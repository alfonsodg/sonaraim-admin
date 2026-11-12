/**
 * @fileoverview Super Admin and Node Operator Console logic for evaluating
 * P2P relay mesh health, Merkle epoch synchronization across federated nodes,
 * and B2B KYB (did:web) verification checklists.
 */

const REQUIRED_KYB_BOOLEAN_CHECKS = Object.freeze([
  'didDocumentHttpsReachable',
  'tlsCertValid',
  'ed25519VerificationMethodPresent',
  'dnsTxtChallengeVerified',
]);

/**
 * Evaluates P2P relay mesh health across reported federated nodes.
 *
 * @param {Array<{nodeId: string, region: string, connected: boolean, latencyMs: number, packetLossPct: number, activeStreams: number}>} peers
 *   List of peer telemetry snapshots.
 * @param {object} thresholds - Explicit operator health thresholds.
 * @param {number} thresholds.maxHealthyLatencyMs - Maximum acceptable latency in milliseconds.
 * @param {number} thresholds.maxHealthyPacketLossPct - Maximum acceptable packet loss percentage.
 * @returns {Readonly<{totalNodes: number, connectedNodes: number, degradedNodes: string[], disconnectedNodes: string[], totalActiveStreams: number, status: 'healthy'|'degraded'|'critical'}>}
 *   Aggregated mesh health report.
 */
export function evaluateMeshHealth(peers, thresholds) {
  if (!Array.isArray(peers) || peers.length === 0) {
    throw new Error('Peers telemetry array must be a non-empty array');
  }
  if (
    !thresholds ||
    typeof thresholds.maxHealthyLatencyMs !== 'number' ||
    typeof thresholds.maxHealthyPacketLossPct !== 'number'
  ) {
    throw new Error('Explicit maxHealthyLatencyMs and maxHealthyPacketLossPct thresholds are required');
  }

  const degradedNodes = [];
  const disconnectedNodes = [];
  let connectedNodes = 0;
  let totalActiveStreams = 0;

  for (const peer of peers) {
    if (!peer.connected) {
      disconnectedNodes.push(peer.nodeId);
      continue;
    }
    connectedNodes += 1;
    totalActiveStreams += Number(peer.activeStreams ?? 0);

    const highLatency = peer.latencyMs > thresholds.maxHealthyLatencyMs;
    const highLoss = peer.packetLossPct > thresholds.maxHealthyPacketLossPct;
    if (highLatency || highLoss) {
      degradedNodes.push(peer.nodeId);
    }
  }

  let status = 'healthy';
  if (disconnectedNodes.length > 0 || connectedNodes === 0) {
    status = 'critical';
  } else if (degradedNodes.length > 0) {
    status = 'degraded';
  }

  return Object.freeze({
    totalNodes: peers.length,
    connectedNodes,
    degradedNodes,
    disconnectedNodes,
    totalActiveStreams,
    status,
  });
}

/**
 * Evaluates Merkle epoch synchronization and detects epoch drift or split-brain
 * conditions across federated Sonaraim nodes.
 *
 * @param {Array<{nodeId: string, epoch: number, merkleRoot: string}>} nodeStates
 *   Reported Merkle epoch states from federated nodes.
 * @param {object} options - Synchronization threshold options.
 * @param {number} options.maxAllowedEpochDrift - Maximum tolerated lag in epochs behind highest epoch.
 * @returns {Readonly<{highestEpoch: number, inSync: boolean, splitBrainDetected: boolean, driftedNodes: Array<{nodeId: string, epoch: number, epochDrift: number}>}>}
 *   Merkle epoch synchronization report.
 */
export function evaluateMerkleEpochSync(nodeStates, options) {
  if (!Array.isArray(nodeStates) || nodeStates.length === 0) {
    throw new Error('nodeStates must be a non-empty array');
  }
  if (!options || typeof options.maxAllowedEpochDrift !== 'number' || options.maxAllowedEpochDrift < 0) {
    throw new Error('maxAllowedEpochDrift must be a non-negative number');
  }

  const highestEpoch = Math.max(...nodeStates.map((n) => n.epoch));
  const rootsByEpoch = new Map();
  let splitBrainDetected = false;
  const driftedNodes = [];

  for (const node of nodeStates) {
    const existingRoot = rootsByEpoch.get(node.epoch);
    if (existingRoot && existingRoot !== node.merkleRoot) {
      splitBrainDetected = true;
    } else {
      rootsByEpoch.set(node.epoch, node.merkleRoot);
    }

    const epochDrift = highestEpoch - node.epoch;
    if (epochDrift > options.maxAllowedEpochDrift) {
      driftedNodes.push({
        nodeId: node.nodeId,
        epoch: node.epoch,
        epochDrift,
      });
    }
  }

  return Object.freeze({
    highestEpoch,
    inSync: !splitBrainDetected && driftedNodes.length === 0,
    splitBrainDetected,
    driftedNodes,
  });
}

/**
 * Evaluates a B2B tenant KYB (Know Your Business) did:web verification checklist.
 *
 * @param {object} submission - KYB verification submission payload.
 * @param {string} submission.tenantDid - Candidate did:web identifier.
 * @param {boolean} submission.didDocumentHttpsReachable - Whether /.well-known/did.json resolved over HTTPS.
 * @param {boolean} submission.tlsCertValid - Whether the TLS certificate chain is valid.
 * @param {boolean} submission.ed25519VerificationMethodPresent - Whether Ed25519 key is present in DID document.
 * @param {boolean} submission.dnsTxtChallengeVerified - Whether DNS TXT ownership challenge passed.
 * @param {string} submission.legalEntityName - Registered legal entity name.
 * @param {string} submission.registrationNumber - Official corporate registration identifier.
 * @returns {Readonly<{tenantDid: string, verified: boolean, failedChecks: string[]}>}
 *   KYB checklist evaluation verdict.
 */
export function evaluateKybChecklist(submission) {
  if (!submission || typeof submission !== 'object') {
    throw new Error('KYB submission must be a valid object');
  }

  const failedChecks = [];

  if (typeof submission.tenantDid !== 'string' || !submission.tenantDid.startsWith('did:web:')) {
    failedChecks.push('tenantDid');
  }

  for (const checkKey of REQUIRED_KYB_BOOLEAN_CHECKS) {
    if (submission[checkKey] !== true) {
      failedChecks.push(checkKey);
    }
  }

  if (typeof submission.legalEntityName !== 'string' || submission.legalEntityName.trim() === '') {
    failedChecks.push('legalEntityName');
  }

  if (typeof submission.registrationNumber !== 'string' || submission.registrationNumber.trim() === '') {
    failedChecks.push('registrationNumber');
  }

  return Object.freeze({
    tenantDid: String(submission.tenantDid ?? ''),
    verified: failedChecks.length === 0,
    failedChecks,
  });
}

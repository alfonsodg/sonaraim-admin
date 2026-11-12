/**
 * @fileoverview Comprehensive test suite for Sonaraim Admin Console modules:
 * zero-hardcode configuration, B2B Card Studio builder/validator, KYB verification,
 * P2P relay mesh health, and Merkle epoch synchronization drift detection.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadAdminConfig,
  buildSonaraimCard,
  validateSonaraimCard,
  createCardSigningManifest,
  evaluateMeshHealth,
  evaluateMerkleEpochSync,
  evaluateKybChecklist,
} from '../src/index.mjs';

test('loadAdminConfig loads valid zero-hardcode environment variables', () => {
  const env = {
    VITE_B2B_API_BASE_URL: 'https://b2b.sonaraim.internal/api/v1/',
    VITE_NODE_API_BASE_URL: 'https://node.sonaraim.internal/api/v1/',
    ADMIN_HTTP_PORT: '8085',
  };

  const config = loadAdminConfig(env);
  assert.equal(config.b2bApiBaseUrl, 'https://b2b.sonaraim.internal/api/v1');
  assert.equal(config.nodeApiBaseUrl, 'https://node.sonaraim.internal/api/v1');
  assert.equal(config.adminHttpPort, 8085);
  assert.equal(Object.isFrozen(config), true);
});

test('loadAdminConfig throws explicit error when required variables are missing or invalid', () => {
  assert.throws(
    () => loadAdminConfig({}),
    /Missing required environment variable: VITE_B2B_API_BASE_URL/
  );

  assert.throws(
    () =>
      loadAdminConfig({
        VITE_B2B_API_BASE_URL: 'not-a-valid-url',
        VITE_NODE_API_BASE_URL: 'https://node.sonaraim.internal',
        ADMIN_HTTP_PORT: '8080',
      }),
    /Invalid URL in environment variable VITE_B2B_API_BASE_URL/
  );

  assert.throws(
    () =>
      loadAdminConfig({
        VITE_B2B_API_BASE_URL: 'https://b2b.sonaraim.internal',
        VITE_NODE_API_BASE_URL: 'https://node.sonaraim.internal',
        ADMIN_HTTP_PORT: '70000',
      }),
    /Invalid port in environment variable ADMIN_HTTP_PORT/
  );
});

test('Card Studio builds, validates, and generates deterministic signing manifest for valid Sonaraim Card', () => {
  const card = buildSonaraimCard({
    cardId: 'card_order_confirm_01',
    version: '1.0.0',
    tenantDid: 'did:web:acme.example.com',
    title: 'Order Confirmation #4821',
    components: [
      {
        id: 'hdr_1',
        type: 'header',
        text: 'Confirm Your Delivery Slot',
      },
      {
        id: 'txt_summary',
        type: 'text',
        text: 'Package arrives tomorrow between 09:00 and 12:00 UTC.',
      },
      {
        id: 'sel_window',
        type: 'select',
        label: 'Time Window',
        options: [
          { value: 'morning', label: '09:00 - 12:00' },
          { value: 'afternoon', label: '13:00 - 17:00' },
        ],
      },
    ],
    actions: [
      {
        id: 'act_confirm',
        type: 'submit_intent',
        label: 'Confirm Slot',
        intentType: 'delivery.slot.confirm',
      },
    ],
  });

  const validation = validateSonaraimCard(card);
  assert.equal(validation.valid, true);
  assert.deepEqual(validation.errors, []);

  const manifest = createCardSigningManifest(card, '2026-11-12T18:00:00Z');
  assert.equal(manifest.cardId, 'card_order_confirm_01');
  assert.equal(manifest.tenantDid, 'did:web:acme.example.com');
  assert.equal(manifest.algorithm, 'Ed25519-BLAKE3');
  assert.match(manifest.payloadDigestHex, /^[0-9a-f]{64}$/);
});

test('Card Studio rejects invalid tenant DID, unsupported component types, and malformed actions', () => {
  const invalidCard = {
    card_id: 'bad card id',
    version: '1.0',
    tenant_did: 'http://insecure.example.com',
    title: '',
    components: [
      {
        id: 'script_inject',
        type: 'remote_iframe',
      },
    ],
    actions: [
      {
        id: 'act_1',
        type: 'arbitrary_eval',
        label: 'Run JS',
      },
    ],
  };

  const result = validateSonaraimCard(invalidCard);
  assert.equal(result.valid, false);
  assert.equal(result.errors.length >= 4, true);
  assert.equal(
    result.errors.some((e) => e.includes('tenant_did')),
    true
  );
  assert.equal(
    result.errors.some((e) => e.includes('Unsupported component type')),
    true
  );
});

test('Operator Console evaluates P2P relay mesh health and flags degraded/critical nodes', () => {
  const peers = [
    {
      nodeId: 'node-eu-1',
      region: 'eu-central',
      connected: true,
      latencyMs: 38,
      packetLossPct: 0.1,
      activeStreams: 120,
    },
    {
      nodeId: 'node-us-1',
      region: 'us-east',
      connected: true,
      latencyMs: 75,
      packetLossPct: 0.4,
      activeStreams: 95,
    },
    {
      nodeId: 'node-ap-1',
      region: 'ap-south',
      connected: true,
      latencyMs: 320,
      packetLossPct: 3.5,
      activeStreams: 40,
    },
  ];

  const report = evaluateMeshHealth(peers, {
    maxHealthyLatencyMs: 250,
    maxHealthyPacketLossPct: 2.0,
  });

  assert.equal(report.totalNodes, 3);
  assert.equal(report.connectedNodes, 3);
  assert.equal(report.degradedNodes.length, 1);
  assert.equal(report.degradedNodes[0], 'node-ap-1');
  assert.equal(report.status, 'degraded');
});

test('Operator Console detects Merkle epoch synchronization drift across federated nodes', () => {
  const nodeStates = [
    {
      nodeId: 'node-eu-1',
      epoch: 1042,
      merkleRoot: 'aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff66667777888899990000',
    },
    {
      nodeId: 'node-us-1',
      epoch: 1042,
      merkleRoot: 'aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff66667777888899990000',
    },
    {
      nodeId: 'node-ap-1',
      epoch: 1038,
      merkleRoot: '1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff',
    },
  ];

  const syncReport = evaluateMerkleEpochSync(nodeStates, { maxAllowedEpochDrift: 2 });
  assert.equal(syncReport.highestEpoch, 1042);
  assert.equal(syncReport.inSync, false);
  assert.equal(syncReport.driftedNodes.length, 1);
  assert.equal(syncReport.driftedNodes[0].nodeId, 'node-ap-1');
  assert.equal(syncReport.driftedNodes[0].epochDrift, 4);
  assert.equal(syncReport.splitBrainDetected, false);
});

test('Operator Console evaluates KYB did:web verification checklist accurately', () => {
  const passedSubmission = {
    tenantDid: 'did:web:bank.example.com',
    didDocumentHttpsReachable: true,
    tlsCertValid: true,
    ed25519VerificationMethodPresent: true,
    dnsTxtChallengeVerified: true,
    legalEntityName: 'Example Bank Corp.',
    registrationNumber: 'REG-99281-EU',
  };

  const approved = evaluateKybChecklist(passedSubmission);
  assert.equal(approved.verified, true);
  assert.equal(approved.failedChecks.length, 0);

  const failedSubmission = {
    ...passedSubmission,
    tlsCertValid: false,
    dnsTxtChallengeVerified: false,
  };

  const rejected = evaluateKybChecklist(failedSubmission);
  assert.equal(rejected.verified, false);
  assert.deepEqual(rejected.failedChecks, ['tlsCertValid', 'dnsTxtChallengeVerified']);
});

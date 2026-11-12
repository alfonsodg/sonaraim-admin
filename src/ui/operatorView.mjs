/**
 * @fileoverview Super Admin & Node Operator Console HTML renderer.
 */

import { escapeHtml, renderAdminShell } from './htmlUtils.mjs';

/**
 * Renders the Node Operator Console showing relay mesh health, Merkle epoch sync,
 * KYB `did:web` verification items, interactive B2B tenant onboarding form,
 * and decentralized P2P peer node registration form.
 *
 * @param {object} state - Operator telemetry snapshot.
 * @param {{status: string, healthyCount: number, totalCount: number}} state.meshSummary
 * @param {{inSync: boolean, maxDriftEpochs: number}} state.epochSummary
 * @param {Array<{did: string, verified: boolean, tlsValid: boolean}>} state.kybItems
 * @param {number} [state.peerCount] - Live connected peer node count.
 * @param {Array<{peerId?: string, peer_id?: string, rpcUrl?: string, rpc_url?: string}>} [state.peers=[]] - Connected peer nodes.
 * @param {string} [state.bannerMessage=''] - Optional action confirmation message.
 * @returns {string} Complete HTML5 document.
 */
export function renderOperatorView({
  meshSummary,
  epochSummary,
  kybItems,
  peerCount,
  peers = [],
  bannerMessage = '',
}) {
  const kybRows = (kybItems ?? [])
    .map(
      (item) =>
        `<li><code>${escapeHtml(item.did)}</code> — verified: ${
          item.verified ? 'YES' : 'NO'
        }, TLS: ${item.tlsValid ? 'OK' : 'FAIL'}</li>`
    )
    .join('');

  const effectivePeerCount = Number(
    peerCount ?? (peers?.length || meshSummary?.healthyCount || 0)
  );

  const peerRows = (peers && peers.length > 0)
    ? peers
        .map(
          (p) =>
            `<li><code>${escapeHtml(p.peerId ?? p.peer_id ?? p.id ?? 'unknown')}</code> — RPC: ${escapeHtml(p.rpcUrl ?? p.rpc_url ?? 'N/A')}</li>`
        )
        .join('')
    : '<li>No external peer nodes registered</li>';

  const bannerHtml = bannerMessage
    ? `<p role="status"><strong>Status:</strong> ${escapeHtml(bannerMessage)}</p>`
    : '';

  const contentHtml = `
    <section aria-labelledby="mesh-heading">
      <h2 id="mesh-heading">P2P Relay Mesh Health</h2>
      ${bannerHtml}
      <p>Status: <strong>${escapeHtml(meshSummary?.status ?? 'UNKNOWN')}</strong></p>
      <p>Connected Peers: <strong>${effectivePeerCount}</strong></p>
      <p>Healthy nodes: ${Number(meshSummary?.healthyCount ?? 0)} / ${Number(meshSummary?.totalCount ?? 0)}</p>
    </section>
    <section aria-labelledby="merkle-heading">
      <h2 id="merkle-heading">Merkle Key Transparency Sync</h2>
      <p>Synchronized: <strong>${epochSummary?.inSync ? 'IN_SYNC' : 'DRIFT_DETECTED'}</strong></p>
      <p>Max epoch drift: ${Number(epochSummary?.maxDriftEpochs ?? 0)}</p>
    </section>
    <section aria-labelledby="kyb-heading">
      <h2 id="kyb-heading">KYB did:web Verification Checklist</h2>
      <ul>${kybRows}</ul>
    </section>
    <section aria-labelledby="peer-registration-heading">
      <h2 id="peer-registration-heading">Register Decentralized Peer Node</h2>
      <form method="POST" action="/operator/peers">
        <label for="op-peer-id">
          Peer Node ID
          <input id="op-peer-id" name="peerId" type="text" required value="node-eu-central-1" />
        </label>
        <label for="op-peer-rpc">
          Peer RPC URL
          <input id="op-peer-rpc" name="rpcUrl" type="url" required value="http://127.0.0.1:8081" />
        </label>
        <label for="op-peer-multiaddr">
          QUIC Multiaddr (Optional)
          <input id="op-peer-multiaddr" name="multiaddr" type="text" value="/ip4/127.0.0.1/udp/9001/quic-v1" />
        </label>
        <button type="submit">Register Peer</button>
      </form>
    </section>
    <section aria-labelledby="peer-list-heading">
      <h2 id="peer-list-heading">Federated Peer Nodes</h2>
      <ul>${peerRows}</ul>
    </section>
    <section aria-labelledby="tenant-provision-heading">
      <h2 id="tenant-provision-heading">Provision B2B Enterprise Tenant</h2>
      <form method="POST" action="/operator/tenants">
        <label for="op-tenant-did">
          Tenant DID (did:web)
          <input id="op-tenant-did" name="tenantDid" type="text" required value="did:web:clinic.example.com" />
        </label>
        <label for="op-tenant-apikey">
          Tenant API Key
          <input id="op-tenant-apikey" name="apiKey" type="password" required value="" />
        </label>
        <label for="op-tenant-tier">
          Subscription Tier
          <input id="op-tenant-tier" name="tier" type="text" value="SMB_PRO" />
        </label>
        <label for="op-tenant-seats">
          Max Operator Seats
          <input id="op-tenant-seats" name="seats" type="number" value="10" />
        </label>
        <label for="op-admin-key">
          Admin Key (X-Sonaraim-Admin-Key)
          <input id="op-admin-key" name="adminKey" type="password" value="" />
        </label>
        <button type="submit">Provision Tenant</button>
      </form>
    </section>`;

  return renderAdminShell({
    title: 'Sonaraim Operator Console',
    activeTab: 'operator',
    contentHtml,
  });
}

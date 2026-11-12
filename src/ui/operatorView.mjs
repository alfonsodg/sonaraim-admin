/**
 * @fileoverview Super Admin & Node Operator Console HTML renderer.
 */

import { escapeHtml, renderAdminShell } from './htmlUtils.mjs';

/**
 * Renders the Node Operator Console showing relay mesh health, Merkle epoch sync,
 * and KYB `did:web` verification items with strict HTML escaping.
 *
 * @param {object} state - Operator telemetry snapshot.
 * @param {{status: string, healthyCount: number, totalCount: number}} state.meshSummary
 * @param {{inSync: boolean, maxDriftEpochs: number}} state.epochSummary
 * @param {Array<{did: string, verified: boolean, tlsValid: boolean}>} state.kybItems
 * @returns {string} Complete HTML5 document.
 */
export function renderOperatorView({ meshSummary, epochSummary, kybItems }) {
  const kybRows = (kybItems ?? [])
    .map(
      (item) =>
        `<li><code>${escapeHtml(item.did)}</code> — verified: ${
          item.verified ? 'YES' : 'NO'
        }, TLS: ${item.tlsValid ? 'OK' : 'FAIL'}</li>`
    )
    .join('');

  const contentHtml = `
    <section aria-labelledby="mesh-heading">
      <h2 id="mesh-heading">P2P Relay Mesh Health</h2>
      <p>Status: <strong>${escapeHtml(meshSummary?.status ?? 'UNKNOWN')}</strong></p>
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
    </section>`;

  return renderAdminShell({
    title: 'Sonaraim Operator Console',
    activeTab: 'operator',
    contentHtml,
  });
}

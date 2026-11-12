/**
 * @fileoverview B2B Tenant Card Studio & Campaign Analytics HTML renderer.
 */

import { escapeHtml, renderAdminShell } from './htmlUtils.mjs';

/**
 * Renders the B2B Tenant Card Studio preview and 0%-markup campaign summary.
 *
 * @param {object} state - Card Studio state.
 * @param {string} state.tenantDid - Verified enterprise `did:web` identifier.
 * @param {string} state.cardTitle - Declarative Sonaraim Card title.
 * @param {string} state.manifestHash - Deterministic signing manifest hash.
 * @param {number} state.actionsCount - Number of interactive card actions.
 * @returns {string} Complete HTML5 document.
 */
export function renderStudioView({ tenantDid, cardTitle, manifestHash, actionsCount }) {
  const contentHtml = `
    <section aria-labelledby="studio-builder">
      <h2 id="studio-builder">Declarative Card Preview</h2>
      <p>Tenant DID: <code>${escapeHtml(tenantDid)}</code></p>
      <p>Card Title: <strong>${escapeHtml(cardTitle)}</strong></p>
      <p>Interactive Actions: ${Number(actionsCount ?? 0)}</p>
    </section>
    <section aria-labelledby="studio-manifest">
      <h2 id="studio-manifest">Signing Manifest & Billing</h2>
      <p>Manifest Digest: <code>${escapeHtml(manifestHash)}</code></p>
      <p>Messaging Policy: <strong>0% per-message markup</strong></p>
    </section>`;

  return renderAdminShell({
    title: 'Sonaraim Card Studio',
    activeTab: 'studio',
    contentHtml,
  });
}

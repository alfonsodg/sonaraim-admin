/**
 * @fileoverview B2B Tenant Card Studio & Campaign Analytics HTML renderer.
 */

import { escapeHtml, renderAdminShell } from './htmlUtils.mjs';

/**
 * Renders the B2B Tenant Card Studio interactive builder form, preview, and 0%-markup campaign summary.
 *
 * @param {object} state - Card Studio state.
 * @param {string} state.tenantDid - Verified enterprise `did:web` identifier.
 * @param {string} state.cardTitle - Declarative Sonaraim Card title.
 * @param {string} [state.actionLabel='Confirm Action'] - Primary interactive action button label.
 * @param {string} state.manifestHash - Deterministic signing manifest hash.
 * @param {number} state.actionsCount - Number of interactive card actions.
 * @returns {string} Complete HTML5 document.
 */
export function renderStudioView({
  tenantDid,
  cardTitle,
  actionLabel = 'Confirm Action',
  manifestHash,
  actionsCount,
}) {
  const safeTenantDid = escapeHtml(tenantDid);
  const safeCardTitle = escapeHtml(cardTitle);
  const safeActionLabel = escapeHtml(actionLabel);
  const safeManifestHash = escapeHtml(manifestHash);

  const contentHtml = `
    <section aria-labelledby="studio-form-heading">
      <h2 id="studio-form-heading">Interactive Card Studio Builder</h2>
      <form method="POST" action="/studio/cards">
        <label for="studio-tenant-did">
          Tenant DID (did:web)
          <input id="studio-tenant-did" name="tenantDid" type="text" required value="${safeTenantDid}" />
        </label>
        <label for="studio-card-title">
          Card Title
          <input id="studio-card-title" name="cardTitle" type="text" required value="${safeCardTitle}" />
        </label>
        <label for="studio-action-label">
          Action Label
          <input id="studio-action-label" name="actionLabel" type="text" required value="${safeActionLabel}" />
        </label>
        <button type="submit">Build &amp; Sign Card</button>
      </form>
    </section>
    <section aria-labelledby="studio-builder">
      <h2 id="studio-builder">Declarative Card Preview</h2>
      <p>Tenant DID: <code>${safeTenantDid}</code></p>
      <p>Card Title: <strong>${safeCardTitle}</strong></p>
      <p>Primary Action: <span>${safeActionLabel}</span></p>
      <p>Interactive Actions: ${Number(actionsCount ?? 0)}</p>
    </section>
    <section aria-labelledby="studio-manifest">
      <h2 id="studio-manifest">Signing Manifest &amp; Billing</h2>
      <p>Manifest Digest: <code id="manifest-digest">${safeManifestHash}</code></p>
      <p>Messaging Policy: <strong>0% per-message markup</strong></p>
    </section>`;

  return renderAdminShell({
    title: 'Sonaraim Card Studio',
    activeTab: 'studio',
    contentHtml,
  });
}

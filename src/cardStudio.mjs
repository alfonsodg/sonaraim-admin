/**
 * @fileoverview B2B Tenant Console Visual Card Studio builder, schema validator,
 * and cryptographic signing manifest generator for declarative Sonaraim Cards.
 */

import { createHash } from 'node:crypto';

const ALLOWED_COMPONENT_TYPES = new Set([
  'header',
  'text',
  'input',
  'select',
  'date_picker',
  'key_value_list',
]);

const ALLOWED_ACTION_TYPES = new Set([
  'submit_intent',
  'approve_payment',
  'dismiss',
]);

const CARD_ID_PATTERN = /^[a-zA-Z0-9_-]{3,64}$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
const DID_WEB_PATTERN = /^did:web:[a-zA-Z0-9.-]+(:[a-zA-Z0-9._-]+)*$/;

/**
 * Builds a normalized declarative Sonaraim Card definition from B2B Studio input.
 *
 * @param {object} params - Builder input parameters.
 * @param {string} params.cardId - Unique identifier for the card template.
 * @param {string} params.version - Semantic version string (MAJOR.MINOR.PATCH).
 * @param {string} params.tenantDid - Verified B2B organization did:web identifier.
 * @param {string} params.title - Accessible card title.
 * @param {Array<object>} params.components - Ordered array of declarative UI components.
 * @param {Array<object>} params.actions - Ordered array of deterministic user actions.
 * @returns {Readonly<object>} Frozen declarative Sonaraim Card payload.
 */
export function buildSonaraimCard({
  cardId,
  version,
  tenantDid,
  title,
  components = [],
  actions = [],
}) {
  return Object.freeze({
    schema: 'sonaraim.card.v1',
    card_id: String(cardId ?? '').trim(),
    version: String(version ?? '').trim(),
    tenant_did: String(tenantDid ?? '').trim(),
    title: String(title ?? '').trim(),
    components: components.map((comp) => Object.freeze({ ...comp })),
    actions: actions.map((act) => Object.freeze({ ...act })),
  });
}

/**
 * Validates a Sonaraim Card definition against strict zero-code-execution rules.
 * Ensures only safe declarative components and structured actions are present.
 *
 * @param {object} card - Candidate Sonaraim Card object.
 * @returns {{valid: boolean, errors: string[]}} Validation result with detailed error list.
 */
export function validateSonaraimCard(card) {
  const errors = [];

  if (!card || typeof card !== 'object') {
    return { valid: false, errors: ['Card payload must be a non-null object'] };
  }

  if (!CARD_ID_PATTERN.test(String(card.card_id ?? ''))) {
    errors.push('Invalid card_id: must match /^[a-zA-Z0-9_-]{3,64}$/');
  }

  if (!SEMVER_PATTERN.test(String(card.version ?? ''))) {
    errors.push('Invalid version: must be valid SemVer (MAJOR.MINOR.PATCH)');
  }

  if (!DID_WEB_PATTERN.test(String(card.tenant_did ?? ''))) {
    errors.push('Invalid tenant_did: must be a valid did:web identifier');
  }

  if (typeof card.title !== 'string' || card.title.trim().length === 0) {
    errors.push('Invalid title: must be a non-empty string');
  }

  if (!Array.isArray(card.components) || card.components.length === 0) {
    errors.push('Card must contain at least one declarative component');
  } else {
    card.components.forEach((comp, idx) => {
      if (!comp || typeof comp.id !== 'string' || comp.id.trim() === '') {
        errors.push(`Component at index ${idx} is missing a valid id`);
      }
      if (!ALLOWED_COMPONENT_TYPES.has(comp?.type)) {
        errors.push(`Unsupported component type at index ${idx}: "${comp?.type}"`);
      }
      if (comp?.type === 'select' && (!Array.isArray(comp.options) || comp.options.length === 0)) {
        errors.push(`Select component "${comp.id}" must define a non-empty options array`);
      }
    });
  }

  if (!Array.isArray(card.actions) || card.actions.length === 0) {
    errors.push('Card must define at least one structured action');
  } else {
    card.actions.forEach((act, idx) => {
      if (!act || typeof act.id !== 'string' || act.id.trim() === '') {
        errors.push(`Action at index ${idx} is missing a valid id`);
      }
      if (!ALLOWED_ACTION_TYPES.has(act?.type)) {
        errors.push(`Unsupported action type at index ${idx}: "${act?.type}"`);
      }
      if (typeof act?.label !== 'string' || act.label.trim() === '') {
        errors.push(`Action "${act?.id ?? idx}" must include a non-empty label`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generates a deterministic signing manifest for a validated Sonaraim Card so
 * the B2B tenant key holder can sign it with their Ed25519 identity key.
 *
 * @param {object} card - Validated Sonaraim Card object.
 * @param {string} issuedAtIso - ISO-8601 timestamp string for signature issuance.
 * @returns {Readonly<{cardId: string, version: string, tenantDid: string, issuedAt: string, algorithm: string, payloadDigestHex: string}>}
 *   Deterministic signing manifest.
 * @throws {Error} If the card fails schema validation or timestamp is missing.
 */
export function createCardSigningManifest(card, issuedAtIso) {
  const validation = validateSonaraimCard(card);
  if (!validation.valid) {
    throw new Error(`Cannot create signing manifest for invalid card: ${validation.errors.join('; ')}`);
  }
  if (!issuedAtIso || Number.isNaN(Date.parse(issuedAtIso))) {
    throw new Error('Valid ISO-8601 issuedAtIso timestamp is required');
  }

  const canonicalPayload = JSON.stringify({
    schema: card.schema ?? 'sonaraim.card.v1',
    card_id: card.card_id,
    version: card.version,
    tenant_did: card.tenant_did,
    title: card.title,
    components: card.components,
    actions: card.actions,
    issued_at: issuedAtIso,
  });

  const payloadDigestHex = createHash('sha256').update(canonicalPayload).digest('hex');

  return Object.freeze({
    cardId: card.card_id,
    version: card.version,
    tenantDid: card.tenant_did,
    issuedAt: issuedAtIso,
    algorithm: 'Ed25519-BLAKE3',
    payloadDigestHex,
  });
}

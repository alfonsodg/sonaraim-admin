/**
 * @fileoverview SaaS Plan Billing, Operator Seat Management, and 0%-markup Take-Rate Analytics.
 */

const SUPPORTED_PROVIDERS = new Set(['stripe', 'mercado_pago', 'yape_plin', 'stablecoin_usdc']);

/**
 * Creates a mutable operator seat ledger for a B2B tenant with 0 per-message fee.
 *
 * @param {object} params - Tenant plan configuration.
 * @param {string} params.tenantDid - Verified enterprise `did:web` identifier.
 * @param {string} params.tier - Subscription tier (`FREE`, `SMB_PRO`, `ENTERPRISE_SOVEREIGN`).
 * @param {number} params.maxSeats - Maximum allowed operator seats.
 * @returns {{tenantDid: string, tier: string, maxSeats: number, perMessageFee: number, assignSeat: (email: string) => number, listSeats: () => string[]}}
 */
export function createTenantBillingLedger({ tenantDid, tier, maxSeats }) {
  if (!tenantDid || !String(tenantDid).startsWith('did:web:')) {
    throw new Error('tenantDid must be a valid did:web identifier');
  }
  if (!Number.isInteger(maxSeats) || maxSeats < 1) {
    throw new Error('maxSeats must be a positive integer');
  }

  const seats = new Set();

  return {
    tenantDid,
    tier,
    maxSeats,
    perMessageFee: 0,
    assignSeat(email) {
      const normalized = String(email ?? '').trim();
      if (!normalized) {
        throw new Error('Operator email cannot be empty');
      }
      if (seats.size >= maxSeats && !seats.has(normalized)) {
        throw new Error(`Seat limit reached (${maxSeats}) for tenant ${tenantDid}`);
      }
      seats.add(normalized);
      return seats.size;
    },
    listSeats() {
      return [...seats];
    },
  };
}

/**
 * Computes payment take-rate fee and merchant net amount in minor currency units.
 *
 * @param {object} params - Payment intent parameters.
 * @param {string} params.provider - Payment rail identifier.
 * @param {number} params.amountMinor - Gross amount in minor units (e.g., cents).
 * @param {number} params.takeRateBps - Platform take-rate in basis points (0..10000).
 * @returns {{provider: string, amountMinor: number, takeRateFeeMinor: number, netMinor: number}}
 */
export function computeAdminTakeRate({ provider, amountMinor, takeRateBps }) {
  const slug = String(provider ?? '').trim().toLowerCase();
  if (!SUPPORTED_PROVIDERS.has(slug)) {
    throw new Error(`Unsupported payment provider: ${provider}`);
  }
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new Error('amountMinor must be a positive integer');
  }
  if (!Number.isInteger(takeRateBps) || takeRateBps < 0 || takeRateBps > 10000) {
    throw new Error('takeRateBps must be between 0 and 10000');
  }
  const takeRateFeeMinor = Math.floor((amountMinor * takeRateBps) / 10000);
  const netMinor = amountMinor - takeRateFeeMinor;
  return { provider: slug, amountMinor, takeRateFeeMinor, netMinor };
}

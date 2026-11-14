/**
 * @fileoverview Milestone 4 TDD integration tests for @sonaraim/admin:
 * Operator Console UI, B2B Card Studio UI, Tenant Billing & Seat Management,
 * and zero-hardcode HTTP server routes.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import {
  renderOperatorView,
  renderStudioView,
  createTenantBillingLedger,
  computeAdminTakeRate,
  startAdminTestServer,
} from '../src/index.mjs';

function fetchText(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      })
      .on('error', reject);
  });
}

test('renderOperatorView renders mesh health, Merkle epoch sync, and KYB checklist safely', () => {
  const html = renderOperatorView({
    meshSummary: { status: 'HEALTHY', healthyCount: 3, totalCount: 3 },
    epochSummary: { inSync: true, maxDriftEpochs: 0 },
    kybItems: [
      { did: 'did:web:clinic.example.com', verified: true, tlsValid: true },
      { did: 'did:web:rogue.example.com<script>', verified: false, tlsValid: false },
    ],
  });

  assert.match(html, /<!doctype html>/i);
  assert.match(html, /Sonaraim Operator Console/);
  assert.match(html, /HEALTHY/);
  assert.match(html, /did:web:clinic\.example\.com/);
  assert.doesNotMatch(html, /<script>alert|<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /@media\s*\(/);
});

test('renderStudioView renders declarative Card Studio preview and zero per-message fee badge', () => {
  const html = renderStudioView({
    tenantDid: 'did:web:clinic.example.com',
    cardTitle: 'Appointment Confirmation',
    manifestHash: 'abc123def456',
    actionsCount: 2,
  });

  assert.match(html, /<!doctype html>/i);
  assert.match(html, /Sonaraim Card Studio/);
  assert.match(html, /Appointment Confirmation/);
  assert.match(html, /0% per-message markup/i);
  assert.match(html, /abc123def456/);
});

test('tenant billing enforces seat limits and computes zero-markup take-rate', () => {
  const ledger = createTenantBillingLedger({
    tenantDid: 'did:web:clinic.example.com',
    tier: 'SMB_PRO',
    maxSeats: 2,
  });

  assert.equal(ledger.perMessageFee, 0);
  ledger.assignSeat('op-1@clinic.example.com');
  ledger.assignSeat('op-2@clinic.example.com');
  assert.throws(() => ledger.assignSeat('op-3@clinic.example.com'), /seat limit/i);

  const fee = computeAdminTakeRate({
    provider: 'yape_plin',
    amountMinor: 10000,
    takeRateBps: 50,
  });
  assert.equal(fee.takeRateFeeMinor, 50);
  assert.equal(fee.netMinor, 9950);
});

test('startAdminTestServer serves /health, /operator, /studio, and /api/billing/summary', async () => {
  const cfg = Object.freeze({
    b2bApiBaseUrl: 'http://127.0.0.1:8080',
    nodeApiBaseUrl: 'http://127.0.0.1:8090',
    adminHttpPort: 0,
    allowUnauthenticatedDev: true,
  });

  const { baseUrl, close } = await startAdminTestServer(cfg);
  try {
    const health = await fetchText(`${baseUrl}/health`);
    assert.equal(health.status, 200);
    assert.match(health.body, /"service":"sonaraim-admin"/);

    const operator = await fetchText(`${baseUrl}/operator`);
    assert.equal(operator.status, 200);
    assert.match(operator.body, /Sonaraim Operator Console/);

    const studio = await fetchText(`${baseUrl}/studio`);
    assert.equal(studio.status, 200);
    assert.match(studio.body, /Sonaraim Card Studio/);

    const billing = await fetchText(`${baseUrl}/api/billing/summary`);
    assert.equal(billing.status, 200);
    assert.match(billing.body, /"perMessageFee":0/);
  } finally {
    await close();
  }
});

/**
 * @fileoverview TDD test suite for Issue #15 (sonaraim-admin):
 * the tenant apiKey must never be reflected back into the studio view
 * markup; only a masked preview (sk-....abcd) may be shown.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { startAdminTestServer, renderStudioView } from '../src/index.mjs';
import { isolateDevAuthEnv, restoreTestEnv } from './testEnv.mjs';

/**
 * Helper to perform HTTP GET or POST requests against local test servers.
 *
 * @param {string} url - Target URL.
 * @param {object} [options] - Optional method, headers, and body.
 * @returns {Promise<{status: number, headers: http.IncomingHttpHeaders, body: string}>}
 */
function requestHttp(url, { method = 'GET', headers = {}, body = '' } = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method,
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: data,
          })
        );
      }
    );
    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

test('Issue #15: renderStudioView never embeds the full apiKey, only a masked preview', () => {
  const fullKey = 'sk-live-tenant-secret-00ab';
  const html = renderStudioView({
    tenantDid: 'did:web:clinic.example.com',
    cardTitle: 'Card',
    actionLabel: 'Join',
    manifestHash: 'ab'.repeat(32),
    actionsCount: 1,
    recipientDid: 'did:sonaraim:alice',
    apiKeyPreview: 'sk-…00ab',
  });

  assert.doesNotMatch(html, /sk-live-tenant-secret-00ab/);
  assert.match(html, /sk-…00ab/);
});

test('Issue #15: POST /studio/cards HTML never contains the full submitted apiKey', async () => {
  const __envSnapshot = isolateDevAuthEnv();
  try {
  const fullKey = 'sk-live-super-secret-key-1234abcd';
  const cfg = Object.freeze({
    b2bApiBaseUrl: 'http://127.0.0.1:59998',
    nodeApiBaseUrl: 'http://127.0.0.1:59999',
    adminHttpPort: 0,
    allowUnauthenticatedDev: true,
  });

  const { baseUrl, close } = await startAdminTestServer(cfg);
  try {
    const formBody = new URLSearchParams({
      tenantDid: 'did:web:clinic.example.com',
      cardTitle: 'Secret Key Card',
      actionLabel: 'Open',
      apiKey: fullKey,
    }).toString();

    const res = await requestHttp(`${baseUrl}/studio/cards`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': String(Buffer.byteLength(formBody)),
      },
      body: formBody,
    });

    assert.equal(res.status, 200);
    assert.ok(!res.body.includes(fullKey), 'full apiKey leaked into response HTML');
    assert.match(res.body, /sk-…abcd/);
  } finally {
    await close();
  }
  } finally {
    restoreTestEnv(__envSnapshot);
  }
});

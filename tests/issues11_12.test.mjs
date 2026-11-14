/**
 * @fileoverview TDD test suite for Issues #11 and #12:
 * - Issue #11: Peer registration form inputs in operatorView.mjs use placeholders instead of hardcoded values.
 * - Issue #12: Operator authentication gate fails closed when ADMIN_OPERATOR_TOKEN is unset.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import {
  renderOperatorView,
  isOperatorAuthorized,
  startAdminTestServer,
} from '../src/index.mjs';

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

test('Issue #11: renderOperatorView uses placeholders instead of hardcoded values on POST /operator/peers inputs', () => {
  const html = renderOperatorView({
    meshSummary: { status: 'HEALTHY', healthyCount: 1, totalCount: 1 },
    epochSummary: { inSync: true, maxDriftEpochs: 0 },
    kybItems: [],
  });

  assert.match(html, /<input[^>]+name="peerId"[^>]+required[^>]+placeholder="node-eu-central-1"/);
  assert.match(html, /<input[^>]+name="rpcUrl"[^>]+required[^>]+placeholder="http:\/\/127\.0\.0\.1:8081"/);
  assert.match(html, /<input[^>]+name="multiaddr"[^>]+placeholder="\/ip4\/127\.0\.0\.1\/udp\/9001\/quic-v1"/);

  assert.doesNotMatch(html, /value="node-eu-central-1"/);
  assert.doesNotMatch(html, /value="http:\/\/127\.0\.0\.1:8081"/);
  assert.doesNotMatch(html, /value="\/ip4\/127\.0\.0\.1\/udp\/9001\/quic-v1"/);
});

test('Issue #12: isOperatorAuthorized fails closed when operatorToken is unset unless explicit dev opt-in is enabled outside production', () => {
  const prevToken = process.env.ADMIN_OPERATOR_TOKEN;
  const prevNoAuth = process.env.ADMIN_ALLOW_DEV_NOAUTH;
  const prevNodeEnv = process.env.NODE_ENV;

  try {
    delete process.env.ADMIN_OPERATOR_TOKEN;
    delete process.env.ADMIN_ALLOW_DEV_NOAUTH;
    process.env.NODE_ENV = 'test';

    assert.equal(isOperatorAuthorized({ headers: {} }, {}), false);
    assert.equal(isOperatorAuthorized({ headers: {} }, { operatorToken: '' }), false);
    assert.equal(
      isOperatorAuthorized({ headers: {} }, { allowUnauthenticatedDev: true }),
      true
    );

    process.env.ADMIN_ALLOW_DEV_NOAUTH = 'true';
    assert.equal(isOperatorAuthorized({ headers: {} }, {}), true);

    process.env.NODE_ENV = 'production';
    assert.equal(isOperatorAuthorized({ headers: {} }, {}), false);
    assert.equal(
      isOperatorAuthorized({ headers: {} }, { allowUnauthenticatedDev: true }),
      false
    );
  } finally {
    if (prevToken === undefined) delete process.env.ADMIN_OPERATOR_TOKEN;
    else process.env.ADMIN_OPERATOR_TOKEN = prevToken;

    if (prevNoAuth === undefined) delete process.env.ADMIN_ALLOW_DEV_NOAUTH;
    else process.env.ADMIN_ALLOW_DEV_NOAUTH = prevNoAuth;

    if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNodeEnv;
  }
});

test('Issue #12: HTTP server returns 401 Unauthorized on protected routes when operatorToken is unset without dev opt-in', async () => {
  const prevToken = process.env.ADMIN_OPERATOR_TOKEN;
  const prevNoAuth = process.env.ADMIN_ALLOW_DEV_NOAUTH;

  try {
    delete process.env.ADMIN_OPERATOR_TOKEN;
    delete process.env.ADMIN_ALLOW_DEV_NOAUTH;

    const cfg = Object.freeze({
      b2bApiBaseUrl: 'http://127.0.0.1:59998',
      nodeApiBaseUrl: 'http://127.0.0.1:59999',
      adminHttpPort: 0,
    });

    const { baseUrl, close } = await startAdminTestServer(cfg);
    try {
      const healthRes = await requestHttp(`${baseUrl}/health`);
      assert.equal(healthRes.status, 200);

      const operatorRes = await requestHttp(`${baseUrl}/operator`);
      assert.equal(operatorRes.status, 401);

      const studioRes = await requestHttp(`${baseUrl}/studio`);
      assert.equal(studioRes.status, 401);

      const billingRes = await requestHttp(`${baseUrl}/api/billing/summary`);
      assert.equal(billingRes.status, 401);

      const loginPostRes = await requestHttp(`${baseUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'operatorToken=anything',
      });
      assert.equal(loginPostRes.status, 401);
    } finally {
      await close();
    }
  } finally {
    if (prevToken === undefined) delete process.env.ADMIN_OPERATOR_TOKEN;
    else process.env.ADMIN_OPERATOR_TOKEN = prevToken;

    if (prevNoAuth === undefined) delete process.env.ADMIN_ALLOW_DEV_NOAUTH;
    else process.env.ADMIN_ALLOW_DEV_NOAUTH = prevNoAuth;
  }
});

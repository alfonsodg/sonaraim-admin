/**
 * @fileoverview Milestone 11 TDD test suite for Issues #7, #8, #9, and #10:
 * Zero-Trust operator authentication gate (#7), B2B tenant provisioning (#8),
 * live Card Studio B2B message dispatch (#9), and P2P peer node registration (#10).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import {
  startAdminTestServer,
  createOperatorSessionToken,
  isOperatorAuthorized,
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

test('Issue #7: enforces 401 when operatorToken is configured and authenticates via POST /login session cookie and Bearer token', async () => {
  const cfg = Object.freeze({
    b2bApiBaseUrl: 'http://127.0.0.1:59998',
    nodeApiBaseUrl: 'http://127.0.0.1:59999',
    adminHttpPort: 0,
    operatorToken: 'sec-op-token-99',
  });

  const sessionToken = createOperatorSessionToken('sec-op-token-99');
  assert.match(sessionToken, /^[0-9a-f]{64}$/);
  assert.equal(
    isOperatorAuthorized({ headers: { authorization: 'Bearer sec-op-token-99' } }, cfg),
    true
  );

  const { baseUrl, close } = await startAdminTestServer(cfg);
  try {
    const openHealth = await requestHttp(`${baseUrl}/health`);
    assert.equal(openHealth.status, 200);

    const openMetrics = await requestHttp(`${baseUrl}/metrics`);
    assert.equal(openMetrics.status, 200);

    const loginPage = await requestHttp(`${baseUrl}/login`);
    assert.equal(loginPage.status, 200);
    assert.match(loginPage.body, /<form[^>]+method="POST"[^>]+action="\/login"/i);

    const unauthOperator = await requestHttp(`${baseUrl}/operator`);
    assert.equal(unauthOperator.status, 401);

    const badLoginBody = new URLSearchParams({ operatorToken: 'wrong-token' }).toString();
    const badLogin = await requestHttp(`${baseUrl}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': String(Buffer.byteLength(badLoginBody)),
      },
      body: badLoginBody,
    });
    assert.equal(badLogin.status, 401);

    const goodLoginBody = new URLSearchParams({ operatorToken: 'sec-op-token-99' }).toString();
    const goodLogin = await requestHttp(`${baseUrl}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': String(Buffer.byteLength(goodLoginBody)),
      },
      body: goodLoginBody,
    });
    assert.equal(goodLogin.status, 200);
    const setCookie = String(goodLogin.headers['set-cookie']?.[0] ?? '');
    assert.match(setCookie, /sonaraim_operator_session=/);
    const cookiePair = setCookie.split(';')[0];

    const authedCookie = await requestHttp(`${baseUrl}/operator`, {
      headers: { Cookie: cookiePair },
    });
    assert.equal(authedCookie.status, 200);

    const authedBearer = await requestHttp(`${baseUrl}/studio`, {
      headers: { Authorization: 'Bearer sec-op-token-99' },
    });
    assert.equal(authedBearer.status, 200);
  } finally {
    await close();
  }
});

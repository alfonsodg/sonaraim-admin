/**
 * @fileoverview TDD test suite for Issue #14 (sonaraim-admin):
 * handleOperatorLogin must compare the submitted operator token in
 * constant time via the same safeEqualString helper used by the rest
 * of the auth gate (Bearer + session cookie).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import {
  handleOperatorLogin,
  createOperatorSessionToken,
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

/**
 * Builds a fake ServerResponse capturing status, headers, and body.
 *
 * @returns {{res: object, captured: {status: number, body: string, headers: object}}}
 */
function fakeResponse() {
  const captured = { status: 0, body: '', headers: {} };
  const res = {
    writeHead(status, headers = {}) {
      captured.status = status;
      captured.headers = headers;
    },
    end(body = '') {
      captured.body = String(body ?? '');
    },
  };
  return { res, captured };
}

test('Issue #14: handleOperatorLogin accepts the exact configured token and rejects wrong/empty candidates', async () => {
  const cfg = Object.freeze({ operatorToken: 'sec-op-token-14', allowUnauthenticatedDev: false });

  const okBody = new URLSearchParams({ operatorToken: 'sec-op-token-14' }).toString();
  const okReq = new http.IncomingMessage(null);
  okReq.headers = { 'content-type': 'application/x-www-form-urlencoded' };
  okReq.push(okBody);
  okReq.push(null);
  const { res: okRes, captured: okCap } = fakeResponse();
  await handleOperatorLogin(okReq, okRes, cfg);
  assert.equal(okCap.status, 200);
  const okSession = String(okCap.headers['Set-Cookie'] ?? '');
  assert.match(okSession, /sonaraim_operator_session=[0-9a-f]{64}; HttpOnly/);

  const wrongBody = new URLSearchParams({ operatorToken: 'sec-op-token-1X' }).toString();
  const wrongReq = new http.IncomingMessage(null);
  wrongReq.headers = { 'content-type': 'application/x-www-form-urlencoded' };
  wrongReq.push(wrongBody);
  wrongReq.push(null);
  const { res: wrongRes, captured: wrongCap } = fakeResponse();
  await handleOperatorLogin(wrongReq, wrongRes, cfg);
  assert.equal(wrongCap.status, 401);
  assert.match(wrongCap.body, /Invalid operator token/);

  const prefixBody = new URLSearchParams({ operatorToken: 'sec-op-token-14-extra' }).toString();
  const prefixReq = new http.IncomingMessage(null);
  prefixReq.headers = { 'content-type': 'application/x-www-form-urlencoded' };
  prefixReq.push(prefixBody);
  prefixReq.push(null);
  const { res: prefixRes, captured: prefixCap } = fakeResponse();
  await handleOperatorLogin(prefixReq, prefixRes, cfg);
  assert.equal(prefixCap.status, 401);

  const emptyReq = new http.IncomingMessage(null);
  emptyReq.headers = { 'content-type': 'application/x-www-form-urlencoded' };
  emptyReq.push('');
  emptyReq.push(null);
  const { res: emptyRes, captured: emptyCap } = fakeResponse();
  await handleOperatorLogin(emptyReq, emptyRes, cfg);
  assert.equal(emptyCap.status, 401);
});

test('Issue #14: POST /login with wrong token is rejected and a forged session cookie does not authorize', async () => {
  const cfg = Object.freeze({
    b2bApiBaseUrl: 'http://127.0.0.1:59998',
    nodeApiBaseUrl: 'http://127.0.0.1:59999',
    adminHttpPort: 0,
    operatorToken: 'sec-op-token-14',
  });

  const { baseUrl, close } = await startAdminTestServer(cfg);
  try {
    const wrongBody = new URLSearchParams({ operatorToken: 'wrong-token' }).toString();
    const wrong = await requestHttp(`${baseUrl}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': String(Buffer.byteLength(wrongBody)),
      },
      body: wrongBody,
    });
    assert.equal(wrong.status, 401);

    const goodBody = new URLSearchParams({ operatorToken: 'sec-op-token-14' }).toString();
    const good = await requestHttp(`${baseUrl}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': String(Buffer.byteLength(goodBody)),
      },
      body: goodBody,
    });
    assert.equal(good.status, 200);
    const cookiePair = String(good.headers['set-cookie']?.[0] ?? '').split(';')[0];
    const sessionVal = cookiePair.split('=')[1];
    assert.equal(sessionVal, createOperatorSessionToken('sec-op-token-14'));

    const forged = await requestHttp(`${baseUrl}/operator`, {
      headers: { Cookie: 'sonaraim_operator_session=0'.repeat(64).slice(0, 64) },
    });
    assert.equal(forged.status, 401);

    const valid = await requestHttp(`${baseUrl}/operator`, {
      headers: { Cookie: cookiePair },
    });
    assert.equal(valid.status, 200);

    assert.equal(
      isOperatorAuthorized({ headers: { authorization: 'Bearer sec-op-token-1X' } }, cfg),
      false
    );
    assert.equal(
      isOperatorAuthorized({ headers: { authorization: 'Bearer sec-op-token-14' } }, cfg),
      true
    );
  } finally {
    await close();
  }
});

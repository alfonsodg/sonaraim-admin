/**
 * @fileoverview TDD test suite for Issue #17 (sonaraim-admin):
 * GET /api/live-telemetry/stream emits SSE events (content-type
 * text/event-stream) with pre-escaped data, and the /operator view
 * subscribes via a minimal inline EventSource script with progressive
 * enhancement (full SSR without JS).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { startAdminTestServer, renderOperatorView } from '../src/index.mjs';
import { isolateDevAuthEnv, restoreTestEnv } from './testEnv.mjs';

/**
 * Consumes at least `minEvents` SSE data frames from a stream URL.
 *
 * @param {string} url - SSE endpoint URL.
 * @param {object} [options] - Request options.
 * @param {number} [minEvents=2] - Minimum data frames to collect.
 * @param {number} [timeoutMs=5000] - Collection timeout.
 * @returns {Promise<{contentType: string, frames: string[]}>}
 */
function collectSseFrames(url, { headers = {}, minEvents = 2, timeoutMs = 5000 } = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const frames = [];
    let contentType = '';
    let buffer = '';
    const timer = setTimeout(() => {
      req.destroy();
      reject(new Error(`SSE timeout: collected ${frames.length}/${minEvents} frames`));
    }, timeoutMs);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: { Accept: 'text/event-stream', ...headers },
      },
      (res) => {
        contentType = String(res.headers['content-type'] ?? '');
        res.on('data', (chunk) => {
          buffer += chunk.toString('utf8');
          let idx;
          while ((idx = buffer.indexOf('\n\n')) !== -1) {
            const block = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const dataLines = block
              .split('\n')
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.slice(5).trim());
            if (dataLines.length > 0) {
              frames.push(dataLines.join('\n'));
              if (frames.length >= minEvents) {
                clearTimeout(timer);
                req.destroy();
                resolve({ contentType, frames });
                return;
              }
            }
          }
        });
        res.on('error', (err) => {
          clearTimeout(timer);
          reject(err);
        });
      }
    );
    req.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    req.end();
  });
}

test('Issue #17: GET /api/live-telemetry/stream emits >=2 SSE events with event-stream content-type', async () => {
  const __envSnapshot = isolateDevAuthEnv();
  try {
    const cfg = Object.freeze({
      b2bApiBaseUrl: 'http://127.0.0.1:59998',
      nodeApiBaseUrl: 'http://127.0.0.1:59999',
      adminHttpPort: 0,
      allowUnauthenticatedDev: true,
    });

    const { baseUrl, close } = await startAdminTestServer(cfg);
    try {
      const { contentType, frames } = await collectSseFrames(
        `${baseUrl}/api/live-telemetry/stream`,
        { minEvents: 2, timeoutMs: 8000 }
      );
      assert.match(contentType, /text\/event-stream/);
      assert.ok(frames.length >= 2, `expected >=2 SSE events, got ${frames.length}`);
      for (const frame of frames) {
        const parsed = JSON.parse(frame);
        assert.ok(typeof parsed.meshStatus === 'string');
        assert.ok('nodeReachable' in parsed);
        assert.ok(!/<script/i.test(frame), 'SSE payload must be pre-escaped');
      }
    } finally {
      await close();
    }
  } finally {
    restoreTestEnv(__envSnapshot);
  }
});

test('Issue #17: /operator view subscribes via minimal EventSource script (progressive enhancement)', async () => {
  const __envSnapshot = isolateDevAuthEnv();
  try {
    const html = renderOperatorView({
      meshSummary: { status: 'HEALTHY', healthyCount: 1, totalCount: 1 },
      epochSummary: { inSync: true, maxDriftEpochs: 0 },
      kybItems: [],
    });
    assert.match(html, /EventSource/);
    assert.match(html, /\/api\/live-telemetry\/stream/);
    assert.match(html, /<noscript>/);

    const cfg = Object.freeze({
      b2bApiBaseUrl: 'http://127.0.0.1:59998',
      nodeApiBaseUrl: 'http://127.0.0.1:59999',
      adminHttpPort: 0,
      allowUnauthenticatedDev: true,
    });
    const { baseUrl, close } = await startAdminTestServer(cfg);
    try {
      const res = await new Promise((resolve, reject) => {
        http.get(`${baseUrl}/operator`, (r) => {
          let data = '';
          r.on('data', (c) => {
            data += c;
          });
          r.on('end', () => resolve({ status: r.statusCode, body: data }));
        }).on('error', reject);
      });
      assert.equal(res.status, 200);
      assert.match(res.body, /EventSource/);
      assert.match(res.body, /Sonaraim Operator Console/);
    } finally {
      await close();
    }
  } finally {
    restoreTestEnv(__envSnapshot);
  }
});

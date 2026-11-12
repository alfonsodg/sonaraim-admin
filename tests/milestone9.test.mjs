/**
 * @fileoverview Milestone 9 TDD test suite for Issues #5 and #6:
 * Interactive POST /studio/cards builder form (urlencoded & JSON) with validation,
 * live Operator Console telemetry client, and Prometheus /metrics endpoint.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import {
  renderStudioView,
  startAdminTestServer,
  fetchUpstreamTelemetry,
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

test('Issue #5: renderStudioView includes accessible POST /studio/cards form with tenantDid, cardTitle, and actionLabel inputs', () => {
  const html = renderStudioView({
    tenantDid: 'did:web:clinic.example.com',
    cardTitle: 'Order & Appointment Card',
    actionLabel: 'Confirm Slot',
    manifestHash: 'sha256-studio-preview',
    actionsCount: 1,
  });

  assert.match(html, /<form[^>]+method="POST"[^>]+action="\/studio\/cards"/i);
  assert.match(html, /name="tenantDid"/);
  assert.match(html, /name="cardTitle"/);
  assert.match(html, /name="actionLabel"/);
  assert.match(html, /type="submit"/);
  assert.match(html, /<link rel="icon" href="data:," \/>/);
});

test('Issue #5: POST /studio/cards builds valid card from form-urlencoded and JSON and rejects invalid tenantDid with 400', async () => {
  const cfg = Object.freeze({
    b2bApiBaseUrl: 'http://127.0.0.1:59998',
    nodeApiBaseUrl: 'http://127.0.0.1:59999',
    adminHttpPort: 0,
  });

  const { baseUrl, close } = await startAdminTestServer(cfg);
  try {
    const formBody = new URLSearchParams({
      tenantDid: 'did:web:pharmacy.example.com',
      cardTitle: 'Prescription Ready #77',
      actionLabel: 'Confirm Pickup',
    }).toString();

    const formRes = await requestHttp(`${baseUrl}/studio/cards`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': String(Buffer.byteLength(formBody)),
      },
      body: formBody,
    });

    assert.equal(formRes.status, 200);
    assert.match(formRes.body, /did:web:pharmacy\.example\.com/);
    assert.match(formRes.body, /Prescription Ready #77/);
    assert.match(formRes.body, /[0-9a-f]{64}/);

    const jsonBody = JSON.stringify({
      tenantDid: 'did:web:logistics.example.com',
      cardTitle: 'Shipment Dispatch #19',
      actionLabel: 'Acknowledge Receipt',
    });

    const jsonRes = await requestHttp(`${baseUrl}/studio/cards`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': String(Buffer.byteLength(jsonBody)),
      },
      body: jsonBody,
    });

    assert.equal(jsonRes.status, 200);
    assert.match(jsonRes.body, /did:web:logistics\.example\.com/);
    assert.match(jsonRes.body, /Shipment Dispatch #19/);
    assert.match(jsonRes.body, /[0-9a-f]{64}/);

    const invalidBody = JSON.stringify({
      tenantDid: 'http://not-a-did-web.example.com',
      cardTitle: 'Bad Card',
      actionLabel: 'Submit',
    });

    const badRes = await requestHttp(`${baseUrl}/studio/cards`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': String(Buffer.byteLength(invalidBody)),
      },
      body: invalidBody,
    });

    assert.equal(badRes.status, 400);
    assert.match(badRes.body, /tenant_did/i);
  } finally {
    await close();
  }
});

test('Issue #6: GET /api/live-telemetry aggregates status from mock upstream Node and B2B servers and GET /metrics returns Prometheus counters', async () => {
  const mockNode = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: 'sonaraim-node' }));
      return;
    }
    if (req.url === '/v1/identity/anchors/latest') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          epoch: 12,
          merkleRoot: 'abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234',
        })
      );
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const mockB2b = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: 'sonaraim-b2b' }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise((resolve) => mockNode.listen(0, '127.0.0.1', resolve));
  await new Promise((resolve) => mockB2b.listen(0, '127.0.0.1', resolve));

  const nodePort = mockNode.address().port;
  const b2bPort = mockB2b.address().port;

  const cfg = Object.freeze({
    b2bApiBaseUrl: `http://127.0.0.1:${b2bPort}`,
    nodeApiBaseUrl: `http://127.0.0.1:${nodePort}`,
    adminHttpPort: 0,
  });

  const { baseUrl, close } = await startAdminTestServer(cfg);
  try {
    const directTelemetry = await fetchUpstreamTelemetry(cfg);
    assert.equal(directTelemetry.nodeReachable, true);
    assert.equal(directTelemetry.b2bReachable, true);
    assert.equal(directTelemetry.meshSummary.status, 'HEALTHY');

    const telemetryRes = await requestHttp(`${baseUrl}/api/live-telemetry`);
    assert.equal(telemetryRes.status, 200);
    const parsed = JSON.parse(telemetryRes.body);
    assert.equal(parsed.nodeReachable, true);
    assert.equal(parsed.b2bReachable, true);
    assert.equal(parsed.meshSummary.healthyCount, 2);

    const operatorRes = await requestHttp(`${baseUrl}/operator`);
    assert.equal(operatorRes.status, 200);
    assert.match(operatorRes.body, /HEALTHY/);

    const metricsRes = await requestHttp(`${baseUrl}/metrics`);
    assert.equal(metricsRes.status, 200);
    assert.match(String(metricsRes.headers['content-type']), /text\/plain;\s*version=0\.0\.4/);
    assert.match(metricsRes.body, /sonaraim_admin_http_requests_total/);
    assert.match(metricsRes.body, /sonaraim_admin_studio_cards_built_total/);
  } finally {
    await close();
    await new Promise((resolve) => mockNode.close(resolve));
    await new Promise((resolve) => mockB2b.close(resolve));
  }
});

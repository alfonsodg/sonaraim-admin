/**
 * @fileoverview Lightweight Node.js HTTP server for Sonaraim Admin Console views and billing API.
 */

import http from 'node:http';
import { renderOperatorView } from './ui/operatorView.mjs';
import { renderStudioView } from './ui/studioView.mjs';
import { createTenantBillingLedger } from './tenantBilling.mjs';

/**
 * Creates the HTTP request handler wired to the validated Admin configuration.
 *
 * @param {Readonly<{b2bApiBaseUrl: string, nodeApiBaseUrl: string, adminHttpPort: number}>} config
 * @returns {http.RequestListener}
 */
export function createAdminRequestHandler(config) {
  const defaultLedger = createTenantBillingLedger({
    tenantDid: 'did:web:clinic.example.com',
    tier: 'SMB_PRO',
    maxSeats: 10,
  });

  return (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (req.method === 'GET' && url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          service: 'sonaraim-admin',
          b2bApiBaseUrl: config.b2bApiBaseUrl,
          nodeApiBaseUrl: config.nodeApiBaseUrl,
        })
      );
      return;
    }

    if (req.method === 'GET' && url.pathname === '/operator') {
      const html = renderOperatorView({
        meshSummary: { status: 'HEALTHY', healthyCount: 3, totalCount: 3 },
        epochSummary: { inSync: true, maxDriftEpochs: 0 },
        kybItems: [{ did: 'did:web:clinic.example.com', verified: true, tlsValid: true }],
      });
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/studio') {
      const html = renderStudioView({
        tenantDid: 'did:web:clinic.example.com',
        cardTitle: 'Order & Appointment Card',
        manifestHash: 'sha256-studio-preview',
        actionsCount: 2,
      });
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/billing/summary') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          tenantDid: defaultLedger.tenantDid,
          tier: defaultLedger.tier,
          maxSeats: defaultLedger.maxSeats,
          perMessageFee: defaultLedger.perMessageFee,
        })
      );
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
  };
}

/**
 * Starts the Admin Console HTTP server on `127.0.0.1` (ephemeral port when `adminHttpPort === 0`).
 *
 * @param {Readonly<{b2bApiBaseUrl: string, nodeApiBaseUrl: string, adminHttpPort: number}>} config
 * @returns {Promise<{baseUrl: string, close: () => Promise<void>}>}
 */
export function startAdminTestServer(config) {
  const server = http.createServer(createAdminRequestHandler(config));
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(config.adminHttpPort, '127.0.0.1', () => {
      const addr = server.address();
      const baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve({
        baseUrl,
        close: () => new Promise((resClose) => server.close(() => resClose())),
      });
    });
  });
}

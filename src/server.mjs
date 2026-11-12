/**
 * @fileoverview Lightweight Node.js HTTP server for Sonaraim Admin Console views and billing API.
 */

import http from 'node:http';
import { renderOperatorView } from './ui/operatorView.mjs';
import { renderStudioView } from './ui/studioView.mjs';
import { createTenantBillingLedger } from './tenantBilling.mjs';
import {
  buildSonaraimCard,
  validateSonaraimCard,
  createCardSigningManifest,
} from './cardStudio.mjs';

/**
 * Reads and parses the incoming HTTP request body as JSON or URL-encoded form parameters.
 *
 * @param {http.IncomingMessage} req - Incoming HTTP request.
 * @returns {Promise<Record<string, string>>} Parsed key-value payload.
 */
function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 65536) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      const contentType = String(req.headers['content-type'] ?? '').toLowerCase();
      if (!raw.trim()) {
        resolve({});
        return;
      }
      if (contentType.includes('application/json')) {
        try {
          resolve(JSON.parse(raw));
        } catch {
          reject(new Error('Malformed JSON payload'));
        }
        return;
      }
      const params = new URLSearchParams(raw);
      resolve(Object.fromEntries(params.entries()));
    });
    req.on('error', reject);
  });
}

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

  let studioState = {
    tenantDid: 'did:web:clinic.example.com',
    cardTitle: 'Order & Appointment Card',
    actionLabel: 'Confirm Slot',
    manifestHash: 'sha256-studio-preview',
    actionsCount: 2,
  };

  return async (req, res) => {
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
      const html = renderStudioView(studioState);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/studio/cards') {
      let body;
      try {
        body = await parseRequestBody(req);
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'bad_request', message: err.message }));
        return;
      }

      const tenantDid = String(body.tenantDid ?? '').trim();
      const cardTitle = String(body.cardTitle ?? '').trim();
      const actionLabel = String(body.actionLabel ?? 'Confirm Action').trim();

      const card = buildSonaraimCard({
        cardId: 'card_studio_builder_v1',
        version: '1.0.0',
        tenantDid,
        title: cardTitle,
        components: [{ id: 'hdr_1', type: 'header', text: cardTitle }],
        actions: [
          {
            id: 'act_1',
            type: 'submit_intent',
            label: actionLabel,
            intentType: 'studio.card.submit',
          },
        ],
      });

      const validation = validateSonaraimCard(card);
      if (!validation.valid) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_card', errors: validation.errors }));
        return;
      }

      const manifest = createCardSigningManifest(card, new Date().toISOString());
      studioState = {
        tenantDid: card.tenant_did,
        cardTitle: card.title,
        actionLabel,
        manifestHash: manifest.payloadDigestHex,
        actionsCount: card.actions.length,
      };

      const html = renderStudioView(studioState);
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

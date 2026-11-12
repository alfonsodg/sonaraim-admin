/**
 * @fileoverview Lightweight Node.js HTTP server for Sonaraim Admin Console views,
 * Zero-Trust operator login, interactive Card Studio builder, and live telemetry.
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
import { fetchUpstreamTelemetry } from './apiClient.mjs';
import {
  createOperatorSessionToken,
  isOperatorAuthorized,
  renderLoginView,
} from './authGate.mjs';
import { parseRequestBody, renderPrometheusMetrics } from './httpHelpers.mjs';

/**
 * Creates the HTTP request handler wired to the validated Admin configuration.
 *
 * @param {Readonly<{b2bApiBaseUrl: string, nodeApiBaseUrl: string, adminHttpPort: number, operatorToken?: string}>} config
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

  const metricsState = {
    httpRequestsTotal: 0,
    studioCardsBuiltTotal: 0,
    tenantsProvisionedTotal: 0,
    telemetryScrapesTotal: 0,
    nodeReachable: false,
    b2bReachable: false,
  };

  return async (req, res) => {
    metricsState.httpRequestsTotal += 1;
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

    if (req.method === 'GET' && url.pathname === '/metrics') {
      res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' });
      res.end(renderPrometheusMetrics(metricsState));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/login') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(renderLoginView());
      return;
    }

    if (req.method === 'POST' && url.pathname === '/login') {
      let body = {};
      try {
        body = await parseRequestBody(req);
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'bad_request', message: err.message }));
        return;
      }
      const candidate = String(body.operatorToken ?? body.token ?? '').trim();
      const requiredToken = String(
        config?.operatorToken ?? process.env.ADMIN_OPERATOR_TOKEN ?? ''
      ).trim();

      if (requiredToken && candidate !== requiredToken) {
        res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(renderLoginView({ error: 'Invalid operator token' }));
        return;
      }

      const tokenForHmac = requiredToken || candidate || 'dev-operator-token';
      const sessionVal = createOperatorSessionToken(tokenForHmac);
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Set-Cookie': `sonaraim_operator_session=${sessionVal}; HttpOnly; Path=/; SameSite=Lax`,
      });
      res.end(renderLoginView({ authenticated: true }));
      return;
    }

    if (!isOperatorAuthorized(req, config)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthorized', loginUrl: '/login' }));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/live-telemetry') {
      metricsState.telemetryScrapesTotal += 1;
      const telemetry = await fetchUpstreamTelemetry(config);
      metricsState.nodeReachable = telemetry.nodeReachable;
      metricsState.b2bReachable = telemetry.b2bReachable;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ service: 'sonaraim-admin', ...telemetry }));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/operator') {
      metricsState.telemetryScrapesTotal += 1;
      const telemetry = await fetchUpstreamTelemetry(config);
      metricsState.nodeReachable = telemetry.nodeReachable;
      metricsState.b2bReachable = telemetry.b2bReachable;
      const html = renderOperatorView({
        meshSummary: telemetry.meshSummary,
        epochSummary: telemetry.epochSummary,
        kybItems: telemetry.kybItems,
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
      metricsState.studioCardsBuiltTotal += 1;
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
 * @param {Readonly<{b2bApiBaseUrl: string, nodeApiBaseUrl: string, adminHttpPort: number, operatorToken?: string}>} config
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

/**
 * @fileoverview Lightweight Node.js HTTP server for Sonaraim Admin Console views,
 * Zero-Trust operator login, interactive Card Studio builder, B2B tenant provisioning,
 * and live upstream telemetry.
 */

import http from 'node:http';
import { renderOperatorView } from './ui/operatorView.mjs';
import { renderStudioView } from './ui/studioView.mjs';
import { createTenantBillingLedger } from './tenantBilling.mjs';
import {
  buildSonaraimCard, validateSonaraimCard, createCardSigningManifest,
} from './cardStudio.mjs';
import {
  fetchUpstreamTelemetry, provisionB2bTenant, dispatchCardToB2b, registerNodePeer,
} from './apiClient.mjs';
import {
  handleOperatorLogin,
  isOperatorAuthorized,
  renderLoginView,
} from './authGate.mjs';
import {
  parseRequestBody, renderPrometheusMetrics, sendJson, sendHtml,
} from './httpHelpers.mjs';

/**
 * Renders and sends the Operator Console view with up-to-date telemetry and peers.
 */
async function replyOperatorView(res, config, tenants, peers, metrics, banner = '') {
  metrics.telemetryScrapesTotal += 1;
  const tel = await fetchUpstreamTelemetry(config);
  metrics.nodeReachable = tel.nodeReachable;
  metrics.b2bReachable = tel.b2bReachable;
  const allPeers = [...(tel.peers ?? []), ...peers];
  sendHtml(
    res,
    200,
    renderOperatorView({
      meshSummary: tel.meshSummary,
      epochSummary: tel.epochSummary,
      kybItems: [...tel.kybItems, ...tenants],
      peerCount: Math.max(tel.peerCount ?? 0, allPeers.length),
      peers: allPeers,
      bannerMessage: banner,
    })
  );
}

/**
 * Creates the HTTP request handler wired to the validated Admin configuration.
 *
 * @param {Readonly<{b2bApiBaseUrl: string, nodeApiBaseUrl: string, adminHttpPort: number, operatorToken?: string}>} config
 * @returns {http.RequestListener}
 */
export function createAdminRequestHandler(config) {
  const defaultLedger = createTenantBillingLedger({
    tenantDid: 'did:web:clinic.example.com', tier: 'SMB_PRO', maxSeats: 10,
  });

  let studioState = {
    tenantDid: 'did:web:clinic.example.com',
    cardTitle: 'Order & Appointment Card',
    actionLabel: 'Confirm Slot',
    manifestHash: 'sha256-studio-preview',
    actionsCount: 2,
  };

  const provisionedTenants = [];
  const registeredPeers = [];

  const metricsState = {
    httpRequestsTotal: 0,
    studioCardsBuiltTotal: 0,
    tenantsProvisionedTotal: 0,
    peersRegisteredTotal: 0,
    telemetryScrapesTotal: 0,
    nodeReachable: false,
    b2bReachable: false,
  };

  return async (req, res) => {
    metricsState.httpRequestsTotal += 1;
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');

    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, {
        status: 'ok', service: 'sonaraim-admin',
        b2bApiBaseUrl: config.b2bApiBaseUrl, nodeApiBaseUrl: config.nodeApiBaseUrl,
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/metrics') {
      res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' });
      res.end(renderPrometheusMetrics(metricsState));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/login') {
      sendHtml(res, 200, renderLoginView());
      return;
    }

    if (req.method === 'POST' && url.pathname === '/login') {
      await handleOperatorLogin(req, res, config);
      return;
    }

    if (!isOperatorAuthorized(req, config)) {
      sendJson(res, 401, { error: 'unauthorized', loginUrl: '/login' });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/live-telemetry') {
      metricsState.telemetryScrapesTotal += 1;
      const telemetry = await fetchUpstreamTelemetry(config);
      metricsState.nodeReachable = telemetry.nodeReachable;
      metricsState.b2bReachable = telemetry.b2bReachable;
      sendJson(res, 200, { service: 'sonaraim-admin', ...telemetry });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/operator') {
      await replyOperatorView(res, config, provisionedTenants, registeredPeers, metricsState);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/operator/tenants') {
      const body = await parseRequestBody(req).catch(() => ({}));
      const tenantDid = String(body.tenantDid ?? '').trim();
      const apiKey = String(body.apiKey ?? '').trim();
      const tier = String(body.tier ?? 'SMB_PRO').trim();
      const seats = Number(body.seats ?? 10) || 10;
      const adminKey = String(body.adminKey ?? '').trim();

      if (!tenantDid.startsWith('did:web:') || !apiKey) {
        sendJson(res, 400, { error: 'invalid_tenant_payload' });
        return;
      }

      const result = await provisionB2bTenant(config, {
        tenantDid,
        apiKey,
        tier,
        seats,
        adminKey,
      });
      metricsState.tenantsProvisionedTotal += 1;
      provisionedTenants.push({ did: tenantDid, verified: true, tlsValid: true });

      await replyOperatorView(
        res,
        config,
        provisionedTenants,
        registeredPeers,
        metricsState,
        `Provisioned ${tenantDid} (upstream status ${result.status})`
      );
      return;
    }

    if (req.method === 'POST' && url.pathname === '/operator/peers') {
      const body = await parseRequestBody(req).catch(() => ({}));
      const peerId = String(body.peerId ?? body.peer_id ?? '').trim();
      const rpcUrl = String(body.rpcUrl ?? body.rpc_url ?? '').trim();
      const multiaddr = String(body.multiaddr ?? '').trim();

      if (!peerId || !rpcUrl) {
        sendJson(res, 400, { error: 'invalid_peer_payload' });
        return;
      }

      const result = await registerNodePeer(config, { peerId, rpcUrl, multiaddr });
      metricsState.peersRegisteredTotal += 1;
      registeredPeers.push({ peerId, rpcUrl, multiaddr });

      await replyOperatorView(
        res,
        config,
        provisionedTenants,
        registeredPeers,
        metricsState,
        `Registered peer ${peerId} (upstream status ${result.status})`
      );
      return;
    }

    if (req.method === 'GET' && url.pathname === '/studio') {
      sendHtml(res, 200, renderStudioView(studioState));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/studio/cards') {
      let body;
      try {
        body = await parseRequestBody(req);
      } catch (err) {
        sendJson(res, 400, { error: 'bad_request', message: err.message });
        return;
      }

      const tenantDid = String(body.tenantDid ?? '').trim();
      const cardTitle = String(body.cardTitle ?? '').trim();
      const actionLabel = String(body.actionLabel ?? 'Confirm Action').trim();
      const recipientDid = String(body.recipientDid ?? '').trim();
      const apiKey = String(body.apiKey ?? '').trim();

      const card = buildSonaraimCard({
        cardId: 'card_studio_builder_v1',
        version: '1.0.0',
        tenantDid,
        title: cardTitle,
        components: [{ id: 'hdr_1', type: 'header', text: cardTitle }],
        actions: [{ id: 'act_1', type: 'submit_intent', label: actionLabel, intentType: 'studio.card.submit' }],
      });

      const validation = validateSonaraimCard(card);
      if (!validation.valid) {
        sendJson(res, 400, { error: 'invalid_card', errors: validation.errors });
        return;
      }

      let dispatchResult = null;
      if (recipientDid) {
        dispatchResult = await dispatchCardToB2b(config, {
          apiKey,
          recipientDid,
          cardTitle,
          actionLabel,
          card,
        });
      }

      const manifest = createCardSigningManifest(card, new Date().toISOString());
      metricsState.studioCardsBuiltTotal += 1;
      studioState = {
        tenantDid: card.tenant_did,
        cardTitle: card.title,
        actionLabel,
        manifestHash: manifest.payloadDigestHex,
        actionsCount: card.actions.length,
        recipientDid,
        apiKey,
        dispatchResult,
      };

      sendHtml(res, 200, renderStudioView(studioState));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/billing/summary') {
      sendJson(res, 200, {
        tenantDid: defaultLedger.tenantDid,
        tier: defaultLedger.tier,
        maxSeats: defaultLedger.maxSeats,
        perMessageFee: defaultLedger.perMessageFee,
      });
      return;
    }

    sendJson(res, 404, { error: 'not_found' });
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
      resolve({
        baseUrl: `http://127.0.0.1:${addr.port}`,
        close: () => new Promise((resClose) => server.close(() => resClose())),
      });
    });
  });
}

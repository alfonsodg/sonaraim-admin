/**
 * @fileoverview Shared HTTP body parsing and Prometheus metrics formatting helpers
 * for the Sonaraim Admin Console server.
 */

/**
 * Reads and parses the incoming HTTP request body as JSON or URL-encoded form parameters.
 *
 * @param {import('node:http').IncomingMessage} req - Incoming HTTP request.
 * @returns {Promise<Record<string, string>>} Parsed key-value payload.
 */
export function parseRequestBody(req) {
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
 * Formats internal counters and upstream state in Prometheus 0.0.4 text format.
 *
 * @param {{
 *   httpRequestsTotal: number,
 *   studioCardsBuiltTotal: number,
 *   tenantsProvisionedTotal?: number,
 *   peersRegisteredTotal?: number,
 *   telemetryScrapesTotal: number,
 *   nodeReachable: boolean,
 *   b2bReachable: boolean
 * }} m
 * @returns {string} Prometheus exposition payload.
 */
export function renderPrometheusMetrics(m) {
  return [
    '# HELP sonaraim_admin_http_requests_total Total HTTP requests handled by sonaraim-admin',
    '# TYPE sonaraim_admin_http_requests_total counter',
    `sonaraim_admin_http_requests_total ${m.httpRequestsTotal}`,
    '# HELP sonaraim_admin_studio_cards_built_total Total declarative cards built via POST /studio/cards',
    '# TYPE sonaraim_admin_studio_cards_built_total counter',
    `sonaraim_admin_studio_cards_built_total ${m.studioCardsBuiltTotal}`,
    '# HELP sonaraim_admin_tenants_provisioned_total Total B2B tenants provisioned via POST /operator/tenants',
    '# TYPE sonaraim_admin_tenants_provisioned_total counter',
    `sonaraim_admin_tenants_provisioned_total ${m.tenantsProvisionedTotal ?? 0}`,
    '# HELP sonaraim_admin_telemetry_scrapes_total Total live telemetry evaluations performed',
    '# TYPE sonaraim_admin_telemetry_scrapes_total counter',
    `sonaraim_admin_telemetry_scrapes_total ${m.telemetryScrapesTotal}`,
    '# HELP sonaraim_admin_upstream_reachable Upstream service reachability gauge (1 = reachable, 0 = unreachable)',
    '# TYPE sonaraim_admin_upstream_reachable gauge',
    `sonaraim_admin_upstream_reachable{upstream="node"} ${m.nodeReachable ? 1 : 0}`,
    `sonaraim_admin_upstream_reachable{upstream="b2b"} ${m.b2bReachable ? 1 : 0}`,
    '',
  ].join('\n');
}

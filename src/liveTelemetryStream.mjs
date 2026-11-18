/**
 * @fileoverview Server-Sent Events live-telemetry stream handler for Sonaraim Admin Console.
 * Emits pre-escaped telemetry snapshots on an interval until the client disconnects.
 */

import { fetchUpstreamTelemetry } from './apiClient.mjs';

/**
 * Interval in milliseconds between live-telemetry SSE snapshots.
 */
export const LIVE_TELEMETRY_SSE_INTERVAL_MS = 1000;

/**
 * Serializes a telemetry snapshot into a pre-escaped JSON payload safe to
 * embed in an SSE `data:` frame (angle brackets and ampersands are
 * unicode-escaped so the stream carries no raw HTML).
 *
 * @param {object} telemetry - Aggregated telemetry snapshot from fetchUpstreamTelemetry().
 * @param {number} eventId - Monotonic SSE event identifier.
 * @returns {string} Escaped JSON payload.
 */
export function serializeTelemetryEvent(telemetry, eventId) {
  return JSON.stringify({
    eventId,
    meshStatus: String(telemetry?.meshSummary?.status ?? 'UNKNOWN'),
    nodeReachable: Boolean(telemetry?.nodeReachable),
    b2bReachable: Boolean(telemetry?.b2bReachable),
    peerCount: Number(telemetry?.peerCount ?? 0),
  })
    .replaceAll('&', '\\u0026')
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e');
}

/**
 * Handles `GET /api/live-telemetry/stream` by emitting SSE telemetry
 * snapshots every second until the client disconnects.
 *
 * @param {import('node:http').IncomingMessage} req - Incoming HTTP request.
 * @param {import('node:http').ServerResponse} res - Outgoing HTTP response.
 * @param {object} config - Validated Admin configuration object.
 * @param {object} metricsState - Mutable Prometheus counters state.
 * @returns {Promise<void>}
 */
export async function handleLiveTelemetryStream(req, res, config, metricsState) {
  metricsState.telemetryScrapesTotal += 1;
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  let eventId = 0;
  let closed = false;
  const sendSnapshot = async () => {
    if (closed) {
      return;
    }
    try {
      const telemetry = await fetchUpstreamTelemetry(config);
      metricsState.nodeReachable = telemetry.nodeReachable;
      metricsState.b2bReachable = telemetry.b2bReachable;
      const safePayload = serializeTelemetryEvent(telemetry, eventId);
      eventId += 1;
      res.write(`id: ${eventId}\nevent: telemetry\ndata: ${safePayload}\n\n`);
    } catch {
      if (!closed) {
        res.write('event: error\ndata: {"meshStatus":"UNKNOWN"}\n\n');
      }
    }
  };
  await sendSnapshot();
  const timer = setInterval(sendSnapshot, LIVE_TELEMETRY_SSE_INTERVAL_MS);
  req.on('close', () => {
    closed = true;
    clearInterval(timer);
  });
}

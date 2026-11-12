/**
 * @fileoverview Zero-hardcode configuration loader for the Sonaraim Admin Console.
 * Strictly loads and validates VITE_B2B_API_BASE_URL (or B2B_API_BASE_URL),
 * VITE_NODE_API_BASE_URL (or NODE_API_BASE_URL), and ADMIN_HTTP_PORT from the environment.
 */

/**
 * Validates and normalizes an HTTP/HTTPS URL string from an environment variable.
 *
 * @param {string} key - The environment variable name.
 * @param {string} rawValue - The raw URL string from the environment.
 * @returns {string} Normalized base URL without trailing slash.
 * @throws {Error} When the URL is malformed or uses an unsupported protocol.
 */
function parseBaseUrl(key, rawValue) {
  let parsed;
  try {
    parsed = new URL(rawValue);
  } catch {
    throw new Error(`Invalid URL in environment variable ${key}: "${rawValue}"`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(
      `Unsupported URL protocol in environment variable ${key}: "${parsed.protocol}"`
    );
  }

  return rawValue.replace(/\/+$/, '');
}

/**
 * Validates and parses a TCP port number from an environment variable.
 *
 * @param {string} key - The environment variable name.
 * @param {string|number} rawValue - The raw port value.
 * @returns {number} Validated integer port in range 1..65535.
 * @throws {Error} When the port is not an integer between 1 and 65535.
 */
function parsePort(key, rawValue) {
  const port = Number(rawValue);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `Invalid port in environment variable ${key}: "${rawValue}" (expected 1-65535)`
    );
  }
  return port;
}

/**
 * Loads and validates the Sonaraim Admin Console runtime configuration.
 *
 * @param {Record<string, string|undefined>} [env=process.env] - Environment object to inspect.
 * @returns {Readonly<{b2bApiBaseUrl: string, nodeApiBaseUrl: string, adminHttpPort: number, operatorToken?: string}>}
 *   Frozen configuration object.
 * @throws {Error} If any required environment variable is missing or invalid.
 */
export function loadAdminConfig(env = process.env) {
  if (!env || typeof env !== 'object') {
    throw new Error('Environment source must be a valid object');
  }

  const rawB2b = env.VITE_B2B_API_BASE_URL ?? env.B2B_API_BASE_URL;
  if (rawB2b === undefined || rawB2b === null || String(rawB2b).trim() === '') {
    throw new Error('Missing required environment variable: VITE_B2B_API_BASE_URL');
  }

  const rawNode = env.VITE_NODE_API_BASE_URL ?? env.NODE_API_BASE_URL;
  if (rawNode === undefined || rawNode === null || String(rawNode).trim() === '') {
    throw new Error('Missing required environment variable: VITE_NODE_API_BASE_URL');
  }

  const rawPort = env.ADMIN_HTTP_PORT;
  if (rawPort === undefined || rawPort === null || String(rawPort).trim() === '') {
    throw new Error('Missing required environment variable: ADMIN_HTTP_PORT');
  }

  const b2bApiBaseUrl = parseBaseUrl('VITE_B2B_API_BASE_URL', String(rawB2b).trim());
  const nodeApiBaseUrl = parseBaseUrl('VITE_NODE_API_BASE_URL', String(rawNode).trim());
  const adminHttpPort = parsePort('ADMIN_HTTP_PORT', String(rawPort).trim());
  const operatorToken = String(env.ADMIN_OPERATOR_TOKEN ?? '').trim() || undefined;

  return Object.freeze({
    b2bApiBaseUrl,
    nodeApiBaseUrl,
    adminHttpPort,
    ...(operatorToken ? { operatorToken } : {}),
  });
}

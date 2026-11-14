/**
 * @fileoverview Zero-Trust Operator Authentication Gate for Sonaraim Admin Console.
 * Provides HMAC-SHA256 session cookie generation, Bearer/Cookie authorization checks,
 * and accessible HTML rendering for GET /login and POST /login.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { parseRequestBody, sendHtml } from './httpHelpers.mjs';
import { escapeHtml, renderAdminShell } from './ui/htmlUtils.mjs';

const SESSION_COOKIE_NAME = 'sonaraim_operator_session';
const SESSION_CONTEXT = 'sonaraim-operator-session-v1';

/**
 * Generates an HMAC-SHA256 session cookie token bound to the configured operator token.
 *
 * @param {string} operatorToken - Secret operator token.
 * @returns {string} 64-character hex HMAC session digest.
 */
export function createOperatorSessionToken(operatorToken) {
  const secret = String(operatorToken ?? '').trim();
  if (!secret) {
    throw new Error('operatorToken is required to generate a session token');
  }
  return createHmac('sha256', secret).update(SESSION_CONTEXT).digest('hex');
}

/**
 * Compares two strings in constant time to prevent timing side-channel leaks.
 *
 * @param {string} a - Candidate string.
 * @param {string} b - Expected string.
 * @returns {boolean} True when both strings are identical.
 */
function safeEqualString(a, b) {
  const bufA = Buffer.from(String(a ?? ''), 'utf8');
  const bufB = Buffer.from(String(b ?? ''), 'utf8');
  if (bufA.length !== bufB.length || bufA.length === 0) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * Determines whether unauthenticated development access is explicitly enabled
 * outside of production.
 *
 * @param {object} [config={}] - Admin configuration object.
 * @returns {boolean} True when explicit dev no-auth opt-in is active and NODE_ENV is not production.
 */
export function isDevNoAuthAllowed(config = {}) {
  const nodeEnv = String(config?.nodeEnv ?? process.env.NODE_ENV ?? '')
    .trim()
    .toLowerCase();
  if (nodeEnv === 'production') {
    return false;
  }
  if (config?.allowUnauthenticatedDev === true) {
    return true;
  }
  const envFlag = String(
    process.env.ADMIN_ALLOW_DEV_NOAUTH ?? process.env.SONARAIM_ALLOW_DEV_NOAUTH ?? ''
  )
    .trim()
    .toLowerCase();
  return envFlag === 'true';
}

/**
 * Validates operator authentication configuration at server startup.
 * Fails fast in production if `ADMIN_OPERATOR_TOKEN` is missing and logs a warning in non-production.
 *
 * @param {object} config - Loaded admin configuration object.
 * @param {Record<string, string|undefined>} [env=process.env] - Environment variables map.
 * @param {{warn?: Function, error?: Function}} [logger=console] - Structured logger.
 * @returns {{ok: boolean, reason?: string}} Startup auth validation result.
 */
export function validateStartupAuth(config, env = process.env, logger = console) {
  const token = String(config?.operatorToken ?? env?.ADMIN_OPERATOR_TOKEN ?? '').trim();
  if (token) {
    return { ok: true };
  }

  const nodeEnv = String(config?.nodeEnv ?? env?.NODE_ENV ?? '')
    .trim()
    .toLowerCase();
  if (nodeEnv === 'production') {
    logger?.error?.(
      JSON.stringify({
        level: 'ERROR',
        service: 'sonaraim-admin',
        event: 'startup_auth_missing',
        message: 'ADMIN_OPERATOR_TOKEN is required in production',
      })
    );
    return { ok: false, reason: 'ADMIN_OPERATOR_TOKEN is required in production' };
  }

  logger?.warn?.(
    JSON.stringify({
      level: 'WARN',
      service: 'sonaraim-admin',
      event: 'startup_auth_missing',
      message:
        'ADMIN_OPERATOR_TOKEN is unset; protected routes fail closed (401) unless ADMIN_ALLOW_DEV_NOAUTH=true',
    })
  );
  return { ok: true };
}

/**
 * Verifies whether an incoming HTTP request is authorized to access protected Admin routes.
 * Fails closed (`false`) when no `operatorToken` / `ADMIN_OPERATOR_TOKEN` is configured,
 * unless explicit non-production dev opt-in (`allowUnauthenticatedDev` or `ADMIN_ALLOW_DEV_NOAUTH=true`) is enabled.
 *
 * @param {import('node:http').IncomingMessage|{headers?: Record<string, string|undefined>}} req
 * @param {object} [config] - Admin configuration object.
 * @returns {boolean} True if authorized.
 */
export function isOperatorAuthorized(req, config = {}) {
  const requiredToken = String(
    config?.operatorToken ?? process.env.ADMIN_OPERATOR_TOKEN ?? ''
  ).trim();
  if (!requiredToken) {
    return isDevNoAuthAllowed(config);
  }

  const headers = req?.headers ?? {};
  const authHeader = String(headers.authorization ?? '').trim();
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (safeEqualString(bearer, requiredToken)) {
      return true;
    }
  }

  const expectedSession = createOperatorSessionToken(requiredToken);
  const rawCookie = String(headers.cookie ?? '');
  for (const part of rawCookie.split(';')) {
    const [k, ...vParts] = part.trim().split('=');
    if (k === SESSION_COOKIE_NAME) {
      const candidate = vParts.join('=').trim();
      if (safeEqualString(candidate, expectedSession)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Renders the accessible Operator Login HTML view.
 *
 * @param {object} [params] - Login view state.
 * @param {string} [params.error=''] - Optional authentication error banner.
 * @param {boolean} [params.authenticated=false] - Whether login succeeded.
 * @returns {string} Complete HTML5 document.
 */
export function renderLoginView({ error = '', authenticated = false } = {}) {
  const bannerHtml = error
    ? `<p role="alert"><strong>Error:</strong> ${escapeHtml(error)}</p>`
    : authenticated
      ? `<p role="status"><strong>Authenticated:</strong> Session cookie active.</p>`
      : '';

  const contentHtml = `
    <section aria-labelledby="login-heading">
      <h2 id="login-heading">Operator Zero-Trust Sign In</h2>
      ${bannerHtml}
      <form method="POST" action="/login">
        <label for="operator-token-input">
          Operator Token
          <input id="operator-token-input" name="operatorToken" type="password" required />
        </label>
        <button type="submit">Sign In</button>
      </form>
    </section>`;

  return renderAdminShell({
    title: 'Sonaraim Operator Login',
    activeTab: 'operator',
    contentHtml,
  });
}

/**
 * Handles `POST /login` operator authentication and issues an HttpOnly session cookie.
 * Fails closed with 401 when no operator token is configured unless dev no-auth opt-in is active.
 *
 * @param {import('node:http').IncomingMessage} req - Incoming HTTP request.
 * @param {import('node:http').ServerResponse} res - HTTP response object.
 * @param {object} config - Admin configuration object.
 * @returns {Promise<void>}
 */
export async function handleOperatorLogin(req, res, config) {
  const body = await parseRequestBody(req).catch(() => ({}));
  const candidate = String(body.operatorToken ?? body.token ?? '').trim();
  const requiredToken = String(
    config?.operatorToken ?? process.env.ADMIN_OPERATOR_TOKEN ?? ''
  ).trim();

  if (!requiredToken && !isDevNoAuthAllowed(config)) {
    sendHtml(res, 401, renderLoginView({ error: 'Operator token is not configured' }));
    return;
  }

  if (requiredToken && candidate !== requiredToken) {
    sendHtml(res, 401, renderLoginView({ error: 'Invalid operator token' }));
    return;
  }

  const sessionVal = createOperatorSessionToken(requiredToken || candidate || 'dev-token');
  sendHtml(res, 200, renderLoginView({ authenticated: true }), {
    'Set-Cookie': `${SESSION_COOKIE_NAME}=${sessionVal}; HttpOnly; Path=/; SameSite=Lax`,
  });
}

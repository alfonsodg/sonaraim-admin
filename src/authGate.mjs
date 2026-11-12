/**
 * @fileoverview Zero-Trust Operator Authentication Gate for Sonaraim Admin Console.
 * Provides HMAC-SHA256 session cookie generation, Bearer/Cookie authorization checks,
 * and accessible HTML rendering for GET /login and POST /login.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
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
 * Verifies whether an incoming HTTP request is authorized to access protected Admin routes.
 * When no `operatorToken` / `ADMIN_OPERATOR_TOKEN` is configured, access is permitted for local dev/test.
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
    return true;
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

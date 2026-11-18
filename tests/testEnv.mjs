/**
 * @fileoverview Shared test-environment helpers for sonaraim-admin:
 * save/restore process.env keys (NODE_ENV, dev-auth flags) so the suite
 * is green even with NODE_ENV=production exported in the shell.
 */

/**
 * Saves the current values of the given env keys so a test can restore them.
 *
 * @param {string[]} [keys=['NODE_ENV','ADMIN_OPERATOR_TOKEN','ADMIN_ALLOW_DEV_NOAUTH','SONARAIM_ALLOW_DEV_NOAUTH']]
 *   Environment keys to snapshot.
 * @returns {Record<string, string|undefined>} Snapshot mapping key to prior value.
 */
export function saveTestEnv(
  keys = ['NODE_ENV', 'ADMIN_OPERATOR_TOKEN', 'ADMIN_ALLOW_DEV_NOAUTH', 'SONARAIM_ALLOW_DEV_NOAUTH']
) {
  const snapshot = {};
  for (const key of keys) {
    snapshot[key] = process.env[key];
  }
  return snapshot;
}

/**
 * Restores a snapshot previously taken with saveTestEnv().
 *
 * @param {Record<string, string|undefined>} snapshot - Prior env values.
 * @returns {void}
 */
export function restoreTestEnv(snapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

/**
 * Forces dev no-auth friendly defaults (NODE_ENV=test, no operator token,
 * no dev-noauth flags) for tests that rely on allowUnauthenticatedDev.
 *
 * @returns {Record<string, string|undefined>} Snapshot to pass to restoreTestEnv().
 */
export function isolateDevAuthEnv() {
  const snapshot = saveTestEnv();
  process.env.NODE_ENV = 'test';
  delete process.env.ADMIN_OPERATOR_TOKEN;
  delete process.env.ADMIN_ALLOW_DEV_NOAUTH;
  delete process.env.SONARAIM_ALLOW_DEV_NOAUTH;
  return snapshot;
}

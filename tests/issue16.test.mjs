/**
 * @fileoverview TDD test suite for Issue #16 (sonaraim-admin):
 * the suite must be green even when NODE_ENV=production is exported in
 * the shell environment; every dev-auth-dependent test isolates NODE_ENV
 * via the shared tests/testEnv.mjs helper.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { isolateDevAuthEnv, restoreTestEnv, saveTestEnv } from './testEnv.mjs';
import { isOperatorAuthorized } from '../src/index.mjs';

test('Issue #16: dev-auth tests force NODE_ENV=test regardless of inherited production env', () => {
  const outer = saveTestEnv();
  try {
    process.env.NODE_ENV = 'production';
    const snapshot = isolateDevAuthEnv();
    try {
      assert.equal(process.env.NODE_ENV, 'test');
      assert.equal(isOperatorAuthorized({ headers: {} }, { allowUnauthenticatedDev: true }), true);
    } finally {
      restoreTestEnv(snapshot);
    }
    assert.equal(process.env.NODE_ENV, 'production');
  } finally {
    restoreTestEnv(outer);
  }
});

test('Issue #16: save/restore round-trips all dev-auth env keys including unset keys', () => {
  const outer = saveTestEnv();
  try {
    delete process.env.ADMIN_OPERATOR_TOKEN;
    process.env.NODE_ENV = 'outer-value';
    const snapshot = saveTestEnv();
    process.env.NODE_ENV = 'mutated';
    process.env.ADMIN_OPERATOR_TOKEN = 'mutated-token';
    restoreTestEnv(snapshot);
    assert.equal(process.env.NODE_ENV, 'outer-value');
    assert.equal(process.env.ADMIN_OPERATOR_TOKEN, undefined);
  } finally {
    restoreTestEnv(outer);
  }
});

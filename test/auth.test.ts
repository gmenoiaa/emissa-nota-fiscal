import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken, verifySessionToken } from '../lib/auth';

test('creates and verifies a signed session token', () => {
  process.env.APP_PASSWORD = 'test-password';
  process.env.AUTH_SECRET = 'test-secret-with-enough-entropy-for-tests';
  const token = createSessionToken();
  assert.equal(verifySessionToken(token), true);
  assert.equal(verifySessionToken(`${token}tampered`), false);
});

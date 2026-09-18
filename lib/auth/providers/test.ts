/**
 * The test identity provider: one account, credentials from the environment.
 *
 * It exists so the whole identity layer — session, login screen, owner
 * partitioning, role plumbing — can be built and exercised before the domain
 * is reachable. It is not a user directory and must never be mistaken for one:
 * `config.ts` refuses to start it in production without an explicit opt-in.
 */

import { timingSafeEqual } from 'node:crypto';

import { testPassword, testUsername } from '../config';
import { readSessionCookie, verifySessionToken } from '../session';
import type { Identity, IdentityProvider } from '../types';

/**
 * Compare two secrets without leaking their relationship through timing.
 *
 * `timingSafeEqual` throws on a length mismatch, and the lengths themselves
 * differ per attempt, so the comparison runs against a fixed-size digest-shaped
 * buffer: both inputs are padded to the longer length before comparing, and the
 * length difference is folded into the result.
 */
function secretsMatch(candidate: string, expected: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(candidate);
  const b = encoder.encode(expected);
  const width = Math.max(a.length, b.length);
  const padA = new Uint8Array(width);
  const padB = new Uint8Array(width);
  padA.set(a);
  padB.set(b);
  return timingSafeEqual(padA, padB) && a.length === b.length;
}

/** The identity the test account maps to. One account, every role. */
export function testIdentity(): Identity {
  const username = testUsername();
  return {
    subject: `test:${username}`,
    displayName: username,
    roles: ['admin', 'author', 'viewer'],
  };
}

/**
 * Check a username/password pair.
 *
 * Both halves are compared even when the username is already wrong, so a
 * caller cannot learn the username by timing the response.
 */
export function verifyTestCredentials(username: string, password: string): Identity | null {
  const userOk = secretsMatch(username, testUsername());
  const passOk = secretsMatch(password, testPassword());
  return userOk && passOk ? testIdentity() : null;
}

export const testProvider: IdentityProvider = {
  id: 'test',
  async resolve(req) {
    const token = readSessionCookie(req.headers);
    if (!token) return null;
    return verifySessionToken(token);
  },
};

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createSessionToken, verifySessionToken } from '@/lib/auth/session';
import { isValidSessionTokenEdge } from '@/lib/auth/session-edge';
import { DEFAULT_SESSION_MAX_AGE_SECONDS } from '@/lib/auth/config';
import type { Identity } from '@/lib/auth/types';

const SECRET = 'a-test-secret-that-is-long-enough-to-pass';

const IDENTITY: Identity = {
  subject: 'test:admin',
  displayName: 'admin',
  roles: ['admin', 'author', 'viewer'],
};

describe('session token', () => {
  beforeEach(() => {
    process.env.AUTH_PROVIDER = 'test';
    process.env.AUTH_SESSION_SECRET = SECRET;
  });

  afterEach(() => {
    delete process.env.AUTH_PROVIDER;
    delete process.env.AUTH_SESSION_SECRET;
    delete process.env.AUTH_SESSION_MAX_AGE_SECONDS;
  });

  it('round-trips the identity it was minted with', () => {
    const identity = verifySessionToken(createSessionToken(IDENTITY));
    expect(identity).toEqual(IDENTITY);
  });

  it('rejects a token whose payload was edited', () => {
    // The whole point of signing: a client that rewrites its own subject would
    // otherwise read and write another person's courses.
    const token = createSessionToken(IDENTITY);
    const [, issuedAt, signature] = token.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: 'test:someone-else', name: 'x', roles: ['admin'] }),
      'utf8',
    )
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    expect(verifySessionToken(`${forgedPayload}.${issuedAt}.${signature}`)).toBeNull();
  });

  it('rejects a token signed with a different secret', () => {
    const token = createSessionToken(IDENTITY);
    process.env.AUTH_SESSION_SECRET = 'a-different-secret-of-sufficient-length';
    expect(verifySessionToken(token)).toBeNull();
  });

  it('rejects a token older than the session lifetime', () => {
    const issued = Date.now() - (DEFAULT_SESSION_MAX_AGE_SECONDS + 60) * 1000;
    expect(verifySessionToken(createSessionToken(IDENTITY, issued))).toBeNull();
  });

  it('accepts a token inside the lifetime', () => {
    const issued = Date.now() - (DEFAULT_SESSION_MAX_AGE_SECONDS - 60) * 1000;
    expect(verifySessionToken(createSessionToken(IDENTITY, issued))).not.toBeNull();
  });

  it('rejects a token dated far into the future', () => {
    // A clock-skew allowance exists, but an hour ahead is not skew — it is a
    // token minted to outlive its own expiry.
    expect(verifySessionToken(createSessionToken(IDENTITY, Date.now() + 3_600_000))).toBeNull();
  });

  it.each([
    ['empty', ''],
    ['no separators', 'garbage'],
    ['two parts', 'a.b'],
    ['four parts', 'a.b.c.d'],
    ['empty signature', 'a.1.'],
  ])('rejects a malformed token (%s)', (_label, token) => {
    expect(verifySessionToken(token)).toBeNull();
  });

  it('rejects a non-canonical (uppercase hex) signature', () => {
    // Node's hex decoder accepts uppercase while the Edge string compare does
    // not; without the shared format check the two verifiers would disagree
    // about the same token, and the middleware would let through what the
    // routes reject.
    const token = createSessionToken(IDENTITY);
    const [payload, issuedAt, signature] = token.split('.');
    const upper = `${payload}.${issuedAt}.${signature.toUpperCase()}`;

    expect(verifySessionToken(upper)).toBeNull();
  });

  describe('the Edge verifier agrees with the Node one', () => {
    it('accepts what Node accepts', async () => {
      await expect(isValidSessionTokenEdge(createSessionToken(IDENTITY))).resolves.toBe(true);
    });

    it('rejects an expired token', async () => {
      const issued = Date.now() - (DEFAULT_SESSION_MAX_AGE_SECONDS + 60) * 1000;
      await expect(isValidSessionTokenEdge(createSessionToken(IDENTITY, issued))).resolves.toBe(
        false,
      );
    });

    it('rejects a tampered signature', async () => {
      const token = createSessionToken(IDENTITY);
      const [payload, issuedAt, signature] = token.split('.');
      const flipped = signature.startsWith('0')
        ? `1${signature.slice(1)}`
        : `0${signature.slice(1)}`;

      await expect(isValidSessionTokenEdge(`${payload}.${issuedAt}.${flipped}`)).resolves.toBe(
        false,
      );
    });

    it('honours a shortened lifetime the same way', async () => {
      process.env.AUTH_SESSION_MAX_AGE_SECONDS = '60';
      const token = createSessionToken(IDENTITY, Date.now() - 120_000);

      expect(verifySessionToken(token)).toBeNull();
      await expect(isValidSessionTokenEdge(token)).resolves.toBe(false);
    });
  });
});

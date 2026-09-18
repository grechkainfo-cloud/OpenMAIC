import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { requestOwnerId } from '@/lib/server/agent-runtime/with-owner';
import { createSessionToken } from '@/lib/auth/session';
import { SESSION_COOKIE } from '@/lib/auth/config';
import type { Identity } from '@/lib/auth/types';

const LONG_SECRET = 'a-test-secret-that-is-long-enough-to-pass';
const ANON_UUID = '11111111-2222-4333-8444-555555555555';

const IDENTITY: Identity = {
  subject: 'test:admin',
  displayName: 'admin',
  roles: ['admin', 'author', 'viewer'],
};

function requestWith(cookies: Record<string, string>): Pick<Request, 'headers'> {
  const cookie = Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
  return { headers: new Headers(cookie ? { cookie } : {}) };
}

/**
 * Who owns the data a request writes.
 *
 * This is the pivot of the identity layer. If a signed-in person is partitioned
 * under an anonymous cookie instead of their subject, everything they create is
 * lost to them the moment that cookie changes — and they never see an error,
 * only an empty workspace.
 */
describe('owner partitioning', () => {
  beforeEach(() => {
    process.env.AUTH_PROVIDER = 'test';
    process.env.AUTH_SESSION_SECRET = LONG_SECRET;
  });

  afterEach(() => {
    delete process.env.AUTH_PROVIDER;
    delete process.env.AUTH_SESSION_SECRET;
  });

  it('uses the signed-in subject', async () => {
    const headers = new Headers();
    const owner = await requestOwnerId(
      requestWith({ [SESSION_COOKIE]: createSessionToken(IDENTITY) }),
      headers,
    );

    expect(owner).toBe('test:admin');
  });

  it('does not mint an anonymous cookie for a signed-in request', async () => {
    // Minting one would be harmless today and confusing later: two identities
    // for one person, and no way to tell which owns what.
    const headers = new Headers();
    await requestOwnerId(requestWith({ [SESSION_COOKIE]: createSessionToken(IDENTITY) }), headers);

    expect(headers.get('set-cookie')).toBeNull();
  });

  it('ignores an anonymous cookie that arrives alongside a session', async () => {
    // A person who used the app anonymously and then signed in carries both.
    // The session has to win, or signing in would silently do nothing.
    const headers = new Headers();
    const owner = await requestOwnerId(
      requestWith({
        anonymous_id: ANON_UUID,
        [SESSION_COOKIE]: createSessionToken(IDENTITY),
      }),
      headers,
    );

    expect(owner).toBe('test:admin');
  });

  it('is stable across requests, so the same person finds their own work', async () => {
    const first = await requestOwnerId(
      requestWith({ [SESSION_COOKIE]: createSessionToken(IDENTITY) }),
      new Headers(),
    );
    // A second sign-in mints a different token; the owner must not change.
    const second = await requestOwnerId(
      requestWith({ [SESSION_COOKIE]: createSessionToken(IDENTITY, Date.now() - 1000) }),
      new Headers(),
    );

    expect(second).toBe(first);
  });

  it('falls back to the anonymous identity when the session is invalid', async () => {
    const headers = new Headers();
    const owner = await requestOwnerId(
      requestWith({ anonymous_id: ANON_UUID, [SESSION_COOKIE]: 'not-a-token' }),
      headers,
    );

    expect(owner).toBe(`anon:${ANON_UUID}`);
  });

  it('keeps the anonymous behaviour when no provider is configured', async () => {
    delete process.env.AUTH_PROVIDER;
    const headers = new Headers();

    const owner = await requestOwnerId(requestWith({ anonymous_id: ANON_UUID }), headers);

    expect(owner).toBe(`anon:${ANON_UUID}`);
  });

  it('still mints an anonymous cookie for a first-time anonymous visitor', async () => {
    delete process.env.AUTH_PROVIDER;
    const headers = new Headers();

    const owner = await requestOwnerId(requestWith({}), headers);

    expect(owner).toMatch(/^anon:[0-9a-f-]{36}$/);
    expect(headers.get('set-cookie')).toContain('anonymous_id=');
  });
});

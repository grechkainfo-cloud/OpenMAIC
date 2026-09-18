import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import { middleware } from '@/middleware';
import { createSessionToken } from '@/lib/auth/session';
import { DEFAULT_SESSION_MAX_AGE_SECONDS, SESSION_COOKIE } from '@/lib/auth/config';
import type { Identity } from '@/lib/auth/types';

const LONG_SECRET = 'a-test-secret-that-is-long-enough-to-pass';

const IDENTITY: Identity = {
  subject: 'test:admin',
  displayName: 'admin',
  roles: ['admin', 'author', 'viewer'],
};

function request(path: string, sessionCookie?: string): NextRequest {
  const headers = new Headers();
  if (sessionCookie !== undefined) headers.set('cookie', `${SESSION_COOKIE}=${sessionCookie}`);
  return new NextRequest(`http://localhost${path}`, { method: 'GET', headers });
}

describe('middleware identity gate', () => {
  beforeEach(() => {
    process.env.AUTH_PROVIDER = 'test';
    process.env.AUTH_SESSION_SECRET = LONG_SECRET;
  });

  afterEach(() => {
    delete process.env.AUTH_PROVIDER;
    delete process.env.AUTH_SESSION_SECRET;
    delete process.env.ACCESS_CODE;
  });

  describe('with no session', () => {
    it('redirects a page request to the sign-in screen', async () => {
      const response = await middleware(request('/'));

      expect(response.status).toBe(307);
      expect(new URL(response.headers.get('location')!).pathname).toBe('/auth/login');
    });

    it('remembers where the request was headed', async () => {
      const response = await middleware(request('/classroom/abc?scene=2'));

      const location = new URL(response.headers.get('location')!);
      expect(location.pathname).toBe('/auth/login');
      expect(location.searchParams.get('next')).toBe('/classroom/abc?scene=2');
    });

    it('answers 401 for an API request rather than redirecting it', async () => {
      // A fetch that follows a redirect to an HTML login page reports success
      // and then fails to parse; the caller needs the status, not the page.
      const response = await middleware(request('/api/stages/abc'));
      expect(response.status).toBe(401);
    });

    it.each([
      '/auth/login',
      '/api/auth/login',
      '/api/auth/logout',
      '/api/auth/me',
      '/api/health',
      // The layout probes this on every page, the sign-in screen included.
      '/api/access-code/status',
    ])('lets %s through, or nobody could ever sign in', async (path) => {
      const response = await middleware(request(path));
      expect(response.status).toBe(200);
    });
  });

  describe('with a session', () => {
    it('lets a valid session through', async () => {
      const response = await middleware(request('/', createSessionToken(IDENTITY)));
      expect(response.status).toBe(200);
    });

    it('turns away an expired session', async () => {
      const stale = createSessionToken(
        IDENTITY,
        Date.now() - (DEFAULT_SESSION_MAX_AGE_SECONDS + 60) * 1000,
      );
      const response = await middleware(request('/api/stages/abc', stale));
      expect(response.status).toBe(401);
    });

    it('turns away a forged session', async () => {
      const token = createSessionToken(IDENTITY);
      const [payload, issuedAt] = token.split('.');
      const forged = `${payload}.${issuedAt}.${'0'.repeat(64)}`;

      const response = await middleware(request('/api/stages/abc', forged));

      expect(response.status).toBe(401);
    });

    it('turns away a session signed with another secret', async () => {
      const token = createSessionToken(IDENTITY);
      process.env.AUTH_SESSION_SECRET = 'a-completely-different-secret-value';

      const response = await middleware(request('/api/stages/abc', token));

      expect(response.status).toBe(401);
    });
  });

  it('supersedes the shared access code', async () => {
    // Both configured: the identity gate decides, and a valid session is not
    // asked for an access code on top.
    process.env.ACCESS_CODE = 'a-shared-code-long-enough';

    const response = await middleware(request('/', createSessionToken(IDENTITY)));

    expect(response.status).toBe(200);
  });

  it('leaves the access-code gate alone when no provider is configured', async () => {
    // The existing deployment mode must keep working exactly as before.
    delete process.env.AUTH_PROVIDER;
    process.env.ACCESS_CODE = 'a-shared-code-long-enough';

    const response = await middleware(request('/api/stages/abc'));

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: 'Access code required' });
  });

  it('does nothing at all when neither gate is configured', async () => {
    delete process.env.AUTH_PROVIDER;

    const response = await middleware(request('/api/stages/abc'));

    expect(response.status).toBe(200);
  });
});

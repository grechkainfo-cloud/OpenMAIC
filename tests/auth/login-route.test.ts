import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ATTEMPT_LIMIT_MAX_FAILURES } from '@/lib/server/attempt-limiter';
import { SESSION_COOKIE } from '@/lib/auth/config';

const mocks = vi.hoisted(() => ({ cookieSet: vi.fn() }));

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined, set: mocks.cookieSet }),
}));

const LONG_SECRET = 'a-test-secret-that-is-long-enough-to-pass';

type Post = (request: Request) => Promise<Response>;

/** Re-import the route so each test gets its own in-process attempt limiter. */
async function loadLogin(): Promise<Post> {
  vi.resetModules();
  const { POST } = await import('@/app/api/auth/login/route');
  return POST;
}

function loginRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    mocks.cookieSet.mockClear();
    process.env.AUTH_PROVIDER = 'test';
    process.env.AUTH_SESSION_SECRET = LONG_SECRET;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    delete process.env.AUTH_PROVIDER;
    delete process.env.AUTH_SESSION_SECRET;
    delete process.env.TRUST_PROXY_HEADERS;
    vi.restoreAllMocks();
  });

  it('issues a session cookie for the right credentials', async () => {
    const post = await loadLogin();

    const response = await post(loginRequest({ username: 'admin', password: 'admin' }));

    expect(response.status).toBe(200);
    expect(mocks.cookieSet).toHaveBeenCalledOnce();
    const [name, value, options] = mocks.cookieSet.mock.calls[0];
    expect(name).toBe(SESSION_COOKIE);
    expect(value).toMatch(/^[\w-]+\.\d+\.[0-9a-f]{64}$/);
    // HttpOnly is what keeps a cross-site script from reading the session.
    expect(options).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' });
  });

  it('never echoes the password back', async () => {
    // Distinctive credentials, so the assertion cannot pass by accident: with
    // the defaults the password and the display name are the same string.
    process.env.AUTH_TEST_USERNAME = 'operator';
    process.env.AUTH_TEST_PASSWORD = 'correct-horse-battery-staple';
    const post = await loadLogin();

    const response = await post(
      loginRequest({ username: 'operator', password: 'correct-horse-battery-staple' }),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain('correct-horse-battery-staple');
    delete process.env.AUTH_TEST_USERNAME;
    delete process.env.AUTH_TEST_PASSWORD;
  });

  it.each([
    ['a wrong password', { username: 'admin', password: 'nope' }],
    ['a wrong username', { username: 'root', password: 'admin' }],
    ['a missing password', { username: 'admin' }],
    ['an empty body', {}],
  ])('answers 401 and sets no cookie for %s', async (_label, body) => {
    const post = await loadLogin();

    const response = await post(loginRequest(body));

    expect(response.status).toBe(401);
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it('answers the same message for a wrong username and a wrong password', async () => {
    // Different messages would tell an attacker which half to keep guessing.
    const post = await loadLogin();
    const wrongUser = await post(loginRequest({ username: 'nobody', password: 'admin' }));
    const wrongPass = await post(loginRequest({ username: 'admin', password: 'nobody' }));

    expect(wrongUser.status).toBe(wrongPass.status);
    expect(await wrongUser.text()).toBe(await wrongPass.text());
  });

  it('rejects a malformed body without crashing', async () => {
    const post = await loadLogin();
    const response = await post(loginRequest('{not json'));
    expect(response.status).toBe(400);
  });

  it('answers 404 when no identity provider is configured', async () => {
    // Otherwise a deployment with authentication off would still expose a
    // credential-checking endpoint.
    delete process.env.AUTH_PROVIDER;
    const post = await loadLogin();

    const response = await post(loginRequest({ username: 'admin', password: 'admin' }));

    expect(response.status).toBe(404);
  });

  it('answers 501 for the windows provider rather than pretending to sign in', async () => {
    process.env.AUTH_PROVIDER = 'windows';
    const post = await loadLogin();

    const response = await post(loginRequest({ username: 'admin', password: 'admin' }));

    expect(response.status).toBe(501);
  });

  describe('attempt limiting behind a trusted proxy', () => {
    beforeEach(() => {
      process.env.TRUST_PROXY_HEADERS = 'true';
    });

    it('throttles repeated failures from one client', async () => {
      const post = await loadLogin();
      const headers = { 'x-forwarded-for': '10.1.2.3' };

      for (let attempt = 0; attempt < ATTEMPT_LIMIT_MAX_FAILURES; attempt += 1) {
        const response = await post(loginRequest({ username: 'admin', password: 'no' }, headers));
        expect(response.status).toBe(401);
      }

      const limited = await post(loginRequest({ username: 'admin', password: 'no' }, headers));
      expect(limited.status).toBe(429);
      expect(Number(limited.headers.get('Retry-After'))).toBeGreaterThan(0);
    });

    it('counts a malformed body too, so garbage cannot be used to probe for free', async () => {
      const post = await loadLogin();
      const headers = { 'x-forwarded-for': '10.9.9.9' };

      for (let attempt = 0; attempt < ATTEMPT_LIMIT_MAX_FAILURES; attempt += 1) {
        await post(loginRequest('{not json', headers));
      }

      const limited = await post(loginRequest({ username: 'admin', password: 'admin' }, headers));
      expect(limited.status).toBe(429);
    });

    it('keeps one client from exhausting the budget of another', async () => {
      const post = await loadLogin();

      for (let attempt = 0; attempt < ATTEMPT_LIMIT_MAX_FAILURES; attempt += 1) {
        await post(
          loginRequest({ username: 'admin', password: 'no' }, { 'x-forwarded-for': '1.1.1.1' }),
        );
      }

      const other = await post(
        loginRequest({ username: 'admin', password: 'admin' }, { 'x-forwarded-for': '2.2.2.2' }),
      );
      expect(other.status).toBe(200);
    });
  });
});

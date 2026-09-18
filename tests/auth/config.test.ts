import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  assertAuthConfig,
  authProviderId,
  isAuthEnabled,
  sessionMaxAgeSeconds,
} from '@/lib/auth/config';
import { verifyTestCredentials } from '@/lib/auth/providers/test';

const LONG_SECRET = 'a-test-secret-that-is-long-enough-to-pass';

const AUTH_VARS = [
  'AUTH_PROVIDER',
  'AUTH_SESSION_SECRET',
  'AUTH_SESSION_MAX_AGE_SECONDS',
  'AUTH_TEST_USERNAME',
  'AUTH_TEST_PASSWORD',
  'AUTH_TEST_ALLOW_IN_PRODUCTION',
  'ACCESS_CODE',
] as const;

describe('identity configuration', () => {
  beforeEach(() => {
    for (const name of AUTH_VARS) delete process.env[name];
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    for (const name of AUTH_VARS) delete process.env[name];
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('provider selection', () => {
    it('defaults to none, which is the pre-identity-layer behaviour', () => {
      expect(authProviderId()).toBe('none');
      expect(isAuthEnabled()).toBe(false);
      // Nothing else is required when nobody asked for authentication.
      expect(() => assertAuthConfig()).not.toThrow();
    });

    it('throws on an unrecognised value rather than falling back to none', () => {
      // A typo in AUTH_PROVIDER must not silently turn authentication off.
      process.env.AUTH_PROVIDER = 'tets';
      expect(() => authProviderId()).toThrow(/not a known provider/);
    });

    it('accepts the documented values, case-insensitively', () => {
      process.env.AUTH_PROVIDER = 'Test';
      expect(authProviderId()).toBe('test');
      process.env.AUTH_PROVIDER = 'WINDOWS';
      expect(authProviderId()).toBe('windows');
    });
  });

  describe('startup validation', () => {
    it('refuses to start without a session secret', () => {
      process.env.AUTH_PROVIDER = 'test';
      expect(() => assertAuthConfig()).toThrow(/AUTH_SESSION_SECRET is required/);
    });

    it('refuses a session secret that is too short to be worth signing with', () => {
      process.env.AUTH_PROVIDER = 'test';
      process.env.AUTH_SESSION_SECRET = 'short';
      expect(() => assertAuthConfig()).toThrow(/at least 32/);
    });

    it('names the cause when the secret is an unexpanded shell substitution', () => {
      // An .env file is read literally, so a pasted `$(openssl rand …)` is
      // stored as those 26 characters. "26 characters" alone sends people
      // hunting for a truncation that never happened.
      process.env.AUTH_PROVIDER = 'test';
      process.env.AUTH_SESSION_SECRET = '$(openssl rand -base64 48)';

      expect(() => assertAuthConfig()).toThrow(/looks like a shell substitution/);
    });

    it('does not cry substitution over an ordinary short secret', () => {
      process.env.AUTH_PROVIDER = 'test';
      process.env.AUTH_SESSION_SECRET = 'short';

      expect(() => assertAuthConfig()).not.toThrow(/shell substitution/);
    });

    it('refuses the windows provider until it exists', () => {
      // Better at startup than as a 500 on somebody's first sign-in attempt.
      process.env.AUTH_PROVIDER = 'windows';
      process.env.AUTH_SESSION_SECRET = LONG_SECRET;
      expect(() => assertAuthConfig()).toThrow(/not implemented yet/);
    });

    it('rejects a non-numeric session lifetime', () => {
      process.env.AUTH_SESSION_MAX_AGE_SECONDS = 'forever';
      expect(() => sessionMaxAgeSeconds()).toThrow(/positive integer/);
    });

    it('accepts a valid test configuration', () => {
      process.env.AUTH_PROVIDER = 'test';
      process.env.AUTH_SESSION_SECRET = LONG_SECRET;
      expect(() => assertAuthConfig()).not.toThrow();
    });
  });

  describe('the test provider in production', () => {
    beforeEach(() => {
      process.env.AUTH_PROVIDER = 'test';
      process.env.AUTH_SESSION_SECRET = LONG_SECRET;
      vi.stubEnv('NODE_ENV', 'production');
    });

    it('refuses to start without an explicit opt-in', () => {
      // The contour stand runs as production. Reaching it must take a
      // deliberate act, not an unnoticed default.
      expect(() => assertAuthConfig()).toThrow(/AUTH_TEST_ALLOW_IN_PRODUCTION/);
    });

    it('starts with the opt-in, and says so loudly when still on admin/admin', () => {
      process.env.AUTH_TEST_ALLOW_IN_PRODUCTION = 'true';
      expect(() => assertAuthConfig()).not.toThrow();
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('default credentials'));
    });

    it('stops warning once the credentials are overridden', () => {
      process.env.AUTH_TEST_ALLOW_IN_PRODUCTION = '1';
      process.env.AUTH_TEST_USERNAME = 'operator';
      process.env.AUTH_TEST_PASSWORD = 'something-else-entirely';
      assertAuthConfig();
      expect(console.warn).not.toHaveBeenCalledWith(expect.stringContaining('default credentials'));
    });
  });

  it('warns that an identity provider supersedes ACCESS_CODE', () => {
    process.env.AUTH_PROVIDER = 'test';
    process.env.AUTH_SESSION_SECRET = LONG_SECRET;
    process.env.ACCESS_CODE = 'a-shared-code';

    assertAuthConfig();

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('supersedes it'));
  });

  describe('credential checking', () => {
    it('accepts the default pair', () => {
      expect(verifyTestCredentials('admin', 'admin')).toEqual({
        subject: 'test:admin',
        displayName: 'admin',
        roles: ['admin', 'author', 'viewer'],
      });
    });

    it.each([
      ['wrong password', 'admin', 'nope'],
      ['wrong username', 'root', 'admin'],
      ['both wrong', 'root', 'nope'],
      ['empty password', 'admin', ''],
      ['password as a prefix of the real one', 'admin', 'adm'],
      ['password with the real one as a prefix', 'admin', 'adminadmin'],
    ])('rejects %s', (_label, username, password) => {
      expect(verifyTestCredentials(username, password)).toBeNull();
    });

    it('uses the overridden credentials when they are set', () => {
      process.env.AUTH_TEST_USERNAME = 'operator';
      process.env.AUTH_TEST_PASSWORD = 'correct horse battery staple';

      expect(verifyTestCredentials('admin', 'admin')).toBeNull();
      expect(verifyTestCredentials('operator', 'correct horse battery staple')).toMatchObject({
        subject: 'test:operator',
      });
    });
  });
});

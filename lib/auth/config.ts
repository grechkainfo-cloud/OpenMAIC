/**
 * Identity-layer configuration, read from the environment.
 *
 * Edge-safe: no `node:*` imports, so `middleware.ts` can ask which provider is
 * configured without dragging Node crypto into the Edge bundle.
 *
 * Every value is read at call time rather than at module load, so a test can
 * change the environment without reloading the module — the same convention the
 * SSRF guard uses.
 */

import { isAuthProviderId, type AuthProviderId } from './types';

/** Session cookie name. Distinct from `openmaic_access` (the shared-code gate). */
export const SESSION_COOKIE = 'openmaic_session';

/** Default session lifetime: one working day. */
export const DEFAULT_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

/** Where an unauthenticated browser request is sent. */
export const LOGIN_PATH = '/auth/login';

/** Test-provider credentials when nothing overrides them. */
export const TEST_DEFAULT_USERNAME = 'admin';
export const TEST_DEFAULT_PASSWORD = 'admin';

/**
 * Which provider this deployment runs. Unset — the default — means `none`:
 * the app behaves exactly as it did before the identity layer existed, which
 * keeps local development and the browser-only deployment working.
 *
 * An unrecognised value is NOT quietly treated as `none`: a typo in
 * `AUTH_PROVIDER` would then silently turn authentication off.
 */
export function authProviderId(): AuthProviderId {
  const raw = process.env.AUTH_PROVIDER?.trim().toLowerCase();
  if (!raw) return 'none';
  if (!isAuthProviderId(raw)) {
    throw new Error(`AUTH_PROVIDER="${raw}" is not a known provider. Use none, test or windows.`);
  }
  return raw;
}

/** Whether any identity provider is active. */
export function isAuthEnabled(): boolean {
  return authProviderId() !== 'none';
}

/**
 * The HMAC key the session cookie is signed with.
 *
 * Never `NEXT_PUBLIC_`: that prefix compiles the value into the bundle every
 * browser downloads, and anyone holding it can mint a session for any subject.
 */
export function sessionSecret(): string {
  const secret = process.env.AUTH_SESSION_SECRET?.trim();
  if (!secret) {
    throw new Error(
      'AUTH_SESSION_SECRET is required when AUTH_PROVIDER is set. ' +
        'Generate one with: openssl rand -base64 48',
    );
  }
  return secret;
}

/** Minimum secret length. Short keys make the signature forgeable by search. */
export const MIN_SESSION_SECRET_LENGTH = 32;

export function sessionMaxAgeSeconds(): number {
  const raw = process.env.AUTH_SESSION_MAX_AGE_SECONDS?.trim();
  if (!raw) return DEFAULT_SESSION_MAX_AGE_SECONDS;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`AUTH_SESSION_MAX_AGE_SECONDS="${raw}" must be a positive integer.`);
  }
  return parsed;
}

export function testUsername(): string {
  return process.env.AUTH_TEST_USERNAME?.trim() || TEST_DEFAULT_USERNAME;
}

export function testPassword(): string {
  return process.env.AUTH_TEST_PASSWORD || TEST_DEFAULT_PASSWORD;
}

/** Whether the test provider is running on its published default credentials. */
export function testUsesDefaultCredentials(): boolean {
  return testUsername() === TEST_DEFAULT_USERNAME && testPassword() === TEST_DEFAULT_PASSWORD;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function testAllowedInProduction(): boolean {
  const raw = process.env.AUTH_TEST_ALLOW_IN_PRODUCTION?.trim().toLowerCase();
  return raw === 'true' || raw === '1';
}

/**
 * Whether the session cookie carries `Secure`.
 *
 * Mirrors the anonymous owner cookie: on by default in production, opted out
 * with the exact value `COOKIE_SECURE=0`. Safari refuses to store `Secure`
 * cookies served over plain `http://localhost`, and a session cookie that is
 * never stored means an endless loop back to the login screen.
 */
export function sessionCookieSecure(): boolean {
  return isProduction() && process.env.COOKIE_SECURE !== '0';
}

/**
 * Extra guidance when a value looks like a shell expression nobody expanded.
 *
 * An `.env` file is not a script: Docker Compose and Next read it literally, so
 * a line pasted as `AUTH_SESSION_SECRET=$(openssl rand -base64 48)` stores those
 * 26 characters verbatim. The length check catches it, but "26 characters" on
 * its own sends people looking for a truncation that never happened.
 */
function unexpandedSubstitutionHint(value: string): string {
  if (!/^\$[({`]|^`/.test(value)) return '';
  return (
    ` — the value is literally "${value}", which looks like a shell substitution ` +
    'that was never run. An .env file is read literally: generate the secret in a ' +
    'shell first, then paste the result.'
  );
}

/**
 * Validate the identity configuration, or throw.
 *
 * Called from `instrumentation.ts`, which runs before the server accepts a
 * request: a deployment configured wrongly must fail to START, not fail on the
 * first login while reporting itself healthy.
 */
export function assertAuthConfig(): void {
  const provider = authProviderId();
  if (provider === 'none') return;

  const secret = sessionSecret();
  if (secret.length < MIN_SESSION_SECRET_LENGTH) {
    throw new Error(
      `AUTH_SESSION_SECRET is ${secret.length} characters; at least ` +
        `${MIN_SESSION_SECRET_LENGTH} are required. Generate one with: ` +
        `openssl rand -base64 48${unexpandedSubstitutionHint(secret)}`,
    );
  }
  sessionMaxAgeSeconds();

  if (provider === 'windows') {
    throw new Error(
      'AUTH_PROVIDER=windows is not implemented yet — it arrives with the Kerberos ' +
        'phase (docs/plan/auth.md). Use AUTH_PROVIDER=test until then.',
    );
  }

  if (provider === 'test') {
    if (isProduction() && !testAllowedInProduction()) {
      throw new Error(
        'AUTH_PROVIDER=test authenticates against credentials held in the ' +
          'environment and is meant for a test stand, not for production. ' +
          'Set AUTH_TEST_ALLOW_IN_PRODUCTION=true to run it anyway, and override ' +
          'AUTH_TEST_USERNAME / AUTH_TEST_PASSWORD before anyone else can reach it.',
      );
    }
    if (testUsesDefaultCredentials()) {
      // Deliberately a warning and not a throw: the default pair is the point
      // of the provider during development. It is loud because a stand that
      // keeps admin/admin is one everybody who ever saw a demo can log into.
      console.warn(
        '[auth] The test provider is running on the default credentials ' +
          `(${TEST_DEFAULT_USERNAME}/${TEST_DEFAULT_PASSWORD}). Anyone who has seen this ` +
          'project can log in. Set AUTH_TEST_USERNAME and AUTH_TEST_PASSWORD.',
      );
    }
  }

  if (process.env.ACCESS_CODE?.trim()) {
    console.warn(
      `[auth] ACCESS_CODE is set but AUTH_PROVIDER=${provider} supersedes it: the shared ` +
        'access code is ignored while an identity provider is active.',
    );
  }
}

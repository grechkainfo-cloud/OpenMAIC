/**
 * Node-side session tokens: minting, verification and the cookie header.
 *
 * The scheme is a signed cookie, not a server-side session table. That is a
 * deliberate trade recorded in docs/plan/identity.md: the test provider has to
 * work with no database at all, and a session that cannot be revoked matters
 * only once there are real users to revoke. The store seam for a durable
 * implementation arrives with the Kerberos provider.
 *
 * The Edge middleware uses `session-edge.ts`; both import the format from
 * `session-shared.ts` so they cannot drift apart.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

import { SESSION_COOKIE, sessionCookieSecure, sessionMaxAgeSeconds, sessionSecret } from './config';
import {
  isSessionSignatureFormatValid,
  isSessionTimestampValid,
  fromBase64Url,
  parseSessionPayload,
  serializeSessionPayload,
  splitSessionToken,
  toBase64Url,
} from './session-shared';
import type { Identity } from './types';

function sign(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('hex');
}

/** Mint a signed session token for `identity`. */
export function createSessionToken(identity: Identity, now: number = Date.now()): string {
  const payload = toBase64Url(
    Buffer.from(serializeSessionPayload(identity), 'utf8').toString('base64'),
  );
  const issuedAt = String(now);
  const signature = sign(`${payload}.${issuedAt}`, sessionSecret());
  return `${payload}.${issuedAt}.${signature}`;
}

/**
 * Verify a token and return the identity it carries, or null.
 *
 * Null for every failure — expired, forged, malformed, or a shape this version
 * no longer understands. A caller that only wants a boolean can compare against
 * null; nobody gets a reason string, because the reason is the same to the
 * client either way.
 */
export function verifySessionToken(token: string, now: number = Date.now()): Identity | null {
  const parts = splitSessionToken(token);
  if (!parts) return null;

  if (!isSessionTimestampValid(parts.issuedAt, sessionMaxAgeSeconds(), now)) return null;
  if (!isSessionSignatureFormatValid(parts.signature)) return null;

  const expected = sign(parts.signedData, sessionSecret());
  const actualBuf = Buffer.from(parts.signature, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  if (actualBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(actualBuf, expectedBuf)) return null;

  let json: string;
  try {
    json = Buffer.from(fromBase64Url(parts.payload), 'base64').toString('utf8');
  } catch {
    return null;
  }
  return parseSessionPayload(json);
}

/** Read the session cookie out of a request, if present. */
export function readSessionCookie(headers: Headers): string | undefined {
  const encoded = headers.get('cookie');
  if (!encoded) return undefined;
  for (const item of encoded.split(';')) {
    const separator = item.indexOf('=');
    if (separator < 0 || item.slice(0, separator).trim() !== SESSION_COOKIE) continue;
    try {
      return decodeURIComponent(item.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Cookie attributes, shared by the login and logout routes so a session cannot
 * be issued on one path and left un-clearable on another.
 *
 * `SameSite=Lax` rather than `Strict`: the login form redirects back into the
 * app, and `Strict` withholds the cookie on that first navigation, which shows
 * the user the login screen again immediately after a successful login.
 */
export function sessionCookieOptions(maxAge: number = sessionMaxAgeSeconds()) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
    secure: sessionCookieSecure(),
  };
}

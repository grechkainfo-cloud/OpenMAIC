/**
 * Session-token format, shared by the Node and Edge verifiers.
 *
 * Dependency-free on purpose: `middleware.ts` runs on the Edge, the API routes
 * run on Node, and the two must not be able to disagree about what a valid
 * token looks like. Anything importable by both lives here.
 *
 * Token layout:
 *
 *     <payload-base64url>.<issued-at-ms>.<hmac-sha256-hex>
 *
 * The signature covers `<payload>.<issued-at>`, so neither half can be swapped
 * for another token's. The payload is not encrypted — it holds a subject, a
 * display name and roles, none of which is a secret — only signed, so the
 * client cannot change it.
 */

import { isRole, type Identity, type Role } from './types';

/** How far a token timestamp may lead the server clock. */
export const SESSION_CLOCK_SKEW_SECONDS = 5 * 60;

/** Canonical HMAC-SHA256: exactly 64 lowercase hex characters. */
const SIGNATURE_PATTERN = /^[0-9a-f]{64}$/;

export function isSessionSignatureFormatValid(signature: string): boolean {
  return SIGNATURE_PATTERN.test(signature);
}

export interface SessionTokenParts {
  payload: string;
  issuedAt: string;
  signature: string;
  /** Exactly what the signature covers. */
  signedData: string;
}

/** Split a token into its three parts, or null when it is not one. */
export function splitSessionToken(token: string): SessionTokenParts | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [payload, issuedAt, signature] = parts;
  if (!payload || !issuedAt || !signature) return null;
  return { payload, issuedAt, signature, signedData: `${payload}.${issuedAt}` };
}

/**
 * Whether `issuedAt` is inside the session lifetime.
 *
 * @param now Server time in epoch milliseconds (injectable for tests).
 */
export function isSessionTimestampValid(
  issuedAt: string,
  maxAgeSeconds: number,
  now: number = Date.now(),
): boolean {
  // Rejects empty strings, signs, decimals, and hex/exponent forms.
  if (!/^\d+$/.test(issuedAt)) return false;
  const issuedAtMs = Number(issuedAt);
  if (!Number.isFinite(issuedAtMs)) return false;

  const ageMs = now - issuedAtMs;
  if (ageMs > maxAgeSeconds * 1000) return false;
  if (ageMs < -SESSION_CLOCK_SKEW_SECONDS * 1000) return false;
  return true;
}

/** base64url, without padding — cookie-safe and the same in Node and the Edge. */
export function toBase64Url(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(base64url: string): string {
  const padded = base64url.replace(/-/g, '+').replace(/_/g, '/');
  return padded + '='.repeat((4 - (padded.length % 4)) % 4);
}

/**
 * Turn a decoded payload string into an Identity, or null.
 *
 * The signature has already been checked by the time this runs, so this is not
 * a security boundary — it is the guard against a token minted by an older
 * version of this code whose shape has since changed.
 */
export function parseSessionPayload(json: string): Identity | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;

  const { sub, name, roles } = parsed as { sub?: unknown; name?: unknown; roles?: unknown };
  if (typeof sub !== 'string' || sub.length === 0) return null;
  if (typeof name !== 'string') return null;
  if (!Array.isArray(roles)) return null;

  const parsedRoles: Role[] = [];
  for (const role of roles) {
    if (typeof role !== 'string' || !isRole(role)) return null;
    parsedRoles.push(role);
  }

  return { subject: sub, displayName: name, roles: parsedRoles };
}

/** The JSON that goes into a token. Kept next to its parser so they agree. */
export function serializeSessionPayload(identity: Identity): string {
  return JSON.stringify({
    sub: identity.subject,
    name: identity.displayName,
    roles: identity.roles,
  });
}

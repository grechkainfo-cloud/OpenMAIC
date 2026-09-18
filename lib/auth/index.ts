/**
 * Server-side entry point for the identity layer.
 *
 * Node only: it reaches the providers, which use `node:crypto`. The Edge
 * middleware imports `config.ts` and `session-edge.ts` directly instead.
 */

import { authProviderId, isAuthEnabled } from './config';
import { testProvider } from './providers/test';
import { windowsProvider } from './providers/windows';
import { verifySessionToken } from './session';
import type { Identity, IdentityProvider } from './types';

/** The provider this deployment runs, or null when authentication is off. */
export function identityProvider(): IdentityProvider | null {
  switch (authProviderId()) {
    case 'test':
      return testProvider;
    case 'windows':
      return windowsProvider;
    case 'none':
      return null;
  }
}

/**
 * The identity behind this request, or null.
 *
 * Null covers both "authentication is off" and "nobody is logged in". Callers
 * that need to tell those apart ask {@link isAuthEnabled} as well — most do
 * not: with authentication off, everything keeps the anonymous behaviour it
 * had before this layer existed.
 */
export async function resolveIdentity(req: Pick<Request, 'headers'>): Promise<Identity | null> {
  const provider = identityProvider();
  if (!provider) return null;
  return provider.resolve(req);
}

/**
 * The owner id an authenticated request writes under, or undefined.
 *
 * This is what `resolveRequestOwnerId` takes as its `authenticatedOwnerId`: a
 * logged-in person must not be partitioned under a fresh anonymous cookie, or
 * the courses they create disappear the next time they log in.
 */
export async function resolveOwnerSubject(
  req: Pick<Request, 'headers'>,
): Promise<string | undefined> {
  const identity = await resolveIdentity(req);
  return identity?.subject;
}

export { isAuthEnabled, authProviderId };
export type { Identity, IdentityProvider };

/**
 * Verify a session token that the caller already holds.
 *
 * For a Server Action there is no `Request` to resolve from — only Next's
 * cookie store — so it reads the cookie itself and brings the value here.
 * Returns null whenever authentication is off, so an anonymous deployment
 * keeps its anonymous owner.
 */
export function identityFromSessionToken(token: string | undefined | null): Identity | null {
  if (!isAuthEnabled() || !token) return null;
  return verifySessionToken(token);
}

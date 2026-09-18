import { cookies } from 'next/headers';

import { apiError, apiSuccess } from '@/lib/server/api-response';
import { authProviderId } from '@/lib/auth/config';
import { createSessionToken, sessionCookieOptions } from '@/lib/auth/session';
import { verifyTestCredentials } from '@/lib/auth/providers/test';
import { WINDOWS_NOT_IMPLEMENTED } from '@/lib/auth/providers/windows';
import { loginAttemptLimiter } from '@/lib/server/attempt-limiter';
import { clientIdentity, isTrustedProxyIdentity } from '@/lib/server/client-identity';

/** Pull credentials out of an already-parsed JSON body. */
function readCredentials(body: unknown): { username: string; password: string } | null {
  if (typeof body !== 'object' || body === null) return null;
  const { username, password } = body as { username?: unknown; password?: unknown };
  if (typeof username !== 'string' || username.length === 0) return null;
  if (typeof password !== 'string' || password.length === 0) return null;
  return { username, password };
}

export async function POST(request: Request) {
  const provider = authProviderId();
  if (provider === 'none') {
    return apiError('INVALID_REQUEST', 404, 'Authentication is not enabled');
  }
  if (provider === 'windows') {
    return apiError('INVALID_REQUEST', 501, WINDOWS_NOT_IMPLEMENTED);
  }

  // Reserved before the body is read, so a malformed body still costs an
  // attempt: otherwise the limiter is trivially bypassed by sending garbage.
  // The limiter is per-identity and only throttles identities a trusted proxy
  // vouched for — see attempt-limiter.ts for why an untrusted caller is not
  // counted at all.
  const trusted = isTrustedProxyIdentity();
  const identity = clientIdentity(request);
  const limit = loginAttemptLimiter.consume(identity, trusted);
  if (limit.limited) {
    const response = apiError('RATE_LIMITED', 429, 'Too many sign-in attempts');
    response.headers.set('Retry-After', String(limit.retryAfterSeconds));
    return response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('INVALID_REQUEST', 400, 'Invalid JSON body');
  }

  const credentials = readCredentials(body);
  // One message and one status for every failure — wrong user, wrong password,
  // missing field. Distinguishing them tells an attacker which half to keep.
  if (!credentials) {
    return apiError('INVALID_REQUEST', 401, 'Invalid credentials');
  }

  const resolved = verifyTestCredentials(credentials.username, credentials.password);
  if (!resolved) {
    // The password is never logged. The attempt is, because an operator
    // investigating a lockout needs to know it happened and from where.
    console.warn(`[auth] failed sign-in for "${credentials.username}" from ${identity}`);
    return apiError('INVALID_REQUEST', 401, 'Invalid credentials');
  }

  loginAttemptLimiter.recordSuccess(identity, trusted);

  const cookieStore = await cookies();
  cookieStore.set('openmaic_session', createSessionToken(resolved), sessionCookieOptions());

  return apiSuccess({
    identity: {
      subject: resolved.subject,
      displayName: resolved.displayName,
      roles: resolved.roles,
    },
  });
}

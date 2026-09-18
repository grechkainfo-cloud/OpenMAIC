import { cookies } from 'next/headers';

import { apiSuccess } from '@/lib/server/api-response';
import { SESSION_COOKIE } from '@/lib/auth/config';
import { sessionCookieOptions } from '@/lib/auth/session';

/**
 * Clear the session.
 *
 * Always succeeds, including when there was no session: a logout that reports
 * an error when the session already expired sends the user looking for a
 * problem that does not exist.
 *
 * The cookie is overwritten with an empty value and a zero lifetime rather than
 * merely deleted, using the same attributes it was issued with — a mismatched
 * Path or Secure flag leaves the original cookie in place and the user
 * apparently still signed in.
 */
export async function POST() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, '', sessionCookieOptions(0));
  return apiSuccess({ signedOut: true });
}

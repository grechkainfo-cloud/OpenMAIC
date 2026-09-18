import { resolveOwnerSubject } from '@/lib/auth';

import { resolveRequestOwnerId } from './owner';

/**
 * The owner id for this request: the signed-in subject when there is one,
 * otherwise the anonymous cookie identity.
 *
 * Every owner-scoped route goes through here or through
 * {@link withRequestOwnerId}. Skipping it would partition a signed-in person's
 * work under a fresh anonymous cookie, and their courses would vanish the next
 * time they signed in.
 *
 * With no identity provider configured `resolveOwnerSubject` answers undefined
 * and this is exactly the anonymous behaviour that existed before.
 */
export async function requestOwnerId(
  req: Pick<Request, 'headers'>,
  responseHeaders: Headers,
): Promise<string> {
  return resolveRequestOwnerId(req, responseHeaders, await resolveOwnerSubject(req));
}

/**
 * Resolve the anonymous owner identity and run a handler with its response
 * headers.
 *
 * The Set-Cookie minted by resolveRequestOwnerId must ride every response,
 * including 4xx and 5xx: a client that retries after an error keeps the same
 * owner partition, while a 500 that dropped the cookie would silently make
 * the retry a different anonymous owner.
 */
export async function withRequestOwnerId(
  req: Pick<Request, 'headers'>,
  handler: (ownerId: string, responseHeaders: Headers) => Promise<Response>,
): Promise<Response> {
  const responseHeaders = new Headers();
  const ownerId = await requestOwnerId(req, responseHeaders);
  try {
    return await handler(ownerId, responseHeaders);
  } catch (error) {
    console.error('[agent-runtime] request failed under an anonymous owner', error);
    return new Response('Internal Server Error', { status: 500, headers: responseHeaders });
  }
}

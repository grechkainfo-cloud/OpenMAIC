import { apiSuccess } from '@/lib/server/api-response';
import { authProviderId } from '@/lib/auth/config';
import { resolveIdentity } from '@/lib/auth';

/**
 * Who is signed in, for the UI.
 *
 * Answers 200 in every case, with `identity: null` when nobody is signed in:
 * this is the question "is anyone signed in", and a 401 would make the UI treat
 * a truthful answer as a failure. The route is on the middleware's allow-list
 * for the same reason.
 */
export async function GET(request: Request) {
  const provider = authProviderId();
  if (provider === 'none') {
    return apiSuccess({ provider, identity: null });
  }

  const identity = await resolveIdentity(request);
  return apiSuccess({
    provider,
    identity: identity
      ? { subject: identity.subject, displayName: identity.displayName, roles: identity.roles }
      : null,
  });
}

/**
 * Placeholder for the Windows (Kerberos/SPNEGO + LDAP) identity provider.
 *
 * It occupies its slot in the configuration now so that switching a deployment
 * over later is a configuration change rather than a rewrite. Until the
 * Kerberos phase lands (docs/plan/auth.md), selecting it fails at startup —
 * `assertAuthConfig()` throws before the server accepts a request, so a
 * deployment that asks for it never reaches the point of answering a login with
 * a 500.
 *
 * What it will do, recorded here so the shape is not re-litigated later:
 * terminate SPNEGO once at the login route, read the account SID (not
 * `DOMAIN\username`) as the subject, resolve group membership over LDAPS in a
 * separate query rather than by decoding the PAC, map those groups to roles
 * through configuration, and then hand over to the same session cookie every
 * other provider uses.
 */

import type { IdentityProvider } from '../types';

export const WINDOWS_NOT_IMPLEMENTED =
  'AUTH_PROVIDER=windows is not implemented yet — it arrives with the Kerberos phase ' +
  '(docs/plan/auth.md). Use AUTH_PROVIDER=test until then.';

export const windowsProvider: IdentityProvider = {
  id: 'windows',
  async resolve() {
    throw new Error(WINDOWS_NOT_IMPLEMENTED);
  },
};

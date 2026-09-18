/**
 * The identity layer's vocabulary.
 *
 * Kept free of `node:*` imports so the Edge middleware can import the types and
 * the constants without pulling a Node-only module into its bundle.
 */

/** Which identity provider a deployment runs. */
export type AuthProviderId = 'none' | 'test' | 'windows';

export const AUTH_PROVIDER_IDS: readonly AuthProviderId[] = ['none', 'test', 'windows'];

export function isAuthProviderId(value: string): value is AuthProviderId {
  return (AUTH_PROVIDER_IDS as readonly string[]).includes(value);
}

/**
 * Roles this deployment knows about. Deliberately few: a role that nothing
 * checks is a promise the code does not keep. Per-route authorization arrives
 * with phase 4; until then these travel in the session and are shown in the UI.
 */
export type Role = 'admin' | 'author' | 'viewer';

export const ROLES: readonly Role[] = ['admin', 'author', 'viewer'];

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export interface Identity {
  /**
   * Stable identifier for this principal, namespaced by provider.
   *
   * For `test` it is `test:<username>`. For `windows` it will be the account's
   * SID (`windows:S-1-5-21-…`), never `DOMAIN\username`: the name changes when
   * a person is renamed or moves between OUs, and everything that person owns
   * would be orphaned. The SID does not change.
   *
   * This value partitions owned data, so it must never be recycled between two
   * different people.
   */
  subject: string;
  /** What to show in the UI. Not an identifier — may collide, may change. */
  displayName: string;
  roles: Role[];
}

/**
 * How a request becomes an identity.
 *
 * `resolve` answers for the request in hand; `null` means "no identity", which
 * the caller turns into a redirect or a 401. Providers do not themselves decide
 * what happens to an anonymous request.
 */
export interface IdentityProvider {
  readonly id: AuthProviderId;
  resolve(req: Pick<Request, 'headers'>): Promise<Identity | null>;
}

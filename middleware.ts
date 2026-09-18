import { NextRequest, NextResponse } from 'next/server';

import { isAgentRuntimeConfigured, isProWorkbenchEnabled } from '@/lib/config/feature-flags';
import { isAuthEnabled, LOGIN_PATH, SESSION_COOKIE } from '@/lib/auth/config';
import { isValidSessionTokenEdge } from '@/lib/auth/session-edge';
import { verifyAccessTokenEdge } from '@/lib/server/access-token-edge';

/**
 * Paths that must answer before anyone is signed in: the sign-in screen and the
 * endpoints it calls, plus the health check the reverse proxy polls. `/api/auth/me`
 * is here because "is anyone signed in" has to be answerable by someone who is not.
 */
function isAuthPublicPath(pathname: string): boolean {
  return (
    pathname === LOGIN_PATH ||
    pathname === '/api/auth/login' ||
    pathname === '/api/auth/logout' ||
    pathname === '/api/auth/me' ||
    pathname === '/api/health' ||
    // The layout's access-code guard probes this on every page, including the
    // sign-in screen. Behind the gate it would get a 401 whose body happens to
    // lack `enabled`, which reads as "gate off" only by accident; letting it
    // answer truthfully (`enabled: false`, because an identity provider
    // supersedes the code) removes the accident.
    pathname === '/api/access-code/status'
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Return an actual server-side 404 when either half of the workbench is off.
  // Edge middleware cannot reliably inspect server-only deployment variables,
  // so it enforces the public gate and leaves the complete runtime/database
  // check to Node. A Node-hosted middleware uses the same gate as startup.
  const canInspectServerRuntime = process.env.NEXT_RUNTIME !== 'edge';
  const workbenchEnabled =
    isProWorkbenchEnabled() && (!canInspectServerRuntime || isAgentRuntimeConfigured());
  if (!workbenchEnabled && (pathname === '/workbench' || pathname.startsWith('/workbench/'))) {
    return new NextResponse('Not found', { status: 404 });
  }

  // The identity layer supersedes the shared access code: a deployment that
  // knows who its users are has no use for one password shared by all of them.
  // `assertAuthConfig` warns at startup when both are configured.
  if (isAuthEnabled()) {
    if (isAuthPublicPath(pathname)) {
      return NextResponse.next();
    }

    const session = request.cookies.get(SESSION_COOKIE);
    if (session?.value && (await isValidSessionTokenEdge(session.value))) {
      return NextResponse.next();
    }

    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, errorCode: 'INVALID_REQUEST', error: 'Authentication required' },
        { status: 401 },
      );
    }

    // Send the browser to the sign-in screen, remembering where it was headed.
    // Only the path and query travel in `next`: the login page refuses anything
    // that is not a same-origin path, so this cannot become an open redirect.
    const loginUrl = new URL(LOGIN_PATH, request.url);
    const target = `${pathname}${request.nextUrl.search}`;
    if (target !== '/') loginUrl.searchParams.set('next', target);
    return NextResponse.redirect(loginUrl);
  }

  const accessCode = process.env.ACCESS_CODE;
  if (!accessCode) {
    return NextResponse.next();
  }

  // Whitelist: access-code endpoints, health check
  if (pathname.startsWith('/api/access-code/') || pathname === '/api/health') {
    return NextResponse.next();
  }

  // Check cookie — validate HMAC signature, not just existence
  const cookie = request.cookies.get('openmaic_access');
  if (cookie?.value && (await verifyAccessTokenEdge(cookie.value, accessCode))) {
    return NextResponse.next();
  }

  // API requests without valid cookie → 401
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { success: false, errorCode: 'INVALID_REQUEST', error: 'Access code required' },
      { status: 401 },
    );
  }

  // Page requests → let through, frontend shows modal
  return NextResponse.next();
}

export const config = {
  // `brand/` joins the exclusions for the same reason as `logos/`: the
  // access-code screen renders the product lockup before anyone is let in, so
  // gating the brand assets would show a broken image on the gate itself. The
  // sign-in screen renders the same lockup, for the same reason.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logos/|brand/).*)'],
};

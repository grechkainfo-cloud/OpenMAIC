import { cookies } from 'next/headers';
import { apiSuccess } from '@/lib/server/api-response';
import { isAuthEnabled } from '@/lib/auth/config';
import { verifyAccessToken } from '@/lib/server/access-token';

export async function GET() {
  const accessCode = process.env.ACCESS_CODE;
  // An identity provider supersedes the shared code: with one configured the
  // middleware already gates every request, and reporting the code as enabled
  // here would put its modal on top of a page the user legitimately reached.
  const enabled = !!accessCode && !isAuthEnabled();

  let authenticated = false;
  if (enabled) {
    const cookieStore = await cookies();
    const token = cookieStore.get('openmaic_access')?.value;
    authenticated = !!token && verifyAccessToken(token, accessCode);
  }

  return apiSuccess({ enabled, authenticated });
}

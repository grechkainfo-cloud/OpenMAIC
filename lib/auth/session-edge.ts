/**
 * Edge-compatible session verification for `middleware.ts`.
 *
 * Uses only Web Crypto — no `node:crypto` — so the Edge bundle can import it.
 * The middleware needs one answer: is this request carrying a valid session.
 * It does not need the identity, so this returns a boolean and leaves decoding
 * the payload to the Node routes.
 */

import { sessionMaxAgeSeconds, sessionSecret } from './config';
import {
  isSessionSignatureFormatValid,
  isSessionTimestampValid,
  splitSessionToken,
} from './session-shared';

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function isValidSessionTokenEdge(
  token: string,
  now: number = Date.now(),
): Promise<boolean> {
  const parts = splitSessionToken(token);
  if (!parts) return false;

  // Cheap checks before the HMAC, so a flood of malformed cookies costs little.
  if (!isSessionTimestampValid(parts.issuedAt, sessionMaxAgeSeconds(), now)) return false;
  if (!isSessionSignatureFormatValid(parts.signature)) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(sessionSecret()).buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expected = bufToHex(
    await crypto.subtle.sign('HMAC', key, encoder.encode(parts.signedData).buffer as ArrayBuffer),
  );

  // Constant-length comparison. Not truly constant-time in JS, but it does not
  // return early on the first differing character, which is what leaks.
  if (parts.signature.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= parts.signature.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

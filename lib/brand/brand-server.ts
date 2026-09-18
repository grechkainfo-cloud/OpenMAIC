/**
 * Brand access for code that runs outside React: `generateMetadata`, route
 * handlers, the video-export emitter, build scripts.
 *
 * Deliberately free of `'use client'`, of React and of anything under
 * `lib/hooks/` — importing this from a server module must not drag the client
 * runtime in. UI code uses `useBrand()` from `./brand-context` instead.
 */
import type { Metadata, Viewport } from 'next';

import { BRAND } from './brand-config';

export { BRAND, type BrandConfig } from './brand-config';

/** Root `metadata` for `app/layout.tsx`. */
export function brandMetadata(): Metadata {
  return {
    title: BRAND.productName,
    description: BRAND.metaDescription,
    applicationName: BRAND.productName,
    // No `icons` entry on purpose: `app/favicon.ico` and `app/apple-icon.png`
    // are file-convention icons that Next.js emits by itself. Declaring them
    // here too would emit a second <link rel="icon">. Rebranding replaces the
    // files — see docs/branding.md.
    openGraph: {
      title: BRAND.productName,
      description: BRAND.metaDescription,
      siteName: BRAND.productName,
    },
  };
}

/** Root `viewport` for `app/layout.tsx`; carries `<meta name="theme-color">`. */
export function brandViewport(): Viewport {
  return { themeColor: BRAND.themeColor };
}

/**
 * Page title for a named surface, e.g. `brandPageTitle('Классы')`.
 * Keeps the separator in one place instead of in every `generateMetadata`.
 */
export function brandPageTitle(pageName: string): string {
  return pageName ? `${pageName} — ${BRAND.productName}` : BRAND.productName;
}

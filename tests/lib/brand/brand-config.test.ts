import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  BRAND,
  BRAND_INTERPOLATION_DEFAULTS,
  BRAND_THEME_TOKEN_KEYS,
  cssVariableName,
} from '@/lib/brand/brand-config';

/** `/brand/mark.png` → `public/brand/mark.png`. */
function publicPath(assetPath: string): string {
  return join(process.cwd(), 'public', assetPath.replace(/^\//, ''));
}

describe('BRAND', () => {
  it('names the product and its agent', () => {
    expect(BRAND.productName).toBe('OpenMAIC');
    expect(BRAND.shortName).toBe('OpenMAIC');
    expect(BRAND.agentName).toBe('MAIC Agent');
  });

  it('marks its horizontal logo as already containing the wordmark', () => {
    expect(BRAND.logo.hasWordmark).toBe(true);
    expect(BRAND.logo.light).toBe('/brand/logo-horizontal.png');
    expect(BRAND.logo.mark).toBe('/brand/mark.png');
  });

  it('ships every logo asset it points at', () => {
    // A rebrand that edits the config but forgets to drop the files in breaks
    // the homepage, the classroom rail and the access-code gate at once, and
    // does it as a silently broken <img> rather than as an error.
    const declared = [BRAND.logo.light, BRAND.logo.dark, BRAND.logo.mark].filter(
      (value): value is string => Boolean(value),
    );
    for (const asset of declared) {
      expect(existsSync(publicPath(asset)), `${asset} is declared but missing`).toBe(true);
    }
  });

  it('keeps the file-convention icons in place', () => {
    // Next.js resolves these by filename; nothing can indirect them, so a
    // rebrand replaces the files. See docs/branding.md.
    expect(existsSync(join(process.cwd(), 'app', 'favicon.ico'))).toBe(true);
    expect(existsSync(join(process.cwd(), 'app', 'apple-icon.png'))).toBe(true);
  });

  it('exposes the brand as interpolation defaults for both translators', () => {
    expect(BRAND_INTERPOLATION_DEFAULTS).toEqual({
      brand: BRAND.productName,
      brandShort: BRAND.shortName,
      brandAgent: BRAND.agentName,
    });
  });

  it('declares both themes over exactly the same token set', () => {
    expect(Object.keys(BRAND.theme.dark).sort()).toEqual(Object.keys(BRAND.theme.light).sort());
    expect(BRAND_THEME_TOKEN_KEYS.length).toBe(Object.keys(BRAND.theme.light).length);
  });

  it('leaves no theme token empty', () => {
    for (const key of BRAND_THEME_TOKEN_KEYS) {
      expect(BRAND.theme.light[key], `light.${key}`).toBeTruthy();
      expect(BRAND.theme.dark[key], `dark.${key}`).toBeTruthy();
    }
  });
});

describe('cssVariableName', () => {
  it('kebab-cases a token key', () => {
    expect(cssVariableName('background')).toBe('--background');
    expect(cssVariableName('primaryForeground')).toBe('--primary-foreground');
    expect(cssVariableName('sidebarPrimaryForeground')).toBe('--sidebar-primary-foreground');
  });

  it('gives a trailing digit its own segment', () => {
    // Plain camel-to-kebab would emit `--chart1`, which matches nothing in
    // globals.css's `@theme inline` block.
    expect(cssVariableName('chart1')).toBe('--chart-1');
    expect(cssVariableName('chart5')).toBe('--chart-5');
  });
});

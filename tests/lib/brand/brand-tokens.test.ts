import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { BRAND, BRAND_THEME_TOKEN_KEYS, cssVariableName } from '@/lib/brand/brand-config';
import { renderBrandTokensCss } from '@/lib/brand/brand-tokens-css';

const GENERATED = join(process.cwd(), 'app', 'brand-tokens.css');
const GLOBALS = join(process.cwd(), 'app', 'globals.css');

describe('app/brand-tokens.css', () => {
  it('matches what the brand config generates', () => {
    // The checked-in stylesheet is generated (`pnpm run gen:brand-tokens`).
    // Forgetting to regenerate after editing BRAND.theme would otherwise ship
    // a build whose colours silently disagree with its config.
    const onDisk = readFileSync(GENERATED, 'utf8');
    expect(onDisk).toBe(renderBrandTokensCss());
  });

  it('declares every token in both themes', () => {
    const css = readFileSync(GENERATED, 'utf8');
    const [, lightBlock = '', darkBlock = ''] = css.match(
      /:root \{([\s\S]*?)\}[\s\S]*?\.dark \{([\s\S]*?)\}/,
    )!;

    for (const key of BRAND_THEME_TOKEN_KEYS) {
      const declaration = `${cssVariableName(key)}: `;
      expect(lightBlock, `:root is missing ${key}`).toContain(declaration);
      expect(darkBlock, `.dark is missing ${key}`).toContain(declaration);
    }

    expect(lightBlock).toContain(`--font-sans: ${BRAND.fonts.ui};`);
    expect(lightBlock).toContain(`--radius: ${BRAND.theme.radius};`);
    // --font-sans and --radius do not vary by theme; repeating them in .dark
    // would be two places to change one value.
    expect(darkBlock).not.toContain('--font-sans');
    expect(darkBlock).not.toContain('--radius:');
  });
});

describe('app/globals.css', () => {
  it('imports the generated tokens instead of declaring its own', () => {
    const css = readFileSync(GLOBALS, 'utf8');
    expect(css).toContain("@import './brand-tokens.css';");
    // Two `:root` blocks would mean two sources of truth, and the later one
    // would quietly win.
    expect(css).not.toMatch(/^:root \{/m);
    expect(css).not.toMatch(/^\.dark \{/m);
  });
});

/**
 * Renders `app/brand-tokens.css` from `BRAND.theme`.
 *
 * Kept as a pure function with no Node imports so three callers share one
 * implementation and cannot drift:
 *   - `scripts/generate-brand-tokens.ts` writes the file,
 *   - `tests/lib/brand/brand-tokens.test.ts` asserts the file still matches,
 *   - `scripts/check-brand-contrast.mjs` reads the same token table.
 */
import {
  BRAND,
  BRAND_THEME_TOKEN_KEYS,
  cssVariableName,
  type BrandThemeTokens,
} from './brand-config';

const HEADER = `/* GENERATED FILE — do not edit by hand.
 *
 * Source of truth: lib/brand/brand-config.ts (BRAND.theme, BRAND.fonts.ui).
 * Regenerate:     pnpm run gen:brand-tokens
 * Drift guard:    tests/lib/brand/brand-tokens.test.ts
 *
 * Imported by app/globals.css. Every colour the product uses resolves through
 * one of these custom properties — a hex literal in app/ or components/ is a
 * lint error (see eslint.config.mjs, "no brand literals").
 */`;

function block(selector: string, lines: string[]): string {
  return `${selector} {\n${lines.map((line) => `  ${line}`).join('\n')}\n}`;
}

function tokenLines(tokens: BrandThemeTokens): string[] {
  return BRAND_THEME_TOKEN_KEYS.map((key) => `${cssVariableName(key)}: ${tokens[key]};`);
}

export function renderBrandTokensCss(): string {
  const light = block(':root', [
    // The UI family carries its own per-subset @font-face declarations (see the
    // comment in app/layout.tsx); naming it here keeps Tailwind's --font-sans
    // and the brand config in one place.
    `--font-sans: ${BRAND.fonts.ui};`,
    `--radius: ${BRAND.theme.radius};`,
    ...tokenLines(BRAND.theme.light),
  ]);

  // The dark block overrides colours only: --font-sans and --radius do not
  // change with the theme, so repeating them would invite them to drift.
  const dark = block('.dark', tokenLines(BRAND.theme.dark));

  return `${HEADER}\n\n${light}\n\n${dark}\n`;
}

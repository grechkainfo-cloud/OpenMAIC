/**
 * Brand configuration, re-exported next to the other `configs/` modules.
 *
 * The values live in `lib/brand/brand-config.ts` — edit them there. This file
 * exists so `configs/` remains a complete index of what a deployment tunes,
 * alongside `configs/theme.ts`, `configs/font.ts` and `configs/chart.ts`.
 *
 * Only the isomorphic data is re-exported. React access is `useBrand()` from
 * `lib/brand/brand-context`; server access is `lib/brand/brand-server`.
 */
export {
  BRAND,
  BRAND_THEME_TOKEN_KEYS,
  cssVariableName,
  type BrandConfig,
  type BrandTheme,
  type BrandThemeTokens,
  type BrandLogoSet,
  type BrandFonts,
} from '@/lib/brand/brand-config';

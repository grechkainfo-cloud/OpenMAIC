/**
 * Brand configuration — the single source of truth for product identity.
 *
 * Everything a rebrand needs to change lives in `BRAND` at the bottom of this
 * file: names, slogan, logo paths, favicon, colour tokens for both themes, and
 * the font families used by the UI, the slide renderer and the `.pptx` export.
 *
 * Nothing under `app/` or `components/` may hold a brand literal or a colour
 * literal. UI code reads this through `useBrand()` (`./brand-context`); server
 * code and build scripts read it through `./brand-server`; the CSS custom
 * properties are generated from `BRAND.theme` into `app/brand-tokens.css` by
 * `scripts/generate-brand-tokens.mjs` (`pnpm run gen:brand-tokens`), and
 * `tests/lib/brand/brand-tokens.test.ts` fails when the two drift apart.
 *
 * Two things a rebrand still touches outside this file, because Next.js
 * resolves them by filename and nothing can indirect them:
 *   - `app/favicon.ico`
 *   - `app/apple-icon.png`
 * See `docs/branding.md`.
 */

/**
 * One theme's worth of design tokens. Every field becomes a CSS custom
 * property on `:root` (light) or `.dark`, named by kebab-casing the key:
 * `primaryForeground` → `--primary-foreground`, `chart1` → `--chart-1`.
 *
 * Values are copied into CSS verbatim, so any CSS colour syntax works. The
 * contrast checker (`scripts/check-brand-contrast.mjs`) understands hex and
 * `oklch()`; a value it cannot parse is reported rather than silently skipped.
 */
export interface BrandThemeTokens {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  border: string;
  input: string;
  ring: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  sidebar: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarBorder: string;
  sidebarRing: string;
}

export interface BrandTheme {
  light: BrandThemeTokens;
  dark: BrandThemeTokens;
  /** `--radius`; the rest of the radius scale is derived from it in `@theme`. */
  radius: string;
}

export interface BrandLogoSet {
  /** Horizontal lockup for light backgrounds, under `public/`. */
  light: string;
  /**
   * Horizontal lockup for dark backgrounds. Omit when the light asset reads
   * correctly on dark too — `<BrandLogo>` then uses `light` in both themes
   * rather than shipping a broken second asset.
   */
  dark?: string;
  /** Square mark (workspace header, PBL chrome), under `public/`. */
  mark: string;
  /** Whether `light`/`dark` already carry the product wordmark. */
  hasWordmark: boolean;
}

export interface BrandFonts {
  /**
   * `--font-sans`. Must carry Cyrillic in every weight the UI uses — a
   * Latin-only face silently falls back to an OS font mid-word for ru-RU.
   * Enforced by `scripts/check-cyrillic-coverage.mjs`.
   */
  ui: string;
  /** Default family for slide elements that do not name one themselves. */
  slideDefault: string;
  /**
   * Font name written into exported `.pptx`. pptxgenjs does NOT embed fonts,
   * so this must be a family that exists on the machines opening the file.
   */
  pptxExport: string;
  /** Family named to the model when it authors slide/scene markup. */
  slidePromptFamily: string;
}

export interface BrandConfig {
  /** Full product name — page titles, logo alt text, metadata. */
  productName: string;
  /** Short name for space-constrained spots. */
  shortName: string;
  /**
   * What the product calls its own authoring agent in user-facing copy.
   * Interpolated into translations as `{{brandAgent}}` — it is brand-derived
   * but not mechanically derivable from `productName`, so it is its own field.
   */
  agentName: string;
  /**
   * Fixed, untranslated tagline. Leave undefined to use the localized
   * `home.slogan` instead — that is the default, because a tagline is prose
   * and prose belongs in `lib/i18n/locales/`. Set it only for a brand whose
   * tagline is a wordmark-like phrase that must not be translated.
   * Read through `useBrandTagline()`, never directly.
   */
  slogan?: string;
  /**
   * `<meta name="description">`. Not localizable: Next.js resolves metadata on
   * the server, before the client-side locale is known, so this is one string
   * per deployment. Write it in the deployment's primary language.
   */
  metaDescription: string;
  /** Ownership line in the homepage footer. Empty string hides the footer. */
  legalFooter: string;
  /** Support address shown to users when something needs a human. */
  supportContact: string;
  logo: BrandLogoSet;
  /** `<meta name="theme-color">` and the Pro workspace wordmark colour. */
  themeColor: string;
  theme: BrandTheme;
  fonts: BrandFonts;
  /** `User-Agent` for outbound requests this product makes on its own behalf. */
  userAgent: string;
}

// ───────────────────────────────────────────────────────────────────────────
// ЗАПОЛНИТЬ ПРИ РЕБРЕНДИНГЕ — всё, что ниже, и файлы из `docs/branding.md`.
// ───────────────────────────────────────────────────────────────────────────

/** The brand this build ships. */
export const BRAND: BrandConfig = {
  productName: 'OpenMAIC',
  shortName: 'OpenMAIC',
  agentName: 'MAIC Agent',
  // slogan: undefined → the localized `home.slogan` is used.
  metaDescription:
    'The open-source AI interactive classroom. Upload a PDF to instantly generate an immersive, multi-agent learning experience.',
  legalFooter: 'OpenMAIC Open Source Project',
  supportContact: '',
  logo: {
    light: '/brand/logo-horizontal.png',
    mark: '/brand/mark.png',
    hasWordmark: true,
  },
  themeColor: '#722ed1',
  fonts: {
    ui: "'Inter Variable', ui-sans-serif, system-ui, sans-serif",
    // The family `@fontsource-variable/inter` registers. Plain `Inter`
    // matches no loaded face and falls back to a system sans.
    slideDefault: 'Inter Variable',
    // Windows ships Segoe UI everywhere and it carries full Cyrillic, so an
    // exported deck renders the same on any corporate workstation. The
    // upstream default was Microsoft YaHei — a Chinese face whose Cyrillic is
    // present but visibly foreign in a Russian deck.
    pptxExport: 'Segoe UI',
    slidePromptFamily: 'Inter',
  },
  userAgent: 'OpenMAIC/1.0',
  theme: {
    radius: '0.625rem',
    light: {
      background: 'oklch(1 0 0)',
      foreground: 'oklch(0.145 0 0)',
      card: 'oklch(1 0 0)',
      cardForeground: 'oklch(0.145 0 0)',
      popover: 'oklch(1 0 0)',
      popoverForeground: 'oklch(0.145 0 0)',
      primary: '#722ed1',
      primaryForeground: 'oklch(0.985 0 0)',
      secondary: 'oklch(0.97 0 0)',
      secondaryForeground: 'oklch(0.205 0 0)',
      muted: 'oklch(0.97 0 0)',
      // 0.556 (the inherited value) measures 4.34:1 against `muted`, under the
      // 4.5:1 body-text floor. See scripts/check-brand-contrast.ts.
      mutedForeground: 'oklch(0.545 0 0)',
      accent: 'oklch(0.97 0 0)',
      accentForeground: 'oklch(0.205 0 0)',
      destructive: 'oklch(0.58 0.22 27)',
      border: 'oklch(0.922 0 0)',
      input: 'oklch(0.922 0 0)',
      // The focus indicator is the only thing telling a keyboard user where
      // they are, so it is held to SC 2.4.11's 3:1. The inherited 0.708
      // measured 2.59:1 on white.
      ring: 'oklch(0.65 0 0)',
      chart1: 'oklch(0.809 0.105 251.813)',
      chart2: 'oklch(0.623 0.214 259.815)',
      chart3: 'oklch(0.546 0.245 262.881)',
      chart4: 'oklch(0.488 0.243 264.376)',
      chart5: 'oklch(0.424 0.199 265.638)',
      sidebar: 'oklch(0.985 0 0)',
      sidebarForeground: 'oklch(0.145 0 0)',
      sidebarPrimary: 'oklch(0.205 0 0)',
      sidebarPrimaryForeground: 'oklch(0.985 0 0)',
      sidebarAccent: 'oklch(0.97 0 0)',
      sidebarAccentForeground: 'oklch(0.205 0 0)',
      sidebarBorder: 'oklch(0.922 0 0)',
      sidebarRing: 'oklch(0.708 0 0)',
    },
    dark: {
      background: 'oklch(0.145 0 0)',
      foreground: 'oklch(0.985 0 0)',
      card: 'oklch(0.205 0 0)',
      cardForeground: 'oklch(0.985 0 0)',
      popover: 'oklch(0.205 0 0)',
      popoverForeground: 'oklch(0.985 0 0)',
      primary: '#8b47ea',
      // A light label, as in the light theme. The inherited near-black label
      // measured 3.57:1 on this violet — below the body-text floor on the
      // product's own primary button.
      primaryForeground: 'oklch(0.985 0 0)',
      secondary: 'oklch(0.269 0 0)',
      secondaryForeground: 'oklch(0.985 0 0)',
      muted: 'oklch(0.269 0 0)',
      mutedForeground: 'oklch(0.708 0 0)',
      accent: 'oklch(0.371 0 0)',
      accentForeground: 'oklch(0.985 0 0)',
      destructive: 'oklch(0.704 0.191 22.216)',
      border: 'oklch(1 0 0 / 10%)',
      input: 'oklch(1 0 0 / 15%)',
      ring: 'oklch(0.556 0 0)',
      chart1: 'oklch(0.809 0.105 251.813)',
      chart2: 'oklch(0.623 0.214 259.815)',
      chart3: 'oklch(0.546 0.245 262.881)',
      chart4: 'oklch(0.488 0.243 264.376)',
      chart5: 'oklch(0.424 0.199 265.638)',
      sidebar: 'oklch(0.205 0 0)',
      sidebarForeground: 'oklch(0.985 0 0)',
      sidebarPrimary: 'oklch(0.488 0.243 264.376)',
      sidebarPrimaryForeground: 'oklch(0.985 0 0)',
      sidebarAccent: 'oklch(0.269 0 0)',
      sidebarAccentForeground: 'oklch(0.985 0 0)',
      sidebarBorder: 'oklch(1 0 0 / 10%)',
      sidebarRing: 'oklch(0.556 0 0)',
    },
  },
};

// ───────────────────────────────────────────────────────────────────────────

/**
 * Variables every translation can interpolate without the call site passing
 * them: `"Этот навык поставляется с {{brand}}."` resolves anywhere `t` works.
 *
 * Wired into both translators — i18next's `interpolation.defaultVariables`
 * (`lib/i18n/config.ts`) and the hook-free `createWorkbenchTranslator`
 * (`lib/i18n/workbench.ts`) — because those two are required to resolve the
 * same keys to the same text, and a default known to only one of them would
 * render `{{brand}}` as an empty string in the workbench.
 *
 * This is how the brand name stays out of `lib/i18n/locales/*.json`: the
 * translation carries the sentence, the config carries the name.
 */
export const BRAND_INTERPOLATION_DEFAULTS: Readonly<Record<string, string>> = {
  brand: BRAND.productName,
  brandShort: BRAND.shortName,
  brandAgent: BRAND.agentName,
};

/**
 * Colour-token key → CSS custom property name.
 *
 * Shared by the generator and its drift test so the two cannot disagree about
 * the mapping. Digits start their own segment (`chart1` → `--chart-1`), which
 * plain camel-to-kebab would render as `--chart1`.
 */
export function cssVariableName(token: keyof BrandThemeTokens): string {
  return `--${String(token)
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([a-zA-Z])(\d)/g, '$1-$2')
    .toLowerCase()}`;
}

/** Token keys in the order the generated stylesheet emits them. */
export const BRAND_THEME_TOKEN_KEYS = Object.keys(BRAND.theme.light) as (keyof BrandThemeTokens)[];

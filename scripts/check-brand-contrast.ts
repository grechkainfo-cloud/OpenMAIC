/**
 * WCAG contrast report for the brand palette.
 *
 *   pnpm run check:brand-contrast
 *
 * Reads `BRAND.theme` directly, so it measures what the app renders rather
 * than a copy of it, and it measures BOTH themes — a rebrand that only looks
 * at the light one ships an unreadable dark mode.
 *
 * Two severities, because WCAG draws the line in a place a single threshold
 * cannot express:
 *
 *   required  Text on a surface (SC 1.4.3, 4.5:1) and the focus indicator
 *             (SC 1.4.11 / 2.4.11, 3:1). A failure here is a defect; the
 *             script exits non-zero.
 *
 *   advisory  Decorative borders and chart series. SC 1.4.11 covers visual
 *             information *required* to identify a control — a hairline on a
 *             card that already differs in fill is not that, and a chart
 *             series is normally read against its neighbours and its label,
 *             not against the page. Reported with its number so the value is
 *             visible, but not treated as a build failure.
 *
 * Colour maths lives in `lib/brand/contrast.ts` and is unit-tested there.
 */
import { BRAND, type BrandThemeTokens } from '../lib/brand/brand-config';
import { contrastRatio, parseCssColor } from '../lib/brand/contrast';

const AA_TEXT = 4.5;
const AA_NON_TEXT = 3;

interface Pair {
  readonly fg: keyof BrandThemeTokens;
  readonly bg: keyof BrandThemeTokens;
  readonly min: number;
  readonly severity: 'required' | 'advisory';
  readonly note: string;
}

/**
 * Every pair the product actually puts one token on top of another. Adding a
 * surface to the theme means adding its pair here — an unlisted pair is an
 * unchecked pair.
 */
const PAIRS: readonly Pair[] = [
  { fg: 'foreground', bg: 'background', min: AA_TEXT, severity: 'required', note: 'body text' },
  { fg: 'cardForeground', bg: 'card', min: AA_TEXT, severity: 'required', note: 'card text' },
  {
    fg: 'popoverForeground',
    bg: 'popover',
    min: AA_TEXT,
    severity: 'required',
    note: 'popover text',
  },
  {
    fg: 'primaryForeground',
    bg: 'primary',
    min: AA_TEXT,
    severity: 'required',
    note: 'primary button label',
  },
  {
    fg: 'secondaryForeground',
    bg: 'secondary',
    min: AA_TEXT,
    severity: 'required',
    note: 'secondary button label',
  },
  {
    fg: 'accentForeground',
    bg: 'accent',
    min: AA_TEXT,
    severity: 'required',
    note: 'accent / hover row text',
  },
  {
    fg: 'mutedForeground',
    bg: 'background',
    min: AA_TEXT,
    severity: 'required',
    note: 'secondary text on page',
  },
  {
    fg: 'mutedForeground',
    bg: 'muted',
    min: AA_TEXT,
    severity: 'required',
    note: 'secondary text on muted fill',
  },
  {
    fg: 'destructive',
    bg: 'background',
    min: AA_TEXT,
    severity: 'required',
    note: 'error text',
  },
  {
    fg: 'sidebarForeground',
    bg: 'sidebar',
    min: AA_TEXT,
    severity: 'required',
    note: 'sidebar text',
  },
  {
    fg: 'sidebarPrimaryForeground',
    bg: 'sidebarPrimary',
    min: AA_TEXT,
    severity: 'required',
    note: 'sidebar active item',
  },
  {
    fg: 'sidebarAccentForeground',
    bg: 'sidebarAccent',
    min: AA_TEXT,
    severity: 'required',
    note: 'sidebar hover item',
  },
  {
    fg: 'ring',
    bg: 'background',
    min: AA_NON_TEXT,
    severity: 'required',
    note: 'focus indicator — SC 2.4.11, keyboard users cannot work without it',
  },
  {
    fg: 'border',
    bg: 'background',
    min: AA_NON_TEXT,
    severity: 'advisory',
    note: 'decorative card hairline',
  },
  {
    fg: 'input',
    bg: 'background',
    min: AA_NON_TEXT,
    severity: 'advisory',
    note: 'field outline — raise to required if fields stop carrying a fill of their own',
  },
  {
    fg: 'chart1',
    bg: 'background',
    min: AA_NON_TEXT,
    severity: 'advisory',
    note: 'chart series 1',
  },
  {
    fg: 'chart2',
    bg: 'background',
    min: AA_NON_TEXT,
    severity: 'advisory',
    note: 'chart series 2',
  },
  {
    fg: 'chart3',
    bg: 'background',
    min: AA_NON_TEXT,
    severity: 'advisory',
    note: 'chart series 3',
  },
  {
    fg: 'chart4',
    bg: 'background',
    min: AA_NON_TEXT,
    severity: 'advisory',
    note: 'chart series 4',
  },
  {
    fg: 'chart5',
    bg: 'background',
    min: AA_NON_TEXT,
    severity: 'advisory',
    note: 'chart series 5',
  },
];

interface Row {
  theme: 'light' | 'dark';
  pair: Pair;
  ratio: number | null;
}

function measure(theme: 'light' | 'dark'): Row[] {
  const tokens = BRAND.theme[theme];
  return PAIRS.map((pair) => {
    const bg = parseCssColor(tokens[pair.bg]);
    const fg = parseCssColor(tokens[pair.fg]);
    // A translucent foreground (the dark theme's borders) is only legible in
    // combination with what it sits on; contrastRatio composites for us.
    const ratio = bg && fg ? contrastRatio(fg, bg) : null;
    return { theme, pair, ratio };
  });
}

const rows = [...measure('light'), ...measure('dark')];
const passed = (row: Row) => row.ratio !== null && row.ratio >= row.pair.min;

const width = Math.max(...PAIRS.map((p) => `${p.fg} on ${p.bg}`.length));
for (const row of rows) {
  const label = `${row.pair.fg} on ${row.pair.bg}`.padEnd(width);
  const ratio = row.ratio === null ? ' unparsed' : `${row.ratio.toFixed(2)}:1`.padStart(8);
  const verdict = passed(row) ? 'ok  ' : row.pair.severity === 'required' ? 'FAIL' : 'warn';
  console.log(
    `${verdict} ${row.theme.padEnd(5)} ${label} ${ratio}  (min ${row.pair.min}) — ${row.pair.note}`,
  );
}

const unparsed = rows.filter((row) => row.ratio === null);
for (const row of unparsed) {
  console.error(
    `\n${row.theme}: could not parse ${row.pair.fg} or ${row.pair.bg}. ` +
      'The checker understands hex and oklch() — add a parser in lib/brand/contrast.ts ' +
      'rather than leaving a colour unmeasured.',
  );
}

const failures = rows.filter((row) => !passed(row) && row.pair.severity === 'required');
const warnings = rows.filter((row) => !passed(row) && row.pair.severity === 'advisory');

console.log(
  `\n${rows.length - failures.length - warnings.length}/${rows.length} pairs pass; ` +
    `${failures.length} required failure(s), ${warnings.length} advisory warning(s).`,
);

if (failures.length || unparsed.length) process.exit(1);

/**
 * Generate fonts.css from fonts.config.mjs.
 *
 * Run via `pnpm run genfonts`. The package build runs this first so the CSS
 * always reflects the config. Do not edit fonts.css by hand.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { FONT_FAMILIES } from '../fonts.config.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.join(here, '..', 'fonts.css');

const EXTERNAL_SRC = /^(?:[a-z][a-z0-9+.-]*:)?\/\//i;

const offending = FONT_FAMILIES.filter((entry) => EXTERNAL_SRC.test(entry.src));
if (offending.length) {
  console.error(
    `[genfonts] refusing to emit ${offending.length} face(s) pointing at an ` +
      `external origin: ${offending.map((entry) => entry.src).join(', ')}\n` +
      '  This package is consumed in a network-isolated deployment. A @font-face\n' +
      '  whose src is a third-party URL never loads there — it stalls, then falls\n' +
      '  back. Serve the woff2 from the app itself (e.g. /fonts/<name>.woff2).',
  );
  process.exit(1);
}

const header = `/**
 * GENERATED FILE — do not edit by hand.
 * Source of truth: fonts.config.mjs (run \`pnpm run genfonts\` to regenerate).
 *
 * Declares one @font-face per family the renderer should be able to resolve by
 * name. The importer passes a slide's original font-family names through
 * unchanged; a name renders in one of these faces only if it matches.
 *
 * Consumers import this once at the app shell:
 *     import '@openmaic/renderer/fonts.css';
 */`;

const blocks = FONT_FAMILIES.map(
  ({ family, src }) => `@font-face {
  font-display: swap;
  font-family: '${family}';
  src: url('${src}') format('woff2');
}`,
).join('\n');

const empty = `
/* No families are declared. See fonts.config.mjs for why, and for what
   re-adding one requires. Kept as an empty stylesheet rather than deleted so
   the package's documented \`@openmaic/renderer/fonts.css\` entry point stays
   valid for consumers. */
`;

writeFileSync(outFile, FONT_FAMILIES.length ? `${header}\n${blocks}\n` : `${header}\n${empty}`);

console.log(
  FONT_FAMILIES.length
    ? `[genfonts] wrote ${FONT_FAMILIES.length} @font-face rules → fonts.css`
    : '[genfonts] wrote fonts.css with no @font-face rules (empty whitelist)',
);

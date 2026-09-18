/**
 * Writes `app/brand-tokens.css` from the brand config.
 *
 *   pnpm run gen:brand-tokens
 *
 * Run it after editing `BRAND.theme` or `BRAND.fonts.ui` in
 * `lib/brand/brand-config.ts`. `tests/lib/brand/brand-tokens.test.ts` fails
 * when the checked-in stylesheet no longer matches the config, so forgetting
 * to run this is caught by `pnpm test` rather than by a wrong-coloured build.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderBrandTokensCss } from '../lib/brand/brand-tokens-css';

const target = join(process.cwd(), 'app', 'brand-tokens.css');
writeFileSync(target, renderBrandTokensCss(), 'utf8');
console.log(`brand tokens → ${target}`);

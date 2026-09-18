/**
 * Cyrillic coverage check for every web font the product loads.
 *
 *   pnpm run check:brand-fonts
 *
 * Why this exists: a font that carries Cyrillic in Regular but not in Bold
 * does not fail loudly. The browser substitutes an OS face for the missing
 * weight and the page renders in two typefaces, often mid-sentence. The bug
 * surfaces as "the bold text looks a bit off" weeks after the rebrand.
 *
 * So this does not sniff filenames — it opens each woff2 with fontkit and asks
 * for the actual glyphs, per family AND per weight, exactly as the browser
 * would have to find them.
 *
 * Audited set is derived from the imports the app really makes:
 *   - the UI family, from `app/layout.tsx`
 *   - the slide editor's picker faces, from `app/editor-fonts.ts`
 * so adding a font to the app adds it to this check automatically.
 */
import { join } from 'node:path';

import { coveredCodepoints, loadedFaces, RUSSIAN_CODEPOINTS } from './font-coverage';

/**
 * Families that are legitimately script-specific: Chinese display faces
 * offered in the slide editor's picker. Requiring Cyrillic of them would be
 * wrong — the point of a Chinese display face is that it is Chinese.
 *
 * The picker no longer OFFERS these to a Russian author either:
 * `configs/font.ts` declares each face's scripts and `fontsForScript` filters
 * on it, which is the user-visible half of the same fact.
 */
const SCRIPT_SPECIFIC_PACKAGES = new Set([
  '@fontsource/noto-sans-sc',
  '@fontsource/noto-serif-sc',
  '@fontsource/lxgw-wenkai',
  '@fontsource/zcool-kuaile',
  '@fontsource/noto-sans-kr',
  '@fontsource/noto-sans-arabic',
]);

const ROOT = process.cwd();

const { faces, unresolved } = loadedFaces([
  join(ROOT, 'app', 'layout.tsx'),
  join(ROOT, 'app', 'editor-fonts.ts'),
]);

if (faces.length === 0 && unresolved.length === 0) {
  console.error(
    'No @fontsource imports found in app/layout.tsx or app/editor-fonts.ts. ' +
      'If the app moved to another font loader, point this script at it rather than deleting it.',
  );
  process.exit(1);
}

// ── Group by family + weight + style: that is what the browser picks ──────

const groups = new Map<string, typeof faces>();
for (const face of faces) {
  // JSON rather than a delimiter string: family names contain spaces
  // ("Source Sans 3") and a separator that can appear in a part is a bug
  // waiting for the first font whose name contains it.
  const key = JSON.stringify([face.pkg, face.family, face.weight, face.style]);
  groups.set(key, [...(groups.get(key) ?? []), face]);
}

interface Result {
  pkg: string;
  family: string;
  weight: string;
  style: string;
  missing: number[];
  exempt: boolean;
}

const results: Result[] = [...groups.entries()]
  .map(([key, files]) => {
    const [pkg, family, weight, style] = JSON.parse(key) as [string, string, string, string];
    const covered = new Set<number>();
    for (const file of files) {
      for (const codePoint of coveredCodepoints(file.file, RUSSIAN_CODEPOINTS)) {
        covered.add(codePoint);
      }
    }
    return {
      pkg,
      family,
      weight,
      style,
      missing: RUSSIAN_CODEPOINTS.filter((codePoint) => !covered.has(codePoint)),
      exempt: SCRIPT_SPECIFIC_PACKAGES.has(pkg),
    };
  })
  .sort((a, b) => a.family.localeCompare(b.family) || a.weight.localeCompare(b.weight));

const width = Math.max(...results.map((r) => `${r.family} ${r.weight} ${r.style}`.length));
for (const result of results) {
  const label = `${result.family} ${result.weight} ${result.style}`.padEnd(width);
  const verdict = result.missing.length === 0 ? 'ok  ' : result.exempt ? 'skip' : 'FAIL';
  const detail =
    result.missing.length === 0
      ? 'full Cyrillic'
      : result.exempt
        ? 'script-specific face, Cyrillic not expected'
        : `missing ${result.missing.length}/${RUSSIAN_CODEPOINTS.length}: ` +
          result.missing
            .slice(0, 8)
            .map((c) => String.fromCodePoint(c))
            .join(' ');
  console.log(`${verdict} ${label}  ${detail}`);
}

for (const specifier of unresolved) {
  console.error(`\nCould not resolve ${specifier} under node_modules — is the package installed?`);
}

const failures = results.filter((r) => !r.exempt && r.missing.length > 0);
const complete = results.filter((r) => r.missing.length === 0);
const skipped = results.filter((r) => r.exempt && r.missing.length > 0);
console.log(
  `\n${complete.length}/${results.length} face groups carry full Cyrillic; ` +
    `${skipped.length} script-specific face(s) skipped; ${failures.length} failure(s).`,
);

if (failures.length || unresolved.length) {
  console.error(
    `\n${failures.length} face group(s) would fall back to an OS font for Russian text.`,
  );
  process.exit(1);
}

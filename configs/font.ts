/**
 * Fonts offered in the slide editor's text-format picker.
 *
 * Every entry is a real web font: Inter via `@fontsource-variable` (imported in
 * `app/layout.tsx`), the rest via `@fontsource` packages loaded in
 * `app/editor-fonts.ts`. `@fontsource` `unicode-range`-subsets the CJK faces,
 * so they download lazily per glyph range — a picked font actually renders.
 *
 * `value` must be the family name the `@font-face` actually REGISTERS, not the
 * font's informal name: a mismatch does not error, it silently falls back to a
 * system face, which is how the Inter entry spent its life not working.
 *
 * Adding a font: install its `@fontsource` package, import the weight CSS in
 * `app/editor-fonts.ts`, then add an entry here whose `value` matches the
 * package's `@font-face` family name and whose `scripts` lists what it can
 * actually render. `tests/configs/font-scripts.test.ts` checks that claim
 * against the font files, so a wrong entry fails rather than shipping.
 */

/**
 * Writing systems the picker distinguishes.
 *
 * Only what the deployment can serve content in — enough to keep a font that
 * cannot render the current language out of the list, not a general script
 * taxonomy.
 */
export type FontScript = 'latin' | 'cyrillic' | 'cjk';

export interface FontEntry {
  /** Display name; rendered as the fallback when `labelKey` is absent. */
  readonly label: string;
  /** CSS font-family value; "" means the element's own default (no override). */
  readonly value: string;
  /** Optional i18n key — preferred over `label` when present. */
  readonly labelKey?: string;
  /**
   * Writing systems this face actually covers.
   *
   * The picker hides a font that cannot render the current language: offering
   * it produces tofu or a silent fallback to some system face, which reads as
   * "this app's font picker is broken" rather than as "that font has no
   * Cyrillic". Undefined means "covers everything" and is used only by the
   * default entry, which overrides nothing.
   */
  readonly scripts?: readonly FontScript[];
}

/**
 * Coverage below is what the font files really contain, verified with fontkit
 * (`pnpm run check:brand-fonts` reads the same files). The large Noto and
 * LXGW faces are pan-script and genuinely carry Cyrillic; ZCOOL KuaiLe is a
 * Chinese display face and does not.
 */
export const FONTS: readonly FontEntry[] = [
  { labelKey: 'edit.text.fontDefault', label: 'Default', value: '' },
  // Chinese
  { label: '思源黑体', value: 'Noto Sans SC', scripts: ['cjk', 'latin', 'cyrillic'] },
  { label: '思源宋体', value: 'Noto Serif SC', scripts: ['cjk', 'latin', 'cyrillic'] },
  { label: '霞鹜文楷', value: 'LXGW WenKai', scripts: ['cjk', 'latin', 'cyrillic'] },
  // Carries Latin as well, like most CJK faces; it is only Cyrillic it lacks.
  { label: '站酷快乐体', value: 'ZCOOL KuaiLe', scripts: ['cjk', 'latin'] },
  // Latin
  // `Inter Variable` is the family `@fontsource-variable/inter` registers.
  // The entry said `Inter`, which matches no loaded face, so picking it in
  // the editor silently fell back to a system sans.
  { label: 'Inter', value: 'Inter Variable', scripts: ['latin', 'cyrillic'] },
  { label: 'Roboto', value: 'Roboto', scripts: ['latin', 'cyrillic'] },
  { label: 'Open Sans', value: 'Open Sans', scripts: ['latin', 'cyrillic'] },
  { label: 'Montserrat', value: 'Montserrat', scripts: ['latin', 'cyrillic'] },
  { label: 'Source Sans 3', value: 'Source Sans 3', scripts: ['latin', 'cyrillic'] },
  { label: 'Merriweather', value: 'Merriweather', scripts: ['latin', 'cyrillic'] },
  { label: 'Literata', value: 'Literata', scripts: ['latin', 'cyrillic'] },
  { label: 'Source Serif 4', value: 'Source Serif 4', scripts: ['latin', 'cyrillic'] },
  { label: 'JetBrains Mono', value: 'JetBrains Mono', scripts: ['latin', 'cyrillic'] },
];

/** The writing system a locale's content is written in. */
export function scriptForLocale(locale: string): FontScript {
  const language = locale.split('-')[0].toLowerCase();
  if (language === 'ru' || language === 'uk' || language === 'be' || language === 'bg') {
    return 'cyrillic';
  }
  if (language === 'zh' || language === 'ja' || language === 'ko') return 'cjk';
  return 'latin';
}

/**
 * The picker's options for one language.
 *
 * A font with no `scripts` (the default entry) always stays: it sets no family
 * at all, so it cannot fail to render anything.
 */
export function fontsForScript(script: FontScript): readonly FontEntry[] {
  return FONTS.filter((font) => !font.scripts || font.scripts.includes(script));
}

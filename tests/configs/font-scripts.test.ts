import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { FONTS, fontsForScript, scriptForLocale, type FontScript } from '@/configs/font';
import {
  CJK_CODEPOINTS,
  familyCovers,
  LATIN_CODEPOINTS,
  loadedFaces,
  RUSSIAN_CODEPOINTS,
} from '../../scripts/font-coverage';

/**
 * `configs/font.ts` declares what each picker font can render, and the picker
 * hides the ones that cannot render the current language. A wrong declaration
 * is invisible until an author picks the font and gets tofu, so it is checked
 * against the font FILES rather than trusted.
 */
const { faces } = loadedFaces([
  join(process.cwd(), 'app', 'layout.tsx'),
  join(process.cwd(), 'app', 'editor-fonts.ts'),
]);

const CODEPOINTS: Record<FontScript, readonly number[]> = {
  latin: LATIN_CODEPOINTS,
  cyrillic: RUSSIAN_CODEPOINTS,
  cjk: CJK_CODEPOINTS,
};

const declared = FONTS.filter((font) => font.scripts);

describe('picker font script declarations', () => {
  it('covers every entry except the default', () => {
    // The default entry sets no family, so it has nothing to declare. Every
    // other one must, or `fontsForScript` would keep it in every language.
    const undeclared = FONTS.filter((font) => !font.scripts).map((font) => font.value);
    expect(undeclared).toEqual(['']);
  });

  it.each(declared.map((font) => [font.value, font.scripts!] as const))(
    '%s really renders the scripts it claims',
    (family, scripts) => {
      for (const script of scripts) {
        expect(
          familyCovers(faces, family, CODEPOINTS[script]),
          `${family} claims ${script} but a face of it is missing those glyphs`,
        ).toBe(true);
      }
    },
  );

  it.each(declared.map((font) => [font.value, font.scripts!] as const))(
    '%s does not silently cover a script it left out',
    (family, scripts) => {
      // A font that gained a script should be declared, not discovered later by
      // a user wondering why it is missing from the picker.
      for (const script of ['latin', 'cyrillic', 'cjk'] as const) {
        if (scripts.includes(script)) continue;
        expect(
          familyCovers(faces, family, CODEPOINTS[script]),
          `${family} covers ${script} but does not declare it`,
        ).toBe(false);
      }
    },
  );
});

describe('scriptForLocale', () => {
  it('maps the shipped locales', () => {
    expect(scriptForLocale('ru-RU')).toBe('cyrillic');
    expect(scriptForLocale('en-US')).toBe('latin');
  });

  it('maps languages a course can still be written in', () => {
    expect(scriptForLocale('zh-CN')).toBe('cjk');
    expect(scriptForLocale('ja-JP')).toBe('cjk');
    expect(scriptForLocale('uk-UA')).toBe('cyrillic');
    expect(scriptForLocale('de-DE')).toBe('latin');
  });
});

describe('fontsForScript', () => {
  it('drops the Chinese display face for Russian', () => {
    // The concrete defect: ZCOOL KuaiLe has no Cyrillic, and was offered to a
    // Russian author who would have got an OS fallback.
    const values = fontsForScript('cyrillic').map((font) => font.value);
    expect(values).not.toContain('ZCOOL KuaiLe');
    expect(values).toContain('Inter Variable');
  });

  it('keeps the Chinese faces for Chinese', () => {
    expect(fontsForScript('cjk').map((font) => font.value)).toContain('ZCOOL KuaiLe');
  });

  it('always keeps the default entry, which overrides no family', () => {
    for (const script of ['latin', 'cyrillic', 'cjk'] as const) {
      expect(fontsForScript(script).map((font) => font.value)).toContain('');
    }
  });
});

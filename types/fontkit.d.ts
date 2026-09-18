/**
 * Minimal ambient types for `fontkit`, which ships no TypeScript definitions.
 *
 * Only the surface `scripts/check-brand-fonts.ts` touches is declared — enough
 * to open a font file and ask whether it has a glyph for a code point. The
 * font-generation scripts under `scripts/*.mjs` are plain JavaScript and never
 * see this file.
 *
 * `openSync` can also return a collection (`.ttc`/`.otc`); the brand check only
 * ever opens single-face `.woff2` files, so that variant is left undeclared
 * rather than declared loosely.
 */
declare module 'fontkit' {
  export interface Font {
    readonly familyName: string;
    readonly numGlyphs: number;
    /** True when the font can render `codePoint` itself, rather than via fallback. */
    hasGlyphForCodePoint(codePoint: number): boolean;
  }

  export function openSync(filename: string, postscriptName?: string): Font;

  const fontkit: { openSync: typeof openSync };
  export default fontkit;
}

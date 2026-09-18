/**
 * WCAG contrast maths for the brand palette.
 *
 * Lives here rather than inside the check script so it can be unit-tested
 * against known reference values — a contrast checker that is quietly wrong
 * is worse than no checker, because it reports "ok".
 *
 * `tinycolor2` (already a dependency) is not used: the palette is written in
 * `oklch()`, which tinycolor2 cannot parse. It would return an invalid colour
 * and every pair would "pass".
 */

/** Linear-light sRGB, components in 0–1, plus alpha. */
export interface LinearRgb {
  r: number;
  g: number;
  b: number;
  a: number;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function parseHex(value: string): { r: number; g: number; b: number; a: number } | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(value.trim());
  if (!match) return null;

  const digits = match[1];
  const expand = (d: string) =>
    d.length === 3 || d.length === 4
      ? d
          .split('')
          .map((c) => c + c)
          .join('')
      : d;
  const full = expand(digits);

  return {
    r: parseInt(full.slice(0, 2), 16) / 255,
    g: parseInt(full.slice(2, 4), 16) / 255,
    b: parseInt(full.slice(4, 6), 16) / 255,
    a: full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1,
  };
}

/** sRGB gamma decode — hex is gamma-encoded, `oklch()` converts straight to linear. */
function decodeGamma(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** `oklch(L C H)` or `oklch(L C H / A)`, with L and A accepted as 0–1 or a percentage. */
function parseOklch(value: string): LinearRgb | null {
  const match = /^oklch\(\s*([^\s/]+)\s+([^\s/]+)\s+([^\s/]+)\s*(?:\/\s*([^\s/)]+)\s*)?\)$/i.exec(
    value.trim(),
  );
  if (!match) return null;

  const num = (raw: string): number =>
    raw.endsWith('%') ? Number(raw.slice(0, -1)) / 100 : Number(raw);

  const lightness = num(match[1]);
  const chroma = num(match[2]);
  const hueDeg = Number(match[3].replace(/deg$/i, ''));
  const alpha = match[4] === undefined ? 1 : num(match[4]);
  if ([lightness, chroma, hueDeg, alpha].some((n) => Number.isNaN(n))) return null;

  const hueRad = (hueDeg * Math.PI) / 180;
  const aLab = chroma * Math.cos(hueRad);
  const bLab = chroma * Math.sin(hueRad);

  // OKLab → LMS → linear sRGB (Björn Ottosson's matrices).
  const lRoot = lightness + 0.3963377774 * aLab + 0.2158037573 * bLab;
  const mRoot = lightness - 0.1055613458 * aLab - 0.0638541728 * bLab;
  const sRoot = lightness - 0.0894841775 * aLab - 1.291485548 * bLab;
  const l = lRoot ** 3;
  const m = mRoot ** 3;
  const s = sRoot ** 3;

  return {
    r: clamp01(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: clamp01(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: clamp01(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    a: clamp01(alpha),
  };
}

/**
 * Parse a CSS colour from the brand palette into linear-light sRGB.
 * Returns null for syntax the checker does not understand, so the caller can
 * report it rather than treat an unparsed colour as passing.
 */
export function parseCssColor(value: string): LinearRgb | null {
  const hex = parseHex(value);
  if (hex) {
    return {
      r: decodeGamma(hex.r),
      g: decodeGamma(hex.g),
      b: decodeGamma(hex.b),
      a: hex.a,
    };
  }
  return parseOklch(value);
}

/** Alpha-composite `top` over `bottom`. Both must already be linear-light. */
export function compositeOver(top: LinearRgb, bottom: LinearRgb): LinearRgb {
  if (top.a >= 1) return top;
  return {
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  };
}

export function relativeLuminance(color: LinearRgb): number {
  return 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
}

/** WCAG 2.1 contrast ratio, 1–21. A translucent foreground is composited first. */
export function contrastRatio(foreground: LinearRgb, background: LinearRgb): number {
  const fg = compositeOver(foreground, background);
  const lighter = Math.max(relativeLuminance(fg), relativeLuminance(background)) + 0.05;
  const darker = Math.min(relativeLuminance(fg), relativeLuminance(background)) + 0.05;
  return lighter / darker;
}

/** Convenience for the two CSS strings the palette actually holds. */
export function cssContrastRatio(foreground: string, background: string): number | null {
  const bg = parseCssColor(background);
  const fg = parseCssColor(foreground);
  if (!bg || !fg) return null;
  return contrastRatio(fg, bg);
}

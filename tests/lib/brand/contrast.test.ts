import { describe, expect, it } from 'vitest';

import { compositeOver, cssContrastRatio, parseCssColor } from '@/lib/brand/contrast';

/**
 * A contrast checker that is quietly wrong is worse than none, because it
 * reports "ok". These are published reference values, not values this
 * implementation produced.
 */
describe('cssContrastRatio', () => {
  it('matches the WCAG reference extremes', () => {
    expect(cssContrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(cssContrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(cssContrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
  });

  it('matches the canonical 4.5:1 boundary colour', () => {
    // #767676 on white is the darkest grey that still clears AA body text, and
    // is quoted at 4.54:1 in every WCAG tutorial.
    expect(cssContrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 1);
  });

  it('is symmetric', () => {
    const a = cssContrastRatio('#722ed1', '#ffffff')!;
    const b = cssContrastRatio('#ffffff', '#722ed1')!;
    expect(a).toBeCloseTo(b, 10);
  });

  it('reads oklch() as well as hex', () => {
    // oklch(1 0 0) is white and oklch(0 0 0) is black, so this must also be 21.
    expect(cssContrastRatio('oklch(1 0 0)', 'oklch(0 0 0)')).toBeCloseTo(21, 2);
    // Same colour expressed both ways must agree.
    const viaOklch = cssContrastRatio('oklch(1 0 0)', '#000000')!;
    expect(viaOklch).toBeCloseTo(21, 2);
  });

  it('returns null for syntax it does not understand, rather than passing', () => {
    // A checker that treats `rgb(...)` as "fine" would silently stop checking
    // whichever token a rebrand writes that way.
    expect(cssContrastRatio('rgb(0 0 0)', '#ffffff')).toBeNull();
    expect(cssContrastRatio('var(--primary)', '#ffffff')).toBeNull();
  });

  it('shortens to 3- and 4-digit hex', () => {
    expect(cssContrastRatio('#fff', '#000')).toBeCloseTo(21, 5);
  });
});

describe('parseCssColor', () => {
  it('keeps the alpha channel from oklch() and from 8-digit hex', () => {
    expect(parseCssColor('oklch(1 0 0 / 10%)')?.a).toBeCloseTo(0.1, 5);
    expect(parseCssColor('#ffffff80')?.a).toBeCloseTo(0.502, 2);
  });
});

describe('compositeOver', () => {
  it('leaves an opaque colour alone', () => {
    const top = { r: 1, g: 0, b: 0, a: 1 };
    expect(compositeOver(top, { r: 0, g: 0, b: 1, a: 1 })).toEqual(top);
  });

  it('blends a translucent colour into its backdrop', () => {
    // The dark theme's --border is white at 10%; measuring it uncomposited
    // would claim near-white contrast for a barely visible hairline.
    const blended = compositeOver({ r: 1, g: 1, b: 1, a: 0.5 }, { r: 0, g: 0, b: 0, a: 1 });
    expect(blended.r).toBeCloseTo(0.5, 5);
    expect(blended.a).toBe(1);
  });
});

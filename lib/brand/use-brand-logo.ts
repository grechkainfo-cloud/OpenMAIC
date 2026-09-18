'use client';

import { useBrand } from './brand-context';
import { useResolvedTheme } from '@/lib/hooks/use-theme';

export type BrandLogoVariant = 'horizontal' | 'mark';

export interface BrandLogoSource {
  /** Path under `public/`, resolved for the active theme. */
  src: string;
  /** Alt text — the product name, never a hardcoded string. */
  alt: string;
}

/**
 * The logo asset to render, resolved for the active theme.
 *
 * Returned as data rather than as a component so call sites keep their own
 * element: the homepage hero animates its lockup with `motion.img`, the PBL
 * header needs `next/image`, and the rails want a plain `<img>`. All three get
 * the same source of truth without giving up their element.
 *
 * A brand with no dark lockup (`logo.dark` unset) uses the light asset in both
 * themes, which is the honest outcome — better than shipping a second asset
 * that was never drawn.
 *
 * Reads the theme through `useResolvedTheme()` rather than `useTheme()`: a
 * logo has no business making a component require a ThemeProvider, and every
 * rail that shows one is also unit-tested in isolation.
 */
export function useBrandLogo(variant: BrandLogoVariant = 'horizontal'): BrandLogoSource {
  const brand = useBrand();
  const resolvedTheme = useResolvedTheme();

  if (variant === 'mark') {
    return { src: brand.logo.mark, alt: brand.productName };
  }

  const src = resolvedTheme === 'dark' && brand.logo.dark ? brand.logo.dark : brand.logo.light;
  return { src, alt: brand.productName };
}

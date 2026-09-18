'use client';

/**
 * Brand context.
 *
 * The brand is static per build (see `./brand-config`), so the default context
 * value already carries it and `useBrand()` works without a provider mounted.
 * `BrandProvider` exists for tests and for a future per-request resolution
 * (a vendor shell, a white-label host) that would inject a different config.
 */

import { createContext, useContext } from 'react';
import { BRAND, type BrandConfig } from './brand-config';

interface BrandContextValue {
  brand: BrandConfig;
  /** Whether the request came from a desktop client (vendor UA marker). */
  isDesktop: boolean;
}

const BrandContext = createContext<BrandContextValue>({
  brand: BRAND,
  isDesktop: false,
});

export function BrandProvider({
  brand = BRAND,
  isDesktop = false,
  children,
}: {
  brand?: BrandConfig;
  isDesktop?: boolean;
  children: React.ReactNode;
}) {
  return <BrandContext.Provider value={{ brand, isDesktop }}>{children}</BrandContext.Provider>;
}

export function useBrand(): BrandConfig {
  return useContext(BrandContext).brand;
}

export function useIsDesktop(): boolean {
  return useContext(BrandContext).isDesktop;
}

'use client';

import { useBrand } from './brand-context';
import { useI18n } from '@/lib/hooks/use-i18n';

/**
 * The tagline shown under the product lockup.
 *
 * A tagline is prose, so by default it lives in `lib/i18n/locales/` under
 * `home.slogan` and gets translated like everything else. `BRAND.slogan`
 * overrides it for a brand whose tagline is a fixed, untranslated phrase.
 *
 * Call sites use this hook instead of `t('home.slogan')` so the override is
 * honoured everywhere the tagline appears, not just where someone remembered.
 */
export function useBrandTagline(): string {
  const brand = useBrand();
  const { t } = useI18n();
  return brand.slogan ?? t('home.slogan');
}

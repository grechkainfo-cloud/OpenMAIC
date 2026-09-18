import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import resourcesToBackend from 'i18next-resources-to-backend';
import { supportedLocales } from './locales';
import { defaultLocale, fallbackLocale } from './types';
import { workbenchResourceFor } from './workbench';
import { BRAND_INTERPOLATION_DEFAULTS } from '@/lib/brand/brand-config';

type TranslationResource = Record<string, unknown>;

function isRecord(value: unknown): value is TranslationResource {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * The workbench chat surface's product copy lives in `lib/i18n/workbench.ts`
 * (a hook-free en/zh map, see `workbenchResourceFor`) rather than in the
 * per-locale JSON files. This loader merges it under the `workbench.*` namespace
 * so the React `t` and the hook-free `WorkbenchTranslator` resolve the same
 * keys: `t('workbench.chat.jumpToBottom')` works everywhere `t` works.
 */
function deepMerge(base: TranslationResource, overlay: TranslationResource): TranslationResource {
  const result = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    result[key] = isRecord(value) && isRecord(result[key]) ? deepMerge(result[key], value) : value;
  }
  return result;
}

i18n
  .use(initReactI18next)
  .use(
    resourcesToBackend(async (language: string) => {
      const localeModule = await import(`./locales/${language}.json`);
      return deepMerge(localeModule.default, { workbench: workbenchResourceFor(language) });
    }),
  )
  .init({
    lng: defaultLocale,
    // English, not the default. `fallbackLng: defaultLocale` would render
    // Russian to an English speaker for any key English happens to be missing.
    fallbackLng: fallbackLocale,
    supportedLngs: supportedLocales.map((l) => l.code),
    interpolation: {
      escapeValue: false,
      // The product name is brand config, not copy, so translations say
      // `{{brand}}` and never spell it out. Declared as a default variable so
      // no call site has to remember to pass it. Mirrored in the hook-free
      // `createWorkbenchTranslator`.
      defaultVariables: BRAND_INTERPOLATION_DEFAULTS,
    },
  });

export default i18n;

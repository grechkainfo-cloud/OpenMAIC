import i18n from './config';

export { type Locale, type ContentLocale, defaultLocale, fallbackLocale } from './types';
import { defaultLocale as defaultLocaleValue } from './types';
export { type LocaleEntry, supportedLocales } from './locales';
export type TranslationKey = string;

export function translate(locale: string, key: string): string {
  return i18n.t(key, { lng: locale });
}

export function getClientTranslation(key: string): string {
  return i18n.t(key);
}

/**
 * The active interface locale, outside React.
 *
 * `useI18n()` is the way to read this in a component. This exists for shared
 * presentation helpers that are plain functions with no hook to read from —
 * the same reason `getClientTranslation` exists above. Falls back to the
 * default before i18next has settled on a language.
 */
export function currentLocale(): string {
  return i18n.language || defaultLocaleValue;
}

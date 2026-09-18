import enUS from '@/lib/i18n/locales/en-US.json';
import ruRU from '@/lib/i18n/locales/ru-RU.json';
import { supportedLocales } from '@/lib/i18n/locales';
import type { Locale } from '@/lib/i18n/types';

/**
 * Every shipped interface locale, for the coverage tests in this directory.
 *
 * These tests used to import each locale by hand and list them in every
 * `it.each`, which meant a locale could be added and silently miss half the
 * assertions — and that dropping one broke seven files. Reading the set from
 * `supportedLocales` makes the coverage follow the registry.
 */

/**
 * `typeof enUS` gives every value its literal type (`"Save"`), which no other
 * locale can satisfy. Widening string leaves to `string` keeps the structure —
 * which is what these tests assert on — without pinning the words.
 */
type Widen<T> = { readonly [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };

export type LocaleResource = Widen<typeof enUS>;

/** `{ 'ru-RU': …, 'en-US': … }` — for tests that iterate with `Object.entries`. */
export const localeResourceMap: Record<Locale, LocaleResource> = {
  'ru-RU': ruRU,
  'en-US': enUS,
};

/**
 * `[code, resource]` pairs for `it.each`, so a failure names the locale that
 * is missing the key rather than dumping the whole resource.
 */
export const localeResources: ReadonlyArray<readonly [Locale, LocaleResource]> =
  supportedLocales.map((entry) => [entry.code, localeResourceMap[entry.code]] as const);

/** Guard: a locale added to the registry must be wired in here too. */
export function assertEveryLocaleCovered(): void {
  for (const entry of supportedLocales) {
    if (!localeResourceMap[entry.code]) {
      throw new Error(`tests/i18n/locale-resources.ts is missing ${entry.code}`);
    }
  }
}

/** Plural suffixes i18next appends when a `count` is passed. */
const PLURAL_SUFFIXES = ['one', 'few', 'many', 'other', 'two', 'zero'] as const;

function readPath(source: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((value, part) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[part];
  }, source);
}

/**
 * The string a key resolves to, following plural suffixes.
 *
 * A counted key has no bare entry — only `key_one`, `key_few`, … — so a
 * coverage check that reads the bare path alone would report a correctly
 * pluralized key as missing. Returns the first form it finds, which is enough
 * for "is this translated at all" checks.
 */
export function resolveLocaleKey(resource: unknown, key: string): string | undefined {
  const bare = readPath(resource, key);
  if (typeof bare === 'string') return bare;
  for (const suffix of PLURAL_SUFFIXES) {
    const form = readPath(resource, `${key}_${suffix}`);
    if (typeof form === 'string') return form;
  }
  return undefined;
}

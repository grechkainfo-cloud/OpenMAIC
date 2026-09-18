/**
 * Locale-aware date, number and relative-time formatting.
 *
 * Every call site used to reach for `toLocaleDateString()` or
 * `new Intl.NumberFormat('en-US', …)` directly. The first takes the BROWSER's
 * locale, not the app's — a Russian interface on an English-locale machine
 * rendered "9/18/2026" next to Russian copy. The second is worse: it pins the
 * grouping and decimal separators to English, so a token count rendered as
 * "1,234.56" where Russian writes "1 234,56".
 *
 * Formatters are cached per locale because constructing an `Intl.*Format` is
 * comparatively expensive and these run inside render.
 */

const dateFormatters = new Map<string, Intl.DateTimeFormat>();
const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();
const numberFormatters = new Map<string, Intl.NumberFormat>();
const relativeFormatters = new Map<string, Intl.RelativeTimeFormat>();

function cached<T>(store: Map<string, T>, key: string, create: () => T): T {
  const existing = store.get(key);
  if (existing) return existing;
  const created = create();
  store.set(key, created);
  return created;
}

/**
 * Numeric date: `18.09.2026` for ru-RU, `9/18/2026` for en-US.
 *
 * Numeric on purpose — it is the form the deployment asked for, it is the
 * shortest, and it does not decline, so it drops into any sentence.
 */
export function formatDate(value: Date | number | string, locale: string): string {
  return cached(dateFormatters, locale, () => new Intl.DateTimeFormat(locale)).format(
    new Date(value),
  );
}

/** Numeric date plus `HH:MM`, 24-hour wherever the locale says so. */
export function formatDateTime(value: Date | number | string, locale: string): string {
  return cached(
    dateTimeFormatters,
    locale,
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: 'short',
        timeStyle: 'short',
      }),
  ).format(new Date(value));
}

export function formatNumber(
  value: number,
  locale: string,
  options?: Intl.NumberFormatOptions,
): string {
  // Options make the cache key useless, so only the bare case is cached — which
  // is the one that runs per row.
  if (!options) {
    return cached(numberFormatters, locale, () => new Intl.NumberFormat(locale)).format(value);
  }
  return new Intl.NumberFormat(locale, options).format(value);
}

export type RelativeUnit = 'minute' | 'hour' | 'day';

/**
 * `5 минут назад`, `2 часа назад`, `3 дня назад` — declined by `Intl`, which
 * knows Russian needs three forms where English needs two.
 *
 * This replaces hand-built strings of the shape `${n} ${t('daysAgo')}`, which
 * could only ever produce one form and read as "3 день назад".
 */
export function formatRelativeTime(count: number, unit: RelativeUnit, locale: string): string {
  return cached(
    relativeFormatters,
    locale,
    () => new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }),
  ).format(-Math.abs(count), unit);
}

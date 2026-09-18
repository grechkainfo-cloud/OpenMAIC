/**
 * Text comparison that works for Cyrillic.
 *
 * `a.toLowerCase().includes(b.toLowerCase())` is not enough for Russian:
 *
 *   - **ё / е.** Russians type "ежик" and "еж" far more often than "ёжик" and
 *     "ёж", and a course the model titled with "ё" then becomes unfindable.
 *     Treating them as the same letter for SEARCH is what users expect; it is
 *     not a claim that they are the same letter.
 *   - **Composition.** Cyrillic "й" and "ё" have both precomposed and
 *     combining forms. Two visually identical names can hold different bytes,
 *     so a duplicate-name check misses the duplicate. `NFC` settles that.
 *   - **Ordering.** `Array.sort()` compares UTF-16 code units, which puts every
 *     Cyrillic name after every Latin one and ignores case entirely. That is a
 *     list nobody can scan. `Intl.Collator` sorts the way a reader expects.
 */

const collators = new Map<string, Intl.Collator>();

/**
 * Case-folded, composition-normalized, ё-folded, whitespace-collapsed.
 *
 * Use for matching and for duplicate detection — never for display, and never
 * for storage: this is deliberately lossy.
 */
export function normalizeForSearch(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .normalize('NFC')
    .toLowerCase()
    .replace(/ё/g, 'е') // ё → е
    .replace(/\s+/g, ' ')
    .trim();
}

/** Whether `haystack` contains `needle`, ignoring case, ё/е and spacing. */
export function matchesSearch(haystack: string | null | undefined, needle: string): boolean {
  const query = normalizeForSearch(needle);
  if (!query) return true;
  return normalizeForSearch(haystack).includes(query);
}

/**
 * Whether two user-entered names are "the same name" for the purpose of
 * refusing a duplicate. `Физика` and `физика ` are the same folder to a person.
 */
export function isSameName(left: string | null | undefined, right: string | null | undefined) {
  return normalizeForSearch(left) === normalizeForSearch(right);
}

/**
 * Locale-aware comparator for user-visible names.
 *
 * `sensitivity: 'base'` so case and ё/е do not reorder the list, and
 * `numeric: true` so "Урок 2" sorts before "Урок 10".
 */
export function compareNames(left: string, right: string, locale: string): number {
  const collator = collators.get(locale);
  if (collator) return collator.compare(left, right);
  const created = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
  collators.set(locale, created);
  return created.compare(left, right);
}

/** `compareNames` bound to a locale, for handing straight to `Array#sort`. */
export function nameComparator(locale: string): (left: string, right: string) => number {
  return (left, right) => compareNames(left, right, locale);
}

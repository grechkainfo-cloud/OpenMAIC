import fs from 'node:fs';
import path from 'node:path';

const LOCALES_DIR = path.join(process.cwd(), 'lib', 'i18n', 'locales');
const SOURCE_LOCALE = 'en-US.json';

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function formatPath(keyPath) {
  return keyPath || '<root>';
}

function collectLeafKeys(value, fileName, keyPath = '', keys = new Set()) {
  if (Array.isArray(value)) {
    throw new Error(
      `${fileName} has an array at "${formatPath(keyPath)}". Locale values must not be arrays.`,
    );
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value);

    if (entries.length === 0) {
      throw new Error(
        `${fileName} has an empty object at "${formatPath(keyPath)}". Locale objects must not be empty.`,
      );
    }

    for (const [key, child] of entries) {
      const nextPath = keyPath ? `${keyPath}.${key}` : key;
      collectLeafKeys(child, fileName, nextPath, keys);
    }

    return keys;
  }

  if (!keyPath) {
    throw new Error(`${fileName} must contain a JSON object at the root.`);
  }

  keys.add(keyPath);
  return keys;
}

function readLocaleKeys(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  const fileName = path.basename(filePath);

  if (!isPlainObject(parsed)) {
    throw new Error(`${fileName} must contain a JSON object at the root.`);
  }

  return [...collectLeafKeys(parsed, fileName)].sort();
}

/**
 * i18next plural suffixes, as `Intl.PluralRules` names them.
 *
 * A key is "plural" when at least one suffixed form exists. The suffix set a
 * locale needs is its OWN language's categories: English needs `one`/`other`,
 * Russian needs `one`/`few`/`many`/`other`. Comparing raw key sets across
 * locales — which this script used to do — makes correct Russian plurals
 * impossible to express, because `sceneCount_few` reads as an "extra key".
 */
const PLURAL_SUFFIXES = ['zero', 'one', 'two', 'few', 'many', 'other'];

function splitPluralKey(key) {
  const underscore = key.lastIndexOf('_');
  if (underscore === -1) return { base: key, form: '' };
  const form = key.slice(underscore + 1);
  return PLURAL_SUFFIXES.includes(form)
    ? { base: key.slice(0, underscore), form }
    : { base: key, form: '' };
}

/** `{ base -> Set(form) }`, where the bare key is the empty-string form. */
function groupByBase(keys) {
  const groups = new Map();
  for (const key of keys) {
    const { base, form } = splitPluralKey(key);
    if (!groups.has(base)) groups.set(base, new Set());
    groups.get(base).add(form);
  }
  return groups;
}

function cardinalCategories(localeFile) {
  const locale = path.basename(localeFile, '.json');
  return new Set(new Intl.PluralRules(locale).resolvedOptions().pluralCategories);
}

function sortedList(values) {
  return [...values].sort();
}

function main() {
  const localeFiles = fs
    .readdirSync(LOCALES_DIR)
    .filter((name) => name.endsWith('.json'))
    .sort();

  if (!localeFiles.includes(SOURCE_LOCALE)) {
    throw new Error(`Missing source locale: ${SOURCE_LOCALE}`);
  }

  const sourceGroups = groupByBase(readLocaleKeys(path.join(LOCALES_DIR, SOURCE_LOCALE)));
  const reports = [];

  // The source locale is held to its own plural rules too. Nothing else checks
  // it, and English rendering "1 actions" is the same defect as Russian
  // rendering "1 действий".
  const sourceCategories = cardinalCategories(SOURCE_LOCALE);
  const sourcePlurals = [];
  for (const [base, forms] of sourceGroups) {
    const declared = new Set([...forms].filter((form) => form !== ''));
    if (declared.size === 0) continue;
    const missingForms = sortedList([...sourceCategories].filter((form) => !declared.has(form)));
    const extraForms = sortedList([...declared].filter((form) => !sourceCategories.has(form)));
    if (missingForms.length > 0 || extraForms.length > 0) {
      sourcePlurals.push(
        `${base}: plural forms must be exactly ${sortedList(sourceCategories).join(', ')}` +
          (missingForms.length > 0 ? ` — missing ${missingForms.join(', ')}` : '') +
          (extraForms.length > 0 ? ` — unexpected ${extraForms.join(', ')}` : ''),
      );
    }
  }
  if (sourcePlurals.length > 0) {
    reports.push({ file: SOURCE_LOCALE, missing: [], extra: [], plurals: sourcePlurals });
  }

  for (const localeFile of localeFiles) {
    if (localeFile === SOURCE_LOCALE) continue;

    const groups = groupByBase(readLocaleKeys(path.join(LOCALES_DIR, localeFile)));
    const categories = cardinalCategories(localeFile);

    const missing = sortedList([...sourceGroups.keys()].filter((base) => !groups.has(base)));
    const extra = sortedList([...groups.keys()].filter((base) => !sourceGroups.has(base)));
    const plurals = [];

    for (const [base, sourceForms] of sourceGroups) {
      const forms = groups.get(base);
      if (!forms) continue;

      const sourceIsPlural = [...sourceForms].some((form) => form !== '');
      const localeForms = new Set([...forms].filter((form) => form !== ''));

      if (!sourceIsPlural) {
        if (localeForms.size > 0) {
          plurals.push(
            `${base}: ${SOURCE_LOCALE} has no plural forms, this locale has ` +
              `${sortedList(localeForms).join(', ')}`,
          );
        }
        continue;
      }

      if (localeForms.size === 0) {
        plurals.push(
          `${base}: needs the plural forms ${sortedList(categories).join(', ')} ` +
            `for this language, but has none`,
        );
        continue;
      }

      const missingForms = sortedList([...categories].filter((form) => !localeForms.has(form)));
      const extraForms = sortedList([...localeForms].filter((form) => !categories.has(form)));
      if (missingForms.length > 0 || extraForms.length > 0) {
        plurals.push(
          `${base}: plural forms must be exactly ${sortedList(categories).join(', ')}` +
            (missingForms.length > 0 ? ` — missing ${missingForms.join(', ')}` : '') +
            (extraForms.length > 0 ? ` — unexpected ${extraForms.join(', ')}` : ''),
        );
      }
    }

    if (missing.length > 0 || extra.length > 0 || plurals.length > 0) {
      reports.push({ file: localeFile, missing, extra, plurals });
    }
  }

  if (reports.length === 0) {
    console.log(
      `i18n key alignment check passed (${localeFiles.length} locale files, source: ${SOURCE_LOCALE}).`,
    );
    return;
  }

  console.error(`i18n key alignment check failed against ${SOURCE_LOCALE}:`);

  for (const report of reports) {
    console.error(`
- ${report.file}`);

    if (report.missing.length > 0) {
      console.error(`  Missing keys (${report.missing.length}):`);
      for (const key of report.missing) console.error(`    - ${key}`);
    }

    if (report.extra.length > 0) {
      console.error(`  Extra keys (${report.extra.length}):`);
      for (const key of report.extra) console.error(`    - ${key}`);
    }

    if (report.plurals.length > 0) {
      console.error(`  Plural form problems (${report.plurals.length}):`);
      for (const note of report.plurals) console.error(`    - ${note}`);
    }
  }

  process.exit(1);
}

main();

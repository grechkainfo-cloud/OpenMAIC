export type LocaleEntry = {
  code: string;
  /** Native name shown in dropdown, e.g. '简体中文' */
  label: string;
  /** Short label shown on the toggle button, e.g. 'CN' */
  shortLabel: string;
};

/**
 * Supported INTERFACE locales.
 *
 * Russian first: it is the default (`lib/i18n/types.ts`), English is the
 * fallback every untranslated key resolves through.
 *
 * Upstream shipped twelve; this deployment serves two, so a copy change is two
 * files instead of twelve. The ten that were dropped are in git history if one
 * is ever wanted back.
 *
 * NOTE: this list is the UI language, NOT the language a course can be
 * generated in. Content language is carried per course by
 * `stage.languageDirective` and is not limited to this list — the model can
 * author a course in any language it supports, and the PBL instructor and the
 * video-export chrome keep their own per-language strings keyed by plain
 * strings for exactly that reason.
 *
 * To add a language:
 *   1. Create `lib/i18n/locales/<code>.json` (copy `en-US.json` as template)
 *   2. Add an entry here
 *   3. Optionally add `lib/i18n/workbench-locales/<code>.json`
 */
export const supportedLocales = [
  { code: 'ru-RU', label: 'Русский', shortLabel: 'RU' },
  { code: 'en-US', label: 'English', shortLabel: 'EN' },
] as const satisfies readonly LocaleEntry[];

import { supportedLocales } from './locales';

export type Locale = (typeof supportedLocales)[number]['code'];

/** Interface language a visitor gets before any preference is known. */
export const defaultLocale: Locale = 'ru-RU';

/**
 * Language an untranslated key resolves through. Deliberately NOT the default:
 * with `fallbackLng` pointing at the default, a key missing from English would
 * render Russian to an English speaker.
 */
export const fallbackLocale: Locale = 'en-US';

/**
 * A BCP-47 tag that is NOT necessarily a shipped interface locale.
 *
 * The interface speaks Russian or English; a COURSE can be authored in any
 * language the model supports, and the video exporter has to keep working for
 * it — right-to-left layout for Arabic, script-font planning for CJK, and so
 * on. Typing those paths as {@link Locale} would have said "a course can only
 * exist in a language the UI ships", which was never true and stopped being
 * expressible once the UI dropped to two locales.
 *
 * Deliberately a bare `string`: the value really is any tag. What it buys is
 * the distinction at every call site, so nobody re-narrows it by accident.
 */
export type ContentLocale = string;

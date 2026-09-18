import i18next, { type i18n as I18n } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import enUS from '@/lib/i18n/locales/en-US.json';
import ruRU from '@/lib/i18n/locales/ru-RU.json';
import { BRAND_INTERPOLATION_DEFAULTS } from '@/lib/brand/brand-config';

/**
 * Russian has four cardinal plural categories; English has two. i18next
 * resolves them through `Intl.PluralRules`, so a Russian key that only carries
 * the English `_one`/`_other` pair does not render a clumsy form — it renders
 * the RAW KEY for counts 2-4 and 5+, which is what a user would have seen on
 * the workspace rail ("workspace.sceneCount" instead of "3 страницы").
 *
 * These cases are the ones that actually distinguish the four categories:
 * 1 (one), 2 (few), 5 (many), 11 (many — not one, despite ending in 1),
 * 21 (one), 22 (few), 25 (many), 101 (one), and 1.5 (other, the only category
 * a fraction can land in).
 */
const COUNTS = [1, 2, 5, 11, 21, 22, 25, 101, 1.5];

let ru: I18n;
let en: I18n;

beforeAll(async () => {
  ru = i18next.createInstance();
  await ru.init({
    lng: 'ru-RU',
    resources: { 'ru-RU': { translation: ruRU } },
    interpolation: { escapeValue: false, defaultVariables: BRAND_INTERPOLATION_DEFAULTS },
  });
  en = i18next.createInstance();
  await en.init({
    lng: 'en-US',
    resources: { 'en-US': { translation: enUS } },
    interpolation: { escapeValue: false, defaultVariables: BRAND_INTERPOLATION_DEFAULTS },
  });
});

/** Every key the UI calls with a `count`, as a base key. */
const COUNTED_KEYS = [
  'workspace.sceneCount',
  'workspace.courseLinkMore',
  'workspace.courseMention.capped',
  'workspace.showMore',
  'classroom.deleteFolderAndCourses',
  'edit.roster.count',
  'edit.regen.actionsCount',
  'edit.regenScene.elementsCount',
  'generation.quizConfigSummary',
  'settings.agentsCollaboratingCount',
  'settings.actionCount',
  'settings.voxcpmVoiceCount',
  'whiteboard.elementCount',
];

describe('Russian plural forms', () => {
  it.each(COUNTED_KEYS)('%s resolves to a real sentence for every count', (key) => {
    for (const count of COUNTS) {
      const value = ru.t(key, { count });
      expect(value, `${key} @ ${count} rendered the key itself`).not.toBe(key);
      expect(value, `${key} @ ${count} is empty`).not.toBe('');
      expect(value, `${key} @ ${count} leaked an interpolation`).not.toContain('{{');
      expect(value, `${key} @ ${count} lost the number`).toContain(String(count));
    }
  });

  it.each(COUNTED_KEYS)('%s resolves for English too', (key) => {
    for (const count of COUNTS) {
      const value = en.t(key, { count });
      expect(value, `${key} @ ${count} rendered the key itself`).not.toBe(key);
      expect(value).not.toContain('{{');
    }
  });

  it('declines the noun, not just the number', () => {
    // The point of four forms. If these three agreed, the key would have been
    // written with one form and the test would be measuring nothing.
    expect(ru.t('workspace.sceneCount', { count: 1 })).toBe('1 страница');
    expect(ru.t('workspace.sceneCount', { count: 2 })).toBe('2 страницы');
    expect(ru.t('workspace.sceneCount', { count: 5 })).toBe('5 страниц');
    // 21 is `one` and 11 is `many` — the case a two-form scheme cannot express.
    expect(ru.t('workspace.sceneCount', { count: 21 })).toBe('21 страница');
    expect(ru.t('workspace.sceneCount', { count: 11 })).toBe('11 страниц');
  });

  it('keeps English on singular/plural', () => {
    expect(en.t('settings.actionCount', { count: 1 })).toBe('1 action');
    expect(en.t('settings.actionCount', { count: 2 })).toBe('2 actions');
  });
});

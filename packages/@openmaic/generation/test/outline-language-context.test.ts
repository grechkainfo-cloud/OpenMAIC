import { describe, expect, it } from 'vitest';

import {
  buildLanguageContext,
  buildOutlinePrompt,
  DEFAULT_LANGUAGE_DIRECTIVE,
  defaultLanguageDirectiveFor,
  languageDisplayName,
} from '@openmaic/generation';

const requirements = { requirement: 'photosynthesis' } as Parameters<typeof buildOutlinePrompt>[0];

/**
 * The course language used to be inferred from the requirement text alone.
 * On a deployment that ships one interface language that is the wrong default:
 * a Russian-speaking author who types a two-word English topic got an English
 * course. The interface language is now the default, and an explicit request
 * in the requirement still overrides it.
 */
describe('languageDisplayName', () => {
  it('names a locale in English, for the prompt', () => {
    expect(languageDisplayName('ru-RU')).toBe('Russian');
    expect(languageDisplayName('en-US')).toBe('English');
    // The region is dropped on purpose; the caller prints the full tag beside it.
    expect(languageDisplayName('pt-BR')).toBe('Portuguese');
  });

  it('falls back to the tag it was given rather than throwing', () => {
    expect(languageDisplayName('not a locale')).toBe('not a locale');
  });
});

describe('defaultLanguageDirectiveFor', () => {
  it('names the interface language when there is one', () => {
    const directive = defaultLanguageDirectiveFor('ru-RU');
    expect(directive).toContain('Russian');
    expect(directive).toContain('unless the requirement explicitly asks');
  });

  it('keeps the old wording when the caller knows no interface language', () => {
    // The eval harness measures inference itself and passes nothing; it must
    // keep seeing the prompt it was written against.
    expect(defaultLanguageDirectiveFor()).toBe(DEFAULT_LANGUAGE_DIRECTIVE);
  });
});

describe('buildLanguageContext', () => {
  it('states the interface language as the default', () => {
    const context = buildLanguageContext('ru-RU');
    expect(context).toContain('**Russian**');
    expect(context).toContain('`ru-RU`');
    expect(context).toContain('Interface language is the default teaching language');
    expect(context).toContain('An explicit language request in the requirement overrides it');
  });

  it('keeps the requirement-language wording when none is supplied', () => {
    const context = buildLanguageContext();
    expect(context).toContain('Requirement language = teaching language');
    expect(context).not.toContain('Interface language is the default');
  });

  it('never drops the rules that are not about the default', () => {
    for (const context of [buildLanguageContext(), buildLanguageContext('ru-RU')]) {
      expect(context).toContain('Foreign language learning');
      expect(context).toContain('PDF language does NOT override');
    }
  });
});

describe('buildOutlinePrompt', () => {
  it('puts the interface language in the prompt the model sees', () => {
    const { user } = buildOutlinePrompt(requirements, { interfaceLanguage: 'ru-RU' });
    expect(user).toContain('**Russian**');
    expect(user).not.toContain('{{languageContext}}');
  });

  it('leaves the prompt as it was when no interface language is given', () => {
    const { user } = buildOutlinePrompt(requirements);
    expect(user).toContain('Requirement language = teaching language');
    expect(user).not.toContain('{{languageContext}}');
  });
});

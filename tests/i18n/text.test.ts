import { describe, expect, it } from 'vitest';

import {
  compareNames,
  isSameName,
  matchesSearch,
  nameComparator,
  normalizeForSearch,
} from '@/lib/i18n/text';

describe('normalizeForSearch', () => {
  it('folds ё to е', () => {
    // The reason this exists: people type "ежик", the model writes «Ёжик».
    expect(normalizeForSearch('Ёжик')).toBe(normalizeForSearch('ежик'));
    expect(normalizeForSearch('Всё')).toBe(normalizeForSearch('все'));
  });

  it('folds case for Cyrillic, not just Latin', () => {
    expect(normalizeForSearch('ФИЗИКА')).toBe('физика');
  });

  it('collapses whitespace and trims', () => {
    expect(normalizeForSearch('  Основы   физики ')).toBe('основы физики');
  });

  it('normalizes composition so identical-looking names match', () => {
    // "й" as precomposed U+0439 vs "и" + combining breve U+0306.
    const precomposed = 'Май';
    const decomposed = 'Май';
    expect(precomposed).not.toBe(decomposed);
    expect(normalizeForSearch(precomposed)).toBe(normalizeForSearch(decomposed));
  });

  it('survives null and undefined', () => {
    expect(normalizeForSearch(null)).toBe('');
    expect(normalizeForSearch(undefined)).toBe('');
  });
});

describe('matchesSearch', () => {
  it('finds a ё-spelled course from an е-spelled query', () => {
    expect(matchesSearch('Ёжик в тумане', 'ежик')).toBe(true);
    expect(matchesSearch('Ежик в тумане', 'ёжик')).toBe(true);
  });

  it('ignores case and surrounding space', () => {
    expect(matchesSearch('Основы физики', '  ФИЗИКИ ')).toBe(true);
  });

  it('still says no when the word is not there', () => {
    expect(matchesSearch('Основы физики', 'химия')).toBe(false);
  });

  it('treats an empty query as matching everything', () => {
    expect(matchesSearch('Основы физики', '   ')).toBe(true);
  });
});

describe('isSameName', () => {
  it('refuses a duplicate that differs only by case or spacing', () => {
    expect(isSameName('Физика', 'физика ')).toBe(true);
    expect(isSameName('Физика', 'Физика')).toBe(true);
  });

  it('keeps genuinely different names apart', () => {
    expect(isSameName('Физика', 'Физика 2')).toBe(false);
  });
});

describe('compareNames', () => {
  it('sorts Cyrillic alphabetically rather than by code unit', () => {
    const names = ['Ящерица', 'Алгебра', 'Ёлка', 'Биология'];
    expect([...names].sort(nameComparator('ru-RU'))).toEqual([
      'Алгебра',
      'Биология',
      'Ёлка',
      'Ящерица',
    ]);
  });

  it('puts a Cyrillic name before a later Latin one instead of after every Latin one', () => {
    // Plain `sort()` compares UTF-16 code units, so EVERY Cyrillic name lands
    // after every Latin one. That is the list nobody can scan.
    const naive = ['Zebra', 'Алгебра'].sort();
    expect(naive).toEqual(['Zebra', 'Алгебра']);
    expect(compareNames('Алгебра', 'Zebra', 'ru-RU')).toBeLessThan(0);
  });

  it('orders numbered lessons the way a reader counts', () => {
    const names = ['Урок 10', 'Урок 2', 'Урок 1'];
    expect([...names].sort(nameComparator('ru-RU'))).toEqual(['Урок 1', 'Урок 2', 'Урок 10']);
  });

  it('does not reorder on case or ё alone', () => {
    expect(compareNames('ёлка', 'Елка', 'ru-RU')).toBe(0);
  });
});

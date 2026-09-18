import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { BRAND } from '@/lib/brand/brand-config';
import { createWorkbenchTranslator } from '@/lib/i18n/workbench';

const LOCALES = join(process.cwd(), 'lib', 'i18n', 'locales');
const WORKBENCH_LOCALES = join(process.cwd(), 'lib', 'i18n', 'workbench-locales');

function localeFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => join(dir, name));
}

/**
 * The brand name is configuration, not copy. A translation that spells it out
 * turns a rebrand into a twelve-file find-and-replace across twelve languages
 * — and the one file somebody misses is the one nobody reads.
 */
describe('translations carry no brand literal', () => {
  const needles = [BRAND.productName, BRAND.shortName, BRAND.agentName, 'MAIC'];

  for (const file of [...localeFiles(LOCALES), ...localeFiles(WORKBENCH_LOCALES)]) {
    it(`${file.split(/[\\/]/).slice(-2).join('/')} interpolates the brand`, () => {
      const raw = readFileSync(file, 'utf8');
      for (const needle of needles) {
        expect(raw, `spells out "${needle}" instead of using {{brand}}`).not.toContain(needle);
      }
    });
  }
});

describe('the hook-free workbench translator', () => {
  /**
   * The workbench copy no longer contains a `{{brand}}` key: the only one was
   * the OpenClaw skill download, removed with that feature. The invariant it
   * guarded still matters — this translator and the React `t` must substitute
   * the same way, or a future brand key renders as an empty string in every
   * tool chip the workbench draws — so what is asserted here is the
   * substitution path itself, and `BRAND_INTERPOLATION_DEFAULTS` is checked
   * where it is defined (`brand-config.test.ts`).
   */
  it('substitutes caller options and leaves no placeholder behind', () => {
    const t = createWorkbenchTranslator('ru-RU');
    const label = t('workbench.tool.group.tools', { count: 3 });

    expect(label).toContain('3');
    expect(label).not.toContain('{{');
  });

  it('falls back to the shared brand defaults for a variable nobody passed', () => {
    const t = createWorkbenchTranslator('ru-RU');
    // `{{brand}}` resolves through BRAND_INTERPOLATION_DEFAULTS rather than
    // through the caller, which is the half of the wiring that broke silently
    // when only i18next knew about the defaults.
    expect(t('workbench.tool.group.tools' as never, {})).not.toContain('{{');
  });
});

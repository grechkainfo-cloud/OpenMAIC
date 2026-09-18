import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { listSkills } from '@/lib/server/agent-runtime/skills';
import { supportedLocales } from '@/lib/i18n/locales';
import { createWorkbenchTranslator, workbenchResourceFor } from '@/lib/i18n/workbench';
import { skillTitle } from '@/lib/workbench/agent-skills';

describe('exercise lesson skill discovery', () => {
  it('keeps the stable invocation id and exposes the Chinese title and references', async () => {
    const skill = (await listSkills()).find((entry) => entry.id === 'zone-of-proximal-development');

    expect(skill).toBeDefined();
    expect(skill!.name).toBe('zone-of-proximal-development');
    expect(skill!.title).toBe('习题课（最近发展区）');
    expect(skill!.source).toBe('builtin');

    for (const reference of ['exercise-lesson.md', 'theory.md']) {
      expect(existsSync(join(dirname(skill!.filePath), 'references', reference))).toBe(true);
    }
  });

  it.each(supportedLocales)('has explicit workbench display copy for $code', ({ code }) => {
    const handle = 'zone-of-proximal-development';
    // Inspect the overlay file itself: a merged resource could silently fall
    // back to English when a translation is missing, which is exactly what this
    // test exists to catch. English is the base and has no overlay of its own.
    const resource =
      code === 'en-US'
        ? workbenchResourceFor(code)
        : JSON.parse(
            readFileSync(join(process.cwd(), 'lib/i18n/workbench-locales', `${code}.json`), 'utf8'),
          );
    const localized = resource.skill?.title?.[handle];

    expect(typeof localized).toBe('string');
    expect(localized.trim()).not.toBe('');
    expect(skillTitle({ name: handle, source: 'builtin' }, createWorkbenchTranslator(code))).toBe(
      localized,
    );
    if (code === 'en-US') expect(localized).toBe('Practice lesson (zone of proximal development)');
  });
});

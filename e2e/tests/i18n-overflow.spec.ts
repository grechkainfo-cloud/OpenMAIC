import { test, expect } from '../fixtures/base';
import { ClassroomPage } from '../pages/classroom.page';
import { HomePage } from '../pages/home.page';
import { findClippedText, inflateText } from '../fixtures/overflow-audit';
import { seedClassroom, TEST_STAGE_ID } from '../fixtures/seed-classroom';

/**
 * Does Russian copy fit?
 *
 * Russian runs 10-15% longer than English, and up to ~40% on short labels, so
 * a control sized around English clips. The screenshot baselines next door
 * catch a layout that MOVED; this catches one that never fitted, which a
 * baseline happily records as correct.
 *
 * Two passes per screen:
 *   1. as it ships, which must be clean;
 *   2. with every string grown ~40%, which reports headroom. That pass does
 *      not fail the build — it is a measurement, and a UI with zero slack is
 *      a judgement call, not a defect.
 */
async function useRussian(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('locale', 'ru-RU');
    localStorage.setItem('theme', 'light');
  });
}

function report(label: string, findings: Awaited<ReturnType<typeof findClippedText>>) {
  if (findings.length === 0) return `${label}: nothing clipped`;
  return [
    `${label}: ${findings.length} clipped element(s)`,
    ...findings.map((f) => `  ${f.axis} +${f.overflowBy}px  ${f.path}\n    "${f.text}"`),
  ].join('\n');
}

test.describe('Russian copy fits the layout', () => {
  test('the audit notices clipping, and ignores a deliberate ellipsis', async ({ page }) => {
    // Checking the checker. An audit that only ever reports "clean" is
    // indistinguishable from one that is broken, and this one has four skip
    // rules that could each swallow a real finding.
    await useRussian(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => {
      const clipped = document.createElement('div');
      clipped.id = 'audit-probe';
      clipped.style.cssText = 'width:40px;overflow:hidden;white-space:nowrap;font-size:14px';
      clipped.textContent = 'Очень длинная надпись на кнопке';

      const ellipsised = document.createElement('div');
      ellipsised.style.cssText =
        'width:40px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:14px';
      ellipsised.textContent = 'Точно такая же длинная надпись';

      document.body.append(clipped, ellipsised);
    });

    const findings = await findClippedText(page);
    const probe = findings.filter((f) => f.text.startsWith('Очень длинная'));
    expect(probe, 'the audit missed text clipped by overflow:hidden').toHaveLength(1);
    expect(probe[0].axis).toBe('horizontal');

    const ellipsis = findings.filter((f) => f.text.startsWith('Точно такая'));
    expect(ellipsis, 'a deliberate ellipsis was reported as a defect').toHaveLength(0);
  });

  test('homepage', async ({ page }) => {
    await useRussian(page);
    const home = new HomePage(page);
    await home.goto();
    await expect(page.getByTestId('brand-logo')).toBeVisible();
    await page.waitForLoadState('networkidle');

    const shipped = await findClippedText(page);
    expect(report('homepage, as shipped', shipped), report('homepage, as shipped', shipped)).toBe(
      'homepage, as shipped: nothing clipped',
    );

    const grown = await inflateText(page);
    expect(grown, 'the stress pass inflated no text, so it proved nothing').toBeGreaterThan(10);
    await page.waitForTimeout(150);
    console.log(report('homepage, +40% text', await findClippedText(page)));
  });

  test('classroom', async ({ page }) => {
    await useRussian(page);
    await seedClassroom(page);

    const classroom = new ClassroomPage(page);
    await classroom.goto(TEST_STAGE_ID);
    await classroom.waitForLoaded();
    await expect(classroom.sidebarScenes).toHaveCount(3, { timeout: 10_000 });

    const shipped = await findClippedText(page);
    expect(report('classroom, as shipped', shipped), report('classroom, as shipped', shipped)).toBe(
      'classroom, as shipped: nothing clipped',
    );

    const grown = await inflateText(page);
    expect(grown, 'the stress pass inflated no text, so it proved nothing').toBeGreaterThan(10);
    await page.waitForTimeout(150);
    console.log(report('classroom, +40% text', await findClippedText(page)));
  });

  test('settings dialog', async ({ page }) => {
    await useRussian(page);
    const home = new HomePage(page);
    await home.goto();
    await expect(page.getByTestId('brand-logo')).toBeVisible();

    // Settings is the densest surface in the product and the one where the
    // longest Russian strings live (provider hints, Token Plan copy).
    await page.getByRole('button', { name: 'Настройки' }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.waitForTimeout(400);

    const shipped = await findClippedText(page, '[role="dialog"]');
    expect(report('settings, as shipped', shipped), report('settings, as shipped', shipped)).toBe(
      'settings, as shipped: nothing clipped',
    );
  });
});

import { test, expect } from '../fixtures/base';
import { ClassroomPage } from '../pages/classroom.page';
import { HomePage } from '../pages/home.page';
import { seedClassroom, TEST_STAGE_ID } from '../fixtures/seed-classroom';

/**
 * Appearance baselines for the three surfaces a rebrand is judged on: the
 * homepage, the classroom, and the gate shown before anyone is let in.
 *
 * These are the only tests in the suite that assert on pixels, and that is the
 * point — every other spec would keep passing if the logo vanished, the theme
 * tokens stopped resolving, or Cyrillic fell back to an OS font mid-word.
 *
 * Both themes are captured, because a palette change that reads well in light
 * mode and is unreadable in dark mode is the normal way this breaks.
 *
 * Tolerance is `maxDiffPixels`, not a ratio. The ratio these started with
 * (0.01) allowed 9216 differing pixels on a 1280x720 shot — enough to absorb
 * the entire interface switching from English to Russian without failing, which
 * is one of the changes these baselines exist to notice. 120 pixels absorbs
 * antialiasing and nothing that has meaning.
 *
 * Two things move between runs and are masked rather than tolerated: the
 * Next.js dev-server overlay (which does not exist in the production build CI
 * screenshots) and the interactive-mode toggle, whose glow never settles.
 * Pixels alone still cannot reliably tell a copy change from render jitter, so
 * the locale is also asserted as text below — the pixels guard layout, the text
 * guards language.
 *
 * Refreshing baselines after an intentional visual change:
 *   pnpm test:e2e -- brand-appearance --update-snapshots
 *
 * Baselines are per-platform (`…-chromium-win32.png`, `…-chromium-linux.png`):
 * font rasterisation differs enough between Windows and Linux that one set
 * cannot serve both. The set committed here was generated on Windows; CI on
 * Linux writes its own on first run, and both sets belong in the repo.
 */

/**
 * Pin the theme and the language before the app boots, so nothing repaints
 * mid-screenshot.
 *
 * The locale is pinned to the shipping default rather than left to the test
 * browser: these baselines are what this deployment actually looks like, and
 * Russian copy is 10-15% longer than English, which is exactly the kind of
 * overflow a pixel baseline is here to catch.
 */
async function useTheme(page: import('@playwright/test').Page, theme: 'light' | 'dark') {
  await page.addInitScript((value) => {
    localStorage.setItem('theme', value);
    localStorage.setItem('locale', 'ru-RU');
  }, theme);
}

/**
 * The homepage animates its hero in on every load (motion springs on the
 * lockup, staggered fades below). `animations: 'disabled'` fast-forwards CSS
 * animations, but the JS-driven springs settle on their own — waiting for the
 * logo to stop moving is what makes the byte comparison stable.
 */
async function settle(page: import('@playwright/test').Page) {
  await page.waitForLoadState('networkidle');
  await expect(page.getByTestId('brand-logo')).toBeVisible();
  await page.waitForTimeout(1200);
}

/**
 * The one element that never holds still: the interactive-mode toggle, whose
 * glow animates continuously. The dev-server overlay used to be here too, until
 * `devIndicators: false` removed it — it was the largest source of noise and it
 * does not exist in the production build CI screenshots anyway.
 */
function movingParts(page: import('@playwright/test').Page) {
  return [page.getByRole('button', { name: /Интерактивный режим/ })];
}

test.describe('brand appearance', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`homepage — ${theme}`, async ({ page }) => {
      await useTheme(page, theme);
      const home = new HomePage(page);
      await home.goto();
      await settle(page);

      // The assertion pixels cannot make reliably: that the shipping default
      // language is what actually rendered.
      await expect(page.locator('html')).toHaveAttribute('lang', 'ru-RU');
      await expect(
        page.getByText('Генеративное обучение в мультиагентном интерактивном классе'),
      ).toBeVisible();

      await expect(page).toHaveScreenshot(`home-${theme}.png`, {
        fullPage: false,
        animations: 'disabled',
        // Each test gets a fresh browser context, so the greeting shows the
        // default nickname and the recent-classroom strip is empty — nothing
        // here varies between runs and nothing needs masking.
        mask: movingParts(page),
        maxDiffPixels: 120,
      });
    });
  }

  test('access-code gate', async ({ page }) => {
    await useTheme(page, 'light');
    // The gate only renders when the deployment sets ACCESS_CODE. Rather than
    // restarting the server with it set, answer the status probe the way a
    // gated deployment would.
    await page.route('**/api/access-code/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, enabled: true, authenticated: false }),
      }),
    );

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const dialog = page.getByRole('textbox').first();
    await expect(dialog).toBeVisible();
    await page.waitForTimeout(800);

    await expect(page).toHaveScreenshot('access-code-gate.png', {
      animations: 'disabled',
      mask: movingParts(page),
      maxDiffPixels: 120,
    });
  });

  test('classroom — light', async ({ page }) => {
    await useTheme(page, 'light');
    await seedClassroom(page);

    const classroom = new ClassroomPage(page);
    await classroom.goto(TEST_STAGE_ID);
    await classroom.waitForLoaded();
    await expect(classroom.sidebarScenes).toHaveCount(3, { timeout: 10_000 });
    await page.waitForTimeout(1200);

    await expect(page).toHaveScreenshot('classroom-light.png', {
      animations: 'disabled',
      mask: movingParts(page),
      maxDiffPixels: 120,
    });
  });
});

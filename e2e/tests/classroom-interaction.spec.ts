import { test, expect } from '../fixtures/base';
import { ClassroomPage } from '../pages/classroom.page';
import { seedClassroom, TEST_STAGE_ID } from '../fixtures/seed-classroom';

test.describe('Classroom Interaction', () => {
  test.beforeEach(async ({ page }) => {
    await seedClassroom(page);
  });

  test('loads classroom and switches scenes', async ({ page }) => {
    const classroom = new ClassroomPage(page);
    await classroom.goto(TEST_STAGE_ID);
    await classroom.waitForLoaded();

    // Sidebar shows 3 scenes
    await expect(classroom.sidebarScenes).toHaveCount(3, { timeout: 10_000 });

    // First scene title visible
    await expect(classroom.getSceneTitle(0)).toContainText('基本概念');

    // Click second scene
    await classroom.clickScene(1);

    // Verify second scene is now active — heading in the top bar shows the current scene name
    await expect(page.getByRole('heading', { name: '光反应' })).toBeVisible();
  });

  test('caps and restores the non-presentation roundtable draft height', async ({ page }) => {
    const classroom = new ClassroomPage(page);
    await classroom.goto(TEST_STAGE_ID);
    await classroom.waitForLoaded();

    await page.keyboard.press('T');
    const textarea = page.getByPlaceholder('Type your message...', { exact: true });
    const inputStage = page.getByTestId('roundtable-non-presentation-input-stage');
    await expect(textarea).toBeVisible();

    const readMetrics = () =>
      textarea.evaluate((element) => {
        const computedStyle = getComputedStyle(element);
        const containingPanel = element.closest<HTMLElement>(
          '[data-testid="roundtable-non-presentation-input-panel"]',
        );
        if (!containingPanel) {
          throw new Error('Could not find the non-presentation roundtable input panel');
        }

        const overflowHiddenCard = containingPanel.closest<HTMLElement>(
          '[data-testid="roundtable-non-presentation-card"]',
        );
        if (!overflowHiddenCard) {
          throw new Error('Could not find the roundtable overflow-hidden card');
        }

        const cardStyle = getComputedStyle(overflowHiddenCard);
        if (
          cardStyle.overflow !== 'hidden' ||
          cardStyle.overflowX !== 'hidden' ||
          cardStyle.overflowY !== 'hidden'
        ) {
          throw new Error('The roundtable clipping card must hide overflow');
        }

        const panelRect = containingPanel.getBoundingClientRect();
        const cardRect = overflowHiddenCard.getBoundingClientRect();
        return {
          computedHeight: computedStyle.height,
          computedMaxHeight: computedStyle.maxHeight,
          computedOverflowY: computedStyle.overflowY,
          computedFieldSizing: computedStyle.getPropertyValue('field-sizing'),
          inlineHeight: element.style.height,
          inlineFieldSizing: element.style.getPropertyValue('field-sizing'),
          boundingRectHeight: element.getBoundingClientRect().height,
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
          containingPanelHeight: panelRect.height,
          panelTop: panelRect.top,
          cardTop: cardRect.top,
          cardHeight: cardRect.height,
          cardOverflow: cardStyle.overflow,
        };
      });

    await expect(inputStage).toHaveCSS('transform', 'none');
    const initialMetrics = await readMetrics();
    const longDraft = Array.from({ length: 24 }, (_, index) => `Line ${index + 1}`).join('\n');

    await textarea.fill(longDraft);
    await expect.poll(async () => (await readMetrics()).inlineHeight).toBe('100px');
    const longDraftMetrics = await readMetrics();

    await test.info().attach('roundtable textarea pre-post metrics', {
      body: JSON.stringify({ initialMetrics, longDraftMetrics }, null, 2),
      contentType: 'application/json',
    });

    const metricSummary = JSON.stringify({ initialMetrics, longDraftMetrics });
    expect(
      longDraftMetrics.panelTop,
      `Roundtable input panel must stay inside its overflow-hidden card: ${metricSummary}`,
    ).toBeGreaterThanOrEqual(longDraftMetrics.cardTop);
    expect(longDraftMetrics.cardOverflow).toBe('hidden');
    expect(
      longDraftMetrics.computedFieldSizing,
      `Roundtable textarea metrics: ${metricSummary}`,
    ).not.toBe('content');
    expect(
      longDraftMetrics.inlineFieldSizing,
      `Roundtable textarea metrics: ${metricSummary}`,
    ).toBe('');
    expect(longDraftMetrics.inlineHeight).toBe('100px');
    expect(longDraftMetrics.computedMaxHeight).toBe('100px');
    expect(longDraftMetrics.computedOverflowY).toBe('auto');
    expect(longDraftMetrics.boundingRectHeight).toBeLessThanOrEqual(100);
    expect(longDraftMetrics.scrollHeight).toBeGreaterThan(longDraftMetrics.clientHeight);

    await textarea.fill('Short line');
    await expect
      .poll(async () => (await readMetrics()).clientHeight)
      .toBeLessThan(longDraftMetrics.clientHeight);
    await expect.poll(async () => (await readMetrics()).inlineHeight).not.toBe('100px');

    await textarea.fill(longDraft);
    await page.keyboard.press('Escape');
    await expect(textarea).toBeHidden();

    await page.keyboard.press('T');
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveValue(longDraft);
    await expect.poll(async () => (await readMetrics()).inlineHeight).toBe('100px');
  });

  test('keeps body spacing stable for header menus and settings modal', async ({ page }) => {
    const classroom = new ClassroomPage(page);
    await classroom.goto(TEST_STAGE_ID);
    await classroom.waitForLoaded();

    const initialBodySpacing = await page.evaluate(() => {
      const styles = getComputedStyle(document.body);
      return {
        paddingRight: styles.paddingRight,
        marginRight: styles.marginRight,
      };
    });

    const expectBodyScrollState = async (locked: boolean) => {
      await expect
        .poll(() =>
          page.evaluate(() => ({
            locked: document.body.hasAttribute('data-scroll-locked'),
            paddingRight: getComputedStyle(document.body).paddingRight,
            marginRight: getComputedStyle(document.body).marginRight,
          })),
        )
        .toEqual({
          locked,
          paddingRight: initialBodySpacing.paddingRight,
          marginRight: initialBodySpacing.marginRight,
        });
    };

    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: 'English' })).toBeVisible();
    await expectBodyScrollState(false);

    await page.keyboard.press('Escape');
    await expect(page.getByRole('menuitem', { name: 'English' })).toBeHidden();

    await page.getByRole('button', { name: 'Theme' }).click();
    await expect(page.getByRole('menuitem', { name: 'Light' })).toBeVisible();
    await expectBodyScrollState(false);

    await page.keyboard.press('Escape');
    await expect(page.getByRole('menuitem', { name: 'Light' })).toBeHidden();

    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
    await expectBodyScrollState(true);
  });
});

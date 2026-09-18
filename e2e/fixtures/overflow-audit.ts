import type { Page } from '@playwright/test';

/**
 * Finds text that the layout is cutting off.
 *
 * Russian runs 10-15% longer than English and up to ~40% on short labels
 * (*Save* becomes *Сохранить*), so a button or tab sized around English copy
 * clips. Reading every screen by eye does not find this reliably; measuring
 * the rendered boxes does.
 *
 * Deliberate truncation is not a finding. A name in a list is SUPPOSED to end
 * in an ellipsis, so anything that opted into `text-overflow: ellipsis` or a
 * line clamp is excluded. What is reported is content clipped by an
 * `overflow: hidden` that shows no ellipsis — the caller asked for a box that
 * fits and did not get one.
 */
export interface OverflowFinding {
  /** Best-effort CSS path, for locating the element in source. */
  path: string;
  /** What is being cut off, trimmed. */
  text: string;
  axis: 'horizontal' | 'vertical';
  overflowBy: number;
}

/**
 * Horizontal overshoot to ignore. Text that does not fit its line is cut off
 * at once, so the bar is low — a couple of pixels of sub-pixel rounding.
 */
const HORIZONTAL_TOLERANCE = 2;

/**
 * Vertical overshoot is reported only when at least this share of a line is
 * lost. A few pixels below a paragraph is line-box rounding and is invisible;
 * half a line missing is a cut-off sentence.
 */
const VERTICAL_LINE_SHARE = 0.5;

/**
 * @param rootSelector limits the audit to one subtree. Pass the dialog when one
 * is open: the page behind a modal is inert and re-measures oddly while the
 * modal removes the page scrollbar, and reporting it says nothing about the
 * surface under test.
 */
export async function findClippedText(
  page: Page,
  rootSelector?: string,
): Promise<OverflowFinding[]> {
  return page.evaluate(
    ({ horizontalTolerance, verticalLineShare, root }) => {
      const findings: OverflowFinding[] = [];

      const describe = (element: Element): string => {
        const parts: string[] = [];
        let node: Element | null = element;
        for (let depth = 0; node && depth < 4; depth += 1) {
          const testId = node.getAttribute('data-testid');
          if (testId) {
            parts.unshift(`[data-testid="${testId}"]`);
            break;
          }
          const classes = (node.getAttribute('class') ?? '')
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .join('.');
          parts.unshift(
            classes ? `${node.tagName.toLowerCase()}.${classes}` : node.tagName.toLowerCase(),
          );
          node = node.parentElement;
          depth += 1;
        }
        return parts.join(' > ');
      };

      const scope = root ? document.querySelector(root) : document.body;
      if (!scope) throw new Error(`overflow audit: no element matches ${root}`);

      for (const element of Array.from(scope.querySelectorAll('*'))) {
        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        // A label that is collapsed until hover (`opacity-0` + zero width) is
        // "clipped" at rest by design. Nothing the user can see is being cut.
        if (Number(style.opacity) === 0) continue;
        // Screen-reader-only text (Radix renders every dialog a title and a
        // description this way) is a 1px box with `overflow: hidden` on purpose.
        // It is not shown, so it cannot be cut off.
        if (element.clientWidth <= 1 || element.clientHeight <= 1) continue;

        // Deliberate: an ellipsis or a clamp IS the design.
        if (style.textOverflow === 'ellipsis') continue;
        if (style.webkitLineClamp && style.webkitLineClamp !== 'none') continue;

        const text = (element.textContent ?? '').trim();
        if (!text) continue;
        // Only leaf-ish nodes: a clipped parent is reported through its child.
        if (element.children.length > 2) continue;

        const lineHeight =
          Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) || 16;
        const horizontallyClipped =
          (style.overflowX === 'hidden' || style.overflowX === 'clip') &&
          element.scrollWidth - element.clientWidth > horizontalTolerance;
        const verticallyClipped =
          (style.overflowY === 'hidden' || style.overflowY === 'clip') &&
          element.scrollHeight - element.clientHeight > lineHeight * verticalLineShare;

        if (horizontallyClipped) {
          findings.push({
            path: describe(element),
            text: text.slice(0, 60),
            axis: 'horizontal',
            overflowBy: element.scrollWidth - element.clientWidth,
          });
        } else if (verticallyClipped) {
          findings.push({
            path: describe(element),
            text: text.slice(0, 60),
            axis: 'vertical',
            overflowBy: element.scrollHeight - element.clientHeight,
          });
        }
      }

      return findings;
    },
    {
      horizontalTolerance: HORIZONTAL_TOLERANCE,
      verticalLineShare: VERTICAL_LINE_SHARE,
      root: rootSelector,
    },
  );
}

/**
 * Grows every text node by roughly `factor`, in place.
 *
 * A stand-in for "the next language, or the next translator, is wordier than
 * this one". Русский уже длиннее английского; this asks whether the layout has
 * any headroom left after that, which is the question a fixed-width button
 * answers badly.
 *
 * Interpolated values are left alone — only the words around them grow — so a
 * count or a name keeps its real width.
 */
export async function inflateText(page: Page, factor = 1.4): Promise<number> {
  return page.evaluate((grow) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);

    let inflated = 0;
    for (const node of nodes) {
      const value = node.nodeValue ?? '';
      const trimmed = value.trim();
      if (trimmed.length < 2) continue;
      if (node.parentElement && ['SCRIPT', 'STYLE'].includes(node.parentElement.tagName)) continue;

      const extra = Math.max(1, Math.round(trimmed.length * (grow - 1)));
      node.nodeValue = `${value}${'ш'.repeat(extra)}`;
      inflated += 1;
    }
    // Returned so the caller can assert the stress pass actually stressed
    // something: "nothing clipped" after inflating zero nodes means nothing.
    return inflated;
  }, factor);
}

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_KATEX_BASE,
  parseActionsFromStructuredOutput,
  postProcessInteractiveHtml,
} from '@openmaic/generation';

describe('action parser', () => {
  it('repairs malformed structured output and preserves interleaving', () => {
    const actions = parseActionsFromStructuredOutput(
      '[{"type":"text","content":"Start"},{"type":"action","name":"widget_setState","params":{}}',
      'interactive',
      ['widget_setState'],
    );
    expect(actions).toEqual([
      expect.objectContaining({ type: 'speech', text: 'Start' }),
      expect.objectContaining({ type: 'widget_setState', state: {} }),
    ]);
  });

  it('filters slide-only actions from non-slide scenes', () => {
    expect(
      parseActionsFromStructuredOutput(
        '[{"type":"action","name":"spotlight","params":{"elementId":"x"}}]',
        'quiz',
      ),
    ).toEqual([]);
  });
});

describe('interactive HTML post-processing', () => {
  it('converts math, protects scripts, and injects KaTeX once', () => {
    const source =
      '<html><head></head><body>$x+1$<script>const price = "$5";</script></body></html>';
    const once = postProcessInteractiveHtml(source);
    const twice = postProcessInteractiveHtml(once);
    expect(once).toContain('\\(x+1\\)');
    expect(once).toContain('const price = "$5";');
    expect(once).toContain('katex.min.css');
    expect(twice.match(/katex\.min\.css/g) ?? []).toHaveLength(1);
  });

  it('loads the KaTeX runtime from the app, never from a CDN', () => {
    // The injected tags used to point at cdn.jsdelivr.net, so on a
    // network-isolated deployment every formula in every generated scene
    // rendered as raw `$...$` — in the app, not only in exports.
    const out = postProcessInteractiveHtml('<html><head></head><body>$x$</body></html>');

    expect(out).not.toMatch(/https?:\/\//);
    expect(out).toContain(`${DEFAULT_KATEX_BASE}/katex.min.css`);
    expect(out).toContain(`${DEFAULT_KATEX_BASE}/katex.min.js`);
    expect(out).toContain(`${DEFAULT_KATEX_BASE}/auto-render.min.js`);
  });

  it('lets a host serving the runtime elsewhere say so', () => {
    const out = postProcessInteractiveHtml('<html><head></head><body>$x$</body></html>', {
      katexBase: 'https://assets.internal.test/katex/',
    });

    expect(out).toContain('https://assets.internal.test/katex/katex.min.js');
    // The trailing slash must not survive into a doubled path.
    expect(out).not.toContain('katex//');
  });
});

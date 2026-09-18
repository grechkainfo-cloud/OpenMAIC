import { describe, expect, it } from 'vitest';

import { inlineHtmlAssets } from '@/lib/export/inline-assets';

/**
 * Generated interactive scenes load the app's own vendored KaTeX runtime by
 * root-relative path. Before relative resolution, the exporter skipped those
 * references silently — no fetch, no reported failure — and the exported HTML
 * kept a path that resolves to nothing once the file leaves the app. Every
 * formula in an exported scene then rendered as raw `$...$`.
 */
const BASE = 'https://classroom.example.test/classroom/abc';

/**
 * Records WHICH urls were requested, not how many times: the real fetcher
 * caches, and an absolute reference is requested twice (once by the parallel
 * pre-warm, once by the rewrite) while a relative one is requested once,
 * because the pre-warm pass does not resolve relative urls. That asymmetry
 * costs a little parallelism and nothing else.
 */
function stubFetcher(seen: Set<string>) {
  return async (url: string) => {
    seen.add(url);
    return { bytes: new TextEncoder().encode('/*stub*/'), contentType: 'text/javascript' };
  };
}

describe('inlineHtmlAssets with relative references', () => {
  it('inlines a root-relative script against the base', async () => {
    const seen = new Set<string>();
    const { html, report } = await inlineHtmlAssets(
      '<html><head><script src="/vendor/katex/katex.min.js"></script></head><body>x</body></html>',
      { fetcher: stubFetcher(seen), baseUrl: BASE },
    );

    expect([...seen]).toEqual(['https://classroom.example.test/vendor/katex/katex.min.js']);
    expect(report.inlined).toContain('https://classroom.example.test/vendor/katex/katex.min.js');
    expect(html).toContain('data:text/javascript;base64,');
    expect(html).not.toContain('/vendor/katex/katex.min.js');
  });

  it('inlines a document-relative reference too', async () => {
    const seen = new Set<string>();
    await inlineHtmlAssets('<html><body><img src="pic.png"></body></html>', {
      fetcher: stubFetcher(seen),
      baseUrl: BASE,
    });

    expect([...seen]).toEqual(['https://classroom.example.test/classroom/pic.png']);
  });

  it('leaves data: and blob: references alone', async () => {
    const seen = new Set<string>();
    const { html } = await inlineHtmlAssets(
      '<html><body><img src="data:image/png;base64,AAAA"><img src="blob:x"></body></html>',
      { fetcher: stubFetcher(seen), baseUrl: BASE },
    );

    expect([...seen]).toEqual([]);
    expect(html).toContain('data:image/png;base64,AAAA');
    expect(html).toContain('blob:x');
  });

  it('still inlines absolute references, base or no base', async () => {
    const seen = new Set<string>();
    await inlineHtmlAssets(
      '<html><head><script src="https://cdn.example.test/a.js"></script></head></html>',
      { fetcher: stubFetcher(seen), baseUrl: BASE },
    );
    expect([...seen]).toEqual(['https://cdn.example.test/a.js']);
  });

  it('skips relative references when there is no base, as it always did', async () => {
    // A non-browser caller has no document to resolve against. Skipping is the
    // old behaviour and is better than guessing an origin.
    const seen = new Set<string>();
    const { html } = await inlineHtmlAssets(
      '<html><head><script src="/vendor/katex/katex.min.js"></script></head></html>',
      { fetcher: stubFetcher(seen), baseUrl: undefined },
    );

    expect([...seen]).toEqual([]);
    expect(html).toContain('/vendor/katex/katex.min.js');
  });

  it('resolves a relative stylesheet and the url() references inside it', async () => {
    const seen = new Set<string>();
    const { html } = await inlineHtmlAssets(
      '<html><head><link rel="stylesheet" href="/vendor/katex/katex.min.css"></head></html>',
      {
        baseUrl: BASE,
        fetcher: async (url) => {
          seen.add(url);
          const body = url.endsWith('.css')
            ? '@font-face{font-family:KaTeX;src:url(/vendor/video-export/fonts/KaTeX_Main-Regular.woff2) format("woff2")}'
            : 'FONTBYTES';
          return {
            bytes: new TextEncoder().encode(body),
            contentType: url.endsWith('.css') ? 'text/css' : 'font/woff2',
          };
        },
      },
    );

    expect([...seen]).toEqual([
      'https://classroom.example.test/vendor/katex/katex.min.css',
      'https://classroom.example.test/vendor/video-export/fonts/KaTeX_Main-Regular.woff2',
    ]);
    expect(html).toContain('<style');
    expect(html).toContain('data:font/woff2;base64,');
  });
});

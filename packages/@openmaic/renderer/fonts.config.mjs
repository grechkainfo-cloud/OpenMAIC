/**
 * Single source of truth for the font families the renderer declares
 * `@font-face` rules for. `fonts.css` is GENERATED from this file by
 * `scripts/generate-fonts-css.mjs` — edit the config here, then run
 * `pnpm run genfonts` (the build does this automatically).
 *
 * The list is EMPTY, on purpose.
 *
 * Upstream declared six self-hosted Chinese faces fetched from an object
 * storage origin (`https://file.maic.chat/fonts/<name>.woff2`). This
 * deployment runs in a network-isolated environment where that origin is
 * unreachable, so every one of those rules was a font that could never load:
 * the browser would stall on the fetch and then fall back anyway. They served
 * only slides imported from Chinese `.pptx`, which this deployment does not
 * handle.
 *
 * `src` is a required field rather than something derived from a base URL, so
 * re-adding a family forces a decision about where the bytes actually come
 * from. Use a path this app serves (for example `/fonts/<name>.woff2`, backed
 * by `public/fonts/`) — not a third-party origin, which would reintroduce the
 * same dead fetch.
 *
 * Re-adding a face also means clearing it for redistribution and recording the
 * attribution in `FONTS.md` first.
 *
 * @typedef {{ family: string, src: string }} FontFamilyEntry
 */

/** @type {readonly FontFamilyEntry[]} */
export const FONT_FAMILIES = [];

#!/usr/bin/env node
/**
 * Copy maic-importer's built bundle to public/vendor/ so the app can
 * load it at runtime via a URL-based dynamic import.
 *
 * Why: the bundle contains dynamic `require()` patterns (from pdfjs-dist)
 * that Turbopack rejects as a hard "Module not found: Can't resolve <dynamic>"
 * error. By serving it as a static asset and importing it via a runtime URL,
 * we bypass the bundler entirely while keeping types via the workspace package.
 *
 * The pdf.js WORKER rides along for a different reason: `mediaWebConvert` used
 * to point `GlobalWorkerOptions.workerSrc` at cdn.jsdelivr.net, which never
 * loads on a network-isolated deployment, so EMF-vector artwork in an imported
 * `.pptx` silently failed to convert. Copying it here rather than committing it
 * keeps a 1.4 MB binary out of git AND guarantees the worker is the exact
 * build of the installed pdfjs-dist — a mismatched pair fails at runtime with
 * a version error.
 */
import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'packages/@openmaic/importer/dist');
const destDir = path.join(root, 'public/vendor/maic-importer');

/** Must match `PDF_WORKER_FILENAME` in @openmaic/importer's mediaWebConvert. */
const PDF_WORKER_FILENAME = 'pdf.worker.min.mjs';

try {
  await stat(srcDir);
} catch {
  console.error(`[sync-maic-importer] missing dist: ${srcDir}`);
  console.error('Run `cd packages/@openmaic/importer && pnpm run build` first.');
  process.exit(1);
}

await rm(destDir, { recursive: true, force: true });
await mkdir(destDir, { recursive: true });
await cp(srcDir, destDir, { recursive: true });

// Resolved from the importer package, not from here: pdfjs-dist is ITS
// dependency, and in a pnpm workspace that means it is not reachable from the
// repo root.
const require = createRequire(path.join(root, 'packages/@openmaic/importer/package.json'));
const pdfjsRoot = path.dirname(require.resolve('pdfjs-dist/package.json'));
const workerSrc = path.join(pdfjsRoot, 'legacy', 'build', 'pdf.worker.min.mjs');
const workerDest = path.join(destDir, PDF_WORKER_FILENAME);

try {
  await stat(workerSrc);
} catch {
  console.error(`[sync-maic-importer] missing pdf.js worker: ${workerSrc}`);
  console.error('pdfjs-dist is a dependency of @openmaic/importer — reinstall to restore it.');
  process.exit(1);
}

await cp(workerSrc, workerDest);

console.log(
  `[sync-maic-importer] copied ${path.relative(root, srcDir)} → ${path.relative(root, destDir)} ` +
    `(+ ${PDF_WORKER_FILENAME} from pdfjs-dist ${require('pdfjs-dist/package.json').version})`,
);

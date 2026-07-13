// Production bundler for the Lester's Arcade portal.
//
// WHY THIS EXISTS
// The portal shipped `apps/portal/main.js` (10.8k lines, ~490 KB raw) as-is to
// browsers. This script produces a minified, tree-shaken, code-split bundle so
// the live payload shrinks dramatically while preserving the app's behavior.
//
// CRITICAL CONSTRAINTS (do not "simplify" away):
//   1. The app resolves ALL art/audio asset URLs as runtime STRING literals
//      (e.g. "./assets/generated/.../00.png") against <base href="/">. These
//      strings must survive the bundle untouched. esbuild only rewrites module
//      `import` specifiers, never string literals, so this is safe — but it is
//      why we must NOT enable any asset loader / `--loader:.png=file`.
//   2. Dynamic import() points (cabinet loaders, litvm-chain-client, generated
//      manifests) are intentional code-split seams. `--splitting` + esm format
//      preserves them as separate lazily-fetched chunks.
//   3. Output goes to apps/portal/dist/ and is served from the SAME site root
//      as the source, so any remaining relative URL resolves identically.
//   4. The build is ADDITIVE and non-destructive: it never edits source files
//      and never deletes main.js. index.html chooses which entry to load.
//
// Usage:
//   node build.mjs            # build minified bundle into apps/portal/dist/
//   node build.mjs --metafile # also write dist/meta.json for bundle analysis
//   node build.mjs --sourcemap # opt into external maps for local profiling

import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { statSync, mkdirSync, rmSync, existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const portalDir = resolve(__dirname, 'apps/portal');
const entry = resolve(portalDir, 'main.js');
const outdir = resolve(portalDir, 'dist');

const wantMeta = process.argv.includes('--metafile');
const wantSourceMap = process.argv.includes('--sourcemap');

function human(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function run() {
  const rawSize = statSync(entry).size;

  // Clean only our own output dir, never source.
  if (existsSync(outdir)) rmSync(outdir, { recursive: true, force: true });
  mkdirSync(outdir, { recursive: true });

  const result = await build({
    entryPoints: { 'main': entry },
    bundle: true,
    splitting: true,        // preserve dynamic import() code-split chunks
    format: 'esm',          // app loads main.js as <script type="module">
    minify: true,
    treeShaking: true,
    target: ['es2020'],
    outdir,
    entryNames: '[name]',   // stable name: dist/main.js (cache-bust via ?v= query)
    chunkNames: 'chunks/[name]-[hash]',
    assetNames: 'assets/[name]-[hash]',
    legalComments: 'none',
    sourcemap: wantSourceMap, // default off for production payload; pass --sourcemap for profiling
    metafile: true,
    logLevel: 'info',
    // Do NOT add file/dataurl loaders: asset URLs are runtime strings, not imports.
  });

  const outMain = resolve(outdir, 'main.js');
  const minSize = statSync(outMain).size;
  const entryDeltaPct = 100 * (minSize / rawSize - 1);

  if (wantMeta) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(resolve(outdir, 'meta.json'), JSON.stringify(result.metafile, null, 2));
  }

  // Report measured bytes (skill rule: quantify, don't intuit).
  const chunkFiles = Object.keys(result.metafile.outputs).filter((f) => !f.endsWith('.map'));
  let totalOut = 0;
  for (const f of chunkFiles) totalOut += statSync(resolve(__dirname, f)).size;

  console.log('\n=== Bundle report ===');
  console.log(`Source main.js:     ${human(rawSize)}`);
  console.log(`Bundled main.js:    ${human(minSize)}  (${entryDeltaPct >= 0 ? '+' : ''}${entryDeltaPct.toFixed(1)}% vs source entry; imports included)`);
  console.log(`Total emitted JS:   ${human(totalOut)} across ${chunkFiles.length} files`);
  console.log(`Output dir:         apps/portal/dist/`);
}

run().catch((err) => {
  console.error('Bundle failed:', err);
  process.exit(1);
});

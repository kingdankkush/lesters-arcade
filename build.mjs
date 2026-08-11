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
import { statSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { assertHmhInitialJsBudget } from './scripts/hmh-reboot-bundle-budget.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const portalDir = resolve(__dirname, 'apps/portal');
const portalEntry = resolve(portalDir, 'main.js');
const hmhRebootEntry = resolve(__dirname, 'apps/hmh-reboot/src/main.mjs');
const chikunEntry = resolve(__dirname, 'apps/chikun/src/main.mjs');
const hmhPixiVendor = resolve(__dirname, 'apps/hmh-reboot/src/pixi-vendor.mjs');
const nodeModulesDir = resolve(__dirname, 'node_modules');
const pixiModule = resolve(nodeModulesDir, 'pixi.js/lib/index.mjs');
const outdir = resolve(portalDir, 'dist');
const HMH_INITIAL_JS_CAP = 1_050_000;

function packageNameFromSpecifier(specifier) {
  return specifier.startsWith('@')
    ? specifier.split('/').slice(0, 2).join('/')
    : specifier.split('/')[0];
}

function importedPackagePath(specifier) {
  const packageName = packageNameFromSpecifier(specifier);
  const packageRoot = resolve(nodeModulesDir, packageName);
  const packageJson = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
  const subpath = specifier.slice(packageName.length).replace(/^\//, '');

  if (subpath) {
    let exported = packageJson.exports?.[`./${subpath}`];
    exported = exported?.import?.default ?? exported?.import ?? exported?.default ?? exported;
    if (typeof exported === 'string') return resolve(packageRoot, exported);
    const direct = resolve(packageRoot, subpath);
    for (const candidate of [direct, `${direct}.mjs`, `${direct}.js`]) {
      if (existsSync(candidate)) return candidate;
    }
  }

  const entry = packageJson.module ?? packageJson.browser ?? packageJson.main ?? 'index.js';
  return resolve(packageRoot, typeof entry === 'string' ? entry : packageJson.main ?? 'index.js');
}

function createHmhPixiPlugin({ externalizeRuntimeImports }) {
  return {
    name: 'hmh-pixi-vendor',
    setup(buildApi) {
      buildApi.onResolve({ filter: /^pixi\.js$/ }, (args) => {
        const importer = args.importer.replaceAll('\\', '/');
        if (externalizeRuntimeImports && importer.includes('/apps/hmh-reboot/src/')) {
          return { path: '../chunks/hmh-pixi.js', external: true };
        }
        return { path: pixiModule };
      });
      buildApi.onResolve({ filter: /^[^./][^:]*$/ }, (args) => {
        const importer = args.importer.replaceAll('\\', '/');
        if (!importer.includes('/node_modules/')) return null;
        return { path: importedPackagePath(args.path) };
      });
    },
  };
}

const wantMeta = process.argv.includes('--metafile');
const wantSourceMap = process.argv.includes('--sourcemap');

function human(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function run() {
  const rawSize = statSync(portalEntry).size;
  const childRawSize = statSync(hmhRebootEntry).size;
  const chikunRawSize = statSync(chikunEntry).size;

  // Clean only our own output dir, never source.
  if (existsSync(outdir)) rmSync(outdir, { recursive: true, force: true });
  mkdirSync(outdir, { recursive: true });

  const result = await build({
    entryPoints: {
      main: portalEntry,
      'hmh-reboot/game': hmhRebootEntry,
      'chikun/game': chikunEntry,
    },
    plugins: [createHmhPixiPlugin({ externalizeRuntimeImports: true })],
    bundle: true,
    splitting: true,        // preserve dynamic import() code-split chunks
    format: 'esm',          // app loads main.js as <script type="module">
    minify: true,
    treeShaking: true,
    target: ['es2020'],
    outdir,
    entryNames: '[dir]/[name]', // stable roots: dist/main.js + dist/hmh-reboot/game.js
    chunkNames: 'chunks/[name]-[hash]',
    assetNames: 'assets/[name]-[hash]',
    legalComments: 'none',
    sourcemap: wantSourceMap, // default off for production payload; pass --sourcemap for profiling
    metafile: true,
    logLevel: 'info',
    // Do NOT add file/dataurl loaders: asset URLs are runtime strings, not imports.
  });

  const vendorResult = await build({
    entryPoints: { 'chunks/hmh-pixi': hmhPixiVendor },
    plugins: [createHmhPixiPlugin({ externalizeRuntimeImports: false })],
    bundle: true,
    splitting: false,
    format: 'esm',
    minify: true,
    treeShaking: true,
    target: ['es2020'],
    outdir,
    entryNames: '[dir]/[name]',
    legalComments: 'none',
    sourcemap: wantSourceMap,
    metafile: true,
    logLevel: 'info',
  });
  const combinedMetafile = {
    inputs: { ...result.metafile.inputs, ...vendorResult.metafile.inputs },
    outputs: { ...result.metafile.outputs, ...vendorResult.metafile.outputs },
  };

  const outMain = resolve(outdir, 'main.js');
  const outChild = resolve(outdir, 'hmh-reboot/game.js');
  const outChikun = resolve(outdir, 'chikun/game.js');
  const outChildVendor = resolve(outdir, 'chunks/hmh-pixi.js');
  const minSize = statSync(outMain).size;
  const childMinSize = statSync(outChild).size;
  const chikunMinSize = statSync(outChikun).size;
  const childVendorSize = statSync(outChildVendor).size;
  const hmhBudget = assertHmhInitialJsBudget({
    entryBytes: childMinSize,
    vendorBytes: childVendorSize,
    cap: HMH_INITIAL_JS_CAP,
  });
  const entryDeltaPct = 100 * (minSize / rawSize - 1);
  const childDeltaPct = 100 * (childMinSize / childRawSize - 1);
  const chikunDeltaPct = 100 * (chikunMinSize / chikunRawSize - 1);

  if (wantMeta) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(resolve(outdir, 'meta.json'), JSON.stringify(combinedMetafile, null, 2));
  }

  // Report measured bytes (skill rule: quantify, don't intuit).
  const chunkFiles = Object.keys(combinedMetafile.outputs).filter((f) => !f.endsWith('.map'));
  let totalOut = 0;
  for (const f of chunkFiles) totalOut += statSync(resolve(__dirname, f)).size;

  console.log('\n=== Bundle report ===');
  console.log(`Source main.js:     ${human(rawSize)}`);
  console.log(`Bundled main.js:    ${human(minSize)}  (${entryDeltaPct >= 0 ? '+' : ''}${entryDeltaPct.toFixed(1)}% vs source entry; imports included)`);
  console.log(`HMH reboot source:  ${human(childRawSize)}`);
  console.log(`HMH reboot entry:   ${human(childMinSize)}  (${childDeltaPct >= 0 ? '+' : ''}${childDeltaPct.toFixed(1)}% vs child source)`);
  console.log(`Chikun source:      ${human(chikunRawSize)}`);
  console.log(`Chikun entry:       ${human(chikunMinSize)}  (${chikunDeltaPct >= 0 ? '+' : ''}${chikunDeltaPct.toFixed(1)}% vs child source)`);
  console.log(`HMH Pixi vendor:    ${human(childVendorSize)}  (stable preloaded module)`);
  console.log(`HMH initial JS:     ${human(hmhBudget.combinedInitialChildBytes)} / ${human(hmhBudget.cap)} raw aggregate`);
  console.log(`HMH headroom:       ${human(hmhBudget.remaining)}`);
  console.log(`Total emitted JS:   ${human(totalOut)} across ${chunkFiles.length} files`);
  console.log(`Output dir:         apps/portal/dist/`);
}

run().catch((err) => {
  console.error('Bundle failed:', err);
  process.exit(1);
});

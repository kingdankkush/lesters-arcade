import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

const bundleBudgetModule = await import('../scripts/hmh-reboot-bundle-budget.mjs').catch(() => ({}));
const vendorStubModule = await import('../scripts/hmh-reboot-pixi-vendor-stubs.mjs').catch(() => ({}));

test('HMH production build enforces the raw entry plus preloaded Pixi aggregate cap', async () => {
  const build = await readFile(new URL('../build.mjs', import.meta.url), 'utf8');
  assert.equal(typeof bundleBudgetModule.assertHmhInitialJsBudget, 'function', 'aggregate budget helper must exist');
  assert.match(build, /HMH_INITIAL_JS_CAP\s*=\s*1_050_000/);
  assert.match(build, /assertHmhInitialJsBudget\(/);

  // Cycle 074: the helper now also reports the honest total that includes the
  // hoisted shared chunks game.js imports statically. With none declared the
  // two totals coincide, so the Cycle 05x fixture keeps its values.
  assert.deepEqual(bundleBudgetModule.assertHmhInitialJsBudget({ entryBytes: 320_000, vendorBytes: 700_000 }), {
    cap: 1_050_000,
    combinedInitialChildBytes: 1_020_000,
    entryBytes: 320_000,
    initialChildBytesWithSharedChunks: 1_020_000,
    remaining: 30_000,
    remainingWithSharedChunks: 30_000,
    sharedChunkBytes: 0,
    vendorBytes: 700_000,
  });
  assert.throws(
    () => bundleBudgetModule.assertHmhInitialJsBudget({ entryBytes: 321_272, vendorBytes: 730_790 }),
    /HMH initial JS exceeds raw aggregate cap: 1,052,062 > 1,050,000/,
  );
});

test('Cycle 074 honest accounting: hoisted shared chunks the child imports statically count toward the same cap', () => {
  // Cycle 073 shipped entry 444,168 + vendor 575,891 = 1,020,059 under the
  // entry+vendor gate while dist/hmh-reboot/game.js also statically imported
  // 63,871 + 655 bytes of hoisted shared chunks (portal-shared sdk/audio/
  // progression modules). The true initial child JS was 1,084,585 and the
  // helper never saw it. Both totals are reported and both are capped, so code
  // can no longer leave the count by moving into a portal-shared module.
  assert.deepEqual(bundleBudgetModule.assertHmhInitialJsBudget({ entryBytes: 444_168, vendorBytes: 500_000, sharedChunkBytes: 64_526 }), {
    cap: 1_050_000,
    combinedInitialChildBytes: 944_168,
    entryBytes: 444_168,
    initialChildBytesWithSharedChunks: 1_008_694,
    remaining: 105_832,
    remainingWithSharedChunks: 41_306,
    sharedChunkBytes: 64_526,
    vendorBytes: 500_000,
  });
  assert.throws(
    () => bundleBudgetModule.assertHmhInitialJsBudget({ entryBytes: 444_168, vendorBytes: 575_891, sharedChunkBytes: 64_526 }),
    /HMH initial JS including shared chunks exceeds raw aggregate cap: 1,084,585 > 1,050,000/,
  );
  assert.throws(
    () => bundleBudgetModule.assertHmhInitialJsBudget({ entryBytes: 1, vendorBytes: 1, sharedChunkBytes: -1 }),
    /sharedChunkBytes must be a non-negative safe integer/,
  );
});

test('Cycle 074 static chunk walker sums every transitively static, non-external import of the child entry and ignores lazy chunks', () => {
  assert.equal(typeof bundleBudgetModule.sumStaticChunkBytes, 'function', 'static chunk walker must exist');
  const metafile = {
    outputs: {
      'apps/portal/dist/hmh-reboot/game.js': {
        bytes: 1000,
        imports: [
          { path: 'apps/portal/dist/chunks/chunk-A.js', kind: 'import-statement' },
          { path: 'apps/portal/dist/chunks/chunk-B.js', kind: 'import-statement' },
          { path: '../chunks/hmh-pixi.js', kind: 'import-statement', external: true },
          { path: 'apps/portal/dist/chunks/lazy-C.js', kind: 'dynamic-import' },
        ],
      },
      'apps/portal/dist/chunks/chunk-A.js': {
        bytes: 500,
        imports: [
          { path: 'apps/portal/dist/chunks/chunk-D.js', kind: 'import-statement' },
          { path: 'apps/portal/dist/chunks/chunk-B.js', kind: 'import-statement' },
        ],
      },
      'apps/portal/dist/chunks/chunk-B.js': { bytes: 40, imports: [] },
      'apps/portal/dist/chunks/chunk-D.js': {
        bytes: 7,
        imports: [{ path: 'apps/portal/dist/chunks/lazy-C.js', kind: 'dynamic-import' }],
      },
      'apps/portal/dist/chunks/lazy-C.js': { bytes: 9000, imports: [] },
    },
  };
  assert.deepEqual(bundleBudgetModule.sumStaticChunkBytes({ metafile, entryOutput: 'apps/portal/dist/hmh-reboot/game.js' }), {
    bytes: 547,
    chunks: [
      { path: 'apps/portal/dist/chunks/chunk-A.js', bytes: 500 },
      { path: 'apps/portal/dist/chunks/chunk-B.js', bytes: 40 },
      { path: 'apps/portal/dist/chunks/chunk-D.js', bytes: 7 },
    ],
  });
  assert.throws(
    () => bundleBudgetModule.sumStaticChunkBytes({ metafile, entryOutput: 'missing.js' }),
    /entry output missing\.js is not in the metafile/,
  );
});

test('Cycle 074 build.mjs feeds the hoisted shared chunks into the budget and reports both totals', async () => {
  const build = await readFile(new URL('../build.mjs', import.meta.url), 'utf8');
  assert.match(build, /sumStaticChunkBytes\(\{/);
  assert.match(build, /sharedChunkBytes:\s*hmhSharedChunks\.bytes/);
  assert.match(build, /HMH shared chunks:/);
  assert.match(build, /HMH initial JS \+ shared:/);
});

test('HMH Pixi vendor uses tree-shakeable library modules instead of the monolithic dist bundle', async () => {
  const build = await readFile(new URL('../build.mjs', import.meta.url), 'utf8');
  assert.match(build, /pixi\.js[\\/]lib[\\/]index\.mjs/);
  assert.doesNotMatch(build, /pixi\.js[\\/]dist[\\/]pixi\.mjs/);
});

test('HMH Pixi vendor is one standalone preloaded file with no hidden static chunks', async () => {
  const build = await readFile(new URL('../build.mjs', import.meta.url), 'utf8');
  const vendorBuild = build.slice(build.indexOf('const vendorResult = await build'), build.indexOf('const combinedMetafile'));
  assert.match(vendorBuild, /splitting:\s*false/);
  assert.match(vendorBuild, /entryPoints:\s*\{\s*'chunks\/hmh-pixi':\s*hmhPixiVendor\s*\}/);
  assert.doesNotMatch(vendorBuild, /chunkNames:/, 'standalone vendor build must not emit hidden static chunks');
});

test('HMH Pixi is a stable preloaded child vendor chunk instead of consuming the capped game entry', async () => {
  const [build, shell] = await Promise.all([
    readFile(new URL('../build.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../apps/portal/hmh-reboot/index.html', import.meta.url), 'utf8'),
  ]);
  assert.match(build, /'chunks\/hmh-pixi': hmhPixiVendor/);
  assert.match(build, /path:\s*'\.\.\/chunks\/hmh-pixi\.js',\s*external:\s*true/);
  assert.match(shell, /rel="modulepreload" href="\.\.\/dist\/chunks\/hmh-pixi\.js"/);
});

test('Cycle 074 vendor trim: the Pixi subsystems the child never uses are stubbed at resolve time, nothing else', async () => {
  const build = await readFile(new URL('../build.mjs', import.meta.url), 'utf8');
  const stubs = vendorStubModule.HMH_PIXI_VENDOR_STUBS;
  assert.equal(typeof vendorStubModule.createHmhPixiStubResolver, 'function', 'stub resolver factory must exist');
  assert.ok(stubs && typeof stubs === 'object', 'stub table must exist');
  // pixi.js/lib/index.mjs side-effect-imports every subsystem, and the vendor
  // build is splitting:false, so the renderers autoDetectRenderer would lazy
  // load are inlined. The child pins preference 'webgl', uses DOM input (no
  // Pixi pointer events), no filters, no Pixi accessibility overlay.
  assert.deepEqual(Object.keys(stubs).sort(), [
    'accessibility/init.mjs',
    'events/init.mjs',
    'filters/init.mjs',
    'rendering/renderers/canvas/CanvasRenderer.mjs',
    'rendering/renderers/gpu/WebGPURenderer.mjs',
  ]);
  // Kept on purpose: the WebGL renderer, rendering/init.mjs (the stencil mask
  // path the terrain ramps and road surface use), spritesheet and dom inits.
  for (const kept of ['rendering/init.mjs', 'rendering/renderers/gl/WebGLRenderer.mjs', 'spritesheet/init.mjs', 'dom/init.mjs']) {
    assert.equal(Object.hasOwn(stubs, kept), false, `${kept} must not be stubbed`);
  }
  // The renderer stubs fail loudly with the real reason instead of drawing nothing.
  assert.match(stubs['rendering/renderers/gpu/WebGPURenderer.mjs'], /export class WebGPURenderer[\s\S]*throw new Error\('Hard Money Heroes needs WebGL/);
  assert.match(stubs['rendering/renderers/canvas/CanvasRenderer.mjs'], /export class CanvasRenderer[\s\S]*throw new Error\('Hard Money Heroes needs WebGL/);
  for (const init of ['accessibility/init.mjs', 'events/init.mjs', 'filters/init.mjs']) {
    assert.equal(stubs[init].trim(), 'export {};', `${init} stub must be an empty module`);
  }
  assert.match(build, /createHmhPixiStubResolver\(/);
  assert.match(build, /namespace:\s*'hmh-pixi-stub'/);
  // The stub resolver only answers for files inside node_modules/pixi.js/lib.
  const resolveStub = vendorStubModule.createHmhPixiStubResolver({ pixiLibDir: 'C:/repo/node_modules/pixi.js/lib' });
  assert.equal(resolveStub({ path: './gpu/WebGPURenderer.mjs', importer: 'C:\\repo\\node_modules\\pixi.js\\lib\\rendering\\renderers\\autoDetectRenderer.mjs' })?.namespace, 'hmh-pixi-stub');
  assert.equal(resolveStub({ path: '../accessibility/init.mjs', importer: 'C:/repo/node_modules/pixi.js/lib/environment-browser/browserAll.mjs' })?.namespace, 'hmh-pixi-stub');
  assert.equal(resolveStub({ path: './gl/WebGLRenderer.mjs', importer: 'C:/repo/node_modules/pixi.js/lib/rendering/renderers/autoDetectRenderer.mjs' }), null);
  assert.equal(resolveStub({ path: './events/init.mjs', importer: 'C:/repo/apps/hmh-reboot/src/main.mjs' }), null);
  assert.equal(resolveStub({ path: '../accessibility/init.mjs', importer: '' }), null);
});

test('Cycle 074 the child runtime never touches the stubbed Pixi subsystems', async () => {
  const srcDir = new URL('../apps/hmh-reboot/src/', import.meta.url);
  const files = (await readdir(srcDir)).filter((name) => name.endsWith('.mjs'));
  assert.ok(files.length > 50, 'child source directory must be populated');
  const forbidden = [
    [/\beventMode\b/, 'Pixi pointer events (eventMode)'],
    [/\.on\(\s*['"](?:pointer|mouse|touch|click|tap|wheel)/, 'Pixi pointer event listeners'],
    [/\binteractive\s*[:=]/, 'Pixi v7 interactive flag'],
    [/\.hitArea\s*=/, 'Pixi hit areas'],
    [/\.filters\s*=/, 'Pixi filters'],
    [/\.accessible(?:Title|Hint|Type|Pointer|Children)?\s*=/, 'Pixi accessibility overlay'],
    [/new (?:Blur|Alpha|ColorMatrix|Displacement|Noise)Filter\b/, 'Pixi filter classes'],
  ];
  for (const name of files) {
    const source = await readFile(new URL(name, srcDir), 'utf8');
    for (const [pattern, label] of forbidden) {
      assert.doesNotMatch(source, pattern, `${name} uses ${label}, which the trimmed vendor no longer ships`);
    }
  }
  const main = await readFile(new URL('main.mjs', srcDir), 'utf8');
  assert.match(main, /preference: 'webgl'/, 'the child must keep pinning the WebGL renderer');
});

test('Cycle 074 built Pixi vendor keeps the WebGL renderer and stencil masks and ships no WebGPU, canvas renderer, event, accessibility or filter system', async () => {
  const vendor = await readFile(new URL('../apps/portal/dist/chunks/hmh-pixi.js', import.meta.url), 'utf8');
  assert.match(vendor, /webgl2/, 'WebGL renderer must ship');
  assert.match(vendor, /stencilMask/, 'stencil mask pipe (terrain ramps, road surface) must ship');
  assert.match(vendor, /alphaMask/, 'alpha mask pipe registered by rendering/init.mjs must ship');
  // Property names survive minification, so these are stable markers. Every
  // one is present in the Cycle 073 vendor (d8bc6710…) and absent after the trim.
  for (const [marker, label] of [
    ['createBindGroup', 'WebGPU renderer'],
    ['_canvasMaskStack', 'canvas renderer'],
    ['globalpointermove', 'Pixi event system'],
    ['aria-live', 'Pixi accessibility overlay'],
    ['_pushFilterData', 'Pixi filter system'],
  ]) {
    assert.doesNotMatch(vendor, new RegExp(marker), `${label} (${marker}) must not ship in the trimmed vendor`);
  }
});

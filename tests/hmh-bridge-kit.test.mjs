import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  BRIDGE_KIT_ATLAS_URL,
  BRIDGE_KIT_FLAG,
  assertBridgeKitSessionMode,
  bridgeDeckContains,
  bridgeKitEnabled,
  bridgeKitPageUrls,
  bridgeKitRequested,
  bridgeSequenceState,
  bridgeSwayFrameIndex,
  createBridgeKitDisplay,
  resolveBridgeCrossingDraws,
  validateBridgeKitAtlas,
} from '../apps/hmh-reboot/src/bridge-kit.mjs';

// Bridge kit (Level 1 design package 2.4, slice S4.9). Built dark: registered
// and rendered, placed by the layout v2 lane, never reachable in Ranked.

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root));
const readJson = (path) => JSON.parse(read(path).toString('utf8'));
const manifest = readJson('apps/hmh-reboot/assets/source/blender/hmh-bridge-kit.json');
const atlasDir = 'apps/portal/assets/generated/hmh-bridge-kit/';
const atlas = readJson(`${atlasDir}hmh-bridge-kit-atlas.json`);
const metrics = readJson('docs/testing/hmh-bridge-kit/hmh-bridge-kit-metrics.json');
const index = validateBridgeKitAtlas(atlas);

const PACKAGE_STYLES = ['stone-arch-viaduct', 'plank-suspension', 'stone-arch', 'steel-through-truss', 'timber-trestle', 'steel-lock-gate', 'steel-bascule'];
// Package 2.4 crossing table as sized by the layout v2 greybox (DECKS on
// fable/hmh-layout-v2 f4289a33).
const LAYOUT_V2_DECKS = [
  ['settler-viaduct', [2430, 2240, 2870, 2480], 'x', 0, 'stone-arch-viaduct'],
  ['rugpull-rope-bridge', [2430, 1020, 2870, 1180], 'x', 0, 'plank-suspension'],
  ['old-mill-bridge', [4500, 845, 5000, 1105], 'x', 16, 'stone-arch'],
  ['proof-of-work-bridge', [4500, 2290, 5000, 2510], 'x', 16, 'steel-through-truss'],
  ['fork-trestle', [4180, 3150, 4470, 3350], 'x', 0, 'timber-trestle'],
  ['lock-gate-walkway', [5230, 3450, 5520, 3700], 'x', 0, 'steel-lock-gate'],
  ['hashwood-run-bridge', [6930, 2250, 7130, 2600], 'x', 0, 'log-and-plank'],
  ['canal-bascule', [10700, 1280, 10920, 1500], 'y', 0, 'steel-bascule'],
];

function params(query) {
  return new URLSearchParams(query);
}

test('the kit is dark: off by default, evidence-only, and never Ranked', () => {
  assert.equal(BRIDGE_KIT_FLAG, 'bridgeKit');
  assert.equal(bridgeKitRequested(params('')), false);
  assert.equal(bridgeKitRequested(params('bridgeKit=1')), false, 'the flag alone is not enough outside evidence sessions');
  assert.equal(bridgeKitRequested(params('evidenceSafe=1')), false);
  assert.equal(bridgeKitRequested(params('evidenceSafe=1&bridgeKit=1')), true);
  assert.equal(bridgeKitRequested(null), false);
  assert.equal(bridgeKitEnabled({ params: params('evidenceSafe=1&bridgeKit=1'), mode: 'free' }), true);
  assert.equal(bridgeKitEnabled({ params: params('evidenceSafe=1&bridgeKit=1'), mode: 'ranked' }), false);
  assert.throws(() => assertBridgeKitSessionMode('ranked'), /never runs Ranked/);
  assert.equal(assertBridgeKitSessionMode('free'), 'free');
  assert.equal(atlas.status, 'dark');
  assert.equal(manifest.status, 'dark');
});

test('nothing on the shipped path imports the kit statically', () => {
  const srcDir = new URL('apps/hmh-reboot/src/', root);
  const offenders = [];
  for (const name of readdirSync(srcDir)) {
    if (!name.endsWith('.mjs') || name === 'bridge-kit.mjs') continue;
    const source = readFileSync(new URL(name, srcDir), 'utf8');
    if (/from\s+['"]\.\/bridge-kit\.mjs['"]/u.test(source) || /^\s*import\s+['"]\.\/bridge-kit\.mjs['"]/mu.test(source)) offenders.push(name);
  }
  assert.deepEqual(offenders, [], 'the layout lane may only reach the kit through a gated dynamic import');
  const main = readFileSync(new URL('main.mjs', srcDir), 'utf8');
  if (main.includes('bridge-kit.mjs')) {
    assert.match(main, /import\(['"]\.\/bridge-kit\.mjs['"]\)/u, 'main must load the kit dynamically');
  }
});

test('the runtime module is projection-only and deterministic by construction', () => {
  const source = read('apps/hmh-reboot/src/bridge-kit.mjs').toString('utf8');
  const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/gu)].map((match) => match[1]);
  assert.deepEqual(imports, ['./world-space.mjs']);
  for (const banned of ['Math.random', 'Date.now', 'performance.now', 'new Date(']) {
    assert.ok(!source.includes(banned), `bridge-kit.mjs must not use ${banned}`);
  }
});

test('eight crossings in the seven package styles, sized to the layout v2 decks', () => {
  assert.equal(manifest.crossings.length, 8);
  assert.deepEqual(Object.keys(atlas.crossings).sort(), LAYOUT_V2_DECKS.map(([id]) => id).sort());
  for (const [id, rect, span, z, style] of LAYOUT_V2_DECKS) {
    const crossing = atlas.crossings[id];
    assert.deepEqual(crossing.rect, rect, `${id} rect`);
    assert.equal(crossing.span, span, `${id} span`);
    assert.equal(crossing.z, z, `${id} z`);
    assert.equal(crossing.style, style, `${id} style`);
  }
  const styles = new Set(Object.values(atlas.crossings).map((crossing) => crossing.style));
  for (const style of PACKAGE_STYLES) assert.ok(styles.has(style), `missing style ${style}`);
  assert.equal(styles.size, 8, 'seven styles plus the log-and-plank timber variant');
  assert.equal(atlas.crossings['hashwood-run-bridge'].rails, false);
});

test('when the layout v2 map is present its decks match the kit exactly', async () => {
  const mapUrl = new URL('apps/hmh-reboot/src/layout-v2-map.mjs', root);
  if (!existsSync(fileURLToPath(mapUrl))) return;
  const { LAYOUT_V2_MAP } = await import(pathToFileURL(fileURLToPath(mapUrl)).href);
  for (const deck of LAYOUT_V2_MAP.decks) {
    const crossing = atlas.crossings[deck.id];
    assert.ok(crossing, `layout deck ${deck.id} has no bridge kit crossing`);
    assert.deepEqual(crossing.rect, deck.rect, `${deck.id} moved on the layout; re-run npm run assets:hmh:bridge-kit`);
    assert.equal(crossing.span, deck.span ?? 'x');
    assert.equal(crossing.z, deck.z ?? 0);
    assert.equal(crossing.style, deck.style);
    assert.equal(crossing.rails, deck.rails !== false);
  }
});

test('the modules are shared: every crossing is assembled from reused pieces', () => {
  for (const [id, crossing] of Object.entries(atlas.crossings)) {
    const uses = Object.values(crossing.moduleInventory);
    assert.ok(uses.length >= 5, `${id} uses too few module kinds`);
    assert.ok(uses.some((count) => count >= 4), `${id} repeats no module`);
  }
  assert.ok(metrics.sharedMeshCount > 0 && metrics.sharedMeshCount < metrics.frameCount * 40);
});

test('art lands on the collision it shows: projection probes, deck and rail coverage', () => {
  assert.equal(atlas.cameraElevationDegrees, 35);
  assert.equal(atlas.pixelDensity, 2);
  assert.equal(atlas.runtimeScale, 0.5);
  assert.ok(metrics.worstProbeErrorPx <= 0.5, `probe error ${metrics.worstProbeErrorPx}px`);
  for (const crossing of manifest.crossings) {
    const result = metrics.alignment[crossing.id];
    const minimum = crossing.deckCoverageMin ?? metrics.gates.deckCoverageMin;
    assert.ok(result.deckCoverage >= minimum, `${crossing.id} deck coverage ${result.deckCoverage} < ${minimum}`);
    if (crossing.rails !== false) {
      assert.ok(result.railCoverage >= metrics.gates.railCoverageMin, `${crossing.id} rail coverage ${result.railCoverage}`);
    }
  }
  assert.equal(metrics.gates.deckCoverageMin, 0.985);
});

function webpSize(bytes) {
  assert.equal(bytes.subarray(0, 4).toString('latin1'), 'RIFF');
  assert.equal(bytes.subarray(8, 12).toString('latin1'), 'WEBP');
  const chunk = bytes.subarray(12, 16).toString('latin1');
  if (chunk === 'VP8X') return { w: 1 + bytes.readUIntLE(24, 3), h: 1 + bytes.readUIntLE(27, 3) };
  if (chunk === 'VP8L') {
    const bits = bytes.readUInt32LE(21);
    return { w: 1 + (bits & 0x3fff), h: 1 + ((bits >> 14) & 0x3fff) };
  }
  return { w: bytes.readUInt16LE(26) & 0x3fff, h: bytes.readUInt16LE(28) & 0x3fff };
}

test('pages are WebP within the prop page budget, each with an exact half-resolution mobile page', () => {
  assert.ok(atlas.pages.length >= 1);
  for (const page of atlas.pages) {
    const full = read(`${atlasDir}${page.image.replace('./', '')}`);
    const mobile = read(`${atlasDir}${page.mobileImage.replace('./', '')}`);
    assert.ok(page.mobileImage.endsWith('@0.5x.webp'));
    assert.equal(full.length, page.bytes);
    assert.equal(mobile.length, page.mobileBytes);
    assert.equal(createHash('sha256').update(full).digest('hex'), page.sha256, `${page.id} changed without a rebuild`);
    assert.equal(createHash('sha256').update(mobile).digest('hex'), page.mobileSha256);
    assert.deepEqual(webpSize(full), { w: page.width, h: page.height });
    assert.deepEqual(webpSize(mobile), { w: page.width / 2, h: page.height / 2 });
    assert.ok(page.width <= 2048 && page.height <= 2048);
    assert.ok(page.bytes <= 1024 * 1024, `${page.id} ${page.bytes} bytes`);
    for (const frame of Object.values(atlas.frames)) {
      for (const part of frame.parts.filter((candidate) => candidate.page === page.id)) {
        for (const value of [part.frame.x, part.frame.y, part.frame.w, part.frame.h]) {
          assert.equal(value % 2, 0, `${part.id} must sit on the 2:1 grid`);
        }
      }
    }
  }
  const urls = bridgeKitPageUrls(index, { mobile: true });
  assert.ok(Object.values(urls).every((url) => url.startsWith('/assets/generated/hmh-bridge-kit/') && url.endsWith('@0.5x.webp')));
  assert.equal(BRIDGE_KIT_ATLAS_URL, '/assets/generated/hmh-bridge-kit/hmh-bridge-kit-atlas.json');
});

test('sway is a 6-8 Hz stop-motion loop driven only by the presentation tick', () => {
  assert.deepEqual(atlas.sway.styles, ['plank-suspension']);
  assert.ok(atlas.sway.fps >= 6 && atlas.sway.fps <= 8);
  const sequence = Array.from({ length: 120 }, (_, tick) => bridgeSwayFrameIndex(tick, atlas.sway));
  assert.deepEqual(sequence, Array.from({ length: 120 }, (_, tick) => bridgeSwayFrameIndex(tick, atlas.sway)));
  const changes = sequence.slice(0, 60).filter((value, tick) => tick > 0 && value !== sequence[tick - 1]).length;
  assert.ok(changes >= 6 && changes <= 8, `${changes} frame changes per second`);
  assert.deepEqual([...new Set(sequence)].sort(), Array.from({ length: atlas.sway.frames }, (_, i) => i));
  assert.equal(bridgeSwayFrameIndex(-4, atlas.sway), 0);
  assert.equal(bridgeSwayFrameIndex(1.5, atlas.sway), 0);
  const rope = atlas.crossings['rugpull-rope-bridge'];
  assert.deepEqual(Object.keys(rope.swayFrames).sort(), ['deck', 'near']);
  for (const list of Object.values(rope.swayFrames)) assert.equal(list.length, atlas.sway.frames);
});

test('moving parts are separate sprites with their gate states', () => {
  const rope = atlas.crossings['rugpull-rope-bridge'];
  assert.equal(rope.movingParts.gateId, 'ravine-rope-bridge-raised');
  assert.equal(rope.defaultState, 'raised');
  const raised = resolveBridgeCrossingDraws(index, 'rugpull-rope-bridge', { gateState: 'raised', presentationTick: 30 });
  assert.ok(raised.some((draw) => draw.frameId.endsWith('.moving.raised')));
  assert.ok(!raised.some((draw) => draw.frameId.includes('.sway-')), 'a raised bridge does not sway');
  const lowered = resolveBridgeCrossingDraws(index, 'rugpull-rope-bridge', { gateState: 'lowered', presentationTick: 30 });
  const phase = bridgeSwayFrameIndex(30, atlas.sway);
  assert.ok(lowered.some((draw) => draw.frameId === `rugpull-rope-bridge.deck.sway-${phase}`));
  assert.ok(!lowered.some((draw) => draw.frameId.endsWith('.moving.raised')));

  const lock = atlas.crossings['lock-gate-walkway'];
  assert.equal(lock.movingParts.gateId, 'crossing-lock-gate-chain');
  const chained = resolveBridgeCrossingDraws(index, 'lock-gate-walkway', {});
  assert.ok(chained.some((draw) => draw.frameId.endsWith('.moving.chained')));
  const open = resolveBridgeCrossingDraws(index, 'lock-gate-walkway', { gateState: 'open' });
  assert.ok(open.some((draw) => draw.frameId.endsWith('.moving.open-north')));
  assert.ok(open.some((draw) => draw.frameId.endsWith('.moving.open-south')));
  assert.ok(!open.some((draw) => draw.frameId.endsWith('.moving.chained')));

  const bascule = atlas.crossings['canal-bascule'];
  assert.equal(bascule.movingParts.gateId, 'yard-bascule-leaf');
  assert.deepEqual(bascule.movingParts.sequence, ['raised', 'lowering-1', 'lowering-2', 'lowered']);
  assert.equal(bridgeSequenceState(bascule, null), 'raised');
  assert.equal(bridgeSequenceState(bascule, 0), 'lowering-1');
  assert.equal(bridgeSequenceState(bascule, bascule.movingParts.sequenceTicks), 'lowering-2');
  assert.equal(bridgeSequenceState(bascule, 10_000), 'lowered');
  const leafUp = resolveBridgeCrossingDraws(index, 'canal-bascule', { gateState: 'raised' }).filter((draw) => draw.frameId.includes('.moving.'));
  assert.ok(leafUp.length > 0 && leafUp.every((draw) => draw.band === 'actors' && draw.sortY === 1506));
  const leafDown = resolveBridgeCrossingDraws(index, 'canal-bascule', { gateState: 'lowered' }).filter((draw) => draw.frameId.includes('.moving.'));
  assert.ok(leafDown.length > 0 && leafDown.every((draw) => draw.band === 'ground'));
});

test('draw lists are deterministic, ordered by band and depth, and fade only the truss', () => {
  const first = resolveBridgeCrossingDraws(index, 'proof-of-work-bridge', { presentationTick: 9 });
  const second = resolveBridgeCrossingDraws(index, 'proof-of-work-bridge', { presentationTick: 9 });
  assert.deepEqual(first, second);
  const bands = first.map((draw) => draw.band);
  assert.deepEqual(bands, [...bands].sort((a, b) => ['ground', 'actors', 'overhead'].indexOf(a) - ['ground', 'actors', 'overhead'].indexOf(b)));
  assert.ok(first.some((draw) => draw.band === 'overhead'));
  assert.ok(first.every((draw) => draw.alpha === 1));
  const onDeck = resolveBridgeCrossingDraws(index, 'proof-of-work-bridge', { heroOnDeck: true });
  const overhead = onDeck.filter((draw) => draw.band === 'overhead');
  assert.ok(overhead.every((draw) => draw.alpha < 0.5));
  assert.ok(onDeck.filter((draw) => draw.band === 'ground').every((draw) => draw.alpha === 1));
  const pow = atlas.crossings['proof-of-work-bridge'];
  assert.equal(bridgeDeckContains(pow, 4750, 2400), true);
  assert.equal(bridgeDeckContains(pow, 4450, 2400), true, 'ramps count as the deck');
  assert.equal(bridgeDeckContains(pow, 4750, 2600), false);
  assert.throws(() => resolveBridgeCrossingDraws(index, 'nope'), RangeError);
});

test('the validator rejects a broken atlas', () => {
  const broken = structuredClone(atlas);
  broken.runtimeAuthority = 'gameplay';
  assert.throws(() => validateBridgeKitAtlas(broken), /projection-only/);
  const missing = structuredClone(atlas);
  missing.crossings['canal-bascule'].movingParts.states.raised = [];
  assert.throws(() => validateBridgeKitAtlas(missing), /no frames/);
  const outside = structuredClone(atlas);
  const firstFrame = Object.values(outside.frames)[0];
  firstFrame.parts[0].frame.x = 99_999;
  assert.throws(() => validateBridgeKitAtlas(outside), /outside its page/);
});

test('the display places parts at their world screen origin and hides off-screen parts', () => {
  class Container {
    constructor() { this.children = []; }
    addChild(child) { this.children.push(child); child.parent = this; }
    removeChild(child) { this.children = this.children.filter((item) => item !== child); }
    destroy() {}
  }
  class Sprite {
    constructor({ texture }) {
      this.texture = texture;
      this.position = { set: (x, y) => { this.x = x; this.y = y; } };
      this.scale = { set: (value) => { this.scaleValue = value; } };
      this.anchor = { set: () => {} };
    }
    destroy() {}
  }
  class Texture { constructor(options) { Object.assign(this, options); } destroy() {} }
  class Rectangle { constructor(x, y, w, h) { Object.assign(this, { x, y, w, h }); } }
  const pageTextures = Object.fromEntries(atlas.pages.map((page) => [page.id, { source: { id: page.id } }]));
  const attached = [];
  const display = createBridgeKitDisplay({
    index, pageTextures, crossingIds: ['settler-viaduct'], depthLayer: { attach: (sprite) => attached.push(sprite), detach() {} },
    ContainerClass: Container, SpriteClass: Sprite, TextureClass: Texture, RectangleClass: Rectangle,
  });
  const camera = { x: 2650, y: 2360, zoom: 1, shakeX: 0, shakeY: 0 };
  const view = { width: 1600, height: 1200 };
  const drawn = display.update({ camera, view, presentationTick: 0 });
  assert.ok(drawn > 0);
  const deckFrame = atlas.frames['settler-viaduct.deck.static'];
  const sprite = display.ground.children.find((child) => child.label === `bridge-kit-${deckFrame.parts[0].id}`);
  assert.ok(sprite?.visible);
  assert.equal(sprite.x, deckFrame.parts[0].origin.x - camera.x + view.width / 2);
  assert.equal(sprite.y, deckFrame.parts[0].origin.y - camera.y + view.height / 2);
  assert.equal(sprite.scaleValue, 0.5);
  assert.ok(attached.length > 0, 'the near parapet joins the actor depth layer');
  display.update({ camera: { ...camera, x: 20_000 }, view });
  assert.ok(display.ground.children.every((child) => child.visible === false));
  display.destroy();
});

test('source scene lives in Git LFS and the pipeline is registered', () => {
  const pkg = readJson('package.json');
  assert.equal(pkg.scripts['assets:hmh:bridge-kit'], 'python scripts/run-hmh-bridge-kit-pipeline.py');
  assert.match(manifest.scene.sourceBlend, /^apps\/hmh-reboot\/assets\/source\/models\/.+\.blend$/u);
  assert.ok(existsSync(fileURLToPath(new URL(manifest.scene.sourceBlend, root))));
  assert.equal(metrics.sourceBlendSha256.length, 64);
  assert.equal(metrics.status, 'pass');
  assert.equal(metrics.manifestSha256, createHash('sha256').update(read('apps/hmh-reboot/assets/source/blender/hmh-bridge-kit.json')).digest('hex'), 'manifest changed without a rebuild');
  assert.equal(metrics.blenderScriptSha256, createHash('sha256').update(read('scripts/hmh-blender/create-hmh-bridge-kit.py')).digest('hex'), 'Blender script changed without a rebuild');
});

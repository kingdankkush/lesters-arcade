import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  AUTHORED_PROP_ASSETS,
  AUTHORED_PROP_PIPELINE_ID,
  authoredPropItemUrl,
  buildAuthoredDistrictLandmarkPlacements,
  buildAuthoredPointOfInterestPlacements,
  buildAuthoredWorldPropPlacements,
  createAuthoredHeldWeaponDisplay,
  createAuthoredPropAtlasIndex,
  createAuthoredPropDisplay,
  resolveAuthoredLandmarkSignal,
  AUTHORED_PROP_ASSET_COUNT,
  AUTHORED_PROP_ASSET_IDS,
  AUTHORED_DRESSING_DENSITY,
} from '../apps/hmh-reboot/src/authored-prop-atlas.mjs';
import { LEVEL_ONE_WORLD } from '../apps/hmh-reboot/src/level-one-world.mjs';

// One source for the dressing count lock: the exported density table. The
// dressing-density suite pins the table's literal total; this suite pins that
// the generator honours it.
const DRESSING_TOTAL = Object.values(AUTHORED_DRESSING_DENSITY).reduce((sum, count) => sum + count, 0);

const metadataUrl = new URL('../apps/portal/assets/generated/hmh-reboot-authored-props/hmh-authored-props-atlas.json', import.meta.url);
const loadMetadata = async () => JSON.parse(await readFile(metadataUrl, 'utf8'));

class FakePoint {
  set(x, y = x) { this.x = x; this.y = y; }
}
class FakeContainer {
  constructor() { this.children = []; this.position = new FakePoint(); this.scale = new FakePoint(); this.visible = true; }
  addChild(...children) { this.children.push(...children); return children.at(-1); }
}
class FakeSprite {
  constructor({ texture }) { this.texture = texture; this.anchor = new FakePoint(); this.position = new FakePoint(); this.scale = new FakePoint(); this.visible = true; }
}
class FakeGraphics {
  constructor() { this.commands = []; this.visible = true; }
  clear() { this.commands = []; return this; }
  circle(...args) { this.commands.push(['circle', ...args]); return this; }
  stroke(options) { this.commands.push(['stroke', options]); return this; }
  fill(options) { this.commands.push(['fill', options]); return this; }
}
class FakeTexture { constructor(options) { Object.assign(this, options); } }
class FakeRectangle { constructor(x, y, width, height) { Object.assign(this, { x, y, width, height }); } }
const fakeAtlasTexture = { source: { id: 'authored-prop-source' } };

test('authored prop metadata is complete, projection-only, and provenance-bearing', async () => {
  const metadata = await loadMetadata();
  const index = createAuthoredPropAtlasIndex(metadata);
  assert.equal(index.pipelineId, AUTHORED_PROP_PIPELINE_ID);
  assert.equal(index.runtimeAuthority, 'projection-only');
  assert.equal(index.frameById.size, metadata.assetCount);
  assert.equal(new Set(AUTHORED_PROP_ASSET_IDS).size, AUTHORED_PROP_ASSET_COUNT, 'prop ids must be unique');
  for (const assetId of Object.values(AUTHORED_PROP_ASSETS).flat()) {
    const frame = index.frameFor(assetId);
    assert.equal(frame.assetId, assetId);
    assert.match(frame.sourcePixelSha256, /^[0-9a-f]{64}$/u);
    assert.ok(frame.runtimeScale > 0);
    assert.equal(authoredPropItemUrl(assetId), `/assets/generated/hmh-reboot-authored-props/items/${assetId}.png`);
  }
  for (const frame of metadata.frames) assert.match(frame.sourcePixelSha256, /^[0-9a-f]{64}$/u);
  assert.throws(() => authoredPropItemUrl('../fake-prop'), /bad prop/);
});

test('authored prop atlas rejects count, path, bounds, hash, and town schema drift', async () => {
  const metadata = await loadMetadata();
  const reject = (mutate) => {
    const changed = structuredClone(metadata);
    mutate(changed);
    assert.throws(() => createAuthoredPropAtlasIndex(changed), TypeError);
  };
  reject((value) => { value.assetCount += 1; });
  reject((value) => { delete value.atlasSize; });
  reject((value) => { value.frames[0].assetId = '../bad'; });
  reject((value) => { value.frames[0].frame.x = -1; });
  reject((value) => { value.frames[0].frame.x = value.atlasSize.width; });
  reject((value) => { value.frames[0].anchor.x = null; });
  reject((value) => { value.frames[0].anchor.y = Number.NaN; });
  reject((value) => { value.frames[0].sourcePixelSha256 = 'g'.repeat(64); });
  reject((value) => { delete value.frames.find((frame) => frame.townPlacements.length).townPlacements[0].collisionPolicy; });
});

test('authored world dressing and gameplay POIs are deterministic and bounded', () => {
  const first = buildAuthoredWorldPropPlacements({ worldId: 'forked-frontier', seed: 0x484d4807, countPerDistrict: 8 });
  const second = buildAuthoredWorldPropPlacements({ worldId: 'forked-frontier', seed: 0x484d4807, countPerDistrict: 8 });
  assert.deepEqual(first, second);
  // Every district carries an authored density per the gameworld art
  // direction (hashwood leads so the forest reads as a forest). W1 raised
  // these once the A1-A4 waves had a library worth placing:
  // 20 + 20 + 20 + 24 + 22 + 22 = 128; W-7 (Cycle 073) raised it to 200.
  assert.equal(first.length, DRESSING_TOTAL);
  assert.equal(DRESSING_TOTAL, 200);
  assert.equal(new Set(first.map((placement) => placement.districtId)).size, 6);
  assert.ok(first.every((placement) => placement.x >= 0 && placement.x <= 12_000 && placement.y >= 0 && placement.y <= 4_800));
  const pointsOfInterest = buildAuthoredPointOfInterestPlacements(LEVEL_ONE_WORLD.pointsOfInterest);
  assert.equal(pointsOfInterest.length, 10);
  assert.deepEqual(new Set(pointsOfInterest.map((placement) => placement.assetId)), new Set([
    ...AUTHORED_PROP_ASSETS.weapons.filter((assetId) => !['hash-rail', 'lightning-ledger', 'bear-market-burner', 'forked-standard'].includes(assetId)),
    ...AUTHORED_PROP_ASSETS.pickups.filter((assetId) => !['lightning-ledger-cache', 'bear-market-burner-cache', 'forked-standard-cache'].includes(assetId)),
  ]));
  assert.deepEqual(pointsOfInterest.map(({ pointOfInterestId, hook, x, y }) => ({ pointOfInterestId, hook, x, y })), LEVEL_ONE_WORLD.pointsOfInterest.map((point) => ({ pointOfInterestId: point.id, hook: point.hook, x: point.anchor.x, y: point.anchor.y })));
  assert.ok(pointsOfInterest.every((placement) => placement.category === 'point-of-interest' && placement.runtimeAuthority === 'projection-only'));
});

test('district landmark clusters stay near visual anchors and clear the playable center', () => {
  const first = buildAuthoredDistrictLandmarkPlacements({ worldId: 'forked-frontier' });
  const second = buildAuthoredDistrictLandmarkPlacements({ worldId: 'forked-frontier' });
  assert.deepEqual(first, second);
  assert.equal(first.length, 42);
  const byDistrict = new Map();
  for (const placement of first) {
    const placements = byDistrict.get(placement.districtId) ?? [];
    placements.push(placement);
    byDistrict.set(placement.districtId, placements);
  }
  assert.equal(byDistrict.size, 6);
  for (const placements of byDistrict.values()) {
    assert.equal(placements.length, 7);
    assert.ok(placements.every((placement) => placement.category === 'district-landmark'));
    assert.ok(placements.every((placement) => placement.runtimeAuthority === 'projection-only'));
    assert.ok(placements.every((placement) => placement.scale >= 1 && placement.scale <= 1.9));
    assert.equal(placements.filter((placement) => placement.anchorDistance === 0).length, 1);
    assert.ok(placements.filter((placement) => placement.anchorDistance > 0).every((placement) => placement.anchorDistance >= 400 && placement.anchorDistance <= 530));
    assert.equal(placements.filter((placement) => placement.mobileOnly).length, 0);
  }
  assert.ok(first.every((placement) => placement.x >= 0 && placement.x <= 12_000));
  assert.ok(first.every((placement) => placement.y >= 0 && placement.y <= 4_800));
  assert.equal(new Set(first.map((placement) => placement.id)).size, first.length);
});

test('district landmark signals are deterministic, bounded, projection-only, and reduced-motion safe', () => {
  const placements = buildAuthoredDistrictLandmarkPlacements({ worldId: 'forked-frontier' });
  const signaled = placements.filter((placement) => resolveAuthoredLandmarkSignal({ placement, tick: 0 }) !== null);
  assert.ok(signaled.length >= 12, 'all six districts need multiple animated signal anchors');
  assert.equal(new Set(signaled.map((placement) => placement.districtId)).size, 6);

  let changed = 0;
  for (const placement of signaled) {
    const first = resolveAuthoredLandmarkSignal({ placement, tick: 0 });
    const repeated = resolveAuthoredLandmarkSignal({ placement, tick: 0 });
    const later = resolveAuthoredLandmarkSignal({ placement, tick: 37 });
    assert.deepEqual(first, repeated);
    assert.equal(first.runtimeAuthority, 'projection-only');
    assert.equal(Object.isFrozen(first), true);
    assert.ok(first.pulse >= 0 && first.pulse <= 1);
    assert.ok(first.alpha >= 0.16 && first.alpha <= 0.62);
    assert.ok(first.radiusScale >= 0.18 && first.radiusScale <= 0.42);
    if (first.pulse !== later.pulse) changed += 1;

    const reduced = resolveAuthoredLandmarkSignal({ placement, tick: 37, reduceMotion: true });
    assert.equal(reduced.animated, false);
    assert.equal(reduced.pulse, 0.5);
  }
  assert.equal(changed, signaled.length, 'every signaled landmark must react to simulation tick');
  assert.equal(resolveAuthoredLandmarkSignal({ placement: placements[0], tick: -1 }), null, 'invalid ticks fail closed');
  assert.equal(resolveAuthoredLandmarkSignal({ placement: { ...placements[0], category: 'world-prop' }, tick: 20 }), null);
});

test('authored prop display creates real sprites, culls, grounds, and never changes placement data', async () => {
  const index = createAuthoredPropAtlasIndex(await loadMetadata());
  const placements = Object.freeze([
    ...buildAuthoredWorldPropPlacements({ worldId: 'forked-frontier', seed: 7, countPerDistrict: 1 }),
    ...buildAuthoredDistrictLandmarkPlacements({ worldId: 'forked-frontier' }),
    ...buildAuthoredPointOfInterestPlacements(LEVEL_ONE_WORLD.pointsOfInterest),
  ]);
  const before = JSON.stringify(placements);
  const display = createAuthoredPropDisplay({ index, atlasTexture: fakeAtlasTexture, placements, ContainerClass: FakeContainer, SpriteClass: FakeSprite, TextureClass: FakeTexture, RectangleClass: FakeRectangle, GraphicsClass: FakeGraphics });
  // Authored overrides drive every district now, so countPerDistrict 1 still
  // yields the full dressing table, plus 6 landmarks x 7 parts and 10 POIs.
  assert.equal(display.entries.length, DRESSING_TOTAL + 6 * 7 + 10);
  const report = display.render({
    camera: { zoom: 1 },
    view: { width: 12_000, height: 4_800 },
    worldToScreen: (point) => ({ x: point.x, y: point.y - point.z }),
    queryGround: () => ({ groundZ: 0 }),
    tick: 42,
  });
  assert.equal(report.placementCount, DRESSING_TOTAL + 6 * 7 + 10);
  assert.ok(report.visibleCount > 0);
  assert.ok(report.signalVisibleCount >= 12);
  assert.equal(report.animatedSignalVisibleCount, report.signalVisibleCount);
  assert.equal(report.animatedSignalOnscreenCount, report.signalOnscreenCount);
  assert.ok(display.effects.commands.length > 0, 'visible landmark signals must draw real effect geometry');
  assert.equal(JSON.stringify(placements), before, 'render projection cannot mutate deterministic placements');
  assert.ok(display.entries.every((entry) => entry.sprite.productionAssetId === entry.placement.assetId));

  const reduced = display.render({
    camera: { zoom: 1 },
    view: { width: 12_000, height: 4_800 },
    worldToScreen: (point) => ({ x: point.x, y: point.y - point.z }),
    queryGround: () => ({ groundZ: 0 }),
    tick: 79,
    reduceMotion: true,
  });
  assert.ok(reduced.signalVisibleCount >= 12);
  assert.equal(reduced.animatedSignalVisibleCount, 0);
  assert.equal(reduced.animatedSignalOnscreenCount, 0);
});

test('authored props hand every visible placement a ground contact shadow', async () => {
  const index = createAuthoredPropAtlasIndex(await loadMetadata());
  const placements = Object.freeze([
    ...buildAuthoredWorldPropPlacements({ worldId: 'forked-frontier', seed: 7, countPerDistrict: 1 }),
    ...buildAuthoredDistrictLandmarkPlacements({ worldId: 'forked-frontier' }),
    ...buildAuthoredPointOfInterestPlacements(LEVEL_ONE_WORLD.pointsOfInterest),
  ]);
  const before = JSON.stringify(placements);
  const display = createAuthoredPropDisplay({ index, atlasTexture: fakeAtlasTexture, placements, ContainerClass: FakeContainer, SpriteClass: FakeSprite, TextureClass: FakeTexture, RectangleClass: FakeRectangle, GraphicsClass: FakeGraphics });
  const calls = [];
  const report = display.render({
    camera: { zoom: 1 },
    view: { width: 12_000, height: 4_800 },
    worldToScreen: (point) => ({ x: point.x, y: point.y - point.z }),
    queryGround: () => ({ groundZ: 0 }),
    tick: 42,
    contactShadows: { place(args) { calls.push(args); } },
  });
  assert.equal(calls.length, report.visibleCount, 'every drawn prop needs a shadow, and nothing culled gets one');
  assert.ok(calls.every((call) => Number.isFinite(call.x) && Number.isFinite(call.y) && Number.isFinite(call.footprintPx)));
  assert.ok(calls.every((call) => call.footprintPx > 0));
  const byId = new Map(display.entries.map((entry) => [entry.placement.id, entry]));
  for (const call of calls) {
    const entry = byId.get(call.placementId);
    assert.ok(entry, `shadow placement ${call.placementId} must map back to a real entry`);
    const spriteWidth = entry.frame.frame.w * entry.frame.runtimeScale * (entry.placement.scale ?? 1);
    // A tall silhouette stands on a narrow base, so the footprint is the
    // sprite width tapered by its aspect.
    const taper = Math.min(1, Math.max(0.42, entry.frame.frame.w / entry.frame.frame.h));
    assert.ok(Math.abs(call.footprintPx - spriteWidth * 0.5 * taper) < 1e-9, 'footprint must taper with sprite aspect');
    assert.ok(call.footprintPx <= spriteWidth * 0.5 + 1e-9, 'a shadow never spreads wider than the sprite that casts it');
    assert.equal(call.ao, call.footprintPx * 2 >= 96, 'only wide bases earn an ambient occlusion pool');
    if (entry.placement.category === 'pickup') {
      assert.ok(call.lift > 0, 'a bobbing pickup lifts off its own shadow');
      // The shadow stays pinned to the ground point while the sprite bobs.
      assert.equal(call.y, entry.placement.y);
    } else {
      assert.equal(call.lift, 0);
    }
  }
  assert.ok(calls.some((call) => call.ao === true), 'the landmark set contains wide bases');
  assert.ok(calls.some((call) => call.ao === false), 'small crates must not get an AO ring');
  assert.equal(JSON.stringify(placements), before, 'shadow projection cannot mutate deterministic placements');

  const withoutShadows = display.render({
    camera: { zoom: 1 },
    view: { width: 12_000, height: 4_800 },
    worldToScreen: (point) => ({ x: point.x, y: point.y - point.z }),
    queryGround: () => ({ groundZ: 0 }),
    tick: 42,
  });
  assert.deepEqual(Object.keys(withoutShadows), Object.keys(report), 'the report shape must not change');
  assert.equal(withoutShadows.visibleCount, report.visibleCount);
});

test('runtime wires reduced motion and animated landmark telemetry into the renderer', async () => {
  const source = await readFile(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(source, /GraphicsClass: Graphics/);
  assert.match(source, /reduceMotion: settings\.reduceMotion \|\| performanceProfile\.particlesPerHazard === 0/);
  assert.match(source, /dataset\.authoredLandmarkAnimated/);
  const smoke = await readFile(new URL('../scripts/hmh-reboot-cockpit-browser-smoke.mjs', import.meta.url), 'utf8');
  assert.match(smoke, /evidenceSafe=1&telemetry=1&progressionPilot=1/);
  assert.match(smoke, /stage\?\.dataset\.authoredLandmarkAnimated === '0'/);
  const visual = await readFile(new URL('../scripts/hmh-reboot-visual-regression.mjs', import.meta.url), 'utf8');
  assert.match(visual, /emulateMedia\(\{ reducedMotion: 'reduce' \}\)/);
  assert.match(visual, /reducedMotionEvidence/);
});

test('held weapon display can select all six authored weapons', async () => {
  const index = createAuthoredPropAtlasIndex(await loadMetadata());
  const display = createAuthoredHeldWeaponDisplay({ index, atlasTexture: fakeAtlasTexture, ContainerClass: FakeContainer, SpriteClass: FakeSprite, TextureClass: FakeTexture, RectangleClass: FakeRectangle });
  for (const weaponId of AUTHORED_PROP_ASSETS.weapons) {
    const frame = display.container.applyWeapon({ weaponId, screen: { x: 100, y: 100 }, aimScreen: { x: 180, y: 140 }, cameraZoom: 1 });
    assert.equal(frame.assetId, weaponId);
    assert.equal(display.container.productionAssetId, weaponId);
    assert.equal(display.container.visible, true);
  }
  assert.equal(display.container.applyWeapon({ weaponId: 'fake' }), null);
  assert.equal(display.container.visible, false);
});

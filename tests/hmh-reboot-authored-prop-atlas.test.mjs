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
} from '../apps/hmh-reboot/src/authored-prop-atlas.mjs';
import { LEVEL_ONE_WORLD } from '../apps/hmh-reboot/src/level-one-world.mjs';

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
  // Pinned to the declared roster, not a literal, so adding a prop does not
  // require editing a number in two places.
  assert.equal(index.frameById.size, AUTHORED_PROP_ASSET_COUNT);
  assert.equal(new Set(AUTHORED_PROP_ASSET_IDS).size, AUTHORED_PROP_ASSET_COUNT, 'prop ids must be unique');
  for (const assetId of Object.values(AUTHORED_PROP_ASSETS).flat()) {
    const frame = index.frameFor(assetId);
    assert.equal(frame.assetId, assetId);
    assert.match(frame.sourcePixelSha256, /^[0-9a-f]{64}$/u);
    assert.ok(frame.runtimeScale > 0);
    assert.equal(authoredPropItemUrl(assetId), `/assets/generated/hmh-reboot-authored-props/items/${assetId}.png`);
  }
  assert.throws(() => authoredPropItemUrl('fake-prop'), /unknown authored prop/);
});

test('authored world dressing and gameplay POIs are deterministic and bounded', () => {
  const first = buildAuthoredWorldPropPlacements({ worldId: 'forked-frontier', seed: 0x484d4807, countPerDistrict: 8 });
  const second = buildAuthoredWorldPropPlacements({ worldId: 'forked-frontier', seed: 0x484d4807, countPerDistrict: 8 });
  assert.deepEqual(first, second);
  assert.equal(first.length, 48);
  assert.equal(new Set(first.map((placement) => placement.districtId)).size, 6);
  assert.ok(first.every((placement) => placement.x >= 0 && placement.x <= 12_000 && placement.y >= 0 && placement.y <= 4_800));
  const pointsOfInterest = buildAuthoredPointOfInterestPlacements(LEVEL_ONE_WORLD.pointsOfInterest);
  assert.equal(pointsOfInterest.length, 9);
  assert.deepEqual(new Set(pointsOfInterest.map((placement) => placement.assetId)), new Set([...AUTHORED_PROP_ASSETS.weapons, ...AUTHORED_PROP_ASSETS.pickups]));
  assert.deepEqual(pointsOfInterest.map(({ pointOfInterestId, hook, x, y }) => ({ pointOfInterestId, hook, x, y })), LEVEL_ONE_WORLD.pointsOfInterest.map((point) => ({ pointOfInterestId: point.id, hook: point.hook, x: point.anchor.x, y: point.anchor.y })));
  assert.ok(pointsOfInterest.every((placement) => placement.category === 'point-of-interest' && placement.runtimeAuthority === 'projection-only'));
});

test('district landmark clusters stay near visual anchors and clear the playable center', () => {
  const first = buildAuthoredDistrictLandmarkPlacements({ worldId: 'forked-frontier' });
  const second = buildAuthoredDistrictLandmarkPlacements({ worldId: 'forked-frontier' });
  assert.deepEqual(first, second);
  assert.equal(first.length, 48);
  const byDistrict = new Map();
  for (const placement of first) {
    const placements = byDistrict.get(placement.districtId) ?? [];
    placements.push(placement);
    byDistrict.set(placement.districtId, placements);
  }
  assert.equal(byDistrict.size, 6);
  for (const placements of byDistrict.values()) {
    assert.equal(placements.length, 8);
    assert.ok(placements.every((placement) => placement.category === 'district-landmark'));
    assert.ok(placements.every((placement) => placement.runtimeAuthority === 'projection-only'));
    assert.ok(placements.every((placement) => placement.scale >= 1.25 && placement.scale <= 2));
    assert.ok(placements.every((placement) => placement.anchorDistance >= 140 && placement.anchorDistance <= 530));
    assert.equal(placements.filter((placement) => placement.mobileOnly).length, 2);
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
  assert.equal(display.entries.length, 63);
  const report = display.render({
    camera: { zoom: 1 },
    view: { width: 12_000, height: 4_800 },
    worldToScreen: (point) => ({ x: point.x, y: point.y - point.z }),
    queryGround: () => ({ groundZ: 0 }),
    tick: 42,
  });
  assert.equal(report.placementCount, 63);
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

test('held weapon display can select all four authored weapons', async () => {
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

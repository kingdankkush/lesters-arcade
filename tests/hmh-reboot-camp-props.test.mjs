import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  AUTHORED_PROP_ASSETS,
  AUTHORED_PROP_ASSET_IDS,
  authoredPropItemUrl,
  buildAuthoredWorldPropPlacements,
  AUTHORED_CAMP_KIT,
} from '../apps/hmh-reboot/src/authored-prop-atlas.mjs';

const manifest = JSON.parse(readFileSync(
  fileURLToPath(new URL('../apps/hmh-reboot/assets/source/blender/hmh-authored-props.json', import.meta.url)),
  'utf8',
));
const builderSource = readFileSync(
  fileURLToPath(new URL('../scripts/hmh-blender/create-hmh-authored-props.py', import.meta.url)),
  'utf8',
);
const atlas = JSON.parse(readFileSync(
  fileURLToPath(new URL('../apps/portal/assets/generated/hmh-reboot-authored-props/hmh-authored-props-atlas.json', import.meta.url)),
  'utf8',
));

// A7 + W3. Enemies spawn in open ground, so an encounter reads as figures
// appearing on grass rather than as a place someone lives. This is the kit
// that gives spawn regions somewhere to come FROM.
//
// Strictly dressing: projection-only props and placement data. No spawn
// timing, no AI, no collision -- W3 attaches the kit to spawn regions that
// already exist.
const CAMP = Object.freeze({
  'campfire-ring': { shape: 'campfire-ring', minRatio: 0.62 },
  'bedroll-cluster': { shape: 'bedroll-cluster', minRatio: 0.60 },
  'sandbag-nest': { shape: 'sandbag-nest', minRatio: 0.62 },
  'scrap-barricade': { shape: 'scrap-barricade', minRatio: 0.80 },
  'watch-platform': { shape: 'watch-platform', minRatio: 1.20 },
  'faction-banner': { shape: 'faction-banner', minRatio: 1.60 },
});

test('every camp asset is on the world-prop roster', () => {
  for (const id of Object.keys(CAMP)) {
    assert.ok(AUTHORED_PROP_ASSETS.worldProps.includes(id), `${id} missing from worldProps`);
    assert.ok(AUTHORED_PROP_ASSET_IDS.includes(id), `${id} missing from the asset id list`);
  }
});

test('every camp asset resolves to an item icon', () => {
  for (const id of Object.keys(CAMP)) {
    assert.doesNotThrow(() => authoredPropItemUrl(id), `${id} has no icon`);
  }
});

test('every camp asset is declared in the Blender manifest', () => {
  const byId = new Map(manifest.assets.map((asset) => [asset.assetId, asset]));
  for (const [id, spec] of Object.entries(CAMP)) {
    const asset = byId.get(id);
    assert.ok(asset, `${id} missing from the props manifest`);
    assert.equal(asset.category, 'world-prop');
    assert.equal(asset.shape, spec.shape);
    for (const key of ['primary', 'secondary', 'accent']) {
      assert.match(asset.palette[key], /^#[0-9a-f]{6}$/, `${id} palette.${key}`);
    }
    assert.deepEqual(asset.frameSize, [256, 256], `${id} needs the 256px detail frame`);
  }
});

test('every camp shape has a builder branch', () => {
  for (const spec of Object.values(CAMP)) {
    assert.ok(
      builderSource.includes(`elif shape == '${spec.shape}':`),
      `create-hmh-authored-props.py has no branch for ${spec.shape}`,
    );
  }
});

test('every camp silhouette holds its proportion in the rendered atlas', () => {
  const frames = new Map(atlas.frames.map((frame) => [frame.assetId, frame]));
  for (const [id, spec] of Object.entries(CAMP)) {
    const frame = frames.get(id);
    assert.ok(frame, `${id} is not in the packed atlas`);
    const ratio = frame.frame.h / frame.frame.w;
    assert.ok(
      ratio >= spec.minRatio,
      `${id} renders ${frame.frame.w}x${frame.frame.h} (h/w ${ratio.toFixed(2)}, needs ${spec.minRatio})`,
    );
    assert.ok(frame.opaquePixels > 400, `${id} has only ${frame.opaquePixels} opaque pixels`);
  }
});

// W3. The kit exists to mark where enemies come from, so it has to be
// attached to encounter regions, not sprinkled as generic dressing.
test('the camp kit declares encampments tied to encounter regions', () => {
  assert.ok(Array.isArray(AUTHORED_CAMP_KIT), 'camp kit must be exported as a list');
  assert.ok(AUTHORED_CAMP_KIT.length >= 4, `only ${AUTHORED_CAMP_KIT.length} encampments authored`);
  for (const camp of AUTHORED_CAMP_KIT) {
    assert.match(camp.id, /^camp:/);
    assert.ok(typeof camp.districtId === 'string' && camp.districtId.length > 0);
    assert.ok(Number.isFinite(camp.x) && Number.isFinite(camp.y), `${camp.id} has no anchor`);
    assert.ok(camp.x >= 0 && camp.x <= 12_000 && camp.y >= 0 && camp.y <= 4_800, `${camp.id} out of bounds`);
    assert.ok(Array.isArray(camp.propIds) && camp.propIds.length >= 3, `${camp.id} is too thin to read as a camp`);
    for (const id of camp.propIds) {
      assert.ok(AUTHORED_PROP_ASSET_IDS.includes(id), `${camp.id} references unknown prop ${id}`);
    }
  }
});

test('encampments spread across districts rather than stacking in one', () => {
  const districts = new Set(AUTHORED_CAMP_KIT.map((camp) => camp.districtId));
  assert.ok(districts.size >= 3, `encampments only reach ${districts.size} districts`);
});

test('every camp prop is actually placed somewhere in the world', () => {
  const dressing = buildAuthoredWorldPropPlacements({ worldId: 'forked-frontier', seed: 'a7-camps' });
  const placed = new Set(dressing.map((placement) => placement.assetId));
  for (const camp of AUTHORED_CAMP_KIT) {
    for (const id of camp.propIds) placed.add(id);
  }
  for (const id of Object.keys(CAMP)) {
    assert.ok(placed.has(id), `${id} renders into the atlas but is never placed`);
  }
});

// A camp is a composition, not a pile. Every encampment needs at least one
// tall element or it reads as scattered ground clutter from the 55-degree
// camera -- the same failure mode the asset waves kept hitting.
test('every encampment carries a vertical element', () => {
  const tall = new Set(['watch-platform', 'faction-banner']);
  for (const camp of AUTHORED_CAMP_KIT) {
    assert.ok(
      camp.propIds.some((id) => tall.has(id)),
      `${camp.id} has no tall prop, so it reads as ground clutter`,
    );
  }
});

// The safety property for this slice. Camp dressing frames an encounter; it
// must not stand in the middle of one. Projection-only sprites carry no
// collision, but they can still occlude actors, and an arena is exactly where
// the player most needs to read what is happening.
test('encampment props ring the arena edge and stay off the fighting floor', async () => {
  const { buildAuthoredEncampmentPlacements } = await import('../apps/hmh-reboot/src/authored-prop-atlas.mjs');
  const placements = buildAuthoredEncampmentPlacements({ worldId: 'forked-frontier' });
  assert.ok(placements.length >= 16, `only ${placements.length} encampment placements`);
  assert.deepEqual(
    placements,
    buildAuthoredEncampmentPlacements({ worldId: 'forked-frontier' }),
    'encampment placement must be deterministic',
  );
  const campById = new Map(AUTHORED_CAMP_KIT.map((camp) => [camp.id, camp]));
  for (const placement of placements) {
    const camp = campById.get(placement.campId);
    assert.ok(camp, `${placement.id} has no camp`);
    const distance = Math.hypot(placement.x - camp.x, placement.y - camp.y);
    assert.ok(
      distance >= camp.radius * 0.7,
      `${placement.id} sits ${Math.round(distance)} from the arena centre (radius ${camp.radius}); that is on the fighting floor`,
    );
    assert.ok(distance <= camp.radius, `${placement.id} drifted outside its arena`);
    assert.equal(placement.category, 'encampment');
    assert.equal(placement.runtimeAuthority, 'projection-only');
  }
});

// An encampment that is built but never handed to the display is invisible
// work -- the same trap as a roster entry that is never placed.
test('encampments are wired into the runtime placement list', () => {
  const source = readFileSync(
    fileURLToPath(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url)),
    'utf8',
  );
  assert.match(source, /buildAuthoredEncampmentPlacements\(\{ worldId: LEVEL_ONE_WORLD\.id \}\)/);
});

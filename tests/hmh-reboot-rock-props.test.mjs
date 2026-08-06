import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  authoredPropItemUrl,
  buildAuthoredWorldPropPlacements,
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

// A3. Only granite-boulder and moss-boulder existed, and cliffs were procedural
// blocker art with nothing authored on them. Rock types legitimately differ in
// proportion -- a spire is a needle, a scree pile is a heap -- so each carries
// its own minimum height-to-width rather than one blanket threshold.
//
// Calibration is the same roster used for A2: driftwood-log 0.30 failed and is
// still held out of dressing; granite-boulder 0.62 and hashwood-stump 0.76
// ship. Nothing here is allowed below 0.55.
const ROCKS = Object.freeze({
  'rock-spire': { shape: 'rock-spire', minRatio: 1.40 },
  'rock-shelf': { shape: 'rock-shelf', minRatio: 0.55 },
  'scree-pile': { shape: 'scree-pile', minRatio: 0.55 },
  'cliff-face': { shape: 'cliff-face', minRatio: 0.75 },
  'balanced-boulder': { shape: 'balanced-boulder', minRatio: 0.95 },
  'ore-vein-rock': { shape: 'ore-vein-rock', minRatio: 0.60 },
});

test('every rock asset is on the world-prop roster', () => {
  for (const id of Object.keys(ROCKS)) {
    assert.equal(manifest.assets.find((asset) => asset.assetId === id)?.category, 'world-prop', `${id} missing from the authored manifest`);
  }
});

test('every rock asset resolves to an item icon', () => {
  for (const id of Object.keys(ROCKS)) {
    assert.doesNotThrow(() => authoredPropItemUrl(id), `${id} has no icon`);
  }
});

test('every rock asset is declared in the Blender manifest', () => {
  const byId = new Map(manifest.assets.map((asset) => [asset.assetId, asset]));
  for (const [id, spec] of Object.entries(ROCKS)) {
    const asset = byId.get(id);
    assert.ok(asset, `${id} missing from the props manifest`);
    assert.equal(asset.category, 'world-prop');
    assert.equal(asset.shape, spec.shape);
    for (const key of ['primary', 'secondary', 'accent']) {
      assert.match(asset.palette[key], /^#[0-9a-f]{6}$/, `${id} palette.${key}`);
    }
    assert.deepEqual(asset.frameSize, [256, 256], `${id} needs the 256px detail frame`);
    assert.ok(asset.runtimeScale > 0 && asset.runtimeScale <= 1.6, `${id} runtimeScale out of range`);
  }
});

test('every rock shape has a builder branch', () => {
  for (const spec of Object.values(ROCKS)) {
    assert.ok(
      builderSource.includes(`elif shape == '${spec.shape}':`),
      `create-hmh-authored-props.py has no branch for ${spec.shape}`,
    );
  }
});

// Deliberate hold-out, same policy as driftwood-log. balanced-boulder failed
// three authoring passes: a cap on a pedestal reads as a mushroom stalk and
// head whatever proportions it is given. It stays in the atlas so the source
// and the byte ledger keep tracking it, but it is not dressed into the world
// until it is re-concepted. Listed here rather than silently omitted so the
// hold-out is visible and has to be justified if it grows.
const HELD_OUT_OF_DRESSING = Object.freeze(['balanced-boulder']);

test('every rock asset is actually placed in a district', () => {
  const dressing = buildAuthoredWorldPropPlacements({ worldId: 'forked-frontier', seed: 'a3-rocks' });
  const placed = new Set(dressing.map((placement) => placement.assetId));
  for (const id of Object.keys(ROCKS)) {
    if (HELD_OUT_OF_DRESSING.includes(id)) {
      assert.ok(!placed.has(id), `${id} is held out of dressing but was placed`);
      continue;
    }
    assert.ok(placed.has(id), `${id} renders into the atlas but is never placed`);
  }
});

test('the dressing hold-out list stays small and stays in the atlas', () => {
  // A hold-out is a debt, not a hiding place. If this list grows the art is
  // not landing and the concept needs revisiting, not another entry.
  assert.ok(HELD_OUT_OF_DRESSING.length <= 1, 'too many rocks held out of dressing');
  for (const id of HELD_OUT_OF_DRESSING) {
    assert.ok(atlas.frames.some((frame) => frame.assetId === id), `${id} must stay in the atlas while held out`);
  }
});

test('rock dressing reaches the stone-heavy districts', () => {
  const dressing = buildAuthoredWorldPropPlacements({ worldId: 'forked-frontier', seed: 'a3-rocks' });
  const districts = new Set(
    dressing.filter((placement) => placement.assetId in ROCKS).map((placement) => placement.districtId),
  );
  // The ravine is the rock biome; the mining camp is where ore-veined stone
  // belongs. Both must actually receive rock dressing.
  assert.ok(districts.has('rugpull-ravine'), 'the ravine got no authored rock');
  assert.ok(districts.has('mining-camp'), 'the mining camp got no authored rock');
  assert.ok(districts.size >= 3, `rock dressing only reached ${districts.size} districts`);
});

test('every rock silhouette holds its proportion in the rendered atlas', () => {
  const frames = new Map(atlas.frames.map((frame) => [frame.assetId, frame]));
  for (const [id, spec] of Object.entries(ROCKS)) {
    const frame = frames.get(id);
    assert.ok(frame, `${id} is not in the packed atlas`);
    const ratio = frame.frame.h / frame.frame.w;
    assert.ok(
      ratio >= spec.minRatio,
      `${id} renders ${frame.frame.w}x${frame.frame.h} (h/w ${ratio.toFixed(2)}, needs ${spec.minRatio}); `
      + 'flat wide rock reads as ground texture, not as an object, at the 55-degree camera',
    );
    assert.ok(frame.opaquePixels > 400, `${id} has only ${frame.opaquePixels} opaque pixels`);
  }
});

// Established twice in earlier cycles and worth keeping enforced: smooth
// spheres read badly in this projection, so rock must be faceted. The builder
// helper `sphere()` applies shade_smooth, which is exactly what to avoid here.
test('rock builders do not use smooth spheres', () => {
  for (const spec of Object.values(ROCKS)) {
    const start = builderSource.indexOf(`elif shape == '${spec.shape}':`);
    assert.ok(start > 0, `${spec.shape} branch not found`);
    const rest = builderSource.slice(start + 10);
    const nextElif = rest.indexOf('    elif shape ==');
    const nextElse = rest.indexOf('\n    else:\n');
    const bounds = [nextElif, nextElse].filter((pos) => pos !== -1);
    const branch = rest.slice(0, bounds.length ? Math.min(...bounds) : rest.length);
    assert.ok(
      !branch.includes('sphere('),
      `${spec.shape} uses sphere(), which shades smooth; facet rock instead`,
    );
  }
});

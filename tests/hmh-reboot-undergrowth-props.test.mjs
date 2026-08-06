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

// A2. Nothing existed between "tree" and "bare ground": the six world-prop
// nature assets were all trees, boulders or reeds, so every district read as
// scattered large objects on empty fill. These are the mid and low layer.
const UNDERGROWTH = Object.freeze({
  'scrub-bush': 'scrub-bush',
  'fern-cluster': 'fern-cluster',
  'grass-tuft': 'grass-tuft',
  'thorn-bramble': 'thorn-bramble',
  'flowering-weeds': 'flowering-weeds',
  'hanging-vines': 'hanging-vines',
});

test('every undergrowth asset is on the world-prop roster', () => {
  for (const id of Object.keys(UNDERGROWTH)) {
    assert.equal(manifest.assets.find((asset) => asset.assetId === id)?.category, 'world-prop', `${id} missing from the authored manifest`);
  }
});

// The Cycle 038 lesson, generalised: authoredPropItemUrl throws on an unknown
// id and callers set that URL inside render loops, so a roster entry without
// art breaks a panel silently rather than loudly.
test('every undergrowth asset resolves to an item icon', () => {
  for (const id of Object.keys(UNDERGROWTH)) {
    assert.doesNotThrow(() => authoredPropItemUrl(id), `${id} has no icon`);
  }
});

test('every undergrowth asset is declared in the Blender manifest', () => {
  const byId = new Map(manifest.assets.map((asset) => [asset.assetId, asset]));
  for (const [id, shape] of Object.entries(UNDERGROWTH)) {
    const asset = byId.get(id);
    assert.ok(asset, `${id} missing from the props manifest`);
    assert.equal(asset.category, 'world-prop');
    assert.equal(asset.shape, shape);
    for (const key of ['primary', 'secondary', 'accent']) {
      assert.match(asset.palette[key], /^#[0-9a-f]{6}$/, `${id} palette.${key}`);
    }
    // Foliage silhouettes need the detail frame; 128px loses the blade edges
    // that make undergrowth read as undergrowth rather than a green blob.
    assert.deepEqual(asset.frameSize, [256, 256], `${id} needs the 256px detail frame`);
    assert.ok(asset.runtimeScale > 0 && asset.runtimeScale <= 1.2, `${id} runtimeScale out of range`);
  }
});

test('every undergrowth shape has a builder branch', () => {
  for (const shape of Object.values(UNDERGROWTH)) {
    assert.ok(
      builderSource.includes(`elif shape == '${shape}':`),
      `create-hmh-authored-props.py has no branch for ${shape}`,
    );
  }
});

// An asset that renders into the atlas but is never placed is dead weight: it
// costs atlas bytes and buys nothing on screen. driftwood-log is the one
// deliberate exception and it is documented as such.
test('every undergrowth asset is actually placed in a district', () => {
  const dressing = buildAuthoredWorldPropPlacements({ worldId: 'forked-frontier', seed: 'a2-undergrowth' });
  const placed = new Set(dressing.map((placement) => placement.assetId));
  for (const id of Object.keys(UNDERGROWTH)) {
    assert.ok(placed.has(id), `${id} renders into the atlas but is never placed`);
  }
});

test('undergrowth spreads across biomes rather than piling into one', () => {
  const dressing = buildAuthoredWorldPropPlacements({ worldId: 'forked-frontier', seed: 'a2-undergrowth' });
  const districts = new Set(
    dressing.filter((placement) => placement.assetId in UNDERGROWTH).map((placement) => placement.districtId),
  );
  assert.ok(districts.size >= 4, `undergrowth only reached ${districts.size} districts`);
});

// Hard-won: horizontal, low-lying shapes fail at the 55-degree camera --
// driftwood-log failed three passes before being re-concepted, and it is still
// held out of district dressing. This asserts on the SHIPPED silhouette rather
// than on the builder source, because the source says nothing about what the
// camera actually sees.
//
// Measured over the nature props already in the atlas:
//   driftwood-log  0.30  <- the documented failure, held out of dressing
//   granite-boulder 0.62    hashwood-stump 0.76    hashwood-pine 0.99
//   moss-boulder    1.05    hashwood-tree  1.13    reed-cluster  1.33
//   dead-pine       2.10
// Undergrowth is small in world scale, so it has to earn its read through
// vertical proportion. 0.75 sits above every shape that failed and below every
// standing plant that ships.
const MIN_HEIGHT_TO_WIDTH = 0.75;

test('every undergrowth silhouette stands up in the rendered atlas', () => {
  const frames = new Map(atlas.frames.map((frame) => [frame.assetId, frame]));
  for (const id of Object.keys(UNDERGROWTH)) {
    const frame = frames.get(id);
    assert.ok(frame, `${id} is not in the packed atlas`);
    const ratio = frame.frame.h / frame.frame.w;
    assert.ok(
      ratio >= MIN_HEIGHT_TO_WIDTH,
      `${id} renders ${frame.frame.w}x${frame.frame.h} (h/w ${ratio.toFixed(2)}); `
      + `below ${MIN_HEIGHT_TO_WIDTH} it reads as ground litter at the 55-degree camera, like driftwood-log at 0.30`,
    );
    // A silhouette can be tall and still be too sparse to see. reed-cluster,
    // the closest shipping analogue, carries ~1,300 opaque pixels.
    assert.ok(frame.opaquePixels > 400, `${id} has only ${frame.opaquePixels} opaque pixels`);
  }
});

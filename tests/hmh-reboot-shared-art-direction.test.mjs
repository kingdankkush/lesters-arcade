import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

/**
 * Heroes, the enemy roster and the authored props each carried their own light
 * rig. The rim light was warm orange on heroes, green on enemies and cyan on
 * props; the fill was cool on two families and warm on the third. Rendered into
 * one world they read as three different games.
 *
 * The rig is now one JSON file that every pipeline loads. These tests exist to
 * stop a fourth rig from being pasted in beside it.
 */

const rigUrl = new URL('../scripts/hmh-blender/hmh-light-rig.json', import.meta.url);
// create-hmh-commando-concepts.py builds the SHIPPED hero scene, consumed by
// create-hmh-production-hero-pilot.py. create-hmh-character-template.py is the
// older template. Both are listed so neither can drift.
const PIPELINES = [
  'create-hmh-commando-concepts.py',
  'create-hmh-character-template.py',
  'create-hmh-enemy-roster.py',
  'create-hmh-authored-props.py',
  // The external-model importer builds its own EEVEE scene when it runs
  // standalone, and it reads the rim colour for the look-dev group. It is the
  // newest place a fifth light rig could be pasted in.
  'import-hmh-external-model.py',
];

const readPipeline = (name) =>
  readFile(new URL(`../scripts/hmh-blender/${name}`, import.meta.url), 'utf8');

test('the shared rig is well formed and projection-only', async () => {
  const rig = JSON.parse(await readFile(rigUrl, 'utf8'));
  assert.equal(rig.id, 'hmh-shared-light-rig-v1');
  assert.equal(rig.runtimeAuthority, 'projection-only');
  for (const channel of ['key', 'fill', 'rim']) {
    const color = rig.colors[channel];
    assert.equal(color.length, 3, `${channel} needs an RGB triple`);
    for (const component of color) {
      assert.ok(component >= 0 && component <= 1, `${channel} component out of range`);
    }
  }
  // Energy is per family on purpose — see the rig's `contract` field. Colour is
  // the shared part; imposing one key/fill ratio on every family washed the
  // contrast out of the props.
  for (const family of ['hero', 'enemy', 'prop']) {
    for (const channel of ['key', 'fill', 'rim']) {
      assert.ok(rig.energy[family][channel] > 0, `${family} ${channel} needs an energy`);
    }
    assert.ok(rig.energy[family].fill < rig.energy[family].key, `${family} fill must stay below its key`);
  }
});

test('the rig encodes the intended direction: cool key and fill, one warm rim', async () => {
  const rig = JSON.parse(await readFile(rigUrl, 'utf8'));
  const [keyR, , keyB] = rig.colors.key;
  const [fillR, , fillB] = rig.colors.fill;
  const [rimR, , rimB] = rig.colors.rim;
  assert.ok(keyB > keyR, 'the key must be cool');
  assert.ok(fillB > fillR, 'the fill must be cool — a warm fill is what made props look foreign');
  assert.ok(rimR > rimB, 'the rim is the single warm accent');
});

test('every authored-asset pipeline loads the shared rig instead of its own', async () => {
  for (const pipeline of PIPELINES) {
    const source = await readPipeline(pipeline);
    assert.match(source, /shared_light_channels\(/, `${pipeline} must load the shared rig`);
    assert.match(source, /hmh-light-rig\.json/, `${pipeline} must reference the rig file`);
  }
});

test('no pipeline hard-codes a light colour or energy beside the shared rig', async () => {
  for (const pipeline of PIPELINES) {
    const source = await readPipeline(pipeline);
    // A literal assignment to .energy or .color on a light is the exact shape
    // of the drift this replaces.
    const strayEnergy = source.match(/\.energy\s*=\s*[\d.]+/g) ?? [];
    assert.deepEqual(strayEnergy, [], `${pipeline} hard-codes light energy: ${strayEnergy.join(', ')}`);
    // Scoped to light data specifically: `scene.world.color` is the background
    // and is not part of the rig.
    const strayColor = (source.match(/^.*\.color\s*=\s*\(\s*[\d.]+\s*,.*$/gm) ?? [])
      .filter((line) => !/world\.color/.test(line))
      .map((line) => line.trim());
    assert.deepEqual(strayColor, [], `${pipeline} hard-codes a light colour: ${strayColor.join(', ')}`);
  }
});

test('the pipelines load the rig before they use it', async () => {
  // The loader was first appended below the `if __name__ == "__main__"` guard,
  // where it is defined too late for main() to call.
  for (const pipeline of PIPELINES) {
    const source = await readPipeline(pipeline);
    const definedAt = source.indexOf('def shared_light_channels');
    const guardAt = source.indexOf('if __name__');
    assert.ok(definedAt > 0, `${pipeline} has no loader`);
    if (guardAt > 0) {
      assert.ok(definedAt < guardAt, `${pipeline} defines the loader after its entry point`);
    }
    assert.ok(definedAt < source.indexOf('shared_light_channels('), `${pipeline} uses the loader before defining it`);
  }
});

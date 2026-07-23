import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const manifestUrl = new URL('../apps/hmh-reboot/assets/source/blender/hmh-commando-concepts.json', import.meta.url);
const metricsUrl = new URL('../docs/hmh-reboot/assets/hmh-commando-concepts-metrics.json', import.meta.url);
const sheetUrl = new URL('../docs/hmh-reboot/assets/hmh-commando-concepts.png', import.meta.url);
const blendUrl = new URL('../apps/hmh-reboot/assets/source/blender/hmh-commando-concepts.blend', import.meta.url);

async function loadJson(url) {
  return JSON.parse(await readFile(url, 'utf8'));
}

test('commando concept manifest defines three canon-safe variants per starter with hitbox parity', async () => {
  const manifest = await loadJson(manifestUrl);

  assert.equal(manifest.schema, 'hmh-reboot-commando-concepts-v1');
  assert.deepEqual(manifest.directions, ['south', 'east', 'north']);
  assert.deepEqual(manifest.directionAngles, { south: 45, east: 135, north: 225 });
  assert.equal(manifest.render.engine, 'BLENDER_EEVEE');
  assert.deepEqual(manifest.render.frameSize, [256, 256]);
  assert.equal(manifest.gameplayBodyProfile, 'human-medium-collision-v1');
  assert.equal(manifest.actors.length, 2);

  const male = manifest.actors.find((actor) => actor.id === 'lit-commando');
  const female = manifest.actors.find((actor) => actor.id === 'lit-valkyrie');
  assert.ok(male, 'lit-commando concept family must exist');
  assert.ok(female, 'lit-valkyrie concept family must exist');

  assert.equal(male.gameplayBodyProfile, manifest.gameplayBodyProfile);
  assert.equal(female.gameplayBodyProfile, manifest.gameplayBodyProfile);
  assert.deepEqual(male.identityCues, ['silver armor', 'Litecoin blue armor', 'cyan visor', 'broad tank silhouette']);
  assert.deepEqual(female.identityCues, ['teal plasma armor', 'short teal hair', 'agile silhouette']);

  assert.deepEqual(male.variants.map((variant) => variant.id), [
    'reserve-vanguard',
    'hashstorm-breacher',
    'frontier-ranger',
  ]);
  assert.deepEqual(female.variants.map((variant) => variant.id), [
    'plasma-striker',
    'circuit-valkyrie',
    'aurora-scout',
  ]);

  for (const actor of manifest.actors) {
    assert.equal(actor.variants.length, 3);
    for (const variant of actor.variants) {
      assert.equal(variant.gameplayBodyProfile, manifest.gameplayBodyProfile);
      assert.ok(variant.silhouette.length >= 2, `${actor.id}/${variant.id} needs silhouette cues`);
      assert.ok(variant.materials.length >= 3, `${actor.id}/${variant.id} needs material cues`);
      assert.ok(variant.weaponSocket === 'weapon_socket', `${actor.id}/${variant.id} must share the weapon socket`);
    }
  }

  const lillyReserved = new Set(['long teal hair', 'black glasses', 'gold and teal tactical armor']);
  for (const variant of female.variants) {
    for (const cue of variant.silhouette) {
      assert.equal(lillyReserved.has(cue), false, `${variant.id} must not consume Lilly identity cue: ${cue}`);
    }
  }
});

test('commando concepts are reproducible repository-owned evidence, not runtime authority', async () => {
  const manifest = await loadJson(manifestUrl);
  const packageJson = await loadJson(new URL('../package.json', import.meta.url));

  assert.equal(packageJson.scripts['assets:hmh:commando-concepts'], 'python scripts/run-hmh-commando-concepts.py');
  assert.equal(manifest.scene.sourceBlend, 'apps/hmh-reboot/assets/source/blender/hmh-commando-concepts.blend');
  assert.equal(manifest.output.contactSheet, 'docs/hmh-reboot/assets/hmh-commando-concepts.png');
  assert.equal(manifest.output.metrics, 'docs/hmh-reboot/assets/hmh-commando-concepts-metrics.json');
  assert.equal(manifest.runtimeClassification, 'concept-review-only');

  await Promise.all([access(blendUrl), access(sheetUrl), access(metricsUrl)]);
  const metrics = await loadJson(metricsUrl);
  assert.equal(metrics.schema, 'hmh-reboot-commando-concept-metrics-v1');
  assert.equal(metrics.status, 'pass');
  assert.equal(metrics.conceptCount, 6);
  assert.equal(metrics.directionCount, 3);
  assert.equal(metrics.renderCount, 18);
  assert.equal(metrics.gameplayBodyProfile, manifest.gameplayBodyProfile);
  assert.equal(metrics.externalDependencyCount, 0);
  assert.equal(metrics.reproducibility, 'pass');
  assert.equal(metrics.reproducibilityMode, 'bounded-premultiplied-rgba-v1');
  assert.ok(metrics.reproducibilityObserved.maxChangedVisiblePixels <= metrics.reproducibilityBudget.maxChangedVisiblePixels);
  assert.ok(metrics.reproducibilityObserved.maxChannelDelta <= metrics.reproducibilityBudget.maxChannelDelta);
  assert.ok(metrics.reproducibilityObserved.maxTotalChannelDelta <= metrics.reproducibilityBudget.maxTotalChannelDelta);
  assert.match(metrics.sourceBlendSha256, /^[0-9a-f]{64}$/);
  assert.match(metrics.contactSheetSha256, /^[0-9a-f]{64}$/);
});

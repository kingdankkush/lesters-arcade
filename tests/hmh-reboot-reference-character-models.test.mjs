import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const repo = new URL('../', import.meta.url);
const referenceManifestUrl = new URL('apps/hmh-reboot/assets/source/blender/hmh-reference-character-models.json', repo);
const productionManifestUrl = new URL('apps/hmh-reboot/assets/source/blender/hmh-production-heroes.json', repo);
const builderUrl = new URL('scripts/hmh-blender/create-hmh-production-hero-pilot.py', repo);
const browserSmokeUrl = new URL('scripts/hmh-reboot-production-hero-browser-smoke.mjs', repo);

const referenceManifest = JSON.parse(await readFile(referenceManifestUrl, 'utf8'));
const productionManifest = JSON.parse(await readFile(productionManifestUrl, 'utf8'));
const builderSource = await readFile(builderUrl, 'utf8');
const browserSmokeSource = await readFile(browserSmokeUrl, 'utf8');
const byActor = Object.fromEntries(referenceManifest.models.map((model) => [model.actorId, model]));

test('user-supplied Lester and Lilly references lock four distinct human hero model identities', () => {
  assert.equal(referenceManifest.schema, 'hmh-reference-character-models-v1');
  assert.equal(referenceManifest.blenderVersion, '5.1.2');
  assert.deepEqual(Object.keys(byActor).sort(), ['lester-original', 'lilly', 'lit-commando', 'lit-valkyrie']);
  assert.equal(referenceManifest.runtimeScale.hero, 0.58);
  assert.equal(referenceManifest.runtimeScale.enemy, 0.50);
  assert.equal(referenceManifest.runtimeScale.rule, 'enemies-and-heroes-share-comparable-human-world-height');

  assert.deepEqual(byActor['lester-original'].immutableIdentity, [
    'spherical-lester-blue-logo-head',
    'large-expressive-eyes-and-smile',
    'blue-neck-scarf-with-two-tails',
    'olive-tactical-vest-and-webbing',
    'brass-ammo-bandolier',
    'tan-cargo-trousers',
    'fingerless-gloves-and-black-combat-boots',
  ]);
  assert.equal(byActor.lilly.hair.kind, 'long-layered-wavy-teal');
  assert.ok(byActor.lilly.hair.minimumRiggedLocks >= 9);
  assert.ok(byActor.lilly.immutableIdentity.includes('round-teal-lens-glasses'));
  assert.ok(byActor['lit-commando'].immutableIdentity.includes('rambo-army-commando-silhouette'));
  assert.ok(byActor['lit-commando'].immutableIdentity.includes('human-face-no-helmet-or-mech-head'));
  assert.equal(byActor['lit-valkyrie'].hair.kind, 'long-platinum-braid-and-ponytail');
  assert.ok(byActor['lit-valkyrie'].immutableIdentity.includes('female-rambo-army-commando-silhouette'));
  for (const model of Object.values(byActor)) {
    assert.equal(model.anatomy, 'human');
    assert.equal(model.runtimeAuthority, 'projection-only');
    assert.equal(model.gameplayBodyProfile, 'human-medium-collision-v1');
  }
});

test('enemy hurtbox generosity is specified but isolated from this projection-only model cycle', () => {
  assert.deepEqual(referenceManifest.hitboxPlan.currentEnemyHurtCapsule, {
    radiusFactor: 0.72,
    axisHalfLength: 8,
  });
  assert.deepEqual(referenceManifest.hitboxPlan.proposedEnemyHurtCapsule, {
    radiusFactor: 0.90,
    axisHalfLength: 10,
  });
  assert.equal(referenceManifest.hitboxPlan.status, 'planned-separate-deterministic-gameplay-cycle');
  assert.equal(referenceManifest.hitboxPlan.collisionBodiesChange, false);
  assert.equal(referenceManifest.hitboxPlan.intent, 'larger-forgiving-projectile-target-without-changing-physical-collision');
});

test('Cycle 028 consumes a fail-closed Lester reference detail kit and records authored geometry', () => {
  const lester = byActor['lester-original'];
  assert.equal(lester.implementationStatus, 'cycle-028-implemented');
  assert.equal(lester.detailKit.kind, 'reference-lester-combat-v1');
  assert.ok(lester.detailKit.minimumAuthoredParts >= 42);
  assert.equal(productionManifest.scene.referenceModelManifest, 'apps/hmh-reboot/assets/source/blender/hmh-reference-character-models.json');
  assert.equal(productionManifest.pilots.find((pilot) => pilot.actorId === 'lester-original').modelSpecId, lester.modelSpecId);
  assert.match(builderSource, /def add_lester_reference_details\(/);
  assert.match(builderSource, /reference-lester-combat-v1/);
  assert.match(builderSource, /Unknown reference detail kit/);
  assert.match(builderSource, /minimumAuthoredParts/);
  assert.match(builderSource, /modelSpecId/);
});

test('Cycle 029 consumes a fail-closed Lilly reference detail kit and records authored geometry', () => {
  const lilly = byActor.lilly;
  assert.equal(lilly.implementationStatus, 'cycle-029-implemented');
  assert.equal(lilly.detailKit.kind, 'reference-lilly-combat-v1');
  assert.ok(lilly.detailKit.minimumAuthoredParts >= 45);
  assert.ok(lilly.hair.minimumRiggedLocks >= 9);
  assert.equal(productionManifest.pilots.find((pilot) => pilot.actorId === 'lilly').modelSpecId, lilly.modelSpecId);
  assert.match(builderSource, /def add_lilly_reference_details\(/);
  assert.match(builderSource, /reference-lilly-combat-v1/);
  assert.match(builderSource, /Lilly reference detail kit has/);
  assert.match(builderSource, /minimumRiggedLocks/);
});

test('Cycle 030 consumes a fail-closed Lit Commando Rambo detail kit and records authored geometry', () => {
  const commando = byActor['lit-commando'];
  assert.equal(commando.implementationStatus, 'cycle-030-implemented');
  assert.equal(commando.detailKit.kind, 'lit-commando-rambo-v1');
  assert.ok(commando.detailKit.minimumAuthoredParts >= 50);
  assert.equal(productionManifest.pilots.find((pilot) => pilot.actorId === 'lit-commando').modelSpecId, commando.modelSpecId);
  assert.match(builderSource, /def add_lit_commando_reference_details\(/);
  assert.match(builderSource, /lit-commando-rambo-v1/);
  assert.match(builderSource, /Lit Commando reference detail kit has/);
});

test('Cycle 031 consumes a fail-closed Lit Valkyrie Rambo detail kit and records authored geometry', () => {
  const valkyrie = byActor['lit-valkyrie'];
  assert.equal(valkyrie.implementationStatus, 'cycle-031-implemented');
  assert.equal(valkyrie.detailKit.kind, 'lit-valkyrie-rambo-v1');
  assert.ok(valkyrie.detailKit.minimumAuthoredParts >= 55);
  assert.ok(valkyrie.hair.minimumRiggedLocks >= 7);
  assert.equal(productionManifest.pilots.find((pilot) => pilot.actorId === 'lit-valkyrie').modelSpecId, valkyrie.modelSpecId);
  assert.match(builderSource, /def add_lit_valkyrie_reference_details\(/);
  assert.match(builderSource, /lit-valkyrie-rambo-v1/);
  assert.match(builderSource, /Lit Valkyrie reference detail kit has/);
  assert.match(builderSource, /Lit Valkyrie reference hair has/);
});

test('production hero mobile evidence follows the compact five-control child ownership contract', () => {
  assert.match(browserSmokeSource, /const controls = await page\.locator\('\[data-hmh-control\]'\)\.count\(\);[\s\S]*?assert\.equal\(controls, 5\)/);
  assert.doesNotMatch(browserSmokeSource, /assert\.equal\(controls, 8\)/);
});

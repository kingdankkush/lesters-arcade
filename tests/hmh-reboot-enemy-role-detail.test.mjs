import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ENEMY_ROSTER_RUNTIME_SCALE } from '../apps/hmh-reboot/src/enemy-roster-atlas.mjs';

const repoUrl = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('apps/hmh-reboot/assets/source/blender/hmh-enemy-roster.json', repoUrl), 'utf8'));
const builderSource = await readFile(new URL('scripts/hmh-blender/create-hmh-enemy-roster.py', repoUrl), 'utf8');
const runtimeSource = await readFile(new URL('apps/hmh-reboot/src/main.mjs', repoUrl), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('package.json', repoUrl), 'utf8'));
const browserSmokeSource = await readFile(new URL('scripts/hmh-reboot-enemy-detail-browser-smoke.mjs', repoUrl), 'utf8');

const actor = (actorId) => manifest.actors.find((entry) => entry.actorId === actorId);

test('Cycle 027 gives the two weakest combat silhouettes explicit front-readable detail kits', () => {
  const forkrunner = actor('forkrunner');
  const gasBomber = actor('gas-bomber');

  assert.deepEqual(forkrunner.detailKit, {
    kind: 'forkrunner-forearm-forks',
    frontReadable: true,
    minimumAuthoredParts: 10,
  });
  assert.deepEqual(gasBomber.detailKit, {
    kind: 'gas-bomber-respirator-rig',
    frontReadable: true,
    minimumAuthoredParts: 11,
  });
});

test('the shipped Blender scene consumes both detail kits and rejects unknown kinds', () => {
  assert.match(builderSource, /def build_role_detail_kit\(/);
  assert.match(builderSource, /kind == "forkrunner-forearm-forks"/);
  assert.match(builderSource, /kind == "gas-bomber-respirator-rig"/);
  assert.match(builderSource, /Unknown detail kit/);
  assert.match(builderSource, /minimumAuthoredParts/);
  assert.match(builderSource, /build_role_detail_kit\([\s\S]*?actor, rig, collection/);
});

test('evidence-safe roster preview instantiates every enemy family for non-vacuous browser art review', () => {
  assert.match(runtimeSource, /const rosterPreviewEnabled = evidenceSafeEnabled && runtimeParams\.get\('rosterPreview'\) === '1'/);
  assert.match(runtimeSource, /const initialEnemyArchetypeIds = rosterPreviewEnabled \? ENEMY_ARCHETYPE_IDS : HMH_OPENING_ENEMY_ARCHETYPE_IDS/);
  assert.match(runtimeSource, /const rosterPreviewOffsets = Object\.freeze/);
  assert.match(runtimeSource, /runtimePlayerSpawn\.x \+ offset\.x/);
  assert.match(runtimeSource, /runtimePlayerSpawn\.y \+ offset\.y/);
  assert.match(runtimeSource, /autoFireEnabled: !rosterPreviewEnabled/);
  assert.match(runtimeSource, /rosterPreviewEnabled \? Number\.MAX_SAFE_INTEGER : directorDebugEnabled \? 1 : 600/);
  assert.match(runtimeSource, /!rosterPreviewEnabled && openingEnemyMovementEnabled\(tick\)/);
  assert.match(runtimeSource, /!rosterPreviewEnabled && openingEnemyAttacksEnabled\(tick\)/);
  assert.match(runtimeSource, /rosterPreviewEnabled[\s\S]*?reason: 'roster-preview'[\s\S]*?: stepEncounterDirector\(/);
});

test('rank-and-file production art uses the reviewed collision-readable projection scale', () => {
  assert.equal(ENEMY_ROSTER_RUNTIME_SCALE, 0.50);
});

test('the role-detail browser gate covers desktop and mobile production roster composition', () => {
  assert.equal(packageJson.scripts['smoke:hmh:enemy-details'], 'node scripts/hmh-reboot-enemy-detail-browser-smoke.mjs');
  assert.match(browserSmokeSource, /rosterPreview=1/);
  assert.match(browserSmokeSource, /production-roster-atlas-v1/);
  assert.match(browserSmokeSource, /width: 1440, height: 900/);
  assert.match(browserSmokeSource, /width: 390, height: 844/);
});

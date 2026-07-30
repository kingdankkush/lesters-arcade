import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ENEMY_ROSTER_RUNTIME_SCALE } from '../apps/hmh-reboot/src/enemy-roster-atlas.mjs';

const repoUrl = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('apps/hmh-reboot/assets/source/blender/hmh-enemy-roster.json', repoUrl), 'utf8'));
const builderSource = await readFile(new URL('scripts/hmh-blender/create-hmh-enemy-roster.py', repoUrl), 'utf8');
const exporterSource = await readFile(new URL('scripts/hmh-blender/export-hmh-enemy-roster.py', repoUrl), 'utf8');
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

test('Cycle 034 gives both close-range undead families explicit role-readable detail and motion profiles', () => {
  const bagholder = actor('bagholder-rusher');
  const whale = actor('whale-enforcer');

  assert.equal(bagholder.identityForm, 'zombie');
  assert.deepEqual(bagholder.detailKit, {
    kind: 'bagholder-undead-scrapper-v1',
    frontReadable: true,
    minimumAuthoredParts: 18,
  });
  assert.deepEqual(bagholder.animationProfile, {
    kind: 'undead-straight-lunge-v1',
  });

  assert.equal(whale.identityForm, 'zombie');
  assert.deepEqual(whale.detailKit, {
    kind: 'whale-enforcer-undead-bruiser-v1',
    frontReadable: true,
    minimumAuthoredParts: 18,
  });
  assert.deepEqual(whale.animationProfile, {
    kind: 'undead-shoulder-charge-v1',
  });
});

test('Cycle 034 detail and motion profiles are fail-closed in the Blender source pipeline', () => {
  assert.match(builderSource, /kind == "bagholder-undead-scrapper-v1"/);
  assert.match(builderSource, /kind == "whale-enforcer-undead-bruiser-v1"/);
  assert.match(exporterSource, /kind == "undead-straight-lunge-v1"/);
  assert.match(exporterSource, /kind == "undead-shoulder-charge-v1"/);
  assert.match(exporterSource, /Unknown enemy animation profile/);
  assert.match(exporterSource, /apply_pose\(rig, actor,/);
});

test('Cycle 034 generated atlases retain the audited detail and animation provenance', async () => {
  for (const [actorId, detailKind, animationKind] of [
    ['bagholder-rusher', 'bagholder-undead-scrapper-v1', 'undead-straight-lunge-v1'],
    ['whale-enforcer', 'whale-enforcer-undead-bruiser-v1', 'undead-shoulder-charge-v1'],
  ]) {
    const metadata = JSON.parse(await readFile(
      new URL(`apps/portal/assets/generated/hmh-reboot-enemy-roster/${actorId}/${actorId}-roster-atlas.json`, repoUrl),
      'utf8',
    ));
    assert.equal(metadata.detailKit.kind, detailKind);
    assert.equal(metadata.detailKit.frontReadable, true);
    assert.ok(metadata.detailKit.minimumAuthoredParts >= 18);
    assert.equal(metadata.animationProfile.kind, animationKind);
    assert.equal(metadata.runtimeAuthority, 'projection-only');
    assert.equal(metadata.gameplayBodyProfile, 'authored-archetype-collision-v1');
  }
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

test('Cycle 032 keeps rank-and-file zombies in the measured human-scale parity band', () => {
  assert.equal(ENEMY_ROSTER_RUNTIME_SCALE, 0.75);
});

test('the role-detail browser gate covers desktop and mobile production roster composition', () => {
  assert.equal(packageJson.scripts['smoke:hmh:enemy-details'], 'node scripts/hmh-reboot-enemy-detail-browser-smoke.mjs');
  assert.match(browserSmokeSource, /rosterPreview=1/);
  assert.match(browserSmokeSource, /production-roster-atlas-v1/);
  assert.match(browserSmokeSource, /width: 1440, height: 900/);
  assert.match(browserSmokeSource, /width: 390, height: 844/);
});

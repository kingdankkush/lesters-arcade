import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ENEMY_ROSTER_RUNTIME_SCALE } from '../apps/hmh-reboot/src/enemy-roster-atlas.mjs';

const repoUrl = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('apps/hmh-reboot/assets/source/blender/hmh-enemy-roster.json', repoUrl), 'utf8'));
const builderSource = await readFile(new URL('scripts/hmh-blender/create-hmh-enemy-roster.py', repoUrl), 'utf8');
const exporterSource = await readFile(new URL('scripts/hmh-blender/export-hmh-enemy-roster.py', repoUrl), 'utf8');
const pipelineSource = await readFile(new URL('scripts/run-hmh-enemy-roster-pipeline.py', repoUrl), 'utf8');
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
    damageResponse: 'snapback-stumble-v1',
  });

  assert.equal(whale.identityForm, 'zombie');
  assert.deepEqual(whale.detailKit, {
    kind: 'whale-enforcer-undead-bruiser-v1',
    frontReadable: true,
    minimumAuthoredParts: 18,
  });
  assert.deepEqual(whale.animationProfile, {
    kind: 'undead-shoulder-charge-v1',
    damageResponse: 'armored-shoulder-absorb-v1',
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

test('Cycle 035 gives the remaining ranged and support families explicit role-readable detail and motion profiles', () => {
  const liquidatorAgent = actor('liquidator-agent');
  const validatorCultist = actor('validator-cultist');

  assert.equal(liquidatorAgent.identityForm, 'human');
  assert.deepEqual(liquidatorAgent.detailKit, {
    kind: 'liquidator-tactical-suppressor-v1',
    frontReadable: true,
    minimumAuthoredParts: 18,
  });
  assert.deepEqual(liquidatorAgent.animationProfile, {
    kind: 'suppression-rifle-burst-v1',
    damageResponse: 'rifle-shoulder-recoil-v1',
  });

  assert.equal(validatorCultist.identityForm, 'zombie');
  assert.deepEqual(validatorCultist.detailKit, {
    kind: 'validator-undead-cultist-v1',
    frontReadable: true,
    minimumAuthoredParts: 18,
  });
  assert.deepEqual(validatorCultist.animationProfile, {
    kind: 'validator-staff-channel-v1',
    damageResponse: 'staff-braced-shock-v1',
  });
});

test('Cycle 035 detail and motion profiles are fail-closed in the Blender source pipeline', () => {
  assert.match(builderSource, /kind == "liquidator-tactical-suppressor-v1"/);
  assert.match(builderSource, /kind == "validator-undead-cultist-v1"/);
  assert.match(exporterSource, /kind == "suppression-rifle-burst-v1"/);
  assert.match(exporterSource, /kind == "validator-staff-channel-v1"/);
  assert.match(builderSource, /Unknown detail kit/);
  assert.match(exporterSource, /Unknown enemy animation profile/);
});

test('Cycle 035 generated atlases retain ranged and support detail, identity, and animation provenance', async () => {
  for (const [actorId, identityForm, detailKind, animationKind] of [
    ['liquidator-agent', 'human', 'liquidator-tactical-suppressor-v1', 'suppression-rifle-burst-v1'],
    ['validator-cultist', 'zombie', 'validator-undead-cultist-v1', 'validator-staff-channel-v1'],
  ]) {
    const metadata = JSON.parse(await readFile(
      new URL(`apps/portal/assets/generated/hmh-reboot-enemy-roster/${actorId}/${actorId}-roster-atlas.json`, repoUrl),
      'utf8',
    ));
    assert.equal(metadata.identityForm, identityForm);
    assert.equal(metadata.detailKit.kind, detailKind);
    assert.equal(metadata.detailKit.frontReadable, true);
    assert.ok(metadata.detailKit.minimumAuthoredParts >= 18);
    assert.equal(metadata.animationProfile.kind, animationKind);
    assert.equal(metadata.runtimeAuthority, 'projection-only');
    assert.equal(metadata.gameplayBodyProfile, 'authored-archetype-collision-v1');
  }
});

test('Cycle 035 cold-scene verification disables stochastic render drift and rebuilds before comparison', () => {
  assert.equal(manifest.render.engine, 'BLENDER_WORKBENCH');
  assert.equal(manifest.render.workbenchLight, 'STUDIO');
  assert.equal(manifest.render.workbenchColorType, 'MATERIAL');
  assert.equal(manifest.render.workbenchCavity, 'WORLD');
  assert.equal(manifest.render.workbenchCavityEnabled, false);
  assert.equal(manifest.render.exposure, 0.55);
  assert.equal(manifest.render.ditherIntensity, 0);
  assert.equal(manifest.render.taaRenderSamples, 1);
  assert.equal(manifest.render.renderScale, 2);
  assert.equal(manifest.render.minAlphaComponentPixels, 9);
  assert.equal(manifest.render.castShadows, false);
  assert.equal(manifest.render.specularIorLevel, 0);
  assert.match(builderSource, /scene\.render\.dither_intensity = manifest\["render"\]\["ditherIntensity"\]/);
  assert.match(builderSource, /scene\.eevee\.taa_render_samples = manifest\["render"\]\["taaRenderSamples"\]/);
  assert.match(builderSource, /use_shadow = manifest\["render"\]\["castShadows"\]/);
  assert.match(builderSource, /inputs\["Specular IOR Level"\]\.default_value = manifest\["render"\]\["specularIorLevel"\]/);
  assert.match(builderSource, /scene\.display\.shading\.light = manifest\["render"\]\["workbenchLight"\]/);
  assert.match(builderSource, /scene\.display\.shading\.color_type = manifest\["render"\]\["workbenchColorType"\]/);
  assert.match(builderSource, /scene\.display\.shading\.cavity_type = manifest\["render"\]\["workbenchCavity"\]/);
  assert.match(builderSource, /show_cavity = manifest\["render"\]\["workbenchCavityEnabled"\]/);
  assert.match(pipelineSource, /def build_scene\(/);
  assert.match(pipelineSource, /if args\.verify_reproducible:[\s\S]*?build_scene\(/);
  assert.match(pipelineSource, /def generated_artifact_hashes\(/);
  assert.match(pipelineSource, /def normalize_rendered_frames\(/);
  assert.match(pipelineSource, /def remove_tiny_alpha_components\(/);
  assert.match(pipelineSource, /minAlphaComponentPixels/);
  assert.match(pipelineSource, /Image\.Resampling\.LANCZOS/);
  assert.match(exporterSource, /parser\.add_argument\("--actor-id", required=True\)/);
  assert.match(pipelineSource, /for actor in manifest\["actors"\]:[\s\S]*?"--actor-id", actor\["actorId"\]/);
  assert.match(pipelineSource, /roster-contact-sheet\.png/);
});

test('evidence-safe roster preview instantiates every enemy family for non-vacuous browser art review', () => {
  assert.match(runtimeSource, /const rosterPreviewEnabled = evidenceSafeEnabled && runtimeParams\.get\('rosterPreview'\) === '1'/);
  assert.match(runtimeSource, /const rosterCombatEnabled = rosterPreviewEnabled && runtimeParams\.get\('rosterCombat'\) === '1'/);
  assert.match(runtimeSource, /const initialEnemyArchetypeIds = rosterPreviewEnabled \? ENEMY_ARCHETYPE_IDS : HMH_OPENING_ENEMY_ARCHETYPE_IDS/);
  assert.match(runtimeSource, /const rosterPreviewOffsets = Object\.freeze/);
  assert.match(runtimeSource, /runtimePlayerSpawn\.x \+ offset\.x/);
  assert.match(runtimeSource, /runtimePlayerSpawn\.y \+ offset\.y/);
  assert.match(runtimeSource, /autoFireEnabled: !rosterPreviewEnabled/);
  assert.match(runtimeSource, /rosterPreviewEnabled \? Number\.MAX_SAFE_INTEGER : directorDebugEnabled \? 1 : 600/);
  assert.match(runtimeSource, /!rosterPreviewEnabled && openingEnemyMovementEnabled\(tick\)/);
  assert.match(runtimeSource, /\(!rosterPreviewEnabled \|\| rosterCombatEnabled\) && openingEnemyAttacksEnabled\(tick\)/);
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

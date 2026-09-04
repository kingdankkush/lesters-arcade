import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ENEMY_ROSTER_RUNTIME_SCALE } from '../apps/hmh-reboot/src/enemy-roster-atlas.mjs';

const repoUrl = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('apps/hmh-reboot/assets/source/blender/hmh-enemy-roster.json', repoUrl), 'utf8'));
const heroManifest = JSON.parse(await readFile(new URL('apps/hmh-reboot/assets/source/blender/hmh-production-heroes.json', repoUrl), 'utf8'));
const heroSceneSource = await readFile(new URL('scripts/hmh-blender/create-hmh-commando-concepts.py', repoUrl), 'utf8');
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

/**
 * Cycle 072/073 (P-4) retires the Cycle 035 Workbench determinism policy.
 * Workbench was adopted because EEVEE cold rebuilds drifted, but it also
 * ignored the shared light rig entirely: the roster shipped under Workbench
 * STUDIO lighting while every hero and prop shipped under the rig's
 * key/fill/rim. A hero and an enemy standing beside each other read as two
 * different games.
 *
 * The determinism spine that replaced the exact-byte gate stays intact: cold
 * scene rebuild before the second pass, supersample + Lanczos downsample, and
 * tiny-alpha-component removal. Two things changed in Cycle 073: the nearest-8
 * RGB quantiser is gone (it turned one-LSB EEVEE jitter on a bucket edge into
 * an eight-step failure and posterised the gradients), and the two passes are
 * compared in the hero pipeline's premultiplied budget form. EEVEE also leaves
 * undefined colour under alpha 0, so `canonical_rgba` zeroes it before any
 * resize or hash.
 */
test('Cycle 073 renders the enemy roster under the hero EEVEE rig with the cold-scene spine intact', () => {
  assert.equal(manifest.render.engine, 'BLENDER_EEVEE');
  assert.equal(manifest.render.engine, heroManifest.render.engine, 'heroes and enemies must share one engine');
  assert.deepEqual(
    Object.keys(manifest.render).filter((key) => key.startsWith('workbench')),
    [],
    'Workbench-only render keys must be deleted, not left dangling',
  );

  // View transform, look and exposure are the hero contract, read from the
  // hero scene builder so the two cannot drift apart silently. Exposure was
  // chosen on a measured luminance ladder: at -0.45 the probe actors sit
  // inside the hero envelope (lower-body 97-115, torso 129-143 mean Rec.709).
  assert.equal(manifest.render.viewTransform, 'AgX');
  assert.equal(manifest.render.look, 'AgX - Medium High Contrast');
  assert.ok(
    heroSceneSource.includes(`scene.view_settings.look = "${manifest.render.look}"`),
    'the enemy look must be the literal the hero scene applies',
  );
  assert.equal(manifest.render.exposure, -0.45);
  assert.equal(manifest.render.exposure, heroManifest.render.exposure, 'one exposure for heroes and enemies');

  // Only Blender 5.1.2 EEVEE names. `use_soft_shadows`, `use_gtao`,
  // `use_bloom` and `shadow_cube_size` do not exist on this build.
  assert.equal(manifest.render.taaRenderSamples, 64);
  assert.equal(manifest.render.ditherIntensity, 0);
  assert.equal(manifest.render.filterSize, 1.5);
  assert.equal(manifest.render.castShadows, true);
  assert.equal(manifest.render.shadowRayCount, 1);
  assert.equal(manifest.render.shadowStepCount, 6);
  assert.equal(manifest.render.shadowResolutionScale, 1);
  assert.equal(manifest.render.shadowFilterRadius, 1);
  assert.equal(manifest.render.useShadowJitter, false);
  assert.equal(manifest.render.useRaytracing, false);
  assert.equal(manifest.render.lightShape, 'DISK');
  assert.deepEqual(manifest.render.lightSizes, { key: 3.0, fill: 2.6, rim: 2.2 });
  assert.deepEqual(manifest.render.world, { color: [0.015, 0.02, 0.05], strength: 0.22 });

  // Determinism knobs that predate the engine flip and must survive it.
  assert.equal(manifest.render.renderScale, 2);
  assert.equal(manifest.render.minAlphaComponentPixels, 9);
  assert.equal(manifest.render.alphaThreshold, 8);
  assert.equal(manifest.render.specularIorLevel, 0);

  assert.match(builderSource, /scene\.render\.dither_intensity = manifest\["render"\]\["ditherIntensity"\]/);
  assert.match(builderSource, /scene\.render\.filter_size = manifest\["render"\]\["filterSize"\]/);
  assert.match(builderSource, /scene\.eevee\.taa_render_samples = manifest\["render"\]\["taaRenderSamples"\]/);
  assert.match(builderSource, /scene\.eevee\.use_shadows = manifest\["render"\]\["castShadows"\]/);
  assert.match(builderSource, /scene\.eevee\.shadow_ray_count = manifest\["render"\]\["shadowRayCount"\]/);
  assert.match(builderSource, /scene\.eevee\.shadow_step_count = manifest\["render"\]\["shadowStepCount"\]/);
  assert.match(builderSource, /scene\.eevee\.shadow_resolution_scale = manifest\["render"\]\["shadowResolutionScale"\]/);
  assert.match(builderSource, /scene\.eevee\.use_raytracing = manifest\["render"\]\["useRaytracing"\]/);
  assert.match(builderSource, /scene\.view_settings\.view_transform = manifest\["render"\]\["viewTransform"\]/);
  assert.match(builderSource, /scene\.view_settings\.look = manifest\["render"\]\["look"\]/);
  assert.match(builderSource, /scene\.view_settings\.exposure = manifest\["render"\]\["exposure"\]/);
  assert.match(builderSource, /\.shape = manifest\["render"\]\["lightShape"\]/);
  assert.match(builderSource, /\.size = manifest\["render"\]\["lightSizes"\]\[channel\]/);
  assert.match(builderSource, /use_shadow = manifest\["render"\]\["castShadows"\]/);
  assert.match(builderSource, /\.shadow_filter_radius = manifest\["render"\]\["shadowFilterRadius"\]/);
  assert.match(builderSource, /\.use_shadow_jitter = manifest\["render"\]\["useShadowJitter"\]/);
  assert.match(builderSource, /inputs\["Specular IOR Level"\]\.default_value = manifest\["render"\]\["specularIorLevel"\]/);
  assert.doesNotMatch(builderSource, /scene\.display\.shading/);
  for (const removed of ['use_soft_shadows', 'use_gtao', 'use_bloom', 'shadow_cube_size']) {
    assert.ok(!builderSource.includes(removed), `${removed} is not a Blender 5.1.2 EEVEE property`);
  }

  // The saved .blend carries the engine; the exporter must refuse a scene that
  // disagrees with the manifest instead of silently rendering the old one.
  assert.match(exporterSource, /scene\.render\.engine != manifest\["render"\]\["engine"\]/);
  assert.match(exporterSource, /raise RuntimeError\(\s*\n?\s*f?"[^"]*render engine/i);
  assert.match(exporterSource, /"engine": scene\.render\.engine/);

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

  // Cycle 073: the quantiser is gone and the comparison is the hero budget form
  // on premultiplied RGBA. tests/hmh-reboot-enemy-roster-reproducibility.test.mjs
  // pins the behaviour; this pins the wiring.
  assert.doesNotMatch(pipelineSource, /canonicalize_rendered_rgb/);
  assert.match(pipelineSource, /def compare_frames_premultiplied\(/);
  assert.match(pipelineSource, /def frames_exceeding_budget\(/);
  assert.deepEqual(manifest.reproducibilityBudget, heroManifest.reproducibilityBudget);

  // EEVEE writes undefined RGB under alpha 0. Lanczos would smear it into the
  // visible edge and both the frame hash and the comparison read all four
  // channels, so the zeroing has to happen inside canonical_rgba, the funnel
  // every read goes through, not after the resize.
  const canonicalStart = pipelineSource.indexOf('def canonical_rgba(');
  const canonicalEnd = pipelineSource.indexOf('\ndef ', canonicalStart + 1);
  assert.ok(canonicalStart > 0 && canonicalEnd > canonicalStart);
  const canonicalRgbaSource = pipelineSource.slice(canonicalStart, canonicalEnd);
  assert.match(canonicalRgbaSource, /alpha = image\.split\(\)/);
  assert.match(canonicalRgbaSource, /alpha\.point\(/);
  assert.match(canonicalRgbaSource, /Image\.new\("L", image\.size, 0\)/);
  assert.match(canonicalRgbaSource, /Image\.composite\(/);
  assert.match(canonicalRgbaSource, /Image\.merge\("RGBA"/);
  assert.match(
    pipelineSource,
    /image = canonical_rgba\(Image\.open\(path\)\)[\s\S]*?normalized = image\.resize\(target_size, Image\.Resampling\.LANCZOS\)/,
  );
  assert.match(pipelineSource, /hashlib\.sha256\(canonical_rgba\(Image\.open\(path\)\)\.tobytes\(\)\)/);
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

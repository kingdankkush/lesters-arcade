import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

/**
 * Cycle 072 P-1/P-2/P-3.
 *
 * The four shipped heroes and the whole enemy roster are built by Python that
 * extrudes primitives and poses a 14-bone rig with trigonometry. The owner's
 * art plan (ChatGPT concept sheet -> Tripo mesh -> Mixamo rig/animation) needs
 * a second, additive path: a committed GLB/FBX imported into the SAME scene,
 * split into the SAME layers, lit by the SAME rig, and rendered by the SAME
 * exporter/packer/reproducibility gates.
 *
 * These tests pin the contract of that path:
 *  - the manifest schema advertises the new optional keys, and they live
 *    BESIDE the pinned `clips` / `animationProfile` objects, never inside;
 *  - the importer exists and does the six things the render depends on;
 *  - both exporters gained a `clipActions` branch that does not disturb the
 *    trigonometric branch the shipped actors still use;
 *  - the throwaway skinned fixture is reproducible and writes nothing into a
 *    shipped directory.
 *
 * Nothing here renders. The rendering proof is
 * `npm run assets:hmh:skinned-test:verify`, which needs Blender 5.1.2.
 */

const readRepo = (relative) => readFile(new URL(`../${relative}`, import.meta.url), 'utf8');
const readJson = async (relative) => JSON.parse(await readRepo(relative));

const SOURCE_DIR = 'apps/hmh-reboot/assets/source/blender';
const HERO_MANIFEST = `${SOURCE_DIR}/hmh-production-heroes.json`;
const ENEMY_MANIFEST = `${SOURCE_DIR}/hmh-enemy-roster.json`;
const SKINNED_MANIFEST = `${SOURCE_DIR}/hmh-skinned-test-actor.json`;
const IMPORTER = 'scripts/hmh-blender/import-hmh-external-model.py';
const FIXTURE = 'scripts/hmh-blender/create-hmh-skinned-test-actor.py';
const HERO_EXPORTER = 'scripts/hmh-blender/export-hmh-production-hero-pilot.py';
const ENEMY_EXPORTER = 'scripts/hmh-blender/export-hmh-enemy-roster.py';
const HERO_RUNNER = 'scripts/run-hmh-production-hero-pilot.py';
const SKINNED_RUNNER = 'scripts/run-hmh-skinned-test-pipeline.py';
const HERO_GENERATOR = 'scripts/hmh-blender/create-hmh-production-hero-pilot.py';
const PIPELINE_DOC = 'docs/hmh-reboot/EXTERNAL-MODEL-PIPELINE.md';

const ALLOWED_SOURCE_MODEL_ROOTS = ['apps/hmh-reboot/assets/source/models/', '.tmp/'];
// 128 is the boss's existing size (it renders at renderScale 2); 160 is the
// shipped hero size; the rest are the steps the external-model path targets.
const ALLOWED_FRAME_SIZES = new Set([128, 160, 192, 256, 512]);

/**
 * The optional keys are only useful if they are uniform across both manifests,
 * so one importer and one exporter branch can read either.
 */
function assertOptionalExternalModelShape(entry, label) {
  if ('sourceModel' in entry) {
    const source = entry.sourceModel;
    assert.equal(typeof source, 'object', `${label} sourceModel must be an object`);
    assert.equal(typeof source.path, 'string', `${label} sourceModel.path must be a string`);
    assert.ok(
      ALLOWED_SOURCE_MODEL_ROOTS.some((prefix) => source.path.startsWith(prefix)),
      `${label} sourceModel.path must be repo-owned source or a .tmp fixture: ${source.path}`,
    );
    assert.ok(['glb', 'gltf', 'fbx'].includes(source.format), `${label} sourceModel.format unsupported`);
    assert.match(source.sourceSha256, /^[0-9a-f]{64}$/, `${label} sourceModel.sourceSha256 must be a SHA-256`);
    assert.ok(source.targetHeight > 0, `${label} sourceModel.targetHeight must be positive`);
    // Without clipActions the exporter would fall through to the trig poser and
    // silently render a T-posed import eight times.
    assert.ok('clipActions' in entry, `${label} declares sourceModel but no clipActions`);
  }
  if ('frameSize' in entry) {
    const [width, height] = entry.frameSize;
    assert.equal(entry.frameSize.length, 2, `${label} frameSize must be [w, h]`);
    assert.equal(width, height, `${label} frameSize must be square`);
    assert.ok(ALLOWED_FRAME_SIZES.has(width), `${label} frameSize ${width} is not a supported step`);
  }
  if ('lookDev' in entry) {
    assert.equal(entry.lookDev, 'hmh-lookdev-v1', `${label} lookDev must name the shared node group`);
  }
  if ('clipActions' in entry) {
    const actions = entry.clipActions;
    for (const [state, action] of Object.entries(actions)) {
      assert.equal(typeof action, 'string', `${label} clipActions.${state} must be an action name`);
      assert.ok(action.length > 0, `${label} clipActions.${state} must not be empty`);
    }
  }
}

test('the hero manifest advertises schema v2 and keeps the four shipped pilots procedural', async () => {
  const manifest = await readJson(HERO_MANIFEST);
  assert.equal(manifest.schema, 'hmh-reboot-production-heroes-v2');
  // The runtime index keys off pipelineId, not schema. Bumping the schema must
  // not orphan apps/hmh-reboot/src/production-hero-atlas.mjs.
  assert.equal(manifest.pipelineId, 'hmh-reboot-production-hero-pilot-v1');
  assert.equal(manifest.pilots.length, 4);
  for (const pilot of manifest.pilots) {
    assertOptionalExternalModelShape(pilot, `hero ${pilot.actorId}`);
    assert.ok(!('sourceModel' in pilot), `${pilot.actorId} must stay procedural until the owner ships a mesh`);
    assert.ok(!('clipActions' in pilot), `${pilot.actorId} must stay on the trig poser`);
    // The new keys are siblings. Anything added inside `clips` or
    // `animationProfile` breaks the deepEqual pins in the sibling suites.
    for (const layerClips of Object.values(pilot.clips)) {
      for (const clip of Object.values(layerClips)) {
        assert.deepEqual(
          Object.keys(clip).filter((key) => !['frames', 'fps', 'loop'].includes(key)),
          [],
          `${pilot.actorId} clip carries a non-clip key`,
        );
      }
    }
    assert.ok(!('sourceModel' in pilot.animationProfile), 'animationProfile must stay closed');
  }
});

test('the enemy manifest advertises schema 2 and, since Cycle 073, renders under EEVEE', async () => {
  const manifest = await readJson(ENEMY_MANIFEST);
  assert.equal(manifest.schema, 2);
  assert.equal(typeof manifest.schema, 'number', 'the enemy schema field has always been numeric');
  assert.equal(manifest.pipelineId, 'hmh-reboot-enemy-roster-v1');
  // P-4 (Cycle 073) moved the roster to the hero EEVEE contract. The schema v2
  // keys beside `clips` are unchanged by that flip.
  assert.equal(manifest.render.engine, 'BLENDER_EEVEE');
  for (const actor of manifest.actors) {
    assertOptionalExternalModelShape(actor, `enemy ${actor.actorId}`);
    assert.ok(!('sourceModel' in actor), `${actor.actorId} must stay procedural`);
  }
});

test('the throwaway skinned fixture writes only into .tmp and never into a shipped directory', async () => {
  const manifest = await readJson(SKINNED_MANIFEST);
  assert.equal(manifest.schema, 'hmh-reboot-production-heroes-v2');
  assert.equal(manifest.pipelineId, 'hmh-reboot-skinned-test-actor-v1');
  assert.equal(manifest.classification, 'pipeline-test-never-ship');
  const tmpPaths = [
    manifest.render.rawOutputDirectory,
    manifest.scene.sourceBlend,
    manifest.atlas.outputDirectory,
  ];
  for (const value of tmpPaths) {
    assert.ok(value.startsWith('.tmp/'), `throwaway output escaped .tmp: ${value}`);
  }
  assert.deepEqual(manifest.render.frameSize, [256, 256]);
  // 160 px pivot [80, 146] scaled to the 256 px frame, same rule as the enemy
  // runner uses for the boss.
  assert.deepEqual(manifest.pivot.sourcePixels, [128, 234]);
  assert.equal(manifest.pilots.length, 1);
  const [pilot] = manifest.pilots;
  assert.equal(pilot.actorId, 'skinned-test');
  assertOptionalExternalModelShape(pilot, 'skinned-test');
  assert.ok(pilot.sourceModel.path.startsWith('.tmp/'), 'the fixture GLB is generated, never committed');
  assert.deepEqual(pilot.frameSize, [256, 256]);
  assert.equal(pilot.lookDev, 'hmh-lookdev-v1');
  // The hero runner indexes pilot["animationProfile"] unconditionally when it
  // writes metadata and metrics.
  assert.equal(typeof pilot.animationProfile, 'object');
  assert.equal(typeof pilot.animationProfile.id, 'string');
});

test('every non-shadow state of the fixture maps to its own Blender action', async () => {
  const manifest = await readJson(SKINNED_MANIFEST);
  const [pilot] = manifest.pilots;
  const states = new Set();
  for (const [layer, clips] of Object.entries(pilot.clips)) {
    if (layer === 'shadow') continue;
    for (const state of Object.keys(clips)) states.add(state);
  }
  assert.deepEqual(
    Object.keys(pilot.clipActions).sort(),
    [...states].sort(),
    'clipActions must cover exactly the non-shadow states',
  );
  // The runner rejects any two decoded-identical non-shadow frames. Two states
  // sharing one action would collide on their shared rest frame.
  const actions = Object.values(pilot.clipActions);
  assert.equal(new Set(actions).size, actions.length, 'each state needs its own action');
});

test('the fixture frame budget matches what the reproducibility gate will count', async () => {
  const manifest = await readJson(SKINNED_MANIFEST);
  const [pilot] = manifest.pilots;
  const directions = manifest.directions.length;
  let total = 0;
  let shadow = 0;
  for (const [layer, clips] of Object.entries(pilot.clips)) {
    for (const clip of Object.values(clips)) {
      total += clip.frames * directions;
      if (layer === 'shadow') shadow += clip.frames * directions;
    }
  }
  assert.equal(total, 248);
  assert.equal(total - shadow, 240, 'the gate requires this many pixel-distinct animated frames');
});

test('the importer covers the six things the deterministic render depends on', async () => {
  const source = await readRepo(IMPORTER);
  for (const needle of [
    'bpy.ops.import_scene.gltf',
    'bpy.ops.import_scene.fbx',
    'def split_skinned_mesh_at_waist',
    'def ensure_weapon_socket',
    'def apply_look_dev',
    'def bind_clip_actions',
    'def import_external_actor',
    'HMH_LookDev_v1',
    'ShaderNodeShaderToRGB',
    'hmh_source_sha256',
    'contentSha256',
    'hmh_runtime_authority',
  ]) {
    assert.ok(source.includes(needle), `importer is missing ${needle}`);
  }
  // Height normalisation must live on a parent Empty. Applying scale to an
  // animated armature leaves fcurve location values un-scaled, so a Mixamo hip
  // translation would come out at the source model's scale.
  assert.match(source, /empty/i, 'the importer must normalise on a parent Empty');
  assert.ok(
    !/transform_apply\([^)]*scale=True[^)]*\)\s*#?\s*(?:armature|rig)/i.test(source),
    'never apply scale to the imported armature',
  );
  // glTF stashes every action in a muted-by-convention NLA track and may key the
  // armature OBJECT. Either would override the exporter's per-direction yaw.
  assert.match(source, /nla_tracks/, 'the importer must handle the glTF NLA stash');
});

test('the importer lights imported actors from the shared rig', async () => {
  const source = await readRepo(IMPORTER);
  assert.match(source, /shared_light_channels\(/);
  assert.match(source, /hmh-light-rig\.json/);
  const definedAt = source.indexOf('def shared_light_channels');
  assert.ok(definedAt > 0, 'the importer needs the shared loader');
  assert.ok(definedAt < source.indexOf('if __name__'), 'loader must be defined before the entry point');
});

test('both exporters gained a clipActions branch without disturbing the trig branch', async () => {
  const hero = await readRepo(HERO_EXPORTER);
  const enemy = await readRepo(ENEMY_EXPORTER);
  for (const [label, source] of [['hero', hero], ['enemy', enemy]]) {
    assert.ok(source.includes('clipActions'), `${label} exporter has no clipActions branch`);
    assert.ok(source.includes('action_slot'), `${label} exporter must bind a slotted action`);
    assert.ok(source.includes('frame_set('), `${label} exporter must sample the action timeline`);
    assert.ok(source.includes('def apply_pose'), `${label} exporter must keep the trig poser`);
    assert.ok(source.includes('def set_clip_action'), `${label} exporter needs the action binder`);
    assert.ok(source.includes('def sample_clip_frame'), `${label} exporter needs the frame sampler`);
  }
  // reset_pose forces rotation_mode = "XYZ" and clears matrix_basis. Imported
  // Mixamo/glTF actions key rotation_quaternion, so calling it before a render
  // freezes the pose at rest.
  assert.match(hero, /apply_pose\([^\n]*pilot\["animationProfile"\]/, 'the trig call must survive verbatim');
  assert.match(enemy, /apply_pose\(rig, actor, state, frame_index, clip\["frames"\], stoop\)/);
});

test('the hero runner can drive a second manifest into a second output root', async () => {
  const source = await readRepo(HERO_RUNNER);
  assert.ok(source.includes('--manifest'), 'runner must accept a manifest override');
  assert.ok(source.includes('--output-root'), 'runner must accept an output-root override');
  assert.ok(source.includes('pilot.get("frameSize"'), 'runner must honour a per-pilot frame size');
  // The pivot is authored against the manifest default frame; a 256 px actor
  // needs it scaled or its ground contact drifts.
  assert.match(source, /frame_size\[\w+\]\s*\/\s*/, 'the pivot must scale with the frame size');
  // Guarding the contact-sheet rows is what lets a reduced clip table render at
  // all: composite_frame opens a PNG per row and per layer.
  assert.match(source, /state in pilot\["clips"\]/, 'contact-sheet rows must be guarded by the clip table');
});

test('the hero generator branches to the importer before it reaches the four hardcoded actors', async () => {
  const source = await readRepo(HERO_GENERATOR);
  assert.ok(source.includes('sourceModel'), 'the generator must recognise an external-model pilot');
  const branchAt = source.indexOf('if "sourceModel" in pilot');
  const hardcodedAt = source.indexOf('{"lester-original", "lilly", "lit-commando", "lit-valkyrie"}');
  assert.ok(branchAt > 0, 'the generator needs an external-model branch');
  assert.ok(hardcodedAt > 0, 'the four-actor set moved; re-anchor this test');
  assert.ok(
    branchAt < hardcodedAt,
    'an external-model pilot must branch before find_reference_model, which fails closed on an unknown actor',
  );
  // The post-loop pose reset forces XYZ on every bone of its rig. Run on an
  // imported quaternion-keyed armature it would flatten the import.
  assert.match(source, /procedural/i, 'the shared-rig reset must be scoped to procedural pilots');
});

test('the throwaway pipeline is a locked, reproducible, gitignored gate', async () => {
  const source = await readRepo(SKINNED_RUNNER);
  assert.match(source, /from hmh_pipeline_lock import exclusive_pipeline_lock/);
  assert.match(source, /with exclusive_pipeline_lock\(/);
  assert.ok(source.includes('contentSha256'), 'P-1 acceptance compares the canonical import inspection');
  assert.ok(source.includes('--verify-reproducible'), 'the gate needs a cold second pass');
  assert.ok(source.includes('.tmp/'), 'every fixture artefact stays under .tmp');
  const fixture = await readRepo(FIXTURE);
  assert.ok(fixture.includes('bpy.ops.export_scene.gltf'), 'the fixture must export a GLB the importer can read');
  assert.ok(fixture.includes('vertex_groups'), 'the fixture must be skinned, not parented');
  for (const action of ['HMH_Idle', 'HMH_Run', 'HMH_Aim', 'HMH_Death']) {
    assert.ok(fixture.includes(action), `the fixture must author ${action}`);
  }
});

test('the new pipeline is wired into npm and the syntax gate', async () => {
  const packageJson = await readJson('package.json');
  assert.equal(packageJson.scripts['assets:hmh:skinned-test'], 'python scripts/run-hmh-skinned-test-pipeline.py');
  assert.equal(
    packageJson.scripts['assets:hmh:skinned-test:verify'],
    'python scripts/run-hmh-skinned-test-pipeline.py --verify-reproducible',
  );
  // Untouched: the shipped hero pipeline command is pinned elsewhere too.
  assert.equal(packageJson.scripts['assets:hmh:production-hero-pilot'], 'python scripts/run-hmh-production-hero-pilot.py');
  const syntaxCheck = await readRepo('scripts/syntax-check.mjs');
  for (const script of [IMPORTER, FIXTURE, SKINNED_RUNNER]) {
    assert.ok(syntaxCheck.includes(`"${script}"`), `${script} is not compiled by npm run check`);
  }
  assert.ok(
    syntaxCheck.includes('"tests/hmh-reboot-external-model-pipeline.test.mjs"'),
    'this test file is not parsed by npm run check',
  );
});

test('the delivery convention and its limits are written down', async () => {
  const doc = await readRepo(PIPELINE_DOC);
  for (const needle of [
    'Tripo',
    'Mixamo',
    'sourceModel',
    'clipActions',
    'frameSize',
    'lookDev',
    'weapon_socket',
    'lower-body',
    'torso-head',
    'npm run assets:hmh:skinned-test:verify',
    'Known limitations',
  ]) {
    assert.ok(doc.includes(needle), `${PIPELINE_DOC} does not document ${needle}`);
  }
  const atlasDoc = await readRepo('docs/hmh-reboot/BLENDER-ATLAS-PIPELINE.md');
  assert.match(atlasDoc, /External model sources/);
  // The pins the blender-pipeline suite already owns.
  assert.match(atlasDoc, /Blender 5\.1\.2/);
  assert.match(atlasDoc, /render-only/i);
});

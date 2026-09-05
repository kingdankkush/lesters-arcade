import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const manifestUrl = new URL('../apps/hmh-reboot/assets/source/blender/hmh-enemy-roster.json', import.meta.url);
const exporterUrl = new URL('../scripts/hmh-blender/export-hmh-enemy-roster.py', import.meta.url);
const metricsUrl = new URL('../apps/portal/assets/generated/hmh-reboot-enemy-roster/hmh-enemy-roster-metrics.json', import.meta.url);

const EXPECTED_ROLE_PROFILES = Object.freeze({
  'bagholder-rusher': 'undead-straight-lunge-v1',
  forkrunner: 'forkrunner-quick-fork-slash-v1',
  'liquidator-agent': 'suppression-rifle-burst-v1',
  'whale-enforcer': 'undead-shoulder-charge-v1',
  'gas-bomber': 'gas-bomber-canister-lob-v1',
  'validator-cultist': 'validator-staff-channel-v1',
});

async function loadJson(url) {
  return JSON.parse(await readFile(url, 'utf8'));
}

const metadataUrl = (actorId) => new URL(
  `../apps/portal/assets/generated/hmh-reboot-enemy-roster/${actorId}/${actorId}-roster-atlas.json`,
  import.meta.url,
);

test('every ordinary enemy declares a role-native tell and attack profile', async () => {
  const manifest = await loadJson(manifestUrl);
  const ordinaryActors = manifest.actors.filter((actor) => actor.boss !== true);
  assert.deepEqual(ordinaryActors.map((actor) => actor.actorId), Object.keys(EXPECTED_ROLE_PROFILES));
  for (const actor of ordinaryActors) {
    assert.equal(
      actor.animationProfile?.kind,
      EXPECTED_ROLE_PROFILES[actor.actorId],
      `${actor.actorId} must not fall back to shared-roster-v1`,
    );
  }
});

test('the Blender exporter owns a distinct pose branch for every ordinary role profile', async () => {
  const exporter = await readFile(exporterUrl, 'utf8');
  for (const profile of Object.values(EXPECTED_ROLE_PROFILES)) {
    assert.match(exporter, new RegExp(`['\"]${profile}['\"]`), `${profile} is not recognized by the exporter`);
    assert.match(
      exporter,
      new RegExp(`(?:if|elif) kind == ['\"]${profile}['\"]`),
      `${profile} has no authored tell/attack pose branch`,
    );
  }
});

test('the cold roster gate publishes the hero premultiplied budget policy and no quantiser', async () => {
  // Cycle 073: the nearest-8 RGB canonicalisation is gone. It hid three
  // quarters of one-LSB EEVEE flips and turned the rest into eight-step
  // failures; the two cold passes are now compared premultiplied, unquantised,
  // against the same budget Lester observes at 0/0/0.
  const metrics = await loadJson(metricsUrl);
  assert.equal(metrics.reproducibilityPolicy.kind, 'bounded-premultiplied-rgba-v1');
  assert.deepEqual(metrics.reproducibilityPolicy.budget, {
    maxChangedVisiblePixels: 8,
    maxChannelDelta: 2,
    maxTotalChannelDelta: 32,
  });
  assert.equal(metrics.reproducibilityPolicy.coldSceneRebuild, true);
  assert.equal(metrics.reproducibilityPolicy.comparedSpace, 'premultiplied-rgba-8bit-unquantised');
  assert.equal('rgbCanonicalization' in metrics.reproducibilityPolicy, false);
  assert.equal(metrics.engine, 'BLENDER_EEVEE');
  const observed = metrics.reproducibilityPolicy.observed;
  assert.ok(observed.maxChangedVisiblePixels <= 8);
  assert.ok(observed.maxChannelDelta <= 2);
  assert.ok(observed.maxTotalChannelDelta <= 32);
});

test('generated atlas metadata preserves each role-native animation profile', async () => {
  for (const [actorId, profile] of Object.entries(EXPECTED_ROLE_PROFILES)) {
    const metadata = await loadJson(metadataUrl(actorId));
    assert.equal(metadata.animationProfile?.kind, profile, `${actorId} generated metadata is stale`);
    assert.notEqual(metadata.animationProfile?.kind, 'shared-roster-v1');
  }
});

// ---------------------------------------------------------------------------
// Cycle 074 (E-3): the pose table moved into a bpy-free module and every role
// gained a grayscale silhouette accent. The manifest records both so a stale
// atlas is detectable from its metadata.
// ---------------------------------------------------------------------------

const builderUrl = new URL('../scripts/hmh-blender/create-hmh-enemy-roster.py', import.meta.url);
const EXPECTED_POSE_AUTHORING = Object.freeze({ module: 'scripts/hmh-blender/hmh_enemy_poses.py', version: 2 });

test('the manifest names the pose module and a distinct silhouette accent per ordinary role', async () => {
  const manifest = await loadJson(manifestUrl);
  assert.deepEqual(manifest.poseAuthoring, EXPECTED_POSE_AUTHORING);
  const ordinaryActors = manifest.actors.filter((actor) => actor.boss !== true);
  const accentKinds = ordinaryActors.map((actor) => actor.silhouetteAccent?.kind);
  assert.equal(accentKinds.every((kind) => typeof kind === 'string' && kind.length > 0), true, 'every ordinary role needs an accent');
  assert.equal(new Set(accentKinds).size, accentKinds.length, 'accents must be distinct so the six roles separate in grayscale');
  for (const actor of ordinaryActors) {
    assert.match(actor.silhouetteAccent.tint, /^#[0-9a-f]{6}$/i, `${actor.actorId} accent tint`);
  }
  const boss = manifest.actors.find((actor) => actor.boss === true);
  assert.equal(boss.silhouetteAccent, undefined, 'the boss already carries its crown rig and phase visuals');
});

test('the Blender builder fails closed on the silhouette accents and the exporter delegates poses to the pure module', async () => {
  const [manifest, builder, exporter] = await Promise.all([loadJson(manifestUrl), readFile(builderUrl, 'utf8'), readFile(exporterUrl, 'utf8')]);
  for (const actor of manifest.actors.filter((entry) => entry.boss !== true)) {
    assert.match(builder, new RegExp(`kind == "${actor.silhouetteAccent.kind}"`), `${actor.actorId} accent has no builder branch`);
  }
  assert.match(builder, /Unknown silhouette accent/);
  assert.match(exporter, /import hmh_enemy_poses/);
  assert.match(exporter, /hmh_enemy_poses\.role_pose\(/, 'poses must come from the bpy-free module so they are testable on Vercel');
  assert.match(exporter, /apply_pose\(rig, actor,/);
});

test('generated atlas metadata records the pose authoring version and the accent', async () => {
  const manifest = await loadJson(manifestUrl);
  for (const actor of manifest.actors) {
    const metadata = await loadJson(metadataUrl(actor.actorId));
    assert.deepEqual(metadata.poseAuthoring, EXPECTED_POSE_AUTHORING, `${actor.actorId} atlas predates the Cycle 074 poses`);
    if (actor.boss !== true) assert.deepEqual(metadata.silhouetteAccent, actor.silhouetteAccent, `${actor.actorId} atlas predates its accent`);
  }
});

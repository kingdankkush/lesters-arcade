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

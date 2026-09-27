import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  BOSS_ROSTER_FLAG,
  BOSS_ROSTER_ROLES,
  BOSS_ROSTER_MAX_PAGE_BYTES,
  BOSS_ROSTER_MAX_BYTES_PER_BOSS,
  BOSS_ROSTER_MAX_DECODED_BYTES,
  BOSS_ROSTER_MAX_HALF_RES_DECODED_BYTES,
  bossRosterArtEnabled,
  bossRosterAsset,
  bossRosterPageUrls,
  createBossRosterAtlasIndex,
  resolveBossRosterPose,
} from '../apps/hmh-reboot/src/boss-roster-atlas.mjs';
import { HMH_RUN_SUMMARY_CATALOGS_V7 } from '../sdk/hmh-run-summary-schema-v7.mjs';

const root = new URL('../', import.meta.url);
const json = (path) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const sha = (path) => createHash('sha256').update(readFileSync(new URL(path, root))).digest('hex');
const portal = (url) => 'apps/portal/' + url.replace('../', '');
const roster = json('apps/hmh-reboot/assets/source/blender/hmh-boss-roster.json');
const DIRECTIONS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];

test('boss art is dark: off by default, Free-only behind an explicit flag, never in Ranked', () => {
  const on = new URLSearchParams(`${BOSS_ROSTER_FLAG}=1`);
  assert.equal(bossRosterArtEnabled(), false);
  assert.equal(bossRosterArtEnabled({ params: on }), false);
  assert.equal(bossRosterArtEnabled({ evidenceSafe: true }), false);
  assert.equal(bossRosterArtEnabled({ evidenceSafe: true, params: new URLSearchParams(`${BOSS_ROSTER_FLAG}=0`) }), false);
  assert.equal(bossRosterArtEnabled({ evidenceSafe: true, ranked: true, params: on }), false);
  assert.equal(bossRosterArtEnabled({ evidenceSafe: 'true', params: on }), false);
  assert.equal(bossRosterArtEnabled({ evidenceSafe: true, params: on }), true);
});

test('no shipped runtime module imports the dark boss atlases', () => {
  const dir = new URL('apps/hmh-reboot/src/', root);
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.mjs') || name === 'boss-roster-atlas.mjs') continue;
    const text = readFileSync(new URL(name, dir), 'utf8');
    assert.ok(!text.includes('boss-roster-atlas'), `${name} must not import the dark boss atlases before promotion`);
    assert.ok(!text.includes('hmh-boss-roster'), `${name} must not load boss roster pages before promotion`);
  }
});

test('dark boss art binds only to v7 boss role ids and never invents one', () => {
  assert.deepEqual([...BOSS_ROSTER_ROLES].sort(), roster.bosses.map((b) => b.roleId).sort());
  for (const roleId of BOSS_ROSTER_ROLES) {
    assert.ok(HMH_RUN_SUMMARY_CATALOGS_V7.bosses.includes(roleId), roleId);
    assert.ok(HMH_RUN_SUMMARY_CATALOGS_V7.enemyRoles.includes(roleId), roleId);
  }
  assert.throws(() => bossRosterAsset('the-lockkeeper'), /no dark boss art/);
  assert.throws(() => bossRosterAsset('liquidator'), /no dark boss art/);
});

for (const entry of roster.bosses) {
  const { roleId } = entry;
  test(`${roleId}: complete boss clip set, verified pages, both tiers inside budget`, () => {
    const asset = bossRosterAsset(roleId);
    const metadata = json(portal(asset.metadataUrl));
    const index = createBossRosterAtlasIndex(metadata, roleId);
    assert.equal(index.identityForm, entry.identityForm);
    assert.ok(['human', 'zombie'].includes(index.identityForm));
    assert.equal(metadata.status, 'dark');
    assert.equal(metadata.runtimeAuthority, 'projection-only');
    assert.deepEqual(metadata.phases, Object.keys(entry.phaseVisuals));
    // The kit: idle, walk, hit, halt and a tell + strike per attack kind in phase 1;
    // south-only intro, both transitions and the death.
    const first = metadata.phaseClips[metadata.phases[0]];
    for (const clip of ['idle', 'walk', 'hit', 'halt']) assert.ok(first.includes(clip), clip);
    const attackKinds = new Set(Object.values(metadata.clips).map((c) => c.attackKind).filter(Boolean));
    assert.ok(attackKinds.size >= 4, 'at least four attack kinds');
    for (const kind of attackKinds) {
      const pair = index.clipsForAttack(kind);
      assert.ok(pair.tell && pair.attack, `${kind} has a tell and a strike`);
    }
    for (const clip of ['intro', 'transition-1', 'transition-2', 'death']) {
      assert.deepEqual(metadata.clips[clip].directions, ['south'], clip);
    }
    let expected = 0;
    for (const phase of metadata.phases) {
      for (const clipId of metadata.phaseClips[phase]) {
        const clip = metadata.clips[clipId];
        if (clip.directions.length !== 1) assert.deepEqual(clip.directions, DIRECTIONS, clipId);
        expected += clip.frames * clip.directions.length;
      }
    }
    assert.equal(metadata.frames.length, expected);
    assert.equal(index.frameCount, expected);
    assert.ok(expected >= 1000 && expected <= 1200, `frame budget ${expected}`);
    let bytes = 0; let decoded = 0; let halfDecoded = 0;
    const fullUrls = bossRosterPageUrls(index).map(portal);
    const halfUrls = bossRosterPageUrls(index, { mobile: true }).map(portal);
    for (const [i, page] of metadata.pages.entries()) {
      const full = fullUrls[i]; const half = halfUrls[i];
      assert.equal(sha(full), page.imageSha256);
      assert.equal(statSync(new URL(full, root)).size, page.imageBytes);
      assert.ok(page.imageBytes <= BOSS_ROSTER_MAX_PAGE_BYTES, `page ${i} bytes`);
      assert.equal(page.width, 2048);
      assert.ok(page.height <= 2048);
      assert.ok(half.endsWith('@0.5x.webp'));
      assert.equal(sha(half), page.halfRes.imageSha256);
      assert.equal(page.halfRes.width * 2, page.width);
      assert.equal(page.halfRes.height * 2, page.height);
      bytes += page.imageBytes; decoded += page.decodedBytes; halfDecoded += page.halfRes.decodedBytes;
    }
    assert.ok(bytes <= BOSS_ROSTER_MAX_BYTES_PER_BOSS, `wire ${bytes}`);
    assert.ok(decoded <= BOSS_ROSTER_MAX_DECODED_BYTES, `decoded ${decoded}`);
    assert.ok(halfDecoded <= BOSS_ROSTER_MAX_HALF_RES_DECODED_BYTES, `phone decoded ${halfDecoded}`);
    // Render proof: two cold Blender passes agree and stay inside the hero budget.
    const evidence = `docs/testing/hmh-boss-roster/${roleId}/`;
    assert.deepEqual(json(evidence + 'run-a-receipt.json'), json(evidence + 'run-b-receipt.json'));
    const measurement = json(evidence + 'measurement.json');
    assert.equal(measurement.metadataSha256, sha(portal(asset.metadataUrl)));
    assert.ok(measurement.repeatability.maxChangedVisiblePixels <= 8);
    assert.ok(measurement.repeatability.maxChannelDelta <= 2);
    assert.ok(measurement.repeatability.maxTotalChannelDelta <= 32);
    assert.equal(measurement.pixelReconstructionChanged, 0);
    assert.ok(existsSync(new URL(evidence + `${roleId}-contact-full.png`, root)));
    assert.ok(existsSync(new URL(evidence + `${roleId}-contact-gameplay.png`, root)));
    // Source lineage: the derivative receipt names the committed Tripo source.
    const receipt = json(`apps/hmh-reboot/assets/source/models/boss-derivatives/${roleId}/source-receipt.json`);
    assert.equal(receipt.baseSource, entry.nativeSource);
    assert.equal(metadata.sourceModel.sourceSha256, receipt.sourceSha256);
    assert.equal(metadata.sourceModel.baseSourceSha256, receipt.baseSha256);
    assert.equal(receipt.renderContract.cameraPitchDegrees, 35);
    assert.equal(receipt.renderContract.lightRigFamily, 'hero');
    // World size comes from the design, measured from the phase-1 idle.
    assert.equal(metadata.designWorldHeightPx, entry.designWorldHeightPx);
    assert.ok(Math.abs(metadata.measuredBodyHeightPx * metadata.runtimeScale - entry.designWorldHeightPx) < 0.5);
  });

  test(`${roleId}: pose resolution loops, clamps, falls back across phases and keeps south-only clips south`, () => {
    const metadata = json(portal(bossRosterAsset(roleId).metadataUrl));
    const index = createBossRosterAtlasIndex(metadata, roleId);
    const [p1, p2, p3] = metadata.phases;
    const idle = metadata.clips.idle;
    const lap = Math.round((idle.frames * 60) / idle.fps);
    assert.equal(resolveBossRosterPose(index, { clip: 'idle', direction: 2, phase: p1, elapsedTicks: 0 }).id,
      resolveBossRosterPose(index, { clip: 'idle', direction: 2, phase: p1, elapsedTicks: lap }).id);
    const death = resolveBossRosterPose(index, { clip: 'death', direction: 0, phase: p3, elapsedTicks: 100_000 });
    assert.equal(death.direction, 'south');
    assert.equal(death.frameIndex, metadata.clips.death.frames - 1);
    // Staggers are rendered in phase 1 only; the phase-1 kit covers later phases.
    const stagger = resolveBossRosterPose(index, { clip: 'stagger', direction: 4, phase: p3, elapsedTicks: 0 });
    assert.equal(stagger.phase, p1);
    assert.equal(stagger.direction, 'west');
    // Phase re-bakes win over fallbacks where they exist.
    assert.equal(resolveBossRosterPose(index, { clip: 'walk', direction: 6, phase: p2, elapsedTicks: 0 }).phase, p2);
    assert.throws(() => resolveBossRosterPose(index, { clip: 'dance' }), /unknown boss clip/);
    // Tells follow the simulation's window: frame = floor(progress x N), held at the end.
    const tell = Object.keys(metadata.clips).find((id) => metadata.clips[id].kind === 'tell');
    const n = metadata.clips[tell].frames;
    assert.equal(resolveBossRosterPose(index, { clip: tell, phase: p1, progress: 0 }).frameIndex, 0);
    assert.equal(resolveBossRosterPose(index, { clip: tell, phase: p1, progress: 0.999 }).frameIndex, n - 1);
    assert.equal(resolveBossRosterPose(index, { clip: tell, phase: p1, progress: 1 }).frameIndex, n - 1);
    assert.equal(resolveBossRosterPose(index, { clip: tell, phase: p1, progress: 1 / n }).frameIndex, 1);
    // Every sim heading resolves to a distinct compass frame for a full clip.
    const names = new Set(Array.from({ length: 8 }, (_, d) => resolveBossRosterPose(index, { clip: 'walk', direction: d, phase: p1 }).direction));
    assert.equal(names.size, 8);
  });

  test(`${roleId}: the index rejects incomplete, foreign or non-projection metadata`, () => {
    const metadata = json(portal(bossRosterAsset(roleId).metadataUrl));
    assert.throws(() => createBossRosterAtlasIndex({ ...metadata, runtimeAuthority: 'simulation' }), /projection-only/);
    assert.throws(() => createBossRosterAtlasIndex(metadata, roleId === 'lockkeeper' ? 'fifty-one-percent-foreman' : 'lockkeeper'), /mismatch/);
    assert.throws(() => createBossRosterAtlasIndex({ ...metadata, identityForm: 'robot' }), /human or a zombie/);
    assert.throws(() => createBossRosterAtlasIndex({ ...metadata, frames: metadata.frames.slice(1) }), /missing/);
  });
}

test('boss clip library: every tell winds up past its hold, every clip samples distinct poses, and the plan matches the atlases', async () => {
  const { spawnSync } = await import('node:child_process');
  const script = [
    'import sys, json, math',
    "sys.path.insert(0, 'scripts/hmh-blender')",
    'import hmh_boss_clips as bc',
    'out = {}',
    'for role, table in bc.BOSS_CLIPS.items():',
    '    base = table["clips"]["idle"]["function"](0.0)',
    '    info = {"plan": len(bc.frame_plan(role)), "unique": {}, "overshoot": {}}',
    '    for cid, clip in table["clips"].items():',
    '        info["unique"][cid] = [len({json.dumps(bc.boss_pose(role, cid, i), sort_keys=True) for i in range(clip["frames"])}), clip["frames"]]',
    '        if clip["kind"] == "tell":',
    '            f = clip["function"]',
    '            dist = lambda c: sum(abs(c.get(k, 0.0) - base.get(k, 0.0)) for k in set(c) | set(base))',
    '            info["overshoot"][cid] = max(dist(f(i / 20)) for i in range(21)) > 1.05 * dist(f(1.0))',
    '    out[role] = info',
    'print(json.dumps(out))',
  ].join('\n');
  const result = spawnSync('python', ['-c', script], { encoding: 'utf8', cwd: new URL('.', root) });
  assert.equal(result.status, 0, result.stderr);
  const info = JSON.parse(result.stdout);
  for (const entry of roster.bosses) {
    const role = info[entry.roleId];
    const metadata = json(portal(bossRosterAsset(entry.roleId).metadataUrl));
    assert.equal(role.plan, metadata.frames.length);
    for (const [clipId, [unique, frames]] of Object.entries(role.unique)) {
      assert.ok(unique >= Math.max(2, Math.ceil(0.6 * frames)), `${entry.roleId}/${clipId} ${unique} of ${frames}`);
    }
    assert.ok(Object.keys(role.overshoot).length >= 4);
    for (const [clipId, overshoots] of Object.entries(role.overshoot)) assert.ok(overshoots, `${entry.roleId}/${clipId} wind-up overshoot`);
  }
});

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const heroManifestUrl = new URL('../apps/hmh-reboot/assets/source/blender/hmh-production-heroes.json', import.meta.url);
const enemyManifestUrl = new URL('../apps/hmh-reboot/assets/source/blender/hmh-enemy-roster.json', import.meta.url);
const propManifestUrl = new URL('../apps/hmh-reboot/assets/source/blender/hmh-authored-props.json', import.meta.url);
const propModuleUrl = new URL('../apps/hmh-reboot/src/authored-prop-atlas.mjs', import.meta.url);

const loadJson = async (url) => JSON.parse(await readFile(url, 'utf8'));

test('Cycle 007 aligns every Blender gameplay pipeline to the certified 55 degree projection', async () => {
  const hero = await loadJson(heroManifestUrl);
  const enemy = await loadJson(enemyManifestUrl);
  assert.equal(hero.render.cameraPitchDegrees, 55, 'hero projection must be explicit');
  assert.equal(enemy.render.cameraPitchDegrees, 55, 'enemy projection must match heroes');
  assert.equal(enemy.render.cameraPitchDegrees, hero.render.cameraPitchDegrees);
});

test('Cycle 007 authors every important hero action across body layers', async () => {
  const manifest = await loadJson(heroManifestUrl);
  const requiredActions = ['dash', 'melee', 'grenade', 'death'];
  for (const pilot of manifest.pilots) {
    for (const layer of ['lower-body', 'torso-head', 'weapon']) {
      for (const action of requiredActions) {
        assert.ok(pilot.clips[layer][action], `${pilot.actorId} ${layer} lacks ${action}`);
        assert.ok(pilot.clips[layer][action].frames >= 3, `${pilot.actorId} ${layer}/${action} is not an animation`);
        assert.ok(pilot.clips[layer][action].fps > 0, `${pilot.actorId} ${layer}/${action} lacks cadence`);
      }
    }
  }
});

test('Cycle 007 consumes authored per-clip cadence for heroes and enemies', async () => {
  const heroSource = await readFile(new URL('../apps/hmh-reboot/src/production-hero-atlas.mjs', import.meta.url), 'utf8');
  const enemySource = await readFile(new URL('../apps/hmh-reboot/src/enemy-roster-atlas.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(heroSource, /moving \? 12 : 2/, 'hero cadence must not be hard-coded');
  assert.doesNotMatch(enemySource, /simulationTick \/ 4/, 'enemy cadence must not be hard-coded');
  assert.match(heroSource, /fpsFor|clipFor/, 'hero index must publish clip cadence');
  assert.match(enemySource, /fpsFor|clipFor/, 'enemy index must publish clip cadence');
});

test('Cycle 007 preserves the last meaningful enemy facing while stationary', async () => {
  const module = await import('../apps/hmh-reboot/src/enemy-roster-atlas.mjs');
  assert.equal(typeof module.resolveEnemyVisualDirection, 'function');
  const state = { direction: 6 };
  assert.equal(module.resolveEnemyVisualDirection(state, { x: 0, y: 0 }), 6);
  assert.equal(module.resolveEnemyVisualDirection(state, { x: 8, y: 0 }), 0);
  assert.equal(state.direction, 0);
  assert.equal(module.resolveEnemyVisualDirection(state, { x: 0.1, y: 0.1 }), 0);
});

test('Cycle 007 gives every Liquidator phase authored visual coverage', async () => {
  const manifest = await loadJson(enemyManifestUrl);
  const boss = manifest.actors.find((actor) => actor.actorId === 'the-liquidator');
  assert.deepEqual(Object.keys(boss.phaseVisuals ?? {}), ['market-open', 'margin-call', 'total-liquidation']);
  const metadata = await loadJson(new URL('../apps/portal/assets/generated/hmh-reboot-enemy-roster/the-liquidator/the-liquidator-roster-atlas.json', import.meta.url));
  for (const phase of ['market-open', 'margin-call', 'total-liquidation']) {
    for (const state of Object.keys(manifest.clips)) {
      assert.ok(metadata.frames.some((frame) => frame.phase === phase && frame.state === state), `${phase}/${state} missing`);
    }
  }
});

test('Cycle 007 replaces pale reflective enemy skin with warm rough authored materials', async () => {
  const manifest = await loadJson(enemyManifestUrl);
  assert.ok(manifest.materialPolicy?.skinRoughness >= 0.82);
  assert.equal(manifest.materialPolicy?.skinMetallic, 0);
  for (const actor of manifest.actors.filter((candidate) => candidate.identityForm === 'human')) {
    const rgb = actor.palette.skin.replace('#', '').match(/../g).map((value) => Number.parseInt(value, 16));
    assert.ok(rgb[0] > rgb[2], `${actor.actorId} human skin must read warm`);
  }
});

test('Cycle 007 prop manifest covers weapons, P0 pickups, power-ups and world dressing', async () => {
  assert.ok(existsSync(propManifestUrl), 'authored prop manifest is missing');
  const manifest = await loadJson(propManifestUrl);
  assert.equal(manifest.render.cameraPitchDegrees, 55);
  assert.equal(manifest.runtimeAuthority, 'projection-only');
  const byCategory = Object.groupBy(manifest.assets, (asset) => asset.category);
  assert.deepEqual(byCategory.weapon.map((asset) => asset.assetId).sort(), ['auto-miner', 'coin-blaster', 'launcher-rig', 'scatter-shotgun']);
  assert.deepEqual(byCategory.pickup.map((asset) => asset.assetId).sort(), ['berserk-candle', 'bonus-life', 'hash-rail-core', 'nuke-liquidation', 'time-dilation']);
  assert.ok(byCategory['power-up'].length >= 6, 'important power-up icons are missing');
  assert.ok(byCategory['world-prop'].length >= 12, 'world dressing kit is too small');
});

test('Cycle 007 authored prop runtime is deterministic and covers every district', async () => {
  assert.ok(existsSync(propModuleUrl), 'authored prop runtime module is missing');
  const module = await import('../apps/hmh-reboot/src/authored-prop-atlas.mjs');
  const first = module.buildAuthoredWorldPropPlacements({ worldId: 'forked-frontier', seed: 0x7a11ce, countPerDistrict: 8 });
  const second = module.buildAuthoredWorldPropPlacements({ worldId: 'forked-frontier', seed: 0x7a11ce, countPerDistrict: 8 });
  assert.deepEqual(first, second);
  // Cycle 044 gave every district an authored density override; W1 raised
  // them once the A1-A4 asset waves had a library worth placing
  // (20 + 20 + 20 + 24 + 22 + 22 = 128).
  assert.equal(first.length, 128);
  assert.deepEqual([...new Set(first.map((entry) => entry.districtId))].sort(), [
    'frontier-relay', 'hashwood', 'liquidation-yard', 'liquidity-crossing', 'mining-camp', 'rugpull-ravine',
  ]);
  assert.ok(first.every((entry) => entry.runtimeAuthority === 'projection-only'));
});

test('Cycle 007 general asset QA owns heroes, enemy roster and authored props', async () => {
  const source = await readFile(new URL('../scripts/hmh-reboot-production-asset-qa.mjs', import.meta.url), 'utf8');
  assert.match(source, /ENEMY_ROSTER_ACTORS/);
  assert.match(source, /AUTHORED_PROP_ASSETS|hmh-authored-props/);
  assert.match(source, /sourcePixelSha256/);
});

test('Cycle 007 Blender pipelines exclusively own their shared generation paths', async () => {
  const lockSource = await readFile(new URL('../scripts/hmh_pipeline_lock.py', import.meta.url), 'utf8');
  for (const marker of ['exclusive_pipeline_lock', 'pid_is_alive', 'already running as PID', 'lock_dir.mkdir', 'shutil.rmtree']) {
    assert.match(lockSource, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const script of [
    'run-hmh-production-hero-pilot.py',
    'run-hmh-enemy-roster-pipeline.py',
    'run-hmh-authored-props-pipeline.py',
  ]) {
    const source = await readFile(new URL(`../scripts/${script}`, import.meta.url), 'utf8');
    assert.match(source, /from hmh_pipeline_lock import exclusive_pipeline_lock/);
    assert.match(source, /with exclusive_pipeline_lock\(/);
  }

  const lockUrl = new URL('../.tmp/hmh-pipeline-lock-contract-test.lock/', import.meta.url);
  const lockPath = fileURLToPath(lockUrl);
  const exercise = [
    'import sys',
    'from pathlib import Path',
    "sys.path.insert(0, 'scripts')",
    'from hmh_pipeline_lock import exclusive_pipeline_lock',
    `with exclusive_pipeline_lock(Path(${JSON.stringify(lockPath)}), 'contract test'):`,
    '    pass',
  ].join('\n');
  await rm(lockUrl, { force: true, recursive: true });
  try {
    await mkdir(lockUrl, { recursive: true });
    await writeFile(new URL('pid', lockUrl), `${process.pid}\n`, 'utf8');
    const contender = spawnSync('python', ['-c', exercise], { cwd: fileURLToPath(root), encoding: 'utf8' });
    assert.notEqual(contender.status, 0, 'a live pipeline owner must reject a contender');
    assert.match(contender.stderr, new RegExp(`already running as PID ${process.pid}`));

    await rm(lockUrl, { force: true, recursive: true });
    await mkdir(lockUrl, { recursive: true });
    await writeFile(new URL('pid', lockUrl), '99999999\n', 'utf8');
    const recovered = spawnSync('python', ['-c', exercise], { cwd: fileURLToPath(root), encoding: 'utf8' });
    assert.equal(recovered.status, 0, recovered.stderr);
    assert.equal(existsSync(lockUrl), false, 'a recovered pipeline lock must be released');
  } finally {
    await rm(lockUrl, { force: true, recursive: true });
  }
});

test('Cycle 007 runtime can select all authored hero actions and boss phases', async () => {
  const source = await readFile(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  for (const action of ['dash', 'melee', 'grenade', 'death']) assert.ok(source.includes(`'${action}'`), `${action} is unreachable`);
  assert.match(source, /phaseId:\s*liquidatorBoss\.phaseId|phase:\s*liquidatorBoss\.phaseId/);
  assert.match(source, /authored-prop-atlas|AuthoredProp/);
  assert.match(source, /enemyVisualFacing = new Map/);
  assert.doesNotMatch(source, /resolveEnemyVisualDirection\(enemy,/, 'projection must not write facing onto simulation enemies');
});

test('Cycle 007 gives one weapon renderer authority at a time', async () => {
  const heroRuntime = await readFile(new URL('../apps/hmh-reboot/src/production-hero-atlas.mjs', import.meta.url), 'utf8');
  const runtime = await readFile(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(heroRuntime, /setLayerVisible/);
  assert.match(runtime, /if \(!productionHeroDisplay && authoredHeldWeaponDisplay\) authoredHeldWeaponDisplay\.container\.visible = false/);
  assert.match(runtime, /const externalWeaponAuthoritative = Boolean\(authoredHeldWeaponDisplay\)/);
  assert.match(runtime, /!\['melee', 'grenade', 'death'\]\.includes\(productionAction\)/);
  assert.match(runtime, /setLayerVisible\('weapon', !externalWeaponAuthoritative\)/);
  assert.match(runtime, /authoredHeldWeaponDisplay\.container\.visible = externalWeaponAuthoritative/);
});

test('repository visual policy points to a dated current HMH cycle handoff and the active reboot gate', async () => {
  const agents = await readFile(new URL('../AGENTS.md', import.meta.url), 'utf8');
  assert.match(agents, /npm run visual:reboot/);
  assert.match(agents, /npm run visual:reboot:accept/);
  assert.match(agents, /docs\/handoffs\/\d{4}-\d{2}-\d{2}-hmh-cycle-\d+-[a-z-]+-handoff\.md/);
});

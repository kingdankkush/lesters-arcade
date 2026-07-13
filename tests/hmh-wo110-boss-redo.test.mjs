import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { loadHMHGame } from '../apps/portal/src/games/hmh/loader.mjs';
import { levelOneRoguelikeBossRoster } from '../apps/portal/src/arcade-core.mjs';
import {
  HMH_WO110_BOSS_REDO,
  wo110BossAssetForPhaseState,
} from '../apps/portal/assets/generated/hmh-wo110-boss-redo/hmh-wo110-boss-redo-manifest.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

function assertAssetExists(asset) {
  const relative = asset.src.replace(/^\.\//, 'apps/portal/');
  assert.equal(existsSync(new URL(`../${relative}`, import.meta.url)), true, `${asset.key} should exist at ${relative}`);
}

test('WO-110 boss redo ships true-scale phase forms in the 192-256px range', () => {
  assert.equal(HMH_WO110_BOSS_REDO.id, 'hmh-wo110-boss-redo-v1');
  assert.deepEqual(HMH_WO110_BOSS_REDO.trueScaleRangePx, [192, 256]);
  const phaseForms = HMH_WO110_BOSS_REDO.assets.filter((asset) => asset.state === 'phase-form');
  assert.equal(phaseForms.length, 3);
  for (const asset of phaseForms) {
    assert.equal(asset.actorId, 'rug-pull-baron');
    assert.ok(asset.frameWidth >= 192 && asset.frameWidth <= 256, `${asset.key} true-scale width`);
    assert.ok(asset.frameHeight >= 192 && asset.frameHeight <= 256, `${asset.key} true-scale height`);
    assert.equal(asset.renderWidth, asset.frameWidth);
    assertAssetExists(asset);
  }
});

test('WO-110 boss redo includes super-move telegraphs and death spectacle', () => {
  const supers = HMH_WO110_BOSS_REDO.assets.filter((asset) => asset.state === 'super-telegraph');
  assert.equal(supers.length, 3);
  assert.deepEqual(supers.map((asset) => asset.superMove).sort(), ['liquidation-wave', 'rug-pull-chain', 'whale-dump']);
  const death = HMH_WO110_BOSS_REDO.assets.find((asset) => asset.state === 'death-spectacle');
  assert.ok(death);
  assert.equal(death.deathSpectacle, true);
  assertAssetExists(death);
});

test('WO-110 manifest lookup and HMH loader expose checkpoint 3 pack', async () => {
  assert.equal(wo110BossAssetForPhaseState(2, 'phase-form')?.key, 'wo110/rug-pull-baron-phase-2');
  assert.equal(wo110BossAssetForPhaseState(3, 'super-telegraph', 'liquidation-wave')?.key, 'wo110/rug-pull-baron-super-liquidation-wave');
  const hmh = await loadHMHGame();
  assert.equal(hmh.HMH_WO110_BOSS_REDO.assetCount, HMH_WO110_BOSS_REDO.assetCount);
});

test('WO-110 runtime and checkpoint docs are wired', () => {
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  assert.match(main, /wo110BossRuntimeFrame/);
  assert.match(main, /hmh\('HMH_WO110_BOSS_REDO'\)/);
  assert.doesNotMatch(main, /import \{ HMH_WO110_BOSS_REDO/);
  assert.match(main, /WO110_TRUE_SCALE_MAX_PX = 256/);
  assert.equal(existsSync(new URL('../docs/game-design/PLAYTEST_CHECKPOINT_3_NOTICE.md', import.meta.url)), true);
  assert.equal(existsSync(new URL('../docs/game-design/wo110-boss-redo-checkpoint3/wo110-boss-checkpoint3-proof.png', import.meta.url)), true);
  const notice = readFileSync(new URL('../docs/game-design/PLAYTEST_CHECKPOINT_3_NOTICE.md', import.meta.url), 'utf8');
  assert.match(notice, /Verdict: \*\*OPEN/);
});

test('WO-110 is the active isometric signature boss rather than a proxy', () => {
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  const bossEntry = levelOneRoguelikeBossRoster().find((entry) => entry.role === 'boss');

  assert.equal(bossEntry?.enemyId, 'rug-pull-baron');
  assert.equal(bossEntry?.animatedCuratedAssetKey, 'wo110/rug-pull-baron-phase-1');
  assert.match(main, /signatureBoss: true/);
  assert.match(main, /bossEnemy\.phase = directive\.phase\.phaseNumber/);
  assert.match(main, /isSignatureBoss \? wo110BossRuntimeFrame\(enemy\) : null/);
  assert.match(main, /img: image/);
  assert.match(main, /ready: Boolean\(image\.complete && image\.naturalWidth > 0\)/);
  assert.match(main, /bossDeathSpectacle/);
  assert.match(main, /deathSpectacle: true/);
  assert.match(main, /__hmhVisualDebugBoss/);
  assert.match(main, /forceEnemyId: 'rug-pull-baron'/);
  assert.match(main, /const affixes = options\.signatureBoss \? \[\] : resolveEliteAffixes/);
  assert.match(main, /nameplateTags: options\.signatureBoss \? \[\(options\.title \?\? spawn\.enemy\.title\)\.toUpperCase\(\)\]/);
  assert.doesNotMatch(main, /finalBossProxy|FinalBossProxy/);
});

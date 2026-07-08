import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { HMH_ANIMATED_ROSTER } from '../apps/portal/assets/generated/hmh-animated-roster/hmh-animated-roster.mjs';
import { BESPOKE_ENEMY_VISUAL_KITS } from '../apps/portal/src/hmh-encounter-visuals.mjs';
import {
  HMH_ART_AUTO_REPAIR_MAP,
  actorHasRenderableAnimations,
  buildArtPurgeRepairPlan,
  repairRuntimeActorKey,
} from '../apps/portal/src/hmh-art-repair.mjs';

function repoText(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

const WO109_FIXED_ACTORS = Object.freeze([
  'crypto-bro-rusher',
  'evil-banker-ranged',
  'gas-beast-tank',
  'liquidation-cascade-golem',
]);

test('WO-109 redesigned runtime actors now render directly instead of through WO-18 auto-repair', () => {
  for (const key of WO109_FIXED_ACTORS) {
    assert.equal(actorHasRenderableAnimations(HMH_ANIMATED_ROSTER[key]), true, `${key} should now be renderable`);
    const resolved = repairRuntimeActorKey(key, HMH_ANIMATED_ROSTER);
    assert.equal(resolved.key, key);
    assert.equal(resolved.repaired, false);
    assert.equal(resolved.action, 'keep');
  }

  assert.equal(Object.keys(HMH_ART_AUTO_REPAIR_MAP).includes('liquidation-cascade-golem'), true, 'legacy repair map keeps provenance until the full purge pass removes it deliberately');
});

test('WO-18 auto-repair has no remaining zero-animation runtime/deferred actors after the native critical pass', () => {
  const remainingRepairKeys = ['warren-spear-rider', 'chain-reaper-boss', 'bit-whale-boss', 'rugpull-summoner'];
  for (const key of remainingRepairKeys) {
    assert.equal(actorHasRenderableAnimations(HMH_ANIMATED_ROSTER[key]), true, `${key} should now be a renderable native actor`);
    const resolved = repairRuntimeActorKey(key, HMH_ANIMATED_ROSTER);
    assert.equal(resolved.key, key);
    assert.equal(resolved.repaired, false, `${key} should no longer require a repair fallback`);
    assert.equal(resolved.action, 'keep');
  }
});

test('WO-18 bespoke enemy visual kits no longer point runtime-spawnable Level 1 enemies at zero-animation actor keys', () => {
  const repairedIds = ['crypto-bro', 'evil-banker', 'ridge-raider', 'bandit-captain', 'gas-beast', 'liquidation-cascade-golem'];
  for (const id of repairedIds) {
    const kit = BESPOKE_ENEMY_VISUAL_KITS[id];
    assert.ok(kit, `${id} should still have a visual kit`);
    assert.equal(actorHasRenderableAnimations(HMH_ANIMATED_ROSTER[kit.rosterKey]), true, `${id} should resolve to renderable ${kit.rosterKey}`);
    assert.ok(kit.autoRepair?.from || kit.rosterKey !== id || WO109_FIXED_ACTORS.includes(kit.rosterKey), `${id} should retain repair provenance, map to a distinct actor, or point at a WO-109 fixed actor`);
  }
});

test('WO-18 purge/repair plan separates fixed actors, runtime repairs, and deferred purge candidates', () => {
  const plan = buildArtPurgeRepairPlan({ roster: HMH_ANIMATED_ROSTER });

  assert.equal(plan.version, 'wo-18-art-purge-repair-v1');
  assert.equal(plan.summary.keptRenderableCount, 8);
  assert.equal(plan.summary.autoRepairCount, 0);
  assert.equal(plan.summary.deferOrPurgeCount, 0);
  assert.equal(plan.summary.unresolvedCount, 0);
  assert.ok(plan.repairs.some((entry) => entry.from === 'liquidation-cascade-golem' && entry.action === 'keep'));
  assert.ok(plan.repairs.some((entry) => entry.from === 'warren-spear-rider' && entry.action === 'keep'));
  assert.ok(plan.repairs.some((entry) => entry.from === 'bit-whale-boss' && entry.action === 'keep'));
  assert.ok(plan.runtimeGuardrails.every((entry) => actorHasRenderableAnimations(HMH_ANIMATED_ROSTER[entry.resolvedKey])));
});

test('WO-18 runtime and CLI are wired for the purge/auto-repair pass', () => {
  const main = repoText('apps/portal/main.js');
  const packageJson = repoText('package.json');
  const syntaxCheck = repoText('scripts/syntax-check.mjs');

  assert.equal(main.includes('repairRuntimeActorKey'), true, 'runtime roster selection should use repairRuntimeActorKey');
  assert.equal(packageJson.includes('design:art-repair'), true, 'package.json should expose npm run design:art-repair');
  assert.equal(syntaxCheck.includes('apps/portal/src/hmh-art-repair.mjs'), true, 'repair source should be syntax checked');
  assert.equal(syntaxCheck.includes('scripts/art-purge-repair.mjs'), true, 'repair CLI should be syntax checked');
  assert.equal(syntaxCheck.includes('tests/hmh-art-purge-repair.test.mjs'), true, 'WO-18 tests should be syntax checked');
});

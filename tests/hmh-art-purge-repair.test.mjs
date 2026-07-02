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

test('WO-18 auto-repair map redirects zero-animation runtime actors to renderable replacements', () => {
  const zeroKeys = [
    'crypto-bro-rusher',
    'evil-banker-ranged',
    'gas-beast-tank',
    'liquidation-cascade-golem',
    'warren-spear-rider',
  ];

  for (const key of zeroKeys) {
    assert.equal(actorHasRenderableAnimations(HMH_ANIMATED_ROSTER[key]), false, `${key} should be a real zero-animation input`);
    const repaired = repairRuntimeActorKey(key, HMH_ANIMATED_ROSTER);
    assert.equal(repaired.repaired, true, `${key} should auto-repair`);
    assert.notEqual(repaired.key, key);
    assert.equal(actorHasRenderableAnimations(HMH_ANIMATED_ROSTER[repaired.key]), true, `${key} replacement should render`);
  }

  assert.equal(Object.keys(HMH_ART_AUTO_REPAIR_MAP).includes('liquidation-cascade-golem'), true);
});

test('WO-18 bespoke enemy visual kits no longer point runtime-spawnable Level 1 enemies at zero-animation actor keys', () => {
  const repairedIds = ['crypto-bro', 'evil-banker', 'ridge-raider', 'bandit-captain', 'gas-beast', 'liquidation-cascade-golem'];
  for (const id of repairedIds) {
    const kit = BESPOKE_ENEMY_VISUAL_KITS[id];
    assert.ok(kit, `${id} should still have a visual kit`);
    assert.equal(actorHasRenderableAnimations(HMH_ANIMATED_ROSTER[kit.rosterKey]), true, `${id} should resolve to renderable ${kit.rosterKey}`);
    assert.ok(kit.autoRepair?.from || kit.rosterKey !== id, `${id} should retain repair provenance or a non-self mapped kit`);
  }
});

test('WO-18 purge/repair plan separates runtime repairs from deferred purge candidates', () => {
  const plan = buildArtPurgeRepairPlan({ roster: HMH_ANIMATED_ROSTER });

  assert.equal(plan.version, 'wo-18-art-purge-repair-v1');
  assert.ok(plan.summary.autoRepairCount >= 5);
  assert.ok(plan.summary.deferOrPurgeCount >= 1);
  assert.ok(plan.repairs.some((entry) => entry.from === 'liquidation-cascade-golem' && entry.action === 'auto-repair'));
  assert.ok(plan.repairs.some((entry) => entry.from === 'bit-whale-boss' && /defer|purge/.test(entry.action)));
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

// The run summary records the Liquidator's damage in whole units (1.9.0
// real-child corpus finding). A boss hit is scaled by his vulnerability and
// role multipliers (applyLiquidatorDamage), so the health he loses is a
// fraction, while the summary's damage totals are integers
// (validateRunSummaryPayload). Recorded as it came, one fractional hit made the
// child's own bridge refuse the whole summary at the end of the run, so an
// honest Ranked run that fought him in a vulnerability window sent none.
// main.mjs now records the whole units he has lost so far.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { applyLiquidatorDamage, createLiquidatorBoss, LIQUIDATOR_ROLE_CHECK_MULTIPLIER } from '../apps/hmh-reboot/src/liquidator-boss.mjs';
import { LIQUIDATOR_MARGIN_FLOOR } from '../apps/hmh-reboot/src/boss-arenas.mjs';

const MAIN = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');

// The ledger of main.mjs, over one boss.
function wholeUnits(losses) {
  let lost = 0;
  let recorded = 0;
  return losses.map((amount) => {
    lost += amount;
    const whole = Math.floor(lost + 1e-6) - recorded;
    recorded += whole;
    return whole;
  });
}

test('a Liquidator hit under a multiplier loses a fraction of health', () => {
  const boss = createLiquidatorBoss({ arena: LIQUIDATOR_MARGIN_FLOOR, startTick: 1_000, maxHealth: 3_000, seed: 1337 });
  const tick = boss.startTick + boss.introTicks + 1;
  const hit = applyLiquidatorDamage({ boss, amount: 3, tick, roleMultiplier: LIQUIDATOR_ROLE_CHECK_MULTIPLIER });
  assert.ok(hit.damageApplied > 0 && !Number.isInteger(hit.damageApplied), String(hit.damageApplied));
});

test('main.mjs records the whole units the boss has lost, never a fraction', () => {
  assert.match(MAIN, /bossSummaryDamage\.lost \+= bossDamage\.damageApplied;\s*const whole = Math\.floor\(bossSummaryDamage\.lost \+ 1e-6\) - bossSummaryDamage\.recorded;\s*bossSummaryDamage\.recorded \+= whole;\s*recordRunDamage\(runSummaryAccumulator, \{ \.\.\.damageEvent, damageApplied: whole, healthBefore: Math\.floor\(healthBefore\) \}\);/);
  assert.equal(MAIN.match(/damageApplied: bossDamage\.damageApplied/g), null, 'the fractional amount is never recorded');
  // The ledger: integers only, and its total is the whole part of what he lost.
  const losses = [3.45, 3.45, 1.25, 2.5, 0.3, 4.3125, 1.15];
  const recorded = wholeUnits(losses);
  assert.ok(recorded.every(Number.isInteger));
  assert.equal(recorded.reduce((sum, value) => sum + value, 0), Math.floor(losses.reduce((sum, value) => sum + value, 0)));
  assert.deepEqual(wholeUnits([0.2, 0.2, 0.2, 0.2, 0.2]), [0, 0, 0, 0, 1], 'fractions carry over');
});

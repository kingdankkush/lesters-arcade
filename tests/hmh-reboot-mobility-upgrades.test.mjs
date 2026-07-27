import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  RUN_UPGRADE_CATALOG,
  createRunProgression,
  getRunProgressionSnapshot,
} from '../apps/hmh-reboot/src/run-progression.mjs';

/**
 * The mobility branch held one upgrade capped at two ranks, so a player
 * building for mobility ran out of picks almost immediately while power,
 * survival and utility each had three-rank picks plus a repeatable tail.
 */

const branchOf = (branch) => Object.values(RUN_UPGRADE_CATALOG).filter((entry) => entry.branch === branch);

test('every branch offers a comparable amount of progression', () => {
  const capacity = (branch) => branchOf(branch).reduce((total, entry) => total + entry.maxRank, 0);
  const branches = ['power', 'survival', 'mobility', 'utility'];
  for (const branch of branches) {
    assert.ok(branchOf(branch).length >= 2, `${branch} needs more than a single upgrade`);
  }
  // Mobility was 2 ranks against 28+ elsewhere.
  assert.ok(capacity('mobility') >= 20, `mobility capacity is only ${capacity('mobility')}`);
});

test('every branch has a repeatable tail so long runs never queue an unspendable choice', () => {
  for (const branch of ['power', 'survival', 'mobility']) {
    assert.ok(
      branchOf(branch).some((entry) => entry.repeatable === true),
      `${branch} has no repeatable mastery pick`,
    );
  }
});

test('movement speed upgrades accumulate into a multiplier the run actually reads', () => {
  const base = getRunProgressionSnapshot(createRunProgression({ seed: 5 }));
  assert.equal(base.effects.moveSpeedMultiplier, 1, 'the default must be neutral');

  const state = createRunProgression({ seed: 5 });
  state.ranks['hot-wallet'] = 3;
  state.ranks['layer-two'] = 4;
  const snapshot = getRunProgressionSnapshot(state);
  const expected = 1 + RUN_UPGRADE_CATALOG['hot-wallet'].amount * 3 + RUN_UPGRADE_CATALOG['layer-two'].amount * 4;
  assert.ok(Math.abs(snapshot.effects.moveSpeedMultiplier - expected) < 1e-9);
  assert.ok(snapshot.effects.moveSpeedMultiplier > 1);
});

test('the movement step consumes the mobility multiplier', async () => {
  const source = await readFile(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  // It must multiply into the same speedMultiplier terrain and power-ups use,
  // rather than being collected and then ignored the way the weapon capstones
  // were.
  assert.match(source, /speedMultiplier: terrainSpeedMultiplier[\s\S]{0,160}runEffects\.moveSpeedMultiplier/);
  // And it must be resolved before that step, not after it.
  const declared = source.indexOf('const runEffects = getRunProgressionSnapshot');
  const used = source.indexOf('runEffects.moveSpeedMultiplier');
  assert.ok(declared > 0 && declared < used, 'runEffects must be declared before the movement step reads it');
});

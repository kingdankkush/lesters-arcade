import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  RUN_UPGRADE_CATALOG,
  createRunProgression,
  getRunProgressionSnapshot,
} from '../apps/hmh-reboot/src/run-progression.mjs';
import { AUTHORED_PROP_ASSET_IDS, authoredPropItemUrl } from '../apps/hmh-reboot/src/authored-prop-atlas.mjs';

/**
 * Upgrade program S3: the critical-strike machinery already exists in
 * combat-events (seeded criticals) and player hits already carry a base
 * 8% / 1.75x. Nothing let a player invest in it. This adds the branch.
 *
 * Deterministic: criticals resolve from the session seed inside
 * combat-events, so raising chance/damage cannot introduce wall-clock or
 * RNG drift.
 */

test('the catalog exposes a critical-chance and a critical-damage upgrade', () => {
  const chance = RUN_UPGRADE_CATALOG['precision-ledger'];
  const damage = RUN_UPGRADE_CATALOG['hard-fork-rounds'];
  assert.ok(chance, 'precision-ledger (crit chance) must exist');
  assert.ok(damage, 'hard-fork-rounds (crit damage) must exist');
  assert.equal(chance.effect, 'criticalChanceBonus');
  assert.equal(damage.effect, 'criticalDamageBonus');
  for (const upgrade of [chance, damage]) {
    assert.equal(upgrade.branch, 'power');
    assert.ok(upgrade.amount > 0, 'each rank must grant something');
    assert.ok(upgrade.maxRank >= 3, 'the branch needs real depth');
    assert.ok(upgrade.title && upgrade.mechanicalLabel, 'players must see what it does');
  }
});

test('critical effects default neutral and accumulate by rank', () => {
  const base = getRunProgressionSnapshot(createRunProgression({ seed: 3 })).effects;
  assert.equal(base.criticalChanceBonus, 0, 'no free crit chance');
  assert.equal(base.criticalDamageBonus, 0, 'no free crit damage');

  const state = createRunProgression({ seed: 3 });
  state.ranks['precision-ledger'] = 3;
  state.ranks['hard-fork-rounds'] = 2;
  const effects = getRunProgressionSnapshot(state).effects;
  assert.ok(Math.abs(effects.criticalChanceBonus - RUN_UPGRADE_CATALOG['precision-ledger'].amount * 3) < 1e-9);
  assert.ok(Math.abs(effects.criticalDamageBonus - RUN_UPGRADE_CATALOG['hard-fork-rounds'].amount * 2) < 1e-9);
});

test('critical chance is capped so it cannot reach guaranteed crits', async () => {
  const source = await readFile(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  // An uncapped chance stack would make every hit critical and flatten the
  // damage curve; the cap keeps the investment meaningful without trivializing.
  assert.match(source, /Math\.min\(\s*CRITICAL_CHANCE_CAP/, 'crit chance must be clamped at the hit site');
  assert.match(source, /CRITICAL_CHANCE_CAP\s*=\s*0\.(4|45|5)/, 'cap must be authored and below 1');
});

test('the player hit site consumes both critical effects', async () => {
  const source = await readFile(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  // The base 8% / 1.75x must be raised by the run effects, or the branch is
  // collected-and-ignored like the inert weapon capstones were.
  assert.match(source, /criticalChance:[\s\S]{0,120}runEffects\.criticalChanceBonus/);
  assert.match(source, /criticalMultiplier:[\s\S]{0,120}runEffects\.criticalDamageBonus/);
});

test('both upgrades have authored power-up art so the upgrade panel cannot break', () => {
  // Cycle 038 lesson: authoredPropItemUrl throws on an unknown id and the
  // cockpit sets that URL inside its render loop, so a missing icon silently
  // renders fewer choices.
  for (const id of ['precision-ledger', 'hard-fork-rounds']) {
    assert.ok(AUTHORED_PROP_ASSET_IDS.includes(id), `${id} needs an authored icon`);
    assert.doesNotThrow(() => authoredPropItemUrl(id));
  }
});

test('every catalog upgrade still resolves to an icon', () => {
  for (const id of Object.keys(RUN_UPGRADE_CATALOG)) {
    assert.doesNotThrow(() => authoredPropItemUrl(id), `${id} has no icon`);
  }
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  HMH_LEVEL_ONE_DROP_ECONOMY,
  dropEconomyBandAt,
  rollLevelOnePowerUpDrop,
  simulateLevelOneDropEconomy,
  summarizeDropEconomy,
} from '../apps/portal/src/hmh-drop-economy.mjs';

const CATEGORY_SET = new Set(['xp', 'score', 'grenade', 'ammo', 'sustain', 'weapon', 'utility', 'offense']);

test('WO-29 defines an authoritative Level 1 drop economy contract with budgeted categories', () => {
  assert.equal(HMH_LEVEL_ONE_DROP_ECONOMY.version, 'wo-29-level-one-drop-economy-v1');
  assert.equal(HMH_LEVEL_ONE_DROP_ECONOMY.seedStream, 'drops');
  assert.deepEqual(Object.keys(HMH_LEVEL_ONE_DROP_ECONOMY.tables).sort(), ['boss', 'elite', 'grunt'].sort());
  for (const [tier, table] of Object.entries(HMH_LEVEL_ONE_DROP_ECONOMY.tables)) {
    assert.ok(table.length >= 6, `${tier} table should have a real pool`);
    assert.ok(table.every((entry) => entry.id && entry.category && CATEGORY_SET.has(entry.category)), `${tier} entries need category metadata`);
    assert.ok(table.every((entry) => entry.weight > 0), `${tier} entries need positive weights`);
  }
  assert.ok(HMH_LEVEL_ONE_DROP_ECONOMY.tables.grunt.some((entry) => entry.id === 'grenade-crate' && entry.category === 'grenade'));
  assert.ok(HMH_LEVEL_ONE_DROP_ECONOMY.tables.boss.some((entry) => entry.id === 'nuke-liquidation' && entry.category === 'offense'));
});

test('WO-29 drop chance bands climb smoothly without flooding the screen', () => {
  const opening = dropEconomyBandAt({ elapsedSeconds: 30 });
  const mid = dropEconomyBandAt({ elapsedSeconds: 8 * 60 });
  const late = dropEconomyBandAt({ elapsedSeconds: 20 * 60 });

  assert.ok(opening.normalDropChance >= 0.11 && opening.normalDropChance <= 0.2, `opening chance ${opening.normalDropChance}`);
  assert.ok(mid.normalDropChance > opening.normalDropChance, 'mid-run chance should exceed opening');
  assert.ok(late.normalDropChance > mid.normalDropChance, 'late-run chance should exceed mid-run');
  assert.ok(late.normalDropChance <= 0.42, `late chance should remain capped, got ${late.normalDropChance}`);
  assert.ok(late.maxPowerUpsPerMinute <= 5.5, `screen economy budget should cap drops/min, got ${late.maxPowerUpsPerMinute}`);
});

test('WO-29 seeded power-up rolls are replayable, inspectable, and luck shifts rarity not event count', () => {
  const base = { seed: 4499, elapsedSeconds: 12 * 60, tier: 'elite', dropChance: 1 };
  const a = rollLevelOnePowerUpDrop({ ...base, luck: 1 });
  const b = rollLevelOnePowerUpDrop({ ...base, luck: 1 });
  const lucky = rollLevelOnePowerUpDrop({ ...base, luck: 2.5 });

  assert.deepEqual(a, b);
  assert.equal(a.seed, base.seed);
  assert.equal(a.tier, 'elite');
  assert.ok(a.dropId, 'forced 100% drop should produce an id');
  assert.ok(a.category, 'drop decision should expose category');
  assert.equal(lucky.didDrop, a.didDrop, 'luck should not change whether this seed produced a drop event');
  assert.ok(lucky.rarityScore >= a.rarityScore, `luck should not downshift rarity for this seeded probe: ${a.dropId} -> ${lucky.dropId}`);
});

test('WO-29 simulator keeps drops scarce across average and elite survival bands', () => {
  const average = simulateLevelOneDropEconomy({ minutes: 8, skillFactor: 0.78, seed: 1001 });
  const elite = simulateLevelOneDropEconomy({ minutes: 25, skillFactor: 1.0, seed: 1001 });
  const averageSummary = summarizeDropEconomy(average);
  const eliteSummary = summarizeDropEconomy(elite);

  assert.ok(averageSummary.totalDrops >= 8 && averageSummary.totalDrops <= 22, `average drops ${averageSummary.totalDrops}`);
  assert.ok(averageSummary.dropsPerMinute <= 3.1, `average DPM ${averageSummary.dropsPerMinute}`);
  assert.ok(eliteSummary.totalDrops >= 50 && eliteSummary.totalDrops <= 105, `elite drops ${eliteSummary.totalDrops}`);
  assert.ok(eliteSummary.dropsPerMinute <= 4.3, `elite DPM ${eliteSummary.dropsPerMinute}`);
  assert.ok(eliteSummary.categories.grenade >= 6, 'elite runs should see grenade refills');
  assert.ok((eliteSummary.categories.offense ?? 0) <= 8, 'screen-clearing offense drops should stay rare');
  assert.ok(eliteSummary.uniqueIds >= 7, 'economy should produce variety without flooding');
});

test('WO-29 runtime delegates drop decisions to the authoritative seeded economy module', () => {
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  assert.ok(main.includes("from './src/hmh-drop-economy.mjs'"), 'main.js should import the WO-29 drop economy module');
  assert.ok(main.includes('rollLevelOnePowerUpDrop({'), 'roguelike drops should call the authoritative decision helper');
  assert.ok(!main.includes('rollDrop({ seed, tier, luck, dropChance'), 'main.js should not keep ad-hoc rollDrop logic');
});

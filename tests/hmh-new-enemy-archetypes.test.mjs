import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { ENEMY_ARCHETYPE_IDS, ENEMY_ARCHETYPES, getEnemyArchetype } from '../apps/hmh-reboot/src/enemy-archetypes.mjs';
import { NEW_ENEMY_ARCHETYPE_IDS, NEW_ENEMY_ARCHETYPES, getNewEnemyArchetype } from '../apps/hmh-reboot/src/enemy-archetypes-2.mjs';
import { DISTRICT_ROLE_GATES, ENCOUNTER_BANDS, selectEncounterArchetype } from '../apps/hmh-reboot/src/encounter-director.mjs';
import { ENEMY_ROSTER_ACTORS } from '../apps/hmh-reboot/src/enemy-roster-atlas.mjs';

const LEGACY_IDS = ['bagholder-rusher', 'forkrunner', 'gas-bomber', 'liquidator-agent', 'validator-cultist', 'whale-enforcer'];
const NEW_IDS = ['hodl-revenant', 'money-printer', 'oracle-marksman', 'pump-and-dump-bloater', 'rug-puller', 'tollkeeper'];

test('the 2.0 enemies are a separate table: the legacy six are untouched and the ids are disjoint', () => {
  assert.deepEqual([...ENEMY_ARCHETYPE_IDS].sort(), LEGACY_IDS);
  assert.deepEqual([...NEW_ENEMY_ARCHETYPE_IDS].sort(), NEW_IDS);
  for (const id of NEW_IDS) {
    assert.equal(Object.hasOwn(ENEMY_ARCHETYPES, id), false, id);
    assert.throws(() => getEnemyArchetype(id), TypeError, `${id} must be unknown to the legacy table`);
    assert.equal(getNewEnemyArchetype(id).id, id);
  }
  assert.throws(() => getNewEnemyArchetype('bagholder-rusher'), TypeError);
});

test('legacy spawn selection never yields a 2.0 enemy in any district, band, ordinal or seed', () => {
  let selections = 0;
  for (const districtId of Object.keys(DISTRICT_ROLE_GATES)) {
    for (const band of ENCOUNTER_BANDS) {
      for (const seed of [0, 1, 7, 12345, 2 ** 31 - 1]) {
        for (let spawnOrdinal = 0; spawnOrdinal < 240; spawnOrdinal++) {
          const { archetypeId } = selectEncounterArchetype({ districtId, bandId: band.id, spawnOrdinal, seed });
          assert.equal(LEGACY_IDS.includes(archetypeId), true, `${districtId}/${band.id}/${spawnOrdinal}/${seed} -> ${archetypeId}`);
          assert.equal(NEW_IDS.includes(archetypeId), false);
          selections++;
        }
      }
    }
  }
  assert.ok(selections >= 6 * ENCOUNTER_BANDS.length * 5 * 240);
});

test('the 2.0 table is reachable only through its own lazy module: no initial-bundle source imports it', () => {
  const directory = new URL('../apps/hmh-reboot/src/', import.meta.url);
  const importers = readdirSync(directory).filter((name) => name.endsWith('.mjs') && name !== 'enemy-archetypes-2.mjs')
    .filter((name) => /enemy-archetypes-2/.test(readFileSync(new URL(name, directory), 'utf8')));
  // Slice HMH-TEN-AREA-GAMEPLAY-WIRING: the ten-area combat module (itself
  // lazy, reached only from world-v2-runtime-context.mjs) is the one importer.
  assert.deepEqual(importers, ['world-v2-combat.mjs']);
});

test('every 2.0 enemy copies a named legacy balance source verbatim, is balance-pending and reads as human or zombie', () => {
  for (const id of NEW_ENEMY_ARCHETYPE_IDS) {
    const archetype = NEW_ENEMY_ARCHETYPES[id];
    const source = getEnemyArchetype(archetype.balanceSource);
    assert.equal(archetype.balancePending, true, id);
    assert.equal(['human', 'zombie'].includes(archetype.identityForm), true, id);
    assert.doesNotMatch(`${archetype.name} ${archetype.faction}`, /animal|beast|mech|robot|vehicle/i);
    for (const key of ['role', 'radius', 'speed', 'maxHealth', 'armor', 'knockbackResistance', 'preferredDistance']) {
      assert.equal(archetype[key], source[key], `${id}.${key}`);
    }
    assert.deepEqual(archetype.costs, source.costs, id);
    assert.deepEqual(archetype.attack, source.attack, id);
    assert.deepEqual(archetype.movement, source.movement, id);
    assert.ok(archetype.telegraph.length >= 12 && archetype.counterplay.length >= 24, id);
    assert.equal(archetype.visual.productionComplete, false, id);
    assert.equal(archetype.visual.eliteEnabled, false, id);
    assert.equal(Object.isFrozen(archetype) && Object.isFrozen(archetype.attack), true, id);
  }
});

test('the temporary sprite fallback reuses an existing legacy roster sprite with a distinct tint', () => {
  const tints = new Set();
  for (const id of NEW_ENEMY_ARCHETYPE_IDS) {
    const { spriteFallback, actor3d, visual } = NEW_ENEMY_ARCHETYPES[id];
    assert.equal(spriteFallback.temporary, true, id);
    assert.equal(ENEMY_ROSTER_ACTORS.includes(spriteFallback.sourceActorId), true, id);
    assert.equal(LEGACY_IDS.includes(spriteFallback.sourceActorId), true, id);
    assert.notEqual(spriteFallback.tint, getEnemyArchetype(spriteFallback.sourceActorId).visual.color, id);
    assert.equal(spriteFallback.tint, visual.color, id);
    assert.equal(tints.has(spriteFallback.tint), false, id);
    tints.add(spriteFallback.tint);
    assert.equal(actor3d.file, `${id}.glb`);
  }
});

// Crypto Bomb Orbit bomblets in the run summary (review of the Genesis Seal
// slice). A bomblet hit carries weaponId 'launcher-rig', so its kill is a
// grenade kill (recordRunKill). Before the fix main.mjs recorded only the
// parent blast as a grenade contact: a launcher blast that missed and a bomblet
// (orbiting at r100, outside the r64 blast) that killed left grenades
// [thrown, detonated, contacts, kills] at [0, 1, 0, 1], and the verifier
// rejected the honest run with grenade-kills-above-contacts. The bomblet's
// non-player hits are now grenade contacts (never a detonation), so kills stay
// within contacts on the v6 and the v7 path.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createBombletPool, spawnBomblets, stepBomblets } from '../apps/hmh-reboot/src/evolution-effects.mjs';
import {
  createRunSummaryAccumulator,
  recordRunBombletDetonation,
  recordRunGrenadeDetonation,
  recordRunKill,
  recordRunWeaponFire,
} from '../sdk/hmh-run-summary.mjs';
import { HMH_RUN_SUMMARY_CATALOGS_V7 as C7 } from '../sdk/hmh-run-summary-schema-v7.mjs';
import { validateRebootRunPlausibility, validateV6RunPlausibility, validateV7RunPlausibility } from '../server/verify/hmh-plausibility.mjs';

const MAIN_SOURCE = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
const readSummary = (name) => JSON.parse(readFileSync(new URL(`./fixtures/ranked/${name}.json`, import.meta.url), 'utf8')).body.evidence.runSummary;
const rowOf = (rows, key, id) => rows.find((row) => row[key] === id);
const rejects = (result) => result.flags.filter((flag) => flag.severity === 'reject').map((flag) => flag.id);
const LAUNCHER = C7.weapons.indexOf('launcher-rig');

// The review's reproduction with the real bomblet module: a launcher shell
// fired, its blast at the origin hit nothing, Crypto Bomb Orbit left three
// bomblets there, and one of them bursts on an enemy at (100, 14) and kills it.
function bombletRun({ recordBomblets }) {
  const state = createRunSummaryAccumulator({ seed: 7, buildHash: 'site-1.9.0:game-1.9.0', mode: 'ranked', heroId: 'lit-commando', startPosition: { x: 1200, y: 2400 }, schemaVersion: 7, catalogs: C7 });
  recordRunWeaponFire(state, { weaponId: 'launcher-rig', emitted: 1, attackId: 'launcher-rig:attack-1' });
  const parent = { grenadeId: 'launcher-rig:00000001', tick: 100, point: { x: 0, y: 0, z: 0 }, radius: 64, damage: 60, hits: [] };
  recordRunGrenadeDetonation(state, parent);
  const pool = createBombletPool();
  spawnBomblets(pool, { tick: parent.tick, parentId: parent.grenadeId, centre: parent.point, parentDamage: parent.damage });
  const enemy = { id: 'enemy-1', x: 100, y: 14, radius: 14 };
  let killed = false;
  let bombletHits = 0;
  for (let tick = parent.tick + 1; tick <= parent.tick + 60 && !killed; tick += 1) {
    for (const detonation of stepBomblets(pool, { tick, targets: [enemy] }).detonations) {
      if (recordBomblets) recordRunBombletDetonation(state, detonation);
      for (const hit of detonation.hits) {
        assert.equal(hit.weaponId, 'launcher-rig', 'a bomblet hit is a launcher hit');
        bombletHits += 1;
        if (!killed) {
          recordRunKill(state, { enemyRoleId: C7.enemyRoles[0], weaponId: hit.weaponId });
          killed = true;
        }
      }
    }
  }
  assert.equal(killed, true, 'a bomblet reached the enemy');
  return { state, bombletHits };
}

// The run's grenade and launcher trail spliced onto an honest fixture: one of
// its Coin Blaster kills becomes the bomblet kill.
function splice(summary, { state }) {
  const s = structuredClone(summary);
  for (const [rows, field] of [[s.kills.byWeapon, 'count'], [s.weapons, 'kills']]) {
    rowOf(rows, 'weaponId', 'coin-blaster')[field] -= 1;
    rowOf(rows, 'weaponId', 'launcher-rig')[field] += 1;
  }
  ['thrown', 'detonated', 'contacts', 'kills'].forEach((field, i) => { s.grenades[field] += state.grenades[i]; });
  const launcher = rowOf(s.weapons, 'weaponId', 'launcher-rig');
  const row = state.weapons[LAUNCHER];
  launcher.pickups = Math.max(1, launcher.pickups);
  launcher.triggers += row[2];
  launcher.triggerContacts += row[3];
  launcher.projectilesEmitted += row[4];
  launcher.projectileContacts += row[5];
  const cache = rowOf(s.collectibles, 'effectId', 'launcher-rig-cache');
  cache.collected = Math.max(1, cache.collected);
  return s;
}

test('a bomblet kill after a blast that missed: its contact is a grenade contact, never a detonation', () => {
  const { state, bombletHits } = bombletRun({ recordBomblets: true });
  assert.ok(bombletHits >= 1);
  // [thrown, detonated, contacts, kills]: the bomblet adds its contact only.
  assert.deepEqual(state.grenades.slice(0, 4), [0, 1, bombletHits, 1]);
  const launcher = state.weapons[LAUNCHER];
  assert.deepEqual([launcher[2], launcher[3], launcher[4], launcher[5]], [1, 0, 1, bombletHits], 'triggers, triggerContacts, emitted, projectileContacts');
  // A bomblet never counts a player hit (it only targets enemies), and a
  // detonation with no hits records nothing.
  const empty = createRunSummaryAccumulator({ seed: 7, buildHash: 'site-1.9.0:game-1.9.0', mode: 'ranked', heroId: 'lit-commando', startPosition: { x: 1200, y: 2400 }, schemaVersion: 7, catalogs: C7 });
  recordRunBombletDetonation(empty, { bombletId: 'b', hits: [{ targetId: 'player' }] });
  recordRunBombletDetonation(empty, { bombletId: 'b', hits: [] });
  assert.deepEqual([...empty.grenades.slice(0, 4), empty.weapons[LAUNCHER][5]], [0, 0, 0, 0, 0]);

  // RED without the recorder: the review's [0, 1, 0, 1].
  assert.deepEqual(bombletRun({ recordBomblets: false }).state.grenades.slice(0, 4), [0, 1, 0, 1]);
});

test('an honest bomblet kill passes the v6 and the v7 verifier; without the recorder both reject it', () => {
  const fixed = bombletRun({ recordBomblets: true });
  const broken = bombletRun({ recordBomblets: false });
  for (const [name, validate] of [['hmh-realistic', validateV6RunPlausibility], ['hmh-valid', validateV6RunPlausibility], ['hmh-v7-liquidator', validateV7RunPlausibility]]) {
    const base = readSummary(name);
    assert.deepEqual(rejects(validateRebootRunPlausibility(base)), [], `${name} as pinned`);
    const honest = splice(base, fixed);
    assert.ok(honest.grenades.kills <= honest.grenades.contacts, name);
    assert.deepEqual(rejects(validate(honest)), [], `${name} with a bomblet kill`);
    assert.deepEqual(rejects(validateRebootRunPlausibility(honest)), [], `${name} through the dispatcher`);
    assert.ok(rejects(validate(splice(base, broken))).includes('grenade-kills-above-contacts'), `${name}: the unrecorded bomblet contact is what the rule catches`);
  }
});

test('main.mjs records every bomblet detonation into the run summary before its hits resolve', () => {
  assert.match(MAIN_SOURCE, /for \(const \[index, detonation\] of bombletFrame\.detonations\.entries\(\)\) \{\s*recordRunBombletDetonation\(runSummaryAccumulator, detonation\);\s*for \(const hit of detonation\.hits\) combatHitIntents\.push/);
  assert.equal(MAIN_SOURCE.match(/recordRunBombletDetonation\(/g).length, 1);
  // Bomblets are never detonations: only the grenade system's blasts are.
  assert.equal(MAIN_SOURCE.match(/recordRunGrenadeDetonation\(/g).length, 1);
  assert.match(MAIN_SOURCE, /for \(const detonation of grenadeFrame\.detonations\) \{\s*recordRunGrenadeDetonation\(runSummaryAccumulator, detonation\);/);
});

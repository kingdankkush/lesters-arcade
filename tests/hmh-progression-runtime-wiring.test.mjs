// Progression release (design package S1.3, 8.3 and 8.6): main.mjs's real
// code for the nuke radius, the launcher's shells, held-weapon crits, the
// re-roll handler, salvage credit, the focus gun and the grenade maximum, run
// against the real modules where the code can be lifted out of the tick.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';

import {
  createRunProgression,
  getRunProgressionSnapshot,
  grantRunXp,
  openRunUpgradeOffer,
  rerollRunUpgradeSlot,
  unlockRunProgressionWeapon,
} from '../apps/hmh-reboot/src/run-progression.mjs';
import {
  HMH_CRITICAL_HELD_WEAPON_IDS,
  createWeaponLoadout,
  stepWeaponLoadout,
} from '../apps/hmh-reboot/src/weapon-system.mjs';
import { COLLECTIBLE_EFFECTS } from '../apps/hmh-reboot/src/collectible-system.mjs';
import { createGrenadeSystem, throwGrenade } from '../apps/hmh-reboot/src/grenades.mjs';
import { HMH_RUN_SUMMARY_CATALOGS } from '../sdk/hmh-run-summary-schema.mjs';

const mainSource = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
const mainAst = parse(mainSource, { sourceType: 'module', ecmaVersion: 'latest' });

function find(predicate, root = mainAst) {
  let found = null;
  (function walk(node) {
    if (found || !node || typeof node !== 'object') return;
    if (node.type && predicate(node)) { found = node; return; }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') walk(value);
    }
  })(root);
  assert.ok(found, 'main.mjs holds the code under test');
  return found;
}
const text = (node) => mainSource.slice(node.start, node.end);
const declarator = (name) => text(find((node) => node.type === 'VariableDeclarator' && node.id?.name === name).init);

test('confirmed first: the nuke branch reached every non-breakable target on the map; it now stops at about 1,100', () => {
  const branch = mainSource.indexOf("} else if (event.kind === 'nuke') {");
  const loop = find((node) => node.type === 'ForOfStatement' && node.start > branch && text(node.right) === 'hurtTargets');
  const run = (event) => {
    const combatHitIntents = [];
    const target = (id, x, y = 0) => ({ id, currentGround: { x, y, z: 0 }, minZ: 0 });
    vm.runInNewContext(text(loop), {
      hurtTargets: [target('near', 300), target('edge', 1_100), target('beyond', 1_101), target('far', 5_000), target('corner', 11_000, 4_000), target('breakable-seal', 40)],
      isBreakableTargetId: (id) => id.startsWith('breakable'),
      actor: { x: 0, y: 0 },
      event,
      tick: 1,
      combatHitIntents,
      Math,
    });
    return JSON.parse(JSON.stringify(combatHitIntents.map((hit) => hit.targetId)));
  };
  // Without a radius (the 1.8.1 effect) the loop is whole-map: the far corner
  // of Level 1 takes the 999 like the hero's own neighbour.
  assert.deepEqual(run({ id: 'nuke', damage: 999 }), ['near', 'edge', 'beyond', 'far', 'corner']);
  // The shipped effect: about 1,100 around the hero; breakables never.
  assert.deepEqual(run({ id: 'nuke', ...COLLECTIBLE_EFFECTS['nuke-liquidation'] }), ['near', 'edge']);
});

test('the launcher throws one shell per shot with the shot direction, damage and blast radius', () => {
  const block = find((node) => node.type === 'IfStatement' && text(node.test) === "event.weaponId === 'launcher-rig'");
  const loadout = createWeaponLoadout({ weaponIds: ['launcher-rig'], activeWeaponId: 'launcher-rig', seed: 12 });
  const event = stepWeaponLoadout(loadout, { tick: 1, fire: true, direction: { x: 0, y: 1 }, progressionByWeapon: { 'launcher-rig': { branches: { rateOfFire: 3, damage: 3 } } } })
    .events.find((candidate) => candidate.type === 'weapon:fire');
  const grenadeSystem = createGrenadeSystem({ capacity: 16 });
  const fires = [];
  const grenadeRecords = [];
  vm.runInNewContext(`for (const event of [fired]) { ${text(block)} }`, {
    fired: event,
    tick: 1,
    actor: { x: 100, y: 200, groundZ: 5 },
    grenadeSystem,
    throwGrenade,
    collectibleSnapshot: { damageMultiplier: 2 },
    runSummaryAccumulator: {},
    recordRunWeaponFire: (_, record) => fires.push(record),
    recordRunGrenade: (_, record) => grenadeRecords.push(record),
  });
  assert.equal(grenadeSystem.active.length, 2, 'Twin Tube fires two shells');
  assert.deepEqual(grenadeSystem.active.map((grenade) => [grenade.mode, grenade.damage, grenade.blastRadius]), [['launcher', 84, 210], ['launcher', 84, 210]]);
  for (const [index, grenade] of grenadeSystem.active.entries()) {
    const shot = event.shots[index];
    assert.ok(Math.abs(grenade.velocity.x / Math.hypot(grenade.velocity.x, grenade.velocity.y) - shot.direction.x) < 1e-9);
  }
  assert.deepEqual(JSON.parse(JSON.stringify(fires)), [{ weaponId: 'launcher-rig', emitted: 2, attackId: event.attackId }]);
  assert.deepEqual(grenadeRecords, []);
});

test('held-weapon direct hits and launcher blasts take the run crit; the knife, hand grenades, burn ticks and self-damage do not', () => {
  const playerCritical = { criticalChance: 0.2, criticalMultiplier: 2.1 };
  const heldCritical = vm.runInNewContext(`(${declarator('heldCritical')})`, {
    HMH_CRITICAL_HELD_WEAPON_IDS, playerCritical, NO_CRITICAL: { criticalChance: 0, criticalMultiplier: 1 },
  });
  for (const weaponId of HMH_CRITICAL_HELD_WEAPON_IDS) assert.equal(heldCritical(weaponId), playerCritical, weaponId);
  for (const weaponId of ['satoshi-frag', 'litecoin-knife', 'coin-blaster']) assert.equal(heldCritical(weaponId).criticalChance, 0, weaponId);
  // The channel pulse, flame contact and War Fork intents spread it; burn ticks keep 0.
  const channel = mainSource.slice(mainSource.indexOf("candidate.type === 'weapon:channel-pulse'"), mainSource.indexOf("candidate.type === 'weapon:flame-pulse'"));
  assert.match(channel, /\.\.\.heldCritical\(event\.weaponId\)/);
  const flame = mainSource.slice(mainSource.indexOf("candidate.type === 'weapon:flame-pulse'"), mainSource.indexOf("candidate.type === 'burner:burn-tick'"));
  assert.match(flame, /\.\.\.heldCritical\(event\.weaponId\)/);
  const burn = mainSource.slice(mainSource.indexOf("candidate.type === 'burner:burn-tick'"), mainSource.indexOf("candidate.type === 'weapon:melee-strike'"));
  assert.match(burn, /criticalChance: 0, criticalMultiplier: 1/);
  const melee = mainSource.slice(mainSource.indexOf("candidate.type === 'weapon:melee-strike'"), mainSource.indexOf("candidate.type === 'weapon:fire'"));
  assert.match(melee, /\.\.\.heldCritical\(event\.weaponId\)/);
  assert.match(mainSource, /for \(const hit of detonation\.hits\) combatHitIntents\.push\(hit\.targetId === 'player' \? \{ \.\.\.hit, tick \} : \{ \.\.\.hit, tick, \.\.\.heldCritical\(hit\.weaponId\) \}\);/);
});

test('the re-roll handler re-rolls the open offer, records the v6 card, re-paints with focus on the new card, and is inert outside the panel', () => {
  const progression = createRunProgression({ seed: 31 });
  unlockRunProgressionWeapon(progression, 'hash-rail');
  while (progression.pendingLevels === 0) grantRunXp(progression, 50, 1);
  openRunUpgradeOffer(progression, { armedWeaponIds: ['hash-rail'] });
  const recorded = [];
  const painted = [];
  const context = {
    simulation: { state: 'upgrade' },
    runProgression: progression,
    runSummaryAccumulator: {},
    V6_UPGRADE_IDS: new Set(HMH_RUN_SUMMARY_CATALOGS.upgrades),
    recordRunUpgradeOffer: (_, ids) => recorded.push(JSON.parse(JSON.stringify(ids))),
    rerollRunUpgradeSlot,
    getRunProgressionSnapshot,
    upgradePanel: { showUpgrade: (snapshot, options) => painted.push(JSON.parse(JSON.stringify([snapshot.pendingChoices.map((choice) => choice.id), options]))) },
  };
  vm.createContext(context);
  context.recordV6UpgradeOffer = vm.runInContext(`(${declarator('recordV6UpgradeOffer')})`, context);
  const applyUpgradeReroll = vm.runInContext(`(${declarator('applyUpgradeReroll')})`, context);
  const before = getRunProgressionSnapshot(progression).pendingChoices.map((choice) => choice.id);
  applyUpgradeReroll(1);
  const after = getRunProgressionSnapshot(progression).pendingChoices.map((choice) => choice.id);
  assert.equal(after[0], before[0]);
  assert.notEqual(after[1], before[1]);
  assert.match(after[1], /^rail-/, 'card 2 stays on the Railgun while it has cards');
  assert.deepEqual(recorded, [[]], 'a v7 gun card is not a v6 upgrade id');
  assert.deepEqual(painted, [[after, { rerolledSlot: 1 }]]);
  applyUpgradeReroll(1);
  assert.equal(painted.length, 1, 'a spent strip changes nothing');
  applyUpgradeReroll(0);
  assert.equal(progression.rerolls, 2);
  assert.equal(recorded.length, 2);
  assert.ok(recorded[1].length <= 1 && recorded[1].every((id) => context.V6_UPGRADE_IDS.has(id)));
  context.simulation.state = 'active';
  const count = progression.rerolls;
  assert.doesNotThrow(() => applyUpgradeReroll(0));
  assert.equal(progression.rerolls, count, 'no re-roll outside the level-up panel');
});

test('salvage, the focus gun and the grenade maximum are wired where the package puts them', () => {
  // Salvage: credited right after each ordinary kill resolves, to the gun that
  // made it, so the weapon step of the next tick reads it.
  assert.match(mainSource, /recordRunKill\(runSummaryAccumulator, \{\s*enemyRoleId: defeatedEnemy\.archetypeId,[\s\S]{0,200}\}\);\s*\/\/[^\n]*\n\s*creditWeaponKills\(weaponLoadout, \{ tick, weaponId: scoreEvent\.weaponId, count: 1, progressionByWeapon \}\);/);
  // The focus gun follows a manual switch (and a new pickup, inside run progression).
  assert.match(mainSource, /const switched = switchWeapon\(weaponLoadout, requestedWeaponId, \{ tick \}\);\s*if \(switched\) \{[\s\S]{0,200}setRunUpgradeFocus\(runProgression, requestedWeaponId\);/);
  // Extra Grenade raises the maximum instead of overflowing it.
  assert.match(mainSource, /raiseHandGrenadeMaximum\(grenadeSystem, \{ amount: grenadeGain \}\)/);
  assert.doesNotMatch(mainSource, /handCharges \+= grenadeGain/);
  // The re-roll handler is wired to the lazy panel, and an offer opens once.
  assert.match(mainSource, /onRerollUpgrade: applyUpgradeReroll,/);
  assert.match(declarator('openLevelOffer'), /openRunUpgradeOffer\(runProgression, \{ armedWeaponIds: weaponIdsWithAmmo\(weaponLoadout\) \}\)/);
  // The rail's charge line reads the upgraded charge.
  assert.doesNotMatch(mainSource, /HMH_WEAPON_DEFINITIONS\['hash-rail'\]\.chargeTicks/);
});

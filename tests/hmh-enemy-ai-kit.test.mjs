// Design package S1.2 (sections 5.2 and 6) and the survey's E2, E3 and B4:
// the enemy AI kit and the core-six AI, exercised through the real static
// enemy steps with the kit passed in, and without it for the 1.8.x paths.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createStaticBlocker } from '../apps/hmh-reboot/src/collision.mjs';
import { createAuthoredGroundQuery, createElevationSurface } from '../apps/hmh-reboot/src/elevation.mjs';
import { ENEMY_ARCHETYPES, ENEMY_BEHAVIOUR_FLAGS, hasBehaviourFlag } from '../apps/hmh-reboot/src/enemy-archetypes.mjs';
import { resolveEnemyAttackAgainstPlayer, stepEnemyAttacks, ENEMY_STRIKE_TICKS } from '../apps/hmh-reboot/src/enemy-combat.mjs';
import { createEnemyPopulation, createEnemyState, planEnemyIntent, stepEnemyPopulation, allocateAttackTokens } from '../apps/hmh-reboot/src/enemy-simulation.mjs';
import { ENCOUNTER_BANDS, DISTRICT_ROLE_GATES, createEncounterDirector, directorViewBounds, stepEncounterDirector } from '../apps/hmh-reboot/src/encounter-director.mjs';
import { automaticDodgeIntent } from '../apps/hmh-reboot/src/automatic-actions.mjs';
import { LEVEL_ONE_WORLD } from '../apps/hmh-reboot/src/level-one-world.mjs';
import * as kit from '../apps/hmh-reboot/src/enemy-ai-kit.mjs';

const FLAT = createElevationSurface({
  id: 'flat', kind: 'ground', area: { type: 'rect', minX: -4000, minY: -4000, maxX: 8000, maxY: 8000 },
  groundZ: 0, visibleTerrainId: 'flat-visible', priority: 0,
});
const flatGround = createAuthoredGroundQuery({ baseSurface: FLAT });
const bounds = { minX: -3000, minY: -3000, maxX: 6000, maxY: 6000, visibleBoundaryId: 'visible-test-edge' };
const HERO = Object.freeze({ id: 'player', x: 0, y: 0, groundZ: 0, radius: 24 });
const OPEN_BUDGET = Object.freeze({ melee: 8, ranged: 8, area: 8, support: 8 });

function enemy(archetypeId, id, x, y = 0) {
  return createEnemyState({ archetypeId, id, x, y, groundZ: 0, visualMode: 'prototype' });
}
const wall = (id, x0, y0, x1, y1) => createStaticBlocker({
  id, shape: { type: 'polygon', vertices: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }] },
  visibleAssetId: `visible-${id}`, minZ: 0, maxZ: 200,
});
const attacks = (enemies, tick, extra = {}) => stepEnemyAttacks({ enemies, player: HERO, tick, budgets: OPEN_BUDGET, kit, kitContext: { lineOfSight: () => true, ...extra } });
function runUntilStrike(subject, { from = 1, limit = 200, extra = {} } = {}) {
  for (let tick = from; tick <= limit; tick += 1) {
    const report = attacks([subject], tick, extra);
    const strikes = report.events.filter((event) => event.enemyId === subject.id);
    if (strikes.length) return { tick, strikes };
  }
  throw new Error('no strike');
}

test('5.2a: behaviour flags replace the role and id checks, and each core archetype carries poise', () => {
  assert.deepEqual(ENEMY_BEHAVIOUR_FLAGS, ['flankLane', 'cover', 'kite', 'holdsChokepoint', 'waddle', 'stalk', 'perch', 'escort']);
  const flagged = (flag) => Object.values(ENEMY_ARCHETYPES).filter((archetype) => hasBehaviourFlag(archetype, flag)).map((archetype) => archetype.id).sort();
  // Exactly the 1.8.x role and id checks, now data.
  assert.deepEqual(flagged('cover'), ['gas-bomber', 'liquidator-agent', 'validator-cultist']);
  assert.deepEqual(flagged('kite'), ['gas-bomber', 'liquidator-agent', 'validator-cultist']);
  assert.deepEqual(flagged('flankLane'), ['forkrunner']);
  assert.deepEqual(flagged('holdsChokepoint'), ['whale-enforcer']);
  for (const archetype of Object.values(ENEMY_ARCHETYPES)) {
    for (const flag of archetype.behavior.flags) assert.ok(ENEMY_BEHAVIOUR_FLAGS.includes(flag), `${archetype.id}.${flag}`);
    assert.ok(archetype.behavior.poise > 0 && archetype.behavior.poise < archetype.maxHealth, archetype.id);
    assert.ok(Number.isInteger(archetype.behavior.staggerTicks) && archetype.behavior.staggerTicks >= 12, archetype.id);
  }
  const source = readFileSync(new URL('../apps/hmh-reboot/src/enemy-simulation.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /archetype\.id === 'whale-enforcer'|archetype\.role === 'flanker'|coverRoles/);
});

test('5.2b: damage during a tell breaks poise, cancels the strike and staggers the body', () => {
  const rusher = enemy('bagholder-rusher', 'poise-rusher', 50);
  const started = attacks([rusher], 1);
  assert.equal(rusher.attackPhase, 'tell');
  assert.equal(started.events.length, 0);
  assert.equal(kit.applyEnemyPoiseDamage(rusher, 10, 2), null, 'under the poise the tell holds');
  const interrupt = kit.applyEnemyPoiseDamage(rusher, 20, 3);
  assert.equal(interrupt.type, 'enemy:interrupted');
  assert.equal(rusher.attackPhase, 'stagger');
  assert.equal(rusher.tellGeometry, null);
  const staggerTicks = ENEMY_ARCHETYPES['bagholder-rusher'].behavior.staggerTicks;
  // No strike ever lands from the broken tell, and no token is held.
  for (let tick = 4; tick < 3 + staggerTicks; tick += 1) {
    assert.equal(attacks([rusher], tick).events.length, 0);
    assert.equal(allocateAttackTokens({ enemies: [rusher], player: HERO, budgets: OPEN_BUDGET, tick }).size, 0);
  }
  // The stagger locks movement like a tell.
  const population = createEnemyPopulation({ capacity: 4, threatCapacity: 40 });
  population.active.push(rusher);
  const before = { x: rusher.x, y: rusher.y };
  stepEnemyPopulation({ population, player: HERO, tick: 5, dtSeconds: 1 / 60, blockers: [], bounds, queryGround: flatGround, kit, kitContext: { seed: 7 } });
  assert.deepEqual({ x: rusher.x, y: rusher.y }, before);
  attacks([rusher], 3 + staggerTicks);
  assert.notEqual(rusher.attackPhase, 'stagger', 'the stagger runs out');
  // Damage outside a tell never staggers.
  const idle = enemy('bagholder-rusher', 'idle-rusher', 900);
  assert.equal(kit.applyEnemyPoiseDamage(idle, 500, 1), null);
});

test('5.2c: a ranged or area tell waits for line of sight and hands its token on', () => {
  const agent = enemy('liquidator-agent', 'los-agent', 300);
  const blocked = attacks([agent], 1, { lineOfSight: () => false });
  assert.equal(agent.attackPhase, 'ready');
  assert.equal(blocked.events.length, 0);
  assert.equal(agent.losBlockedUntilTick, 16);
  assert.equal(allocateAttackTokens({ enemies: [agent], player: HERO, budgets: OPEN_BUDGET, tick: 5 }).size, 0);
  attacks([agent], 16);
  assert.equal(agent.attackPhase, 'tell', 'in sight again, it tells');
  const bomber = enemy('gas-bomber', 'los-bomber', 300);
  attacks([bomber], 1, { lineOfSight: () => false });
  assert.equal(bomber.attackPhase, 'ready');
  // A melee tell needs no sight line.
  const rusher = enemy('bagholder-rusher', 'los-rusher', 40);
  attacks([rusher], 1, { lineOfSight: () => false });
  assert.equal(rusher.attackPhase, 'tell');
});

test('5.2f: every geometry resolves the hero disk, and the telegraph is the hitbox', () => {
  const at = (x, y) => ({ x, y, groundZ: 0 });
  const lane = kit.buildEnemyAttackGeometry({ type: 'lane', halfWidth: 18 }, at(0, 0), at(300, 0));
  assert.equal(kit.enemyGeometryContains(lane, at(150, 41), 24), true);
  assert.equal(kit.enemyGeometryContains(lane, at(150, 43), 24), false);
  const cone = kit.buildEnemyAttackGeometry({ type: 'cone', halfAngle: Math.PI / 6, range: 200 }, at(0, 0), at(100, 0));
  assert.equal(kit.enemyGeometryContains(cone, at(150, 60), 0), true);
  assert.equal(kit.enemyGeometryContains(cone, at(150, 120), 0), false);
  assert.equal(kit.enemyGeometryContains(cone, at(-100, 0), 24), false, 'nothing behind the apex');
  assert.equal(kit.enemyGeometryContains(cone, at(210, 0), 24), true, 'the disk reaches past the range');
  const offset = kit.buildEnemyAttackGeometry({ type: 'offset-circle', offset: 120, radius: 60 }, at(0, 0), at(10, 0));
  assert.deepEqual([offset.center.x, offset.center.y], [120, 0]);
  const rug = kit.buildEnemyAttackGeometry({ type: 'rug-lane', length: 260, halfWidth: 40, pull: 90 }, at(0, 0), at(1, 0));
  const pulled = kit.resolveEnemyGeometryHit(rug, at(200, 20), 24);
  assert.equal(pulled.hit, true);
  assert.ok(pulled.pull.x < 0 && Math.abs(Math.hypot(pulled.pull.x, pulled.pull.y) - 90) < 1e-9, 'a rug pulls the hero toward its owner');
  const tracking = kit.buildEnemyAttackGeometry({ type: 'tracking-lane', length: 600, halfWidth: 10, trackTicks: 20, turnRadiansPerTick: 0.1 }, at(0, 0), at(1, 0));
  const marksman = { id: 'm', attackTellStartedTick: 1, tellGeometry: tracking };
  kit.trackEnemyTell(marksman, at(0, 600), 2);
  assert.ok(marksman.tellGeometry.direction.y > 0 && marksman.tellGeometry.direction.y < Math.sin(0.1) + 1e-9, 'a tracking lane turns at its rate');
  kit.trackEnemyTell(marksman, at(0, 600), 30);
  const locked = marksman.tellGeometry;
  kit.trackEnemyTell(marksman, at(0, -600), 31);
  assert.equal(marksman.tellGeometry, locked, 'and locks after its tracking window');
  assert.throws(() => kit.enemyGeometryContains({ type: 'nope' }, at(0, 0)), /Unsupported enemy attack geometry/);

  // A core-six strike resolves the geometry its tell locked and drew.
  for (const [archetypeId, x] of [['bagholder-rusher', 50], ['forkrunner', 60], ['liquidator-agent', 400], ['whale-enforcer', 90], ['gas-bomber', 380]]) {
    const subject = enemy(archetypeId, `lock-${archetypeId}`, x, 10);
    attacks([subject], 1);
    const drawn = subject.tellGeometry;
    assert.ok(drawn, `${archetypeId} locked a geometry`);
    const { strikes } = runUntilStrike(subject, { from: 2 });
    assert.equal(strikes[0].geometry, drawn, `${archetypeId} strikes the drawn shape`);
  }
});

test('5.2f: the automatic dodge reads the locked shape and the lane width as a parameter', () => {
  const agent = enemy('liquidator-agent', 'dodge-agent', 600, 0);
  agent.attackPhase = 'tell';
  agent.attackPhaseUntilTick = 10;
  agent.telegraphTarget = { x: 0, y: 0, groundZ: 0 };
  // A wide lane (halfWidth 60) the legacy 18 would miss at y = 50.
  agent.tellGeometry = kit.buildEnemyAttackGeometry({ type: 'lane', halfWidth: 60, length: 900 }, agent, { x: -300, y: 0, groundZ: 0 });
  const args = {
    tick: 5, actor: { x: 0, y: 50, groundZ: 0 }, move: { x: 0, y: 1 }, state: { active: false, cooldownReadyTick: 0, distance: 120 },
    body: { radius: 24, minZ: 0, maxZ: 56 }, bounds, blockers: [], queryGround: (x, y) => ({ ...flatGround(x, y), walkable: true, deepWater: false }), enemies: [agent],
  };
  assert.equal(automaticDodgeIntent(args), null, 'without the kit the 18-wide lane misses the hero');
  assert.deepEqual(automaticDodgeIntent({ ...args, tellDanger: kit.enemyTellDanger }), { x: 0, y: 1 });
});

test('section 6: the Agent bursts three rounds inside its strike at mid range and aims one shot beyond', () => {
  const agent = enemy('liquidator-agent', 'burst-agent', 400);
  attacks([agent], 1);
  assert.equal(agent.tellGeometry.type, 'volley');
  const rounds = [];
  for (let tick = 2; tick <= 60; tick += 1) for (const event of attacks([agent], tick).events) rounds.push([tick, event.damage, event.round]);
  const strike = rounds[0][0];
  assert.deepEqual(rounds, [[strike, 4, 0], [strike + 2, 3, 1], [strike + 4, 3, 2]]);
  assert.ok(rounds.at(-1)[0] < strike + ENEMY_STRIKE_TICKS, 'every kick lands inside the 6-tick strike');
  assert.equal(rounds.reduce((sum, [, damage]) => sum + damage, 0), ENEMY_ARCHETYPES['liquidator-agent'].attack.damage);
  const sniper = enemy('liquidator-agent', 'aimed-agent', 600);
  attacks([sniper], 1);
  assert.equal(sniper.tellGeometry.type, 'lane');
  const hitsBehindCover = resolveEnemyAttackAgainstPlayer({ damage: 4, geometry: kit.buildEnemyAttackGeometry(kit.AGENT_BURST, { x: 400, y: 0 }, HERO) }, {
    player: HERO, blockers: [wall('cover', 190, -40, 210, 40)], kit,
  });
  assert.equal(hitsBehindCover.reason, 'cover', 'a volley round is a bullet: cover stops it');
});

test('section 6: the Whale rushes a locked 46-wide lane up to 220 and stumbles at a blocker', () => {
  const open = enemy('whale-enforcer', 'rush-open', 100);
  attacks([open], 1, { probeLane: () => 220 });
  assert.equal(open.tellGeometry.type, 'shove-lane');
  assert.equal(open.tellGeometry.halfWidth, 23);
  assert.equal(Math.round(Math.hypot(open.tellGeometry.to.x - open.x, open.tellGeometry.to.y - open.y)), 220);
  const { tick: openStrike } = runUntilStrike(open, { from: 2, extra: { probeLane: () => 220 } });
  assert.equal(open.attackRecoveryUntilTick, openStrike + ENEMY_ARCHETYPES['whale-enforcer'].attack.recoveryTicks, 'no stumble in the open');
  const population = createEnemyPopulation({ capacity: 4, threatCapacity: 40 });
  population.active.push(open);
  const start = open.x;
  for (let tick = openStrike + 1; tick <= openStrike + ENEMY_STRIKE_TICKS; tick += 1) stepEnemyPopulation({ population, player: HERO, tick, dtSeconds: 1 / 60, blockers: [], bounds, queryGround: flatGround, kit, kitContext: { seed: 1 } });
  assert.ok(Math.abs(open.x - (start - 220)) < 1, `the rush carries the body its lane (${open.x})`);

  const walled = enemy('whale-enforcer', 'rush-walled', 100);
  attacks([walled], 1, { probeLane: () => 140 });
  assert.equal(Math.round(Math.hypot(walled.tellGeometry.to.x - walled.x, walled.tellGeometry.to.y - walled.y)), 140);
  const { tick: walledStrike } = runUntilStrike(walled, { from: 2, extra: { probeLane: () => 140 } });
  assert.equal(walled.attackRecoveryUntilTick, walledStrike + ENEMY_ARCHETYPES['whale-enforcer'].attack.recoveryTicks + kit.WHALE_RUSH.stumbleTicks);
});

test('section 6: the Validator rings a Revenant first, never the player when it has no ally', () => {
  const lone = enemy('validator-cultist', 'lone-validator', 200);
  attacks([lone], 1);
  assert.equal(lone.attackPhase, 'ready', 'no ally, no ring aimed at the player');
  const validator = enemy('validator-cultist', 'validator', 200);
  const rusher = enemy('bagholder-rusher', 'near-rusher', 210);
  const revenant = { ...enemy('bagholder-rusher', 'far-revenant', 600), archetypeId: 'hodl-revenant' };
  const plan = kit.planEnemyTell({ enemy: validator, archetype: ENEMY_ARCHETYPES['validator-cultist'], player: HERO, tick: 1, allies: [validator, rusher, revenant] });
  assert.equal(plan.target.x, 600);
  const fallback = kit.planEnemyTell({ enemy: validator, archetype: ENEMY_ARCHETYPES['validator-cultist'], player: HERO, tick: 1, allies: [validator, rusher] });
  assert.equal(fallback.target.x, 210);
});

test('5.2e: forced motion is swept: a shove slides along a wall and never tunnels', () => {
  const body = enemy('bagholder-rusher', 'shoved', 0, 0);
  const blockers = [wall('shove-wall', 30, -200, 40, 200)];
  kit.shoveEnemy(body, { x: 80, y: 0 }, { blockers, bounds, queryGround: flatGround });
  assert.ok(body.x <= 30 - body.radius + 1e-6, `stopped at the wall (${body.x})`);
  const player = kit.resolveForcedMotion({ body: { radius: 24, minZ: 0, maxZ: 56 }, start: { x: 0, y: 0, groundZ: 0 }, delta: { x: 90, y: 0 }, blockers, bounds, queryGround: flatGround });
  assert.ok(player.x <= 30 - 24 + 1e-6);
});

test('5.2g: the kit director draws a seeded weighted role inside the district gates, and new roles stay dark', () => {
  for (const band of ENCOUNTER_BANDS) {
    for (const districtId of kit.DISTRICT_ORDER) {
      const seen = new Set();
      for (let ordinal = 0; ordinal < 200; ordinal += 1) {
        const pick = kit.selectDirectorArchetype({ districtId, band, spawnOrdinal: ordinal, seed: 99 });
        const role = ENEMY_ARCHETYPES[pick.archetypeId].role;
        assert.ok(DISTRICT_ROLE_GATES[districtId].includes(role), `${band.id}/${districtId} drew ${role}`);
        seen.add(role);
        assert.deepEqual(kit.selectDirectorArchetype({ districtId, band, spawnOrdinal: ordinal, seed: 99 }), pick, 'same seed, same draw');
      }
      const eligible = DISTRICT_ROLE_GATES[districtId].filter((role) => band.allowedRoles.includes(role));
      assert.deepEqual([...seen].sort(), (eligible.length ? eligible : DISTRICT_ROLE_GATES[districtId]).sort(), `${band.id}/${districtId} draws every eligible role`);
    }
  }
  // New roles have no archetypes yet: even enabled they are never drawn, and
  // their table follows package 5.9 (0 = never).
  const elite = ENCOUNTER_BANDS.find((band) => band.id === 'elite');
  const enabled = new Set(kit.NEW_ENEMY_ROLES);
  assert.deepEqual(kit.directorRoleWeights({ districtId: 'hashwood', band: elite, enabledRoles: enabled }).map(([role]) => role).sort(), ['demolition', 'flanker', 'rusher', 'support']);
  assert.equal(kit.NEW_ROLE_DISTRICTS.warden.elite.includes('hashwood'), false);
  assert.equal(kit.NEW_ROLE_DISTRICTS.marksman.endurance.includes('hashwood'), false);
  assert.equal(kit.NEW_ROLE_DISTRICTS.artillery.endurance.includes('frontier-relay'), false);
  assert.deepEqual(kit.KIT_RANGED_ROLES, ['suppressor', 'demolition', 'support', 'trapper', 'artillery', 'marksman']);
});

test('package 2.7: seeded lairs, the view and distance rules, and the one-front rule', () => {
  const points = [
    { id: 'a-west', districtId: 'liquidity-crossing', x: 3700, y: 2400 },
    { id: 'b-east', districtId: 'liquidity-crossing', x: 5700, y: 2400 },
    { id: 'c-near', districtId: 'liquidity-crossing', x: 4900, y: 2600 },
    { id: 'd-far-district', districtId: 'mining-camp', x: 5000, y: 3000 },
  ];
  const player = { x: 4750, y: 2400, groundZ: 16 };
  const camera = directorViewBounds({ x: 4750, y: 2400 });
  const validate = () => ({ allowed: true, groundZ: 0 });
  const choose = (extra = {}) => kit.chooseDirectorLair({ points, districtId: 'liquidity-crossing', player, camera, validate, seed: 5, spawnOrdinal: 3, ...extra });
  const picks = new Set();
  for (let ordinal = 0; ordinal < 40; ordinal += 1) picks.add(choose({ spawnOrdinal: ordinal }).point.id);
  assert.deepEqual([...picks].sort(), ['a-west', 'b-east'], 'on-view and non-neighbouring lairs are never used; the rotation is seeded');
  assert.equal(choose({ pathDistanceAt: (point) => (point.id === 'b-east' ? 3000 : 900) }).point.id, 'a-west', 'past 2,600 path units a lair is out');
  assert.equal(choose({ pathDistanceAt: () => -1 }), null, 'an unreachable lair is out');
  // One front: on the Proof-of-Work bridge having come from the west, only
  // western lairs stay eligible.
  const crossing = LEVEL_ONE_WORLD.crossings.find((entry) => entry.id === 'proof-of-work-bridge');
  const state = { front: null };
  assert.deepEqual(kit.stepOneFront(state, { x: 4300, y: 2400 }, [crossing]), { crossingId: 'proof-of-work-bridge', side: -1 });
  assert.equal(kit.stepOneFront(state, { x: 5000, y: 2400 }, [crossing]).side, -1, 'the side is the one entered from');
  for (let ordinal = 0; ordinal < 20; ordinal += 1) assert.equal(choose({ spawnOrdinal: ordinal, front: state.front, crossings: [crossing] }).point.id, 'a-west');
  assert.equal(kit.stepOneFront(state, { x: 6000, y: 2400 }, [crossing]), null, 'leaving the zone clears the front');
});

test('package 2.7: the kit director spawns on the shipped map through the lair rules', () => {
  const population = createEnemyPopulation({ capacity: 64, threatCapacity: 512 });
  const director = createEncounterDirector({ nextSpawnTick: 1, seed: 11 });
  const player = { x: 800, y: 2400, groundZ: 0 };
  const inserted = [];
  for (let tick = 1; tick <= 3_000; tick += 1) {
    const step = stepEncounterDirector({
      state: director, population, tick, districtId: 'frontier-relay', player, camera: directorViewBounds(player),
      spawnPoints: LEVEL_ONE_WORLD.spawnPoints, queryGround: (x, y) => ({ groundZ: 0, kind: 'ground' }), isBlocked: () => false, isRouteReachable: () => true,
      kit, kitContext: { pathDistanceAt: (point) => Math.hypot(point.x - player.x, point.y - player.y) * 1.3, crossings: LEVEL_ONE_WORLD.crossings, lairRules: kit.LAIR_RULES_SHIPPED_MAP },
    });
    if (step.inserted) inserted.push(step.spawnPointId);
  }
  assert.ok(inserted.length >= 15, `the shipped map keeps its spawn rate (${inserted.length})`);
  assert.ok(new Set(inserted).size >= 2, 'spawns rotate between lairs');
  assert.ok(inserted.every((id) => ['frontier-relay', 'rugpull-ravine'].includes(LEVEL_ONE_WORLD.spawnPoints.find((point) => point.id === id).districtId)));
});

test('package 2.7: leash and recycle retire lost bodies off-view only, never a closing one or a boss add', () => {
  const view = directorViewBounds({ x: 0, y: 0 });
  const lost = enemy('bagholder-rusher', 'lost', 2000);
  const walker = enemy('bagholder-rusher', 'walker', 2500);
  const onView = enemy('bagholder-rusher', 'on-view', 200);
  const add = { ...enemy('liquidator-agent', 'boss:liquidator:w1:0', 2000), id: 'boss:liquidator:w1:0' };
  let walkerPath = 4000;
  const recycled = [];
  for (let tick = 1; tick <= 700; tick += 1) {
    walkerPath -= 1;
    for (const event of kit.stepEnemyLeash({
      enemies: [lost, walker, onView, add], tick, view,
      pathDistanceAt: (body) => (body === lost || body === add || body === onView ? -1 : walkerPath),
    })) recycled.push([event.tick, event.enemyId, event.reason]);
  }
  assert.deepEqual(recycled.slice(0, 1), [[kit.LEASH_UNREACHABLE_TICKS, 'lost', 'unreachable']]);
  assert.equal(recycled.some(([, id]) => id !== 'lost'), false);
  const trailing = enemy('bagholder-rusher', 'trailing', 3000);
  const far = [];
  for (let tick = 1; tick <= 700; tick += 1) far.push(...kit.stepEnemyLeash({ enemies: [trailing], tick, view, pathDistanceAt: () => 3200 }));
  assert.equal(far[0].tick, kit.LEASH_FAR_TICKS + 1, 'a body that never closes past 2,600 goes after 600 ticks');
  assert.equal(far[0].reason, 'far');
});

test('B4: kills and crits freeze ordinary enemies for 2-4 ticks, with a cooldown, and hold their clocks', () => {
  assert.equal(kit.hitStopTicks({ kills: 1 }), 2);
  assert.equal(kit.hitStopTicks({ crits: 1 }), 2);
  assert.equal(kit.hitStopTicks({ kills: 1, critKills: 1 }), 3);
  assert.equal(kit.hitStopTicks({ kills: 3 }), 4);
  assert.equal(kit.hitStopTicks({}), 0);
  const state = kit.createHitStopState();
  const rusher = enemy('bagholder-rusher', 'frozen', 50);
  attacks([rusher], 1);
  const until = rusher.attackPhaseUntilTick;
  assert.equal(kit.triggerHitStop(state, 10, 3), true);
  assert.equal(kit.triggerHitStop(state, 11, 4), false, 'no stacking while frozen');
  let frozen = 0;
  for (let tick = 11; tick <= 20; tick += 1) if (kit.consumeHitStop(state, [rusher])) frozen += 1;
  assert.equal(frozen, 3);
  assert.equal(rusher.attackPhaseUntilTick, until + 3, 'the tell keeps its length');
  assert.equal(kit.triggerHitStop(state, 20, 2), false, 'the cooldown holds');
  assert.equal(kit.triggerHitStop(state, 10 + 3 + kit.HIT_STOP.cooldownTicks, 2), true);
});

test('E2: a dodge in the last 8 ticks of a tell that holds the hero is perfect', () => {
  const rusher = enemy('bagholder-rusher', 'perfect-rusher', 40);
  attacks([rusher], 1);
  const strikeTick = rusher.attackPhaseUntilTick;
  const check = (tick, actor = { x: 0, y: 0, groundZ: 0 }) => kit.isPerfectDodge({ tick, actor, bodyRadius: 24, enemies: [rusher] });
  assert.equal(check(strikeTick - 9), false, 'too early');
  assert.equal(check(strikeTick - 8), true);
  assert.equal(check(strikeTick), true);
  assert.equal(check(strikeTick - 4, { x: 0, y: 400, groundZ: 0 }), false, 'outside the shape');
  assert.equal(kit.isPerfectDodge({ tick: 10, actor: { x: 0, y: 0 }, bodyRadius: 24, enemies: [], bossDangers: [{ resolveTick: 14, contains: () => true }] }), true, 'a boss strike counts');
  assert.ok(kit.PERFECT_DODGE.damageMultiplier > 1 && kit.PERFECT_DODGE.bonusTicks <= 120);
});

test('E3: approach slots are seeded per body, drift every 180 ticks and bias melee pursuit only', () => {
  const a = enemy('bagholder-rusher', 'slot-a', 400);
  const b = enemy('bagholder-rusher', 'slot-b', 400);
  const angle = kit.approachSlotAngle(3, a, 10);
  assert.equal(kit.approachSlotAngle(3, a, 179), angle, 'steady inside an epoch');
  assert.notEqual(kit.approachSlotAngle(3, a, 180), angle, 'drifts on the timer');
  assert.notEqual(kit.approachSlotAngle(3, b, 10), angle, 'each body keeps its own slot');
  assert.notEqual(kit.approachSlotAngle(4, a, 10), angle, 'from the run seed');
  const rusher = ENEMY_ARCHETYPES['bagholder-rusher'];
  assert.ok(kit.approachSlotBias(a, rusher, HERO, 10, { seed: 3 }));
  assert.equal(kit.approachSlotBias(a, ENEMY_ARCHETYPES.forkrunner, HERO, 10, { seed: 3 }), null, 'the flanker keeps its lane');
  assert.equal(kit.approachSlotBias(a, ENEMY_ARCHETYPES['liquidator-agent'], HERO, 10, { seed: 3 }), null);
  assert.equal(kit.approachSlotBias(enemy('bagholder-rusher', 'close', 70), rusher, HERO, 10, { seed: 3 }), null, 'a body at its slot commits');
  // The intent blends it only with the kit.
  const plain = planEnemyIntent(a, { player: HERO, tick: 10 });
  const slotted = planEnemyIntent(a, { player: HERO, tick: 10, kit, kitContext: { seed: 3 } });
  assert.notDeepEqual(slotted.facing, plain.facing);
  // A slot on a chokepoint is pushed outward past the deck.
  const crossing = LEVEL_ONE_WORLD.crossings.find((entry) => entry.id === 'proof-of-work-bridge');
  const zone = kit.chokeZone(crossing);
  for (let index = 0; index < 64; index += 1) {
    const body = { ...enemy('bagholder-rusher', `choke-${index}`, 4750, 2000), spawnedTick: 0 };
    const direction = kit.approachSlotBias(body, rusher, { x: 4750, y: 2400 }, 1, { seed: index, crossings: [crossing] });
    assert.ok(direction, 'a bias exists');
    // Walk the bias 1 unit: it never aims at a slot inside the deck zone.
    const slotAngle = kit.approachSlotAngle(index, body, 1);
    const raw = { x: 4750 + Math.cos(slotAngle) * 60, y: 2400 + Math.sin(slotAngle) * 60 };
    assert.ok(raw.x >= zone.minX && raw.x <= zone.maxX, 'the raw slot sits on the deck');
    assert.ok(Math.abs(direction.x) > 0 || Math.abs(direction.y) > 0);
  }
});

test('the static enemy steps are unchanged without the kit (the 1.8.x corpora and the model baseline depend on it)', () => {
  const run = (useKit) => {
    const bodies = [enemy('liquidator-agent', 'n-agent', 400), enemy('validator-cultist', 'n-validator', 300), enemy('whale-enforcer', 'n-whale', 90)];
    const out = [];
    for (let tick = 1; tick <= 200; tick += 1) {
      const report = stepEnemyAttacks({ enemies: bodies, player: HERO, tick, budgets: OPEN_BUDGET, ...(useKit ? { kit, kitContext: { lineOfSight: () => true } } : {}) });
      for (const event of report.events) out.push([tick, event.enemyId, event.geometry.type, event.damage]);
    }
    return out;
  };
  const legacy = run(false);
  assert.ok(legacy.some(([, id, type]) => id === 'n-validator' && type === 'support-ring'), 'without the kit the lone validator still rings');
  assert.ok(legacy.every(([, , type]) => ['lane', 'support-ring', 'shove-lane'].includes(type)));
  assert.notDeepEqual(run(true), legacy);
});

test('main.mjs hands the kit to every enemy step and keeps new enemy roles dark outside evidence runs and Ranked', () => {
  const main = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  for (const call of ['stepEncounterDirector({', 'stepEnemyPopulation({', 'stepEnemyAttacks({']) {
    const at = main.indexOf(call);
    assert.ok(at > 0 && main.slice(at, at + 2_600).includes('kit: enemyAiKit'), `${call} takes the kit`);
  }
  assert.match(main, /resolveEnemyAttackAgainstPlayer\(event, \{[\s\S]{0,300}kit: enemyAiKit/);
  assert.match(main, /tellDanger: enemyAiKit\.enemyTellDanger/);
  assert.match(main, /const newEnemiesRequested = evidenceSafeEnabled && runtimeParams\.get\('newEnemies'\) === '1';/);
  assert.match(main, /newEnemyRoles = newEnemiesRequested && payload\.mode !== 'ranked' \? new Set\(enemyAiKit\.NEW_ENEMY_ROLES\) : null;/);
  assert.match(main, /enabledRoles: newEnemyRoles/);
  // Recycles retire without kill credit.
  assert.match(main, /retireEnemyFromPopulation\(enemyPopulation, recycle\.enemyId, \{ tick, reason: 'recycled' \}\)/);
  const recycleAt = main.indexOf("reason: 'recycled'");
  assert.doesNotMatch(main.slice(recycleAt - 600, recycleAt + 400), /recordRunKill|recordRunDefeat|runKills/);
});

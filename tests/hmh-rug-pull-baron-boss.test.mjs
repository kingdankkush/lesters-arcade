// The Rug Pull Baron (design package 4.4, slice S3.1, dark behind bossesV2):
// the boss module on its own. Contract bindings, the intro, the HP phases and
// their carpet, the walk budget of every tell, the yank's drift field, the
// rug burn, the knock-down, Double or Nothing, Exit Scam, Exit Liquidity, the
// stall guard and the defeat.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BARON_ATTACK_DEFINITIONS,
  BARON_BODY,
  BARON_BOSS_ID,
  BARON_INTRO_TICKS,
  BARON_KNOCKDOWN_TICKS,
  BARON_MAX_DAMAGE_MULTIPLIER,
  BARON_STALL_TICKS,
  BARON_TARGET_ID,
  BARON_YANK,
  applyRugPullBaronDamage,
  baronCarpetRects,
  baronCoinFace,
  baronKnockDownTargets,
  baronScamTarget,
  baronStrutMark,
  baronYankDirection,
  createRugPullBaronAddCandidates,
  createRugPullBaronBoss,
  getRugPullBaronVulnerability,
  isRugPullBaronTargetable,
  knockDownEnemy,
  onBaronCarpet,
  resolveRugPullBaronAttack,
  rugPullBaronDriftAt,
  rugPullBaronStrikes,
  rugPullBaronStrikesAreFair,
  stepRugPullBaronBoss,
} from '../apps/hmh-reboot/src/rug-pull-baron-boss.mjs';
import { RUG_PULL_BARON_QUARRY, bossArenaInterior } from '../apps/hmh-reboot/src/boss-arenas.mjs';
import { bossShapeClearDistance, bossWalkBudgetTicks } from '../apps/hmh-reboot/src/boss-geometry.mjs';
import { createEnemyPopulation, attemptScheduledEnemyInsertion } from '../apps/hmh-reboot/src/enemy-simulation.mjs';
import { stepEnemyAttacks } from '../apps/hmh-reboot/src/enemy-combat.mjs';
import { HMH_V7_BOSSES, HMH_V7_BOSS_RULES } from '../sdk/hmh-run-contract-v7.mjs';

const ARENA = RUG_PULL_BARON_QUARRY;
const START = 7_200;
const newBaron = (overrides = {}) => createRugPullBaronBoss({ arena: ARENA, startTick: START, maxHealth: 800, seed: 1337, ...overrides });
const hero = (x, y, extra = {}) => ({ x, y, groundZ: 0, vx: 0, vy: 0, ...extra });
const engaged = START + BARON_INTRO_TICKS;

// Steps the boss from `from` to `to` (inclusive) with the hero at `player`
// (a point or a function of the tick) and returns every event.
function run(boss, from, to, player, options = {}) {
  const events = [];
  for (let tick = from; tick <= to; tick += 1) {
    const at = typeof player === 'function' ? player(tick) : player;
    events.push(...stepRugPullBaronBoss({ boss, tick, player: at, ...options }).events);
  }
  return events;
}

test('the Baron keeps the v7 contract: thresholds, target seconds, threat, silver, intro and body', () => {
  const contract = HMH_V7_BOSSES['rug-pull-baron'];
  assert.deepEqual(contract.phaseThresholds, [0.6, 0.25]);
  assert.equal(contract.readyTick, 7_200);
  assert.equal(contract.threat, 24);
  assert.equal(BARON_BOSS_ID, 'rug-pull-baron');
  assert.equal(BARON_TARGET_ID, 'boss-rug-pull-baron');
  assert.ok(BARON_INTRO_TICKS >= HMH_V7_BOSS_RULES.BOSS_INTRO_MIN_TICKS);
  assert.deepEqual({ radius: BARON_BODY.radius, hurt: BARON_BODY.hurtRadius, minZ: BARON_BODY.minZ, maxZ: BARON_BODY.maxZ, armor: BARON_BODY.armor },
    { radius: 44, hurt: 40, minZ: 4, maxZ: 90, armor: 1 });
  assert.ok(Math.abs(BARON_BODY.walkUnitsPerTick * 60 - 100) < 1e-9, 'speed 100 units a second');
  const boss = newBaron();
  assert.deepEqual(boss.thresholds, [480, 200]);
  assert.throws(() => createRugPullBaronBoss({ arena: ARENA }), /maxHealth/);
  assert.throws(() => createRugPullBaronBoss({ arena: ARENA, maxHealth: 800, entry: 'bell' }), /Welcome Mat/);
});

test('the intro is 120 ticks: untargetable, damage-proof and silent, then he engages', () => {
  const boss = newBaron();
  const player = hero(3_000, 1_100);
  for (let tick = START; tick < engaged; tick += 1) {
    assert.deepEqual(stepRugPullBaronBoss({ boss, tick, player }).events, []);
    assert.equal(isRugPullBaronTargetable(boss, tick), false);
    assert.equal(applyRugPullBaronDamage({ boss, amount: 100, tick }).reason, 'intro');
  }
  const report = stepRugPullBaronBoss({ boss, tick: engaged, player });
  assert.equal(report.events[0].type, 'engage');
  assert.equal(isRugPullBaronTargetable(boss, engaged), true);
  assert.equal(applyRugPullBaronDamage({ boss, amount: 10, tick: engaged }).damageApplied, 10);
});

test('HP thresholds clamp the overshoot, halt 90 ticks, clear his tells and change the carpet', () => {
  const boss = newBaron();
  const player = hero(3_000, 1_100);
  run(boss, START, engaged + 200, player);
  assert.ok(boss.pendingAttacks.length > 0 || boss.motion || boss.vanish, 'he is doing something');
  const crossing = applyRugPullBaronDamage({ boss, amount: 700, tick: engaged + 201 });
  assert.equal(crossing.phaseCrossed, 'the-pull');
  assert.equal(boss.health, 480, 'clamped at 60%');
  assert.equal(boss.pendingAttacks.length, 0);
  assert.equal(applyRugPullBaronDamage({ boss, amount: 5, tick: engaged + 201 }).reason, 'halt');
  assert.equal(applyRugPullBaronDamage({ boss, amount: 5, tick: engaged + 201 + HMH_V7_BOSS_RULES.BOSS_PHASE_HALT_TICKS }).reason, 'halt');
  const halt = stepRugPullBaronBoss({ boss, tick: engaged + 202, player }).events.find((event) => event.type === 'halt');
  assert.deepEqual(halt.carpet, baronCarpetRects(ARENA, 1));
  // The west third rolls up.
  const [rolled] = baronCarpetRects(ARENA, 1);
  assert.equal(rolled.minX, ARENA.carpet.minX + (ARENA.carpet.maxX - ARENA.carpet.minX) / 3);
  const after = engaged + 202 + HMH_V7_BOSS_RULES.BOSS_PHASE_HALT_TICKS;
  assert.equal(applyRugPullBaronDamage({ boss, amount: 400, tick: after }).phaseCrossed, 'hard-rug');
  assert.equal(boss.health, 200, 'clamped at 25%');
  const strips = baronCarpetRects(ARENA, 2);
  assert.equal(strips.length, 3);
  for (let k = 1; k < 3; k += 1) assert.ok(Math.abs(strips[k].minY - strips[k - 1].maxY - ARENA.stripGap) < 1e-6, 'bare stone between the strips');
});

test('every tell is walkable: each damaging strike fits its tell from every hero spot on the floor', () => {
  const interior = bossArenaInterior(ARENA);
  const spots = [];
  for (let x = interior.minX; x <= interior.maxX; x += 64) for (let y = interior.minY; y <= interior.maxY; y += 48) spots.push(hero(x, y, { vx: 120, vy: -60 }));
  for (const phaseIndex of [0, 1, 2]) {
    for (const bossSpot of ARENA.marks) {
      const boss = newBaron({ x: bossSpot.x, y: bossSpot.y });
      boss.phaseIndex = phaseIndex;
      for (const player of spots) {
        for (const attackId of ['rug-yank', 'pump-and-dump', 'double-or-nothing']) {
          const strikes = rugPullBaronStrikes(attackId, { boss, player });
          assert.ok(rugPullBaronStrikesAreFair(strikes, player, ARENA), `${attackId} phase ${phaseIndex} from (${player.x}, ${player.y})`);
        }
      }
    }
  }
  // Exit Scam's smoke is centred on him; he uses it when the hero is close.
  const boss = newBaron({ x: 3_200, y: 930 });
  for (const player of spots.filter((spot) => Math.hypot(spot.x - 3_200, spot.y - 930) < 160)) {
    const [smoke] = rugPullBaronStrikes('exit-scam', { boss, player });
    const clear = bossShapeClearDistance(smoke.shape, player, { interior, step: 2, angles: 128 });
    assert.ok(bossWalkBudgetTicks(clear) <= smoke.offset, `smoke from (${player.x}, ${player.y})`);
  }
  assert.equal(BARON_ATTACK_DEFINITIONS['rug-yank'].tellTicks, 72);
  assert.equal(BARON_ATTACK_DEFINITIONS['pump-and-dump'].tellTicks, 54);
  assert.equal(BARON_ATTACK_DEFINITIONS['exit-scam'].tellTicks, 42);
});

test('a resolved yank drifts the carpet 200 units over 16 ticks; pegs and the stone margin never slide', () => {
  const boss = newBaron();
  const player = hero(3_100, 1_000);
  const direction = baronYankDirection(ARENA, player);
  const strikes = rugPullBaronStrikes('rug-yank', { boss, player });
  assert.equal(strikes.length, 1);
  const { fields } = strikes[0].yank;
  assert.equal(fields.length, 1);
  assert.deepEqual(fields[0].pull, { x: direction.x * 12.5, y: direction.y * 12.5 });
  // Resolve a yank by hand through the step: queue it and step to its tick.
  run(boss, START, engaged, player);
  boss.pendingAttacks = [];
  boss.nextActionTick = Infinity;
  const tellTick = engaged + 1;
  boss.pendingAttacks.push({ attackId: 'rug-yank', groupId: 'g', telegraphId: 'g', resolveTick: tellTick + 72, tellStartTick: tellTick, yank: strikes[0].yank, geometry: strikes[0].shape, damage: 10, knockback: 0, groundZ: 0, origin: { x: 0, y: 0 }, target: player });
  const events = run(boss, tellTick, tellTick + 72, player);
  const drift = events.find((event) => event.type === 'drift');
  assert.equal(drift.fromTick, tellTick + 73);
  assert.equal(drift.untilTick, tellTick + 72 + BARON_YANK.ticks);
  let total = 0;
  for (let tick = drift.fromTick - 1; tick <= drift.untilTick + 1; tick += 1) {
    const at = rugPullBaronDriftAt(boss, player, tick);
    if (at) total += Math.hypot(at.x, at.y);
  }
  assert.equal(total, BARON_YANK.distance);
  const peg = ARENA.pegs[0];
  assert.equal(rugPullBaronDriftAt(boss, { x: peg.x + 10, y: peg.y + 10 }, drift.fromTick), null, 'a peg ring holds');
  assert.equal(rugPullBaronDriftAt(boss, { x: ARENA.bounds.minX + 30, y: 930 }, drift.fromTick), null, 'the stone margin holds');
  assert.equal(onBaronCarpet(ARENA, 0, player), true);
  assert.equal(onBaronCarpet(ARENA, 0, { x: peg.x + 10, y: peg.y + 10 }), false);
});

test('the yank pulls toward the nearest wall or crate; Hard Rug alternates its strips and flips every yank', () => {
  const crate = ARENA.props[0].shape.a;
  // West of the first crate, level with it: east carries the hero into it.
  assert.equal(baronYankDirection(ARENA, { x: crate.x - 80, y: crate.y }).id, 'east');
  // Hard by the south lock: south.
  assert.equal(baronYankDirection(ARENA, { x: 3_300, y: ARENA.bounds.maxY - 40 }).id, 'south');
  const boss = newBaron();
  boss.phaseIndex = 2;
  const first = rugPullBaronStrikes('rug-yank', { boss, player: hero(3_300, 930), phaseIndex: 2 })[0].yank;
  assert.equal(first.hardRug, true);
  assert.deepEqual(first.fields.map((field) => Math.sign(field.pull.x)), [1, -1, 1]);
  boss.hardRugYanks = 1;
  const second = rugPullBaronStrikes('rug-yank', { boss, player: hero(3_300, 930), phaseIndex: 2 })[0].yank;
  assert.deepEqual(second.fields.map((field) => Math.sign(field.pull.x)), [-1, 1, -1]);
});

test('a slide stopped by a wall or crate is one rug burn of 10 per yank', () => {
  const boss = newBaron();
  const player = hero(3_100, 1_000);
  run(boss, START, engaged, player);
  boss.pendingAttacks = [];
  boss.nextActionTick = Infinity;
  const fields = rugPullBaronStrikes('rug-yank', { boss, player })[0].yank.fields;
  boss.drifts.push({ groupId: 'y1', fields, fromTick: engaged + 1, untilTick: engaged + 16, burned: false });
  const burn = stepRugPullBaronBoss({ boss, tick: engaged + 2, player, playerDriftBlocked: true }).events.filter((event) => event.type === 'attack');
  assert.equal(burn.length, 1);
  assert.equal(burn[0].attackId, 'rug-burn');
  assert.equal(burn[0].damage, 10);
  assert.deepEqual(resolveRugPullBaronAttack({ event: burn[0], player }), { hit: true, damage: 10, reason: null });
  assert.deepEqual(stepRugPullBaronBoss({ boss, tick: engaged + 3, player, playerDriftBlocked: true }).events.filter((event) => event.type === 'attack'), [], 'once per yank');
  // Blocked off the carpet (no drift there) is no burn.
  boss.drifts.push({ groupId: 'y2', fields, fromTick: engaged + 4, untilTick: engaged + 20, burned: false });
  assert.deepEqual(stepRugPullBaronBoss({ boss, tick: engaged + 5, player: hero(ARENA.bounds.minX + 30, 930), playerDriftBlocked: true }).events.filter((event) => event.type === 'attack'), []);
});

test('the knock-down stops an add on the carpet for 60 ticks: no tell, no movement of its own', () => {
  const population = createEnemyPopulation();
  for (const [id, x, y] of [['boss:rug-pull-baron:w1:0', 3_150, 900], ['boss:rug-pull-baron:w1:1', 2_900, 1_120], ['boss:rug-pull-baron:w1:2', ARENA.pegs[1].x - 5, ARENA.pegs[1].y + 5]]) {
    const result = attemptScheduledEnemyInsertion({ population, schedule: { nextSpawnTick: 0, intervalTicks: 1, burstRemaining: 1 }, candidate: { id, archetypeId: 'bagholder-rusher', x, y, groundZ: 0 }, tick: 0, placementAllowed: true, visualMode: 'normal', threatRemaining: null });
    assert.equal(result.inserted, true);
  }
  const event = { type: 'knockdown', tick: 100, untilTick: 100 + BARON_KNOCKDOWN_TICKS, rects: baronCarpetRects(ARENA, 0), pegs: ARENA.pegs, pegRadius: ARENA.pegRadius };
  const targets = baronKnockDownTargets(event, population.active);
  assert.deepEqual(targets.map((enemy) => enemy.id), ['boss:rug-pull-baron:w1:0'], 'the margin and the peg ring hold');
  const [down] = targets;
  assert.equal(knockDownEnemy(down, { tick: 100 }), true);
  assert.equal(down.attackPhase, 'recovery');
  assert.equal(down.nextDecisionTick, 160);
  assert.deepEqual(down.velocity, { x: 0, y: 0 });
  // Standing on the hero, it still never starts a tell while down.
  for (let tick = 101; tick < 160; tick += 1) {
    const report = stepEnemyAttacks({ enemies: [down], player: { x: down.x + 10, y: down.y }, tick });
    assert.notEqual(down.attackPhase, 'tell', `tick ${tick}`);
    assert.deepEqual(report.events, []);
  }
});

test('Double or Nothing: the coin is fnv(runSeed, ordinal) & 1; red pulls twice (reversed), green fumbles him at x1.15', () => {
  const faces = new Set();
  for (let ordinal = 0; ordinal < 64; ordinal += 1) faces.add(baronCoinFace(1337, ordinal));
  assert.deepEqual([...faces].sort(), ['green', 'red']);
  assert.equal(baronCoinFace(1337, 5), baronCoinFace(1337, 5));
  for (const face of ['red', 'green']) {
    const ordinal = [...Array(64).keys()].find((k) => baronCoinFace(1337, k) === face);
    const boss = newBaron();
    const player = hero(3_100, 1_000);
    run(boss, START, engaged, player);
    boss.pendingAttacks = [];
    boss.vanish = null;
    boss.vanished = false;
    boss.motion = null;
    boss.staggerUntil = -1;
    boss.phaseIndex = 1;
    boss.phaseId = 'the-pull';
    boss.ordinal = ordinal;
    boss.actionCount = 1;
    boss.walked = true;
    boss.nextActionTick = engaged + 1;
    boss.cooldownUntil = {};
    // Force the flip: the yank turn picks it when the hash is under 0.5, so
    // issue it through the strikes and the coin directly.
    const strikes = rugPullBaronStrikes('double-or-nothing', { boss, player });
    assert.equal(strikes.length, 2);
    assert.deepEqual(strikes[1].yank.fields[0].pull, { x: -strikes[0].yank.fields[0].pull.x, y: -strikes[0].yank.fields[0].pull.y }, 'the second pull is reversed');
    assert.equal(strikes[1].offset - strikes[0].offset, 40);
    const tellTick = engaged + 1;
    boss.coin = { ordinal, groupId: 'coin', face: baronCoinFace(1337, ordinal), revealTick: tellTick + 18 + 24 };
    for (const [index, entry] of strikes.entries()) {
      boss.pendingAttacks.push({ attackId: 'double-or-nothing', groupId: 'coin', telegraphId: `coin:${index}`, resolveTick: tellTick + entry.offset, tellStartTick: tellTick, yank: entry.yank, geometry: entry.shape, damage: 10, knockback: 0, groundZ: 0, origin: { x: 0, y: 0 }, target: player });
    }
    boss.nextActionTick = tellTick + 200;
    const events = run(boss, tellTick, tellTick + 140, player);
    const coin = events.find((event) => event.type === 'coin');
    assert.equal(coin.face, face);
    assert.equal(coin.tick, tellTick + 42, 'the reveal comes inside the yank tell');
    const drifts = events.filter((event) => event.type === 'drift');
    if (face === 'red') {
      assert.deepEqual(drifts.map((event) => event.tick), [tellTick + 90, tellTick + 130]);
    } else {
      assert.deepEqual(drifts, []);
      assert.equal(getRugPullBaronVulnerability(boss, tellTick + 60).multiplier, 1.15);
      assert.equal(getRugPullBaronVulnerability(boss, tellTick + 60).windowId, 'fumble');
      const hit = applyRugPullBaronDamage({ boss, amount: 100, tick: tellTick + 60 });
      assert.equal(hit.damageApplied, 115);
      assert.throws(() => applyRugPullBaronDamage({ boss, amount: 1, tick: tellTick + 61, roleMultiplier: 1.16 }), /Baron bound/);
      assert.ok(Math.abs(applyRugPullBaronDamage({ boss, amount: 100, tick: tellTick + 62, roleMultiplier: 1.15 }).damageApplied - 100 * BARON_MAX_DAMAGE_MULTIPLIER) < 1e-6, 'capped at x1.15');
    }
  }
});

test('Exit Scam pre-empts a close hero: smoke, a 60-tick vanish, the gold ring, and a 45-tick x1.15 landing', () => {
  const boss = newBaron();
  const close = hero(3_200, 1_040);
  run(boss, START, engaged - 1, close);
  const tellEvents = run(boss, engaged, engaged + 30, close);
  const tell = tellEvents.find((event) => event.type === 'tell');
  assert.equal(tell.attackId, 'exit-scam', 'a hero within 160 draws Exit Scam first');
  const smoke = run(boss, engaged + 31, tell.tick + 42, close).find((event) => event.type === 'attack' && event.attackId === 'exit-scam');
  assert.equal(smoke.tick - tell.tick, 42);
  assert.equal(smoke.damage, 10);
  assert.equal(resolveRugPullBaronAttack({ event: smoke, player: close }).hit, true);
  const target = boss.vanish.target;
  assert.ok(Math.hypot(target.x - close.x, target.y - close.y) > 160, 'he never lands on the hero');
  assert.equal(baronScamTarget(boss, close, 0).id, baronScamTarget(boss, close, 0).id);
  for (let tick = smoke.tick + 1; tick < smoke.tick + 60; tick += 1) {
    stepRugPullBaronBoss({ boss, tick, player: close });
    assert.equal(isRugPullBaronTargetable(boss, tick), false);
    assert.equal(applyRugPullBaronDamage({ boss, amount: 50, tick }).reason, 'vanished');
  }
  const back = stepRugPullBaronBoss({ boss, tick: smoke.tick + 60, player: close }).events.find((event) => event.type === 'reappear');
  assert.deepEqual({ x: boss.x, y: boss.y }, { x: target.x, y: target.y });
  assert.equal(back.markId, target.id);
  assert.equal(getRugPullBaronVulnerability(boss, smoke.tick + 61).windowId, 'arrival');
  assert.equal(applyRugPullBaronDamage({ boss, amount: 100, tick: smoke.tick + 61 }).damageApplied, 115);
  assert.equal(getRugPullBaronVulnerability(boss, smoke.tick + 60 + 46).active, false);
});

test('Exit Liquidity brings two bagholders a wave under the carpet edge, ids boss:rug-pull-baron:w<n>:<k>, at most four alive', () => {
  const boss = newBaron({ wave: 3 });
  const player = hero(3_000, 850);
  const [order] = rugPullBaronStrikes('exit-liquidity', { boss, player });
  assert.equal(order.summon.wave, 4);
  assert.deepEqual(order.summon.adds.map((add) => [add.id, add.archetypeId]), [['boss:rug-pull-baron:w4:0', 'bagholder-rusher'], ['boss:rug-pull-baron:w4:1', 'bagholder-rusher']]);
  const far = order.summon.adds.map((add) => Math.hypot(add.x - player.x, add.y - player.y));
  for (const mark of ARENA.marks) {
    if (order.summon.adds.some((add) => add.x === mark.x && add.y === mark.y)) continue;
    assert.ok(Math.hypot(mark.x - player.x, mark.y - player.y) <= Math.min(...far) + 1e-9, 'the marks farthest from the hero');
  }
  const event = { type: 'add-wave', attackId: 'exit-liquidity', adds: order.summon.adds, groundZ: 0 };
  assert.equal(createRugPullBaronAddCandidates({ event, alive: 0 }).length, 2);
  assert.equal(createRugPullBaronAddCandidates({ event, alive: 3 }).length, 1);
  assert.equal(createRugPullBaronAddCandidates({ event, alive: 4 }).length, 0);
});

test('he struts to the carpet mark nearest 400 from the hero and never closes to melee', () => {
  const player = hero(2_950, 1_120);
  const mark = baronStrutMark(ARENA, player);
  const score = (m) => Math.abs(Math.hypot(m.x - player.x, m.y - player.y) - 400);
  for (const other of ARENA.marks) assert.ok(score(mark) <= score(other) + 1e-9);
  // A fight where the hero hugs him: he keeps escaping, never melee.
  const boss = newBaron();
  const tells = run(boss, START, START + 3_000, (tick) => hero(boss.x + 60, boss.y)).filter((event) => event.type === 'tell').map((event) => event.attackId);
  assert.ok(tells.includes('exit-scam'));
  assert.ok(tells.every((attackId) => ['exit-scam', 'rug-yank', 'pump-and-dump'].includes(attackId)), 'phase 1 kit only');
});

test('after 4,800 engaged ticks the stall guard loops Hard Rug: a yank, then a sack, every 240', () => {
  const boss = newBaron();
  const player = hero(3_000, 1_100);
  const events = run(boss, START, engaged + BARON_STALL_TICKS + 720, player).filter((event) => event.type === 'tell' && event.tick >= engaged + BARON_STALL_TICKS);
  assert.ok(events.length >= 4);
  for (const event of events) {
    const loopTick = (event.tick - engaged - BARON_STALL_TICKS) % 240;
    assert.deepEqual([event.attackId, loopTick], loopTick === 0 ? ['rug-yank', 0] : ['pump-and-dump', 120]);
  }
});

test('the defeat stops everything at once and emits one generic boss-defeated run event', () => {
  const boss = newBaron();
  const player = hero(3_000, 1_100);
  run(boss, START, engaged + 400, player);
  applyRugPullBaronDamage({ boss, amount: 400, tick: engaged + 401 });
  applyRugPullBaronDamage({ boss, amount: 400, tick: engaged + 492 });
  const kill = applyRugPullBaronDamage({ boss, amount: 400, tick: engaged + 583 });
  assert.equal(kill.defeated, true);
  assert.deepEqual(kill.runEvent, { type: 'game:run-event', name: 'boss-defeated', data: { bossId: 'boss-rug-pull-baron', tick: engaged + 583, elapsedTicks: engaged + 583 - START } });
  assert.equal(kill.runEvent.data.elapsedTicks >= HMH_V7_BOSS_RULES.BOSS_MIN_FIGHT_TICKS, true);
  assert.deepEqual([boss.pendingAttacks, boss.drifts], [[], []]);
  assert.equal(applyRugPullBaronDamage({ boss, amount: 5, tick: engaged + 584 }).runEvent, null);
  // Environmental damage never lands the killing blow.
  const other = newBaron();
  run(other, START, engaged, player);
  other.thresholds = [];
  assert.equal(applyRugPullBaronDamage({ boss: other, amount: 5_000, tick: engaged + 1, environmental: true }).remainingHealth, 1);
});

test('same seed, same fight; another seed differs', () => {
  const fight = (seed) => {
    const boss = newBaron({ seed });
    const lines = [];
    for (let tick = START; tick <= START + 6_000; tick += 1) {
      const angle = tick / 110;
      const player = hero(3_200 + Math.cos(angle) * 240, 930 + Math.sin(angle) * 170, { vx: -Math.sin(angle) * 130, vy: Math.cos(angle) * 93 });
      for (const event of stepRugPullBaronBoss({ boss, tick, player, addsAlive: 0 }).events) lines.push(`${tick}:${event.type}:${event.attackId ?? event.face ?? event.phaseId ?? ''}`);
      if (isRugPullBaronTargetable(boss, tick)) {
        const result = applyRugPullBaronDamage({ boss, amount: 0.2, tick });
        if (result.runEvent) break;
      }
    }
    return lines.join('|');
  };
  assert.equal(fight(99), fight(99));
  assert.notEqual(fight(99), fight(100));
});

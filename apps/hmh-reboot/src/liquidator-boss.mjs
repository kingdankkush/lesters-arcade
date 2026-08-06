import { freezeDeep } from './value-guards.mjs';
const EPSILON = 1e-9;
export const LIQUIDATOR_TARGET_FIGHT_TICKS = 3_600;
export const MAX_BOSS_EVENTS_PER_TICK = 8;


export const LIQUIDATOR_READABILITY_BUDGET = freezeDeep({
  animationLayers: 4,
  simultaneousTelegraphs: 4,
  activeEffects: 24,
  audioVoices: 6,
  activeAdds: 6,
});

import { finite } from './value-guards.mjs';

function nonNegativeInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative integer`);
  return value;
}

export const LIQUIDATOR_PHASES = freezeDeep([
  { id: 'market-open', minTick: 0, maxTick: 1_199, arena: 'open-floor' },
  { id: 'margin-call', minTick: 1_200, maxTick: 2_399, arena: 'narrowed-corners' },
  { id: 'total-liquidation', minTick: 2_400, maxTick: 3_599, arena: 'volatile-safe-zones' },
]);

const defineAttack = (definition) => freezeDeep(definition);
export const LIQUIDATOR_ATTACK_DEFINITIONS = freezeDeep({
  'crash-lane': defineAttack({ id: 'crash-lane', tier: 'primitive', tellTicks: 45, recoveryTicks: 60, damage: 14, telegraph: 'red market-crash lane', geometry: { type: 'line', width: 54 } }),
  'liquidation-zone': defineAttack({ id: 'liquidation-zone', tier: 'primitive', tellTicks: 60, recoveryTicks: 75, damage: 18, telegraph: 'pulsing liquidation circle', geometry: { type: 'circle', radius: 112 } }),
  'debt-collection': defineAttack({ id: 'debt-collection', tier: 'primitive', tellTicks: 30, recoveryTicks: 45, damage: 12, telegraph: 'front-loaded collection ring', geometry: { type: 'melee-circle', radius: 104 } }),
  'margin-call-dash': defineAttack({ id: 'margin-call-dash', tier: 'primitive', tellTicks: 36, recoveryTicks: 60, damage: 16, telegraph: 'locked gold dash lane', geometry: { type: 'line', width: 76 } }),
  'bad-debt-summon': defineAttack({ id: 'bad-debt-summon', tier: 'primitive', tellTicks: 45, recoveryTicks: 90, damage: 0, telegraph: 'three add-entry seals', geometry: { type: 'summon-sites', count: 3 } }),
  'short-squeeze-burst': defineAttack({ id: 'short-squeeze-burst', tier: 'primitive', tellTicks: 48, recoveryTicks: 72, damage: 15, telegraph: 'expanding squeeze ring', geometry: { type: 'ring', innerRadius: 88, outerRadius: 178 } }),
  'circuit-breaker': defineAttack({ id: 'circuit-breaker', tier: 'super', tellTicks: 120, recoveryTicks: 120, damage: 24, telegraph: 'two bright safe circles', geometry: { type: 'safe-circles', radius: 76, count: 2 } }),
  'total-liquidation-super': defineAttack({ id: 'total-liquidation-super', tier: 'super', tellTicks: 150, recoveryTicks: 150, damage: 30, telegraph: 'three final safe circles', geometry: { type: 'safe-circles', radius: 68, count: 3 } }),
});

export const LIQUIDATOR_ATTACK_PLAN = freezeDeep([
  { startTick: 60, attackId: 'crash-lane' },
  { startTick: 300, attackId: 'debt-collection' },
  { startTick: 540, attackId: 'liquidation-zone' },
  { startTick: 780, attackId: 'short-squeeze-burst' },
  { startTick: 1_020, attackId: 'crash-lane' },
  { startTick: 1_260, attackId: 'circuit-breaker' },
  { startTick: 1_560, attackId: 'margin-call-dash' },
  { startTick: 1_800, attackId: 'bad-debt-summon' },
  { startTick: 2_040, attackId: 'liquidation-zone' },
  { startTick: 2_280, attackId: 'crash-lane' },
  { startTick: 2_460, attackId: 'total-liquidation-super' },
  { startTick: 2_820, attackId: 'bad-debt-summon' },
  { startTick: 3_030, attackId: 'margin-call-dash' },
  { startTick: 3_240, attackId: 'short-squeeze-burst' },
  { startTick: 3_420, attackId: 'crash-lane' },
]);

// The authored plan ends at 3,420 elapsed ticks. A player below the target DPS
// would otherwise face a permanently passive boss at full health, so the fight
// continues on a deterministic endless cadence built from the final-phase
// attack set. The loop starts only after the certified 3,600-tick window so the
// authored encounter timeline is unchanged.
export const LIQUIDATOR_ENDLESS_LOOP_START_TICK = LIQUIDATOR_TARGET_FIGHT_TICKS;
export const LIQUIDATOR_ENDLESS_CYCLE_TICKS = 1_440;
export const LIQUIDATOR_ENDLESS_CYCLE = freezeDeep([
  { offset: 60, attackId: 'crash-lane' },
  { offset: 300, attackId: 'short-squeeze-burst' },
  { offset: 540, attackId: 'margin-call-dash' },
  { offset: 780, attackId: 'liquidation-zone' },
  { offset: 1_020, attackId: 'bad-debt-summon' },
  { offset: 1_200, attackId: 'total-liquidation-super' },
]);

function getPhase(elapsedTick) {
  return LIQUIDATOR_PHASES.find((phase) => elapsedTick >= phase.minTick && elapsedTick <= phase.maxTick) ?? LIQUIDATOR_PHASES.at(-1);
}

function plannedStarts(elapsedTick) {
  if (elapsedTick < LIQUIDATOR_ENDLESS_LOOP_START_TICK) {
    return LIQUIDATOR_ATTACK_PLAN
      .filter((entry) => entry.startTick === elapsedTick)
      .map((entry) => ({ attackId: entry.attackId, planKey: String(entry.startTick) }));
  }
  const loopTick = elapsedTick - LIQUIDATOR_ENDLESS_LOOP_START_TICK;
  const cycleIndex = Math.floor(loopTick / LIQUIDATOR_ENDLESS_CYCLE_TICKS);
  const cycleOffset = loopTick % LIQUIDATOR_ENDLESS_CYCLE_TICKS;
  return LIQUIDATOR_ENDLESS_CYCLE
    .filter((entry) => entry.offset === cycleOffset)
    .map((entry) => ({ attackId: entry.attackId, planKey: `loop${cycleIndex}-${entry.offset}` }));
}

function geometryFor(definition, boss, target) {
  const origin = { x: boss.x, y: boss.y };
  if (definition.geometry.type === 'line') return freezeDeep({ type: 'line', origin, target, width: definition.geometry.width });
  if (definition.geometry.type === 'circle') return freezeDeep({ type: 'circle', center: target, radius: definition.geometry.radius });
  if (definition.geometry.type === 'melee-circle') return freezeDeep({ type: 'melee-circle', center: origin, radius: definition.geometry.radius });
  if (definition.geometry.type === 'ring') return freezeDeep({ type: 'ring', center: origin, innerRadius: definition.geometry.innerRadius, outerRadius: definition.geometry.outerRadius });
  if (definition.geometry.type === 'summon-sites') return freezeDeep({ type: 'summon-sites', sites: [{ x: origin.x - 180, y: origin.y - 120 }, { x: origin.x + 180, y: origin.y - 120 }, { x: origin.x, y: origin.y + 190 }] });
  const count = definition.geometry.count;
  const radius = definition.geometry.radius;
  const zones = count === 2
    ? [{ x: origin.x - 150, y: origin.y }, { x: origin.x + 150, y: origin.y }]
    : [{ x: origin.x - 170, y: origin.y - 80 }, { x: origin.x + 170, y: origin.y - 80 }, { x: origin.x, y: origin.y + 170 }];
  return freezeDeep({ type: 'safe-circles', zones, radius });
}

export function createLiquidatorBoss({ id, x, y, groundZ = 0, startTick = 0 } = {}) {
  if (typeof id !== 'string' || id.trim().length === 0) throw new TypeError('boss id is required');
  return {
    id,
    kind: 'boss',
    radius: 56,
    x: finite(x, 'boss.x'),
    y: finite(y, 'boss.y'),
    groundZ: finite(groundZ, 'boss.groundZ'),
    startTick: nonNegativeInteger(startTick, 'startTick'),
    elapsedTick: 0,
    health: 12_000,
    maxHealth: 12_000,
    active: true,
    defeated: false,
    defeatEventEmitted: false,
    phaseId: 'market-open',
    pendingAttacks: [],
    droppedEvents: 0,
    body: freezeDeep({ radius: 56, playerSeparationRadius: 84, maxPressureStep: 4, pinEscapeClearance: 48 }),
  };
}

function pushBounded(boss, events, event) {
  if (events.length >= MAX_BOSS_EVENTS_PER_TICK) {
    boss.droppedEvents += 1;
    return;
  }
  events.push(freezeDeep(event));
}

export function stepLiquidatorBoss({ boss, tick, player } = {}) {
  if (!boss || !Array.isArray(boss.pendingAttacks)) throw new TypeError('boss state is required');
  nonNegativeInteger(tick, 'tick');
  finite(player?.x, 'player.x');
  finite(player?.y, 'player.y');
  finite(player?.groundZ, 'player.groundZ');
  if (tick < boss.startTick) throw new TypeError('tick cannot precede boss startTick');
  const elapsedTick = tick - boss.startTick;
  const events = [];
  const phase = getPhase(elapsedTick);
  if (phase.id !== boss.phaseId) {
    boss.phaseId = phase.id;
    pushBounded(boss, events, { type: 'arena-change', phaseId: phase.id, tick, elapsedTick, arena: phase.arena });
  }

  const starts = plannedStarts(elapsedTick);
  for (const plan of starts) {
    const definition = LIQUIDATOR_ATTACK_DEFINITIONS[plan.attackId];
    const target = freezeDeep({ x: player.x, y: player.y });
    const telegraphId = `${boss.id}:${plan.attackId}:${plan.planKey}`;
    const pending = {
      attackId: plan.attackId,
      telegraphId,
      target,
      origin: freezeDeep({ x: boss.x, y: boss.y }),
      geometry: geometryFor(definition, boss, target),
      groundZ: boss.groundZ,
      resolveTick: tick + definition.tellTicks,
    };
    boss.pendingAttacks.push(pending);
    boss.pendingAttacks.sort((a, b) => a.resolveTick - b.resolveTick || a.telegraphId.localeCompare(b.telegraphId));
    pushBounded(boss, events, { type: 'tell', attackId: plan.attackId, telegraphId, tick, elapsedTick, target, origin: pending.origin, geometry: pending.geometry, groundZ: pending.groundZ, tellTicks: definition.tellTicks, damage: definition.damage });
  }

  const remaining = [];
  for (const pending of boss.pendingAttacks) {
    // A skipped tick must not strand a lit telegraph forever.
    if (pending.resolveTick > tick) {
      remaining.push(pending);
      continue;
    }
    const definition = LIQUIDATOR_ATTACK_DEFINITIONS[pending.attackId];
    const type = pending.attackId === 'bad-debt-summon' ? 'add-wave' : 'attack';
    pushBounded(boss, events, { type, attackId: pending.attackId, telegraphId: pending.telegraphId, tick, elapsedTick, target: pending.target, origin: pending.origin, geometry: pending.geometry, groundZ: pending.groundZ, damage: definition.damage, recoveryTicks: definition.recoveryTicks });
  }
  boss.pendingAttacks = remaining;
  boss.elapsedTick = elapsedTick;
  return freezeDeep({ tick, elapsedTick, phaseId: phase.id, events, pendingCount: remaining.length, droppedEvents: boss.droppedEvents });
}

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= EPSILON) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t));
}

export function resolveLiquidatorAttack({ event, player } = {}) {
  if (!event?.geometry || !['attack', 'add-wave'].includes(event.type)) throw new TypeError('resolved boss event is required');
  const point = { x: finite(player?.x, 'player.x'), y: finite(player?.y, 'player.y') };
  const groundZ = finite(player?.groundZ, 'player.groundZ');
  if (event.type === 'add-wave' || event.damage <= 0) return freezeDeep({ hit: false, damage: 0, reason: 'non-damaging' });
  if (Math.abs(groundZ - event.groundZ) > 64) return freezeDeep({ hit: false, damage: 0, reason: 'elevation' });
  const geometry = event.geometry;
  let hit = false;
  if (geometry.type === 'line') hit = distanceToSegment(point, geometry.origin, geometry.target) <= geometry.width * 0.5;
  else if (geometry.type === 'circle' || geometry.type === 'melee-circle') hit = Math.hypot(point.x - geometry.center.x, point.y - geometry.center.y) <= geometry.radius;
  else if (geometry.type === 'ring') {
    const distance = Math.hypot(point.x - geometry.center.x, point.y - geometry.center.y);
    hit = distance >= geometry.innerRadius && distance <= geometry.outerRadius;
  } else if (geometry.type === 'safe-circles') {
    hit = !geometry.zones.some((zone) => Math.hypot(point.x - zone.x, point.y - zone.y) <= geometry.radius);
  }
  return freezeDeep({ hit, damage: hit ? event.damage : 0, reason: hit ? null : 'outside-hit-geometry' });
}

export function applyLiquidatorDamage({ boss, amount, tick } = {}) {
  if (!boss) throw new TypeError('boss state is required');
  finite(amount, 'damage amount');
  if (amount < 0) throw new TypeError('damage amount must be non-negative');
  nonNegativeInteger(tick, 'tick');
  if (boss.defeated) return freezeDeep({ defeated: true, damageApplied: 0, remainingHealth: 0, runEvent: null });
  const applied = Math.min(boss.health, amount);
  boss.health -= applied;
  if (boss.health > 0) return freezeDeep({ defeated: false, damageApplied: applied, remainingHealth: boss.health, runEvent: null });
  boss.active = false;
  boss.defeated = true;
  let runEvent = null;
  if (!boss.defeatEventEmitted) {
    boss.defeatEventEmitted = true;
    runEvent = freezeDeep({ type: 'game:run-event', name: 'boss-defeated', data: { bossId: boss.id, tick, elapsedTicks: tick - boss.startTick } });
  }
  return freezeDeep({ defeated: true, damageApplied: applied, remainingHealth: 0, runEvent });
}

export function simulateLiquidatorDps({ damagePerTick } = {}) {
  finite(damagePerTick, 'damagePerTick');
  if (damagePerTick < 0) throw new TypeError('damagePerTick must be non-negative');
  const boss = createLiquidatorBoss({ id: 'simulation-liquidator', x: 0, y: 0, startTick: 0 });
  for (let tick = 1; tick <= LIQUIDATOR_TARGET_FIGHT_TICKS; tick += 1) {
    const result = applyLiquidatorDamage({ boss, amount: damagePerTick, tick });
    if (result.defeated) return freezeDeep({ defeated: true, defeatTick: tick, remainingHealth: 0 });
  }
  return freezeDeep({ defeated: false, defeatTick: null, remainingHealth: boss.health });
}

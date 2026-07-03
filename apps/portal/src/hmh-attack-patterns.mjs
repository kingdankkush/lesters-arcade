// Hard Money Heroes — WO-44 enemy attack-pattern planner.
//
// Difficulty pressure must come from readable verbs, composition, and pattern
// density instead of HP/damage inflation. This module is pure and deterministic
// so runtime attacks and future replay verification can share the same contract.

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function unitVector(origin = {}, target = {}) {
  const dx = (Number(target.x) || 0) - (Number(origin.x) || 0);
  const dy = (Number(target.y) || 0) - (Number(origin.y) || 0);
  const d = Math.hypot(dx, dy) || 1;
  return { x: dx / d, y: dy / d };
}

function rotate(v, radians) {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

function hash(seed = 0, salt = 0, id = '') {
  let h = (Number(seed) || 0) >>> 0;
  for (let i = 0; i < String(id).length; i += 1) h = Math.imul(h ^ String(id).charCodeAt(i), 16777619) >>> 0;
  h = (h + Math.imul(salt + 1, 2654435761)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
}

export const ENEMY_ATTACK_PATTERN_CATALOG = Object.freeze([
  Object.freeze({ id: 'aimed-burst', visualTell: 'rifle raise + three amber muzzle pips', telegraphDecal: 'narrow aim line', counterplay: Object.freeze(['sidestep the lead line', 'dash through the gap after shot two']), frequencyPressureScale: 1.55, baseTelegraphFrames: 30 }),
  Object.freeze({ id: 'radial-nova', visualTell: 'red-orange expanding ring under the enemy', telegraphDecal: 'full circular nova ring', counterplay: Object.freeze(['dash across the ring edge', 'use the open wedge between spokes']), frequencyPressureScale: 1.35, baseTelegraphFrames: 38 }),
  Object.freeze({ id: 'lobbed-mortar', visualTell: 'overhead windup + falling shadow marker', telegraphDecal: 'landing shadow circle', counterplay: Object.freeze(['leave the shadow before impact', 'bait the lob away from pickups']), frequencyPressureScale: 1.45, baseTelegraphFrames: 42 }),
  Object.freeze({ id: 'line-dash', visualTell: 'lane rectangle flashes from enemy to player', telegraphDecal: 'straight dash lane', counterplay: Object.freeze(['dash perpendicular to the lane', 'circle around during recovery']), frequencyPressureScale: 1.4, baseTelegraphFrames: 34 }),
  Object.freeze({ id: 'summoner', visualTell: 'cast bar with three small add silhouettes', telegraphDecal: 'summon triangle sigil', counterplay: Object.freeze(['interrupt/burst during cast', 'clear adds before chasing elites']), frequencyPressureScale: 1.3, baseTelegraphFrames: 48 }),
  Object.freeze({ id: 'zone-spitter', visualTell: 'green bubbling mouth + marked puddle trail', telegraphDecal: 'hazard pool circle', counterplay: Object.freeze(['do not kite through the pool', 'rotate around the pool edge']), frequencyPressureScale: 1.5, baseTelegraphFrames: 36 }),
]);

const PATTERN_BY_ID = new Map(ENEMY_ATTACK_PATTERN_CATALOG.map((pattern) => [pattern.id, pattern]));

export function patternIdForEnemy({ enemyId = '', role = '', ranged = false } = {}) {
  const id = String(enemyId).toLowerCase();
  const signature = `${id} ${role}`.toLowerCase();
  if (signature.includes('sheriff') || signature.includes('claim-jumper')) return 'aimed-burst';
  if (signature.includes('turret') || signature.includes('honeypot')) return 'radial-nova';
  if (signature.includes('banker') || signature.includes('ranged')) return 'lobbed-mortar';
  if (signature.includes('coyote') || signature.includes('scorpion') || signature.includes('runner')) return 'line-dash';
  if (signature.includes('zealot') || signature.includes('cult') || signature.includes('summon')) return 'summoner';
  if (signature.includes('gas') || signature.includes('spitter') || signature.includes('beast')) return 'zone-spitter';
  return ranged ? 'aimed-burst' : 'line-dash';
}

function aimedBurstActions({ origin, target, pressure, shotSpeed }) {
  const dir = unitVector(origin, target);
  const count = pressure >= 0.62 ? 3 : 2;
  const spread = pressure >= 0.82 ? 0.16 : 0.08;
  const actions = [];
  for (let i = 0; i < count; i += 1) {
    const offset = (i - (count - 1) / 2) * spread;
    const v = rotate(dir, offset);
    actions.push(Object.freeze({ type: 'shot', vx: Number((v.x * shotSpeed).toFixed(3)), vy: Number((v.y * shotSpeed).toFixed(3)), delayFrames: i * 5 }));
  }
  return actions;
}

function radialNovaActions({ pressure, shotSpeed }) {
  const count = pressure >= 0.7 ? 10 : 8;
  return Object.freeze(Array.from({ length: count }, (_, i) => {
    const a = (Math.PI * 2 * i) / count;
    return Object.freeze({ type: 'shot', vx: Number((Math.cos(a) * shotSpeed * 0.82).toFixed(3)), vy: Number((Math.sin(a) * shotSpeed * 0.82).toFixed(3)), delayFrames: 0 });
  }));
}

function lobbedMortarActions({ origin, target, pressure, seed, enemyId }) {
  const count = pressure >= 0.78 ? 2 : 1;
  return Object.freeze(Array.from({ length: count }, (_, i) => {
    const jitter = ((hash(seed, i, enemyId) % 1000) / 1000 - 0.5) * 1.6;
    return Object.freeze({ type: 'mortar-marker', x: Number(((target.x ?? 0) + jitter).toFixed(2)), y: Number(((target.y ?? 0) + (i ? 1.15 : 0)).toFixed(2)), radiusTiles: 1.45, impactFrames: 42, originX: origin.x ?? 0, originY: origin.y ?? 0 });
  }));
}

function lineDashActions({ origin, target, pressure }) {
  return Object.freeze([Object.freeze({ type: 'dash-lane', fromX: origin.x ?? 0, fromY: origin.y ?? 0, toX: target.x ?? 0, toY: target.y ?? 0, laneWidthTiles: pressure >= 0.7 ? 0.7 : 0.55, dashSpeedTilesPerSecond: pressure >= 0.7 ? 6.4 : 5.4 })]);
}

function summonerActions({ pressure }) {
  return Object.freeze([Object.freeze({ type: 'summon-adds', count: pressure >= 0.7 ? 3 : 2, interruptible: true, spawnTier: 'swarm' })]);
}

function zoneSpitterActions({ target, pressure }) {
  const count = pressure >= 0.7 ? 2 : 1;
  return Object.freeze(Array.from({ length: count }, (_, i) => Object.freeze({ type: 'hazard-pool', x: Number(((target.x ?? 0) + i * 0.9).toFixed(2)), y: Number(((target.y ?? 0) - i * 0.6).toFixed(2)), radiusTiles: 1.3, ttlFrames: 210, maxActivePools: 4 })));
}

export function planEnemyAttackPattern({ enemyId = 'unknown-enemy', role = '', ranged = true, patternId = null, pressure = 0, seed = 0, origin = { x: 0, y: 0 }, target = { x: 0, y: 0 }, shotSpeed = 5.2 } = {}) {
  const safePressure = clamp(pressure, 0, 1);
  const resolvedId = patternId ?? patternIdForEnemy({ enemyId, role, ranged });
  const pattern = PATTERN_BY_ID.get(resolvedId) ?? PATTERN_BY_ID.get('aimed-burst');
  let actions;
  if (pattern.id === 'aimed-burst') actions = aimedBurstActions({ origin, target, pressure: safePressure, shotSpeed });
  else if (pattern.id === 'radial-nova') actions = radialNovaActions({ pressure: safePressure, shotSpeed });
  else if (pattern.id === 'lobbed-mortar') actions = lobbedMortarActions({ origin, target, pressure: safePressure, seed, enemyId });
  else if (pattern.id === 'line-dash') actions = lineDashActions({ origin, target, pressure: safePressure });
  else if (pattern.id === 'summoner') actions = summonerActions({ pressure: safePressure });
  else actions = zoneSpitterActions({ target, pressure: safePressure });
  return Object.freeze({
    enemyId,
    patternId: pattern.id,
    visualTell: pattern.visualTell,
    telegraphDecal: pattern.telegraphDecal,
    counterplay: pattern.counterplay,
    telegraphFrames: Math.round(pattern.baseTelegraphFrames + safePressure * 10),
    recoveryFrames: Math.round(22 + safePressure * 10),
    frequencyMultiplier: Number((1 + safePressure * (pattern.frequencyPressureScale - 1)).toFixed(3)),
    damageMultiplier: 1,
    actions: Object.freeze(actions),
  });
}

export function validateDodgePathForPattern(plan = {}, { dashIFrameSeconds = 0.35, playerMoveSpeedTilesPerSecond = 4.15 } = {}) {
  const telegraphSeconds = (Number(plan.telegraphFrames) || 0) / 60;
  const dashWindowTiles = Math.max(0, Number(playerMoveSpeedTilesPerSecond) || 0) * Math.max(0, Number(dashIFrameSeconds) || 0);
  const hardestWidth = Math.max(0.55, ...((plan.actions ?? []).map((action) => action.laneWidthTiles ?? action.radiusTiles ?? 0.55)));
  const ok = telegraphSeconds >= 0.4 && dashWindowTiles >= Math.min(1.55, hardestWidth * 0.9);
  return Object.freeze({ ok, reason: ok ? 'dash window covers telegraphed escape' : `telegraph=${telegraphSeconds.toFixed(2)}s dashTiles=${dashWindowTiles.toFixed(2)} width=${hardestWidth}` });
}

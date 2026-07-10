// Hard Money Heroes combat balance helpers.
//
// Keep these pure and unit-tested. The runtime can have multiple movement loops
// (older tactical side-scroller + current isometric roguelike), but the fairness
// rules should stay shared: melee enemies may pressure the player, not outrun
// upgraded movement builds or instantly dogpile the player.

export const HMH_PLAYER_BASE_MOVE_SPEED_TILES_PER_SECOND = 4.15;

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export const ELITE_AFFIX_CATALOG = Object.freeze([
  Object.freeze({
    id: 'shielded',
    title: 'Shielded',
    nameplateTag: 'SHIELD',
    visualTell: 'front-facing blue hex shield wedge; exposed back edge stays unlit',
    counterplay: Object.freeze(['flank the exposed rear arc', 'grenade behind the shield']),
    modifiers: Object.freeze({ directionalFrontShield: true, shieldArcDegrees: 118 }),
  }),
  Object.freeze({
    id: 'splitter',
    title: 'Splitter',
    nameplateTag: 'SPLIT',
    visualTell: 'two ghost silhouettes flicker inside the elite before death',
    counterplay: Object.freeze(['clear space before finishing it', 'save pierce or area damage for the split adds']),
    modifiers: Object.freeze({ splitOnDeathCount: 2, splitSpawnTier: 'swarm' }),
  }),
  Object.freeze({
    id: 'volatile',
    title: 'Volatile',
    nameplateTag: 'BOOM',
    visualTell: 'orange fuse decal pulses underfoot for one second on death',
    counterplay: Object.freeze(['dash out after the kill', 'detonate inside enemy packs for payoff']),
    modifiers: Object.freeze({ deathExplosion: true, fuseFrames: 60, explosionRadiusTiles: 2.4 }),
  }),
  Object.freeze({
    id: 'magnetron',
    title: 'Magnetron',
    nameplateTag: 'MAGNET',
    visualTell: 'purple coin-arcs spiral toward the elite chest',
    counterplay: Object.freeze(['kill it to release stolen drops', 'kite away from loose XP piles']),
    modifiers: Object.freeze({ pullsDrops: true, dropPullRadiusTiles: 8 }),
  }),
  Object.freeze({
    id: 'warder',
    title: 'Warder',
    nameplateTag: 'WARD',
    visualTell: 'slow-aura dome decal with clear cyan edge',
    counterplay: Object.freeze(['fight outside the dome', 'focus the warder before the pack catches you']),
    modifiers: Object.freeze({ slowAura: true, auraRadiusTiles: 4.2, playerSlowMultiplier: 0.82 }),
  }),
  Object.freeze({
    id: 'vampiric',
    title: 'Vampiric',
    nameplateTag: 'VAMP',
    visualTell: 'red fiat-glow tether pulses from nearby enemies into the elite',
    counterplay: Object.freeze(['burst it first', 'separate it from the pack before committing damage']),
    modifiers: Object.freeze({ healsNearbyOnHit: true, healPulseRadiusTiles: 5, healShare: 0.12 }),
  }),
  Object.freeze({
    id: 'juggernaut',
    title: 'Juggernaut',
    nameplateTag: 'JUGG',
    visualTell: 'heavy white shoulder plates and dust puffs on every step',
    counterplay: Object.freeze(['do not rely on knockback', 'use movement lanes and damage over time']),
    modifiers: Object.freeze({ immuneToKnockback: true, speedMultiplier: 0.8 }),
  }),
]);

function affixWeightByPressureFor({ pressure = 0, role = 'melee' } = {}) {
  const p = clamp(pressure, 0, 1);
  const ranged = role === 'ranged' || role === 'stationary';
  return Object.freeze({
    shielded: Number((1.1 + p * 0.55 + (role === 'melee' ? 0.25 : 0)).toFixed(3)),
    splitter: Number((0.85 + p * 0.7).toFixed(3)),
    volatile: Number((0.95 + p * 0.8).toFixed(3)),
    magnetron: Number((0.75 + p * 0.55).toFixed(3)),
    warder: Number((0.8 + p * 0.9).toFixed(3)),
    vampiric: Number((0.7 + p * 0.75).toFixed(3)),
    juggernaut: Number((0.8 + p * 0.55 + (ranged ? -0.25 : 0.2)).toFixed(3)),
  });
}

function seededAffixHash(seed = 0, salt = 0, enemyId = '') {
  let h = (Number(seed) || 0) >>> 0;
  for (let i = 0; i < String(enemyId).length; i += 1) h = Math.imul(h ^ String(enemyId).charCodeAt(i), 16777619) >>> 0;
  h = (h + Math.imul(salt + 1, 2246822519)) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
}

function weightedAffixPick(pool, weights, seed, salt, enemyId) {
  const total = pool.reduce((sum, affix) => sum + Math.max(0, Number(weights[affix.id]) || 0), 0);
  if (total <= 0) return pool[seededAffixHash(seed, salt, enemyId) % pool.length];
  const roll = (seededAffixHash(seed, salt, enemyId) / 0xffffffff) * total;
  let acc = 0;
  for (const affix of pool) {
    acc += Math.max(0, Number(weights[affix.id]) || 0);
    if (roll <= acc) return affix;
  }
  return pool.at(-1);
}

export function resolveEliteAffixes({ enemyId = 'unknown-enemy', elite = false, boss = false, pressure = 0, seed = 0, role = 'melee', affixWeightByPressure = null } = {}) {
  if (!elite && !boss) return Object.freeze([]);
  const count = clamp(pressure, 0, 1) >= 0.7 ? 2 : 1;
  const weights = affixWeightByPressure ?? affixWeightByPressureFor({ pressure, role });
  const pool = [...ELITE_AFFIX_CATALOG];
  const picks = [];
  for (let i = 0; i < count && pool.length > 0; i += 1) {
    const picked = weightedAffixPick(pool, weights, seed, i, enemyId);
    picks.push(picked);
    const index = pool.findIndex((affix) => affix.id === picked.id);
    if (index >= 0) pool.splice(index, 1);
  }
  return Object.freeze(picks.map((affix) => Object.freeze({ ...affix })));
}

export function summarizeEliteAffixRuntime(affixes = []) {
  const summary = {
    speedMultiplier: 1,
    immuneToKnockback: false,
    directionalFrontShield: false,
    splitOnDeathCount: 0,
    deathExplosion: false,
    pullsDrops: false,
    slowAura: false,
    healsNearbyOnHit: false,
  };
  for (const affix of Array.isArray(affixes) ? affixes : []) {
    const modifiers = affix.modifiers ?? {};
    summary.speedMultiplier *= Number(modifiers.speedMultiplier) || 1;
    summary.immuneToKnockback ||= Boolean(modifiers.immuneToKnockback);
    summary.directionalFrontShield ||= Boolean(modifiers.directionalFrontShield);
    summary.splitOnDeathCount += Math.max(0, Number(modifiers.splitOnDeathCount) || 0);
    summary.deathExplosion ||= Boolean(modifiers.deathExplosion);
    summary.pullsDrops ||= Boolean(modifiers.pullsDrops);
    summary.slowAura ||= Boolean(modifiers.slowAura);
    summary.healsNearbyOnHit ||= Boolean(modifiers.healsNearbyOnHit);
  }
  summary.speedMultiplier = Number(summary.speedMultiplier.toFixed(3));
  return Object.freeze(summary);
}

export function calculateEnemyChaseSpeed({
  catalogSpeed = 1,
  enemySpeed = catalogSpeed,
  elite = false,
  boss = false,
  pressure = 0,
  encounterSpeedMul = 1,
  slowFactor = 1,
  playerMoveSpeed = HMH_PLAYER_BASE_MOVE_SPEED_TILES_PER_SECOND,
} = {}) {
  const base = clamp(enemySpeed, 0, 6);
  const pressureMul = 1 + clamp(pressure, 0, 1) * 0.18;
  const authoredMul = clamp(encounterSpeedMul, 0.65, 1.08);
  const roleMul = boss ? 1.05 : elite ? 0.82 : 0.74;
  const raw = base * roleMul * pressureMul * authoredMul * clamp(slowFactor, 0, 1);
  const capRatio = boss ? 1.08 : elite ? 0.92 : 0.86;
  const speedCap = Math.max(0.45, clamp(playerMoveSpeed, 1, 12) * capRatio);
  return Number(Math.max(0, Math.min(raw, speedCap)).toFixed(3));
}

export function calculateSideScrollerEnemySpeed({
  catalogSpeed = 1,
  enemySpeed = catalogSpeed,
  role = 'cover-shooter',
  miniBoss = false,
  difficultyAiLevel = 0,
  playerMoveSpeed = 3.1,
} = {}) {
  if (miniBoss) return 0.24;
  if (role !== 'aggressive-melee-rusher') return Number((clamp(enemySpeed, 0, 6) * 0.55).toFixed(3));
  return calculateEnemyChaseSpeed({
    enemySpeed,
    elite: false,
    pressure: clamp(difficultyAiLevel / 10, 0, 1),
    encounterSpeedMul: 0.9,
    playerMoveSpeed,
  });
}

export function calculateEnemyMeleeDamage({ normalHitDamage = 5, elite = false } = {}) {
  const base = Math.max(1, Number(normalHitDamage) || 5);
  const scaled = elite ? base * 1.18 : base * 0.78;
  return Math.max(1, Math.round(scaled));
}

function enemyBalanceRole(enemy = {}, { boss = false } = {}) {
  const signature = `${enemy.id ?? ''} ${enemy.class ?? ''} ${enemy.aiArchetype ?? ''} ${enemy.preferredRangeMode ?? ''}`.toLowerCase();
  if (boss || enemy.boss || signature.includes('boss')) return 'boss';
  if ((enemy.speed ?? 0) <= 0 || signature.includes('stationary') || signature.includes('turret') || signature.includes('trap')) return 'stationary';
  if (signature.includes('flyer') || signature.includes('hover') || signature.includes('drone') || signature.includes('wisp')) return 'flyer';
  if (enemy.preferredRangeMode === 'ranged' || signature.includes('ranged') || signature.includes('shooter')) return 'ranged';
  return 'melee';
}

export function buildEnemyBalanceCard({
  enemy = {},
  elite = false,
  boss = false,
  pressure = 0,
  encounterSpeedMul = 1,
  slowFactor = 1,
  playerMoveSpeed = HMH_PLAYER_BASE_MOVE_SPEED_TILES_PER_SECOND,
} = {}) {
  const role = enemyBalanceRole(enemy, { boss });
  const catalogSpeed = clamp(enemy.speed ?? enemy.catalogSpeed ?? 1, 0, 8);
  const safePlayerSpeed = clamp(playerMoveSpeed, 1, 12);
  const effectiveElite = Boolean(elite || boss || enemy.boss);
  const chaseSpeed = role === 'melee'
    ? calculateEnemyChaseSpeed({
        enemySpeed: catalogSpeed,
        elite: effectiveElite,
        pressure,
        encounterSpeedMul,
        slowFactor,
        playerMoveSpeed: safePlayerSpeed,
      })
    : 0;
  const spawnSpeed = role === 'stationary'
    ? 0
    : role === 'boss'
      ? Math.min(catalogSpeed * 0.62, 1.1)
      : role === 'flyer'
        ? Math.min(catalogSpeed * 0.72, safePlayerSpeed * 0.78)
        : role === 'ranged'
          ? Math.min(catalogSpeed * 0.64, safePlayerSpeed * 0.68)
          : chaseSpeed;
  const minTellFrames = role === 'boss' ? 48
    : role === 'stationary' ? 42
      : role === 'ranged' ? 34
        : role === 'flyer' ? 30
          : effectiveElite ? 30 : 28;
  const recoveryFrames = role === 'boss' ? 54
    : role === 'stationary' ? 40
      : role === 'ranged' ? 32
        : role === 'flyer' ? 28
          : effectiveElite ? 30 : 24;
  const capRatio = effectiveElite ? 0.92 : 0.86;
  const safePressure = clamp(pressure, 0, 1);
  const affixWeightByPressure = affixWeightByPressureFor({ pressure: safePressure, role });
  return Object.freeze({
    enemyId: enemy.id ?? enemy.enemyId ?? 'unknown-enemy',
    title: enemy.title ?? enemy.id ?? 'Unknown Enemy',
    role,
    tier: boss || enemy.boss ? 'boss' : effectiveElite ? 'elite' : (enemy.tier ?? enemy.class ?? 'grunt'),
    speedLaw: Object.freeze({
      catalogSpeed: Number(catalogSpeed.toFixed(3)),
      spawnSpeed: Number(spawnSpeed.toFixed(3)),
      chaseSpeed,
      playerMoveSpeed: Number(safePlayerSpeed.toFixed(3)),
      capRatio,
      pressure: Number(clamp(pressure, 0, 1).toFixed(3)),
    }),
    readability: Object.freeze({
      minTellFrames,
      recoveryFrames,
      note: role === 'melee' ? 'pressures below player escape speed' : role === 'boss' ? 'deliberate boss-class movement' : 'readable non-melee pressure',
    }),
    affixWeightByPressure,
  });
}

export function buildEnemyBalanceCards(enemies = [], options = {}) {
  return Object.freeze((Array.isArray(enemies) ? enemies : []).map((enemy) => buildEnemyBalanceCard({ enemy, ...options })));
}

export function validateEnemyBalanceCards(cards = []) {
  const errors = [];
  for (const card of Array.isArray(cards) ? cards : []) {
    if (!card.enemyId) errors.push('enemy card missing id');
    if (!['melee', 'ranged', 'flyer', 'stationary', 'boss'].includes(card.role)) errors.push(`${card.enemyId} invalid role ${card.role}`);
    if ((card.speedLaw?.spawnSpeed ?? -1) < 0) errors.push(`${card.enemyId} spawn speed must be non-negative`);
    if (card.role === 'melee') {
      const cap = (card.speedLaw?.playerMoveSpeed ?? HMH_PLAYER_BASE_MOVE_SPEED_TILES_PER_SECOND) * (card.speedLaw?.capRatio ?? 0.86);
      if ((card.speedLaw?.chaseSpeed ?? 0) > cap + 1e-6) errors.push(`${card.enemyId} chase speed ${card.speedLaw.chaseSpeed} exceeds speed-law cap ${cap.toFixed(3)}`);
    }
    if ((card.readability?.minTellFrames ?? 0) < 24) errors.push(`${card.enemyId} tell frames too low`);
    if ((card.readability?.recoveryFrames ?? 0) < 20) errors.push(`${card.enemyId} recovery frames too low`);
    if (card.role === 'boss' && (card.readability?.minTellFrames ?? 0) < 42) errors.push(`${card.enemyId} boss tell frames too low`);
    const weights = card.affixWeightByPressure ?? {};
    for (const affixId of ELITE_AFFIX_CATALOG.map((affix) => affix.id)) {
      if (!Number.isFinite(Number(weights[affixId])) || Number(weights[affixId]) < 0) errors.push(`${card.enemyId} invalid affix weight ${affixId}`);
    }
    for (const affix of Array.isArray(card.affixes) ? card.affixes : []) {
      const modifiers = affix.modifiers ?? {};
      if (Object.hasOwn(modifiers, 'healthMultiplier') || Object.hasOwn(modifiers, 'rawHp') || Object.hasOwn(modifiers, 'maxHpMultiplier')) {
        errors.push(`${card.enemyId} affix ${affix.id ?? 'unknown'} adds HP inflation`);
      }
    }
  }
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) });
}

export function calculateMeleeAttackResetFrames({ preferredResetFrames = null } = {}) {
  const preferred = Number(preferredResetFrames);
  if (!Number.isFinite(preferred)) return 72;
  return Math.max(72, Math.round(preferred));
}

const DAMAGE_RECAP_LABELS = Object.freeze({
  'enemy-melee': 'Enemy melee hit',
  'mini-boss-melee': 'Mini-boss melee hit',
  'boss-contact': 'Boss contact hit',
  'enemy-shot': 'Enemy gunfire',
  'environment-hazard': 'Environmental hazard',
  gap: 'Gap hazard',
});

export function calculatePlayerDamageRecovery({
  damage = 5,
  source = 'hit',
  armor = 1,
  invulnerability = 1,
  baseInvulnerableFrames = 72,
} = {}) {
  const armorScale = Math.max(1, Number(armor) || 1);
  const appliedDamage = Math.max(1, Math.round((Number(damage) || 5) / armorScale));
  const sourceText = String(source ?? 'hit');
  const melee = sourceText.includes('melee') || sourceText.includes('boss-contact');
  const projectile = sourceText.includes('shot') || sourceText.includes('gun');
  const hazard = sourceText.includes('hazard') || sourceText === 'gap';
  const iFrameMul = Math.max(0.8, Math.min(1.45, Number(invulnerability) || 1));
  const sourceBonus = melee ? 10 : projectile ? 6 : hazard ? 4 : 0;
  return Object.freeze({
    appliedDamage,
    invulnerableFrames: Math.max(48, Math.round((baseInvulnerableFrames + sourceBonus) * iFrameMul)),
    knockbackTiles: Number((melee ? 0.72 : projectile ? 0.36 : hazard ? 0.22 : 0.3).toFixed(2)),
    recapLabel: DAMAGE_RECAP_LABELS[sourceText] ?? 'Combat damage',
    readableSource: melee ? 'melee' : projectile ? 'gunfire' : hazard ? 'hazard' : 'combat',
  });
}

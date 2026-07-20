// Bridges live combat state to the durable sprite-pipeline (SpriteActor).
//
// This is the ONLY place that knows how gameplay state (combat.*) maps onto
// canonical animation states + facing direction. The renderer calls
// resolveActorFrame() and draws whatever image comes back; adding new states or
// actors never requires touching the renderer again.

import { SpriteActor, directionFromVector } from './sprite-pipeline.mjs';

// Build SpriteActors from a map of { actorId: manifest }, sharing one loader.
export function buildActorRegistry(manifests, imageLoader) {
  const registry = new Map();
  for (const [id, manifest] of Object.entries(manifests ?? {})) {
    if (!manifest) continue;
    registry.set(id, new SpriteActor(manifest, imageLoader));
  }
  return registry;
}

export function prewarmActorRegistry(registry, actorIds = [], options = {}) {
  let count = 0;
  for (const actorId of actorIds) {
    const actor = registry?.get?.(actorId);
    if (!actor || typeof actor.prewarm !== 'function') continue;
    count += actor.prewarm(options);
  }
  return count;
}

const SELECTED_HERO_ACTOR_IDS = Object.freeze({
  lester: 'lester',
  'lester-original': 'lester',
  lilly: 'lilly',
});

export function prewarmSelectedHeroActorRegistry(registry, characterId, options = {}) {
  const actorId = SELECTED_HERO_ACTOR_IDS[String(characterId ?? '').trim().toLowerCase()];
  if (!actorId) return 0;
  const states = options.states ?? ['idle', 'run', 'shoot'];
  return prewarmActorRegistry(registry, [actorId], { ...options, states });
}

// Map the hero's live combat state to a canonical animation state name.
// Mirrors the legacy selectHeroFrame() priority order so behavior is preserved.
export function heroStateFromCombat(combat, groundY) {
  if (combat.gameOver) return 'death';
  if (!combat.active) return 'idle';
  if (combat.playerY < groundY - 4 && !combat.roguelikeRun) return 'jump';
  const meleeAge = combat.frame - (combat.lastMeleeFrame ?? -999);
  if (meleeAge >= 0 && meleeAge < 18) return 'melee';
  if ((combat.shots ?? 0) > 0 && combat.frame % 36 < 10) return 'shoot';
  if (combat.crouching) return 'idle';
  const moving = combat.keys?.has('a') || combat.keys?.has('d')
    || combat.keys?.has('w') || combat.keys?.has('s')
    || combat.keys?.has('arrowleft') || combat.keys?.has('arrowright')
    || combat.keys?.has('arrowup') || combat.keys?.has('arrowdown');
  return moving ? 'run' : 'idle';
}

// Derive an 8-way facing direction from combat input/aim. For the side-scroll
// path this collapses to east/west; for the isometric roguelike it uses the
// full movement vector or aim angle.
export function heroDirectionFromCombat(combat) {
  if (combat.roguelikeRun && typeof combat.aimAngle === 'number') {
    return directionFromVector(Math.cos(combat.aimAngle), Math.sin(combat.aimAngle));
  }
  const dx = (combat.keys?.has('d') || combat.keys?.has('arrowright') ? 1 : 0)
    - (combat.keys?.has('a') || combat.keys?.has('arrowleft') ? 1 : 0);
  const dy = (combat.keys?.has('s') || combat.keys?.has('arrowdown') ? 1 : 0)
    - (combat.keys?.has('w') || combat.keys?.has('arrowup') ? 1 : 0);
  return directionFromVector(dx, dy);
}

const ENEMY_FACING_DIRECTIONS = new Set([
  'south', 'south-east', 'east', 'north-east',
  'north', 'north-west', 'west', 'south-west',
]);

// Keep canonical enemies aligned with their 8-way art. Attack/tell poses face
// the player, locomotion follows velocity, and non-moving reactions preserve
// the last rendered direction so hit/death frames do not snap south.
export function enemyDirectionFromEntity(enemy = {}, {
  playerX,
  playerY,
  lastDirection = null,
  intent = null,
} = {}) {
  const hasPlayerVector = Number.isFinite(playerX) && Number.isFinite(playerY)
    && Number.isFinite(enemy.x) && Number.isFinite(enemy.y);
  const vx = Number.isFinite(enemy.vx) ? enemy.vx : 0;
  const vy = Number.isFinite(enemy.vy) ? enemy.vy : 0;
  const hasMeaningfulVelocity = Math.abs(vx) > 0.01 || Math.abs(vy) > 0.01;
  const burrowTravel = enemy.burrowing && hasMeaningfulVelocity;
  const hostileIntent = !burrowTravel && (
    intent?.attacking || intent?.telegraphing || intent?.recovering
    || enemy.attacking || enemy.telegraphing || enemy.recovering
    || enemy.lunging || enemy.burrowing || enemy.aiming || enemy.windingUp
    || enemy.reloading || enemy.postVolley
    || ['attack', 'ranged-attack', 'telegraph', 'melee-tell', 'recover', 'melee-counter'].includes(enemy.state)
  );

  if (hostileIntent && hasPlayerVector) {
    const facing = directionFromVector(playerX - enemy.x, playerY - enemy.y);
    if (facing) return facing;
  }

  if (hasMeaningfulVelocity) {
    const facing = directionFromVector(vx, vy);
    if (facing) return facing;
  }

  if (ENEMY_FACING_DIRECTIONS.has(lastDirection)) return lastDirection;
  if (hasPlayerVector) {
    const facing = directionFromVector(playerX - enemy.x, playerY - enemy.y);
    if (facing) return facing;
  }
  return 'south';
}

function enemyAnimationPriorityTier(enemy = {}, intent = {}, onScreen = false) {
  if (enemy.signatureBoss || enemy.miniBoss || enemy.boss) return 0;
  if (intent.telegraphing || intent.attacking || enemy.telegraphing || enemy.attacking) return 1;
  if (intent.recovering || enemy.dying || enemy.dead || (enemy.hitFrames ?? 0) > 0 || (enemy.goreFrames ?? 0) > 0) return 2;
  if (intent.spawning || enemy.spawning || (enemy.spawnFrames ?? 0) > 0) return 3;
  const eliteClass = typeof enemy.class === 'string' && /(^|[-_\s])elite($|[-_\s])/.test(enemy.class);
  if (enemy.elite || eliteClass || enemy.spawnLaneRoleApplied === true && enemy.spawnLaneRole === 'elite') return 4;
  return onScreen ? 5 : 6;
}

// Preserve the existing hard animation cap while spending it on authored combat
// readability first. This is render-only: every enemy remains simulated and
// drawn, but idle margin enemies hold a still frame before active threats do.
export function selectAnimatedEnemySet(entries = [], {
  maxAnimatedEnemies = entries.length,
  playerX = 0,
  playerY = 0,
  viewportWidth = 0,
  viewportHeight = 0,
} = {}) {
  const inputEntries = Array.isArray(entries) ? entries : [];
  let validEntryCount = 0;
  for (const entry of inputEntries) {
    if (entry?.enemy) validEntryCount += 1;
  }
  const cap = Math.max(0, Math.min(validEntryCount, Math.floor(Number(maxAnimatedEnemies) || 0)));
  if (cap === 0) return new Set();
  if (cap >= validEntryCount) {
    const selected = new Set();
    for (const entry of inputEntries) {
      if (entry?.enemy) selected.add(entry.enemy);
    }
    return selected;
  }

  const ranked = [];
  for (let index = 0; index < inputEntries.length; index += 1) {
    const entry = inputEntries[index];
    if (!entry?.enemy) continue;
    const { enemy, intent = {} } = entry;
    const onScreen = Number.isFinite(enemy.x) && Number.isFinite(enemy.y)
      && enemy.x >= 0 && enemy.x <= viewportWidth
      && enemy.y >= 0 && enemy.y <= viewportHeight;
    const ex = Number.isFinite(enemy.mapX) ? enemy.mapX : playerX;
    const ey = Number.isFinite(enemy.mapY) ? enemy.mapY : playerY;
    ranked.push({
      enemy,
      index,
      tier: enemyAnimationPriorityTier(enemy, intent, onScreen),
      distance: Math.hypot(ex - playerX, ey - playerY),
    });
  }
  ranked.sort((a, b) => a.tier - b.tier || a.distance - b.distance || a.index - b.index);
  const selected = new Set();
  for (let index = 0; index < cap; index += 1) selected.add(ranked[index].enemy);
  return selected;
}

// Map an enemy's live state to a canonical animation state.
export function enemyStateFromEntity(enemy) {
  if (enemy.dying || enemy.dead) return 'death';
  if (enemy.hitFrames > 0) return 'hit';
  if (enemy.spawning || (enemy.spawnFrames ?? 0) > 0) return 'spawn-in';
  if (enemy.attacking || enemy.lunging || enemy.unburrowing || enemy.pouncing) return 'attack';
  if (enemy.telegraphing || enemy.burrowing || enemy.aiming || enemy.windingUp) return 'attack-tell';
  if (enemy.recovering || enemy.countering || enemy.reloading || enemy.postVolley) return 'melee-counter';
  if (enemy.moving) return 'walk';
  return 'idle';
}

export function enemyOverlayStateFromEntity(enemy, { goreEnabled = false } = {}) {
  if (!goreEnabled) return null;
  if (enemy.dying || enemy.dead) return 'optional-gore-overlay';
  if ((enemy.goreFrames ?? 0) > 0) return 'optional-gore-overlay';
  if ((enemy.hitFrames ?? 0) > 0) return 'optional-gore-overlay';
  return null;
}

// Resolve a frame for any registered actor. Returns null when the actor isn't
// in the registry (caller falls back to legacy art).
export function resolveActorFrame(registry, actorId, { state, direction, clock, lastDirection } = {}) {
  const actor = registry.get(actorId);
  if (!actor) return null;
  const frame = actor.frame({ state, direction: direction ?? lastDirection ?? null, clock: clock ?? 0 });
  return frame;
}

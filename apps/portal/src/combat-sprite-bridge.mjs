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

// Map an enemy's live state to a canonical animation state.
export function enemyStateFromEntity(enemy) {
  if (enemy.dying || enemy.dead) return 'death';
  if (enemy.hitFrames > 0) return 'hit';
  if (enemy.attacking) return 'attack';
  if (enemy.telegraphing) return 'attack-tell';
  if (enemy.moving) return 'walk';
  return 'idle';
}

// Resolve a frame for any registered actor. Returns null when the actor isn't
// in the registry (caller falls back to legacy art).
export function resolveActorFrame(registry, actorId, { state, direction, clock, lastDirection } = {}) {
  const actor = registry.get(actorId);
  if (!actor) return null;
  const frame = actor.frame({ state, direction: direction ?? lastDirection ?? null, clock: clock ?? 0 });
  return frame;
}

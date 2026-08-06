const DEFAULT_SEGMENTS = 32;

import { finite } from './value-guards.mjs';

function positive(value, name) {
  finite(value, name);
  if (value <= 0) throw new TypeError(`${name} must be positive`);
  return value;
}

function nonNegativeInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative integer`);
  return value;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

export function buildGrenadeDangerProjection({
  grenade,
  tick,
  groundZ,
  reduceFlash = false,
  segments = DEFAULT_SEGMENTS,
} = {}) {
  if (typeof grenade?.id !== 'string' || !grenade.id) throw new TypeError('grenade.id must be a non-empty string');
  if (!['hand', 'launcher'].includes(grenade.mode)) throw new TypeError('grenade.mode must be hand or launcher');
  nonNegativeInteger(tick, 'tick');
  nonNegativeInteger(grenade.spawnTick, 'grenade.spawnTick');
  nonNegativeInteger(grenade.detonateTick, 'grenade.detonateTick');
  if (grenade.detonateTick <= grenade.spawnTick) throw new TypeError('grenade.detonateTick must follow spawnTick');
  if (!Number.isInteger(segments) || segments < 12 || segments > 64) throw new TypeError('segments must be an integer from 12 to 64');
  const x = finite(grenade.position?.x, 'grenade.position.x');
  const y = finite(grenade.position?.y, 'grenade.position.y');
  const z = finite(groundZ, 'groundZ');
  const blastRadius = positive(grenade.blastRadius, 'grenade.blastRadius');
  const fuseTicks = grenade.detonateTick - grenade.spawnTick;
  const remainingTicks = Math.max(0, grenade.detonateTick - tick);
  const progress = clamp01(1 - remainingTicks / fuseTicks);
  const pulseOffset = reduceFlash ? 0 : ((Math.max(0, tick - grenade.spawnTick) % 8) / 7);
  const urgency = progress * progress;
  const center = Object.freeze({ x, y, z });
  const boundary = Object.freeze(Array.from({ length: segments }, (_, index) => {
    const angle = index / segments * Math.PI * 2;
    return Object.freeze({
      x: x + Math.cos(angle) * blastRadius,
      y: y + Math.sin(angle) * blastRadius,
      z,
    });
  }));
  return Object.freeze({
    grenadeId: grenade.id,
    mode: grenade.mode,
    center,
    boundary,
    blastRadius,
    remainingTicks,
    progress,
    urgent: remainingTicks <= 12,
    pulseOffset,
    fillAlpha: 0.045 + urgency * 0.08,
    strokeAlpha: 0.42 + urgency * 0.48,
    strokeWidth: grenade.mode === 'launcher' ? 3 : 4,
  });
}

// Solo ledger timing is selected from the canonical session's hash-bound game
// version, never a URL, child claim, current site constant or wall clock.
import { GARBAGE_START_TICK, GARBAGE_INTERVAL_START_TICKS, GARBAGE_INTERVAL_STEP_TICKS, GARBAGE_INTERVAL_STEP_PERIOD_TICKS, GARBAGE_INTERVAL_FLOOR_TICKS } from './stacked-contracts.mjs';

const VERSION = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
export function validStackedGameVersion(value) {
  if (typeof value !== 'string' || value.length > 50 || !VERSION.test(value)) return false;
  return value.split('.').every(part => Number.isSafeInteger(Number(part)));
}
export function stackedGameVersionFromBuildHash(buildHash) {
  if (typeof buildHash !== 'string') throw new TypeError('gameVersion requires a buildHash');
  const match = /^site-([^:]+):game-([^:]+)(?::cabinet-[A-Za-z0-9][A-Za-z0-9._-]*)?$/.exec(buildHash);
  if (match) {
    if (!validStackedGameVersion(match[1]) || !validStackedGameVersion(match[2])) throw new TypeError('gameVersion in buildHash is invalid');
    return match[2];
  }
  if (buildHash.startsWith('site-') || buildHash.includes(':game-')) throw new TypeError('gameVersion in buildHash is invalid');
  return null; // Old local/plain build labels retain the original rules.
}
export const STACKED_LEGACY_LEDGER = Object.freeze({id:'legacy', startTick:GARBAGE_START_TICK, intervalStart:GARBAGE_INTERVAL_START_TICKS, intervalStep:GARBAGE_INTERVAL_STEP_TICKS, stepPeriod:GARBAGE_INTERVAL_STEP_PERIOD_TICKS, intervalFloor:GARBAGE_INTERVAL_FLOOR_TICKS});
export const STACKED_22_LEDGER = Object.freeze({id:'2.2', startTick:5400, intervalStart:1080, intervalStep:30, stepPeriod:5400, intervalFloor:360});
export function resolveStackedLedgerPacing(config = {}) {
  const bound = stackedGameVersionFromBuildHash(config.buildHash ?? 'stacked-local');
  const explicit = Object.hasOwn(config,'gameVersion');
  const descriptor = explicit ? Object.getOwnPropertyDescriptor(config,'gameVersion') : null;
  if (explicit && (!descriptor.enumerable || !Object.hasOwn(descriptor,'value') || !validStackedGameVersion(descriptor.value))) throw new TypeError('gameVersion is invalid');
  const supplied = explicit ? descriptor.value : null;
  if (bound && supplied && bound !== supplied) throw new TypeError('gameVersion does not match buildHash');
  const version = bound ?? supplied;
  if (!version) return STACKED_LEGACY_LEDGER;
  const [major,minor] = version.split('.').map(part => Number(part));
  if (major === 2 && minor === 2) return STACKED_22_LEDGER;
  if (major < 2 || (major === 2 && minor <= 1)) return STACKED_LEGACY_LEDGER;
  throw new TypeError('unsupported gameVersion: no STACKED rules for this release line');
}
export function stackedGarbageIntervalTicks(tick, pacing) {
  if (!Number.isInteger(tick) || tick < 0) throw new RangeError('tick must be a non-negative integer');
  if (tick < pacing.startTick) return Number.POSITIVE_INFINITY;
  return Math.max(pacing.intervalFloor, pacing.intervalStart - pacing.intervalStep * Math.floor((tick-pacing.startTick)/pacing.stepPeriod));
}

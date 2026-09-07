import { DAS_TICKS, ARR_TICKS, DCD_TICKS, STACKED_DAS_RANGE_TICKS, STACKED_ARR_RANGE_TICKS, STACKED_DCD_RANGE_TICKS, STACKED_ACTIONS } from './stacked-contracts.mjs';

export function createStackedAutoShift({ dasTicks = DAS_TICKS, arrTicks = ARR_TICKS, dcdTicks = DCD_TICKS } = {}) {
  for (const [value, range] of [[dasTicks, STACKED_DAS_RANGE_TICKS], [arrTicks, STACKED_ARR_RANGE_TICKS], [dcdTicks, STACKED_DCD_RANGE_TICKS]]) {
    if (!Number.isInteger(value) || value < range.min || value > range.max) throw new RangeError('invalid auto-shift handling');
  }
  let held = 0, age = 0, nextPulse = 0, lastMask = 0, cooldown = 0, blocked = false;
  const reset = () => {
    held = 0;
    age = 0;
    nextPulse = 0;
    lastMask = 0;
    cooldown = 0;
    blocked = false;
  };
  return Object.freeze({
    reset,
    sample(direction, { canMove = true, spawned = false, rotated = false } = {}) {
      if (![-1, 0, 1].includes(direction) || [canMove, spawned, rotated].some(v => typeof v !== 'boolean')) throw new TypeError('invalid auto-shift sample');
      if (direction === 0) {
        reset();
        return 0;
      }

      const changed = direction !== held;
      const reversed = held !== 0 && changed;
      if (changed) {
        held = direction;
        age = 0;
        nextPulse = 0;
        blocked = false;
        cooldown = reversed ? Math.min(dasTicks, dcdTicks) : 0;
      } else if (spawned || rotated) {
        age = 0;
        nextPulse = 0;
        blocked = false;
      } else if (!blocked) {
        age += 1;
      }

      if (!canMove) blocked = true;
      if (cooldown > 0) {
        cooldown -= 1;
        lastMask = 0;
        return 0;
      }
      if (blocked) {
        lastMask = 0;
        return 0;
      }

      const mask = 1 << STACKED_ACTIONS.indexOf(direction < 0 ? 'moveLeft' : 'moveRight');
      if (age >= nextPulse && lastMask !== mask) {
        nextPulse = age + (nextPulse === 0 ? dasTicks : arrTicks);
        lastMask = mask;
        return mask;
      }
      lastMask = 0;
      return 0;
    },
  });
}

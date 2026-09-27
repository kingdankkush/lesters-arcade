// STACKED haptics (owner direction, 1.9.0): one pulse per committed step
// through the shared cabinet API, so phones vibrate and gamepads rumble.
// Presentation only: it reads committed snapshots after the step and never
// feeds input, the simulation, evidence or the result. Loaded lazily with the
// renderer, so the STACKED entry stays inside its byte budget.
//
// On by default; reduced motion turns it off (there is no separate setting
// row: the one settings card has no room left).
import { createCabinetHaptics } from '../../portal/src/cabinet-haptics.mjs';

// [pattern, intensity] for the most important event in this step, or null.
// Top-out beats HALVING beats a line clear beats a plain lock.
export function stackedHapticForStep(before, after) {
  if (after.terminal && !before.terminal) {
    return after.terminalReason === 'tick-ceiling' || after.terminalReason === 'evidence-ceiling' ? null : ['death', 1];
  }
  const lines = after.lines - before.lines;
  if (lines >= 4 || after.perfectClears > before.perfectClears) return ['big', 1];
  if (lines > 0) return ['clear', Math.min(1, .35 + lines * .2)];
  if (after.piecesLocked > before.piecesLocked) return ['tap', after.hardDropCells > before.hardDropCells ? .6 : .4];
  return null;
}

export function createStackedHaptics({ getSettings, navigatorRef, getGamepads = () => globalThis.navigator?.getGamepads?.() ?? [] } = {}) {
  const haptics = createCabinetHaptics({
    ...(navigatorRef ? { navigatorRef } : {}),
    // getGamepads throws where the frame lacks the gamepad permission; a pulse
    // must never break the frame loop, so a throwing pad list reads as no pads.
    getGamepads: () => { try { return getGamepads() ?? []; } catch { return []; } },
    reducedMotion: () => !!getSettings?.()?.accessibility?.reduceMotion,
  });
  return Object.freeze({
    step(before, after) {
      const cue = stackedHapticForStep(before, after);
      return cue ? haptics.pulse(cue[0], cue[1]) : false;
    },
  });
}

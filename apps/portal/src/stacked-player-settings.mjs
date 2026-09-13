import { STACKED_ACTIONS, STACKED_PLAYER_SETTINGS_KEY } from './stacked-contracts.mjs';
export const STACKED_DEFAULT_BINDINGS = Object.freeze({
  moveLeft: ['ArrowLeft', 'KeyA'], moveRight: ['ArrowRight', 'KeyD'], softDrop: ['ArrowDown', 'KeyS'],
  hardDrop: ['Space', null], rotateCW: ['ArrowUp', 'KeyX'], rotateCCW: ['KeyZ', null],
  rotate180: ['KeyV', null], hold: ['KeyC', 'ShiftLeft'],
});
export function defaultStackedSettings(reducedMotion = false) {
  return {
    version: 1, handling: { dasMs: 133, arrMs: 33, dcdMs: 0, cancelDas: true },
    controls: { keyboardBindings: Object.fromEntries(STACKED_ACTIONS.map(key => [key, { primary: STACKED_DEFAULT_BINDINGS[key][0], secondary: STACKED_DEFAULT_BINDINGS[key][1] }])), touchLayout: 'buttons', touchOpacity: 0.7, touchLeftHanded: false, touchSensitivity: 1 },
    video: { qualityTier: 'auto', reducedEffects: false, audioReactive: true, ghostPiece: true, gridLines: true },
    audio: { musicEnabled: true, sfxEnabled: true, sfxVolume: 0.35 },
    accessibility: { reduceMotion: reducedMotion, reduceFlash: true, colorblindPieces: true, hudScale: 1 },
  };
}
export function readStackedSettings(storage, reducedMotion = false) {
  const value = defaultStackedSettings(reducedMotion);
  try {
    const saved = JSON.parse(storage?.getItem(STACKED_PLAYER_SETTINGS_KEY) ?? 'null');
    // Only projection preferences are recovered until handling remapping has its own acceptance.
    for (const group of ['video', 'audio', 'accessibility']) {
      for (const key of Object.keys(value[group])) {
        if (typeof value[group][key] === 'boolean' && typeof saved?.[group]?.[key] === 'boolean') value[group][key] = saved[group][key];
      }
    }
  } catch { /* unavailable or malformed device settings use safe defaults */ }
  return value;
}
export function saveStackedSettings(storage, settings) {
  try { storage?.setItem(STACKED_PLAYER_SETTINGS_KEY, JSON.stringify(settings)); return true; }
  catch { return false; }
}

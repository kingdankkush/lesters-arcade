// Shared cabinet haptics: one tiny API every cabinet uses (HMH, Chikun).
// navigator.vibrate where the browser has it, plus the first connected
// gamepad's 'dual-rumble' actuator scaled by intensity. A no-op when disabled
// or under reduced motion. No imports; presentation only.

const PATTERNS = Object.freeze({ tap: 8, hit: 20, death: 60, clear: 15, big: 40 });

export function createCabinetHaptics({
  navigatorRef = globalThis.navigator,
  getGamepads = () => globalThis.navigator?.getGamepads?.() ?? [],
  enabled = () => true,
  reducedMotion = () => false,
} = {}) {
  return Object.freeze({
    pulse(name, intensity = 1) {
      const duration = Object.hasOwn(PATTERNS, name) ? PATTERNS[name] : 0;
      const strength = Math.max(0, Math.min(1, Number(intensity) || 0));
      if (!duration || !strength || !enabled() || reducedMotion()) return false;
      try { navigatorRef?.vibrate?.(duration); } catch {}
      for (const pad of Array.from(getGamepads() ?? [])) {
        const actuator = pad?.vibrationActuator;
        if (actuator?.playEffect) {
          try { actuator.playEffect('dual-rumble', { duration, strongMagnitude: strength, weakMagnitude: strength * 0.6 })?.catch?.(() => {}); } catch {}
          break;
        }
      }
      return true;
    },
  });
}

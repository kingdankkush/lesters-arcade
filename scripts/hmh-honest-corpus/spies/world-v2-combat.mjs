// The ten-area combat handle, remembered for the ten-area pilots: its cover
// faces and traversal markers, and the session's cover + traversal run
// (read-only; the pilot answers with a gamepad like a player who sees the
// prompt rings).
import * as real from '../../../apps/hmh-reboot/src/world-v2-combat.mjs';
export * from '../../../apps/hmh-reboot/src/world-v2-combat.mjs';
export function createWorldV2Combat(options) {
  const combat = real.createWorldV2Combat(options);
  const spies = globalThis.__headless?.spies;
  if (spies) spies.tenAreaCombat = combat;
  return combat;
}

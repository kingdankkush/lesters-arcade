// Headless cockpit: the real one is DOM projection. The pilot picks an upgrade
// through the same callback the real cockpit calls (onSelectUpgrade).
export * from '../../../apps/hmh-reboot/src/cockpit-ui.mjs';
export function createCockpitUi(options = {}) {
  const spies = globalThis.__headless.spies;
  spies.cockpitOptions = options;
  spies.upgradeOffer = null;
  return {
    destroy() {},
    hideUpgrade() { spies.upgradeOffer = null; },
    setPaused() {},
    setSession() {},
    setSettings() {},
    showUpgrade(snapshot) { spies.upgradeOffer = snapshot; },
    updateCombo() {},
    updateRun() {},
  };
}

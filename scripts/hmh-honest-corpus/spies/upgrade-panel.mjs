// Headless level-up and evolution panel: the real one is DOM projection. The
// pilot picks or re-rolls through the callbacks main.mjs gives the real panel
// (onSelectUpgrade, onRerollUpgrade).
export * from '../../../apps/hmh-reboot/src/upgrade-panel.mjs';
export function createUpgradePanel(options = {}) {
  const spies = globalThis.__headless.spies;
  spies.upgradePanelOptions = options;
  spies.upgradeOffer = null;
  return Object.freeze({
    showUpgrade(snapshot) { spies.upgradeOffer = snapshot; },
    hideUpgrade() { spies.upgradeOffer = null; },
    get open() { return spies.upgradeOffer !== null; },
    destroy() { spies.upgradeOffer = null; },
  });
}

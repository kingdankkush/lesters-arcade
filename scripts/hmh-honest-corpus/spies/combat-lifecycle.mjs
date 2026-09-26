import * as real from '../../../apps/hmh-reboot/src/combat-lifecycle.mjs';
export * from '../../../apps/hmh-reboot/src/combat-lifecycle.mjs';
export function createPlayerDefeatController(options = {}) {
  const controller = real.createPlayerDefeatController(options);
  const spies = globalThis.__headless.spies;
  spies.maxHealth = options.maxHealth ?? 100;
  if (!Number.isFinite(spies.health) || spies.health > spies.maxHealth) spies.health = spies.maxHealth;
  return Object.freeze({
    resolve(args = {}) { spies.health = args.health; return controller.resolve(args); },
    get announced() { return controller.announced; },
  });
}

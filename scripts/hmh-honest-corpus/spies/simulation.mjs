import * as real from '../../../apps/hmh-reboot/src/simulation.mjs';
export * from '../../../apps/hmh-reboot/src/simulation.mjs';
export class DeterministicSimulation extends real.DeterministicSimulation {
  constructor(...args) { super(...args); globalThis.__headless.spies.simulation = this; }
}

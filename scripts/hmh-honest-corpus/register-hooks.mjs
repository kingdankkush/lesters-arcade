// Redirects pixi.js to the headless stub, and a few of main.mjs's
// imports to read-only spy wrappers (they re-export the real module and only
// remember the state object a factory returns, so the pilot can "see" it).
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const stub = pathToFileURL(path.join(HERE, 'pixi-stub.mjs')).href;
const SPIES = {
  './movement.mjs': 'movement.mjs',
  './enemy-simulation.mjs': 'enemy-simulation.mjs',
  './collectible-system.mjs': 'collectible-system.mjs',
  './world-design-interactions.mjs': 'world-design-interactions.mjs',
  './grenades.mjs': 'grenades.mjs',
  './weapon-system.mjs': 'weapon-system.mjs',
  './simulation.mjs': 'simulation.mjs',
  './run-progression.mjs': 'run-progression.mjs',
  './combat-lifecycle.mjs': 'combat-lifecycle.mjs',
  './liquidator-boss.mjs': 'liquidator-boss.mjs',
  './dash.mjs': 'dash.mjs',
  './cockpit-ui.mjs': 'cockpit-ui.mjs',
  '../../../sdk/hmh-run-summary.mjs': 'hmh-run-summary.mjs',
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'pixi.js') return { url: stub, shortCircuit: true, format: 'module' };
    if (context.parentURL && /\/apps\/hmh-reboot\/src\/main\.mjs$/.test(context.parentURL) && Object.hasOwn(SPIES, specifier)) {
      return { url: pathToFileURL(path.join(HERE, 'spies', SPIES[specifier])).href, shortCircuit: true, format: 'module' };
    }
    return nextResolve(specifier, context);
  },
});

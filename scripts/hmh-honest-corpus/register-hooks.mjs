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
  './mission-objectives.mjs': 'mission-objectives.mjs',
  './boss-slots.mjs': 'boss-slots.mjs',
  './upgrade-panel.mjs': 'upgrade-panel.mjs',
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
// HMH_HARNESS_RELEASE labels a child ahead of this checkout's version files
// (identity.mjs). From 2.1.0 the child's own game version also decides its
// Level 1 (world-context.mjs reads version-tracking.mjs), so under that label
// the child reads the labelled version too; without it nothing is redirected.
const versionTracking = pathToFileURL(path.join(HERE, '..', '..', 'apps', 'portal', 'src', 'version-tracking.mjs')).href;
const release = process.env.HMH_HARNESS_RELEASE;
const labelledVersion = release && /^\d+\.\d+\.\d+$/.test(release)
  ? `data:text/javascript,${encodeURIComponent(`export * from ${JSON.stringify(versionTracking)};
export const SITE_VERSION = ${JSON.stringify(release)};
export const GAME_VERSION = ${JSON.stringify(release)};
`)}`
  : null;
// The ten-area combat handle (cover faces, traversal markers, the session's
// cover + traversal run), remembered read-only for the ten-area pilots.
const tenAreaCombat = pathToFileURL(path.join(HERE, 'spies', 'world-v2-combat.mjs')).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'pixi.js') return { url: stub, shortCircuit: true, format: 'module' };
    if (labelledVersion && specifier === '../../portal/src/version-tracking.mjs' && /\/apps\/hmh-reboot\/src\/world-context\.mjs$/.test(context.parentURL ?? '')) {
      return { url: labelledVersion, shortCircuit: true, format: 'module' };
    }
    if (specifier === './world-v2-combat.mjs' && /\/apps\/hmh-reboot\/src\/world-v2-runtime-context\.mjs$/.test(context.parentURL ?? '')) {
      return { url: tenAreaCombat, shortCircuit: true, format: 'module' };
    }
    if (context.parentURL && /\/apps\/hmh-reboot\/src\/main\.mjs$/.test(context.parentURL) && Object.hasOwn(SPIES, specifier)) {
      return { url: pathToFileURL(path.join(HERE, 'spies', SPIES[specifier])).href, shortCircuit: true, format: 'module' };
    }
    return nextResolve(specifier, context);
  },
});

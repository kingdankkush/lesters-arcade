// Boundary gate (2.0 weapons lane): the weapon model reader, the seated
// weapon backend and the pickup world cards are presentation chunks. No
// simulation-owned module imports them, and none of them sits on the HMH
// initial static path (which has under 2 KB of cap headroom).
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = new URL('../', import.meta.url);
const src = new URL('apps/hmh-reboot/src/', repoRoot);
const NEW_MODULES = ['weapon-model.mjs', 'pickup-world-cards.mjs'];
const SIMULATION_MODULES = ['simulation.mjs', 'weapon-system.mjs', 'combat-events.mjs', 'combat-lifecycle.mjs', 'enemy-combat.mjs', 'projectile-physics.mjs',
  'collectible-system.mjs', 'objective-rewards.mjs', 'run-progression.mjs', 'grenade-system.mjs', 'level-one-world.mjs'];

const importsOf = source => Array.from(source.matchAll(/(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g), m => m[1] ?? m[2]);

test('no simulation-owned module imports the weapon model, seated backend or pickup card modules', () => {
  const forbidden = [...NEW_MODULES, 'actor-3d-pixi.mjs', 'actor-3d-controller.mjs', 'pickup-indicators.mjs'];
  for (const file of readdirSync(src)) {
    if (!file.endsWith('.mjs')) continue;
    const imports = importsOf(readFileSync(new URL(file, src), 'utf8'));
    const hits = imports.filter(specifier => forbidden.some(name => specifier.endsWith(`/${name}`)));
    if (SIMULATION_MODULES.includes(file)) assert.deepEqual(hits, [], `${file} must not import presentation weapon modules`);
    if (NEW_MODULES.includes(file)) {
      assert.ok(!imports.some(specifier => SIMULATION_MODULES.some(name => specifier.endsWith(`/${name}`))), `${file} must not import simulation modules`);
    }
  }
  // The weapon model reader is reached only through the lazy actor backend; the cards only through the lazy indicators.
  assert.ok(importsOf(readFileSync(new URL('actor-3d-pixi.mjs', src), 'utf8')).includes('./weapon-model.mjs'));
  assert.ok(importsOf(readFileSync(new URL('pickup-indicators.mjs', src), 'utf8')).includes('./pickup-world-cards.mjs'));
  assert.match(readFileSync(new URL('pickup-indicators.mjs', src), 'utf8'), /import\('\.\/pickup-world-cards\.mjs'\)/);
  const main = readFileSync(new URL('main.mjs', src), 'utf8');
  for (const name of [...NEW_MODULES, 'actor-3d-pixi.mjs']) assert.ok(!main.includes(`'./${name}'`), `main.mjs never names ${name}`);
});

test('the new modules stay off the HMH initial static graph', async () => {
  const { build } = await import('esbuild');
  const result = await build({
    entryPoints: ['apps/hmh-reboot/src/main.mjs'], absWorkingDir: fileURLToPath(repoRoot), bundle: true, write: false, format: 'esm', metafile: true, logLevel: 'silent',
    outdir: 'hmh-weapon-boundary-test-out', external: ['pixi.js'],
    plugins: [{ name: 'dynamic-imports-stay-lazy', setup(api) { api.onResolve({ filter: /.*/ }, args => (args.kind === 'dynamic-import' ? { path: args.path, external: true } : null)); } }],
  });
  const graph = new Set(Object.keys(result.metafile.inputs));
  for (const name of [...NEW_MODULES, 'actor-3d-pixi.mjs', 'actor-3d-controller.mjs', 'actor-3d-model.mjs', 'pickup-indicators.mjs']) {
    assert.equal(graph.has(`apps/hmh-reboot/src/${name}`), false, `${name} is lazy`);
  }
  assert.equal(graph.has('apps/hmh-reboot/src/simulation.mjs'), true);
});

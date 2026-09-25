// Design package S0.2 bundle offsets: the level-up panel, the upgrade card
// text, the boss, the world-design objective machinery, world-design life and
// the briefing leave the child's initial JS. They load as awaited dynamic
// imports that boot() resolves before any session can start, so the fixed-step
// simulation still only calls resident, synchronous code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import { RUN_UPGRADE_CATALOG } from '../apps/hmh-reboot/src/run-progression.mjs';
import { RUN_UPGRADE_CONTENT, runUpgradeContent } from '../apps/hmh-reboot/src/progression-content.mjs';

const repoRoot = new URL('../', import.meta.url);
const read = (relative) => readFileSync(new URL(relative, repoRoot), 'utf8');
const mainSource = read('apps/hmh-reboot/src/main.mjs');
const mainAst = parse(mainSource, { sourceType: 'module', ecmaVersion: 'latest' });

const LAZY_RUNTIME_MODULES = Object.freeze([
  'liquidator-boss.mjs',
  'creature-presentation.mjs',
  'liquidator-telegraph-renderer.mjs',
  'world-design-interactions.mjs',
  'world-design-life.mjs',
  'world-design-pacing.mjs',
  'world-design-native-assets.mjs',
  'level-briefing.mjs',
  'upgrade-panel.mjs',
  'progression-content.mjs',
]);

function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (node.type) visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach((child) => walk(child, visit));
    else if (value && typeof value === 'object') walk(value, visit);
  }
}

// The modules a bundle loads before anything is imported on demand: every
// dynamic import() is left outside, so only static edges are followed (the
// same rule as scripts/hmh-reboot-bundle-budget.mjs sumStaticChunkBytes).
async function staticGraph(entry) {
  const { build } = await import('esbuild');
  const result = await build({
    entryPoints: [entry],
    absWorkingDir: fileURLToPath(repoRoot),
    bundle: true,
    write: false,
    format: 'esm',
    metafile: true,
    logLevel: 'silent',
    outdir: 'hmh-bundle-offsets-test-out',
    external: ['pixi.js'],
    plugins: [{
      name: 'dynamic-imports-stay-lazy',
      setup(buildApi) {
        buildApi.onResolve({ filter: /.*/ }, (args) => (args.kind === 'dynamic-import' ? { path: args.path, external: true } : null));
      },
    }],
  });
  return new Set(Object.keys(result.metafile.inputs));
}

test('the HMH initial static graph leaves the panel, card text, boss, objective and world-design life modules lazy', async () => {
  const graph = await staticGraph('apps/hmh-reboot/src/main.mjs');
  for (const module of LAZY_RUNTIME_MODULES) {
    assert.equal(graph.has(`apps/hmh-reboot/src/${module}`), false, `${module} must not be on the initial static path`);
  }
  assert.equal(graph.has('apps/hmh-reboot/src/upgrade-card-presentation.mjs'), false, 'card presentation travels with the lazy panel');
  // The simulation's own modules stay on the initial path.
  for (const module of ['simulation.mjs', 'run-progression.mjs', 'weapon-system.mjs', 'cockpit-ui.mjs', 'level-one-world.mjs']) {
    assert.equal(graph.has(`apps/hmh-reboot/src/${module}`), true, `${module} stays static`);
  }
});

test('main.mjs imports each lazy runtime module once, dynamically, through one loader', () => {
  const dynamic = [];
  const staticImports = [];
  walk(mainAst, (node) => {
    if (node.type === 'ImportExpression' && node.source.type === 'Literal') dynamic.push(node.source.value);
    if (node.type === 'ImportDeclaration') staticImports.push(node.source.value);
  });
  for (const module of LAZY_RUNTIME_MODULES) {
    assert.equal(dynamic.filter((specifier) => specifier === `./${module}`).length, 1, `${module} is imported dynamically exactly once`);
    assert.equal(staticImports.includes(`./${module}`), false, `${module} has no static import`);
  }
  const loader = mainAst.body.find((node) => node.type === 'FunctionDeclaration' && node.id.name === 'loadLazyRuntimeModules');
  assert.ok(loader, 'one named loader owns the lazy runtime modules');
  const loaderSource = mainSource.slice(loader.start, loader.end);
  for (const module of LAZY_RUNTIME_MODULES) assert.ok(loaderSource.includes(`import('./${module}')`), `${module} loads through the loader`);
  assert.match(loaderSource, /lazyRuntimeModulesLoad \?\?= Promise\.all\(/, 'the loads start once and are shared');
});

test('boot awaits the lazy runtime modules before any lazily bound code runs or a session can start', () => {
  const boot = mainAst.body.find((node) => node.type === 'FunctionDeclaration' && node.id.name === 'boot');
  const bootSource = mainSource.slice(boot.start, boot.end);
  const start = bootSource.indexOf('const lazyRuntimeModules = loadLazyRuntimeModules();');
  const awaitAt = bootSource.indexOf('await lazyRuntimeModules;');
  assert.ok(start >= 0 && awaitAt > start, 'boot starts the loads and awaits them');
  assert.ok(start < bootSource.indexOf('await app.init('), 'the chunks download while the renderer initialises');
  // Every call to a lazily bound function in boot comes after the await.
  const lazyNames = ['createWorldDesignLife', 'createWorldDesignState', 'createWorldDesignPacing', 'createUpgradePanel', 'loadWorldDesignAppearance',
    'createLiquidatorBoss', 'stepLiquidatorBoss', 'stepWorldDesign', 'resolveLevelBriefing', 'applyLevelBriefing', 'liquidatorPose', 'creatureAnimationTick',
    'renderLiquidatorTelegraph', 'prepareWorldDesignEnemyPose', 'stepWorldDesignPacing'];
  const bootAst = parse(`(async function(){${bootSource.slice(bootSource.indexOf('{') + 1)})`, { ecmaVersion: 'latest' });
  const awaitInWrapped = `(async function(){${bootSource.slice(bootSource.indexOf('{') + 1)}`.indexOf('await lazyRuntimeModules;');
  walk(bootAst, (node) => {
    if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && lazyNames.includes(node.callee.name)) {
      assert.ok(node.start > awaitInWrapped, `${node.callee.name} is called only after the lazy modules are resident`);
    }
  });
  // The bridge defers initialisation and the standalone session starts at the
  // end of boot, both after the await.
  assert.ok(bootSource.indexOf('bridge.activate()') > awaitAt);
  assert.ok(bootSource.lastIndexOf('initializeSession(payload);') > awaitAt);
  // No lazily bound name is called at module scope.
  const moduleScope = mainAst.body.filter((node) => node.type !== 'FunctionDeclaration');
  for (const node of moduleScope) {
    walk(node, (child) => {
      if (child.type === 'CallExpression' && child.callee.type === 'Identifier' && lazyNames.includes(child.callee.name)) {
        assert.fail(`${child.callee.name} is called at module scope`);
      }
    });
  }
});

test('the upgrade catalogue holds mechanics only; progression-content holds every card text', () => {
  assert.deepEqual(Object.keys(RUN_UPGRADE_CONTENT).sort(), Object.keys(RUN_UPGRADE_CATALOG).sort());
  for (const [id, upgrade] of Object.entries(RUN_UPGRADE_CATALOG)) {
    for (const key of ['title', 'mechanicalLabel', 'description']) {
      assert.equal(Object.hasOwn(upgrade, key), false, `${id}.${key} is card text, not simulation data`);
      assert.equal(typeof RUN_UPGRADE_CONTENT[id][key], 'string', `${id}.${key}`);
      assert.ok(RUN_UPGRADE_CONTENT[id][key].length > 0, `${id}.${key} is filled`);
    }
    assert.equal(runUpgradeContent(id), RUN_UPGRADE_CONTENT[id]);
  }
  assert.equal(runUpgradeContent('not-an-upgrade').title, 'not-an-upgrade', 'an unknown id reads as itself');
  assert.equal(Object.isFrozen(RUN_UPGRADE_CONTENT['proof-of-work']), true);
});

test('the cockpit keeps no level-up panel; the lazy upgrade panel owns it', () => {
  const cockpit = read('apps/hmh-reboot/src/cockpit-ui.mjs');
  assert.doesNotMatch(cockpit, /hmhUpgradeChoices|showUpgrade|resolveUpgradeCardPresentation/);
  const panel = read('apps/hmh-reboot/src/upgrade-panel.mjs');
  assert.match(panel, /export function createUpgradePanel\(/);
  assert.match(panel, /from '\.\/progression-content\.mjs'/);
  assert.match(mainSource, /upgradePanel = createUpgradePanel\(\{/);
  assert.doesNotMatch(mainSource, /cockpit\?\.(?:show|hide)Upgrade/);
});

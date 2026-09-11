import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';
import test from 'node:test';
import { createStartupArtGate } from '../apps/hmh-reboot/src/startup-art.mjs';
import { DeterministicSimulation } from '../apps/hmh-reboot/src/simulation.mjs';
import { createCombatAudio } from '../apps/hmh-reboot/src/combat-audio.mjs';

const source = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
function findNode(predicate, node = ast) {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  for (const value of Object.values(node)) {
    if (value && typeof value === 'object') {
      const found = Array.isArray(value)
        ? value.map(item => findNode(predicate, item)).find(Boolean)
        : findNode(predicate, value);
      if (found) return found;
    }
  }
  return null;
}
const pauseNode = findNode(node => node.type === 'VariableDeclarator' && node.id.name === 'pauseRuntime').init;
const tickerNode = findNode(node => node.type === 'CallExpression'
  && source.slice(node.callee.start, node.callee.end) === 'app.ticker.add').arguments[0];
const continueNode = findNode(node => node.type === 'CallExpression'
  && source.slice(node.callee.start, node.callee.end) === 'startupContinue?.addEventListener').arguments[1];

// Execute the shipped handlers rather than a second implementation of their
// loading conditions. The renderer and transport are only observation stubs.
function runtime({ paused = true } = {}) {
  const simulation = new DeterministicSimulation({ seed: 17 });
  simulation.start();
  if (paused) simulation.pause();
  const events = [];
  const context = vm.createContext({
    simulation, startupGate: createStartupArtGate(0), sessionPayload: { heroId: 'lilly' },
    dataset: { authoredPropStatus: 'ready', nativePropStatus: 'ready', worldDesignStatus: 'ready' },
    productionPilotEnabled: true, loadedProductionHeroId: 'lilly',
    productionHeroAsset: id => ({ actorId: id }), productionHeroLoadError: null,
    enemyRosterEnabled: true, HMH_OPENING_ENEMY_ARCHETYPE_IDS: ['bagholder-rusher', 'forkrunner'],
    enemyRosterIndexes: new Map([['bagholder-rusher', {}], ['forkrunner', {}]]), enemyRosterLoadError: null,
    terrainTilesEnabled: true, TERRAIN_MATERIAL_IDS: ['asphalt', 'grass', 'sand'],
    terrainTiles: { ready: true, loadedIds: ['asphalt', 'grass', 'sand'] }, terrainTileLoadError: null,
    startupPanel: { hidden: false }, startupContinue: { hidden: true }, startupCopy: { textContent: '' },
    performance: { now: () => 100 }, input: { reset: reason => events.push(['input-reset', reason]) },
    renderWorld: () => events.push(['render']), requestEnemyRosterAtlas: id => events.push(['prewarm', id]),
    releaseAnchorEnabled: false, actor: null, camera: {}, world: { position: { set() {} } },
    app: { ticker: {
      running: true,
      stop() { this.running = false; events.push(['ticker-stop']); },
      start() { this.running = true; events.push(['ticker-start']); },
    } },
    combatAudio: { pause() {}, resume() {}, play() {} }, cockpit: { setPaused() {} },
    document: { getElementById: () => null }, setStatus() {}, bridge: null,
    loadGroundFallback: async () => events.push(['load-basic-ground']),
  });
  const execute = node => vm.runInContext(`(${source.slice(node.start, node.end)})`, context,
    { importModuleDynamically: () => Promise.reject(new Error('Map renderer is outside this loading test.')) });
  const pause = execute(pauseNode);
  const frame = execute(tickerNode);
  return { context, events, pause, continueWithBasicGraphics: execute(continueNode), frame: () => frame({ deltaMS: 1000 / 60 }) };
}

test('visibility pause keeps the artwork ticker alive until the first complete frame', () => {
  const { context, events, pause, frame } = runtime({ paused: false });
  context.loadedProductionHeroId = null;
  frame();
  assert.equal(context.simulation.tick, 0);
  assert.equal(context.startupPanel.hidden, false);
  pause('visibility');
  assert.equal(context.simulation.state, 'paused');
  assert.equal(context.app.ticker.running, true, 'art readiness must still be polled while the run is paused');
  context.loadedProductionHeroId = 'lilly';
  frame();
  assert.equal(context.startupGate, null);
  assert.equal(context.startupPanel.hidden, true);
  assert.equal(context.dataset.startupArt, 'ready');
  assert.equal(context.app.ticker.running, false, 'the ordinary paused ticker should stop after artwork is ready');
  assert.equal(context.simulation.tick, 0);
  assert.ok(events.some(([kind]) => kind === 'render'));
});

test('an already paused run stops rendering after the artwork gate clears', () => {
  const { context, frame } = runtime();
  frame();
  assert.equal(context.startupGate, null);
  assert.equal(context.app.ticker.running, false);
  assert.equal(context.simulation.tick, 0);
});

test('an active restart restores combat audio only after artwork is ready', () => {
  const { context, frame } = runtime({ paused: false });
  const audio = createCombatAudio({ AudioCtor: class {} });
  audio.pause();
  context.combatAudio = audio;
  context.loadedProductionHeroId = null;
  frame();
  assert.equal(audio.status().paused, true);
  context.loadedProductionHeroId = 'lilly';
  frame();
  assert.equal(audio.status().paused, false, 'fresh active session must restore gun and damage cues');
  const pausedRun = runtime();
  audio.pause();
  pausedRun.context.combatAudio = audio;
  pausedRun.frame();
  assert.equal(audio.status().paused, true, 'finishing art must not unmute a deliberately paused run');
});

test('one loaded terrain texture cannot dismiss the complete-world loading screen', () => {
  const { context, frame } = runtime();
  context.terrainTiles.loadedIds = ['asphalt'];
  frame();
  assert.notEqual(context.startupGate, null);
  assert.equal(context.startupPanel.hidden, false);
  assert.equal(context.simulation.tick, 0);
  context.terrainTiles.loadedIds.push('grass');
  frame();
  assert.equal(context.startupPanel.hidden, false);
  context.terrainTiles.loadedIds.push('sand');
  frame();
  assert.equal(context.startupPanel.hidden, true);
  assert.equal(context.dataset.startupArt, 'ready');
});

test('a warm restart cannot reveal the previously selected hero as the new hero', () => {
  const { context, events, frame } = runtime();
  context.loadedProductionHeroId = 'lit-commando';
  frame();
  assert.equal(context.startupPanel.hidden, false);
  assert.deepEqual(events, []);
  context.loadedProductionHeroId = 'lilly';
  frame();
  assert.equal(context.startupPanel.hidden, true);
  assert.equal(context.dataset.startupArt, 'ready');
  assert.equal(context.simulation.tick, 0);
  assert.deepEqual(events[0], ['input-reset', 'artwork-ready']);
});

test('failed artwork waits at tick zero until the player explicitly accepts basic graphics', async () => {
  const { context, frame, continueWithBasicGraphics } = runtime();
  context.loadedProductionHeroId = null;
  context.productionHeroLoadError = 'unavailable';
  frame();
  assert.equal(context.startupContinue.hidden, false);
  assert.equal(context.startupPanel.hidden, false);
  assert.equal(context.simulation.tick, 0);
  await continueWithBasicGraphics();
  frame();
  assert.equal(context.startupPanel.hidden, true);
  assert.equal(context.dataset.startupArt, 'basic-graphics');
  assert.equal(context.simulation.tick, 0);
});

test('normal authored startup never requests the optional basic ground renderer', () => {
  const { context, frame, events } = runtime();
  context.loadedProductionHeroId = null;
  frame();
  context.loadedProductionHeroId = 'lilly';
  frame();
  assert.equal(context.dataset.startupArt, 'ready');
  assert.equal(events.some(([kind]) => kind === 'load-basic-ground'), false);
});

test('explicit basic graphics waits for its ground renderer before releasing the run', async () => {
  const { context, frame, continueWithBasicGraphics } = runtime();
  context.terrainTiles.loadedIds = [];
  context.terrainTileLoadError = 'unavailable';
  let finishLoading;
  context.loadGroundFallback = () => new Promise(resolve => { finishLoading = resolve; });
  frame();
  const continuation = continueWithBasicGraphics();
  frame();
  assert.equal(context.startupPanel.hidden, false);
  assert.equal(context.simulation.tick, 0);
  assert.equal(context.startupContinue.disabled, true);
  assert.equal(typeof finishLoading, 'function');
  finishLoading();
  await continuation;
  frame();
  assert.equal(context.startupPanel.hidden, true);
  assert.equal(context.dataset.startupArt, 'basic-graphics');
  assert.equal(context.startupContinue.disabled, false);
});

test('a delayed basic-graphics choice cannot release a replacement session', async () => {
  const { context, frame, continueWithBasicGraphics } = runtime();
  context.terrainTiles.loadedIds = [];
  let finishLoading;
  context.loadGroundFallback = () => new Promise(resolve => { finishLoading = resolve; });
  const continuation = continueWithBasicGraphics();
  context.startupGate = createStartupArtGate(100);
  assert.equal(typeof finishLoading, 'function');
  finishLoading();
  await continuation;
  frame();
  assert.notEqual(context.startupGate, null);
  assert.equal(context.startupPanel.hidden, false);
  assert.equal(context.simulation.tick, 0);
});

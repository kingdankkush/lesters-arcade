import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import { CHIKUN_COSMETIC_IDS, createChikunBridgeEnvelope, validateChikunChildMessage, validateChikunParentMessage } from '../apps/portal/src/chikun-bridge-protocol.mjs';
import { STACKED_COSMETIC_IDS, validateStackedBridgeMessage, validateStackedBridgeSettings } from '../apps/portal/src/stacked-bridge-protocol.mjs';
import { createBridgeEnvelope, validateChildMessage, validateParentMessage } from '../sdk/hmh-bridge-protocol.mjs';
import { projectHmhRuntimeSettings } from '../apps/portal/src/hmh-player-settings.mjs';
import { defaultStackedSettings } from '../apps/portal/src/stacked-player-settings.mjs';
import { HMH_COSMETIC_TINTS, UNLOCKABLES, childCosmeticsFor, emptyUnlocks, unlocksFromProfileResponse } from '../apps/portal/src/unlockables.mjs';
import { CHIKUN_COSMETIC_LOOKS, CHIKUN_TRAIL_EVENTS, chikunCoatFilter, chikunHatRects, chikunTrailParticles, createChikunCharacter, drawChikunHat } from '../apps/chikun/src/character.mjs';
import { planChikunVfx } from '../apps/chikun/src/vfx.mjs';
import { buildChikunReplayClaim, createChikunRuntime, decodeFlapDeltas, replayChikunRun, verifyChikunReplayClaim } from '../apps/portal/src/chikun-cabinet.mjs';
import { PIECE_CELLS, cellsFor, collides, createStackedRuntime } from '../apps/portal/src/stacked-sim.mjs';
import { createStackedBoardView, PIECE_COLORS } from '../apps/stacked/src/render/board-view.mjs';
import { createGameplayParticles } from '../apps/stacked/src/render/gameplay-particles.mjs';
import { STACKED_PIECE_PALETTES, STACKED_SCENE_GRADES, piecePaletteFor, sceneGradeFor } from '../apps/stacked/src/render/cosmetic-palettes.mjs';
import { createHmhRebootHost } from '../apps/portal/src/hmh-reboot-host.mjs';
import { createProductionHeroAtlasIndex, createProductionHeroDisplay } from '../apps/hmh-reboot/src/production-hero-atlas.mjs';
import { validateRunSummaryPayload } from '../sdk/hmh-run-summary-schema.mjs';
import { verifyRankedRun } from '../server/verify/index.mjs';
import { fixtureVerifyOptions, readFixture } from './fixtures/ranked/build-fixtures.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const idsOf = (gameId, kind) => UNLOCKABLES.filter((item) => item.gameId === gameId && item.kind === kind).map((item) => item.id);

// ---------------------------------------------------------------------------
// Bridge validators: one optional `cosmetics` key, allowlisted values only.
// ---------------------------------------------------------------------------

function chikunInit(settings, mode = 'ranked') {
  return createChikunBridgeEnvelope({
    type: 'portal:init', sessionId: 'chikun:ranked:12345678', messageId: 'message-1',
    payload: { gameId: 'chikun', mode, profile: { displayName: 'Player One', locale: 'en-US' }, session: { seed: 1234, buildHash: 'chikun-canvas-v1', seasonId: 'season-0', rankedEligible: mode === 'ranked' }, settings },
  });
}

test('settings accept only allowlisted cosmetics', () => {
  // The allowlists are exactly the working unlockables.
  assert.deepEqual(CHIKUN_COSMETIC_IDS, { coat: idsOf('chikun', 'coat'), trail: idsOf('chikun', 'trail'), hat: idsOf('chikun', 'hat') });
  assert.deepEqual(STACKED_COSMETIC_IDS, { pieceSkin: idsOf('stacked', 'piece-skin'), scene: idsOf('stacked', 'scene') });
  for (const [slot, ids] of Object.entries(CHIKUN_COSMETIC_IDS)) assert.deepEqual(Object.keys(CHIKUN_COSMETIC_LOOKS[slot]), ids, `Chikun draws every ${slot}`);
  assert.deepEqual(Object.keys(STACKED_PIECE_PALETTES), STACKED_COSMETIC_IDS.pieceSkin);
  assert.deepEqual(Object.keys(STACKED_SCENE_GRADES), STACKED_COSMETIC_IDS.scene);

  // Chikun: exact keys musicEnabled, reduceMotion and the optional cosmetics.
  const base = { musicEnabled: true, reduceMotion: false };
  const look = { coat: 'chikun-coat-glacier', trail: null, hat: 'chikun-hat-crown' };
  assert.equal(validateChikunParentMessage(chikunInit(base)).ok, true, 'cosmetics stay optional');
  assert.equal(validateChikunParentMessage(chikunInit({ ...base, cosmetics: look })).ok, true);
  assert.equal(validateChikunParentMessage(chikunInit({ ...base, cosmetics: { coat: null, trail: null, hat: null } }, 'free')).ok, true);
  for (const bad of [
    { ...look, coat: 'chikun-coat-plaid' },
    { ...look, hat: 'stacked-pieces-gold' },
    { coat: null, trail: null },
    { ...look, glow: null },
    { ...look, trail: 7 },
    null,
    ['chikun-coat-glacier'],
  ]) assert.equal(validateChikunParentMessage(chikunInit({ ...base, cosmetics: bad })).ok, false, JSON.stringify(bad));
  assert.equal(validateChikunParentMessage(chikunInit({ ...base, cosmetics: look, extra: true })).ok, false);
  const update = createChikunBridgeEnvelope({ type: 'portal:settings', sessionId: 'chikun:ranked:12345678', messageId: 'message-2', payload: { settings: { ...base, cosmetics: look } } });
  assert.equal(validateChikunParentMessage(update).ok, true);
  update.payload.settings.cosmetics.coat = 'forged';
  assert.equal(validateChikunParentMessage(update).ok, false);

  // STACKED: optional cosmetics { pieceSkin, scene } beside the canonical groups.
  const stacked = { ...defaultStackedSettings(), startLevel: 1 };
  assert.equal(validateStackedBridgeSettings(stacked, { initial: true }), true);
  assert.equal(validateStackedBridgeSettings({ ...stacked, cosmetics: { pieceSkin: 'stacked-pieces-gold', scene: null } }, { initial: true }), true);
  const { startLevel, ...updateSettings } = stacked;
  assert.equal(startLevel, 1);
  assert.equal(validateStackedBridgeSettings({ ...updateSettings, cosmetics: { pieceSkin: null, scene: 'stacked-scene-forge' } }), true);
  for (const bad of [
    { pieceSkin: 'stacked-pieces-plaid', scene: null },
    { pieceSkin: null },
    { pieceSkin: null, scene: null, extra: null },
    { pieceSkin: 'chikun-coat-golden', scene: null },
    null,
  ]) assert.equal(validateStackedBridgeSettings({ ...stacked, cosmetics: bad }, { initial: true }), false, JSON.stringify(bad));
  const envelope = { protocol: 'stacked-bridge/v1', type: 'portal:init', sessionId: 'session-protocol', messageId: 'message-one', payload: { gameId: 'stacked', mode: 'ranked', profile: { displayName: 'Player', locale: 'en-US' }, session: { seed: 1, buildHash: 'stacked-test', seasonId: 'stacked-season-preview-1', rankedEligible: true }, settings: { ...stacked, cosmetics: { pieceSkin: 'stacked-pieces-silver', scene: 'stacked-scene-noir' } } } };
  assert.equal(validateStackedBridgeMessage(envelope).ok, true, 'a Ranked init may carry looks');

  // HMH: { heroTint, weaponTint }, 0xRRGGBB integers or null.
  const hmhInit = (settings) => createBridgeEnvelope({ type: 'portal:init', sessionId: 'game-session-000000001', messageId: 'portal-1', payload: { gameId: 'lester-blaster', mode: 'ranked', heroId: 'lit-commando', profile: { displayName: 'Guest', locale: 'en' }, session: { seed: 1234567890, buildHash: 'site-48:game-48', seasonId: 'season-1', rankedEligible: true }, settings } });
  const hmh = projectHmhRuntimeSettings();
  assert.equal(validateParentMessage(hmhInit(hmh)).ok, true);
  assert.equal(validateParentMessage(hmhInit({ ...hmh, cosmetics: { heroTint: HMH_COSMETIC_TINTS.heroTint[0], weaponTint: null } })).ok, true);
  for (const bad of [{ heroTint: 0x1000000, weaponTint: null }, { heroTint: -1, weaponTint: null }, { heroTint: 1.5, weaponTint: null }, { heroTint: '#ffffff', weaponTint: null }, { heroTint: null }, { heroTint: null, weaponTint: null, hat: null }, null]) {
    assert.equal(validateParentMessage(hmhInit({ ...hmh, cosmetics: bad })).ok, false, JSON.stringify(bad));
  }
  // The child's game:settings echo carries the same key through the same validator.
  const echo = createBridgeEnvelope({ type: 'game:settings', sessionId: 'game-session-000000001', messageId: 'child-1', payload: { settings: { ...hmh, cosmetics: { heroTint: null, weaponTint: HMH_COSMETIC_TINTS.weaponTint[1] } } } });
  assert.equal(validateChildMessage(echo).ok, true);
});

// Contract §7.9 ("tint tables stay in the parent") wins over the brief's
// "allowlist sent by the parent": the parent resolves every tint from its own
// table and the child checks only the shape (a 24-bit integer or null), which
// keeps the tint hook inside the 350 B HMH child budget.
test('the parent sends only allowlisted HMH tints; the child checks their shape', () => {
  const unlocks = unlocksFromProfileResponse({ achievements: [{ id: 'score-10000', gameId: 'lester-blaster', tokenId: null }, { id: 'weapon-collector', gameId: 'lester-blaster', tokenId: null }], games: {} });
  // The parent sends only tints from its own table, only for unlocked looks.
  const picked = childCosmeticsFor('lester-blaster', { 'lester-blaster': { 'hero-skin': 'hmh-hero-silver', 'weapon-skin': 'hmh-weapon-hashstorm' } }, unlocks);
  assert.deepEqual(picked, { heroTint: 0xc9d8ee, weaponTint: 0xd3b0ff });
  assert.ok(HMH_COSMETIC_TINTS.heroTint.includes(picked.heroTint) && HMH_COSMETIC_TINTS.weaponTint.includes(picked.weaponTint));
  assert.deepEqual(childCosmeticsFor('lester-blaster', { 'lester-blaster': { 'hero-skin': 'hmh-hero-gold', 'weapon-skin': 'hmh-weapon-amber' } }, unlocks), { heroTint: null, weaponTint: null }, 'locked looks send no tint');
  assert.deepEqual(childCosmeticsFor('lester-blaster', { 'lester-blaster': { 'hero-skin': 0xff0000, 'weapon-skin': 'hmh-hero-silver' } }, unlocks), { heroTint: null, weaponTint: null }, 'raw colours and wrong-slot ids never pass');
  assert.deepEqual(childCosmeticsFor('lester-blaster', {}, emptyUnlocks()), { heroTint: null, weaponTint: null });
  // Every tint the parent could send passes the child validator.
  const hmh = projectHmhRuntimeSettings();
  for (const heroTint of [null, ...HMH_COSMETIC_TINTS.heroTint]) for (const weaponTint of [null, ...HMH_COSMETIC_TINTS.weaponTint]) {
    const message = createBridgeEnvelope({ type: 'portal:settings', sessionId: 'game-session-000000001', messageId: 'portal-2', payload: { settings: { ...hmh, cosmetics: { heroTint, weaponTint } } } });
    assert.equal(validateParentMessage(message).ok, true);
  }
  // The child boundary is a shape check only: an in-range colour outside the
  // parent's table passes it (only the parent decides which tints exist).
  const offTable = createBridgeEnvelope({ type: 'portal:settings', sessionId: 'game-session-000000001', messageId: 'portal-3', payload: { settings: { ...hmh, cosmetics: { heroTint: 0x000000, weaponTint: null } } } });
  assert.equal(HMH_COSMETIC_TINTS.heroTint.includes(0x000000), false);
  assert.equal(validateParentMessage(offTable).ok, true);
});

// ---------------------------------------------------------------------------
// Replays: looks never change a Ranked result.
// ---------------------------------------------------------------------------

function recordingContext(calls, { crest = true } = {}) {
  // A 2D context double: records calls and property writes; a probe reads a
  // red crest band at rows 10-11, columns 40-49 of the half-size probe.
  return new Proxy({}, {
    get: (target, key) => {
      if (key === 'getImageData') return (x, y, w, h) => {
        const data = new Uint8ClampedArray(w * h * 4);
        if (crest) for (let row = 10; row < 12; row++) for (let col = 40; col < 50; col++) data.set([200, 16, 46, 255], (row * w + col) * 4);
        return { data };
      };
      if (key in target) return target[key];
      return (...args) => { calls.push([key, ...args]); };
    },
    set: (target, key, value) => { target[key] = value; calls.push([`set:${String(key)}`, value]); return true; },
  });
}

async function withChikunDom(run) {
  const originals = { Image: globalThis.Image, document: globalThis.document };
  globalThis.Image = class { naturalWidth = 768; complete = true; async decode() {} };
  const probeCalls = [];
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => recordingContext(probeCalls) }) };
  try { return await run(); } finally { Object.assign(globalThis, originals); }
}

// Drives a fixture's evidence through the canonical runtime the way the child
// does, drawing Chikun (and planning trail bursts through the child's own
// chikunTrailParticles) with the given looks on every frame. Returns the
// result and every draw call.
async function driveChikun(evidence, cosmetics) {
  return withChikunDom(async () => {
    const character = createChikunCharacter();
    await character.ready;
    const calls = [];
    const ctx = recordingContext(calls);
    const flaps = new Set(decodeFlapDeltas(evidence.flapDeltas, evidence.maxTicks));
    const runtime = createChikunRuntime({ seed: evidence.seed, maxTicks: evidence.maxTicks, evidenceVersion: evidence.version });
    const trails = [];
    while (!runtime.terminal) {
      const tick = runtime.snapshot().tick;
      runtime.step({ flap: flaps.has(tick) });
      if (tick % 4 === 0) {
        const snapshot = runtime.snapshot();
        character.draw(ctx, snapshot, 4 / 60, { phase: 'running', cosmetics });
        if (flaps.has(tick)) trails.push(...chikunTrailParticles(planChikunVfx({ event: 'flap', x: 280, y: 360, tick }).particles, 'flap', cosmetics));
      }
    }
    character.dispose();
    return { result: runtime.result(), calls, trails };
  });
}

test('cosmetics do not change a replayed Ranked result (Chikun v6 fixture)', async () => {
  const fixtures = JSON.parse(read('tests/fixtures/chikun-v6-replays.json'));
  const run = fixtures.runs[0];
  const look = { coat: 'chikun-coat-royal', trail: 'chikun-trail-neon', hat: 'chikun-hat-top' };
  const plain = await driveChikun(run.evidence, null);
  const dressed = await driveChikun(run.evidence, look);
  assert.equal(JSON.stringify(dressed.result), JSON.stringify(plain.result), 'identical canonical result');
  assert.equal(JSON.stringify(plain.result), JSON.stringify(replayChikunRun(run.evidence)), 'the live path equals the canonical replay');
  assert.equal(plain.result.score, run.result.score);
  // The looks were really drawn, so the comparison is not vacuous.
  assert.ok(dressed.calls.some(([key, value]) => key === 'set:filter' && value === CHIKUN_COSMETIC_LOOKS.coat['chikun-coat-royal']), 'the coat filter is applied at draw time');
  assert.ok(dressed.calls.some(([key]) => key === 'fillRect'), 'the hat is painted');
  assert.ok(!plain.calls.some(([key]) => key === 'fillRect'), 'no hat without the look');
  assert.ok(plain.calls.filter(([key]) => key === 'set:filter').every(([, value]) => value === 'none'));
  assert.ok(dressed.trails.length > 0 && dressed.trails.every((particle) => particle.color === '#19f7ff'));
  assert.deepEqual(dressed.trails.map(({ color, ...rest }) => rest), plain.trails.map(({ color, ...rest }) => rest), 'a trail only recolours the burst');
  // The replay claim the parent verifies is the same with or without looks.
  const claimFor = () => buildChikunReplayClaim({ buildHash: 'chikun-canvas-v1', seasonId: 'season-0', result: replayChikunRun(run.evidence) });
  const claim = claimFor();
  assert.deepEqual(claimFor(), claim);
  assert.equal(JSON.stringify(claim).includes('cosmetic'), false);
  const replayed = replayChikunRun(run.evidence);
  verifyChikunReplayClaim({ expectedSeed: run.evidence.seed, expectedBuildHash: 'chikun-canvas-v1', expectedSeasonId: 'season-0', score: replayed.score, runStats: replayed, replayClaim: claim });
  // The child's result message never carries looks.
  assert.equal(read('apps/portal/src/chikun-bridge-protocol.mjs').match(/function validateResult[\s\S]*?\n}/)[0].includes('cosmetics'), false);
  const result = createChikunBridgeEnvelope({ type: 'game:result', sessionId: 'chikun:ranked:12345678', messageId: 'child-1', payload: { score: replayed.score, survivalTime: replayed.survivalTime, survivalTicks: replayed.survivalTicks, coinsCollected: replayed.coinsCollected, forksPassed: replayed.forksPassed, nearMisses: replayed.nearMisses, bestCombo: replayed.bestCombo, achievements: replayed.achievements, evidence: replayed.evidence, finalState: replayed.finalState, replayClaim: claim, cosmetics: look } });
  assert.equal(validateChikunChildMessage(result).ok, false, 'a result that tries to carry looks is refused');
});

test('the Chikun child applies its looks: coat filter, trail bursts, hat, and the ragdoll coat', () => {
  // The helpers the child calls (character.mjs), driven directly.
  assert.equal(chikunCoatFilter({ coat: 'chikun-coat-glacier' }), CHIKUN_COSMETIC_LOOKS.coat['chikun-coat-glacier']);
  for (const none of [null, {}, { coat: null }, { coat: 'forged' }, { coat: 'constructor' }]) assert.equal(chikunCoatFilter(none), 'none', JSON.stringify(none));
  assert.equal(chikunHatRects({ hat: 'chikun-hat-cap' }), CHIKUN_COSMETIC_LOOKS.hat['chikun-hat-cap']);
  assert.equal(chikunHatRects({ hat: 'toString' }), null);
  assert.deepEqual(CHIKUN_TRAIL_EVENTS, ['flap', 'fork', 'coin']);
  const look = { coat: null, trail: 'chikun-trail-ember', hat: null };
  for (const event of ['flap', 'fork', 'coin', 'near-miss', 'milestone', 'crash']) {
    const plan = planChikunVfx({ event, x: 280, y: 360, tick: 12 });
    const dressed = chikunTrailParticles(plan.particles, event, look);
    assert.equal(dressed.length, plan.particles.length);
    const recoloured = CHIKUN_TRAIL_EVENTS.includes(event);
    if (recoloured) assert.ok(plan.particles.length > 0 && dressed.every((particle) => particle.color === '#ff7b2f'), `${event} takes the trail colour`);
    else assert.deepEqual(dressed, plan.particles, `${event} keeps its warning colours`);
    assert.deepEqual(dressed.map(({ color, ...rest }) => rest), plan.particles.map(({ color, ...rest }) => rest), `${event}: only the colour changes`);
    assert.equal(chikunTrailParticles(plan.particles, event, null), plan.particles, 'no look, no copy');
  }
  // The child wires them in: the character draw, the burst spawner and the ragdoll.
  const main = read('apps/chikun/src/main.mjs');
  assert.match(main, /function cosmetics\(\) \{\n\s+return initPayload\?\.settings\?\.cosmetics \?\? null;\n\}/, 'looks come from the parent settings');
  assert.match(main, /const characterOptions = \{[^\n]*, cosmetics: cosmetics\(\) \};/, 'the character draw receives the looks');
  assert.match(main, /const particles = chikunTrailParticles\(plan\.particles, event, cosmetics\(\)\)\.map\(/, 'every burst goes through the trail look');
  assert.match(main, /ctx\.filter = chikunCoatFilter\(characterOptions\.cosmetics\);\n\s+drawChikunRagdoll\(/, 'the coat follows Chikun into the ragdoll');
  assert.equal((main.match(/cosmetics/g) ?? []).length, 6, 'no other code in the child reads looks');
  const character = read('apps/chikun/src/character.mjs');
  assert.match(character, /ctx\.filter=chikunCoatFilter\(options\.cosmetics\);\n\s+ctx\.drawImage\(composite/);
  assert.match(character, /const hat=chikunHatRects\(options\.cosmetics\);/);
});

test('the hat sits on the crest found in the frame and keeps to pixel rectangles', async () => {
  await withChikunDom(async () => {
    const character = createChikunCharacter();
    await character.ready;
    const calls = [];
    const ctx = recordingContext(calls);
    character.draw(ctx, { tick: 30, chikun: { x: 280, y: 360, velocityY: 0 } }, 1 / 60, { phase: 'running', reduceMotion: true, cosmetics: { coat: null, trail: null, hat: 'chikun-hat-crown' } });
    const rects = calls.filter(([key]) => key === 'fillRect');
    const crown = CHIKUN_COSMETIC_LOOKS.hat['chikun-hat-crown'];
    assert.equal(rects.length, crown.length * 2, 'one outline and one colour rectangle per hat pixel block');
    // Crest centre: columns 40-49 of the half-size probe = 89 sprite px; top row 10 = 20 sprite px.
    const size = 166, k = size / 192, unit = 3 * k;
    const [, x, y] = rects[crown.length];
    assert.ok(Math.abs(x - (-size / 2 + 89 * k + crown[0][0] * unit)) < 1e-9);
    assert.ok(Math.abs(y - (-size / 2 + (20 + 9) * k + crown[0][1] * unit)) < 1e-9);
    character.dispose();
  });
  // drawChikunHat paints the outline pass before the colours.
  const calls = [];
  drawChikunHat(recordingContext(calls), [[0, 0, 2, 1, '#ffd23f']], 10, 20, 2);
  assert.deepEqual(calls.filter(([key]) => key === 'fillRect'), [['fillRect', 8, 18, 8, 6], ['fillRect', 10, 20, 4, 2]]);
});

class Node {
  constructor() { this.children = []; this.visible = true; this.tint = 0xffffff; this.position = { x: 0, y: 0, set: (x, y) => { this.position.x = x; this.position.y = y; } }; this.scale = { x: 1, y: 1, set: (x, y = x) => { this.scale.x = x; this.scale.y = y; } }; }
  addChild(...children) { this.children.push(...children); return children.at(-1); }
  destroy() { this.destroyed = true; }
}
class Graphics extends Node { constructor() { super(); this.fills = []; } clear() { this.fills = []; return this; } rect() { return this; } roundRect() { return this; } fill(style) { this.fills.push(style?.color ?? style); return this; } stroke() { return this; } }
class Text extends Node { constructor({ text = '' } = {}) { super(); this.text = text; this.anchor = { set() {} }; } }

function stackedSettings(cosmetics) {
  const settings = defaultStackedSettings();
  return cosmetics ? { ...settings, cosmetics } : settings;
}

function driveStacked(fixture, settings) {
  const view = createStackedBoardView({ index: 0, rows: 24, cells: 10, frame: 'wide', geometry: { PIECE_CELLS, cellsFor, collides }, Container: Node, Graphics, Text });
  const particles = createGameplayParticles({ geometry: { PIECE_CELLS, cellsFor, collides } });
  const runtime = createStackedRuntime({ seed: fixture.seed, maxTicks: fixture.maxTicks, config: { startLevel: fixture.startLevel, buildHash: fixture.buildHash, seasonId: fixture.seasonId } });
  view.setPalette(piecePaletteFor(settings));
  let before = runtime.snapshot();
  const colors = new Set();
  let now = 0;
  for (const mask of fixture.masks) {
    const after = runtime.step(mask);
    now += 1000 / 60;
    particles.step(before, after, now, settings);
    view.present(after);
    for (const layer of Object.values(view.layers)) for (const child of layer.children ?? []) if (child.visible && child.__stackedColor !== undefined) colors.add(child.__stackedColor);
    for (let i = 0; i < particles.state.capacity; i++) if (particles.state.alive[i]) colors.add(particles.state.color[i]);
    before = after;
  }
  return { result: runtime.result(), stateHash: runtime.stateHash(), colors };
}

test('cosmetics do not change a replayed Ranked result (STACKED golden run)', () => {
  const fixture = JSON.parse(read('tests/fixtures/stacked-golden-run.json'));
  const plain = driveStacked(fixture, stackedSettings(null));
  const dressed = driveStacked(fixture, stackedSettings({ pieceSkin: 'stacked-pieces-sunset', scene: 'stacked-scene-forge' }));
  assert.deepEqual(dressed.result, plain.result, 'identical result tuple');
  assert.equal(dressed.stateHash, plain.stateHash);
  assert.equal(plain.stateHash, fixture.expectedStateHash, 'and both equal the golden run');
  for (const field of Object.keys(fixture.expected)) assert.equal(plain.result[field], fixture.expected[field], field);
  // The skin was really drawn: the dressed run shows sunset colours only.
  const sunset = new Set(Object.values(STACKED_PIECE_PALETTES['stacked-pieces-sunset']));
  const classic = new Set(Object.values(PIECE_COLORS));
  assert.ok([...dressed.colors].some((color) => sunset.has(color)), 'skinned pieces use the palette');
  assert.ok(![...dressed.colors].some((color) => classic.has(color) && !sunset.has(color)), 'no classic piece colour leaks through');
  assert.ok(![...plain.colors].some((color) => sunset.has(color) && !classic.has(color)));
  // The scene grade is a backdrop tint; white leaves the visualizers as authored.
  assert.equal(sceneGradeFor(stackedSettings({ pieceSkin: null, scene: 'stacked-scene-forge' })), STACKED_SCENE_GRADES['stacked-scene-forge']);
  assert.equal(sceneGradeFor(stackedSettings(null)), 0xffffff);
  assert.equal(piecePaletteFor(stackedSettings({ pieceSkin: 'forged', scene: null })), null);
});

test('STACKED looks stay out of the entry, the simulation and the visualizer choice', () => {
  const entry = read('apps/stacked/src/main.mjs');
  assert.equal(entry.includes('cosmetic-palettes'), false, 'palette data loads with the lazy renderer only');
  assert.equal(read('apps/portal/src/stacked-sim.mjs').includes('cosmetic'), false, 'the purity-audited simulation never sees looks');
  const renderer = read('apps/stacked/src/render/renderer.mjs');
  assert.match(renderer, /import \{ piecePaletteFor, sceneGradeFor \} from '\.\/cosmetic-palettes\.mjs';/);
  assert.match(renderer, /tree\.layers\.layerBackdrop\.tint = tree\.layers\.layerParticleFar\.tint = sceneGradeFor\(settings\);/);
  assert.match(entry, /import\('\.\/render\/renderer\.mjs'\)/, 'the renderer stays a dynamic import');
  // Every visualizer stays free: no look gates a visualizer id.
  const visualizers = ['journey', 'living', 'aurora', 'orbit', 'spectrum'];
  assert.ok(UNLOCKABLES.every((item) => !visualizers.some((name) => item.id.includes(name))));
});

// ---------------------------------------------------------------------------
// HMH: tints never change the run summary.
// ---------------------------------------------------------------------------

function hostFixture() {
  const mount = { children: [], replaceChildren(...children) { this.children = children; for (const child of children) child.contentWindow = {}; } };
  const bridges = [];
  const summaries = [];
  const errors = [];
  const host = createHmhRebootHost({
    mount,
    documentRef: { createElement: () => ({ dataset: {}, setAttribute() {}, addEventListener() {}, contentWindow: null }) },
    expectedOrigin: 'https://arcade.test',
    bridgeFactory: (options) => { const bridge = { options, connect() {}, send() {}, destroy() {} }; bridges.push(bridge); return bridge; },
    onRunSummary: (message) => summaries.push(message),
    onError: (error) => errors.push(error),
    setTimeoutRef: () => ({}),
    clearTimeoutRef: () => {},
  });
  return { host, bridges, summaries, errors };
}

test('HMH tints reach the child through its settings and never the run summary', async () => {
  // The child itself (Pixi) cannot run headless, so this proves the parent side
  // end to end with a real summary, and audits the child's source below.
  // hmh-valid holds a v6 summary built by the real accumulator and run
  // progression (tests/fixtures/ranked/build-fixtures.mjs).
  const fixture = readFixture('hmh-valid');
  const summary = fixture.body.evidence.runSummary;
  const { seed, buildHash, mode, heroId } = summary.identity;
  const tints = { heroTint: HMH_COSMETIC_TINTS.heroTint[2], weaponTint: HMH_COSMETIC_TINTS.weaponTint[0] };
  const settings = projectHmhRuntimeSettings();
  const forwarded = [];
  for (const extra of [{}, { cosmetics: tints }]) {
    const { host, bridges, summaries, errors } = hostFixture();
    host.mountSession({
      sessionId: 'game-session-000000001', gameId: 'lester-blaster', mode, heroId,
      profile: { displayName: 'Guest', locale: 'en' },
      session: { seed, buildHash, seasonId: 'season-1', rankedEligible: true },
      settings: { ...settings, ...extra },
    });
    // The plumbing: portal:init carries exactly the parent's looks, and the
    // child's validator accepts that init.
    const session = bridges[0].options.session;
    assert.deepEqual(session.settings.cosmetics, extra.cosmetics);
    const init = createBridgeEnvelope({ type: 'portal:init', sessionId: session.sessionId, messageId: 'portal-1', payload: { gameId: session.gameId, mode: session.mode, heroId: session.heroId, profile: { ...session.profile }, session: { ...session.session }, settings: { ...session.settings } } });
    assert.equal(validateParentMessage(init).ok, true);
    bridges[0].options.onMessage({ type: 'game:run-summary', payload: structuredClone(summary) });
    assert.deepEqual(errors, []);
    forwarded.push(summaries[0].payload);
  }
  assert.deepEqual(forwarded[0], summary);
  assert.deepEqual(forwarded[1], forwarded[0], 'the portal forwards the same summary with and without tints');
  // The server verifies both to the same verified run.
  const verifyWith = (runSummary) => verifyRankedRun({ ...fixture.body, evidence: { ...fixture.body.evidence, runSummary } }, fixtureVerifyOptions());
  const [plain, dressed] = await Promise.all(forwarded.map(verifyWith));
  assert.equal(plain.ok, true);
  assert.deepEqual(dressed, plain);
  // A summary that tried to carry looks is refused by the schema the server uses.
  assert.match(validateRunSummaryPayload({ ...summary, cosmetics: tints }) ?? '', /must contain exact fields|unexpected field/);
  assert.ok(!validateRunSummaryPayload(summary), 'the plain summary passes');
  assert.equal((await verifyWith({ ...summary, cosmetics: tints })).ok, false);

  // Source audit of the child: looks are read only where tints are applied.
  const main = read('apps/hmh-reboot/src/main.mjs');
  const lines = main.split('\n').filter((line) => line.includes('cosmetics'));
  assert.equal(lines.length, 2);
  for (const line of lines) assert.match(line, /\.tint = |\.setTint\(/, line.trim());
  const accumulator = main.slice(main.indexOf('runSummaryAccumulator = createRunSummaryAccumulator('), main.indexOf('});', main.indexOf('runSummaryAccumulator = createRunSummaryAccumulator(')));
  assert.equal(/settings/.test(accumulator), false, 'the run summary never reads settings');
  for (const path of ['sdk/hmh-run-summary.mjs', 'sdk/hmh-run-summary-schema.mjs', 'apps/hmh-reboot/src/simulation.mjs', 'apps/hmh-reboot/src/run-adapters.mjs']) {
    assert.equal(read(path).includes('cosmetic'), false, `${path} never reads looks`);
  }
  const touching = readdirSync(new URL('../apps/hmh-reboot/src/', import.meta.url)).filter((file) => file.endsWith('.mjs') && read(`apps/hmh-reboot/src/${file}`).includes('cosmetics'));
  assert.deepEqual(touching.sort(), ['main.mjs', 'production-hero-atlas.mjs']);
});

test('the HMH hero display tints body and weapon layers from the looks and a hit flash covers both', () => {
  const metadata = JSON.parse(read('apps/portal/assets/generated/hmh-reboot-production-heroes/lit-commando/lit-commando-production-pilot-atlas.json'));
  const point = () => ({ x: 0, y: 0, set(x, y = x) { this.x = x; this.y = y; } });
  class Container { children = []; scale = point(); addChild(child) { this.children.push(child); } }
  class Sprite { anchor = point(); scale = point(); tint = 0xffffff; constructor({ texture }) { this.texture = texture; } }
  class Texture { constructor(options) { Object.assign(this, options); } }
  class Rectangle { constructor(x, y, width, height) { Object.assign(this, { x, y, width, height }); } }
  const display = createProductionHeroDisplay({ index: createProductionHeroAtlasIndex(metadata), atlasTexture: { source: { width: 2048, height: 2048 } }, ContainerClass: Container, SpriteClass: Sprite, TextureClass: Texture, RectangleClass: Rectangle });
  const tints = () => Object.fromEntries(display.container.children.map((sprite) => [sprite.label.replace('production-hero-', ''), sprite.tint]));
  const look = { heroTint: 0xffdb7a, weaponTint: 0xd3b0ff };
  display.setTint(0xffffff, look);
  assert.deepEqual(tints(), { shadow: 0xffffff, 'lower-body': 0xffdb7a, 'torso-head': 0xffdb7a, weapon: 0xd3b0ff });
  display.setTint(0xff8080, look);
  assert.deepEqual(tints(), { shadow: 0xffffff, 'lower-body': 0xff8080, 'torso-head': 0xff8080, weapon: 0xff8080 }, 'the hit flash still reads on every layer');
  display.setTint(0xffffff, { heroTint: null, weaponTint: null });
  assert.deepEqual(tints(), { shadow: 0xffffff, 'lower-body': 0xffffff, 'torso-head': 0xffffff, weapon: 0xffffff });
  display.setTint(0xffffff);
  assert.deepEqual(tints(), { shadow: 0xffffff, 'lower-body': 0xffffff, 'torso-head': 0xffffff, weapon: 0xffffff }, 'no looks keeps the atlas colours');
});

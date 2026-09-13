import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import test from 'node:test';

import {
  BOSS_ROSTER_RUNTIME_SCALE,
  ENEMY_ROSTER_ACTORS,
  ENEMY_ROSTER_DIRECTIONS,
  ENEMY_ROSTER_PIPELINE_ID,
  ENEMY_ROSTER_RUNTIME_SCALE,
  ENEMY_ROSTER_STATES,
  ENEMY_DIRECTION_BY_SIMULATION_INDEX,
  createEnemyRosterAtlasIndex,
  directionNameForRosterIndex,
  enemyRosterAsset,
  resolveEnemyRosterPose,
} from '../apps/hmh-reboot/src/enemy-roster-atlas.mjs';
import { ENEMY_ARCHETYPES, REQUIRED_ENEMY_VISUAL_STATES } from '../apps/hmh-reboot/src/enemy-archetypes.mjs';
import { PRODUCTION_HERO_ASSETS, PRODUCTION_HERO_RUNTIME_SCALE } from '../apps/hmh-reboot/src/production-hero-atlas.mjs';

const rosterPath = (actorId) => actorId === 'bagholder-rusher' && process.env.HMH_ENEMY_CANDIDATE_ROOT
  ? `${process.env.HMH_ENEMY_CANDIDATE_ROOT}/${actorId}/${actorId}-roster-atlas.json` : new URL(
  `../apps/portal/assets/generated/hmh-reboot-enemy-roster/${actorId}/${actorId}-roster-atlas.json`,
  import.meta.url,
);

const loadMetadata = async (actorId) => JSON.parse(await readFile(rosterPath(actorId), 'utf8'));

const heroPath = (actorId) => new URL(
  `../apps/portal/assets/generated/hmh-reboot-production-heroes/${actorId}/${actorId}-production-pilot-atlas.json`,
  import.meta.url,
);

const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const frameBounds = (frame) => {
  // Pixi schema-2 trim lies within logical orig; density normalization belongs
  // to the child sprite, independently of its parent's world/camera scale.
  const densityScale = 160 / (frame.sourceSize?.h ?? 160);
  const top = ((frame.trim?.y ?? 0) - frame.anchor.y * (frame.orig?.h ?? frame.frame.h)) * densityScale;
  return { top, bottom: top + frame.frame.h * densityScale };
};

const unionHeight = (frames) => {
  const bounds = frames.map(frameBounds);
  return Math.max(...bounds.map(({ bottom }) => bottom)) - Math.min(...bounds.map(({ top }) => top));
};

test('the authored roster covers every active archetype plus the boss', () => {
  for (const archetypeId of Object.keys(ENEMY_ARCHETYPES)) {
    assert.ok(ENEMY_ROSTER_ACTORS.includes(archetypeId), `${archetypeId} has no authored roster art`);
  }
  assert.ok(ENEMY_ROSTER_ACTORS.includes('the-liquidator'), 'the boss needs its own authored art');
});

test('roster states cover every state the runtime can select', () => {
  for (const state of REQUIRED_ENEMY_VISUAL_STATES) {
    assert.ok(ENEMY_ROSTER_STATES.includes(state), `roster is missing the ${state} state`);
  }
});

test('every roster atlas is present, projection-only, and complete', async () => {
  for (const actorId of ENEMY_ROSTER_ACTORS) {
    assert.ok(existsSync(rosterPath(actorId)), `${actorId} atlas metadata missing`);
    const metadata = await loadMetadata(actorId);
    assert.equal(metadata.pipelineId, ENEMY_ROSTER_PIPELINE_ID);
    assert.equal(metadata.runtimeAuthority, 'projection-only');
    assert.equal(metadata.actorId, actorId);
    assert.ok(['human', 'zombie'].includes(metadata.identityForm), 'actors must read as humans or zombies');
    const index = createEnemyRosterAtlasIndex(metadata, actorId);
    // Index construction throws on any missing state/direction, so reaching
    // here already proves full coverage; assert the frame count as evidence.
    assert.equal(index.frameCount, metadata.frames.length);
    // Rank-and-file actors carry one 152-frame set. The boss carries the same
    // complete set for each of three authored phase silhouettes.
    assert.equal(index.frameCount, actorId === 'the-liquidator' ? 456 : 152, `${actorId} frame count regressed`);
    if (actorId === 'the-liquidator') assert.deepEqual([...index.phases], ['market-open', 'margin-call', 'total-liquidation']);
  }
});

test('a roster index rejects foreign or gameplay-authoritative metadata', async () => {
  const metadata = await loadMetadata('forkrunner');
  assert.throws(() => createEnemyRosterAtlasIndex({ ...metadata, pipelineId: 'other' }, 'forkrunner'), /pipeline/);
  assert.throws(() => createEnemyRosterAtlasIndex({ ...metadata, runtimeAuthority: 'gameplay' }, 'forkrunner'), /projection-only/);
  assert.throws(() => createEnemyRosterAtlasIndex(metadata, 'whale-enforcer'), /mismatch/);
  const missingState = { ...metadata, frames: metadata.frames.filter((frame) => frame.state !== 'death') };
  assert.throws(() => createEnemyRosterAtlasIndex(missingState, 'forkrunner'), /missing.*death.*south/);
});

test('pose resolution is deterministic, wraps loops, and holds the death frame', async () => {
  const index = createEnemyRosterAtlasIndex(await loadMetadata('bagholder-rusher'), 'bagholder-rusher');
  const first = resolveEnemyRosterPose(index, { state: 'run', tick: 40, direction: 2 });
  const second = resolveEnemyRosterPose(index, { state: 'run', tick: 40, direction: 2 });
  assert.equal(first.id, second.id, 'same tick and direction must resolve the same frame');
  assert.equal(first.direction, 'south', 'simulation index 2 is south, matching the hero mapping');

  const runCount = index.frameCountFor('run', 'south');
  const runFps = index.fpsFor('run', 'south');
  const wrapped = resolveEnemyRosterPose(index, { state: 'run', tick: 40 + runCount * 60 / runFps, direction: 2 });
  assert.equal(wrapped.id, first.id, 'run must loop');

  const lateDeath = resolveEnemyRosterPose(index, { state: 'death', tick: 100_000, direction: 0 });
  const deathCount = index.frameCountFor('death', 'south');
  assert.equal(lateDeath.frameIndex, deathCount - 1, 'death holds its final frame instead of looping');

  const unknown = resolveEnemyRosterPose(index, { state: 'not-a-state', tick: 0, direction: 0 });
  assert.equal(unknown.state, 'idle', 'an unknown state falls back to idle rather than throwing');
});

test('roster headings match the certified hero direction mapping exactly', async () => {
  // The roster must not invent its own heading order. Reusing the manifest's
  // compass list mirrored the mapping and left six of eight headings facing
  // the wrong way, so this asserts against the hero module rather than
  // against the roster's own constant.
  const heroSource = await readFile(new URL('../apps/hmh-reboot/src/production-hero-atlas.mjs', import.meta.url), 'utf8');
  const heroList = heroSource
    .slice(heroSource.indexOf('const DIRECTION_BY_SIMULATION_INDEX'), heroSource.indexOf(']);', heroSource.indexOf('const DIRECTION_BY_SIMULATION_INDEX')))
    .match(/'[a-z-]+'/g)
    .map((entry) => entry.replaceAll("'", ''));
  assert.deepEqual([...ENEMY_DIRECTION_BY_SIMULATION_INDEX], heroList, 'enemy and hero headings must agree');
  for (let index = 0; index < 8; index += 1) {
    assert.equal(directionNameForRosterIndex(index), heroList[index]);
  }
  assert.equal(directionNameForRosterIndex(8), heroList[0], 'indices wrap');
  assert.equal(directionNameForRosterIndex(-1), heroList[7]);
});

test('roster assets resolve to committed paths and reject unknown actors', () => {
  const asset = enemyRosterAsset('gas-bomber');
  assert.match(asset.imageUrl, /hmh-reboot-enemy-roster\/gas-bomber\/gas-bomber-roster-atlas\.png$/);
  assert.match(asset.metadataUrl, /gas-bomber-roster-atlas\.json$/);
  assert.throws(() => enemyRosterAsset('not-an-actor'), /unknown roster actor/);
});

test('ordinary zombies remain comparable to heroes while the boss reads larger', async () => {
  const heroMedianHeights = [];
  for (const actorId of Object.keys(PRODUCTION_HERO_ASSETS)) {
    const metadata = JSON.parse(await readFile(heroPath(actorId), 'utf8'));
    const directionalHeights = metadata.directions.map((direction) => unionHeight([
      metadata.frames.find((frame) => frame.layer === 'lower-body' && frame.state === 'idle' && frame.direction === direction && frame.frameIndex === 0),
      metadata.frames.find((frame) => frame.layer === 'torso-head' && frame.state === 'aim' && frame.direction === direction && frame.frameIndex === 0),
    ]) * PRODUCTION_HERO_RUNTIME_SCALE);
    heroMedianHeights.push(median(directionalHeights));
  }

  const ordinaryMedianHeights = [];
  let bossMedianHeight = 0;
  for (const actorId of ENEMY_ROSTER_ACTORS) {
    const metadata = await loadMetadata(actorId);
    const phase = metadata.phases?.[0] ?? null;
    const scale = enemyRosterAsset(actorId).runtimeScale;
    const directionalHeights = metadata.directions.map((direction) => {
      const frame = metadata.frames.find((candidate) => candidate.state === 'idle'
        && candidate.direction === direction
        && candidate.frameIndex === 0
        && (candidate.phase ?? null) === phase);
      return frame.frame.h * scale;
    });
    if (metadata.boss) bossMedianHeight = median(directionalHeights);
    else ordinaryMedianHeights.push(median(directionalHeights));
  }

  const heroHeight = median(heroMedianHeights);
  const ordinaryRatio = median(ordinaryMedianHeights) / heroHeight;
  const bossRatio = bossMedianHeight / heroHeight;
  assert.ok(ordinaryRatio >= 0.8 && ordinaryRatio <= 0.9, `ordinary zombie/hero visual-height ratio ${ordinaryRatio.toFixed(3)} must stay in the measured 0.8–0.9 parity band`);
  assert.ok(bossRatio >= 1 && bossRatio <= 1.15, `boss/hero visual-height ratio ${bossRatio.toFixed(3)} must stay in the measured 1.0–1.15 emphasis band`);
});

test('the runtime falls back to vector art and reports what it rendered', async () => {
  const source = await readFile(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(source, /createRosterOrVectorDisplay/, 'a fallback path must exist');
  assert.match(source, /createProductionEnemyDisplay\(\{\s*\n\s*archetypeId,/, 'vector art remains the fallback');
  assert.match(source, /enemyRosterIndexes\.size > 0 \? 'production-roster-atlas-v1'/, 'art telemetry must be truthful');
  assert.match(source, /dataset\.enemyRosterError/, 'a failed roster load must be observable');
});

test('roster art carries no gameplay authority', async () => {
  const source = await readFile(new URL('../apps/hmh-reboot/src/enemy-roster-atlas.mjs', import.meta.url), 'utf8');
  // Strip comments: the module's own header documents the systems it must NOT
  // touch, and that prose would otherwise trip this check.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(code, /collision|damage|health|armor|speed|spawn|seed|wallet|settlement/i);
  for (const actorId of ['forkrunner', 'the-liquidator']) {
    const metadata = await loadMetadata(actorId);
    assert.equal(metadata.gameplayBodyProfile, 'authored-archetype-collision-v1');
    for (const frame of metadata.frames.slice(0, 12)) {
      assert.ok(Number.isInteger(frame.frame.w) && frame.frame.w > 0);
      assert.ok(frame.anchor.x >= 0 && frame.anchor.x <= 1.5);
    }
  }
});

// ---------------------------------------------------------------------------
// Cycle 074 (E-3 / E-4): phase-relative tell and attack frames, and the elite
// treatment on the roster display itself.
// ---------------------------------------------------------------------------

test('a phase tick selects tell and attack frames in authored order and holds the last one', async () => {
  const index = createEnemyRosterAtlasIndex(await loadMetadata('bagholder-rusher'), 'bagholder-rusher');
  // Tell clip: 2 frames at 6 fps -> 10 ticks per frame. The anticipation
  // frame must come first no matter where the global clock sits.
  for (const tick of [0, 7, 13, 999_983]) {
    for (let phaseTick = 0; phaseTick < 10; phaseTick += 1) {
      assert.equal(resolveEnemyRosterPose(index, { state: 'tell', tick, direction: 2, phaseTick }).frameIndex, 0, `tell phaseTick ${phaseTick} at tick ${tick}`);
    }
    for (const phaseTick of [10, 11, 29, 44, 500]) {
      assert.equal(resolveEnemyRosterPose(index, { state: 'tell', tick, direction: 2, phaseTick }).frameIndex, 1, `tell holds frame 1 at phaseTick ${phaseTick}`);
    }
  }
  // Attack clip: 3 frames at 14 fps. Overshoot for the front of the 6-tick
  // strike, follow-through, then the exposed recovery frame held for the rest
  // of the recovery window instead of looping back to the overshoot.
  assert.equal(resolveEnemyRosterPose(index, { state: 'attack', tick: 17, direction: 0, phaseTick: 0 }).frameIndex, 0);
  assert.equal(resolveEnemyRosterPose(index, { state: 'attack', tick: 17, direction: 0, phaseTick: 4 }).frameIndex, 0);
  assert.equal(resolveEnemyRosterPose(index, { state: 'attack', tick: 17, direction: 0, phaseTick: 5 }).frameIndex, 1);
  assert.equal(resolveEnemyRosterPose(index, { state: 'attack', tick: 17, direction: 0, phaseTick: 8 }).frameIndex, 1);
  assert.equal(resolveEnemyRosterPose(index, { state: 'attack', tick: 17, direction: 0, phaseTick: 9 }).frameIndex, 2);
  assert.equal(resolveEnemyRosterPose(index, { state: 'attack', tick: 17, direction: 0, phaseTick: 60 }).frameIndex, 2, 'recovery holds the last attack frame');
  // Looping states ignore the phase tick and keep the absolute clock.
  const run = resolveEnemyRosterPose(index, { state: 'run', tick: 40, direction: 2 });
  assert.equal(resolveEnemyRosterPose(index, { state: 'run', tick: 40, direction: 2, phaseTick: 3 }).id, run.id);
  // Omitting the phase tick preserves the absolute-tick behaviour exactly.
  for (const tick of [0, 5, 10, 33]) {
    assert.equal(
      resolveEnemyRosterPose(index, { state: 'tell', tick, direction: 2 }).frameIndex,
      Math.floor(tick * 6 / 60) % 2,
    );
  }
  assert.equal(resolveEnemyRosterPose(index, { state: 'attack', tick: 3, direction: 0, phaseTick: -4 }).frameIndex, 0, 'a negative phase tick clamps to the first frame');
});

function makeFakePixi() {
  class FakePoint {
    constructor() { this.x = 1; this.y = 1; }
    set(x, y = x) { this.x = x; this.y = y; }
  }
  class FakeContainer {
    constructor() { this.children = []; this.scale = new FakePoint(); this.position = new FakePoint(); this.visible = true; }
    addChild(...children) { this.children.push(...children); return children[0]; }
    addChildAt(child, index) { this.children.splice(index, 0, child); return child; }
  }
  class FakeSprite extends FakeContainer {
    constructor({ texture } = {}) { super(); this.texture = texture; this.anchor = new FakePoint(); this.tint = 0xffffff; this.alpha = 1; this.blendMode = 'normal'; }
  }
  class FakeTexture {
    constructor({ source, frame }) { this.source = source; this.frame = frame; }
  }
  class FakeRectangle {
    constructor(x, y, width, height) { Object.assign(this, { x, y, width, height }); }
  }
  class FakeGraphics extends FakeContainer {
    constructor() { super(); this.calls = []; }
    clear() { this.calls.push(['clear']); return this; }
    poly(points) { this.calls.push(['poly', points]); return this; }
    circle(...args) { this.calls.push(['circle', args]); return this; }
    moveTo(...args) { this.calls.push(['moveTo', args]); return this; }
    lineTo(...args) { this.calls.push(['lineTo', args]); return this; }
    fill(style) { this.calls.push(['fill', style]); return this; }
    stroke(style) { this.calls.push(['stroke', style]); return this; }
  }
  return { FakeContainer, FakeSprite, FakeTexture, FakeRectangle, FakeGraphics };
}

test('the roster display carries the elite treatment itself and reports it truthfully', async () => {
  const { createEnemyRosterDisplay } = await import('../apps/hmh-reboot/src/enemy-roster-atlas.mjs');
  const { FakeContainer, FakeSprite, FakeTexture, FakeRectangle, FakeGraphics } = makeFakePixi();
  const index = createEnemyRosterAtlasIndex(await loadMetadata('forkrunner'), 'forkrunner');
  const make = (elite) => createEnemyRosterDisplay({
    index,
    atlasTexture: { source: { id: 'atlas' } },
    ContainerClass: FakeContainer,
    SpriteClass: FakeSprite,
    TextureClass: FakeTexture,
    RectangleClass: FakeRectangle,
    GraphicsClass: FakeGraphics,
    scale: 1,
    elite,
  });

  const plain = make(false);
  assert.equal(plain.eliteProjection, false, 'a rank-and-file body must not count as an elite');
  assert.deepEqual([...plain.eliteLayers], ['aura', 'crown', 'outline'], 'the roster reports the pinned vector elite contract');

  const elite = make(true);
  assert.equal(elite.eliteProjection, true, 'the elite flag must be observable on the roster container for telemetry');
  const body = elite.children.find((child) => child.label === 'roster-body-forkrunner');
  const rim = elite.children.find((child) => child.label === 'roster-elite-rim-forkrunner');
  const crown = elite.children.find((child) => child.label === 'roster-elite-crown-forkrunner');
  assert.ok(body && rim && crown, 'elite bodies carry a rim sprite and a crown glyph');
  assert.ok(elite.children.indexOf(rim) < elite.children.indexOf(body), 'the rim draws behind the body');
  assert.ok(elite.children.indexOf(crown) > elite.children.indexOf(body), 'the crown draws over the body');
  assert.equal(rim.visible, true);
  assert.equal(crown.visible, true);
  assert.equal(rim.blendMode, 'add', 'the rim is an additive tinted duplicate, not a second opaque body');
  assert.ok(rim.scale.x > 1 && rim.scale.x < 1.2, 'the rim is a slightly enlarged copy of the current frame');
  assert.notEqual(rim.tint, 0xffffff, 'the rim carries the elite tint');
  assert.equal(rim.texture, body.texture, 'the rim shows the same frame as the body');

  const frame = elite.applyPose({ state: 'attack', tick: 30, direction: 4, elite: true, phaseTick: 0 });
  assert.equal(rim.texture, body.texture, 'the rim follows every pose change');
  assert.ok(crown.y < -(frame.anchor.y * frame.frame.h) + 1, 'the crown sits above the head line of the current frame');
  assert.equal(elite.eliteProjection, true);

  elite.applyPose({ state: 'idle', tick: 0, direction: 0, elite: false });
  assert.equal(rim.visible, false);
  assert.equal(crown.visible, false);
  assert.equal(elite.eliteProjection, false, 'dropping the elite flag hides the treatment and the telemetry follows');
  assert.equal(body.tint, 0xffffff);
});


test('parity helper matches schema-2 indexed hero sprite trim and source-density geometry', async () => {
  const { createProductionHeroAtlasIndex, createProductionHeroDisplay } = await import('../apps/hmh-reboot/src/production-hero-atlas.mjs');
  const fake = makeFakePixi();
  class GeometryTexture {
    constructor(options) { Object.assign(this, options); this.orig ??= this.frame; }
  }
  for (const actorId of Object.keys(PRODUCTION_HERO_ASSETS)) {
    const metadata = JSON.parse(await readFile(heroPath(actorId), 'utf8'));
    const index = createProductionHeroAtlasIndex(metadata, PRODUCTION_HERO_ASSETS[actorId]);
    const display = createProductionHeroDisplay({ index, atlasTexture: { source: { width: 2048, height: 2048 } },
      ContainerClass: fake.FakeContainer, SpriteClass: fake.FakeSprite, TextureClass: GeometryTexture, RectangleClass: fake.FakeRectangle });
    for (const sprite of display.container.children.filter((s) => ['production-hero-lower-body', 'production-hero-torso-head'].includes(s.label))) {
      const layer = sprite.label.replace('production-hero-', '');
      const frame = metadata.frames.find((f) => f.layer === layer && f.state === (layer === 'lower-body' ? 'idle' : 'aim') && f.direction === 'east' && f.frameIndex === 0);
      const expectedTop = (sprite.texture.trim.y - sprite.anchor.y * sprite.texture.orig.height) * sprite.scale.y;
      const expectedBottom = expectedTop + sprite.texture.frame.height * sprite.scale.y;
      const actual = frameBounds(frame);
      assert.ok(Math.abs(actual.top - expectedTop) < 0.0002, `${actorId}/${layer}: top must match actual renderer geometry`);
      assert.ok(Math.abs(actual.bottom - expectedBottom) < 0.0002, `${actorId}/${layer}: bottom must match actual renderer geometry`);
    }
  }
});

test('native bagholder descriptor alone changes scale; ordinary and boss constants remain exact', () => {
  assert.equal(enemyRosterAsset('bagholder-rusher').runtimeScale, 0.50);
  for (const actorId of ENEMY_ROSTER_ACTORS.filter((id) => id !== 'bagholder-rusher')) {
    assert.equal(enemyRosterAsset(actorId).runtimeScale, actorId === 'the-liquidator' ? 0.86 : 0.75);
  }
  assert.equal(ENEMY_ROSTER_RUNTIME_SCALE, 0.75);
  assert.equal(BOSS_ROSTER_RUNTIME_SCALE, 0.86);
});

test('actual roster/fallback wiring carries the actor scale into existing camera-zoom composition', async () => {
  const { createEnemyRosterDisplay } = await import('../apps/hmh-reboot/src/enemy-roster-atlas.mjs');
  const source = await readFile(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('const createRosterOrVectorDisplay = ');
  const end = source.indexOf('\n  };', start) + 5;
  const wiring = source.slice(start, end);
  assert.match(wiring, /display\.rosterScale = enemyRosterAsset\(archetypeId\)\.runtimeScale;/,
    'loaded roster path must bind the descriptor scale');
  assert.match(wiring, /requestEnemyRosterAtlas\(archetypeId\);[\s\S]*return createProductionEnemyDisplay\(/,
    'lazy miss must retain the vector fallback');
  const fake = makeFakePixi();
  for (const actorId of ENEMY_ROSTER_ACTORS.filter((id) => id !== 'the-liquidator')) {
    const index = createEnemyRosterAtlasIndex(await loadMetadata(actorId), actorId);
    const display = createEnemyRosterDisplay({ index, atlasTexture: { source: {} },
      ContainerClass: fake.FakeContainer, SpriteClass: fake.FakeSprite,
      TextureClass: fake.FakeTexture, RectangleClass: fake.FakeRectangle,
      GraphicsClass: fake.FakeGraphics, scale: 1 });
    display.rosterScale = enemyRosterAsset(actorId).runtimeScale;
    const expected = actorId === 'bagholder-rusher' ? 0.50 : 0.75;
    assert.equal(display.rosterScale, expected);
    for (const zoom of [0.7, 1, 1.6]) {
      display.scale.set(display.rosterScale * zoom);
      assert.equal(display.scale.y, expected * zoom);
    }
  }
  assert.match(source, /enemyMarker\.scale\.set\(\(enemyMarker\.rosterScale \?\? 1\) \* camera\.zoom\)/);
});

test('native hit peak and recovery both occur inside every existing short hit window', async () => {
  const { resolveEnemyRosterPoseSelection } = await import('../apps/hmh-reboot/src/enemy-production-art.mjs');
  const metadata = await loadMetadata('bagholder-rusher');
  assert.deepEqual(metadata.poseAuthoring.sourceFrameSamples, { hit: [12, 25] });
  const index = createEnemyRosterAtlasIndex(metadata, 'bagholder-rusher');
  const source = await readFile(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  const assignment = source.match(/enemy\.hitUntilTick = tick \+ (\d+);/);
  assert.ok(assignment, 'use the actual damage-event hit window');
  assert.equal(Number(assignment[1]), 6, 'no hit duration change');
  for (let start = 100; start < 110; start += 1) {
    for (let direction = 0; direction < 8; direction += 1) {
      const enemy = { archetypeId: 'bagholder-rusher', active: true, health: 10, attackPhase: 'idle', velocity: { x: 2, y: 0 }, hitUntilTick: start + Number(assignment[1]) };
      const before = structuredClone(enemy);
      const samples = new Set();
      for (let tick = start; tick <= enemy.hitUntilTick; tick += 1) {
        const selection = resolveEnemyRosterPoseSelection(enemy, tick);
        assert.equal(selection.state, 'hit');
        const frame = resolveEnemyRosterPose(index, { ...selection, tick, direction });
        assert.equal(frame.fps, 12);
        samples.add(metadata.poseAuthoring.sourceFrameSamples.hit[frame.frameIndex]);
      }
      assert.deepEqual([...samples].sort((a, b) => a - b), [12, 25], 'both native samples appear regardless of global-clock phase');
      assert.equal(resolveEnemyRosterPoseSelection(enemy, enemy.hitUntilTick + 1).state, 'run');
      assert.deepEqual(enemy, before, 'projection never writes simulation state');
    }
  }
});

test('rendered enemy frame evidence follows the actual texture selection', async () => {
  const { createEnemyRosterDisplay } = await import('../apps/hmh-reboot/src/enemy-roster-atlas.mjs');
  const index = createEnemyRosterAtlasIndex(await loadMetadata('bagholder-rusher'), 'bagholder-rusher');
  const fake = makeFakePixi();
  const display = createEnemyRosterDisplay({ index, atlasTexture: { source: {} },
    ContainerClass: fake.FakeContainer, SpriteClass: fake.FakeSprite,
    TextureClass: fake.FakeTexture, RectangleClass: fake.FakeRectangle,
    GraphicsClass: fake.FakeGraphics, scale: 1 });
  for (const phaseTick of [0, 3]) {
    const frame = display.applyPose({ state: 'hit', tick: 100 + phaseTick, phaseTick, direction: 2, hitFlash: false });
    assert.equal(display.frameId, frame.id, 'evidence must name the frame applied to the live sprite');
    assert.equal(display.visualState, frame.state);
    assert.deepEqual(display.children.find((child) => child.label === 'roster-body-bagholder-rusher').texture.frame,
      new fake.FakeRectangle(frame.frame.x, frame.frame.y, frame.frame.w, frame.frame.h));
  }
});

// ---------------------------------------------------------------------------
// Enemy hit feedback (projection): the roster display exposes a tint hook so
// a hit can flash the body inside a tell or strike frame without touching the
// pose precedence. null hands the tint back to applyPose, elite tint included.
// ---------------------------------------------------------------------------

test('the roster display exposes setTint and null restores the tint applyPose owns', async () => {
  const { createEnemyRosterDisplay } = await import('../apps/hmh-reboot/src/enemy-roster-atlas.mjs');
  const { FakeContainer, FakeSprite, FakeTexture, FakeRectangle, FakeGraphics } = makeFakePixi();
  const index = createEnemyRosterAtlasIndex(await loadMetadata('forkrunner'), 'forkrunner');
  const make = (elite) => createEnemyRosterDisplay({
    index,
    atlasTexture: { source: { id: 'atlas' } },
    ContainerClass: FakeContainer,
    SpriteClass: FakeSprite,
    TextureClass: FakeTexture,
    RectangleClass: FakeRectangle,
    GraphicsClass: FakeGraphics,
    scale: 1,
    elite,
  });
  for (const elite of [false, true]) {
    const display = make(elite);
    const body = display.children.find((child) => child.label === 'roster-body-forkrunner');
    const base = elite ? 0xfff0c0 : 0xffffff;
    assert.equal(typeof display.setTint, 'function');
    assert.equal(body.tint, base);
    display.setTint(0xffd6d6);
    assert.equal(body.tint, 0xffd6d6, 'the flash reaches the body sprite');
    display.setTint(null);
    assert.equal(body.tint, base, `null restores ${elite ? 'the elite tint' : 'white'}`);
    display.setTint(0xffd6d6);
    display.applyPose({ state: 'tell', tick: 3, direction: 0, elite, phaseTick: 3 });
    assert.equal(body.tint, base, 'a pose refresh never leaks the flash');
    assert.equal(display.visualState, 'tell', 'the flash changes no pose state');
    assert.equal(display.eliteProjection, elite);
  }
});

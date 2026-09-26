// Micro-benchmark for the enemy body pass (perf step: render-alloc).
//
// node --expose-gc scripts/hmh-enemy-pass-bench.mjs [--frames=3000] [--blocks=6] [--population=128] [--cap=32]
//
// Runs the same seeded 128-body crowd through the verbatim 1.8.1 loop
// (tests/fixtures/hmh-render-reference/enemy-body-pass.mjs, with the 1.8.1
// roster display and helpers) and through enemy-render-pass.mjs (with the
// current display and helpers), in alternating blocks, on real Pixi
// containers and real roster displays cut from the shipped roster metadata.
// Draw targets (shadow pool, glows, elite rings, tells, pips) are no-op sinks
// on both sides, so the numbers are the loop's own JS: CPU time per frame and
// garbage-collection counts. Browser frame time is measured by the crowd
// bench; this isolates what the step changed from host and GPU noise.
import { readFileSync } from 'node:fs';
import { PerformanceObserver, performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { Container, Graphics, Rectangle, Sprite, Texture, TextureSource } from 'pixi.js';

import { referenceEnemyBodyPass, referenceHealthPips } from '../tests/fixtures/hmh-render-reference/enemy-body-pass.mjs';
import * as reference from '../tests/fixtures/hmh-render-reference/render-helpers.mjs';
import * as referenceRoster from '../tests/fixtures/hmh-render-reference/enemy-roster-atlas.mjs';
import { createEnemyRenderPass } from '../apps/hmh-reboot/src/enemy-render-pass.mjs';
import { isScreenPointVisible, selectAnimatedEnemyIds } from '../apps/hmh-reboot/src/runtime-performance.mjs';
import { worldToScreenInto } from '../apps/hmh-reboot/src/world-space.mjs';
import { prepareWorldDesignEnemyPose } from '../apps/hmh-reboot/src/world-design-life.mjs';
import { isEliteEnemyProjection, resolveEnemyRuntimeVisualState, selectEnemyRosterPose } from '../apps/hmh-reboot/src/enemy-production-art.mjs';
import { creatureAnimationTick, creatureIdPhase } from '../apps/hmh-reboot/src/creature-presentation.mjs';
import { createEnemyRosterAtlasIndex, createEnemyRosterDisplay, enemyRosterAsset, resolveEnemyVisualDirection } from '../apps/hmh-reboot/src/enemy-roster-atlas.mjs';
import { worldDepthKey } from '../apps/hmh-reboot/src/world-depth.mjs';
import { projectGasBomberCanister } from '../apps/hmh-reboot/src/enemy-attack-presentation.mjs';
import { ENEMY_ARCHETYPES } from '../apps/hmh-reboot/src/enemy-archetypes.mjs';
import * as enemyHitFeedback from '../apps/hmh-reboot/src/enemy-hit-feedback.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((arg) => { const [key, ...value] = arg.replace(/^--/, '').split('='); return [key, value.join('=')]; }));
const FRAMES = Number(args.frames ?? 3000);
const BLOCKS = Number(args.blocks ?? 6);
const POPULATION = Number(args.population ?? 128);
const CAP = Number(args.cap ?? 32);
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ROSTER = ['bagholder-rusher', 'forkrunner', 'liquidator-agent', 'whale-enforcer', 'gas-bomber', 'validator-cultist'];

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const metadata = Object.fromEntries(ROSTER.map((id) => [id, JSON.parse(readFileSync(`${ROOT}apps/portal/${enemyRosterAsset(id).metadataUrl.replace('../', '')}`, 'utf8'))]));
const atlas = Object.fromEntries(ROSTER.map((id) => [id, new Texture({ source: new TextureSource({ width: 4096, height: 4096 }) })]));
const classes = { ContainerClass: Container, SpriteClass: Sprite, TextureClass: Texture, RectangleClass: Rectangle, GraphicsClass: Graphics };
const contactShadowFootY = (display, pose, screenY, zoom) =>
  screenY + (pose?.frame?.h ?? 0) * (1 - (pose?.anchor?.y ?? 1)) * (display.rosterScale ?? 1) * zoom;
const sink = new Proxy({}, { get: () => () => sink });
const noop = () => {};
const shadows = { place: () => true };
const MOBILE = { enemyCullMargin: 160, maxAnimatedEnemies: CAP, particlesPerHazard: 4 };
const view = { width: 414, height: 896 };

// One crowd, stepped identically for both sides: the same enemies move, tell,
// strike and get hit on the same frames.
function crowd(seed) {
  const random = rng(seed);
  const enemies = Array.from({ length: POPULATION }, (_, index) => {
    const archetypeId = ROSTER[index % ROSTER.length];
    const archetype = ENEMY_ARCHETYPES[archetypeId];
    return {
      id: `bench-${String(index).padStart(4, '0')}`, archetypeId, active: true,
      x: 500 + (random() - 0.5) * 1400, y: 900 + (random() - 0.5) * 2200, groundZ: 0,
      radius: archetype.radius, health: archetype.maxHealth * (0.3 + random() * 0.7), maxHealth: archetype.maxHealth,
      velocity: { x: 0, y: 0 }, spawnedTick: -100, attackPhase: 'ready', hitUntilTick: null,
    };
  });
  const hits = new Map();
  const step = (tick) => {
    for (const enemy of enemies) {
      enemy.x += (random() - 0.5) * 6;
      enemy.y += (random() - 0.5) * 6;
      enemy.velocity = { x: (random() - 0.5) * 160, y: (random() - 0.5) * 160 };
      const roll = random();
      if (roll < 0.01) {
        enemy.attackPhase = 'tell';
        enemy.attackTellStartedTick = tick;
        enemy.attackPhaseUntilTick = tick + 30;
        enemy.telegraphTarget = { x: enemy.x + 80, y: enemy.y + 40, groundZ: 0 };
      } else if (roll < 0.02 && enemy.attackPhase === 'tell') {
        enemy.attackPhase = 'ready';
        enemy.telegraphTarget = null;
      }
      if (random() < 0.03) {
        enemy.hitUntilTick = tick + 6;
        hits.set(enemy.id, { tick, knockback: { x: 6, y: 0 }, knockbackResistance: 1, damageApplied: 8, maxHealth: enemy.maxHealth, critical: false, shielded: false, armor: 1, supportArmored: false });
      }
    }
  };
  return { enemies, hits, step };
}

function side(kind) {
  const markers = new Map();
  const facing = new Map();
  const displayFactory = kind === 'reference' ? referenceRoster.createEnemyRosterDisplay : createEnemyRosterDisplay;
  const indexFactory = kind === 'reference' ? referenceRoster.createEnemyRosterAtlasIndex : createEnemyRosterAtlasIndex;
  const indexes = Object.fromEntries(ROSTER.map((id) => [id, indexFactory(metadata[id], id)]));
  const attach = (enemies) => {
    for (const enemy of enemies) {
      const display = displayFactory({ index: indexes[enemy.archetypeId], atlasTexture: atlas[enemy.archetypeId], ...classes, scale: 1, elite: isEliteEnemyProjection(enemy.id) });
      display.rosterScale = enemyRosterAsset(enemy.archetypeId).runtimeScale;
      display.phaseRelativePoses = true;
      display.contactShadowFootprint = ENEMY_ARCHETYPES[enemy.archetypeId].radius;
      markers.set(enemy.id, display);
    }
  };
  return { markers, facing, attach };
}

const referenceSide = side('reference');
const passSide = side('pass');
const passFor = (hitFeedbackById) => createEnemyRenderPass({
  markers: passSide.markers, facing: passSide.facing, hitFeedbackById, archetypes: ENEMY_ARCHETYPES, enemyTelegraphs: sink,
  worldToScreenInto, isScreenPointVisible, resolveEnemyRuntimeVisualState, selectEnemyRosterPose, creatureAnimationTick, creatureIdPhase,
  isEliteEnemyProjection, resolveEnemyVisualDirection, prepareWorldDesignEnemyPose, worldDepthKey, contactShadowFootY,
  drawEliteGroundRing: noop, placeWeaponGlow: noop, projectGasBomberCanister,
});

let gcCount = 0;
let gcMs = 0;
const observer = new PerformanceObserver((list) => { for (const entry of list.getEntries()) { gcCount += 1; gcMs += entry.duration; } });
observer.observe({ entryTypes: ['gc'] });

async function runBlock(kind, seed) {
  const { enemies, hits, step } = crowd(seed);
  const target = kind === 'reference' ? referenceSide : passSide;
  target.markers.clear();
  target.facing.clear();
  target.attach(enemies);
  const pass = kind === 'pass' ? passFor(hits) : null;
  const camera = { x: 500, y: 900, zoom: 1, shakeX: 0, shakeY: 0, groundZ: 0 };
  const heroScreen = { x: view.width / 2, y: view.height / 2 };
  globalThis.gc?.();
  // GC observer entries arrive asynchronously: let the forced GC's land first.
  await new Promise((resolve) => setTimeout(resolve, 20));
  const gcBefore = gcCount;
  const gcMsBefore = gcMs;
  let busy = 0;
  let tick = 1000;
  for (let frame = 0; frame < FRAMES; frame += 1) {
    tick += 2;
    step(tick);
    camera.x = 500 + Math.sin(frame / 90) * 120;
    const started = performance.now();
    if (kind === 'reference') {
      const result = referenceEnemyBodyPass({
        grayboxEnemies: enemies, enemyMarkers: target.markers, enemyVisualFacing: target.facing, enemyHitFeedback, enemyHitFeedbackById: hits,
        simulation: { tick }, camera, view, screen: heroScreen, performanceProfile: MOBILE, releaseTelemetryEnabled: false, dataset: {},
        settings: { reduceMotion: false, reduceFlash: false }, particleScale: 4, contactShadowPool: shadows, enemyTelegraphs: sink,
        runtimeEncounterSnapshot: () => ({ animationCap: 64 }), worldToScreen: reference.worldToScreen, isScreenPointVisible: reference.isScreenPointVisible,
        resolveEnemyRuntimeVisualState, isEliteEnemyProjection, selectAnimatedEnemyIds, ENEMY_ARCHETYPES, resolveEnemyVisualDirection,
        resolveEnemyRosterPoseSelection: reference.resolveEnemyRosterPoseSelection, prepareWorldDesignEnemyPose: reference.prepareWorldDesignEnemyPose,
        creatureAnimationTick, placeWeaponGlow: noop, worldDepthKey, contactShadowFootY, drawEliteGroundRing: noop, projectGasBomberCanister,
      });
      referenceHealthPips({ enemyHealthPips: result.enemyHealthPips, camera, world: { position: { x: 0, y: 0 } }, overlayVisuals: sink });
    } else {
      pass.render({
        enemies, camera, view, tick, heroScreen, cullMargin: MOBILE.enemyCullMargin, animationBudget: Math.min(MOBILE.maxAnimatedEnemies, 64),
        simulationActive: true, contactShadowPool: shadows, hitFeedback: enemyHitFeedback, particleScale: 4, reduceMotion: false, reduceFlash: false,
      });
      pass.drawHealthPips(sink, camera.zoom, 0, 0);
    }
    busy += performance.now() - started;
  }
  await new Promise((resolve) => setTimeout(resolve, 20));
  return { msPerFrame: busy / FRAMES, gcs: gcCount - gcBefore, gcMs: gcMs - gcMsBefore };
}

const results = { reference: [], pass: [] };
for (let block = 0; block < BLOCKS; block += 1) {
  const order = block % 2 === 0 ? ['reference', 'pass'] : ['pass', 'reference'];
  for (const kind of order) results[kind].push(await runBlock(kind, 0x484d4804 + block));
}
await new Promise((resolve) => setTimeout(resolve, 50));
observer.disconnect();
const summary = (rows) => ({
  msPerFrame: rows.map((row) => +row.msPerFrame.toFixed(4)),
  meanMsPerFrame: +(rows.reduce((sum, row) => sum + row.msPerFrame, 0) / rows.length).toFixed(4),
  gcsPerThousandFrames: +(rows.reduce((sum, row) => sum + row.gcs, 0) / rows.length / FRAMES * 1000).toFixed(2),
});
console.log(JSON.stringify({ frames: FRAMES, blocks: BLOCKS, population: POPULATION, cap: CAP, reference: summary(results.reference), pass: summary(results.pass) }, null, 2));

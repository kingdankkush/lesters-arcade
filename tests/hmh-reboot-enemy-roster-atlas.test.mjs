import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import test from 'node:test';

import {
  ENEMY_ROSTER_ACTORS,
  ENEMY_ROSTER_DIRECTIONS,
  ENEMY_ROSTER_PIPELINE_ID,
  ENEMY_ROSTER_STATES,
  ENEMY_DIRECTION_BY_SIMULATION_INDEX,
  createEnemyRosterAtlasIndex,
  directionNameForRosterIndex,
  enemyRosterAsset,
  resolveEnemyRosterPose,
} from '../apps/hmh-reboot/src/enemy-roster-atlas.mjs';
import { ENEMY_ARCHETYPES, REQUIRED_ENEMY_VISUAL_STATES } from '../apps/hmh-reboot/src/enemy-archetypes.mjs';

const rosterPath = (actorId) => new URL(
  `../apps/portal/assets/generated/hmh-reboot-enemy-roster/${actorId}/${actorId}-roster-atlas.json`,
  import.meta.url,
);

const loadMetadata = async (actorId) => JSON.parse(await readFile(rosterPath(actorId), 'utf8'));

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
    // 6 states x 8 directions x authored frame counts = 152 per actor.
    assert.equal(index.frameCount, 152, `${actorId} frame count regressed`);
  }
});

test('a roster index rejects foreign or gameplay-authoritative metadata', async () => {
  const metadata = await loadMetadata('forkrunner');
  assert.throws(() => createEnemyRosterAtlasIndex({ ...metadata, pipelineId: 'other' }, 'forkrunner'), /pipeline/);
  assert.throws(() => createEnemyRosterAtlasIndex({ ...metadata, runtimeAuthority: 'gameplay' }, 'forkrunner'), /projection-only/);
  assert.throws(() => createEnemyRosterAtlasIndex(metadata, 'whale-enforcer'), /mismatch/);
  const missingState = { ...metadata, frames: metadata.frames.filter((frame) => frame.state !== 'death') };
  assert.throws(() => createEnemyRosterAtlasIndex(missingState, 'forkrunner'), /missing death/);
});

test('pose resolution is deterministic, wraps loops, and holds the death frame', async () => {
  const index = createEnemyRosterAtlasIndex(await loadMetadata('bagholder-rusher'), 'bagholder-rusher');
  const first = resolveEnemyRosterPose(index, { state: 'run', tick: 40, direction: 2 });
  const second = resolveEnemyRosterPose(index, { state: 'run', tick: 40, direction: 2 });
  assert.equal(first.id, second.id, 'same tick and direction must resolve the same frame');
  assert.equal(first.direction, 'south', 'simulation index 2 is south, matching the hero mapping');

  const runCount = index.frameCountFor('run', 'south');
  const wrapped = resolveEnemyRosterPose(index, { state: 'run', tick: 40 + runCount * 4, direction: 2 });
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

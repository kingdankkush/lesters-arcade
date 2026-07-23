import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PRODUCTION_HERO_ASSETS,
  PRODUCTION_HERO_ATLAS_METADATA_URL,
  PRODUCTION_HERO_RUNTIME_SCALE,
  createProductionHeroAtlasIndex,
  directionNameForProductionIndex,
  productionHeroAsset,
  resolveProductionHeroPose,
} from '../apps/hmh-reboot/src/production-hero-atlas.mjs';

const DIRECTIONS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];
const LAYERS = ['shadow', 'lower-body', 'torso-head', 'weapon'];
const clips = {
  shadow: { idle: { frames: 1, fps: 1 } },
  'lower-body': { idle: { frames: 2, fps: 2 }, run: { frames: 6, fps: 12 } },
  'torso-head': { aim: { frames: 2, fps: 2 }, 'pistol-fire': { frames: 3, fps: 15 }, hurt: { frames: 2, fps: 10 } },
  weapon: { aim: { frames: 2, fps: 2 }, 'pistol-fire': { frames: 3, fps: 15 } },
};

function metadataFixture(actorId = 'lit-commando') {
  const variantId = actorId === 'lit-valkyrie' ? 'plasma-striker' : 'reserve-vanguard';
  const frames = [];
  for (const layer of LAYERS) {
    for (const [state, clip] of Object.entries(clips[layer])) {
      for (const direction of DIRECTIONS) {
        for (let frameIndex = 0; frameIndex < clip.frames; frameIndex += 1) {
          frames.push({
            id: `${actorId}__${layer}__${state}__${direction}__${String(frameIndex).padStart(3, '0')}`,
            layer,
            state,
            direction,
            frameIndex,
            fps: clip.fps,
            frame: { x: frames.length * 2, y: 0, w: 80, h: 120 },
            sourcePivot: { x: 80, y: 146 },
            pivot: { x: 40, y: 115 },
            anchor: { x: 0.5, y: 0.958333 },
          });
        }
      }
    }
  }
  return {
    schemaVersion: 1,
    pipelineId: 'hmh-reboot-production-hero-pilot-v1',
    actorId,
    variantId,
    classification: 'production-art',
    runtimeAuthority: 'projection-only',
    gameplayBodyProfile: 'human-medium-collision-v1',
    image: `./${actorId}-production-pilot-atlas.png`,
    directions: DIRECTIONS,
    layers: LAYERS,
    composition: { independentDirections: true, weaponSocket: 'weapon_socket', layerOrder: LAYERS },
    frames,
  };
}

test('production hero atlas constants target selected repository-owned art', () => {
  assert.equal(PRODUCTION_HERO_ATLAS_METADATA_URL, '/assets/generated/hmh-reboot-production-heroes/lit-commando/lit-commando-production-pilot-atlas.json');
  assert.equal(PRODUCTION_HERO_ASSETS['lit-valkyrie'].metadataUrl, '/assets/generated/hmh-reboot-production-heroes/lit-valkyrie/lit-valkyrie-production-pilot-atlas.json');
  assert.equal(productionHeroAsset('lit-valkyrie').variantId, 'plasma-striker');
  assert.throws(() => productionHeroAsset('unknown-hero'));
  assert.ok(PRODUCTION_HERO_RUNTIME_SCALE > 0.5 && PRODUCTION_HERO_RUNTIME_SCALE < 0.7);
});

test('production hero atlas index rejects authority and identity drift', () => {
  const metadata = metadataFixture();
  const index = createProductionHeroAtlasIndex(metadata);
  assert.equal(index.actorId, 'lit-commando');
  assert.equal(index.variantId, 'reserve-vanguard');
  assert.equal(index.frameByKey.size, 168);
  assert.deepEqual(index.layerOrder, LAYERS);

  for (const [field, value] of [
    ['runtimeAuthority', 'gameplay-authority'],
    ['gameplayBodyProfile', 'human-heavy-collision-v1'],
    ['classification', 'concept-review-only'],
    ['actorId', 'lit-valkyrie'],
  ]) {
    const invalid = metadataFixture();
    invalid[field] = value;
    assert.throws(() => createProductionHeroAtlasIndex(invalid));
  }

  const femaleMetadata = metadataFixture('lit-valkyrie');
  const female = createProductionHeroAtlasIndex(femaleMetadata, productionHeroAsset('lit-valkyrie'));
  assert.equal(female.actorId, 'lit-valkyrie');
  assert.equal(female.variantId, 'plasma-striker');
  assert.equal(female.frameByKey.size, 168);
});

test('production direction mapping preserves simulation semantics', () => {
  assert.deepEqual(Array.from({ length: 8 }, (_, index) => directionNameForProductionIndex(index)), [
    'east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east',
  ]);
  assert.equal(directionNameForProductionIndex(-1), 'north-east');
});

test('production pose resolver composes independent locomotion aim fire and hurt layers', () => {
  const index = createProductionHeroAtlasIndex(metadataFixture());
  const idle = resolveProductionHeroPose(index, {
    simulationTick: 30,
    actionTick: 0,
    locomotion: 'idle',
    legDirection: 0,
    torsoDirection: 6,
    action: 'aim',
  });
  assert.deepEqual(idle.map((frame) => [frame.layer, frame.state, frame.direction, frame.frameIndex]), [
    ['shadow', 'idle', 'east', 0],
    ['lower-body', 'idle', 'east', 1],
    ['torso-head', 'aim', 'north', 1],
    ['weapon', 'aim', 'north', 1],
  ]);

  const firing = resolveProductionHeroPose(index, {
    simulationTick: 5,
    actionTick: 5,
    locomotion: 'moving',
    legDirection: 1,
    torsoDirection: 7,
    action: 'pistol-fire',
  });
  assert.deepEqual(firing.map((frame) => [frame.layer, frame.state, frame.direction, frame.frameIndex]), [
    ['shadow', 'idle', 'south-east', 0],
    ['lower-body', 'run', 'south-east', 1],
    ['torso-head', 'pistol-fire', 'north-east', 1],
    ['weapon', 'pistol-fire', 'north-east', 1],
  ]);

  const hurt = resolveProductionHeroPose(index, {
    simulationTick: 7,
    actionTick: 7,
    locomotion: 'idle',
    legDirection: 4,
    torsoDirection: 4,
    action: 'hurt',
  });
  assert.deepEqual(hurt.map((frame) => [frame.layer, frame.state]), [
    ['shadow', 'idle'], ['lower-body', 'idle'], ['torso-head', 'hurt'], ['weapon', 'aim'],
  ]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { validateSpriteManifest, SpriteActor } from '../apps/portal/src/sprite-pipeline.mjs';
import { HMH_ROSTER_LESTER_MATRIX, HMH_ROSTER_LILLY_MATRIX } from '../apps/portal/src/canonical-actors.mjs';
import { assetSrcForFrameRef } from '../apps/portal/src/atlas-frame-ref.mjs';

const REQUIRED_DIRECTIONS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];
const REQUIRED_STATES = ['idle', 'walk', 'run', 'shoot-pistol', 'shoot-shotgun', 'shoot-mg', 'melee', 'throw-grenade', 'hurt', 'death', 'dash', 'victory'];

function repoPath(assetPath) {
  const concrete = assetSrcForFrameRef(assetPath);
  const normalized = concrete.startsWith('./') ? concrete.slice(2) : concrete;
  return fileURLToPath(new URL(`../apps/portal/${normalized}`, import.meta.url));
}

function allFrames(manifest) {
  const frames = [];
  for (const [state, stateDef] of Object.entries(manifest.states)) {
    for (const [direction, list] of Object.entries(stateDef.frames)) {
      for (const src of list) frames.push({ state, direction, src });
    }
  }
  return frames;
}

for (const [hero, manifest] of Object.entries({ lester: HMH_ROSTER_LESTER_MATRIX, lilly: HMH_ROSTER_LILLY_MATRIX })) {
  test(`animated-roster ${hero} compatibility matrix is valid, complete, and runtime-addressable`, () => {
    const result = validateSpriteManifest(manifest);
    assert.equal(result.ok, true, result.errors.join('; '));
    assert.deepEqual(manifest.directions, REQUIRED_DIRECTIONS);
    assert.deepEqual(Object.keys(manifest.states), REQUIRED_STATES);
    assert.deepEqual(manifest.frameSize, [128, 128]);
    assert.equal(manifest.anchor, 'bottom-center');


    for (const state of REQUIRED_STATES) {
      const stateDef = manifest.states[state];
      assert.ok(stateDef, `${hero} missing state ${state}`);
      for (const direction of REQUIRED_DIRECTIONS) {
        const frames = stateDef.frames[direction];
        assert.equal(Array.isArray(frames), true, `${hero} ${state}/${direction} frames should be an array`);
        assert.equal(frames.length > 0, true, `${hero} ${state}/${direction} should have frames`);
      }
    }

    const frameList = allFrames(manifest);
    assert.equal(frameList.length >= 392, true, `${hero} should preserve or exceed WO-93 frame coverage`);
    for (const frame of frameList) {
      assert.equal(existsSync(repoPath(frame.src)), true, `${hero} missing ${frame.state}/${frame.direction}: ${frame.src}`);
    }
  });

  test(`animated-roster ${hero} SpriteActor resolves gameplay aliases and all eight directions`, () => {
    const loaded = [];
    const actor = new SpriteActor(manifest, (src) => {
      loaded.push(src);
      return { src, complete: true, naturalWidth: 128 };
    });
    for (const direction of REQUIRED_DIRECTIONS) {
      for (const requestedState of ['idle', 'run', 'shoot', 'attack', 'melee', 'grenade', 'hurt', 'death', 'dash', 'victory']) {
        const frame = actor.frame({ state: requestedState, direction, clock: 0 });
        assert.equal(Boolean(frame.src), true, `${hero} ${requestedState}/${direction} should resolve to a frame`);
        assert.equal(frame.direction, direction);
      }
    }
    assert.equal(loaded.length > 0, true, `${hero} should load frames through SpriteActor`);
  });
}

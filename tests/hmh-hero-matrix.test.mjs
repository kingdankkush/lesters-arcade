import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { validateSpriteManifest, SpriteActor } from '../apps/portal/src/sprite-pipeline.mjs';
import { HMH_WO93_LESTER_MATRIX } from '../apps/portal/assets/generated/hmh-hero-matrix/wo93-v1/lester/lester.mjs';
import { HMH_WO93_LILLY_MATRIX } from '../apps/portal/assets/generated/hmh-hero-matrix/wo93-v1/lilly/lilly.mjs';

const REQUIRED_DIRECTIONS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];
const REQUIRED_STATES = ['idle', 'walk', 'run', 'shoot-pistol', 'shoot-shotgun', 'shoot-mg', 'melee', 'throw-grenade', 'hurt', 'death', 'dash', 'victory'];

function repoPath(assetPath) {
  const normalized = assetPath.startsWith('./') ? assetPath.slice(2) : assetPath;
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

for (const [hero, manifest] of Object.entries({ lester: HMH_WO93_LESTER_MATRIX, lilly: HMH_WO93_LILLY_MATRIX })) {
  test(`WO-93 ${hero} matrix is valid, complete, and runtime-addressable`, () => {
    const result = validateSpriteManifest(manifest);
    assert.equal(result.ok, true, result.errors.join('; '));
    assert.deepEqual(manifest.directions, REQUIRED_DIRECTIONS);
    assert.deepEqual(Object.keys(manifest.states), REQUIRED_STATES);
    assert.deepEqual(manifest.frameSize, [128, 128]);
    assert.equal(manifest.anchor, 'bottom-center');
    assert.equal(manifest.atlas?.prewarm, true);
    assert.equal(manifest.atlas?.mode, 'loose-png-frames');
    assert.equal(Boolean(manifest.eventAnchors?.south?.muzzle), true);
    assert.equal(Boolean(manifest.eventAnchors?.east?.muzzle), true);
    assert.equal(Boolean(manifest.eventAnchors?.west?.muzzle), true);
    assert.equal(Boolean(manifest.stateEvents?.['shoot-pistol']?.some((event) => event.event === 'muzzle-flash')), true);
    assert.equal(Boolean(manifest.stateEvents?.['throw-grenade']?.some((event) => event.event === 'grenade-release')), true);
    assert.equal(existsSync(fileURLToPath(new URL(`../${manifest.contactSheet}`, import.meta.url))), true);

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
    assert.equal(frameList.length, 392);
    for (const frame of frameList) {
      assert.equal(existsSync(repoPath(frame.src)), true, `${hero} missing ${frame.state}/${frame.direction}: ${frame.src}`);
    }
  });

  test(`WO-93 ${hero} SpriteActor resolves gameplay aliases and all eight directions`, () => {
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

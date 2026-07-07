import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { HMH_ANIMATED_ROSTER } from '../apps/portal/assets/generated/hmh-animated-roster/hmh-animated-roster.mjs';
import { repairRuntimeActorKey } from '../apps/portal/src/hmh-art-repair.mjs';

const repoPath = (relativePath) => fileURLToPath(new URL(`../${relativePath}`, import.meta.url));

const DIRECTIONS = Object.freeze(['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']);
const REQUIRED_STATES = Object.freeze(['idle', 'walk', 'run', 'attack-tell', 'attack', 'hit', 'death', 'spawn-in']);
const WO109_BATCH_ONE = Object.freeze([
  'crypto-bro-rusher',
  'gas-beast-tank',
  'evil-banker-ranged',
  'liquidation-cascade-golem',
  'scorpion-ambusher',
]);

test('WO-109 batch one ships five Level-1 runtime-spawnable enemy redraws with full 8-direction matrices', () => {
  for (const actorKey of WO109_BATCH_ONE) {
    const actor = HMH_ANIMATED_ROSTER[actorKey];
    assert.ok(actor, `${actorKey} is present in the runtime animated roster`);
    assert.equal(actor.role, 'enemy');
    for (const state of REQUIRED_STATES) {
      const dirs = actor.animations[state];
      assert.ok(dirs, `${actorKey}/${state} exists`);
      assert.deepEqual(Object.keys(dirs).sort(), [...DIRECTIONS].sort(), `${actorKey}/${state} has all 8 directions`);
      for (const direction of DIRECTIONS) {
        const frames = dirs[direction];
        assert.ok(Array.isArray(frames) && frames.length >= 1, `${actorKey}/${state}/${direction} has frames`);
        for (const frame of frames) {
          assert.match(frame, new RegExp(`^\\./assets/generated/hmh-animated-roster/${actorKey}/${state}/${direction}/`));
          assert.ok(existsSync(repoPath(`apps/portal/${frame.replace(/^\.\//, '')}`)), `${frame} exists on disk`);
        }
      }
    }
  }
});

test('WO-109 batch one removes old auto-repair fallback use for redesigned runtime actors', () => {
  for (const actorKey of WO109_BATCH_ONE) {
    const resolved = repairRuntimeActorKey(actorKey, HMH_ANIMATED_ROSTER);
    assert.equal(resolved.key, actorKey);
    assert.equal(resolved.repaired, false, `${actorKey} renders directly instead of through an old fallback actor`);
    assert.equal(resolved.action, 'keep');
  }
});

test('WO-109 batch one proof and report artifacts are committed review handles', () => {
  assert.ok(existsSync(repoPath('scripts/generate-wo109-enemy-redesign-batch.py')));
  assert.ok(existsSync(repoPath('docs/game-design/wo109-enemy-redesign-batch/README.md')));
  assert.ok(existsSync(repoPath('docs/game-design/wo109-enemy-redesign-batch/wo109-enemy-redesign-batch1-proof.png')));
});

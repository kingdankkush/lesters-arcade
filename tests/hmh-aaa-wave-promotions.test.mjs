import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { HMH_ANIMATED_ROSTER } from '../apps/portal/assets/generated/hmh-animated-roster/hmh-animated-roster.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIRECTIONS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];
const STATES = ['idle', 'walk', 'run', 'attack-tell', 'attack', 'hit', 'death', 'spawn-in'];

function framePath(src) {
  return path.join(ROOT, 'apps/portal', src.replace(/^\.\//, ''));
}

function assertCompleteAaaEnemy(actorKey) {
  const actor = HMH_ANIMATED_ROSTER[actorKey];
  assert.ok(actor, `${actorKey} exists in runtime roster`);
  assert.equal(actor.source, 'pixellab-aaa-quality-wave-v2');
  assert.match(actor.quality_target, /AAA isometric pixel-art/i);
  for (const state of STATES) {
    for (const direction of DIRECTIONS) {
      const frames = actor.animations?.[state]?.[direction] ?? [];
      assert.ok(frames.length >= 1, `${actorKey}/${state}/${direction} has frames`);
      for (const src of frames) assert.equal(existsSync(framePath(src)), true, `${src} exists`);
    }
  }
}

test('complete PixelLab AAA wave enemies replace old partial runtime kits', () => {
  assertCompleteAaaEnemy('trench-degen');
  assertCompleteAaaEnemy('phishing-angler');
  assertCompleteAaaEnemy('mev-reaper');
});

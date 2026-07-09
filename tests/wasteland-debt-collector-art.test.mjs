import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { HMH_ANIMATED_ROSTER } from '../apps/portal/assets/generated/hmh-animated-roster/hmh-animated-roster.mjs';
import { bespokeEnemyVisualKitFor } from '../apps/portal/src/hmh-encounter-visuals.mjs';

const DIRECTIONS = Object.freeze(['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']);
const STATES = Object.freeze(['idle', 'walk', 'attack-tell', 'attack', 'hit', 'death']);
const repoRoot = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

test('Wasteland Debt Collector has approved 8-direction production sprite coverage', () => {
  const entry = HMH_ANIMATED_ROSTER['wasteland-debt-collector'];
  assert.ok(entry, 'wasteland-debt-collector roster entry should exist');
  assert.equal(entry.role, 'enemy');
  assert.equal(entry.character_id, 'user-approved-wasteland-debt-collector-contact-sheets');

  for (const state of STATES) {
    const animation = entry.animations[state];
    assert.ok(animation, `${state} animation should exist`);
    assert.deepEqual(Object.keys(animation), DIRECTIONS, `${state} directions should be canonical and ordered`);
    for (const direction of DIRECTIONS) {
      assert.equal(animation[direction].length, 7, `${state}/${direction} should have 7 frames`);
      for (const src of animation[direction]) {
        assert.match(src, /^\.\/assets\/generated\/hmh-animated-roster\/wasteland-debt-collector\//);
        assert.doesNotMatch(src, /C:|Users|Downloads|\\/i, 'runtime frame paths must not leak local source paths');
        assert.equal(
          existsSync(join(repoRoot, 'apps/portal', src.replace('./', ''))),
          true,
          `${state}/${direction} frame should exist on disk: ${src}`,
        );
      }
    }
  }
});

test('Paper Hands uses the direct PixelLab runtime kit instead of Wasteland Debt Collector', () => {
  const kit = bespokeEnemyVisualKitFor({ id: 'paper-hand', title: 'Paper Hands' });
  assert.ok(kit);
  assert.equal(kit.rosterKey, 'paper-hand');
  assert.ok(kit.drawScaleMul >= 1);
});

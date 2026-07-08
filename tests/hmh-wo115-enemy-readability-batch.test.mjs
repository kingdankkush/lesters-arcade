import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { HMH_ANIMATED_ROSTER } from '../apps/portal/assets/generated/hmh-animated-roster/hmh-animated-roster.mjs';
import { repairRuntimeActorKey } from '../apps/portal/src/hmh-art-repair.mjs';
import { buildRosterCoverageReport } from '../scripts/roster-coverage-report.mjs';

const repoPath = (relativePath) => fileURLToPath(new URL(`../${relativePath}`, import.meta.url));
const DIRECTIONS = Object.freeze(['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']);
const REQUIRED_STATES = Object.freeze(['idle', 'walk', 'run', 'attack-tell', 'attack', 'hit', 'death', 'spawn-in']);
const WO115_BATCH_TWO = Object.freeze([
  'claim-jumper',
  'scam-cult-zealot',
  'sybil-drone',
  'rug-rat',
  'honeypot-turret',
]);

test('WO-115 batch two completes five Level 1 runtime enemy matrices', () => {
  for (const actorKey of WO115_BATCH_TWO) {
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

test('WO-115 batch two renders directly and improves Level 1 roster coverage', () => {
  const report = buildRosterCoverageReport({ repoRoot: repoPath('') });
  for (const actorKey of WO115_BATCH_TWO) {
    const resolved = repairRuntimeActorKey(actorKey, HMH_ANIMATED_ROSTER);
    assert.equal(resolved.key, actorKey);
    assert.equal(resolved.repaired, false, `${actorKey} renders directly instead of through an old fallback actor`);
    assert.equal(resolved.action, 'keep');
    assert.equal(report.actors[actorKey].summary.status, 'complete', `${actorKey} should be complete in roster coverage`);
  }
  const completeLevelOne = new Set(report.levelOneShipScope
    .filter((row) => WO115_BATCH_TWO.includes(row.actorKey) && row.coverageStatus === 'complete')
    .map((row) => row.actorKey));
  assert.equal(completeLevelOne.size, WO115_BATCH_TWO.length);
});

test('WO-115 proof and level-design readability docs are committed review handles', () => {
  assert.ok(existsSync(repoPath('scripts/generate-wo115-enemy-readability-batch.py')));
  assert.ok(existsSync(repoPath('docs/game-design/wo115-enemy-readability-batch/README.md')));
  assert.ok(existsSync(repoPath('docs/game-design/wo115-enemy-readability-batch/wo115-enemy-readability-batch2-proof.png')));
  assert.ok(existsSync(repoPath('docs/game-design/wo115-level-design-readability-lock.md')));
});

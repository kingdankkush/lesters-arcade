import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  HMH_WO107_CHECKPOINT2,
  buildWo107Checkpoint2Tour,
  renderWo107Checkpoint2Markdown,
} from '../apps/portal/src/hmh-wo107-checkpoint2.mjs';

function repoPath(relativePath) {
  return fileURLToPath(new URL(`../${relativePath}`, import.meta.url));
}

test('WO-107 Checkpoint 2 covers the full six-biome Level 1 assembly', () => {
  const tour = buildWo107Checkpoint2Tour();
  assert.equal(HMH_WO107_CHECKPOINT2.id, 'wo107-level-one-checkpoint-2-v1');
  assert.equal(tour.seed, 1337);
  assert.deepEqual(tour.summary.biomeCoverage, [
    'neon-city-core',
    'industrial-yard',
    'old-canal-riverfront',
    'lakeside-park-old-growth',
    'farmstead-outskirts',
    'extraction-plaza',
  ]);
  assert.deepEqual(tour.summary.routeBeatCoverage, ['spawn', 'first-arena', 'arena', 'pressure', 'chokepoint', 'loop', 'breather', 'boss', 'extract']);
  assert.equal(tour.steps.length, 6);
  assert.equal(tour.summary.placedObjectCount > 50, true);
  assert.equal(tour.summary.microSceneCount >= 12, true);
});

test('WO-107 lighting pass defines readable dusk/noir checks for every biome step', () => {
  const tour = buildWo107Checkpoint2Tour();
  for (const step of tour.steps) {
    assert.equal(step.lighting.phase, 'dusk');
    assert.equal(step.lighting.hasDynamicLightingPass, true);
    assert.equal(step.lighting.hasVisionFogPass, true);
    assert.equal(step.lighting.acceptance.length >= 3, true, `${step.biomeId} lighting checks`);
    assert.equal(step.acceptance.some((rule) => /silhouette|readable|negative space/i.test(rule)), true, `${step.biomeId} readability rule`);
  }
});

test('WO-107 Checkpoint 2 keeps Justin verdict gate open instead of pretending final approval', () => {
  const tour = buildWo107Checkpoint2Tour();
  assert.equal(tour.verdictGate.owner, 'Justin');
  assert.equal(tour.verdictGate.status, 'open');
  assert.equal(tour.verdictGate.blocksShipCandidate, true);
  assert.match(tour.verdictGate.prompt, /approve|revise/i);
});

test('WO-107 markdown renders and committed notice exists', () => {
  const markdown = renderWo107Checkpoint2Markdown();
  assert.match(markdown, /Playtest Checkpoint 2/);
  assert.match(markdown, /Justin Verdict Gate/);
  assert.match(markdown, /six-biome/i);
  const noticePath = repoPath('docs/game-design/PLAYTEST_CHECKPOINT_2_NOTICE.md');
  assert.equal(existsSync(noticePath), true);
  const notice = readFileSync(noticePath, 'utf8');
  assert.match(notice, /Playtest Checkpoint 2/);
  assert.match(notice, /Justin Verdict Gate/);
});

test('WO-107 files are covered by the explicit syntax gate', () => {
  const syntaxSource = readFileSync(repoPath('scripts/syntax-check.mjs'), 'utf8');
  assert.match(syntaxSource, /apps\/portal\/src\/hmh-wo107-checkpoint2\.mjs/);
  assert.match(syntaxSource, /tests\/hmh-wo107-checkpoint2\.test\.mjs/);
});

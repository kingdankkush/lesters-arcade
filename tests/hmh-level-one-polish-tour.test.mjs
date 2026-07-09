import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  buildLevelOnePolishAcceptanceTour,
  renderLevelOnePolishAcceptanceMarkdown,
} from '../apps/portal/src/hmh-level-one-polish-tour.mjs';
import { curatedLevelKitAssetByKey } from '../apps/portal/assets/generated/hmh-curated-level-kit/hmh-curated-level-kit-manifest.mjs';

function repoPath(relativePath) {
  return fileURLToPath(new URL(`../${relativePath}`, import.meta.url));
}

test('WO-66 Level 1 polish acceptance tour covers every authored route beat in order', () => {
  const tour = buildLevelOnePolishAcceptanceTour();
  assert.equal(tour.id, 'wo66-level-one-polish-acceptance-tour-v1');
  assert.deepEqual(tour.summary.routeCoverage, ['spawn', 'arena', 'arena', 'loop', 'chokepoint', 'pressure', 'boss', 'extract']);
  assert.equal(tour.steps.length, 8);
  assert.deepEqual(tour.checkCategories, ['readability', 'composition', 'navigation']);
  for (const step of tour.steps) {
    assert.equal(Number.isFinite(step.camera.playerX), true);
    assert.equal(Number.isFinite(step.camera.playerY), true);
    assert.equal(step.camera.window >= 18, true);
    assert.equal(step.checks.readability.length >= 3, true);
    assert.equal(step.checks.composition.length >= 3, true);
    assert.equal(step.checks.navigation.length >= 3, true);
    assert.equal(step.expectedAssetKeys.length >= 1, true);
  }
});

test('WO-66 tour expected cue keys are concrete curated or authored-route keys', () => {
  const tour = buildLevelOnePolishAcceptanceTour();
  const concreteKeys = tour.steps.flatMap((step) => step.expectedAssetKeys);
  assert.equal(concreteKeys.some((key) => key === 'level-1/water/water-02'), true, 'chokepoint should check exact shoreline water cue');
  assert.equal(concreteKeys.some((key) => key === 'curated/jul9-industrial-mining-00-mining-rig-rack'), true, 'boss yard should check exact crypto-industrial gate cue');
  assert.equal(concreteKeys.some((key) => key === 'curated/jul9-fences-barricades-18-retaining-wall'), true, 'boss yard should check exact barricade wall cue');
  assert.equal(concreteKeys.filter((key) => curatedLevelKitAssetByKey(key)).length >= 24, true, 'most expected cues should resolve to curated runtime art');
});

test('WO-66 punch list is prioritized and limited to actionable manual acceptance checks', () => {
  const tour = buildLevelOnePolishAcceptanceTour();
  assert.equal(tour.punchList.length >= 3, true);
  assert.equal(tour.punchList.every((item) => ['high', 'medium', 'low'].includes(item.severity)), true);
  assert.equal(tour.punchList.some((item) => item.area === 'navigation' && item.routeBeat === 'boss'), true);
  assert.equal(tour.punchList.every((item) => item.fix.length > 30), true);
});

test('WO-66 markdown report renders and report script writes the committed doc', () => {
  const markdown = renderLevelOnePolishAcceptanceMarkdown();
  assert.match(markdown, /Hard Money Heroes Level 1 Polish Acceptance Tour/);
  assert.match(markdown, /## Acceptance Steps/);
  assert.match(markdown, /## Punch List/);
  execFileSync(process.execPath, [repoPath('scripts/write-hmh-level-one-polish-tour.mjs')], { cwd: repoPath('.'), stdio: 'pipe' });
  const docPath = repoPath('docs/game-design/hmh-level-one-polish-acceptance-tour.md');
  assert.equal(existsSync(docPath), true);
  const doc = readFileSync(docPath, 'utf8');
  assert.match(doc, /Tour ID: `wo66-level-one-polish-acceptance-tour-v1`/);
  assert.match(doc, /Verification Commands/);
});

test('WO-66 polish tour files are covered by the explicit syntax gate', () => {
  const syntaxSource = readFileSync(repoPath('scripts/syntax-check.mjs'), 'utf8');
  assert.match(syntaxSource, /apps\/portal\/src\/hmh-level-one-polish-tour\.mjs/);
  assert.match(syntaxSource, /scripts\/write-hmh-level-one-polish-tour\.mjs/);
  assert.match(syntaxSource, /tests\/hmh-level-one-polish-tour\.test\.mjs/);
});

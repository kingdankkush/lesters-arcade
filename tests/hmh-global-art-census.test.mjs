import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildGlobalArtCensus, renderGlobalArtCensusMarkdown } from '../scripts/global-art-census.mjs';
import { buildArtPurgeRepairPlan } from '../apps/portal/src/hmh-art-repair.mjs';

function repoText(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('WO-17 global art census aggregates runtime, final-art, VFX, setpiece, and curated-world layers', () => {
  const census = buildGlobalArtCensus();

  assert.equal(census.version, 'wo-17-global-art-census-v1');
  assert.ok(census.summary.totalAssets > 100, `expected broad asset census, got ${census.summary.totalAssets}`);
  assert.ok(census.layers.runtimeAnimatedRoster.actorCount >= 30);
  assert.ok(census.layers.finalAnimationCompletion.assetCount > 0);
  assert.ok(census.layers.finalBossAnimations.assetCount > 0);
  assert.ok(census.layers.combatVfx.assetCount > 0);
  assert.ok(census.layers.finalSetpieces.assetCount > 0);
  assert.ok(census.layers.curatedLevelKit.assetCount > 0);
  assert.ok(census.scorecard.overallScore >= 0 && census.scorecard.overallScore <= 100);
  assert.ok(census.scorecard.categories.animationCoverage.score >= 0);
  assert.ok(census.scorecard.categories.sourcePolicy.score >= 0);
});

test('WO-17 global art census calls out incomplete roster coverage instead of pretending all art is done', () => {
  const census = buildGlobalArtCensus();

  assert.ok(census.scorecard.categories.animationCoverage.gaps.length > 0, 'partial/zero actor gaps should stay visible');
  assert.ok(census.recommendations.some((item) => /WO-18|purge|repair/i.test(item)), 'census should feed WO-18 purge/repair decisions');
  assert.ok(census.recommendations.some((item) => /WO-19|hero/i.test(item)), 'census should feed WO-19 hero certification decisions');
});

test('runtime actor census repair resolves all strict zero-animation blockers into direct renderable actors', () => {
  const repairPlan = buildArtPurgeRepairPlan();
  assert.equal(repairPlan.summary.keptRenderableCount, 8, 'WO-109 plus native critical actors should now render directly');
  assert.equal(repairPlan.summary.autoRepairCount, 0, 'no zero-animation actors should need auto-repair');
  assert.equal(repairPlan.summary.deferOrPurgeCount, 0);
  assert.equal(repairPlan.summary.unresolvedCount, 0);

  const census = buildGlobalArtCensus();
  const strict = census.scorecard.categories.strictRuntimeActors;
  assert.ok(strict, 'strict runtime actor score should exist');
  assert.equal(strict.summary.unresolvedZeroAnimationActorCount, 0);
  assert.equal(strict.summary.autoRepairedZeroAnimationActorCount, 0);
  assert.equal(strict.summary.deferredOrPurgedZeroAnimationActorCount, 0);
  assert.equal(strict.score, 100);
  assert.equal(census.summary.runtimeStrictRenderableActorCount, census.summary.runtimeActorCount);
  assert.equal(census.scorecard.categories.purgeReadiness.score, 100);
  assert.ok(census.scorecard.overallScore >= 80, `strict repair should improve global compliance score, got ${census.scorecard.overallScore}`);
  assert.equal(strict.gaps.some((gap) => /unresolved/i.test(gap)), false);
});

test('WO-17 global art census markdown and package wiring are durable', () => {
  const census = buildGlobalArtCensus();
  const markdown = renderGlobalArtCensusMarkdown(census);
  const packageJson = repoText('package.json');
  const syntaxCheck = repoText('scripts/syntax-check.mjs');

  assert.match(markdown, /# Hard Money Heroes Global Art Census/i);
  assert.match(markdown, /Compliance scorecard/i);
  assert.match(markdown, /Runtime animated roster/i);
  assert.equal(packageJson.includes('design:art-census'), true, 'package.json should expose npm run design:art-census');
  assert.equal(syntaxCheck.includes('scripts/global-art-census.mjs'), true, 'script should be in syntax gate');
  assert.equal(syntaxCheck.includes('tests/hmh-global-art-census.test.mjs'), true, 'test should be in syntax gate');
});

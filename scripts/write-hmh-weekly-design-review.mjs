import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  buildHardMoneyHeroesAnimationCoverageReport,
  buildHardMoneyHeroesAnimationProductionBriefs,
  buildTacticalBalanceDebugOverlayModel,
  LESTER_ARCADE_WORKFLOW_AUTOMATION,
} from '../apps/portal/src/arcade-core.mjs';

const outputDir = fileURLToPath(new URL('../docs/game-design', import.meta.url));
const weeklyMdPath = `${outputDir}/hard-money-heroes-weekly-design-review.md`;
const weeklyJsonPath = `${outputDir}/hard-money-heroes-weekly-design-review.json`;
const animationPlanPath = `${outputDir}/hard-money-heroes-animation-coverage-action-plan.md`;
const animationRequestsPath = `${outputDir}/hard-money-heroes-animation-production-requests.md`;
const balanceSnapshotPath = `${outputDir}/hard-money-heroes-tactical-balance-snapshot.md`;
const interactionPlanPath = `${outputDir}/hard-money-heroes-interaction-smoke-plan.json`;

async function readOptional(path) {
  if (!existsSync(path)) return null;
  return readFile(path, 'utf8');
}

function firstLines(text, count = 10) {
  if (!text) return ['Not generated yet. Run the paired design script.'];
  return text.split(/\r?\n/).filter(Boolean).slice(0, count);
}

const coverage = buildHardMoneyHeroesAnimationCoverageReport();
const briefs = buildHardMoneyHeroesAnimationProductionBriefs(coverage);
const overlayProbe = buildTacticalBalanceDebugOverlayModel({
  debugEnabled: true,
  playerX: 318,
  scroll: 144,
  furthestScroll: 200,
  stagePhase: 'travel',
  stageTravel: 73,
  stageTravelGoal: 254,
  enemies: [{ role: 'cover-shooter', state: 'telegraph', x: 520, attackTimer: 44 }],
  props: [{ kind: 'crate', cover: true, x: 180 }, { kind: 'barrel', explosive: true, x: 340 }],
});

const [animationPlan, animationRequests, balanceSnapshot, interactionPlan] = await Promise.all([
  readOptional(animationPlanPath),
  readOptional(animationRequestsPath),
  readOptional(balanceSnapshotPath),
  readOptional(interactionPlanPath),
]);

const review = {
  title: 'Hard Money Heroes Weekly Design Review',
  generatedAt: new Date().toISOString(),
  sourceReports: {
    animationCoverageActionPlan: 'docs/game-design/hard-money-heroes-animation-coverage-action-plan.md',
    animationProductionRequests: 'docs/game-design/hard-money-heroes-animation-production-requests.md',
    tacticalBalanceSnapshot: 'docs/game-design/hard-money-heroes-tactical-balance-snapshot.md',
    interactionSmokePlan: 'docs/game-design/hard-money-heroes-interaction-smoke-plan.json',
  },
  automationLoops: LESTER_ARCADE_WORKFLOW_AUTOMATION.loops.map((loop) => loop.id),
  animationCoverage: {
    heroRequestCount: briefs.summary.heroRequestCount,
    enemyRequestCount: briefs.summary.enemyRequestCount,
    topHeroNeeds: Object.fromEntries(Object.entries(briefs.heroes).map(([id, hero]) => [id, hero.requests.slice(0, 5).map((request) => request.state)])),
    topEnemyNeeds: Object.fromEntries(Object.entries(briefs.enemies).map(([id, enemy]) => [id, enemy.requests.slice(0, 4).map((request) => request.state)])),
    placeholderPolicy: briefs.placeholderPolicy,
  },
  tacticalBalance: {
    debugOverlay: overlayProbe.metrics,
    defaultPublicVisibility: overlayProbe.publicUiDefault,
    query: 'hmhDebug=balance',
  },
  weeklyChecklist: [
    'Run npm run design:audit after every art drop.',
    'Run npm run design:animation-prompts after every animation coverage change.',
    'Run npm run design:balance before every playable preview.',
    'Run npm run smoke:portal and npm run smoke:portal:interactions before handoff.',
    'Use browser smoke for real click evidence after any gameplay/menu/runtime change.',
    'Ask Justin for approval before scheduling recurring automation, importing licensed audio packs, or changing gore/intensity direction.',
  ],
};

const md = [
  '# Hard Money Heroes Weekly Design Review',
  '',
  `Generated: ${review.generatedAt}`,
  '',
  '## Source Reports',
  '',
  '- animation-coverage-action-plan: `docs/game-design/hard-money-heroes-animation-coverage-action-plan.md`',
  '- animation-production-requests: `docs/game-design/hard-money-heroes-animation-production-requests.md`',
  '- tactical-balance-snapshot: `docs/game-design/hard-money-heroes-tactical-balance-snapshot.md`',
  '- interaction-smoke-plan: `docs/game-design/hard-money-heroes-interaction-smoke-plan.json`',
  '',
  '## Animation Production Needs',
  '',
  `- Hero animation requests: ${briefs.summary.heroRequestCount}`,
  `- Enemy animation requests: ${briefs.summary.enemyRequestCount}`,
  `- Placeholder policy: ${briefs.placeholderPolicy}`,
  '',
  ...Object.values(briefs.heroes).map((hero) => `- ${hero.title}: ${hero.requests.slice(0, 5).map((request) => request.state).join(', ') || 'covered'}`),
  ...Object.values(briefs.enemies).map((enemy) => `- ${enemy.title}: ${enemy.requests.slice(0, 4).map((request) => request.state).join(', ') || 'covered'}`),
  '',
  '## Tactical Debug Overlay Probe',
  '',
  `- Query: hmhDebug=balance`,
  `- Public default: ${overlayProbe.publicUiDefault}`,
  `- Camera: ${overlayProbe.metrics.camera.mode} / backtrack ${overlayProbe.metrics.camera.backtrackLimit}`,
  `- Stage sample: ${overlayProbe.metrics.stage.progress}`,
  `- Enemy sample: ${overlayProbe.metrics.enemies.count} active / ${overlayProbe.metrics.enemies.telegraphing} telegraphing`,
  `- Cover sample: ${overlayProbe.metrics.cover.coverCount} cover / ${overlayProbe.metrics.cover.explosiveCount} explosive`,
  '',
  '## Latest Report Excerpts',
  '',
  '### Animation Coverage Action Plan',
  ...firstLines(animationPlan, 8).map((line) => `> ${line}`),
  '',
  '### Animation Production Requests',
  ...firstLines(animationRequests, 8).map((line) => `> ${line}`),
  '',
  '### Tactical Balance Snapshot',
  ...firstLines(balanceSnapshot, 8).map((line) => `> ${line}`),
  '',
  '### Interaction Smoke Plan',
  ...firstLines(interactionPlan, 8).map((line) => `> ${line}`),
  '',
  '## Weekly Checklist',
  '',
  ...review.weeklyChecklist.map((item) => `- ${item}`),
  '',
].join('\n');

await mkdir(outputDir, { recursive: true });
await writeFile(weeklyJsonPath, `${JSON.stringify(review, null, 2)}\n`);
await writeFile(weeklyMdPath, md);

console.log('Weekly design review written.');
console.log(weeklyMdPath);
console.log(weeklyJsonPath);

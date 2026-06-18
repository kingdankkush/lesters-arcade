import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  HARD_MONEY_HEROES_ASSET_MANIFEST,
  buildHardMoneyHeroesAnimationCoverageReport,
} from '../apps/portal/src/arcade-core.mjs';
import { CANONICAL_ACTOR_MANIFESTS } from '../apps/portal/src/canonical-actors.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const report = buildHardMoneyHeroesAnimationCoverageReport(HARD_MONEY_HEROES_ASSET_MANIFEST);

const outputDir = join(repoRoot, 'docs', 'game-design');
mkdirSync(outputDir, { recursive: true });

const jsonPath = join(outputDir, 'hard-money-heroes-animation-coverage-report.json');
const mdPath = join(outputDir, 'hard-money-heroes-animation-coverage-action-plan.md');

const ENEMY_CANONICAL_ACTOR_IDS = Object.freeze({
  trenchDegen: 'trench-degen',
  evilBanker: 'evil-banker',
  warrenSpearRider: 'warren-boss',
  cryptoBro: 'crypto-bro',
  gasBeast: 'gas-beast',
});

const enemyStateAliases = Object.freeze({
  'walk-or-fly': Object.freeze(['walk', 'fly', 'run']),
  'attack-tell': Object.freeze(['attack-tell', 'tell', 'telegraph']),
  'melee-counter': Object.freeze(['melee-counter', 'counter']),
  'optional-gore-overlay': Object.freeze(['gore', 'gore-overlay']),
});

function statesForActor(actorId) {
  return Object.keys(CANONICAL_ACTOR_MANIFESTS[actorId]?.states ?? {}).filter(Boolean).sort();
}

function satisfiesState(states, requiredState) {
  const aliases = enemyStateAliases[requiredState] ?? [requiredState];
  return aliases.some((alias) => states.includes(alias));
}

const runtimeEnemyCoverage = Object.fromEntries(Object.entries(report.enemies).map(([key, enemy]) => {
  const actorId = ENEMY_CANONICAL_ACTOR_IDS[key] ?? enemy.id;
  const runtimeAnimatedStates = statesForActor(actorId);
  const runtimeCoveredStates = report.requiredEnemyStates.filter((state) => satisfiesState(runtimeAnimatedStates, state));
  const runtimeDerivedStates = report.requiredEnemyStates.filter((state) => runtimeCoveredStates.includes(state) && !satisfiesState(enemy.availableAnimatedStates, state));
  const runtimeMissingStates = report.requiredEnemyStates.filter((state) => !satisfiesState(runtimeAnimatedStates, state));
  return [key, Object.freeze({
    canonicalActorId: actorId,
    runtimeAnimatedStates: Object.freeze(runtimeAnimatedStates),
    runtimeCoveredStates: Object.freeze(runtimeCoveredStates),
    runtimeDerivedStates: Object.freeze(runtimeDerivedStates),
    runtimeMissingStates: Object.freeze(runtimeMissingStates),
  })];
}));

const heroRows = Object.values(report.characters).map((character) => [
  character.id,
  character.availableAnimatedStates.join(', ') || 'none',
  character.coveredByStillStates.join(', ') || 'none',
  character.missingAnimatedStates.join(', ') || 'none',
  character.nextArtPriority.join(', ') || 'none',
]);

const enemyRows = Object.entries(report.enemies).map(([key, enemy]) => {
  const runtime = runtimeEnemyCoverage[key] ?? { runtimeDerivedStates: [], runtimeMissingStates: [] };
  return [
    enemy.id,
    enemy.title,
    enemy.availableAnimatedStates.join(', ') || 'none',
    runtime.runtimeDerivedStates.join(', ') || 'none',
    enemy.missingAnimatedStates.join(', ') || 'none',
    runtime.runtimeMissingStates.join(', ') || 'none',
  ];
});

const table = (headers, rows) => [
  `| ${headers.join(' | ')} |`,
  `| ${headers.map(() => '---').join(' | ')} |`,
  ...rows.map((row) => `| ${row.map((cell) => String(cell).replaceAll('\n', ' ')).join(' | ')} |`),
].join('\n');

const missingHeroCount = Object.values(report.characters).reduce((sum, character) => sum + character.missingAnimatedStates.length, 0);
const missingEnemyCount = Object.values(report.enemies).reduce((sum, enemy) => sum + enemy.missingAnimatedStates.length, 0);
const runtimeDerivedEnemyCount = Object.values(runtimeEnemyCoverage).reduce((sum, enemy) => sum + enemy.runtimeDerivedStates.length, 0);
const runtimeMissingEnemyCount = Object.values(runtimeEnemyCoverage).reduce((sum, enemy) => sum + enemy.runtimeMissingStates.length, 0);
const runtimeReadableEnemyCount = Object.values(runtimeEnemyCoverage).filter((enemy) => enemy.runtimeMissingStates.every((state) => state === 'optional-gore-overlay')).length;
const uniqueRuntimeMissingStates = [...new Set(Object.values(runtimeEnemyCoverage).flatMap((enemy) => enemy.runtimeMissingStates))];

const enhancedReport = Object.freeze({
  ...report,
  runtimeEnemyCoverage: Object.freeze(runtimeEnemyCoverage),
  summary: Object.freeze({
    missingHeroAnimatedStateCount: missingHeroCount,
    missingEnemyAnimatedStateCount: missingEnemyCount,
    runtimeDerivedEnemyStateCount: runtimeDerivedEnemyCount,
    runtimeMissingEnemyStateCount: runtimeMissingEnemyCount,
    runtimeReadableEnemyCount,
    runtimeEnemyCount: Object.keys(runtimeEnemyCoverage).length,
    uniqueRuntimeMissingStates: Object.freeze(uniqueRuntimeMissingStates),
  }),
});

const markdown = `# Hard Money Heroes Animation Coverage Report\n\nGenerated by \`npm run design:audit\`.\n\n## Runtime readability status\n\n- Canonical enemy manifests now provide runtime readability coverage for ${runtimeReadableEnemyCount}/${Object.keys(runtimeEnemyCoverage).length} current enemy actors, even before bespoke production sheets land.\n- Runtime-derived enemy states currently cover ${runtimeDerivedEnemyCount} required enemy-state slots across the active roster.\n- Remaining runtime gap: ${uniqueRuntimeMissingStates.join(', ') || 'none'}. This stays optional polish, not a blocker for the readable combat pass.\n- The production tables below still track missing bespoke sheets so future art drops can replace derived runtime fallbacks with authored animation.\n\n## Required hero states\n\n${report.requiredHeroStates.join(', ')}\n\n## Required enemy states\n\n${report.requiredEnemyStates.join(', ')}\n\n## Playable characters\n\n${table(['Character', 'Animated states', 'Covered by stills', 'Missing animated states', 'Next art priority'], heroRows)}\n\n## Enemies\n\n${table(['Enemy ID', 'Title', 'Production animated states', 'Runtime-derived readability states', 'Missing production states', 'Still missing in runtime'], enemyRows)}\n\n## Recommendations\n\n${report.recommendations.map((item) => `- ${item}`).join('\n')}\n\n## Production note\n\nDo not fill these gaps with low-quality placeholder animation in the shipped game. Use this report as the asset brief for Aseprite/LibreSprite slicing, sprite-sheet cleanup, and future art drops.\n`;

writeFileSync(jsonPath, `${JSON.stringify(enhancedReport, null, 2)}\n`);
writeFileSync(mdPath, markdown);

console.log('Animation coverage report written:');
console.log(`- ${jsonPath}`);
console.log(`- ${mdPath}`);
console.log(`Missing animated hero states: ${missingHeroCount}`);
console.log(`Missing production enemy states: ${missingEnemyCount}`);
console.log(`Runtime-derived enemy readability states: ${runtimeDerivedEnemyCount}`);
console.log(`Still missing in runtime: ${runtimeMissingEnemyCount}`);

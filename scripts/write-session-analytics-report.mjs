import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildSessionAnalyticsReport, buildSessionBalanceReportMarkdown } from '../apps/portal/src/session-analytics.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputDir = join(repoRoot, 'docs', 'game-design');
mkdirSync(outputDir, { recursive: true });

const sampleSessions = [
  {
    gameId: 'lester-blaster',
    gameTitle: 'Hard Money Heroes',
    mode: 'paid',
    wallet: '0x1000000000000000000000000000000000000001',
    urlSessionId: 'game-session-000000201',
    score: 3800,
    syncedAt: '2026-07-03T09:00:00.000Z',
    runStats: { elapsedSeconds: 252, kills: 30, maxCombo: 7, stageIndexReached: 6, collectedPowerUps: ['shield', 'cache'] },
    settlement: { primaryTxHash: '0x' + '1'.repeat(64) },
  },
  {
    gameId: 'lester-blaster',
    gameTitle: 'Hard Money Heroes',
    mode: 'paid',
    wallet: '0x1000000000000000000000000000000000000002',
    urlSessionId: 'game-session-000000202',
    score: 6900,
    syncedAt: '2026-07-03T09:12:00.000Z',
    runStats: { elapsedSeconds: 388, kills: 49, maxCombo: 12, stageIndexReached: 9, collectedPowerUps: ['shield', 'cache', 'heart'] },
  },
  {
    gameId: 'lester-blaster',
    gameTitle: 'Hard Money Heroes',
    mode: 'paid',
    wallet: '0x1000000000000000000000000000000000000003',
    urlSessionId: 'game-session-000000203',
    score: 12500,
    syncedAt: '2026-07-03T09:28:00.000Z',
    runStats: { elapsedSeconds: 910, kills: 141, maxCombo: 26, stageIndexReached: 13, bossId: 'rug-pull-tank', collectedPowerUps: ['shield', 'cache', 'magnet', 'heart', 'damage'] },
    settlement: { primaryTxHash: '0x' + '2'.repeat(64) },
  },
  {
    gameId: 'chikun',
    gameTitle: "Chikun's Escape",
    mode: 'paid',
    wallet: '0x1000000000000000000000000000000000000004',
    urlSessionId: 'game-session-000000204',
    score: 740,
    syncedAt: '2026-07-03T09:31:00.000Z',
    runStats: { elapsedSeconds: 72, survivalTime: 72, coinsCollected: 11, maxCombo: 4 },
  },
  {
    gameId: 'chikun',
    gameTitle: "Chikun's Escape",
    mode: 'paid',
    wallet: '0x1000000000000000000000000000000000000005',
    urlSessionId: 'game-session-000000205',
    score: 1180,
    syncedAt: '2026-07-03T09:35:00.000Z',
    runStats: { elapsedSeconds: 105, survivalTime: 105, coinsCollected: 21, maxCombo: 7 },
  },
];

const report = buildSessionAnalyticsReport(sampleSessions, {
  generatedAt: '2026-07-03T12:00:00.000Z',
  source: 'deterministic-local-prototype-sessions',
});
const jsonPath = join(outputDir, 'lesters-arcade-session-analytics-report.json');
const mdPath = join(outputDir, 'lesters-arcade-session-analytics-report.md');
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(mdPath, buildSessionBalanceReportMarkdown(report));
console.log('Session analytics report written:');
console.log(`- ${jsonPath}`);
console.log(`- ${mdPath}`);

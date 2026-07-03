import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import {
  buildSessionAnalyticsReport,
  buildSessionBalanceReportMarkdown,
} from '../apps/portal/src/session-analytics.mjs';

const SESSIONS = [
  {
    gameId: 'lester-blaster',
    gameTitle: 'Hard Money Heroes',
    mode: 'paid',
    wallet: '0x' + '1'.repeat(40),
    score: 4200,
    syncedAt: '2026-07-03T10:00:00.000Z',
    runStats: { elapsedSeconds: 240, kills: 32, maxCombo: 9, stageIndexReached: 7, collectedPowerUps: ['shield', 'cache'] },
    settlement: { primaryTxHash: '0x' + 'a'.repeat(64) },
  },
  {
    gameId: 'lester-blaster',
    gameTitle: 'Hard Money Heroes',
    mode: 'paid',
    wallet: '0x' + '2'.repeat(40),
    score: 9100,
    syncedAt: '2026-07-03T10:10:00.000Z',
    runStats: { elapsedSeconds: 620, kills: 88, maxCombo: 22, stageIndexReached: 13, collectedPowerUps: ['shield', 'cache', 'magnet', 'heart'] },
  },
  {
    gameId: 'chikun',
    gameTitle: "Chikun's Escape",
    mode: 'paid',
    wallet: '0x' + '3'.repeat(40),
    score: 875,
    syncedAt: '2026-07-03T10:12:00.000Z',
    runStats: { elapsedSeconds: 85, survivalTime: 85, coinsCollected: 14, maxCombo: 5 },
  },
];

test('WO-59 session analytics pipeline aggregates runs, percentiles, trust, and balance flags', () => {
  const report = buildSessionAnalyticsReport(SESSIONS, { generatedAt: '2026-07-03T12:00:00.000Z' });

  assert.equal(report.generatedAt, '2026-07-03T12:00:00.000Z');
  assert.equal(report.summary.totalRuns, 3);
  assert.equal(report.summary.rankedRuns, 3);
  assert.equal(report.summary.settledRuns, 1);
  assert.equal(report.summary.uniqueWallets, 3);
  assert.equal(report.games['lester-blaster'].runs, 2);
  assert.equal(report.games['lester-blaster'].score.p50, 6650);
  assert.equal(report.games['lester-blaster'].survivalSeconds.p90, 582);
  assert.equal(report.games.chikun.score.max, 875);
  assert.equal(report.balanceFlags.some((flag) => flag.id === 'hmh-master-run-window'), true);
  assert.equal(report.balanceFlags.some((flag) => flag.severity === 'info'), true);
});

test('WO-59 balance report markdown and docs artifact are generated', () => {
  const report = buildSessionAnalyticsReport(SESSIONS, { generatedAt: '2026-07-03T12:00:00.000Z' });
  const markdown = buildSessionBalanceReportMarkdown(report);
  assert.match(markdown, /# Lester's Arcade Session Analytics Balance Report/);
  assert.match(markdown, /Hard Money Heroes/);
  assert.match(markdown, /p50 score/);
  assert.match(markdown, /Action items/);

  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(packageJson.scripts['design:session-analytics'], 'node scripts/write-session-analytics-report.mjs');
  assert.equal(existsSync(new URL('../docs/game-design/lesters-arcade-session-analytics-report.md', import.meta.url)), true);
  assert.equal(existsSync(new URL('../docs/game-design/lesters-arcade-session-analytics-report.json', import.meta.url)), true);
});

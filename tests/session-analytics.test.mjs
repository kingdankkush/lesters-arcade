import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import {
  buildHmhPerformanceCertificate,
  buildSessionAnalyticsReport,
  buildSessionBalanceReportMarkdown,
} from '../apps/portal/src/session-analytics.mjs';

test('HMH browser performance certificate tracks frame tails and combat occupancy without hiding cap violations', () => {
  const baseTelemetry = {
    p95RenderMs: 9.5,
    p95UpdateMs: 4.5,
    occupancy: { activeEnemies: 40, playerProjectiles: 32, enemyProjectiles: 48, particles: 120, vfxParticles: 24, floatingTexts: 42, xpGems: 90, powerUps: 8 },
    budgets: { maxEnemiesOnMap: 55, enemyProjectileCap: 72, maxParticles: 150, maxFloatingTexts: 64, maxAudioVoices: 32 },
    animation: { visibleEnemies: 40, animatedEnemies: 32, maxAnimatedEnemies: 36 },
    audio: { activeVoices: 18, peakVoices: 24, droppedVoices: 2, stolenVoices: 3, familyCounts: { weapon: 12, impact: 6 }, familyCaps: { weapon: 16, impact: 14 } },
    simulation: { lastSteps: 1, peakSteps: 2, maxStepsPerFrame: 2, observedWallClockMs: 10000, droppedSimulationMs: 100, catchUpFrames: 4 },
    adaptivePerformance: { tier: 1, reason: 'boss-swarm-preemptive' },
  };
  const certificate = buildHmhPerformanceCertificate([
    { frameDeltasMs: [15, 16, 17, 18], performance: baseTelemetry },
    { frameDeltasMs: [16, 17, 18, 19], performance: { ...baseTelemetry, occupancy: { ...baseTelemetry.occupancy, activeEnemies: 44, enemyProjectiles: 61 } } },
  ]);
  assert.equal(certificate.status, 'PASS');
  assert.equal(certificate.frameSampleCount, 8);
  assert.equal(certificate.frameTimeMs.p50, 17);
  assert.equal(certificate.frameTimeMs.p95, 18.65);
  assert.equal(certificate.frameTimeMs.p99, 18.93);
  assert.equal(certificate.frameTimeMs.max, 19);
  assert.equal(certificate.renderTimeMs.p95, 9.5);
  assert.equal(certificate.updateTimeMs.p95, 4.5);
  assert.equal(certificate.maxOccupancy.activeEnemies, 44);
  assert.equal(certificate.maxOccupancy.enemyProjectiles, 61);
  assert.equal(certificate.maxAnimation.animatedEnemies, 32);
  assert.equal(certificate.maxAudio.activeVoices, 18);
  assert.equal(certificate.maxAudio.peakVoices, 24);
  assert.equal(certificate.maxAudio.droppedVoices, 2);
  assert.equal(certificate.maxAudio.familyCounts.weapon, 12);
  assert.equal(certificate.maxSimulation.peakSteps, 2);
  assert.equal(certificate.maxSimulation.droppedSimulationMs, 100);
  assert.equal(certificate.maxSimulation.droppedSimulationRatio, 0.01);
  assert.equal(certificate.maxAdaptiveTier, 1);
  assert.equal(certificate.capViolationCount, 0);

  const failed = buildHmhPerformanceCertificate([
    { frameDeltasMs: [16, 21, 29, 35], performance: { ...baseTelemetry, occupancy: { ...baseTelemetry.occupancy, particles: 151 } } },
  ]);
  assert.equal(failed.status, 'FAIL');
  assert.equal(failed.capViolationCount, 1);
  assert.ok(failed.failures.includes('particle-cap'));
  assert.ok(failed.failures.includes('p95-frame-time'));
  assert.ok(failed.failures.includes('p99-frame-time'));

  const audioFailed = buildHmhPerformanceCertificate([
    { frameDeltasMs: [16, 17], performance: { ...baseTelemetry, audio: { ...baseTelemetry.audio, activeVoices: 33, familyCounts: { weapon: 17 } } } },
  ]);
  assert.equal(audioFailed.status, 'FAIL');
  assert.ok(audioFailed.failures.includes('audio-voice-cap'));
  assert.ok(audioFailed.failures.includes('audio-family-cap:weapon'));

  const simulationFailed = buildHmhPerformanceCertificate([
    { frameDeltasMs: [16, 17], performance: { ...baseTelemetry, simulation: { ...baseTelemetry.simulation, droppedSimulationMs: 2501 } } },
  ]);
  assert.equal(simulationFailed.status, 'FAIL');
  assert.ok(simulationFailed.failures.includes('simulation-time-dropped'));

  const simulationRatioFailed = buildHmhPerformanceCertificate([
    { frameDeltasMs: [16, 17], performance: { ...baseTelemetry, simulation: { ...baseTelemetry.simulation, observedWallClockMs: 10000, droppedSimulationMs: 500 } } },
  ]);
  assert.equal(simulationRatioFailed.status, 'FAIL');
  assert.ok(simulationRatioFailed.failures.includes('simulation-time-dropped-ratio'));

  const startupDiluted = buildHmhPerformanceCertificate([
    { frameDeltasMs: [16], performance: { ...baseTelemetry, simulation: { ...baseTelemetry.simulation, observedWallClockMs: 10000, droppedSimulationMs: 600 } } },
    { frameDeltasMs: [16], performance: { ...baseTelemetry, simulation: { ...baseTelemetry.simulation, observedWallClockMs: 100000, droppedSimulationMs: 1000 } } },
  ]);
  assert.equal(startupDiluted.status, 'PASS');
  assert.equal(startupDiluted.maxSimulation.droppedSimulationRatio, 0.01);

  const perRunRatioFailed = buildHmhPerformanceCertificate([
    { frameDeltasMs: [16], performance: { ...baseTelemetry, simulation: { ...baseTelemetry.simulation, observedWallClockMs: 50000, droppedSimulationMs: 1500 } } },
    { frameDeltasMs: [16], performance: { ...baseTelemetry, simulation: { ...baseTelemetry.simulation, observedWallClockMs: 20000, droppedSimulationMs: 400 } } },
  ]);
  assert.equal(perRunRatioFailed.status, 'FAIL');
  assert.equal(perRunRatioFailed.maxSimulation.droppedSimulationRatio, 0.03);
  assert.ok(perRunRatioFailed.failures.includes('simulation-time-dropped-ratio'));
});

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

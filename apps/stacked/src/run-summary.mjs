import { zoneForTick } from '../../portal/src/stacked-sim.mjs';
export function buildStackedRunSummary(s, mode, inputDevice = 'keyboard', counters = {}) {
  return {
    schemaVersion: 1,
    identity: { seed: s.seed, buildHash: s.buildHash, mode, seasonId: s.seasonId, terminalReason: s.terminalReason, startTick: 0, endTick: s.tick },
    totals: { score: s.score, survivalTicks: s.tick, elapsedMs: Math.round(s.tick * 50 / 3), level: s.level, zoneReached: zoneForTick(s.tick) + 1, pieces: s.piecesSpawned, linesCleared: s.lines },
    clears: { singles: s.singles, doubles: s.doubles, triples: s.triples, quadClears: s.quadClears, perfectClears: s.perfectClears, allClearStreakMax: counters.allClearStreakMax ?? 0 },
    technique: { spins: s.spinsMini + s.spinsFull, spinClears: counters.spinClears ?? 0, maxCombo: s.maxCombo, maxBackToBack: s.maxBackToBack, holds: s.holdsUsed, hardDrops: counters.hardDrops ?? 0, softDropCells: s.softDropCells },
    pressure: { garbageRowsReceived: s.garbageRowsReceived, garbageRowsCleared: s.garbageRowsCleared, maxStackHeight: s.maxStackHeight, topOutTick: ['block-out', 'lock-out', 'garbage-out'].includes(s.terminalReason) ? s.tick : 0 },
    handling: { dasTicks: 8, arrTicks: 2, dcdTicks: 0, inputDevice },
    versus: { wins: 0, losses: 0, draws: 0, garbageSent: 0, garbageReceived: 0, kos: 0, roundsPlayed: 0 },
  };
}

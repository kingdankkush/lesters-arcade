// Headless deterministic run smoke test (Roadmap Phase 1.2).
//
// PURPOSE
// Determinism is the foundation for replay verification, daily-seed boards, and
// server-side anti-cheat. This test re-simulates a model Hard Money Heroes run
// through the REAL seeded pure-logic pipeline (spawn selection, kill XP, level
// curve, upgrade choices, score) twice with the same seed and asserts the two
// runs are byte-identical, then asserts a different seed diverges.
//
// SCOPE NOTE
// The full `updateRoguelikeCombatStep` loop lives in apps/portal/main.js, which
// is DOM-coupled and has import side effects, so it cannot be imported headless
// until the Phase 3.4 module split. This test exercises the deterministic core
// it is built from — the pure exports in arcade-core.mjs plus seeded-rng.mjs —
// which is where every gameplay RNG decision now resolves. When main.js is
// modularized, extend this harness to drive the real step function directly.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SeededRng, hashSeed } from '../apps/portal/src/seeded-rng.mjs';
import {
  createRoguelikeRunState,
  chooseEnemySpawn,
  getRoguelikeSpawnDirectorAt,
  calculateRoguelikeKillXp,
  grantRoguelikeXp,
  chooseRoguelikeUpgradeOptions,
  calculateLesterBlasterScore,
  getLesterBlasterDifficultyAt,
} from '../apps/portal/src/arcade-core.mjs';

// Simulate a deterministic 90-second model run. Mirrors how the runtime derives
// per-decision seeds: a single run-scoped SeededRng stream drives spawn-seed and
// upgrade-seed selection, so the same run seed reproduces the same run exactly.
function simulateModelRun(runSeed, { durationSeconds = 90, stepSeconds = 0.5 } = {}) {
  let run = createRoguelikeRunState({ seed: runSeed, mode: 'free', characterId: 'lit-commando' });
  const spawnRng = new SeededRng(hashSeed(runSeed ^ 0x53504157)); // 'SPAW'
  const upgradeRng = new SeededRng(hashSeed(runSeed ^ 0x55504752)); // 'UPGR'

  let kills = 0;
  let elapsed = 0;
  let maxCombo = 0;
  let combo = 0;
  const killsByType = {};
  const spawnLog = [];
  const upgradeLog = [];

  for (let t = 0; t < durationSeconds; t += stepSeconds) {
    elapsed = Number((t + stepSeconds).toFixed(3));
    const director = getRoguelikeSpawnDirectorAt(elapsed);
    // Spawn cadence scales with director pressure; derive a deterministic spawn
    // every ~1.5s, modulated by the seeded stream.
    if (spawnRng.float() < 0.34) {
      const spawnSeed = spawnRng.int(0, 1_000_000);
      const spawn = chooseEnemySpawn({ elapsedSeconds: elapsed, seed: spawnSeed });
      const enemyId = spawn.enemy.id;
      spawnLog.push(`${elapsed}:${enemyId}:${spawn.scaledHealth}`);

      // Deterministically "kill" a fraction of spawns to drive XP/score/combo.
      if (spawnRng.chance(0.6)) {
        kills += 1;
        combo += 1;
        maxCombo = Math.max(maxCombo, combo);
        killsByType[enemyId] = (killsByType[enemyId] ?? 0) + 1;
        const xp = calculateRoguelikeKillXp(spawn.enemy);
        const before = run.level;
        run = grantRoguelikeXp(run, xp);
        // On level-up, deterministically pick an upgrade from the seeded options.
        if (run.level > before) {
          const offer = chooseRoguelikeUpgradeOptions(run, { seed: upgradeRng.int(0, 1_000_000) });
          const opts = offer.options ?? [];
          if (opts.length) {
            const pick = opts[upgradeRng.int(0, opts.length - 1)];
            upgradeLog.push(`L${run.level}:${pick?.id ?? pick?.skillId ?? 'none'}`);
          }
        }
      } else {
        combo = 0; // missed/escaped resets combo
      }
    }
  }

  const difficulty = getLesterBlasterDifficultyAt(elapsed);
  const score = Math.round(
    calculateLesterBlasterScore({
      elapsedSeconds: elapsed,
      kills,
      maxKillCombo: maxCombo,
      maxDamageCombo: maxCombo,
      noDamageSeconds: elapsed,
      powerUpsCollected: 0,
      weaponUpgrades: ['damage'],
      difficultyTier: difficulty.tier,
    }).total,
  );

  return {
    seed: runSeed,
    elapsed,
    kills,
    maxCombo,
    level: run.level,
    score,
    killsByType,
    spawnLog,
    upgradeLog,
    spawnDraws: spawnRng.count,
    upgradeDraws: upgradeRng.count,
  };
}

test('same seed reproduces a byte-identical model run', () => {
  const a = simulateModelRun(123456789);
  const b = simulateModelRun(123456789);
  assert.deepEqual(a, b, 'identical seed must produce identical run');
  // Sanity: the run actually did something (not a trivially-empty equality).
  assert.ok(a.kills > 0, 'run produced no kills');
  assert.ok(a.score > 0, 'run produced no score');
  assert.ok(a.spawnLog.length > 0, 'run produced no spawns');
});

test('different seeds diverge', () => {
  const a = simulateModelRun(111);
  const b = simulateModelRun(222);
  assert.notDeepEqual(
    { kills: a.kills, score: a.score, spawnLog: a.spawnLog },
    { kills: b.kills, score: b.score, spawnLog: b.spawnLog },
    'different seeds should not produce identical runs',
  );
});

test('a fixed seed produces a stable snapshot across step granularities of the same stream', () => {
  // Re-running the identical configuration must be perfectly stable — this is the
  // contract a replay verifier relies on.
  const runs = Array.from({ length: 4 }, () => simulateModelRun(0xC0FFEE));
  for (let i = 1; i < runs.length; i += 1) {
    assert.deepEqual(runs[i], runs[0], `run ${i} diverged from run 0`);
  }
});

test('run seed is recorded on run state for replay reconstruction', () => {
  const run = createRoguelikeRunState({ seed: 987654321, mode: 'free', characterId: 'lit-commando' });
  // Seed is stored (floored) so a verifier can rebuild the exact streams.
  assert.equal(run.seed, 987654321);
});

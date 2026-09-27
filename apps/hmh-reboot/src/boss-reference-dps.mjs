// Boss HP reference damage per second (Level 1 design package 4.1).
//
// A boss's HP is frozen when the player starts the fight:
// round(targetSeconds x referenceDps(level at trigger)), through
// sdk/hmh-run-contract-v7.mjs hmhV7BossHp. referenceDps(L) is the Pistol's
// sustained single-target DPS a typical player has at level L: the median,
// over every run of scripts/hmh-progression-model.mjs against 1.8.1, of the
// weapon-benchmark Pistol DPS with the run's outgoing damage multiplier and
// expected critical hit, measured once the picks of the new level are made.
// The medians are non-decreasing and rounded to 0.1; past the last calibrated
// level (the last one at least half the runs reach) the value holds.
//
// It replaces the package placeholder min(47, 8 + 2.6 x (L - 1)), which no
// capped line can match: 1.8.1 Pistol power grows slowly while level-ups go to
// health, speed and utility, then steeply once the Pistol and critical cards
// stack. The numbers are docs/testing/hmh-progression-baseline-1.8.1.json
// referenceDps.calibration.levels; tests/hmh-progression-model.test.mjs pins
// them to it. Nothing imports this module yet (the boss slice will), so it
// adds nothing to the child's initial bundle.

export const HMH_REFERENCE_DPS = Object.freeze({
  source: 'docs/testing/hmh-progression-baseline-1.8.1.json',
  // Levels 1 to 32.
  levels: Object.freeze([
    6.7, 6.7, 7.1, 7.6, 7.9, 8.1, 8.6, 8.9,
    9.4, 11.1, 11.2, 12.3, 13.5, 15.3, 15.8, 17,
    19, 19.1, 24.3, 27.2, 30.9, 32.2, 33.8, 34.1,
    34.9, 37.1, 40.8, 47.6, 48.6, 59.6, 72.3, 79.6,
  ]),
});

export function referenceDps(level) {
  if (!Number.isInteger(level) || level < 1 || level > 1_000) throw new TypeError('level must be an integer from 1 to 1000');
  const { levels } = HMH_REFERENCE_DPS;
  return levels[Math.min(level, levels.length) - 1];
}

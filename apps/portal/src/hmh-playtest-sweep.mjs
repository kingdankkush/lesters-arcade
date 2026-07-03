export const HMH_PLAYTEST_SCENARIOS = Object.freeze([
  Object.freeze({
    id: 'guest-arcade-entry',
    title: 'Guest enters arcade and browses cabinets',
    priority: 'P0',
    steps: Object.freeze(['Open portal root', 'Enter arcade', 'Select Hard Money Heroes cabinet']),
    expected: Object.freeze(['Cabinet card is reachable', 'No wallet is required for browsing', 'No console-blocking route dead end']),
    automatedEvidence: Object.freeze(['smoke:portal:interactions', 'arcade-router.test.mjs']),
  }),
  Object.freeze({
    id: 'free-mode-ready-gate',
    title: 'Free Mode starts behind READY gate',
    priority: 'P0',
    steps: Object.freeze(['Choose Free Mode', 'Select a starter hero', 'Wait on READY overlay', 'Press Space']),
    expected: Object.freeze(['Canvas is visible before simulation starts', 'Timer and audio stay frozen before READY', 'Run starts after Space/click only']),
    automatedEvidence: Object.freeze(['smoke:portal:interactions', 'arcade-core.test.mjs']),
  }),
  Object.freeze({
    id: 'ranked-submit-path',
    title: 'Ranked run submits only after game over',
    priority: 'P0',
    steps: Object.freeze(['Connect wallet', 'Choose Ranked', 'Finish a run', 'Submit official score']),
    expected: Object.freeze(['No hidden write on exit', 'LitVM testnet language is clear', 'Settlement path uses live submitSession ABI']),
    automatedEvidence: Object.freeze(['contract-abi-alignment.test.mjs', 'smoke:portal:interactions', 'contracts:check']),
  }),
  Object.freeze({
    id: 'level-one-combat-loop',
    title: 'Level 1 combat loop is readable under pressure',
    priority: 'P0',
    steps: Object.freeze(['Move through route', 'Collect XP', 'Pick upgrade', 'Fight mini-boss', 'Fight major boss beat']),
    expected: Object.freeze(['Bounded spawns and AI stay off player', 'Combat feedback is multimodal', 'Boss phases are readable']),
    automatedEvidence: Object.freeze(['hmh-bounded-world-ai.test.mjs', 'hmh-combat-feedback.test.mjs', 'hmh-boss-balance-pass.test.mjs']),
  }),
  Object.freeze({
    id: 'audio-accessibility',
    title: 'Audio, SFX, motion, and flash toggles are safe',
    priority: 'P1',
    steps: Object.freeze(['Toggle SFX/music', 'Enable reduced motion', 'Enable reduced flash', 'Trigger hit, pickup, boss cues']),
    expected: Object.freeze(['SFX cooldowns prevent spam', 'Heavy cues are damped with reduced motion', 'Text/state feedback remains present']),
    automatedEvidence: Object.freeze(['hmh-audio-system.test.mjs', 'hmh-combat-feedback.test.mjs']),
  }),
  Object.freeze({
    id: 'mobile-input-smoke',
    title: 'Mobile/touch input does not dead-end combat',
    priority: 'P1',
    steps: Object.freeze(['Use touch movement', 'Use fire/grenade controls', 'Open pause/settings', 'Exit to arcade']),
    expected: Object.freeze(['Touch controls mirror keyboard intent', 'Open menus capture input', 'Exit path is always visible']),
    automatedEvidence: Object.freeze(['device-model.test.mjs', 'smoke:portal:interactions']),
  }),
]);

export const HMH_BUG_SWEEP_AREAS = Object.freeze([
  Object.freeze({ id: 'route-dead-end', severity: 'blocker', guard: 'arcade-router.test.mjs', status: 'covered' }),
  Object.freeze({ id: 'pre-ready-sim-audio', severity: 'blocker', guard: 'arcade-core.test.mjs + smoke:portal:interactions', status: 'covered' }),
  Object.freeze({ id: 'on-chain-abi-mismatch', severity: 'blocker', guard: 'contract-abi-alignment.test.mjs + contracts:check', status: 'covered' }),
  Object.freeze({ id: 'spawn-on-player', severity: 'major', guard: 'hmh-finite-map-spawn.test.mjs + hmh-bounded-world-ai.test.mjs', status: 'covered' }),
  Object.freeze({ id: 'missing-feedback', severity: 'major', guard: 'hmh-combat-feedback.test.mjs', status: 'covered' }),
  Object.freeze({ id: 'sfx-spam', severity: 'major', guard: 'hmh-audio-system.test.mjs', status: 'covered' }),
  Object.freeze({ id: 'copy-cost-confusion', severity: 'major', guard: 'hmh-copy-sheet.test.mjs', status: 'covered' }),
]);

function freezeRows(rows) {
  return Object.freeze(rows.map((row) => Object.freeze(row)));
}

export function buildStructuredPlaytestSweep({ scenarios = HMH_PLAYTEST_SCENARIOS, bugAreas = HMH_BUG_SWEEP_AREAS } = {}) {
  const scenarioRows = scenarios.map((scenario) => ({
    id: scenario.id,
    title: scenario.title,
    priority: scenario.priority,
    stepCount: scenario.steps.length,
    expectedCount: scenario.expected.length,
    automatedEvidenceCount: scenario.automatedEvidence.length,
    status: scenario.automatedEvidence.length >= 2 ? 'ready-for-human-smoke' : 'needs-evidence',
  }));
  const bugRows = bugAreas.map((area) => ({
    ...area,
    covered: area.status === 'covered' && Boolean(area.guard),
  }));
  const uncovered = bugRows.filter((area) => !area.covered);
  const blockerGaps = bugRows.filter((area) => area.severity === 'blocker' && !area.covered);
  return Object.freeze({
    version: 'wo-34-structured-playtest-v1',
    summary: Object.freeze({
      scenarioCount: scenarioRows.length,
      p0ScenarioCount: scenarioRows.filter((row) => row.priority === 'P0').length,
      bugAreaCount: bugRows.length,
      uncoveredBugAreaCount: uncovered.length,
      blockerGapCount: blockerGaps.length,
      status: uncovered.length === 0 && blockerGaps.length === 0 ? 'PASS' : 'NEEDS_SWEEP',
    }),
    scenarios: freezeRows(scenarioRows),
    bugAreas: freezeRows(bugRows),
    gaps: Object.freeze(uncovered.map((area) => `${area.id} lacks automated evidence`)),
  });
}

export function validateStructuredPlaytestSweep(sweep = buildStructuredPlaytestSweep()) {
  const gaps = [];
  if (sweep.summary.scenarioCount < 6) gaps.push('fewer than six playtest scenarios');
  if (sweep.summary.p0ScenarioCount < 4) gaps.push('fewer than four P0 scenarios');
  if (sweep.summary.blockerGapCount > 0) gaps.push('blocker bug area lacks coverage');
  if (sweep.summary.uncoveredBugAreaCount > 0) gaps.push('some bug areas lack coverage');
  for (const scenario of sweep.scenarios) {
    if (scenario.stepCount < 3) gaps.push(`${scenario.id} has too few steps`);
    if (scenario.automatedEvidenceCount < 2) gaps.push(`${scenario.id} lacks evidence`);
  }
  return Object.freeze({ ok: gaps.length === 0, gaps: Object.freeze(gaps), status: gaps.length === 0 ? 'PASS' : 'FAIL' });
}

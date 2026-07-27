import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildCrowdedCombatPlayerMarkerPlan } from '../apps/portal/src/hmh-combat-feedback.mjs';
import { planHmhFixedStepFrame } from '../apps/portal/src/session-analytics.mjs';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const visualScript = readFileSync(new URL('../scripts/visual-regression.mjs', import.meta.url), 'utf8');
const browserSoakScript = readFileSync(new URL('../scripts/hmh-browser-soak.mjs', import.meta.url), 'utf8');
const combatSoakScript = readFileSync(new URL('../scripts/hmh-reboot-combat-soak.mjs', import.meta.url), 'utf8');
const legacyBrowserSoakScript = readFileSync(new URL('../scripts/hmh-legacy-browser-soak.mjs', import.meta.url), 'utf8');
const mainSource = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');

test('WO-65 visual regression harness is command-wired and captures real HMH canvas frames', () => {
  assert.equal(packageJson.scripts['visual:regression'], 'npm run build && node scripts/visual-regression.mjs');
  assert.equal(packageJson.scripts['visual:accept'], 'npm run build && node scripts/visual-regression.mjs --accept');
  assert.match(visualScript, /remote-debugging-port/);
  assert.match(visualScript, /Page\.captureScreenshot/);
  assert.match(visualScript, /appearDeadline/);
  assert.match(visualScript, /removeDeadline/);
  assert.match(visualScript, /seed-1337-render-anchor/);
  assert.match(visualScript, /seed-1337-live-spawn/);
  assert.match(visualScript, /seed-1337-east-walk/);
  assert.match(visualScript, /seed-1337-ghost-town/);
  assert.match(visualScript, /seed-1337-dry-forest/);
  assert.match(visualScript, /requireWater: true/);
  assert.match(visualScript, /textureKeys\?\.some/);
  assert.doesNotMatch(visualScript, /waterFlowCells > 0/);
  assert.match(visualScript, /seed-1337-pine-creek-bridge/);
  assert.match(visualScript, /seed-1337-west-river-main-bridge/);
  assert.match(visualScript, /seed-1337-east-river-bridge/);
  assert.match(visualScript, /seed-1337-lake-outlet-farm-bridge/);
  assert.match(visualScript, /bridgeStats\?\.bridgeDetailCells > 0/);
  assert.match(visualScript, /seed-1337-frontier-town/);
  assert.match(visualScript, /seed-1337-wrecked-lighthouse/);
  assert.match(visualScript, /seed-1337-boss-yard/);
  assert.match(visualScript, /seed-1337-extraction/);
  assert.match(visualScript, /seed-1337-west-boundary/);
  assert.match(mainSource, /__hmhVisualDebugTeleport/);
  assert.match(mainSource, /__hmhVisualDebugHero/);
  assert.match(mainSource, /__hmhVisualDebugOpenLevelUp/);
  assert.match(visualScript, /level-up-portrait-390x844/);
  assert.match(visualScript, /level-up-landscape-844x390/);
  assert.match(visualScript, /levelUpViewportProbe/);
  assert.match(visualScript, /data\.armed === 'true'/);
  assert.match(visualScript, /heroReadyDeadline/);
  assert.match(visualScript, /heroVisual\?\.ready/);
  const obstacleRenderer = mainSource.slice(
    mainSource.indexOf('function buildObstacleRenderEntries'),
    mainSource.indexOf('function currentLevelOneExplorationLayer'),
  );
  assert.doesNotMatch(obstacleRenderer, /if \(!worldProps\.length\) return \[\]/);
  assert.match(visualScript, /readyOverlay\.click\(\)/);
  assert.doesNotMatch(visualScript, /readyOverlay\.style\.display\s*=\s*['"]none['"]/);
  assert.match(visualScript, /simulationAdvanced/);
  assert.match(visualScript, /LIVE_WALK_REAL_TIME_MS = 700/);
  assert.doesNotMatch(visualScript, /Page\.setWebLifecycleState/);
  assert.doesNotMatch(visualScript, /Emulation\.setScriptExecutionDisabled/);
  assert.doesNotMatch(visualScript, /Emulation\.setVirtualTimePolicy/);
  assert.doesNotMatch(visualScript, /combatPauseButton/);
  assert.match(visualScript, /Input\.dispatchKeyEvent/);
  assert.match(visualScript, /combatCanvas['"]\)\?\.scrollIntoView/);
  assert.match(visualScript, /debugOverlay\.hidden = true/);
  assert.match(visualScript, /Date\.now = \(\) => 1337/);
  assert.match(visualScript, /comparePngWithPillow/);
  assert.match(visualScript, /visualDiffPasses/);
  assert.match(visualScript, /writeEvidenceCapture/);
  assert.match(visualScript, /activeEvidenceDistinct/);
  assert.doesNotMatch(visualScript, /liveVisualDiffPasses/);
  assert.doesNotMatch(visualScript, /LIVE_VISUAL_MAX_CHANGED_PCT/);
  assert.doesNotMatch(visualScript, /LIVE_VISUAL_MAX_MEAN_ABS_PER_CHANNEL/);
  assert.doesNotMatch(visualScript, /changedPct <= 75/);
  assert.doesNotMatch(visualScript, /meanAbsPerChannel <= 18/);
  assert.match(visualScript, /changedPct <= 1/);
  assert.match(visualScript, /meanAbsPerChannel <= 0\.25/);
  assert.match(visualScript, /WO-65 smoke captures live canvas frames/);
  assert.match(visualScript, /docs\/testing\/VISUAL_BASELINES/);
});

test('browser soak targets the current Pixi reboot and proves authored runtime time advances', () => {
  assert.equal(packageJson.scripts['test:soak'], 'npm run build && node scripts/hmh-browser-soak.mjs --profile=desktop --minutes=30');
  assert.equal(packageJson.scripts['test:soak:mobile'], 'npm run build && node scripts/hmh-browser-soak.mjs --profile=mobile --minutes=30');
  assert.equal(packageJson.scripts['test:soak:legacy'], 'npm run build && node scripts/hmh-legacy-browser-soak.mjs --minutes=30');
  assert.match(legacyBrowserSoakScript, /hmh-legacy-browser-soak\.json/);
  assert.match(legacyBrowserSoakScript, /legacy-soak/);
  assert.doesNotMatch(legacyBrowserSoakScript, /'hmh-browser-soak\.json'/);
  assert.match(browserSoakScript, /hmh-reboot\/\?\$\{REBOOT_QUERY\}/);
  assert.match(browserSoakScript, /#hmhRebootStage/);
  assert.match(browserSoakScript, /acquireRunLock/);
  assert.match(browserSoakScript, /HMH reboot soak already running as PID/);
  assert.match(browserSoakScript, /dataset\.simulationTick/);
  assert.match(browserSoakScript, /production-blender-atlas-v1/);
  assert.match(browserSoakScript, /production-roster-atlas-v1/);
  assert.match(browserSoakScript, /dataset\.authoredPropStatus === 'ready'/);
  assert.match(browserSoakScript, /frameDeltasMs/);
  assert.match(browserSoakScript, /minimumTickAdvance/);
  assert.match(browserSoakScript, /#hmhRestartButton/);
  assert.match(browserSoakScript, /cumulativeTickAdvance/);
  assert.match(browserSoakScript, /runRestarts/);
  assert.match(browserSoakScript, /force-restart-after-seconds/);
  assert.match(browserSoakScript, /heapGrowthBytes/);
  assert.match(browserSoakScript, /heapAfterGc/);
  assert.match(browserSoakScript, /steadyStateRetainedHeap/);
  assert.match(browserSoakScript, /retainedHeapGrowthBytes/);
  assert.match(browserSoakScript, /gcPauseMs/);
  assert.match(browserSoakScript, /consoleIssues/);
  assert.match(browserSoakScript, /networkIssues/);
  assert.match(browserSoakScript, /runtime: 'hmh-reboot'/);
  assert.match(browserSoakScript, /--profile=/);
  assert.match(browserSoakScript, /profile === 'mobile'/);
  assert.match(browserSoakScript, /Emulation\.setTouchEmulationEnabled/);
  assert.match(browserSoakScript, /mobile touch chrome became unavailable/);
  assert.match(browserSoakScript, /hmh-browser-soak\$\{reportSuffix\}\.json/);
  assert.match(combatSoakScript, /handCharges:\s*500,\s*maxHandCharges:\s*500/);
  assert.doesNotMatch(browserSoakScript, /data-stat="survived"/);
  assert.doesNotMatch(browserSoakScript, /__hmhSoakStressBossSwarm/);
});

test('crowded boss combat keeps a bounded player locator above particles', () => {
  const quiet = buildCrowdedCombatPlayerMarkerPlan({ active: true, roguelikeRun: true, visibleEnemies: 17, bossEnemies: 0 });
  assert.equal(quiet.visible, false);
  const crowded = buildCrowdedCombatPlayerMarkerPlan({ active: true, roguelikeRun: true, visibleEnemies: 18, bossEnemies: 0, playerX: 100.4, playerY: 200.4, frame: 10 });
  assert.equal(crowded.visible, true);
  assert.equal(crowded.x, 100);
  assert.equal(crowded.y, 122);
  assert.ok(crowded.pulse >= 0 && crowded.pulse <= 3);
  const bossOverride = buildCrowdedCombatPlayerMarkerPlan({ active: true, roguelikeRun: true, visibleEnemies: 1, bossEnemies: 1, reduceMotion: true });
  assert.equal(bossOverride.visible, true);
  assert.equal(bossOverride.pulse, 0);
  assert.equal(buildCrowdedCombatPlayerMarkerPlan({ active: false, roguelikeRun: true, visibleEnemies: 48, bossEnemies: 1 }).visible, false);
  const particleDraw = mainSource.indexOf('  drawParticles(ctx);');
  const markerDraw = mainSource.indexOf('  drawCrowdedCombatPlayerMarker(ctx);');
  const floatingTextDraw = mainSource.indexOf('  drawFloatingTexts(ctx);');
  assert.ok(particleDraw >= 0 && markerDraw > particleDraw, 'player locator must render after particles');
  assert.ok(floatingTextDraw > markerDraw, 'player locator must remain below textual UI');
});

test('fixed-step catch-up is bounded and telemetry records discarded simulation time', () => {
  const stepMs = 1000 / 60;
  const normal = planHmhFixedStepFrame({ rawDeltaMs: stepMs, accumulatorMs: 0, fixedStepMs: stepMs, maxSteps: 2 });
  assert.equal(normal.steps, 1);
  assert.equal(normal.droppedSimulationMs, 0);
  assert.ok(normal.accumulatorMs < 0.000001);

  const stalled = planHmhFixedStepFrame({ rawDeltaMs: 200, accumulatorMs: 0, fixedStepMs: stepMs, maxSteps: 2, maxFrameDeltaMs: 66 });
  assert.equal(stalled.steps, 2);
  assert.equal(stalled.deltaMs, 66);
  assert.ok(Math.abs(stalled.droppedSimulationMs - (200 - stepMs * 2)) < 0.000001);
  assert.ok(stalled.accumulatorMs < 0.000001);

  const backlog = planHmhFixedStepFrame({ rawDeltaMs: 20, accumulatorMs: 20, fixedStepMs: stepMs, maxSteps: 2, maxFrameDeltaMs: 66 });
  assert.equal(backlog.steps, 2);
  assert.ok(Math.abs(backlog.droppedSimulationMs - (40 - stepMs * 2)) < 0.000001);
  assert.ok(backlog.accumulatorMs < 0.000001);
});

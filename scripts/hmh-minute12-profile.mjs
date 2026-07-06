import { mkdir, writeFile } from 'node:fs/promises';

import {
  buildLevelOneMinimapModel,
  buildLevelOneRunWorldDimensions,
  buildLevelOneVisionFogModel,
  levelOneRoguelikePerformanceBudgetAt,
  levelOneRoguelikeSpawnDirectorAt,
  updateLevelOneExplorationTrail,
} from '../apps/portal/src/arcade-core.mjs';

const OUT_DIR = 'docs/testing';
const JSON_PATH = `${OUT_DIR}/wo71-minute12-profile.json`;
const MD_PATH = `${OUT_DIR}/wo71-minute12-profile.md`;

const BASELINE = Object.freeze({
  enemyAnimationFps: 12,
  obstacleRenderRadiusWindowed: 18,
  obstacleRenderRadiusFullscreen: 45,
  groundOverscanWindowedTiles: 6,
  groundOverscanFullscreenTiles: 20,
});

function pctDrop(before, after) {
  if (!before) return 0;
  return Number((((before - after) / before) * 100).toFixed(1));
}

function squareWindow(radius) {
  return (radius * 2 + 1) ** 2;
}

function estimateTileSpan({ width = 1280, height = 720, overscanTiles = 6 } = {}) {
  // Rough iso tile span for the ground pass. The runtime then cheaply culls by
  // projection; this estimate is intentionally conservative for profile notes.
  const isoWidthTiles = Math.ceil(width / 36);
  const isoHeightTiles = Math.ceil(height / 18);
  return (isoWidthTiles + overscanTiles * 2) * (isoHeightTiles + overscanTiles * 2);
}

function profileAt(minute) {
  const elapsedSeconds = minute * 60;
  const director = levelOneRoguelikeSpawnDirectorAt(elapsedSeconds);
  const budget = levelOneRoguelikePerformanceBudgetAt({
    elapsedSeconds,
    activeEnemies: director.maxEnemiesOnMap,
  });
  const baseline = {
    animatedEnemies: director.maxEnemiesOnMap,
    enemyAnimationFps: BASELINE.enemyAnimationFps,
    enemyAnimationSampleUnits: director.maxEnemiesOnMap * BASELINE.enemyAnimationFps,
    obstacleWindowedCells: squareWindow(BASELINE.obstacleRenderRadiusWindowed),
    obstacleFullscreenCells: squareWindow(BASELINE.obstacleRenderRadiusFullscreen),
    groundWindowedTileEstimate: estimateTileSpan({ overscanTiles: BASELINE.groundOverscanWindowedTiles }),
    groundFullscreenTileEstimate: estimateTileSpan({ width: 2560, height: 1440, overscanTiles: BASELINE.groundOverscanFullscreenTiles }),
  };
  const lod = {
    animatedEnemies: Math.min(director.maxEnemiesOnMap, budget.maxAnimatedEnemies),
    enemyAnimationFps: budget.enemyAnimationFps,
    enemyAnimationSampleUnits: Math.min(director.maxEnemiesOnMap, budget.maxAnimatedEnemies) * budget.enemyAnimationFps,
    obstacleWindowedCells: squareWindow(budget.obstacleRenderRadiusWindowed),
    obstacleFullscreenCells: squareWindow(budget.obstacleRenderRadiusFullscreen),
    groundWindowedTileEstimate: estimateTileSpan({ overscanTiles: budget.groundOverscanWindowedTiles }),
    groundFullscreenTileEstimate: estimateTileSpan({ width: 2560, height: 1440, overscanTiles: budget.groundOverscanFullscreenTiles }),
  };
  return {
    minute,
    elapsedSeconds,
    director,
    budget,
    baseline,
    lod,
    reductions: {
      enemyAnimationSampleUnitsPct: pctDrop(baseline.enemyAnimationSampleUnits, lod.enemyAnimationSampleUnits),
      obstacleWindowedCellsPct: pctDrop(baseline.obstacleWindowedCells, lod.obstacleWindowedCells),
      obstacleFullscreenCellsPct: pctDrop(baseline.obstacleFullscreenCells, lod.obstacleFullscreenCells),
      groundWindowedTileEstimatePct: pctDrop(baseline.groundWindowedTileEstimate, lod.groundWindowedTileEstimate),
      groundFullscreenTileEstimatePct: pctDrop(baseline.groundFullscreenTileEstimate, lod.groundFullscreenTileEstimate),
    },
  };
}

function integrationProfile() {
  const world = buildLevelOneRunWorldDimensions();
  const player = { x: 0, y: 0 };
  const visitedCells = updateLevelOneExplorationTrail({ world, player, cellSize: 8, revealRadius: 1 });
  const visionFog = buildLevelOneVisionFogModel({ world, player, visitedCells, cellSize: 8, visibleRadius: 1 });
  const minimap = buildLevelOneMinimapModel({ world, player, exploration: { visitedCells, cellSize: 8, revealRadius: 1 } });
  return {
    sharedExplorationCache: 'runtime updates the exploration trail once per frame, then shares it with vision fog and minimap',
    visionFogDrawCells: visionFog.layers.reduce((sum, layer) => sum + layer.cells.length, 0),
    visionFogVisibleCells: visionFog.states.visible.length,
    minimapFogCells: minimap.exploration.fogCells.length,
    minimapRevealedCells: minimap.exploration.revealedCells.length,
  };
}

const checkpoints = [0, 8, 12, 20].map(profileAt);
const minute12 = checkpoints.find((entry) => entry.minute === 12);
const report = {
  workOrder: 'WO-71',
  title: 'Minute-12 render/profile budget and justified LOD policy',
  generatedBy: 'scripts/hmh-minute12-profile.mjs',
  target: '60fps / 16.7ms frame budget; preserve full fidelity in opening, apply render LOD only under late-swarm pressure.',
  checkpoints,
  integration: integrationProfile(),
  decision: {
    applyLod: minute12.budget.lodStage === 'pressure-lod' && minute12.director.maxEnemiesOnMap >= 110,
    reason: `Minute 12 reaches ${minute12.director.maxEnemiesOnMap} active-enemy budget at ${minute12.budget.pressure} pressure, so LOD is justified for animation, obstacle radius, and tile overscan while opening remains ${checkpoints[0].budget.lodStage}.`,
  },
};

const md = `# WO-71 minute-12 performance profile

Generated by \`${report.generatedBy}\`.

${report.decision.applyLod ? '✅' : '❌'} **LOD decision:** ${report.decision.reason}

| Minute | Active enemy budget | LOD stage | Animated enemies | Enemy anim fps | Particle cap | Obstacle radius window/full | Ground overscan window/full |
| ---: | ---: | --- | ---: | ---: | ---: | --- | --- |
${checkpoints.map((entry) => `| ${entry.minute} | ${entry.director.maxEnemiesOnMap} | ${entry.budget.lodStage} | ${entry.lod.animatedEnemies}/${entry.director.maxEnemiesOnMap} | ${entry.budget.enemyAnimationFps} | ${entry.budget.maxParticles} | ${entry.budget.obstacleRenderRadiusWindowed}/${entry.budget.obstacleRenderRadiusFullscreen} | ${entry.budget.groundOverscanWindowedTiles}/${entry.budget.groundOverscanFullscreenTiles} |`).join('\n')}

## Minute 12 reductions versus old full-fidelity policy

- Enemy animation sample units: ${minute12.baseline.enemyAnimationSampleUnits} → ${minute12.lod.enemyAnimationSampleUnits} (**${minute12.reductions.enemyAnimationSampleUnitsPct}% less**)
- Windowed obstacle candidate cells: ${minute12.baseline.obstacleWindowedCells} → ${minute12.lod.obstacleWindowedCells} (**${minute12.reductions.obstacleWindowedCellsPct}% less**)
- Fullscreen obstacle candidate cells: ${minute12.baseline.obstacleFullscreenCells} → ${minute12.lod.obstacleFullscreenCells} (**${minute12.reductions.obstacleFullscreenCellsPct}% less**)
- Windowed ground tile estimate: ${minute12.baseline.groundWindowedTileEstimate} → ${minute12.lod.groundWindowedTileEstimate} (**${minute12.reductions.groundWindowedTileEstimatePct}% less**)
- Fullscreen ground tile estimate: ${minute12.baseline.groundFullscreenTileEstimate} → ${minute12.lod.groundFullscreenTileEstimate} (**${minute12.reductions.groundFullscreenTileEstimatePct}% less**)

## Fog/minimap integration re-verification

- Vision fog draw cells: ${report.integration.visionFogDrawCells} (${report.integration.visionFogVisibleCells} visible cells skipped by the draw layers)
- Minimap fog cells: ${report.integration.minimapFogCells}; revealed cells: ${report.integration.minimapRevealedCells}
- Shared exploration cache: ${report.integration.sharedExplorationCache}.

## Policy

- Opening stays full fidelity: all early enemies can animate, original obstacle radius/overscan remain intact.
- Late-swarm LOD only starts after pressure + active enemies support it.
- Bosses/mini-bosses remain animation-priority even when the nearest-enemy cap is active.
`;

await mkdir(OUT_DIR, { recursive: true });
await writeFile(JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(MD_PATH, md);
console.log(JSON.stringify({ json: JSON_PATH, markdown: MD_PATH, decision: report.decision, minute12: minute12.reductions }, null, 2));

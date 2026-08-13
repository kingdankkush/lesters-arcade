import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildLoadSpeedReport, HMH_LOAD_SPEED_BUDGETS } from '../scripts/hmh-load-speed-report.mjs';

function repoText(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('WO-36 index boots through optimized dist bundle with first-screen preload hints', () => {
  const index = repoText('apps/portal/index.html');
  assert.equal(index.includes('src="./dist/main.js?v=hmh-aaa-cycle-001"'), true);
  assert.equal(index.includes('rel="modulepreload" href="./dist/main.js?v=hmh-aaa-cycle-001"'), true);
  assert.equal(index.includes('hard-money-heroes-keyart-bg.jpg'), true);
  assert.equal(index.includes('fetchpriority="high"'), true);
  const sw = repoText('apps/portal/sw.js');
  assert.equal(sw.includes("'/dist/main.js'"), true);
  assert.equal(sw.includes('lesters-arcade-v16-hmh-hazard-path'), true);
});

test('WO-36 Vercel build generates the optimized dist bundle before deploy', () => {
  const pkg = JSON.parse(repoText('package.json'));
  assert.equal(pkg.scripts['vercel:build'].includes('npm run build'), true);
});

test('WO-36 production build keeps sourcemaps opt-in instead of default deploy payload', () => {
  const buildScript = repoText('build.mjs');
  assert.equal(buildScript.includes('const wantSourceMap = process.argv.includes(\'--sourcemap\')'), true);
  assert.equal(buildScript.includes('sourcemap: wantSourceMap'), true);
});

test('WO-36 load speed report passes bundle and source-map budgets after build', () => {
  execFileSync(process.execPath, ['build.mjs'], {
    cwd: new URL('..', import.meta.url),
    stdio: 'ignore',
  });
  const report = buildLoadSpeedReport();
  assert.equal(report.summary.status, 'PASS', JSON.stringify(report.checks, null, 2));
  assert.ok(report.metrics.mainBytes <= HMH_LOAD_SPEED_BUDGETS.mainBundleMaxBytes);
  assert.equal(report.metrics.sourceMapCount, 0);
});

test('WO-36 Level 1 prewarm decodes only spawn-near terrain and props', () => {
  const source = repoText('apps/portal/main.js');
  const prewarm = source.slice(source.indexOf('async function prewarmHmhLevelAssets'), source.indexOf('function isLevelOneCuratedRuntime'));
  assert.equal(prewarm.includes('textureKeysNear('), true);
  assert.equal(prewarm.includes('window: 26'), true);
  assert.equal(prewarm.includes('window: 140'), false);
});

test('Level 1 biome loading has no artificial 1.5 second hold or cross-level asset decode', () => {
  const source = repoText('apps/portal/main.js');
  const loading = source.slice(source.indexOf('async function precomputeBiomeWorld'), source.indexOf('// Canonical building/prop set dressing'));
  const minimum = Number(loading.match(/const MIN_LOAD_MS = (\d+)/)?.[1] ?? Number.POSITIVE_INFINITY);
  assert.ok(minimum <= 300, `Level 1 load reveal should add at most 300ms, got ${minimum}ms`);
  assert.equal(loading.includes('for (const manifest of [HMH_LEVEL_ONE_FINAL_PAINT_GROUND'), false, 'startup must not decode every Level 1/2/3 manifest in one loop');
  assert.match(loading, /const isLevelOne = currentCampaignLevel\(\)\.id === DEFAULT_CAMPAIGN_LEVEL_ID/);
  assert.match(loading, /if \(!isLevelOne\)/, 'legacy biome prop warming should be skipped for authored Level 1');
});

test('biome precompute consumes the supplied road network without falling through its catch path', () => {
  const source = repoText('apps/portal/main.js');
  const body = source.slice(source.indexOf('async function precomputeBiomeWorld('), source.indexOf('// Canonical building/prop set dressing'));
  assert.match(body, /const \{ districtGrid, roadNetwork \} = worldStructure;/);
  assert.match(body, /roads: roadNetwork\?\.length \?\? 0/);
});

test('portal bootstrap does not eagerly import heavyweight canonical actor manifests', () => {
  const source = repoText('apps/portal/main.js');
  const encounterVisuals = repoText('apps/portal/src/hmh-encounter-visuals.mjs');
  const combatArtInit = source.slice(source.indexOf('const combatArt ='), source.indexOf('function refreshHmhCombatArtPayload'));
  assert.match(source, /from '\.\/src\/canonical-actor-routing\.mjs'/);
  assert.doesNotMatch(source, /CANONICAL_ACTOR_MANIFESTS/);
  assert.doesNotMatch(source, /hmh-bonus-enemies\//);
  assert.match(source, /const HMH_ACTOR_REGISTRY = new Map\(\)/);
  assert.doesNotMatch(encounterVisuals, /from ['"].*hmh-animated-roster/);
  assert.doesNotMatch(combatArtInit, /buildCharacterArtFromManifest\(/, 'portal boot must not fetch legacy Lester/Lilly still libraries');
  assert.doesNotMatch(combatArtInit, /buildEnemyArtFromManifest\(/, 'portal boot must not fetch legacy enemy still libraries');
});

test('selected hero opening frame is decoded before READY and roguelike never draws the old block fallback', () => {
  const source = repoText('apps/portal/main.js');
  const rosterPreload = source.slice(source.indexOf('async function preloadHeroRoster'), source.indexOf('// --- Roguelike biome-themed enemy sprites'));
  const drawPlayer = source.slice(source.indexOf('function drawPlayer(ctx)'), source.indexOf('function manifestEnemyKeyFor'));
  const beginLevel = source.slice(source.indexOf('async function beginOfficialLevel'), source.indexOf('async function advanceOfficialCampaignLevel'));

  assert.match(beginLevel, /await ensureHMHLoaded\(\)/, 'direct and deep-linked HMH starts must load the lazy roster payload');
  assert.match(source, /await preloadHeroRoster\(combat\.characterId\)/);
  assert.match(rosterPreload, /await Promise\.all\(/);
  assert.match(source, /const preferredStates = \['idle', 'walk', 'run', 'shoot'\]/, 'decoded hold frames must prefer neutral locomotion instead of death/dash states');
  assert.equal(rosterPreload.includes('for (const dirs of Object.values(anims))'), false, 'startup must not decode every state and direction');
  const noFallbackGuard = drawPlayer.indexOf('draw nothing rather than resurrecting old block art');
  const oldBlockFallback = drawPlayer.indexOf("ctx.fillStyle = '#ff7b2f'");
  assert.ok(noFallbackGuard >= 0 && noFallbackGuard < oldBlockFallback, 'roguelike guard must return before the legacy block fallback');
});

test('Level 1 scales complete hero frames and keeps muzzle/tracer VFX at weapon height', () => {
  const source = repoText('apps/portal/main.js');
  const drawPlayer = source.slice(source.indexOf('function drawPlayer(ctx)'), source.indexOf('function manifestEnemyKeyFor'));
  const fireWeapon = source.slice(source.indexOf('function updateAutoFire'), source.indexOf('function openLevelUpMenu'));
  const updateBullets = source.slice(source.indexOf('function updateRoguelikeBullets'), source.indexOf('function updateRoguelikeEnemies'));
  const drawBullets = source.slice(source.indexOf('function drawBullets(ctx)'), source.indexOf('// Prefer repo-owned Art Redo Queue'));

  assert.match(drawPlayer, /buildIsometricHeroDrawPlan\(/);
  assert.match(drawPlayer, /ctx\.drawImage\(heroFrame,\s*source\.x,/);
  assert.match(drawPlayer, /hero\?\.productionSlug/, 'lazy roster heroes must not dereference the retired legacy art object');
  assert.match(fireWeapon, /projectPlayerShotScreenPoint\(/);
  assert.match(updateBullets, /projectPlayerShotScreenPoint\(/);
  assert.match(drawBullets, /projectPlayerShotScreenPoint\(/);
});

test('Level 1 prop rendering uses screen rectangles instead of pressure-dependent anchor radius culling', () => {
  const source = repoText('apps/portal/main.js');
  const renderBody = source.slice(source.indexOf('function buildObstacleRenderEntries('), source.indexOf('function currentLevelOneExplorationLayer('));
  assert.match(renderBody, /drawRectIntersectsViewport\(/);
  assert.doesNotMatch(renderBody, /obstacleRenderRadiusWindowed|obstacleRenderRadiusFullscreen|Math\.abs\(o\.worldX - combat\.playerMapX\)/);
});

test('Level 1 bullets use swept hit detection for both cover and enemies', () => {
  const source = repoText('apps/portal/main.js');
  const bulletBody = source.slice(source.indexOf('function updateRoguelikeBullets('), source.indexOf('function trimLooseRoguelikeRewards('));
  assert.match(bulletBody, /circleTargetHitAlongSegment\(/);
  assert.doesNotMatch(bulletBody, /Math\.hypot\(enemy\.mapX - bullet\.worldX/);
});

test('Level 1 fog batches world and minimap cells instead of issuing hundreds of fills per frame', () => {
  const source = repoText('apps/portal/main.js');
  const visionFogBody = source.slice(source.indexOf('function drawLevelOneVisionFog('), source.indexOf('function drawRoguelikeMinimap('));
  const minimapBody = source.slice(source.indexOf('function drawRoguelikeMinimap('), source.indexOf('function drawRoguelikeScene('));
  assert.match(visionFogBody, /new Path2D\(\)/);
  assert.match(visionFogBody, /ctx\.fill\(fogPath\)/);
  assert.match(minimapBody, /new Path2D\(\)/);
  assert.match(minimapBody, /ctx\.fill\(minimapFogPath\)/);
  assert.doesNotMatch(minimapBody, /fillRect\(x \+ cell\.x/);
});

test('Level 1 roads use prewarmed texture masks and authored bridges instead of flat color diamonds', () => {
  const source = repoText('apps/portal/main.js');
  const roadBody = source.slice(source.indexOf('function drawRoadsAndTransitions('), source.indexOf('function drawProductionIsoProp('));
  assert.match(roadBody, /const roadSurfaceGroups = new Map\(\)/);
  assert.match(roadBody, /ROAD_SURFACE_TEXTURE/);
  assert.match(roadBody, /ctx\.createPattern\(/);
  assert.match(roadBody, /ctx\.fill\(group\.surfacePath\)/);
  assert.doesNotMatch(roadBody, /ctx\.fillStyle = group\.style\.fill/);
  assert.doesNotMatch(roadBody, /bridgeSurfacePath|bridgeWearPath/);
  assert.doesNotMatch(roadBody, /traceIsoDiamond\(ctx, cx, cy, 9\)/);
  assert.doesNotMatch(roadBody, /hmh-coherent-world\/construct\/wood-bridge\.png/);
});

test('curated Level 1 disables camera-relative animated prop scatter', () => {
  const source = repoText('apps/portal/main.js');
  const ambientBody = source.slice(source.indexOf('function collectAnimatedProps('), source.indexOf('const groundPlanPatternFrames'));
  assert.match(ambientBody, /if \(isLevelOneCuratedRuntime\(\)\) return \[\];/);
  assert.doesNotMatch(ambientBody, /environmentState\.wind\.x \* 0\.18/);
  assert.doesNotMatch(ambientBody, /environmentState\.wind\.y \* 0\.12/);
});

test('Level 1 terrain renders to the actual canvas instead of a phantom 2560x1440 fullscreen target', () => {
  const source = repoText('apps/portal/main.js');
  const sceneBody = source.slice(source.indexOf('function drawRoguelikeScene('), source.indexOf('function drawEnvironmentLayer('));
  assert.doesNotMatch(sceneBody, /Math\.max\(width,\s*2560\)|Math\.max\(height,\s*1440\)/);
  assert.match(sceneBody, /const renderWidth = width/);
  assert.match(sceneBody, /const renderHeight = height/);
});

test('Level 1 terrain stops at finite world bounds so edge collision has a visible map edge', () => {
  const source = repoText('apps/portal/main.js');
  const sceneBody = source.slice(source.indexOf('function drawRoguelikeScene('), source.indexOf('function drawEnvironmentLayer('));
  assert.match(sceneBody, /const finiteWorld = [\s\S]*?buildLevelOneRunWorldDimensions/);
  assert.match(sceneBody, /worldX < finiteWorld\.minX/);
  assert.match(sceneBody, /worldY > finiteWorld\.maxY/);
});

test('WO-36 syntax gate includes load-speed report', () => {
  const syntaxCheck = repoText('scripts/syntax-check.mjs');
  assert.equal(syntaxCheck.includes('scripts/hmh-load-speed-report.mjs'), true);
  assert.equal(syntaxCheck.includes('tests/hmh-load-speed.test.mjs'), true);
});

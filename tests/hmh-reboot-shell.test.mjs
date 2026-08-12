import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('standalone child HTML exposes the reboot cockpit and bundled module without wallet APIs', async () => {
  const html = await read('../apps/portal/hmh-reboot/index.html');
  assert.match(html, /id="hmhRebootStage"/);
  assert.match(html, /id="hmhRebootStatus"/);
  assert.match(html, /id="hmhRebootCombatStatus"[^>]+role="status"[^>]+aria-live="polite"/);
  assert.match(html, /id="hmhRebootDashStatus"[^>]+role="status"[^>]+aria-live="polite"/);
  assert.match(html, /src="\.\.\/dist\/hmh-reboot\/game\.js"/);
  assert.match(html, /href="\.\/styles\.css"/);
  assert.match(html, /no wallet requested/i);
  assert.doesNotMatch(html, /window\.ethereum|walletconnect|sendTransaction|contractAddress|privateKey/i);
});

test('child runtime uses Pixi and the validated bridge without wallet or settlement authority', async () => {
  const source = await read('../apps/hmh-reboot/src/main.mjs');
  const worldSource = await read('../apps/hmh-reboot/src/level-one-world.mjs');
  assert.match(source, /from 'pixi\.js'/);
  assert.match(source, /createHmhChildBridge/);
  assert.match(source, /window\.location\.origin/);
  assert.doesNotMatch(source, /window\.ethereum|privateKey|settleRun|walletConnector/);
  assert.match(source, /createStandaloneInitPayload/);
  assert.match(source, /window\.parent === window[\s\S]*?createStandaloneInitPayload\(\{ heroId:/);
  assert.match(source, /new DeterministicSimulation\([\s\S]*?seed: payload\.session\.seed/);
  assert.match(source, /new InputState\(\)/);
  assert.match(source, /createPlayerMotionState\(/);
  assert.match(source, /stepPlayerMovement\(/);
  assert.match(source, /resolveAimIntent\(/);
  assert.match(source, /createTouchControlAdapter\(/);
  assert.match(source, /createPrototypeHumanoidDescriptor\(/);
  assert.match(source, /drawPrototypeHumanoid\(/);
  assert.doesNotMatch(source, /archetype\.visual\.silhouette\s*===/);
  assert.match(source, /createCollisionBody\(/);
  assert.match(source, /LEVEL_ONE_WORLD/);
  assert.match(worldSource, /createStaticBlocker\(/);
  assert.match(source, /resolveSweptCircleMotion\(/);
  assert.match(source, /createLevelOneGroundQuery\(/);
  assert.match(worldSource, /createAuthoredGroundQuery\(/);
  assert.match(source, /movementSpeedMultiplierForTransition\(/);
  assert.match(source, /resolveSweptTraversalPath\(/);
  assert.match(source, /createHurtTarget\(/);
  assert.match(source, /previousGroundZ/);
  assert.match(source, /createProjectileState\(/);
  assert.match(source, /resolveProjectileBatch\(/);
  assert.match(source, /createWeaponLoadout\(/);
  assert.match(source, /stepWeaponLoadout\(/);
  assert.match(source, /selectWeapon\(/);
  assert.match(source, /createMeleeState\(/);
  assert.match(source, /createMeleeTarget\(/);
  assert.match(source, /stepMeleeState\(/);
  assert.match(source, /createGrenadeSystem\(/);
  assert.match(source, /throwGrenade\(/);
  assert.match(source, /stepGrenadeSystem\(/);
  assert.match(source, /resolveCombatHits\(/);
  assert.match(source, /createCombatAudio\(/);
  assert.match(source, /createDashState\(/);
  assert.match(source, /beginDash\(/);
  assert.match(source, /resolveDashWorldStep\(/);
  assert.match(source, /isDashInvulnerable\(/);
  assert.match(source, /previousDash/);
  assert.match(source, /actor\.locomotion = dashFrame\.active \? 'dash'/);
  assert.match(source, /MAX_ACTIVE_PROJECTILES\s*=\s*128/);
  assert.match(source, /MAX_ACTIVE_GRENADES\s*=\s*16/);
  assert.match(source, /MAX_COMBAT_VISUAL_EVENTS\s*=\s*64/);
  assert.match(source, /pushCombatVisualEvent\(/);
  assert.match(source, /PROJECTILE_GRID_THRESHOLD\s*=\s*64/);
  assert.match(source, /new UniformHurtboxGrid\(/);
  assert.match(source, /projectileTrails/);
  assert.match(source, /previous:\s*Object\.freeze|previous:/);
  assert.match(source, /current:\s*Object\.freeze|current:/);
  assert.match(source, /actor\.groundZ\s*=\s*lastGround\.groundZ/);
  assert.match(source, /actor\.z\s*=\s*lastGround\.groundZ/);
  assert.match(worldSource, /visibleAssetId:\s*`graybox-/);
  assert.match(source, /(?:stageElement\.dataset|dataset)\.collisionBlocker/);
  assert.match(source, /(?:stageElement\.dataset|dataset)\.surfaceId/);
  assert.match(source, /(?:stageElement\.dataset|dataset)\.projectileHit/);
  assert.match(source, /(?:stageElement\.dataset|dataset)\.weaponId/);
  assert.match(source, /(?:stageElement\.dataset|dataset)\.actorArt/);
  assert.match(source, /(?:stageElement\.dataset|dataset)\.enemyArt/);
  assert.match(source, /(?:stageElement\.dataset|dataset)\.bossArt/);
  assert.match(source, /(?:stageElement\.dataset|dataset)\.weaponAmmo/);
  assert.match(source, /(?:stageElement\.dataset|dataset)\.weaponHeat/);
  assert.match(source, /(?:stageElement\.dataset|dataset)\.weaponStatus/);
  assert.match(source, /(?:stageElement\.dataset|dataset)\.weaponReloadTicksRemaining/);
  assert.match(source, /getWeaponReadabilityStatus/);
  assert.match(source, /magnitude:\s*event\.recoil/);
  assert.match(source, /createPlayerDefeatController/);
  assert.match(source, /simulation\.gameOver\(\)/);
  assert.match(source, /buildRunResultMessages\(/);
  assert.match(source, /bridge\.send\('game:run-summary', resultMessages\.runSummary\)/);
  assert.match(source, /bridge\.send\('game:score-result', resultMessages\.scoreResult\)/);
  assert.match(source, /bridge\.send\('game:game-over', resultMessages\.gameOver\)/);
  assert.match(source, /simulation\?\.state === 'game-over' \? 'game-over'/);
  assert.match(source, /(?:stageElement\.dataset|dataset)\.grenadeCount/);
  assert.match(source, /(?:stageElement\.dataset|dataset)\.dashReadyTick/);
  assert.doesNotMatch(source, /SETTLER_CALIBRATION/);
  assert.match(source, /if \(debugGridEnabled \|\| releaseTelemetryEnabled\) \{[\s\S]*(?:stageElement\.dataset|dataset)\.collisionBlocker/);
  assert.match(source, /label\.style\.fontSize/);
  assert.match(source, /computeHudMinimapLayout/);
  assert.match(source, /computeCombatStatusLayout/);
  assert.match(source, /const combatStatusX = combatStatusLayout\.compact && activePowerupLabels\.length > 0[\s\S]*?view\.width \* 0\.25[\s\S]*?combatStatusLayout\.x/);
  assert.match(source, /const combatStatusY = combatStatusLayout\.y \+ \(narrowDebug \? 32 : 0\)/);
  assert.match(source, /label\.position\.set\(combatStatusX, combatStatusY\)/);
  assert.match(source, /createActorSpatialState\(/);
  assert.match(source, /createCameraState\(/);
  assert.match(source, /interpolateSpatialState\(/);
  assert.match(source, /const handleResize = \(\) => renderWorld\(\)/);
  assert.doesNotMatch(source, /\.on\('resize', renderWorld\)/);
  assert.match(source, /simulation\.update\(ticker\.deltaMS/);
  assert.match(source, /navigator\.getGamepads/);
  assert.match(source, /visibilitychange/);
  assert.doesNotMatch(source, /elapsedMs\s*\+=\s*ticker\.deltaMS/);
  assert.match(
    source,
    /message\.type === 'portal:restart'[\s\S]*?initializeSession\(sessionPayload\)[\s\S]*?statePayload\('running'\)/,
    'restart must rebuild the same canonical seeded session before reporting running state',
  );
});

test('opt-in Blender pilot composes render state without replacing the default graybox path', async () => {
  const source = await read('../apps/hmh-reboot/src/main.mjs');
  const atlasSource = await read('../apps/hmh-reboot/src/mannequin-atlas.mjs');
  assert.match(source, /MANNEQUIN_ATLAS_IMAGE_URL/);
  assert.match(source, /MANNEQUIN_ATLAS_METADATA_URL/);
  assert.match(source, /MANNEQUIN_RUNTIME_SCALE \* camera\.zoom/);
  assert.match(source, /createMannequinAtlasIndex/);
  assert.match(source, /createMannequinDisplay/);
  assert.match(source, /runtimeParams\.get\('pipelinePilot'\) === '1'/);
  assert.match(source, /fetch\(MANNEQUIN_ATLAS_METADATA_URL/);
  assert.match(source, /Assets\.load\(MANNEQUIN_ATLAS_IMAGE_URL\)/);
  assert.match(source, /mannequinDisplay\.applyPose\(\{[\s\S]*simulationTick:[\s\S]*locomotion:[\s\S]*legDirection:[\s\S]*torsoDirection:/);
  assert.match(source, /actorVisual\.position\.set\(atlasActorEnabled \? groundScreen\.x : screen\.x, atlasActorEnabled \? groundScreen\.y : screen\.y\)/);
  assert.match(source, /(?:stageElement\.dataset|dataset)\.actorArtSource/);
  assert.match(atlasSource, /pipeline-pilot-human-atlas/);
  assert.match(source, /drawPrototypeHumanoid\(new Graphics\(\), createPrototypeHumanoidDescriptor/);
  assert.doesNotMatch(source, /pipelinePilotEnabled[\s\S]{0,120}(?:collision|damage|score|wallet|settlement)\s*=/i);
});

test('the production hero atlas is the projection-only shipped identity with a graybox fallback', async () => {
  const source = await read('../apps/hmh-reboot/src/main.mjs');
  const atlasSource = await read('../apps/hmh-reboot/src/production-hero-atlas.mjs');
  assert.match(source, /productionHeroAsset/);
  assert.match(source, /PRODUCTION_HERO_RUNTIME_SCALE \* camera\.zoom/);
  assert.match(source, /createProductionHeroAtlasIndex/);
  assert.match(source, /createProductionHeroDisplay/);
  // The production hero atlas is the shipped default identity; `?graybox=1`
  // keeps the prototype available for regression work only.
  assert.match(source, /const productionPilotEnabled = !grayboxRequested && !pipelinePilotEnabled/);
  assert.match(source, /runtimeParams\.get\('graybox'\) === '1'/);
  assert.match(source, /Object\.hasOwn\(PRODUCTION_HERO_ASSETS, requestedProductionHeroId\)/);
  // The atlas is loaded for whichever actor the session requests, not a
  // boot-time URL default, so a player picking any hero gets that hero.
  assert.match(source, /fetch\(selection\.metadataUrl/);
  assert.match(source, /Assets\.load\(selection\.imageUrl\)/);
  assert.match(source, /createProductionHeroAtlasIndex\(metadata, selection\)/);
  assert.match(source, /productionHeroDisplay\.applyPose\(\{[\s\S]*simulationTick:[\s\S]*actionTick:[\s\S]*locomotion:[\s\S]*legDirection:[\s\S]*torsoDirection:[\s\S]*action:/);
  // The atlas loads asynchronously so the shell can signal READY before the
  // ~650 KB texture decodes; the prototype renders until the swap lands.
  assert.match(source, /let actorVisual = mannequinDisplay\?\.container \?\? marker/);
  assert.match(source, /ensureProductionHeroAtlas\(sessionHeroSelection\.actorId\)/);
  assert.match(source, /loadProductionHeroAtlas\(selection\)\.then\(/);
  // Art selection must never abort a session: this runs inside the bridge
  // onInit handler and throwing would skip game:ready.
  assert.ok(!/Production projection actor mismatch/.test(source));
  assert.match(source, /world\.addChildAt\(actorVisual, slot\)/);
  // Art telemetry must reflect what rendered, so a fallback cannot be
  // reported as production art.
  assert.match(source, /(?:stageElement\.dataset|dataset)\.actorArtSource = productionHeroDisplay \? 'production-blender-atlas-v1'/);
  assert.match(source, /dataset\.actorArtFallbackReason/);
  assert.match(atlasSource, /runtimeAuthority !== 'projection-only'/);
  assert.match(source, /drawPrototypeHumanoid\(new Graphics\(\), createPrototypeHumanoidDescriptor/);
  assert.doesNotMatch(source, /productionPilotEnabled[\s\S]{0,160}(?:collision|damage|score|wallet|settlement)\s*=/i);
});

test('runtime gives every projectile hit intent a stable per-projectile identifier', async () => {
  const source = await read('../apps/hmh-reboot/src/main.mjs');
  assert.match(source, /id: `\$\{shot\.id\}:\$\{hit\.targetId\}:\$\{hit\.kind\}`/);
  assert.doesNotMatch(source, /id: `\$\{shot\.attackId\}:\$\{hit\.targetId\}:\$\{hit\.kind\}`/);
});

test('production build emits a dedicated HMH reboot entry', async () => {
  const build = await read('../build.mjs');
  assert.match(build, /'hmh-reboot\/game'/);
  assert.match(build, /apps[\\/]hmh-reboot[\\/]src[\\/]main\.mjs|hmh-reboot.*main\.mjs/s);
});

test('same-origin child framing and the Pixi CSP exception remain isolated from the parent portal', async () => {
  const vercel = JSON.parse(await read('../vercel.json'));
  const childRule = vercel.headers.find((rule) => rule.source === '/hmh-reboot/(.*)');
  const parentRule = vercel.headers.find((rule) => rule.headers?.some((header) => header.key === 'Content-Security-Policy' && header.value.includes("frame-ancestors 'none'")));
  const childCsp = childRule?.headers.find((header) => header.key === 'Content-Security-Policy')?.value ?? '';
  const parentCsp = parentRule?.headers.find((header) => header.key === 'Content-Security-Policy')?.value ?? '';
  assert.match(childCsp, /script-src 'self' 'unsafe-eval'/);
  assert.match(childCsp, /frame-ancestors 'self'/);
  assert.doesNotMatch(childCsp, /script-src[^;]*'unsafe-inline'/);
  assert.doesNotMatch(parentCsp, /'unsafe-eval'/);
  assert.match(parentCsp, /frame-ancestors 'none'/);
});

test('portal main integrates the reboot host at the official combat mount', async () => {
  const source = await read('../apps/portal/main.js');
  const lifecycleSource = await read('../apps/portal/src/hmh-reboot-portal-lifecycle.mjs');
  assert.match(source, /createHmhRebootHost/);
  assert.match(source, /mountHmhRebootSession/);
  assert.match(source, /officialCombatMount/);
  assert.match(source, /window\.location\.origin/);
  assert.match(source, /buildCabinetInitContextFromSession\(currentSession/);
  assert.match(source, /onState: \(message\) => hmhRebootLifecycle\?\.handleState\(message\)/);
  assert.match(lifecycleSource, /message\.type === 'game:pause'/);
  assert.match(source, /onExit:[\s\S]*?returnToOfficialGameMenu\(\)/);
  assert.match(source, /onRunEvent:[\s\S]*?recordSessionEvent\(/);
  assert.match(source, /function drawCombatScene[\s\S]*?if \(hmhRebootActive\)[\s\S]*?requestAnimationFrame\(drawCombatScene\)/);
});

test('portal frame fills the active gameplay viewport without a fixed 72vh dead zone', async () => {
  const css = await read('../apps/portal/styles.css');
  const childStyles = await read('../apps/portal/hmh-reboot/styles.css');
  assert.match(css, /\.hmh-reboot-frame[\s\S]*?min-height:\s*calc\(100dvh\s*-\s*\d+px\)/);
  assert.match(childStyles, /touch-action:\s*none/);
  assert.match(childStyles, /user-select:\s*none/);
  assert.match(childStyles, /\.hmh-touch-button--power/);
  assert.match(childStyles, /\.hmh-reboot-dash-status/);
  assert.match(childStyles, /\.hmh-reboot-dash-status\[data-ready="true"\]/);
});

test('touch-stick safe labels remain readable at portrait-mobile scale', async () => {
  const childStyles = await read('../apps/portal/hmh-reboot/styles.css');
  const labelRule = childStyles.match(/\.hmh-touch-stick::before\s*\{([\s\S]*?)\}/)?.[1] ?? '';
  assert.match(labelRule, /font-size:\s*0\.72rem/);
  assert.match(labelRule, /top:\s*6px/);
  assert.match(labelRule, /color:\s*#f4fbff/);
  assert.match(labelRule, /background:\s*rgba\(3,\s*15,\s*26,\s*0\.78\)/);
  assert.match(labelRule, /text-shadow:/);
});

test('built child bundle exists after the project build', async () => {
  const bundle = new URL('../apps/portal/dist/hmh-reboot/game.js', import.meta.url);
  const info = await stat(bundle);
  assert.ok(info.size > 100_000);
});

test('service worker versions both playable cabinet shells for offline startup', async () => {
  const source = await read('../apps/portal/sw.js');
  assert.match(source, /CACHE_VERSION\s*=\s*'lesters-arcade-v12-chikun-upgrade'/);
  const preCache = source.match(/const PRECACHE_URLS = \[([^\]]+)\]/s)?.[1] ?? '';
  for (const asset of [
    '/hmh-reboot/index.html',
    '/hmh-reboot/styles.css',
    '/dist/hmh-reboot/game.js',
    '/dist/chunks/hmh-pixi.js',
    '/chikun/index.html',
    '/chikun/game.css',
    '/dist/chikun/game.js',
    '/assets/generated/chikun-game/chikun-coast.webp',
    '/assets/generated/chikun-game/chikun-fall.webp',
  ]) {
    assert.match(preCache, new RegExp(asset.replace(/[./]/g, '\\$&')));
  }
  assert.doesNotMatch(preCache, /hmh-reboot.*(?:atlas|audio)|assets\/audio/, 'heavy HMH art and audio packages must remain lazy');
});

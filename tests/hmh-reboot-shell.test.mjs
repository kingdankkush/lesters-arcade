import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('standalone child HTML exposes only the reboot shell and bundled module', async () => {
  const html = await read('../apps/portal/hmh-reboot/index.html');
  assert.match(html, /id="hmhRebootStage"/);
  assert.match(html, /id="hmhRebootStatus"/);
  assert.match(html, /src="\.\.\/dist\/hmh-reboot\/game\.js"/);
  assert.match(html, /href="\.\/styles\.css"/);
  assert.doesNotMatch(html, /wallet|ethereum|contract/i);
});

test('child runtime uses Pixi and the validated bridge without wallet or settlement authority', async () => {
  const source = await read('../apps/hmh-reboot/src/main.mjs');
  assert.match(source, /from 'pixi\.js'/);
  assert.match(source, /createHmhChildBridge/);
  assert.match(source, /window\.location\.origin/);
  assert.doesNotMatch(source, /window\.ethereum|privateKey|settleRun|walletConnector/);
  assert.match(source, /createStandaloneInitPayload/);
  assert.match(source, /window\.parent === window[\s\S]*?createStandaloneInitPayload\(\)/);
  assert.match(source, /new DeterministicSimulation\([\s\S]*?seed: payload\.session\.seed/);
  assert.match(source, /new InputState\(\)/);
  assert.match(source, /createPlayerMotionState\(/);
  assert.match(source, /stepPlayerMovement\(/);
  assert.match(source, /resolveAimIntent\(/);
  assert.match(source, /createTouchControlAdapter\(/);
  assert.match(source, /createCollisionBody\(/);
  assert.match(source, /createStaticBlocker\(/);
  assert.match(source, /resolveSweptCircleMotion\(/);
  assert.match(source, /createAuthoredGroundQuery\(/);
  assert.match(source, /movementSpeedMultiplierForTransition\(/);
  assert.match(source, /resolveSweptTraversalPath\(/);
  assert.match(source, /actor\.groundZ\s*=\s*lastGround\.groundZ/);
  assert.match(source, /actor\.z\s*=\s*lastGround\.groundZ/);
  assert.match(source, /visibleAssetId:\s*'graybox-/);
  assert.match(source, /stageElement\.dataset\.collisionBlocker/);
  assert.match(source, /stageElement\.dataset\.surfaceId/);
  assert.match(source, /if \(debugGridEnabled\) \{[\s\S]*stageElement\.dataset\.collisionBlocker/);
  assert.match(source, /label\.style\.fontSize/);
  assert.match(source, /view\.width\s*<\s*600/);
  assert.match(source, /label\.width\s*\*\s*0\.5/);
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

test('production build emits a dedicated HMH reboot entry', async () => {
  const build = await read('../build.mjs');
  assert.match(build, /'hmh-reboot\/game'/);
  assert.match(build, /apps[\\/]hmh-reboot[\\/]src[\\/]main\.mjs|hmh-reboot.*main\.mjs/s);
});

test('same-origin framing is allowed while arbitrary framing remains blocked', async () => {
  const vercel = JSON.parse(await read('../vercel.json'));
  const csp = vercel.headers.flatMap((rule) => rule.headers).find((header) => header.key === 'Content-Security-Policy')?.value ?? '';
  assert.match(csp, /frame-ancestors 'self'/);
  assert.doesNotMatch(csp, /frame-ancestors 'none'/);
});

test('portal main integrates the reboot host at the official combat mount', async () => {
  const source = await read('../apps/portal/main.js');
  assert.match(source, /createHmhRebootHost/);
  assert.match(source, /mountHmhRebootSession/);
  assert.match(source, /officialCombatMount/);
  assert.match(source, /window\.location\.origin/);
  assert.match(source, /buildCabinetInitContextFromSession\(currentSession/);
  assert.match(source, /message\.type === 'game:pause'/);
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
});

test('built child bundle exists after the project build', async () => {
  const bundle = new URL('../apps/portal/dist/hmh-reboot/game.js', import.meta.url);
  const info = await stat(bundle);
  assert.ok(info.size > 100_000);
});

test('service worker versions only the minimal reboot shell for offline startup', async () => {
  const source = await read('../apps/portal/sw.js');
  assert.match(source, /CACHE_VERSION\s*=\s*'lesters-arcade-v4-hmh-reboot-07'/);
  const preCache = source.match(/const PRECACHE_URLS = \[([^\]]+)\]/s)?.[1] ?? '';
  for (const asset of ['/hmh-reboot/index.html', '/hmh-reboot/styles.css', '/dist/hmh-reboot/game.js']) {
    assert.match(preCache, new RegExp(asset.replace(/[./]/g, '\\$&')));
  }
  assert.doesNotMatch(preCache, /\/assets\//, 'heavy art and audio packages must remain lazy');
});

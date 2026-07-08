import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

import { buildTacticalBalanceDebugOverlayModel } from '../apps/portal/src/arcade-core.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const outputDir = fileURLToPath(new URL('../docs/game-design', import.meta.url));
const outputJson = `${outputDir}/hard-money-heroes-interaction-smoke-plan.json`;
const flowId = 'wallet-profile-free-ranked-exit';

async function findOpenSmokePort(preferredPort = 8791) {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.unref();
    probe.on('error', () => {
      const fallback = createServer();
      fallback.listen(0, '127.0.0.1', () => {
        const { port } = fallback.address();
        fallback.close(() => resolve(port));
      });
    });
    probe.listen(preferredPort, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

const externalRootUrl = process.env.PORTAL_SMOKE_ROOT;
const configuredSmokePort = Number.parseInt(process.env.PORTAL_SMOKE_PORT ?? '8791', 10);
const preferredSmokePort = Number.isInteger(configuredSmokePort) ? configuredSmokePort : 8791;
const smokePort = externalRootUrl ? null : await findOpenSmokePort(preferredSmokePort);
const rootUrl = externalRootUrl ?? `http://127.0.0.1:${smokePort}`;
const portalPath = process.env.PORTAL_SMOKE_PATH ?? (externalRootUrl ? '/' : '/apps/portal/');
const portalUrl = new URL(portalPath, rootUrl.endsWith('/') ? rootUrl : `${rootUrl}/`).toString();
const shouldWritePlan = process.env.PORTAL_SMOKE_WRITE_PLAN === 'true' || !externalRootUrl;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url, attempts = 10) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      await sleep(250);
    }
  }
  throw lastError;
}

function assertIncludes(label, source, needle) {
  if (!source.includes(needle)) throw new Error(`${label} missing interaction marker: ${needle}`);
}

const server = externalRootUrl
  ? null
  : spawn('python', ['-m', 'http.server', String(smokePort), '--bind', '127.0.0.1'], {
    cwd: repoRoot,
    stdio: 'pipe',
  });

let serverError = '';
server?.stderr.on('data', (chunk) => {
  serverError += chunk.toString();
});

try {
  const html = await fetchText(portalUrl);
  const main = await fetchText(`${portalUrl}main.js?v=web3-security-v22`);
  const styles = await fetchText(`${portalUrl}styles.css`);
  const overlayProbe = buildTacticalBalanceDebugOverlayModel({
    debugEnabled: true,
    playerX: 318,
    scroll: 144,
    furthestScroll: 200,
    stagePhase: 'travel',
    stageTravel: 73,
    stageTravelGoal: 254,
    enemies: [{ role: 'cover-shooter', state: 'telegraph', x: 520, attackTimer: 44 }],
    props: [{ kind: 'crate', cover: true, x: 180 }, { kind: 'barrel', explosive: true, x: 340 }],
  });

  const requiredHtmlMarkers = [
    'officialConnectButton',
    'officialGuestEnterButton',
    'officialFreeModeButton',
    'officialRankedModeButton',
    'combatPauseButton',
    'combatMenuIconButton',
    'combatSettingsPanel',
    'combatRestartButton',
    'combatReturnMenuButton',
    'combatExitButton',
    'combatHudOverlay',
    'tacticalBalanceDebugOverlay',
    'arcadeMusicShuffleButton',
  ];
  const requiredMainMarkers = [
    'enterOfficialArcadeFromSplash',
    'enterArcadeAsGuest',
    'isGuestAllowedStep',
    'beginOfficialLevel',
    'applyPlayerLedCameraMovement',
    'renderCombatHudOverlay',
    'renderTacticalBalanceDebugOverlay',
    'renderCombatSettingsPanel',
    'toggleCombatSettingsPanel',
    'toggleCombatReduceMotionSetting',
    'toggleCombatReduceFlashSetting',
    'toggleCombatColorblindTagsSetting',
    'toggleCombatAutoAimSetting',
    'buildCombatAccessibilitySettingsModel',
    'scheduleCombatViewportRelayout',
    "document.addEventListener('fullscreenchange'",
    "window.addEventListener('orientationchange'",
    'buildTacticalBalanceDebugOverlayModel',
    'clearInactiveCombatOverlay',
    "officialAppStep = connectedWallet ? 'cabinet-select' : 'wallet-splash'",
    'hmhDebug=balance',
    "event.key === 'F10'",
  ];
  const requiredStyleMarkers = [
    'combat-hud-overlay',
    'tactical-debug-overlay',
    'debug-layer',
    'combat-menu-icon-button',
    'combat-settings-panel',
    'combat-accessibility-grid',
    'combat-accessibility-action',
    'combat-settings-action-desc',
    'stat-tone-tag',
    'upgrade-card-tone-tag',
  ];

  for (const marker of requiredHtmlMarkers) assertIncludes('portal html', html, marker);
  for (const marker of requiredMainMarkers) assertIncludes('portal main.js', main, marker);
  for (const marker of requiredStyleMarkers) assertIncludes('portal styles.css', styles, marker);

  const plan = {
    flowId,
    checkedUrl: portalUrl,
    mode: 'static-interaction-contract',
    note: 'This gate verifies all selectors/handlers required for the live browser flow: wallet/profile/free/ranked/exit. Browser tool smoke still exercises actual clicks during handoff.',
    requiredSteps: [
      { id: 'connect-wallet', selector: '#officialConnectButton', expectedHandler: 'enterOfficialArcadeFromSplash' },
      { id: 'profile-tab', selector: '[data-tab="profile"]', expectedVisibleCopy: 'connected wallet profile' },
      { id: 'free-start', selector: '#officialFreeModeButton', expectedNext: '#officialBeginLevelButton' },
      { id: 'rightward-scroll', key: 'd', expectedHud: 'combatHudOverlay' },
      { id: 'pause-options', selector: '#combatPauseButton', expectedPanel: '#combatMenuPanel' },
      { id: 'restart', selector: '#combatRestartButton', expectedCleanHud: true },
      { id: 'game-menu', selector: '#combatReturnMenuButton', expectedStep: 'mode-select' },
      { id: 'ranked-start', selector: '#officialRankedModeButton', expectedSeparation: 'official score sync only at game over' },
      { id: 'exit-cleanup', selector: '#combatExitButton', expectedStep: 'cabinet-select', expectedCleanup: ['combatHudOverlay', 'clearInactiveCombatOverlay'] },
      { id: 'dev-balance-overlay', query: 'hmhDebug=balance', toggle: 'F10', model: 'buildTacticalBalanceDebugOverlayModel' },
    ],
    overlayProbe: {
      enabled: overlayProbe.enabled,
      cameraMode: overlayProbe.metrics.camera.mode,
      stageProgress: overlayProbe.metrics.stage.progress,
      enemyCount: overlayProbe.metrics.enemies.count,
      telegraphing: overlayProbe.metrics.enemies.telegraphing,
      coverCount: overlayProbe.metrics.cover.coverCount,
    },
  };

  console.log('Portal interaction smoke contract passed.');
  console.log(`Flow: ${flowId}`);
  if (shouldWritePlan) {
    await mkdir(outputDir, { recursive: true });
    await writeFile(outputJson, `${JSON.stringify(plan, null, 2)}\n`);
    console.log(`Wrote ${outputJson}`);
  } else {
    console.log('External smoke mode: skipped writing the local interaction smoke plan.');
  }
} finally {
  if (server && !server.killed) server.kill();
}

if (serverError && !serverError.includes('Address already in use')) {
  console.warn(serverError.trim());
}

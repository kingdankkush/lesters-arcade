import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const rootUrl = process.env.PORTAL_SMOKE_ROOT ?? 'http://127.0.0.1:8791';
const portalUrl = `${rootUrl.replace(/\/$/, '')}/apps/portal/`;

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
  if (!source.includes(needle)) {
    throw new Error(`${label} missing required smoke marker: ${needle}`);
  }
}

const server = spawn('python', ['-m', 'http.server', '8791', '--bind', '127.0.0.1'], {
  cwd: repoRoot,
  stdio: 'pipe',
});

let serverError = '';
server.stderr.on('data', (chunk) => {
  serverError += chunk.toString();
});

try {
  const html = await fetchText(portalUrl);
  const main = await fetchText(`${portalUrl}main.js?v=hmh-tactical-exit-v2`);
  const styles = await fetchText(`${portalUrl}styles.css`);

  for (const marker of [
    'officialConnectButton',
    'officialFreeModeButton',
    'officialRankedModeButton',
    'officialCombatMount',
    'combatCanvas',
    'combatHudOverlay',
    'combatMenuPanel',
    'hmh-tactical-exit-v2',
  ]) {
    assertIncludes('portal html', html, marker);
  }

  for (const marker of [
    'applyPlayerLedCameraMovement',
    'renderCombatHudOverlay',
    'buildCombatOptionsMenuModel',
    'buildHardMoneyHeroesAnimationCoverageReport',
    'combatReturnMenuButton',
    "officialAppStep = connectedWallet ? 'cabinet-select' : 'wallet-splash'",
    'player-led advance',
  ]) {
    assertIncludes('portal main.js', main, marker);
  }

  for (const marker of ['combat-hud-overlay', 'hud-widget', 'combat-menu-panel']) {
    assertIncludes('portal styles.css', styles, marker);
  }

  console.log('Portal smoke gate passed.');
  console.log(`Checked ${portalUrl}`);
  console.log('Covered: wallet entry markers, free/ranked buttons, gameplay canvas, HUD overlay, options popup, return/exit controls, and player-led camera wiring.');
} finally {
  if (!server.killed) server.kill();
}

if (serverError && !serverError.includes('Address already in use')) {
  console.warn(serverError.trim());
}

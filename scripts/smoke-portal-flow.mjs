import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url, attempts = 10) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      await sleep(250);
    }
  }
  throw lastError;
}

async function fetchPngSize(url, attempts = 10) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);
      const png = Buffer.from(await response.arrayBuffer());
      if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error(`${url} is not a PNG`);
      return [png.readUInt32BE(16), png.readUInt32BE(20)];
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
  const main = await fetchText(`${portalUrl}main.js?v=hmh-aaa-cycle-074-atmosphere-and-feel`);
  const styles = await fetchText(`${portalUrl}styles.css`);
  const playlistManifest = await fetchText(`${portalUrl}assets/audio/playlist/arcade-playlist-manifest.json`);
  const pixelLabRuntimeManifest = await fetchText(`${portalUrl}assets/generated/pixellab-calibration/lester-hero-6d6e53e2/runtime-manifest.mjs`);
  const isometricWaveManifest = await fetchText(`${portalUrl}assets/generated/hmh-isometric-pixellab/hmh-isometric-pixellab-wave-1.mjs`);
  const productionArtManifest = await fetchText(`${portalUrl}assets/generated/hmh-production-art-pass/hmh-production-art-pass.mjs`);

  for (const marker of [
    'officialConnectButton',
    'officialFreeModeButton',
    'officialRankedModeButton',
    'officialCombatMount',
    'combatHudOverlay',
    'arcadeMusicPlayer',
    'arcadeMusicProgressFill',
    'arcadeMusicNextButton',
    'arcadeMusicShuffleButton',
    'combatMenuPanel',
    'splashFeaturedCabinet',
    'hmh-aaa-cycle-074-atmosphere-and-feel',
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
    'renderRotatingCabinetSprite',
    'hardMoneyHeroScreenBackgroundProfile',
    'buildArcadeMusicPlayerModel',
    'startArcadeMusicForGame',
    "startArcadeMusicForGame('hard-money-heroes')",
    'buildPixelLabLesterCalibrationArt',
    'lesterPixelLabCalibration',
    'HMH_ISOMETRIC_PIXELLAB_WAVE_1',
    'HMH_PRODUCTION_ART_PASS',
    'buildProductionArtPass',
    'preloadHeroRoster(combat.characterId)',
    'biomeGroundTileForWorld',
    'productionPropForIndex',
    'productionVfxFrame',
    'hero.animations.shoot',
  ]) {
    assertIncludes('portal main.js', main, marker);
  }

  for (const marker of ['combat-hud-overlay', 'hud-widget', 'combat-menu-panel', 'hmh-cabinet-rotator', 'arcade-music-player', 'arcade-music-progress-fill', '[data-expanded="true"]', '@keyframes hmhCabinetFloat']) {
    assertIncludes('portal styles.css', styles, marker);
  }

  for (const marker of [
    'lesters-arcade-custom-mp3-playlist-v1',
    'Hard Money Heroes — Main Theme',
    'Hard Money Heroes — Mempool Mayhem',
    './assets/audio/playlist/hard-money-heroes-16-bit-arcade-music.mp3',
  ]) {
    assertIncludes('playlist manifest', playlistManifest, marker);
  }

  for (const marker of [
    'HMH_PIXELLAB_LESTER_CALIBRATION_MANIFEST',
    'pixellab-lester-hero-6d6e53e2',
    'idle/run/shoot',
    'animations/shoot-blaster/east/00.png',
    'animations/idle-combat-ready/east/00.png',
    'animations/run-side-scroll/east/00.png',
  ]) {
    assertIncludes('PixelLab Lester runtime manifest', pixelLabRuntimeManifest, marker);
  }

  for (const marker of [
    'HMH_ISOMETRIC_PIXELLAB_WAVE_1',
    'isometric-production-wave-1',
    'lester-iso-hero',
    'trench-degen-chaser',
    'xp-bar-frame',
    'contactSheet',
  ]) {
    assertIncludes('PixelLab isometric wave manifest', isometricWaveManifest, marker);
  }

  for (const marker of [
    'HMH_PRODUCTION_ART_PASS',
    'PixelLab wave 1 plus deterministic Python/Pillow UI and animation derivatives',
    'characters/lester-iso-hero/run/frame-00.png',
    'xp-bar-frame',
    'hard-money-heroes-production-cabinet',
    'boss-telegraph-ring',
  ]) {
    assertIncludes('HMH production art pass manifest', productionArtManifest, marker);
  }

  const pixelLabSpriteProbePaths = [
    'assets/generated/pixellab-calibration/lester-hero-6d6e53e2/rotations/east.png',
    'assets/generated/pixellab-calibration/lester-hero-6d6e53e2/animations/idle-combat-ready/east/00.png',
    'assets/generated/pixellab-calibration/lester-hero-6d6e53e2/animations/run-side-scroll/east/00.png',
    'assets/generated/pixellab-calibration/lester-hero-6d6e53e2/animations/shoot-blaster/east/00.png',
    'assets/generated/pixellab-calibration/lester-hero-6d6e53e2/hmh-pixellab-lester-calibration-contact-sheet.png',
  ];
  for (const spritePath of pixelLabSpriteProbePaths) {
    const [width, height] = await fetchPngSize(`${portalUrl}${spritePath}`);
    if (width <= 0 || height <= 0) throw new Error(`PixelLab sprite probe ${spritePath} has invalid dimensions ${width}x${height}`);
  }

  const productionSpriteProbePaths = [
    'assets/generated/hmh-reboot-production-heroes/lester-original/lester-original-production-pilot-atlas.png',
    'assets/generated/hmh-reboot-production-heroes/lilly/lilly-production-pilot-atlas.png',
    'assets/generated/hmh-reboot-production-heroes/lit-commando/lit-commando-production-pilot-atlas.png',
    'assets/generated/hmh-reboot-production-heroes/lit-valkyrie/lit-valkyrie-production-pilot-atlas.png',
  ];
  for (const spritePath of productionSpriteProbePaths) {
    const [width, height] = await fetchPngSize(`${portalUrl}${spritePath}`);
    if (width <= 0 || height <= 0) throw new Error(`HMH production sprite probe ${spritePath} has invalid dimensions ${width}x${height}`);
  }

  const playlist = JSON.parse(playlistManifest);
  if (playlist.tracks.length < 20) throw new Error(`playlist manifest expected 20 tracks, got ${playlist.tracks.length}`);
  const firstHmhSrc = playlist.tracks.find((track) => track.id === 'hard-money-heroes-16-bit-arcade-music')?.src;
  if (!firstHmhSrc) throw new Error('playlist manifest missing first Hard Money Heroes track');
  await fetchText(`${portalUrl}${firstHmhSrc.replace(/^\.\//, '')}`, 3);

  console.log('Portal smoke gate passed.');
  console.log(`Checked ${portalUrl}`);
  console.log('Covered: wallet entry markers, free/ranked buttons, gameplay canvas, HUD overlay, options popup, return/exit controls, player-led camera wiring, PixelLab Lester calibration assets, and Hard Money Heroes isometric production asset loading.');
} finally {
  if (server && !server.killed) server.kill();
}

if (serverError && !serverError.includes('Address already in use')) {
  console.warn(serverError.trim());
}

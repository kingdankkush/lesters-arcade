import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { startPortalStaticServer } from './hmh-reboot-portal-e2e.mjs';

// The runtime canvas is WebGL with the default preserveDrawingBuffer:false, so
// reading it back inside the page (drawImage/getImageData/toDataURL) yields a
// cleared buffer — a signature of all zeros that silently compares equal
// forever. Screenshots are captured by the browser compositor instead and
// decoded here, which reflects exactly what a player sees.
export function decodePng(buffer) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let index = 0; index < signature.length; index += 1) {
    if (buffer[index] !== signature[index]) throw new Error('not a PNG buffer');
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (data[12] !== 0) throw new Error('interlaced PNG is not supported');
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }
  if (bitDepth !== 8) throw new Error(`unsupported PNG bit depth ${bitDepth}`);
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (!channels) throw new Error(`unsupported PNG color type ${colorType}`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);
  let rawOffset = 0;
  for (let row = 0; row < height; row += 1) {
    const filter = raw[rawOffset];
    rawOffset += 1;
    const rowStart = row * stride;
    const previousStart = (row - 1) * stride;
    for (let index = 0; index < stride; index += 1) {
      const value = raw[rawOffset + index];
      const left = index >= channels ? pixels[rowStart + index - channels] : 0;
      const up = row > 0 ? pixels[previousStart + index] : 0;
      const upLeft = row > 0 && index >= channels ? pixels[previousStart + index - channels] : 0;
      let restored;
      if (filter === 0) restored = value;
      else if (filter === 1) restored = value + left;
      else if (filter === 2) restored = value + up;
      else if (filter === 3) restored = value + ((left + up) >> 1);
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        restored = value + predictor;
      } else throw new Error(`unsupported PNG filter ${filter}`);
      pixels[rowStart + index] = restored & 0xff;
    }
    rawOffset += stride;
  }
  return { width, height, channels, pixels };
}

// Box-downsample to the signature grid and convert to Rec. 601 luma.
export function signatureFromPng(buffer, { width = 32, height = 18 } = {}) {
  const image = decodePng(buffer);
  const cells = [];
  for (let cellY = 0; cellY < height; cellY += 1) {
    for (let cellX = 0; cellX < width; cellX += 1) {
      const x0 = Math.floor((cellX * image.width) / width);
      const x1 = Math.max(x0 + 1, Math.floor(((cellX + 1) * image.width) / width));
      const y0 = Math.floor((cellY * image.height) / height);
      const y1 = Math.max(y0 + 1, Math.floor(((cellY + 1) * image.height) / height));
      let total = 0;
      let count = 0;
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const index = y * image.width * image.channels + x * image.channels;
          total += 0.299 * image.pixels[index] + 0.587 * image.pixels[index + 1] + 0.114 * image.pixels[index + 2];
          count += 1;
        }
      }
      cells.push(Math.round(total / Math.max(1, count)));
    }
  }
  return cells;
}

export const VISUAL_SIGNATURE_SCHEMA = 'hmh-reboot-visual-signature-v1';

// Perceptual signature grid. Small enough that GPU antialiasing noise cannot
// flip a cell, large enough to catch layout, palette, and draw-order changes.
export const SIGNATURE_WIDTH = 32;
export const SIGNATURE_HEIGHT = 18;

// Mean absolute luminance delta (0-255 scale) at or below which two captures
// are considered visually identical.
export const SIGNATURE_TOLERANCE = 2.5;
// Mean delta alone is blind to a large change confined to a small part of the
// frame — a hero sprite is well under 1% of a 1440x900 view, so losing it
// entirely moves the mean by ~0.9. These bound how far any single cell may
// move, and how many cells may move at all, so localized regressions fail.
export const SIGNATURE_MAX_CELL_DELTA = 26;
export const SIGNATURE_MAX_CHANGED_CELLS = 24;

// Deterministic capture scenes. evidenceSafe pins the run (invulnerable
// player, stable spawns) so a baseline stays reproducible across machines.
export const VISUAL_SCENES = Object.freeze([
  Object.freeze({
    id: 'frontier-relay-desktop',
    query: 'evidenceSafe=1&telemetry=1',
    viewport: Object.freeze({ width: 1440, height: 900 }),
    tick: 90,
  }),
  Object.freeze({
    id: 'frontier-relay-mobile',
    query: 'evidenceSafe=1&telemetry=1',
    viewport: Object.freeze({ width: 390, height: 844 }),
    tick: 90,
  }),
  Object.freeze({
    id: 'combat-engaged-desktop',
    // director/boss debug puts real pressure on screen, so this scene gates
    // the combat-feedback work instead of duplicating the opening frame.
    query: 'evidenceSafe=1&telemetry=1&director=1&boss=1',
    viewport: Object.freeze({ width: 1440, height: 900 }),
    tick: 420,
  }),
  Object.freeze({
    id: 'ravine-overlook-desktop',
    query: 'evidenceSafe=1&telemetry=1&worldTour=ravine',
    viewport: Object.freeze({ width: 1440, height: 900 }),
    tick: 180,
  }),
  Object.freeze({
    id: 'mining-camp-desktop',
    query: 'evidenceSafe=1&telemetry=1&worldTour=mining',
    viewport: Object.freeze({ width: 1440, height: 900 }),
    tick: 180,
  }),
  // Water, foliage, and structures each need their own scene or the passes
  // that draw them are ungated.
  Object.freeze({
    id: 'liquidity-bridge-desktop',
    query: 'evidenceSafe=1&telemetry=1&worldTour=bridge',
    viewport: Object.freeze({ width: 1440, height: 900 }),
    tick: 180,
  }),
  Object.freeze({
    id: 'hashwood-foliage-desktop',
    query: 'evidenceSafe=1&telemetry=1&worldTour=hashwood',
    viewport: Object.freeze({ width: 1440, height: 900 }),
    tick: 180,
  }),
  Object.freeze({
    id: 'liquidation-yard-desktop',
    query: 'evidenceSafe=1&telemetry=1&worldTour=yard',
    viewport: Object.freeze({ width: 1440, height: 900 }),
    tick: 180,
  }),
]);

export function compareSignatures(baseline, current) {
  if (!Array.isArray(baseline) || !Array.isArray(current)) throw new TypeError('signatures must be arrays');
  if (baseline.length !== current.length) {
    return Object.freeze({ comparable: false, meanDelta: Infinity, maxDelta: Infinity, changedCells: current.length });
  }
  let total = 0;
  let maxDelta = 0;
  let changedCells = 0;
  for (let index = 0; index < baseline.length; index += 1) {
    const delta = Math.abs(baseline[index] - current[index]);
    total += delta;
    if (delta > maxDelta) maxDelta = delta;
    if (delta > SIGNATURE_TOLERANCE) changedCells += 1;
  }
  return Object.freeze({
    comparable: true,
    meanDelta: total / baseline.length,
    maxDelta,
    changedCells,
  });
}

export function classifyScene({ baseline, current }) {
  if (!baseline) return Object.freeze({ status: 'new', ...compareSignatures(current, current) });
  const comparison = compareSignatures(baseline, current);
  if (!comparison.comparable) return Object.freeze({ status: 'incomparable', ...comparison });
  const unchanged = comparison.meanDelta <= SIGNATURE_TOLERANCE
    && comparison.maxDelta <= SIGNATURE_MAX_CELL_DELTA
    && comparison.changedCells <= SIGNATURE_MAX_CHANGED_CELLS;
  return Object.freeze({ status: unchanged ? 'unchanged' : 'changed', ...comparison });
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  const accept = process.argv.includes('--accept');
  const repoRoot = fileURLToPath(new URL('..', import.meta.url));
  const portalRoot = path.join(repoRoot, 'apps', 'portal');
  const baselineDir = path.join(repoRoot, 'docs', 'testing', 'VISUAL_BASELINES', 'hmh-reboot');
  const currentDir = path.join(repoRoot, '.hermes', 'evidence', 'hmh-reboot-visual', 'current');

  for (const artifact of ['dist/hmh-reboot/game.js']) {
    if (!existsSync(path.join(portalRoot, artifact))) {
      console.error(`Missing build artifact apps/portal/${artifact}. Run: npm run build`);
      process.exit(1);
    }
  }
  await mkdir(baselineDir, { recursive: true });
  await mkdir(currentDir, { recursive: true });

  const { chromium } = await import('../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs');
  const { server, origin } = await startPortalStaticServer({ rootDir: portalRoot });
  const browser = await chromium.launch({
    executablePath: process.env.HMH_REBOOT_BROWSER_EXECUTABLE
      ?? String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,
    headless: true,
    args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', '--hide-scrollbars', '--force-device-scale-factor=1'],
  });

  const results = [];
  try {
    for (const scene of VISUAL_SCENES) {
      const page = await browser.newPage({ viewport: { ...scene.viewport }, deviceScaleFactor: 1 });
      const errors = [];
      page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
      page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });

      await page.goto(`${origin}/hmh-reboot/index.html?${scene.query}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#hmhRebootStage canvas', { timeout: 30_000 });
      // The hero atlas swaps in asynchronously. Without waiting for it the
      // capture is a race between the prototype and the production actor —
      // exactly the magnitude the per-cell bound is tuned to fail on.
      await page.waitForFunction(() => {
        const stage = document.querySelector('#hmhRebootStage');
        const actor = stage?.dataset.actorArtSource;
        const enemies = stage?.dataset.enemyArt;
        const props = stage?.dataset.authoredPropStatus;
        return actor === 'production-blender-atlas-v1'
          && enemies === 'production-roster-atlas-v1'
          && props === 'ready';
      }, undefined, { timeout: 30_000 });
      // evidenceSafe + telemetry publishes the authoritative tick, so captures
      // are pinned to simulation state rather than wall-clock timing.
      await page.waitForFunction((targetTick) => {
        const tick = Number(document.querySelector('#hmhRebootStage')?.dataset.simulationTick ?? Number.NaN);
        return Number.isFinite(tick) && tick >= targetTick;
      }, scene.tick, { timeout: 60_000 });

      // Freeze the frame before capturing. Waiting for a tick and then
      // screenshotting let the ticker keep running, so captures landed on an
      // arbitrary later tick and the tolerance had to absorb that drift.
      // Escape is the runtime's own pause path and stops the ticker.
      await page.keyboard.press('Escape');
      await page.waitForTimeout(250);
      // Pausing raises the pause dialog, which would sit over the canvas and
      // mask exactly the world we are trying to gate. Hide modal chrome; the
      // renderer keeps its last frame.
      await page.evaluate(() => {
        for (const node of document.querySelectorAll('.hmh-modal-layer')) node.style.display = 'none';
      });
      const observedTick = await page.evaluate(() => Number(document.querySelector('#hmhRebootStage')?.dataset.simulationTick ?? -1));
      await page.waitForTimeout(200);
      const settledTick = await page.evaluate(() => Number(document.querySelector('#hmhRebootStage')?.dataset.simulationTick ?? -1));
      if (settledTick !== observedTick) {
        throw new Error(`scene ${scene.id} did not settle before capture (${observedTick} -> ${settledTick})`);
      }
      // Capture the renderer canvas only, so DOM chrome (cockpit rail, pause
      // panel) cannot mask a change in the rendered world.
      const screenshot = await page.locator('#hmhRebootStage canvas').screenshot();
      await writeFile(path.join(currentDir, `${scene.id}.png`), screenshot);
      const signature = signatureFromPng(screenshot, { width: SIGNATURE_WIDTH, height: SIGNATURE_HEIGHT });
      if (signature.every((cell) => cell === signature[0])) {
        throw new Error(`scene ${scene.id} captured a uniform frame (${signature[0]}) — the renderer output was not readable`);
      }

      const baselinePath = path.join(baselineDir, `${scene.id}.json`);
      const baseline = existsSync(baselinePath)
        ? JSON.parse(await readFile(baselinePath, 'utf8'))
        : null;
      const verdict = classifyScene({ baseline: baseline?.signature ?? null, current: signature });

      if (accept || !baseline) {
        await writeFile(baselinePath, `${JSON.stringify({
          schema: VISUAL_SIGNATURE_SCHEMA,
          sceneId: scene.id,
          viewport: scene.viewport,
          tick: scene.tick,
          width: SIGNATURE_WIDTH,
          height: SIGNATURE_HEIGHT,
          signature,
        }, null, 2)}\n`, 'utf8');
      }

      results.push({
        sceneId: scene.id,
        observedTick,
        status: accept && baseline ? 'accepted' : verdict.status,
        meanDelta: Number(verdict.meanDelta.toFixed(3)),
        maxDelta: verdict.maxDelta,
        changedCells: verdict.changedCells,
        errors,
      });
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  const failures = results.filter((result) => result.errors.length > 0 || result.status === 'changed' || result.status === 'incomparable');
  console.log(JSON.stringify({
    schema: VISUAL_SIGNATURE_SCHEMA,
    tolerance: SIGNATURE_TOLERANCE,
    accepted: accept,
    baselineDir: path.relative(repoRoot, baselineDir).replaceAll('\\', '/'),
    currentDir: path.relative(repoRoot, currentDir).replaceAll('\\', '/'),
    results,
  }, null, 2));

  if (accept) {
    console.log('Visual baselines accepted. Review the PNGs before committing them.');
    process.exit(0);
  }
  if (failures.length > 0) {
    console.error(`Visual regression: ${failures.length} scene(s) changed or errored. Inspect ${path.relative(repoRoot, currentDir)} and re-run with --accept if intended.`);
    process.exit(1);
  }
  console.log(`Visual regression passed for ${results.length} scenes.`);
}

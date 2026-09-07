import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import { chromium } from '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';

function decodeScreenshotPixels(png) {
  assert.equal(png.toString('ascii', 1, 4), 'PNG', 'screenshot must be a PNG');
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const compressed = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      assert.equal(data[12], 0, 'interlaced screenshots are unsupported');
    } else if (type === 'IDAT') compressed.push(data);
    else if (type === 'IEND') break;
    offset += 12 + length;
  }
  assert.equal(bitDepth, 8, 'screenshot must use 8-bit channels');
  assert.ok(colorType === 2 || colorType === 6, 'screenshot must use RGB or RGBA pixels');
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const filtered = inflateSync(Buffer.concat(compressed));
  const pixels = Buffer.alloc(stride * height);
  const paeth = (left, above, upperLeft) => {
    const estimate = left + above - upperLeft;
    const leftDistance = Math.abs(estimate - left);
    const aboveDistance = Math.abs(estimate - above);
    const upperLeftDistance = Math.abs(estimate - upperLeft);
    return leftDistance <= aboveDistance && leftDistance <= upperLeftDistance
      ? left
      : aboveDistance <= upperLeftDistance ? above : upperLeft;
  };
  for (let y = 0; y < height; y++) {
    const filter = filtered[y * (stride + 1)];
    const source = y * (stride + 1) + 1;
    const target = y * stride;
    for (let x = 0; x < stride; x++) {
      const raw = filtered[source + x];
      const left = x >= channels ? pixels[target + x - channels] : 0;
      const above = y > 0 ? pixels[target + x - stride] : 0;
      const upperLeft = y > 0 && x >= channels ? pixels[target + x - stride - channels] : 0;
      const prediction = filter === 0 ? 0
        : filter === 1 ? left
          : filter === 2 ? above
            : filter === 3 ? Math.floor((left + above) / 2)
              : filter === 4 ? paeth(left, above, upperLeft) : NaN;
      assert.ok(Number.isFinite(prediction), `unsupported PNG filter ${filter}`);
      pixels[target + x] = (raw + prediction) & 0xff;
    }
  }
  return Object.freeze({ width, height, channels, pixels });
}

function screenshotPixelMetrics(png) {
  const { width, height, channels, pixels } = decodeScreenshotPixels(png);
  const region = Object.freeze({
    left: Math.floor(width * 0.05),
    right: Math.ceil(width * 0.95),
    top: Math.floor(height * 0.02),
    bottom: Math.ceil(height * 0.98),
  });
  let boardRegionColorfulPixels = 0;
  let boardRegionBrightPixels = 0;
  let cyanPixels = 0;
  const buckets = new Set();
  for (let y = region.top; y < region.bottom; y++) {
    for (let x = region.left; x < region.right; x++) {
      const offset = (y * width + x) * channels;
      const red = pixels[offset];
      const green = pixels[offset + 1];
      const blue = pixels[offset + 2];
      const maximum = Math.max(red, green, blue);
      const minimum = Math.min(red, green, blue);
      if (maximum - minimum >= 48 && maximum >= 96) boardRegionColorfulPixels++;
      if (red >= 150 && green >= 150 && blue >= 150) boardRegionBrightPixels++;
      if (green >= 145 && blue >= 170 && blue - red >= 60) cyanPixels++;
      buckets.add(`${red >> 4},${green >> 4},${blue >> 4}`);
    }
  }
  return Object.freeze({
    width,
    height,
    region,
    distinctColorBuckets: buckets.size,
    boardRegionColorfulPixels,
    boardRegionBrightPixels,
    cyanPixels,
  });
}

const outputArgument = process.argv.find((value) => value.startsWith('--output-dir='));
const outputDirectory = resolve(outputArgument?.slice('--output-dir='.length) || '.tmp/S12-browser');
const info = JSON.parse(await readFile('.tmp/renderer-preview-info.json', 'utf8'));
const profiles = Object.freeze([
  Object.freeze({ name: 'desktop', viewport: Object.freeze({ width: 1440, height: 900 }) }),
  Object.freeze({ name: 'mobile', viewport: Object.freeze({ width: 390, height: 844 }) }),
]);

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
});
const rows = [];

try {
  for (const profile of profiles) {
    const page = await browser.newPage({ viewport: profile.viewport, deviceScaleFactor: 1 });
    const pageErrors = [];
    const consoleMessages = [];
    const networkErrors = [];
    page.on('pageerror', (error) => pageErrors.push({ message: error.message, stack: error.stack }));
    page.on('console', (message) => consoleMessages.push({ type: message.type(), text: message.text() }));
    page.on('requestfailed', (request) => networkErrors.push({ url: request.url(), failure: request.failure() }));
    page.on('response', (response) => {
      if (response.status() >= 400) networkErrors.push({ url: response.url(), status: response.status() });
    });

    const response = await page.goto(info.url, { waitUntil: 'networkidle' });
    await page.waitForFunction(
      () => document.querySelector('#stackedStage')?.dataset.assetsReady === 'true'
        || document.querySelector('#stackedStatus')?.textContent.includes('failed'),
      { timeout: 15_000 },
    ).catch(() => {});
    const state = await page.evaluate(() => ({
      title: document.title,
      text: document.body.innerText,
      stage: { ...document.querySelector('#stackedStage')?.dataset },
      canvas: [...document.querySelectorAll('canvas')].map((canvas) => {
        const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
        return {
          width: canvas.width,
          height: canvas.height,
          preserveDrawingBuffer: context?.getContextAttributes()?.preserveDrawingBuffer ?? null,
          rect: canvas.getBoundingClientRect().toJSON(),
        };
      }),
      overflow: document.documentElement.scrollWidth > innerWidth,
    }));
    const screenshot = resolve(outputDirectory, `${profile.name}-${profile.viewport.width}x${profile.viewport.height}.png`);
    const screenshotBytes = await page.screenshot({ path: screenshot, fullPage: true });
    const pixels = screenshotPixelMetrics(screenshotBytes);
    rows.push({
      profile: profile.name,
      viewport: profile.viewport,
      status: response?.status() ?? null,
      csp: response?.headers()['content-security-policy'] ?? '',
      state,
      pageErrors,
      consoleMessages,
      networkErrors,
      pixels,
      screenshot,
    });
    await page.close();
  }
} finally {
  await browser.close();
}

await writeFile(resolve(outputDirectory, 'results.json'), `${JSON.stringify(rows, null, 2)}\n`);

let assertionFailure = null;
try {
  assert.equal(rows.length, profiles.length, 'desktop and mobile profiles must both complete');
  for (const row of rows) {
    assert.equal(row.status, 200, `${row.profile}: shell response must be HTTP 200`);
    assert.doesNotMatch(row.csp, /'unsafe-eval'|'unsafe-inline'/u, `${row.profile}: CSP must remain strict`);
    assert.equal(row.state.canvas.length, 1, `${row.profile}: exactly one canvas must mount`);
    assert.equal(row.state.canvas[0].preserveDrawingBuffer, false, `${row.profile}: compositor proof must keep preserveDrawingBuffer disabled`);
    assert.equal(row.state.stage.assetsReady, 'true', `${row.profile}: assetsReady must be true`);
    assert.equal(row.pageErrors.length, 0, `${row.profile}: page errors must be empty`);
    assert.equal(row.consoleMessages.filter(message => message.type === 'error').length, 0, `${row.profile}: console errors must be empty`);
    assert.equal(row.networkErrors.length, 0, `${row.profile}: network errors must be empty`);
    assert.ok(row.pixels.boardRegionColorfulPixels >= 1_000, `${row.profile}: compositor screenshot must contain the colored board and pieces`);
    assert.ok(row.pixels.boardRegionBrightPixels >= 100, `${row.profile}: compositor screenshot must contain bright title/HUD pixels`);
    assert.ok(row.pixels.cyanPixels >= 100, `${row.profile}: compositor screenshot must contain the cyan well/grid`);
  }
} catch (error) {
  assertionFailure = { name: error.name, message: error.message, stack: error.stack };
}

const assertionResult = { passed: assertionFailure === null, profiles: rows.length, failure: assertionFailure };
await writeFile(resolve(outputDirectory, 'assertions.json'), `${JSON.stringify(assertionResult, null, 2)}\n`);
console.log(JSON.stringify(assertionResult));
if (assertionFailure) throw Object.assign(new Error(assertionFailure.message), { name: assertionFailure.name });

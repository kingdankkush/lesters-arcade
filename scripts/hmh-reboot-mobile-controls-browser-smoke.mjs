/**
 * Mobile control certification.
 *
 * Device playtest, 2026-07-27:
 *   "When I tried playing on my phone, the movement controls didn't even work."
 *
 * Two root causes were fixed, and this harness is built so that reverting
 * either one turns it red. That property is the whole point: an earlier draft
 * of this file passed with both fixes reverted, because it dispatched every
 * synthetic pointermove to the stick element as well as the window, and never
 * made the visual viewport differ from the layout viewport.
 *
 * Scenario A — real touch input through CDP `Input.dispatchTouchEvent`, i.e.
 *   the browser's own pipeline, proving a thumb drag actually moves the hero.
 * Scenario B — pointermove delivered to the WINDOW ONLY, proving drag tracking
 *   is bound to the shared surface rather than to the small stick element.
 *   Element-bound tracking survives in Chromium because setPointerCapture
 *   works here; it is what fails on iOS Safari, and this is the assertion that
 *   stands in for that.
 * Scenario C — a visual viewport deliberately shorter than the layout
 *   viewport, which is what a phone URL bar produces. Controls must sit inside
 *   the VISIBLE region.
 */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { chromium } from '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';
import { startPortalStaticServer } from './hmh-reboot-portal-e2e.mjs';

const portalRoot = fileURLToPath(new URL('../apps/portal/', import.meta.url));
const evidenceDir = new URL('../.hermes/evidence/hmh-reboot-mobile-controls/', import.meta.url);
await mkdir(evidenceDir, { recursive: true });

const CHROME = process.env.HMH_CHROME_PATH ?? String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;
const EXPECTED_CONTROLS = ['aim', 'move', 'pause', 'power', 'weapon'];

// Real handsets, including the short landscape case where browser chrome eats
// the most vertical space.
const DEVICES = [
  { id: 'iphone-13-portrait', width: 390, height: 844 },
  { id: 'pixel-7-portrait', width: 412, height: 915 },
  { id: 'iphone-se-portrait', width: 375, height: 667 },
  { id: 'iphone-13-landscape', width: 844, height: 390 },
];

// How much shorter the visible area is than the layout viewport in scenario C.
const URL_BAR_HEIGHT = 120;

const { server, origin } = await startPortalStaticServer({ rootDir: portalRoot });
const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'],
});

const results = [];
let failures = 0;

const boxOf = async (page, control) => {
  const box = await page.locator(`[data-hmh-control="${control}"]`).boundingBox();
  assert.ok(box, `${control} has no layout box`);
  return box;
};
const centreOf = (box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

const actorPosition = async (stage) => ({
  x: Number(await stage.getAttribute('data-actor-x')),
  y: Number(await stage.getAttribute('data-actor-y')),
});

const settle = async (page, stage) => {
  // Let the hero come to rest so the next scenario measures from a still frame.
  await page.waitForTimeout(450);
  return actorPosition(stage);
};

async function openPage(device, { shrinkVisualViewport = false } = {}) {
  const context = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  if (shrinkVisualViewport) {
    // `window.visualViewport` is an accessor on Window.prototype, so an own
    // property shadows it. This models a browser whose URL bar covers the
    // bottom of the layout viewport.
    await page.addInitScript((barHeight) => {
      const fake = {
        get width() { return window.innerWidth; },
        get height() { return window.innerHeight - barHeight; },
        offsetLeft: 0, offsetTop: 0, pageLeft: 0, pageTop: 0, scale: 1,
        addEventListener() {}, removeEventListener() {},
      };
      Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => fake });
    }, URL_BAR_HEIGHT);
  }
  const errors = [];
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  await page.goto(`${origin}/hmh-reboot/?evidenceSafe=1&telemetry=1`, { waitUntil: 'networkidle' });
  const stage = page.locator('#hmhRebootStage');
  await stage.waitFor({ state: 'attached' });
  return { context, page, stage, errors };
}

for (const device of DEVICES) {
  let context;
  try {
    const opened = await openPage(device);
    context = opened.context;
    const { page, stage, errors } = opened;

    // The overlay must be reachable at all: the media query decides that.
    assert.equal(await page.locator('.hmh-touch-controls').isVisible(), true, 'touch overlay hidden on a touch device');

    const controls = await page.locator('[data-hmh-control]').evaluateAll(
      (nodes) => nodes.map((node) => node.dataset.hmhControl).sort(),
    );
    assert.deepEqual(controls, EXPECTED_CONTROLS, `unexpected control set: ${controls.join(',')}`);

    const viewport = page.viewportSize();
    for (const name of controls) {
      const box = await boxOf(page, name);
      assert.ok(box.y + box.height <= viewport.height + 0.5, `${name} extends below the visible viewport`);
      assert.ok(box.x + box.width <= viewport.width + 0.5, `${name} extends past the right edge`);
      assert.ok(box.x >= -0.5 && box.y >= -0.5, `${name} starts off-screen`);
      assert.ok(Math.min(box.width, box.height) >= 44, `${name} is below the 44px touch minimum`);
      // Hit-testing, not geometry. This catches a control buried under DOM
      // chrome — which is how the pause button failed twice while passing
      // every geometric assertion above. It cannot see canvas-drawn HUD, so
      // it is a partial check, not a complete one.
      const centre = centreOf(box);
      const topmost = await page.evaluate(
        ([x, y]) => document.elementFromPoint(x, y)?.closest('[data-hmh-control]')?.dataset.hmhControl ?? null,
        [centre.x, centre.y],
      );
      assert.equal(topmost, name, `${name} is covered by a DOM element and cannot be touched`);
    }

    const moveBox = await boxOf(page, 'move');
    const moveCentre = centreOf(moveBox);
    // Drag well past the stick radius: that is the case that broke on device.
    const dragX = moveCentre.x + moveBox.width * 0.95;

    // --- Scenario A: real touch input through the browser's own pipeline ----
    const cdp = await context.newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1, radiusX: 12, radiusY: 12, force: 1 }],
    });
    const startA = await actorPosition(stage);
    assert.ok(Number.isFinite(startA.x) && Number.isFinite(startA.y), 'hero position is not observable');
    await touch('touchStart', moveCentre.x, moveCentre.y);
    for (let step = 1; step <= 8; step += 1) {
      await touch('touchMove', moveCentre.x + (dragX - moveCentre.x) * (step / 8), moveCentre.y);
      await page.waitForTimeout(20);
    }
    await page.waitForTimeout(700);
    const heldA = await actorPosition(stage);
    await touch('touchEnd', dragX, moveCentre.y);
    const travelReal = Math.hypot(heldA.x - startA.x, heldA.y - startA.y);
    assert.ok(travelReal > 12, `real touch drag produced only ${travelReal.toFixed(2)}px of travel`);
    assert.ok(heldA.x > startA.x, 'dragging the stick right must move the hero right');

    // Releasing must stop the hero, or a dropped pointer leaves it running.
    const restA = await settle(page, stage);
    await page.waitForTimeout(400);
    const restB = await actorPosition(stage);
    assert.ok(Math.abs(restB.x - restA.x) < 2.5, 'hero kept moving after the touch ended');

    // --- Scenario B: pointermove delivered to the WINDOW ONLY --------------
    const startB = await actorPosition(stage);
    await page.evaluate(async ([sx, sy, dx]) => {
      const make = (type, x, y) => new PointerEvent(type, {
        pointerId: 77, pointerType: 'touch', isPrimary: true,
        clientX: x, clientY: y, bubbles: true, cancelable: true,
      });
      // Only the initial press touches the element. Every subsequent move goes
      // to the window and nowhere else, so an element-bound listener sees none
      // of them and the hero stays put.
      document.elementFromPoint(sx, sy).dispatchEvent(make('pointerdown', sx, sy));
      for (let step = 1; step <= 8; step += 1) {
        window.dispatchEvent(make('pointermove', sx + (dx - sx) * (step / 8), sy));
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    }, [moveCentre.x, moveCentre.y, dragX]);
    await page.waitForTimeout(700);
    const heldB = await actorPosition(stage);
    await page.evaluate(([x, y]) => {
      window.dispatchEvent(new PointerEvent('pointerup', {
        pointerId: 77, pointerType: 'touch', isPrimary: true,
        clientX: x, clientY: y, bubbles: true, cancelable: true,
      }));
    }, [dragX, moveCentre.y]);
    const travelSurface = Math.hypot(heldB.x - startB.x, heldB.y - startB.y);
    assert.ok(
      travelSurface > 12,
      `window-level pointermove produced only ${travelSurface.toFixed(2)}px — drag tracking is bound to the stick element`,
    );
    await settle(page, stage);

    await page.screenshot({ path: fileURLToPath(new URL(`${device.id}.png`, evidenceDir)) });
    assert.deepEqual(errors, [], `page errors: ${errors.join(' | ')}`);
    await context.close();
    context = null;

    // --- Scenario C: visible viewport shorter than the layout viewport -----
    const shrunk = await openPage(device, { shrinkVisualViewport: true });
    context = shrunk.context;
    const visibleHeight = device.height - URL_BAR_HEIGHT;
    for (const name of EXPECTED_CONTROLS) {
      const box = await boxOf(shrunk.page, name);
      assert.ok(
        box.y + box.height <= visibleHeight + 0.5,
        `${name} is laid out below the visible area (${(box.y + box.height).toFixed(1)} > ${visibleHeight}) — the layout is measuring innerHeight, not visualViewport`,
      );
    }
    await shrunk.page.screenshot({ path: fileURLToPath(new URL(`${device.id}-urlbar.png`, evidenceDir)) });
    await context.close();
    context = null;

    results.push({
      device: device.id,
      status: 'PASS',
      travelReal: Number(travelReal.toFixed(2)),
      travelSurface: Number(travelSurface.toFixed(2)),
    });
  } catch (error) {
    failures += 1;
    results.push({ device: device.id, status: 'FAIL', reason: String(error?.message ?? error) });
  } finally {
    if (context) await context.close();
  }
}

await browser.close();
server.close();

for (const row of results) {
  const detail = row.status === 'PASS'
    ? ` realTouch=${row.travelReal}px surfaceTracking=${row.travelSurface}px`
    : ` — ${row.reason}`;
  console.log(`${row.status} ${row.device}${detail}`);
}
console.log(`HMH_REBOOT_MOBILE_CONTROLS ${failures === 0 ? 'PASS' : 'FAIL'} devices=${results.length} failures=${failures}`);
if (failures > 0) process.exitCode = 1;

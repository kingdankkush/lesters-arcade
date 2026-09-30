// Reserved local browser window only. Builds an instrumented entry under
// .tmp, serves it through a private local route and leaves release dist/source
// unchanged. This is a correctness fixture; its fixed clock never measures FPS.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { injectAuthorityProbe } from './lib/hmh-actor-authority-injection.mjs';
import { startPortalStaticServer } from './hmh-reboot-portal-e2e.mjs';

const root = fileURLToPath(new URL('..', import.meta.url)), portal = path.join(root, 'apps/portal');
const output = path.join(root, '.tmp/hmh-actor-3d-pilot/authority'), dist = path.join(output, 'dist');
await mkdir(dist, { recursive: true });
const entry = path.join(root, 'apps/hmh-reboot/src/main.mjs');
const original = await readFile(entry, 'utf8'), instrumented = injectAuthorityProbe(original);
await writeFile(path.join(output, 'main-injected.mjs'), instrumented.source);
const shippedEntry = path.join(portal, 'dist/hmh-reboot/game.js'), shippedBefore = await readFile(shippedEntry);
await build({ absWorkingDir: root, entryPoints: { game: entry }, outdir: dist, bundle: true, splitting: true, format: 'esm',
  target: 'es2022', minify: true, write: true, logLevel: 'warning', plugins: [{ name: 'private-authority-diagnostic', setup(api) {
    api.onLoad({ filter: /main\.mjs$/ }, args => path.resolve(args.path) === entry ? { contents: instrumented.source, loader: 'js', resolveDir: path.dirname(entry) } : null);
    api.onResolve({ filter: /^pixi\.js$/ }, () => ({ path: '/dist/chunks/hmh-pixi.js', external: true }));
  } }] });
const { chromium } = await import('../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs');
const { server, origin } = await startPortalStaticServer({ rootDir: portal });
const browser = await chromium.launch({ executablePath: String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`, headless: true,
  args: ['--enable-gpu','--ignore-gpu-blocklist','--enable-webgl','--hide-scrollbars','--force-device-scale-factor=1'] });
const hash = text => createHash('sha256').update(text).digest('hex');
const diagnosticFiles = [];
for (const name of (await readdir(dist)).filter(name => name.endsWith('.js')).sort()) {
  const bytes = await readFile(path.join(dist, name)); diagnosticFiles.push({ name, bytes: bytes.length, sha256: hash(bytes) });
}
const receipt = { schema: 'hmh-actor-3d-authority-browser-v1', correctnessFixture: true, physicalPhone: false, performanceMeasured: false,
  originalSourceSha256: hash(original), injectedSourceSha256: hash(instrumented.source),
  diagnosticEntrySha256: hash(await readFile(path.join(dist, 'game.js'))), shippedEntrySha256: hash(shippedBefore),
  shippedVendorSha256: hash(await readFile(path.join(portal, 'dist/chunks/hmh-pixi.js'))), diagnosticFiles,
  inventory: instrumented.inventory, scenes: [], scopedCallbackOmissions: [
    'Simulation step/replay/projection observers: code references omitted; all own numeric state and RNG Map retained.',
    'Nav-grid cell queries/flow-field direction and enemy-navigation callbacks: implementations unchanged, complete data arrays/state retained.',
    'Nav-grid authority adopt/build/require and defeat resolve: code omitted; ready/grid/announced closure state read through pure public getters.',
    'Prototype methods are code; every own InputState property, Map and Set remains captured.',
  ] };
let activePage = null, activeErrors = [];

function fixedClock({ enabled }) {
  let now = 1000, authorityNow = 1000, previous = -1; const native = requestAnimationFrame.bind(window);
  // Asset loading receives a 1ms RAF cadence so Pixi can pump its startup
  // gate. The event timestamp stays fixed until both arms are ready: slower
  // asset loading must not create different authoritative InputState times.
  performance.now = () => authorityNow;
  window.requestAnimationFrame = callback => native(frame => {
    if (frame !== previous) {
      const data = document.querySelector('#hmhRebootStage')?.dataset;
      if (data?.startupArt !== 'ready') now += 1;
      else if (window.__actor3dAuditArmed && (!enabled || data?.actor3dStatus === 'ready' || window.__actor3dAuditAllowFallback)) { now += 1000 / 60; authorityNow += 1000 / 60; }
      previous = frame;
    }
    callback(now);
  });
}

async function routePrivateBuild(page) {
  await page.route('**/_actor3d-diagnostic/**', async route => {
    const name = new URL(route.request().url()).pathname.slice('/_actor3d-diagnostic/'.length);
    assert.match(name, /^[A-Za-z0-9_-]+\.js$/, 'owned flat diagnostic output only');
    await route.fulfill({ contentType: 'text/javascript', body: await readFile(path.join(dist, name)) });
  });
  await page.route('**/hmh-reboot/index.html?**', async route => {
    const html = await readFile(path.join(portal, 'hmh-reboot/index.html'), 'utf8');
    assert.equal(html.split('../dist/hmh-reboot/game.js').length, 2, 'exact production entry anchor');
    await route.fulfill({ contentType: 'text/html', body: html.replace('../dist/hmh-reboot/game.js', '/_actor3d-diagnostic/game.js') });
  });
}

try {
  for (const scene of [{ id: 'desktop', width: 1440, height: 900, tick: 240 }, { id: 'mobile', width: 390, height: 844, tick: 240 }]) {
    for (const enabled of [false, true]) {
      const page = await browser.newPage({ viewport: { width: scene.width, height: scene.height }, deviceScaleFactor: 1, hasTouch: scene.id === 'mobile' });
      const errors = []; page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      activePage = page; activeErrors = errors;
      await page.addInitScript(fixedClock, { enabled }); await routePrivateBuild(page);
      await page.goto(`${origin}/hmh-reboot/index.html?evidenceSafe=1&telemetry=1${enabled ? '&actor3dPilot=1' : ''}`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(({ enabled }) => globalThis.__actor3dAuthority && document.querySelector('#hmhRebootStage')?.dataset.startupArt === 'ready'
        && (!enabled || ['ready','fallback'].includes(document.querySelector('#hmhRebootStage').dataset.actor3dStatus)), { enabled }, { timeout: 30000 });
      if (enabled) assert.equal(await page.locator('#hmhRebootStage').getAttribute('data-actor3d-status'), 'ready');
      await page.evaluate(({ tick, mobile }) => {
        const stage = document.querySelector('#hmhRebootStage'); window.__actor3dAuditPaused = null;
        const canvas = stage.querySelector('canvas');
        if (mobile) {
          const stick = document.querySelector('[data-hmh-control="aim"]'), rect = stick.getBoundingClientRect();
          const pointer = { pointerId: 902, pointerType: 'touch', isPrimary: false, buttons: 1, button: 0, clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2, bubbles: true, cancelable: true };
          stick.dispatchEvent(new PointerEvent('pointerdown', pointer)); window.dispatchEvent(new PointerEvent('pointermove', { ...pointer, clientX: pointer.clientX - 45, clientY: pointer.clientY + 35 }));
        } else canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: 24, clientY: 558, pointerType: 'mouse', buttons: 0, bubbles: true }));
        let moved = false, released = false;
        const inspect = () => {
          const current = Number(stage.dataset.simulationTick ?? -1);
          if (!mobile && current >= 120 && !moved) { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', code: 'KeyD', bubbles: true })); moved = true; }
          if (!mobile && current >= 180 && !released) { window.dispatchEvent(new KeyboardEvent('keyup', { key: 'd', code: 'KeyD', bubbles: true })); released = true; }
          if (current < tick) return;
          observer.disconnect(); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
          window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', bubbles: true })); window.__actor3dAuditPaused = current;
        };
        const observer = new MutationObserver(inspect); observer.observe(stage, { attributes: true }); window.__actor3dAuditArmed = true;
      }, { tick: scene.tick, mobile: scene.id === 'mobile' });
      await page.waitForFunction(() => window.__actor3dAuditPaused !== null, undefined, { timeout: 30000 });
      const captured = await page.evaluate(() => {
        const probe = globalThis.__actor3dAuthority, before = probe.read(), evidence = probe.evidence(), after = probe.read();
        return { before, evidence, after, presentation: probe.presentation(), tick: window.__actor3dAuditPaused };
      });
      assert.equal(captured.tick, scene.tick); assert.equal(captured.before, captured.after, 'finalizing a cloned summary cannot change actual state');
      const stateHash = hash(captured.before), evidenceHash = hash(captured.evidence);
      const id = `${scene.id}-${enabled ? 'pilot' : 'baseline'}`;
      await writeFile(path.join(output, `${id}-authority.json`), captured.before); await writeFile(path.join(output, `${id}-evidence.json`), captured.evidence);
      await page.evaluate(() => { for (const element of document.querySelectorAll('.hmh-modal-layer')) element.style.display = 'none'; });
      await page.locator('#hmhRebootStage canvas').screenshot({ path: path.join(output, `${id}.png`) });
      const row = { id: scene.id, enabled, tick: captured.tick, stateHash, evidenceHash, stateBytes: Buffer.byteLength(captured.before), evidenceBytes: Buffer.byteLength(captured.evidence), presentation: captured.presentation, errors };
      receipt.scenes.push(row);
      if (enabled) {
        assert.equal(stateHash, receipt.scenes.at(-2).stateHash, `${scene.id} complete owned-state/RNG/input parity`);
        assert.equal(evidenceHash, receipt.scenes.at(-2).evidenceHash, `${scene.id} exact cloned evidence bytes`);
        const restored = await page.evaluate(async () => {
          const canvas = document.querySelector('#hmhRebootStage canvas'), gl = canvas.getContext('webgl2'), extension = gl.getExtension('WEBGL_lose_context');
          if (!extension) throw new Error('actual context-loss proof unavailable');
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('context restore timeout')), 5000);
            canvas.addEventListener('webglcontextlost', () => setTimeout(() => extension.restoreContext(), 100), { once: true });
            canvas.addEventListener('webglcontextrestored', () => { clearTimeout(timeout); resolve(); }, { once: true }); extension.loseContext();
          });
          return { ...globalThis.__actor3dAuthority.presentation(), realContextLoss: true, contextRestored: !gl.isContextLost() };
        });
        assert.equal(restored.status, 'fallback'); assert.equal(restored.actorDisplays, 0); assert.equal(restored.depthActors, 0);
        assert.equal(restored.heroRenderable, true); assert.equal(restored.weaponRenderable, true); assert.ok(restored.enemyOriginals.every(enemy => enemy.renderable));
        await page.evaluate(targetTick => {
          const stage = document.querySelector('#hmhRebootStage'); window.__actor3dAuditAllowFallback = true; window.__actor3dAuditRestoredTick = null;
          const observer = new MutationObserver(() => { if (Number(stage.dataset.simulationTick ?? -1) < targetTick) return;
            observer.disconnect(); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })); window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', bubbles: true })); window.__actor3dAuditRestoredTick = Number(stage.dataset.simulationTick); });
          observer.observe(stage, { attributes: true }); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })); window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', bubbles: true }));
        }, scene.tick + 2);
        await page.waitForFunction(() => window.__actor3dAuditRestoredTick !== null, undefined, { timeout: 10000 });
        await page.locator('#hmhRebootStage canvas').screenshot({ path: path.join(output, `${id}-context-restored.png`) });
        row.context = { ...restored, tick: await page.evaluate(() => window.__actor3dAuditRestoredTick), gpuError: await page.evaluate(() => document.querySelector('#hmhRebootStage canvas').getContext('webgl2').getError()) };
        assert.equal(row.context.gpuError, 0);
      }
      assert.deepEqual(errors, []); await page.close(); activePage = null;
    }
  }
  assert.equal(hash(await readFile(entry, 'utf8')), receipt.originalSourceSha256, 'diagnostic build cannot save over the original source');
  assert.equal(hash(await readFile(shippedEntry)), receipt.shippedEntrySha256, 'diagnostic build cannot edit shipped JS');
} catch (error) {
  receipt.failure = String(error.stack ?? error); receipt.failureErrors = activeErrors;
  if (activePage && !activePage.isClosed()) {
    receipt.failureState = await activePage.evaluate(() => ({ probe: Boolean(globalThis.__actor3dAuthority), dataset: { ...document.querySelector('#hmhRebootStage')?.dataset }, text: document.body.innerText.slice(0, 2000) })).catch(() => null);
    await activePage.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  }
  throw error;
}
finally { await writeFile(path.join(output, 'receipt.json'), JSON.stringify(receipt, null, 2)); await browser.close(); await new Promise(resolve => server.close(resolve)); }
console.log(JSON.stringify(receipt.scenes.map(({id,enabled,stateHash,evidenceHash,context,errors}) => ({id,enabled,stateHash,evidenceHash,context,errors}))));

// Presentation-only recovery witness. Run only in its reserved heavy slot.
// A private instrumented entry reads the actual mission tracker's logical
// text and bounds; the observable assertion uses compositor glyph pixels.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { injectAuthorityProbe } from './lib/hmh-actor-authority-injection.mjs';
import { startPortalStaticServer } from './hmh-reboot-portal-e2e.mjs';
import { decodePng } from './hmh-reboot-visual-regression.mjs';

const root = fileURLToPath(new URL('..', import.meta.url)), portal = path.join(root, 'apps/portal');
const phase = process.argv.includes('--red') ? 'red' : 'green';
const output = path.join(root, `.tmp/hmh-actor-3d-pilot/text-context/${phase}`), dist = path.join(output, 'dist');
await mkdir(dist, { recursive: true });
const entry = path.join(root, 'apps/hmh-reboot/src/main.mjs'), original = await readFile(entry, 'utf8');
const worldTextEntry = path.join(root, 'apps/hmh-reboot/src/world-design-life.mjs'), worldTextBefore = await readFile(worldTextEntry);
const authority = injectAuthorityProbe(original), anchor = 'presentation: () => Object.freeze({';
assert.equal(authority.source.split(anchor).length, 2, 'exact test-only presentation anchor');
const instrumented = authority.source.replace(anchor, `
    redrawPresentation: () => app.renderer.render({ container: app.stage }),
    guidance: () => {
      const text = worldLife.overlay.children[3], bounds = text.getBounds();
      const gpu = text._gpuData[app.renderer.uid], source = gpu?.texture?.source;
      const canvas = source?.resource, context = canvas?.getContext?.('2d');
      let resourceAlphaPixels = null;
      if (context && canvas.width > 0 && canvas.height > 0) {
        const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
        resourceAlphaPixels = 0; for (let at = 3; at < data.length; at += 4) if (data[at] > 0) resourceAlphaPixels++;
      }
      return Object.freeze({ text: text.text, visible: text.visible, styleKey: text.styleKey,
        bounds: Object.freeze({ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }),
        resourceType: source?.resource?.constructor?.name ?? null,
        resourceWidth: source?.resource?.width ?? null, resourceHeight: source?.resource?.height ?? null,
        textureKey: gpu?.currentKey ?? null, resourceAlphaPixels,
      });
    },
    ${anchor}`);
await writeFile(path.join(output, 'main-injected.mjs'), instrumented);
await build({ absWorkingDir: root, entryPoints: { game: entry }, outdir: dist, bundle: true, splitting: true, format: 'esm', target: 'es2022', minify: true, logLevel: 'warning',
  plugins: [{ name: 'owned-text-context-proof', setup(api) {
    api.onLoad({ filter: /main\.mjs$/ }, args => path.resolve(args.path) === entry ? { contents: instrumented, loader: 'js', resolveDir: path.dirname(entry) } : null);
    api.onResolve({ filter: /^pixi\.js$/ }, () => ({ path: '/dist/chunks/hmh-pixi.js', external: true }));
  } }] });
const hash = value => createHash('sha256').update(value).digest('hex');
const diagnosticFiles = [];
for (const name of (await readdir(dist)).filter(name => name.endsWith('.js')).sort()) {
  const bytes = await readFile(path.join(dist, name)); diagnosticFiles.push({ name, bytes: bytes.length, sha256: hash(bytes) });
}
const shippedEntry = path.join(portal, 'dist/hmh-reboot/game.js'), shippedBefore = await readFile(shippedEntry);
const receipt = { schema: 'hmh-text-context-browser-v1', phase, physicalPhone: false, performanceMeasured: false,
  originalSourceSha256: hash(original), injectedSourceSha256: hash(instrumented), diagnosticEntrySha256: hash(await readFile(path.join(dist, 'game.js'))),
  worldTextSourceSha256: hash(worldTextBefore), shippedVendorSha256: hash(await readFile(path.join(portal, 'dist/chunks/hmh-pixi.js'))), diagnosticFiles,
  shippedEntrySha256: hash(shippedBefore), scenes: [], witnessScope: 'Native tracker glyph pixels and four local world texts; no claim for all Pixi text or complete UI recovery.' };
const { chromium } = await import('../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs');
const { server, origin } = await startPortalStaticServer({ rootDir: portal });
const browser = await chromium.launch({ executablePath: String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`, headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', '--hide-scrollbars', '--force-device-scale-factor=1'] });

function clock() {
  let rafNow = 1000, previous = -1; const native = requestAnimationFrame.bind(window);
  performance.now = () => 1000;
  window.requestAnimationFrame = callback => native(frame => {
    if (frame !== previous) { if (document.querySelector('#hmhRebootStage')?.dataset.startupArt !== 'ready') rafNow += 1; previous = frame; }
    callback(rafNow);
  });
}

function readGuidanceGlyphMask(png, bounds) {
  const image = decodePng(png);
  const left = Math.max(0, Math.floor(bounds.x)), top = Math.max(0, Math.floor(bounds.y));
  const right = Math.min(image.width, Math.ceil(bounds.x + bounds.width)), bottom = Math.min(image.height, Math.ceil(bounds.y + bounds.height));
  assert.ok(right > left && bottom > top, 'actual tracker text bounds must be visible');
  const glyphs = new Set();
  for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
    const at = (y * image.width + x) * image.channels;
    if (image.pixels[at] >= 190 && image.pixels[at + 1] >= 180 && image.pixels[at + 2] >= 150) glyphs.add(y * image.width + x);
  }
  return glyphs;
}

try {
  for (const scene of [{ id: 'desktop', width: 1440, height: 900 }, { id: 'mobile', width: 390, height: 844 }]) {
    // Native sprite and optional 3D paths must both retain the actual label.
    for (const enabled of [false, true]) {
      const page = await browser.newPage({ viewport: { width: scene.width, height: scene.height }, deviceScaleFactor: 1, hasTouch: scene.id === 'mobile' });
      const errors = []; page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      await page.addInitScript(clock);
      await page.route('**/_text-context-diagnostic/**', async route => {
        const name = new URL(route.request().url()).pathname.slice('/_text-context-diagnostic/'.length);
        assert.match(name, /^[A-Za-z0-9_-]+\.js$/); await route.fulfill({ contentType: 'text/javascript', body: await readFile(path.join(dist, name)) });
      });
      await page.route('**/hmh-reboot/index.html?**', async route => {
        const html = await readFile(path.join(portal, 'hmh-reboot/index.html'), 'utf8'); assert.equal(html.split('../dist/hmh-reboot/game.js').length, 2);
        await route.fulfill({ contentType: 'text/html', body: html.replace('../dist/hmh-reboot/game.js', '/_text-context-diagnostic/game.js') });
      });
      await page.goto(`${origin}/hmh-reboot/index.html?evidenceSafe=1&telemetry=1${enabled ? '&actor3dPilot=1' : ''}`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(({ enabled }) => globalThis.__actor3dAuthority && document.querySelector('#hmhRebootStage')?.dataset.startupArt === 'ready'
        && (!enabled || document.querySelector('#hmhRebootStage').dataset.actor3dStatus === 'ready'), { enabled }, { timeout: 30000 });
      await page.evaluate(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', bubbles: true }));
        for (const node of document.querySelectorAll('.hmh-modal-layer')) node.style.display = 'none';
        globalThis.__actor3dAuthority.redrawPresentation();
      });
      const before = await page.evaluate(() => ({ guidance: globalThis.__actor3dAuthority.guidance(), state: globalThis.__actor3dAuthority.read() }));
      assert.match(before.guidance.text, /Press the generator switch/); assert.equal(before.guidance.visible, true);
      const id = `${scene.id}-${enabled ? 'pilot' : 'native'}`;
      const beforePng = await page.locator('#hmhRebootStage canvas').screenshot({ path: path.join(output, `${id}-before.png`) });
      const beforeMask = readGuidanceGlyphMask(beforePng, before.guidance.bounds), beforeGlyphs = beforeMask.size;
      assert.ok(beforeGlyphs > 100, 'RED must begin with actually drawn text');
      await page.evaluate(async () => {
        const canvas = document.querySelector('#hmhRebootStage canvas'), gl = canvas.getContext('webgl2'), extension = gl.getExtension('WEBGL_lose_context');
        if (!extension) throw new Error('real WebGL loss/restore unavailable');
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('real context restore timeout')), 5000);
          canvas.addEventListener('webglcontextlost', () => setTimeout(() => extension.restoreContext(), 100), { once: true });
          canvas.addEventListener('webglcontextrestored', () => { clearTimeout(timeout); resolve(); }, { once: true }); extension.loseContext();
        });
        globalThis.__actor3dAuthority.redrawPresentation();
      });
      const after = await page.evaluate(() => ({ guidance: globalThis.__actor3dAuthority.guidance(), state: globalThis.__actor3dAuthority.read(),
        presentation: globalThis.__actor3dAuthority.presentation(), gpuError: document.querySelector('#hmhRebootStage canvas').getContext('webgl2').getError() }));
      const afterPng = await page.locator('#hmhRebootStage canvas').screenshot({ path: path.join(output, `${id}-restored.png`) });
      const afterMask = readGuidanceGlyphMask(afterPng, after.guidance.bounds), afterGlyphs = afterMask.size;
      const glyphOverlap = [...beforeMask].filter(pixel => afterMask.has(pixel)).length / beforeGlyphs;
      const row = { id, before: before.guidance, after: after.guidance, beforeGlyphs, afterGlyphs, glyphOverlap, preservedStateHash: hash(before.state),
        stateUnchanged: before.state === after.state, presentation: after.presentation, gpuError: after.gpuError, errors, glyphRecovery: afterGlyphs >= beforeGlyphs * .9 && glyphOverlap >= .9 };
      receipt.scenes.push(row);
      assert.equal(after.guidance.text, before.guidance.text, 'mission content must survive graphics recovery');
      assert.equal(after.state, before.state, 'redraw/recovery cannot alter owned authority'); assert.equal(after.gpuError, 0); assert.deepEqual(errors, []);
      assert.ok(row.glyphRecovery, `${id} restored guidance glyphs: ${afterGlyphs}/${beforeGlyphs}, overlap ${glyphOverlap}`);
      await page.close();
    }
  }
  assert.equal(hash(await readFile(entry, 'utf8')), receipt.originalSourceSha256);
  assert.equal(hash(await readFile(shippedEntry)), receipt.shippedEntrySha256);
} catch (error) { receipt.failure = String(error.stack ?? error); throw error; }
finally {
  receipt.originalSourceAfterSha256 = hash(await readFile(entry, 'utf8'));
  receipt.worldTextSourceAfterSha256 = hash(await readFile(worldTextEntry));
  receipt.shippedEntryAfterSha256 = hash(await readFile(shippedEntry));
  receipt.sourceAndShippedUnchanged = receipt.originalSourceAfterSha256 === receipt.originalSourceSha256 && receipt.shippedEntryAfterSha256 === receipt.shippedEntrySha256 && receipt.worldTextSourceAfterSha256 === receipt.worldTextSourceSha256;
  await writeFile(path.join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  await browser.close(); await new Promise(resolve => server.close(resolve));
}
console.log(JSON.stringify(receipt.scenes.map(({id,beforeGlyphs,afterGlyphs,stateUnchanged,glyphRecovery})=>({id,beforeGlyphs,afterGlyphs,stateUnchanged,glyphRecovery}))));

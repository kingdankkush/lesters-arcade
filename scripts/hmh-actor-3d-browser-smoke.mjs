// Two-instance opening proof, not a performance or physical-phone gate.
// Run under the shared heavy lock after build.mjs. Screenshots are captured
// by the compositor; deterministic RAF cadence is never reported as FPS.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startPortalStaticServer } from './hmh-reboot-portal-e2e.mjs';
import { signatureFromPng } from './hmh-reboot-visual-regression.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = path.join(root, '.tmp/hmh-actor-3d-pilot/browser');
await mkdir(output, { recursive: true });
const { chromium } = await import('../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs');
const { server, origin } = await startPortalStaticServer({ rootDir: path.join(root, 'apps/portal') });
const browser = await chromium.launch({ executablePath: String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`, headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', '--hide-scrollbars', '--force-device-scale-factor=1'] });
const receipt = { classification: 'unapproved-two-instance-browser-proof', physicalPhone: false, performanceMeasured: false, scenes: [], fixture: null };

function monitorGl() {
  window.__actor3dGl = { screenDraws: 0, probeDraws: 0, depthDraws: 0, depthClears: 0, palettes: new Set(), sequence: [] };
  const programs = new WeakMap();
  for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
    const draw = proto.drawElements, clear = proto.clear;
    proto.drawElements = function (...args) {
      const program = this.getParameter(this.CURRENT_PROGRAM); let actor = programs.get(program);
      if (actor === undefined) {
        actor = false;
        for (let i = 0; i < this.getProgramParameter(program, this.ACTIVE_UNIFORMS); i++) if (this.getActiveUniform(program, i).name.startsWith('uJoints')) actor = true;
        programs.set(program, actor);
      }
      const result = draw.apply(this, args), screen = this.getParameter(this.FRAMEBUFFER_BINDING) === null;
      if (screen) window.__actor3dGl.sequence.push(actor ? 'actor' : 'pixi-2d');
      if (actor) {
        window.__actor3dGl[screen ? 'screenDraws' : 'probeDraws']++;
        if (this.isEnabled(this.DEPTH_TEST)) window.__actor3dGl.depthDraws++;
        const joints = this.getUniform(program, this.getUniformLocation(program, 'uJoints[0]'));
        window.__actor3dGl.palettes.add(Array.from(joints ?? []).map(v => v.toFixed(4)).join(','));
      }
      // The backend owns gl.getError() after preflight; do not consume it here.
      return result;
    };
    proto.clear = function (mask) { if (mask & this.DEPTH_BUFFER_BIT) window.__actor3dGl.depthClears++; return clear.call(this, mask); };
  }
}
function fixedFrames({ enabled }) {
  const native = requestAnimationFrame.bind(window); let now = 1000, previous = -1;
  performance.now = () => now;
  window.requestAnimationFrame = callback => native(frame => {
    if (frame !== previous) {
      const stage = document.querySelector('#hmhRebootStage'), ready = stage?.dataset.startupArt === 'ready';
      const pilotReady = !enabled || stage?.dataset.actor3dStatus === 'ready';
      now += ready ? (pilotReady && window.__hmhVisualCaptureArmed ? 17 : 0) : 1; previous = frame;
    }
    callback(now);
  });
}

try {
  for (const scene of [{ id: 'desktop', width: 1440, height: 900, tick: 90 }, { id: 'mobile', width: 390, height: 844, tick: 240 }]) {
    for (const enabled of [false, true]) {
      const page = await browser.newPage({ viewport: { width: scene.width, height: scene.height }, deviceScaleFactor: 1, hasTouch: scene.id === 'mobile' });
      const errors = [], requests = []; page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      page.on('request', request => requests.push(new URL(request.url()).pathname));
      await page.addInitScript(monitorGl); await page.addInitScript(fixedFrames, { enabled });
      await page.goto(`${origin}/hmh-reboot/index.html?evidenceSafe=1&telemetry=1${enabled ? '&actor3dPilot=1' : ''}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#hmhRebootStage canvas');
      await page.evaluate(({ tick, mobile, enabled }) => {
        const stage = document.querySelector('#hmhRebootStage'); window.__hmhVisualPauseTick = null; let aimed = false;
        const inspect = () => {
          if (stage.dataset.startupArt === 'ready' && !aimed) {
            if (mobile) {
              const stick = document.querySelector('[data-hmh-control="aim"]'), rect = stick.getBoundingClientRect();
              const pointer = { pointerId: 902, pointerType: 'touch', isPrimary: false, buttons: 1, button: 0, clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2, bubbles: true, cancelable: true };
              stick.dispatchEvent(new PointerEvent('pointerdown', pointer));
              window.dispatchEvent(new PointerEvent('pointermove', { ...pointer, clientX: pointer.clientX - 45, clientY: pointer.clientY + 35 }));
            } else stage.querySelector('canvas').dispatchEvent(new PointerEvent('pointermove', { clientX: 24, clientY: 558, pointerType: 'mouse', buttons: 0, bubbles: true }));
            aimed = true;
          }
          if (stage.dataset.startupArt === 'ready' && (!enabled || stage.dataset.actor3dStatus === 'ready')) window.__hmhVisualCaptureArmed = true;
          if (Number(stage.dataset.simulationTick ?? -1) < tick) return;
          observer.disconnect(); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
          window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', bubbles: true })); window.__hmhVisualPauseTick = Number(stage.dataset.simulationTick);
        };
        const observer = new MutationObserver(inspect); observer.observe(stage, { attributes: true }); inspect();
      }, { tick: scene.tick, mobile: scene.id === 'mobile', enabled });
      await page.waitForFunction(() => window.__hmhVisualPauseTick !== null || document.querySelector('#hmhRebootStage')?.dataset.actor3dStatus === 'fallback', undefined, { timeout: 45000 }).then(async () => {
        if (enabled && await page.locator('#hmhRebootStage').getAttribute('data-actor3d-status') === 'fallback') throw new Error('pilot entered fallback');
      }).catch(async error => {
        await writeFile(path.join(output, `${scene.id}-${enabled ? 'pilot' : 'baseline'}-failure.json`), JSON.stringify({ errors,
          runtime: await page.locator('#hmhRebootStage').evaluate(stage => ({ ...stage.dataset })).catch(() => null),
          capabilities: await page.evaluate(() => { const gl = document.querySelector('#hmhRebootStage canvas')?.getContext('webgl2'); return gl && {
            attrs: gl.getContextAttributes(), version: gl.getParameter(gl.VERSION), depthBits: gl.getParameter(gl.DEPTH_BITS),
            vertexUniformVectors: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS), framebufferBound: gl.getParameter(gl.FRAMEBUFFER_BINDING) !== null,
          }; }).catch(() => null),
          body: await page.locator('body').innerText().catch(() => null) }, null, 2));
        await page.screenshot({ path: path.join(output, `${scene.id}-${enabled ? 'pilot' : 'baseline'}-failure.png`) }).catch(() => {});
        throw error;
      });
      const runtime = await page.locator('#hmhRebootStage').evaluate(stage => ({ ...stage.dataset }));
      await page.evaluate(() => { for (const node of document.querySelectorAll('.hmh-modal-layer')) node.style.display = 'none'; });
      const png = await page.locator('#hmhRebootStage canvas').screenshot({ path: path.join(output, `${scene.id}-${enabled ? 'pilot' : 'baseline'}.png`) });
      const gpu = await page.evaluate(() => ({ ...window.__actor3dGl, palettes: window.__actor3dGl.palettes.size, sequence: undefined }));
      const checkpoint = Object.fromEntries(['simulationTick', 'actorX', 'actorY', 'targetX', 'targetHealth', 'enemyArchetypes', 'projectileCount', 'projectileDrops',
        'runScore', 'runXp', 'runLevel', 'weaponId', 'weaponAmmo', 'weaponHeat', 'aimDirectionX', 'aimDirectionY', 'groundZ', 'surfaceId'].map(key => [key, runtime[key]]));
      const checkpointHash = createHash('sha256').update(JSON.stringify(checkpoint)).digest('hex');
      assert.equal(runtime.simulationTick, String(scene.tick)); assert.equal(errors.length, 0, errors.join('\n'));
      if (enabled) { assert.equal(runtime.actor3dStatus, 'ready'); assert.equal(runtime.actor3dCount, '2'); assert.ok(gpu.screenDraws > 0 && gpu.probeDraws >= 12 && gpu.depthDraws > 0 && gpu.depthClears > 0 && gpu.palettes > 1); }
      else { assert.equal(runtime.actor3dStatus, 'disabled'); assert.ok(!requests.some(url => url.includes('actor-3d') || url.endsWith('.glb'))); assert.equal(gpu.screenDraws, 0); }
      receipt.scenes.push({ id: scene.id, enabled, checkpoint, checkpointHash, gpu, runtime, screenshot: `${scene.id}-${enabled ? 'pilot' : 'baseline'}.png`, signature: signatureFromPng(png) });
      if (enabled) assert.equal(checkpointHash, receipt.scenes.at(-2).checkpointHash, `${scene.id} authoritative checkpoint parity`);
      await page.close();
    }
  }
  const files = await readdir(path.join(root, 'apps/portal/dist/chunks'));
  const controller = files.find(file => /^actor-3d-controller-.*\.js$/.test(file)), backend = files.find(file => /^actor-3d-pixi-.*\.js$/.test(file));
  assert.ok(controller && backend, 'lazy controller and backend chunks must exist');
  const page = await browser.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(monitorGl);
  await page.route('**/actor-3d-proof.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>' }));
  await page.goto(`${origin}/actor-3d-proof.html`);
  await page.evaluate(async ({ controller, backend }) => {
    // Isolated Pixi integration fixture reuses the actual compiled pilot and
    // an existing native world prop; it does not manipulate game simulation.
    document.body.replaceChildren();
    const pixi = await import('/dist/chunks/hmh-pixi.js');
    const { createActor3dPilotController } = await import(`/dist/chunks/${controller}`);
    const { createActor3dPixiBackend } = await import(`/dist/chunks/${backend}`);
    const app = new pixi.Application(); await app.init({ width: 800, height: 600, background: '#243540', preference: 'webgl', antialias: true }); app.ticker.stop(); document.body.append(app.canvas);
    const layer = new pixi.RenderLayer({ sortableChildren: true }); app.stage.addChild(layer);
    const metadata = await (await fetch('/assets/generated/hmh-world-design/world-design.json')).json();
    const frame = metadata.frames.find(frame => frame.assetId === 'hmh-ld2-53-bus-shelter').tiers.desktop;
    const atlas = await pixi.Assets.load(`/assets/generated/hmh-world-design/${metadata.tiers.desktop.pages[0].image}`);
    const prop = new pixi.Sprite({ texture: new pixi.Texture({ source: atlas.source, frame: new pixi.Rectangle(frame.frame.x, frame.frame.y, frame.frame.w, frame.frame.h) }) });
    prop.label = 'existing-native-bus-shelter'; prop.anchor.set(frame.anchor.x, frame.anchor.y); prop.position.set(400, 320); prop.scale.set(frame.runtimeScale * 80, frame.runtimeScale * frame.projectionY * 80); prop.zIndex = -1; app.stage.addChild(prop); layer.attach(prop);
    const originals = [new pixi.Graphics().rect(-8, -40, 16, 40).fill('#ff00ff'), new pixi.Graphics().rect(-8, -40, 16, 40).fill('#00ffff')];
    const attached = []; const pilot = createActor3dPilotController({ renderer: app.renderer, canvas: app.canvas,
      attachDisplay: display => { app.stage.addChild(display); layer.attach(display); attached.push(display); },
      backendFactory: async options => createActor3dPixiBackend({ renderer: app.renderer, ...options }) });
    const status = await pilot.start(); if (status !== 'ready') throw new Error(`fixture ${status}`);
    const entries = [{ descriptor: { id: 'hero', actorId: 'lit-commando', x: 0, y: 0, z: 0, heading: Math.PI / 2, clip: 'idle', clipTimeSeconds: 0, pixelsPerMetre: 80 }, originals: [originals[0]] },
      { descriptor: { id: 'enemy', actorId: 'bagholder-rusher', x: 0, y: 0, z: 0, heading: Math.PI / 2, clip: 'idle', clipTimeSeconds: 0, pixelsPerMetre: 80 }, originals: [originals[1]] }];
    const camera = { x: 0, y: 0, zoom: 1, shakeX: 0, shakeY: 0 }, view = { width: 800, height: 600 };
    if (!pilot.update(entries, camera, view)) throw new Error('fixture GPU preflight failed'); app.render();
    window.__fixture = { app, pilot, prop, layer, attached, entries, originals, camera, view, frame, errors: [] };
  }, { controller, backend });
  await page.locator('canvas').screenshot({ path: path.join(output, 'depth-tied-native-prop-behind.png') });
  const fixture = await page.evaluate(() => {
    const f = window.__fixture, before = f.layer.renderLayerChildren.map(child => child.label); f.prop.zIndex = 1; f.app.render();
    const after = f.layer.renderLayerChildren.map(child => child.label);
    const bounds = f.attached.map(actor => ({ id: actor.pilotId, primitives: actor.children.filter(mesh => mesh.visible).map(mesh => ({ minX: mesh.bounds.minX, minY: mesh.bounds.minY, maxX: mesh.bounds.maxX, maxY: mesh.bounds.maxY })), drawProven: actor.pilotDrawProven }));
    return { before, after, bounds, gpuError: f.app.renderer.gl.getError(), contextDepth: f.app.renderer.gl.getContextAttributes().depth, webGLVersion: f.app.renderer.context.webGLVersion, legacyPropProjectionY: f.frame.projectionY };
  });
  await page.locator('canvas').screenshot({ path: path.join(output, 'depth-tied-native-prop-front.png') });
  assert.equal(fixture.gpuError, 0); assert.equal(fixture.contextDepth, true); assert.ok(fixture.bounds.every(actor => actor.drawProven));
  assert.equal(fixture.before[0], 'existing-native-bus-shelter'); assert.equal(fixture.after.at(-1), 'existing-native-bus-shelter');
  fixture.gpuRulers = await page.evaluate(() => {
    // Transform feedback runs the actual Mesh vertex source and reports its
    // projected 1m basis, with identity skin and world matrices. All diagnostic
    // GL resources belong to this fixture and are released before Pixi resumes.
    const f = window.__fixture, gl = f.app.renderer.gl, source = f.attached[0].children[0].shader.glProgram;
    const vertex = gl.createShader(gl.VERTEX_SHADER), fragment = gl.createShader(gl.FRAGMENT_SHADER), program = gl.createProgram();
    const vao = gl.createVertexArray(), input = gl.createBuffer(), output = gl.createBuffer(), feedback = gl.createTransformFeedback();
    try {
      for (const [shader, text] of [[vertex, source.vertex], [fragment, source.fragment]]) {
        gl.shaderSource(shader, text); gl.compileShader(shader); if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader)); gl.attachShader(program, shader);
      }
      gl.transformFeedbackVaryings(program, ['vPilotPosition'], gl.SEPARATE_ATTRIBS); gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
      gl.useProgram(program); gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, input);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'aSourcePosition'); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 0, 0);
      for (const [name, value] of [['aNormal', [0, 1, 0, 0]], ['aUV', [0, 0, 0, 0]], ['aJoints', [0, 0, 0, 0]], ['aWeights', [1, 0, 0, 0]], ['aTangent', [1, 0, 0, 1]]]) {
        const location = gl.getAttribLocation(program, name); if (location >= 0) { gl.disableVertexAttribArray(location); gl.vertexAttrib4fv(location, value); }
      }
      const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), joints = new Float32Array(32 * 16);
      for (let i = 0; i < 32; i++) joints.set(identity, i * 16);
      gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uJoints[0]'), false, joints);
      for (const name of ['uProjectionMatrix', 'uWorldTransformMatrix', 'uTransformMatrix']) gl.uniformMatrix3fv(gl.getUniformLocation(program, name), false, new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]));
      gl.uniform4fv(gl.getUniformLocation(program, 'uView'), new Float32Array([1, 0, 80, 0])); gl.uniform1f(gl.getUniformLocation(program, 'uDepthHalfWidth'), .1);
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, feedback); gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, output); gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER, 4 * 3 * 4, gl.STREAM_READ); gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, output);
      gl.enable(gl.RASTERIZER_DISCARD); gl.beginTransformFeedback(gl.POINTS); gl.drawArrays(gl.POINTS, 0, 4); gl.endTransformFeedback(); gl.disable(gl.RASTERIZER_DISCARD);
      const result = new Float32Array(12); gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER, 0, result);
      const error = gl.getError(); if (error) throw new Error(`GPU ruler error ${error}`); return Array.from(result);
    } finally {
      gl.disable(gl.RASTERIZER_DISCARD); gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null); gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null); gl.bindVertexArray(null);
      gl.deleteTransformFeedback(feedback); gl.deleteBuffer(input); gl.deleteBuffer(output); gl.deleteVertexArray(vao); gl.deleteProgram(program); gl.deleteShader(vertex); gl.deleteShader(fragment); f.app.renderer.resetState();
    }
  });
  for (const [index, x, y] of [[0, 0, 0], [1, 80, 0], [2, 0, 80], [3, 0, -80]]) {
    assert.ok(Math.abs(fixture.gpuRulers[index * 3] - x) < .001 && Math.abs(fixture.gpuRulers[index * 3 + 1] - y) < .001, 'actual vertex shader 1m ruler calibration');
  }
  fixture.cleanup = await page.evaluate(async () => {
    const f = window.__fixture;
    for (let i = 0; i < 20; i++) { f.entries[1].descriptor.id = `enemy-${i}`; f.entries[1].descriptor.y = i % 2 ? .001 : -.001; f.pilot.update(f.entries, f.camera, f.view); f.app.render(); }
    const childCount = f.layer.renderLayerChildren.length;
    const gl = f.app.renderer.gl, extension = gl.getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('real context-loss diagnostic unavailable');
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('real context restore timed out')), 5000);
      f.app.canvas.addEventListener('webglcontextlost', () => setTimeout(() => extension.restoreContext(), 100), { once: true });
      f.app.canvas.addEventListener('webglcontextrestored', () => { clearTimeout(timeout); resolve(); }, { once: true });
      extension.loseContext();
    });
    const status = f.pilot.status, restored = f.originals.every(display => display.renderable), remaining = f.layer.renderLayerChildren.map(child => child.label);
    f.pilot.dispose(); f.app.render(); const gpuError = f.app.renderer.gl.getError();
    return { childCount, status, restored, remaining, gpuError, realContextLoss: true, contextRestored: !gl.isContextLost() };
  });
  await page.locator('canvas').screenshot({ path: path.join(output, 'real-context-restored-native-prop.png') });
  await page.evaluate(() => window.__fixture.app.destroy(true));
  assert.equal(fixture.cleanup.childCount, 3); assert.equal(fixture.cleanup.status, 'fallback'); assert.equal(fixture.cleanup.restored, true); assert.equal(fixture.cleanup.remaining.length, 1); assert.equal(fixture.cleanup.gpuError, 0); assert.equal(errors.length, 0, errors.join('\n'));
  receipt.fixture = fixture; await page.close();
} catch (error) { receipt.failure = String(error.stack ?? error); throw error; }
finally {
  await writeFile(path.join(output, 'receipt.json'), JSON.stringify(receipt, null, 2)); await browser.close(); await new Promise(resolve => server.close(resolve));
}
console.log(JSON.stringify({ scenes: receipt.scenes.map(({ id, enabled, checkpointHash, gpu }) => ({ id, enabled, checkpointHash, gpu })), fixture: receipt.fixture }));

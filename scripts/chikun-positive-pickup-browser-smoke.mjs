import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from 'acorn';

const repo = path.resolve(process.env.CHIKUN_REPO_ROOT || fileURLToPath(new URL('..', import.meta.url)));
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE_PATH || 'playwright');
const { flapTicksOf, replayChikunRun } = await import(pathToFileURL(repo + '/apps/portal/src/chikun-cabinet.mjs'));
const fixtures = JSON.parse(await readFile(repo + '/tests/fixtures/chikun-v6-replays.json', 'utf8'));
const recording = fixtures.runs.find(run => run.seed === 422250483) ?? fixtures.runs[0];
const taps = flapTicksOf(recording.evidence);
const origin = process.env.CHIKUN_PORTAL_ORIGIN || 'http://127.0.0.1:8799';
const out = path.resolve(process.env.CHIKUN_QA_OUTPUT || '.tmp/chikun-positive-pickup');
const meta = JSON.parse(await readFile(path.join(repo, 'apps/portal/dist/meta.json'), 'utf8'));
const domOutputs = Object.entries(meta.outputs).filter(([, output]) => Object.keys(output.inputs ?? {}).includes('apps/chikun/src/coin-feedback-dom.mjs'));
assert.equal(domOutputs.length, 1, 'build must identify exactly one lazy feedback module');
const domChunkPath = '/' + domOutputs[0][0].replaceAll('\\', '/').replace(/^apps\/portal\//, '');
await mkdir(out, { recursive: true });
const lateImportOnly = process.argv.includes('--late-import-only');
const removeDisposeGuard = process.argv.includes('--remove-dispose-guard');
assert.ok(!removeDisposeGuard || lateImportOnly, 'negative control is limited to the delayed-import proof');
let negativeControl;
if (removeDisposeGuard) {
  // Private served bytes only. The authored source and built entry remain untouched.
  const original = await readFile(path.join(repo, 'apps/portal/dist/chikun/game.js'), 'utf8');
  const matches = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'CallExpression' && node.callee?.type === 'MemberExpression' && node.callee.property?.name === 'then'
      && node.callee.object?.type === 'ImportExpression' && String(node.callee.object.source.value).endsWith(path.posix.basename(domChunkPath))) {
      const callback = node.arguments[0], guard = callback?.body?.body?.[0];
      assert.equal(callback.type, 'ArrowFunctionExpression');
      assert.equal(guard.type, 'IfStatement'); assert.equal(guard.test.type, 'Identifier');
      assert.equal(guard.consequent.type, 'ReturnStatement'); assert.equal(guard.consequent.argument, null); assert.equal(guard.alternate, null);
      matches.push(guard);
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === 'object') visit(value);
    }
  }
  visit(parse(original, { ecmaVersion: 'latest', sourceType: 'module' }));
  assert.equal(matches.length, 1, 'negative control must identify exactly one lazy-import disposal guard');
  const guard = matches[0], served = original.slice(0, guard.start) + original.slice(guard.end);
  const sha256 = value => createHash('sha256').update(value).digest('hex');
  negativeControl = { body: served, originalSha256: sha256(original), servedSha256: sha256(served), removedGuard: original.slice(guard.start, guard.end), servedCount: 0 };
}

// Controlled browser frame/input scheduling for result identity. This is not an FPS measurement.
function clock() {
  let now = 1000, frames = 0, id = 0; const callbacks = new Map();
  Object.defineProperty(performance, 'now', { value: () => now });
  window.requestAnimationFrame = fn => { callbacks.set(++id, fn); return id; };
  window.cancelAnimationFrame = id => callbacks.delete(id);
  window.__advance = count => {
    for (let i = 0; i < count; i++) {
      now = 1000 + ++frames * 1000 / 60; const pending = [...callbacks.values()]; callbacks.clear();
      for (const fn of pending) fn(now);
    }
  };
  window.__pendingFrames = () => callbacks.size;
  window.__closedPorts = 0;
  const close = MessagePort.prototype.close;
  MessagePort.prototype.close = function (...args) { window.__closedPorts++; return close.apply(this, args); };
  window.__audioStarts = [];
  for (const [type, proto] of [['buffer', globalThis.AudioBufferSourceNode?.prototype], ['oscillator', globalThis.OscillatorNode?.prototype]]) {
    if (!proto) continue; const original = proto.start;
    proto.start = function (...args) { window.__audioStarts.push({ type, pitch: this.playbackRate?.value ?? 1, frequency: this.frequency?.value ?? 0 }); return original.apply(this, args); };
  }
}

function host(candidate, reduced) {
  const suffix = candidate ? '?coinFeedback=positive-v1' : '';
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#071020}iframe{border:0;display:block;width:100%;height:100%}</style></head><body><iframe id="game" src="/chikun/index.html${suffix}" title="Chikun Free Mode"></iframe><script type="module">
import {createChikunParentBridge} from '/src/chikun-bridge.mjs';
window.__messages=[]; window.__protocolErrors=[];
const iframe=document.querySelector('#game');
const bridge=createChikunParentBridge({iframe,expectedOrigin:location.origin,session:{sessionId:'coin-feedback-local',gameId:'chikun',mode:'free',profile:{displayName:'Local presentation check',locale:'en'},session:{seed:${recording.seed},buildHash:'local-coin-feedback',seasonId:'local-presentation',rankedEligible:false},settings:{musicEnabled:true,reduceMotion:${reduced}}},onMessage:m=>__messages.push(m),onProtocolError:e=>__protocolErrors.push(e.message)});
const connect=()=>{if(!bridge.connected)bridge.connect();};
iframe.addEventListener('load',connect,{once:true});
if(iframe.contentDocument?.readyState==='complete'&&iframe.contentWindow.location.pathname==='/chikun/index.html')connect();
window.__bridge=bridge;
</script></body></html>`;
}

function installDriver(taps) {
  const tapSet = new Set(taps); let frameIndex = 0, peak = 0, firstPickupFrame = -1;
  window.__drive = (frames, allowTaps = true) => {
    for (let i = 0; i < frames; i++) {
      if (allowTaps && tapSet.has(frameIndex)) {
        const canvas = document.querySelector('#chikunCanvas');
        canvas.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
        canvas.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space', bubbles: true }));
      }
      __advance(1); frameIndex++; peak = Math.max(peak, document.querySelectorAll('[data-coin-flight]').length);
      if (firstPickupFrame < 0 && Number(document.querySelector('#coinValue').textContent) > 0) firstPickupFrame = frameIndex;
    }
    return { frameIndex, peak, firstPickupFrame, coins: Number(document.querySelector('#coinValue').textContent), phase: document.querySelector('#gameShell').dataset.phase };
  };
  let state; do { state = __drive(1); } while (state.firstPickupFrame < 0 && state.phase === 'running' && state.frameIndex < 3000);
  return state;
}

const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const report = { schema: 'chikun-positive-pickup-browser-v1', recordedAt: new Date().toISOString(), physicalPhoneTested: false,
  proofMode: lateImportOnly ? 'delayed-import-only' : 'complete', negativeControl: negativeControl && { ...negativeControl, body: undefined },
  frameScheduling: 'controlled real browser frames and real child input handlers; not performance or physical acceptance', lazyModule: domChunkPath, cases: [], safetyCases: [], errors: [] };
let activePage, activeName;
try {
  let baseline;
  if (!lateImportOnly) for (const [name, candidate, reduced, viewport, dpr] of [
    ['desktop-before', false, false, { width: 1440, height: 900 }, 1],
    ['desktop-positive', true, false, { width: 1440, height: 900 }, 1],
    ['phone-positive', true, false, { width: 414, height: 896 }, 3],
    ['phone-reduced', true, true, { width: 414, height: 896 }, 3],
  ]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: dpr, hasTouch: name.startsWith('phone'), serviceWorkers: 'block', reducedMotion: reduced ? 'reduce' : 'no-preference' });
    await context.addInitScript(clock);
    const page = await context.newPage(), errors = [], domRequests = [];
    activePage = page; activeName = name;
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (new URL(request.url()).pathname === domChunkPath) domRequests.push(request.url()); });
    await page.route('**/coin-feedback-host', route => route.fulfill({ status: 200, contentType: 'text/html', body: host(candidate, reduced) }));
    await page.goto(origin + '/coin-feedback-host', { waitUntil: 'networkidle' });
    const element = await page.waitForSelector('#game'), frame = await element.contentFrame();
    await page.waitForFunction(() => __messages.some(message => message.type === 'game:ready'), null, { polling: 50 });
    await frame.waitForFunction(() => !document.querySelector('#startButton').disabled, null, { polling: 50 });
    if (candidate) await frame.waitForFunction(() => document.querySelector('#gameShell').dataset.coinFeedback === 'ready', null, { polling: 50 });
    else assert.equal(domRequests.length, 0, 'default-off must not fetch the lazy feedback system');
    await frame.evaluate(() => __advance(2));
    await frame.locator('#startButton').click();
    // Audio completes on its native clock; game frames remain under harness control.
    await page.waitForTimeout(350);
    const observed = await frame.evaluate(installDriver, taps);
    assert.ok(observed.coins > 0, `${name}: actual coin pickup required`);
    await frame.evaluate(() => __drive(4));
    const geometry = await frame.evaluate(() => {
      const box = node => { const rect = node.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }; };
      return { status: document.querySelector('#gameShell').dataset.coinFeedback, coins: Number(document.querySelector('#coinValue').textContent),
        flights: [...document.querySelectorAll('[data-coin-flight]')].map(box), counter: box(document.querySelector('#coinValue')), overflow: document.body.scrollWidth > innerWidth };
    });
    if (candidate && !reduced) assert.ok(geometry.flights.length > 0 && geometry.flights.length <= 4);
    if (reduced) assert.equal(geometry.flights.length, 0);
    assert.equal(geometry.overflow, false);
    await page.screenshot({ path: path.join(out, name + '.png'), fullPage: true });
    await frame.evaluate(() => __drive(40));
    const afterFlight = await frame.evaluate(() => ({ flights: document.querySelectorAll('[data-coin-flight]').length, arrivals: Number(document.querySelector('#coinValue').dataset.coinFeedbackArrivals ?? 0) }));
    if (candidate) assert.ok(afterFlight.arrivals > 0);
    await page.waitForTimeout(600);
    const muteCheck = name === 'phone-positive' ? { before: await frame.evaluate(() => ({ starts: __audioStarts.length, coins: Number(document.querySelector('#coinValue').textContent) })) } : null;
    // Portrait exposes sound in the pause menu. Exercise that real control;
    // every case pauses/resumes here so frame/input scheduling remains identical.
    await frame.locator('#pauseButton').click();
    if (muteCheck) await frame.locator('#pauseMuteButton').click();
    await frame.locator('#resumeButton').click();
    // Every switch/orientation gets this same live input prefix.
    await frame.evaluate(() => __drive(1200));
    if (muteCheck) {
      assert.ok(muteCheck.before.starts > 0, 'native sound started before mute');
      muteCheck.after = await frame.evaluate(() => ({ starts: __audioStarts.length, coins: Number(document.querySelector('#coinValue').textContent) }));
      assert.ok(muteCheck.after.coins > muteCheck.before.coins, 'real pickups occurred while muted');
      assert.equal(muteCheck.after.starts, muteCheck.before.starts, 'muted positive pickups started no sound');
    }
    // Complete a real run with the same physical input sequence in both switches.
    await frame.evaluate(() => { let state; do { state = __drive(60, false); } while (state.phase === 'running' && state.frameIndex < 8000); return state; });
    await page.waitForFunction(() => __messages.some(message => message.type === 'game:result'), null, { polling: 50 });
    const payload = await page.evaluate(() => __messages.find(message => message.type === 'game:result').payload);
    const replay = replayChikunRun(payload.evidence);
    assert.equal(replay.score, payload.score); assert.deepEqual(replay.finalState, payload.finalState);
    if (baseline) {
      assert.deepEqual(payload.evidence, baseline.evidence, 'switch/orientation must preserve exact recorded evidence');
      assert.deepEqual(payload.finalState, baseline.finalState, 'switch/orientation must preserve canonical result');
    } else baseline = payload;
    const audio = await frame.evaluate(() => __audioStarts);
    const protocolErrors = await page.evaluate(() => __protocolErrors);
    const runtimeErrors = await page.evaluate(() => __messages.filter(message => message.type === 'game:error'));
    assert.deepEqual(errors, []); assert.deepEqual(protocolErrors, []);
    assert.deepEqual(runtimeErrors, [], 'the frame guard must not conceal a failed live frame');
    await page.evaluate(() => __bridge.send('portal:dispose', {}));
    await frame.waitForFunction(() => __closedPorts > 0, null, { polling: 50 });
    assert.equal(await frame.evaluate(() => { __advance(2); return __pendingFrames(); }), 0, 'disposed loop schedules no more frames');
    assert.equal(await frame.locator('[data-coin-flight]').count(), 0);
    report.cases.push({ name, viewport, dpr, observed, geometry, afterFlight, audio, evidence: payload.evidence, finalState: payload.finalState,
      exactResultAndEvidenceParity: true, canonicalPublicReplayAccepted: true, ownedNodesAbsentAfterDispose: true, domRequests, muteCheck, errors, protocolErrors, runtimeErrors });
    await context.close();
    activePage = null;
  }
  // A delayed dynamic import must never revive a disposed child.
  const safetyCases = lateImportOnly ? [['delayed-load-dispose', 'hold']] : [['delayed-load-dispose', 'hold'], ['failed-download-fallback', 'abort'], ['active-flight-dispose', 'live']];
  for (const [name, behavior] of safetyCases) {
    const context = await browser.newContext({ viewport: { width: 414, height: 896 }, deviceScaleFactor: 3, serviceWorkers: 'block' });
    await context.addInitScript(clock);
    const page = await context.newPage(), errors = []; activePage = page; activeName = name;
    page.on('pageerror', error => errors.push(error.message));
    let release, intercepted = 0;
    const held = new Promise(resolve => { release = resolve; });
    await page.route('**/*', async route => {
      const requestPath = new URL(route.request().url()).pathname;
      if (negativeControl && requestPath === '/dist/chikun/game.js') {
        negativeControl.servedCount++; report.negativeControl.servedCount = negativeControl.servedCount;
        return route.fulfill({ status: 200, contentType: 'text/javascript', body: negativeControl.body });
      }
      if (requestPath !== domChunkPath) return route.continue();
      intercepted++;
      if (behavior === 'live') return route.continue();
      if (behavior === 'abort') return route.abort('failed');
      await held; return route.continue();
    });
    try {
      await page.route('**/coin-feedback-host', route => route.fulfill({ status: 200, contentType: 'text/html', body: host(true, false) }));
      await page.goto(origin + '/coin-feedback-host', { waitUntil: 'domcontentloaded' });
      const frame = await (await page.waitForSelector('#game')).contentFrame();
      await page.waitForFunction(() => __messages.some(message => message.type === 'game:ready'), null, { polling: 50 });
      await frame.waitForFunction(() => !document.querySelector('#startButton').disabled, null, { polling: 50 });
      assert.equal(intercepted, 1);
      if (behavior === 'hold') {
        assert.equal(await frame.locator('#gameShell').getAttribute('data-coin-feedback'), 'loading');
        await page.evaluate(() => __bridge.send('portal:dispose', {}));
        await frame.waitForFunction(() => __closedPorts > 0, null, { polling: 50 });
        const finished = page.waitForEvent('requestfinished', { predicate: request => new URL(request.url()).pathname === domChunkPath });
        release(); await finished;
        const observed = await frame.evaluate(async moduleUrl => {
          // Await the exact module used by the child, its registered import continuation,
          // and a following task before observing disposal. No cache-busting or second module.
          await import(moduleUrl); await Promise.resolve(); await new Promise(resolve => setTimeout(resolve, 0));
          __advance(2); return {
          status: document.querySelector('#gameShell').dataset.coinFeedback, nodes: document.querySelectorAll('[data-coin-flight]').length, pendingFrames: __pendingFrames(), closedPorts: __closedPorts };
        }, domChunkPath);
        report.delayedImportObservation = { ...observed, intercepted, moduleEvaluationAwaited: true };
        assert.equal(intercepted, 1, 'proof uses the original imported module');
        if (negativeControl) assert.equal(negativeControl.servedCount, 1, 'private negative entry served exactly once');
        assert.equal(observed.status, 'loading', 'late import never marks a disposed child ready'); assert.equal(observed.nodes, 0); assert.equal(observed.pendingFrames, 0);
        report.safetyCases.push({ name, observed, errors, passed: true });
      } else if (behavior === 'abort') {
        await frame.waitForFunction(() => document.querySelector('#gameShell').dataset.coinFeedback === 'fallback', null, { polling: 50 });
        await frame.evaluate(() => __advance(2)); await frame.locator('#startButton').click();
        await frame.evaluate(() => __advance(8));
        assert.equal(await frame.locator('#gameShell').getAttribute('data-phase'), 'running', 'optional module failure keeps the game playable');
        assert.equal(await frame.locator('[data-coin-flight]').count(), 0);
        await page.screenshot({ path: path.join(out, name + '.png'), fullPage: true });
        await page.evaluate(() => __bridge.send('portal:dispose', {}));
        await frame.waitForFunction(() => __closedPorts > 0, null, { polling: 50 });
        report.safetyCases.push({ name, optionalFailureKeepsGamePlayable: true, errors, passed: true });
      } else {
        await frame.waitForFunction(() => document.querySelector('#gameShell').dataset.coinFeedback === 'ready', null, { polling: 50 });
        await frame.evaluate(() => __advance(2)); await frame.locator('#startButton').click();
        const pickup = await frame.evaluate(installDriver, taps);
        assert.ok(pickup.coins > 0); assert.ok(await frame.locator('[data-coin-flight]').count() > 0, 'owned flight was active before disposal');
        await page.evaluate(() => __bridge.send('portal:dispose', {}));
        await frame.waitForFunction(() => __closedPorts > 0, null, { polling: 50 });
        assert.equal(await frame.locator('[data-coin-flight]').count(), 0, 'active owned flight is removed immediately');
        assert.equal(await frame.evaluate(() => { __advance(3); return __pendingFrames(); }), 0);
        assert.equal(await page.evaluate(() => __messages.filter(message => message.type === 'game:result').length), 0, 'disposing a partial flight does not invent a completed run');
        report.safetyCases.push({ name, actualPickupBeforeDisposal: pickup.coins, activeFlightRemoved: true, noInventedResult: true, errors, passed: true });
      }
      assert.deepEqual(errors, []); assert.deepEqual(await page.evaluate(() => __protocolErrors), []);
      assert.deepEqual(await page.evaluate(() => __messages.filter(message => message.type === 'game:error')), []);
    } finally { release(); await context.close(); activePage = null; }
  }
} catch (error) {
  if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: path.join(out, activeName + '.failure.png'), fullPage: true }).catch(() => {});
  report.errors.push(error.stack ?? String(error)); throw error;
} finally {
  await writeFile(path.join(out, 'CHIKUN-E0-browser.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ pass: report.cases.length, safetyPass: report.safetyCases.length, errors: report.errors.length, output: out }));

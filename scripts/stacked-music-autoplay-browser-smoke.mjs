// STACKED run-music autoplay smoke (owner request 2026-09-26: the arcade music
// player auto-plays when a STACKED game begins, on a random starting track).
//
// Serves apps/portal (build first: npm run build) and drives the real portal in
// system Chrome twice: the default autoplay policy, then
// --autoplay-policy=user-gesture-required (the Safari/iOS-like strict policy).
// The stacked-host chunk is held back STACKED_MUSIC_SMOKE_DELAY_MS (default
// 6000 ms) so the parent's play() after the chunk import runs outside the
// Free click's transient user activation: the case that used to be rejected.
//
// Clean window: Playwright evaluate/waitFor* calls run with a CDP user gesture
// and would hand the page fresh activation, so from each Free click until the
// run is live the smoke waits only on console markers and Node-side timers.
//
// Each browser plays two STACKED sessions on one page (Free -> Start -> checks
// -> child Exit -> Free again -> Start), four runs in all. At running + 1 s the
// music must be playing unmuted on a STACKED queue track, the song the Free
// click started must still be the one playing (the run start never switches
// it), no audible play() may be rejected, the two sessions of a browser start
// on different tracks and the four runs on at least two. The strict browser
// then plays a Hard Money Heroes Free level to prove its click-time start is
// unchanged.
//
// Env: STACKED_MUSIC_SMOKE_PORT (default 8921), STACKED_MUSIC_SMOKE_DELAY_MS,
// PLAYWRIGHT_PACKAGE_PATH, CHROME_PATH. Writes .tmp/stacked-music-autoplay/ (gitignored).
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startPortalStaticServer } from './hmh-reboot-portal-e2e.mjs';
import { buildArcadeMusicQueueForContext } from '../apps/portal/src/arcade-core.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = path.join(root, '.tmp/stacked-music-autoplay');
await mkdir(out, { recursive: true });
const playwrightPath = process.env.PLAYWRIGHT_PACKAGE_PATH || path.join(root, 'benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs');
const { chromium } = await import(pathToFileURL(playwrightPath).href);
const chromePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = Number(process.env.STACKED_MUSIC_SMOKE_PORT || 8921);
const delayMs = Number(process.env.STACKED_MUSIC_SMOKE_DELAY_MS ?? 6000);
const stackedQueue = new Set(buildArcadeMusicQueueForContext('stacked').map(track => track.id));
const hmhQueue = new Set(buildArcadeMusicQueueForContext('hard-money-heroes').map(track => track.id));

// Records every media play() on the parent music element and the child's
// bridge states as console markers (no evaluate needed to wait on them).
const INIT = `(() => {
  if (window.top !== window) return;
  const log = window.__sm = [];
  const P = HTMLMediaElement.prototype, origPlay = P.play;
  P.play = function () {
    const entry = { t: Math.round(performance.now()), trackId: this.dataset.trackId ?? null, muted: this.muted, active: navigator.userActivation?.isActive ?? null };
    log.push({ kind: 'play', ...entry });
    let p;
    try { p = origPlay.call(this); } catch (error) { log.push({ kind: 'throw', name: error.name }); throw error; }
    p?.then?.(() => { log.push({ kind: 'resolve', ...entry }); console.info('__sm:resolve:' + entry.muted + ':' + entry.trackId); },
      error => { log.push({ kind: 'reject', name: error?.name, message: error?.message, ...entry }); console.info('__sm:reject:' + (error?.name || '') + ':' + entry.muted); });
    return p;
  };
  const desc = Object.getOwnPropertyDescriptor(MessagePort.prototype, 'onmessage');
  Object.defineProperty(MessagePort.prototype, 'onmessage', { configurable: true, get() { return desc.get.call(this); }, set(fn) {
    if (typeof fn !== 'function') { desc.set.call(this, fn); return; }
    desc.set.call(this, function (event) {
      const data = event.data;
      if (data && (data.type === 'game:ready' || data.type === 'game:state')) console.info('__sm:recv:' + data.type + ':' + (data.payload?.status ?? ''));
      return fn.call(this, event);
    });
  } });
})();`;

const snapshot = () => {
  const audio = document.querySelector('#arcadeMusicAudio'), player = document.querySelector('#arcadeMusicPlayer');
  return { paused: audio.paused, muted: audio.muted, trackId: audio.dataset.trackId, currentTime: Number(audio.currentTime.toFixed(2)), context: player?.dataset.context, playerPlaying: player?.dataset.playing, log: window.__sm.slice() };
};

async function playSession(page, label) {
  const marker = text => page.waitForEvent('console', { predicate: message => message.text().startsWith(text), timeout: 60000 });
  await page.locator('#officialGuestEnterButton').click();
  await page.locator('.official-cabinet-card').filter({ hasText: 'STACKED' }).click();
  await page.waitForSelector('#officialModeSelect:not([hidden])');
  const logStart = await page.evaluate(() => window.__sm.length);
  // ---- clean window: no evaluate/waitFor until the run is live ----
  const ready = marker('__sm:recv:game:ready');
  const clickAt = Date.now();
  await page.locator('#officialFreeModeButton').click();
  await ready;
  const readyAfterMs = Date.now() - clickAt;
  await page.waitForTimeout(1500);
  const running = marker('__sm:recv:game:state:running');
  const frame = page.frames().find(item => item.url().includes('/stacked/index.html'));
  await frame.locator('#continueButton').click();
  await running;
  await page.waitForTimeout(1000);
  // ---- end of clean window ----
  const live = await page.evaluate(snapshot);
  await page.waitForTimeout(1500);
  const later = await page.evaluate(snapshot);
  // Informational: whether the child's visualizer receives analysed audio.
  const visualizer = await frame.evaluate(() => document.querySelector('#audioLabel')?.textContent ?? null).catch(() => null);
  const plays = live.log.slice(logStart);
  const rejected = plays.filter(entry => entry.kind === 'reject');
  const audible = plays.filter(entry => entry.kind === 'resolve' && !entry.muted);
  assert.equal(live.paused, false, `${label}: music is playing at running + 1 s`);
  assert.equal(live.muted, false, `${label}: music is not muted`);
  assert.ok(live.currentTime > 0.2, `${label}: music time advances by running + 1 s (${live.currentTime}s)`);
  assert.ok(later.currentTime > live.currentTime, `${label}: music keeps advancing (${live.currentTime}s -> ${later.currentTime}s)`);
  assert.equal(later.trackId, live.trackId, `${label}: the track is not switched during the run`);
  assert.ok(stackedQueue.has(live.trackId), `${label}: ${live.trackId} is a STACKED queue track`);
  assert.equal(live.context, 'stacked', `${label}: the player follows the STACKED queue`);
  assert.ok(audible.length >= 1, `${label}: an unmuted play() resolved`);
  assert.deepEqual(rejected.filter(entry => entry.name !== 'AbortError' || !entry.muted), [], `${label}: no audible play() was rejected`);
  const startedTrack = audible[0].trackId;
  assert.equal(live.trackId, startedTrack, `${label}: the song the Free click started is still playing`);
  assert.equal(plays.find(entry => entry.kind === 'play' && !entry.muted)?.active, true, `${label}: the first audible play() ran inside the click's user activation`);
  return { label, readyAfterMs, trackId: live.trackId, currentTime: live.currentTime, visualizer, plays };
}

// Hard Money Heroes Free level: its music starts in beginOfficialLevel's click.
async function playHmhLevel(page) {
  await page.locator('#officialGuestEnterButton').click();
  await page.locator('#officialCabinetGrid .official-cabinet-card.playable').filter({ hasText: 'Hard Money Heroes' }).first().click();
  await page.waitForSelector('#officialModeSelect:not([hidden])');
  await page.locator('#officialFreeModeButton').click();
  await page.waitForSelector('#officialCharacterSelect:not([hidden])');
  await page.locator('#officialCharacterRoster .hero-card.active').first().click();
  await page.waitForSelector('#officialLevelIntro:not([hidden])');
  const logStart = await page.evaluate(() => window.__sm.length);
  await page.locator('#officialBeginLevelButton').click();
  await page.waitForSelector('#officialGameplay:not([hidden])');
  await page.waitForTimeout(2500);
  const live = await page.evaluate(snapshot);
  const plays = live.log.slice(logStart);
  assert.equal(live.paused, false, 'HMH: music is playing after Begin');
  assert.equal(live.muted, false, 'HMH: music is not muted');
  assert.ok(live.currentTime > 0.5, `HMH: music time advances (${live.currentTime}s)`);
  assert.ok(hmhQueue.has(live.trackId), `HMH: ${live.trackId} is a Hard Money Heroes queue track`);
  assert.equal(live.context, 'hard-money-heroes', 'HMH: the player follows the Hard Money Heroes queue');
  assert.deepEqual(plays.filter(entry => entry.kind === 'reject' && !entry.muted), [], 'HMH: no audible play() was rejected');
  return { trackId: live.trackId, currentTime: live.currentTime, plays };
}

const report = { delayMs, startedAt: new Date().toISOString(), browsers: [] };
const { server, origin } = await startPortalStaticServer({ rootDir: path.join(root, 'apps/portal'), port });
try {
  for (const [policy, extra] of [['default', []], ['user-gesture-required', ['--autoplay-policy=user-gesture-required']]]) {
    const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist', ...extra] });
    try {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
      await context.addInitScript(INIT);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      if (delayMs > 0) await page.route('**/dist/chunks/stacked-host-*.js', async route => { await new Promise(resolve => setTimeout(resolve, delayMs)); await route.continue(); });
      await page.goto(origin + '/', { waitUntil: 'networkidle' });
      const first = await playSession(page, `${policy} run 1`);
      const frame = page.frames().find(item => item.url().includes('/stacked/index.html'));
      await frame.locator('#exitButton').click({ force: true });
      await page.waitForFunction(() => !document.querySelector('#officialCombatMount iframe'));
      const second = await playSession(page, `${policy} run 2`);
      assert.notEqual(second.trackId, first.trackId, `${policy}: a new session starts on a different random track`);
      let hmh = null;
      if (policy === 'user-gesture-required') {
        const stackedFrame = page.frames().find(item => item.url().includes('/stacked/index.html'));
        await stackedFrame.locator('#exitButton').click({ force: true });
        await page.waitForFunction(() => !document.querySelector('#officialCombatMount iframe'));
        hmh = await playHmhLevel(page);
      }
      assert.deepEqual(errors, [], `${policy}: no page errors`);
      report.browsers.push({ policy, version: browser.version(), sessions: [first, second], hmh });
      console.log(`${policy}: run 1 ${first.trackId} (${first.currentTime}s), run 2 ${second.trackId} (${second.currentTime}s)${hmh ? `, HMH ${hmh.trackId} (${hmh.currentTime}s)` : ''}`);
    } finally { await browser.close(); }
  }
  const starts = report.browsers.flatMap(entry => entry.sessions.map(session => session.trackId));
  assert.equal(starts.length, 4, 'four STACKED runs were played');
  assert.ok(new Set(starts).size >= 2, `four runs start on at least two tracks (${starts.join(', ')})`);
  report.startingTracks = starts;
  report.ok = true;
} finally {
  server.close();
  await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
}
console.log('STACKED music autoplay smoke passed');

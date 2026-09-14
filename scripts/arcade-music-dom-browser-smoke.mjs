import assert from 'node:assert/strict';
import {writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {startPortalStaticServer} from './hmh-reboot-portal-e2e.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = path.resolve(process.env.ARCADE_MUSIC_EVIDENCE_DIR || '.tmp/arcade-music-dom');
await mkdir(out, {recursive: true});
const {chromium} = await import(pathToFileURL(path.join(root, 'benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs')).href);
const {server, origin} = process.env.PORTAL_E2E_ORIGIN
  ? {server: null, origin: process.env.PORTAL_E2E_ORIGIN}
  : await startPortalStaticServer({rootDir: path.join(root, 'apps/portal')});
const browser = await chromium.launch({executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true});
const context = await browser.newContext({viewport: {width: 390, height: 844}, hasTouch: true, serviceWorkers: 'block'});
// Routing disables the HTTP cache. Recreating an external SVG must not cause
// repeated requests while the real audio clock updates otherwise unchanged UI.
await context.route('**/*', route => route.continue());
const page = await context.newPage();
const errors = [];
let iconRequests = 0;
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
page.on('request', request => {if (new URL(request.url()).pathname === '/assets/icons/arcade-ui.svg') iconRequests++;});
try {
  await page.goto(origin, {waitUntil: 'networkidle'});
  await page.locator('#officialGuestEnterButton').click();
  await page.locator('#arcadeMusicPlayButton').click();
  await page.waitForFunction(() => !document.querySelector('#arcadeMusicAudio').paused && document.querySelector('#arcadeMusicAudio').currentTime > .2);
  await page.evaluate(() => {
    const controls = [...document.querySelectorAll('#arcadeMusicPlayButton, #arcadeMusicMuteButton, #arcadeMusicShuffleButton, #arcadeMusicExpandButton, #arcadeMusicQueueList')];
    window.__musicDomSample = {mutations: 0, controls, children: controls.map(node => node.firstChild), start: document.querySelector('#arcadeMusicAudio').currentTime};
    const observer = new MutationObserver(records => {window.__musicDomSample.mutations += records.filter(record => record.type === 'childList').length;});
    controls.forEach(node => observer.observe(node, {childList: true, subtree: true}));
    window.__musicDomSample.observer = observer;
  });
  const initialRequests = iconRequests;
  await page.waitForTimeout(3500);
  const sample = await page.evaluate(() => {
    const s = window.__musicDomSample;
    s.observer.disconnect();
    return {mutations: s.mutations, retainedNodes: s.controls.every((node, index) => node.firstChild === s.children[index]), audioAdvanced: document.querySelector('#arcadeMusicAudio').currentTime - s.start};
  });
  const report = {origin, ...sample, repeatedIconRequests: iconRequests - initialRequests, errors};
  await writeFile(path.join(out, 'measurement.json'), JSON.stringify(report, null, 2));
  assert.ok(sample.audioAdvanced >= 2, 'measure ordinary active music playback');
  assert.equal(sample.mutations, 0, 'unchanged icons and queue must retain their DOM nodes');
  assert.equal(sample.retainedNodes, true);
  assert.equal(report.repeatedIconRequests, 0, 'unchanged playback must not refetch the icon sprite');
  await page.locator('#arcadeMusicPlayButton').click();
  await page.waitForFunction(() => document.querySelector('#arcadeMusicAudio').paused
    && document.querySelector('#arcadeMusicPlayButton use').getAttribute('href').endsWith('#play'), null, {timeout: 2000});
  assert.match(await page.locator('#arcadeMusicPlayButton use').getAttribute('href'), /#play$/);
  await page.locator('#arcadeMusicPlayButton').click();
  await page.waitForFunction(() => !document.querySelector('#arcadeMusicAudio').paused
    && document.querySelector('#arcadeMusicPlayButton use').getAttribute('href').endsWith('#pause'), null, {timeout: 2000});
  assert.match(await page.locator('#arcadeMusicPlayButton use').getAttribute('href'), /#pause$/);
  await page.locator('#arcadeMusicMuteButton').click();
  assert.equal(await page.locator('#arcadeMusicAudio').evaluate(audio => audio.muted), true);
  assert.match(await page.locator('#arcadeMusicMuteButton use').getAttribute('href'), /#mute$/);
  const previousTrack = await page.locator('#arcadeMusicAudio').getAttribute('data-track-id');
  const previousTitle = await page.locator('#arcadeMusicTitle').textContent();
  await page.locator('#arcadeMusicNextButton').click();
  await page.waitForFunction(previous => {
    const title = document.querySelector('#arcadeMusicTitle').textContent;
    return document.querySelector('#arcadeMusicAudio').dataset.trackId !== previous.track
      && title !== previous.title
      && document.querySelector('#arcadeMusicQueueList li.active')?.textContent.startsWith(title);
  }, {track: previousTrack, title: previousTitle}, {timeout: 3000});
  const selection = await page.evaluate(() => ({title: document.querySelector('#arcadeMusicTitle').textContent, active: document.querySelector('#arcadeMusicQueueList li.active').textContent}));
  assert.ok(selection.active.startsWith(selection.title), 'queue selection follows the actual track');
  assert.deepEqual(errors, []);
  await writeFile(path.join(out, 'verification.json'), JSON.stringify({status: 'PASS', ...report, controlsVerified: ['pause', 'resume', 'mute', 'next', 'active queue']}, null, 2));
  console.log(JSON.stringify({status: 'PASS', ...report}));
} finally {
  await browser.close();
  server?.close();
}

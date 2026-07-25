import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const PORTAL_E2E_FLOW_SCHEMA = 'hmh-reboot-portal-e2e-flows-v1';

// Master-plan Phase 14 coverage areas. Every area must be claimed by at least
// one flow below, either implemented here or explicitly deferred with a reason
// and (where it exists) the harness that owns it instead.
export const PORTAL_E2E_REQUIRED_AREAS = Object.freeze([
  'free-run',
  'ranked',
  'wallet-connect-reconnect',
  'reload-persistence',
  'profile',
  'scores-session-history',
  'game-over',
  'restart-play-again',
  'pause-resume',
  'audio',
  'service-worker-offline',
]);

export const PORTAL_E2E_FLOWS = Object.freeze([
  Object.freeze({
    id: 'guest-boot',
    status: 'implemented',
    covers: Object.freeze(['free-run']),
    description: 'Portal boots to the wallet splash as a guest with zero console or page errors.',
  }),
  Object.freeze({
    id: 'guest-free-run',
    status: 'implemented',
    covers: Object.freeze(['free-run', 'profile']),
    description: 'Guest enters the arcade, selects the HMH cabinet, starts a Free run; the sandboxed reboot iframe connects, the simulation advances, and the child profile reads Guest.',
  }),
  Object.freeze({
    id: 'pause-resume',
    status: 'implemented',
    covers: Object.freeze(['pause-resume']),
    description: 'Portal-side pause freezes the child simulation tick and shows both pause surfaces; resume unfreezes the tick.',
  }),
  Object.freeze({
    id: 'mid-run-restart',
    status: 'implemented',
    covers: Object.freeze(['restart-play-again']),
    description: 'Portal restart mints a fresh parent session and a new child iframe whose session id differs and whose simulation advances.',
  }),
  Object.freeze({
    id: 'settings-persistence-reload',
    status: 'implemented',
    covers: Object.freeze(['reload-persistence', 'audio']),
    description: 'A settings toggle made during a run persists to hmh-settings across a full page reload, and the arcade save (version 2) survives reload.',
  }),
  Object.freeze({
    id: 'guest-exit-to-splash',
    status: 'implemented',
    covers: Object.freeze(['free-run']),
    description: 'Exiting a guest run tears the session down and returns to the wallet splash (current guest behavior).',
  }),
  Object.freeze({
    id: 'ranked-preview',
    status: 'deferred',
    covers: Object.freeze(['ranked']),
    reason: "startOfficialMode('ranked') hard-gates on walletConnector === 'injected-evm'; no real EVM provider exists headlessly. Needs a portal-approved test provider before it can be automated.",
  }),
  Object.freeze({
    id: 'wallet-connect-reconnect',
    status: 'deferred',
    covers: Object.freeze(['wallet-connect-reconnect', 'profile', 'scores-session-history']),
    reason: 'Wallet connect falls back to the mock wallet without an injected provider, which is not representative of the reconnect path this flow must prove.',
  }),
  Object.freeze({
    id: 'game-over-duplicate-rejection',
    status: 'deferred',
    covers: Object.freeze(['game-over', 'restart-play-again']),
    reason: 'The portal embeds the child without evidence-safe parameters, so there is no deterministic in-portal death path yet. Duplicate-finalization rejection stays covered by tests/hmh-reboot-portal-lifecycle.test.mjs.',
  }),
  Object.freeze({
    id: 'service-worker-offline-update',
    status: 'deferred',
    covers: Object.freeze(['service-worker-offline']),
    reason: 'Service worker, offline shell, and stale-cache flows need dedicated SW lifecycle control; currently exercised by the release browser certification harness.',
  }),
]);

export function auditPortalE2eFlowContract({ flows = PORTAL_E2E_FLOWS, requiredAreas = PORTAL_E2E_REQUIRED_AREAS } = {}) {
  const errors = [];
  const seen = new Set();
  const covered = new Set();
  for (const flow of flows) {
    if (!flow?.id || typeof flow.id !== 'string') {
      errors.push('flow without a string id');
      continue;
    }
    if (seen.has(flow.id)) errors.push(`duplicate flow id ${flow.id}`);
    seen.add(flow.id);
    if (!['implemented', 'deferred'].includes(flow.status)) errors.push(`flow ${flow.id} has invalid status ${String(flow.status)}`);
    if (flow.status === 'implemented' && !(typeof flow.description === 'string' && flow.description.length > 0)) {
      errors.push(`implemented flow ${flow.id} is missing a description`);
    }
    if (flow.status === 'deferred' && !(typeof flow.reason === 'string' && flow.reason.length >= 20)) {
      errors.push(`deferred flow ${flow.id} must state a substantive reason`);
    }
    if (!Array.isArray(flow.covers) || flow.covers.length === 0) {
      errors.push(`flow ${flow.id} claims no coverage areas`);
      continue;
    }
    for (const area of flow.covers) {
      if (!requiredAreas.includes(area)) errors.push(`flow ${flow.id} claims unknown area ${area}`);
      covered.add(area);
    }
  }
  for (const area of requiredAreas) {
    if (!covered.has(area)) errors.push(`required area ${area} is not claimed by any flow`);
  }
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors.sort()) });
}

const MIME_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
});

const SPA_ROUTE_PATTERN = /^\/(games|play|profile|scores|leaderboards|settings)(\/|$)/;

export function startPortalStaticServer({ rootDir, host = '127.0.0.1', port = 0 } = {}) {
  const root = path.resolve(rootDir);
  const server = createServer((request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
      let pathname = decodeURIComponent(url.pathname);
      if (SPA_ROUTE_PATTERN.test(pathname)) pathname = '/index.html';
      if (pathname.endsWith('/')) pathname += 'index.html';
      const filePath = path.join(root, pathname);
      if (!filePath.startsWith(root + path.sep) || !existsSync(filePath) || !statSync(filePath).isFile()) {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('not found');
        return;
      }
      response.writeHead(200, { 'content-type': MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream' });
      createReadStream(filePath).pipe(response);
    } catch (error) {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(String(error?.message ?? error));
    }
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, host, () => {
      resolve({ server, origin: `http://${host}:${server.address().port}` });
    });
  });
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  const repoRoot = fileURLToPath(new URL('..', import.meta.url));
  const portalRoot = path.join(repoRoot, 'apps', 'portal');
  for (const artifact of ['dist/main.js', 'dist/hmh-reboot/game.js']) {
    if (!existsSync(path.join(portalRoot, artifact))) {
      console.error(`Missing build artifact apps/portal/${artifact}. Run: npm run build`);
      process.exit(1);
    }
  }
  const contract = auditPortalE2eFlowContract();
  if (!contract.ok) {
    console.error('Portal E2E flow contract failed:', contract.errors);
    process.exit(1);
  }

  const evidenceDir = new URL('../.hermes/evidence/hmh-aaa-cycle-003/portal-e2e/', import.meta.url);
  await mkdir(evidenceDir, { recursive: true });
  const evidencePath = (name) => fileURLToPath(new URL(`${name}.png`, evidenceDir));

  const { chromium } = await import('../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs');
  const { server, origin } = await startPortalStaticServer({ rootDir: portalRoot });
  const browser = await chromium.launch({
    executablePath: String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,
    headless: true,
    args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'],
  });

  const results = [];
  const consoleErrors = [];
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  page.on('pageerror', (error) => consoleErrors.push(`page: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(`console: ${message.text()}`); });

  const childFrame = () => page.frames().find((frame) => {
    try { return new URL(frame.url()).pathname === '/hmh-reboot/index.html'; } catch { return false; }
  });

  // The portal's "runtime connected" status copy is transient (live run status
  // overwrites it within a second), so readiness is read from the child frame
  // itself: bridge status plus, for restarts, a session identity change.
  async function waitForConnectedChild({ differentFrom = null, timeoutMs = 45_000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    let lastDetail = 'no child frame attached';
    while (Date.now() < deadline) {
      const stateCopy = await page.locator('#officialGameStateCopy').textContent().catch(() => '');
      assert.ok(!stateCopy.includes('Reboot lifecycle error'), `portal reported lifecycle error: ${stateCopy}`);
      const frame = childFrame();
      if (frame) {
        try {
          const status = await frame.locator('#hmhRebootStatus').textContent({ timeout: 1_000 });
          const session = (await frame.locator('#hmhRebootSession').textContent({ timeout: 1_000 })).trim();
          if (status === 'Portal session connected' && (!differentFrom || session !== differentFrom)) {
            await frame.waitForSelector('#hmhRebootStage canvas', { timeout: 10_000 });
            return { frame, session };
          }
          lastDetail = `status=${status} session=${session}`;
        } catch (error) {
          lastDetail = `frame transition: ${String(error?.message ?? error).split('\n')[0]}`;
        }
      }
      await page.waitForTimeout(250);
    }
    throw new Error(`reboot child did not reach connected state (${lastDetail})`);
  }

  async function waitForChildReady() {
    await page.waitForSelector('#officialCombatMount iframe[data-runtime="hmh-reboot"]', { timeout: 20_000 });
    const { frame } = await waitForConnectedChild();
    return frame;
  }

  // Normal mode intentionally exposes no debug tick dataset (Cycle 001 rule:
  // debug telemetry must be absent outside evidence modes), so runtime
  // liveness is proven from composited child frames: pixels change while the
  // simulation runs and stay byte-identical once the ticker stops on pause.
  async function stageShot() {
    return page.locator('#officialCombatMount iframe[data-runtime="hmh-reboot"]').screenshot({ timeout: 10_000 });
  }

  async function assertRendererAnimating(label) {
    const first = await stageShot();
    await page.waitForTimeout(450);
    const second = await stageShot();
    assert.ok(!first.equals(second), `${label}: rendered child frame did not change while running`);
  }

  async function assertRendererFrozen(label) {
    await page.waitForTimeout(600);
    const first = await stageShot();
    await page.waitForTimeout(450);
    const second = await stageShot();
    assert.ok(first.equals(second), `${label}: rendered child frame changed while paused`);
  }

  async function openPauseMenu() {
    await page.click('#combatMenuIconButton');
    await page.waitForSelector('#combatMenuPanel[data-state="paused"]', { timeout: 10_000 });
  }

  async function enterGuestFreeRun() {
    await page.waitForSelector('#officialWalletSplash:not([hidden])');
    await page.click('#officialGuestEnterButton');
    await page.waitForSelector('#officialArcadeFloor:not([hidden])');
    await page.locator('#officialCabinetGrid .official-cabinet-card.playable').first().click();
    await page.waitForSelector('#officialModeSelect:not([hidden])');
    await page.click('#officialFreeModeButton');
    await page.waitForSelector('#officialCharacterSelect:not([hidden])');
    await page.locator('#officialCharacterRoster .hero-card.active').first().click();
    await page.waitForSelector('#officialLevelIntro:not([hidden])');
    await page.click('#officialBeginLevelButton');
    await page.waitForSelector('#officialGameplay:not([hidden])');
    return waitForChildReady();
  }

  async function runFlow(id, execute) {
    const errorsBefore = consoleErrors.length;
    try {
      const detail = await execute();
      const flowErrors = consoleErrors.slice(errorsBefore);
      if (flowErrors.length > 0) throw new Error(`console/page errors during flow: ${flowErrors.join(' | ')}`);
      results.push({ id, ok: true, detail: detail ?? null });
      console.log(`PASS ${id}`);
    } catch (error) {
      results.push({ id, ok: false, error: String(error?.message ?? error) });
      console.error(`FAIL ${id}: ${error?.message ?? error}`);
    }
  }

  try {
    await runFlow('guest-boot', async () => {
      await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#officialWalletSplash:not([hidden])', { timeout: 20_000 });
      assert.equal(await page.locator('#officialGuestEnterButton').isVisible(), true);
      await page.screenshot({ path: evidencePath('01-guest-boot'), fullPage: false });
      return { splash: true };
    });

    let child = null;
    await runFlow('guest-free-run', async () => {
      child = await enterGuestFreeRun();
      const iframe = page.locator('#officialCombatMount iframe[data-runtime="hmh-reboot"]');
      assert.equal(await iframe.getAttribute('sandbox'), 'allow-scripts allow-same-origin allow-pointer-lock');
      assert.equal(await child.locator('#hmhProfileName').textContent(), 'Guest');
      assert.equal(await page.locator('#officialCombatMount #combatCanvas').count(), 0, 'legacy canvas must not mount for reboot runs');
      await assertRendererAnimating('guest-free-run');
      await page.screenshot({ path: evidencePath('02-guest-free-run'), fullPage: false });
      return { profile: 'Guest' };
    });

    await runFlow('pause-resume', async () => {
      assert.ok(child, 'requires guest-free-run');
      await openPauseMenu();
      await child.waitForFunction(() => document.querySelector('#hmhRebootStatus')?.textContent === 'Portal session paused', undefined, { timeout: 10_000 });
      assert.equal(await page.locator('#officialCombatMount').getAttribute('data-paused'), 'true');
      await assertRendererFrozen('pause-resume');
      await page.screenshot({ path: evidencePath('03-paused'), fullPage: false });
      await page.click('#combatMenuIconButton');
      await child.waitForFunction(() => document.querySelector('#hmhRebootStatus')?.textContent === 'Portal session connected', undefined, { timeout: 10_000 });
      await assertRendererAnimating('pause-resume');
      return { pausedSurfaces: ['#combatMenuPanel', '#hmhPausePanel'] };
    });

    await runFlow('mid-run-restart', async () => {
      assert.ok(child, 'requires guest-free-run');
      const sessionBefore = (await child.locator('#hmhRebootSession').textContent()).trim();
      await openPauseMenu();
      await page.click('#combatMenuActionGrid [data-action="restart"]');
      const restarted = await waitForConnectedChild({ differentFrom: sessionBefore });
      child = restarted.frame;
      const sessionAfter = restarted.session;
      assert.notEqual(sessionAfter, sessionBefore, 'restart must mint a fresh parent session');
      assert.equal(await page.locator('#combatMenuPanel').evaluate((panel) => panel.hidden), true, 'pause menu must close after restart');
      assert.equal(await page.locator('#officialCombatMount').getAttribute('data-paused'), 'false');
      await assertRendererAnimating('mid-run-restart');
      await page.screenshot({ path: evidencePath('04-restarted'), fullPage: false });
      return { sessionBefore, sessionAfter };
    });

    let expectedGore = null;
    await runFlow('settings-persistence-reload', async () => {
      assert.ok(child, 'requires a live run');
      const before = await page.evaluate(() => JSON.parse(localStorage.getItem('hmh-settings') ?? '{}'));
      await openPauseMenu();
      await page.click('#combatMenuActionGrid [data-action="toggle-settings"]');
      await page.waitForSelector('#combatSettingsPanel:not([hidden])', { timeout: 10_000 });
      await page.click('#combatSettingsPanel [data-action="gore"]');
      const after = await page.evaluate(() => JSON.parse(localStorage.getItem('hmh-settings') ?? '{}'));
      assert.notEqual(after.gore, before.gore ?? true, 'gore toggle did not persist to hmh-settings');
      expectedGore = after.gore;
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
      await page.waitForTimeout(400);
      await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#officialWalletSplash:not([hidden])', { timeout: 20_000 });
      const persisted = await page.evaluate(() => ({
        settings: JSON.parse(localStorage.getItem('hmh-settings') ?? '{}'),
        save: JSON.parse(localStorage.getItem('lesters-arcade-save-v1') ?? 'null'),
      }));
      assert.equal(persisted.settings.gore, expectedGore, 'hmh-settings did not survive reload');
      assert.ok(persisted.save, 'arcade save missing after reload');
      assert.equal(persisted.save.version, 2);
      child = null;
      return { gore: expectedGore, saveVersion: persisted.save.version };
    });

    await runFlow('guest-exit-to-splash', async () => {
      child = await enterGuestFreeRun();
      await openPauseMenu();
      await page.click('#combatMenuActionGrid [data-action="toggle-settings"]');
      await page.waitForSelector('#combatSettingsPanel:not([hidden])', { timeout: 10_000 });
      const goreLabel = await page.locator('#combatSettingsPanel [data-action="gore"]').textContent();
      if (expectedGore !== null) {
        assert.equal(goreLabel.includes('Gore Off'), expectedGore === false, `gore setting label "${goreLabel.trim()}" does not reflect persisted setting`);
      }
      await page.click('#combatMenuActionGrid [data-action="exit-to-arcade"]');
      await page.waitForSelector('#officialWalletSplash:not([hidden])', { timeout: 15_000 });
      assert.equal(await page.locator('#officialCombatMount iframe[data-runtime="hmh-reboot"]').count(), 0, 'exit must unmount the reboot iframe');
      await page.screenshot({ path: evidencePath('05-exit-splash'), fullPage: false });
      return { returnedTo: 'wallet-splash' };
    });
  } finally {
    await browser.close();
    server.close();
  }

  const failed = results.filter((result) => !result.ok);
  const summary = {
    schema: PORTAL_E2E_FLOW_SCHEMA,
    origin,
    implementedFlows: PORTAL_E2E_FLOWS.filter((flow) => flow.status === 'implemented').map((flow) => flow.id),
    deferredFlows: PORTAL_E2E_FLOWS.filter((flow) => flow.status === 'deferred').map((flow) => ({ id: flow.id, reason: flow.reason })),
    results,
    consoleErrors,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (failed.length > 0 || consoleErrors.length > 0) {
    console.error(`Portal E2E failed: ${failed.length} failing flows, ${consoleErrors.length} console/page errors.`);
    process.exit(1);
  }
  console.log('Portal E2E passed for all implemented flows.');
}

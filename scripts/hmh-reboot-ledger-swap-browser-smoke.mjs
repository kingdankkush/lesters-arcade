// Lightning Ledger swap-away browser smoke (1.8.x ledger swap hotfix).
//
// The live bug: swapping away from a channelling Arc Rifle (SWAP or a
// weapon-wheel pick) ended the channel inside the weapon system but main.mjs
// never handed that 'switch' break to the run summary. The summary kept the
// Ledger marked channelling, so the next channel start threw "Lightning Ledger
// channel is already active" and stopped the ticker mid-run.
//
// This drives the real child in an ordinary Free evidence run with the Ledger
// drawn (lightningLedgerPilot) and the shipped auto-fire: the beam starts by
// itself when a hostile is in reach. Each cycle waits for a live beam, swaps
// away while it runs (SWAP in the same frame the stage reports it; a wheel
// pick only if the beam still reads live with the wheel holding the run), waits
// out the break cooldown, picks the Ledger back from the wheel and waits for a
// fresh beam. Every restart must reach an active beam with the ticker still
// advancing and no page error. On the unfixed 1.8.6 child the first restart
// throws and the run stops. Level-up choices are taken with Digit1 as they come.
// Serves apps/portal itself; run `npm run build` first.
// Evidence: .hermes/evidence/hmh-reboot-ledger-swap/.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startPortalStaticServer } from './hmh-reboot-portal-e2e.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const output = path.join(repoRoot, '.hermes', 'evidence', 'hmh-reboot-ledger-swap');
await mkdir(output, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_PACKAGE_PATH
  ? pathToFileURL(process.env.PLAYWRIGHT_PACKAGE_PATH).href
  : '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs');

// The Ledger's break cooldown is 108 ticks; wait past it plus the switch lockout.
const COOLDOWN_TICKS = 108 + 30;
const CYCLES = [
  { label: 'SWAP', away: 'swap' },
  { label: 'wheel pick', away: 'wheel' },
  { label: 'SWAP again', away: 'swap' },
];

const { server, origin } = await startPortalStaticServer({ rootDir: path.join(repoRoot, 'apps', 'portal') });
const browser = await chromium.launch({
  executablePath: process.env.HMH_CHROME_PATH ?? String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const errors = [];
const report = { cycles: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  await page.goto(`${origin}/hmh-reboot/index.html?evidenceSafe=1&telemetry=1&lightningLedgerPilot=1&seed=424242`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.weaponId === 'lightning-ledger', null, { timeout: 60_000 });

  const read = () => page.evaluate(() => {
    const dataset = document.querySelector('#hmhRebootStage')?.dataset ?? {};
    return {
      weapon: document.querySelector('#hmhHudWeapon')?.dataset.weapon ?? dataset.weaponId,
      ticks: Number(dataset.simulationStepsTotal ?? 0),
      simulation: dataset.simulationState,
      ledgerActive: dataset.lightningLedgerActive,
      pulses: Number(dataset.lightningLedgerPulses ?? 0),
    };
  });
  const fail = async (label, cause) => {
    const state = await read().catch(() => ({}));
    await page.screenshot({ path: path.join(output, `failure-${label.replace(/\W+/g, '-')}.png`) }).catch(() => {});
    throw new Error(`${label}: ${JSON.stringify({ state, errors })}`, { cause });
  };
  // Take any level-up choice so the run keeps stepping.
  const serviceUpgrade = async () => {
    if ((await read()).simulation !== 'upgrade') return false;
    await page.keyboard.press('Digit1');
    await page.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.simulationState !== 'upgrade', null, { timeout: 5_000 });
    return true;
  };
  // Waits for a named stage condition over `value` (no string evaluation in
  // the page), taking level-up choices on the way.
  const waitFor = async (label, predicate, arg, timeout = 30_000) => {
    const deadline = Date.now() + timeout;
    for (;;) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) return fail(label);
      const reached = await page.waitForFunction(([kind, value]) => {
        const stage = document.querySelector('#hmhRebootStage');
        if (stage?.dataset.simulationState === 'upgrade') return 'upgrade';
        const weapon = () => document.querySelector('#hmhHudWeapon')?.dataset.weapon ?? stage?.dataset.weaponId;
        const wheel = document.querySelector('#hmhWeaponWheel');
        const holds = {
          stage: () => stage?.dataset[value.key] === value.value,
          hud: () => weapon() === value,
          hudNot: () => weapon() !== value,
          ticks: () => Number(stage?.dataset.simulationStepsTotal ?? 0) >= value,
          wheelOpen: () => wheel?.hidden === false,
          wheelClosed: () => wheel?.hidden === true,
        }[kind];
        return holds() ? 'ok' : false;
      }, [predicate, arg ?? null], { timeout: remaining }).then((handle) => handle.jsonValue()).catch(() => null);
      if (reached === 'ok') return undefined;
      if (reached === 'upgrade') { await serviceUpgrade(); continue; }
      return fail(label);
    }
  };
  const hudIs = 'hud';
  const hudIsNot = 'hudNot';
  const waitTicks = async (label, count) => {
    const { ticks } = await read();
    await waitFor(label, 'ticks', ticks + count);
  };
  // Waits for the first frame the stage reports a live beam. For SWAP it
  // presses the key in that same frame, so the switch lands mid-channel.
  const swapAwayWhileLive = (away) => page.evaluate((mode) => new Promise((resolve, reject) => {
    const started = performance.now();
    const key = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true, cancelable: true }));
    const poll = () => {
      const dataset = document.querySelector('#hmhRebootStage')?.dataset ?? {};
      if (dataset.simulationState === 'upgrade') return reject(new Error('upgrade'));
      if (performance.now() - started > 30_000) return reject(new Error(`no live beam: ${JSON.stringify({ state: dataset.simulationState, active: dataset.lightningLedgerActive })}`));
      if (dataset.simulationState === 'active' && dataset.lightningLedgerActive === 'true') {
        const at = { tick: Number(dataset.simulationStepsTotal), pulses: Number(dataset.lightningLedgerPulses) };
        if (mode === 'swap') {
          key('keydown', 'KeyQ');
          requestAnimationFrame(() => requestAnimationFrame(() => { key('keyup', 'KeyQ'); resolve(at); }));
        } else {
          resolve(at);
        }
        return undefined;
      }
      requestAnimationFrame(poll);
      return undefined;
    };
    poll();
  }), away);
  const wheelPick = async (label, digit, weaponId) => {
    await page.keyboard.press('Tab');
    await waitFor(`${label} (wheel open)`, 'wheelOpen');
    await page.keyboard.press(`Digit${digit}`);
    await waitFor(`${label} (wheel closed)`, 'wheelClosed');
    await waitFor(label, hudIs, weaponId);
  };

  for (const cycle of CYCLES) {
    await waitFor(`${cycle.label}: Ledger drawn`, hudIs, 'lightning-ledger');
    let swappedAt = null;
    for (let attempt = 0; attempt < 8 && !swappedAt; attempt += 1) {
      swappedAt = await swapAwayWhileLive(cycle.away).catch(async (error) => {
        if (error.message === 'upgrade') { await serviceUpgrade(); return null; }
        return fail(`${cycle.label}: live beam`, error);
      });
      if (swappedAt && cycle.away === 'wheel') {
        // The wheel holds the simulation, so the beam read while it is open is
        // the beam the pick switches away from.
        await page.keyboard.press('Tab');
        await waitFor(`${cycle.label} (wheel open)`, 'wheelOpen');
        if ((await read()).ledgerActive !== 'true') {
          await page.keyboard.press('Escape');
          await waitFor(`${cycle.label} (wheel closed)`, 'wheelClosed');
          swappedAt = null;
          continue;
        }
        await page.keyboard.press('Digit1');
      }
    }
    assert.ok(swappedAt, `${cycle.label}: never swapped away from a live beam`);
    await waitFor(`${cycle.label}: swapped away`, hudIsNot, 'lightning-ledger');
    const away = await read();
    await waitTicks(`${cycle.label}: break cooldown`, COOLDOWN_TICKS);
    await wheelPick(`${cycle.label}: wheel back to the Ledger`, 6, 'lightning-ledger');
    // The live bug throws at this restart and stops the ticker.
    await waitFor(`${cycle.label}: fresh beam after the swap`, 'stage', { key: 'lightningLedgerActive', value: 'true' });
    await waitTicks(`${cycle.label}: ticker keeps running`, 30);
    const after = await read();
    assert.deepEqual(errors, [], `${cycle.label}: runtime errors`);
    assert.ok(['active', 'upgrade'].includes(after.simulation), `${cycle.label}: the run must still be stepping (${after.simulation})`);
    report.cycles.push({ label: cycle.label, swappedAt, awayWeapon: away.weapon, after });
  }
  await page.screenshot({ path: path.join(output, 'final.png') });
  const final = await read();
  assert.ok(final.pulses > report.cycles[0].swappedAt.pulses, 'the restarted beams pulsed');
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, 'report.json'), `${JSON.stringify({ ...report, final, errors }, null, 2)}\n`);
  console.log(JSON.stringify({ status: 'PASS', cycles: report.cycles.map(({ label, swappedAt, awayWeapon, after }) => ({ label, swappedAtTick: swappedAt.tick, awayWeapon, afterTick: after.ticks })) }));
} finally {
  await browser.close();
  server.close();
}

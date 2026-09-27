// Build ledger slice 6 review item: a weapon switch the player did not make by
// hand (a cache that auto-selects its gun, a refill that selects) used to leave
// a live Lightning Ledger channel flagged active after the switch, so the beam
// overheated or "released" the moment the player switched back. Every switch
// away from the Ledger now ends the channel inside the tick, the way a manual
// switch always has (stopReason 'switch', the break cooldown).
//
// 1.8.x hotfix (fable/hmh-ledger-swap-hotfix): on the 1.8.x child a cache
// always selects its gun (select: true), and the manual SWAP and weapon-wheel
// paths already ended the channel inside the weapon system but main.mjs never
// handed that break to the run summary. The summary kept the Ledger marked
// channelling, so the next channel start threw "Lightning Ledger channel is
// already active" and stopped the ticker mid-run (paid runs lost). The last
// block pins the switch -> summary contract for SWAP, a wheel pick and a cache.
import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createWeaponLoadout,
  grantWeaponPickup,
  refillWeaponLoadout,
  stepWeaponLoadout,
  nextOwnedWeaponId,
  switchWeapon,
} from '../apps/hmh-reboot/src/weapon-system.mjs';
import * as summary from '../sdk/hmh-run-summary.mjs';
import { LIGHTNING_LEDGER_CONFIG } from '../apps/hmh-reboot/src/lightning-ledger.mjs';

const TARGETS = Object.freeze([{ id: 'zombie-1', x: 140, y: 0, z: 0 }]);
const DIRECTION = Object.freeze({ x: 1, y: 0 });

function stepChannel(loadout, tick, fire = true) {
  return stepWeaponLoadout(loadout, {
    tick, fire, direction: DIRECTION, channelOrigin: { x: 0, y: 0 },
    channelTargets: TARGETS, channelLineOfSight: () => true,
  });
}

// The Ledger drawn and channelling for 40 ticks; the Shotgun still unowned.
function channelingLoadout() {
  const loadout = createWeaponLoadout({ weaponIds: ['coin-blaster', 'scatter-shotgun', 'lightning-ledger'], activeWeaponId: 'lightning-ledger', seed: 0x4c4544 });
  assert.equal(stepChannel(loadout, 0).events[0].type, 'ledger:channel-start');
  for (let tick = 1; tick <= 40; tick += 1) stepChannel(loadout, tick);
  const ledger = loadout.weapons['lightning-ledger'];
  assert.equal(ledger.channelState.active, true, 'the beam is live');
  return { loadout, ledger };
}

// After the switch away, the player comes back to the Ledger once the break
// cooldown and the switch lockout have passed and holds fire on a target.
function channelRestartEvents(loadout, switchedTick) {
  const backTick = switchedTick + LIGHTNING_LEDGER_CONFIG.breakCooldownTicks + 1;
  assert.ok(switchWeapon(loadout, 'lightning-ledger', { tick: backTick }));
  const events = [];
  for (let tick = backTick; tick <= backTick + loadout.switchTicks + 1; tick += 1) events.push(...stepChannel(loadout, tick).events);
  return events.map((event) => event.type);
}

test('a weapon cache that auto-selects its gun ends a live Ledger channel inside the tick', () => {
  const { loadout, ledger } = channelingLoadout();
  const granted = grantWeaponPickup(loadout, { tick: 41, weaponId: 'scatter-shotgun', select: true });
  assert.equal(loadout.activeWeaponId, 'scatter-shotgun');
  assert.equal(ledger.channelState.active, false, 'the channel ended with the switch');
  assert.equal(ledger.channelState.channelStartTick, null);
  assert.equal(ledger.channelState.cooldownUntilTick, 41 + LIGHTNING_LEDGER_CONFIG.breakCooldownTicks, 'the break cooldown of a manual switch');
  assert.equal(granted.interrupted?.type, 'ledger:channel-break');
  assert.equal(granted.interrupted?.reason, 'switch');
  assert.equal(granted.interrupted?.tick, 41);
  // Coming back starts a fresh channel instead of overheating a stale one.
  const types = channelRestartEvents(loadout, 41);
  assert.ok(types.includes('ledger:channel-start'), types.join(','));
  assert.ok(!types.includes('ledger:overheat') && !types.includes('ledger:channel-break'), types.join(','));
});

test('a refill that selects another gun ends the channel the same way', () => {
  const { loadout, ledger } = channelingLoadout();
  grantWeaponPickup(loadout, { tick: 41, weaponId: 'scatter-shotgun', select: false });
  assert.equal(loadout.activeWeaponId, 'lightning-ledger', 'a cache that does not select leaves the Ledger drawn');
  assert.equal(ledger.channelState.active, true, 'and its beam live');
  stepChannel(loadout, 41);
  const refilled = refillWeaponLoadout(loadout, { tick: 42, weaponId: 'scatter-shotgun', select: true });
  assert.equal(loadout.activeWeaponId, 'scatter-shotgun');
  assert.equal(ledger.channelState.active, false);
  assert.equal(refilled.interrupted?.type, 'ledger:channel-break');
  assert.equal(refilled.interrupted?.reason, 'switch');
  const types = channelRestartEvents(loadout, 42);
  assert.ok(types.includes('ledger:channel-start'), types.join(','));
  assert.ok(!types.includes('ledger:overheat'), types.join(','));
});

test('a cache for the drawn Ledger, or one that does not select, keeps the beam running and reports no interruption', () => {
  const { loadout, ledger } = channelingLoadout();
  const cells = ledger.channelState.cellsRemaining;
  const ownCache = grantWeaponPickup(loadout, { tick: 41, weaponId: 'lightning-ledger', select: true });
  assert.equal(loadout.activeWeaponId, 'lightning-ledger');
  assert.equal(ledger.channelState.active, true);
  assert.equal(ownCache.interrupted, null);
  assert.equal(ledger.channelState.cellsRemaining, LIGHTNING_LEDGER_CONFIG.cellSegments, `topped up from ${cells} (1.8.4 hotfix)`);
  const other = grantWeaponPickup(loadout, { tick: 42, weaponId: 'scatter-shotgun', select: false });
  assert.equal(other.interrupted, null);
  assert.equal(ledger.channelState.active, true);
  const refill = refillWeaponLoadout(loadout, { tick: 43 });
  assert.equal(refill.interrupted, null);
  assert.equal(ledger.channelState.active, true, 'a plain refill never switches, so it never breaks the beam');
  const frame = stepChannel(loadout, 43);
  assert.ok(!frame.events.some((event) => event.type === 'ledger:overheat'));
});

test('the same switch resolves identically for the same inputs, and a switch elsewhere touches nothing', () => {
  const run = () => {
    const { loadout, ledger } = channelingLoadout();
    const granted = grantWeaponPickup(loadout, { tick: 41, weaponId: 'scatter-shotgun', select: true });
    return JSON.stringify([granted, ledger.channelState, channelRestartEvents(loadout, 41)]);
  };
  assert.equal(run(), run());
  const pistolOnly = createWeaponLoadout({ weaponIds: ['coin-blaster', 'scatter-shotgun'], seed: 1 });
  const granted = grantWeaponPickup(pistolOnly, { tick: 5, weaponId: 'scatter-shotgun', select: true });
  assert.equal(granted.interrupted, null, 'no channel weapon in the loadout');
});

// The runtime's display order (main.mjs WEAPON_ORDER): SWAP cycles it and a
// wheel pick selects slot N directly.
const WEAPON_ORDER = Object.freeze(['coin-blaster', 'scatter-shotgun', 'auto-miner', 'launcher-rig', 'hash-rail', 'lightning-ledger', 'bear-market-burner', 'forked-standard']);

function summaryAccumulator() {
  return summary.createRunSummaryAccumulator({
    seed: 7, buildHash: 'ledger-swap-hotfix', mode: 'free', heroId: 'hero-hodler', startTick: 0, startPosition: { x: 0, y: 0 },
  });
}

const SWAP = { apply: (loadout, tick) => switchWeapon(loadout, nextOwnedWeaponId(loadout, WEAPON_ORDER), { tick }) };
const WHEEL_PISTOL = { apply: (loadout, tick) => switchWeapon(loadout, WEAPON_ORDER[1 - 1], { tick }) };
const CACHE = { apply: (loadout, tick) => grantWeaponPickup(loadout, { tick, weaponId: 'scatter-shotgun', select: true }) };

for (const [label, path] of [['SWAP (next owned weapon)', SWAP], ['a weapon-wheel pick', WHEEL_PISTOL], ['a cache that selects its gun', CACHE]]) {
  test(`${label} away from a live Ledger closes the summary channel so a later channel start does not throw`, () => {
    const switchAt = 40;
    const backAt = switchAt + LIGHTNING_LEDGER_CONFIG.breakCooldownTicks + 5;
    // Mirrors the main.mjs tick order: the switch edge, then the weapon step,
    // with every ledger event (and a switch's interrupted break) fed to the summary.
    const { loadout, acc, switches } = (() => {
      const loadout = createWeaponLoadout({ weaponIds: ['coin-blaster', 'scatter-shotgun', 'lightning-ledger'], activeWeaponId: 'lightning-ledger', seed: 0x4c4544 });
      const acc = summaryAccumulator();
      const record = (event) => {
        if (event?.type?.startsWith('ledger:') || event?.type === 'weapon:channel-pulse') summary.recordRunLightningLedgerEvent(acc, event);
      };
      const switches = [];
      for (let tick = 0; tick <= backAt + loadout.switchTicks + 30; tick += 1) {
        let switched = null;
        if (tick === switchAt) switched = path.apply(loadout, tick);
        else if (tick === backAt) switched = switchWeapon(loadout, 'lightning-ledger', { tick });
        if (switched) {
          switches.push(switched);
          if (switched.interrupted) record(switched.interrupted);
        }
        for (const event of stepChannel(loadout, tick).events) record(event);
      }
      return { loadout, acc, switches };
    })();
    assert.equal(switches[0].interrupted?.type, 'ledger:channel-break');
    assert.equal(switches[0].interrupted?.reason, 'switch');
    assert.equal(loadout.activeWeaponId, 'lightning-ledger');
    assert.equal(loadout.weapons['lightning-ledger'].channelState.active, true, 'a fresh channel started after the swap back');
    const result = summary.finalizeRunSummary(acc, {
      endTick: backAt + loadout.switchTicks + 31, elapsedMs: 1000, terminalReason: 'completed', score: 0, level: 1, xp: 0, currentCombo: 0, maxCombo: 0, revealedCells: 0, totalCells: 1,
    });
    assert.equal(result.lightningLedger.interruptions.switch, 1, 'the switch break is counted once');
    assert.equal(result.lightningLedger.interruptions.overheat, 0);
  });
}

test('without the recorded switch break the summary keeps the Ledger channelling and the next start throws (the live bug)', () => {
  const acc = summaryAccumulator();
  summary.recordRunLightningLedgerEvent(acc, { type: 'ledger:channel-start', tick: 0 });
  // The weapon system ended the channel on the swap, but the break never reached the summary.
  assert.throws(() => summary.recordRunLightningLedgerEvent(acc, { type: 'ledger:channel-start', tick: 60 }), /already active/);
});

test('main.mjs hands every switch-induced channel break to the run summary (SWAP, wheel and cache)', () => {
  const main = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /const switched = switchWeapon\(weaponLoadout, requestedWeaponId, \{ tick \}\);[\s\S]{0,400}if \(switched\.interrupted\) recordRunLightningLedgerEvent\(runSummaryAccumulator, switched\.interrupted\)/);
  assert.match(main, /const granted = grantWeaponPickup\(weaponLoadout, \{ tick, weaponId: event\.weaponId, select: true, progressionByWeapon \}\);[\s\S]{0,400}if \(granted\.interrupted\) recordRunLightningLedgerEvent\(runSummaryAccumulator, granted\.interrupted\)/);
  // Every other select path in the runtime is at tick 0 (debug loadouts) or does not select.
  assert.doesNotMatch(main, /refillWeaponLoadout\([^)]*select: true/);
});

// Dry fallback. In live play the Ledger's own cell drain ends the channel with
// reason 'empty' before the clip can read zero, so the fallback normally finds
// no live beam. The weapon system still owns the invariant that every switch
// away ends a live channel, so a Ledger that is dry while its beam is flagged
// live (any future path that empties the clip or reserve out of band) must
// break the channel inside the fallback tick and hand the break to the frame
// events that main.mjs feeds to the run summary.
function recordLedgerEvents(acc, events) {
  for (const event of events) {
    if (event?.type?.startsWith('ledger:') || event?.type === 'weapon:channel-pulse') summary.recordRunLightningLedgerEvent(acc, event);
  }
}

test('the dry-gun fallback away from a live Ledger ends the channel and puts the break in the frame events', () => {
  const { loadout, ledger } = channelingLoadout();
  const acc = summaryAccumulator();
  summary.recordRunLightningLedgerEvent(acc, { type: 'ledger:channel-start', tick: 0 });
  ledger.ammoInClip = 0;
  ledger.reserveAmmo = 0;
  ledger.reloadCompleteTick = null;
  const frame = stepChannel(loadout, 41);
  const types = frame.events.map((event) => event.type);
  assert.equal(loadout.activeWeaponId, 'coin-blaster', types.join(','));
  assert.ok(types.includes('weapon:auto-fallback'), types.join(','));
  assert.equal(ledger.channelState.active, false, 'the fallback ended the beam');
  const breakEvent = frame.events.find((event) => event.type === 'ledger:channel-break');
  assert.equal(breakEvent?.reason, 'switch');
  assert.equal(breakEvent?.tick, 41);
  assert.ok(types.indexOf('ledger:channel-break') < types.indexOf('weapon:auto-fallback'), 'the break precedes the fallback');
  recordLedgerEvents(acc, frame.events);
  // The summary channel is closed: a later start on the refilled Ledger does not throw.
  assert.doesNotThrow(() => summary.recordRunLightningLedgerEvent(acc, { type: 'ledger:channel-start', tick: 41 + LIGHTNING_LEDGER_CONFIG.breakCooldownTicks + 1 }));
});

test('a Ledger that runs dry through its own cell drain ends with reason empty, falls back, and the summary finalizes cleanly', () => {
  const loadout = createWeaponLoadout({ weaponIds: ['coin-blaster', 'lightning-ledger'], activeWeaponId: 'lightning-ledger', seed: 0x4c4544 });
  const ledger = loadout.weapons['lightning-ledger'];
  ledger.reserveAmmo = 0;
  const acc = summaryAccumulator();
  const seen = [];
  let tick = 0;
  for (; tick < 2_000 && loadout.activeWeaponId === 'lightning-ledger'; tick += 1) {
    const frame = stepChannel(loadout, tick);
    seen.push(...frame.events.map((event) => `${event.type}${event.reason ? `:${event.reason}` : ''}`));
    recordLedgerEvents(acc, frame.events);
  }
  assert.equal(loadout.activeWeaponId, 'coin-blaster', `no fallback within ${tick} ticks: ${seen.slice(-8).join(',')}`);
  assert.ok(seen.includes('ledger:channel-break:empty') || seen.includes('ledger:overheat:overheat'), seen.join(','));
  assert.ok(seen.includes('weapon:auto-fallback'));
  assert.ok(!seen.includes('ledger:channel-break:switch'), 'the beam had already stopped, so the fallback has nothing to break');
  assert.equal(ledger.channelState.active, false);
  const result = summary.finalizeRunSummary(acc, {
    endTick: tick + 1, elapsedMs: 1000, terminalReason: 'completed', score: 0, level: 1, xp: 0, currentCombo: 0, maxCombo: 0, revealedCells: 0, totalCells: 1,
  });
  assert.equal(result.lightningLedger.interruptions.switch, 0);
});

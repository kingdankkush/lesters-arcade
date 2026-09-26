// Build ledger slice 6 review item: a weapon switch the player did not make by
// hand (a cache that auto-selects its gun, a refill that selects) used to leave
// a live Lightning Ledger channel flagged active after the switch, so the beam
// overheated or "released" the moment the player switched back. Every switch
// away from the Ledger now ends the channel inside the tick, the way a manual
// switch always has (stopReason 'switch', the break cooldown).
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createWeaponLoadout,
  grantWeaponPickup,
  refillWeaponLoadout,
  stepWeaponLoadout,
  switchWeapon,
} from '../apps/hmh-reboot/src/weapon-system.mjs';
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
  const granted = grantWeaponPickup(loadout, { tick: 41, weaponId: 'scatter-shotgun', select: 'if-new' });
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
  const ownCache = grantWeaponPickup(loadout, { tick: 41, weaponId: 'lightning-ledger', select: 'if-new' });
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
    const granted = grantWeaponPickup(loadout, { tick: 41, weaponId: 'scatter-shotgun', select: 'if-new' });
    return JSON.stringify([granted, ledger.channelState, channelRestartEvents(loadout, 41)]);
  };
  assert.equal(run(), run());
  const pistolOnly = createWeaponLoadout({ weaponIds: ['coin-blaster', 'scatter-shotgun'], seed: 1 });
  const granted = grantWeaponPickup(pistolOnly, { tick: 5, weaponId: 'scatter-shotgun', select: true });
  assert.equal(granted.interrupted, null, 'no channel weapon in the loadout');
});

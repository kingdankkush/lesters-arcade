import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { COLLECTIBLE_EFFECTS } from '../apps/hmh-reboot/src/collectible-system.mjs';
import { AUTHORED_PROP_ASSETS } from '../apps/hmh-reboot/src/authored-prop-atlas.mjs';
import { HMH_WEAPON_SFX, weaponFireCueId } from '../apps/hmh-reboot/src/weapon-audio.mjs';
import { HMH_RUN_SUMMARY_CATALOGS } from '../sdk/hmh-run-summary-schema.mjs';
import {
  HMH_WEAPON_DEFINITIONS,
  createWeaponLoadout,
  selectWeapon,
  stepWeaponLoadout,
} from '../apps/hmh-reboot/src/weapon-system.mjs';

test('W8B Lightning Ledger is a six-cell channel weapon in the authoritative loadout', () => {
  const definition = HMH_WEAPON_DEFINITIONS['lightning-ledger'];
  assert.equal(definition.kind, 'channel');
  assert.equal(definition.clipSize, 6);
  assert.equal(definition.displayName, 'Lightning Ledger');

  const state = createWeaponLoadout({
    weaponIds: ['coin-blaster', 'lightning-ledger'],
    activeWeaponId: 'lightning-ledger',
    seed: 0x484d4808,
  });
  const targets = [
    { id: 'enemy-b', x: 180, y: 0, active: true },
    { id: 'enemy-a', x: 90, y: 0, active: true },
  ];
  let frame = stepWeaponLoadout(state, {
    tick: 0,
    fire: true,
    direction: { x: 1, y: 0 },
    channelOrigin: { x: 0, y: 0 },
    channelTargets: targets,
    channelLineOfSight: () => true,
  });
  assert.equal(frame.events[0].type, 'ledger:channel-start');

  frame = stepWeaponLoadout(state, {
    tick: 6,
    fire: true,
    direction: { x: 1, y: 0 },
    channelOrigin: { x: 0, y: 0 },
    channelTargets: targets,
    channelLineOfSight: () => true,
  });
  const pulse = frame.events.find((event) => event.type === 'weapon:channel-pulse');
  assert.deepEqual(pulse.hits.map((hit) => hit.targetId), ['enemy-a', 'enemy-b']);
  assert.ok(pulse.hits.every((hit) => hit.damage > 0));
  assert.equal(pulse.rampPermille, 1067);

  const switched = selectWeapon(state, 'coin-blaster', { tick: 7 });
  assert.equal(switched.interrupted.reason, 'switch');
  assert.equal(state.weapons['lightning-ledger'].channelState.active, false);
});

test('W8B Lightning Ledger has a shipped collectible path and fixed-step browser integration', async () => {
  assert.equal(COLLECTIBLE_EFFECTS['lightning-ledger-cache'].weaponId, 'lightning-ledger');
  assert.ok(HMH_RUN_SUMMARY_CATALOGS.collectibles.includes('lightning-ledger-cache'));
  assert.ok(AUTHORED_PROP_ASSETS.weapons.includes('lightning-ledger'));
  assert.ok(AUTHORED_PROP_ASSETS.pickups.includes('lightning-ledger-cache'));
  assert.equal(weaponFireCueId('lightning-ledger'), 'hmh-fire-lightning-ledger');
  for (const cueId of ['hmh-lightning-interrupt', 'hmh-lightning-overheat', 'hmh-lightning-empty']) {
    assert.ok(HMH_WEAPON_SFX[cueId]);
  }
  const main = await readFile(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /weapon:channel-pulse/);
  assert.match(main, /type:\s*'lightning-ledger'/);
  assert.match(main, /createLightningLedgerRareEvent/);
  assert.match(main, /lightningLedgerEvent/);
  assert.match(main, /channelLineOfSight:\s*\(from, to\)/);
  assert.match(main, /const lightningTargets = \[/);
  assert.match(main, /channelTargets: lightningTargets/);
});

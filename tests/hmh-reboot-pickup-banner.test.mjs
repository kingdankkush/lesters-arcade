import assert from 'node:assert/strict';
import test from 'node:test';
import { PICKUP_BANNER_FADE_TICKS, PICKUP_BANNER_HOLD_TICKS, PICKUP_BANNER_QUEUE_CAP, createPickupBanner, pickupBannerText } from '../apps/hmh-reboot/src/pickup-banner.mjs';

/**
 * Owner direction 2026-09-16: a brief bold banner names every pickup and
 * world interaction, then fades. Tick-driven and deterministic.
 */

function fakeDocument() {
  const make = (tag) => {
    const node = { tag, className: '', dataset: {}, textContent: '', children: [], attributes: {}, removed: false };
    node.append = (...items) => node.children.push(...items);
    node.setAttribute = (name, value) => { node.attributes[name] = value; };
    node.remove = () => { node.removed = true; };
    return node;
  };
  return { createElement: make };
}

test('pickup banner copy names weapons, supplies, power-ups, objective rewards and world interactions', () => {
  const weaponTitles = { 'hash-rail': 'Hash Rail', 'forked-standard': 'Forked Standard' };
  assert.deepEqual(pickupBannerText({ type: 'collectible:collected', kind: 'weapon-cache', weaponId: 'hash-rail' }, { weaponTitles }), { kind: 'weapon', title: 'PICKED UP: HASH RAIL', detail: 'Armed and ready' });
  assert.equal(pickupBannerText({ type: 'collectible:collected', kind: 'weapon-cache', weaponId: 'hash-rail', bonusWeaponId: 'forked-standard' }, { weaponTitles }).detail, 'Also unlocked: Forked Standard');
  assert.equal(pickupBannerText({ type: 'collectible:collected', kind: 'ammo-refill' }).title, 'AMMO REFILLED');
  assert.equal(pickupBannerText({ type: 'collectible:collected', kind: 'grenade-supply' }).title, '+1 GRENADE');
  assert.equal(pickupBannerText({ type: 'collectible:collected', kind: 'heal', amount: 30 }).title, '+30 HEALTH');
  assert.equal(pickupBannerText({ type: 'collectible:collected', kind: 'nuke' }).kind, 'nuke');
  assert.deepEqual(pickupBannerText({ type: 'collectible:collected', kind: 'timed', effectId: 'berserk', durationTicks: 600 }, { effectTitles: { berserk: 'Berserk' } }), { kind: 'power', title: 'BERSERK', detail: 'Power-up active · 10 s' });
  assert.deepEqual(pickupBannerText({ type: 'collectible:collected', kind: 'heal', amount: 30 }, { objectiveReward: { rewardName: 'Litecoin Sanctuary', respawnTicks: 7200 } }), { kind: 'objective', title: 'LITECOIN SANCTUARY COLLECTED', detail: 'Returns in 120 s' });
  assert.deepEqual(pickupBannerText({ type: 'world:activated', name: 'Crossing pumphouse', rewardName: 'Liquidity Haven' }), { kind: 'world', title: 'CROSSING PUMPHOUSE ACTIVATED', detail: 'Liquidity Haven ready nearby' });
  assert.equal(pickupBannerText({ type: 'world:gate', name: 'Vault gate' }).title, 'VAULT GATE UNLOCKED');
  assert.equal(pickupBannerText({ type: 'world:secret', name: 'Genesis block' }).title, 'GENESIS BLOCK FOUND');
  assert.equal(pickupBannerText({ type: 'weapon:swap' }), null);
  assert.equal(pickupBannerText({ type: 'collectible:collected', kind: 'unknown' }), null);
  assert.equal(pickupBannerText(null), null);
});

test('the banner shows, holds, fades and hides on ticks, queues in order, coalesces repeats and caps the queue', () => {
  const documentRef = fakeDocument();
  const mount = documentRef.createElement('main');
  const banner = createPickupBanner({ mount, documentRef });
  assert.equal(mount.children[0].className, 'hmh-pickup-banner');
  assert.equal(banner.update(0), 'hidden');
  banner.announce({ kind: 'ammo', title: 'AMMO REFILLED', detail: 'Every weapon topped up' }, 10);
  assert.equal(banner.update(10), 'shown');
  assert.deepEqual([banner.state().title, banner.state().detail, banner.state().kind], ['AMMO REFILLED', 'Every weapon topped up', 'ammo']);
  banner.announce({ kind: 'ammo', title: 'AMMO REFILLED' }, 20);
  banner.update(20);
  assert.equal(banner.state().title, 'AMMO REFILLED ×2', 'a repeat inside the window becomes a count');
  banner.announce({ kind: 'grenade', title: '+1 GRENADE' }, 21);
  banner.announce({ kind: 'grenade', title: '+1 GRENADE' }, 22);
  banner.announce({ kind: 'heal', title: '+30 HEALTH' }, 23);
  assert.equal(banner.state().queued, 2, 'queued repeats merge');
  assert.equal(banner.update(20 + PICKUP_BANNER_HOLD_TICKS), 'fading');
  assert.equal(banner.update(20 + PICKUP_BANNER_HOLD_TICKS + PICKUP_BANNER_FADE_TICKS), 'shown', 'the next queued banner follows the fade');
  assert.equal(banner.state().title, '+1 GRENADE ×2');
  const start = 20 + PICKUP_BANNER_HOLD_TICKS + PICKUP_BANNER_FADE_TICKS;
  banner.update(start + PICKUP_BANNER_HOLD_TICKS + PICKUP_BANNER_FADE_TICKS);
  assert.equal(banner.state().title, '+30 HEALTH');
  for (let i = 0; i < PICKUP_BANNER_QUEUE_CAP + 3; i++) banner.announce({ kind: 'world', title: `SITE ${i}` }, 400);
  assert.equal(banner.state().queued, PICKUP_BANNER_QUEUE_CAP, 'the queue is bounded');
  assert.equal(banner.announce(null, 1), false);
  assert.throws(() => banner.update(-1), /tick/);
  banner.clear();
  assert.deepEqual([banner.state().state, banner.state().queued], ['hidden', 0]);
  banner.destroy();
  assert.equal(mount.children[0].removed, true);
  assert.throws(() => createPickupBanner({ mount: null, documentRef }), /mount/);
});

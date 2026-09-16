import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  createWeaponLoadout,
  grantWeaponPickup,
  nextOwnedWeaponId,
  stepWeaponLoadout,
  switchWeapon,
} from '../apps/hmh-reboot/src/weapon-system.mjs';
import { InputState, computeTouchControlLayout, mapGamepadSnapshot } from '../apps/hmh-reboot/src/input.mjs';
import { DeterministicSimulation } from '../apps/hmh-reboot/src/simulation.mjs';
import { createHurtTarget, createProjectileState, resolveProjectileBatch, resolveProjectilePath } from '../apps/hmh-reboot/src/projectile-physics.mjs';
import { ammoLabel, createWeaponWheel, weaponWheelRadius, weaponWheelSlotPositions, weaponWheelSlotWidth } from '../apps/hmh-reboot/src/weapon-wheel.mjs';

/**
 * Owner direction 2026-09-16: one manual weapon control (SWAP cycles carried
 * weapons; the HUD weapon card opens a wheel) so a player can hold a rare
 * weapon back for a boss. Fire, melee and dash stay automatic.
 */

const ORDER = ['coin-blaster', 'scatter-shotgun', 'auto-miner', 'launcher-rig', 'hash-rail', 'lightning-ledger', 'bear-market-burner', 'forked-standard'];
const direction = Object.freeze({ x: 1, y: 0 });
const context = { actor: { x: 0, y: 0, z: 0 }, camera: { x: 0, y: 0, zoom: 1 }, viewport: { width: 800, height: 450 }, nowMs: 0 };

function loadoutWith(...ids) {
  const state = createWeaponLoadout({ weaponIds: ORDER, seed: 5 });
  let tick = 1;
  for (const id of ids) { grantWeaponPickup(state, { tick, weaponId: id, select: false }); tick += 1; }
  return state;
}

test('SWAP cycles only carried weapons in display order and wraps back to the pistol', () => {
  const pistolOnly = loadoutWith();
  assert.equal(nextOwnedWeaponId(pistolOnly, ORDER), null, 'nothing to cycle to with the pistol alone');
  const state = loadoutWith('hash-rail', 'scatter-shotgun');
  assert.equal(nextOwnedWeaponId(state, ORDER), 'scatter-shotgun');
  state.activeWeaponId = 'scatter-shotgun';
  assert.equal(nextOwnedWeaponId(state, ORDER), 'hash-rail');
  state.activeWeaponId = 'hash-rail';
  assert.equal(nextOwnedWeaponId(state, ORDER), 'coin-blaster', 'the pistol is always one press away');
});

test('a manual switch precedes the weapon step of its tick and starts the switch lockout', () => {
  const state = loadoutWith('hash-rail');
  stepWeaponLoadout(state, { tick: 10, fire: false, direction });
  assert.throws(() => switchWeapon(state, 'hash-rail', { tick: 10 }), /precede/);
  assert.throws(() => switchWeapon(state, 'lightning-ledger', { tick: 11 }), /unowned/);
  assert.throws(() => switchWeapon(state, 'nope', { tick: 11 }), /unknown/);
  assert.equal(switchWeapon(state, 'coin-blaster', { tick: 11 }), null, 'switching to the armed weapon is a no-op');
  const event = switchWeapon(state, 'hash-rail', { tick: 11 });
  assert.equal(event.type, 'weapon:switch');
  assert.equal(event.manual, true);
  assert.equal(event.previousWeaponId, 'coin-blaster');
  assert.equal(state.activeWeaponId, 'hash-rail');
  assert.equal(state.switchReadyTick, 11 + state.switchTicks);
  // The same tick still steps normally: the switch did not consume it.
  const frame = stepWeaponLoadout(state, { tick: 11, fire: true, direction });
  assert.equal(frame.events.length, 0, 'the switch lockout blocks fire on the switch tick');
  const ready = stepWeaponLoadout(state, { tick: state.switchReadyTick, fire: true, direction });
  assert.equal(ready.events[0]?.type, 'weapon:charge-start', 'the rail starts charging once the lockout ends');
});

test('keyboard Q, right bumper and the SWAP touch button are one-tick edges that never repeat while held', () => {
  const input = new InputState();
  input.setKey('KeyQ', true, 10);
  const first = input.snapshot({ ...context, nowMs: 11 });
  assert.equal(first.actions.weaponNext, true);
  assert.equal(first.heldActions.weaponNext, false, 'held continuation never carries the swap');
  input.consumeBufferedActions(first.sequence);
  const held = input.snapshot({ ...context, nowMs: 12 });
  assert.equal(held.actions.weaponNext, false, 'a held key does not re-swap');
  input.setKey('KeyQ', false, 13);
  input.setKey('KeyE', true, 14);
  assert.equal(input.snapshot({ ...context, nowMs: 15 }).actions.weaponNext, true, 'E is the default alternate');
  input.reset('test');
  input.setTouch({ weaponNext: true }, 20);
  assert.equal(input.snapshot({ ...context, nowMs: 21 }).actions.weaponNext, true);
  const pad = mapGamepadSnapshot({ axes: [0, 0, 0, 0], buttons: Array.from({ length: 16 }, (_, index) => ({ pressed: index === 5 })) });
  assert.equal(pad.actions.weaponNext, true, 'right bumper swaps');
  assert.equal(pad.actions.grenade, false);
});

test('a wheel pick is a direct slot request consumed by the next admitted tick', () => {
  const input = new InputState();
  assert.throws(() => input.requestWeaponSlot(0, 5), /1 to 8/);
  assert.throws(() => input.requestWeaponSlot(9, 5), /1 to 8/);
  input.requestWeaponSlot(5, 5);
  const waiting = input.snapshot({ ...context, nowMs: 6 });
  assert.equal(waiting.actions.weaponSlot, 5);
  // A frame that admits no tick keeps the request.
  const again = input.snapshot({ ...context, nowMs: 400 });
  assert.equal(again.actions.weaponSlot, 5, 'the request outlives the 100 ms edge buffer');
  input.consumeBufferedActions(again.sequence);
  assert.equal(input.snapshot({ ...context, nowMs: 401 }).actions.weaponSlot, 0);
  input.requestWeaponSlot(2, 500);
  input.reset('blur');
  assert.equal(input.snapshot({ ...context, nowMs: 501 }).actions.weaponSlot, 0, 'reset drops a pending pick');
});

test('the simulation holds in the menu state for the wheel and resumes without ticking', () => {
  const simulation = new DeterministicSimulation({ seed: 3 });
  simulation.start();
  assert.throws(() => simulation.leaveMenu(), /Cannot leave menu/);
  simulation.enterMenu();
  assert.equal(simulation.state, 'menu');
  assert.throws(() => simulation.enterMenu(), /Cannot enter menu/);
  assert.equal(simulation.update(100).steps, 0, 'no ticks while the wheel is open');
  simulation.pause();
  simulation.resume();
  assert.equal(simulation.state, 'menu', 'a portal pause returns to the menu hold');
  simulation.leaveMenu();
  assert.equal(simulation.state, 'active');
  assert.equal(simulation.update(FIXED_STEP).steps, 1);
});
const FIXED_STEP = 1000 / 60;

test('the SWAP touch button shares the grenade row and never overlaps another control', () => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 360, height: 640 }, { width: 375, height: 667 }]) {
    for (const leftHanded of [false, true]) {
      const layout = computeTouchControlLayout({ ...viewport, leftHanded });
      const swap = layout.buttons.swap;
      assert.ok(swap, 'swap button present');
      assert.equal(swap.y, layout.buttons.power.y, 'same thumb row as grenade');
      assert.ok(swap.radius * 2 >= 44);
      const controls = [layout.moveStick, layout.aimStick, layout.buttons.power, layout.buttons.pause];
      for (const other of controls) {
        const distance = Math.hypot(other.x - swap.x, other.y - swap.y);
        assert.ok(distance >= other.radius + swap.radius - 0.5, `swap overlaps a control at ${viewport.width}x${viewport.height} leftHanded=${leftHanded}`);
      }
      assert.ok(swap.x - swap.radius >= 0 && swap.x + swap.radius <= viewport.width);
      assert.ok(swap.y - swap.radius >= 0 && swap.y + swap.radius <= viewport.height);
    }
  }
});

test('a piercing slug remembers the bodies it passed and keeps flying through a crowd', () => {
  const targets = [1, 2, 3, 4, 5, 6, 7].map((index) => createHurtTarget({
    id: `e${index}`, active: true, health: 100,
    bodyShape: { type: 'circle', radius: 12 }, hurtShape: { type: 'circle', radius: 10 },
    previousGround: { x: index * 40, y: 0, z: 0 }, currentGround: { x: index * 40, y: 0, z: 0 },
    minZ: 4, maxZ: 58,
  }));
  const projectile = createProjectileState({
    id: 'rail-1', ownerId: 'player', previous: { x: 0, y: 0, z: 20 }, current: { x: 100, y: 0, z: 20 }, radius: 2, damage: 54,
    policy: { type: 'pierce', maxTargets: 6 }, excludeTargetIds: ['e1'],
  });
  assert.deepEqual(projectile.excludeTargetIds, ['e1']);
  assert.throws(() => createProjectileState({ id: 'x', ownerId: 'p', previous: { x: 0, y: 0, z: 0 }, current: { x: 1, y: 0, z: 0 }, damage: 1, excludeTargetIds: [1] }), /excludeTargetIds/);
  const first = resolveProjectilePath({ projectile, targets });
  assert.deepEqual(first.hits.map((hit) => hit.targetId), ['e2'], 'an excluded body is skipped even though the segment crosses it');
  const batch = resolveProjectileBatch({
    projectiles: [createProjectileState({ id: 'rail-2', ownerId: 'player', previous: { x: 0, y: 0, z: 20 }, current: { x: 300, y: 0, z: 20 }, radius: 2, damage: 54, policy: { type: 'pierce', maxTargets: 6 } })],
    targets,
  });
  assert.deepEqual(batch.damageEvents.map((hit) => hit.targetId), ['e1', 'e2', 'e3', 'e4', 'e5', 'e6'], 'six bodies in one lane, the seventh is spared by the budget');
  assert.ok(batch.damageEvents.every((hit) => hit.damage === 54), 'no falloff along the lane');
});

test('the runtime carries pierce hits across ticks and only retires the slug on cover, range, or budget', async () => {
  const main = await readFile(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /pierceHitIds: shot\.policy\?\.type === 'pierce' \? \[\] : null/);
  assert.match(main, /excludeTargetIds: pierced > 0 \? shot\.pierceHitIds : null/);
  assert.match(main, /if \(shot\.pierceHitIds\.length < shot\.policy\.maxTargets\) continue;/);
  assert.match(main, /nextOwnedWeaponId\(weaponLoadout, WEAPON_ORDER\)/);
  assert.match(main, /switchWeapon\(weaponLoadout, requestedWeaponId, \{ tick \}\)/);
  assert.match(main, /import\('\.\/weapon-wheel\.mjs'\)/, 'the wheel stays a lazy chunk');
  assert.match(main, /simulation\.enterMenu\(\)/);
  assert.match(main, /if \(weaponWheel\?\.isOpen\(\)\) closeWeaponWheel\(0\);\n\s+if \(!simulation \|\| \(simulation\.state !== 'active'/, 'a pause closes the wheel first');
});

test('the shell exposes the weapon card as the wheel trigger and the wheel layer', async () => {
  const html = await readFile(new URL('../apps/portal/hmh-reboot/index.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../apps/portal/hmh-reboot/styles.css', import.meta.url), 'utf8');
  assert.match(html, /id="hmhHudWeapon"[^>]*role="button"[^>]*tabindex="0"/);
  assert.match(html, /id="hmhWeaponWheel" class="hmh-modal-layer hmh-weapon-wheel-layer" role="dialog"[^>]*hidden/);
  assert.match(html, /id="hmhWeaponWheelRing"/);
  assert.match(css, /\.hmh-hud-weapon \{ pointer-events: auto; cursor: pointer;/);
  assert.match(css, /\.hmh-run-rail \{[^}]*pointer-events: none;/s, 'the rail itself stays non-interactive');
  assert.match(css, /\.hmh-touch-button--swap/);
});

function fakeDocument() {
  const byId = new Map();
  class Node {
    constructor(tag) {
      this.tagName = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.textContent = ''; this.hidden = false; this.disabled = false;
      this.listeners = new Map(); this.style = { setProperty: (k, v) => { this.styleVars ??= {}; this.styleVars[k] = v; } }; this.focused = 0;
    }
    appendChild(child) { this.children.push(child); child.parent = this; return child; }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this); }
    addEventListener(type, fn) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]); }
    removeEventListener(type, fn) { this.listeners.set(type, (this.listeners.get(type) ?? []).filter((f) => f !== fn)); }
    dispatch(type, event = {}) { for (const fn of this.listeners.get(type) ?? []) fn({ preventDefault() {}, target: this, ...event }); }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    focus() { this.focused += 1; }
  }
  const make = (tag, id) => { const node = new Node(tag); if (id) { node.id = id; byId.set(id, node); } return node; };
  make('section', 'hmhWeaponWheel'); make('div', 'hmhWeaponWheelRing'); make('h1', 'hmhWeaponWheelTitle');
  return { getElementById: (id) => byId.get(id) ?? null, createElement: (tag) => make(tag), byId };
}

test('the wheel renders eight slots, disables unowned ones, and reports picks and closes', () => {
  assert.equal(weaponWheelSlotPositions(8, 100)[0].y, -100, 'slot 1 sits at twelve o’clock');
  assert.ok(Math.abs(weaponWheelSlotPositions(8, 100)[2].x - 100) < 1e-9, 'slot 3 sits at three o’clock');
  assert.equal(weaponWheelRadius({ width: 1280, height: 800 }), 168, 'desktop caps the ring');
  for (const width of [320, 360, 375, 390, 412, 844]) {
    const radius = weaponWheelRadius({ width, height: width <= 500 ? 844 : 390 });
    const slot = weaponWheelSlotWidth(width);
    assert.ok(radius >= 92, `${width}px ring too small`);
    assert.ok(width / 2 + radius + slot / 2 <= width - 10, `${width}px: the 3 o'clock card would leave the viewport`);
  }
  assert.equal(ammoLabel({ owned: false }), 'Not found');
  assert.equal(ammoLabel({ owned: true, clipSize: 8, ammoInClip: 3, reserveAmmo: null }), '3/8 · ∞');
  assert.equal(ammoLabel({ owned: true, clipSize: 3, ammoInClip: 2, reserveAmmo: 15 }), '2/3 · 15');

  const documentRef = fakeDocument();
  const picks = [];
  let closes = 0;
  const windowRef = { innerWidth: 1280, innerHeight: 720, addEventListener() {}, removeEventListener() {} };
  const wheel = createWeaponWheel({ documentRef, windowRef, onPick: (slot) => picks.push(slot), onClose: () => { closes += 1; } });
  const views = ORDER.map((weaponId, index) => ({ slot: index + 1, weaponId, name: weaponId, code: weaponId.slice(0, 3), owned: index === 0 || index === 4, active: index === 0, ammoInClip: 1, clipSize: 3, reserveAmmo: 0 }));
  wheel.open(views);
  const layer = documentRef.byId.get('hmhWeaponWheel');
  const ring = documentRef.byId.get('hmhWeaponWheelRing');
  assert.equal(layer.hidden, false);
  assert.equal(ring.children.length, 8);
  assert.equal(ring.children.filter((button) => button.disabled).length, 6, 'only carried weapons are selectable');
  assert.equal(ring.children[0].dataset.active, 'true');
  assert.equal(documentRef.byId.get('hmhWeaponWheelTitle').textContent, 'coin-blaster armed');
  ring.children[4].dispatch('click');
  assert.deepEqual(picks, [5], 'a pick reports the 1-based slot');
  ring.children[1].dispatch('click');
  assert.deepEqual(picks, [5], 'a disabled slot cannot be picked');
  layer.dispatch('pointerdown', { target: layer });
  assert.equal(closes, 1, 'a backdrop tap closes without a pick');
  wheel.close();
  assert.equal(layer.hidden, true);
  assert.equal(wheel.isOpen(), false);
  wheel.open(views.map((view) => ({ ...view, owned: true })));
  assert.equal(ring.children.filter((button) => button.disabled).length, 0, 'reopening re-renders ownership in place');
  assert.equal(ring.children.length, 8, 'no duplicate buttons on reopen');
  wheel.destroy();
  assert.equal(ring.children.length, 0);
});

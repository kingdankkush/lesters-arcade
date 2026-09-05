import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createHud } from '../apps/hmh-reboot/src/hud.mjs';

const read = (relative) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const html = read('../apps/portal/hmh-reboot/index.html');
const css = read('../apps/portal/hmh-reboot/styles.css');
const main = read('../apps/hmh-reboot/src/main.mjs');

let writes = 0;

class FakeElement {
  constructor(ownerDocument, id = '') {
    this.ownerDocument = ownerDocument;
    this.id = id;
    this.children = [];
    this.className = '';
    this.attributes = new Map();
    this.properties = new Map();
    this._textContent = '';
    this._hidden = false;
    const properties = this.properties;
    this.style = {
      setProperty(name, value) { writes += 1; properties.set(name, String(value)); },
      getPropertyValue(name) { return properties.get(name) ?? ''; },
    };
    this.dataset = new Proxy({}, {
      set(target, key, value) { writes += 1; target[key] = String(value); return true; },
    });
  }
  get textContent() { return this._textContent; }
  set textContent(value) { writes += 1; this._textContent = String(value); }
  get hidden() { return this._hidden; }
  set hidden(value) { writes += 1; this._hidden = Boolean(value); }
  setAttribute(name, value) { writes += 1; this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  append(...children) { this.children.push(...children); }
}

function fakeDocument(extraIds = [], { pips = {} } = {}) {
  const ids = [
    'hmhHud', 'hmhHudHero', 'hmhHudHealthTrack', 'hmhHudHealthFill', 'hmhHudHealthPips', 'hmhHudHealthText',
    'hmhHudWeapon', 'hmhHudWeaponName', 'hmhHudWeaponState', 'hmhHudAmmoPips', 'hmhHudAmmoFill',
    'hmhHudAmmoText', 'hmhHudAmmoCap', 'hmhHudReserve', 'hmhHudReloadRing', 'hmhHudWeaponSlots',
    'hmhHudGrenades', 'hmhHudGrenadeCount', 'hmhHudDashRing', 'hmhHudKills', 'hmhHudPowerups',
    'hmhBossBar', 'hmhBossPhase', 'hmhBossFill',
    ...extraIds,
  ];
  const elements = new Map();
  const documentRef = {
    getElementById: (id) => elements.get(id) ?? null,
    documentElement: null,
  };
  for (const id of ids) elements.set(id, new FakeElement(documentRef, id));
  const fill = (id, count) => {
    const parent = elements.get(id);
    for (let index = 0; index < count; index += 1) parent.children.push(new FakeElement(documentRef));
  };
  fill('hmhHudHealthPips', pips.health ?? 4);
  fill('hmhHudAmmoPips', pips.ammo ?? 12);
  fill('hmhHudGrenades', pips.grenades ?? 5);
  fill('hmhHudWeaponSlots', pips.slots ?? 8);
  fill('hmhHudPowerups', pips.powerups ?? 2);
  documentRef.documentElement = new FakeElement(documentRef, 'root');
  return { documentRef, elements };
}

const WEAPON_ORDER = ['coin-blaster', 'scatter-shotgun', 'auto-miner', 'launcher-rig', 'hash-rail', 'lightning-ledger', 'bear-market-burner', 'forked-standard'];

const baseView = Object.freeze({
  health: 100,
  maxHealth: 100,
  weaponId: 'coin-blaster',
  weaponName: 'Pistol',
  mode: 'ready',
  ammoInClip: 8,
  clipSize: 8,
  reserveAmmo: null,
  heat: 0,
  ticksRemaining: 0,
  secondsRemaining: 0,
  reloadTicksTotal: 0,
  meleeNext: '',
  ownedMask: 1,
  activeSlot: 0,
  grenades: 3,
  maxGrenades: 5,
  dashProgress: 1,
  dashReady: true,
  dashActive: false,
  kills: 0,
  powerupHudLabel: '',
});

test('the HUD fails closed when a cockpit node is missing', () => {
  const { documentRef, elements } = fakeDocument();
  elements.delete('hmhHudHealthFill');
  assert.throws(() => createHud({ documentRef, weaponOrder: WEAPON_ORDER }), /hmhHudHealthFill/);
});

test('health renders as a fill, quarter pips, a number and a severity band', () => {
  const { documentRef, elements } = fakeDocument();
  const hud = createHud({ documentRef, weaponOrder: WEAPON_ORDER });
  hud.update({ ...baseView, health: 37 });
  assert.equal(elements.get('hmhHudHealthFill').style.getPropertyValue('--hp'), '37%');
  assert.equal(elements.get('hmhHudHealthText').textContent, '37');
  assert.equal(elements.get('hmhHudHealthTrack').dataset.band, 'mid');
  const lit = elements.get('hmhHudHealthPips').children.map((pip) => pip.dataset.filled);
  assert.deepEqual(lit, ['true', 'true', 'false', 'false']);
  hud.update({ ...baseView, health: 12 });
  assert.equal(elements.get('hmhHudHealthTrack').dataset.band, 'low');
  hud.update({ ...baseView, health: 0 });
  assert.deepEqual(elements.get('hmhHudHealthPips').children.map((pip) => pip.dataset.filled), ['false', 'false', 'false', 'false']);
});

test('every one of the eight weapons gets a readable ammo presentation', () => {
  const { documentRef, elements } = fakeDocument();
  const hud = createHud({ documentRef, weaponOrder: WEAPON_ORDER });
  const ammo = elements.get('hmhHudAmmoPips');
  const weapon = elements.get('hmhHudWeapon');

  hud.update({ ...baseView, weaponId: 'coin-blaster', weaponName: 'Pistol', ammoInClip: 3, clipSize: 8, reserveAmmo: null });
  assert.equal(weapon.dataset.mode, 'pips');
  assert.equal(ammo.children.filter((pip) => pip.dataset.filled === 'true').length, 3);
  assert.equal(ammo.children.filter((pip) => pip.hidden === false).length, 8);
  assert.equal(elements.get('hmhHudReserve').textContent, '∞');
  assert.equal(elements.get('hmhHudAmmoText').textContent, '3');
  assert.equal(elements.get('hmhHudAmmoCap').textContent, '/8');

  hud.update({ ...baseView, weaponId: 'scatter-shotgun', weaponName: 'Shotgun', ammoInClip: 0, clipSize: 2, reserveAmmo: 12, mode: 'reloading', ticksRemaining: 120, reloadTicksTotal: 120, secondsRemaining: 2 });
  assert.equal(weapon.dataset.mode, 'pips');
  assert.equal(elements.get('hmhHudReserve').textContent, '12');
  assert.equal(elements.get('hmhHudWeaponState').textContent, 'RELOAD 2.0S');

  hud.update({ ...baseView, weaponId: 'auto-miner', weaponName: 'Machine Gun', ammoInClip: 60, clipSize: 120, reserveAmmo: 240 });
  assert.equal(weapon.dataset.mode, 'bar', 'a 120-round drum cannot be pips');
  assert.equal(elements.get('hmhHudAmmoFill').style.getPropertyValue('--ammo'), '50%');

  hud.update({ ...baseView, weaponId: 'bear-market-burner', weaponName: 'Flame Projector', ammoInClip: 300, clipSize: 1200, reserveAmmo: 600 });
  assert.equal(weapon.dataset.mode, 'bar');
  assert.equal(elements.get('hmhHudAmmoFill').style.getPropertyValue('--ammo'), '25%');

  hud.update({ ...baseView, weaponId: 'lightning-ledger', weaponName: 'Lightning Ledger', ammoInClip: 4, clipSize: 6, reserveAmmo: 6, mode: 'channeling' });
  assert.equal(weapon.dataset.mode, 'cells');
  assert.equal(ammo.children.filter((pip) => pip.hidden === false).length, 6);
  assert.equal(elements.get('hmhHudWeaponState').textContent, 'CHANNEL');

  hud.update({ ...baseView, weaponId: 'lightning-ledger', weaponName: 'Lightning Ledger', ammoInClip: 0, clipSize: 6, reserveAmmo: 6, mode: 'cooldown', ticksRemaining: 90, secondsRemaining: 1.5 });
  assert.equal(elements.get('hmhHudWeaponState').textContent, 'COOLDOWN 1.5S');

  hud.update({ ...baseView, weaponId: 'forked-standard', weaponName: 'Forked Standard', ammoInClip: 1, clipSize: 1, reserveAmmo: 0, meleeNext: 'THRUST' });
  assert.equal(weapon.dataset.mode, 'melee');
  assert.equal(elements.get('hmhHudAmmoText').textContent, 'THRUST');
  assert.equal(elements.get('hmhHudAmmoCap').textContent, 'NEXT');
  assert.equal(elements.get('hmhHudReserve').textContent, '');
  assert.equal(ammo.children.every((pip) => pip.hidden === true), true, 'the melee weapon has no ammo pips');

  hud.update({ ...baseView, weaponId: 'hash-rail', weaponName: 'Rail Gun', ammoInClip: 2, clipSize: 3, reserveAmmo: 9, mode: 'recovery', ticksRemaining: 30, secondsRemaining: 0.5 });
  assert.equal(weapon.dataset.mode, 'pips');
  assert.equal(elements.get('hmhHudWeaponState').textContent, 'RECOVER 0.5S');

  hud.update({ ...baseView, weaponId: 'launcher-rig', weaponName: 'Grenade Launcher', ammoInClip: 0, clipSize: 4, reserveAmmo: 4, mode: 'empty' });
  assert.equal(elements.get('hmhHudWeaponState').textContent, 'EMPTY');
});

test('the reload ring is exact from the authoritative reload duration', () => {
  const { documentRef, elements } = fakeDocument();
  const hud = createHud({ documentRef, weaponOrder: WEAPON_ORDER });
  const ring = elements.get('hmhHudReloadRing');
  hud.update({ ...baseView, mode: 'reloading', ticksRemaining: 90, reloadTicksTotal: 120, secondsRemaining: 1.5 });
  assert.equal(ring.dataset.active, 'true');
  assert.equal(ring.style.getPropertyValue('--progress'), '0.250');
  hud.update({ ...baseView, mode: 'reloading', ticksRemaining: 30, reloadTicksTotal: 120, secondsRemaining: 0.5 });
  assert.equal(ring.style.getPropertyValue('--progress'), '0.750');
  hud.update({ ...baseView, mode: 'ready' });
  assert.equal(ring.dataset.active, 'false');
  assert.equal(ring.style.getPropertyValue('--progress'), '1.000');
});

test('a timed mode without an authoritative total still fills its ring monotonically', () => {
  const { documentRef, elements } = fakeDocument();
  const hud = createHud({ documentRef, weaponOrder: WEAPON_ORDER });
  const ring = elements.get('hmhHudReloadRing');
  hud.update({ ...baseView, weaponId: 'lightning-ledger', mode: 'cooldown', ticksRemaining: 120, secondsRemaining: 2 });
  assert.equal(ring.style.getPropertyValue('--progress'), '0.000');
  hud.update({ ...baseView, weaponId: 'lightning-ledger', mode: 'cooldown', ticksRemaining: 30, secondsRemaining: 0.5 });
  assert.equal(ring.style.getPropertyValue('--progress'), '0.750');
});

test('grenades, dash ring, kills and power-up chips read as game state', () => {
  const { documentRef, elements } = fakeDocument();
  const hud = createHud({ documentRef, weaponOrder: WEAPON_ORDER });
  hud.update({ ...baseView, grenades: 2, maxGrenades: 5, dashProgress: 0.5, dashReady: false, dashActive: false, kills: 12, powerupHudLabel: 'BERSERK 9S + DILATION 10S R1' });
  const pips = elements.get('hmhHudGrenades').children;
  assert.deepEqual(pips.map((pip) => pip.dataset.filled), ['true', 'true', 'false', 'false', 'false']);
  assert.equal(elements.get('hmhHudGrenadeCount').textContent, '2');
  const dash = elements.get('hmhHudDashRing');
  assert.equal(dash.dataset.ready, 'false');
  assert.equal(dash.style.getPropertyValue('--progress'), '0.500');
  assert.equal(elements.get('hmhHudKills').textContent, '12');
  const chips = elements.get('hmhHudPowerups').children;
  assert.equal(chips[0].textContent, 'BERSERK 9S');
  assert.equal(chips[1].textContent, 'DILATION 10S R1');
  assert.deepEqual(chips.map((chip) => chip.hidden), [false, false]);
  hud.update({ ...baseView, dashActive: true, dashProgress: 1 });
  assert.equal(dash.dataset.ready, 'true');
  assert.deepEqual(elements.get('hmhHudPowerups').children.map((chip) => chip.hidden), [true, true]);
});

test('the dash ring raises a one-shot ready flash only on a real cooldown completion (Cycle 074 K-6)', () => {
  const { documentRef, elements } = fakeDocument();
  const hud = createHud({ documentRef, weaponOrder: WEAPON_ORDER });
  const dash = elements.get('hmhHudDashRing');
  // A fresh session starts ready: no flash on the first frame.
  hud.update({ ...baseView, dashProgress: 1, dashReady: true, dashActive: false });
  assert.equal(dash.dataset.readyFlash, undefined);
  // A dash starts: ready reads true through dashActive (pinned) and must not flash.
  hud.update({ ...baseView, dashProgress: 0, dashReady: false, dashActive: true });
  assert.equal(dash.dataset.ready, 'true');
  assert.notEqual(dash.dataset.readyFlash, 'true');
  // Cooling down, then ready again: exactly one rise.
  hud.update({ ...baseView, dashProgress: 0.4, dashReady: false, dashActive: false });
  assert.equal(dash.dataset.ready, 'false');
  assert.notEqual(dash.dataset.readyFlash, 'true');
  hud.update({ ...baseView, dashProgress: 1, dashReady: true, dashActive: false });
  assert.equal(dash.dataset.readyFlash, 'true');
  assert.equal(dash.dataset.ready, 'true');
  writes = 0;
  hud.update({ ...baseView, dashProgress: 1, dashReady: true, dashActive: false });
  assert.equal(writes, 0, 'holding ready must not rewrite the flash attribute');
  // The next dash clears it so the following completion can animate again.
  hud.update({ ...baseView, dashProgress: 0, dashReady: false, dashActive: true });
  assert.equal(dash.dataset.readyFlash, 'false');
  hud.update({ ...baseView, dashProgress: 0.5, dashReady: false, dashActive: false });
  hud.update({ ...baseView, dashProgress: 1, dashReady: true, dashActive: false });
  assert.equal(dash.dataset.readyFlash, 'true');
});

test('the weapon strip tracks ownership and the active slot for all eight weapons', () => {
  const { documentRef, elements } = fakeDocument();
  const hud = createHud({ documentRef, weaponOrder: WEAPON_ORDER });
  hud.update({ ...baseView, ownedMask: 0b10100101, activeSlot: 5 });
  const slots = elements.get('hmhHudWeaponSlots').children;
  assert.equal(slots.length, 8);
  assert.deepEqual(slots.map((slot) => slot.dataset.owned), ['true', 'false', 'true', 'false', 'false', 'true', 'false', 'true']);
  assert.deepEqual(slots.map((slot) => slot.dataset.active), ['false', 'false', 'false', 'false', 'false', 'true', 'false', 'false']);
});

test('the boss bar is DOM, hidden until the fight, and carries the phase name', () => {
  const { documentRef, elements } = fakeDocument();
  const hud = createHud({ documentRef, weaponOrder: WEAPON_ORDER });
  const bar = elements.get('hmhBossBar');
  assert.equal(bar.hidden, true);
  hud.setBoss(true, 0.66, 'margin-call');
  assert.equal(bar.hidden, false);
  assert.equal(elements.get('hmhBossFill').style.getPropertyValue('--ratio'), '0.660');
  assert.equal(elements.get('hmhBossPhase').textContent, 'MARGIN CALL');
  hud.setBoss(false, 0, 'margin-call');
  assert.equal(bar.hidden, true);
});

test('hero identity, visibility and teardown stay idempotent and allocation-free on repeat', () => {
  const { documentRef, elements } = fakeDocument();
  const hud = createHud({ documentRef, weaponOrder: WEAPON_ORDER });
  hud.setHero('lilly');
  assert.equal(elements.get('hmhHudHero').dataset.hero, 'lilly');
  assert.equal(elements.get('hmhHudHero').textContent.length > 0, true);
  hud.update({ ...baseView });
  writes = 0;
  hud.update({ ...baseView });
  hud.update({ ...baseView });
  assert.equal(writes, 0, 'an unchanged frame must not touch the DOM');
  hud.setVisible(false);
  assert.equal(elements.get('hmhHud').hidden, true);
  hud.setVisible(true);
  assert.equal(elements.get('hmhHud').hidden, false);
  hud.destroy();
  hud.destroy();
  assert.equal(elements.get('hmhBossBar').hidden, true);
});

test('the child shell ships the cockpit nodes and gates only developer text', () => {
  for (const id of [
    'hmhHud', 'hmhHudHero', 'hmhHudHealthFill', 'hmhHudHealthPips', 'hmhHudHealthText', 'hmhHudWeaponName',
    'hmhHudWeaponSlots', 'hmhHudAmmoPips', 'hmhHudAmmoText', 'hmhHudReserve', 'hmhHudReloadRing',
    'hmhHudGrenades', 'hmhHudDashRing', 'hmhHudPowerups', 'hmhHudKills', 'hmhBossBar', 'hmhBossFill', 'hmhBossPhase',
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), `index.html must ship #${id}`);
  }
  // U-2: the developer strings are gated, but they stay in the DOM because the
  // embedded, portal and hero-selector smokes read their textContent.
  assert.match(html, /<span class="hmh-reboot-kicker" data-debug-only>/);
  assert.match(html, /<strong id="hmhRebootStatus" data-debug-only>/);
  assert.match(html, /<span id="hmhRebootSession" data-debug-only>/);
  // L-1a: the simulated-wallet disclosure is not developer telemetry.
  assert.doesNotMatch(html, /id="hmhAdapterStatus"[^>]*data-debug-only/);
  const commandRow = html.slice(html.indexOf('hmh-command-row'), html.indexOf('</aside>'));
  for (const id of ['hmhMusicToggle', 'hmhMenuToggle', 'hmhProfileToggle']) {
    assert.ok(commandRow.includes(id), `${id} must stay outside anything the debug gate hides`);
    assert.doesNotMatch(commandRow, new RegExp(`id="${id}"[^>]*data-debug-only`));
  }
  const rail = html.slice(html.indexOf('class="hmh-run-rail"'), html.indexOf('hmhControlsHint'));
  for (const id of ['hmhRunScore', 'hmhRunLevel', 'hmhRunCombo', 'hmhRunComboLabel', 'hmhRunXp', 'hmhRunXpNext', 'hmhRunXpFill', 'hmhRebootDashStatus']) {
    assert.ok(rail.includes(id), `the enhanced cockpit must keep #${id}`);
  }
  // Certification dereferences .hmh-run-rail's rect on three touch profiles.
  assert.match(html, /<section class="hmh-run-rail" id="hmhHud"/);
  assert.match(html, /id="hmhRebootDashStatus"[^>]+role="status"[^>]+aria-live="polite"/);
});

test('the child stylesheet gates developer chrome and keeps the cockpit non-interactive', () => {
  assert.match(css, /html:not\(\[data-debug-hud="1"\]\) \[data-debug-only\] \{ display: none !important; \}/);
  assert.match(css, /\.hmh-run-rail \{[^}]*pointer-events: none;/s);
  assert.match(css, /\.hmh-hud-ring/);
  assert.match(css, /--danger/);
  assert.match(css, /--warning/);
  assert.match(css, /\.hmh-boss-bar/);
  // The <=900 rail declared four grid tracks for five children, so the dash
  // output wrapped to an implicit row on every touch profile.
  const compact = css.slice(css.indexOf('@media (hover: none) and (pointer: coarse), (max-width: 900px)'));
  const compactRail = compact.slice(compact.indexOf('.hmh-run-rail'), compact.indexOf('.hmh-run-stat '));
  assert.doesNotMatch(compactRail, /grid-template-columns: 0\.75fr 0\.55fr 1\.4fr 0\.8fr/);
  // The touch-control label literals are browser-verified and stay untouched.
  assert.match(css, /\.hmh-touch-stick::before \{[^}]*font-size: 0\.72rem;/s);
});

test('the runtime gates the Pixi telemetry strip without disturbing its pinned layout', () => {
  assert.match(main, /runtimeParams\.get\('debugHud'\) === '1'/);
  assert.match(main, /label\.visible = debugHudEnabled;/);
  assert.match(main, /document\.documentElement\.dataset\.debugHud = debugHudEnabled \? '1' : '0';/);
  assert.match(main, /createHud\(/);
  assert.match(main, /hud\.update\(\{/);
  assert.match(main, /hud\??\.setBoss\(/);
  assert.match(main, /hud\??\.setHero\(payload\.heroId\)/);
  // The telemetry-dataset condition and the pinned label layout must survive.
  assert.match(main, /if \(debugGridEnabled \|\| releaseTelemetryEnabled\) \{/);
  assert.match(main, /label\.position\.set\(combatStatusX, combatStatusY\)/);
  assert.match(main, /computeCombatStatusLayout/);
  // The reload denominator comes from the exported progression, never from a
  // new field on the deepEqual-pinned readability status.
  assert.match(main, /applyWeaponProgression\(/);
  assert.doesNotMatch(main, /localStorage/);
});

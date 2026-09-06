import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { RUN_UPGRADE_CATALOG } from '../apps/hmh-reboot/src/run-progression.mjs';
import { AUTHORED_PROP_ASSETS, authoredPropItemUrl } from '../apps/hmh-reboot/src/authored-prop-atlas.mjs';
import {
  UPGRADE_TIERS,
  UPGRADE_TIER_TOKENS,
  UPGRADE_TIER_LABELS,
  resolveUpgradeTier,
  resolveUpgradeIconAssetId,
  resolveUpgradeCardPresentation,
} from '../apps/hmh-reboot/src/upgrade-card-presentation.mjs';
import { createCockpitUi } from '../apps/hmh-reboot/src/cockpit-ui.mjs';
import { createBridgeEnvelope, validateChildMessage } from '../sdk/hmh-bridge-protocol.mjs';
import { HMH_PLAYER_SETTINGS_DEFAULTS, mergeHmhRuntimeSettings } from '../apps/portal/src/hmh-player-settings.mjs';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const html = read('apps/portal/hmh-reboot/index.html');
const css = read('apps/portal/hmh-reboot/styles.css');
const main = read('apps/hmh-reboot/src/main.mjs');
const cockpit = read('apps/hmh-reboot/src/cockpit-ui.mjs');
const ITEM_ROOT = path.join(root, 'apps/portal/assets/generated/hmh-reboot-authored-props/items');
const catalog = Object.values(RUN_UPGRADE_CATALOG);

// ---------------------------------------------------------------------------
// U-4 tier resolver: render-side only, derived from the frozen catalog fields.
// ---------------------------------------------------------------------------

test('every catalog upgrade resolves to exactly one of the four tiers, 3 mastery / 9 core / 9 weapon / 3 capstone', () => {
  assert.deepEqual([...UPGRADE_TIERS], ['mastery', 'core', 'weapon', 'capstone']);
  const counts = { mastery: 0, core: 0, weapon: 0, capstone: 0 };
  for (const upgrade of catalog) {
    const tier = resolveUpgradeTier(upgrade);
    assert.ok(UPGRADE_TIERS.includes(tier), `${upgrade.id} resolved to unknown tier ${tier}`);
    counts[tier] += 1;
    if (upgrade.repeatable === true) assert.equal(tier, 'mastery', upgrade.id);
    else if (upgrade.requiresRanks && upgrade.maxRank === 1) assert.equal(tier, 'capstone', upgrade.id);
    else if (upgrade.requiresWeaponId) assert.equal(tier, 'weapon', upgrade.id);
    else assert.equal(tier, 'core', upgrade.id);
  }
  assert.deepEqual(counts, { mastery: 3, core: 9, weapon: 9, capstone: 3 });
  assert.equal(catalog.length, 24);
});

test('tiers map onto the shared rarity tokens and carry a player-facing label', () => {
  assert.deepEqual(UPGRADE_TIER_TOKENS, {
    mastery: '--rarity-common',
    core: '--rarity-uncommon',
    weapon: '--rarity-rare',
    capstone: '--rarity-legendary',
  });
  for (const tier of UPGRADE_TIERS) {
    assert.equal(typeof UPGRADE_TIER_LABELS[tier], 'string');
    assert.ok(UPGRADE_TIER_LABELS[tier].length > 0);
  }
  assert.ok(Object.isFrozen(UPGRADE_TIER_TOKENS));
  assert.ok(Object.isFrozen(UPGRADE_TIER_LABELS));
  assert.ok(Object.isFrozen(UPGRADE_TIERS));
});

test('resolveUpgradeTier is pure: it never mutates the frozen catalog entry and tolerates junk input', () => {
  for (const upgrade of catalog) {
    const before = JSON.stringify(upgrade);
    resolveUpgradeTier(upgrade);
    assert.equal(JSON.stringify(upgrade), before);
    assert.ok(Object.isFrozen(upgrade));
  }
  assert.equal(resolveUpgradeTier(null), 'core');
  assert.equal(resolveUpgradeTier(undefined), 'core');
  assert.equal(resolveUpgradeTier({}), 'core');
});

// ---------------------------------------------------------------------------
// U-4 icon: every catalog card must paint a PNG that exists on disk. Twelve
// weapon-branch ids have no item PNG today and 404 in the browser; the weapon
// icon of the branch is the fallback.
// ---------------------------------------------------------------------------

test('resolveUpgradeIconAssetId returns an id whose item PNG exists for all 24 catalog upgrades', () => {
  for (const upgrade of catalog) {
    const assetId = resolveUpgradeIconAssetId(upgrade);
    assert.equal(typeof assetId, 'string', `${upgrade.id} has no icon asset id`);
    const url = authoredPropItemUrl(assetId);
    const file = path.join(ITEM_ROOT, `${assetId}.png`);
    assert.ok(fs.existsSync(file), `${upgrade.id} -> ${assetId}: ${url} has no PNG on disk`);
  }
});

test('icon fallback prefers the upgrade\'s own power-up art and only falls back to its weapon', () => {
  for (const id of AUTHORED_PROP_ASSETS.powerUps) {
    if (!RUN_UPGRADE_CATALOG[id]) continue;
    assert.equal(resolveUpgradeIconAssetId(RUN_UPGRADE_CATALOG[id]), id);
  }
  assert.equal(resolveUpgradeIconAssetId(RUN_UPGRADE_CATALOG['ledger-voltage']), 'lightning-ledger');
  assert.equal(resolveUpgradeIconAssetId(RUN_UPGRADE_CATALOG['total-selloff']), 'bear-market-burner');
  assert.equal(resolveUpgradeIconAssetId(RUN_UPGRADE_CATALOG['canonical-fork']), 'forked-standard');
  assert.equal(resolveUpgradeIconAssetId({ id: 'not-a-real-upgrade' }), null);
  assert.equal(resolveUpgradeIconAssetId({ id: 'not-a-real-upgrade', requiresWeaponId: 'not-a-weapon' }), null);
  assert.equal(resolveUpgradeIconAssetId({ id: '../fake-prop' }), null);
});

test('resolveUpgradeCardPresentation bundles tier, token, label and icon as a frozen record', () => {
  const card = resolveUpgradeCardPresentation(RUN_UPGRADE_CATALOG['proof-of-network'], 1);
  assert.deepEqual(card, {
    tier: 'capstone',
    tierToken: '--rarity-legendary',
    tierLabel: UPGRADE_TIER_LABELS.capstone,
    iconAssetId: 'lightning-ledger',
    hotkey: '2',
  });
  assert.ok(Object.isFrozen(card));
  assert.equal(resolveUpgradeCardPresentation(RUN_UPGRADE_CATALOG['proof-of-work'], 0).hotkey, '1');
  assert.equal(resolveUpgradeCardPresentation(RUN_UPGRADE_CATALOG['proof-of-work'], 5).hotkey, '');
});

// ---------------------------------------------------------------------------
// Cockpit behaviour against a minimal DOM stub: tier band, icon fallback,
// hotkey chip, keyboard 1/2 + arrows + Enter, and a gamepad release-edge poll
// that only runs while the panel is open.
// ---------------------------------------------------------------------------

class FakeClassList {
  constructor(owner) { this.owner = owner; }
  get set() { return new Set(this.owner.className.split(/\s+/).filter(Boolean)); }
  write(set) { this.owner.className = [...set].join(' '); }
  add(...names) { const set = this.set; for (const name of names) set.add(name); this.write(set); }
  remove(...names) { const set = this.set; for (const name of names) set.delete(name); this.write(set); }
  toggle(name, force) {
    const set = this.set;
    const next = force ?? !set.has(name);
    if (next) set.add(name); else set.delete(name);
    this.write(set);
    return next;
  }
  contains(name) { return this.set.has(name); }
}

class FakeElement {
  constructor(ownerDocument, tagName = 'div', id = '') {
    this.ownerDocument = ownerDocument;
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.children = [];
    this.parentNode = null;
    this.className = '';
    this.classList = new FakeClassList(this);
    this.attributes = new Map();
    this.listeners = new Map();
    this.dataset = {};
    this.style = {};
    this.textContent = '';
    this.hidden = false;
    this.checked = false;
    this.disabled = false;
    this.open = false;
    this.value = '';
    this.type = '';
    this.focusCount = 0;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  hasAttribute(name) { return this.attributes.has(name); }
  append(...children) { for (const child of children) { child.parentNode = this; this.children.push(child); } }
  replaceChildren(...children) { this.children = []; this.append(...children); }
  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
  }
  removeEventListener(type, handler) { this.listeners.get(type)?.delete(handler); }
  dispatch(type, event = {}) {
    const payload = { type, target: this, defaultPrevented: false, propagationStopped: false, ...event };
    payload.preventDefault = () => { payload.defaultPrevented = true; };
    payload.stopPropagation = () => { payload.propagationStopped = true; };
    for (const handler of [...(this.listeners.get(type) ?? [])]) handler(payload);
    return payload;
  }
  focus() { this.focusCount += 1; this.ownerDocument.activeElement = this; }
  *walk() { for (const child of this.children) { yield child; yield* child.walk(); } }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  querySelectorAll(selector) {
    const out = [];
    for (const node of this.walk()) {
      if (selector.startsWith('.') ? node.classList.contains(selector.slice(1)) : node.tagName === selector.toUpperCase()) out.push(node);
    }
    return out;
  }
}

const COCKPIT_IDS = [
  'hmhRunScore', 'hmhRunLevel', 'hmhRunCombo', 'hmhRunComboLabel', 'hmhRunComboStat', 'hmhRunXp', 'hmhRunXpNext', 'hmhRunXpFill',
  'hmhMusicToggle', 'hmhMenuToggle', 'hmhProfileToggle', 'hmhProfilePanel', 'hmhProfileName', 'hmhProfileHero', 'hmhProfileMode',
  'hmhProfileSeason', 'hmhAdapterStatus', 'hmhPausePanel', 'hmhResumeButton', 'hmhRestartButton', 'hmhExitButton',
  'hmhSettingMusic', 'hmhSettingScreenShake', 'hmhSettingReduceMotion', 'hmhSettingReduceFlash',
  'hmhSettingSfxVolume', 'hmhSettingSfxVolumeValue',
  'hmhBuildEmpty', 'hmhBuildSummary', 'hmhControlsCard', 'hmhUpgradePanel', 'hmhUpgradeQueue', 'hmhUpgradeChoices',
];

function fakeCockpitDocument({ gamepads = () => [], compact = false } = {}) {
  const elements = new Map();
  const frames = new Map();
  let frameId = 0;
  const documentRef = {
    activeElement: null,
    getElementById: (id) => elements.get(id) ?? null,
    createElement: (tag) => new FakeElement(documentRef, tag),
    listeners: new Map(),
    addEventListener(type, handler) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type).add(handler);
    },
    removeEventListener(type, handler) { this.listeners.get(type)?.delete(handler); },
    dispatch(type, event = {}) {
      const payload = { type, defaultPrevented: false, propagationStopped: false, repeat: false, ...event };
      payload.preventDefault = () => { payload.defaultPrevented = true; };
      payload.stopPropagation = () => { payload.propagationStopped = true; };
      for (const handler of [...(this.listeners.get(type) ?? [])]) handler(payload);
      return payload;
    },
    defaultView: {
      matchMedia: () => ({ matches: compact }),
      setTimeout: () => 0,
      requestAnimationFrame: (callback) => { frameId += 1; frames.set(frameId, callback); return frameId; },
      cancelAnimationFrame: (id) => { frames.delete(id); },
      navigator: { getGamepads: () => gamepads() },
      performance: { now: () => 0 },
    },
  };
  for (const id of COCKPIT_IDS) elements.set(id, new FakeElement(documentRef, id.includes('Setting') ? 'input' : 'div', id));
  elements.get('hmhUpgradePanel').hidden = true;
  elements.get('hmhPausePanel').hidden = true;
  const runFrame = (now = 0) => {
    const pending = [...frames.entries()];
    frames.clear();
    for (const [, callback] of pending) callback(now);
    return pending.length;
  };
  return { documentRef, elements, runFrame, pendingFrames: () => frames.size };
}

const upgradeSnapshot = (ids) => ({
  pendingLevels: 1,
  pendingChoices: ids.map((id) => ({ ...RUN_UPGRADE_CATALOG[id], nextRank: 1 })),
});

test('upgrade pointer confirmation is single-shot just like keyboard and gamepad', () => {
  const { documentRef, elements } = fakeCockpitDocument();
  const selected = [];
  const ui = createCockpitUi({ documentRef, onSelectUpgrade: (id) => selected.push(id) });
  ui.showUpgrade(upgradeSnapshot(['proof-of-work', 'diamond-hands']));
  const buttons = elements.get('hmhUpgradeChoices').querySelectorAll('button');
  buttons[1].dispatch('click');
  buttons[1].dispatch('click');
  buttons[0].dispatch('click');
  documentRef.dispatch('keydown', { code: 'Enter' });
  assert.deepEqual(selected, ['diamond-hands']);
  ui.destroy();
});

test('repeated upgrade menus release detached listeners on hide, replacement and destroy', () => {
  const { documentRef, elements, pendingFrames } = fakeCockpitDocument();
  const ui = createCockpitUi({ documentRef });
  let previous = [];
  const assertReleased = (nodes) => {
    for (const node of nodes) for (const callbacks of node.listeners.values()) assert.equal(callbacks.size, 0, `${node.tagName} retains a detached handler`);
  };
  for (let cycle = 0; cycle < 40; cycle++) {
    ui.showUpgrade(upgradeSnapshot(['proof-of-work', 'diamond-hands']));
    assertReleased(previous);
    previous = [...elements.get('hmhUpgradeChoices').walk()];
    assert.equal(pendingFrames(), 1, 'one controller poll for the current menu');
    if (cycle % 2 === 0) {
      ui.hideUpgrade();
      assertReleased(previous);
      assert.equal(pendingFrames(), 0);
    }
  }
  ui.destroy();
  assertReleased(previous);
  assert.equal(pendingFrames(), 0);
});

test('cards carry a tier band, a real icon, a hotkey chip and aria-keyshortcuts; the first card is armed and focused', () => {
  const { documentRef, elements } = fakeCockpitDocument();
  const ui = createCockpitUi({ documentRef });
  ui.showUpgrade(upgradeSnapshot(['ledger-voltage', 'proof-of-network']));
  const choices = elements.get('hmhUpgradeChoices');
  const options = choices.children;
  assert.equal(options.length, 2);
  assert.equal(options[0].dataset.tier, 'weapon');
  assert.equal(options[1].dataset.tier, 'capstone');
  assert.ok(options[0].classList.contains('hmh-upgrade-option--armed'), 'first option must be armed on open');
  assert.ok(!options[1].classList.contains('hmh-upgrade-option--armed'));
  const buttons = choices.querySelectorAll('button');
  assert.equal(buttons.length, 2, 'exactly two <button> elements inside #hmhUpgradeChoices (certification pin)');
  assert.equal(choices.querySelectorAll('details').length, 2);
  assert.equal(buttons[0].getAttribute('aria-keyshortcuts'), '1');
  assert.equal(buttons[1].getAttribute('aria-keyshortcuts'), '2');
  assert.equal(documentRef.activeElement, buttons[0]);
  const icon = buttons[0].querySelector('.hmh-upgrade-choice__icon');
  assert.match(icon.style.backgroundImage, /lightning-ledger\.png/, 'weapon-branch card must fall back to its weapon icon');
  assert.match(buttons[1].querySelector('.hmh-upgrade-choice__icon').style.backgroundImage, /lightning-ledger\.png/);
  const hotkeys = choices.querySelectorAll('.hmh-upgrade-choice__hotkey');
  assert.deepEqual(hotkeys.map((node) => node.textContent), ['1', '2']);
  assert.ok(hotkeys.every((node) => node.tagName === 'SPAN' && node.getAttribute('aria-hidden') === 'true'));
  const tiers = choices.querySelectorAll('.hmh-upgrade-choice__tier');
  assert.deepEqual(tiers.map((node) => node.textContent), [UPGRADE_TIER_LABELS.weapon, UPGRADE_TIER_LABELS.capstone]);
  // The button text order the smoke reads must still start with the branch label and title.
  assert.match(buttons[0].querySelector('.hmh-upgrade-choice__branch').textContent, /^lightning ledger · rank 1\/3$/i);
  ui.destroy();
});

test('Digit1 / Digit2 select a card, arrows move the armed ring, Enter confirms, and a second confirm is ignored', () => {
  const { documentRef, elements } = fakeCockpitDocument();
  const selected = [];
  const ui = createCockpitUi({ documentRef, onSelectUpgrade: (id) => selected.push(id) });
  ui.showUpgrade(upgradeSnapshot(['proof-of-work', 'diamond-hands']));
  const options = elements.get('hmhUpgradeChoices').children;
  const buttons = elements.get('hmhUpgradeChoices').querySelectorAll('button');

  let event = documentRef.dispatch('keydown', { code: 'ArrowRight', key: 'ArrowRight' });
  assert.ok(event.defaultPrevented);
  assert.ok(options[1].classList.contains('hmh-upgrade-option--armed'));
  assert.ok(!options[0].classList.contains('hmh-upgrade-option--armed'));
  assert.equal(documentRef.activeElement, buttons[1]);
  documentRef.dispatch('keydown', { code: 'ArrowRight', key: 'ArrowRight' });
  assert.ok(options[1].classList.contains('hmh-upgrade-option--armed'), 'arming clamps at the last card');
  documentRef.dispatch('keydown', { code: 'ArrowLeft', key: 'ArrowLeft' });
  assert.ok(options[0].classList.contains('hmh-upgrade-option--armed'));
  documentRef.dispatch('keydown', { code: 'ArrowDown', key: 'ArrowDown' });
  assert.ok(options[1].classList.contains('hmh-upgrade-option--armed'));
  assert.deepEqual(selected, []);

  // Space is the fire key and must not be a card shortcut.
  event = documentRef.dispatch('keydown', { code: 'Space', key: ' ' });
  assert.ok(!event.defaultPrevented);
  assert.deepEqual(selected, []);

  // Auto-repeat must not fire a selection.
  event = documentRef.dispatch('keydown', { code: 'Enter', key: 'Enter', repeat: true });
  assert.deepEqual(selected, []);

  event = documentRef.dispatch('keydown', { code: 'Enter', key: 'Enter' });
  assert.ok(event.defaultPrevented, 'Enter is handled here so the focused button does not also fire a native click');
  assert.deepEqual(selected, ['diamond-hands']);
  // Same panel, second confirm: latched until the panel is re-shown.
  documentRef.dispatch('keydown', { code: 'Digit1', key: '1' });
  assert.deepEqual(selected, ['diamond-hands']);

  ui.showUpgrade(upgradeSnapshot(['proof-of-work', 'diamond-hands']));
  event = documentRef.dispatch('keydown', { code: 'Digit2', key: '2' });
  assert.ok(event.defaultPrevented);
  assert.ok(event.propagationStopped, 'a card hotkey must not reach the window-level gameplay key listener');
  assert.deepEqual(selected, ['diamond-hands', 'diamond-hands']);

  ui.showUpgrade(upgradeSnapshot(['proof-of-work', 'diamond-hands']));
  documentRef.dispatch('keydown', { code: 'Digit1', key: '1' });
  assert.deepEqual(selected, ['diamond-hands', 'diamond-hands', 'proof-of-work']);
  ui.hideUpgrade();
  // Hidden panel: keys are ignored and untouched.
  event = documentRef.dispatch('keydown', { code: 'Digit1', key: '1' });
  assert.ok(!event.defaultPrevented);
  assert.equal(selected.length, 3);
  ui.destroy();
});

test('gamepad selection polls only while the panel is open, moves on D-pad and selects on the A release edge', () => {
  let pad = null;
  const { documentRef, elements, runFrame, pendingFrames } = fakeCockpitDocument({ gamepads: () => [pad] });
  const selected = [];
  const ui = createCockpitUi({ documentRef, onSelectUpgrade: (id) => selected.push(id) });
  assert.equal(pendingFrames(), 0, 'no poll before the panel opens');
  ui.showUpgrade(upgradeSnapshot(['proof-of-work', 'diamond-hands']));
  assert.equal(pendingFrames(), 1, 'showUpgrade starts exactly one rAF poll');
  const options = elements.get('hmhUpgradeChoices').children;
  const button = (index, pressed) => ({ pressed, value: pressed ? 1 : 0 });
  const padWith = ({ a = false, left = false, right = false, axis = 0 } = {}) => ({
    buttons: [button(0, a), ...Array.from({ length: 13 }, () => button(0, false)), button(14, left), button(15, right)],
    axes: [axis, 0, 0, 0],
  });

  pad = padWith({ right: true });
  runFrame(16);
  pad = padWith();
  runFrame(32);
  assert.ok(options[1].classList.contains('hmh-upgrade-option--armed'), 'D-pad right release moves the ring');
  pad = padWith({ left: true });
  runFrame(48);
  pad = padWith();
  runFrame(64);
  assert.ok(options[0].classList.contains('hmh-upgrade-option--armed'));

  // Left stick with a repeat guard: one move per 180 ms while held.
  pad = padWith({ axis: 0.9 });
  runFrame(80);
  assert.ok(options[1].classList.contains('hmh-upgrade-option--armed'));
  runFrame(96);
  runFrame(112);
  assert.ok(options[1].classList.contains('hmh-upgrade-option--armed'));
  pad = padWith({ axis: -0.9 });
  runFrame(300);
  assert.ok(options[0].classList.contains('hmh-upgrade-option--armed'));

  // A pressed: nothing yet (a press edge would leak a dash into the resumed tick).
  pad = padWith({ a: true });
  runFrame(320);
  assert.deepEqual(selected, []);
  assert.equal(pendingFrames(), 1);
  // A released: select the armed card; the poll must stop when the host hides the panel.
  pad = padWith();
  const uiHide = () => ui.hideUpgrade();
  const onSelect = selected.push.bind(selected);
  selected.push = (id) => { onSelect(id); uiHide(); return selected.length; };
  runFrame(340);
  assert.deepEqual([...selected], ['proof-of-work']);
  assert.equal(pendingFrames(), 0, 'hideUpgrade cancels the poll; no second poller may survive a selection');
  assert.equal(elements.get('hmhUpgradePanel').hidden, true);

  // Re-showing restarts exactly one poller even when the host re-shows from inside the selection callback.
  selected.push = onSelect;
  ui.showUpgrade(upgradeSnapshot(['proof-of-work', 'diamond-hands']));
  assert.equal(pendingFrames(), 1);
  ui.destroy();
  assert.equal(pendingFrames(), 0, 'destroy cancels the poll');
});

test('re-showing the panel from inside the selection callback leaves exactly one poller alive', () => {
  let pad = null;
  const { documentRef, runFrame, pendingFrames } = fakeCockpitDocument({ gamepads: () => [pad] });
  let ui = null;
  const selected = [];
  ui = createCockpitUi({
    documentRef,
    onSelectUpgrade: (id) => {
      selected.push(id);
      ui.showUpgrade(upgradeSnapshot(['diamond-hands', 'cold-storage']));
    },
  });
  ui.showUpgrade(upgradeSnapshot(['proof-of-work', 'diamond-hands']));
  const button = (pressed) => ({ pressed, value: pressed ? 1 : 0 });
  pad = { buttons: [button(true)], axes: [0, 0, 0, 0] };
  runFrame(16);
  pad = { buttons: [button(false)], axes: [0, 0, 0, 0] };
  runFrame(32);
  assert.deepEqual(selected, ['proof-of-work']);
  assert.equal(pendingFrames(), 1, 'the stale poller must not reschedule itself next to the new one');
  runFrame(48);
  assert.equal(pendingFrames(), 1);
  ui.destroy();
});

// ---------------------------------------------------------------------------
// U-5 SFX slider: child-owned, numeric, rides the existing settings channel.
// ---------------------------------------------------------------------------

test('the SFX slider updates its readout on input and notifies the host only on change', () => {
  const { documentRef, elements } = fakeCockpitDocument();
  const levels = [];
  const ui = createCockpitUi({ documentRef, onSettingLevel: (key, value) => levels.push([key, value]) });
  const slider = elements.get('hmhSettingSfxVolume');
  const readout = elements.get('hmhSettingSfxVolumeValue');
  ui.setSettings({ musicEnabled: true, sfxVolume: 0.85 });
  assert.equal(slider.value, '0.85');
  assert.equal(readout.textContent, '85%');
  slider.value = '0.3';
  slider.dispatch('input');
  assert.equal(readout.textContent, '30%');
  assert.deepEqual(levels, [], 'dragging must not flood the bridge');
  slider.dispatch('change');
  assert.deepEqual(levels, [['sfxVolume', 0.3]]);
  slider.value = '7';
  slider.dispatch('change');
  assert.deepEqual(levels.at(-1), ['sfxVolume', 1], 'value is clamped to [0, 1]');
  ui.setSettings({ musicEnabled: true });
  assert.equal(slider.value, '1', 'a host without sfxVolume means the bus is at full level');
  assert.equal(readout.textContent, '100%');
  ui.destroy();
});

test('pause settings markup: range slider with output, exactly four toggles, no new button or details inside the choices list', () => {
  assert.match(html, /<input id="hmhSettingSfxVolume" type="range" min="0" max="1" step="0\.05"/);
  assert.match(html, /<label class="hmh-setting-range">[\s\S]*?id="hmhSettingSfxVolume"[\s\S]*?<\/label>/);
  assert.match(html, /<output id="hmhSettingSfxVolumeValue"/);
  assert.equal((html.match(/class="hmh-setting-toggle"/g) ?? []).length, 4);
  assert.doesNotMatch(html, /class="hmh-setting-toggle"[^>]*>\s*<input id="hmhSettingSfxVolume"/);
  const pauseStart = html.indexOf('id="hmhPausePanel"');
  const pauseEnd = html.indexOf('hmh-menu-actions', pauseStart);
  assert.ok(html.slice(pauseStart, pauseEnd).includes('hmhSettingSfxVolume'), 'slider lives inside the pause panel');
  assert.match(html, /<div id="hmhUpgradeChoices" class="hmh-upgrade-choices" role="list"><\/div>/);
  const upgradeStart = html.indexOf('id="hmhUpgradePanel"');
  const upgradeEnd = html.indexOf('</section>', upgradeStart);
  const upgradePanel = html.slice(upgradeStart, upgradeEnd);
  assert.doesNotMatch(upgradePanel, /<button|<details/);
  assert.match(upgradePanel, /class="hmh-upgrade-hint"/);
});

test('styles: tier tokens, armed ring, hotkey chip hidden on touch, and a 44px slider row in both compact blocks', () => {
  for (const [tier, token] of Object.entries(UPGRADE_TIER_TOKENS)) {
    assert.match(css, new RegExp(`\\[data-tier="${tier}"\\][^}]*var\\(${token}\\)`), `${tier} must use ${token}`);
  }
  assert.match(css, /\.hmh-upgrade-option--armed/);
  assert.match(css, /\.hmh-upgrade-choice__hotkey/);
  assert.match(css, /@media \(hover: none\) and \(pointer: coarse\)[^{]*\{[\s\S]*?\.hmh-upgrade-choice__hotkey[^}]*display:\s*none/);
  assert.match(css, /\.hmh-setting-range[^}]*min-height:\s*52px/);
  const compact = css.slice(css.indexOf('@media (max-width: 600px) {'));
  assert.match(compact, /\.hmh-setting-range[^}]*min-height:\s*44px/);
  const landscape = css.slice(css.indexOf('@media (max-width: 900px) and (max-height: 520px) and (orientation: landscape)'));
  assert.match(landscape, /\.hmh-setting-range[^}]*min-height:\s*44px/);
  // The four toggles keep their pinned targets.
  assert.match(css, /\.hmh-setting-toggle[^}]*min-height:\s*52px/);
  assert.match(css, /max-height:\s*520px[\s\S]*\.hmh-setting-toggle[^}]*min-height:\s*44px/);
  // Desktop pause panel: the actions row must never scroll below the fold. The
  // panel is a flex column and only the settings/build/controls grid scrolls.
  const desktopCss = css.slice(0, css.indexOf('@media'));
  assert.match(desktopCss, /\.hmh-menu-panel \{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*overflow-y:\s*hidden/);
  assert.match(desktopCss, /\.hmh-menu-panel > \.hmh-pause-grid \{[^}]*overflow-y:\s*auto/);
});

test('main.mjs: applyPauseLevel clamps and syncs sfxVolume, the pinned boolean path is byte-identical, and a keyboard pick clears held input', () => {
  assert.match(main, /const applyPauseLevel = \(key, value\) =>/);
  assert.match(main, /syncRuntimeSettings\(\{ \.\.\.settings, sfxVolume: level \}, \{ notify: true \}\)/);
  assert.match(main, /onSettingLevel: applyPauseLevel/);
  assert.match(main, /PAUSE_SETTING_KEYS = new Set\(\['musicEnabled', 'screenShake', 'reduceMotion', 'reduceFlash'\]\)/);
  assert.match(main, /syncRuntimeSettings\(\{ \.\.\.settings, \[key\]: Boolean\(enabled\) \}, \{ notify: true \}\)/);
  assert.match(main, /input\.reset\('upgrade-select'/);
  const selectAt = main.indexOf('const selection = selectRunUpgrade(runProgression, upgradeId)');
  const resetAt = main.indexOf("input.reset('upgrade-select'", selectAt);
  const leaveAt = main.indexOf('simulation.leaveUpgrade()', selectAt);
  assert.ok(selectAt > 0 && resetAt > selectAt && resetAt < leaveAt, 'held Digit keys are cleared after the pick and before the ticker resumes');
  assert.doesNotMatch(main, /sfxVolume: [0-9.]+/, 'child default settings gain no sfxVolume key; the parent projection owns the default');
});

test('cockpit source: no innerHTML, spans-only chips, rAF poll owned by show/hide/destroy, onSettingLevel wired', () => {
  assert.doesNotMatch(cockpit, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
  assert.match(cockpit, /requestAnimationFrame/);
  assert.match(cockpit, /cancelAnimationFrame/);
  assert.match(cockpit, /onSettingLevel\(/);
  assert.match(cockpit, /aria-keyshortcuts/);
  assert.match(cockpit, /hmh-upgrade-option--armed/);
  assert.match(cockpit, /option\.append\(button, detail\)/);
  assert.match(cockpit, /detail\.append\(summary, description\)/);
  assert.match(cockpit, /resolveUpgradeCardPresentation|resolveUpgradeTier/);
  assert.doesNotMatch(cockpit, /Math\.random/);
});

test('a numeric sfxVolume round-trips the existing channel without a schema change', () => {
  const envelope = createBridgeEnvelope({
    type: 'game:settings',
    sessionId: 'session-073',
    messageId: 'msg-1',
    payload: {
      settings: {
        musicEnabled: true, screenShake: true, gore: false, reduceMotion: false, reduceFlash: false, colorblindTags: false,
        sfxVolume: 0.35,
      },
    },
  });
  const result = validateChildMessage(envelope);
  assert.equal(result.ok, true, result.error);
  const merged = mergeHmhRuntimeSettings(HMH_PLAYER_SETTINGS_DEFAULTS, { sfxVolume: 0.35 });
  assert.equal(merged.audio.sfxVolume, 0.35);
  assert.equal(merged.version, HMH_PLAYER_SETTINGS_DEFAULTS.version);
  assert.deepEqual(Object.keys(merged), Object.keys(HMH_PLAYER_SETTINGS_DEFAULTS), 'no new persisted domain');
});

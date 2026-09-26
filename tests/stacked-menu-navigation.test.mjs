import test from 'node:test';
import assert from 'node:assert/strict';

// Gamepad navigation over the STACKED menu overlay (settings simplification
// 2026-09-24): up/down walk the stops and skip disabled controls (F12), a radio
// group is one stop, and left/right change the focused choice.
const load = () => import('../apps/stacked/src/menu-navigation.mjs');

// A tiny selector matcher for exactly the selector shapes the module uses.
const matchesOne = (node, part) => {
  const found = /^([a-z]+)(?:\[type=([a-z]+)\])?(:not\(:disabled\))?(:checked)?$/.exec(part.trim());
  if (!found) throw new Error('unsupported selector ' + part);
  const [, tag, type, enabledOnly, checkedOnly] = found;
  return node.tag === tag && (!type || node.type === type) && (!enabledOnly || !node.disabled) && (!checkedOnly || node.checked);
};
let focused = null;
const node = (tag, props = {}) => {
  const self = {
    tag, hidden: false, disabled: false, checked: false, name: '', value: '', rects: 1, clicks: 0, events: [], ...props,
    matches: selector => selector.split(',').some(part => matchesOne(self, part)),
    getClientRects: () => ({ length: self.rects }),
    focus() { focused = self; },
    click() { self.clicks++; if (self.type === 'checkbox') self.checked = !self.checked; },
    dispatchEvent(event) { self.events.push({ type: event.type, bubbles: event.bubbles }); return true; },
  };
  return self;
};
const root = nodes => ({ querySelectorAll: selector => nodes.filter(item => item.matches(selector)) });
const radios = (checked = 'standard') => ['off', 'calm', 'standard', 'full'].map(value => node('input', { id: 'effects' + value, type: 'radio', name: 'effectsPreset', value, checked: value === checked }));

test('next and previous skip disabled and hidden controls and wrap at both ends', async () => {
  const { applyMenuAction, menuStops, MENU_STOP_SELECTOR } = await load();
  assert.equal(MENU_STOP_SELECTOR, 'button:not(:disabled),input:not(:disabled),select:not(:disabled),summary');
  const start = node('button', { id: 'continueButton' }), locked = node('input', { id: 'locked', type: 'checkbox', disabled: true });
  const hidden = node('button', { id: 'restartButton', hidden: true }), collapsed = node('input', { id: 'collapsed', type: 'checkbox', rects: 0 });
  const grid = node('input', { id: 'gridToggle', type: 'checkbox' }), summary = node('summary', { id: 'summary' }), volume = node('input', { id: 'volumeRange', type: 'range', value: '35', min: '0', max: '100', step: '5' });
  const menu = root([start, hidden, locked, collapsed, grid, summary, volume]);
  assert.deepEqual(menuStops(menu).map(item => item.id), ['continueButton', 'gridToggle', 'summary', 'volumeRange']);
  focused = start; assert.equal(applyMenuAction(menu, 'next', focused), grid); assert.equal(focused, grid, 'the disabled checkbox is skipped (F12)');
  assert.equal(applyMenuAction(menu, 'previous', grid), start); assert.equal(focused, start);
  applyMenuAction(menu, 'next', volume); assert.equal(focused, start, 'next wraps from the last stop to the first');
  applyMenuAction(menu, 'previous', start); assert.equal(focused, volume, 'previous wraps from the first stop to the last');
  assert.equal(applyMenuAction(root([]), 'next', null), null);
});

test('a radio group is one stop: only its checked radio', async () => {
  const { applyMenuAction, menuStops } = await load();
  const group = radios('calm'), select = node('select', { id: 'visualizerSelect', selectedIndex: 0, options: { length: 5 } });
  const menu = root([node('summary', { id: 'summary' }), ...group, select]);
  assert.deepEqual(menuStops(menu).map(item => item.id), ['summary', 'effectscalm', 'visualizerSelect']);
  focused = null; applyMenuAction(menu, 'next', menuStops(menu)[0]); assert.equal(focused, group[1]);
  applyMenuAction(menu, 'next', group[1]); assert.equal(focused, select);
});

test('left and right pick the neighbouring preset, fire one change and clamp at the ends', async () => {
  const { applyMenuAction } = await load();
  const group = radios('standard'), menu = root([node('button', { id: 'continueButton' }), ...group]);
  const [off, calm, standard, full] = group;
  focused = standard;
  assert.equal(applyMenuAction(menu, 'increase', standard), full);
  assert.equal(full.checked, true); assert.equal(focused, full);
  assert.deepEqual(full.events, [{ type: 'change', bubbles: true }], 'one bubbling change event');
  assert.equal(applyMenuAction(menu, 'increase', full), full);
  assert.equal(full.events.length, 1, 'no change at the end of the group');
  // Native radio exclusivity is the browser's job; emulate it for the next step.
  standard.checked = false;
  applyMenuAction(menu, 'decrease', full); assert.equal(standard.checked, true); assert.equal(focused, standard);
  for (const radio of group) radio.checked = radio === off;
  assert.equal(applyMenuAction(menu, 'decrease', off), off, 'decrease clamps at Off');
  assert.deepEqual(off.events, []); assert.equal(calm.checked, false);
  assert.equal(applyMenuAction(menu, 'activate', off), off);
  assert.equal(off.clicks, 0, 'activate does not act on a radio; left and right change it');
});

test('select and range stepping and activation are unchanged', async () => {
  const { applyMenuAction } = await load();
  const select = node('select', { id: 'visualizerSelect', selectedIndex: 0, options: { length: 5 } });
  const range = node('input', { id: 'volumeRange', type: 'range', value: '35', min: '0', max: '100', step: '5' });
  const box = node('input', { id: 'ghostToggle', type: 'checkbox', checked: true }), summary = node('summary'), button = node('button');
  const menu = root([select, range, box, summary, button]);
  applyMenuAction(menu, 'increase', select); assert.equal(select.selectedIndex, 1);
  applyMenuAction(menu, 'decrease', select); applyMenuAction(menu, 'decrease', select); assert.equal(select.selectedIndex, 0, 'selects clamp');
  select.selectedIndex = 4; applyMenuAction(menu, 'increase', select); assert.equal(select.selectedIndex, 4);
  assert.ok(select.events.every(event => event.type === 'change'));
  applyMenuAction(menu, 'decrease', range); assert.equal(range.value, '30');
  range.value = '100'; applyMenuAction(menu, 'increase', range); assert.equal(range.value, '100', 'ranges clamp at max');
  range.value = '5'; applyMenuAction(menu, 'decrease', range); applyMenuAction(menu, 'decrease', range); assert.equal(range.value, '0', 'ranges clamp at zero (Off)');
  assert.ok(range.events.length >= 4 && range.events.every(event => event.type === 'change'));
  applyMenuAction(menu, 'activate', box); assert.equal(box.checked, false);
  applyMenuAction(menu, 'activate', summary); applyMenuAction(menu, 'activate', button);
  assert.deepEqual([summary.clicks, button.clicks], [1, 1]);
  applyMenuAction(menu, 'activate', range); assert.equal(range.clicks, 0);
  assert.equal(applyMenuAction(menu, 'increase', null), null);
});

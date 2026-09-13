import test from 'node:test';
import assert from 'node:assert/strict';
import { createStackedInput } from '../apps/stacked/src/input.mjs';
import { defaultStackedSettings } from '../apps/portal/src/stacked-player-settings.mjs';

test('Space on a dialog button keeps native keyboard activation', () => {
  const listeners = new Map();
  const target = { addEventListener: (type, callback) => listeners.set(type, callback), removeEventListener() {} };
  const input = createStackedInput({ target, controls: { querySelectorAll: () => [] }, settings: defaultStackedSettings(), onPause() {}, onUndo() {} });
  let prevented = false;
  listeners.get('keydown')({ code: 'Space', target: { tagName: 'BUTTON' }, preventDefault() { prevented = true; } });
  listeners.get('keyup')({ code: 'Space', target: { tagName: 'BUTTON' }, preventDefault() { prevented = true; } });
  assert.equal(prevented, false);
  input.destroy();
});

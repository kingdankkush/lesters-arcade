import test from 'node:test';
import assert from 'node:assert/strict';
import { createChikunGamepadInput } from '../apps/chikun/src/gamepad-input.mjs';
import { createChikunRuntime, replayChikunRun } from '../apps/portal/src/chikun-cabinet.mjs';

const pad = (pressed = [], index = 0) => ({ id: 'standard-controller', index, connected: true, mapping: 'standard', buttons: Array.from({length:16}, (_, i) => ({ pressed: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 })) });
const read = (input, controller, options = {}) => input.sample([controller], { enabled: true, ...options });

test('controller jump is one existing flap edge with a separate held-glide signal', () => {
  const input = createChikunGamepadInput();
  read(input, pad());
  assert.deepEqual(read(input, pad([0])), { connected:true, flap:true, glide:true, pause:false });
  assert.deepEqual(read(input, pad([0])), { connected:true, flap:false, glide:true, pause:false });
  read(input, pad());
  assert.equal(read(input, pad([7])).flap, true, 'right trigger shares the jump action');
  assert.equal(read(input, pad([7,12])).flap, false, 'overlapping jump controls cannot add a duplicate input');
  read(input, pad());
  assert.equal(read(input, pad([12])).flap, true, 'D-pad up is accessible jump');
});

test('Start is edge-triggered and connection, focus, restart and disconnect cannot inject a held action', () => {
  const input = createChikunGamepadInput();
  assert.equal(read(input, pad([0,9])).flap, false, 'a newly connected held control is latched');
  assert.equal(read(input, pad([0,9])).pause, false);
  read(input, pad());
  assert.equal(read(input, pad([9])).pause, true);
  assert.equal(read(input, pad([9])).pause, false);
  assert.equal(read(input, pad([0]), {enabled:false}).glide, false);
  assert.equal(read(input, pad([0])).flap, false, 'refocus latches held controls');
  read(input, pad());
  assert.equal(read(input, pad([0])).flap, true);
  input.reset();
  assert.equal(read(input, pad([0])).flap, false, 'restart does not inherit a held jump');
  assert.deepEqual(input.sample([], {enabled:true}), {connected:false,flap:false,glide:false,pause:false});
});

test('only one connected standard controller owns input; reads never mutate the browser pad', () => {
  const input = createChikunGamepadInput(), a = pad(), b = pad([0],1);
  const before = JSON.stringify([a,b]);
  assert.equal(input.sample([a,b], {enabled:true}).flap, false);
  assert.equal(JSON.stringify([a,b]), before);
  assert.equal(input.sample([{...a,mapping:'unknown'}], {enabled:true}).connected, false);
  assert.deepEqual(input.sample(null, {enabled:true}), {connected:false,flap:false,glide:false,pause:false});
});

test('controller and keyboard equivalents produce byte-identical current and historical replay results', () => {
  for (const evidenceVersion of ['chikun-flap-evidence-v6','chikun-flap-evidence-v5']) {
    const input = createChikunGamepadInput();
    read(input, pad());
    const controller = createChikunRuntime({seed:20260807,maxTicks:300,evidenceVersion});
    const keyboard = createChikunRuntime({seed:20260807,maxTicks:300,evidenceVersion});
    const taps = [1,18,42,68,94,120,146,172,198,224,250];
    for (let tick=0; tick<300&&!controller.terminal; tick++) {
      const held = taps.some(t=>tick===t||tick===t+1);
      const control = read(input, pad(held?[0]:[]));
      controller.step({flap:control.flap});
      keyboard.step({flap:taps.includes(tick)});
    }
    assert.equal(JSON.stringify(controller.result()),JSON.stringify(keyboard.result()));
    assert.equal(JSON.stringify(replayChikunRun(controller.result().evidence)),JSON.stringify(controller.result()));
  }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import * as prototypePolicy from '../apps/hmh-reboot/src/prototype-actor-art.mjs';
import { readFileSync } from 'node:fs';

import {
  createPrototypeHumanoidDescriptor,
  drawPrototypeHumanoid,
} from '../apps/hmh-reboot/src/prototype-actor-art.mjs';

const REQUIRED_HUMAN_PARTS = Object.freeze([
  'head',
  'torso',
  'left-arm',
  'right-arm',
  'left-leg',
  'right-leg',
]);

test('fallback readability uses body geometry at every facing, never the held weapon', () => {
  assert.equal(typeof prototypePolicy.measureMinimumPrototypeBodyHeight, 'function');
  const unarmed = createPrototypeHumanoidDescriptor({ radius: 24, bodyColor: 0x49ddff });
  const armed = createPrototypeHumanoidDescriptor({ radius: 24, bodyColor: 0x49ddff, weapon: true });
  const height = prototypePolicy.measureMinimumPrototypeBodyHeight(unarmed);
  assert.ok(height > 25 && height < 60, `body height ${height} must be derived from the six anatomical parts`);
  assert.equal(prototypePolicy.measureMinimumPrototypeBodyHeight(armed), height);
  const enlarged = structuredClone(unarmed);
  enlarged.parts.find((part) => part.id === 'head').geometry.radius *= 5;
  assert.ok(prototypePolicy.measureMinimumPrototypeBodyHeight(enlarged) > height);
  assert.throws(() => prototypePolicy.measureMinimumPrototypeBodyHeight(null), /descriptor|body|prototype/i);
});

test('fallback render loop composes a measured camera zoom instead of leaving the marker unscaled', () => {
  const source = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(source, /bodyHeight: productionHeroDisplay\?\.minimumBodyHeight \?\? prototypeMinimumBodyHeight/);
  assert.match(source, /marker\.scale\.set\(prototypePoseScale\.x \* camera\.zoom, prototypePoseScale\.y \* camera\.zoom\)/);
});

function recordingGraphics() {
  const calls = [];
  const graphics = { calls };
  for (const method of ['circle', 'ellipse', 'moveTo', 'lineTo', 'fill', 'stroke']) {
    graphics[method] = (...args) => {
      calls.push({ method, args });
      return graphics;
    };
  }
  return graphics;
}

test('prototype actor descriptor is immutable, bounded, and explicitly human', () => {
  const descriptor = createPrototypeHumanoidDescriptor({
    radius: 24,
    bodyColor: 0x49ddff,
    weapon: true,
  });

  assert.equal(descriptor.kind, 'prototype-human-graybox');
  assert.equal(descriptor.radius, 24);
  assert.deepEqual(descriptor.parts.map((part) => part.id), REQUIRED_HUMAN_PARTS);
  assert.equal(descriptor.weapon?.id, 'rifle');
  assert.ok(Object.isFrozen(descriptor));
  assert.ok(Object.isFrozen(descriptor.parts));
  assert.ok(descriptor.parts.every(Object.isFrozen));

  for (const part of descriptor.parts) {
    for (const value of Object.values(part.geometry)) {
      if (typeof value === 'number') assert.ok(Math.abs(value) <= 24, `${part.id} escaped actor radius`);
    }
  }
});

test('prototype actor drawing emits human anatomy rather than role-shape proxy bodies', () => {
  const graphics = recordingGraphics();
  const descriptor = createPrototypeHumanoidDescriptor({
    radius: 32,
    bodyColor: 0xff5c7a,
    outlineColor: 0xffffff,
  });

  drawPrototypeHumanoid(graphics, descriptor);

  assert.equal(graphics.label, 'prototype-human-graybox');
  assert.ok(graphics.calls.some((call) => call.method === 'circle'), 'head must be visibly circular');
  assert.ok(graphics.calls.some((call) => call.method === 'ellipse'), 'torso must be visibly distinct');
  assert.ok(graphics.calls.filter((call) => call.method === 'lineTo').length >= 4, 'four separate limbs must be drawn');
  assert.doesNotMatch(JSON.stringify(descriptor), /wedge|diamond|square|hexagon|star|animal|robot|mechanical/i);
});

test('prototype human scales proportionally for player, enemy, and boss radii', () => {
  for (const radius of [18, 24, 56]) {
    const descriptor = createPrototypeHumanoidDescriptor({ radius, bodyColor: 0x8ff3ff });
    const head = descriptor.parts.find((part) => part.id === 'head');
    const torso = descriptor.parts.find((part) => part.id === 'torso');
    assert.equal(head.geometry.radius, radius * 0.28);
    assert.equal(torso.geometry.radiusX, radius * 0.46);
    assert.equal(torso.geometry.radiusY, radius * 0.52);
  }
});

// Package §3.3 colour rules (slice S1.4): no objective colour reuses a
// telegraph colour; boss-trigger colours are at least ΔE 25 (CIE76) from the
// telegraph colours; ivory is at least ΔE 25 from every district's accent and
// ground.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MISSION_PALETTE, MISSION_TELEGRAPH_COLORS, MISSION_LAMP_SHAPES } from '../apps/hmh-reboot/src/mission-palette.mjs';
import { LEVEL_ONE_WORLD } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { DISTRICT_ATMOSPHERE } from '../apps/hmh-reboot/src/world-atmosphere.mjs';

// sRGB (D65) -> CIE L*a*b*, then the CIE76 distance.
function lab(hex) {
  const linear = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const [r, g, b] = linear;
  const xyz = [
    (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047,
    (0.2126729 * r + 0.7151522 * g + 0.072175 * b) / 1,
    (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883,
  ].map((t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116));
  return [116 * xyz[1] - 16, 500 * (xyz[0] - xyz[1]), 200 * (xyz[1] - xyz[2])];
}
const deltaE = (left, right) => Math.hypot(...lab(left).map((value, index) => value - lab(right)[index]));
const colours = (value) => (typeof value === 'number' ? [value] : Object.values(value).flatMap(colours));

test('the CIE76 helper matches known references', () => {
  assert.equal(deltaE(0xffffff, 0xffffff), 0);
  assert.ok(Math.abs(lab(0xffffff)[0] - 100) < 1e-3);
  assert.ok(Math.abs(deltaE(0x000000, 0xffffff) - 100) < 1e-2);
  // Pure red is L 53.24, a 80.09, b 67.20.
  assert.ok(lab(0xff0000).every((value, index) => Math.abs(value - [53.24, 80.09, 67.2][index]) < 0.05));
});

test('no objective colour reuses a telegraph colour, and the boss trigger stays at least ΔE 25 from all of them', () => {
  for (const colour of colours(MISSION_PALETTE)) assert.ok(!MISSION_TELEGRAPH_COLORS.includes(colour), colour.toString(16));
  for (const colour of colours(MISSION_PALETTE.boss)) {
    for (const telegraph of MISSION_TELEGRAPH_COLORS) {
      assert.ok(deltaE(colour, telegraph) >= 25, `boss ${colour.toString(16)} vs ${telegraph.toString(16)}: ${deltaE(colour, telegraph).toFixed(1)}`);
    }
  }
});

test('ivory stays at least ΔE 25 from every district accent and ground colour', () => {
  for (const district of LEVEL_ONE_WORLD.districts) {
    const accent = DISTRICT_ATMOSPHERE[district.id].tint.color;
    for (const background of [accent, district.color]) {
      const distance = deltaE(MISSION_PALETTE.mechanism.ring, background);
      assert.ok(distance >= 25, `${district.id} ${background.toString(16)}: ${distance.toFixed(1)}`);
    }
  }
});

test('every status lamp carries a shape as well as a colour', () => {
  assert.deepEqual(Object.keys(MISSION_LAMP_SHAPES).sort(), Object.keys(MISSION_PALETTE.lamp).sort());
  assert.equal(new Set(Object.values(MISSION_LAMP_SHAPES)).size, 3);
  assert.ok(Object.isFrozen(MISSION_PALETTE) && Object.isFrozen(MISSION_PALETTE.lamp));
});

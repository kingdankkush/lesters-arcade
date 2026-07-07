import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  buildGrenadeAimPreview,
  classifyGrenadeRelease,
  grenadeAimDistance,
  grenadeChargeProgress,
  isGrenadeAimCancel,
} from '../apps/portal/src/hmh-grenade-aim.mjs';

test('WO-101 grenade charge curve eases from min toward max', () => {
  assert.equal(grenadeChargeProgress({ heldMs: 0, chargeMs: 900 }), 0);
  assert.equal(grenadeChargeProgress({ heldMs: 900, chargeMs: 900 }), 1);
  const mid = grenadeChargeProgress({ heldMs: 450, chargeMs: 900 });
  assert.ok(mid > 0.5 && mid < 1, `ease-out should advance quickly, got ${mid}`);
});

test('WO-101 grenade type distances match spec clamps', () => {
  assert.equal(grenadeAimDistance({ typeId: 'satoshi-frag', heldMs: 0 }), 2.5);
  assert.equal(grenadeAimDistance({ typeId: 'satoshi-frag', heldMs: 900 }), 7);
  assert.equal(grenadeAimDistance({ typeId: 'launcher-rig', heldMs: 650 }), 11);
  assert.equal(grenadeAimDistance({ typeId: 'block-buster', heldMs: 1050 }), 6);
});

test('WO-101 release classifier preserves tap quick throw and hold aim', () => {
  assert.equal(classifyGrenadeRelease({ heldMs: 80 }), 'quick');
  assert.equal(classifyGrenadeRelease({ heldMs: 150 }), 'aimed');
  assert.equal(classifyGrenadeRelease({ heldMs: 900, canceled: true }), 'cancel');
});

test('WO-101 manual preview exposes truthful blast radius and landing point', () => {
  const preview = buildGrenadeAimPreview({ typeId: 'satoshi-frag', heldMs: 900, playerX: 10, playerY: -2, aimX: 1, aimY: 0, blastRadius: 2, radiusMultiplier: 1.25 });
  assert.equal(preview.preview, 'lob-ellipse');
  assert.equal(preview.distance, 7);
  assert.equal(preview.landX, 17);
  assert.equal(preview.landY, -2);
  assert.equal(preview.marker.radius, 2.5);
});

test('WO-101 launcher and block-buster use distinct preview variants', () => {
  assert.equal(buildGrenadeAimPreview({ typeId: 'launcher-rig', heldMs: 650 }).preview, 'flat-line');
  const block = buildGrenadeAimPreview({ typeId: 'block-buster', heldMs: 1050, blastRadius: 3.25 });
  assert.equal(block.preview, 'heavy-blast-ring');
  assert.equal(block.distance, 6);
  assert.equal(block.marker.radius, 3.25);
});

test('WO-101 homing cluster locks largest nearby pack while held', () => {
  const enemies = [
    { id: 'solo', mapX: 6, mapY: 0, hp: 5 },
    { id: 'pack-a', mapX: 3, mapY: 3, hp: 5 },
    { id: 'pack-b', mapX: 3.5, mapY: 3.2, hp: 5 },
    { id: 'pack-c', mapX: 2.8, mapY: 2.7, hp: 5 },
  ];
  const preview = buildGrenadeAimPreview({ typeId: 'homing-cluster', playerX: 0, playerY: 0, enemies, blastRadius: 2.35 });
  assert.equal(preview.mode, 'homing-lock');
  assert.match(preview.lockedEnemyId, /^pack-/);
  assert.equal(preview.preview, 'cluster-lock');
});

test('WO-101 cancel zone accepts upward drag or second-finger tap', () => {
  assert.equal(isGrenadeAimCancel({ startX: 100, startY: 500, currentX: 105, currentY: 390, cancelZoneY: 420 }), true);
  assert.equal(isGrenadeAimCancel({ startX: 100, startY: 500, currentX: 105, currentY: 490, cancelZoneY: 420 }), false);
  assert.equal(isGrenadeAimCancel({ secondFingerTap: true }), true);
});

test('WO-101 runtime wires tap/hold/release/cancel across touch and desktop', () => {
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../apps/portal/styles.css', import.meta.url), 'utf8');
  const doc = readFileSync(new URL('../docs/game-design/hmh-grenade-aim-wo101.md', import.meta.url), 'utf8');
  assert.match(main, /from '.\/src\/hmh-grenade-aim\.mjs'/);
  assert.match(main, /function startGrenadeAimInput/);
  assert.match(main, /function releaseGrenadeAimInput/);
  assert.match(main, /classifyGrenadeRelease/);
  assert.match(main, /isGrenadeAimCancel/);
  assert.match(main, /key === 'f' \|\| key === 'g'/);
  assert.match(main, /event\.button === 2\) startGrenadeAimInput/);
  assert.match(main, /touch-grenade-cancel-zone/);
  assert.doesNotMatch(main, /btn\.addEventListener\('pointerdown',[\s\S]{0,180}performTouchAction\('grenade'\)/);
  assert.match(css, /touch-grenade-cancel-zone/);
  assert.match(doc, /Tap grenade/);
  assert.match(doc, /hold `F`, `G`, or right mouse/);
});

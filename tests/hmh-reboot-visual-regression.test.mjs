import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  ENEMY_CROP_MAX_CELL_DELTA,
  ENEMY_CROP_MEAN_LUMA_TOLERANCE,
  ENEMY_CROP_SIGNATURE_SIZE,
  SIGNATURE_HEIGHT,
  SIGNATURE_MAX_CELL_DELTA,
  SIGNATURE_MAX_CHANGED_CELLS,
  SIGNATURE_TOLERANCE,
  SIGNATURE_WIDTH,
  VISUAL_SCENES,
  classifyEnemyCrops,
  classifyScene,
  compareSignatures,
  cropSignature,
  signatureFromImage,
} from '../scripts/hmh-reboot-visual-regression.mjs';

// A synthetic decoded frame in the shape decodePng returns, so the crop gate
// can be exercised without a browser or a PNG encoder.
function flatFrame(width, height, value) {
  return { width, height, channels: 3, pixels: Buffer.alloc(width * height * 3, value) };
}

function paintRect(image, rect, value) {
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) {
      const index = (y * image.width + x) * image.channels;
      image.pixels[index] = value;
      image.pixels[index + 1] = value;
      image.pixels[index + 2] = value;
    }
  }
}

test('reboot visual gate owns desktop, mobile, combat, and every authored district material pass', () => {
  assert.ok(VISUAL_SCENES.length >= 8);
  const ids = new Set(VISUAL_SCENES.map((scene) => scene.id));
  for (const required of ['frontier-relay-desktop', 'frontier-relay-mobile', 'combat-engaged-desktop', 'ravine-overlook-desktop', 'mining-camp-desktop', 'liquidity-bridge-desktop', 'hashwood-foliage-desktop', 'liquidation-yard-desktop']) {
    assert.ok(ids.has(required), `visual gate is missing ${required}`);
  }
  assert.ok(VISUAL_SCENES.every((scene) => scene.query.includes('evidenceSafe=1') && scene.query.includes('telemetry=1')));
});

test('reboot visual comparison rejects localized and broad regressions', () => {
  const baseline = Array(32 * 18).fill(80);
  assert.deepEqual(compareSignatures(baseline, baseline), { comparable: true, meanDelta: 0, maxDelta: 0, changedCells: 0 });
  const localized = [...baseline];
  localized[40] += SIGNATURE_MAX_CELL_DELTA + 1;
  assert.equal(classifyScene({ baseline, current: localized }).status, 'changed');
  const broad = baseline.map((value, index) => index < SIGNATURE_MAX_CHANGED_CELLS + 1 ? value + SIGNATURE_TOLERANCE + 1 : value);
  assert.equal(classifyScene({ baseline, current: broad }).status, 'changed');
  assert.equal(classifyScene({ baseline: null, current: baseline }).status, 'new');
});

// Cycle 073: with EEVEE enemy atlases live, the twelve-scene 32x18 gate stayed
// inside tolerance. A 1440x900 cell is 45x50 px and an idle roster sprite is
// about 120 px, so a full re-light of every enemy touched under ten cells by a
// few luma levels each: invisible to the frame signature, obvious to a player.
test('the enemy-crop check catches a sprite re-light the 32x18 frame signature cannot see', () => {
  const body = { x: 700, y: 400, w: 120, h: 120 };
  const before = flatFrame(1440, 900, 80);
  paintRect(before, body, 90);
  const relit = flatFrame(1440, 900, 80);
  paintRect(relit, body, 90 + 12);

  const frameBefore = signatureFromImage(before, { width: SIGNATURE_WIDTH, height: SIGNATURE_HEIGHT });
  const frameRelit = signatureFromImage(relit, { width: SIGNATURE_WIDTH, height: SIGNATURE_HEIGHT });
  const frameVerdict = classifyScene({ baseline: frameBefore, current: frameRelit });
  assert.equal(frameVerdict.status, 'unchanged', 'precondition: the frame signature is blind to this change');
  assert.ok(frameVerdict.maxDelta <= SIGNATURE_MAX_CELL_DELTA && frameVerdict.meanDelta < SIGNATURE_TOLERANCE);

  const rect = { archetypeId: 'forkrunner', ...body };
  const cropBefore = cropSignature(before, rect);
  const cropRelit = cropSignature(relit, rect);
  assert.equal(cropBefore.signature.length, ENEMY_CROP_SIGNATURE_SIZE * ENEMY_CROP_SIGNATURE_SIZE);
  const verdict = classifyEnemyCrops({ baseline: [cropBefore], current: [cropRelit] });
  assert.equal(verdict.status, 'changed');
  assert.equal(verdict.crops[0].archetypeId, 'forkrunner');
  assert.ok(verdict.crops[0].meanLumaDelta > ENEMY_CROP_MEAN_LUMA_TOLERANCE);

  // Identical crops pass; a baseline that predates the crop check reports
  // 'new' rather than failing, so the integrator's accept run populates it.
  assert.equal(classifyEnemyCrops({ baseline: [cropBefore], current: [cropSignature(before, rect)] }).status, 'unchanged');
  assert.equal(classifyEnemyCrops({ baseline: null, current: [cropBefore] }).status, 'new');
  // A crop count or archetype mismatch is a real composition change.
  assert.equal(classifyEnemyCrops({ baseline: [cropBefore], current: [] }).status, 'incomparable');
  assert.equal(classifyEnemyCrops({ baseline: [cropBefore], current: [{ ...cropBefore, archetypeId: 'gas-bomber' }] }).status, 'incomparable');
});

test('the enemy-crop check tolerates sub-cell sprite placement jitter', () => {
  // The runtime publishes the body rectangle, so the crop follows the sprite;
  // a one-pixel camera-interpolation shift changes only what shows under it.
  const body = { x: 700, y: 400, w: 120, h: 120 };
  const frame = flatFrame(1440, 900, 80);
  paintRect(frame, body, 140);
  paintRect(frame, { x: 700, y: 480, w: 120, h: 40 }, 60);
  const shifted = flatFrame(1440, 900, 80);
  paintRect(shifted, { ...body, x: body.x + 1 }, 140);
  paintRect(shifted, { x: 701, y: 480, w: 120, h: 40 }, 60);
  const verdict = classifyEnemyCrops({
    baseline: [cropSignature(frame, { archetypeId: 'bagholder-rusher', ...body })],
    current: [cropSignature(shifted, { archetypeId: 'bagholder-rusher', ...body, x: body.x + 1 })],
  });
  assert.equal(verdict.status, 'unchanged');
  assert.ok(verdict.crops[0].maxCellDelta <= ENEMY_CROP_MAX_CELL_DELTA);
});

test('enemy crops are cut from a chrome-free capture of the same frozen frame', async () => {
  // The gate's canvas screenshot carries the fixed DOM chrome (cockpit rail,
  // pause card) at a document-relative offset, so an enemy standing under it
  // would be cropped as HUD. The frame signature keeps that capture for
  // baseline compatibility; the crops come from a second screenshot taken
  // after every node outside the canvas' ancestor chain is hidden.
  const source = await readFile(new URL('../scripts/hmh-reboot-visual-regression.mjs', import.meta.url), 'utf8');
  assert.match(source, /const cropSource = decodePng\(await page\.locator\('#hmhRebootStage canvas'\)\.screenshot\(\)\)/);
  assert.match(source, /node\.style\.visibility = 'hidden'/);
  assert.match(source, /\.enemy-crops\.png/);
  assert.match(source, /dataset\.enemyScreenRects/);
  // Rects fully outside the frame are not crops; a declared scene with none
  // on camera is a broken scene, not a pass.
  assert.match(source, /declares the enemy-crop check but reported no enemy body on camera/);
});

test('every scene with roster enemies on camera declares the enemy-crop check', () => {
  const byId = new Map(VISUAL_SCENES.map((scene) => [scene.id, scene]));
  for (const id of ['frontier-relay-desktop', 'frontier-relay-mobile', 'combat-engaged-desktop']) {
    assert.equal(byId.get(id)?.enemyCrops, true, `${id} must gate enemy sprite lighting`);
  }
  // The world-tour scenes move the camera 3,000-11,000 units from every spawn
  // and capture before the director starts; there is nothing to crop there.
  for (const scene of VISUAL_SCENES) {
    if (/worldTour=/.test(scene.query)) assert.notEqual(scene.enemyCrops, true, `${scene.id} has no roster enemy on camera`);
  }
});

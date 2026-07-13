import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MASTER_PALETTE,
  analyzeTransparencyFrame,
  auditCompleteness,
  auditPaletteCompliance,
  auditPivotStability,
  auditRuntimeAnchorConsistency,
  auditTellDurationContract,
  estimateFootContactPoint,
  nearestPaletteDistance,
  renderTinyQaContactSheet,
  spriteQaExitCode,
} from '../scripts/sprite-qa.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function frame(width, height, paint) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 0;
    pixels[i + 1] = 0;
    pixels[i + 2] = 0;
    pixels[i + 3] = 0;
  }
  paint({
    set(x, y, rgba) {
      const i = (y * width + x) * 4;
      pixels[i] = rgba[0];
      pixels[i + 1] = rgba[1];
      pixels[i + 2] = rgba[2];
      pixels[i + 3] = rgba[3];
    },
  });
  return { width, height, pixels };
}

test('palette audit measures ART_BIBLE palette distance and reports offending colors', () => {
  assert.equal(nearestPaletteDistance({ r: 23, g: 59, b: 114 }, MASTER_PALETTE).distance, 0);

  const bad = frame(4, 4, ({ set }) => {
    for (let y = 0; y < 4; y += 1) {
      for (let x = 0; x < 4; x += 1) set(x, y, [255, 0, 0, 255]);
    }
  });
  const result = auditPaletteCompliance(bad, MASTER_PALETTE, { distanceThreshold: 20, maxOffPaletteRatio: 0.01 });
  assert.equal(result.status, 'fail');
  assert.equal(result.offPaletteRatio, 1);
  assert.equal(result.offendingHexes[0].hex, '#ff0000');
});

test('transparency audit catches opaque background corners, matte halos, and stray islands', () => {
  const bad = frame(6, 6, ({ set }) => {
    for (const [x, y] of [[0, 0], [5, 0], [0, 5], [5, 5]]) set(x, y, [30, 30, 30, 255]);
    set(2, 2, [23, 59, 114, 255]);
    set(3, 2, [23, 59, 114, 255]);
    set(2, 3, [23, 59, 114, 255]);
    set(3, 3, [23, 59, 114, 255]);
    set(1, 1, [255, 255, 255, 20]);
    set(5, 2, [23, 59, 114, 255]);
  });

  const result = analyzeTransparencyFrame(bad, { strayIslandPixelThreshold: 0, maxMatteHaloPixels: 0 });
  assert.equal(result.status, 'fail');
  assert.equal(result.opaqueCornerCount, 4);
  assert.equal(result.haloPixelCount > 0, true);
  assert.equal(result.strayIslandCount > 0, true);
});

test('pivot stability uses the lowest opaque row center as the foot contact point', () => {
  const a = frame(5, 5, ({ set }) => {
    set(1, 4, [23, 59, 114, 255]);
    set(2, 4, [23, 59, 114, 255]);
  });
  const b = frame(5, 5, ({ set }) => {
    set(2, 4, [23, 59, 114, 255]);
    set(3, 4, [23, 59, 114, 255]);
  });
  assert.deepEqual(estimateFootContactPoint(a), { x: 1.5, y: 4 });
  const stable = auditPivotStability([a, b], { maxVariancePx: 1.5 });
  assert.equal(stable.status, 'pass');

  const c = frame(8, 5, ({ set }) => set(7, 4, [23, 59, 114, 255]));
  const unstable = auditPivotStability([a, c], { maxVariancePx: 1.5 });
  assert.equal(unstable.status, 'fail');
});

test('runtime anchor audit accepts width-varying crops with a stable center-bottom height', () => {
  const wide = frame(8, 6, ({ set }) => set(1, 5, [23, 59, 114, 255]));
  const narrow = frame(4, 6, ({ set }) => set(3, 5, [23, 59, 114, 255]));
  const inconsistent = frame(4, 7, ({ set }) => set(3, 6, [23, 59, 114, 255]));
  assert.deepEqual(auditRuntimeAnchorConsistency([wide, narrow]).frameHeights, [6]);
  assert.equal(auditRuntimeAnchorConsistency([wide, narrow]).status, 'pass');
  assert.equal(auditRuntimeAnchorConsistency([wide, inconsistent]).status, 'fail');
});

test('sprite QA failures are fatal unless calibration explicitly allows them', () => {
  assert.equal(spriteQaExitCode({ failCount: 2 }), 1);
  assert.equal(spriteQaExitCode({ failCount: 2 }, { allowFailures: true }), 0);
  assert.equal(spriteQaExitCode({ failCount: 0 }), 0);
});

test('completeness audit catches missing states and partial direction sets', () => {
  const actor = {
    animations: {
      idle: { south: ['s0.png'], north: ['n0.png'] },
      run: { south: ['s0.png'] },
    },
  };
  const result = auditCompleteness(actor, {
    requiredStates: ['idle', 'run', 'death'],
    requiredDirections: ['south', 'north'],
    minFramesByState: { idle: 1, run: 2, death: 1 },
  });

  assert.equal(result.status, 'fail');
  assert.deepEqual(result.missingStates, ['death']);
  assert.deepEqual(result.partialDirections.run.missingDirections, ['north']);
  assert.equal(result.tooShortStates.run.south, 1);
});

test('tell-duration contract requires attack-tell art to cover behavior windup frames', () => {
  const actor = { animations: { 'attack-tell': { south: ['0.png', '1.png'] } } };
  const fail = auditTellDurationContract(actor, { enemyId: 'warren-spear-rider', tellFrames: 46 }, { fps: 12 });
  assert.equal(fail.status, 'fail');
  assert.equal(fail.coverageFrames.south, 10);

  const passActor = { animations: { 'attack-tell': { south: Array.from({ length: 10 }, (_, i) => `${i}.png`) } } };
  const pass = auditTellDurationContract(passActor, { enemyId: 'warren-spear-rider', tellFrames: 46 }, { fps: 12 });
  assert.equal(pass.status, 'pass');
});

test('contact-sheet renderer writes a PNG report artifact without external dependencies', () => {
  const out = path.join(os.tmpdir(), 'lesters-sprite-qa-test-contact-sheet.png');
  renderTinyQaContactSheet({ outPath: out, actorKey: 'test-actor', summary: { status: 'pass' }, checks: [] });
  assert.equal(existsSync(out), true);
  assert.equal(readFileSync(out).subarray(1, 4).toString('ascii'), 'PNG');
});

test('package scripts and syntax gate include the Sprite QA pipeline', () => {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const syntax = readFileSync(path.join(ROOT, 'scripts/syntax-check.mjs'), 'utf8');

  assert.equal(pkg.scripts['assets:qa'], 'node scripts/sprite-qa.mjs');
  assert.match(syntax, /scripts\/sprite-qa\.mjs/);
  assert.match(syntax, /tests\/sprite-qa\.test\.mjs/);
});

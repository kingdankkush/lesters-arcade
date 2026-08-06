import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  SIGNATURE_MAX_CELL_DELTA,
  SIGNATURE_MAX_CHANGED_CELLS,
  SIGNATURE_TOLERANCE,
  VISUAL_SCENES,
  classifyScene,
  compareSignatures,
  decodePng,
  signatureFromPng,
} from '../scripts/hmh-reboot-visual-regression.mjs';

const readMain = () => readFile(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');

test('combat feedback never conveys health through transparency', async () => {
  const source = await readMain();
  assert.ok(!/enemyMarker\.alpha = Math\.max\(0\.35/.test(source), 'health must not drive enemy alpha');
  assert.ok(!/bossVisual\.alpha = Math\.max\(0\.38/.test(source), 'health must not drive boss alpha');
  assert.match(source, /enemyMarker\.alpha = 1;/, 'living enemies render at full opacity');
  assert.match(source, /enemyHealthPips\.push/, 'health reads from a dedicated pip');
});

test('kills, impacts, and player damage each have a distinct visual response', async () => {
  const source = await readMain();
  assert.match(source, /type: 'kill'/, 'a defeat must emit a kill event');
  assert.match(source, /event\.type === 'kill'/, 'the kill event must be rendered');
  assert.match(source, /PLAYER_DAMAGE_FLASH_TICKS/, 'player damage needs a bounded screen flash');
  assert.match(source, /LOW_HEALTH_VIGNETTE_THRESHOLD/, 'low health needs a persistent vignette');
  assert.match(source, /1 - deathProgress \* deathProgress/, 'corpses must fade rather than pop out');
});

test('camera shake is wired, bounded, and honours accessibility settings', async () => {
  const source = await readMain();
  assert.match(source, /world\.position\.set\(/, 'shake must actually be applied');
  assert.match(source, /settings\.screenShake && !settings\.reduceMotion/, 'shake respects both settings');
  assert.match(source, /SHAKE_DECAY_TICKS/, 'shake must decay on a bounded window');
  // Shake must NOT touch camera.shakeX/Y: screenToGround reads those back for
  // pointer aim, so a shaking camera would let a cosmetic accessibility
  // setting change which shots hit. It offsets the render container instead.
  assert.ok(!/setCameraShake/.test(source), 'shake must never be applied through the camera');
});

test('camera shake cannot influence aim or hit resolution', async () => {
  const source = await readMain();
  const worldSpace = await readFile(new URL('../apps/hmh-reboot/src/world-space.mjs', import.meta.url), 'utf8');
  // screenToGround subtracts camera shake, so anything writing camera.shakeX/Y
  // feeds jitter straight into pointer aim.
  assert.match(worldSpace, /camera\.shakeX/, 'screenToGround still reads camera shake');
  assert.ok(!/camera\.shakeX\s*=/.test(source), 'runtime must not write camera.shakeX');
  assert.ok(!/camera\.shakeY\s*=/.test(source), 'runtime must not write camera.shakeY');
});

test('shake and spark randomness is deterministic, never Math.random', async () => {
  const source = await readMain();
  assert.ok(!/Math\.random/.test(source), 'the runtime must contain no Math.random');
  assert.match(source, /function deterministicUnit\(key\)/, 'effects use a seeded hash');
  assert.match(source, /deterministicUnit\(`shake-x:/, 'shake offsets are seeded from the tick');
});

test('visual effects respect the active performance profile', async () => {
  const source = await readMain();
  assert.match(source, /const particleScale = performanceProfile\.particlesPerHazard/);
  assert.match(source, /particleScale > 0 \? \(event\.critical \? 8 : 4\) : 0/, 'sparks degrade with the quality tier');
});

test('live grenades project their authoritative blast radius as an accessibility-safe danger warning', async () => {
  const source = await readMain();
  assert.match(source, /buildGrenadeDangerProjection/);
  assert.match(source, /reduceFlash:\s*settings\.reduceFlash/);
  assert.match(source, /warning\.boundary\.map/);
  assert.match(source, /worldToScreen\(point, camera, view\)/);
  assert.match(source, /activeGrenadeWarnings/);
  assert.match(source, /activeGrenadeWarningRadius/);
});

test('enemies face their movement direction instead of a fixed side', async () => {
  const source = await readFile(new URL('../apps/hmh-reboot/src/enemy-production-art.mjs', import.meta.url), 'utf8');
  assert.match(source, /poseLayer\.scale\.x = pose\.direction >= 3 && pose\.direction <= 5 \? -1 : 1/);
});

test('the shipped player identity is the production atlas, not the prototype graybox', async () => {
  const source = await readMain();
  assert.match(source, /const productionPilotEnabled = !grayboxRequested && !pipelinePilotEnabled/);
  // A failed atlas load must degrade to the prototype rather than break the run.
  assert.match(source, /productionHeroLoadError = String/);
  assert.match(source, /(?:stageElement\.dataset|dataset)\.actorArtSource = productionHeroDisplay \?/);
});

test('enemy depth sorting and combat VFX draw order are explicit', async () => {
  const source = await readMain();
  assert.match(source, /enemyVisuals\.sortableChildren = true/);
  assert.match(source, /enemyMarker\.zIndex = enemyScreen\.y/);
  const childOrder = source.slice(source.indexOf('world.addChild('), source.indexOf('app.stage.addChild('));
  assert.ok(
    childOrder.indexOf('actorVisual') < childOrder.indexOf('combatVisuals'),
    'combat VFX must draw above the actor so muzzle flashes are not occluded',
  );
});

test('the visual signature comparison is a real gate, not a constant pass', () => {
  const baseline = Array.from({ length: 64 }, (_, index) => (index * 3) % 200);
  assert.equal(classifyScene({ baseline, current: [...baseline] }).status, 'unchanged');
  const shifted = baseline.map((value, index) => (index < 20 ? value + 40 : value));
  const shiftedVerdict = classifyScene({ baseline, current: shifted });
  assert.equal(shiftedVerdict.status, 'changed');
  assert.ok(shiftedVerdict.meanDelta > SIGNATURE_TOLERANCE);
  assert.equal(classifyScene({ baseline, current: baseline.slice(0, 32) }).status, 'incomparable');
  assert.equal(classifyScene({ baseline: null, current: baseline }).status, 'new');
});

test('the gate fails a localized change that barely moves the mean', () => {
  // A hero sprite is well under 1% of a 1440x900 frame: losing it entirely
  // moves the mean by under 1, which a mean-only gate would pass.
  const baseline = new Array(576).fill(120);
  const heroLost = [...baseline];
  for (let index = 280; index < 292; index += 1) heroLost[index] = 50;
  const verdict = classifyScene({ baseline, current: heroLost });
  assert.ok(verdict.meanDelta < SIGNATURE_TOLERANCE, 'precondition: the mean stays under tolerance');
  assert.equal(verdict.status, 'changed', 'a localized regression must still fail the gate');
  assert.ok(verdict.maxDelta > SIGNATURE_MAX_CELL_DELTA);
  // Antialiasing-level noise across the whole frame must still pass.
  const noise = baseline.map((value, index) => value + (index % 2 === 0 ? 1 : -1));
  assert.equal(classifyScene({ baseline, current: noise }).status, 'unchanged');
  assert.ok(SIGNATURE_MAX_CHANGED_CELLS > 0);
});

test('signature comparison reports magnitude and locality', () => {
  const baseline = new Array(16).fill(100);
  const current = [...baseline];
  current[3] = 180;
  const comparison = compareSignatures(baseline, current);
  assert.equal(comparison.maxDelta, 80);
  assert.equal(comparison.changedCells, 1);
  assert.ok(comparison.meanDelta > 0 && comparison.meanDelta < 80);
});

test('the visual harness decodes real pixels rather than a cleared WebGL buffer', async () => {
  const { deflateSync } = await import('node:zlib');

  const crcTable = Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    return value >>> 0;
  });
  const crc32 = (buffer) => {
    let crc = 0xffffffff;
    for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };

  // 2x1 RGBA: one black pixel, one white, with a zero filter byte.
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(2, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.from([0, 0, 0, 0, 255, 255, 255, 255, 255]);
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);

  const decoded = decodePng(png);
  assert.equal(decoded.width, 2);
  assert.equal(decoded.height, 1);
  assert.equal(decoded.channels, 4);
  const signature = signatureFromPng(png, { width: 2, height: 1 });
  assert.deepEqual(signature, [0, 255], 'a black and a white pixel must not produce identical luma');
});

test('visual scenes cover both viewports and multiple authored districts', () => {
  const ids = VISUAL_SCENES.map((scene) => scene.id);
  assert.ok(ids.length >= 5);
  assert.ok(VISUAL_SCENES.some((scene) => scene.viewport.width < 500), 'a mobile viewport must be covered');
  assert.ok(VISUAL_SCENES.some((scene) => scene.query.includes('worldTour=ravine')));
  assert.ok(VISUAL_SCENES.every((scene) => Number.isInteger(scene.tick) && scene.tick > 0), 'captures pin to a simulation tick');
});

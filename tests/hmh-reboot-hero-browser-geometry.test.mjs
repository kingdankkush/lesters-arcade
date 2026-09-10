import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const load = () => import('../scripts/hmh-hero-browser-geometry.mjs');
const frame = (id, layer, x, y, w, h) => ({ id, layer, frame: { x: 0, y: 0, w, h }, sourceSize: { w: 160, h: 160 }, spriteSourceSize: { x, y }, sourcePivot: { x: 80, y: 150 } });
const frames = [frame('legs', 'lower-body', 60, 100, 40, 50), frame('torso', 'torso-head', 45, 30, 70, 70), frame('gun', 'weapon', 10, 10, 150, 150), frame('shadow', 'shadow', 0, 0, 160, 160)];
const state = { frameIds: frames.map((f) => f.id), actorScreenX: 422, actorScreenY: 195, actorScreenScale: 1, viewportWidth: 844, viewportHeight: 390 };

test('hero clearance measures both body layers at the actual rendered anchor, not texture padding or weapons', async () => {
  const { measureHeroBody, assertHeroClearance } = await load();
  const body = measureHeroBody(state, new Map(frames.map((f) => [f.id, f])));
  assert.deepEqual(body, { x: 387, y: 75, width: 70, height: 120, right: 457, bottom: 195, viewportRatio: 120 / 390 });
  assert.throws(() => assertHeroClearance(body, [{ id: 'first-use-hint', x: 217, y: 94, width: 410, height: 40 }], state), /first-use-hint.*overlap/);
  assert.doesNotThrow(() => assertHeroClearance(body, [{ id: 'first-use-hint', x: 8, y: 64, width: 184, height: 80 }], state));
  assert.throws(() => assertHeroClearance(body, [{ id: 'hint-shadow-edge', x: 380, y: 30, width: 90, height: 44 }], state), /12px clearance/);
  const trimmed = structuredClone(frames);
  trimmed[1].trim = { x: 3, y: 4 };
  const shifted = measureHeroBody(state, new Map(trimmed.map((f) => [f.id, f])));
  assert.equal(shifted.x, body.x + 3);
  assert.equal(shifted.y, body.y + 4);
});

test('clearance cannot pass with missing body layers, a clipped body, a tiny hero, or invalid geometry', async () => {
  const { measureHeroBody, assertHeroClearance } = await load();
  const index = new Map(frames.map((f) => [f.id, f]));
  assert.throws(() => measureHeroBody({ ...state, frameIds: ['legs', 'gun'] }, index), /body layers/);
  assert.throws(() => measureHeroBody({ ...state, actorScreenX: NaN }, index), /finite/);
  assert.throws(() => measureHeroBody({ ...state, actorScreenScale: 0 }, index), /positive/);
  const body = measureHeroBody({ ...state, actorScreenY: 20 }, index);
  assert.throws(() => assertHeroClearance(body, [], state), /viewport/);
  const tiny = measureHeroBody({ ...state, actorScreenScale: 0.2 }, index);
  assert.throws(() => assertHeroClearance(tiny, [], state), /12%/);
  assert.throws(() => assertHeroClearance(measureHeroBody(state, index), [{ id: 'bad', x: 0, y: 0, width: NaN, height: 10 }], state), /finite/);
});

test('the actual projection publishes its final anchor and scale and the normal first frame is checked before input', async () => {
  const source = await readFile(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  const smoke = await readFile(new URL('../scripts/hmh-reboot-production-hero-browser-smoke.mjs', import.meta.url), 'utf8');
  assert.match(source, /dataset\.actorScreenX = String\(actorVisual\.x \+ world\.position\.x\)/);
  assert.match(source, /dataset\.actorScreenY = String\(actorVisual\.y \+ world\.position\.y\)/);
  assert.match(source, /dataset\.actorScreenScale = String\(actorVisual\.scale\.x\)/);
  assert.match(smoke, /await assertFirstFrameClearance\(page\)/);
  assert.doesNotMatch(smoke, /hmhControlsHintDismiss.*click\(/);
});

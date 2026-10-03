import test from 'node:test';
import assert from 'node:assert/strict';
import { GraphicsContext } from 'pixi.js';
import { createCoverReadability } from '../apps/hmh-reboot/src/cover-readability.mjs';
import { COVER_RULES_V1 } from '../apps/hmh-reboot/src/cover-system.mjs';

function badgeStub() {
  let writes = 0;
  const data = { hidden: true, textContent: '', title: '' };
  const badge = {};
  for (const key of Object.keys(data)) Object.defineProperty(badge, key, {
    get: () => data[key], set: value => { writes++; data[key] = value; },
  });
  return { badge, writes: () => writes };
}
const cover = kind => ({ phase: 'cover', kind, anchor: { x: 100, y: 200 }, tangent: { x: 1, y: 0 }, along: 80, length: 160 });
const hero = Object.freeze({ x: 180, y: 224, groundZ: 36 });
const project = ({ x, y, z }) => ({ x: x * 2, y: y - z });

test('cover shield reports directional protection from current rules and diffs DOM writes', () => {
  const { badge, writes } = badgeStub(), view = createCoverReadability({ badge });
  for (const kind of ['tall', 'short']) {
    const state = cover(kind), before = JSON.stringify(state);
    view.draw({ graphics: new GraphicsContext(), cover: state, hero, project, zoom: 1 });
    const reduction = Math.round(100 * (1 - COVER_RULES_V1[`${kind}DamageMultiplier`]));
    assert.equal(badge.textContent, `${reduction}% cover`);
    assert.match(badge.title, /covered side/);
    assert.equal(badge.hidden, false);
    const count = writes();
    view.draw({ graphics: new GraphicsContext(), cover: state, hero, project, zoom: 1 });
    assert.equal(writes(), count, 'unchanged frames must not write DOM');
    assert.equal(JSON.stringify(state), before, 'presentation must not mutate authoritative cover');
  }
  view.draw({ graphics: new GraphicsContext(), cover: { phase: 'free' }, hero, project, zoom: 1 });
  assert.equal(badge.hidden, true);
  view.reset();
  assert.equal(badge.hidden, true);
});

test('active cover edge stays on the actual grounded face and retains both Pixi strokes', () => {
  const view = createCoverReadability(), graphics = new GraphicsContext();
  view.draw({ graphics, cover: cover('short'), hero, project, zoom: .75 });
  assert.equal(graphics.instructions.length, 2, 'bounded soft edge plus crisp edge');
  for (const instruction of graphics.instructions) {
    assert.equal(instruction.action, 'stroke');
    const points = instruction.data.path.instructions.find(row => row.action === 'poly').data[0];
    assert.equal(points.length, 4);
    assert.deepEqual(Array.from(points), [264, 163.5, 456, 163.5]);
    const shapes = instruction.data.path.shapePath.shapePrimitives;
    assert.equal(shapes.length, 1, 'Pixi must compile a real edge shape, not just store an instruction');
    assert.deepEqual(shapes[0].shape.points, [264, 163.5, 456, 163.5]);
  }
  graphics.destroy();
});

test('free, invalid and missing cover never leave a stale shield or draw a false edge', () => {
  const { badge } = badgeStub(), view = createCoverReadability({ badge });
  for (const state of [null, { phase: 'free' }, { ...cover('tall'), along: NaN }, cover('none')]) {
    const graphics = new GraphicsContext();
    view.draw({ graphics, cover: state, hero, project, zoom: 1 });
    assert.equal(graphics.instructions.length, 0);
    assert.equal(badge.hidden, true);
    graphics.destroy();
  }
});

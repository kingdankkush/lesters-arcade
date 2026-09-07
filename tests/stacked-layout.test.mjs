import assert from 'node:assert/strict';
import test from 'node:test';
import { computeBoardRects, computeLayout, layoutMatch } from '../apps/portal/src/stacked-layout.mjs';

const frozen = value => Object.isFrozen(value) && value.every(Object.isFrozen);

test('layout is pure, frozen, integer-aligned, centred and exposes both pinned names', () => {
  const input = Object.freeze({ viewportWidth: 1280, viewportHeight: 720, boardCount: 1, opponentMini: false });
  const before = JSON.stringify(input);
  const slots = layoutMatch(input);
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(computeLayout(input), slots);
  assert(frozen(slots));
  assert.equal(slots.length, 1);
  assert.equal(slots[0].frame, 'wide');
  for (const key of ['slot', 'x', 'y', 'scale']) assert(Number.isInteger(slots[0][key]), key);
  const [rect] = computeBoardRects(slots);
  assert.equal(rect.x + rect.width / 2, input.viewportWidth / 2);
  assert.equal(rect.y + rect.height / 2, input.viewportHeight / 2);
});

test('two wide boards use the measured formulas, ascending slots and never overlap', () => {
  for (const [viewportWidth, viewportHeight, expectedScale] of [[1920,1080,1],[1280,720,1],[900,500,1],[1600,600,1],[900,600,1]]) {
    const slots = layoutMatch({ viewportWidth, viewportHeight, boardCount: 2, opponentMini: false });
    assert.deepEqual(slots.map(({ slot }) => slot), [0, 1]);
    assert.equal(slots[0].scale, expectedScale);
    assert.equal(slots[1].scale, expectedScale);
    const rects = computeBoardRects(slots);
    assert(rects[0].x + rects[0].width <= rects[1].x);
  }
});

test('portrait uses the tall frame and online opponent mini remains a second slot', () => {
  const solo = layoutMatch({ viewportWidth: 390, viewportHeight: 844, boardCount: 1, opponentMini: false });
  assert.equal(solo[0].frame, 'tall');
  const versus = layoutMatch({ viewportWidth: 390, viewportHeight: 844, boardCount: 2, opponentMini: true });
  assert.equal(versus.length, 2);
  assert.equal(versus[1].frame, 'tall');
  assert(versus[1].scale <= versus[0].scale);
  assert(computeBoardRects(versus)[0].x + computeBoardRects(versus)[0].width <= 390);
});

test('safe areas constrain and centre the authored box inside usable pixels', () => {
  const [slot]=layoutMatch({viewportWidth:1280,viewportHeight:720,boardCount:1,opponentMini:false,safeArea:{top:20,right:40,bottom:30,left:60}});
  const [rect]=computeBoardRects([slot]);
  assert(rect.x>=60 && rect.y>=20);
  assert(rect.x+rect.width<=1240 && rect.y+rect.height<=690);
  assert.equal(rect.x+rect.width/2,60+(1180/2));
});

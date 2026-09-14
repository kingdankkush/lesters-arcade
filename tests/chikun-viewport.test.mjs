import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChikunViewport, upcomingChikunObstacle } from '../apps/chikun/src/viewport.mjs';

test('portrait uses an undistorted 9:16 camera with the full vertical flight lane', () => {
  const view = buildChikunViewport(405, 720, 2);
  assert.equal(view.width, 405);
  assert.equal(view.height, 720);
  assert.equal(view.portrait, true);
  assert.equal((280 - view.left) / view.width, .26);
  assert.equal(view.pixelWidth / view.pixelHeight, 9 / 16);
  assert.equal(view.density, 2);
});

test('landscape preserves the entire 16:9 course without altering simulation', () => {
  const view = buildChikunViewport(1280, 720, 1);
  assert.equal(view.left, 0);
  assert.equal(view.width, 1280);
  assert.equal(view.height, 720);
  assert.equal(view.portrait, false);
});

test('portrait previews an approaching obstacle before it enters the narrower camera', () => {
  const view = buildChikunViewport(405,720,1);
  const obstacles=[{index:0,kind:'tree',x:720,width:230,gapCenter:200,passed:false}];
  assert.equal(upcomingChikunObstacle(obstacles, view)?.kind, 'tree');
  assert.equal(upcomingChikunObstacle([{...obstacles[0],x:400}], view), null);
  assert.equal(upcomingChikunObstacle([{...obstacles[0],passed:true}], view), null);
  assert.equal(upcomingChikunObstacle(obstacles,buildChikunViewport(1280,720,1)),null);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  arcadeMusicVolume,
  musicSeekSeconds,
  shouldShowArcadeMusicPlayer,
} from '../apps/portal/src/arcade-music-transport.mjs';

test('arcade music volume is finite and clamped without losing an intentional zero', () => {
  assert.equal(arcadeMusicVolume(0), 0);
  assert.equal(arcadeMusicVolume(0.65), 0.65);
  assert.equal(arcadeMusicVolume(-1), 0);
  assert.equal(arcadeMusicVolume(2), 1);
  assert.equal(arcadeMusicVolume(Number.NaN, 0.7), 0.7);
});

test('arcade music seek converts a bounded progress fraction into media seconds', () => {
  assert.equal(musicSeekSeconds({ fraction: 0, durationSeconds: 240 }), 0);
  assert.equal(musicSeekSeconds({ fraction: 0.5, durationSeconds: 240 }), 120);
  assert.equal(musicSeekSeconds({ fraction: 2, durationSeconds: 240 }), 240);
  assert.equal(musicSeekSeconds({ fraction: 0.5, durationSeconds: Number.NaN }), 0);
});

test('shared player stays off the live combat canvas and returns for the gameplay pause surface', () => {
  assert.equal(shouldShowArcadeMusicPlayer({ appStep: 'wallet-splash' }), true);
  assert.equal(shouldShowArcadeMusicPlayer({ appStep: 'gameplay', gameplayPaused: false }), false);
  assert.equal(shouldShowArcadeMusicPlayer({ appStep: 'gameplay', gameplayPaused: true }), true);
  assert.equal(shouldShowArcadeMusicPlayer({ appStep: 'gameplay', gameplayPaused: true, pendingBegin: true }), false);
  assert.equal(shouldShowArcadeMusicPlayer({ appStep: 'gameplay', gameplayPaused: true, levelUpPaused: true }), false);
});

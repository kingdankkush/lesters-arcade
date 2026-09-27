import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStackedRunMusic } from '../apps/portal/src/stacked-run-music.mjs';
import { chooseArcadeMusicStartIndex } from '../apps/portal/src/arcade-core.mjs';

// A fake parent player: `start` picks a fresh random track and plays it,
// `adopt` keeps the song and only switches the queue context.
function harness({ musicOn = true, playing = false } = {}) {
  const calls = [];
  const player = { musicOn, playing };
  const music = createStackedRunMusic({
    start: () => { calls.push('start'); if (player.musicOn) player.playing = true; },
    adopt: () => { calls.push('adopt'); },
    isPlaying: () => player.playing,
    musicOn: () => player.musicOn,
  });
  return { calls, player, music };
}

test('mount starts a fresh random track and the first running keeps that song', () => {
  const { calls, music } = harness();
  assert.equal(music.mount(), 'start');
  assert.equal(music.observe({ status: 'paused', survivalTicks: 0, paused: true }), 'idle');
  assert.equal(music.observe({ status: 'ready', survivalTicks: 0 }), 'idle');
  assert.equal(music.observe({ status: 'running', survivalTicks: 0 }), 'adopt');
  assert.deepEqual(calls, ['start', 'adopt']);
});

test('a blocked mount start is retried on the ready->running transition (the Start click)', () => {
  const { calls, player, music } = harness();
  music.mount();
  player.playing = false; // play() rejected: no user activation left after the chunk import
  assert.equal(music.observe({ status: 'running', survivalTicks: 0 }), 'start');
  assert.equal(player.playing, true);
  assert.deepEqual(calls, ['start', 'start']);
});

test('pause and resume, score ticks and duplicate running states never restart the song', () => {
  const { calls, music } = harness();
  music.mount();
  music.observe({ status: 'running', survivalTicks: 0 });
  for (const state of [
    { status: 'running', survivalTicks: 1 },
    { status: 'running', survivalTicks: 600 },
    { status: 'paused', survivalTicks: 600, paused: true },
    { status: 'running', survivalTicks: 600 },
    { paused: false },
    {},
  ]) assert.equal(music.observe(state), 'idle');
  assert.deepEqual(calls, ['start', 'adopt']);
});

test('a new run after game over starts a fresh random track even while music plays', () => {
  const { calls, player, music } = harness();
  music.mount();
  music.observe({ status: 'running', survivalTicks: 0 });
  assert.equal(music.observe({ status: 'terminal', survivalTicks: 900 }), 'armed');
  assert.equal(player.playing, true);
  assert.equal(music.observe({ status: 'running', survivalTicks: 0 }), 'start');
  assert.equal(music.observe({ status: 'running', survivalTicks: 5 }), 'idle');
  assert.deepEqual(calls, ['start', 'adopt', 'start']);
});

test('a music already playing when the run begins keeps its song and switches the queue context', () => {
  const { calls, music } = harness({ playing: true });
  assert.equal(music.observe({ status: 'running', survivalTicks: 0 }), 'adopt');
  assert.deepEqual(calls, ['adopt']);
});

test('music off or muted: nothing plays at mount or at run start, only the queue context follows', () => {
  const { calls, player, music } = harness({ musicOn: false });
  assert.equal(music.mount(), 'adopt');
  assert.equal(music.observe({ status: 'running', survivalTicks: 0 }), 'off');
  music.observe({ status: 'terminal' });
  assert.equal(music.observe({ status: 'running', survivalTicks: 0 }), 'off');
  assert.equal(player.playing, false);
  assert.deepEqual(calls, ['adopt']);
  // Turning music back on mid-run does not start a song by itself; the next run does.
  player.musicOn = true;
  assert.equal(music.observe({ status: 'running', survivalTicks: 40 }), 'idle');
  music.observe({ status: 'terminal' });
  assert.equal(music.observe({ status: 'running', survivalTicks: 0 }), 'start');
});

test('a disposed session (cabinet closed or remounted) never touches the player again', () => {
  const { calls, music } = harness();
  music.mount();
  music.dispose();
  assert.equal(music.mount(), 'closed');
  assert.equal(music.observe({ status: 'running', survivalTicks: 0 }), 'closed');
  assert.deepEqual(calls, ['start']);
});

test('restarts never repeat the previous track when the queue has more than one song', () => {
  for (const r of [0, 0.2, 0.5, 0.8, 0.999999]) {
    for (let previous = 0; previous < 26; previous++) {
      const next = chooseArcadeMusicStartIndex({ queueLength: 26, previousIndex: previous, random: () => r });
      assert.notEqual(next, previous);
      assert.ok(next >= 0 && next < 26);
    }
  }
  assert.equal(chooseArcadeMusicStartIndex({ queueLength: 1, previousIndex: 0, random: () => 0.7 }), 0);
});

test('the parent blesses the music element inside the STACKED mode click and wires the run machine', () => {
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  const start = main.indexOf('async function startOfficialMode(mode) {');
  assert.ok(start > 0);
  const body = main.slice(start, main.indexOf('\n}\n', start));
  const bless = body.indexOf("selectedGameId === 'stacked') blessArcadeMusicElement()");
  assert.ok(bless > 0, 'startOfficialMode blesses the element for STACKED');
  assert.equal(body.slice(0, bless).includes('await'), false, 'the bless runs before any await (still inside the click)');
  const mount = main.slice(main.indexOf('async function mountStackedSession() {'), main.indexOf('let chikunLifecycle = null;'));
  assert.match(mount, /stackedRunMusic = createStackedRunMusic\(/);
  assert.match(mount, /runMusic\.mount\(\);\n\}/);
  assert.match(mount, /onState\(value\) \{ runMusic\.observe\(value\);/);
  assert.match(main, /function destroyStackedSession\(\) \{[^\n]*stackedRunMusic\?\.dispose\(\)/);
  assert.equal(mount.includes("void startArcadeMusicForGame('stacked');\n}"), false, 'mount no longer fires a bare unobserved start');
});

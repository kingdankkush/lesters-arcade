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

test('the song the Free click started is kept at mount and at run start', () => {
  const { calls, music } = harness({ playing: true });
  assert.equal(music.mount(), 'adopt');
  assert.equal(music.observe({ status: 'ready', survivalTicks: 0 }), 'idle');
  assert.equal(music.observe({ status: 'running', survivalTicks: 0 }), 'keep');
  assert.deepEqual(calls, ['adopt']);
});

test('a paused player at mount (Ranked modal, rejected click start) starts a random track', () => {
  const { calls, music } = harness();
  assert.equal(music.mount(), 'start');
  assert.equal(music.observe({ status: 'running', survivalTicks: 0 }), 'keep');
  assert.deepEqual(calls, ['start']);
});

test('a blocked start is retried once on the first running (the child Start click)', () => {
  const { calls, player, music } = harness();
  music.mount();
  player.playing = false; // play() rejected: no user activation left after the chunk import
  assert.equal(music.observe({ status: 'paused', survivalTicks: 0, paused: true }), 'idle');
  assert.equal(music.observe({ status: 'running', survivalTicks: 0 }), 'start');
  assert.equal(player.playing, true);
  assert.deepEqual(calls, ['start', 'start']);
});

test('only the first running of a session acts: pause, resume, ticks, game over never restart', () => {
  const { calls, player, music } = harness({ playing: true });
  music.mount();
  music.observe({ status: 'running', survivalTicks: 0 });
  for (const state of [
    { status: 'running', survivalTicks: 1 },
    { status: 'paused', survivalTicks: 600, paused: true },
    { status: 'running', survivalTicks: 600 },
    { status: 'terminal', survivalTicks: 900 },
    { status: 'running', survivalTicks: 0 },
    { paused: false },
    {},
  ]) assert.equal(music.observe(state), 'idle');
  // Even a player the user paused mid-run is left alone.
  player.playing = false;
  assert.equal(music.observe({ status: 'running', survivalTicks: 700 }), 'idle');
  assert.deepEqual(calls, ['adopt']);
});

test('a playing track is never switched by the run machine', () => {
  const { calls, music } = harness({ playing: true });
  assert.equal(music.observe({ status: 'running', survivalTicks: 0 }), 'keep');
  assert.deepEqual(calls, []);
});

test('music off or muted: nothing plays at mount or at run start, only the queue context follows', () => {
  const { calls, player, music } = harness({ musicOn: false });
  assert.equal(music.mount(), 'adopt');
  assert.equal(music.observe({ status: 'running', survivalTicks: 0 }), 'off');
  assert.equal(player.playing, false);
  assert.deepEqual(calls, ['adopt']);
});

test('a disposed session (cabinet closed or remounted) never touches the player again', () => {
  const { calls, music } = harness();
  music.mount();
  music.dispose();
  assert.equal(music.mount(), 'closed');
  assert.equal(music.observe({ status: 'running', survivalTicks: 0 }), 'closed');
  assert.deepEqual(calls, ['start']);
});

test('a new game never repeats the previous track when the queue has more than one song', () => {
  for (const r of [0, 0.2, 0.5, 0.8, 0.999999]) {
    for (let previous = 0; previous < 26; previous++) {
      const next = chooseArcadeMusicStartIndex({ queueLength: 26, previousIndex: previous, random: () => r });
      assert.notEqual(next, previous);
      assert.ok(next >= 0 && next < 26);
    }
  }
  assert.equal(chooseArcadeMusicStartIndex({ queueLength: 1, previousIndex: 0, random: () => 0.7 }), 0);
});

test('the STACKED Free click starts the random track before any await; Ranked blesses the element', () => {
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  const start = main.indexOf('async function startOfficialMode(mode, { frontierPreview = false } = {}) {');
  assert.ok(start > 0);
  const body = main.slice(start, main.indexOf('\n}\n', start));
  const clickMusic = body.indexOf("if (selectedGameId === 'stacked') {");
  assert.ok(clickMusic > 0, 'startOfficialMode has a STACKED click-music step');
  const code = text => text.split('\n').filter(line => !line.trim().startsWith('//')).join('\n');
  assert.equal(/\bawait\b/.test(code(body.slice(0, clickMusic))), false, 'the click-music step runs before any await (still inside the click)');
  const step = body.slice(clickMusic, body.indexOf('\n  }\n', clickMusic));
  assert.match(step, /mode === 'ranked'\) blessArcadeMusicElement\(\)/);
  assert.match(step, /else void startArcadeMusicForGame\('stacked'\)/);
  assert.equal(/\bawait\b/.test(code(step)), false);
  const mount = main.slice(main.indexOf('async function mountStackedSession() {'), main.indexOf('let chikunLifecycle = null;'));
  assert.match(mount, /stackedRunMusic = createStackedRunMusic\(/);
  assert.match(mount, /runMusic\.mount\(\);\n\}/);
  const stateBody=mount.match(/onState\(value\)\s*\{([\s\S]*?)\},\s*\n\s*onResult\(/)?.[1];
  assert.ok(stateBody,'actual mounted lifecycle owns a state callback');
  assert.equal((stateBody.match(/runMusic\.observe\(value\)/g)??[]).length,1,'the actual callback observes each state exactly once');
  assert.match(stateBody,/^\s*const wasPaused\s*=\s*combat\.paused;\s*runMusic\.observe\(value\);/,'observation is unconditional after capturing the previous pause state');
  assert.ok(stateBody.indexOf('runMusic.observe(value)')<stateBody.indexOf('combat.paused = value.paused'),'music sees the state before pause-overlay bookkeeping');
  assert.match(stateBody,/combat\.paused\s*=\s*value\.paused;/);
  assert.match(stateBody,/combat\.active\s*=\s*\['running',\s*'paused',\s*'ready'\]\.includes\(value\.status\);/);
  assert.match(stateBody,/combat\.gameOver\s*=\s*value\.status\s*===\s*'terminal';\s*combat\.score\s*=\s*value\.score;/,'terminal and score handling remain alongside music');
  assert.match(stateBody,/if\(wasPaused!==combat\.paused\)syncCombatOverlay\(\);/,'only pause transitions refresh the parent overlay');
  assert.match(main, /function destroyStackedSession\(\) \{[^\n]*stackedRunMusic\?\.dispose\(\)/);
  assert.equal(mount.includes("void startArcadeMusicForGame('stacked');\n}"), false, 'mount no longer fires a bare unobserved start');
});

test('Hard Money Heroes still starts its music synchronously in beginOfficialLevel', () => {
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  const begin = main.slice(main.indexOf('async function beginOfficialLevel('));
  const call = begin.indexOf("void startArcadeMusicForGame('hard-money-heroes');");
  assert.ok(call > 0);
  assert.equal(/\bawait\b/.test(begin.slice(0, call).split('\n').filter(line => !line.trim().startsWith('//')).join('\n')), false);
});

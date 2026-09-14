import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
const start = source.indexOf('async function toggleCombatPause(');
const end = source.indexOf('\nfunction toggleCombatShakeSetting(', start);

function host(musicEnabled = true) {
  const calls = [];
  const context = {
    hmhRebootActive: true,
    combat: { paused: false, musicEnabled, menuSettingsOpen: true },
    hmhRebootHost: { pause: () => calls.push('pause-child'), resume: () => calls.push('resume-child') },
    pauseCombatMusic: () => calls.push('pause-music'),
    ensureCombatMusic: () => calls.push('resume-music'),
    playSfxCue: (cue) => calls.push(cue),
    syncCombatOverlay: () => calls.push('overlay'),
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context);
  return { context, calls };
}

test('reboot pause stops the active music before exposing the pause deck', async () => {
  const { context, calls } = host();
  await context.toggleCombatPause(true);
  assert.equal(context.combat.paused, true);
  assert.equal(calls.filter((call) => call === 'pause-music').length, 1);
  assert.ok(calls.indexOf('pause-music') < calls.indexOf('overlay'));
  assert.ok(calls.includes('pause-child'));
});

test('reboot resume restores enabled music and closes the settings page', async () => {
  const { context, calls } = host();
  context.combat.paused = true;
  await context.toggleCombatPause(false);
  assert.equal(context.combat.paused, false);
  assert.equal(context.combat.menuSettingsOpen, false);
  assert.ok(calls.includes('resume-music'));
  assert.ok(calls.includes('resume-child'));
});

test('reboot resume respects the music-off preference', async () => {
  const { context, calls } = host(false);
  context.combat.paused = true;
  await context.toggleCombatPause(false);
  assert.ok(!calls.includes('resume-music'));
  assert.ok(calls.includes('resume-child'));
});

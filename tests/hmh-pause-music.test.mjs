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

test('reboot pause leaves the current soundtrack playing without forcing playback', async () => {
  const { context, calls } = host();
  await context.toggleCombatPause(true);
  assert.equal(context.combat.paused, true);
  assert.ok(!calls.includes('pause-music'));
  assert.ok(!calls.includes('resume-music'));
  assert.ok(calls.includes('pause-child'));
});

function overlayHost({ gameOver = false, levelUpPaused = false } = {}) {
  const calls = [];
  const context = {
    combat: { paused: true, pendingBegin: false, levelUpPaused, gameOver, viewportMode: 'embedded' },
    officialAppStep: 'gameplay', chikunActive: false, stackedHost: null, hmhRebootActive: true,
    currentSession: { isPaid: true, mode: 'ranked' },
    document: { documentElement: { dataset: {} }, body: { classList: { toggle() {} } } },
    dom: { combatMenuPanel: { hidden: false }, officialCombatMount: { dataset: {} } },
    renderArcadeMusicPlayer: () => calls.push('music-controls'),
    gameplaySyncCopy: () => '',
    submitCombatGameOver: () => calls.push('finished-run'),
    clearInactiveCombatOverlay: () => gameOver,
  };
  vm.createContext(context);
  const overlayStart = source.indexOf('function syncCombatOverlay()');
  vm.runInContext(source.slice(overlayStart, start), context);
  return { context, calls };
}

for (const levelUpPaused of [false, true]) test(`HMH owns its ${levelUpPaused ? 'upgrade' : 'pause'} panel while the parent updates shared controls`, () => {
  const { context, calls } = overlayHost({ levelUpPaused });
  context.syncCombatOverlay();
  assert.equal(context.dom.combatMenuPanel.hidden, true);
  assert.equal(context.dom.officialCombatMount.dataset.paused, 'true');
  assert.equal(context.document.documentElement.dataset.gameplayPaused, levelUpPaused ? undefined : 'true');
  assert.deepEqual(calls, ['music-controls']);
});

test('HMH game-over still reaches the existing parent completion path', () => {
  const { context, calls } = overlayHost({ gameOver: true });
  context.syncCombatOverlay();
  assert.deepEqual(calls, ['music-controls', 'finished-run']);
});

test('HMH retains the parent game-over recap after its own pause panels close', () => {
  const { context, calls } = overlayHost({ gameOver: true });
  context.clearInactiveCombatOverlay = () => false;
  context.document.getElementById = () => null;
  Object.assign(context.dom.combatMenuPanel, { dataset: {}, querySelector: () => null });
  Object.assign(context, {
    buildCombatOptionsMenuModel: () => ({}), lastSettlementSucceeded: false,
    SETTLEMENT_LIVE: false, renderCombatHudOverlay() {}, renderRoguelikeStatBar() {},
    renderTacticalBalanceDebugOverlay() {}, renderCombatMenuActionGrid() {}, renderCombatSettingsPanel() {},
    renderGameOverSummary: () => calls.push('recap'),
  });
  context.syncCombatOverlay();
  assert.equal(context.dom.combatMenuPanel.hidden, false);
  assert.equal(context.dom.combatMenuPanel.dataset.state, 'game-over');
  assert.deepEqual(calls, ['music-controls', 'finished-run', 'recap']);
});

test('reboot resume preserves manually paused music and closes the settings page', async () => {
  const { context, calls } = host();
  context.combat.paused = true;
  await context.toggleCombatPause(false);
  assert.equal(context.combat.paused, false);
  assert.equal(context.combat.menuSettingsOpen, false);
  assert.ok(!calls.includes('resume-music'));
  assert.ok(!calls.includes('pause-music'));
  assert.ok(calls.includes('resume-child'));
});

test('reboot resume respects the music-off preference', async () => {
  const { context, calls } = host(false);
  context.combat.paused = true;
  await context.toggleCombatPause(false);
  assert.ok(!calls.includes('resume-music'));
  assert.ok(calls.includes('resume-child'));
});

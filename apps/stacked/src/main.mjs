import { Application, Container, Graphics, Text } from 'pixi.js';
import { PIECE_CELLS, cellsFor, collides } from '../../portal/src/stacked-sim.mjs';
import { createStackedRenderer } from './render/renderer.mjs';
import { createStackedPlaySession } from './play-session.mjs';
import { createStackedInput } from './input.mjs';
import { connectStackedChild } from './child-bridge.mjs';
import { buildStackedRunSummary } from './run-summary.mjs';
import { chunkStackedEvidence } from '../../portal/src/stacked-evidence-transport.mjs';
import { STACKED_CAPABILITIES } from '../../portal/src/stacked-contracts.mjs';
import { createStackedPauseClock } from './pause-clock.mjs';

const $ = id => document.getElementById(id);
const stage = $('stackedStage'), status = $('stackedStatus'), overlay = $('gameOverlay');
let app, renderer, run, input, init, settings, raf = 0, disposed = false, lastTime = 0, accumulator = 0, started = false, submitted = false, pauseCount = 0, forfeited = false;
const pauseClock = createStackedPauseClock();
let counters = { hardDrops: 0, spinClears: 0, allClearStreakMax: 0 }, allClearStreak = 0;
const reportError = error => { status.textContent = error.message; $('overlayTitle').textContent = 'Unable to continue'; $('overlayCopy').textContent = error.message; overlay.hidden = false; $('continueButton').hidden = true; };
const bridge = connectStackedChild(async (message, send) => {
  if (message.type === 'portal:init') { init = message.payload; settings = structuredClone(init.settings); await boot(); send('game:ready', { runtimeVersion: 'stacked-playable-v1', renderer: 'pixi-webgl', capabilities: [...STACKED_CAPABILITIES] }); }
  else if (message.type === 'portal:audio-frame') renderer?.audio(message.payload.audio, performance.now());
  else if (message.type === 'portal:pause') pause();
  else if (message.type === 'portal:resume') resume();
  else if (message.type === 'portal:exit') dispose();
  else if (message.type === 'portal:settings') { settings = structuredClone(message.payload.settings); syncPreferences(); }
  else if (message.type === 'portal:preferences-status') { status.textContent = message.payload.saved ? 'Preferences saved on this device.' : 'Preferences apply to this run; device storage is unavailable.'; }
  else if (message.type === 'portal:result-status') { $('overlayCopy').textContent = message.payload.message; $('restartButton').disabled = false; }
}, reportError);
function state() {
  if (!run) return;
  const s = run.snapshot;
  bridge.send('game:state', { status: s.terminal ? 'terminal' : run.paused ? 'paused' : started ? 'running' : 'ready', score: s.score, linesCleared: s.lines, level: s.level, survivalTicks: s.tick, paused: run.paused });
}
function syncPreferences() {
  $('motionToggle').checked = settings.accessibility.reduceMotion;
  $('effectsToggle').checked = settings.video.reducedEffects;
  $('reactiveToggle').checked = settings.video.audioReactive;
  $('ghostToggle').checked = settings.video.ghostPiece;
  $('gridToggle').checked = settings.video.gridLines;
  $('soundToggle').checked = settings.audio.sfxEnabled;
}
function pause() {
  if (!run || run.snapshot.terminal || !started || forfeited) return;
  pauseClock.pause(performance.now());
  if (!run.paused) pauseCount++;
  run.pause(); input.clear(); accumulator = 0;
  $('overlayTitle').textContent = 'Paused';
  $('overlayCopy').textContent = init.mode === 'ranked' ? 'Ranked has a shared 15-minute pause allowance. Resume when ready.' : 'Take your time. This Free run stays on this device.';
  $('continueButton').textContent = 'Resume'; $('continueButton').hidden = false; overlay.hidden = false; state();
}
function resume() {
  if (!run || !run.paused || run.snapshot.terminal || forfeited || pauseClock.countingDown || document.hidden) return;
  pauseClock.requestResume(performance.now(), started && init.mode === 'ranked');
  if (started && init.mode === 'ranked') {
    $('continueButton').hidden = true; $('overlayTitle').textContent = '3'; return;
  }
  pauseClock.complete(performance.now());
  started = true; run.resume(); input.clear(); overlay.hidden = true; lastTime = performance.now(); accumulator = 0; state();
}
let soundContext = null;
function sound(frequency, duration = 0.065) {
  if (!settings?.audio.sfxEnabled || settings.audio.sfxVolume <= 0) return;
  try {
    soundContext ??= new (window.AudioContext || window.webkitAudioContext)();
    void soundContext.resume();
    const oscillator = soundContext.createOscillator(), gain = soundContext.createGain(), now = soundContext.currentTime;
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, now); oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.7, now + duration);
    gain.gain.setValueAtTime(settings.audio.sfxVolume * 0.12, now); gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain); gain.connect(soundContext.destination); oscillator.start(now); oscillator.stop(now + duration);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  } catch { /* audio is optional */ }
}
async function finish() {
  if (submitted) return; submitted = true; input.clear(); state();
  const s = run.snapshot;
  $('overlayTitle').textContent = s.terminalReason === 'tick-ceiling' ? 'Ledger complete' : 'Run complete';
  $('overlayCopy').textContent = run.assisted ? 'Assisted Free practice. No profile or leaderboard write.' : 'Verifying your recorded run…';
  $('resultStats').textContent = s.score.toLocaleString() + ' POINTS\n' + s.lines + ' LINES · LEVEL ' + s.level + ' · ' + Math.floor(s.tick / 3600) + ':' + String(Math.floor(s.tick / 60) % 60).padStart(2, '0') + '\n' + s.quadClears + ' HALVINGS · BEST COMBO ' + s.maxCombo;
  $('continueButton').hidden = true; $('restartButton').hidden = false; $('restartButton').textContent = init.mode === 'ranked' ? 'Choose a new Ranked run' : 'Play again';
  $('restartButton').disabled = !run.assisted; overlay.hidden = false; $('restartButton').focus();
  if (run.assisted) return;
  try {
    const evidence = run.evidence();
    const digest = '0x' + [...new Uint8Array(await crypto.subtle.digest('SHA-256', evidence))].map(byte => byte.toString(16).padStart(2, '0')).join('');
    if (disposed) return;
    for (const message of chunkStackedEvidence(evidence, { sessionId: bridge.sessionId })) bridge.send(message.type, message.payload);
    bridge.send('game:result', { v: 'stacked-run-payload-v1', score: s.score, evidenceDigest: digest, totalRawBytes: evidence.length, tuple: run.result, summary: buildStackedRunSummary(s, init.mode, input.device, counters), runStats: { pauseCount, pausedWallClockMs: Math.round(pauseClock.elapsed(performance.now())), sampledTicksPerSecond: 60, qualityTier: 'desktopLow', reducedMotion: settings.accessibility.reduceMotion, droppedInputs: 0, degradationLevel: 0 } });
  } catch (error) { $('overlayCopy').textContent = 'Run could not be submitted: ' + error.message; $('restartButton').disabled = false; }
}
function frame(now) {
  if (disposed) return;
  if (run?.paused && init.mode === 'ranked' && pauseClock.elapsed(now) > 900000) {
    forfeited = true; pauseClock.pause(now); pauseClock.requestResume(now, false); pauseClock.complete(now); run.resume();
    $('overlayTitle').textContent = 'Pause allowance ended'; $('overlayCopy').textContent = 'Controls are forfeited. The real game continues with neutral input until it ends.'; $('continueButton').hidden = true;
  }
  if (pauseClock.countingDown) {
    $('overlayTitle').textContent = String(Math.max(1, Math.ceil(pauseClock.remaining(now) / 1000)));
    if (!document.hidden && pauseClock.complete(now)) { started = true; run.resume(); input.clear(); overlay.hidden = true; lastTime = now; accumulator = 0; state(); }
  }
  const elapsed = lastTime ? Math.min(1000 / 15, Math.max(0, now - lastTime)) : 0; lastTime = now;
  if (run && started && !run.paused && !run.snapshot.terminal) {
    accumulator = Math.min(1000 / 15, accumulator + elapsed);
    let steps = 0;
    while (accumulator >= 1000 / 60 && steps++ < 4 && !run.snapshot.terminal) {
      const before = run.snapshot, mask = forfeited ? 0 : input.sample(before);
      const s = run.step(mask);
      if (s.piecesLocked > before.piecesLocked) {
        if ((mask & 8) && !(before.prevMask & 8) && s.holdsUsed === before.holdsUsed) counters.hardDrops++;
        const cleared = s.lines - before.lines;
        if (s.spinsMini + s.spinsFull > before.spinsMini + before.spinsFull) counters.spinClears += cleared;
        allClearStreak = s.perfectClears > before.perfectClears ? allClearStreak + 1 : 0;
        counters.allClearStreakMax = Math.max(counters.allClearStreakMax, Math.min(1000, allClearStreak));
        sound(cleared === 4 ? 880 : cleared ? 660 : 180, cleared ? 0.18 : 0.04);
      }
      accumulator -= 1000 / 60;
      if (s.tick % 30 === 0) state();
    }
    if (run.snapshot.terminal) void finish();
  }
  if (run && renderer) {
    const info = renderer.frame(run.snapshot, now, settings);
    $('epochLabel').textContent = info.name;
    $('audioLabel').textContent = info.available ? 'REACTING TO ARCADE MUSIC' : settings.video.audioReactive ? 'AMBIENT · PLAY ARCADE MUSIC' : 'AMBIENT VISUALS';
    stage.dataset.simulationTick = String(run.snapshot.tick); stage.dataset.runScore = String(run.snapshot.score);
    stage.dataset.renderedParticles = String(info.particles); stage.dataset.audioAvailable = String(info.available);
  }
  raf = requestAnimationFrame(frame);
}
async function boot() {
  run = createStackedPlaySession({ ...init.session, mode: init.mode, startLevel: settings.startLevel }); run.pause();
  app = new Application();
  await app.init({ resizeTo: stage, backgroundAlpha: 0, resolution: Math.min(1.5, window.devicePixelRatio || 1), antialias: false, autoDensity: true, preference: 'webgl', powerPreference: 'low-power' });
  if (disposed) { app.destroy(true, { children: true }); return; }
  app.ticker.stop(); app.canvas.tabIndex = 0; app.canvas.setAttribute('aria-label', 'Falling block board. Keyboard controls are listed below.');
  stage.prepend(app.canvas);
  renderer = createStackedRenderer({ app, stageElement: stage, geometry: { PIECE_CELLS, cellsFor, collides }, Container, Graphics, Text });
  input = createStackedInput({ target: window, controls: $('touchControls'), settings, onPause: () => run.paused ? resume() : pause(), onUndo: undo });
  $('modeLabel').textContent = init.mode === 'ranked' ? 'RANKED PREVIEW' : 'FREE MODE';
  $('undoButton').hidden = init.mode === 'ranked';
  $('overlayCopy').textContent = 'Clear full rows and keep the stack below the rim. Hold a piece with C; drop with Space. Backgrounds respond to the arcade music. You can reduce motion before starting.';
  $('continueButton').disabled = false; syncPreferences(); stage.dataset.assetsReady = 'true'; state();
  $('continueButton').focus(); raf = requestAnimationFrame(frame);
}
function undo() {
  if (submitted || !run?.undo()) return;
  input.clear(); accumulator = 0; status.textContent = 'Placement undone. Assisted Free practice.'; state();
}
function dispose() {
  if (disposed) return; disposed = true; cancelAnimationFrame(raf); input?.destroy(); renderer?.destroy(); app?.destroy(true, { children: true }); bridge.destroy(); void soundContext?.close(); soundContext = null;
}
$('continueButton').disabled = true;
$('continueButton').addEventListener('click', () => { sound(440); resume(); });
$('pauseButton').addEventListener('click', () => run?.paused ? resume() : pause());
$('undoButton').addEventListener('click', undo);
for (const id of ['exitButton', 'overlayExitButton']) $(id).addEventListener('click', () => bridge.send('game:exit-request', {}));
$('restartButton').addEventListener('click', () => bridge.send('game:restart-request', {}));
for (const id of ['motionToggle', 'effectsToggle', 'reactiveToggle', 'ghostToggle', 'gridToggle', 'soundToggle']) $(id).addEventListener('change', () => {
  if (!settings) return;
  settings.accessibility.reduceMotion = $('motionToggle').checked; settings.video.reducedEffects = $('effectsToggle').checked; settings.video.audioReactive = $('reactiveToggle').checked;
  settings.video.ghostPiece = $('ghostToggle').checked; settings.video.gridLines = $('gridToggle').checked; settings.audio.sfxEnabled = $('soundToggle').checked;
  bridge.send('game:preferences-request', { reduceMotion: settings.accessibility.reduceMotion, reducedEffects: settings.video.reducedEffects, audioReactive: settings.video.audioReactive, ghostPiece: settings.video.ghostPiece, gridLines: settings.video.gridLines, sfxEnabled: settings.audio.sfxEnabled });
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('blur', pause);
window.addEventListener('pagehide', dispose, { once: true });

import { Application, Container, Graphics, Text } from 'pixi.js';
import { PIECE_CELLS, cellsFor, collides } from '../../portal/src/stacked-sim.mjs';
import { createStackedPlaySession } from './play-session.mjs';
import { createStackedInput } from './input.mjs';
import { connectStackedChild } from './child-bridge.mjs';
import { buildStackedRunSummary } from './run-summary.mjs';
import { buildShareLinks, buildStackedShareText, createShareRow, shareUrlFor } from '../../portal/src/share-links.mjs';
import { chunkStackedEvidence } from '../../portal/src/stacked-evidence-transport.mjs';
import { STACKED_CAPABILITIES } from '../../portal/src/stacked-contracts.mjs';
import { createStackedPauseClock } from './pause-clock.mjs';
import { manageOverlayFocus } from './overlay-focus.mjs';
import { createStackedSoundEffects, stackedSoundForStep } from './sound-effects.mjs';
import { createVisualizerPreview } from './render/visualizer-preview.mjs';

const $ = id => document.getElementById(id);
const stage = $('stackedStage'), status = $('stackedStatus'), overlay = $('gameOverlay');
const releaseOverlayFocus = manageOverlayFocus(overlay, () => stage.querySelector('canvas'));
let app, renderer, run, input, init, settings, raf = 0, disposed = false, lastTime = 0, accumulator = 0, started = false, submitted = false, pauseCount = 0, forfeited = false;
const pauseClock = createStackedPauseClock();
const sfx = createStackedSoundEffects();
const preview = createVisualizerPreview($('visualizerPreview'));
let lastFeedback = '';
let counters = { hardDrops: 0, spinClears: 0, allClearStreakMax: 0 }, allClearStreak = 0;
const reportError = error => { status.textContent = error.message; $('overlayTitle').textContent = 'Unable to continue'; $('overlayCopy').textContent = error.message; overlay.hidden = false; $('continueButton').hidden = true; };
const bridge = connectStackedChild(async (message, send) => {
  if (message.type === 'portal:init') { init = message.payload; settings = structuredClone(init.settings); await boot(); if (!disposed) send('game:ready', { runtimeVersion: 'stacked-playable-v1', renderer: 'pixi-webgl', capabilities: [...STACKED_CAPABILITIES] }); }
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
  $('pieceMarksToggle').checked = settings.accessibility.colorblindPieces;
  $('flashToggle').checked = settings.accessibility.reduceFlash;
  $('leftHandToggle').checked = settings.controls.touchLeftHanded;
  $('touchControls').dataset.leftHanded=String(settings.controls.touchLeftHanded);
  $('visualizerSelect').value = settings.video.visualizer ?? 'journey';
  $('intensityRange').value = String(Math.round((settings.video.effectsIntensity ?? .7) * 100));
  $('volumeRange').value = String(Math.round(settings.audio.sfxVolume * 100));
  $('intensityValue').textContent = $('intensityRange').value + '%';
  $('volumeValue').textContent = $('volumeRange').value + '%';
  $('visualizerHint').textContent = {journey:'Follow the six zones. Every clear reshapes your world.',living:'Nine ocean creatures swim to your music, scatter on clears, then take a new form.',aurora:'Bass moves the curtains. Clears send a wave through the light.',orbit:'Beats expand the orbits. Combos widen the constellation.',spectrum:'Low and high notes shape the towers. Drops and clears push them outward.'}[$('visualizerSelect').value];
  if (!settings.audio.sfxEnabled) sfx.stop();
}
function pause() {
  if (!run || run.snapshot.terminal || !started || forfeited) return;
  pauseClock.pause(performance.now());
  if (!run.paused) pauseCount++;
  run.pause(); input.clear(); sfx.stop(); accumulator = 0;
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
// X / Facebook / Discord copy and native share for the finished run (owner
// direction 2026-09-16). Presentation only; nothing here touches the result.
let shareRow = null;
function renderShareRow(s) {
  const mount = $('shareRow');
  if (!mount) return;
  const links = buildShareLinks({
    text: buildStackedShareText({ score: s.score, lines: s.lines, level: s.level, tick: s.tick, quadClears: s.quadClears, maxCombo: s.maxCombo, ranked: init.mode === 'ranked', assisted: run.assisted }),
    url: shareUrlFor('stacked'),
    hashtags: ['LestersArcade', 'STACKED'],
  });
  if (shareRow) { shareRow.refresh(links); mount.hidden = false; return; }
  shareRow = createShareRow({ documentRef: document, title: 'STACKED', links, className: 'share-row', buttonClassName: 'share-button', onStatus: (message) => { $('overlayCopy').textContent = message; } });
  mount.replaceChildren(shareRow); mount.hidden = false;
}
async function finish() {
  if (submitted) return; submitted = true; input.clear(); state();
  const s = run.snapshot;
  $('overlayTitle').textContent = s.terminalReason === 'tick-ceiling' ? 'Ledger complete' : 'Run complete';
  $('preferencePanel').open = false;
  $('overlayCopy').textContent = run.assisted ? 'Assisted Free practice. No profile or leaderboard write.' : 'Verifying your recorded run…';
  $('resultScore').textContent = s.score.toLocaleString();
  for (const [id, value] of [['statLines', s.lines], ['statLevel', s.level], ['statTime', Math.floor(s.tick / 3600) + ':' + String(Math.floor(s.tick / 60) % 60).padStart(2, '0')], ['statHalvings', s.quadClears], ['statCombo', s.maxCombo]]) $(id).textContent = String(value);
  $('resultStats').hidden = false;
  $('resultCause').textContent = {'block-out':'The next piece had no room to enter. Try keeping the center of the stack low.','lock-out':'A piece locked above the rim. Use your landing guide and hold to make space.','garbage-out':'The rising ledger pushed the stack over the rim. Clear lower rows to leave room.','tick-ceiling':'You reached the end of the ledger.'}[s.terminalReason] ?? 'The stack reached the top. Clear space early and keep a landing route open.';
  $('continueButton').hidden = true; $('restartButton').hidden = false; $('restartButton').textContent = init.mode === 'ranked' ? 'Choose a new Ranked run' : 'Play again';
  $('restartButton').disabled = !run.assisted; overlay.hidden = false; $('restartButton').focus();
  renderShareRow(s);
  if (init.mode === 'free') {
    $('freeMedalShelf').hidden = false;
    $('freeMedalSummary').textContent = run.assisted ? 'Assisted practice does not earn medals.' : 'Opening your practice shelf…';
    if (!run.assisted) {
      try {
        const { completeFreeMedals, FREE_MEDALS, describeFreeMedal } = await import('./free-medals.mjs');
        if (disposed) return;
        const shelf = completeFreeMedals(window.localStorage, { mode: init.mode, sessionId: bridge.sessionId, snapshot: s, spinClears: counters.spinClears });
        $('freeMedalSummary').textContent = shelf.saved ? `${shelf.total} / 16 medals · ${shelf.runs} completed ${shelf.runs === 1 ? 'run' : 'runs'} on this device.` : 'Device storage is unavailable. This run’s medals could not be saved.';
        if (shelf.saved && shelf.bestScore !== null) $('practiceBest').textContent = shelf.previousBest === null ? `First recorded practice best: ${shelf.bestScore.toLocaleString()}` : s.score > shelf.previousBest ? `New practice best! +${(s.score-shelf.previousBest).toLocaleString()} points` : `Practice best: ${shelf.bestScore.toLocaleString()} · ${Math.max(0,shelf.bestScore-s.score).toLocaleString()} points to match it`;
        for (const medal of shelf.saved ? FREE_MEDALS : []) {
          const item = document.createElement('li');
          const earned = shelf.medals.includes(medal), title = document.createElement('strong'), description = document.createElement('span');
          item.dataset.earned = String(earned);
          title.textContent = (shelf.newMedals.includes(medal) ? 'NEW · ' : earned ? 'EARNED · ' : '') + medal.title;
          description.textContent = describeFreeMedal(medal) + (earned ? shelf.earnedAt[medal.id] ? ' Earned '+new Date(shelf.earnedAt[medal.id]).toLocaleDateString()+'.' : ' Earned earlier; date unknown.' : ` Best recorded: ${medal.field === 'tick' ? Math.floor(shelf.progress[medal.id]/60)+' / '+Math.floor(medal.threshold/60)+' sec' : shelf.progress[medal.id]+' / '+medal.threshold}.`);
          item.append(title, description);
          $('freeMedalList').append(item);
        }
      } catch { $('freeMedalSummary').textContent = 'Your practice shelf is unavailable. You can still play again.'; }
    }
  }
  if (run.assisted) return;
  try {
    const evidence = run.evidence();
    const digest = '0x' + [...new Uint8Array(await crypto.subtle.digest('SHA-256', evidence))].map(byte => byte.toString(16).padStart(2, '0')).join('');
    if (disposed) return;
    for (const message of chunkStackedEvidence(evidence, { sessionId: bridge.sessionId })) bridge.send(message.type, message.payload);
    bridge.send('game:result', { v: 'stacked-run-payload-v1', score: s.score, evidenceDigest: digest, totalRawBytes: evidence.length, tuple: run.result, summary: buildStackedRunSummary(s, init.mode, input.device, counters), runStats: { pauseCount, pausedWallClockMs: Math.round(pauseClock.elapsed(performance.now())), sampledTicksPerSecond: 60, qualityTier: renderer.mobile ? 'mobile' : 'desktopLow', reducedMotion: settings.accessibility.reduceMotion, droppedInputs: 0, degradationLevel: 0 } });
  } catch (error) { $('overlayCopy').textContent = 'Run could not be submitted: ' + error.message; $('restartButton').disabled = false; }
}
function frame(now) {
  if (disposed) return;
  input?.poll();
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
      renderer.gameplay(before, s, now, settings);
      sfx.play(stackedSoundForStep(before, s), settings);
      if (s.piecesLocked > before.piecesLocked) {
        if ((mask & 8) && !(before.prevMask & 8) && s.holdsUsed === before.holdsUsed) counters.hardDrops++;
        const cleared = s.lines - before.lines;
        if (s.spinsMini + s.spinsFull > before.spinsMini + before.spinsFull) counters.spinClears += cleared;
        allClearStreak = s.perfectClears > before.perfectClears ? allClearStreak + 1 : 0;
        counters.allClearStreakMax = Math.max(counters.allClearStreakMax, Math.min(1000, allClearStreak));
      }
      accumulator -= 1000 / 60;
      if (s.tick % 30 === 0) state();
    }
    if (run.snapshot.terminal) void finish();
  }
  if (run && renderer) {
    const info = renderer.frame(run.snapshot, now, settings);
    if ($('epochLabel').textContent !== info.name) $('epochLabel').textContent = info.name;
    const audioCopy = info.visualizerName.toUpperCase() + ' · ' + (settings.accessibility.reduceMotion ? 'STILL' : info.available ? 'LIVE MUSIC' : 'AMBIENT');
    if ($('audioLabel').textContent !== audioCopy) $('audioLabel').textContent = audioCopy;
    if (!overlay.hidden && $('preferencePanel').open) preview.draw(now, settings, info);
    if (stage.dataset.feedback && stage.dataset.feedback !== lastFeedback) { lastFeedback = stage.dataset.feedback; status.textContent = lastFeedback; }
    if (!stage.dataset.feedback) lastFeedback = '';
    stage.dataset.simulationTick = String(run.snapshot.tick); stage.dataset.runScore = String(run.snapshot.score);
    stage.dataset.renderedParticles = String(info.particles); stage.dataset.audioAvailable = String(info.available);
  }
  raf = requestAnimationFrame(frame);
}
async function boot() {
  const { createStackedRenderer } = await import('./render/renderer.mjs');
  if (disposed) return;
  run = createStackedPlaySession({ ...init.session, mode: init.mode, startLevel: settings.startLevel }); run.pause();
  app = new Application();
  await app.init({ resizeTo: stage, backgroundAlpha: 0, resolution: Math.min(1.5, window.devicePixelRatio || 1), antialias: false, autoDensity: true, preference: 'webgl', powerPreference: 'low-power' });
  if (disposed) { app.destroy(true, { children: true }); return; }
  app.ticker.stop(); app.canvas.tabIndex = 0; app.canvas.setAttribute('aria-label', 'Falling block board. Keyboard controls are listed below.');
  stage.prepend(app.canvas);
  renderer = createStackedRenderer({ app, stageElement: stage, geometry: { PIECE_CELLS, cellsFor, collides }, Container, Graphics, Text });
  input = createStackedInput({ target: window, controls: $('touchControls'), settings, onPause: () => run.paused ? resume() : pause(), onUndo: undo, isMenuOpen: () => !overlay.hidden, onMenuAction: menuAction });
  $('modeLabel').textContent = init.mode === 'ranked' ? 'RANKED PREVIEW' : 'FREE MODE';
  $('undoButton').hidden = init.mode === 'ranked';
  $('overlayCopy').textContent = 'Fill a row to clear it. The ledger rises from below, so leave room at the top. Clear four rows together for a HALVING. ' + (renderer.mobile ? 'Use the arrow and rotation buttons below. HOLD saves a piece; DROP places it at the landing guide.' : 'Move with ← →, rotate with ↑ / X, and drop with Space. C holds a piece; Z rotates back. Choose your music world below or start right away.');
  $('continueButton').disabled = false; syncPreferences(); stage.dataset.assetsReady = 'true'; state();
  $('continueButton').focus(); raf = requestAnimationFrame(frame);
}
function undo() {
  if (submitted || !run?.undo()) return;
  input.clear(); renderer.resetEffects(); accumulator = 0; status.textContent = 'Placement undone. Assisted Free practice.'; state();
}
function menuAction(action) {
  if (overlay.hidden) return;
  const controls = [...overlay.querySelectorAll('button:not(:disabled),input,select,summary')].filter(node=>!node.hidden&&node.getClientRects().length);
  const active = document.activeElement, index = Math.max(0, controls.indexOf(active));
  if (action === 'next' || action === 'previous') controls[(index + (action === 'next' ? 1 : controls.length - 1)) % controls.length]?.focus();
  else if (action === 'activate') { if (active?.matches('button,input[type=checkbox],summary')) active.click(); }
  else if (action === 'increase' || action === 'decrease') {
    const direction = action === 'increase' ? 1 : -1;
    if (active?.matches('select')) { active.selectedIndex = Math.max(0,Math.min(active.options.length-1,active.selectedIndex+direction)); active.dispatchEvent(new Event('change')); }
    if (active?.matches('input[type=range]')) { active.value = String(Math.max(Number(active.min),Math.min(Number(active.max),Number(active.value)+direction*Number(active.step||1)))); active.dispatchEvent(new Event('change')); }
  }
}
function dispose() {
  if (disposed) return; disposed = true; releaseOverlayFocus(); cancelAnimationFrame(raf); input?.destroy(); renderer?.destroy(); app?.destroy(true, { children: true }); bridge.destroy(); sfx.destroy();
}
$('continueButton').disabled = true;
$('continueButton').addEventListener('click', () => { sfx.play('menu', settings); resume(); });
$('pauseButton').addEventListener('click', () => run?.paused ? resume() : pause());
$('undoButton').addEventListener('click', undo);
for (const id of ['exitButton', 'overlayExitButton']) $(id).addEventListener('click', () => bridge.send('game:exit-request', {}));
$('restartButton').addEventListener('click', () => bridge.send('game:restart-request', {}));
function updatePreferences() {
  if (!settings) return;
  settings.accessibility.reduceMotion = $('motionToggle').checked; settings.video.reducedEffects = $('effectsToggle').checked; settings.video.audioReactive = $('reactiveToggle').checked;
  settings.video.ghostPiece = $('ghostToggle').checked; settings.video.gridLines = $('gridToggle').checked; settings.audio.sfxEnabled = $('soundToggle').checked;
  settings.video.visualizer = $('visualizerSelect').value; settings.video.effectsIntensity = Number($('intensityRange').value) / 100;
  settings.audio.sfxVolume = Number($('volumeRange').value) / 100; settings.accessibility.colorblindPieces = $('pieceMarksToggle').checked;
  settings.accessibility.reduceFlash=$('flashToggle').checked; settings.controls.touchLeftHanded=$('leftHandToggle').checked;
  syncPreferences();
  bridge.send('game:preferences-request', { reduceMotion: settings.accessibility.reduceMotion, reducedEffects: settings.video.reducedEffects, audioReactive: settings.video.audioReactive, ghostPiece: settings.video.ghostPiece, gridLines: settings.video.gridLines, sfxEnabled: settings.audio.sfxEnabled, visualizer:settings.video.visualizer, effectsIntensity:settings.video.effectsIntensity, sfxVolume:settings.audio.sfxVolume, colorblindPieces:settings.accessibility.colorblindPieces, reduceFlash:settings.accessibility.reduceFlash, touchLeftHanded:settings.controls.touchLeftHanded });
}
for (const id of ['motionToggle', 'effectsToggle', 'reactiveToggle', 'ghostToggle', 'gridToggle', 'soundToggle', 'visualizerSelect', 'pieceMarksToggle', 'flashToggle', 'leftHandToggle', 'intensityRange', 'volumeRange']) $(id).addEventListener('change', updatePreferences);
for (const [id, output] of [['intensityRange','intensityValue'],['volumeRange','volumeValue']]) $(id).addEventListener('input', () => { $(output).textContent = $(id).value + '%'; });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('blur', pause);
window.addEventListener('pagehide', dispose, { once: true });

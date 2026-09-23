import { exportChikunReplay, importChikunReplay, REPLAY_FILE_LIMIT } from './replay-file.mjs';
import { chikunAchievements } from '../../portal/src/chikun-profile.mjs';
import { loadGroundArt, drawGround, drawGroundObstacle } from './ground-world.mjs';
import { loadRagdollArt, createChikunRagdoll, drawChikunRagdoll } from './ragdoll.mjs';
import { createChikunCharacter, CHIKUN_FLOURISHES, milestoneFlourish } from './character.mjs';
import { createChikunWorld, drawChikunObstacle } from './world.mjs';
import { createChikunAudio } from './audio.mjs';
import { buildChikunViewport, upcomingChikunObstacle } from './viewport.mjs';
import {
  CHIKUN_FIXED_STEP_HZ,
  buildChikunReplayClaim,
  createChikunRuntime,
} from '../../portal/src/chikun-cabinet.mjs';
import {
  CHIKUN_BRIDGE_PROTOCOL,
  createChikunBridgeEnvelope,
  validateChikunConnectMessage,
  validateChikunParentMessage,
  validateChikunChildMessage,
} from '../../portal/src/chikun-bridge-protocol.mjs';
import { MAX_CHIKUN_PARTICLES, planChikunVfx } from './vfx.mjs';
import { buildChikunReplayTimeline, buildChikunShareText, buildChikunModeTease } from './presentation.mjs';
import { buildShareLinks, createShareRow, shareUrlFor } from '../../portal/src/share-links.mjs';
import { createChikunReplayPlayback, replayPlayheadRatio } from './replay-viewer.mjs';
import {
  chikunDailyChallengeForSeed,
  compareChikunGhost,
  createChikunGhostRecord,
  readChikunGhostRecord,
  writeChikunGhostRecord,
} from '../../portal/src/chikun-daily-challenge.mjs';

const canvas = document.querySelector('#chikunCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const shell = document.querySelector('#gameShell');
let flightViewport = buildChikunViewport(1280, 720);
function resizeFlightViewport() {
  const rect = canvas.getBoundingClientRect();
  flightViewport = buildChikunViewport(rect.width, rect.height, window.devicePixelRatio || 1);
  if (canvas.width !== flightViewport.pixelWidth) canvas.width = flightViewport.pixelWidth;
  if (canvas.height !== flightViewport.pixelHeight) canvas.height = flightViewport.pixelHeight;
  shell.dataset.orientation = flightViewport.portrait ? 'portrait' : 'landscape';
}
const flightResizeObserver = new ResizeObserver(resizeFlightViewport);
flightResizeObserver.observe(document.querySelector('#gameFrame'));
window.addEventListener('resize', resizeFlightViewport);
resizeFlightViewport();
const scoreValue = document.querySelector('#scoreValue');
const coinValue = document.querySelector('#coinValue');
const forkValue = document.querySelector('#forkValue');
const comboValue = document.querySelector('#comboValue');
const nearMissValue = document.querySelector('#nearMissValue');
const eventCallout = document.querySelector('#eventCallout');
const startOverlay = document.querySelector('#startOverlay');
const pauseOverlay = document.querySelector('#pauseOverlay');
const resultOverlay = document.querySelector('#resultOverlay');
const startButton = document.querySelector('#startButton');
const pauseButton = document.querySelector('#pauseButton');
const resumeButton = document.querySelector('#resumeButton');
const pauseExitButton = document.querySelector('#pauseExitButton');
const pauseMuteButton = document.querySelector('#pauseMuteButton');
const pauseFullscreenButton = document.querySelector('#pauseFullscreenButton');
const muteButton = document.querySelector('#muteButton');
const fullscreenButton = document.querySelector('#fullscreenButton');
const exitButton = document.querySelector('#exitButton');
const restartButton = document.querySelector('#restartButton');
const resultExitButton = document.querySelector('#resultExitButton');
const modeLabel = document.querySelector('#modeLabel');
const modeCopy = document.querySelector('#modeCopy');
const resultEyebrow = document.querySelector('#resultEyebrow');
const resultScore = document.querySelector('#resultScore');
const resultCopy = document.querySelector('#resultCopy');
const resultStats = document.querySelector('#resultStats');
const replayTimeline = document.querySelector('#replayTimeline');
const replayTime = document.querySelector('#replayTime');
const replaySpeed = document.querySelector('#replaySpeed');
const watchReplayButton = document.querySelector('#watchReplayButton');
const shareRunButton = document.querySelector('#shareRunButton');
const liveStatus = document.querySelector('#liveStatus');
const modeTease = document.querySelector('#modeTease');

const STEP_MS = 1000 / CHIKUN_FIXED_STEP_HZ;
const MAX_CATCH_UP_STEPS = 4;
const MAX_AUDIO_VOICES = 8;
const MAX_RUN_TICKS = CHIKUN_FIXED_STEP_HZ * 60 * 60;
const coastSprite = new Image();
const fallSprite = new Image();
coastSprite.src = '/assets/generated/chikun-game/chikun-coast.webp';
fallSprite.src = '/assets/generated/chikun-game/chikun-fall.webp';
Promise.allSettled([coastSprite.decode?.(), fallSprite.decode?.()]);

const assetStatus = document.querySelector('#assetStatus');
let assetsFinished = false;
function syncAssetStatus() {
  if (disposed) return;
  const usable = flightCharacter.renderable;
  startButton.disabled = !usable && !assetsFinished;
  startButton.textContent = usable ? 'Start Running' : assetsFinished ? 'Retry character download' : 'Loading Chikun…';
  assetStatus.textContent = flightCharacter.complete ? '' : assetsFinished
    ? usable ? 'Some animations are unavailable. You can still fly.' : 'Chikun could not load. Check your connection and retry.'
    : `Loading animations · ${flightCharacter.loaded}/31`;
  assetStatus.hidden = flightCharacter.complete;
}
const flightCharacter = createChikunCharacter({onProgress:syncAssetStatus});
startButton.disabled = true;
startButton.textContent = 'Loading Chikun…';
flightCharacter.ready.then(() => { assetsFinished = true; syncAssetStatus(); });
const flightWorld = createChikunWorld();
const flightAudio = createChikunAudio();
let renderDt = 0;
let idleTime = 0;
let terminalAge = 0;
let ragdoll = null;
const RAGDOLL_HANDOFF_SECONDS = 0.22;
let goreEnabled = true;
try { goreEnabled = localStorage.getItem('chikun-gore-v1') !== 'off'; } catch {}
loadGroundArt(); loadRagdollArt();
const speedValue = document.querySelector('#speedValue');
const routeReadout = document.querySelector('#routeReadout');
const goreButton = document.querySelector('#goreButton');
let flapAge = Infinity;
let flapVelocity = 0;
let flightEvent = '';
let flightEventAge = Infinity;
function animateFlight(event) {
  if (CHIKUN_FLOURISHES.includes(flightEvent) && flightEventAge < .8) return;
  flightEvent = event; flightEventAge = 0;
}

let port = null;
let sessionId = '';
let messageSequence = 0;
let initPayload = null;
let mode = 'free';
let runtime = null;
let phase = 'waiting';
let paused = false;
let muted = false;
let flapQueued = false;
let accumulator = 0;
let previousFrameAt = 0;
let latestSnapshot = null;
let lastStateTick = -1;
let audioContext = null;
const activeAudioVoices = new Set();
let disposed = false;
let calloutTimer = null;
let previousCoins = 0;
let previousForks = 0;
let previousNearMisses = 0;
let previousDifficultyLevel = 1;
let activeParticles = [];
let activeShake = null;
let activeFlash = null;
let crashVfxPlayed = false;
let lastCompletedResult = null;
let vfxFrame = 0;
let dailyChallenge = null;
let ghostTrack = null;
let replayPlayback = null;
let replayPlaying = false;

function setLive(message) {
  liveStatus.textContent = message;
}

function reduceMotion() {
  return initPayload?.settings.reduceMotion === true || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

function showCallout(message) {
  eventCallout.textContent = message;
  eventCallout.classList.add('is-visible');
  if (calloutTimer !== null) clearTimeout(calloutTimer);
  calloutTimer = setTimeout(() => eventCallout.classList.remove('is-visible'), reduceMotion() ? 500 : 900);
}

function spawnVfx(event, x = latestSnapshot?.chikun?.x ?? 280, y = latestSnapshot?.chikun?.y ?? 360) {
  const plan = planChikunVfx({ event, x, y, tick: latestSnapshot?.tick ?? 0, reduceMotion: reduceMotion() });
  const particles = plan.particles.map((particle) => ({ ...particle, bornFrame: vfxFrame }));
  activeParticles = [...activeParticles, ...particles].slice(-MAX_CHIKUN_PARTICLES);
  activeShake = plan.shake > 0 ? { amount: plan.shake, bornFrame: vfxFrame, lifeTicks: plan.lifeTicks } : null;
  activeFlash = plan.flash > 0 ? { alpha: plan.flash, bornFrame: vfxFrame, lifeTicks: Math.min(18, plan.lifeTicks) } : null;
}

function renderReplayTimeline(evidence) {
  const timeline = buildChikunReplayTimeline(evidence, 24);
  replayTimeline.replaceChildren();
  for (const count of timeline.bins) {
    const bar = document.createElement('span');
    bar.style.height = `${Math.max(8, timeline.peak ? (count / timeline.peak) * 100 : 8)}%`;
    bar.title = `${count} flap${count === 1 ? '' : 's'}`;
    replayTimeline.append(bar);
  }
  const playhead = document.createElement('i');
  playhead.className = 'replay-playhead';
  playhead.setAttribute('aria-hidden', 'true');
  replayTimeline.append(playhead);
  replayTimeline.setAttribute('aria-label', `${timeline.totalFlaps} flaps across this run. Click to scrub the replay.`);
  updateReplayPlayhead();
}

function replayPlayheadEl() {
  return replayTimeline.querySelector('.replay-playhead');
}

function updateReplayPlayhead() {
  const duration = replayPlayback?.durationTicks ?? lastCompletedResult?.survivalTicks ?? 1;
  const tick = replayPlayback?.tick ?? duration;
  const ratio = replayPlayheadRatio(tick, duration);
  const playhead = replayPlayheadEl();
  if (playhead) playhead.style.left = `${ratio * 100}%`;
  replayTimeline.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
  const timeLabel = `${(tick / 60).toFixed(1)} / ${(duration / 60).toFixed(1)} s`;
  replayTime.textContent = timeLabel;
  replayTimeline.setAttribute('aria-valuetext', `${(tick / 60).toFixed(1)} seconds of ${(duration / 60).toFixed(1)}`);
}

function stopReplayViewer() {
  replayPlaying = false;
  replayPlayback = null;
  resultOverlay.classList.remove('is-replaying');
  if (watchReplayButton) watchReplayButton.textContent = 'Watch Replay';
}

function startReplayViewer() {
  if (!lastCompletedResult?.evidence || !watchReplayButton) return;
  replayPlayback = createChikunReplayPlayback(lastCompletedResult.evidence);
  resultOverlay.classList.add('is-replaying');
  if (reduceMotion()) {
    replayPlaying = false;
    latestSnapshot = replayPlayback.seek(replayPlayback.durationTicks);
    watchReplayButton.textContent = 'Play Replay';
    setLive('Replay parked on the final frame. Play Replay to watch, or scrub the timeline.');
  } else {
    replayPlaying = true;
    latestSnapshot = replayPlayback.seek(0);
    flapAge = Infinity; flightEventAge = Infinity; terminalAge = 0;
    watchReplayButton.textContent = 'Pause Replay';
    setLive('Watching canonical replay. Score is already final.');
  }
  accumulator = 0;
  previousFrameAt = performance.now();
  updateReplayPlayhead();
}

function toggleReplayViewer() {
  if (phase !== 'game-over' || !lastCompletedResult) return;
  if (!replayPlayback) {
    startReplayViewer();
    return;
  }
  if (replayPlayback.terminal && !replayPlaying) {
    latestSnapshot = replayPlayback.seek(0);
    flapAge = Infinity; flightEventAge = Infinity; terminalAge = 0;
    replayPlaying = !reduceMotion();
    watchReplayButton.textContent = replayPlaying ? 'Pause Replay' : 'Play Replay';
    updateReplayPlayhead();
    return;
  }
  replayPlaying = !replayPlaying;
  watchReplayButton.textContent = replayPlaying ? 'Pause Replay' : 'Play Replay';
}

function seekReplayFromEvent(event) {
  if (phase !== 'game-over' || !lastCompletedResult) return;
  if (!replayPlayback) startReplayViewer();
  if (!replayPlayback) return;
  const rect = replayTimeline.getBoundingClientRect();
  const ratio = rect.width > 0 ? Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) : 0;
  latestSnapshot = replayPlayback.seek(Math.round(ratio * replayPlayback.durationTicks));
  replayPlaying = false;
  watchReplayButton.textContent = replayPlayback.terminal ? 'Replay Again' : 'Play Replay';
  updateReplayPlayhead();
  setLive('Replay scrubbed. Score is unchanged.');
}

function send(type, payload) {
  if (!port || !sessionId || disposed) return null;
  const message = createChikunBridgeEnvelope({
    type,
    sessionId,
    messageId: `game-${++messageSequence}`,
    payload,
  });
  const validation = validateChikunChildMessage(message);
  if (!validation.ok) throw new Error(validation.error);
  port.postMessage(message);
  return message;
}

function sendState(status = phase === 'running' ? 'running' : phase === 'game-over' ? 'game-over' : paused ? 'paused' : 'ready') {
  const snapshot = latestSnapshot;
  send('game:state', {
    status,
    score: Math.max(0, Math.round(snapshot?.score ?? 0)),
    coinsCollected: Math.max(0, Math.round(snapshot?.coinsCollected ?? 0)),
    forksPassed: Math.max(0, Math.round(snapshot?.forksPassed ?? 0)),
    nearMisses: Math.max(0, Math.round(snapshot?.nearMisses ?? 0)),
    bestCombo: Math.max(0, Math.round(snapshot?.bestCombo ?? 0)),
    difficultyLevel: Math.max(1, Math.round(snapshot?.difficulty?.level ?? 1)),
    survivalTicks: Math.max(0, Math.round(snapshot?.tick ?? 0)),
    paused,
  });
}

function tone(frequency, duration = 0.08, gainValue = 0.035, type = 'triangle') {
  if (muted) return;
  const cue = ({420:'launch',96:'impact',560:'flap',880:'coin',1040:'near',660:'pass'})[frequency];
  if (cue && flightAudio.play(cue)) return;
  try {
    if (activeAudioVoices.size >= MAX_AUDIO_VOICES) return;
    const AudioContextCtor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!AudioContextCtor) return;
    audioContext ??= new AudioContextCtor();
    if (audioContext.state === 'suspended') audioContext.resume?.();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const voice = { oscillator, gain };
    oscillator.addEventListener('ended', () => {
      activeAudioVoices.delete(voice);
      try { oscillator.disconnect(); gain.disconnect(); } catch { /* already released */ }
    }, { once: true });
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(gainValue, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    // Counted only once the node is actually running: a throw before this point
    // would otherwise strand the voice in the set and silence audio at the cap.
    activeAudioVoices.add(voice);
    oscillator.stop(audioContext.currentTime + duration);
  } catch { /* audio is optional */ }
}

function loadGhostForSeed(seed) {
  try {
    const record = readChikunGhostRecord(globalThis.localStorage, seed);
    ghostTrack = record?.samples?.length ? record : null;
  } catch {
    ghostTrack = null;
  }
}

function setModePresentation() {
  const ranked = mode === 'ranked';
  dailyChallenge = ranked ? null : chikunDailyChallengeForSeed(initPayload?.session?.seed);
  shell.dataset.mode = mode;
  modeLabel.textContent = ranked
    ? 'Ranked Preview · Device Local'
    : dailyChallenge
      ? `${dailyChallenge.label} · Shared Course`
      : 'Free Mode · Practice Flight';
  modeCopy.textContent = ranked
    ? 'Collect Litecoin and skim the edges for bonuses. Lester’s Arcade verifies your replay for this device’s profile and local Ranked boards.'
    : dailyChallenge
      ? `The ${dailyChallenge.dayKey} course resets at 00:00 UTC. Collect Litecoin and beat your best on this device. This flight keeps its course through reset.`
      : 'Collect Litecoin and skim the edges for bonuses. Practice scores stay separate from your Ranked profile.';
  loadGhostForSeed(initPayload?.session?.seed);
  renderModeTease();
}

// Start-screen teases only; nothing here reaches the gameplay HUD.
function renderModeTease() {
  if (!modeTease) return;
  const tease = buildChikunModeTease(mode);
  modeTease.replaceChildren();
  for (const [title, detail] of [[tease.daily, tease.dailyDetail], [tease.rewards, tease.rewardsDetail]]) {
    if (!title) continue;
    const item = document.createElement('li');
    item.append(title);
    if (detail) { const copy = document.createElement('span'); copy.textContent = detail; item.append(copy); }
    modeTease.append(item);
  }
}

function syncAudioControl() {
  const disabled = muted;
  flightAudio.setEnabled(!disabled);
  muteButton.disabled = false;
  muteButton.textContent = disabled ? '×' : '♪';
  muteButton.setAttribute('aria-pressed', String(disabled));
  muteButton.setAttribute('aria-label', muted ? 'Unmute flight sounds' : 'Mute flight sounds');
  pauseMuteButton.disabled = false;
  pauseMuteButton.textContent = muted ? 'SFX On' : 'SFX Off';
  pauseMuteButton.setAttribute('aria-pressed', String(disabled));
  pauseMuteButton.setAttribute('aria-label', muted ? 'Unmute flight sounds' : 'Mute flight sounds');
}

function syncFullscreenControl() {
  const supported = Boolean(document.fullscreenEnabled && document.documentElement.requestFullscreen);
  fullscreenButton.hidden = !supported;
  fullscreenButton.disabled = !supported;
  fullscreenButton.setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen');
  pauseFullscreenButton.hidden = !supported;
  pauseFullscreenButton.disabled = !supported;
  pauseFullscreenButton.textContent = document.fullscreenElement ? 'Windowed' : 'Fullscreen';
  pauseFullscreenButton.setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen');
}

function toggleMute() {
  muted = !muted;
  syncAudioControl();
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.();
}

function prepareRun() {
  ragdoll?.dispose(); ragdoll = null;
  terminalAge = 0; flapAge = Infinity; flightEventAge = Infinity; flightEvent = '';
  runtime = createChikunRuntime({ seed: initPayload.session.seed, maxTicks: MAX_RUN_TICKS });
  latestSnapshot = runtime.snapshot();
  updateHud();
  draw(latestSnapshot);
}

function startRun() {
  if (!initPayload || disposed) return;
  if (!flightCharacter.renderable) {
    if (assetsFinished) {
      assetsFinished = false; syncAssetStatus();
      flightCharacter.retry().then(() => { assetsFinished = true; syncAssetStatus(); });
    }
    return;
  }
  stopReplayViewer();
  prepareRun();
  frameFailureReported = false;
  phase = 'running';
  paused = false;
  flapQueued = false;
  accumulator = 0;
  previousFrameAt = performance.now();
  lastStateTick = -1;
  previousCoins = 0;
  previousForks = 0;
  previousNearMisses = 0;
  previousDifficultyLevel = 1;
  activeParticles = [];
  activeShake = null;
  activeFlash = null;
  crashVfxPlayed = false;
  lastCompletedResult = null;
  startOverlay.classList.add('is-hidden');
  pauseOverlay.classList.add('is-hidden');
  resultOverlay.classList.add('is-hidden');
  canvas.focus();
  const flightLabel = mode === 'ranked' ? 'Ranked' : dailyChallenge ? dailyChallenge.label : 'Free';
  setLive(`${flightLabel} flight started. Tap to jump, tap again to fly. Descend to land and run.`);
  flightAudio.unlock().then(() => { if (!disposed && phase === 'running') flightAudio.play('launch'); });
  sendState('running');
}

function updateHud() {
  scoreValue.textContent = String(latestSnapshot?.score ?? 0);
  coinValue.textContent = String(latestSnapshot?.coinsCollected ?? 0);
  forkValue.textContent = String(latestSnapshot?.forksPassed ?? 0);
  comboValue.textContent = String(latestSnapshot?.combo ?? 0);
  nearMissValue.textContent = String(latestSnapshot?.nearMisses ?? 0);
  if(speedValue)speedValue.textContent = Math.round((latestSnapshot?.difficulty?.speedMultiplier??1)*100)+'%';
  if(routeReadout)routeReadout.textContent = (latestSnapshot?.region??'Farmland')+' · '+(latestSnapshot?.chikun?.locomotion==='run'?'RUNNING':'AIRBORNE');
}

function finishRun() {
  if (phase === 'game-over') return;
  phase = 'game-over';
  terminalAge = 0;
  paused = false;
  const result = runtime.result();
  if(result.crashed)ragdoll=createChikunRagdoll({...latestSnapshot.chikun,...latestSnapshot.impact,kind:result.finalState.terminalReason,tick:latestSnapshot.tick,grounded:latestSnapshot.chikun.y>610,reduceMotion:reduceMotion(),gore:goreEnabled});
  lastCompletedResult = result;
  let ghostComparison = null;
  if (ghostTrack && ghostTrack.seed === result.seed) {
    try { ghostComparison = compareChikunGhost({ run: result, ghost: ghostTrack }); } catch { ghostComparison = null; }
  }
  try {
    const stored = writeChikunGhostRecord(globalThis.localStorage, createChikunGhostRecord(result));
    if (stored?.samples?.length) ghostTrack = stored;
  } catch { /* local ghost storage is optional */ }
  if (!crashVfxPlayed) { spawnVfx('crash'); crashVfxPlayed = true; }
  const replayClaim = buildChikunReplayClaim({
    buildHash: initPayload.session.buildHash,
    seasonId: initPayload.session.seasonId,
    result,
  });
  const payload = {
    score: result.score,
    survivalTime: result.survivalTime,
    survivalTicks: result.survivalTicks,
    coinsCollected: result.coinsCollected,
    forksPassed: result.forksPassed,
    nearMisses: result.nearMisses,
    bestCombo: result.bestCombo,
    achievements: result.achievements,
    evidence: result.evidence,
    finalState: result.finalState,
    replayClaim,
  };
  tone(96, 0.38, 0.07, 'sawtooth');
  send('game:result', payload);
  resultEyebrow.textContent = mode === 'ranked'
    ? 'Ranked run sent for parent replay'
    : dailyChallenge
      ? `${dailyChallenge.label} complete`
      : 'Free flight complete';
  resultScore.textContent = String(result.score);
  resultCopy.textContent = mode === 'ranked'
    ? 'Lester’s Arcade is verifying this input log. Accepted scores update this device’s profile and local Chikun score boards.'
    : ghostComparison
      ? `${ghostComparison.beatGhost ? 'You beat your daily best' : 'Your daily best leads'} by ${Math.abs(ghostComparison.scoreDelta)} points. Practice score only.`
      : 'Practice score only. Nothing was written to Ranked progress or leaderboards.';
  resultStats.replaceChildren();
  const cause = {ground:'Reached the ground',ceiling:'Reached the flight ceiling',fork:'Hit a gate',tree:'Hit a tree',drone:'Decapitated by a drone',rock:'Hit a boulder',log:'Hit a fallen log',thorn:'Caught in thorns',hurdle:'Hit a hurdle',crate:'Hit a crate',shiba:'Caught by a Shiba',pit:'Fell into a gap',waterfall:'Fell into the waterfall',forest:'Crashed into the forest',town:{city:'Crashed into a city block',suburb:'Crashed into a suburban home'}[latestSnapshot?.impact?.variant]??'Crashed into town',canopy:'Hit a low canopy',hawk:'Hit a hawk',eagle:'Hit an eagle',pelican:'Hit a pelican',plane:'Hit a plane',storm:'Caught in a storm',pipe:'Hit an industrial pipe','run-complete':'Course complete'}[result.finalState?.terminalReason ?? latestSnapshot?.terminalReason];
  const statLabels = [`Ł ${result.coinsCollected} coins`, `${result.forksPassed} obstacles`, `${result.nearMisses} near misses`, `${result.bestCombo} best combo`, `${result.survivalTime.toFixed(1)} seconds`];
  if(cause)statLabels.unshift(cause);
  if(latestSnapshot.distancePixels)statLabels.push(Math.floor(latestSnapshot.distancePixels/10)+' m travelled');
  if (ghostComparison) statLabels.push(`daily best ${ghostComparison.scoreDelta >= 0 ? '+' : ''}${ghostComparison.scoreDelta}`);
  for (const label of statLabels) {
    const chip = document.createElement('span');
    chip.textContent = label;
    resultStats.append(chip);
  }
  const awards=chikunAchievements(result);
  document.querySelector('#runObjectives').textContent=awards.map(a=>a.title+': '+(a.unlocked?'✓':Math.min(a.value??0,a.target)+'/'+a.target)).join(' · ');
  renderReplayTimeline(result.evidence);
  stopReplayViewer();
  renderShareRow(result);
  restartButton.disabled = false;
  restartButton.textContent = 'Run Again';
  if (watchReplayButton) watchReplayButton.textContent = 'Watch Replay';
  resultOverlay.classList.toggle('is-hidden', !reduceMotion());
  setLive(`Game over. Score ${result.score}. ${result.coinsCollected} coins and ${result.forksPassed} obstacles.`);
}

function togglePause(source = 'user', force = null) {
  if (phase !== 'running') return;
  paused = force === null ? !paused : Boolean(force);
  if(paused)flapQueued=false;
  pauseOverlay.classList.toggle('is-hidden', !paused);
  if (paused) resumeButton.focus({preventScroll:true});
  pauseButton.textContent = paused ? '▶' : 'Ⅱ';
  send('game:pause', { paused, source });
  sendState(paused ? 'paused' : 'running');
  if (!paused) {
    accumulator = 0;
    previousFrameAt = performance.now();
    canvas.focus();
  }
  setLive(paused ? 'Flight paused.' : 'Flight resumed.');
}

function queueFlap(event) {
  if(event?.type==='pointerdown' && (event.button!==0 || event.isPrimary===false))return;
  if (event?.target?.closest?.('button')) return;
  event?.preventDefault?.();
  canvas.focus({ preventScroll: true });
  if (phase === 'game-over' && replayPlayback) {
    toggleReplayViewer();
    return;
  }
  if (phase === 'ready') startRun();
  else if (phase === 'running' && !paused) {
    flapQueued = true;
  }
}

function drawSky(snapshot) {
  flightWorld.draw(ctx, snapshot, { reduced: reduceMotion(), mode, idleTime, view: flightViewport });
}

function drawFork(fork) {
  if(fork.family)drawGroundObstacle(ctx, fork, latestSnapshot?.tick ?? 0, reduceMotion());
  else drawChikunObstacle(ctx, fork, latestSnapshot?.tick ?? 0, reduceMotion());
}

function drawChikun(snapshot) {
  const menuPosition = flightViewport.portrait ? {x: flightViewport.left + flightViewport.width / 2, y: 155, size: 280} : null;
  const characterOptions = { phase, terminalAge, flapAge, flapVelocity, event: flightEvent, eventAge: flightEventAge, idleTime, menuPosition, reduceMotion: reduceMotion(), seek: Boolean(replayPlayback && !replayPlaying) };
  if(ragdoll && phase==='game-over' && !replayPlayback && !reduceMotion()){
    // Defeat handoff: the hit pose recoils for one beat while the ragdoll fades in over it.
    const handoff = Math.min(1, terminalAge / RAGDOLL_HANDOFF_SECONDS);
    if (handoff < 1) { ctx.save(); ctx.globalAlpha = 1 - handoff; flightCharacter.draw(ctx, snapshot, renderDt, characterOptions); ctx.restore(); }
    drawChikunRagdoll(ctx, ragdoll, { alpha: handoff });
    return;
  }
  if (flightCharacter.draw(ctx, snapshot, renderDt, characterOptions)) return;
  const bird = snapshot.chikun;
  const sprite = bird.velocityY > 1.6 ? fallSprite : coastSprite;
  const ready = sprite.complete && sprite.naturalWidth > 0;
  const width = bird.velocityY > 1.6 ? 102 : 150;
  const height = 112;
  ctx.save();
  ctx.translate(bird.x, bird.y);
  ctx.rotate(Math.max(-0.38, Math.min(0.62, bird.velocityY * 0.055)));
  if (ready) {
    ctx.drawImage(sprite, -width / 2, -height / 2, width, height);
  }
  ctx.restore();
}

function drawVfx(snapshot) {
  activeParticles = activeParticles.filter((particle) => vfxFrame - particle.bornFrame < particle.lifeTicks);
  for (const particle of activeParticles) {
    const age = Math.max(0, vfxFrame - particle.bornFrame);
    const progress = age / particle.lifeTicks;
    ctx.globalAlpha = Math.max(0, 1 - progress);
    const x=particle.x+particle.vx*age-age*1.6,y=particle.y+particle.vy*age+age*age*.012;
    ctx.strokeStyle=particle.color;
    ctx.lineWidth=Math.max(.7,particle.size*.18*(1-progress));
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-particle.size*.8,y+particle.vy*.5);ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (activeFlash) {
    const age = vfxFrame - activeFlash.bornFrame;
    if (age < activeFlash.lifeTicks) {
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0, activeFlash.alpha * (1 - age / activeFlash.lifeTicks))})`;
      ctx.fillRect(flightViewport.left, 0, flightViewport.width, flightViewport.height);
    } else activeFlash = null;
  }
}

function draw(snapshot = latestSnapshot) {
  shell.dataset.phase = phase;
  vfxFrame += renderDt * 60;
  ctx.save();
  ctx.scale(flightViewport.density, flightViewport.density);
  ctx.translate(-flightViewport.left, 0);
  if (activeShake && !reduceMotion()) {
    const age = vfxFrame - activeShake.bornFrame;
    if (age < activeShake.lifeTicks) {
      const strength = activeShake.amount * (1 - age / activeShake.lifeTicks);
      ctx.translate(Math.sin(age * 2.1) * strength, Math.cos(age * 1.7) * strength * 0.6);
    } else activeShake = null;
  }
  drawSky(snapshot);
  if(snapshot?.chikun?.locomotion)drawGround(ctx,snapshot,{reduced:reduceMotion()});
  for (const fork of snapshot?.forks ?? []) drawFork(fork);
  if (snapshot?.chikun) {
    drawChikun(snapshot);
  }
  drawVfx(snapshot);
  const approaching = phase === 'running' ? upcomingChikunObstacle(snapshot?.forks ?? [], flightViewport, snapshot?.difficulty?.speedMultiplier??1) : null;
  if (approaching) {
    const x = flightViewport.left + flightViewport.width - 12;
    const y = Math.max(118, Math.min(620, approaching.gapCenter));
    ctx.fillStyle = '#102a3bce'; ctx.fillRect(x - 84, y - 20, 84, 36);
    ctx.textAlign = 'right'; ctx.fillStyle = '#f1dfb8'; ctx.font = '700 10px system-ui';
    ctx.fillText((approaching.variant??approaching.kind).toUpperCase() + ' AHEAD', x - 7, y - 5);
    ctx.fillStyle = '#bcd9d7'; ctx.font = '10px system-ui'; ctx.fillText(approaching.family==='sky'?'↓ STAY LOW':approaching.family==='tree'?'↑ FLY OVER':'↑ JUMP / FLY', x - 7, y + 8);
  }
  ctx.restore();
}

// Failure safety: nothing a frame does may stop the loop. A throw is reported
// once to the parent and the next animation frame is always requested.
let frameFailureReported = false;
function reportFrameFailure(error) {
  if (frameFailureReported) return;
  frameFailureReported = true;
  try { send('game:error', { code: 'runtime-error', message: error instanceof Error ? error.message.slice(0, 240) : 'Runtime failure' }); } catch { /* the bridge itself failed */ }
}

function frame(now) {
  if (disposed) return;
  try {
    stepFrame(now);
  } catch (error) {
    reportFrameFailure(error);
  } finally {
    if (!disposed) requestAnimationFrame(frame);
  }
}

function stepFrame(now) {
  if (!previousFrameAt) previousFrameAt = now;
  const elapsed = Math.min(100, Math.max(0, now - previousFrameAt));
  previousFrameAt = now;
  renderDt = paused || document.visibilityState === 'hidden' ? 0 : elapsed / 1000;
  idleTime += renderDt;
  flapAge += renderDt;
  flightEventAge += renderDt;
  if (phase === 'game-over' && !replayPlayback) {
    terminalAge += renderDt;
    ragdoll?.step(renderDt);
    if (terminalAge >= (ragdoll?6:1.15)) {resultOverlay.classList.remove('is-hidden');if(document.activeElement===canvas)restartButton.focus({preventScroll:true});}
    document.querySelector('#skipDeathButton').hidden=terminalAge>=6||!ragdoll;
  }
  flightAudio.ambience(phase === 'running' && !paused);
  if (phase === 'running' && !paused && runtime) {
    accumulator = Math.min(accumulator + elapsed, STEP_MS * MAX_CATCH_UP_STEPS);
    let steps = 0;
    try {
      while (accumulator >= STEP_MS && !runtime.terminal && steps < MAX_CATCH_UP_STEPS) {
        if (flapQueued) { flapAge = 0; flapVelocity = latestSnapshot?.chikun?.velocityY ?? 0; }
        latestSnapshot = runtime.step({ flap: flapQueued });
        if (flapQueued) {
          flapQueued = false;
          tone(560, 0.055, 0.025, 'square');
          spawnVfx('flap');
        }
        accumulator -= STEP_MS;
        steps += 1;
        if (latestSnapshot.coinsCollected > previousCoins) { previousCoins = latestSnapshot.coinsCollected; tone(880, 0.12, 0.04, 'sine'); showCallout('Litecoin +25'); spawnVfx('coin'); animateFlight('collect'); }
        if (latestSnapshot.nearMisses > previousNearMisses) { previousNearMisses = latestSnapshot.nearMisses; tone(1040, 0.12, 0.04, 'triangle'); showCallout('Near miss +40'); spawnVfx('near-miss'); animateFlight(latestSnapshot.chikun.y < 360 ? 'dodge_high' : 'dodge_low'); }
        if (latestSnapshot.forksPassed > previousForks) {
          previousForks = latestSnapshot.forksPassed;
          tone(660, 0.09, 0.03, 'square');
          spawnVfx('fork');
          if (latestSnapshot.forksPassed % 5 === 0) { showCallout(`${latestSnapshot.forksPassed} clear streak`); spawnVfx('milestone'); animateFlight(milestoneFlourish(latestSnapshot.forksPassed)); flightAudio.play('streak'); }
        }
        if (latestSnapshot.difficulty.level > previousDifficultyLevel) {
          previousDifficultyLevel = latestSnapshot.difficulty.level;
          showCallout(Math.round(latestSnapshot.difficulty.speedMultiplier*100)+'% speed');
        }
      }
    } catch (error) {
      phase = 'error';
      send('game:error', { code: 'runtime-error', message: error instanceof Error ? error.message.slice(0, 240) : 'Runtime failure' });
    }
    updateHud();
    if (latestSnapshot && latestSnapshot.tick - lastStateTick >= 30) {
      lastStateTick = latestSnapshot.tick;
      sendState('running');
    }
    if (runtime.terminal) {
      try { finishRun(); } catch (error) { reportFrameFailure(error); }
    }
  } else if (phase === 'game-over' && replayPlaying && replayPlayback) {
    accumulator = Math.min(accumulator + elapsed * Number(replaySpeed.value), STEP_MS * MAX_CATCH_UP_STEPS);
    let steps = 0;
    while (accumulator >= STEP_MS && !replayPlayback.terminal && steps < MAX_CATCH_UP_STEPS) {
      const replayTick = replayPlayback.tick;
      if (replayPlayback.hasFlapAt(replayTick)) { flapAge = 0; flapVelocity = latestSnapshot?.chikun?.velocityY ?? 0; }
      latestSnapshot = replayPlayback.step();
      accumulator -= STEP_MS;
      steps += 1;
    }
    updateReplayPlayhead();
    if (replayPlayback.terminal) {
      replayPlaying = false;
      if (watchReplayButton) watchReplayButton.textContent = 'Replay Again';
      setLive('Replay finished. Score is unchanged.');
    }
  }
  draw(latestSnapshot);
}

function handleParentMessage(event) {
  const validation = validateChikunParentMessage(event.data);
  if (!validation.ok) {
    send('game:error', { code: 'protocol-error', message: validation.error.slice(0, 240) });
    return;
  }
  const message = validation.value;
  if (message.sessionId !== sessionId) {
    send('game:error', { code: 'session-mismatch', message: 'Parent command did not match the active session.' });
    return;
  }
  if (message.type === 'portal:init') {
    initPayload = message.payload;
    mode = initPayload.mode;
    setModePresentation();
    syncAudioControl();
    syncFullscreenControl();
    prepareRun();
    phase = 'ready';
    startOverlay.classList.remove('is-hidden');
    send('game:ready', { runtimeVersion: '0.9.0', renderer: 'canvas-2d', capabilities: ['pause', 'restart', 'score-result', 'fullscreen'] });
    sendState('ready');
    setLive(`Ready for ${mode === 'ranked' ? 'Ranked' : 'Free'} Mode.`);
  } else if (message.type === 'portal:pause') togglePause('portal', true);
  else if (message.type === 'portal:resume') togglePause('portal', false);
  else if (message.type === 'portal:restart') {
    if (phase === 'game-over') send('game:restart-request', {});
    else startRun();
  } else if (message.type === 'portal:settings') {
    initPayload.settings = { ...message.payload.settings };
    syncAudioControl();
  } else if (message.type === 'portal:dispose') {
    disposed = true;
    phase = 'disposed';
    if (calloutTimer !== null) clearTimeout(calloutTimer);
    for (const voice of activeAudioVoices) {
      try { voice.oscillator.stop(); voice.oscillator.disconnect(); voice.gain.disconnect(); } catch { /* already released */ }
    }
    activeAudioVoices.clear();
    ragdoll?.dispose();
    flightCharacter.dispose();
    flightWorld.dispose();
    flightResizeObserver.disconnect();
    window.removeEventListener('resize', resizeFlightViewport);
    flightAudio.dispose();
    audioContext?.close?.();
    audioContext = null;
    port.onmessage = null;
    port.close?.();
  }
}

window.addEventListener('message', (event) => {
  if (port || event.source !== window.parent || event.origin !== window.location.origin) return;
  const validation = validateChikunConnectMessage(event.data);
  if (!validation.ok || event.ports?.length !== 1) return;
  port = event.ports[0];
  port.onmessage = handleParentMessage;
  port.start?.();
  sessionId = '';
  const firstHandler = (firstEvent) => {
    const firstValidation = validateChikunParentMessage(firstEvent.data);
    if (!firstValidation.ok || firstValidation.value.type !== 'portal:init') return;
    sessionId = firstValidation.value.sessionId;
    port.onmessage = handleParentMessage;
    handleParentMessage(firstEvent);
  };
  port.onmessage = firstHandler;
}, false);

startButton.addEventListener('click', startRun);
canvas.addEventListener('pointerdown', () => flightAudio.unlock(), { once: true });
canvas.addEventListener('keydown', () => flightAudio.unlock(), { once: true });
canvas.addEventListener('pointerdown', queueFlap);
canvas.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (event.code === 'Space' || event.code === 'ArrowUp' || event.key === 'Enter') { event.preventDefault(); queueFlap(event); }
  else if (event.key.toLowerCase() === 'p' || event.key === 'Escape') { event.preventDefault(); togglePause('user'); }
  else if (event.key.toLowerCase() === 'm') toggleMute();
});
pauseButton.addEventListener('click', () => togglePause('user'));
resumeButton.addEventListener('click', () => togglePause('user', false));
pauseExitButton.addEventListener('click', () => send('game:exit-request', {}));
muteButton.addEventListener('click', toggleMute);
pauseMuteButton.addEventListener('click', toggleMute);
document.querySelector('#pauseMusicButton').addEventListener('click', async () => {
  if(document.fullscreenElement)await document.exitFullscreen?.();
  send('game:music-request', {});
});
fullscreenButton.addEventListener('click', toggleFullscreen);
pauseFullscreenButton.addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', syncFullscreenControl);
exitButton.addEventListener('click', () => send('game:exit-request', {}));
resultExitButton.addEventListener('click', () => send('game:exit-request', {}));
// X / Facebook / Discord targets beside the native Share Run button (owner
// direction 2026-09-16). Same text as the native share, same public link.
let shareRow = null;
function renderShareRow(result) {
  const mount = document.querySelector('#shareRow');
  if (!mount) return;
  const links = buildShareLinks({
    text: buildChikunShareText(result, mode, dailyChallenge?.label ?? ''),
    url: shareUrlFor('chikun'),
    hashtags: ['LestersArcade', 'ChikunsEscape'],
  });
  if (shareRow) { shareRow.refresh(links); return; }
  shareRow = createShareRow({
    documentRef: document,
    navigatorRef: { clipboard: navigator.clipboard },
    title: "Chikun's Escape",
    links,
    className: 'share-row',
    buttonClassName: 'secondary-button share-button',
    onStatus: setLive,
  });
  mount.replaceChildren(shareRow);
}
shareRunButton.addEventListener('click', async () => {
  if (!lastCompletedResult) return;
  const text = buildChikunShareText(lastCompletedResult, mode, dailyChallenge?.label ?? '');
  try {
    if (navigator.share) await navigator.share({ title: "Chikun's Escape", text, url: 'https://lestersarcade.io' });
    else if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else throw new Error('Sharing is unavailable');
    shareRunButton.textContent = navigator.share ? 'Shared' : 'Copied';
    setLive(navigator.share ? 'Run shared.' : 'Run summary copied to clipboard.');
  } catch (error) {
    if (error?.name === 'AbortError') return;
    shareRunButton.textContent = 'Share unavailable';
    setLive('Sharing is unavailable in this browser.');
  }
  setTimeout(() => { shareRunButton.textContent = 'Share Run'; }, 1_500);
});
watchReplayButton?.addEventListener('click', () => toggleReplayViewer());
replayTimeline.addEventListener('pointerdown', seekReplayFromEvent);
replayTimeline.addEventListener('keydown', (event) => {
  if (phase !== 'game-over' || !lastCompletedResult) return;
  if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
  event.preventDefault();
  if (!replayPlayback) startReplayViewer();
  if (!replayPlayback) return;
  const delta = event.key === 'ArrowRight' ? 15 : -15;
  latestSnapshot = replayPlayback.seek(event.key==='Home'?0:event.key==='End'?replayPlayback.durationTicks:replayPlayback.tick + delta);
  replayPlaying = false;
  watchReplayButton.textContent = replayPlayback.terminal ? 'Replay Again' : 'Play Replay';
  updateReplayPlayhead();
});
restartButton.addEventListener('click', () => {
  if (mode !== 'ranked') {
    startRun();
    return;
  }
  restartButton.disabled = true;
  restartButton.textContent = 'Requesting new run…';
  send('game:restart-request', {});
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && phase === 'running' && !paused) togglePause('visibility', true);
  else if (document.visibilityState === 'visible') { accumulator = 0; previousFrameAt = performance.now(); }
});
window.addEventListener('blur', () => {
  flapQueued = false;
  if (phase === 'running' && !paused) togglePause('visibility', true);
});

latestSnapshot = createChikunRuntime({ seed: 1, maxTicks: MAX_RUN_TICKS }).snapshot();
renderModeTease();
// Read-only QA peek for browser smokes (scripts/chikun-regions-browser-smoke.mjs).
// The harness must define the global before this module runs; the frozen
// snapshot cannot alter the run, the score or the replay evidence.
if (globalThis.__CHIKUN_QA__ && typeof globalThis.__CHIKUN_QA__ === 'object') {
  globalThis.__CHIKUN_QA__.peek = () => latestSnapshot;
  globalThis.__CHIKUN_QA__.region = () => flightWorld.regionState();
}
syncAudioControl();
syncFullscreenControl();
draw(latestSnapshot);
requestAnimationFrame(frame);

function syncGore(){goreButton.textContent='Blood & gore: '+(goreEnabled?'On':'Off');goreButton.setAttribute('aria-pressed',String(goreEnabled));}
goreButton.addEventListener('click',()=>{goreEnabled=!goreEnabled;try{localStorage.setItem('chikun-gore-v1',goreEnabled?'on':'off');}catch{}syncGore();});
syncGore();
document.querySelector('#skipDeathButton').addEventListener('click',()=>{terminalAge=6;ragdoll?.dispose();ragdoll=null;resultOverlay.classList.remove('is-hidden');document.querySelector('#skipDeathButton').hidden=true;restartButton.focus();});

document.querySelector('#exportReplayButton').addEventListener('click',()=>{
 if(!lastCompletedResult)return;
 const blob=new Blob([exportChikunReplay(lastCompletedResult)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='chikun-replay.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setLive('Replay downloaded. It contains inputs and a course seed, without your wallet or account identity.');
});
document.querySelector('#importReplayButton').addEventListener('click',()=>document.querySelector('#replayFile').click());
document.querySelector('#replayFile').addEventListener('change',async event=>{
 const file=event.target.files?.[0];event.target.value='';if(!file)return;
 try{
  if(file.size>REPLAY_FILE_LIMIT)throw new Error('Replay file must be smaller than 256 KB.');
  const imported=importChikunReplay(await file.text());stopReplayViewer();lastCompletedResult=imported;ragdoll?.dispose();ragdoll=null;
  renderReplayTimeline(imported.evidence);resultScore.textContent=String(imported.score);resultStats.replaceChildren();document.querySelector('#runObjectives').textContent='';
  resultEyebrow.textContent=['chikun-flap-evidence-v3','chikun-flap-evidence-v5','chikun-flap-evidence-v6'].includes(imported.evidence.version)?'Imported replay · Ground & Sky':'Imported historical flight';
  resultCopy.textContent='Playback only. This replay does not write a score, best, achievement or profile record.';startReplayViewer();
 }catch(error){setLive(error.message);resultCopy.textContent=error.message;}
});

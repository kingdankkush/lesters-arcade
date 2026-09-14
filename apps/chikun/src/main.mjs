import { createChikunCharacter } from './character.mjs';
import { createChikunWorld, drawChikunObstacle } from './world.mjs';
import { createChikunAudio } from './audio.mjs';
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
import { buildChikunReplayTimeline, buildChikunShareText } from './presentation.mjs';
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
const watchReplayButton = document.querySelector('#watchReplayButton');
const shareRunButton = document.querySelector('#shareRunButton');
const liveStatus = document.querySelector('#liveStatus');

const STEP_MS = 1000 / CHIKUN_FIXED_STEP_HZ;
const MAX_CATCH_UP_STEPS = 4;
const MAX_AUDIO_VOICES = 8;
const MAX_RUN_TICKS = CHIKUN_FIXED_STEP_HZ * 60 * 60;
const coastSprite = new Image();
const fallSprite = new Image();
coastSprite.src = '/assets/generated/chikun-game/chikun-coast.webp';
fallSprite.src = '/assets/generated/chikun-game/chikun-fall.webp';
Promise.allSettled([coastSprite.decode?.(), fallSprite.decode?.()]);

const flightCharacter = createChikunCharacter();
const flightWorld = createChikunWorld();
const flightAudio = createChikunAudio();
let renderDt = 0;
let idleTime = 0;
let terminalAge = 0;
let flapAge = Infinity;
let flapVelocity = 0;
let flightEvent = '';
let flightEventAge = Infinity;
function animateFlight(event) { flightEvent = event; flightEventAge = 0; }

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
  if (muted || initPayload?.settings.musicEnabled === false) return;
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
    ? 'Ranked Mode · Replay Verified'
    : dailyChallenge
      ? `${dailyChallenge.label} · Shared Course`
      : 'Free Mode · Practice Flight';
  modeCopy.textContent = ranked
    ? 'Dodge trees and drones, thread the gates, collect Litecoin, and skim the edges for bonuses. Lester’s Arcade replays every input before the score reaches your profile and Ranked boards.'
    : dailyChallenge
      ? `Dodge trees and drones, thread the gates, collect Litecoin, and skim the edges for bonuses. Everyone flies the ${dailyChallenge.dayKey} course today, and your daily best stays on this seed without entering Ranked boards.`
      : 'Dodge trees and drones, thread the gates, collect Litecoin, and skim the edges for bonuses. This practice score never enters your profile or Ranked boards.';
  loadGhostForSeed(initPayload?.session?.seed);
}

function syncAudioControl() {
  const parentDisabled = initPayload?.settings.musicEnabled === false;
  const disabled = parentDisabled || muted;
  flightAudio.setEnabled(!disabled);
  muteButton.disabled = parentDisabled;
  muteButton.textContent = disabled ? '×' : '♪';
  muteButton.setAttribute('aria-pressed', String(disabled));
  muteButton.setAttribute('aria-label', parentDisabled ? 'Sound disabled in arcade settings' : muted ? 'Unmute flight sounds' : 'Mute flight sounds');
  pauseMuteButton.disabled = parentDisabled;
  pauseMuteButton.textContent = parentDisabled ? 'Sound Off' : muted ? 'SFX On' : 'SFX Off';
  pauseMuteButton.setAttribute('aria-pressed', String(disabled));
  pauseMuteButton.setAttribute('aria-label', parentDisabled ? 'Sound disabled in arcade settings' : muted ? 'Unmute flight sounds' : 'Mute flight sounds');
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
  if (initPayload?.settings.musicEnabled === false) return;
  muted = !muted;
  syncAudioControl();
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.();
}

function prepareRun() {
  terminalAge = 0; flapAge = Infinity; flightEventAge = Infinity; flightEvent = '';
  runtime = createChikunRuntime({ seed: initPayload.session.seed, maxTicks: MAX_RUN_TICKS });
  latestSnapshot = runtime.snapshot();
  updateHud();
  draw(latestSnapshot);
}

function startRun() {
  if (!initPayload || disposed) return;
  stopReplayViewer();
  prepareRun();
  phase = 'running';
  paused = false;
  flapQueued = true;
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
  setLive(`${flightLabel} flight started. Tap or press Space to flap.`);
  flightAudio.unlock().then(() => { if (!disposed && phase === 'running') flightAudio.play('launch'); });
  sendState('running');
}

function updateHud() {
  scoreValue.textContent = String(latestSnapshot?.score ?? 0);
  coinValue.textContent = String(latestSnapshot?.coinsCollected ?? 0);
  forkValue.textContent = String(latestSnapshot?.forksPassed ?? 0);
  comboValue.textContent = String(latestSnapshot?.combo ?? 0);
  nearMissValue.textContent = String(latestSnapshot?.nearMisses ?? 0);
}

function finishRun() {
  if (phase === 'game-over') return;
  phase = 'game-over';
  terminalAge = 0;
  paused = false;
  const result = runtime.result();
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
    ? 'Lester’s Arcade is verifying this input log. Accepted scores update your profile and the Chikun’s Escape score boards.'
    : ghostComparison
      ? `${ghostComparison.beatGhost ? 'You beat your daily best' : 'Your daily best leads'} by ${Math.abs(ghostComparison.scoreDelta)} points. Practice score only.`
      : 'Practice score only. Nothing was written to Ranked progress or leaderboards.';
  resultStats.replaceChildren();
  const statLabels = [`Ł ${result.coinsCollected} coins`, `${result.forksPassed} obstacles`, `${result.nearMisses} near misses`, `${result.bestCombo} best combo`, `${result.survivalTime.toFixed(1)} seconds`];
  if (ghostComparison) statLabels.push(`daily best ${ghostComparison.scoreDelta >= 0 ? '+' : ''}${ghostComparison.scoreDelta}`);
  for (const label of statLabels) {
    const chip = document.createElement('span');
    chip.textContent = label;
    resultStats.append(chip);
  }
  renderReplayTimeline(result.evidence);
  stopReplayViewer();
  restartButton.disabled = false;
  restartButton.textContent = 'Fly Again';
  if (watchReplayButton) watchReplayButton.textContent = 'Watch Replay';
  resultOverlay.classList.toggle('is-hidden', !reduceMotion());
  setLive(`Game over. Score ${result.score}. ${result.coinsCollected} coins and ${result.forksPassed} obstacles.`);
}

function togglePause(source = 'user', force = null) {
  if (phase !== 'running') return;
  paused = force === null ? !paused : Boolean(force);
  if(paused)flapQueued=false;
  pauseOverlay.classList.toggle('is-hidden', !paused);
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
    tone(560, 0.055, 0.025, 'square');
    spawnVfx('flap');
  }
}

function drawSky(snapshot) {
  flightWorld.draw(ctx, snapshot, { reduced: reduceMotion(), mode, idleTime });
}

function drawFork(fork) {
  drawChikunObstacle(ctx, fork, latestSnapshot?.tick ?? 0, reduceMotion());
}

function drawChikun(snapshot) {
  if (flightCharacter.draw(ctx, snapshot, renderDt, { phase, terminalAge, flapAge, flapVelocity, event: flightEvent, eventAge: flightEventAge, idleTime, reduceMotion: reduceMotion(), seek: Boolean(replayPlayback && !replayPlaying) })) return;
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
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else activeFlash = null;
  }
}

function draw(snapshot = latestSnapshot) {
  shell.dataset.phase = phase;
  vfxFrame += renderDt * 60;
  ctx.save();
  if (activeShake && !reduceMotion()) {
    const age = vfxFrame - activeShake.bornFrame;
    if (age < activeShake.lifeTicks) {
      const strength = activeShake.amount * (1 - age / activeShake.lifeTicks);
      ctx.translate(Math.sin(age * 2.1) * strength, Math.cos(age * 1.7) * strength * 0.6);
    } else activeShake = null;
  }
  drawSky(snapshot);
  for (const fork of snapshot?.forks ?? []) drawFork(fork);
  if (snapshot?.chikun) {
    drawChikun(snapshot);
  }
  drawVfx(snapshot);
  ctx.restore();
}

function frame(now) {
  if (disposed) return;
  if (!previousFrameAt) previousFrameAt = now;
  const elapsed = Math.min(100, Math.max(0, now - previousFrameAt));
  previousFrameAt = now;
  renderDt = paused || document.visibilityState === 'hidden' ? 0 : elapsed / 1000;
  idleTime += renderDt;
  flapAge += renderDt;
  flightEventAge += renderDt;
  if (phase === 'game-over' && !replayPlayback) {
    terminalAge += renderDt;
    if (terminalAge >= 1.15) resultOverlay.classList.remove('is-hidden');
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
        }
        accumulator -= STEP_MS;
        steps += 1;
        if (latestSnapshot.coinsCollected > previousCoins) { previousCoins = latestSnapshot.coinsCollected; tone(880, 0.12, 0.04, 'sine'); showCallout('Litecoin +25'); spawnVfx('coin'); animateFlight('collect'); }
        if (latestSnapshot.nearMisses > previousNearMisses) { previousNearMisses = latestSnapshot.nearMisses; tone(1040, 0.12, 0.04, 'triangle'); showCallout('Near miss +40'); spawnVfx('near-miss'); animateFlight(latestSnapshot.chikun.y < 360 ? 'dodge_high' : 'dodge_low'); }
        if (latestSnapshot.forksPassed > previousForks) {
          previousForks = latestSnapshot.forksPassed;
          tone(660, 0.09, 0.03, 'square');
          spawnVfx('fork');
          if (latestSnapshot.forksPassed % 5 === 0) { showCallout(`${latestSnapshot.forksPassed} clear streak`); spawnVfx('milestone'); animateFlight('barrel_roll'); flightAudio.play('streak'); }
        }
        if (latestSnapshot.difficulty.level > previousDifficultyLevel) {
          previousDifficultyLevel = latestSnapshot.difficulty.level;
          showCallout(`Pressure level ${previousDifficultyLevel}`);
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
    if (runtime.terminal) finishRun();
  } else if (phase === 'game-over' && replayPlaying && replayPlayback) {
    accumulator += elapsed;
    let steps = 0;
    while (accumulator >= STEP_MS && !replayPlayback.terminal && steps < MAX_CATCH_UP_STEPS) {
      const replayTick = replayPlayback.tick;
      if (lastCompletedResult?.evidence?.flapSteps?.includes(replayTick)) { flapAge = 0; flapVelocity = latestSnapshot?.chikun?.velocityY ?? 0; }
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
  if (!disposed) requestAnimationFrame(frame);
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
    send('game:ready', { runtimeVersion: '0.6.0', renderer: 'canvas-2d', capabilities: ['pause', 'restart', 'score-result', 'fullscreen'] });
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
    flightCharacter.dispose();
    flightWorld.dispose();
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
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  if (!replayPlayback) startReplayViewer();
  if (!replayPlayback) return;
  const delta = event.key === 'ArrowRight' ? 15 : -15;
  latestSnapshot = replayPlayback.seek(replayPlayback.tick + delta);
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

latestSnapshot = createChikunRuntime({ seed: 1, maxTicks: MAX_RUN_TICKS }).snapshot();
syncAudioControl();
syncFullscreenControl();
draw(latestSnapshot);
requestAnimationFrame(frame);

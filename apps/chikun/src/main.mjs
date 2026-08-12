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
const shareRunButton = document.querySelector('#shareRunButton');
const liveStatus = document.querySelector('#liveStatus');

const STEP_MS = 1000 / CHIKUN_FIXED_STEP_HZ;
const MAX_CATCH_UP_STEPS = 4;
const MAX_RUN_TICKS = CHIKUN_FIXED_STEP_HZ * 60 * 60;
const coastSprite = new Image();
const fallSprite = new Image();
coastSprite.src = '/assets/generated/chikun-game/chikun-coast.webp';
fallSprite.src = '/assets/generated/chikun-game/chikun-fall.webp';
Promise.allSettled([coastSprite.decode?.(), fallSprite.decode?.()]);

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
let flapBufferFrames = 0;
let accumulator = 0;
let previousFrameAt = 0;
let latestSnapshot = null;
let lastStateTick = -1;
let audioContext = null;
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
  replayTimeline.setAttribute('aria-label', `${timeline.totalFlaps} flaps across this run`);
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
  try {
    audioContext ??= new AudioContext();
    if (audioContext.state === 'suspended') audioContext.resume?.();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(gainValue, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch { /* audio is optional */ }
}

function setModePresentation() {
  const ranked = mode === 'ranked';
  shell.dataset.mode = mode;
  modeLabel.textContent = ranked ? 'Ranked Mode · Replay Verified' : 'Free Mode · Practice Flight';
  modeCopy.textContent = ranked
    ? 'Your parent-issued run is replayed by Lester’s Arcade before it reaches your profile and the Chikun score boards.'
    : 'Practice forever. Your score stays in this flight and never enters Ranked boards.';
}

function prepareRun() {
  runtime = createChikunRuntime({ seed: initPayload.session.seed, maxTicks: MAX_RUN_TICKS });
  latestSnapshot = runtime.snapshot();
  updateHud();
  draw(latestSnapshot);
}

function startRun() {
  if (!initPayload || disposed) return;
  prepareRun();
  phase = 'running';
  paused = false;
  flapQueued = true;
  flapBufferFrames = 2;
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
  setLive(`${mode === 'ranked' ? 'Ranked' : 'Free'} flight started. Tap or press Space to flap.`);
  tone(420, 0.1, 0.04, 'square');
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
  paused = false;
  const result = runtime.result();
  lastCompletedResult = result;
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
  resultEyebrow.textContent = mode === 'ranked' ? 'Ranked run sent for parent replay' : 'Free flight complete';
  resultScore.textContent = String(result.score);
  resultCopy.textContent = mode === 'ranked'
    ? 'Lester’s Arcade is verifying this input log. Accepted scores update your profile and the Chikun’s Escape score boards.'
    : 'Practice score only. Nothing was written to Ranked progress or leaderboards.';
  resultStats.replaceChildren();
  for (const label of [`Ł ${result.coinsCollected} coins`, `${result.forksPassed} forks`, `${result.nearMisses} near misses`, `${result.bestCombo} best combo`, `${result.survivalTime.toFixed(1)} seconds`]) {
    const chip = document.createElement('span');
    chip.textContent = label;
    resultStats.append(chip);
  }
  renderReplayTimeline(result.evidence);
  restartButton.disabled = false;
  restartButton.textContent = 'Fly Again';
  resultOverlay.classList.remove('is-hidden');
  setLive(`Game over. Score ${result.score}. ${result.coinsCollected} coins and ${result.forksPassed} forks.`);
}

function togglePause(source = 'user', force = null) {
  if (phase !== 'running') return;
  paused = force === null ? !paused : Boolean(force);
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
  if (event?.target?.closest?.('button')) return;
  if (phase === 'ready') startRun();
  else if (phase === 'running' && !paused) {
    flapQueued = true;
    flapBufferFrames = 2;
    tone(560, 0.055, 0.025, 'square');
  }
}

function drawSky(snapshot) {
  const ranked = mode === 'ranked';
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  if (ranked) {
    gradient.addColorStop(0, '#050b2b');
    gradient.addColorStop(0.55, '#243b89');
    gradient.addColorStop(1, '#815869');
  } else {
    gradient.addColorStop(0, '#105be5');
    gradient.addColorStop(0.58, '#49aef4');
    gradient.addColorStop(1, '#d6edff');
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const tick = snapshot?.tick ?? 0;
  const motionTick = reduceMotion() ? 0 : tick;
  if (!ranked) {
    ctx.fillStyle = 'rgba(255,255,255,.78)';
    for (let index = 0; index < 7; index += 1) {
      const x = ((index * 263 - motionTick * (0.12 + index * 0.01)) % 1580 + 1580) % 1580 - 150;
      const y = 72 + (index * 83) % 310;
      const size = 28 + (index % 3) * 14;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.arc(x + size, y + 7, size * 0.75, 0, Math.PI * 2);
      ctx.arc(x - size, y + 10, size * 0.68, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.strokeStyle = 'rgba(190,220,255,.32)';
    ctx.lineWidth = 2;
    for (let index = 0; index < 70; index += 1) {
      const x = ((index * 73 - motionTick * 8) % 1400 + 1400) % 1400 - 60;
      const y = (index * 137 + motionTick * 13) % 760 - 40;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 13, y + 35); ctx.stroke();
    }
    if (!reduceMotion() && tick % 420 < 4) {
      ctx.fillStyle = 'rgba(235,245,255,.32)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#eaf4ff';
      ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(920, 0); ctx.lineTo(850, 120); ctx.lineTo(905, 108); ctx.lineTo(820, 260); ctx.stroke();
    }
  }

  ctx.fillStyle = ranked ? '#090d1f' : '#4c6f9b';
  for (let index = 0; index < 18; index += 1) {
    const width = 60 + (index * 29) % 70;
    const height = 90 + (index * 47) % 170;
    const x = index * 82 - (motionTick * 0.25) % 82;
    ctx.fillRect(x, canvas.height - 42 - height, width, height);
  }
  ctx.fillStyle = ranked ? '#02040b' : '#20344d';
  ctx.fillRect(0, canvas.height - 42, canvas.width, 42);
  ctx.fillStyle = mode === 'ranked' ? '#ffe138' : '#2dff5c';
  ctx.fillRect(0, canvas.height - 42, canvas.width, 5);
}

function drawFork(fork) {
  if (fork.passed) return;
  const topHeight = Math.max(0, fork.gapTop);
  const bottomY = fork.gapBottom;
  const bottomHeight = canvas.height - 42 - bottomY;
  const gradient = ctx.createLinearGradient(fork.x, 0, fork.x + fork.width, 0);
  gradient.addColorStop(0, '#03250d'); gradient.addColorStop(0.18, '#0ca735'); gradient.addColorStop(0.5, '#43ef67'); gradient.addColorStop(0.82, '#087326'); gradient.addColorStop(1, '#021b0a');
  ctx.fillStyle = gradient;
  ctx.strokeStyle = '#020805';
  ctx.lineWidth = 6;
  ctx.fillRect(fork.x, 0, fork.width, topHeight);
  ctx.strokeRect(fork.x, -4, fork.width, topHeight + 4);
  ctx.fillRect(fork.x, bottomY, fork.width, bottomHeight);
  ctx.strokeRect(fork.x, bottomY, fork.width, bottomHeight + 5);
  ctx.fillStyle = '#12a63c';
  ctx.fillRect(fork.x - 13, topHeight - 32, fork.width + 26, 32);
  ctx.strokeRect(fork.x - 13, topHeight - 32, fork.width + 26, 32);
  ctx.fillRect(fork.x - 13, bottomY, fork.width + 26, 32);
  ctx.strokeRect(fork.x - 13, bottomY, fork.width + 26, 32);
  ctx.save();
  ctx.translate(fork.x + fork.width / 2, Math.max(60, topHeight / 2));
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = 'rgba(0,0,0,.56)';
  ctx.font = '900 22px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('BIG CORP', 0, 7);
  ctx.restore();

  if (!fork.coin.collected) {
    const pulse = 1 + ((latestSnapshot.tick + fork.index * 11) % 60 < 30 ? 0.06 : 0);
    ctx.save();
    ctx.translate(fork.coin.x, fork.coin.y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#dce4ef';
    ctx.strokeStyle = '#596475';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(0, 0, fork.coin.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#737f90';
    ctx.font = '900 31px Georgia';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Ł', 0, 2);
    ctx.restore();
  }
}

function drawChikun(snapshot) {
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
  } else {
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#050607'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(0, 0, 46, 33, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e8c23b'; ctx.beginPath(); ctx.moveTo(40, -7); ctx.lineTo(76, 3); ctx.lineTo(40, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

function drawVfx(snapshot) {
  activeParticles = activeParticles.filter((particle) => vfxFrame - particle.bornFrame < particle.lifeTicks);
  for (const particle of activeParticles) {
    const age = Math.max(0, vfxFrame - particle.bornFrame);
    const progress = age / particle.lifeTicks;
    ctx.globalAlpha = Math.max(0, 1 - progress);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x + particle.vx * age, particle.y + particle.vy * age + age * age * 0.012, particle.size * (1 - progress * 0.55), 0, Math.PI * 2);
    ctx.fill();
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
  vfxFrame += 1;
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
  if (snapshot?.tick < 240) {
    const nextFork = snapshot.forks.find((fork) => !fork.passed && fork.x > 280);
    if (nextFork) {
      ctx.save();
      ctx.strokeStyle = mode === 'ranked' ? 'rgba(255,225,56,.55)' : 'rgba(45,255,92,.55)';
      ctx.setLineDash([12, 12]);
      ctx.lineWidth = 3;
      ctx.strokeRect(nextFork.x - 5, nextFork.gapTop + 5, nextFork.width + 10, nextFork.gapBottom - nextFork.gapTop - 10);
      ctx.restore();
    }
  }
  if (snapshot?.chikun) drawChikun(snapshot);
  drawVfx(snapshot);
  ctx.restore();
}

function frame(now) {
  if (disposed) return;
  if (!previousFrameAt) previousFrameAt = now;
  const elapsed = Math.min(100, Math.max(0, now - previousFrameAt));
  previousFrameAt = now;
  if (phase === 'running' && !paused && runtime) {
    accumulator += elapsed;
    let steps = 0;
    try {
      while (accumulator >= STEP_MS && !runtime.terminal && steps < MAX_CATCH_UP_STEPS) {
        latestSnapshot = runtime.step({ flap: flapQueued });
        if (flapQueued) {
          flapQueued = false;
          flapBufferFrames = 0;
        }
        accumulator -= STEP_MS;
        steps += 1;
        if (latestSnapshot.coinsCollected > previousCoins) { previousCoins = latestSnapshot.coinsCollected; tone(880, 0.12, 0.04, 'sine'); showCallout('Litecoin +25'); spawnVfx('coin'); }
        if (latestSnapshot.nearMisses > previousNearMisses) { previousNearMisses = latestSnapshot.nearMisses; tone(1040, 0.12, 0.04, 'triangle'); showCallout('Near miss +40'); spawnVfx('near-miss'); }
        if (latestSnapshot.forksPassed > previousForks) {
          previousForks = latestSnapshot.forksPassed;
          tone(660, 0.09, 0.03, 'square');
          spawnVfx('fork');
          if (latestSnapshot.forksPassed % 5 === 0) { showCallout(`${latestSnapshot.forksPassed} fork streak`); spawnVfx('milestone'); }
        }
        if (latestSnapshot.difficulty.level > previousDifficultyLevel) {
          previousDifficultyLevel = latestSnapshot.difficulty.level;
          showCallout(`Pressure level ${previousDifficultyLevel}`);
        }
      }
      if (flapQueued && steps === 0 && flapBufferFrames > 0) flapBufferFrames -= 1;
      if (flapQueued && flapBufferFrames <= 0) flapQueued = false;
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
    prepareRun();
    phase = 'ready';
    startOverlay.classList.remove('is-hidden');
    send('game:ready', { runtimeVersion: '0.5.0', renderer: 'canvas-2d', capabilities: ['pause', 'restart', 'score-result', 'fullscreen'] });
    sendState('ready');
    setLive(`Ready for ${mode === 'ranked' ? 'Ranked' : 'Free'} Mode.`);
  } else if (message.type === 'portal:pause') togglePause('portal', true);
  else if (message.type === 'portal:resume') togglePause('portal', false);
  else if (message.type === 'portal:restart') {
    if (phase === 'game-over') send('game:restart-request', {});
    else startRun();
  } else if (message.type === 'portal:settings') {
    initPayload.settings = { ...message.payload.settings };
  } else if (message.type === 'portal:dispose') {
    disposed = true;
    phase = 'disposed';
    if (calloutTimer !== null) clearTimeout(calloutTimer);
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
canvas.addEventListener('pointerdown', queueFlap);
canvas.addEventListener('keydown', (event) => {
  if (event.code === 'Space' || event.code === 'ArrowUp' || event.key === 'Enter') { event.preventDefault(); queueFlap(event); }
  else if (event.key.toLowerCase() === 'p' || event.key === 'Escape') { event.preventDefault(); togglePause('user'); }
  else if (event.key.toLowerCase() === 'm') { muted = !muted; muteButton.textContent = muted ? '×' : '♪'; muteButton.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound'); }
});
pauseButton.addEventListener('click', () => togglePause('user'));
resumeButton.addEventListener('click', () => togglePause('user', false));
muteButton.addEventListener('click', () => { muted = !muted; muteButton.textContent = muted ? '×' : '♪'; muteButton.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound'); });
fullscreenButton.addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.();
});
document.addEventListener('fullscreenchange', () => fullscreenButton.setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen'));
exitButton.addEventListener('click', () => send('game:exit-request', {}));
resultExitButton.addEventListener('click', () => send('game:exit-request', {}));
shareRunButton.addEventListener('click', async () => {
  if (!lastCompletedResult) return;
  const text = buildChikunShareText(lastCompletedResult, mode);
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
restartButton.addEventListener('click', () => {
  restartButton.disabled = true;
  restartButton.textContent = 'Requesting new run…';
  send('game:restart-request', {});
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && phase === 'running' && !paused) togglePause('visibility', true);
  else if (document.visibilityState === 'visible') { accumulator = 0; previousFrameAt = performance.now(); }
});

latestSnapshot = createChikunRuntime({ seed: 1, maxTicks: MAX_RUN_TICKS }).snapshot();
draw(latestSnapshot);
requestAnimationFrame(frame);

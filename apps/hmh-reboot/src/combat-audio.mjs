import {
  HMH_SFX_CUE_REGISTRY,
  resolveHmhSfxCuePlan,
  resolveHmhSfxVoiceAllocation,
} from '../../portal/src/hmh-audio-system.mjs';

import { HMH_WEAPON_SFX } from './weapon-audio.mjs';

// SFX run on Web Audio (perf step 5/8). Every cue used to construct a new
// HTMLAudioElement(url): a media element, a revalidation of a max-age=0 asset
// and a decoder start on the main thread, up to 16 voices deep in a crowded
// fight. iOS also ignores element `volume`, so the SFX/UI sliders were dead on
// the owner's iPhone. Now each sample is fetched and decoded once, after the
// first gesture, and a cue is an AudioBufferSourceNode -> per-voice gain ->
// SFX or UI bus gain -> destination. Audio stays projection-only: nothing here
// feeds the simulation. Standalone music is still a media element; embedded
// HMH music belongs to the parent's player.
const SAMPLE_PATHS = Object.freeze({
  'silver-collect':'../assets/audio/sfx/hmh-silver-collect.wav',
  'objective-complete':'../assets/audio/sfx/hmh-objective-complete.wav',
  'supply-ready':'../assets/audio/sfx/hmh-supply-ready.wav',
  // C1: per-weapon fire, reload and empty-click, synthesised in-repo. Spread
  // first so a sourced cue of the same name would still win -- these are
  // additions, not overrides.
  ...Object.fromEntries(Object.entries(HMH_WEAPON_SFX).map(([cueId, cue]) => [cueId, cue.src])),
  'weapon-fire': '../assets/audio/sfx/weapon-fire.ogg',
  melee: '../assets/audio/sfx/hmh-melee.wav',
  grenade: '../assets/audio/sfx/hmh-grenade-throw.wav',
  'grenade-boom': '../assets/audio/sfx/hmh-grenade-boom.wav',
  'enemy-hit': '../assets/audio/sfx/hmh-enemy-hit.wav',
  'player-hit': '../assets/audio/sfx/hmh-player-hit.wav',
  'reload-complete': '../assets/audio/sfx/hmh-reload-complete.wav',
  'boss-phase': '../assets/audio/sfx/hmh-boss-phase.wav',
  'boss-hit': '../assets/audio/sfx/hmh-boss-hit.wav',
  'boss-death': '../assets/audio/sfx/hmh-boss-death.wav',
  'enemy-death': '../assets/audio/sfx/hmh-enemy-death.wav',
  'enemy-melee-tell': '../assets/audio/sfx/hmh-enemy-melee-tell.wav',
  'enemy-ranged-tell': '../assets/audio/sfx/hmh-enemy-ranged-tell.wav',
  'combo-reset': '../assets/audio/sfx/hmh-player-hit.wav',
  'combo-milestone': '../assets/audio/sfx/hmh-pickup.wav',
  'combo-boss-threshold': '../assets/audio/sfx/boss-warning.ogg',
  pickup: '../assets/audio/sfx/hmh-pickup.wav',
  'time-dilation-activate': '../assets/audio/sfx/hmh-time-dilation.wav',
  'berserk-activate': '../assets/audio/sfx/hmh-berserk.wav',
  'health-pickup': '../assets/audio/sfx/hmh-health-pickup.wav',
  'ammo-pickup': '../assets/audio/sfx/hmh-ammo-pickup.wav',
  'level-up': '../assets/audio/sfx/hmh-level-up.wav',
  'upgrade-offer': '../assets/audio/sfx/hmh-upgrade-offer.wav',
  'upgrade-pick': '../assets/audio/sfx/hmh-upgrade-pick.wav',
  // A timed effect running out reuses the soft hit sample at low volume; no
  // new file, same "something was taken away" register as combo-reset.
  'powerup-expire': '../assets/audio/sfx/hmh-player-hit.wav',
  dash: '../assets/audio/sfx/hmh-dash.wav',
  land: '../assets/audio/sfx/land.ogg',
  pause: '../assets/audio/sfx/menu-click.ogg',
  resume: '../assets/audio/sfx/menu-click.ogg',
  'low-health': '../assets/audio/sfx/boss-warning.ogg',
  'game-over': '../assets/audio/sfx/game-over.ogg',
  'menu-click': '../assets/audio/sfx/menu-click.ogg',
});
// Owner decision (2026-09-25): no footstep sounds and no voice lines. The
// footstep samples are no longer reachable from any playback path.
const RETIRED_CUES = new Set(['footstep-dirt', 'footstep-road']);
const PRESENTATION_CUE = /^(dash$|land$|combo-|level-up$|upgrade-|powerup-expire$|pause$|resume$|low-health$|game-over$|menu-click$)/;
// 'pickup' is allowed while paused so the pause-menu SFX slider can preview the
// new bus level (Cycle 073, U-5); nothing can be picked up while paused.
const PAUSED_CUE_ALLOWLIST = new Set(['pause', 'upgrade-offer', 'pickup']);
const MUSIC_PATH = '../assets/audio/playlist/hard-money-heroes-16-bit-arcade-music.mp3';
// Longest authored combat sample is well under a second; anything still held
// after this is a voice that will never report completion.
export const MAX_VOICE_LIFETIME_MS = 4_000;
// Cycle 074 (S-2): while a boss-family cue has just started, the lighter
// families are ducked so the warning reads over gunfire. The window is
// time-based on purpose: a boss voice that never reports `ended` must not hold
// the duck for its whole reaped lifetime. Boss, damage and UI are never ducked.
export const BOSS_DUCK_WINDOW_MS = 600;
export const BOSS_DUCK_MUL = 0.7;
const DUCK_EXEMPT_FAMILIES = new Set(['boss', 'damage', 'ui']);
// A touch pointerdown is not a user activation (HTML spec, iOS Safari), so a
// tap unlocks on pointerup/touchend. The listeners stay attached: the next tap
// or key also resumes a context iOS interrupted (call, Siri, another app).
const GESTURE_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'keydown'];
const PRELOAD_CONCURRENCY = 4;
const REFUSALS = new Map();
const refuse = (reason) => {
  let result = REFUSALS.get(reason);
  if (!result) REFUSALS.set(reason, result = Object.freeze({ played: false, reason }));
  return result;
};
const quiet = (pending) => { pending?.catch?.(() => {}); };

function clampMaxVoices(value) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 32) throw new TypeError('maxVoices must be an integer from 1 to 32');
  return numeric;
}

function fetchSampleBytes(path) {
  return fetch(path).then((response) => {
    if (!response.ok) throw new Error(`${response.status} ${path}`);
    return response.arrayBuffer();
  });
}

// WebKit before 14.5 only has the callback form; newer engines return a Promise.
function decodeSample(context, data) {
  return new Promise((resolve, reject) => {
    quiet(context.decodeAudioData(data, resolve, reject)?.then?.(resolve, reject));
  });
}

export function createCombatAudio({
  AudioCtor = globalThis.Audio,
  AudioContextCtor = globalThis.AudioContext ?? globalThis.webkitAudioContext,
  fetchSample = fetchSampleBytes,
  gestureTarget = null,
  visibilityTarget = null,
  maxVoices = 16,
  gameplayOnly = false,
  standalone = false,
  musicEnabled = true,
} = {}) {
  if (standalone && typeof AudioCtor !== 'function') throw new TypeError('Audio constructor is required');
  const voiceCap = clampMaxVoices(maxVoices);
  let sequence = 0;
  let paused = false;
  let unlocked = false;
  let allowMusic = Boolean(musicEnabled);
  let musicLevel = 0.7;
  let sfxLevel = 1;
  let uiLevel = 1;
  let dynamicRange = 'standard';
  let reduceMotion = false;
  let unknownCues = 0;
  let music = null;
  const lastPlayed = new Map();
  const voices = [];
  let unsupported = typeof AudioContextCtor !== 'function';
  let context = null;
  let sfxBus = null;
  let uiBus = null;
  let loading = null;
  const queue = [];
  // path -> AudioBuffer once decoded, null when the fetch or decode failed.
  const buffers = new Map();
  let samplesReady = 0;
  let samplesFailed = 0;

  const isHidden = () => visibilityTarget?.visibilityState === 'hidden';

  const release = (voice) => {
    voice.stopped = true;
    voice.source.disconnect();
    voice.gain.disconnect();
  };

  const stopVoice = (voice) => {
    if (voice.stopped) return;
    try { voice.source.stop(); } catch {}
    release(voice);
  };

  // A voice is released on `ended`, an explicit steal, or age. Age-reaping
  // bounds the pool even if a source never reports completion (a context that
  // was suspended mid-sample, for example).
  const cleanup = (now = null) => {
    let kept = 0;
    for (const voice of voices) {
      if (voice.stopped) continue;
      if (now !== null && now - voice.startedAt > MAX_VOICE_LIFETIME_MS) {
        stopVoice(voice);
        continue;
      }
      voices[kept++] = voice;
    }
    voices.length = kept;
  };

  const applyBuses = () => {
    if (!sfxBus) return;
    const rangeGain = dynamicRange === 'night' ? 0.75 : 1;
    sfxBus.gain.value = sfxLevel * rangeGain;
    uiBus.gain.value = uiLevel * rangeGain;
  };

  const ensureContext = () => {
    if (context || unsupported) return context;
    try {
      context = new AudioContextCtor();
    } catch {
      unsupported = true;
      return null;
    }
    sfxBus = context.createGain();
    uiBus = context.createGain();
    sfxBus.connect(context.destination);
    uiBus.connect(context.destination);
    applyBuses();
    return context;
  };

  // Every sample a cue can reach in this mode, fetched and decoded once.
  const preload = () => {
    if (loading || !context) return loading;
    for (const cue of Object.keys(SAMPLE_PATHS)) {
      const path = SAMPLE_PATHS[cue];
      if (HMH_SFX_CUE_REGISTRY[cue] && !(gameplayOnly && PRESENTATION_CUE.test(cue)) && !queue.includes(path)) queue.push(path);
    }
    const target = context;
    const worker = async () => {
      while (queue.length) {
        const path = queue.shift();
        try {
          buffers.set(path, await decodeSample(target, await fetchSample(path)));
          samplesReady += 1;
        } catch {
          buffers.set(path, null);
          samplesFailed += 1;
        }
      }
    };
    loading = Promise.all(Array.from({ length: PRELOAD_CONCURRENCY }, worker));
    return loading;
  };

  // Called inside a gesture: resume() and a one-sample buffer started there
  // are what open the output on iOS.
  const wake = () => {
    const ctx = ensureContext();
    if (!ctx) return;
    if (ctx.state !== 'running' && !isHidden()) {
      quiet(ctx.resume?.());
      try {
        const blip = ctx.createBufferSource();
        blip.buffer = ctx.createBuffer(1, 1, 22_050);
        blip.connect(ctx.destination);
        blip.start(0);
      } catch {}
    }
    preload();
  };

  const ensureMusic = async () => {
    if (!standalone || !unlocked || !allowMusic || paused) return;
    if (!music) {
      music = new AudioCtor(MUSIC_PATH);
      music.loop = true;
      music.preload = 'auto';
      music.volume = 0.4 * musicLevel;
    }
    try { await music.play(); } catch {}
  };

  const play = (cue, { now = globalThis.performance?.now?.() ?? Date.now(), volume = 0.1, playbackRate = 1 } = {}) => {
    if (RETIRED_CUES.has(cue)) return refuse('cue-retired');
    if (gameplayOnly && PRESENTATION_CUE.test(cue)) return refuse('presentation-cue-disabled');
    if (paused && !PAUSED_CUE_ALLOWLIST.has(cue)) return refuse('paused');
    const samplePath = SAMPLE_PATHS[cue];
    if (!samplePath || !HMH_SFX_CUE_REGISTRY[cue]) {
      unknownCues += 1;
      return refuse('unknown-cue');
    }
    if (unsupported) return refuse('unsupported');
    if (!context) return refuse('locked');
    // A source started into a suspended context would burst out on resume.
    if (context.state !== 'running') return refuse('suspended');
    const buffer = buffers.get(samplePath);
    if (!buffer) {
      if (buffer === null) return refuse('sample-unavailable');
      // Late is worse than silent for a hit or a shot: drop it, but decode
      // this sample next.
      const queued = queue.indexOf(samplePath);
      if (queued > 0) queue.unshift(...queue.splice(queued, 1));
      return refuse('loading');
    }
    cleanup(now);
    const plan = resolveHmhSfxCuePlan(cue, {
      requestedVolume: volume,
      now,
      lastPlayedAt: lastPlayed.get(cue) ?? -Infinity,
      sfxEnabled: true,
      reduceMotion,
    });
    if (!plan.allowed) return refuse(plan.reason);
    const voiceId = `hmh-reboot-audio-${String(sequence).padStart(8, '0')}`;
    const allocation = resolveHmhSfxVoiceAllocation({
      activeVoices: voices,
      incoming: { id: voiceId, family: plan.family, priority: plan.priority, startedAt: now },
      maxVoices: voiceCap,
    });
    if (!allocation.allowed) return refuse(allocation.reason);
    if (allocation.stealVoiceId) {
      const stolen = voices.find((voice) => voice.id === allocation.stealVoiceId);
      if (stolen) stopVoice(stolen);
      cleanup();
    }
    const duckMul = !DUCK_EXEMPT_FAMILIES.has(plan.family)
      && voices.some((voice) => voice.family === 'boss' && !voice.stopped && now - voice.startedAt < BOSS_DUCK_WINDOW_MS)
      ? BOSS_DUCK_MUL
      : 1;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = Number.isFinite(playbackRate) ? Math.max(0.65, Math.min(1.4, playbackRate)) : 1;
    const gain = context.createGain();
    // The bus carries the SFX/UI level and dynamic range; the voice carries
    // the cue plan and the boss duck. Their product is the old element volume.
    gain.gain.value = plan.volume * duckMul;
    source.connect(gain);
    gain.connect(plan.family === 'ui' ? uiBus : sfxBus);
    const voice = {
      id: voiceId,
      family: plan.family,
      priority: plan.priority,
      startedAt: now,
      source,
      gain,
      stopped: false,
    };
    sequence += 1;
    source.onended = () => {
      if (!voice.stopped) release(voice);
      cleanup();
    };
    voices.push(voice);
    lastPlayed.set(cue, now);
    try {
      source.start(0);
    } catch {
      release(voice);
      cleanup();
    }
    return Object.freeze({ played: true, reason: allocation.reason, voiceId, cue });
  };

  const onGesture = () => {
    if (!unlocked) void api.unlock();
    else if (context && context.state !== 'running') wake();
  };
  const onVisibility = () => {
    if (!context) return;
    if (isHidden()) quiet(context.suspend?.());
    else wake();
  };
  for (const type of GESTURE_EVENTS) gestureTarget?.addEventListener(type, onGesture, { capture: true, passive: true });
  visibilityTarget?.addEventListener('visibilitychange', onVisibility);

  const api = Object.freeze({
    play,
    async unlock() {
      unlocked = true;
      // Both must start synchronously, inside the gesture that called us.
      const musicStarting = ensureMusic();
      wake();
      await Promise.all([musicStarting, loading]);
      return Object.freeze({ unlocked: true, musicStarted: Boolean(music && !music.paused) });
    },
    pause() {
      paused = true;
      for (const voice of voices) stopVoice(voice);
      voices.length = 0;
      if (music) music.pause();
    },
    resume() {
      paused = false;
      voices.length = 0;
      void ensureMusic();
    },
    setMusicEnabled(enabled) {
      allowMusic = Boolean(enabled);
      if (!allowMusic && music) music.pause();
      else void ensureMusic();
    },
    setBusLevels({ musicVolume = musicLevel, sfxVolume = sfxLevel, uiVolume = uiLevel, dynamicRange: nextRange = dynamicRange, reduceMotion: nextReduceMotion = reduceMotion } = {}) {
      const level = (value, name) => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1) throw new TypeError(`${name} must be in [0, 1]`);
        return numeric;
      };
      if (!['standard', 'night', 'wide'].includes(nextRange)) throw new TypeError('dynamicRange is invalid');
      musicLevel = level(musicVolume, 'musicVolume');
      sfxLevel = level(sfxVolume, 'sfxVolume');
      uiLevel = level(uiVolume, 'uiVolume');
      dynamicRange = nextRange;
      reduceMotion = Boolean(nextReduceMotion);
      applyBuses();
      if (music) music.volume = 0.4 * musicLevel;
    },
    status() {
      cleanup();
      return Object.freeze({
        activeVoices: voices.length,
        maxVoices: voiceCap,
        unknownCues,
        reduceMotion,
        paused,
        unlocked,
        musicEnabled: allowMusic,
        musicActive: Boolean(music && !music.paused),
        contextState: unsupported ? 'unsupported' : context?.state ?? 'locked',
        samplesReady,
        samplesFailed,
        buses: Object.freeze({ music: musicLevel, sfx: sfxLevel, ui: uiLevel, dynamicRange }),
      });
    },
    destroy() {
      paused = true;
      for (const voice of voices) stopVoice(voice);
      voices.length = 0;
      queue.length = 0;
      for (const type of GESTURE_EVENTS) gestureTarget?.removeEventListener(type, onGesture, true);
      visibilityTarget?.removeEventListener('visibilitychange', onVisibility);
      if (music) {
        music.pause();
        try { music.currentTime = 0; } catch {}
      }
      music = null;
      if (context) quiet(context.close?.());
      context = sfxBus = uiBus = null;
    },
  });
  return api;
}

import {
  HMH_SFX_CUE_REGISTRY,
  resolveHmhSfxCuePlan,
  resolveHmhSfxVoiceAllocation,
} from '../../portal/src/hmh-audio-system.mjs';

import { HMH_WEAPON_SFX } from './weapon-audio.mjs';

const SAMPLE_PATHS = Object.freeze({
  // C1: per-weapon fire, reload and empty-click, synthesised in-repo. Spread
  // first so a sourced cue of the same name would still win -- these are
  // additions, not overrides.
  ...Object.fromEntries(Object.entries(HMH_WEAPON_SFX).map(([cueId, cue]) => [cueId, cue.src])),
  'weapon-fire': '../assets/audio/sfx/weapon-fire.ogg',
  melee: '../assets/audio/sfx/melee.ogg',
  grenade: '../assets/audio/sfx/grenade.ogg',
  'grenade-boom': '../assets/audio/sfx/grenade.ogg',
  'enemy-hit': '../assets/audio/sfx/enemy-hit.ogg',
  'player-hit': '../assets/audio/sfx/player-hit.ogg',
  'boss-phase': '../assets/audio/sfx/boss-warning.ogg',
  'combo-reset': '../assets/audio/sfx/player-hit.ogg',
  'combo-milestone': '../assets/audio/sfx/pickup.ogg',
  'combo-boss-threshold': '../assets/audio/sfx/boss-warning.ogg',
  pickup: '../assets/audio/sfx/pickup.ogg',
  'health-pickup': '../assets/audio/sfx/pickup.ogg',
  'ammo-pickup': '../assets/audio/sfx/pickup.ogg',
  'level-up': '../assets/audio/sfx/level-start.ogg',
  'upgrade-offer': '../assets/audio/sfx/level-start.ogg',
  'upgrade-pick': '../assets/audio/sfx/pickup.ogg',
  dash: '../assets/audio/sfx/jump.ogg',
  land: '../assets/audio/sfx/land.ogg',
  'footstep-dirt': '../assets/audio/sfx/land.ogg',
  'footstep-road': '../assets/audio/sfx/land.ogg',
  pause: '../assets/audio/sfx/menu-click.ogg',
  resume: '../assets/audio/sfx/menu-click.ogg',
  'low-health': '../assets/audio/sfx/boss-warning.ogg',
  'game-over': '../assets/audio/sfx/game-over.ogg',
  'menu-click': '../assets/audio/sfx/menu-click.ogg',
});
const PAUSED_CUE_ALLOWLIST = new Set(['pause', 'upgrade-offer']);
const MUSIC_PATH = '../assets/audio/playlist/hard-money-heroes-16-bit-arcade-music.mp3';
// Longest authored combat sample is well under a second; anything still held
// after this is a voice that will never report completion.
export const MAX_VOICE_LIFETIME_MS = 4_000;

function clampMaxVoices(value) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 32) throw new TypeError('maxVoices must be an integer from 1 to 32');
  return numeric;
}

export function createCombatAudio({
  AudioCtor = globalThis.Audio,
  maxVoices = 16,
  standalone = false,
  musicEnabled = true,
} = {}) {
  if (typeof AudioCtor !== 'function') throw new TypeError('Audio constructor is required');
  const voiceCap = clampMaxVoices(maxVoices);
  let sequence = 0;
  let paused = false;
  let unlocked = false;
  let allowMusic = Boolean(musicEnabled);
  let musicLevel = 0.7;
  let sfxLevel = 1;
  let uiLevel = 1;
  let dynamicRange = 'standard';
  let music = null;
  const lastPlayed = new Map();
  let voices = [];

  // A voice only ever released on `ended` or an explicit steal. A rejected
  // play() (for example an unsupported codec) fires neither, so those voices
  // were immortal and could fill the pool with priority-protected slots until
  // weapon, melee, and hit audio went permanently silent. Age-reaping bounds
  // the pool even when a voice never reports completion.
  const cleanup = (now = null) => {
    voices = voices.filter((voice) => {
      if (voice.audio.ended || voice.stopped) return false;
      if (now !== null && Number.isFinite(voice.startedAt) && now - voice.startedAt > MAX_VOICE_LIFETIME_MS) return false;
      return true;
    });
  };

  const stopVoice = (voice) => {
    voice.stopped = true;
    voice.audio.pause();
    try { voice.audio.currentTime = 0; } catch {}
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

  const play = (cue, { now = globalThis.performance?.now?.() ?? Date.now(), volume = 0.1 } = {}) => {
    if (paused && !PAUSED_CUE_ALLOWLIST.has(cue)) return Object.freeze({ played: false, reason: 'paused' });
    const samplePath = SAMPLE_PATHS[cue];
    if (!samplePath || !HMH_SFX_CUE_REGISTRY[cue]) return Object.freeze({ played: false, reason: 'unknown-cue' });
    cleanup(now);
    const plan = resolveHmhSfxCuePlan(cue, {
      requestedVolume: volume,
      now,
      lastPlayedAt: lastPlayed.get(cue) ?? -Infinity,
      sfxEnabled: true,
    });
    if (!plan.allowed) return Object.freeze({ played: false, reason: plan.reason });
    const voiceId = `hmh-reboot-audio-${String(sequence).padStart(8, '0')}`;
    const allocation = resolveHmhSfxVoiceAllocation({
      activeVoices: voices,
      incoming: { id: voiceId, family: plan.family, priority: plan.priority, startedAt: now },
      maxVoices: voiceCap,
    });
    if (!allocation.allowed) return Object.freeze({ played: false, reason: allocation.reason });
    if (allocation.stealVoiceId) {
      const stolen = voices.find((voice) => voice.id === allocation.stealVoiceId);
      if (stolen) stopVoice(stolen);
      cleanup();
    }
    const audio = new AudioCtor(samplePath);
    audio.preload = 'auto';
    const busLevel = plan.family === 'ui' ? uiLevel : sfxLevel;
    const rangeGain = dynamicRange === 'night' ? 0.75 : 1;
    audio.volume = Math.min(1, plan.volume * busLevel * rangeGain);
    const voice = {
      id: voiceId,
      family: plan.family,
      priority: plan.priority,
      startedAt: now,
      audio,
      stopped: false,
    };
    sequence += 1;
    audio.onended = () => {
      voice.stopped = true;
      cleanup();
    };
    voices.push(voice);
    lastPlayed.set(cue, now);
    try {
      const playResult = audio.play();
      if (playResult?.catch) {
        playResult.catch(() => {
          // Rejected playback never fires `ended`; release the slot now.
          voice.stopped = true;
          cleanup();
        });
      }
    } catch {
      voice.stopped = true;
      cleanup();
    }
    return Object.freeze({ played: true, reason: allocation.reason, voiceId, cue });
  };

  return Object.freeze({
    play,
    async unlock() {
      unlocked = true;
      await ensureMusic();
      return Object.freeze({ unlocked: true, musicStarted: Boolean(music && !music.paused) });
    },
    pause() {
      paused = true;
      for (const voice of voices) stopVoice(voice);
      voices = [];
      if (music) music.pause();
    },
    resume() {
      paused = false;
      voices = [];
      void ensureMusic();
    },
    setMusicEnabled(enabled) {
      allowMusic = Boolean(enabled);
      if (!allowMusic && music) music.pause();
      else void ensureMusic();
    },
    setBusLevels({ musicVolume = musicLevel, sfxVolume = sfxLevel, uiVolume = uiLevel, dynamicRange: nextRange = dynamicRange } = {}) {
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
      if (music) music.volume = 0.4 * musicLevel;
    },
    status() {
      cleanup();
      return Object.freeze({
        activeVoices: voices.length,
        maxVoices: voiceCap,
        paused,
        unlocked,
        musicEnabled: allowMusic,
        musicActive: Boolean(music && !music.paused),
        buses: Object.freeze({ music: musicLevel, sfx: sfxLevel, ui: uiLevel, dynamicRange }),
      });
    },
    destroy() {
      paused = true;
      for (const voice of voices) stopVoice(voice);
      voices = [];
      if (music) {
        music.pause();
        try { music.currentTime = 0; } catch {}
      }
      music = null;
    },
  });
}

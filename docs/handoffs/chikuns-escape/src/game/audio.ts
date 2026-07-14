/**
 * ARISE — Web Audio SFX + looped MP3 soundtrack.
 * SFX are instant one-shots synthesized on the fly. Music is a pre-recorded
 * loop routed through the Web Audio graph so master mute still applies.
 */

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let musicBus: GainNode | null = null;
let sfxBus: GainNode | null = null;
let muted = false;

export function setMuted(next: boolean) {
  muted = next;
  if (masterGain) {
    masterGain.gain.setTargetAtTime(next ? 0 : 0.8, ctxOrNull()?.currentTime ?? 0, 0.02);
  }
  // Music plays through a plain HTMLAudioElement (not the Web Audio graph),
  // so masterGain does not reach it — toggle its volume directly.
  music.applyMute(next);
}
export function isMuted() { return muted; }

function ctxOrNull() { return audioCtx; }

export function ensureAudio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      const Ctor =
        (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      audioCtx = new Ctor();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = muted ? 0 : 0.8;
      masterGain.connect(audioCtx.destination);

      musicBus = audioCtx.createGain();
      musicBus.gain.value = 0.55;
      musicBus.connect(masterGain);

      sfxBus = audioCtx.createGain();
      sfxBus.gain.value = 1;
      sfxBus.connect(masterGain);
    } catch {
      return null;
    }
  }
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function sfx(): AudioNode | null { return sfxBus; }

// ============================================================
// SFX
// ============================================================
export function sfxFlap() {
  const ctx = ensureAudio();
  const dest = sfx();
  if (!ctx || !dest) return;
  const t = ctx.currentTime;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.18), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(1800, t);
  lp.frequency.exponentialRampToValueAtTime(400, t + 0.14);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.22, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  src.connect(lp).connect(g).connect(dest);
  src.start(t);
}

// Coin pickup — classic two-note ding (B5 → E6) that rings out. Every coin
// sounds identical regardless of combo count, so streaks stay satisfying
// instead of turning into a frantic rising blip.
export function sfxCoin(_combo: number) {
  void _combo;
  const ctx = ensureAudio();
  const dest = sfx();
  if (!ctx || !dest) return;
  const t = ctx.currentTime;

  const note = (
    hz: number,
    startOffset: number,
    duration: number,
    peak: number
  ) => {
    const start = t + startOffset;
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(hz, start);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    o.connect(g).connect(dest);
    o.start(start);
    o.stop(start + duration + 0.02);
  };

  // Two-note ring-out: the low note sets up, the high note holds long enough
  // to actually ring rather than feeling clipped.
  note(988, 0, 0.14, 0.32);     // B5 — short announcement
  note(1318, 0.12, 0.36, 0.36); // E6 — held, the satisfying part

  // High E7 sparkle overtone that sustains under the second note.
  const spark = ctx.createOscillator();
  spark.type = "sine";
  spark.frequency.setValueAtTime(2637, t + 0.12);
  const sparkG = ctx.createGain();
  sparkG.gain.setValueAtTime(0.0001, t + 0.12);
  sparkG.gain.exponentialRampToValueAtTime(0.09, t + 0.128);
  sparkG.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
  spark.connect(sparkG).connect(dest);
  spark.start(t + 0.12);
  spark.stop(t + 0.44);
}

export function sfxTowerPass() {
  const ctx = ensureAudio();
  const dest = sfx();
  if (!ctx || !dest) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = "square";
  o.frequency.setValueAtTime(540, t);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.05, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + 0.08);
}

export function sfxDeath() {
  const ctx = ensureAudio();
  const dest = sfx();
  if (!ctx || !dest) return;
  const t = ctx.currentTime;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.45), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(2200, t);
  lp.frequency.exponentialRampToValueAtTime(300, t + 0.4);
  const g1 = ctx.createGain();
  g1.gain.setValueAtTime(0.3, t);
  g1.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  src.connect(lp).connect(g1).connect(dest);
  src.start(t);

  const o = ctx.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(190, t);
  o.frequency.exponentialRampToValueAtTime(38, t + 0.55);
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.35, t);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
  o.connect(g2).connect(dest);
  o.start(t);
  o.stop(t + 0.65);
}

// Power-up pickup — quick rising arpeggio.
export function sfxPowerup() {
  const ctx = ensureAudio();
  const dest = sfx();
  if (!ctx || !dest) return;
  const t0 = ctx.currentTime;
  const notes = [660, 880, 1320];
  notes.forEach((f, i) => {
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(f, t0 + i * 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0 + i * 0.05);
    g.gain.exponentialRampToValueAtTime(0.18, t0 + i * 0.05 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.05 + 0.18);
    o.connect(g).connect(dest);
    o.start(t0 + i * 0.05);
    o.stop(t0 + i * 0.05 + 0.22);
  });
}

// Shield hit — low thunk, the shield absorbing a blow.
export function sfxShieldHit() {
  const ctx = ensureAudio();
  const dest = sfx();
  if (!ctx || !dest) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(220, t);
  o.frequency.exponentialRampToValueAtTime(80, t + 0.25);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.35, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + 0.32);
}

// Short buzzy chord used when entering a new zone.
export function sfxZone() {
  const ctx = ensureAudio();
  const dest = sfx();
  if (!ctx || !dest) return;
  const t = ctx.currentTime;
  const freqs = [330, 415, 494];
  freqs.forEach((f) => {
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(f, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.08, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1600;
    o.connect(lp).connect(g).connect(dest);
    o.start(t);
    o.stop(t + 0.72);
  });
}

// Boss warning klaxon — alternating tones.
export function sfxBossWarn() {
  const ctx = ensureAudio();
  const dest = sfx();
  if (!ctx || !dest) return;
  const t = ctx.currentTime;
  for (let i = 0; i < 3; i++) {
    const o = ctx.createOscillator();
    o.type = "square";
    o.frequency.setValueAtTime(i % 2 === 0 ? 440 : 330, t + i * 0.14);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t + i * 0.14);
    g.gain.exponentialRampToValueAtTime(0.15, t + i * 0.14 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.14 + 0.12);
    o.connect(g).connect(dest);
    o.start(t + i * 0.14);
    o.stop(t + i * 0.14 + 0.14);
  }
}

// Boss defeat / zone cleared — triumphant rising run.
export function sfxTriumph() {
  const ctx = ensureAudio();
  const dest = sfx();
  if (!ctx || !dest) return;
  const t0 = ctx.currentTime;
  const notes = [523, 659, 784, 1047];
  notes.forEach((f, i) => {
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(f, t0 + i * 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0 + i * 0.08);
    g.gain.exponentialRampToValueAtTime(0.22, t0 + i * 0.08 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.08 + 0.34);
    o.connect(g).connect(dest);
    o.start(t0 + i * 0.08);
    o.stop(t0 + i * 0.08 + 0.4);
  });
}

// Combo "ch-ching" — fires on streak milestones (every 10 coins). A rising
// three-note arpeggio on top of the normal coin sound, with a shimmer tail,
// so hitting a 10-streak feels meaningfully bigger than a single coin.
export function sfxComboChing() {
  const ctx = ensureAudio();
  const dest = sfx();
  if (!ctx || !dest) return;
  const t = ctx.currentTime;

  // Rising arpeggio: E6 → G#6 → B6 (major triad feel).
  const notes: Array<[number, number]> = [
    [1318, 0],     // E6
    [1661, 0.08],  // G#6
    [1976, 0.16],  // B6
  ];
  for (const [hz, offset] of notes) {
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(hz, t + offset);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t + offset);
    g.gain.exponentialRampToValueAtTime(0.3, t + offset + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.28);
    o.connect(g).connect(dest);
    o.start(t + offset);
    o.stop(t + offset + 0.3);
  }

  // Sustained B7 shimmer under the arpeggio for the "ching" tail.
  const shimmer = ctx.createOscillator();
  shimmer.type = "sine";
  shimmer.frequency.setValueAtTime(3951, t + 0.04);
  const shG = ctx.createGain();
  shG.gain.setValueAtTime(0.0001, t + 0.04);
  shG.gain.exponentialRampToValueAtTime(0.12, t + 0.06);
  shG.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
  shimmer.connect(shG).connect(dest);
  shimmer.start(t + 0.04);
  shimmer.stop(t + 0.62);
}

// Crowd chant swell — filtered noise bed with a rising vowel formant.
export function sfxChant() {
  const ctx = ensureAudio();
  const dest = sfx();
  if (!ctx || !dest) return;
  const t = ctx.currentTime;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 1.4), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.6;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 4;
  bp.frequency.setValueAtTime(400, t);
  bp.frequency.linearRampToValueAtTime(1100, t + 1.1);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.22, t + 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
  src.connect(bp).connect(g).connect(dest);
  src.start(t);
}

// ============================================================
// MUSIC — pre-recorded soundtrack played by a plain HTMLAudioElement. It does
// NOT go through the Web Audio graph — some browsers silently fail to route an
// element through createMediaElementSource, which causes the track to leak
// out at full volume alongside any gain-controlled copy. Going direct is
// simpler and predictable. Volume sits well below SFX so it reads as
// background music.
// ============================================================
export const MUSIC_URL = "/arise/soundtrack.mp3";

// Absolute element volume (0..1). SFX bus runs at ~0.8 absolute after master
// gain, so 0.25 puts music roughly a third the loudness of SFX — clearly
// background, won't mask coin/flap hits.
const MUSIC_VOLUME = 0.25;

// Registry pinned to `window` so every soundtrack audio element in the page
// (game singleton, homepage tile, anything else that registers) is tracked in
// one place — even across HMR reloads that would otherwise orphan an old
// `new Audio()` and leave it playing ghost-like in the background. Start()
// calls pauseOtherSoundtracks(self) to guarantee only one plays at a time.
type TrackRegistry = Set<HTMLAudioElement>;
const REGISTRY_KEY = "__ariseSoundtrackRegistry";

function getRegistry(): TrackRegistry | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { [k: string]: unknown };
  if (!(w[REGISTRY_KEY] instanceof Set)) {
    w[REGISTRY_KEY] = new Set<HTMLAudioElement>();
  }
  return w[REGISTRY_KEY] as TrackRegistry;
}

export function registerSoundtrack(el: HTMLAudioElement) {
  getRegistry()?.add(el);
}

export function unregisterSoundtrack(el: HTMLAudioElement) {
  getRegistry()?.delete(el);
}

export function pauseOtherSoundtracks(except: HTMLAudioElement | null) {
  const reg = getRegistry();
  if (!reg) return;
  for (const el of Array.from(reg)) {
    if (el === except) continue;
    try {
      el.pause();
    } catch {}
    try {
      el.currentTime = 0;
    } catch {}
    el.volume = 0;
  }
}

class Music {
  private audioEl: HTMLAudioElement | null = null;
  private started = false;
  private fadeRaf: number | null = null;
  private pauseTimer: number | null = null;

  private initElement(): HTMLAudioElement | null {
    if (typeof window === "undefined") return null;
    if (this.audioEl) return this.audioEl;
    // Re-use an element left behind by a previous HMR load if one exists —
    // creating a second `new Audio()` while the old one is still playing is
    // exactly what produced the "two soundtracks at once" bug.
    const w = window as unknown as {
      __ariseGameMusicEl?: HTMLAudioElement;
    };
    let el = w.__ariseGameMusicEl;
    if (el) {
      try {
        el.pause();
      } catch {}
      try {
        el.currentTime = 0;
      } catch {}
    } else {
      el = new Audio(MUSIC_URL);
      el.loop = true;
      el.preload = "auto";
      w.__ariseGameMusicEl = el;
    }
    el.volume = 0;
    this.audioEl = el;
    registerSoundtrack(el);
    return el;
  }

  private cancelFade() {
    if (this.fadeRaf !== null) {
      cancelAnimationFrame(this.fadeRaf);
      this.fadeRaf = null;
    }
    if (this.pauseTimer !== null) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }
  }

  private fadeVolume(target: number, durationMs: number, after?: () => void) {
    this.cancelFade();
    const el = this.audioEl;
    if (!el) {
      after?.();
      return;
    }
    const start = el.volume;
    const t0 = performance.now();
    const step = () => {
      const now = performance.now();
      const k = Math.min(1, (now - t0) / durationMs);
      el.volume = start + (target - start) * k;
      if (k < 1) {
        this.fadeRaf = requestAnimationFrame(step);
      } else {
        this.fadeRaf = null;
        after?.();
      }
    };
    this.fadeRaf = requestAnimationFrame(step);
  }

  start() {
    const el = this.initElement();
    if (!el) return;
    // Defensive: silence every other registered soundtrack element before we
    // start — covers navigation-from-homepage cases, and HMR orphans.
    pauseOtherSoundtracks(el);
    // First start per mount: rewind to zero, play, fade in to MUSIC_VOLUME.
    // Subsequent calls (new run after death) are no-ops so the loop keeps
    // playing uninterrupted.
    if (!this.started) {
      this.cancelFade();
      try {
        el.currentTime = 0;
      } catch {
        // Safari may throw if the element isn't ready yet; harmless.
      }
      el.volume = 0;
      el.play().catch(() => {
        // Autoplay blocked (no user gesture yet) — fade-in target will apply
        // once a gesture-triggered call reaches us.
      });
      this.fadeVolume(muted ? 0 : MUSIC_VOLUME, 500);
      this.started = true;
    }
  }

  // Preserved for API compatibility — the MP3 plays at a fixed volume, so
  // score-based layering no longer applies.
  setLayers(_level: number) {
    void _level;
  }

  setKey(_accentHz: number) {
    void _accentHz;
  }

  tick() {}

  // Called by setMuted() so master mute still silences music without routing
  // through the Web Audio graph.
  applyMute(isMutedNow: boolean) {
    const el = this.audioEl;
    if (!el || !this.started) return;
    this.fadeVolume(isMutedNow ? 0 : MUSIC_VOLUME, 120);
  }

  stop() {
    const el = this.audioEl;
    this.started = false;
    if (!el) return;
    // Fade out, then pause at the end. Short enough that there's no real
    // overlap if the user navigates fast, long enough to avoid an abrupt cut.
    this.fadeVolume(0, 150, () => {
      el.pause();
      try {
        el.currentTime = 0;
      } catch {}
    });
  }
}

export const music = new Music();

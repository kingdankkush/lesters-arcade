"use client";

/**
 * ARISE — Chikun's flight game.
 *
 * Core loop: tap / click / space to flap. Dodge Big Corp towers. Collect silver
 * LTC coins. Lifetime coins bank to spend on cosmetic skins and trails.
 *
 * Content & static data live in `./game/config.ts`.
 * Audio (SFX + layered procedural music) lives in `./game/audio.ts`.
 * Sprite loading + background removal lives in `./game/sprites.ts`.
 * Save state lives in `./game/storage.ts`.
 */

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  CFG,
  COLORS,
  ZONES,
  getZoneIndex,
  getZone,
  getBlendedPalette,
  SKINS,
  TRAILS,
  ACHIEVEMENTS,
  HEADLINES,
  VILLAIN_TAUNTS,
  VIGNETTES,
  type ZonePalette,
  type Skin,
  type Trail,
} from "./game/config";
import {
  loadSave,
  saveState,
  updateSave,
  todaySeed,
  seededRng,
  submitLeaderboardEntry,
  LEADERBOARD_SIZE,
  type SaveState,
} from "./game/storage";
import {
  ensureAudio,
  setMuted as setAudioMuted,
  sfxFlap,
  sfxCoin,
  sfxComboChing,
  sfxTowerPass,
  sfxDeath,
  sfxPowerup,
  sfxShieldHit,
  sfxZone,
  sfxBossWarn,
  sfxTriumph,
  sfxChant,
  music,
} from "./game/audio";
import {
  loadImage,
  removeSpriteBackground,
  tintSprite,
  cropSprite,
  SPRITE_SRCS,
  type SpriteSource,
} from "./game/sprites";

// ============================================================
// TYPES
// ============================================================
type GameState = "idle" | "playing" | "gameover" | "boss";

type TowerKind = "static" | "sway" | "panel";

interface Tower {
  x: number;
  gapY: number;
  passed: boolean;
  kind: TowerKind;
  phase: number;
}

interface Coin {
  x: number;
  y: number;
  collected: boolean;
}

interface Feather {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  life: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  color: string;
}

interface ScorePopup {
  x: number;
  y: number;
  vy: number;
  life: number;
  text: string;
  color: string;
}

interface Cloud {
  x: number;
  y: number;
  scale: number;
  speed: number;
  layer: number;
}

type PowerUpKind = "shield" | "magnet" | "slowmo";

interface PowerUp {
  x: number;
  y: number;
  kind: PowerUpKind;
  collected: boolean;
  bobT: number;
}

interface Drone {
  x: number;
  y: number;
  vx: number;
  vy: number;
  state: "approach" | "chase" | "dead";
  life: number;
  targetY: number;
}

interface Missile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  kind: "missile" | "drone";
}

type BossKind = "heli" | "swarm" | "ceo";
type BossPhase = "warn" | "fight" | "defeat";

interface BossState {
  phase: BossPhase;
  kind: BossKind;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  tBorn: number;
  nextAttackAt: number;
  zoneIdx: number;
}

interface ZoneBanner {
  zoneIdx: number;
  startedAt: number;
}

interface Headline {
  text: string;
  x: number;
}

// ============================================================
// SPRITE CACHES
// ============================================================
interface SpriteBundle {
  flap: SpriteSource | null;
  coast: SpriteSource | null;
  fall: SpriteSource | null;
  tower: SpriteSource | null;
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function ArisGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const baseSpritesRef = useRef<SpriteBundle>({
    flap: null, coast: null, fall: null, tower: null,
  });
  const tintedSpriteCacheRef = useRef<Map<string, SpriteBundle>>(new Map());
  const [assetsReady, setAssetsReady] = useState(false);

  // ---- Closure mirror refs: RAF tick only sees the update/render versions
  // captured when the game-loop useEffect first ran, so we forward latest
  // versions through refs that are re-assigned on every React render. ----
  const updateRef = useRef<(dt: number, now: number, frameScale: number) => void>(() => {});
  const renderRef = useRef<(ctx: CanvasRenderingContext2D, dpr: number) => void>(
    () => {}
  );

  // ---- Core game refs ----
  const stateRef = useRef<GameState>("idle");
  const chikunRef = useRef({ y: CFG.canvas.h / 2, vy: 0, lastFlap: 0 });
  const towersRef = useRef<Tower[]>([]);
  const coinsRef = useRef<Coin[]>([]);
  const feathersRef = useRef<Feather[]>([]);
  const sparksRef = useRef<Spark[]>([]);
  const popupsRef = useRef<ScorePopup[]>([]);
  const cloudsRef = useRef<Cloud[]>([]);
  const powerUpsRef = useRef<PowerUp[]>([]);
  const dronesRef = useRef<Drone[]>([]);
  const missilesRef = useRef<Missile[]>([]);
  const headlinesRef = useRef<Headline[]>([]);

  const scoreRef = useRef(0);
  const coinCountRef = useRef(0);
  const comboRef = useRef(0);
  const maxComboThisRunRef = useRef(0);
  const towersPassedRef = useRef(0);
  const flapsThisRunRef = useRef(0);
  const scrollSpeedRef = useRef(CFG.scroll.initial);
  const worldXRef = useRef(0);
  const noHitThisRunRef = useRef(true);
  const noCoinsThisRunRef = useRef(true);

  // Juice refs
  const shakeRef = useRef(0);
  const hitStopUntilRef = useRef(0);
  const flapScaleTRef = useRef(0);
  const trailRef = useRef<Array<{ x: number; y: number }>>([]);
  const deathFlashUntilRef = useRef(0);

  // Zones / transitions
  const currentZoneIdxRef = useRef(0);
  const zoneBannerRef = useRef<ZoneBanner | null>(null);
  const paletteRef = useRef<ZonePalette>(ZONES[0].palette);

  // Power-up active timers
  const shieldUntilRef = useRef(0);
  const magnetUntilRef = useRef(0);
  const slowmoUntilRef = useRef(0);

  // Boss state
  const bossRef = useRef<BossState | null>(null);
  const bossCooldownRef = useRef(false); // set true after boss, reset when normal spawn resumes

  // Count-up score animation for gameover
  const displayScoreRef = useRef(0);
  const gameoverAtRef = useRef(0);

  // Narrative beat selected per death
  const currentTauntRef = useRef<string>("");
  const currentVignetteRef = useRef<string>("");

  // Tutorial hint (shown first-run on idle)
  const [tutorialVisible, setTutorialVisible] = useState(false);

  // ---- UI state ----
  const [uiState, setUiState] = useState<GameState>("idle");
  const [lastScore, setLastScore] = useState(0);
  const [lastCoins, setLastCoins] = useState(0);
  const [lastTowers, setLastTowers] = useState(0);
  const [lastMaxCombo, setLastMaxCombo] = useState(0);
  const [lastZoneIdx, setLastZoneIdx] = useState(0);
  const [displayScoreState, setDisplayScoreState] = useState(0);
  const [save, setSaveUi] = useState<SaveState | null>(null);
  const [showShop, setShowShop] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [paused, setPaused] = useState(false);
  const [newAchievements, setNewAchievements] = useState<string[]>([]);
  const [shareToast, setShareToast] = useState("");
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [nameInput, setNameInput] = useState("");
  // null = nothing submitted this run; rank>0 = made the top 20; rank=null = recorded but missed.
  const [submissionResult, setSubmissionResult] = useState<
    { submitted: boolean; rank: number | null } | null
  >(null);
  // YouTube-style fullscreen: user opts in via a button. No auto-rotate
  // prompt, no auto-fullscreen-on-landscape. The page lays out the same
  // on mobile as desktop (game frame + leaderboard below), but the user
  // can tap the maximize button in the HUD to expand the canvas.
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Mirror window.innerHeight into a CSS variable for fullscreen mode
  // — iOS Safari's `100dvh` updates lazily after orientation change.
  useEffect(() => {
    const setVh = () => {
      document.documentElement.style.setProperty(
        "--arise-vh-px",
        `${window.innerHeight}px`
      );
    };
    setVh();
    window.addEventListener("resize", setVh);
    window.addEventListener("orientationchange", setVh);
    return () => {
      window.removeEventListener("resize", setVh);
      window.removeEventListener("orientationchange", setVh);
    };
  }, []);

  // Body class drives the CSS that hides nav/footer/leaderboard while
  // in fullscreen. Also tries the real Fullscreen API where supported
  // (Chrome/Android/desktop). iOS Safari doesn't expose it, so the CSS
  // fallback covers that case.
  useEffect(() => {
    if (isFullscreen) {
      document.body.classList.add("is-arise-fullscreen");
      const el = document.documentElement;
      const req =
        el.requestFullscreen ||
        (el as unknown as { webkitRequestFullscreen?: () => Promise<void> })
          .webkitRequestFullscreen;
      if (req) {
        try {
          req.call(el)?.catch(() => {});
        } catch {}
      }
    } else {
      document.body.classList.remove("is-arise-fullscreen");
      const exit =
        document.exitFullscreen ||
        (document as unknown as { webkitExitFullscreen?: () => Promise<void> })
          .webkitExitFullscreen;
      if (exit && document.fullscreenElement) {
        try {
          exit.call(document)?.catch(() => {});
        } catch {}
      }
    }
    return () => {
      document.body.classList.remove("is-arise-fullscreen");
    };
  }, [isFullscreen]);

  // If the user exits fullscreen via Esc / system gesture, sync state.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setIsFullscreen(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // ============================================================
  // LIFECYCLE — asset load, save load
  // ============================================================
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        Object.entries(SPRITE_SRCS).map(async ([k, spec]) => {
          const img = await loadImage(spec.src);
          if (!img) return [k, null] as const;
          let processed: SpriteSource = spec.removeBg
            ? removeSpriteBackground(img)
            : img;
          if (spec.cropPct) {
            const w =
              (processed as HTMLImageElement).naturalWidth ||
              (processed as HTMLCanvasElement).width;
            const h =
              (processed as HTMLImageElement).naturalHeight ||
              (processed as HTMLCanvasElement).height;
            processed = cropSprite(processed, {
              top: Math.round(h * (spec.cropPct.top ?? 0)),
              right: Math.round(w * (spec.cropPct.right ?? 0)),
              bottom: Math.round(h * (spec.cropPct.bottom ?? 0)),
              left: Math.round(w * (spec.cropPct.left ?? 0)),
            });
          }
          return [k, processed] as const;
        })
      );
      if (cancelled) return;
      const bundle = Object.fromEntries(entries) as unknown as SpriteBundle;
      baseSpritesRef.current = bundle;
      setAssetsReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const s = loadSave();
    setSaveUi(s);
    setAudioMuted(s.muted);
    if (!s.seenTutorial) setTutorialVisible(true);
    // Seed cloud layer so idle looks alive
    cloudsRef.current = seedClouds();
    // Seed scrolling headlines
    headlinesRef.current = seedHeadlines();
    // Stop the music when the player leaves the page. Starts on first flap
    // (a user gesture that unlocks audio) and continues across deaths.
    return () => {
      music.stop();
    };
  }, []);

  // Detect portrait orientation on small screens — the game is 16:9 and
  // cramming it into portrait leaves Chikun tiny. Show a rotate-device prompt

  // ============================================================
  // SPRITE SKIN HELPERS
  // ============================================================
  const getSkinSprites = useCallback((skinId: string): SpriteBundle => {
    const base = baseSpritesRef.current;
    const skin = SKINS.find((s) => s.id === skinId) ?? SKINS[0];
    if (!skin.tint) return base;
    const cache = tintedSpriteCacheRef.current;
    const hit = cache.get(skinId);
    if (hit) return hit;
    const bundle: SpriteBundle = {
      flap: base.flap ? tintSprite(base.flap, skin.tint) : null,
      coast: base.coast ? tintSprite(base.coast, skin.tint) : null,
      fall: base.fall ? tintSprite(base.fall, skin.tint) : null,
      tower: base.tower,
    };
    cache.set(skinId, bundle);
    return bundle;
  }, []);

  // ============================================================
  // SAVE HELPERS
  // ============================================================
  const mutateSave = useCallback((patch: Partial<SaveState>) => {
    const next = updateSave(patch);
    setSaveUi(next);
    return next;
  }, []);

  const toggleMute = useCallback(() => {
    if (!save) return;
    const next = !save.muted;
    setAudioMuted(next);
    mutateSave({ muted: next });
  }, [save, mutateSave]);

  const toggleHaptics = useCallback(() => {
    if (!save) return;
    mutateSave({ hapticsEnabled: !save.hapticsEnabled });
  }, [save, mutateSave]);

  const toggleReducedMotion = useCallback(() => {
    if (!save) return;
    mutateSave({ reducedMotion: !save.reducedMotion });
  }, [save, mutateSave]);

  const haptic = useCallback(
    (pattern: number | number[]) => {
      if (!save?.hapticsEnabled) return;
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(pattern);
        } catch {}
      }
    },
    [save]
  );

  // ============================================================
  // GAME LIFECYCLE
  // ============================================================
  const resetGame = useCallback(() => {
    chikunRef.current = { y: CFG.canvas.h / 2, vy: 0, lastFlap: 0 };
    towersRef.current = [];
    coinsRef.current = [];
    feathersRef.current = [];
    sparksRef.current = [];
    popupsRef.current = [];
    powerUpsRef.current = [];
    dronesRef.current = [];
    missilesRef.current = [];
    trailRef.current = [];
    scoreRef.current = 0;
    coinCountRef.current = 0;
    comboRef.current = 0;
    maxComboThisRunRef.current = 0;
    towersPassedRef.current = 0;
    flapsThisRunRef.current = 0;
    scrollSpeedRef.current = CFG.scroll.initial;
    shakeRef.current = 0;
    hitStopUntilRef.current = 0;
    flapScaleTRef.current = 0;
    deathFlashUntilRef.current = 0;
    currentZoneIdxRef.current = 0;
    zoneBannerRef.current = null;
    paletteRef.current = ZONES[0].palette;
    shieldUntilRef.current = 0;
    magnetUntilRef.current = 0;
    slowmoUntilRef.current = 0;
    bossRef.current = null;
    bossCooldownRef.current = false;
    noHitThisRunRef.current = true;
    noCoinsThisRunRef.current = true;
    displayScoreRef.current = 0;
    setDisplayScoreState(0);
  }, []);

  const spawnFirstTower = () => {
    towersRef.current.push({
      x: CFG.canvas.w + CFG.tower.firstTowerXOffset,
      gapY: CFG.canvas.h / 2,
      passed: false,
      kind: "static",
      phase: 0,
    });
    coinsRef.current.push({
      x: CFG.canvas.w + CFG.tower.firstTowerXOffset,
      y: CFG.canvas.h / 2,
      collected: false,
    });
  };

  const startGame = useCallback(() => {
    resetGame();
    chikunRef.current.vy = CFG.physics.flapV;
    chikunRef.current.lastFlap = performance.now();
    flapScaleTRef.current = 1;
    flapsThisRunRef.current = 1;
    spawnFirstTower();
    currentVignetteRef.current =
      VIGNETTES[Math.floor(Math.random() * VIGNETTES.length)];
    ensureAudio();
    music.start();
    sfxFlap();
    haptic(12);
    stateRef.current = "playing";
    setUiState("playing");
    setTutorialVisible(false);
    if (save && !save.seenTutorial) mutateSave({ seenTutorial: true });
  }, [resetGame, haptic, save, mutateSave]);

  const endGame = useCallback(() => {
    if (stateRef.current === "gameover") return;
    stateRef.current = "gameover";
    gameoverAtRef.current = performance.now();

    const finalScore = scoreRef.current;
    const finalCoins = coinCountRef.current;
    const finalTowers = towersPassedRef.current;
    const finalCombo = maxComboThisRunRef.current;
    const finalZoneIdx = currentZoneIdxRef.current;
    setLastScore(finalScore);
    setLastCoins(finalCoins);
    setLastTowers(finalTowers);
    setLastMaxCombo(finalCombo);
    setLastZoneIdx(finalZoneIdx);
    setDisplayScoreState(0);
    displayScoreRef.current = 0;

    // Persist — coins bank, lifetime stats, high score, achievements
    const cur = loadSave();
    const patch: Partial<SaveState> = {
      bankedCoins: cur.bankedCoins + finalCoins,
      lifetimeCoins: cur.lifetimeCoins + finalCoins,
      lifetimeTowers: cur.lifetimeTowers + finalTowers,
      lifetimeRuns: cur.lifetimeRuns + 1,
      lifetimeFlaps: cur.lifetimeFlaps + flapsThisRunRef.current,
      lifetimeDeaths: cur.lifetimeDeaths + 1,
      bestCombo: Math.max(cur.bestCombo, finalCombo),
      maxZoneReached: Math.max(cur.maxZoneReached, finalZoneIdx + 1),
      highScore: Math.max(cur.highScore, finalScore),
    };
    // Daily challenge high-water mark
    const seed = todaySeed();
    if (cur.lastDailySeed === seed) {
      patch.dailyBestScore = Math.max(cur.dailyBestScore, finalScore);
    } else {
      patch.lastDailySeed = seed;
      patch.dailyBestScore = finalScore;
    }
    // Achievement checks
    const newlyUnlocked: string[] = [];
    const ctx = {
      runScore: finalScore,
      runCoins: finalCoins,
      runTowers: finalTowers,
      runMaxCombo: finalCombo,
      runNoHit: noHitThisRunRef.current,
      runNoCoins: noCoinsThisRunRef.current && finalTowers > 0,
      lifetimeCoins: (patch.lifetimeCoins ?? cur.lifetimeCoins),
      lifetimeTowers: (patch.lifetimeTowers ?? cur.lifetimeTowers),
      lifetimeRuns: (patch.lifetimeRuns ?? cur.lifetimeRuns),
      highScore: (patch.highScore ?? cur.highScore),
      zonesReached: finalZoneIdx + 1,
    };
    for (const a of ACHIEVEMENTS) {
      if (!cur.achievements.includes(a.id) && a.check(ctx)) {
        newlyUnlocked.push(a.id);
      }
    }
    if (newlyUnlocked.length) {
      patch.achievements = [...cur.achievements, ...newlyUnlocked];
    }
    const next = updateSave(patch);
    setSaveUi(next);
    setNewAchievements(newlyUnlocked);

    // Leaderboard — always offer the prompt so every player names their run.
    // Previous handle pre-fills so returning players can just hit Enter.
    setSubmissionResult(null);
    if (finalScore > 0) {
      setNameInput(next.playerName || "");
      setShowNamePrompt(true);
    } else {
      setShowNamePrompt(false);
    }

    // Death juice
    const c = chikunRef.current;
    for (let i = 0; i < CFG.featherOnDeath; i++) {
      feathersRef.current.push(spawnFeather(CFG.chikun.x, c.y, 3.5));
    }
    for (let i = 0; i < 14; i++) {
      sparksRef.current.push(spawnSpark(CFG.chikun.x, c.y, 4.5, COLORS.red));
    }
    shakeRef.current = CFG.juice.deathShake;
    hitStopUntilRef.current = performance.now() + CFG.juice.hitStopMs;
    deathFlashUntilRef.current = performance.now() + CFG.juice.deathFlashMs;
    comboRef.current = 0;
    currentTauntRef.current =
      VILLAIN_TAUNTS[Math.floor(Math.random() * VILLAIN_TAUNTS.length)];
    sfxDeath();
    haptic([0, 60, 40, 80]);
    setUiState("gameover");
  }, [haptic]);

  const flap = useCallback(() => {
    if (paused) return;
    if (showNamePrompt) return; // block restart while the name entry is open
    const st = stateRef.current;
    if (st === "idle" || st === "gameover") {
      startGame();
      return;
    }
    chikunRef.current.vy = CFG.physics.flapV;
    chikunRef.current.lastFlap = performance.now();
    flapScaleTRef.current = 1;
    flapsThisRunRef.current += 1;
    for (let i = 0; i < CFG.featherOnFlap; i++) {
      feathersRef.current.push(spawnFeather(CFG.chikun.x, chikunRef.current.y, 1.8));
    }
    sfxFlap();
    haptic(8);
  }, [startGame, haptic, paused, showNamePrompt]);

  // ============================================================
  // INPUT
  // ============================================================
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore game hotkeys while the user is typing in an input (name prompt).
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) return;
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        if (e.repeat) return;
        e.preventDefault();
        flap();
      } else if (e.code === "KeyM") {
        toggleMute();
      } else if (e.code === "KeyP" || e.code === "Escape") {
        if (stateRef.current === "playing") setPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flap, toggleMute]);

  const handlePointer = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (showShop || showStats || showAchievements || showSettings || showShare) return;
      flap();
    },
    [flap, showShop, showStats, showAchievements, showSettings, showShare]
  );

  // Keep RAF's callable versions of update/render current across React re-renders.
  useEffect(() => {
    updateRef.current = update;
    renderRef.current = render;
  });

  // ============================================================
  // GAME LOOP
  // ============================================================
  useEffect(() => {
    if (!assetsReady) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Cap DPR aggressively on touch devices. A 3× retina canvas at
    // 1280×720 logical = 3840×2160 of pixels (4K) per frame — mobile
    // GPUs choke on this and the canvas-blit cost drags down rAF
    // intervals so much the game appears to run in slow-motion. Capping
    // at 1 drops pixel count by 89% with negligible visual cost on a
    // small screen. Desktop keeps native DPR for crisp rendering.
    const isMobile =
      typeof window !== "undefined" &&
      (window.matchMedia("(hover: none)").matches ||
        window.innerWidth < 900);
    const rawDpr = window.devicePixelRatio || 1;
    const dpr = isMobile ? 1 : rawDpr;
    canvas.width = CFG.canvas.w * dpr;
    canvas.height = CFG.canvas.h * dpr;

    // Two completely separate loops — desktop and mobile — so I can
    // iterate on mobile without ever touching the desktop game feel.
    let lastTime = performance.now();
    const onVisibility = () => {
      if (!document.hidden) lastTime = performance.now();
    };
    document.addEventListener("visibilitychange", onVisibility);

    let tick: (now: number) => void;
    if (isMobile) {
      // MOBILE LOOP — dt cap 100, then frameScale = 3 × (dt / 16.667).
      // The constant 3 boost is the per-second speed multiplier vs the
      // 60Hz desktop tuning: mobile will run at ~180 game-ups/sec
      // regardless of the actual frame rate (60fps → physics × 3,
      // 30fps → physics × 6, both give 180 ups). DO NOT clamp at 1 —
      // that prevents the boost from kicking in on devices that hit
      // 60fps. If 3× is still not fast enough, raise the constant. If
      // it's TOO fast, lower it. Easy single dial.
      const MOBILE_BOOST = 4;
      tick = (now: number) => {
        const dt = Math.min(100, now - lastTime);
        lastTime = now;
        const frameScale = (dt / (1000 / 60)) * MOBILE_BOOST;
        updateRef.current(dt, now, frameScale);
        renderRef.current(ctx, dpr);
        rafRef.current = requestAnimationFrame(tick);
      };
    } else {
      // DESKTOP LOOP — original code, byte-identical to the version that
      // shipped before any mobile work. Always passes frameScale=1 so the
      // update function's per-frame physics behave exactly like the
      // pre-fix tuning. DO NOT MODIFY THIS BRANCH for mobile-only fixes.
      tick = (now: number) => {
        const dt = Math.min(33, now - lastTime);
        lastTime = now;
        updateRef.current(dt, now, 1);
        renderRef.current(ctx, dpr);
        rafRef.current = requestAnimationFrame(tick);
      };
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetsReady]);

  // ============================================================
  // UPDATE
  // ============================================================
  const update = (dt: number, now: number, frameScale: number) => {
    if (paused) return;
    const state = stateRef.current;

    // frameScale is provided by the caller (game loop). Desktop always
    // passes 1 → physics × 1, byte-identical to original tuning. Mobile
    // passes Math.max(1, dt/16.667 × boost) so per-call movement scales
    // with how slow the device is actually rendering.

    // Decay juice state every frame regardless of freeze
    flapScaleTRef.current = Math.max(
      0,
      flapScaleTRef.current - dt / CFG.juice.flapSquashMs
    );
    shakeRef.current *= CFG.juice.shakeDecay;
    if (shakeRef.current < 0.2) shakeRef.current = 0;

    updateFeathers(frameScale);
    updateSparks(frameScale);
    updatePopups(dt, frameScale);
    updateClouds(dt);
    updateHeadlines(dt);

    // Count-up score animation when on gameover screen
    if (state === "gameover") {
      const dur = 900;
      const t = Math.min(1, (now - gameoverAtRef.current) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      const target = Math.round(lastScore * eased);
      if (target !== displayScoreRef.current) {
        displayScoreRef.current = target;
        setDisplayScoreState(target);
      }
    }

    // Hit-stop: freeze all motion briefly on death
    if (now < hitStopUntilRef.current) return;

    const slowFactor =
      now < slowmoUntilRef.current ? CFG.powerup.slowmoFactor : 1;
    const effDt = dt * slowFactor;

    worldXRef.current +=
      (state === "playing" ? scrollSpeedRef.current * slowFactor : 0.8) *
      frameScale;

    if (state === "idle") {
      const t = performance.now() / 500;
      chikunRef.current.y = CFG.canvas.h / 2 + Math.sin(t) * 14;
      // Zone-0 palette only during idle
      paletteRef.current = ZONES[0].palette;
      return;
    }

    if (state === "gameover") {
      const c = chikunRef.current;
      c.vy = Math.min(
        c.vy + CFG.physics.deathGravity * frameScale,
        CFG.physics.maxFall
      );
      c.y += c.vy * frameScale;
      return;
    }

    const c = chikunRef.current;
    c.vy = Math.min(
      c.vy + CFG.physics.gravity * slowFactor * frameScale,
      CFG.physics.maxFall
    );
    c.y += c.vy * slowFactor * frameScale;

    // Update trail history
    trailRef.current.push({ x: CFG.chikun.x, y: c.y });
    if (trailRef.current.length > CFG.juice.trailLines + 2) trailRef.current.shift();

    const speed = scrollSpeedRef.current * slowFactor * frameScale;

    // Towers
    for (const t of towersRef.current) {
      t.x -= speed;
      t.phase += dt * 0.002;
      if (!t.passed && t.x + CFG.tower.width / 2 < CFG.chikun.x) {
        t.passed = true;
        scoreRef.current += CFG.towerScore;
        towersPassedRef.current += 1;
        scrollSpeedRef.current = Math.min(
          CFG.scroll.max,
          scrollSpeedRef.current + CFG.scroll.rampPerTower
        );
        sfxTowerPass();
        // Zone transition detection
        maybeHandleZoneEntry();
      }
    }

    // Palette blending based on towers passed
    paletteRef.current = getBlendedPalette(towersPassedRef.current);

    // Music runs at a steady level the whole time the player is on the page —
    // started on first flap, continues across deaths, silenced only by the mute
    // toggle. No per-frame scheduling needed for the looped MP3.

    // Coin motion + magnet
    const magnetRadiusNow = now < magnetUntilRef.current
      ? CFG.coin.magnetRadius * 3.5
      : CFG.coin.magnetRadius;
    const magnetStrengthNow = now < magnetUntilRef.current
      ? CFG.coin.magnetStrength * 1.3
      : CFG.coin.magnetStrength;
    for (const coin of coinsRef.current) {
      coin.x -= speed;
      if (coin.collected) continue;
      const dx = CFG.chikun.x - coin.x;
      const dy = c.y - coin.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < magnetRadiusNow * magnetRadiusNow) {
        const dist = Math.sqrt(distSq);
        const pull = (1 - dist / magnetRadiusNow) * magnetStrengthNow * frameScale;
        coin.x += dx * pull;
        coin.y += dy * pull;
      }
    }

    // Power-ups motion + magnet (same radius as coins when magnet active)
    for (const p of powerUpsRef.current) {
      p.x -= speed;
      p.bobT += dt * 0.005;
    }
    powerUpsRef.current = powerUpsRef.current.filter((p) => p.x > -40 && !p.collected);

    // Drones
    updateDrones(c, effDt, frameScale);
    // Missiles
    updateMissiles(effDt, frameScale);

    towersRef.current = towersRef.current.filter(
      (t) => t.x + CFG.tower.width > -20
    );
    coinsRef.current = coinsRef.current.filter(
      (co) => co.x > -40 && !co.collected
    );
    const last = towersRef.current[towersRef.current.length - 1];

    // Spawn next tower unless we're holding for a boss
    if (bossRef.current) {
      updateBoss(c, now, effDt);
    } else if (last && CFG.canvas.w - last.x >= CFG.tower.spacing) {
      spawnNextTower(last.x + CFG.tower.spacing);
      // After each normal spawn, check if we owe a boss
      maybeSpawnBoss(now);
    }

    // Apply moving-tower kinematics to the gap
    const zone = ZONES[currentZoneIdxRef.current];
    if (zone.modifiers.movingTowers) {
      for (const t of towersRef.current) {
        if (t.kind === "sway") {
          // Nothing stored each frame; gapY effective is recomputed in collision
        }
      }
    }

    // Coin pickups
    for (const coin of coinsRef.current) {
      if (coin.collected) continue;
      const dx = coin.x - CFG.chikun.x;
      const dy = coin.y - c.y;
      if (dx * dx + dy * dy < (CFG.coin.radius + CFG.chikun.hitRadius) ** 2) {
        coin.collected = true;
        coinCountRef.current += 1;
        comboRef.current += 1;
        maxComboThisRunRef.current = Math.max(
          maxComboThisRunRef.current,
          comboRef.current
        );
        scoreRef.current += CFG.coin.value;
        noCoinsThisRunRef.current = false;
        sfxCoin(comboRef.current);
        // Streak milestone — ch-ching every 10 coins without break.
        if (comboRef.current > 0 && comboRef.current % 10 === 0) {
          sfxComboChing();
        }
        haptic(8);
        for (let i = 0; i < CFG.juice.sparksOnCoin; i++) {
          sparksRef.current.push(spawnSpark(coin.x, coin.y, 3.2, COLORS.gold));
        }
        popupsRef.current.push({
          x: coin.x,
          y: coin.y,
          vy: -CFG.popup.rise,
          life: 1,
          text: `+${CFG.coin.value}`,
          color: "#ffcf3a",
        });
        if (comboRef.current >= 2) {
          popupsRef.current.push({
            x: coin.x + 14,
            y: coin.y - 22,
            vy: -CFG.popup.rise * 0.85,
            life: 1,
            text: `×${comboRef.current}`,
            color: "#2dff5c",
          });
        }
      }
    }

    // Power-up pickups
    for (const p of powerUpsRef.current) {
      if (p.collected) continue;
      const dx = p.x - CFG.chikun.x;
      const dy = p.y - c.y;
      if (dx * dx + dy * dy < (CFG.powerup.radius + CFG.chikun.hitRadius) ** 2) {
        p.collected = true;
        applyPowerUp(p.kind, now);
        sfxPowerup();
        haptic([0, 15, 15, 15]);
        for (let i = 0; i < 14; i++) {
          sparksRef.current.push(
            spawnSpark(p.x, p.y, 3.5, powerupColor(p.kind))
          );
        }
        popupsRef.current.push({
          x: p.x,
          y: p.y,
          vy: -CFG.popup.rise,
          life: 1,
          text: powerupLabel(p.kind),
          color: powerupColor(p.kind),
        });
      }
    }
    powerUpsRef.current = powerUpsRef.current.filter((p) => !p.collected);

    // Ceiling / floor
    if (c.y - CFG.chikun.hitRadius <= 0) {
      c.y = CFG.chikun.hitRadius;
      c.vy = 0;
    }
    if (c.y + CFG.chikun.hitRadius >= CFG.canvas.h - 40) {
      endGame();
      return;
    }

    // Tower collisions
    for (const t of towersRef.current) {
      const inTowerX =
        CFG.chikun.x + CFG.chikun.hitRadius > t.x - CFG.tower.width / 2 &&
        CFG.chikun.x - CFG.chikun.hitRadius < t.x + CFG.tower.width / 2;
      if (!inTowerX) continue;
      const eff = effectiveGapY(t, now);
      const topEdge = eff - CFG.tower.gap / 2;
      const bottomEdge = eff + CFG.tower.gap / 2;
      if (c.y - CFG.chikun.hitRadius < topEdge || c.y + CFG.chikun.hitRadius > bottomEdge) {
        if (tryConsumeShield(now, c.y)) continue;
        endGame();
        return;
      }
    }

    // Drone collisions
    for (const d of dronesRef.current) {
      if (d.state === "dead") continue;
      const dx = d.x - CFG.chikun.x;
      const dy = d.y - c.y;
      if (dx * dx + dy * dy < (CFG.drone.hitRadius + CFG.chikun.hitRadius) ** 2) {
        if (tryConsumeShield(now, c.y)) {
          d.state = "dead";
          d.life = 0;
          continue;
        }
        endGame();
        return;
      }
    }

    // Missile collisions
    for (const m of missilesRef.current) {
      const dx = m.x - CFG.chikun.x;
      const dy = m.y - c.y;
      if (dx * dx + dy * dy < (16 + CFG.chikun.hitRadius) ** 2) {
        if (tryConsumeShield(now, c.y)) {
          m.life = 0;
          continue;
        }
        endGame();
        return;
      }
    }
    missilesRef.current = missilesRef.current.filter(
      (m) => m.life > 0 && m.x > -40 && m.x < CFG.canvas.w + 40
    );
  };

  // ============================================================
  // BOSS
  // ============================================================
  const maybeSpawnBoss = (now: number) => {
    const passed = towersPassedRef.current;
    // Boss triggers at the last tower of a zone (i.e. tower 24, 49, 74)
    const nextZoneStart = ZONES.find((z) => z.startTower > passed);
    if (!nextZoneStart) return;
    // Trigger when we've just passed a tower numbered exactly nextZoneStart - 1
    if (passed !== nextZoneStart.startTower - 1) return;
    if (bossRef.current) return;
    if (bossCooldownRef.current) return;
    const zoneIdx = ZONES.indexOf(nextZoneStart);
    const kind: BossKind = zoneIdx === 1 ? "heli" : zoneIdx === 2 ? "swarm" : "ceo";
    bossRef.current = {
      phase: "warn",
      kind,
      hp: 6,
      maxHp: 6,
      x: CFG.canvas.w + 200,
      y: CFG.canvas.h / 2,
      tBorn: now,
      nextAttackAt: now + 1800,
      zoneIdx,
    };
    sfxBossWarn();
    haptic([0, 40, 20, 40]);
  };

  const updateBoss = (c: { y: number }, now: number, _effDt: number) => {
    const b = bossRef.current;
    if (!b) return;
    const approachT = Math.min(1, (now - b.tBorn) / CFG.boss.approachMs);
    const targetX = CFG.canvas.w - 260;
    b.x = CFG.canvas.w + 200 - (CFG.canvas.w + 200 - targetX) * easeOutCubic(approachT);

    if (b.phase === "warn" && approachT >= 1) {
      b.phase = "fight";
      b.tBorn = now;
      b.nextAttackAt = now + 800;
    }

    if (b.phase === "fight") {
      // Vertical bob chase toward Chikun
      b.y += (c.y - b.y) * 0.02;
      b.y += Math.sin(now / 400) * 1.2;
      // Attacks
      if (now >= b.nextAttackAt) {
        bossAttack(b, c.y, now);
        b.nextAttackAt = now + (b.kind === "swarm" ? 900 : 1400);
      }
      if (now - b.tBorn > CFG.boss.durationMs) {
        // Timed win — boss retreats
        b.phase = "defeat";
        b.tBorn = now;
        sfxTriumph();
        sfxChant();
        haptic([0, 30, 30, 30, 30, 30]);
      }
    }

    if (b.phase === "defeat") {
      b.y -= 2;
      b.x += 3;
      // Particle trail
      if (Math.random() < 0.3) {
        sparksRef.current.push(spawnSpark(b.x, b.y, 3, COLORS.lime));
      }
      if (now - b.tBorn > 1600) {
        // Award bonus + exit
        const bonus = 15 + b.zoneIdx * 10;
        scoreRef.current += bonus;
        popupsRef.current.push({
          x: CFG.chikun.x,
          y: c.y - 50,
          vy: -CFG.popup.rise,
          life: 1,
          text: `+${bonus} BOSS`,
          color: "#2dff5c",
        });
        // Fire the chapter banner now that the boss is down.
        const newIdx = getZoneIndex(towersPassedRef.current);
        if (newIdx !== currentZoneIdxRef.current) {
          currentZoneIdxRef.current = newIdx;
          zoneBannerRef.current = {
            zoneIdx: newIdx,
            startedAt: performance.now(),
          };
          sfxZone();
          if (newIdx >= 2) sfxChant();
        }
        bossRef.current = null;
        bossCooldownRef.current = true;
        // Force-spawn the next tower right away
        const lastTower = towersRef.current[towersRef.current.length - 1];
        const spawnX = lastTower
          ? lastTower.x + CFG.tower.spacing
          : CFG.canvas.w + 40;
        spawnNextTower(spawnX);
        setTimeout(() => {
          bossCooldownRef.current = false;
        }, 100);
      }
    }
  };

  const bossAttack = (b: BossState, chikunY: number, _now: number) => {
    if (b.kind === "heli") {
      // Fire 2 homing-ish missiles
      for (let i = -1; i <= 1; i += 2) {
        missilesRef.current.push({
          x: b.x - 40,
          y: b.y + i * 20,
          vx: -6,
          vy: (chikunY - b.y) * 0.015 + i * 0.5,
          life: 1,
          kind: "missile",
        });
      }
    } else if (b.kind === "swarm") {
      // Drop a small drone
      dronesRef.current.push({
        x: b.x - 40,
        y: b.y,
        vx: -4,
        vy: 0,
        state: "chase",
        life: 1,
        targetY: chikunY,
      });
    } else {
      // CEO: wall of 3 missiles spread vertically
      for (let i = -1; i <= 1; i++) {
        missilesRef.current.push({
          x: b.x - 40,
          y: b.y + i * 80,
          vx: -5,
          vy: 0,
          life: 1,
          kind: "missile",
        });
      }
    }
  };

  // ============================================================
  // ZONE + POWERUPS
  // ============================================================
  const maybeHandleZoneEntry = () => {
    // Banner is deferred until after a boss defeat so the chapter reveal lands
    // on the victory moment rather than mid-fight.
    if (bossRef.current) return;
    const idx = getZoneIndex(towersPassedRef.current);
    if (idx !== currentZoneIdxRef.current) {
      currentZoneIdxRef.current = idx;
      zoneBannerRef.current = { zoneIdx: idx, startedAt: performance.now() };
      sfxZone();
      if (idx >= 2) sfxChant();
    }
  };

  const spawnNextTower = (x: number) => {
    const gapY =
      CFG.tower.minGapY +
      Math.random() * (CFG.tower.maxGapY - CFG.tower.minGapY);
    const zone = ZONES[currentZoneIdxRef.current];
    let kind: TowerKind = "static";
    if (zone.modifiers.slidingPanels && Math.random() < 0.35) kind = "panel";
    else if (zone.modifiers.movingTowers && Math.random() < 0.55) kind = "sway";
    towersRef.current.push({
      x,
      gapY,
      passed: false,
      kind,
      phase: Math.random() * Math.PI * 2,
    });
    coinsRef.current.push({ x, y: gapY, collected: false });

    // Chance to attach a power-up vertically offset from the gap
    if (Math.random() < CFG.powerup.spawnChance) {
      const kinds: PowerUpKind[] = ["shield", "magnet", "slowmo"];
      const k = kinds[Math.floor(Math.random() * kinds.length)];
      powerUpsRef.current.push({
        x: x + CFG.tower.spacing / 2,
        y: clamp(gapY + (Math.random() - 0.5) * 120, 120, CFG.canvas.h - 120),
        kind: k,
        collected: false,
        bobT: Math.random() * Math.PI * 2,
      });
    }

    // Chance to spawn a drone in the next gap (zones 2+)
    if (zone.modifiers.drones && Math.random() < CFG.drone.spawnChance) {
      dronesRef.current.push({
        x: CFG.canvas.w + 180,
        y: Math.random() * (CFG.canvas.h - 200) + 100,
        vx: -scrollSpeedRef.current * CFG.drone.speedMult,
        vy: 0,
        state: "approach",
        life: 1,
        targetY: chikunRef.current.y,
      });
    }
  };

  const applyPowerUp = (kind: PowerUpKind, now: number) => {
    if (kind === "shield") shieldUntilRef.current = now + CFG.powerup.shieldMs;
    if (kind === "magnet") magnetUntilRef.current = now + CFG.powerup.magnetMs;
    if (kind === "slowmo") slowmoUntilRef.current = now + CFG.powerup.slowmoMs;
  };

  const tryConsumeShield = (now: number, y: number) => {
    if (now < shieldUntilRef.current) {
      shieldUntilRef.current = 0; // single-use on first impact
      sfxShieldHit();
      haptic([0, 30, 20, 30]);
      for (let i = 0; i < 18; i++) {
        sparksRef.current.push(spawnSpark(CFG.chikun.x, y, 4, COLORS.cyan));
      }
      shakeRef.current = 10;
      noHitThisRunRef.current = false;
      return true;
    }
    return false;
  };

  // ============================================================
  // MOVING TOWER EFFECTIVE GAP
  // ============================================================
  const effectiveGapY = (t: Tower, now: number) => {
    if (t.kind === "sway") {
      return t.gapY + Math.sin(now / 700 + t.phase) * 60;
    }
    if (t.kind === "panel") {
      // Gap shifts by ±40 with a square-wave-like motion (the panel slides open/close)
      return t.gapY + Math.sin(now / 900 + t.phase) * 40;
    }
    return t.gapY;
  };

  // ============================================================
  // CLOUDS / HEADLINES
  // ============================================================
  const seedClouds = (): Cloud[] => {
    const arr: Cloud[] = [];
    for (let i = 0; i < 9; i++) {
      arr.push({
        x: Math.random() * CFG.canvas.w,
        y: 60 + Math.random() * 260,
        scale: 0.6 + Math.random() * 1.4,
        speed: 0.12 + Math.random() * 0.22,
        layer: Math.random() < 0.5 ? 0 : 1,
      });
    }
    return arr;
  };
  const updateClouds = (dt: number) => {
    const speedFactor = stateRef.current === "playing" ? 1 : 0.3;
    for (const c of cloudsRef.current) {
      c.x -= c.speed * dt * 0.1 * speedFactor;
      if (c.x < -220) {
        c.x = CFG.canvas.w + 160;
        c.y = 60 + Math.random() * 260;
        c.scale = 0.6 + Math.random() * 1.4;
      }
    }
  };

  const seedHeadlines = (): Headline[] => {
    return [{ text: HEADLINES[Math.floor(Math.random() * HEADLINES.length)], x: CFG.canvas.w }];
  };
  const updateHeadlines = (dt: number) => {
    for (const h of headlinesRef.current) {
      h.x -= dt * 0.08;
    }
    headlinesRef.current = headlinesRef.current.filter((h) => h.x > -400);
    // Space instances so the slogan reads as a tight repeating marquee, not a PA crawl.
    if (
      headlinesRef.current.length === 0 ||
      headlinesRef.current[headlinesRef.current.length - 1].x <
        CFG.canvas.w - 220
    ) {
      headlinesRef.current.push({
        text: HEADLINES[Math.floor(Math.random() * HEADLINES.length)],
        x: CFG.canvas.w + 40,
      });
    }
  };

  // ============================================================
  // DRONES / MISSILES
  // ============================================================
  const updateDrones = (
    chikun: { y: number },
    effDt: number,
    frameScale: number
  ) => {
    for (const d of dronesRef.current) {
      if (d.state === "dead") {
        d.life -= 0.04 * frameScale;
        continue;
      }
      // Lock target Y to chikun with a slight lag
      d.targetY += (chikun.y - d.targetY) * 0.03 * frameScale;
      d.y += (d.targetY - d.y) * 0.04 * frameScale;
      d.x += d.vx * frameScale;
      // Keep within vertical bounds
      d.y = clamp(d.y, 80, CFG.canvas.h - 100);
    }
    dronesRef.current = dronesRef.current.filter(
      (d) => d.x > -60 && d.life > 0
    );
  };

  const updateMissiles = (effDt: number, frameScale: number) => {
    for (const m of missilesRef.current) {
      m.x += m.vx * frameScale;
      m.y += m.vy * frameScale;
    }
  };

  // ============================================================
  // PARTICLES
  // ============================================================
  const updateFeathers = (frameScale: number) => {
    // Exponential decays use Math.pow so a 30Hz frame still ends up at the
    // same total decay-per-second as 60Hz. Linear movements just scale.
    const drag = Math.pow(0.99, frameScale);
    for (const f of feathersRef.current) {
      f.x += f.vx * frameScale;
      f.y += f.vy * frameScale;
      f.vy += 0.05 * frameScale;
      f.vx *= drag;
      f.rot += f.vrot * frameScale;
      f.life -= 0.008 * frameScale;
    }
    feathersRef.current = feathersRef.current.filter((f) => f.life > 0);
  };

  const updateSparks = (frameScale: number) => {
    const drag = Math.pow(0.9, frameScale);
    for (const s of sparksRef.current) {
      s.x += s.vx * frameScale;
      s.y += s.vy * frameScale;
      s.vx *= drag;
      s.vy *= drag;
      s.vy += 0.1 * frameScale;
      s.life -= 0.035 * frameScale;
    }
    sparksRef.current = sparksRef.current.filter((s) => s.life > 0);
  };

  const updatePopups = (dt: number, frameScale: number) => {
    for (const p of popupsRef.current) {
      p.y += p.vy * frameScale;
      p.life -= dt / CFG.popup.lifeMs;
    }
    popupsRef.current = popupsRef.current.filter((p) => p.life > 0);
  };

  // ============================================================
  // RENDER
  // ============================================================
  const render = (ctx: CanvasRenderingContext2D, dpr: number) => {
    const { w, h } = CFG.canvas;
    const reduced = !!save?.reducedMotion;

    const now = performance.now();
    const flash = Math.max(0, (deathFlashUntilRef.current - now) / CFG.juice.deathFlashMs);
    const shake = reduced ? 0 : shakeRef.current;
    const shakeX = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    const shakeY = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(shakeX, shakeY);

    const palette = paletteRef.current;

    // Sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, palette.skyTop);
    grad.addColorStop(0.55, palette.skyMid);
    grad.addColorStop(1, palette.skyBot);
    ctx.fillStyle = grad;
    ctx.fillRect(-shake, -shake, w + shake * 2, h + shake * 2);

    // Distant mountain silhouette
    drawMountainLayer(ctx, worldXRef.current * 0.06, palette.mountain);

    // God-rays: soft vertical slashes drifting across the sky
    if (!reduced) drawGodRays(ctx, now, palette);

    // Clouds (back + front layers)
    drawClouds(ctx, palette.cloud, 0);

    drawCitySilhouette(
      ctx,
      worldXRef.current * 0.15,
      h - 210,
      190,
      palette.cityFar,
      95,
      null
    );
    drawClouds(ctx, palette.cloud, 1);
    drawCitySilhouette(
      ctx,
      worldXRef.current * 0.35,
      h - 130,
      130,
      palette.cityNear,
      70,
      palette.windowColor && palette.windowIntensity > 0
        ? { color: palette.windowColor, intensity: palette.windowIntensity }
        : null
    );

    // Ground
    ctx.fillStyle = COLORS.ground;
    ctx.fillRect(0, h - 40, w, 40);
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 3;
    ctx.shadowColor = palette.accent;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0, h - 40);
    ctx.lineTo(w, h - 40);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Scrolling headline ribbon just above the ground
    drawHeadlineRibbon(ctx, palette);

    // Towers
    for (const t of towersRef.current) drawTower(ctx, t, now, palette);

    // Coins
    for (const coin of coinsRef.current) {
      if (!coin.collected) drawCoin(ctx, coin.x, coin.y);
    }

    // Power-ups
    for (const p of powerUpsRef.current) {
      if (!p.collected) drawPowerUp(ctx, p, now);
    }

    // Drones + missiles
    for (const d of dronesRef.current) drawDrone(ctx, d);
    for (const m of missilesRef.current) drawMissile(ctx, m);

    // Boss
    if (bossRef.current) drawBoss(ctx, bossRef.current, now);

    // Speed trail
    if (stateRef.current === "playing" && !reduced) {
      drawSpeedLines(ctx, chikunRef.current.y);
    }

    for (const f of feathersRef.current) drawFeather(ctx, f);
    for (const s of sparksRef.current) drawSpark(ctx, s);

    drawChikun(ctx, now);

    // Score popups (drawn above Chikun)
    for (const p of popupsRef.current) drawPopup(ctx, p);

    // Active power-up icons HUD (top-left)
    drawActivePowerups(ctx, now);

    // HUD: score
    if (stateRef.current === "playing" || stateRef.current === "boss") {
      ctx.font = "900 64px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillText(String(scoreRef.current), w / 2 + 3, 30 + 3);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(String(scoreRef.current), w / 2, 30);

      if (comboRef.current >= 2) {
        ctx.font = "900 28px system-ui, -apple-system, sans-serif";
        ctx.fillStyle = COLORS.lime;
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 6;
        ctx.fillText(`×${comboRef.current}`, w / 2, 100);
        ctx.shadowBlur = 0;
      }
    }

    // Zone banner overlay
    drawZoneBanner(ctx, now);

    // Boss warning overlay
    if (bossRef.current && bossRef.current.phase === "warn") {
      drawBossWarning(ctx, now);
    }

    // Death flash + chromatic aberration (simulated with red/cyan ghost rects)
    if (flash > 0 && !reduced) {
      const shift = CFG.juice.chromaticMaxShift * flash;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = `rgba(255, 0, 0, ${0.25 * flash})`;
      ctx.fillRect(-shift, 0, w, h);
      ctx.fillStyle = `rgba(0, 255, 255, ${0.25 * flash})`;
      ctx.fillRect(shift, 0, w, h);
      ctx.restore();
      ctx.fillStyle = `rgba(255, 255, 255, ${flash})`;
      ctx.fillRect(0, 0, w, h);
    }
  };

  // ---- Draw helpers ----
  const drawChikun = (ctx: CanvasRenderingContext2D, now: number) => {
    const c = chikunRef.current;
    const skinId = save?.equippedSkin ?? "default";
    const skin = SKINS.find((s) => s.id === skinId) ?? SKINS[0];
    const bundle = getSkinSprites(skinId);

    let spriteKey: "flap" | "coast" | "fall";
    if (stateRef.current === "gameover") spriteKey = "fall";
    else if (now - c.lastFlap < CFG.flapAnimMs) spriteKey = "flap";
    else spriteKey = "coast";

    const img = bundle[spriteKey];

    let rot = 0;
    if (stateRef.current === "playing") rot = Math.max(-0.35, Math.min(0.9, c.vy / 14));
    else if (stateRef.current === "gameover") rot = 1.0;

    const sq = flapScaleTRef.current;
    const scaleY = 1 + 0.18 * sq;
    const scaleX = 1 - 0.08 * sq;

    // Shield aura when active
    if (now < shieldUntilRef.current) {
      const t = (now / 160) % (Math.PI * 2);
      const r = CFG.chikun.hitRadius * 1.9 + Math.sin(t) * 3;
      ctx.save();
      ctx.translate(CFG.chikun.x, c.y);
      const g = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r);
      g.addColorStop(0, "rgba(49, 224, 255, 0)");
      g.addColorStop(0.75, "rgba(49, 224, 255, 0.35)");
      g.addColorStop(1, "rgba(49, 224, 255, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(49, 224, 255, 0.7)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // Skin aura
    if (skin.aura) {
      ctx.save();
      ctx.translate(CFG.chikun.x, c.y);
      const g = ctx.createRadialGradient(0, 0, 4, 0, 0, CFG.chikun.hitRadius * 1.7);
      g.addColorStop(0, hexToRgba(skin.aura, 0.4));
      g.addColorStop(1, hexToRgba(skin.aura, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, CFG.chikun.hitRadius * 1.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(CFG.chikun.x, c.y);
    ctx.rotate(rot);
    ctx.scale(scaleX, scaleY);
    if (img) {
      const naturalW =
        (img as HTMLImageElement).naturalWidth || (img as HTMLCanvasElement).width;
      const naturalH =
        (img as HTMLImageElement).naturalHeight || (img as HTMLCanvasElement).height;
      const aspect = naturalH > 0 ? naturalW / naturalH : 1;
      const hsize = CFG.chikun.size;
      const wsize = hsize * aspect;
      ctx.drawImage(img as CanvasImageSource, -wsize / 2, -hsize / 2, wsize, hsize);
    } else {
      ctx.fillStyle = COLORS.red;
      ctx.beginPath();
      ctx.arc(0, 0, CFG.chikun.hitRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  const drawTower = (ctx: CanvasRenderingContext2D, t: Tower, now: number, palette: ZonePalette) => {
    const img = baseSpritesRef.current.tower;
    const effGap = effectiveGapY(t, now);
    const topH = effGap - CFG.tower.gap / 2;
    const bottomY = effGap + CFG.tower.gap / 2;
    const bottomH = CFG.canvas.h - 40 - bottomY;
    const x = t.x - CFG.tower.width / 2;

    const srcW = img
      ? (img as HTMLImageElement).naturalWidth || (img as HTMLCanvasElement).width
      : 0;
    const srcH = img
      ? (img as HTMLImageElement).naturalHeight || (img as HTMLCanvasElement).height
      : 0;

    if (img && srcW > 0 && srcH > 0) {
      const topSrcH = Math.min(srcH, topH * (srcW / CFG.tower.width));
      ctx.drawImage(
        img as CanvasImageSource,
        0, srcH - topSrcH,
        srcW, topSrcH,
        x, 0,
        CFG.tower.width, topH
      );
      const botSrcH = Math.min(srcH, bottomH * (srcW / CFG.tower.width));
      ctx.drawImage(
        img as CanvasImageSource,
        0, 0,
        srcW, botSrcH,
        x, bottomY,
        CFG.tower.width, bottomH
      );
    } else {
      ctx.fillStyle = COLORS.towerFill;
      ctx.fillRect(x, 0, CFG.tower.width, topH);
      ctx.fillRect(x, bottomY, CFG.tower.width, bottomH);
    }

    // Moving/sliding tower variants get a subtle red warning tint at the gap
    // edge so they're telegraphed; default static towers draw no outline.
    if (t.kind === "panel") {
      ctx.fillStyle = hexToRgba(COLORS.red, 0.35);
      ctx.fillRect(x - 2, topH - 4, CFG.tower.width + 4, 4);
      ctx.fillRect(x - 2, bottomY, CFG.tower.width + 4, 4);
    }
  };

  const drawCoin = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    const r = CFG.coin.radius;
    const t = performance.now() / 180;
    const squish = Math.abs(Math.sin(t));
    const rx = r * (0.3 + 0.7 * squish);
    ctx.save();
    ctx.translate(x, y);
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2);
    glow.addColorStop(0, "rgba(0, 214, 50, 0.45)");
    glow.addColorStop(1, "rgba(0, 214, 50, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.coinBody;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.coinRim;
    ctx.lineWidth = 2;
    ctx.stroke();
    if (squish > 0.35) {
      ctx.fillStyle = "#1a1d24";
      ctx.font = `900 ${Math.round(r * 1.6)}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Ł", 0, 2);
    }
    ctx.restore();
  };

  const drawPowerUp = (ctx: CanvasRenderingContext2D, p: PowerUp, now: number) => {
    const bobY = Math.sin(p.bobT) * 6;
    const r = CFG.powerup.radius;
    const color = powerupColor(p.kind);
    ctx.save();
    ctx.translate(p.x, p.y + bobY);
    // Halo
    const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.8);
    halo.addColorStop(0, hexToRgba(color, 0.55));
    halo.addColorStop(1, hexToRgba(color, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.8, 0, Math.PI * 2);
    ctx.fill();
    // Outer ring
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Inner fill
    ctx.fillStyle = hexToRgba(color, 0.3);
    ctx.beginPath();
    ctx.arc(0, 0, r - 4, 0, Math.PI * 2);
    ctx.fill();
    // Icon glyph
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 22px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(powerupGlyph(p.kind), 0, 1);
    ctx.restore();
  };

  const drawActivePowerups = (ctx: CanvasRenderingContext2D, now: number) => {
    const entries: Array<{ color: string; label: string; t: number }> = [];
    const remaining = (until: number, dur: number) =>
      Math.max(0, Math.min(1, (until - now) / dur));
    if (now < shieldUntilRef.current)
      entries.push({
        color: powerupColor("shield"),
        label: "SHIELD",
        t: remaining(shieldUntilRef.current, CFG.powerup.shieldMs),
      });
    if (now < magnetUntilRef.current)
      entries.push({
        color: powerupColor("magnet"),
        label: "MAGNET",
        t: remaining(magnetUntilRef.current, CFG.powerup.magnetMs),
      });
    if (now < slowmoUntilRef.current)
      entries.push({
        color: powerupColor("slowmo"),
        label: "SLOWMO",
        t: remaining(slowmoUntilRef.current, CFG.powerup.slowmoMs),
      });
    entries.forEach((e, i) => {
      const x = 18;
      const y = 18 + i * 28;
      ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      ctx.fillRect(x, y, 140, 22);
      ctx.fillStyle = hexToRgba(e.color, 0.85);
      ctx.fillRect(x, y, 140 * e.t, 22);
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 12px system-ui";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(e.label, x + 8, y + 11);
    });
  };

  const drawDrone = (ctx: CanvasRenderingContext2D, d: Drone) => {
    const alpha = d.state === "dead" ? d.life : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(d.x, d.y);
    // Body
    ctx.fillStyle = "#1a1d24";
    ctx.strokeStyle = COLORS.red;
    ctx.lineWidth = 2;
    ctx.shadowColor = COLORS.red;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Rotor line (flicker)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-20, -10);
    ctx.lineTo(20, -10);
    ctx.stroke();
    // Red eye
    ctx.fillStyle = COLORS.red;
    ctx.beginPath();
    ctx.arc(-6, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const drawMissile = (ctx: CanvasRenderingContext2D, m: Missile) => {
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(Math.atan2(m.vy, m.vx));
    ctx.fillStyle = "#ff3344";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-14, -4);
    ctx.lineTo(14, 0);
    ctx.lineTo(-14, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Trail flame
    ctx.fillStyle = "rgba(255, 138, 42, 0.8)";
    ctx.beginPath();
    ctx.moveTo(-14, -3);
    ctx.lineTo(-24 - Math.random() * 6, 0);
    ctx.lineTo(-14, 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  const drawBoss = (ctx: CanvasRenderingContext2D, b: BossState, now: number) => {
    ctx.save();
    ctx.translate(b.x, b.y);
    // Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.ellipse(0, 48, 62, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    if (b.kind === "heli") {
      // Chunky helicopter body
      ctx.fillStyle = "#0a0d12";
      ctx.strokeStyle = COLORS.red;
      ctx.lineWidth = 3;
      ctx.shadowColor = COLORS.red;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.ellipse(0, 0, 62, 28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      // Tail
      ctx.fillStyle = "#0a0d12";
      ctx.fillRect(40, -6, 40, 12);
      ctx.strokeStyle = COLORS.red;
      ctx.strokeRect(40, -6, 40, 12);
      // Rotor blur
      const rot = (now / 30) % (Math.PI * 2);
      ctx.save();
      ctx.rotate(rot);
      ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
      ctx.beginPath();
      ctx.ellipse(0, -30, 80, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (b.kind === "swarm") {
      // Giant drone
      ctx.fillStyle = "#1a1d24";
      ctx.strokeStyle = COLORS.red;
      ctx.lineWidth = 3;
      ctx.shadowColor = COLORS.red;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.ellipse(0, 0, 56, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      for (let i = -1; i <= 1; i += 2) {
        ctx.beginPath();
        ctx.arc(i * 36, -18, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    } else {
      // CEO platform
      ctx.fillStyle = "#1a1d24";
      ctx.strokeStyle = palette().accent;
      ctx.lineWidth = 3;
      ctx.shadowColor = palette().accent;
      ctx.shadowBlur = 10;
      ctx.fillRect(-60, 10, 120, 20);
      ctx.strokeRect(-60, 10, 120, 20);
      ctx.shadowBlur = 0;
      // CEO figure
      ctx.fillStyle = "#f5f1e8";
      ctx.fillRect(-18, -40, 36, 50);
      ctx.fillStyle = "#000";
      ctx.fillRect(-10, -40, 20, 14);
      ctx.fillStyle = COLORS.red;
      ctx.fillRect(-4, -26, 8, 20);
    }

    // HP bar
    const barW = 120;
    const frac = Math.max(0, Math.min(1, (CFG.boss.durationMs - (now - b.tBorn)) / CFG.boss.durationMs));
    if (b.phase === "fight") {
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(-barW / 2, -60, barW, 8);
      ctx.fillStyle = COLORS.red;
      ctx.fillRect(-barW / 2, -60, barW * frac, 8);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.strokeRect(-barW / 2, -60, barW, 8);
    }

    ctx.restore();
  };

  const palette = () => paletteRef.current;

  const drawBossWarning = (ctx: CanvasRenderingContext2D, now: number) => {
    const w = CFG.canvas.w;
    const h = CFG.canvas.h;
    const b = bossRef.current!;
    const t = (now - b.tBorn) / CFG.boss.approachMs;
    const alpha = 0.5 + 0.4 * Math.sin(t * 14);
    ctx.save();
    ctx.fillStyle = `rgba(255, 51, 68, ${alpha * 0.28})`;
    ctx.fillRect(0, 0, w, h);
    ctx.font = "900 96px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = COLORS.red;
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 6;
    ctx.fillText("⚠ INCOMING ⚠", w / 2, h / 2 - 40);
    ctx.font = "900 24px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "#fff";
    const label = b.kind === "heli" ? "BIG CORP HELICOPTER" : b.kind === "swarm" ? "DRONE SWARM" : "THE CEO";
    ctx.fillText(label, w / 2, h / 2 + 30);
    ctx.shadowBlur = 0;
    ctx.restore();
  };

  const drawFeather = (ctx: CanvasRenderingContext2D, f: Feather) => {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);
    ctx.globalAlpha = Math.max(0, f.life);
    ctx.fillStyle = COLORS.feather;
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  };

  const drawSpark = (ctx: CanvasRenderingContext2D, s: Spark) => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, s.life);
    ctx.fillStyle = s.color;
    ctx.shadowColor = s.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size * s.life, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  };

  const drawPopup = (ctx: CanvasRenderingContext2D, p: ScorePopup) => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.font = "900 28px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillText(p.text, p.x + 2, p.y + 2);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y);
    ctx.restore();
  };

  const drawSpeedLines = (ctx: CanvasRenderingContext2D, chikunY: number) => {
    const trailId = save?.equippedTrail ?? "default";
    const trail = TRAILS.find((t) => t.id === trailId) ?? TRAILS[0];
    const speed = scrollSpeedRef.current;
    const intensity = Math.min(1, (speed - CFG.scroll.initial) / (CFG.scroll.max - CFG.scroll.initial));
    const lines = CFG.juice.trailLines;
    for (let i = 0; i < lines; i++) {
      const t = i / lines;
      const alpha = (0.2 + 0.28 * intensity) * (1 - t);
      const lineLen = 26 + 30 * intensity + i * 6;
      const offsetX = 36 + i * 22;
      const jitterY = (Math.random() - 0.5) * 10;
      if (trail.color === "rainbow") {
        const hue = ((performance.now() / 4) + i * 40) % 360;
        ctx.strokeStyle = `hsla(${hue}, 100%, 60%, ${alpha})`;
      } else {
        ctx.strokeStyle = `rgba(${trail.color}, ${alpha})`;
      }
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(CFG.chikun.x - offsetX, chikunY + jitterY);
      ctx.lineTo(CFG.chikun.x - offsetX - lineLen, chikunY + jitterY);
      ctx.stroke();
    }
  };

  const drawGodRays = (
    ctx: CanvasRenderingContext2D,
    now: number,
    pal: ZonePalette
  ) => {
    const w = CFG.canvas.w;
    const h = CFG.canvas.h;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const rayCount = 3;
    for (let i = 0; i < rayCount; i++) {
      const t = ((now / 11000 + i / rayCount) % 1);
      const x = t * (w + 600) - 300;
      const skew = 120;
      const grd = ctx.createLinearGradient(x, 0, x + skew + 120, h);
      grd.addColorStop(0, hexToRgba(pal.accent, 0.045));
      grd.addColorStop(0.5, hexToRgba(pal.accent, 0.015));
      grd.addColorStop(1, hexToRgba(pal.accent, 0));
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 120, 0);
      ctx.lineTo(x + skew + 260, h);
      ctx.lineTo(x + skew + 140, h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  };

  const drawMountainLayer = (ctx: CanvasRenderingContext2D, offset: number, color: string) => {
    const h = CFG.canvas.h;
    ctx.fillStyle = color;
    const segment = 220;
    const baseY = h - 280;
    const start = Math.floor(offset / segment) * segment;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i < Math.ceil(CFG.canvas.w / segment) + 2; i++) {
      const bx = i * segment + start - offset;
      const seed = Math.floor((start + i * segment) / segment);
      const peakY = baseY - 50 - ((seed * 2663 + 104729) % 70);
      ctx.lineTo(bx, peakY);
      ctx.lineTo(bx + segment / 2, peakY - 30);
    }
    ctx.lineTo(CFG.canvas.w, h);
    ctx.closePath();
    ctx.fill();
  };

  const drawCitySilhouette = (
    ctx: CanvasRenderingContext2D,
    offset: number,
    y: number,
    height: number,
    color: string,
    segment: number,
    windows: { color: string; intensity: number } | null
  ) => {
    const start = Math.floor(offset / segment) * segment;
    const count = Math.ceil(CFG.canvas.w / segment) + 2;

    // Pass 1: solid building bodies.
    ctx.fillStyle = color;
    const buildings: Array<{
      bx: number;
      by: number;
      bw: number;
      bh: number;
      seed: number;
    }> = [];
    for (let i = 0; i < count; i++) {
      const bx = i * segment + start - offset;
      const seed = Math.floor((start + i * segment) / segment);
      const bh =
        height * (0.55 + ((seed * 9301 + 49297) % 233280) / 233280 * 0.45);
      const by = y + (height - bh);
      const bw = segment - 4;
      ctx.fillRect(bx, by, bw, bh);
      buildings.push({ bx, by, bw, bh, seed });
    }

    if (!windows) return;

    // Pass 2: deterministic lit windows per building. Seeded so patterns don't
    // flicker frame to frame as parallax scrolls.
    const wSize = 3;
    const winGrid = 9;
    for (const { bx, by, bw, bh, seed } of buildings) {
      const cols = Math.max(2, Math.floor((bw - 6) / winGrid));
      const rows = Math.max(4, Math.floor((bh - 8) / winGrid));
      const litFrac = 0.18 + windows.intensity * 0.28; // 18-46% of cells lit
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const h1 = (seed * 73856093) ^ (c * 19349663) ^ (r * 83492791);
          const rnd = ((h1 >>> 0) % 10000) / 10000;
          if (rnd > litFrac) continue;
          const brightness = 0.55 + (rnd / litFrac) * 0.45;
          ctx.fillStyle = hexToRgba(
            windows.color,
            brightness * windows.intensity
          );
          const wx = bx + 3 + c * winGrid;
          const wy = by + 4 + r * winGrid;
          ctx.fillRect(wx, wy, wSize, wSize);
        }
      }
    }
  };

  const drawClouds = (ctx: CanvasRenderingContext2D, color: string, layer: number) => {
    for (const c of cloudsRef.current) {
      if (c.layer !== layer) continue;
      drawCloud(ctx, c.x, c.y, c.scale, color);
    }
  };

  const drawCloud = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale: number,
    color: string
  ) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, 40 * scale, 14 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 28 * scale, y + 3, 24 * scale, 10 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 30 * scale, y + 2, 28 * scale, 12 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawHeadlineRibbon = (ctx: CanvasRenderingContext2D, palette: ZonePalette) => {
    const h = CFG.canvas.h;
    const ribbonY = h - 58;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, ribbonY, CFG.canvas.w, 18);
    ctx.fillStyle = palette.accent;
    ctx.fillRect(0, ribbonY, CFG.canvas.w, 2);
    ctx.fillRect(0, ribbonY + 16, CFG.canvas.w, 2);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 10px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    for (const headline of headlinesRef.current) {
      ctx.fillText(headline.text, headline.x, ribbonY + 9);
    }
  };

  const drawZoneBanner = (ctx: CanvasRenderingContext2D, now: number) => {
    const b = zoneBannerRef.current;
    if (!b) return;
    const age = now - b.startedAt;
    const dur = CFG.zoneBanner.durationMs;
    if (age > dur) {
      zoneBannerRef.current = null;
      return;
    }
    const t = age / dur;
    // fade in 0..0.15, hold, fade out 0.8..1
    let alpha = 1;
    if (t < 0.15) alpha = t / 0.15;
    else if (t > 0.8) alpha = Math.max(0, 1 - (t - 0.8) / 0.2);

    const zone = ZONES[b.zoneIdx];
    const w = CFG.canvas.w;
    const h = CFG.canvas.h;
    ctx.save();
    ctx.globalAlpha = alpha;
    // Letterbox style bar behind text
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, h / 2 - 80, w, 160);
    ctx.fillStyle = zone.palette.accent;
    ctx.fillRect(0, h / 2 - 80, w, 4);
    ctx.fillRect(0, h / 2 + 76, w, 4);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 14px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = zone.palette.accent;
    ctx.fillText(zone.chapter, w / 2, h / 2 - 40);

    ctx.font = "900 56px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 10;
    ctx.fillText(zone.name, w / 2, h / 2);
    ctx.shadowBlur = 0;

    ctx.font = "700 16px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "#e6e6e6";
    ctx.fillText(zone.tagline, w / 2, h / 2 + 42);

    ctx.restore();
  };

  // ============================================================
  // SHOP / STATS / SHARE handlers
  // ============================================================
  const buySkin = useCallback(
    (skin: Skin) => {
      if (!save) return;
      if (save.ownedSkins.includes(skin.id)) {
        mutateSave({ equippedSkin: skin.id });
        return;
      }
      if (save.bankedCoins < skin.cost) return;
      mutateSave({
        bankedCoins: save.bankedCoins - skin.cost,
        ownedSkins: [...save.ownedSkins, skin.id],
        equippedSkin: skin.id,
      });
    },
    [save, mutateSave]
  );

  const buyTrail = useCallback(
    (trail: Trail) => {
      if (!save) return;
      if (save.ownedTrails.includes(trail.id)) {
        mutateSave({ equippedTrail: trail.id });
        return;
      }
      if (save.bankedCoins < trail.cost) return;
      mutateSave({
        bankedCoins: save.bankedCoins - trail.cost,
        ownedTrails: [...save.ownedTrails, trail.id],
        equippedTrail: trail.id,
      });
    },
    [save, mutateSave]
  );

  const submitName = useCallback(async () => {
    setShowNamePrompt(false);
    const handle = (nameInput.trim() || "ANON").slice(0, 12).toUpperCase();
    const next = await submitLeaderboardEntry({
      name: handle,
      score: lastScore,
      coins: lastCoins,
      towers: lastTowers,
      zone: (save?.maxZoneReached ?? 1),
    });
    setSaveUi(next);
    // Find our row in the fresh top-N. findIndex on (name, score) is fine —
    // ties are sorted by created_at asc, so the highest-ranked match is the
    // one to surface in the feedback.
    const rankIdx = next.leaderboard.findIndex(
      (e) => e.name === handle && e.score === lastScore
    );
    const rank = rankIdx >= 0 ? rankIdx + 1 : null;
    setSubmissionResult({ submitted: true, rank });
  }, [nameInput, lastScore, lastCoins, lastTowers, save]);

  const tweetText = useMemo(() => {
    return `I just played 'Chikun's Escape' and scored ${lastScore}.\nTry beat my score!\nhttps://www.chikun.meme/arise\n@ChikunLTC 🐔🎮`;
  }, [lastScore]);

  // Opens X's tweet intent in a new tab. URL is embedded in tweetText so we
  // only pass &text=; X auto-shortens the inline link via t.co.
  const openXIntent = useCallback(() => {
    if (typeof window === "undefined") return;
    const intent =
      "https://x.com/intent/tweet" +
      `?text=${encodeURIComponent(tweetText)}`;
    window.open(intent, "_blank", "noopener,noreferrer");
  }, [tweetText]);

  const shareRun = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      // Compose a small share card into an offscreen canvas
      const off = document.createElement("canvas");
      off.width = 800;
      off.height = 420;
      const cctx = off.getContext("2d");
      if (!cctx) return;
      const grad = cctx.createLinearGradient(0, 0, 0, 420);
      const pal = paletteRef.current;
      grad.addColorStop(0, pal.skyTop);
      grad.addColorStop(1, pal.skyBot);
      cctx.fillStyle = grad;
      cctx.fillRect(0, 0, 800, 420);
      cctx.fillStyle = "#ffffff";
      cctx.font = "900 60px system-ui, -apple-system, sans-serif";
      cctx.textAlign = "center";
      cctx.fillText("CHIKUN'S ESCAPE", 400, 80);
      cctx.font = "900 180px system-ui";
      cctx.fillText(String(lastScore), 400, 260);
      cctx.font = "900 22px system-ui";
      cctx.fillText(
        `${lastCoins} COINS · ${lastTowers} TOWERS · BEST ×${lastMaxCombo} COMBO`,
        400,
        320
      );
      cctx.font = "700 14px system-ui";
      cctx.fillStyle = pal.accent;
      cctx.fillText("chikun · the first litecoin meme", 400, 360);

      const blob: Blob | null = await new Promise((res) => off.toBlob(res, "image/png"));
      if (!blob) return;

      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
        share?: (data: ShareData) => Promise<void>;
      };
      const file = new File([blob], "arise-score.png", { type: "image/png" });
      if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
        await nav.share({
          files: [file],
          title: "CHIKUN'S ESCAPE",
          text: `I flew ${lastScore} in CHIKUN'S ESCAPE. Join the flock.`,
        });
        setShareToast("Shared");
      } else {
        // Fallback — copy a PNG data URL to clipboard
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "arise-score.png";
        a.click();
        URL.revokeObjectURL(url);
        setShareToast("Saved PNG");
      }
      setTimeout(() => setShareToast(""), 1800);
    } catch {
      setShareToast("Share failed");
      setTimeout(() => setShareToast(""), 1800);
    }
  }, [lastScore, lastCoins, lastTowers, lastMaxCombo]);

  // ============================================================
  // REACT RENDER (UI overlays)
  // ============================================================
  const hS = save?.highScore ?? 0;
  const bank = save?.bankedCoins ?? 0;
  const skinId = save?.equippedSkin ?? "default";

  return (
    <div className="relative mx-auto flex w-full flex-col items-center select-none">
      <div
        className="ariseFrame relative overflow-hidden border-[3px] border-black rounded-[14px] sm:rounded-[20px] shadow-[4px_4px_0_0_#000] sm:shadow-[8px_8px_0_0_#000]"
        style={{
          aspectRatio: `${CFG.canvas.w} / ${CFG.canvas.h}`,
          // Fit within the viewport: prefer height-driven sizing, fall back to
          // full width. On phones (small landscape) we use more of the vertical
          // space because the nav/footer take proportionally less.
          width: `min(100%, calc(var(--arise-vh, 86vh) * ${CFG.canvas.w} / ${CFG.canvas.h}))`,
          maxHeight: "var(--arise-vh, 86vh)",
          backgroundColor: ZONES[0].palette.skyMid,
        }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointer}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            touchAction: "none",
            cursor: "pointer",
          }}
        />

        {/* Top-right HUD buttons */}
        <div className="absolute top-3 right-3 z-20 flex flex-col gap-2 items-end">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleMute();
            }}
            className="w-11 h-11 rounded-full bg-black/70 hover:bg-black text-white text-sm font-black flex items-center justify-center border-2 border-white/20"
            aria-label={save?.muted ? "Unmute" : "Mute"}
          >
            {save?.muted ? "🔇" : "🔊"}
          </button>
          {stateRef.current === "playing" && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPaused((p) => !p);
              }}
              className="w-11 h-11 rounded-full bg-black/70 hover:bg-black text-white text-sm font-black flex items-center justify-center border-2 border-white/20"
              aria-label="Pause"
            >
              {paused ? "▶" : "❚❚"}
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowSettings(true);
            }}
            className="w-11 h-11 rounded-full bg-black/70 hover:bg-black text-white text-sm font-black flex items-center justify-center border-2 border-white/20"
            aria-label="Settings"
          >
            ⚙
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsFullscreen((f) => !f);
            }}
            className="w-11 h-11 rounded-full bg-black/70 hover:bg-black text-white text-base font-black flex items-center justify-center border-2 border-white/20"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? "⤡" : "⛶"}
          </button>
        </div>

        {/* Bank display */}
        {save && (uiState === "idle" || uiState === "gameover") && (
          <div className="absolute top-3 left-3 z-20 inline-flex items-center gap-2 bg-black/70 border-2 border-white/20 rounded-full px-3 py-1.5 text-white font-black text-xs tracking-widest">
            <span className="text-[#ffcf3a]">Ł</span>
            <span>{bank}</span>
          </div>
        )}

        {/* LOADING */}
        {!assetsReady && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: ZONES[0].palette.skyMid }}
          >
            <div className="font-black tracking-[0.3em] text-black text-sm">
              LOADING THE CHANT...
            </div>
          </div>
        )}

        {/* PAUSE */}
        {paused && uiState === "playing" && (
          <div
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 text-center"
            style={{ background: "rgba(0, 0, 0, 0.65)" }}
          >
            <div className="text-white font-black text-5xl tracking-tight">PAUSED</div>
            <div className="text-white/70 text-xs tracking-[0.3em]">
              TAP ▶ TO RESUME · P OR ESC
            </div>
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={() => setPaused(false)}
                className="px-5 py-2 bg-[#00d632] text-black font-black tracking-widest text-sm rounded-full border-2 border-black"
              >
                RESUME
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaused(false);
                  endGame();
                }}
                className="px-5 py-2 bg-[#ff3344] text-white font-black tracking-widest text-sm rounded-full border-2 border-black"
              >
                QUIT
              </button>
            </div>
          </div>
        )}

        {/* IDLE / START */}
        {assetsReady && uiState === "idle" && !showShop && !showStats && !showAchievements && !showSettings && !showShare && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-between py-8 px-6 text-center">
            <div className="flex flex-col items-center gap-2 mt-4">
              <div className="inline-block bg-black text-white font-black text-[10px] tracking-[0.35em] px-3 py-1 rounded-full">
                CHAPTER ONE · FLIGHT
              </div>
              <h1
                className="text-black font-black leading-[0.85] tracking-tight mt-2"
                style={{ fontSize: "clamp(72px, 16vw, 144px)" }}
              >
                CHIKUN&apos;S
              </h1>
              <div
                className="font-black leading-[0.9] tracking-tight -mt-1"
                style={{
                  fontSize: "clamp(28px, 6vw, 48px)",
                  color: COLORS.lime,
                  transform: "rotate(-3deg)",
                }}
              >
                ESCAPE
              </div>
              <div className="mt-4 text-black/80 text-sm font-semibold max-w-[320px] leading-snug">
                The Elite clipped your wings. LitVM gave them back. Reclaim the sky.
              </div>
              {currentVignetteRef.current && (
                <div className="mt-2 text-[11px] italic text-black/55 max-w-[300px] leading-snug">
                  "{currentVignetteRef.current}"
                </div>
              )}
            </div>
            <div className="flex flex-col items-center gap-3 mb-2 pointer-events-auto">
              <div className="px-7 py-3 bg-black text-white font-black tracking-[0.15em] text-lg rounded-full shadow-[4px_4px_0_0_rgba(0,0,0,0.25)]">
                TAP TO ESCAPE
              </div>
              <div className="text-[10px] tracking-[0.3em] text-black/60 font-bold">
                SPACE · CLICK · TAP · M MUTE · P PAUSE
              </div>
              <div className="flex gap-2 mt-1 flex-wrap justify-center">
                {hS > 0 && (
                  <div className="inline-block bg-[#f5f1e8] text-black font-black text-[11px] tracking-[0.25em] px-3 py-1 rounded-full border-2 border-black">
                    BEST · {hS}
                  </div>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowShop(true);
                  }}
                  className="bg-black text-white font-black text-[11px] tracking-[0.25em] px-3 py-1 rounded-full border-2 border-white/10 hover:bg-[#111]"
                >
                  SHOP
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowStats(true);
                  }}
                  className="bg-black text-white font-black text-[11px] tracking-[0.25em] px-3 py-1 rounded-full border-2 border-white/10 hover:bg-[#111]"
                >
                  STATS
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAchievements(true);
                  }}
                  className="bg-black text-white font-black text-[11px] tracking-[0.25em] px-3 py-1 rounded-full border-2 border-white/10 hover:bg-[#111]"
                >
                  AWARDS
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tutorial hint */}
        {tutorialVisible && uiState === "idle" && (
          <div className="pointer-events-none absolute left-1/2 top-[62%] -translate-x-1/2 bg-black/85 text-white text-xs font-black tracking-[0.22em] px-3 py-2 rounded-md border-2 border-white/20 animate-pulse">
            TAP ANYWHERE TO FLAP
          </div>
        )}

        {/* GAME OVER */}
        {assetsReady && uiState === "gameover" && !showShop && !showStats && !showAchievements && !showSettings && !showShare && (
          <div
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center"
            style={{ background: "rgba(8, 10, 25, 0.78)" }}
          >
            <div className="inline-block bg-[#ff3344] text-white font-black text-[10px] tracking-[0.35em] px-3 py-1 rounded-[4px] border-2 border-black -rotate-2 shadow-[3px_3px_0_0_#000]">
              CLASSIFIED · INCIDENT REPORT
            </div>
            <div
              className="text-white/90 font-black leading-[0.9] tracking-tight"
              style={{ fontSize: "clamp(22px, 4.5vw, 34px)" }}
            >
              "{currentTauntRef.current}"
            </div>
            <div
              className="text-white font-black leading-none"
              style={{
                fontSize: "clamp(80px, 18vw, 140px)",
                textShadow: "4px 4px 0 #000",
              }}
            >
              {displayScoreState}
            </div>
            <div className="flex gap-2 flex-wrap justify-center">
              <div className="bg-[#f5f1e8] text-black font-black text-[11px] tracking-[0.25em] px-3 py-1 rounded-full border-2 border-black">
                COINS · {lastCoins}
              </div>
              <div className="bg-black text-white font-black text-[11px] tracking-[0.25em] px-3 py-1 rounded-full border-2 border-black">
                TOWERS · {lastTowers}
              </div>
              <div className="bg-black text-white font-black text-[11px] tracking-[0.25em] px-3 py-1 rounded-full border-2 border-black">
                ×{lastMaxCombo} COMBO
              </div>
              <div className="bg-[#00d632] text-black font-black text-[11px] tracking-[0.25em] px-3 py-1 rounded-full border-2 border-black">
                BEST · {hS}
              </div>
            </div>
            {newAchievements.length > 0 && (
              <div className="flex flex-col items-center gap-1 mt-1">
                {newAchievements.map((id) => {
                  const a = ACHIEVEMENTS.find((x) => x.id === id);
                  return (
                    <div
                      key={id}
                      className="inline-block bg-[#ffcf3a] text-black font-black text-[11px] tracking-[0.2em] px-3 py-1 rounded border-2 border-black -rotate-1"
                    >
                      ★ {a?.name ?? id}
                    </div>
                  );
                })}
              </div>
            )}

            {showNamePrompt && (
              <div className="pointer-events-auto flex flex-col items-center gap-2 mt-1 bg-black/75 border-2 border-[#00d632] rounded-xl px-4 py-3 w-full max-w-xs shadow-[4px_4px_0_0_#000]">
                <div className="text-[#00d632] font-black text-xs tracking-[0.3em]">
                  ★ CLAIM YOUR HANDLE ★
                </div>
                <input
                  type="text"
                  maxLength={12}
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitName();
                  }}
                  placeholder="YOUR NAME"
                  autoFocus
                  className="w-full bg-black text-white font-black text-base tracking-[0.25em] text-center px-3 py-2 border-2 border-white/20 rounded focus:outline-none focus:border-[#00d632] uppercase"
                />
                <button
                  type="button"
                  onClick={submitName}
                  className="w-full bg-[#00d632] text-black font-black text-sm tracking-widest py-2 rounded border-2 border-black"
                >
                  SUBMIT SCORE
                </button>
              </div>
            )}
            {submissionResult?.submitted && submissionResult.rank !== null && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  document
                    .getElementById("leaderboard")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="pointer-events-auto flex flex-col items-center gap-0.5 bg-[#00d632] text-black font-black px-4 py-2 rounded-xl border-2 border-black shadow-[3px_3px_0_0_#000] -rotate-1"
              >
                <div className="text-xs tracking-[0.25em]">
                  ★ #{submissionResult.rank} ON THE LEADERBOARD ★
                </div>
                <div className="text-[10px] tracking-[0.2em] opacity-80">
                  TAP TO SEE IT
                </div>
              </button>
            )}
            {submissionResult?.submitted && submissionResult.rank === null && (
              <div className="text-bone/70 font-black text-[11px] tracking-[0.25em] text-center max-w-[240px]">
                SCORE RECORDED — DIDN&apos;T CRACK THE TOP {LEADERBOARD_SIZE}.
                <br />
                FLAP HARDER.
              </div>
            )}

            <div className="pointer-events-auto flex gap-2 mt-2 flex-wrap justify-center">
              {!showNamePrompt && (
                <div className="px-7 py-3 bg-[#00d632] text-black font-black tracking-[0.15em] text-lg rounded-full border-2 border-black shadow-[4px_4px_0_0_#000]">
                  TAP TO ESCAPE AGAIN
                </div>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowShare(true);
                }}
                className="px-5 py-3 bg-black text-white font-black tracking-[0.15em] text-sm rounded-full border-2 border-white/20"
              >
                SHARE
              </button>
            </div>
            {shareToast && (
              <div className="text-xs text-white/70 font-black tracking-widest mt-1">
                {shareToast}
              </div>
            )}
          </div>
        )}

        {/* SHOP MODAL */}
        {showShop && save && (
          <Modal onClose={() => setShowShop(false)} title="SHOP" accent={palette().accent}>
            <div className="mb-3 text-[11px] tracking-[0.25em] text-white/70 font-black">
              YOU HAVE <span className="text-[#ffcf3a]">Ł {save.bankedCoins}</span>
            </div>
            <div className="text-[10px] tracking-[0.3em] text-white/80 font-black mb-2">SKINS</div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {SKINS.map((s) => {
                const owned = save.ownedSkins.includes(s.id);
                const equipped = save.equippedSkin === s.id;
                const canAfford = save.bankedCoins >= s.cost;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => buySkin(s)}
                    disabled={!owned && !canAfford}
                    className={`text-left p-2 rounded border-2 transition ${
                      equipped
                        ? "bg-[#00d632] text-black border-black"
                        : owned
                        ? "bg-black text-white border-white/30 hover:bg-[#111]"
                        : canAfford
                        ? "bg-black/70 text-white border-white/20 hover:bg-black"
                        : "bg-black/40 text-white/40 border-white/10 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-5 h-5 rounded-full border-2"
                        style={{
                          background: s.tint ?? "#f5f1e8",
                          borderColor: s.aura ?? "#000",
                        }}
                      />
                      <div className="flex-1">
                        <div className="font-black text-xs tracking-widest">{s.name}</div>
                        <div className="text-[10px] opacity-80">
                          {equipped ? "EQUIPPED" : owned ? "TAP TO EQUIP" : `Ł ${s.cost}`}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="text-[10px] tracking-[0.3em] text-white/80 font-black mb-2">TRAILS</div>
            <div className="grid grid-cols-2 gap-2">
              {TRAILS.map((t) => {
                const owned = save.ownedTrails.includes(t.id);
                const equipped = save.equippedTrail === t.id;
                const canAfford = save.bankedCoins >= t.cost;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => buyTrail(t)}
                    disabled={!owned && !canAfford}
                    className={`text-left p-2 rounded border-2 transition ${
                      equipped
                        ? "bg-[#00d632] text-black border-black"
                        : owned
                        ? "bg-black text-white border-white/30 hover:bg-[#111]"
                        : canAfford
                        ? "bg-black/70 text-white border-white/20 hover:bg-black"
                        : "bg-black/40 text-white/40 border-white/10 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-5 h-5 rounded-full border-2 border-black"
                        style={{
                          background:
                            t.color === "rainbow"
                              ? "conic-gradient(red, orange, yellow, green, cyan, blue, magenta, red)"
                              : `rgb(${t.color})`,
                        }}
                      />
                      <div className="flex-1">
                        <div className="font-black text-xs tracking-widest">{t.name}</div>
                        <div className="text-[10px] opacity-80">
                          {equipped ? "EQUIPPED" : owned ? "TAP TO EQUIP" : `Ł ${t.cost}`}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Modal>
        )}

        {/* STATS MODAL */}
        {showStats && save && (
          <Modal onClose={() => setShowStats(false)} title="STATS" accent={palette().accent}>
            <StatRow label="HIGH SCORE" v={save.highScore} />
            <StatRow label="LIFETIME COINS" v={save.lifetimeCoins} />
            <StatRow label="BANKED" v={save.bankedCoins} />
            <StatRow label="TOWERS PASSED" v={save.lifetimeTowers} />
            <StatRow label="RUNS" v={save.lifetimeRuns} />
            <StatRow label="DEATHS" v={save.lifetimeDeaths} />
            <StatRow label="FLAPS" v={save.lifetimeFlaps} />
            <StatRow label="BEST COMBO" v={`×${save.bestCombo}`} />
            <StatRow label="FURTHEST ZONE" v={ZONES[save.maxZoneReached - 1]?.name ?? ZONES[0].name} />
            <StatRow
              label="DAILY BEST"
              v={save.lastDailySeed === todaySeed() ? save.dailyBestScore : 0}
            />
          </Modal>
        )}

        {/* ACHIEVEMENTS MODAL */}
        {showAchievements && save && (
          <Modal
            onClose={() => setShowAchievements(false)}
            title="AWARDS"
            accent={palette().accent}
          >
            <div className="text-[11px] tracking-[0.25em] text-white/70 font-black mb-3">
              {save.achievements.length} / {ACHIEVEMENTS.length} UNLOCKED
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {ACHIEVEMENTS.map((a) => {
                const unlocked = save.achievements.includes(a.id);
                return (
                  <div
                    key={a.id}
                    className={`p-2 rounded border-2 ${
                      unlocked
                        ? "bg-[#ffcf3a]/20 border-[#ffcf3a] text-white"
                        : "bg-black/40 border-white/10 text-white/40"
                    }`}
                  >
                    <div className="font-black text-xs tracking-widest">
                      {unlocked ? "★" : "○"} {a.name}
                    </div>
                    <div className="text-[10px] opacity-80">{a.description}</div>
                  </div>
                );
              })}
            </div>
          </Modal>
        )}

        {/* SETTINGS MODAL */}
        {showSettings && save && (
          <Modal onClose={() => setShowSettings(false)} title="SETTINGS" accent={palette().accent}>
            <ToggleRow label="SOUND" on={!save.muted} onToggle={toggleMute} />
            <ToggleRow label="HAPTICS" on={save.hapticsEnabled} onToggle={toggleHaptics} />
            <ToggleRow
              label="REDUCED MOTION"
              on={save.reducedMotion}
              onToggle={toggleReducedMotion}
            />
            <div className="text-[10px] tracking-[0.25em] text-white/60 font-black mt-3 leading-snug">
              CONTROLS · SPACE / CLICK / TAP · P OR ESC TO PAUSE · M TO MUTE
            </div>
          </Modal>
        )}

        {/* SHARE MODAL */}
        {showShare && (
          <Modal
            onClose={() => setShowShare(false)}
            title="SHARE YOUR RUN"
            accent={palette().accent}
          >
            {/* Score readout */}
            <div className="rounded-xl border-2 border-white/15 bg-white/5 p-4 mb-3">
              <div className="text-[10px] tracking-[0.3em] text-white/60 font-black">
                CHIKUN&apos;S ESCAPE
              </div>
              <div className="flex items-baseline gap-3 mt-1">
                <div className="font-black text-white leading-none text-5xl tabular-nums">
                  {lastScore}
                </div>
                <div className="text-[11px] tracking-[0.2em] text-white/70 font-black">
                  SCORE
                </div>
              </div>
              <div className="text-[11px] tracking-[0.2em] text-white/70 font-black mt-2">
                {lastCoins} COINS · {lastTowers} TOWERS · ×{lastMaxCombo} BEST COMBO
              </div>
            </div>

            {/* Tweet preview — URL is inside tweetText so no separate line. */}
            <div className="rounded-xl border-2 border-white/15 bg-black/50 p-3 mb-4 text-sm leading-snug">
              <div className="text-white whitespace-pre-line font-medium break-all">
                {tweetText}
              </div>
            </div>

            {/* Actions */}
            <button
              type="button"
              onClick={() => {
                openXIntent();
                setShowShare(false);
              }}
              className="w-full py-3 bg-black text-white font-black tracking-[0.2em] text-sm rounded-full border-2 border-white hover:bg-white hover:text-black transition-colors flex items-center justify-center gap-2"
            >
              {/* X logo */}
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4"
                fill="currentColor"
                aria-hidden
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              POST TO X
            </button>

            <button
              type="button"
              onClick={() => {
                shareRun();
                setShowShare(false);
              }}
              className="w-full py-2.5 mt-2 bg-white/10 text-white font-black tracking-[0.2em] text-xs rounded-full border-2 border-white/15 hover:bg-white/15"
            >
              DOWNLOAD CARD (PNG)
            </button>

            {shareToast && (
              <div className="text-xs text-white/70 font-black tracking-widest mt-3 text-center">
                {shareToast}
              </div>
            )}
          </Modal>
        )}
      </div>
    </div>
  );
}

// ============================================================
// REACT SUBCOMPONENTS (overlays)
// ============================================================
function Modal({
  onClose,
  title,
  accent,
  children,
}: {
  onClose: () => void;
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center p-4"
      style={{ background: "rgba(0, 0, 0, 0.72)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md bg-[#0a0d12] border-2 border-black rounded-2xl p-4 shadow-[6px_6px_0_0_#000] overflow-hidden"
        style={{ borderColor: accent }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="font-black text-white text-sm tracking-[0.3em]">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 text-white font-black flex items-center justify-center hover:bg-white/20"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto pr-1 text-white">{children}</div>
      </div>
    </div>
  );
}

function StatRow({ label, v }: { label: string; v: number | string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/10">
      <div className="text-[11px] tracking-[0.25em] text-white/70 font-black">{label}</div>
      <div className="text-white font-black">{v}</div>
    </div>
  );
}

function ToggleRow({
  label,
  on,
  onToggle,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between py-2 border-b border-white/10"
    >
      <div className="text-[11px] tracking-[0.25em] text-white/80 font-black">{label}</div>
      <div
        className={`w-10 h-5 rounded-full relative transition ${
          on ? "bg-[#00d632]" : "bg-white/20"
        }`}
      >
        <div
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-black transition-all ${
            on ? "left-5" : "left-0.5"
          }`}
        />
      </div>
    </button>
  );
}

// ============================================================
// HELPERS
// ============================================================
function spawnFeather(x: number, y: number, energy: number): Feather {
  return {
    x,
    y,
    vx: (Math.random() - 0.5) * 2 * energy,
    vy: (Math.random() - 1) * energy,
    rot: Math.random() * Math.PI * 2,
    vrot: (Math.random() - 0.5) * 0.2,
    life: 1,
  };
}

function spawnSpark(x: number, y: number, energy: number, color: string): Spark {
  const angle = Math.random() * Math.PI * 2;
  const speed = energy * (0.4 + Math.random() * 0.8);
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - 1,
    life: 1,
    size: 3 + Math.random() * 3,
    color,
  };
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function hexToRgba(hex: string, a: number) {
  if (hex.startsWith("rgba") || hex.startsWith("rgb")) {
    // Try to reuse the components
    const m = hex.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${a})`;
    return hex;
  }
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function powerupColor(kind: PowerUpKind): string {
  return kind === "shield" ? COLORS.cyan : kind === "magnet" ? COLORS.magenta : COLORS.orange;
}

function powerupGlyph(kind: PowerUpKind): string {
  return kind === "shield" ? "◈" : kind === "magnet" ? "U" : "◷";
}

function powerupLabel(kind: PowerUpKind): string {
  return kind === "shield" ? "SHIELD" : kind === "magnet" ? "MAGNET" : "SLOWMO";
}

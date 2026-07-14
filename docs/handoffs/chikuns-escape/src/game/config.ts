/**
 * ARISE — static config / content tables.
 * Kept out of the main component so gameplay code stays scannable.
 */

// ============================================================
// CORE CONFIG
// ============================================================
export const CFG = {
  canvas: { w: 1280, h: 720 },
  chikun: {
    x: 280,
    size: 110,
    hitRadius: 30,
  },
  physics: {
    gravity: 0.09,
    flapV: -3.6,
    maxFall: 5,
    deathGravity: 0.55,
  },
  tower: {
    width: 130,
    gap: 320,
    spacing: 640,
    minGapY: 180,
    maxGapY: 540,
    firstTowerXOffset: 80,
  },
  scroll: {
    initial: 2.4,
    max: 3.8,
    rampPerTower: 0.025,
  },
  coin: {
    radius: 20,
    value: 5,
    magnetRadius: 120,
    magnetStrength: 0.22,
  },
  juice: {
    deathShake: 18,
    shakeDecay: 0.86,
    hitStopMs: 110,
    flapSquashMs: 220,
    sparksOnCoin: 10,
    trailLines: 5,
    deathFlashMs: 260,
    chromaticMaxShift: 7,
  },
  popup: {
    lifeMs: 900,
    rise: 1.1,
  },
  zoneBanner: {
    durationMs: 2600,
  },
  powerup: {
    radius: 24,
    spawnChance: 0.18,
    shieldMs: 6000,
    magnetMs: 7000,
    slowmoMs: 5000,
    slowmoFactor: 0.55,
  },
  drone: {
    spawnChance: 0.22,
    speedMult: 1.3,
    size: 36,
    hitRadius: 22,
  },
  boss: {
    everyTowers: 25,
    durationMs: 12000,
    approachMs: 1200,
  },
  towerScore: 1,
  flapAnimMs: 180,
  featherOnFlap: 1,
  featherOnDeath: 14,
};

// ============================================================
// COLORS — static palette; zone colors live in ZONES
// ============================================================
export const COLORS = {
  ground: "#050607",
  groundEdge: "#00d632",
  black: "#000000",
  towerFill: "#0a0d12",
  towerStroke: "#00d632",
  towerWindow: "#2dff5c",
  neonGreen: "#00d632",
  lime: "#2dff5c",
  red: "#ff3344",
  cream: "#f5f1e8",
  feather: "#ffffff",
  coinBody: "#e0e5ec",
  coinRim: "#6c7380",
  gold: "#ffcf3a",
  cyan: "#31e0ff",
  magenta: "#ff3dc0",
  orange: "#ff8a2a",
};

// ============================================================
// ZONES — chapters the player passes through.
// Tower ranges are inclusive of `startTower`; last zone continues forever.
// ============================================================
export interface ZonePalette {
  skyTop: string;
  skyMid: string;
  skyBot: string;
  cityFar: string;
  cityNear: string;
  mountain: string;
  cloud: string;
  accent: string;
  /** Hex color for lit windows on the near city silhouette; null = no lights. */
  windowColor: string | null;
  /** 0..1 — how dense the lit windows are, and how bright they glow. */
  windowIntensity: number;
}

export interface Zone {
  id: number;
  chapter: string;
  name: string;
  tagline: string;
  startTower: number;
  palette: ZonePalette;
  modifiers: {
    movingTowers?: boolean;
    drones?: boolean;
    slidingPanels?: boolean;
  };
}

export const ZONES: Zone[] = [
  {
    id: 0,
    chapter: "CHAPTER ONE",
    name: "THE YARD",
    tagline: "Clipped. Caged. Forgotten.",
    startTower: 0,
    palette: {
      // Urban daylight — clear sky, pale haze on the horizon.
      skyTop: "#1a3ec7",
      skyMid: "#3d6ce5",
      skyBot: "#9ec0f2",
      cityFar: "rgba(50, 70, 110, 0.55)",
      cityNear: "rgba(18, 28, 52, 0.88)",
      mountain: "rgba(35, 52, 95, 0.45)",
      cloud: "rgba(255, 255, 255, 0.55)",
      accent: "#00d632",
      windowColor: null,
      windowIntensity: 0,
    },
    modifiers: {},
  },
  {
    id: 1,
    chapter: "CHAPTER TWO",
    name: "CORPORATE HEIGHTS",
    tagline: "The sun goes down on the Elite.",
    startTower: 25,
    palette: {
      // Burning sunset — deep purple top, molten orange mid, soft yellow horizon.
      skyTop: "#311763",
      skyMid: "#e8572a",
      skyBot: "#ffc969",
      cityFar: "rgba(32, 14, 44, 0.7)",
      cityNear: "rgba(8, 2, 18, 0.94)",
      mountain: "rgba(70, 28, 68, 0.5)",
      cloud: "rgba(255, 188, 110, 0.5)",
      accent: "#ffcf3a",
      windowColor: "#ffd27a",
      windowIntensity: 0.5,
    },
    modifiers: {},
  },
  {
    id: 2,
    chapter: "CHAPTER THREE",
    name: "BLUE HOUR",
    tagline: "The city lights up. You do too.",
    startTower: 50,
    palette: {
      // Blue-hour downtown — deep indigo sky, city turning its lights on.
      skyTop: "#020216",
      skyMid: "#1a1355",
      skyBot: "#4025a0",
      cityFar: "rgba(6, 4, 28, 0.82)",
      cityNear: "rgba(2, 0, 14, 0.97)",
      mountain: "rgba(20, 10, 58, 0.6)",
      cloud: "rgba(180, 130, 230, 0.25)",
      accent: "#ff3dc0",
      windowColor: "#ff6ddc",
      windowIntensity: 0.85,
    },
    modifiers: { movingTowers: true, drones: true, slidingPanels: true },
  },
  {
    id: 3,
    chapter: "CHAPTER FOUR",
    name: "MIDNIGHT",
    tagline: "The sky is yours. They forgot to lock it.",
    startTower: 75,
    palette: {
      // Deep night — near-black sky, brightest neon city.
      skyTop: "#000003",
      skyMid: "#030820",
      skyBot: "#0a1840",
      cityFar: "rgba(0, 0, 8, 0.92)",
      cityNear: "rgba(0, 0, 0, 0.99)",
      mountain: "rgba(6, 18, 45, 0.7)",
      cloud: "rgba(120, 180, 255, 0.18)",
      accent: "#31e0ff",
      windowColor: "#6df0ff",
      windowIntensity: 1,
    },
    modifiers: { movingTowers: true, drones: true, slidingPanels: true },
  },
];

export function getZoneIndex(towersPassed: number): number {
  for (let i = ZONES.length - 1; i >= 0; i--) {
    if (towersPassed >= ZONES[i].startTower) return i;
  }
  return 0;
}

export function getZone(towersPassed: number): Zone {
  return ZONES[getZoneIndex(towersPassed)];
}

// Linear blend between current zone and the next, within the last 4 towers of
// the current zone — gives a visible palette shift as you approach the boundary.
export function getBlendedPalette(towersPassed: number): ZonePalette {
  const idx = getZoneIndex(towersPassed);
  const cur = ZONES[idx];
  const next = ZONES[idx + 1];
  if (!next) return cur.palette;
  const windowStart = next.startTower - 4;
  if (towersPassed < windowStart) return cur.palette;
  const t = Math.min(1, (towersPassed - windowStart) / 4);
  return blendPalette(cur.palette, next.palette, t);
}

function blendPalette(a: ZonePalette, b: ZonePalette, t: number): ZonePalette {
  return {
    skyTop: mix(a.skyTop, b.skyTop, t),
    skyMid: mix(a.skyMid, b.skyMid, t),
    skyBot: mix(a.skyBot, b.skyBot, t),
    cityFar: mix(a.cityFar, b.cityFar, t),
    cityNear: mix(a.cityNear, b.cityNear, t),
    mountain: mix(a.mountain, b.mountain, t),
    cloud: mix(a.cloud, b.cloud, t),
    accent: mix(a.accent, b.accent, t),
    // Pick the non-null window color as early as it's introduced; intensity lerps linearly.
    windowColor: b.windowColor ?? a.windowColor,
    windowIntensity:
      a.windowIntensity + (b.windowIntensity - a.windowIntensity) * t,
  };
}

function parseColor(c: string): [number, number, number, number] {
  if (c.startsWith("#")) {
    const hex = c.slice(1);
    const n =
      hex.length === 3
        ? hex
            .split("")
            .map((ch) => ch + ch)
            .join("")
        : hex;
    return [
      parseInt(n.slice(0, 2), 16),
      parseInt(n.slice(2, 4), 16),
      parseInt(n.slice(4, 6), 16),
      1,
    ];
  }
  const m = c.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/
  );
  if (m) return [+m[1], +m[2], +m[3], m[4] !== undefined ? +m[4] : 1];
  return [0, 0, 0, 1];
}

function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab, aa] = parseColor(a);
  const [br, bg, bb, ba] = parseColor(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  const al = aa + (ba - aa) * t;
  return `rgba(${r}, ${g}, ${bl}, ${al.toFixed(3)})`;
}

// ============================================================
// SKINS — cosmetic Chikun tints, unlocked with lifetime coins
// ============================================================
export interface Skin {
  id: string;
  name: string;
  cost: number;
  tint: string | null;
  aura?: string;
  description: string;
}

export const SKINS: Skin[] = [
  { id: "default", name: "Chikun", cost: 0, tint: null, description: "The original hero." },
  { id: "neon", name: "Neon", cost: 150, tint: "#2dff5c", aura: "#00d632", description: "LitVM overclock build." },
  { id: "gold", name: "24 Karat", cost: 400, tint: "#ffcf3a", aura: "#ffd84a", description: "The Elite's worst nightmare: a wealthy chicken." },
  { id: "cyan", name: "Ice", cost: 400, tint: "#9de8ff", aura: "#31e0ff", description: "Cold-blooded. Kinda." },
  { id: "magenta", name: "Trollbox", cost: 600, tint: "#ff9bd8", aura: "#ff3dc0", description: "Summoned from ancient IRC." },
  { id: "shadow", name: "Shadow", cost: 900, tint: "#444444", aura: "#222222", description: "The chikun they couldn't kill." },
  { id: "inferno", name: "Inferno", cost: 1500, tint: "#ff5a2a", aura: "#ff3344", description: "Combustible poultry." },
];

// ============================================================
// TRAILS — speed-line color variants
// ============================================================
export interface Trail {
  id: string;
  name: string;
  cost: number;
  color: string;
}

export const TRAILS: Trail[] = [
  { id: "default", name: "Standard", cost: 0, color: "255, 255, 255" },
  { id: "neon", name: "Neon", cost: 100, color: "45, 255, 92" },
  { id: "gold", name: "Gold", cost: 300, color: "255, 207, 58" },
  { id: "cyan", name: "Cyan", cost: 300, color: "49, 224, 255" },
  { id: "rainbow", name: "Rainbow", cost: 1200, color: "rainbow" },
];

// ============================================================
// ACHIEVEMENTS
// ============================================================
export interface AchievementCtx {
  runScore: number;
  runCoins: number;
  runTowers: number;
  runMaxCombo: number;
  runNoHit: boolean;
  runNoCoins: boolean;
  lifetimeCoins: number;
  lifetimeTowers: number;
  lifetimeRuns: number;
  highScore: number;
  zonesReached: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  check: (ctx: AchievementCtx) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first_flap", name: "First Flap", description: "Start your first run.", check: (c) => c.lifetimeRuns >= 1 },
  { id: "ten_towers", name: "Getting The Hang", description: "Pass 10 towers in a run.", check: (c) => c.runTowers >= 10 },
  { id: "twentyfive", name: "Escape The Yard", description: "Reach Corporate Heights.", check: (c) => c.zonesReached >= 2 },
  { id: "fifty", name: "Blue Hour", description: "Reach Blue Hour.", check: (c) => c.zonesReached >= 3 },
  { id: "seventyfive", name: "High Altitude", description: "Reach the final zone.", check: (c) => c.zonesReached >= 4 },
  { id: "hundred", name: "Century Chikun", description: "Score 100 in one run.", check: (c) => c.runScore >= 100 },
  { id: "ascetic", name: "Ascetic Bird", description: "Pass 15 towers without collecting a coin.", check: (c) => c.runTowers >= 15 && c.runNoCoins },
  { id: "greedy", name: "Greedy Bird", description: "Collect 20 coins in a single run.", check: (c) => c.runCoins >= 20 },
  { id: "combo_ten", name: "On Fire", description: "Hit a ×10 combo.", check: (c) => c.runMaxCombo >= 10 },
  { id: "thousand_coins", name: "Thousand-Coin Chikun", description: "Bank 1,000 lifetime coins.", check: (c) => c.lifetimeCoins >= 1000 },
];

// ============================================================
// NARRATIVE FLAVOR
// ============================================================
export const HEADLINES: string[] = ["DEFEAT THE GLOBAL ELITE"];

export const VILLAIN_TAUNTS: string[] = [
  "You've dishonoured SatoshiLite.",
  "Coblee expected more.",
  "Hard money is not your path.",
];

export const VIGNETTES: string[] = [
  "A feather drifts past a Big Corp window. Someone closes the blinds.",
  "Somewhere below, a chikun reads the gravity law out loud and laughs.",
  "The Elite hold a meeting about the draft. They adjust their ties.",
  "LitVM hums in a basement. It is not worried.",
  "A sign reads 'NO FLIGHT ZONE'. A feather lands on it.",
  "Children point at the sky. They are told not to.",
  "A drone returns empty-handed. Nothing to see.",
  "The old trollboxes remember. They are patient.",
];

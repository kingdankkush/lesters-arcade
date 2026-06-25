// Canonical seeded PRNG for Lester's Arcade / Hard Money Heroes.
//
// WHY THIS MODULE EXISTS
// Determinism is the prerequisite for replay verification, daily-seed boards,
// reproducible bug reports, and server-side anti-cheat (re-simulating a run from
// its seed + input log and checking the score matches). Two identical copies of
// `mulberry32` had already drifted into `drop-tables.mjs` and `leaderboard-seed.mjs`;
// this is the single source of truth they now both import.
//
// mulberry32 is a fast, well-distributed 32-bit PRNG. Same seed -> same sequence
// on every platform (no Math.random, no float nondeterminism in the generator).
//
// Pure + DOM-free + dependency-free so it is trivially unit-testable and safe to
// import anywhere (pure logic modules AND the runtime).

/**
 * Create a raw mulberry32 generator: a zero-arg function returning a float in
 * [0, 1). This is the canonical implementation; the bitwise spelling is chosen
 * to match the two prior copies exactly so existing seeded output is unchanged.
 * @param {number} seed - any integer; coerced to uint32.
 * @returns {() => number}
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Hash an arbitrary integer-ish value into a well-mixed uint32 seed. Useful when
 * a caller wants to derive an independent stream from a base seed plus a salt
 * (e.g. seed ^ hashSeed(frameIndex)) without correlated low bits.
 * @param {number} value
 * @returns {number} uint32
 */
export function hashSeed(value) {
  let h = (Math.floor(Number(value) || 0) ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0x45d9f3b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * A stateful, resumable seeded RNG with convenience helpers. This is what the
 * combat runtime uses for gameplay rolls (crit chance, jitter that affects sim
 * state, etc.) so a run is fully reproducible from its seed + the order of draws.
 *
 * `count` tracks how many draws have happened, which lets a verifier resume the
 * exact stream position when re-simulating from an input log.
 */
export class SeededRng {
  /** @param {number} seed @param {number} [count] - draws already consumed (for resume). */
  constructor(seed = 1, count = 0) {
    this.seed = Math.floor(Number(seed) || 1) >>> 0;
    this._next = mulberry32(this.seed);
    this.count = 0;
    // Fast-forward to a prior stream position when resuming a replay.
    for (let i = 0; i < count; i += 1) this.float();
  }

  /** Next float in [0, 1). */
  float() {
    this.count += 1;
    return this._next();
  }

  /** Float in [min, max). */
  range(min, max) {
    return min + (max - min) * this.float();
  }

  /** Integer in [min, max] inclusive. */
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  /** True with probability p (default 0.5). */
  chance(p = 0.5) {
    return this.float() < p;
  }

  /** Uniformly pick one element of a non-empty array. */
  pick(arr) {
    if (!arr || arr.length === 0) return undefined;
    return arr[Math.floor(this.float() * arr.length)];
  }

  /** Snapshot for persistence/resume: { seed, count }. */
  snapshot() {
    return { seed: this.seed, count: this.count };
  }

  /** Rebuild an RNG at the exact stream position of a snapshot. */
  static fromSnapshot(snap = {}) {
    return new SeededRng(snap.seed ?? 1, snap.count ?? 0);
  }
}

/** Convenience factory mirroring the class for call sites that prefer a function. */
export function createSeededRng(seed = 1, count = 0) {
  return new SeededRng(seed, count);
}

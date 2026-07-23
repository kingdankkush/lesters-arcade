export const FIXED_STEP_MS = 1000 / 60;
export const MAX_CATCH_UP_STEPS = 4;
export const DEFAULT_MAX_FRAME_DELTA_MS = 100;

const UINT32_MAX = 0xffff_ffff;
const FLOAT_EPSILON = 1e-9;
const RANDOM_STREAMS = new Set(['encounters', 'drops']);

function positiveFinite(value, name) {
  if (!Number.isFinite(value) || value <= 0) throw new TypeError(`${name} must be a positive finite number`);
  return value;
}

function validSeed(value) {
  if (!Number.isInteger(value) || value < 0 || value > UINT32_MAX) throw new TypeError('seed must be an unsigned 32-bit integer');
  return value >>> 0;
}

function freezeClone(value, path = 'input') {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`${path} numbers must be finite`);
    return value;
  }
  if (Array.isArray(value)) return Object.freeze(value.map((item, index) => freezeClone(item, `${path}[${index}]`)));
  if (typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError(`${path} must contain only plain deterministic data`);
  }
  const clone = {};
  for (const [key, child] of Object.entries(value)) clone[key] = freezeClone(child, `${path}.${key}`);
  return Object.freeze(clone);
}

function hashStreamSeed(seed, streamName) {
  let hash = (seed ^ 0x811c9dc5) >>> 0;
  for (let index = 0; index < streamName.length; index += 1) {
    hash ^= streamName.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash || 0x6d2b79f5;
}

function nextUint32(state) {
  let value = state >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return value >>> 0 || 0x6d2b79f5;
}

function zeroLossMetrics() {
  return {
    rawWallClockLossMs: 0,
    accumulatorOverflowMs: 0,
    totalDroppedMs: 0,
  };
}

export class DeterministicSimulation {
  constructor({
    fixedStepMs = FIXED_STEP_MS,
    maxFrameDeltaMs = DEFAULT_MAX_FRAME_DELTA_MS,
    maxCatchUpSteps = MAX_CATCH_UP_STEPS,
    seed = 0,
  } = {}) {
    this.fixedStepMs = positiveFinite(fixedStepMs, 'fixedStepMs');
    this.maxFrameDeltaMs = positiveFinite(maxFrameDeltaMs, 'maxFrameDeltaMs');
    if (!Number.isInteger(maxCatchUpSteps) || maxCatchUpSteps < 1 || maxCatchUpSteps > MAX_CATCH_UP_STEPS) {
      throw new TypeError(`maxCatchUpSteps must be an integer from 1 to ${MAX_CATCH_UP_STEPS}`);
    }
    this.maxCatchUpSteps = maxCatchUpSteps;
    this.seed = validSeed(seed);
    this.state = 'start';
    this.tick = 0;
    this.accumulatorMs = 0;
    this.interpolationAlpha = 0;
    this.resumeState = 'active';
    this.lossMetrics = zeroLossMetrics();
    this.stepCallbacks = new Set();
    this.replayCallbacks = new Set();
    this.randomStates = new Map([
      ['encounters', hashStreamSeed(this.seed, 'encounters')],
      ['drops', hashStreamSeed(this.seed, 'drops')],
    ]);
  }

  get timeMs() {
    return this.tick * this.fixedStepMs;
  }

  resetAccumulator() {
    this.accumulatorMs = 0;
    this.interpolationAlpha = 0;
  }

  start() {
    if (this.state === 'exit') throw new Error('Cannot start a simulation after exit');
    if (this.state !== 'start') throw new Error(`Cannot start simulation from ${this.state}`);
    this.state = 'active';
  }

  pause() {
    if (this.state !== 'active' && this.state !== 'upgrade') throw new Error(`Cannot pause simulation from ${this.state}`);
    this.resumeState = this.state;
    this.state = 'paused';
    this.resetAccumulator();
  }

  resume() {
    if (this.state !== 'paused') throw new Error(`Cannot resume simulation from ${this.state}`);
    this.state = this.resumeState;
    this.resetAccumulator();
  }

  enterUpgrade() {
    if (this.state !== 'active') throw new Error(`Cannot enter upgrade from ${this.state}`);
    this.state = 'upgrade';
    this.resetAccumulator();
  }

  leaveUpgrade() {
    if (this.state !== 'upgrade') throw new Error(`Cannot leave upgrade from ${this.state}`);
    this.state = 'active';
    this.resetAccumulator();
  }

  gameOver() {
    if (this.state === 'exit') throw new Error('Cannot enter game-over after exit');
    this.state = 'game-over';
    this.resetAccumulator();
  }

  exit() {
    this.state = 'exit';
    this.resetAccumulator();
  }

  update(rawDeltaMs, inputSnapshot = null) {
    if (!Number.isFinite(rawDeltaMs) || rawDeltaMs < 0) throw new TypeError('frame delta must be a non-negative finite number');
    if (this.state !== 'active') {
      this.resetAccumulator();
      return Object.freeze({ steps: 0, alpha: 0, ...zeroLossMetrics() });
    }

    const input = freezeClone(inputSnapshot);
    const admittedDeltaMs = Math.min(rawDeltaMs, this.maxFrameDeltaMs);
    const rawWallClockLossMs = Math.max(0, rawDeltaMs - admittedDeltaMs);
    this.accumulatorMs += admittedDeltaMs;

    const accumulatorCeilingMs = this.maxCatchUpSteps * this.fixedStepMs;
    const accumulatorOverflowMs = Math.max(0, this.accumulatorMs - accumulatorCeilingMs);
    if (accumulatorOverflowMs > 0) this.accumulatorMs = accumulatorCeilingMs;

    let steps = 0;
    while (this.accumulatorMs + FLOAT_EPSILON >= this.fixedStepMs && steps < this.maxCatchUpSteps) {
      this.accumulatorMs -= this.fixedStepMs;
      if (Math.abs(this.accumulatorMs) < FLOAT_EPSILON) this.accumulatorMs = 0;
      this.tick += 1;
      steps += 1;

      const step = Object.freeze({
        tick: this.tick,
        dtMs: this.fixedStepMs,
        dtSeconds: this.fixedStepMs / 1000,
        input,
      });
      for (const callback of [...this.stepCallbacks]) callback(step);

      const replayEvent = Object.freeze({ type: 'tick', ...step });
      for (const callback of [...this.replayCallbacks]) callback(replayEvent);
    }

    this.interpolationAlpha = Math.max(0, Math.min(1 - Number.EPSILON, this.accumulatorMs / this.fixedStepMs));
    const totalDroppedMs = rawWallClockLossMs + accumulatorOverflowMs;
    this.lossMetrics.rawWallClockLossMs += rawWallClockLossMs;
    this.lossMetrics.accumulatorOverflowMs += accumulatorOverflowMs;
    this.lossMetrics.totalDroppedMs += totalDroppedMs;

    return Object.freeze({
      steps,
      alpha: this.interpolationAlpha,
      rawWallClockLossMs,
      accumulatorOverflowMs,
      totalDroppedMs,
    });
  }

  getInterpolationAlpha() {
    return this.interpolationAlpha;
  }

  getLossMetrics() {
    return Object.freeze({ ...this.lossMetrics });
  }

  takeLossMetrics() {
    const measured = this.getLossMetrics();
    this.lossMetrics = zeroLossMetrics();
    return measured;
  }

  onStep(callback) {
    if (typeof callback !== 'function') throw new TypeError('step callback must be a function');
    this.stepCallbacks.add(callback);
    return () => this.stepCallbacks.delete(callback);
  }

  onReplayEvent(callback) {
    if (typeof callback !== 'function') throw new TypeError('replay callback must be a function');
    this.replayCallbacks.add(callback);
    return () => this.replayCallbacks.delete(callback);
  }

  nextRandom(streamName) {
    if (!RANDOM_STREAMS.has(streamName)) throw new TypeError(`Unknown deterministic random stream: ${String(streamName)}`);
    const state = nextUint32(this.randomStates.get(streamName));
    this.randomStates.set(streamName, state);
    return state / 0x1_0000_0000;
  }

  getRandomState(streamName) {
    if (!RANDOM_STREAMS.has(streamName)) throw new TypeError(`Unknown deterministic random stream: ${String(streamName)}`);
    return this.randomStates.get(streamName);
  }
}

export const Simulation = DeterministicSimulation;

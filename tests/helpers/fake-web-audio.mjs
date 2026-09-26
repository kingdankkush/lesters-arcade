// A minimal Web Audio graph for Node tests of apps/hmh-reboot/src/combat-audio.mjs.
//
// It models only what the child's SFX engine touches: context state
// (suspended/running/interrupted/closed), gain and buffer-source nodes wired
// into a graph, decodeAudioData, and the `ended` event. Every source keeps the
// buffer it plays (the decoded buffer carries the sample path it was fetched
// from), so a test can prove which file a cue reached and at what gain, the
// way the older HTMLAudioElement probes read `src` and `volume`.
//
// Also imported by scripts/hmh-action-audio-audit.mjs, which renders the
// routed mix offline from the same graph.

class FakeParam {
  constructor(value) { this.value = value; }
}

class FakeNode {
  constructor(context, kind) {
    this.context = context;
    this.kind = kind;
    this.outputs = [];
    this.disconnected = false;
  }

  connect(node) {
    this.outputs.push(node);
    return node;
  }

  disconnect() {
    this.outputs = [];
    this.disconnected = true;
  }
}

export class FakeGainNode extends FakeNode {
  constructor(context) {
    super(context, 'gain');
    this.gain = new FakeParam(1);
  }
}

export class FakeBufferSourceNode extends FakeNode {
  constructor(context) {
    super(context, 'source');
    this.buffer = null;
    this.playbackRate = new FakeParam(1);
    this.onended = null;
    this.started = false;
    this.stopped = false;
    this.ended = false;
    this.startedAt = null;
    this.stoppedAt = null;
    this.stopCalls = 0;
  }

  start() {
    if (this.started) throw new Error('InvalidStateError: start() called twice');
    if (this.context.failStart) throw new Error('InvalidStateError: start() refused');
    this.started = true;
    this.startedAt = this.context.clock;
  }

  stop() {
    this.stopCalls += 1;
    if (!this.started) throw new Error('InvalidStateError: stop() before start()');
    if (this.stopped) return;
    this.stopped = true;
    this.stoppedAt = this.context.clock;
    // Browsers fire `ended` asynchronously after stop().
    queueMicrotask(() => this.finish());
  }

  // Test hook: the sample played to its end (or the stop() took effect).
  finish() {
    if (this.ended) return;
    this.ended = true;
    if (this.stoppedAt === null) this.stoppedAt = this.context.clock;
    this.onended?.({ target: this });
  }
}

export class FakeAudioContext {
  static instances = [];
  // New contexts start 'running' when true (Chrome with an autoplay grant or
  // sticky activation), 'suspended' otherwise (iOS Safari before a gesture).
  static autoplay = false;

  constructor() {
    this.state = FakeAudioContext.autoplay ? 'running' : 'suspended';
    this.destination = new FakeNode(this, 'destination');
    this.sources = [];
    this.gains = [];
    this.decoded = [];
    this.resumeCalls = 0;
    this.suspendCalls = 0;
    this.closeCalls = 0;
    this.primingBuffers = 0;
    this.clock = 0;
    this.failStart = false;
    this.statechanges = 0;
    this.onstatechange = null;
    FakeAudioContext.instances.push(this);
  }

  setState(state) {
    this.state = state;
    this.statechanges += 1;
    this.onstatechange?.();
  }

  resume() {
    this.resumeCalls += 1;
    if (this.state !== 'closed') this.setState('running');
    return Promise.resolve();
  }

  suspend() {
    this.suspendCalls += 1;
    if (this.state !== 'closed') this.setState('suspended');
    return Promise.resolve();
  }

  close() {
    this.closeCalls += 1;
    this.setState('closed');
    return Promise.resolve();
  }

  createGain() {
    const node = new FakeGainNode(this);
    this.gains.push(node);
    return node;
  }

  createBufferSource() {
    const node = new FakeBufferSourceNode(this);
    this.sources.push(node);
    return node;
  }

  createBuffer(channels, length, sampleRate) {
    this.primingBuffers += 1;
    return { channels, length, sampleRate, priming: true };
  }

  // The Promise form and the legacy callback form, as WebKit ships both.
  decodeAudioData(data, onSuccess, onError) {
    this.decoded.push(data?.src ?? null);
    if (data?.corrupt) {
      const error = new Error('EncodingError: unable to decode');
      onError?.(error);
      return Promise.reject(error);
    }
    const buffer = { src: data?.src ?? null, duration: data?.duration ?? 0.3 };
    onSuccess?.(buffer);
    return Promise.resolve(buffer);
  }
}

// Product of every gain between a source and the destination, i.e. what the
// listener hears relative to the sample at full scale.
export function effectiveGain(source) {
  let gain = 1;
  let node = source;
  const seen = new Set();
  while (node && node.kind !== 'destination') {
    if (seen.has(node)) throw new Error('cycle in fake audio graph');
    seen.add(node);
    if (node.kind === 'gain') gain *= node.gain.value;
    if (node.outputs.length !== 1) return node.outputs.length === 0 ? 0 : Number.NaN;
    node = node.outputs[0];
  }
  return node ? gain : 0;
}

export class FakeMusic {
  static instances = [];

  constructor(src) {
    this.src = src;
    this.loop = false;
    this.preload = '';
    this.volume = 1;
    this.currentTime = 0;
    this.paused = true;
    this.pauseCalls = 0;
    FakeMusic.instances.push(this);
  }

  play() {
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.pauseCalls += 1;
    this.paused = true;
  }
}

export class FakeEventTarget {
  constructor(props = {}) {
    Object.assign(this, props);
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type, event = { type }) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event);
  }

  listenerCount() {
    let total = 0;
    for (const set of this.listeners.values()) total += set.size;
    return total;
  }
}

export function fakeSampleFetch({ fail = new Set(), corrupt = new Set(), durations = {} } = {}) {
  const requests = [];
  const fetchSample = (path) => {
    requests.push(path);
    if (fail.has(path)) return Promise.reject(new Error(`404 ${path}`));
    return Promise.resolve({ src: path, corrupt: corrupt.has(path), duration: durations[path] ?? 0.3 });
  };
  return { fetchSample, requests };
}

export function resetFakeAudio({ autoplay = false } = {}) {
  FakeAudioContext.instances = [];
  FakeAudioContext.autoplay = autoplay;
  FakeMusic.instances = [];
}

// Every source the engine started, oldest first, across contexts.
export function startedSources() {
  return FakeAudioContext.instances.flatMap((context) => context.sources.filter((source) => source.started && !source.buffer?.priming));
}

// Headless stand-in for pixi.js. Rendering is projection-only in the
// HMH child (AGENTS.md runtime authority), so a no-op display tree cannot
// change a simulation tick. Every object is a permissive callable proxy.
const STUB_TAG = Symbol.for('hmh-headless-stub');

export function makeStub() {
  const store = new Map();
  const target = function stub() {};
  let proxy;
  proxy = new Proxy(target, {
    get(_t, prop) {
      if (store.has(prop)) return store.get(prop);
      if (prop === STUB_TAG) return true;
      if (prop === 'then') return undefined;
      if (prop === Symbol.iterator) return function* empty() {};
      if (prop === Symbol.toPrimitive) return (hint) => (hint === 'string' ? '' : 0);
      if (prop === 'toString') return () => '';
      if (prop === 'valueOf') return () => 0;
      if (prop === 'toJSON') return () => null;
      if (prop === 'length') return 0;
      if (typeof prop === 'symbol') return undefined;
      const child = makeStub();
      store.set(prop, child);
      return child;
    },
    set(_t, prop, value) { store.set(prop, value); return true; },
    apply() { return proxy; },
    construct() { return makeStub(); },
    has(_t, prop) { return store.has(prop); },
    deleteProperty(_t, prop) { store.delete(prop); return true; },
  });
  return proxy;
}

function stubClass() {
  return new Proxy(function StubClass() {}, {
    construct() { return makeStub(); },
    apply() { return makeStub(); },
    get(_t, prop) {
      if (prop === 'prototype') return Object.prototype;
      if (prop === 'then') return undefined;
      if (typeof prop === 'symbol') return undefined;
      return makeStub();
    },
  });
}

class Ticker {
  constructor() { this.callbacks = []; this.started = false; this.deltaMS = 1000 / 60; this.deltaTime = 1; }
  add(fn) { this.callbacks.push(fn); return this; }
  addOnce(fn) { return this.add(fn); }
  remove(fn) { this.callbacks = this.callbacks.filter((entry) => entry !== fn); return this; }
  start() { this.started = true; }
  stop() { this.started = false; }
  destroy() { this.callbacks = []; }
}

export class Application {
  constructor() {
    this.ticker = new Ticker();
    this.stage = makeStub();
    this.renderer = makeStub();
    this.renderer.resolution = 1;
    this.screen = { width: 1280, height: 720 };
    this.canvas = globalThis.__headless.createElement('canvas');
    globalThis.__headless.app = this;
  }
  async init() {}
  resize() {}
  render() {}
  destroy() {}
}

export const Assets = {
  async load() { return makeStub(); },
  async unload() {},
  get() { return makeStub(); },
  add() {},
  cache: makeStub(),
};

export const Container = stubClass();
export const Graphics = stubClass();
export const Rectangle = stubClass();
export const RenderLayer = stubClass();
export const Sprite = stubClass();
export const Text = stubClass();
export const TilingSprite = stubClass();
export const Texture = stubClass();
export const GraphicsContext = stubClass();
export const Matrix = stubClass();
export const Point = stubClass();
export const BlurFilter = stubClass();
export const ColorMatrixFilter = stubClass();
export const AnimatedSprite = stubClass();
export const ParticleContainer = stubClass();
export const Particle = stubClass();
export const MeshRope = stubClass();
export const NineSliceSprite = stubClass();
export const TextStyle = stubClass();
export const BitmapText = stubClass();
export const Ticker_ = Ticker;

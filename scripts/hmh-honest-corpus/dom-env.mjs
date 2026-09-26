// Headless browser globals for running the real HMH child
// (apps/hmh-reboot/src/main.mjs) in Node. DOM, audio and Pixi are projection
// only; the simulation, input sampling, bridge and run summary are the child's
// own code. Time is virtual: performance.now() advances one 60 Hz frame per
// driven frame.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { makeStub } from './pixi-stub.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const PORTAL_ROOT = path.join(REPO, 'apps', 'portal');
export const PAGE_URL = 'http://127.0.0.1:8791/hmh-reboot/index.html';
const ORIGIN = 'http://127.0.0.1:8791';

const clock = { nowMs: 1000 };
const realPerformance = globalThis.performance;

const listenersOf = new WeakMap();
function addListener(target, type, fn) {
  if (typeof fn !== 'function' && !(fn && typeof fn.handleEvent === 'function')) return;
  let map = listenersOf.get(target);
  if (!map) { map = new Map(); listenersOf.set(target, map); }
  if (!map.has(type)) map.set(type, []);
  map.get(type).push(fn);
}
function removeListener(target, type, fn) {
  const list = listenersOf.get(target)?.get(type);
  if (!list) return;
  const index = list.indexOf(fn);
  if (index >= 0) list.splice(index, 1);
}
function dispatch(target, event) {
  const list = [...(listenersOf.get(target)?.get(event.type) ?? [])];
  for (const fn of list) {
    try { typeof fn === 'function' ? fn.call(target, event) : fn.handleEvent(event); } catch (error) { globalThis.__headless.errors.push({ where: `listener:${event.type}`, message: error?.stack ?? String(error) }); }
  }
  return !event.defaultPrevented;
}
export function makeEvent(type, props = {}) {
  const event = { type, defaultPrevented: false, bubbles: false, target: null, currentTarget: null, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, stopImmediatePropagation() {}, ...props };
  return event;
}

const elementRegistry = new Map();
function createElement(tag = 'div', id = '') {
  const backing = {
    tagName: String(tag).toUpperCase(),
    nodeName: String(tag).toUpperCase(),
    id,
    dataset: {},
    style: { setProperty() {}, removeProperty() {} },
    hidden: false,
    disabled: tag === 'button' && id === 'hmhStartupEnter',
    checked: false,
    open: false,
    isConnected: true,
    textContent: '',
    innerHTML: '',
    value: '',
    className: '',
    tabIndex: 0,
    children: [],
    childNodes: [],
    attributes: {},
    classList: { add() {}, remove() {}, toggle() { return false; }, contains() { return false; }, replace() {} },
    addEventListener(type, fn) { addListener(proxy, type, fn); },
    removeEventListener(type, fn) { removeListener(proxy, type, fn); },
    dispatchEvent(event) { return dispatch(proxy, event); },
    setAttribute(name, value) { backing.attributes[name] = String(value); },
    getAttribute(name) { return Object.hasOwn(backing.attributes, name) ? backing.attributes[name] : null; },
    removeAttribute(name) { delete backing.attributes[name]; },
    hasAttribute(name) { return Object.hasOwn(backing.attributes, name); },
    toggleAttribute() { return false; },
    querySelector(selector) { return querySelector(selector); },
    querySelectorAll() { return []; },
    getElementsByTagName() { return []; },
    closest() { return null; },
    contains() { return false; },
    matches() { return false; },
    append() {}, appendChild(child) { return child; }, prepend() {}, replaceChildren() {}, remove() {}, removeChild(child) { return child; }, insertBefore(child) { return child; }, replaceWith() {}, before() {}, after() {},
    focus() {}, blur() {}, click() { dispatch(proxy, makeEvent('click')); },
    getBoundingClientRect() { return { x: 0, y: 0, left: 0, top: 0, right: 1280, bottom: 720, width: 1280, height: 720 }; },
    getContext() { return makeStub(); },
    animate() { return makeStub(); },
    setPointerCapture() {}, releasePointerCapture() {}, hasPointerCapture() { return false; },
    scrollIntoView() {},
    clientWidth: 1280, clientHeight: 720, offsetWidth: 1280, offsetHeight: 720, width: 1280, height: 720,
    ownerDocument: null,
  };
  backing.firstElementChild = null;
  let proxy;
  proxy = new Proxy(backing, {
    get(target, prop) {
      if (Object.hasOwn(target, prop)) return target[prop];
      if (prop === 'then') return undefined;
      if (typeof prop === 'symbol') return undefined;
      if (prop === 'firstElementChild' || prop === 'parentElement' || prop === 'parentNode' || prop === 'nextElementSibling') return null;
      const child = makeStub();
      target[prop] = child;
      return child;
    },
    set(target, prop, value) { target[prop] = value; return true; },
  });
  return proxy;
}

function querySelector(selector) {
  const key = String(selector);
  if (!elementRegistry.has(key)) {
    const idMatch = /^#([A-Za-z0-9_-]+)$/.exec(key);
    const tag = /Enter|Continue|Exit|Toggle|button/i.test(key) ? 'button' : 'div';
    elementRegistry.set(key, createElement(tag, idMatch ? idMatch[1] : ''));
  }
  return elementRegistry.get(key);
}

function fileForUrl(rawUrl) {
  let url;
  try { url = new URL(String(rawUrl), PAGE_URL); } catch { return null; }
  if (url.protocol === 'file:') return fileURLToPath(url);
  if (url.origin !== ORIGIN) return null;
  return path.join(PORTAL_ROOT, decodeURIComponent(url.pathname));
}

async function headlessFetch(input) {
  const file = fileForUrl(typeof input === 'string' ? input : input?.url);
  if (!file || !existsSync(file)) {
    return { ok: false, status: 404, statusText: 'Not Found', async json() { throw new Error('404'); }, async text() { return ''; }, async arrayBuffer() { return new ArrayBuffer(0); }, async blob() { return makeStub(); }, headers: { get() { return null; } } };
  }
  const bytes = readFileSync(file);
  return {
    ok: true, status: 200, statusText: 'OK', url: String(input),
    async json() { return JSON.parse(bytes.toString('utf8')); },
    async text() { return bytes.toString('utf8'); },
    async arrayBuffer() { return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); },
    async blob() { return makeStub(); },
    headers: { get() { return null; } },
  };
}

export function installHeadlessEnvironment({ gamepadRef }) {
  const headless = {
    errors: [],
    app: null,
    clock,
    createElement,
    querySelector,
    outbox: [],
    port: null,
    spies: {},
  };
  globalThis.__headless = headless;

  const documentElement = createElement('html');
  const body = createElement('body');
  const documentObj = {
    documentElement,
    body,
    head: createElement('head'),
    visibilityState: 'visible',
    hidden: false,
    readyState: 'complete',
    activeElement: null,
    fullscreenElement: null,
    querySelector,
    querySelectorAll() { return []; },
    getElementById(id) { return querySelector(`#${id}`); },
    getElementsByClassName() { return []; },
    createElement(tag) { return createElement(tag); },
    createElementNS(_ns, tag) { return createElement(tag); },
    createTextNode(text) { return { textContent: text }; },
    createDocumentFragment() { return createElement('fragment'); },
    addEventListener(type, fn) { addListener(documentObj, type, fn); },
    removeEventListener(type, fn) { removeListener(documentObj, type, fn); },
    dispatchEvent(event) { return dispatch(documentObj, event); },
    hasFocus() { return true; },
  };

  const parentWindow = { postMessage() {} };
  const windowObj = {
    location: { href: PAGE_URL, origin: ORIGIN, protocol: 'http:', host: '127.0.0.1:8791', hostname: '127.0.0.1', port: '8791', pathname: '/hmh-reboot/index.html', search: '', hash: '', assign() {}, reload() {}, replace() {} },
    parent: parentWindow,
    top: parentWindow,
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 1,
    matchMedia: () => ({ matches: false, media: '', addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
    addEventListener(type, fn) { addListener(windowObj, type, fn); },
    removeEventListener(type, fn) { removeListener(windowObj, type, fn); },
    dispatchEvent(event) { return dispatch(windowObj, event); },
    focus() {},
    getComputedStyle() { return { getPropertyValue() { return ''; } }; },
    requestAnimationFrame: (cb) => setTimeout(() => cb(clock.nowMs), 0),
    cancelAnimationFrame: (id) => clearTimeout(id),
    navigator: null,
  };
  const navigatorObj = {
    userAgent: 'hmh-headless-realruns',
    language: 'en-US',
    languages: ['en-US'],
    maxTouchPoints: 0,
    hardwareConcurrency: 8,
    getGamepads: () => [gamepadRef.current],
    vibrate() { return false; },
  };
  windowObj.navigator = navigatorObj;
  windowObj.document = documentObj;

  const storage = new Map();
  const localStorageObj = {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => { storage.set(key, String(value)); },
    removeItem: (key) => { storage.delete(key); },
    clear: () => storage.clear(),
    key: (index) => [...storage.keys()][index] ?? null,
    get length() { return storage.size; },
  };
  windowObj.localStorage = localStorageObj;

  const define = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true, enumerable: false });
  define('window', windowObj);
  define('self', windowObj);
  define('document', documentObj);
  define('navigator', navigatorObj);
  define('localStorage', localStorageObj);
  define('sessionStorage', localStorageObj);
  define('matchMedia', windowObj.matchMedia);
  define('requestAnimationFrame', windowObj.requestAnimationFrame);
  define('cancelAnimationFrame', windowObj.cancelAnimationFrame);
  define('requestIdleCallback', (cb) => setImmediate(() => cb({ didTimeout: false, timeRemaining: () => 50 })));
  define('cancelIdleCallback', () => {});
  define('fetch', headlessFetch);
  define('performance', {
    now: () => clock.nowMs,
    timeOrigin: realPerformance.timeOrigin,
    mark() {}, measure() {}, getEntriesByName() { return []; }, getEntriesByType() { return []; }, clearMarks() {}, clearMeasures() {},
    memory: undefined,
  });
  define('Image', class { constructor() { this.onload = null; this.onerror = null; } set src(_v) { setTimeout(() => this.onload?.(), 0); } decode() { return Promise.resolve(); } });
  define('Audio', class { constructor(src) { this.src = src; this.volume = 1; this.loop = false; this.paused = true; this.currentTime = 0; this.playbackRate = 1; this.preload = ''; } play() { this.paused = false; return Promise.resolve(); } pause() { this.paused = true; } load() {} addEventListener() {} removeEventListener() {} cloneNode() { return new globalThis.Audio(this.src); } });
  define('AudioContext', undefined);
  define('webkitAudioContext', undefined);
  define('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  define('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} });
  define('MutationObserver', class { observe() {} disconnect() {} takeRecords() { return []; } });
  define('HTMLElement', class {});
  define('HTMLCanvasElement', class {});
  define('CustomEvent', class { constructor(type, init = {}) { Object.assign(this, makeEvent(type, init)); this.detail = init.detail; } });
  define('getComputedStyle', windowObj.getComputedStyle);

  headless.window = windowObj;
  headless.document = documentObj;
  headless.parentWindow = parentWindow;
  headless.dispatchWindowEvent = (event) => dispatch(windowObj, event);
  headless.click = (selector) => dispatch(querySelector(selector), makeEvent('click'));
  headless.fileForUrl = fileForUrl;
  return headless;
}

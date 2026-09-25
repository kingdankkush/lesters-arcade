// A small fake DOM for the jackpot-ui tests (tests/jackpot-ui-*.test.mjs, tests/owner-jackpot-page.test.mjs):
// createElement / createElementNS, tree operations, attributes, dataset, hidden, click listeners and the
// simple selectors the jackpot modules use (#id, .class, tag, tag.class, [attr], tag[attr], [attr="v"]).

class FakeClassList {
  constructor(node) { this.node = node; }
  get values() { return String(this.node.className ?? '').split(/\s+/).filter(Boolean); }
  contains(name) { return this.values.includes(name); }
  add(...names) { this.node.className = [...new Set([...this.values, ...names])].join(' '); }
  remove(...names) { this.node.className = this.values.filter((value) => !names.includes(value)).join(' '); }
  toggle(name, force) {
    const on = force ?? !this.contains(name);
    if (on) this.add(name); else this.remove(name);
    return on;
  }
}

export class FakeNode {
  constructor(documentRef, tagName, namespace = null) {
    this.ownerDocument = documentRef;
    this.tagName = String(tagName).toUpperCase();
    this.namespaceURI = namespace;
    this.children = [];
    this.parentNode = null;
    this.attributes = {};
    this.dataset = {};
    this.style = {};
    this.listeners = new Map();
    this.hidden = false;
    this.disabled = false;
    this.className = '';
    this.id = '';
    this.value = '';
    this.classList = new FakeClassList(this);
  }
  // Like the DOM, setting textContent replaces the children with one text node.
  get textContent() { return this.children.map((child) => child.textContent).join(''); }
  set textContent(value) {
    for (const child of this.children) child.parentNode = null;
    this.children = [];
    const text = String(value ?? '');
    if (text) this.appendChild(this.ownerDocument.createTextNode(text));
  }
  get isConnected() {
    let node = this;
    while (node.parentNode) node = node.parentNode;
    return node === this.ownerDocument.root;
  }
  get firstChild() { return this.children[0] ?? null; }
  get nextSibling() {
    if (!this.parentNode) return null;
    const siblings = this.parentNode.children;
    return siblings[siblings.indexOf(this) + 1] ?? null;
  }
  appendChild(child) {
    if (typeof child === 'string') child = this.ownerDocument.createTextNode(child);
    child.remove?.();
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  append(...nodes) { for (const node of nodes) this.appendChild(node); }
  prepend(...nodes) { for (const node of nodes.reverse()) this.insertBefore(typeof node === 'string' ? this.ownerDocument.createTextNode(node) : node, this.children[0] ?? null); }
  insertBefore(child, reference) {
    child.remove?.();
    const index = reference ? this.children.indexOf(reference) : -1;
    child.parentNode = this;
    this.children.splice(index < 0 ? this.children.length : index, 0, child);
    return child;
  }
  after(...nodes) {
    const parent = this.parentNode;
    const reference = this.nextSibling;
    for (const node of nodes) parent.insertBefore(node, reference);
  }
  replaceChildren(...nodes) {
    for (const child of this.children) child.parentNode = null;
    this.children = [];
    this.append(...nodes);
  }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((node) => node !== this);
    this.parentNode = null;
  }
  contains(node) { for (let current = node; current; current = current.parentNode) if (current === this) return true; return false; }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === 'id') this.id = String(value);
    if (name === 'class') this.className = String(value);
    if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = String(value);
  }
  getAttribute(name) {
    if (name === 'id') return this.id || null;
    if (name === 'class') return this.className || null;
    if (name === 'href' && this.href !== undefined) return this.href;
    return this.attributes[name] ?? null;
  }
  hasAttribute(name) { return this.getAttribute(name) !== null; }
  removeAttribute(name) { delete this.attributes[name]; if (name === 'href') this.href = undefined; }
  addEventListener(type, fn) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]); }
  removeEventListener(type, fn) { this.listeners.set(type, (this.listeners.get(type) ?? []).filter((item) => item !== fn)); }
  focus() { this.ownerDocument.activeElement = this; }
  getClientRects() { return this.hidden ? [] : [{}]; }
  all() { return this.children.flatMap((child) => (child instanceof FakeNode ? [child, ...child.all()] : [])); }
  matches(selector) { return selector.split(',').some((part) => matchesOne(this, part.trim())); }
  querySelector(selector) { return this.all().find((node) => node.matches(selector)) ?? null; }
  querySelectorAll(selector) { return this.all().filter((node) => node.matches(selector)); }
  closest(selector) { for (let node = this; node instanceof FakeNode; node = node.parentNode) if (node.matches(selector)) return node; return null; }
  // Bubbling dispatch, like the real DOM.
  async dispatch(type, init = {}) {
    const event = { type, target: this, currentTarget: null, defaultPrevented: false, stopped: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; }, ...init };
    for (let node = this; node && !event.stopped; node = node.parentNode) {
      event.currentTarget = node;
      for (const fn of node.listeners.get(type) ?? []) await fn(event);
    }
    return event;
  }
  click() { return this.disabled ? Promise.resolve(null) : this.dispatch('click'); }
}

class FakeText {
  constructor(text) { this.text = String(text); this.parentNode = null; }
  get textContent() { return this.text; }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((node) => node !== this);
    this.parentNode = null;
  }
}

function matchesOne(node, selector) {
  const match = /^([a-zA-Z][\w-]*)?((?:[#.][\w-]+)*)((?:\[[\w-]+(?:="[^"]*")?\])*)$/.exec(selector);
  if (!match) throw new Error(`fake DOM does not support the selector ${selector}`);
  const [, tag, simple, attrs] = match;
  if (tag && node.tagName !== tag.toUpperCase()) return false;
  for (const [, kind, name] of simple.matchAll(/([#.])([\w-]+)/g)) {
    if (kind === '#' && node.id !== name) return false;
    if (kind === '.' && !node.classList.contains(name)) return false;
  }
  for (const [, name, value] of attrs.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)) {
    const actual = name.startsWith('data-') ? node.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] ?? node.attributes[name] ?? null : node.getAttribute(name);
    if (actual === null || actual === undefined) return false;
    if (value !== undefined && String(actual) !== value) return false;
  }
  return true;
}

export function fakeDocument() {
  const documentRef = {
    activeElement: null,
    listeners: new Map(),
    createElement: (tag) => new FakeNode(documentRef, tag),
    createElementNS: (namespace, tag) => new FakeNode(documentRef, tag, namespace),
    createTextNode: (text) => new FakeText(text),
    getElementById: (id) => documentRef.root.querySelector(`#${id}`),
    querySelector: (selector) => documentRef.root.querySelector(selector),
    querySelectorAll: (selector) => documentRef.root.querySelectorAll(selector),
    addEventListener(type, fn) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]); },
    removeEventListener(type, fn) { this.listeners.set(type, (this.listeners.get(type) ?? []).filter((item) => item !== fn)); },
  };
  documentRef.root = new FakeNode(documentRef, 'html');
  documentRef.head = documentRef.root.appendChild(new FakeNode(documentRef, 'head'));
  documentRef.body = documentRef.root.appendChild(new FakeNode(documentRef, 'body'));
  documentRef.documentElement = documentRef.root;
  return documentRef;
}

// A detached element with an id, appended to <body> (the page's own containers).
export function mountById(documentRef, tag, id, { hidden = false, className = '' } = {}) {
  const node = documentRef.createElement(tag);
  node.id = id;
  node.hidden = hidden;
  node.className = className;
  documentRef.body.appendChild(node);
  return node;
}

// All visible text of a subtree (hidden elements excluded).
export function visibleText(node) {
  if (!node || node.hidden) return '';
  if (!(node instanceof FakeNode)) return node.textContent ?? '';
  return node.children.map((child) => visibleText(child)).join('');
}

export const settle = () => new Promise((resolve) => setImmediate(resolve));
export async function flush(times = 5) { for (let index = 0; index < times; index += 1) await settle(); }

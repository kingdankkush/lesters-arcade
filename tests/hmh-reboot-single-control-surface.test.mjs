import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createHmhRebootHost } from '../apps/portal/src/hmh-reboot-host.mjs';

/**
 * Device playtest, 2026-07-27: "There are two sets of controls on mobile."
 *
 * The reboot runs in a sandboxed iframe hosted by the portal. The portal builds
 * its own floating joystick and action buttons for the legacy cabinet on any
 * touch device, and that layer covers the whole page — including the iframe. A
 * phone player therefore saw the portal's controls stacked on top of the
 * reboot's own MOVE/AIM/POWER set, with the portal's set driving nothing.
 *
 * The embedded runtime owns input while it is mounted.
 */

class FakeElement {
  constructor() {
    this.children = [];
    this.dataset = {};
    this.style = { setProperty() {} };
    this.listeners = new Map();
    this.className = '';
  }
  replaceChildren(...nodes) { this.children = nodes; }
  appendChild(node) { this.children.push(node); return node; }
  setAttribute(name, value) { this[name] = value; }
  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
  }
  removeEventListener(type, handler) { this.listeners.get(type)?.delete(handler); }
  emit(type, event = {}) { for (const handler of this.listeners.get(type) ?? []) handler(event); }
}

function harness() {
  const documentElement = new FakeElement();
  const documentRef = {
    documentElement,
    createElement: () => new FakeElement(),
    addEventListener() {}, removeEventListener() {},
  };
  const mount = new FakeElement();
  const host = createHmhRebootHost({
    mount,
    documentRef,
    expectedOrigin: 'https://example.test',
    bridgeFactory: () => ({ send() {}, destroy() {} }),
    setTimeoutRef: () => 1,
    clearTimeoutRef: () => {},
  });
  return { host, mount, documentElement };
}

test('mounting the cabinet claims input ownership, and destroying it releases', () => {
  const { host, documentElement } = harness();
  assert.equal(documentElement.dataset.embeddedCabinet, undefined, 'nothing owns input before mount');

  host.mountSession({ sessionId: 'session-1', heroId: 'lit-commando' });
  assert.equal(
    documentElement.dataset.embeddedCabinet,
    'hmh-reboot',
    'the mounted cabinet must claim input ownership',
  );

  host.destroy();
  assert.equal(
    documentElement.dataset.embeddedCabinet,
    undefined,
    'leaving the cabinet must hand input back to the portal',
  );
});

test('the portal suppresses its own touch layer while a cabinet owns input', async () => {
  const source = await readFile(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  assert.match(source, /function embeddedCabinetOwnsInput\(\)/, 'the portal needs an ownership predicate');
  // Both the builder and the body class must respect it, or the layer is either
  // constructed anyway or left visible by the class alone.
  assert.match(
    source,
    /if \(!profile\.showTouchControls \|\| embeddedCabinetOwnsInput\(\)\)/,
    'ensureTouchControls must bail out when a cabinet owns input',
  );
  assert.match(
    source,
    /'show-touch-controls', profile\.showTouchControls && !embeddedCabinetOwnsInput\(\)/,
    'the body class must respect ownership too',
  );
});

test('a CSS backstop hides the portal layer even before the profile is recomputed', async () => {
  const css = await readFile(new URL('../apps/portal/styles.css', import.meta.url), 'utf8');
  // applyDeviceProfile runs on resize and orientation change, not on mount, so
  // without this the duplicate set survives until the next resize.
  assert.match(css, /html\[data-embedded-cabinet\][\s\S]{0,120}display:\s*none/, 'CSS must hide the portal touch layer');
});

test('the reboot child still renders exactly one control surface', async () => {
  const source = await readFile(new URL('../apps/hmh-reboot/src/touch-controls.mjs', import.meta.url), 'utf8');
  // The child overlay is created once per adapter; guard against a second
  // overlay being appended beside it.
  const overlayCreations = source.match(/className = 'hmh-touch-controls'/g) ?? [];
  assert.equal(overlayCreations.length, 1, 'the child must build exactly one overlay');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorldDesignLife } from '../apps/hmh-reboot/src/world-design-life.mjs';

class Container {
  constructor() { this.children = []; }
  addChild(...children) { this.children.push(...children); }
}
class Graphics extends Container {}
class Text extends Container {
  constructor({ text, style }) {
    super(); this.text = text; this.style = style; this.visible = false; this.unloads = 0;
    this.anchor = { set() {} }; this.position = { set() {} };
  }
  unload() { this.unloads++; }
}
class Canvas extends EventTarget {
  constructor() { super(); this.restorationListeners = 0; }
  addEventListener(type, listener, options) { super.addEventListener(type, listener, options); if (type === 'webglcontextrestored') this.restorationListeners++; }
  removeEventListener(type, listener, options) { super.removeEventListener(type, listener, options); if (type === 'webglcontextrestored') this.restorationListeners--; }
}
const setup = canvas => createWorldDesignLife({ ContainerClass: Container, GraphicsClass: Graphics, TextClass: Text, canvas });

test('world text recovery reclaims each local text resource while preserving semantic content and layout', () => {
  const canvas = new Canvas(), life = setup(canvas), texts = life.overlay.children.filter(child => child instanceof Text);
  assert.equal(texts.length, 4);
  texts.forEach((text, i) => { text.text = ['Press the generator switch · 36 m ↓', 'Needs handle', 'Secret found', 'BOSS READY'][i]; text.visible = Boolean(i % 2); });
  const semantic = texts.map(text => ({ text: text.text, style: structuredClone(text.style), visible: text.visible }));
  const layout = texts.map(text => ({ anchor: text.anchor, position: text.position }));
  canvas.dispatchEvent(new Event('webglcontextrestored'));
  assert.deepEqual(texts.map(text => text.unloads), [1, 1, 1, 1], 'GPU-only invalidation covers tracker, prompt, needs and boss note');
  assert.deepEqual(texts.map(text => ({ text: text.text, style: structuredClone(text.style), visible: text.visible })), semantic);
  texts.forEach((text, i) => { assert.equal(text.anchor, layout[i].anchor); assert.equal(text.position, layout[i].position); });
});

test('restoration ownership is bounded and disposal removes the canvas listener exactly once', () => {
  const canvas = new Canvas(), life = setup(canvas), texts = life.overlay.children.filter(child => child instanceof Text);
  assert.equal(canvas.restorationListeners, 1);
  for (let i = 0; i < 3; i++) canvas.dispatchEvent(new Event('webglcontextrestored'));
  assert.deepEqual(texts.map(text => text.unloads), [3, 3, 3, 3]);
  life.dispose(); life.dispose(); assert.equal(canvas.restorationListeners, 0);
  canvas.dispatchEvent(new Event('webglcontextrestored')); assert.deepEqual(texts.map(text => text.unloads), [3, 3, 3, 3]);
});

test('a headless presentation fixture needs no canvas or renderer and retains its existing render API', () => {
  const life = setup(); assert.equal(typeof life.render, 'function'); assert.equal(typeof life.dispose, 'function'); assert.doesNotThrow(() => life.dispose());
});

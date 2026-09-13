import { createStackedAutoShift } from '../../portal/src/stacked-autoshift.mjs';
import { STACKED_ACTIONS } from '../../portal/src/stacked-contracts.mjs';
import { cellsFor, collides } from '../../portal/src/stacked-sim.mjs';

export function createStackedInput({ target, controls, settings, onPause, onUndo }) {
  const held = new Map(), queued = new Set(), listeners = [];
  const shift = createStackedAutoShift();
  let sequence = 0, previousPiece = null, previousRotation = null, device = 'keyboard';
  const listen = (node, type, fn, options) => { node.addEventListener(type, fn, options); listeners.push(() => node.removeEventListener(type, fn, options)); };
  const press = (action, id) => { if (!held.has(id)) { held.set(id, { action, sequence: ++sequence }); queued.add(action); } };
  const release = id => held.delete(id);
  const clear = () => { held.clear(); queued.clear(); shift.reset(); };
  const actionFor = code => STACKED_ACTIONS.find(key => Object.values(settings.controls.keyboardBindings[key]).includes(code));
  listen(target, 'keydown', event => {
    if (/INPUT|SELECT|TEXTAREA/.test(event.target?.tagName)) return;
    if (event.code === 'Escape' || event.code === 'KeyP') { event.preventDefault(); if (!event.repeat) onPause(); return; }
    if (event.code === 'KeyU') { event.preventDefault(); if (!event.repeat) onUndo(); return; }
    const action = actionFor(event.code); if (!action) return;
    event.preventDefault(); device = 'keyboard'; if (!event.repeat) press(action, event.code);
  });
  listen(target, 'keyup', event => { if (actionFor(event.code)) event.preventDefault(); release(event.code); });
  for (const button of controls.querySelectorAll('[data-action]')) {
    listen(button, 'pointerdown', event => { event.preventDefault(); button.setPointerCapture(event.pointerId); device = 'touch'; press(button.dataset.action, 'pointer-' + event.pointerId); });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(button, type, event => release('pointer-' + event.pointerId));
  }
  listen(target, 'blur', clear);
  let padHeld = new Set();
  const samplePad = () => {
    const pad = globalThis.navigator?.getGamepads?.()?.find?.(Boolean);
    const now = new Set();
    if (pad) {
      const mapping = { 0: 'rotateCW', 1: 'rotateCCW', 2: 'hold', 3: 'rotate180', 12: 'hardDrop', 13: 'softDrop', 14: 'moveLeft', 15: 'moveRight' };
      for (const [key, action] of Object.entries(mapping)) if (pad.buttons[Number(key)]?.pressed) now.add(action);
      if (pad.axes[0] < -0.5) now.add('moveLeft'); if (pad.axes[0] > 0.5) now.add('moveRight');
      if (pad.axes[1] > 0.5) now.add('softDrop');
      for (const action of now) { if (!padHeld.has(action)) { device = 'gamepad'; press(action, 'pad-' + action); } }
    }
    for (const action of padHeld) if (!now.has(action)) release('pad-' + action);
    padHeld = now;
  };
  return {
    clear,
    sample(snapshot) {
      samplePad();
      const active = new Set([...held.values()].map(value => value.action));
      const direction = [...held.values()].filter(value => ['moveLeft', 'moveRight'].includes(value.action)).sort((a, b) => b.sequence - a.sequence)[0]?.action;
      const dir = direction === 'moveLeft' ? -1 : direction === 'moveRight' ? 1 : queued.has('moveLeft') ? -1 : queued.has('moveRight') ? 1 : 0;
      const piece = snapshot.active;
      const canMove = !!piece && !collides(snapshot.board, cellsFor(piece.kind, piece.rotation, piece.x + dir, piece.y));
      let mask = shift.sample(dir, { canMove, spawned: previousPiece !== snapshot.piecesSpawned, rotated: previousRotation !== piece?.rotation });
      for (let i = 2; i < STACKED_ACTIONS.length; i++) if (active.has(STACKED_ACTIONS[i]) || queued.has(STACKED_ACTIONS[i])) mask |= 1 << i;
      previousPiece = snapshot.piecesSpawned; previousRotation = piece?.rotation; queued.clear();
      return mask;
    },
    get device() { return device; },
    destroy() { clear(); for (const off of listeners) off(); },
  };
}

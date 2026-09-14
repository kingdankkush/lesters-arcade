import { createStackedAutoShift } from '../../portal/src/stacked-autoshift.mjs';
import { STACKED_ACTIONS } from '../../portal/src/stacked-contracts.mjs';
import { cellsFor, collides } from '../../portal/src/stacked-sim.mjs';

export function createStackedInput({ target, controls, settings, onPause, onUndo, isMenuOpen = () => false, onMenuAction = () => {}, getGamepads = () => globalThis.navigator?.getGamepads?.() ?? [] }) {
  const held = new Map(), queued = new Map(), listeners = [];
  const shift = createStackedAutoShift();
  let sequence = 0, previousPiece = null, previousRotation = null, device = 'keyboard';
  const usedDevices = new Set();
  let padHeld = new Set(), menuHeld = new Set(), padBlocked = false;
  const listen = (node, type, fn, options) => { node.addEventListener(type, fn, options); listeners.push(() => node.removeEventListener(type, fn, options)); };
  const press = (action, id) => { if (!held.has(id)) { usedDevices.add(device); held.set(id, { action, sequence: ++sequence }); queued.set(id,action); } };
  const release = id => held.delete(id);
  const cancel = id => { held.delete(id); queued.delete(id); };
  const clear = () => { held.clear(); queued.clear(); shift.reset(); padHeld.clear(); padBlocked = true; };
  const actionFor = code => STACKED_ACTIONS.find(key => Object.values(settings.controls.keyboardBindings[key]).includes(code));
  listen(target, 'keydown', event => {
    if (/INPUT|SELECT|TEXTAREA|BUTTON|SUMMARY/.test(event.target?.tagName) || event.target?.isContentEditable) return;
    if (event.code === 'Escape' || event.code === 'KeyP') { event.preventDefault(); if (!event.repeat) onPause(); return; }
    if (isMenuOpen()) return;
    if (event.code === 'KeyU') { event.preventDefault(); if (!event.repeat) onUndo(); return; }
    const action = actionFor(event.code); if (!action) return;
    event.preventDefault(); device = 'keyboard'; if (!event.repeat) press(action, event.code);
  });
  listen(target, 'keyup', event => { if (actionFor(event.code) && !/INPUT|SELECT|TEXTAREA|BUTTON|SUMMARY/.test(event.target?.tagName) && !event.target?.isContentEditable) event.preventDefault(); release(event.code); });
  for (const button of controls.querySelectorAll('[data-action]')) {
    listen(button, 'pointerdown', event => { event.preventDefault(); if(isMenuOpen())return; try{button.setPointerCapture(event.pointerId);}catch{} device = 'touch'; press(button.dataset.action, 'pointer-' + event.pointerId); });
    listen(button,'pointerup',event=>release('pointer-'+event.pointerId));
    listen(button,'pointercancel',event=>cancel('pointer-'+event.pointerId));
    listen(button,'lostpointercapture',event=>{ const id='pointer-'+event.pointerId; if(held.has(id))cancel(id); });
  }
  listen(target, 'blur', clear);
  const connectedPad = () => { try { return getGamepads()?.find?.(Boolean); } catch { return null; } };
  const poll = () => {
    const pad = connectedPad(), current = new Set();
    if (pad) {
      for (const [key, action] of [[0,'activate'],[9,'pause'],[12,'previous'],[13,'next'],[14,'decrease'],[15,'increase']]) if (pad.buttons[key]?.pressed) current.add(action);
      if (pad.axes[1] < -.6) current.add('previous'); if (pad.axes[1] > .6) current.add('next');
      if (pad.axes[0] < -.6) current.add('decrease'); if (pad.axes[0] > .6) current.add('increase');
    }
    const edges = [...current].filter(action => !menuHeld.has(action)); menuHeld = current;
    if (edges.includes('pause')) { device='gamepad'; onPause(); return; }
    if (isMenuOpen()) for (const action of edges) { device='gamepad'; onMenuAction(action); }
  };
  const samplePad = () => {
    const pad = connectedPad();
    if (padBlocked) {
      if (pad && (pad.buttons.some(button=>button.pressed) || pad.axes.some(axis=>Math.abs(axis)>.5))) return;
      padBlocked = false;
    }
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
    clear, poll,
    sample(snapshot) {
      if(isMenuOpen()) { clear(); return 0; }
      samplePad();
      const taps=new Set(queued.values());
      const active = new Set([...held.values()].map(value => value.action));
      const direction = [...held.values()].filter(value => ['moveLeft', 'moveRight'].includes(value.action)).sort((a, b) => b.sequence - a.sequence)[0]?.action;
      const dir = direction === 'moveLeft' ? -1 : direction === 'moveRight' ? 1 : taps.has('moveLeft') ? -1 : taps.has('moveRight') ? 1 : 0;
      const piece = snapshot.active;
      const canMove = !!piece && !collides(snapshot.board, cellsFor(piece.kind, piece.rotation, piece.x + dir, piece.y));
      let mask = shift.sample(dir, { canMove, spawned: previousPiece !== snapshot.piecesSpawned, rotated: previousRotation !== piece?.rotation });
      for (let i = 2; i < STACKED_ACTIONS.length; i++) if (active.has(STACKED_ACTIONS[i]) || taps.has(STACKED_ACTIONS[i])) mask |= 1 << i;
      previousPiece = snapshot.piecesSpawned; previousRotation = piece?.rotation; queued.clear();
      return mask;
    },
    get device() { return usedDevices.size>1?'mixed':usedDevices.values().next().value??device; },
    destroy() { clear(); for (const off of listeners) off(); },
  };
}

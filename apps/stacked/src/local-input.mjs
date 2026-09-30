import { createStackedInput } from './input.mjs';
import { STACKED_ACTIONS } from '../../portal/src/stacked-contracts.mjs';
import { STACKED_DEFAULT_BINDINGS } from '../../portal/src/stacked-player-settings.mjs';

const SPLIT_CODES = Object.freeze({
  'keyboard-left': ['KeyA','KeyD','KeyS','KeyW','KeyG','KeyF','KeyH','KeyT'],
  'keyboard-right': ['ArrowLeft','ArrowRight','ArrowDown','ArrowUp','Numpad3','Numpad1','Numpad2','Numpad0'],
});
const editable = node => /^(INPUT|SELECT|TEXTAREA|BUTTON|SUMMARY)$/.test(node?.tagName) || node?.isContentEditable;
const emptyControls = Object.freeze({ querySelectorAll: () => [] });
const validPad = (pad, index, id) => pad?.index === index && pad.id === id && pad.connected === true
  && pad.mapping === 'standard' && pad.buttons?.length >= 16 && pad.axes?.length >= 2
  && Array.from(pad.axes).every(Number.isFinite);

// This adapter is for a local Free match only. It owns no session, recorder,
// persistence, clock or simulation. The existing input adapter still expands
// held directions into deterministic per-tick pulses separately for each board.
export function createStackedLocalInput({ target, devices, getGamepads = () => globalThis.navigator?.getGamepads?.() ?? [], onPause = () => {}, onDeviceLost = () => {} } = {}) {
  if (!target?.addEventListener || !target?.removeEventListener || !Array.isArray(devices) || devices.length !== 2) throw new TypeError('two local input slots required');
  const readPads = () => { try { return getGamepads() ?? []; } catch { return []; } };
  let pads = readPads();
  const claims = devices.map(device => {
    if (device?.kind === 'gamepad') {
      const index = device.index, pad = pads[index];
      if (!Number.isSafeInteger(index) || index < 0 || typeof pad?.id !== 'string' || !pad.id || !validPad(pad,index,pad.id)) throw new TypeError('connected standard controller required');
      return Object.freeze({kind:'gamepad',index,id:pad.id});
    }
    if (!['keyboard','keyboard-left','keyboard-right'].includes(device?.kind)) throw new TypeError('unknown local device');
    return Object.freeze({kind:device.kind});
  });
  const [a,b] = claims;
  if ((a.kind === 'gamepad' && b.kind === 'gamepad' && a.index === b.index)
    || (a.kind !== 'gamepad' && b.kind !== 'gamepad' && (a.kind === b.kind || a.kind === 'keyboard' || b.kind === 'keyboard'))) throw new TypeError('a device cannot drive both boards');

  let active = false, destroyed = false;
  const lost = new Set(), inputs = [], removers = [];
  const clear = () => { for (const input of inputs) input.clear(); };
  const deactivate = () => { active = false; clear(); };
  const pause = () => { if (!active || destroyed) return; deactivate(); onPause(); };
  const lose = slots => {
    const fresh = slots.filter(slot => !lost.has(slot));
    if (!fresh.length || destroyed) return;
    for (const slot of fresh) lost.add(slot);
    deactivate(); onDeviceLost(Object.freeze([...lost].sort()));
  };
  const listen = (name, fn) => { target.addEventListener(name,fn);removers.push(() => target.removeEventListener(name,fn)); };
  const projectedPad = claim => {
    const pad = pads[claim.index];
    if (lost.size || !validPad(pad,claim.index,claim.id)) return [];
    // Map the documented couch layout into the unchanged solo adapter's actions:
    // A drop, B clockwise, X counterclockwise, Y 180, LB hold, Menu pause.
    const sourceIndices = [1,2,4,3,-1,-1,-1,-1,-1,9,-1,-1,0,13,14,15];
    return [{ buttons:sourceIndices.map(i => ({pressed:i >= 0 && pad.buttons[i]?.pressed === true})), axes:Array.from(pad.axes) }];
  };
  for (const claim of claims) {
    const keyboardBindings = Object.fromEntries(STACKED_ACTIONS.map((action,index) => [action, {
      primary:claim.kind === 'keyboard' ? STACKED_DEFAULT_BINDINGS[action][0] : SPLIT_CODES[claim.kind]?.[index] ?? null,
      secondary:claim.kind === 'keyboard' ? STACKED_DEFAULT_BINDINGS[action][1] : null,
    }]));
    const codes = new Set(Object.values(keyboardBindings).flatMap(binding => Object.values(binding)).filter(Boolean));
    const wrappers = [];
    const proxy = {
      addEventListener(type,fn,options) {
        const wrapped = event => {
          if ((type === 'keydown' || type === 'keyup') && (!codes.has(event.code) || (type === 'keydown' && !active))) return;
          fn(event);
        };
        wrappers.push({type,fn,wrapped,options});target.addEventListener(type,wrapped,options);
      },
      removeEventListener(type,fn) {
        const at = wrappers.findIndex(row => row.type === type && row.fn === fn);
        if (at >= 0) { const row=wrappers.splice(at,1)[0];target.removeEventListener(type,row.wrapped,row.options); }
      },
    };
    inputs.push(createStackedInput({target:proxy,controls:emptyControls,settings:{controls:{keyboardBindings}},onPause:pause,onUndo(){},isMenuOpen:()=>!active,onMenuAction(){},getGamepads:()=>claim.kind === 'gamepad' ? projectedPad(claim) : []}));
  }
  listen('keydown',event => { if(event.code === 'Escape' && !editable(event.target) && !event.repeat && active) {event.preventDefault();pause();} });
  listen('blur',pause);
  listen('focusin',event => { if(editable(event.target)) pause(); });
  listen('gamepaddisconnected',event => lose(claims.flatMap((claim,slot) => claim.kind === 'gamepad' && claim.index === event.gamepad?.index && claim.id === event.gamepad?.id ? [slot] : [])));
  clear();
  return Object.freeze({
    activate() { if(destroyed || lost.size) return false;clear();active=true;return true; },
    deactivate, clear,
    pollTick(snapshots) {
      if (destroyed) return Uint8Array.of(0,0);
      pads=readPads();
      lose(claims.flatMap((claim,slot) => claim.kind === 'gamepad' && !validPad(pads[claim.index],claim.index,claim.id) ? [slot] : []));
      for (const input of inputs) input.poll();
      if (!active) return Uint8Array.of(0,0);
      if (!Array.isArray(snapshots) || snapshots.length !== 2) throw new TypeError('two board snapshots required');
      return Uint8Array.from(inputs.map((input,slot) => input.sample(snapshots[slot])));
    },
    releasedSlots: () => Object.freeze([...lost].sort()),
    get active() { return active; },
    destroy() { if(destroyed) return;deactivate();destroyed=true;for(const input of inputs) input.destroy();for(const off of removers) off(); },
  });
}

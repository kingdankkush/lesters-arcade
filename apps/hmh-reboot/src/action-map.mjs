import { freezeDeep } from './value-guards.mjs';

const entries = [
  ['moveUp', 'Move up', 'KeyW', 'Left stick up', 'Move stick up', 'Move north.'],
  ['moveDown', 'Move down', 'KeyS', 'Left stick down', 'Move stick down', 'Move south.'],
  ['moveLeft', 'Move left', 'KeyA', 'Left stick left', 'Move stick left', 'Move west.'],
  ['moveRight', 'Move right', 'KeyD', 'Left stick right', 'Move stick right', 'Move east.'],
  ['grenade', 'Grenade', 'KeyF', 'Left bumper', 'GRENADE', 'Throw a hand grenade.'],
  ['weaponNext', 'Swap weapon', 'KeyQ', 'Right bumper', 'SWAP', 'Cycle to the next weapon you carry.'],
  ['pause', 'Pause', 'Escape', 'Menu', 'Pause button', 'Open or close the run menu.'],
  // Design package S1.1 (owner decision 20): the desktop keyboard's manual
  // dodge. Keyboard only: touch and gamepad keep the automatic dodge. Listed
  // last so bindings saved before it existed keep their keys when normalised.
  ['dodge', 'Dodge', 'ShiftLeft', '', '', 'Dash out of danger. On touch or a gamepad your hero dodges automatically.'],
];

export const HMH_ACTION_MAP = freezeDeep(Object.fromEntries(entries.map(([id, label, keyboard, gamepad, touch, help]) => [
  id,
  { id, label, keyboard, gamepad, touch, help,
    pointer: id === 'fire' ? 'Mouse aim / left click' : id === 'grenade' ? 'Right click' : '' },
])));
export const DEFAULT_KEYBOARD_BINDINGS = freezeDeep(Object.fromEntries(entries.map(([id, , keyboard]) => [id, keyboard])));
export const HMH_ACTION_IDS = Object.freeze(Object.keys(HMH_ACTION_MAP));
const DEFAULT_ALTERNATES = freezeDeep({
  moveUp: ['ArrowUp'], moveDown: ['ArrowDown'], moveLeft: ['ArrowLeft'], moveRight: ['ArrowRight'],
  grenade: ['KeyG'],
  weaponNext: ['KeyE'],
  dodge: ['ShiftRight'],
});

const ALLOWED_KEY_CODES = new Set([
  'Space', 'Escape', 'Tab', 'Enter',
  'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  ...Array.from({ length: 26 }, (_, index) => `Key${String.fromCharCode(65 + index)}`),
  ...Array.from({ length: 10 }, (_, index) => `Digit${index}`),
]);

export function normalizeKeyboardBindings(input = {}) {
  const requested = input && typeof input === 'object' ? input : {};
  const result = {};
  const used = new Set();
  for (const actionId of HMH_ACTION_IDS) {
    const candidate = typeof requested[actionId] === 'string' && ALLOWED_KEY_CODES.has(requested[actionId])
      ? requested[actionId]
      : DEFAULT_KEYBOARD_BINDINGS[actionId];
    const fallback = DEFAULT_KEYBOARD_BINDINGS[actionId];
    // A taken default falls back to the action's own alternate (Right Shift
    // for dodge) before the first free key.
    const code = !used.has(candidate) ? candidate : !used.has(fallback) ? fallback
      : (DEFAULT_ALTERNATES[actionId] ?? []).find((value) => !used.has(value)) ?? [...ALLOWED_KEY_CODES].find((value) => !used.has(value));
    result[actionId] = code;
    used.add(code);
  }
  return freezeDeep(result);
}

export function rebindKeyboardAction(bindings, actionId, code, { rankedActive = false } = {}) {
  if (rankedActive) throw new TypeError('keyboard bindings are locked during an active ranked run');
  if (!HMH_ACTION_IDS.includes(actionId)) throw new TypeError(`unknown action ${String(actionId)}`);
  if (!ALLOWED_KEY_CODES.has(code)) throw new TypeError(`unsupported keyboard code ${String(code)}`);
  const current = normalizeKeyboardBindings(bindings);
  const displacedAction = HMH_ACTION_IDS.find((id) => id !== actionId && current[id] === code);
  const next = { ...current, [actionId]: code };
  if (displacedAction) next[displacedAction] = current[actionId];
  return normalizeKeyboardBindings(next);
}

function keyboardAlternates(bindings, actionId) {
  if (bindings[actionId] !== DEFAULT_KEYBOARD_BINDINGS[actionId]) return [];
  return (DEFAULT_ALTERNATES[actionId] ?? []).filter((code) => !Object.values(bindings).includes(code));
}

export function keyboardActionPressed(keys, bindings, actionId) {
  return keys.has(bindings[actionId]) || keyboardAlternates(bindings, actionId).some((code) => keys.has(code));
}

export function keyboardCodesForBindings(bindings) {
  const normalized = normalizeKeyboardBindings(bindings);
  const codes = Object.values(normalized);
  for (const actionId of Object.keys(DEFAULT_ALTERNATES)) codes.push(...keyboardAlternates(normalized, actionId));
  return Object.freeze(codes);
}

export function keyboardMovement(keys, bindings) {
  const x = (keyboardActionPressed(keys, bindings, 'moveRight') ? 1 : 0) - (keyboardActionPressed(keys, bindings, 'moveLeft') ? 1 : 0);
  const y = (keyboardActionPressed(keys, bindings, 'moveDown') ? 1 : 0) - (keyboardActionPressed(keys, bindings, 'moveUp') ? 1 : 0);
  return { x, y };
}

export function keyboardActionRecord(keys, bindings) {
  // Fire and melee stay automatic; the swap edge is the one manual weapon
  // control (owner direction 2026-09-16). The dodge key is the desktop
  // keyboard's manual dodge (package S1.1); it feeds the sim's `dash` edge.
  return {
    fire: false, melee: false, weaponSlot: 0,
    dash: keyboardActionPressed(keys, bindings, 'dodge'),
    weaponNext: keyboardActionPressed(keys, bindings, 'weaponNext'),
    grenade: keyboardActionPressed(keys, bindings, 'grenade'),
    pause: keyboardActionPressed(keys, bindings, 'pause'),
  };
}

export function actionHelpRows(bindings = DEFAULT_KEYBOARD_BINDINGS) {
  const normalized = normalizeKeyboardBindings(bindings);
  return HMH_ACTION_IDS.map((id) => freezeDeep({ ...HMH_ACTION_MAP[id], keyboard: normalized[id], keyboardAlternates: keyboardAlternates(normalized, id) }));
}

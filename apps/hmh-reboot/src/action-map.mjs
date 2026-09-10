import { freezeDeep } from './value-guards.mjs';

const entries = [
  ['moveUp', 'Move up', 'KeyW', 'Left stick up', 'Move stick up', 'Move north.'],
  ['moveDown', 'Move down', 'KeyS', 'Left stick down', 'Move stick down', 'Move south.'],
  ['moveLeft', 'Move left', 'KeyA', 'Left stick left', 'Move stick left', 'Move west.'],
  ['moveRight', 'Move right', 'KeyD', 'Left stick right', 'Move stick right', 'Move east.'],
  ['grenade', 'Grenade', 'KeyF', 'Left bumper', 'GRENADE', 'Throw a hand grenade.'],
  ['pause', 'Pause', 'Escape', 'Menu', 'Pause button', 'Open or close the run menu.'],
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
    const code = !used.has(candidate) ? candidate : !used.has(fallback) ? fallback : [...ALLOWED_KEY_CODES].find((value) => !used.has(value));
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
  // Preserve the simulation snapshot shape while retiring manual combat extras.
  return {
    fire: false, melee: false, dash: false, weaponSlot: 0, weaponNext: false,
    grenade: keyboardActionPressed(keys, bindings, 'grenade'),
    pause: keyboardActionPressed(keys, bindings, 'pause'),
  };
}

export function actionHelpRows(bindings = DEFAULT_KEYBOARD_BINDINGS) {
  const normalized = normalizeKeyboardBindings(bindings);
  return HMH_ACTION_IDS.map((id) => freezeDeep({ ...HMH_ACTION_MAP[id], keyboard: normalized[id], keyboardAlternates: keyboardAlternates(normalized, id) }));
}

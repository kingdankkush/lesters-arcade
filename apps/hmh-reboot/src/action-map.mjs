import { freezeDeep } from './value-guards.mjs';

const entries = [
  ['moveUp', 'Move up', 'KeyW', 'Left stick up', 'Move stick up', 'Move north.'],
  ['moveDown', 'Move down', 'KeyS', 'Left stick down', 'Move stick down', 'Move south.'],
  ['moveLeft', 'Move left', 'KeyA', 'Left stick left', 'Move stick left', 'Move west.'],
  ['moveRight', 'Move right', 'KeyD', 'Left stick right', 'Move stick right', 'Move east.'],
  ['fire', 'Fire', 'Space', 'Right trigger', 'Aim stick / fire', 'Use the equipped weapon.'],
  ['melee', 'Melee', 'KeyE', 'X / Square', 'Melee', 'Use the close attack.'],
  ['grenade', 'Grenade', 'KeyF', 'Left bumper', 'Power', 'Throw a hand grenade.'],
  ['dash', 'Dash', 'ShiftLeft', 'A / Cross', 'Dash', 'Burst through danger.'],
  ['pause', 'Pause', 'Escape', 'Menu', 'Pause', 'Open or close the run menu.'],
  ['weaponNext', 'Next weapon', 'KeyQ', 'D-pad right', 'Weapon', 'Cycle to the next owned weapon.'],
  ['weaponSlot1', 'Weapon 1', 'Digit1', '', '', 'Equip weapon slot one.'],
  ['weaponSlot2', 'Weapon 2', 'Digit2', '', '', 'Equip weapon slot two.'],
  ['weaponSlot3', 'Weapon 3', 'Digit3', '', '', 'Equip weapon slot three.'],
  ['weaponSlot4', 'Weapon 4', 'Digit4', '', '', 'Equip weapon slot four.'],
];

export const HMH_ACTION_MAP = freezeDeep(Object.fromEntries(entries.map(([id, label, keyboard, gamepad, touch, help]) => [
  id,
  { id, label, keyboard, gamepad, touch, help },
])));
export const DEFAULT_KEYBOARD_BINDINGS = freezeDeep(Object.fromEntries(entries.map(([id, , keyboard]) => [id, keyboard])));
export const HMH_ACTION_IDS = Object.freeze(Object.keys(HMH_ACTION_MAP));
const DEFAULT_ALTERNATES = freezeDeep({
  moveUp: ['ArrowUp'], moveDown: ['ArrowDown'], moveLeft: ['ArrowLeft'], moveRight: ['ArrowRight'],
  grenade: ['KeyG'], dash: ['ShiftRight'],
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

export function keyboardActionPressed(keys, bindings, actionId) {
  if (keys.has(bindings[actionId])) return true;
  if (bindings[actionId] !== DEFAULT_KEYBOARD_BINDINGS[actionId]) return false;
  return (DEFAULT_ALTERNATES[actionId] ?? []).some((code) => keys.has(code));
}

export function keyboardCodesForBindings(bindings) {
  const normalized = normalizeKeyboardBindings(bindings);
  const codes = Object.values(normalized);
  for (const [actionId, alternates] of Object.entries(DEFAULT_ALTERNATES)) {
    if (normalized[actionId] === DEFAULT_KEYBOARD_BINDINGS[actionId]) codes.push(...alternates);
  }
  return Object.freeze(codes);
}

export function keyboardMovement(keys, bindings) {
  const x = (keyboardActionPressed(keys, bindings, 'moveRight') ? 1 : 0) - (keyboardActionPressed(keys, bindings, 'moveLeft') ? 1 : 0);
  const y = (keyboardActionPressed(keys, bindings, 'moveDown') ? 1 : 0) - (keyboardActionPressed(keys, bindings, 'moveUp') ? 1 : 0);
  return { x, y };
}

export function keyboardActionRecord(keys, bindings) {
  const weaponSlot = ['weaponSlot1', 'weaponSlot2', 'weaponSlot3', 'weaponSlot4'].findIndex((id) => keyboardActionPressed(keys, bindings, id)) + 1;
  return {
    fire: keyboardActionPressed(keys, bindings, 'fire'),
    melee: keyboardActionPressed(keys, bindings, 'melee'),
    grenade: keyboardActionPressed(keys, bindings, 'grenade'),
    dash: keyboardActionPressed(keys, bindings, 'dash'),
    pause: keyboardActionPressed(keys, bindings, 'pause'),
    weaponSlot,
    weaponNext: keyboardActionPressed(keys, bindings, 'weaponNext'),
  };
}

export function actionHelpRows(bindings = DEFAULT_KEYBOARD_BINDINGS) {
  const normalized = normalizeKeyboardBindings(bindings);
  return HMH_ACTION_IDS.map((id) => freezeDeep({ ...HMH_ACTION_MAP[id], keyboard: normalized[id] }));
}

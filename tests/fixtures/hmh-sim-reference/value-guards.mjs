// Verbatim copy of the 1.8.1 release (60ea173a) apps/hmh-reboot/src/value-guards.mjs, kept as the
// bit-identical reference for tests/hmh-sim-hot-path.test.mjs. Do not edit.
export function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

export function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

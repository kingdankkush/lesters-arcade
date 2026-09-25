export function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

// Shared argument guards (formerly copied into each simulation module).
// finite(value, `${name}.${axis}`), without building the message for valid input.
function coordinate(value, name, axis) {
  return Number.isFinite(value) ? value : finite(value, `${name}.${axis}`);
}

export function point2(value, name) {
  return Object.freeze({ x: coordinate(value?.x, name, 'x'), y: coordinate(value?.y, name, 'y') });
}

export function point3(value, name) {
  return Object.freeze({
    x: coordinate(value?.x, name, 'x'),
    y: coordinate(value?.y, name, 'y'),
    z: coordinate(value?.z, name, 'z'),
  });
}

export function validSeed(value) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) throw new TypeError('seed must be an unsigned 32-bit integer');
  return value >>> 0;
}

export function positive(value, name) {
  finite(value, name);
  if (value <= 0) throw new TypeError(`${name} must be positive`);
  return value;
}

export function nonNegative(value, name) {
  finite(value, name);
  if (value < 0) throw new TypeError(`${name} must be non-negative`);
  return value;
}

export function nonNegativeInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative integer`);
  return value;
}

export function positiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) throw new TypeError(`${name} must be a positive integer`);
  return value;
}

// Code-unit string order, the comparator the simulation sorts ids with.
export const lexical = (left, right) => left < right ? -1 : left > right ? 1 : 0;

export function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

// A canonical Map key for an integer grid cell. Cells within +-8191 on both
// axes pack into one small integer; any other cell (or a non-integer one)
// keeps an "x,y" string. The two forms never collide, and -0 and 0 share a
// key, exactly as their "x,y" strings did, so a packed grid finds the same
// buckets a string-keyed one did.
export function cellKey(x, y) {
  return x > -8192 && x < 8192 && y > -8192 && y < 8192 && Number.isInteger(x) && Number.isInteger(y)
    ? (x + 8192) * 16384 + y + 8192
    : `${x},${y}`;
}

// Shared deterministic hash helpers (Cycle 074, N-4 entry hygiene).
//
// Before this module four files carried their own seededUnit, four their own
// deterministicUnit (two DIFFERENT FNV-1a families under one name) and three
// their own mix. Each helper here is bit-for-bit the copy it replaces;
// tests/hmh-reboot-deterministic-hash.test.mjs holds every one to the verbatim
// pre-refactor implementation over the live key shapes.
//
// Two FNV-1a families exist on purpose and must stay distinct:
//   seededUnit / feedbackUnit: offset basis XOR seed, prime 0x01000193, then an
//     xorshift (13, 17, 5) finaliser. feedbackUnit(key) === seededUnit(0, key).
//     Users: weapon spread, pellets and shock rolls (weapon-system), critical
//     rolls (combat-events), authored dressing layout (authored-prop-atlas),
//     baked decals (world-decals), impact and grenade fans (combat-feedback,
//     grenade-feedback).
//   deterministicUnit: plain 32-bit FNV-1a (2166136261, 16777619) with no
//     finaliser. Users: camera shake and event VFX jitter (main), casing tumble
//     (weapon-vfx).
//   mix: the 32-bit integer finaliser the three event placers use to pick a
//     candidate, an offset and a tick from the run seed.
//
// Keys are iterated by UTF-16 code unit. Every runtime key is ASCII (ids,
// ticks, indices, colons), where this matches the code-point loop some older
// copies used. Seeds are not validated here: the simulation callers validate
// at their own boundaries (validSeed) and the art callers pass world constants.

export function seededUnit(seed, key) {
  let hash = ((Number(seed) >>> 0) ^ 0x811c9dc5) >>> 0;
  const text = String(key);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  hash ^= hash << 13;
  hash ^= hash >>> 17;
  hash ^= hash << 5;
  return (hash >>> 0) / 0x1_0000_0000;
}

export function feedbackUnit(key) {
  return seededUnit(0, key);
}

export function deterministicUnit(key) {
  let hash = 2166136261;
  const text = String(key);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash / 0x1_0000_0000;
}

export function mix(value) {
  let hash = value >>> 0;
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d) >>> 0;
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b) >>> 0;
  return (hash ^ (hash >>> 16)) >>> 0;
}

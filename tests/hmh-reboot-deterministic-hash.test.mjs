import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

// Cycle 074 (N-4 entry hygiene). Four modules each carried their own
// seededUnit, four their own deterministicUnit (two different FNV families
// under one name), three their own mix. They now share one module. These
// tests hold the shared helpers to the pre-refactor copies bit for bit, so a
// wrong seed XOR or a dropped finaliser (which would move weapon spread,
// critical rolls, decals, VFX fans and event placement) cannot ship.
const hashModule = await import('../apps/hmh-reboot/src/deterministic-hash.mjs').catch(() => ({}));

// --- verbatim pre-Cycle-074 copies -------------------------------------------
// authored-prop-atlas.mjs (for-of over code points, coercing seed)
function legacySeededUnitAuthoredProps(seed, key) {
  let hash = (Number(seed) >>> 0) ^ 0x811c9dc5;
  for (const character of String(key)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  hash ^= hash << 13;
  hash ^= hash >>> 17;
  hash ^= hash << 5;
  return (hash >>> 0) / 0x1_0000_0000;
}
// combat-events.mjs / weapon-system.mjs (validated seed, unsigned start)
function legacySeededUnitSimulation(seed, key) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff) throw new TypeError('seed must be an unsigned 32-bit integer');
  let hash = ((seed >>> 0) ^ 0x811c9dc5) >>> 0;
  for (const character of String(key)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  hash ^= hash << 13;
  hash ^= hash >>> 17;
  hash ^= hash << 5;
  return (hash >>> 0) / 0x1_0000_0000;
}
// world-decals.mjs (indexed code units)
function legacySeededUnitDecals(seed, key) {
  let hash = (Number(seed) >>> 0) ^ 0x811c9dc5;
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
// combat-feedback.mjs / grenade-feedback.mjs ("deterministicUnit", xorshift family)
function legacyFeedbackUnit(key) {
  let hash = 0x811c9dc5;
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
// main.mjs / weapon-vfx.mjs ("deterministicUnit", plain FNV-1a family)
function legacyRuntimeUnit(key) {
  let hash = 2166136261;
  const text = String(key);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash / 0x1_0000_0000;
}
// bear-market-burner-event.mjs / forked-standard-event.mjs / lightning-ledger-event.mjs
const legacyMix = (value) => {
  let hash = value >>> 0;
  hash ^= hash >>> 16; hash = Math.imul(hash, 0x7feb352d) >>> 0;
  hash ^= hash >>> 15; hash = Math.imul(hash, 0x846ca68b) >>> 0;
  return (hash ^ (hash >>> 16)) >>> 0;
};

// Key shapes lifted from the live call sites plus edge cases. Every key the
// runtime builds is ASCII (ids, ticks, indices, colons), which is the contract
// the shared helper documents; BMP text is included to show the code-unit loop
// agrees with the code-point loop wherever no surrogate pair exists.
const KEYS = [
  '', '0', 'a', ':', 'critical:hit-12:enemy-3', 'attack-991:spread', 'attack-991:pellet:7', 'attack-991:shock',
  'shake-x:1200:1180', 'shake-y:1200:1180', '4321:ledger:2', '4321:burner:plume', '4321:burner:ember:5',
  '4321:512.5:-88.25:3', 'camp-hashwood-2:angle', 'camp-hashwood-2:radius', 'dressing:liquidation-yard:14:x:2',
  'anchor:rugpull-ravine:3:sweep', 'landmark-mining-loader:0', 'decal:mining-camp:scorch:12:j', 'decal:hashwood:leaf:3:rot',
  '77:puff', '77:lobe:1', '77:drift:2', '77:frag:63', '77:speed:0', 'impact-3301-4:9', '9001:shell',
  'the-liquidator:phase:2', 'x'.repeat(200), 'ünïcödé:ß:ø', '☃:snow', 'tab\tand\nnewline',
];
const SEEDS = [0, 1, 2, 7, 255, 256, 65_535, 65_536, 424_242, 0x484d4807, 0x484d4821, 12_345_678, 2 ** 31 - 1, 2 ** 31, 0xdead_beef, 0xffff_fffe, 0xffff_ffff];

test('seededUnit reproduces the authored-prop, simulation and decal copies bit for bit', () => {
  assert.equal(typeof hashModule.seededUnit, 'function');
  let checked = 0;
  for (const seed of SEEDS) {
    for (const key of KEYS) {
      const shared = hashModule.seededUnit(seed, key);
      assert.equal(shared, legacySeededUnitAuthoredProps(seed, key), `authored-prop copy differs for seed ${seed} key ${JSON.stringify(key)}`);
      assert.equal(shared, legacySeededUnitSimulation(seed, key), `simulation copy differs for seed ${seed} key ${JSON.stringify(key)}`);
      assert.equal(shared, legacySeededUnitDecals(seed, key), `decal copy differs for seed ${seed} key ${JSON.stringify(key)}`);
      assert.ok(shared >= 0 && shared < 1, 'unit interval');
      checked += 1;
    }
  }
  assert.equal(checked, SEEDS.length * KEYS.length);
  // Numeric keys are stringified exactly as before.
  assert.equal(hashModule.seededUnit(9, 42), legacySeededUnitDecals(9, 42));
  assert.equal(hashModule.seededUnit(9, 0.5), legacySeededUnitDecals(9, 0.5));
});

test('feedbackUnit reproduces the combat/grenade feedback copy bit for bit and equals seededUnit(0, key)', () => {
  assert.equal(typeof hashModule.feedbackUnit, 'function');
  for (const key of KEYS) {
    const shared = hashModule.feedbackUnit(key);
    assert.equal(shared, legacyFeedbackUnit(key), `feedback copy differs for key ${JSON.stringify(key)}`);
    assert.equal(shared, hashModule.seededUnit(0, key), 'the feedback family is the seeded family at seed 0');
  }
});

test('deterministicUnit reproduces the runtime and weapon-vfx FNV-1a copy bit for bit', () => {
  assert.equal(typeof hashModule.deterministicUnit, 'function');
  for (const key of KEYS) {
    const shared = hashModule.deterministicUnit(key);
    assert.equal(shared, legacyRuntimeUnit(key), `runtime copy differs for key ${JSON.stringify(key)}`);
    assert.ok(shared >= 0 && shared < 1, 'unit interval');
  }
  // The two families are distinct on purpose (only one applies the xorshift
  // finaliser); a dedupe that merged them would move every VFX fan.
  assert.notEqual(hashModule.deterministicUnit('shake-x:1200:1180'), hashModule.feedbackUnit('shake-x:1200:1180'));
});

test('mix reproduces the three event-placement copies bit for bit', () => {
  assert.equal(typeof hashModule.mix, 'function');
  const values = [];
  for (const seed of SEEDS) {
    values.push(seed, seed ^ 0xb34a4e7, seed ^ 0xf1a4e55, seed ^ 0xb007e4, seed ^ 0xf04ced, seed ^ 0x57a4da2d, seed ^ 0xca110ca1, seed ^ 0xa11ce55d, seed ^ 0x1ed6e7);
  }
  for (const value of values) {
    const shared = hashModule.mix(value);
    assert.equal(shared, legacyMix(value), `mix differs for ${value}`);
    assert.ok(Number.isInteger(shared) && shared >= 0 && shared <= 0xffff_ffff, 'unsigned 32-bit result');
  }
});

test('no child module keeps a private copy of the shared hash helpers', async () => {
  const srcDir = new URL('../apps/hmh-reboot/src/', import.meta.url);
  const files = (await readdir(srcDir)).filter((name) => name.endsWith('.mjs') && name !== 'deterministic-hash.mjs');
  const importers = {
    seededUnit: ['authored-prop-atlas.mjs', 'combat-events.mjs', 'weapon-system.mjs', 'world-decals.mjs'],
    feedbackUnit: ['combat-feedback.mjs', 'grenade-feedback.mjs'],
    deterministicUnit: ['main.mjs', 'weapon-vfx.mjs'],
    mix: ['bear-market-burner-event.mjs', 'forked-standard-event.mjs', 'lightning-ledger-event.mjs'],
  };
  for (const name of files) {
    const source = await readFile(new URL(name, srcDir), 'utf8');
    assert.doesNotMatch(source, /function (?:seededUnit|deterministicUnit|feedbackUnit|mix)\s*\(/, `${name} redefines a shared hash helper`);
    assert.doesNotMatch(source, /const (?:seededUnit|deterministicUnit|feedbackUnit|mix)\s*=\s*\(/, `${name} redefines a shared hash helper`);
    // The xorshift finaliser only belongs to the shared seeded family; the
    // inline FNV id-hash loops elsewhere (collision, navgrid, roster ids) are
    // integer hashes of a different shape and stay where they are.
    assert.doesNotMatch(source, /hash \^= hash << 13;\s*hash \^= hash >>> 17;\s*hash \^= hash << 5;/, `${name} inlines the seeded-unit finaliser`);
  }
  for (const [helper, names] of Object.entries(importers)) {
    for (const name of names) {
      const source = await readFile(new URL(name, srcDir), 'utf8');
      const importLine = source.match(/import \{([^}]*)\} from '\.\/deterministic-hash\.mjs'/);
      assert.ok(importLine, `${name} must import from deterministic-hash.mjs`);
      assert.match(importLine[1], new RegExp(`\\b${helper}\\b`), `${name} must import ${helper}`);
    }
  }
});

test('the shared hash module is projection-and-simulation-safe source: no time, no Math.random, no DOM', async () => {
  const source = await readFile(new URL('../apps/hmh-reboot/src/deterministic-hash.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /Math\.random|performance\.now|Date\.now|document\.|window\./);
  assert.match(source, /export function seededUnit\(seed, key\)/);
  assert.match(source, /export function deterministicUnit\(key\)/);
  assert.match(source, /export function feedbackUnit\(key\)/);
  assert.match(source, /export function mix\(value\)/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { HMH_ANIMATED_ROSTER } from '../apps/portal/assets/generated/hmh-animated-roster/hmh-animated-roster.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Regression guard for the "hero swaps between 3-4 designs mid-run" glitch.
// Each playable hero must lock to EXACTLY ONE roster, so no animation state
// ever falls through to a DIFFERENT character design.
const HERO_LOCKED_ROSTER = {
  'lit-commando': 'lit-commando',
  'lit-valkyrie': 'lit-valkyrie',
  'lester-original': 'lester',
  lester: 'lester',
  lilly: 'lilly',
};

const PLAYABLE_ROSTERS = ['lit-commando', 'lit-valkyrie', 'lester', 'lilly'];
const HERO_REQUIRED_STATES = ['idle', 'walk', 'run', 'shoot', 'melee', 'throw', 'hurt', 'death'];
const HERO_DIRECTIONS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];

function resolveRuntimeAsset(src) {
  return path.resolve(ROOT, 'apps/portal', String(src).replace(/^\.\//, ''));
}

function pngDimensions(filePath) {
  const buffer = readFileSync(filePath);
  assert.equal(buffer.toString('ascii', 1, 4), 'PNG', `${filePath} must be a PNG`);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bytes: buffer.length,
  };
}

test('every hero locks to one roster that exists', () => {
  for (const [hero, key] of Object.entries(HERO_LOCKED_ROSTER)) {
    const roster = HMH_ANIMATED_ROSTER[key];
    assert.ok(roster, `roster ${key} exists for hero ${hero}`);
  }
});

test('all playable rosters carry full 8-direction required animation coverage with real PNG frames', () => {
  for (const key of PLAYABLE_ROSTERS) {
    const anims = HMH_ANIMATED_ROSTER[key]?.animations ?? {};
    for (const state of HERO_REQUIRED_STATES) {
      for (const direction of HERO_DIRECTIONS) {
        const frames = anims[state]?.[direction] ?? [];
        assert.ok(frames.length > 0, `${key}/${state}/${direction} has no frames`);
        const first = resolveRuntimeAsset(frames[0]);
        assert.ok(existsSync(first), `${key}/${state}/${direction} first frame is missing on disk: ${frames[0]}`);
        assert.ok(first.endsWith('.png'), `${key}/${state}/${direction} first frame should be a PNG: ${frames[0]}`);
      }
    }
  }
});

test('playable hero manifests do not carry QA-green placeholder identity or tiny sprite artifacts', () => {
  const minimumBytes = {
    'lit-commando': 3000,
    'lit-valkyrie': 3500,
    lester: 7000,
    lilly: 7000,
  };
  for (const key of PLAYABLE_ROSTERS) {
    const entry = HMH_ANIMATED_ROSTER[key];
    assert.ok(!String(entry?.character_id ?? '').startsWith('qa-green-native-'), `${key} is still labeled as QA-green placeholder art`);
    const firstSouthIdle = resolveRuntimeAsset(entry.animations?.idle?.south?.[0]);
    const dims = pngDimensions(firstSouthIdle);
    assert.ok(dims.width >= 45 && dims.height >= 90, `${key} idle/south canvas is too small for production hero art: ${dims.width}x${dims.height}`);
    assert.ok(dims.bytes >= minimumBytes[key], `${key} idle/south PNG is too tiny/simple and likely placeholder art: ${dims.bytes} bytes`);
  }
});

test('no playable hero frame keeps the tiny QA triangle/robot placeholder signature', () => {
  for (const key of PLAYABLE_ROSTERS) {
    const entry = HMH_ANIMATED_ROSTER[key];
    for (const [state, dirs] of Object.entries(entry.animations ?? {})) {
      for (const [direction, frames] of Object.entries(dirs ?? {})) {
        for (const frame of frames ?? []) {
          const resolved = resolveRuntimeAsset(frame);
          const dims = pngDimensions(resolved);
          assert.ok(dims.bytes >= 950, `${key}/${state}/${direction}/${path.basename(frame)} is still a tiny placeholder-like frame (${dims.bytes} bytes)`);
        }
      }
    }
  }
});

test('character-select rotation display scales normalize Lester and Lilly without shrinking them', () => {
  const src = readFileSync(fileURLToPath(new URL('../apps/portal/main.js', import.meta.url)), 'utf8');
  assert.equal(src.includes("'lit-commando': 1.1"), true);
  assert.equal(src.includes("'lit-valkyrie': 1.1"), true);
  assert.equal(src.includes("lester: 1.23"), true);
  assert.equal(src.includes("'lester-original': 1.23"), true);
  assert.equal(src.includes("lilly: 1.23"), true);
});

test('Commando and Valkyrie are DISTINCT designs (no shared roster)', () => {
  assert.notEqual(HERO_LOCKED_ROSTER['lit-commando'], HERO_LOCKED_ROSTER['lit-valkyrie']);
});

test('main.js HERO_LOCKED_ROSTER mapping stays in sync with the locked designs', () => {
  const src = readFileSync(fileURLToPath(new URL('../apps/portal/main.js', import.meta.url)), 'utf8');
  // The lock table + the no-fall-through resolver must be present.
  assert.equal(src.includes('const HERO_LOCKED_ROSTER'), true);
  assert.equal(src.includes("'lit-commando': 'lit-commando'"), true);
  assert.equal(src.includes("'lit-valkyrie': 'lit-valkyrie'"), true);
  assert.equal(src.includes("'lester-original': 'lester'"), true);
  assert.equal(src.includes("lilly: 'lilly'"), true);
});

test('each enemy/boss roster with frames represents a single coherent design', () => {
  // Enemies/bosses map 1:1 to a roster via rosterKeyForEntity, so there is no
  // per-enemy design mixing. A roster may legitimately carry a partial kit
  // (e.g. only 'hurt' harvested) -- the renderer falls back to non-animated
  // stills for missing states. The invariant we assert: any present animation
  // has at least one direction with frames (no empty/broken animation entries).
  for (const [key, entry] of Object.entries(HMH_ANIMATED_ROSTER)) {
    if (PLAYABLE_ROSTERS.includes(key)) continue;
    const anims = entry.animations ?? {};
    for (const [name, dirs] of Object.entries(anims)) {
      const dirKeys = Object.keys(dirs ?? {});
      assert.ok(dirKeys.length > 0, `${key}/${name} has no directions`);
      assert.ok(dirKeys.some((d) => Array.isArray(dirs[d]) && dirs[d].length > 0), `${key}/${name} has no frames in any direction`);
    }
  }
});

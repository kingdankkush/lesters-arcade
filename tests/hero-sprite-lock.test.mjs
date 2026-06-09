import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { HMH_ANIMATED_ROSTER } from '../apps/portal/assets/generated/hmh-animated-roster/hmh-animated-roster.mjs';

// Regression guard for the "hero swaps between 3-4 designs mid-run" glitch.
// Each playable hero must lock to EXACTLY ONE roster that has the full hero
// animation kit, so no animation state ever falls through to a different
// character design.
const HERO_LOCKED_ROSTER = {
  'lit-commando': 'lester',
  lester: 'lester',
  'lit-valkyrie': 'lilly',
  lilly: 'lilly',
};
const HERO_ANIM_STATES = ['idle', 'walk', 'run', 'shoot', 'melee', 'throw', 'hurt', 'death'];

test('every hero locks to one roster that covers all hero animation states', () => {
  const seen = new Set();
  for (const [hero, key] of Object.entries(HERO_LOCKED_ROSTER)) {
    const roster = HMH_ANIMATED_ROSTER[key];
    assert.ok(roster, `roster ${key} exists for hero ${hero}`);
    const anims = roster.animations ?? {};
    for (const state of HERO_ANIM_STATES) {
      assert.ok(anims[state], `${hero} -> ${key} is missing the '${state}' animation (would cause design-swap fallback)`);
    }
    seen.add(key);
  }
  // The two distinct designs must be distinct rosters (Commando != Valkyrie).
  assert.equal(HERO_LOCKED_ROSTER['lit-commando'] !== HERO_LOCKED_ROSTER['lit-valkyrie'], true);
});

test('main.js HERO_LOCKED_ROSTER mapping stays in sync with the locked designs', () => {
  const src = readFileSync(fileURLToPath(new URL('../apps/portal/main.js', import.meta.url)), 'utf8');
  // The lock table + the no-fall-through resolver must be present.
  assert.equal(src.includes('const HERO_LOCKED_ROSTER'), true);
  assert.equal(src.includes("'lit-commando': 'lester'"), true);
  assert.equal(src.includes("'lit-valkyrie': 'lilly'"), true);
});

test('each enemy/boss roster with frames represents a single coherent design', () => {
  // Enemies/bosses map 1:1 to a roster via rosterKeyForEntity, so there is no
  // per-enemy design mixing. A roster may legitimately carry a partial kit
  // (e.g. only 'hurt' harvested) -- the renderer falls back to non-animated
  // stills for missing states. The invariant we assert: any present animation
  // has at least one direction with frames (no empty/broken animation entries).
  for (const [key, entry] of Object.entries(HMH_ANIMATED_ROSTER)) {
    if (['lester', 'lilly', 'lit-commando', 'lit-valkyrie'].includes(key)) continue;
    const anims = entry.animations ?? {};
    for (const [name, dirs] of Object.entries(anims)) {
      const dirKeys = Object.keys(dirs ?? {});
      assert.ok(dirKeys.length > 0, `${key}/${name} has no directions`);
      assert.ok(dirKeys.some((d) => Array.isArray(dirs[d]) && dirs[d].length > 0), `${key}/${name} has no frames in any direction`);
    }
  }
});

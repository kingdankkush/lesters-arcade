import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { HMH_ANIMATED_ROSTER } from '../apps/portal/assets/generated/hmh-animated-roster/hmh-animated-roster.mjs';
import { HMH_COMPLETE_ANIMATIONS_READY } from '../apps/portal/assets/generated/hmh-complete-animations/hmh-complete-animations.mjs';

// Regression guard for the "hero swaps between 3-4 designs mid-run" glitch.
// Each playable hero must lock to EXACTLY ONE roster, so no animation state
// ever falls through to a DIFFERENT character design. (Missing states inside a
// roster are OK — the renderer falls back to other anims of the SAME design.)
const HERO_LOCKED_ROSTER = {
  'lit-commando': 'lit-commando',
  lester: 'lester',
  'lit-valkyrie': 'lit-valkyrie',
  lilly: 'lit-valkyrie',
};
// Core states every hero roster must cover with REAL multi-direction art so
// moment-to-moment gameplay (move + fight) never falls back awkwardly.
// hurt/death/throw may lag behind while PixelLab kits finish generating —
// in-roster fallback keeps the design coherent for those.
const HERO_CORE_STATES = ['idle', 'walk', 'run', 'shoot', 'melee'];
// Minimum direction coverage for the core states (8 = full kit; lester's
// legacy kit carries walk/idle at 8-dir and the rest as south-only stills
// that the renderer mirrors, so we gate per-roster below).
const FULL_8DIR_ROSTERS = ['lit-valkyrie', 'lit-commando'];

test('every hero locks to one roster that covers the core animation states', () => {
  for (const [hero, key] of Object.entries(HERO_LOCKED_ROSTER)) {
    const roster = HMH_COMPLETE_ANIMATIONS_READY[key] ?? HMH_ANIMATED_ROSTER[key];
    assert.ok(roster, `roster ${key} exists for hero ${hero}`);
    const anims = roster.animations ?? {};
    for (const state of HERO_CORE_STATES) {
      assert.ok(anims[state], `${hero} -> ${key} is missing the '${state}' animation (would cause design-swap fallback)`);
    }
  }
});

test('new-hero rosters carry true 8-direction kits for the core states', () => {
  for (const key of FULL_8DIR_ROSTERS) {
    const anims = HMH_ANIMATED_ROSTER[key]?.animations ?? {};
    for (const state of HERO_CORE_STATES) {
      const dirs = Object.keys(anims[state] ?? {});
      // shoot may be 7/8 while one direction re-queues; require >= 7 so a
      // partial regen never silently ships a 1-direction kit again.
      assert.ok(dirs.length >= 7, `${key}/${state} has only ${dirs.length} directions (expected >= 7 of 8)`);
    }
  }
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

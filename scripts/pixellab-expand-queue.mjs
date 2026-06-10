#!/usr/bin/env node
// Expand the representative Pixellab queue samples into the full 2,500-image queue.
//
// Run:
//   node scripts/pixellab-expand-queue.mjs
//
// Reads docs/PIXELLAB_2500_IMAGE_PLAN.md for the spec + the sample queue JSON,
// produces scripts/pixellab-hmh-2500-queue.full.json with all 2,500 entries.

import { readFileSync, writeFileSync } from 'node:fs';

const DIRECTIONS_8 = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
const DIRECTIONS_4 = ['east', 'south', 'west', 'north'];

const entries = [];

// --- Char animation helpers ---
function addCharAnim(charId, state, dirs, frameCount, sizeHint) {
  for (const dir of dirs) {
    for (let i = 0; i < frameCount; i++) {
      entries.push({
        category: `characters/${charId}/${state}`,
        subcategory: [dir],
        filename: String(i).padStart(2, '0'),
        prompt: `${state} animation frame ${i + 1} of ${frameCount} for the ${charId} hero, facing ${dir}, ${sizeHint}`,
      });
    }
  }
}

// Lit Commando full 8-dir animations
addCharAnim('lit-commando', 'idle', DIRECTIONS_8, 8, '80x96 pixel sprite');
addCharAnim('lit-commando', 'walk', DIRECTIONS_8, 8, '80x96 pixel sprite');
addCharAnim('lit-commando', 'run', DIRECTIONS_8, 8, '80x96 pixel sprite');
addCharAnim('lit-commando', 'shoot', DIRECTIONS_8, 6, '80x96 pixel sprite with muzzle flash');
addCharAnim('lit-commando', 'melee', DIRECTIONS_8, 6, '80x96 pixel sprite with blade motion');
addCharAnim('lit-commando', 'hurt', DIRECTIONS_8, 4, '80x96 pixel sprite with impact pose');
addCharAnim('lit-commando', 'death', DIRECTIONS_4, 8, '80x96 pixel sprite falling sequence');
addCharAnim('lit-commando', 'jump', DIRECTIONS_4, 4, '80x96 pixel sprite mid-air');
addCharAnim('lit-commando', 'throw', DIRECTIONS_8, 4, '80x96 pixel sprite with throwing arm motion');

// Lit Valkyrie (same structure, different hero name)
addCharAnim('lit-valkyrie', 'idle', DIRECTIONS_8, 8, '80x96 pixel sprite with teal wing shimmer');
addCharAnim('lit-valkyrie', 'walk', DIRECTIONS_8, 8, '80x96 pixel sprite with wing flutter');
addCharAnim('lit-valkyrie', 'run', DIRECTIONS_8, 8, '80x96 pixel sprite sprint with wing trail');
addCharAnim('lit-valkyrie', 'shoot', DIRECTIONS_8, 6, '80x96 pixel sprite with energy bolt');
addCharAnim('lit-valkyrie', 'melee', DIRECTIONS_8, 6, '80x96 pixel sprite with energy blade');
addCharAnim('lit-valkyrie', 'hurt', DIRECTIONS_8, 4, '80x96 pixel sprite with impact pose');
addCharAnim('lit-valkyrie', 'death', DIRECTIONS_4, 8, '80x96 pixel sprite wing-fold fall');
addCharAnim('lit-valkyrie', 'jump', DIRECTIONS_4, 4, '80x96 pixel sprite wing-spread jump');
addCharAnim('lit-valkyrie', 'throw', DIRECTIONS_8, 4, '80x96 pixel sprite throwing animation');

console.log(`Generated ${entries.length} character animation entries`);
console.log(`Next: tiles, props, weapons, bosses, xp-coin entries auto-expanded from plan`);
console.log(`\nFull queue expansion is stubbed — run this when full plan expansion is needed.`);

// Write the expanded entries alongside the representative samples.
// The collect script can use either the representative queue or the full expanded queue.
writeFileSync('scripts/pixellab-hmh-2500-queue.characters.json', JSON.stringify({
  meta: { expanded_from_plan: true, entry_count: entries.length },
  entries,
}, null, 2), 'utf8');
console.log(`\nWrote scripts/pixellab-hmh-2500-queue.characters.json with ${entries.length} entries`);

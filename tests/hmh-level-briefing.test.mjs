import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LEVEL_ONE_ENTRIES } from '../apps/hmh-reboot/src/level-entry.mjs';
import { LEVEL_ONE_WORLD } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { WORLD_DESIGN_SITES } from '../apps/hmh-reboot/src/world-design-encounters.mjs';
import { buildAuthoredPointOfInterestPlacements } from '../apps/hmh-reboot/src/authored-prop-atlas.mjs';
import { HMH_WEAPON_DEFINITIONS } from '../apps/hmh-reboot/src/weapon-system.mjs';
import {
  LEVEL_ONE_BRIEFING, BRIEFING_SLOTS, selectBriefingTip, resolveLevelBriefing, applyLevelBriefing,
} from '../apps/hmh-reboot/src/level-briefing.mjs';

const OCTANTS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
// Screen space: +y is south. The octant is the nearest 45-degree compass slice.
function bearingOf(from, to) {
  const degrees = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;
  return OCTANTS[((Math.round(degrees / 45) % 8) + 8) % 8];
}

const placements = buildAuthoredPointOfInterestPlacements(LEVEL_ONE_WORLD.pointsOfInterest);
function locate(feature) {
  switch (feature.kind) {
    case 'poi': {
      const poi = LEVEL_ONE_WORLD.pointsOfInterest.find((item) => item.id === feature.id);
      return poi ? { x: poi.anchor.x, y: poi.anchor.y } : null;
    }
    case 'arena': {
      const arena = LEVEL_ONE_WORLD.encounterArenas.find((item) => item.id === feature.id);
      return arena ? { x: arena.anchor.x, y: arena.anchor.y, radius: arena.radius } : null;
    }
    case 'site': {
      const site = WORLD_DESIGN_SITES.find((item) => item.id === feature.id);
      return site ? { x: site.x, y: site.y } : null;
    }
    default:
      return null;
  }
}

test('every Level 1 entry has a briefing and the briefing names only real entries', () => {
  assert.equal(LEVEL_ONE_BRIEFING.levelId, LEVEL_ONE_WORLD.id);
  const entryIds = LEVEL_ONE_ENTRIES.map((entry) => entry.id).sort();
  assert.deepEqual(Object.keys(LEVEL_ONE_BRIEFING.entries).sort(), entryIds);
  for (const entry of LEVEL_ONE_ENTRIES) {
    const briefing = LEVEL_ONE_BRIEFING.entries[entry.id];
    for (const slot of ['objective', 'watch', 'supply']) {
      assert.equal(typeof briefing[slot], 'string', `${entry.id}.${slot}`);
      assert.equal(briefing[slot], briefing[slot].trim(), `${entry.id}.${slot} has no stray whitespace`);
      assert.ok(briefing[slot].length >= 24 && briefing[slot].length <= 150, `${entry.id}.${slot} length ${briefing[slot].length}`);
    }
    assert.ok(briefing.features.length >= 3, `${entry.id} cites at least three authored features`);
  }
});

test('briefing copy cites authored features that exist, sit near the entry, and lie on the stated bearing', () => {
  for (const entry of LEVEL_ONE_ENTRIES) {
    const briefing = LEVEL_ONE_BRIEFING.entries[entry.id];
    for (const feature of briefing.features) {
      const target = locate(feature);
      assert.ok(target, `${entry.id}: ${feature.kind} ${feature.id} exists in the authored world`);
      const distance = Math.hypot(target.x - entry.x, target.y - entry.y);
      assert.ok(distance <= 1500, `${entry.id}: ${feature.id} is ${Math.round(distance)} units away, too far to call nearby`);
      if (feature.inside) {
        assert.ok(Number.isFinite(target.radius) && distance <= target.radius, `${entry.id} starts inside ${feature.id}`);
      } else {
        assert.ok(OCTANTS.includes(feature.bearing), `${entry.id}: ${feature.id} declares a compass bearing`);
        assert.equal(bearingOf(entry, target), feature.bearing, `${entry.id}: ${feature.id} bearing`);
        const copy = `${briefing.watch} ${briefing.supply} ${briefing.objective}`.toLowerCase();
        assert.ok(copy.includes(feature.bearing), `${entry.id}: copy names the ${feature.bearing} bearing of ${feature.id}`);
      }
    }
  }
});

test('named pickups match the authored point-of-interest collectibles and shipped weapon names', () => {
  for (const entry of LEVEL_ONE_ENTRIES) {
    const briefing = LEVEL_ONE_BRIEFING.entries[entry.id];
    for (const feature of briefing.features.filter((item) => item.kind === 'poi')) {
      const placement = placements.find((item) => item.pointOfInterestId === feature.id);
      assert.ok(placement, `${feature.id} becomes a collectible placement`);
      assert.equal(placement.assetId, feature.asset, `${feature.id} collectible asset`);
      if (feature.weapon) {
        const weapon = Object.values(HMH_WEAPON_DEFINITIONS).find((definition) => definition.displayName === feature.weapon);
        assert.ok(weapon, `${feature.weapon} is a shipped weapon display name`);
        assert.equal(weapon.id, feature.asset, `${feature.id} names the weapon its cache holds`);
        assert.ok(briefing.supply.includes(feature.weapon), `${entry.id}: supply copy names ${feature.weapon}`);
      }
    }
  }
});

test('tips are practical one-liners chosen deterministically per seed and all reachable', () => {
  assert.ok(LEVEL_ONE_BRIEFING.tips.length >= 5);
  for (const tip of LEVEL_ONE_BRIEFING.tips) assert.ok(tip.length >= 40 && tip.length <= 120, tip);
  const seen = new Set();
  for (let seed = 0; seed < 600; seed++) {
    const tip = selectBriefingTip(seed);
    assert.equal(selectBriefingTip(seed), tip, 'same seed, same tip');
    assert.ok(LEVEL_ONE_BRIEFING.tips.includes(tip));
    seen.add(tip);
  }
  assert.equal(seen.size, LEVEL_ONE_BRIEFING.tips.length);
  assert.equal(selectBriefingTip(7, []), null);
});

test('resolveLevelBriefing returns frozen copy for real entries and null otherwise', () => {
  const resolved = resolveLevelBriefing({ entryId: 'ravine', seed: 42 });
  assert.equal(resolved.levelId, 'forked-frontier');
  assert.equal(resolved.entryId, 'ravine');
  assert.equal(resolved.objective, LEVEL_ONE_BRIEFING.entries.ravine.objective);
  assert.equal(resolved.tip, selectBriefingTip(42));
  assert.ok(Object.isFrozen(resolved));
  assert.equal(resolveLevelBriefing({ entryId: 'evidence', seed: 1 }), null);
  assert.equal(resolveLevelBriefing({ entryId: undefined, seed: 1 }), null);
  assert.equal(resolveLevelBriefing({}), null);
});

test('applyLevelBriefing fills only the present slots and tolerates a missing panel', () => {
  const nodes = Object.fromEntries(BRIEFING_SLOTS.map((slot) => [slot, { textContent: '' }]));
  const panel = { querySelector: (selector) => nodes[selector.slice('[data-briefing-'.length, -1)] ?? null };
  const briefing = resolveLevelBriefing({ entryId: 'yard', seed: 3 });
  assert.equal(applyLevelBriefing(panel, briefing), 4);
  assert.equal(nodes.objective.textContent, briefing.objective);
  assert.equal(nodes.watch.textContent, briefing.watch);
  assert.equal(nodes.supply.textContent, briefing.supply);
  assert.equal(nodes.tip.textContent, briefing.tip);
  assert.equal(applyLevelBriefing(null, briefing), 0);
  assert.equal(applyLevelBriefing(panel, null), 0);
  const partial = { querySelector: (selector) => (selector.includes('objective') ? nodes.objective : null) };
  assert.equal(applyLevelBriefing(partial, briefing), 1);
});

test('the loading panel carries the four briefing slots and the runtime fills them at session start', () => {
  const html = readFileSync(new URL('../apps/portal/hmh-reboot/index.html', import.meta.url), 'utf8');
  for (const slot of BRIEFING_SLOTS) assert.match(html, new RegExp(`<dd data-briefing-${slot}>[^<]{16,}</dd>`), `index.html default copy for ${slot}`);
  assert.match(html, /<dl class="hmh-startup-brief" aria-label="Insertion briefing">/);
  const source = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(source, /import \{ resolveLevelBriefing, applyLevelBriefing \} from '\.\/level-briefing\.mjs';/);
  assert.match(source, /applyLevelBriefing\(startupPanel, resolveLevelBriefing\(\{ entryId: runtimePlayerSpawn\.id, seed: payload\.session\.seed \}\)\);/);
  const css = readFileSync(new URL('../apps/portal/hmh-reboot/styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.hmh-startup-brief \{ display:grid;/);
  assert.match(css, /@media\(max-width:600px\)[^\n]*\.hmh-startup-brief \{ grid-template-columns:1fr;[^\n]*\.hmh-startup-brief dt \{ display:inline;/, 'phones collapse the briefing to inline labels');
});

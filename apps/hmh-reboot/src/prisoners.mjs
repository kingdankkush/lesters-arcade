// Prisoners (design package §3.5, §3.7 and §3.9; contract §4, §5.5 and §11;
// slice S1.6). Eight slots, two of each kind, dealt from the session seed by
// the shared `dealHmhPrisoners`, the same function the verifier runs on
// identity.seed. Six field cages sit at interim anchors on the shipped map; the
// two boss-held slots (the Baron's Diggings, the Foreman's Hoist Vault) wait
// for their bosses and are not placed, so their rows stay 0.
//
// A cage is a kneel channel of the mission core (90 ticks, ring 64, the
// operate spot beside the lock plate, facing east or west): stand still in the
// ring and the hero kneels at the lock; a hit pauses it, moving holds it. The
// rescue applies its kind's reward on that tick where it can be used; a Field
// Medic's or Quartermaster's remainder waits in the open cage as a station.
//
// Everything here is simulation: integer ticks, sorted ids, no clock, camera
// or quality read. The cage and the prisoner are placeholders until the S4.6
// art lands: the cage has no collider (projection only), and the prisoner is
// not drawn as an actor. It is loaded by the awaited lazy-module import before
// any session starts (main.mjs loadLazyRuntimeModules).
import { freezeDeep } from './value-guards.mjs';
import { HMH_V7_PRISONER_SLOTS, HMH_V7_RUN_RULES, dealHmhPrisoners } from '../../../sdk/hmh-run-contract-v7.mjs';
import { HMH_RUN_SUMMARY_CATALOGS_V7 } from '../../../sdk/hmh-run-summary-schema-v7.mjs';

// Owner decision 9 (package §10): the roster is approved, and prisoners wait
// for their art. Placeholder cages with no prisoner actor do not read as
// human survivors held captive (AGENTS.md: active actors must read as humans;
// no abstract proxies), so the flag defaults to dark. `?prisoners=1` turns them
// on under evidenceSafe outside Ranked for review; a Ranked run always uses
// this default.
export const PRISONERS_LIVE_DEFAULT = false;

export const PRISONER_RULES = freezeDeep({
  kneelTicks: 90,
  ringRadius: 64,
  // The remainder is handed over while the hero stands within this of the
  // open cage's operate spot.
  stationRadius: 64,
  medicPool: 50,
  quartermasterGrenades: 3,
  pawnbrokerTicks: 900,
  // Today's two timed power-ups (package §3.5), sorted by effect id.
  pawnbrokerEffects: ['berserk-candle', 'time-dilation'],
  // The open-cage fade of the placeholder, projection only.
  fadeTicks: 60,
});

// Interim anchors on the shipped map (measured by tests/hmh-prisoners.test.mjs
// against every placement rule the machines meet): the operate spot, and the
// cage 46 along its facing, lock plate towards the hero; the cage faces south.
const FIELD_CAGES = freezeDeep({
  'p1-relay-barn-yard': { x: 660, y: 3080, facing: 'east', cage: 'farm-stocks', place: 'Relay barn yard' },
  'p2-ravine-surveyor-camp': { x: 3000, y: 3950, facing: 'east', cage: 'gibbet', place: 'Ravine surveyor camp' },
  'p3-crossing-boathouse': { x: 5150, y: 1650, facing: 'east', cage: 'crate-cell', place: 'Crossing boathouse' },
  'p4-hashwood-logging-camp': { x: 6350, y: 1610, facing: 'east', cage: 'log-cage', place: 'Hashwood logging camp' },
  'p5-mining-bench': { x: 9100, y: 1470, facing: 'east', cage: 'standpipe', place: 'Mining bench' },
  'p6-yard-warehouse-compound': { x: 10830, y: 3830, facing: 'east', cage: 'chain-link-pen', place: 'Yard warehouse compound' },
});

export const PRISONER_TITLES = freezeDeep({
  'field-medic': 'Field Medic', quartermaster: 'Quartermaster', pawnbroker: 'Pawnbroker', 'og-miner': 'OG Miner',
});

// The mission-core rows for a run: the placed slots, in catalogue order, with
// the kind the seed deals them. Held slots are not placed.
export function prisonerMissionRows(seed) {
  const deal = dealHmhPrisoners(seed >>> 0);
  return freezeDeep(HMH_RUN_SUMMARY_CATALOGS_V7.prisonerSlots.flatMap((slotId, index) => {
    const cage = FIELD_CAGES[slotId];
    if (!cage || HMH_V7_PRISONER_SLOTS[slotId].heldBy) return [];
    const prisonerKind = deal[index];
    return [{
      id: slotId, objectiveClass: 'prisoner', districtId: HMH_V7_PRISONER_SLOTS[slotId].district,
      name: `${PRISONER_TITLES[prisonerKind]} (${cage.place})`, task: `Free the ${PRISONER_TITLES[prisonerKind]}`,
      kind: 'prisoner', mode: 'channel', clip: 'kneel', fillTicks: PRISONER_RULES.kneelTicks, ringRadius: PRISONER_RULES.ringRadius,
      anchor: { x: cage.x + (cage.facing === 'east' ? 46 : -46), y: cage.y }, operate: { x: cage.x, y: cage.y, facing: cage.facing },
      cage: cage.cage, prisonerKind, propBlockerId: null, requires: null, xpPerLevel: 0, effects: [],
    }];
  }));
}

// A rescue on its tick: the kind's grants that can be used now, and the
// remainder left in the open cage (the mission state's prisonerStations:
// slotId -> { kind, x, y, heal, refill, grenades }). `level` is the run level just before the
// rescue's own grant (the mission core records it as levelAtRescue).
export function rescuePrisoner(mission, row, { tick, health, maxHealth, grenades, maxGrenades, needsAmmo }) {
  const station = { kind: row.prisonerKind, x: row.operate.x, y: row.operate.y, heal: 0, refill: false, grenades: false };
  if (row.prisonerKind === 'field-medic') station.heal = PRISONER_RULES.medicPool;
  else if (row.prisonerKind === 'quartermaster') { station.refill = true; station.grenades = true; }
  else if (row.prisonerKind === 'pawnbroker') {
    return freezeDeep(PRISONER_RULES.pawnbrokerEffects.map((effectId) => ({ grant: 'timed', effectId, durationTicks: PRISONER_RULES.pawnbrokerTicks })));
  } else return freezeDeep([{ grant: 'level-span' }]);
  mission.prisonerStations.set(row.id, station);
  return dispense(mission, row.id, station, { tick, health, maxHealth, grenades, maxGrenades, needsAmmo });
}

function dispense(mission, slotId, station, { health, maxHealth, grenades, maxGrenades, needsAmmo }) {
  const grants = [];
  const missing = Math.max(0, maxHealth - health);
  if (station.heal > 0 && missing > 0) {
    const amount = Math.min(station.heal, missing);
    station.heal -= amount;
    grants.push({ grant: 'heal', amount });
  }
  if (station.refill && needsAmmo) { station.refill = false; grants.push({ grant: 'ammo' }); }
  if (station.grenades && grenades < maxGrenades) {
    station.grenades = false;
    grants.push({ grant: 'grenades', amount: PRISONER_RULES.quartermasterGrenades });
  }
  // He leaves once every part is handed over.
  if (station.heal <= 0 && !station.refill && !station.grenades) mission.prisonerStations.delete(slotId);
  return freezeDeep(grants);
}

// Each tick after the mission step: an open cage's remainder, for a hero
// standing at it who can use it. Stations are visited in slot order.
export function stepPrisonerStations(mission, { hero, health, maxHealth, grenades, maxGrenades, needsAmmo }) {
  const grants = [];
  for (const slotId of [...mission.prisonerStations.keys()].sort()) {
    const station = mission.prisonerStations.get(slotId);
    if (Math.hypot(hero.x - station.x, hero.y - station.y) > PRISONER_RULES.stationRadius) continue;
    grants.push(...dispense(mission, slotId, station, { health, maxHealth, grenades, maxGrenades, needsAmmo }));
  }
  return freezeDeep(grants);
}

// The Pawnbroker's timed power-ups go into the collectible state's active
// effects, so they read, expire and count in the summary's activeTicks exactly
// like a pickup's; they are not collectible pickups (`collected` is unchanged).
// An active effect is refreshed to max(remaining, duration), never stacked.
export function startPrisonerTimedEffect(collectibleState, { effectId, durationTicks, tick }) {
  const previous = collectibleState.activeEffects.get(effectId) ?? null;
  const expiresTick = Math.max(previous && tick < previous.expiresTick ? previous.expiresTick : 0, tick + durationTicks);
  collectibleState.activeEffects.set(effectId, freezeDeep({
    effectId,
    collectedTick: tick,
    expiresTick,
    damageMultiplier: effectId === 'berserk-candle' ? 2 : 1,
    speedMultiplier: effectId === 'time-dilation' ? 1.2 : 1,
    refreshCount: (previous?.refreshCount ?? 0) + Number(previous !== null),
  }));
  return expiresTick;
}

// The OG Miner's level span, 300 × level (the contract's constant).
export const OG_MINER_XP_PER_LEVEL = HMH_V7_RUN_RULES.OG_MINER_XP_PER_LEVEL;

// The v7 `prisoners` rows (contract §4): dense, in catalogue order.
export function prisonerRows(mission) {
  return Object.freeze(HMH_RUN_SUMMARY_CATALOGS_V7.prisonerSlots.map((slotId) => {
    const tick = mission?.rescued?.get(slotId);
    const rescued = Number.isInteger(tick);
    return Object.freeze({ slotId, rescued: rescued ? 1 : 0, tick: rescued ? tick : 0, levelAtRescue: rescued ? (mission.levels.get(slotId) ?? 0) : 0 });
  }));
}

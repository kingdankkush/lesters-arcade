// The scripted honest corpus against the v6 plausibility path (1.8.4
// consistency rules): 75 schema-6 summaries from the real 1.8.x accumulator and
// run-progression, played by five scripted pilots from every level entry
// (tests/fixtures/ranked/hmh-honest-corpus.mjs). It is a MODEL of honest play:
// the pilots move through the child's world modules, but combat is scheduled,
// not simulated, so it reaches each rule's bound on purpose rather than by
// play. The child's own summaries are the real-child corpus
// (tests/server-verify-hmh-real-corpus.test.mjs); a rule needs both green.
// No honest run may be rejected or gain a consistency flag, and the corpus must
// reach the neighbourhood of each rule, so a rule that starts to bite honest
// play fails here. The ceilings come from the child's rules
// (HMH_V6_CONSISTENCY_RULES), never from this corpus.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HMH_HONEST_PILOTS,
  buildHmhHonestCorpus,
  hmhHonestCorpusDigest,
} from './fixtures/ranked/hmh-honest-corpus.mjs';
import {
  HMH_V6_CONSISTENCY_REJECTS,
  HMH_V6_CONSISTENCY_RULES,
  hmhV6DistrictTravel,
  hmhV6HandGrenadeSupply,
  hmhV6LevelEntry,
  hmhV6MinTicksForTravel,
  hmhV6ObjectiveUnlocks,
  hmhV6PickupCapacity,
  hmhV6WeaponsWithoutSource,
  validateRebootRunPlausibility,
} from '../server/verify/hmh-plausibility.mjs';
import { HMH_RUN_SUMMARY_CATALOGS_V6, validateRunSummaryPayload } from '../sdk/hmh-run-summary-schema.mjs';
import { statsFromHmhRunSummary } from '../apps/portal/src/achievements/stats.mjs';

// Pinned: the corpus is deterministic. A change to the pilots, or to a child
// module they run (movement, dash, collectibles, sites, progression, the
// accumulator), moves it; re-pin only after the assertions below still hold.
const HMH_HONEST_CORPUS_DIGEST = '07121f5ba4c182593afafcc2fb6f5a420a2256f48e34cf0e2478b6c4fe61ec9e';
const PER_ENTRY = 3;

const corpus = buildHmhHonestCorpus({ perEntry: PER_ENTRY });
const V6C = HMH_V6_CONSISTENCY_RULES;
const row = (rows, key, id) => rows.find((entry) => entry[key] === id);
const grenadeWeaponKills = (summary) => V6C.grenadeWeapons.reduce((sum, weaponId) => sum + row(summary.kills.byWeapon, 'weaponId', weaponId).count, 0);
const pickups = (summary) => summary.collectibles.reduce((sum, entry) => sum + entry.collected, 0);
const pickupCapacity = (ticks, unlocks) => HMH_RUN_SUMMARY_CATALOGS_V6.collectibles.reduce((sum, effectId) => sum + hmhV6PickupCapacity(effectId, ticks, unlocks), 0);
const bits = (mask) => mask.toString(2).replaceAll('0', '').length;

test('the honest corpus is pinned, covers every pilot and entry, and every run is a valid schema-6 summary', () => {
  assert.equal(corpus.length, Object.keys(HMH_HONEST_PILOTS).length * 5 * PER_ENTRY);
  assert.equal(hmhHonestCorpusDigest(corpus), HMH_HONEST_CORPUS_DIGEST);
  for (const pilot of Object.keys(HMH_HONEST_PILOTS)) {
    const entries = new Set(corpus.filter((run) => run.pilot === pilot).map((run) => hmhV6LevelEntry(run.seed).id));
    assert.equal(entries.size, 5, pilot);
  }
  for (const { name, runSummary } of corpus) {
    assert.equal(validateRunSummaryPayload(runSummary), '', name);
    assert.equal(runSummary.schemaVersion, 6);
    assert.doesNotThrow(() => statsFromHmhRunSummary(runSummary), name);
  }
});

test('no honest run is rejected, and none gains a consistency flag', (t) => {
  const verdicts = {};
  for (const { name, runSummary } of corpus) {
    const result = validateRebootRunPlausibility(runSummary);
    assert.notEqual(result.verdict, 'rejected', `${name}: ${JSON.stringify(result.flags)}`);
    assert.deepEqual(result.flags.filter((flag) => HMH_V6_CONSISTENCY_REJECTS.includes(flag.id)), [], name);
    verdicts[result.verdict] = (verdicts[result.verdict] ?? 0) + 1;
  }
  t.diagnostic(`verdicts ${JSON.stringify(verdicts)}`);
});

test('grenade kills: every honest run has exactly its grenade weapons\' kills, and the grenadier piles them up', (t) => {
  for (const { name, runSummary } of corpus) assert.equal(runSummary.grenades.kills, grenadeWeaponKills(runSummary), name);
  const most = Math.max(...corpus.map(({ runSummary }) => runSummary.grenades.kills));
  assert.ok(most >= 80, `the most grenade kills in one run: ${most}`);
  for (const weaponId of V6C.grenadeWeapons) {
    assert.ok(corpus.some(({ runSummary }) => row(runSummary.kills.byWeapon, 'weaponId', weaponId).count > 0), weaponId);
  }
  t.diagnostic(`most grenade kills in one run: ${most}`);
});

test('pickups: no honest run passes an effect\'s capacity, and the hoarder collects most of what the run can give', (t) => {
  let fullest = 0;
  let atCapacity = 0;
  let gatedAtCapacity = 0;
  let sitesOperated = 0;
  let vaults = 0;
  for (const { name, runSummary } of corpus) {
    const ticks = runSummary.totals.survivalTicks;
    // The capacity counts only the objective rewards the run's own milestones
    // and Liquidator kill unlock, from their ticks (the second 1.8.4 round).
    const unlocks = hmhV6ObjectiveUnlocks(runSummary);
    sitesOperated += runSummary.milestones.sites.filter((entry) => entry.operated === 1).length;
    if (Object.hasOwn(unlocks, V6C.vaultObjective)) vaults += 1;
    for (const entry of runSummary.collectibles) {
      const capacity = hmhV6PickupCapacity(entry.effectId, ticks, unlocks);
      assert.ok(entry.collected <= capacity, `${name}: ${entry.effectId} ${entry.collected} > ${capacity}`);
      if (entry.collected > 0 && entry.collected === capacity) {
        atCapacity += 1;
        if (V6C.pickupPlacements[entry.effectId].some(([, unlock]) => typeof unlock === 'string')) gatedAtCapacity += 1;
      }
    }
    fullest = Math.max(fullest, pickups(runSummary) / pickupCapacity(ticks, unlocks));
  }
  assert.ok(fullest >= 0.85, `the fullest run collected ${fullest} of its capacity`);
  assert.ok(atCapacity >= 20, `effects collected up to their exact capacity: ${atCapacity}`);
  assert.ok(gatedAtCapacity >= 20, `effects with a site reward collected up to their exact capacity: ${gatedAtCapacity}`);
  assert.ok(sitesOperated >= 100 && vaults >= 5, `sites operated ${sitesOperated}, vaults unlocked ${vaults}`);
  t.diagnostic(`fullest run: ${(fullest * 100).toFixed(1)}% of the pickup capacity; effect rows at capacity: ${atCapacity} (${gatedAtCapacity} with a site reward); sites operated: ${sitesOperated}; vaults: ${vaults}`);
});

test('ticks, weapons, grenade trail, damage and combo: every honest run meets each second-round rule, most at its bound', (t) => {
  let thrownAtSupply = 0;
  let comboAtKills = 0;
  let mostWeapons = 0;
  for (const { name, runSummary } of corpus) {
    const { totals, kills, weapons, grenades } = runSummary;
    // The pilots record every tick, as the child does.
    assert.equal(weapons.reduce((sum, entry) => sum + entry.equippedTicks, 0), totals.survivalTicks, name);
    assert.deepEqual(hmhV6WeaponsWithoutSource(runSummary), [], name);
    mostWeapons = Math.max(mostWeapons, weapons.filter((entry) => entry.equippedTicks > 0).length);
    // The pilot blasts like the child: one contact per victim and one
    // detonation per throw or launcher shot, so both hold with equality.
    assert.equal(grenades.kills, grenades.contacts, name);
    assert.equal(grenades.detonated, grenades.thrown + row(weapons, 'weaponId', V6C.launcherWeapon).triggers, name);
    const supply = hmhV6HandGrenadeSupply(runSummary);
    assert.ok(grenades.thrown <= supply, `${name}: ${grenades.thrown} > ${supply}`);
    if (grenades.thrown === supply) thrownAtSupply += 1;
    assert.equal(totals.damageDealt, weapons.reduce((sum, entry) => sum + entry.damage, 0), name);
    assert.ok(totals.maxCombo <= kills.total, name);
    if (totals.maxCombo === kills.total && kills.total > 0) comboAtKills += 1;
  }
  assert.ok(thrownAtSupply >= 5, `runs that threw every hand grenade they had: ${thrownAtSupply}`);
  assert.ok(comboAtKills >= 1, 'some run never broke its combo');
  assert.ok(mostWeapons >= 5, `the most weapons equipped in one run: ${mostWeapons}`);
  t.diagnostic(`runs at the hand-grenade supply: ${thrownAtSupply}; runs whose best combo is every kill: ${comboAtKills}; most weapons in one run: ${mostWeapons}`);
});

test('districts: every honest run visits one run of strips around its entry, within the travel budget', (t) => {
  let tightest = 0;
  let fastestFullMap = Infinity;
  for (const { name, seed, runSummary, maxStepPx } of corpus) {
    const mask = runSummary.exploration.visitedDistrictMask;
    const travel = hmhV6DistrictTravel(seed, mask);
    assert.equal(travel.pathValid, true, `${name}: mask ${mask}`);
    assert.ok(runSummary.totals.survivalTicks >= hmhV6MinTicksForTravel(travel.travelPx), name);
    tightest = Math.max(tightest, travel.travelPx / (runSummary.totals.survivalTicks * V6C.travel.maxStepPx + V6C.travel.allowancePx));
    if (bits(mask) === 6) fastestFullMap = Math.min(fastestFullMap, runSummary.totals.survivalTicks);
    // The pilots move through the child's own movement and dash code at the
    // run's multipliers; the budget is twice their longest single tick.
    assert.ok(maxStepPx <= V6C.travel.maxStepPx / 2 + 1e-6, `${name}: ${maxStepPx}`);
  }
  for (const entry of V6C.levelEntries.map(([id]) => id)) {
    assert.ok(corpus.some(({ seed, runSummary }) => hmhV6LevelEntry(seed).id === entry && runSummary.exploration.visitedDistrictMask === 63), `a full-map run from ${entry}`);
  }
  assert.ok(Math.max(...corpus.map(({ maxStepPx }) => maxStepPx)) > V6C.travel.maxStepPx / 2 - 1e-6, 'some pilot dashed');
  t.diagnostic(`tightest travel: ${(tightest * 100).toFixed(1)}% of the budget; fastest full-map run: ${fastestFullMap} ticks`);
});

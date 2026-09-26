// Progression release (design package S1.3, section 8.2 and 8.3): the twelve
// gun-branch cards, the two-card offer (card 1 general, card 2 "your gun"),
// one re-roll per card per offer, the focus gun, and the v7 counters the run
// summary needs (offersOpened, rerolls, offered and selected per card).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  CARD_TWO_GUN_ORDER,
  HMH_CARD_TWO_INTERVAL,
  RUN_UPGRADE_CATALOG,
  createRunProgression,
  getRunProgressionSnapshot,
  grantRunXp,
  openRunUpgradeOffer,
  rerollRunUpgradeSlot,
  runProgressionRow,
  runUpgradeRows,
  runWeaponMastery,
  selectRunUpgrade,
  setRunUpgradeFocus,
  unlockRunProgressionWeapon,
} from '../apps/hmh-reboot/src/run-progression.mjs';
import { HMH_WEAPON_ORDER, progressionByWeapon } from '../apps/hmh-reboot/src/weapon-system.mjs';
import { HMH_V7_UPGRADES } from '../sdk/hmh-run-contract-v7.mjs';
import {
  HMH_RUN_SUMMARY_CATALOGS_V7,
  HMH_V7_PROGRESSION_FIELDS,
  validateRunSummaryPayload,
} from '../sdk/hmh-run-summary-schema-v7.mjs';

const GUN_CARDS = Object.freeze({
  'scatter-shotgun': ['scatter-pump', 'scatter-dump', 'scatter-shells'],
  'auto-miner': ['miner-hashrate', 'miner-asic', 'miner-pool'],
  'hash-rail': ['rail-blocktime', 'rail-proof', 'rail-mempool'],
  'launcher-rig': ['launcher-airdrop', 'launcher-yield', 'launcher-bandolier'],
});

// One pending level at a time, like the runtime: XP up to the next threshold.
function levelUp(state) {
  const before = state.level;
  while (state.level === before) grantRunXp(state, 40, 1);
}

test('the catalogue holds the 36 v7 upgrade ids in v7 catalogue order with the contract ranks and gates', () => {
  assert.deepEqual(Object.keys(RUN_UPGRADE_CATALOG), [...HMH_RUN_SUMMARY_CATALOGS_V7.upgrades]);
  for (const [id, upgrade] of Object.entries(RUN_UPGRADE_CATALOG)) {
    assert.equal(upgrade.maxRank, HMH_V7_UPGRADES[id].maxRank, id);
    assert.equal(upgrade.requiresWeaponId ?? null, HMH_V7_UPGRADES[id].requiresWeaponId, id);
  }
  for (const [weaponId, ids] of Object.entries(GUN_CARDS)) {
    for (const id of ids) {
      const upgrade = RUN_UPGRADE_CATALOG[id];
      assert.equal(upgrade.branch, weaponId, id);
      assert.equal(upgrade.repeatable, undefined, id);
      assert.ok(!['xpMultiplier', 'scoreMultiplier'].includes(upgrade.effect), `${id} has no XP or score effect (contract 5.6)`);
    }
  }
});

test('card 2 walks the simulation weapon order after the focus gun, never the Pistol', () => {
  assert.deepEqual([...CARD_TWO_GUN_ORDER], HMH_WEAPON_ORDER.filter((id) => id !== 'coin-blaster'));
});

test('the twelve cards feed the four dead gun trees through progressionByWeapon', () => {
  const ranks = Object.fromEntries(Object.values(GUN_CARDS).flat().map((id, index) => [id, (index % 3) + 1]));
  const mapped = progressionByWeapon(ranks);
  for (const [weaponId, [rateOfFire, damage, reloadSpeed]] of Object.entries(GUN_CARDS)) {
    assert.deepEqual(mapped[weaponId].branches, { rateOfFire: ranks[rateOfFire], damage: ranks[damage], reloadSpeed: ranks[reloadSpeed] }, weaponId);
  }
});

test('card 2 offers the focus gun: a newly picked-up gun becomes the focus, the Pistol never does', () => {
  const state = createRunProgression({ seed: 21 });
  unlockRunProgressionWeapon(state, 'scatter-shotgun');
  assert.equal(state.focusWeaponId, 'scatter-shotgun');
  unlockRunProgressionWeapon(state, 'scatter-shotgun');
  assert.equal(state.focusWeaponId, 'scatter-shotgun', 'a repeat pickup changes nothing');
  unlockRunProgressionWeapon(state, 'hash-rail');
  assert.equal(state.focusWeaponId, 'hash-rail', 'the last newly picked-up gun');
  setRunUpgradeFocus(state, 'coin-blaster');
  assert.equal(state.focusWeaponId, 'hash-rail', 'selecting the Pistol by hand never moves the focus');
  setRunUpgradeFocus(state, 'auto-miner');
  assert.equal(state.focusWeaponId, 'hash-rail', 'an unowned gun cannot be the focus');
  setRunUpgradeFocus(state, 'scatter-shotgun');
  assert.equal(state.focusWeaponId, 'scatter-shotgun');

  for (let offer = 0; offer < 9; offer += 1) {
    levelUp(state);
    const choices = openRunUpgradeOffer(state, { armedWeaponIds: ['scatter-shotgun', 'hash-rail'] });
    assert.equal(choices.length, 2);
    assert.deepEqual(choices.map((choice) => choice.slot), [0, 1]);
    const card2 = choices[1];
    assert.equal(card2.weaponId, 'scatter-shotgun', `offer ${offer}: card 2 is the focus gun`);
    assert.equal(RUN_UPGRADE_CATALOG[card2.id].requiresWeaponId, 'scatter-shotgun');
    assert.notEqual(choices[0].id, card2.id);
    selectRunUpgrade(state, card2.id);
  }
  // Nine picks master the Shotgun; the next card 2 moves to the next candidate.
  assert.deepEqual(GUN_CARDS['scatter-shotgun'].map((id) => state.ranks[id]), [3, 3, 3]);
  levelUp(state);
  const next = openRunUpgradeOffer(state, { armedWeaponIds: ['scatter-shotgun', 'hash-rail'] });
  assert.equal(next[1].weaponId, 'hash-rail');
});

test('candidates skip guns without ammo and fall back to a general draw', () => {
  const state = createRunProgression({ seed: 5 });
  unlockRunProgressionWeapon(state, 'auto-miner');
  unlockRunProgressionWeapon(state, 'forked-standard');
  setRunUpgradeFocus(state, 'auto-miner');
  levelUp(state);
  // The loadout arms the War Fork always (weaponIdsWithAmmo); the dry Machine
  // Gun, although it is the focus, is skipped.
  const dry = openRunUpgradeOffer(state, { armedWeaponIds: ['forked-standard'] });
  assert.equal(dry[1].weaponId, 'forked-standard');
  selectRunUpgrade(state, dry[0].id);
  const pistolOnly = createRunProgression({ seed: 5 });
  unlockRunProgressionWeapon(pistolOnly, 'auto-miner');
  levelUp(pistolOnly);
  const general = openRunUpgradeOffer(pistolOnly, { armedWeaponIds: ['coin-blaster'] });
  assert.equal(general.length, 2);
  assert.equal(general[1].weaponId, null, 'a dry Machine Gun leaves card 2 a second general draw');
  assert.ok(general.every((choice) => RUN_UPGRADE_CATALOG[choice.id].requiresWeaponId !== 'coin-blaster'));
});

test('one re-roll per card per offer; a shown card never returns; card 2 walks its gun, then the next gun, then the general pool', () => {
  const state = createRunProgression({ seed: 99 });
  unlockRunProgressionWeapon(state, 'launcher-rig');
  unlockRunProgressionWeapon(state, 'hash-rail');
  setRunUpgradeFocus(state, 'launcher-rig');
  // Leave one Launcher card: card 2 re-rolls onto the next candidate gun.
  state.ranks['launcher-airdrop'] = 3;
  state.ranks['launcher-yield'] = 3;
  levelUp(state);
  const opened = openRunUpgradeOffer(state, { armedWeaponIds: ['launcher-rig', 'hash-rail'] });
  assert.equal(opened[1].id, 'launcher-bandolier');
  assert.equal(opened[1].rerollState, 'ready');
  const rerolled = rerollRunUpgradeSlot(state, 1);
  assert.equal(rerolled.weaponId, 'hash-rail');
  assert.ok(GUN_CARDS['hash-rail'].includes(rerolled.id));
  assert.equal(rerolled.rerollState, 'used');
  assert.equal(rerollRunUpgradeSlot(state, 1), null, 'the strip is spent for this offer');
  const card1Before = getRunProgressionSnapshot(state).pendingChoices[0].id;
  const card1 = rerollRunUpgradeSlot(state, 0);
  assert.ok(card1);
  const shown = new Set([opened[0].id, opened[1].id, rerolled.id]);
  assert.ok(!shown.has(card1.id), 'a shown card never comes back in the same offer');
  assert.notEqual(card1.id, card1Before);
  const snapshot = getRunProgressionSnapshot(state);
  assert.deepEqual(snapshot.pendingChoices.map((choice) => choice.id), [card1.id, rerolled.id]);
  assert.equal(snapshot.rerolls, 2);
  assert.equal(snapshot.offersOpened, 1);
  // A re-roll never selects or closes the offer.
  assert.equal(snapshot.pendingLevels, 1);
  assert.throws(() => selectRunUpgrade(state, 'launcher-bandolier'), /not currently offered/);
  selectRunUpgrade(state, rerolled.id);
  assert.equal(getRunProgressionSnapshot(state).pendingChoices.length, 0);
  // The next offer has fresh re-rolls.
  levelUp(state);
  const fresh = openRunUpgradeOffer(state, { armedWeaponIds: ['launcher-rig', 'hash-rail'] });
  assert.ok(fresh.every((choice) => choice.rerollState === 'ready'));
});

test('an exhausted strip reads none, spends nothing and counts nothing', () => {
  const state = createRunProgression({ seed: 3 });
  // Only two cards left anywhere: both shown, nothing to re-roll into.
  for (const upgrade of Object.values(RUN_UPGRADE_CATALOG)) state.ranks[upgrade.id] = upgrade.maxRank;
  state.ranks['compound-interest'] = 24;
  state.ranks['layer-two'] = 24;
  levelUp(state);
  const choices = openRunUpgradeOffer(state, { armedWeaponIds: [] });
  assert.deepEqual(choices.map((choice) => choice.id).sort(), ['compound-interest', 'layer-two']);
  assert.ok(choices.every((choice) => choice.rerollState === 'none'));
  assert.equal(rerollRunUpgradeSlot(state, 0), null);
  assert.equal(rerollRunUpgradeSlot(state, 1), null);
  assert.equal(state.rerolls, 0);
});

test('offers are a pure function of the progression state: the same seed and inputs give the same offers and re-rolls', () => {
  const run = () => {
    const state = createRunProgression({ seed: 0xabcdef });
    unlockRunProgressionWeapon(state, 'scatter-shotgun');
    const log = [];
    for (let offer = 0; offer < 12; offer += 1) {
      levelUp(state);
      const choices = openRunUpgradeOffer(state, { armedWeaponIds: ['scatter-shotgun'] });
      log.push(choices.map((choice) => choice.id).join('|'));
      if (offer % 3 === 0) log.push(rerollRunUpgradeSlot(state, offer % 2)?.id ?? '-');
      selectRunUpgrade(state, getRunProgressionSnapshot(state).pendingChoices[offer % 2].id);
    }
    return log;
  };
  assert.deepEqual(run(), run());
  const seeds = new Set(Array.from({ length: 12 }, (_, seed) => {
    const state = createRunProgression({ seed });
    levelUp(state);
    return openRunUpgradeOffer(state, {}).map((choice) => choice.id).join('|');
  }));
  assert.ok(seeds.size > 1, 'the seed drives the draw');
  const source = readFileSync(new URL('../apps/hmh-reboot/src/run-progression.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /nextRandom|Math\.random/, 'menu use cannot touch the simulation RNG (package 8.3)');
  assert.match(source, /offer:\$\{/, 'the package 8.3 salt');
});

test('the preview equals the offer the runtime opens with every owned gun armed, and selecting opens it implicitly', () => {
  const state = createRunProgression({ seed: 404 });
  unlockRunProgressionWeapon(state, 'hash-rail');
  levelUp(state);
  const preview = getRunProgressionSnapshot(state).pendingChoices.map((choice) => choice.id);
  assert.equal(state.offersOpened, 0, 'a preview opens nothing');
  const twin = createRunProgression({ seed: 404 });
  unlockRunProgressionWeapon(twin, 'hash-rail');
  levelUp(twin);
  assert.deepEqual(openRunUpgradeOffer(twin, {}).map((choice) => choice.id), preview);
  assert.equal(openRunUpgradeOffer(twin, {}), null, 'an open offer is opened once');
  selectRunUpgrade(state, preview[1]);
  assert.equal(state.offersOpened, 1);
  assert.equal(state.selectionSequence, 1);
});

test('the card 2 fallback interval draws card 2 from the focus gun on every second offer only', () => {
  assert.equal(HMH_CARD_TWO_INTERVAL, 1, 'the harness keeps card 2 on every level');
  const state = createRunProgression({ seed: 8, cardTwoInterval: 2 });
  unlockRunProgressionWeapon(state, 'auto-miner');
  const focusByOffer = [];
  for (let offer = 0; offer < 6; offer += 1) {
    levelUp(state);
    const choices = openRunUpgradeOffer(state, { armedWeaponIds: ['auto-miner'] });
    focusByOffer.push(choices[1].weaponId);
    selectRunUpgrade(state, choices[0].id);
  }
  assert.deepEqual(focusByOffer.map((id, index) => (index % 2 === 0 ? id === 'auto-miner' : id === null)), Array(6).fill(true));
});

test('runWeaponMastery counts a gun branch chip: 9 ranks for a finite gun, 10 with a capstone', () => {
  const ranks = { 'scatter-pump': 2, 'scatter-dump': 1, 'scatter-shells': 1, 'ledger-voltage': 3, 'proof-of-network': 1 };
  assert.deepEqual(runWeaponMastery(ranks, 'scatter-shotgun'), { ranks: 4, total: 9 });
  assert.deepEqual(runWeaponMastery(ranks, 'lightning-ledger'), { ranks: 4, total: 10 });
});

test('the v7 upgrade and progression rows satisfy schema rules S13-S15 and S18 on a real payload', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/ranked/hmh-v7-districts.json', import.meta.url), 'utf8')).body.evidence.runSummary;
  const state = createRunProgression({ seed: fixture.identity.seed });
  // The fixture's run owns the Railgun and the Arc Rifle.
  unlockRunProgressionWeapon(state, 'hash-rail');
  unlockRunProgressionWeapon(state, 'lightning-ledger');
  let pick = 0;
  while (state.level < fixture.totals.level) {
    grantRunXp(state, 40, 1);
    while (state.pendingLevels > 0) {
      const choices = openRunUpgradeOffer(state, { armedWeaponIds: ['hash-rail', 'lightning-ledger'] });
      if (!choices) break;
      if (pick % 2 === 0) rerollRunUpgradeSlot(state, 1);
      if (pick % 3 === 0) rerollRunUpgradeSlot(state, 0);
      const current = getRunProgressionSnapshot(state).pendingChoices;
      selectRunUpgrade(state, current[pick % current.length].id);
      pick += 1;
    }
  }
  assert.equal(state.level, fixture.totals.level);
  const upgrades = runUpgradeRows(state);
  assert.deepEqual(upgrades.map((row) => row.upgradeId), [...HMH_RUN_SUMMARY_CATALOGS_V7.upgrades]);
  const progression = runProgressionRow(state, { revivesUsed: 0 });
  assert.deepEqual(Object.keys(progression), [...HMH_V7_PROGRESSION_FIELDS]);
  assert.ok(progression.rerolls > 0 && progression.offersOpened === fixture.totals.level - 1);
  assert.equal(upgrades.reduce((sum, row) => sum + row.offered, 0), 2 * progression.offersOpened + progression.rerolls);
  const payload = { ...fixture, upgrades, progression: { ...fixture.progression, offersOpened: progression.offersOpened, rerolls: progression.rerolls } };
  assert.equal(validateRunSummaryPayload(payload), '');
  // The same rows with a re-roll the counters never saw are refused (S15).
  const inflated = upgrades.map((row) => (row.upgradeId === 'diamond-hands' ? { ...row, offered: row.offered + 1 } : row));
  assert.match(validateRunSummaryPayload({ ...payload, upgrades: inflated }), /offered cards are inconsistent/);
  // Selecting a card that was never counted as offered would break S15 and selected <= offered.
  assert.ok(upgrades.every((row) => row.selected <= row.offered && row.offered <= progression.offersOpened));
});

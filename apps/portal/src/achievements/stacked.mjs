// STACKED achievement catalog (gameId 'stacked', contract §6.1): 40 entries,
// 14 bronze, 12 silver, 9 gold, 5 platinum. Criteria read only the replayed
// result tuple through statsFromStackedTuple (§6.3) plus verified history (§6.5):
// no singles/doubles/triples, spin clears, stack height or zone snapshots.
// Line, level, survival, score, piece and garbage thresholds come from the
// throttled soak-pilot profiles in tests/fixtures/achievements/stacked-calibration.json;
// Halving, spin, perfect-clear, combo and back-to-back thresholds are anchored on
// the Free medals (apps/stacked/src/free-medals.mjs), because the pilot never
// sets those up. Sources per entry: docs/game-design/achievement-catalogs-20260923.md.
import { best, defineCatalog, runs, total } from './entry.mjs';

const minutes = (n) => best('survivalSeconds', n * 60);

const specs = [
  { id: 'stacked-first-line', title: 'Genesis Row', tier: 'bronze', category: 'lines', description: 'Cleared your first row in a Ranked run.', rule: best('lines', 1) },
  { id: 'stacked-level-2', title: 'Block Height 2', tier: 'bronze', category: 'level', description: 'Reached level 2 in one Ranked run.', rule: best('level', 2) },
  { id: 'stacked-lines-25', title: 'Twenty-Five Rows', tier: 'bronze', category: 'lines', description: 'Cleared 25 rows in one Ranked run.', rule: best('lines', 25) },
  { id: 'stacked-lines-total-100', title: 'Hundred-Row Ledger', tier: 'bronze', category: 'lines', description: 'Cleared 100 rows in total across Ranked runs.', rule: total('lines', 100) },
  { id: 'stacked-first-halving', title: 'First Halving', tier: 'bronze', category: 'halving', description: 'Cleared four rows with one piece (a Halving) in a Ranked run.', rule: best('quadClears', 1) },
  { id: 'stacked-halvings-total-5', title: 'Halving Habit', tier: 'bronze', category: 'halving', description: 'Made 5 Halvings in total across Ranked runs.', rule: total('quadClears', 5) },
  { id: 'stacked-first-spin-lock', title: 'First Spin', tier: 'bronze', category: 'spin', description: 'Locked a piece with a spin in a Ranked run.', rule: best('spins', 1) },
  { id: 'stacked-first-hold', title: 'Cold Storage', tier: 'bronze', category: 'hold', description: 'Put a piece on Hold in a Ranked run.', rule: best('holdsUsed', 1) },
  { id: 'stacked-chain-2', title: 'Chain Starter', tier: 'bronze', category: 'combo', description: 'Reached a combo of 2 (3 clearing pieces in a row) in one Ranked run.', rule: best('maxCombo', 2) },
  { id: 'stacked-pieces-100', title: 'Hundred Blocks', tier: 'bronze', category: 'pieces', description: 'Placed 100 pieces in one Ranked run.', rule: best('pieces', 100) },
  { id: 'stacked-survive-2m', title: 'Two-Minute Stack', tier: 'bronze', category: 'survival', description: 'Survived 2 minutes in one Ranked run.', rule: minutes(2) },
  { id: 'stacked-score-20k', title: '20K Block', tier: 'bronze', category: 'score', description: 'Scored 20,000 points in one Ranked run.', rule: best('score', 20_000) },
  { id: 'stacked-garbage-2', title: 'Mempool Spill', tier: 'bronze', category: 'garbage', description: 'Took 2 garbage rows in one Ranked run.', rule: best('garbageRowsReceived', 2) },
  { id: 'stacked-runs-5', title: 'Regular Stacker', tier: 'bronze', category: 'volume', description: 'Finished 5 verified Ranked runs.', rule: runs(5) },

  { id: 'stacked-level-10', title: 'Block Height 10', tier: 'silver', category: 'level', description: 'Reached level 10 in one Ranked run.', rule: best('level', 10) },
  { id: 'stacked-lines-100', title: 'Hundred Rows', tier: 'silver', category: 'lines', description: 'Cleared 100 rows in one Ranked run.', rule: best('lines', 100) },
  { id: 'stacked-lines-total-1000', title: 'Row Miner', tier: 'silver', category: 'lines', description: 'Cleared 1,000 rows in total across Ranked runs.', rule: total('lines', 1000) },
  { id: 'stacked-halvings-3', title: 'Triple Halving', tier: 'silver', category: 'halving', description: 'Made 3 Halvings in one Ranked run.', rule: best('quadClears', 3) },
  { id: 'stacked-first-perfect-clear', title: 'Clean Books', tier: 'silver', category: 'perfect-clear', description: 'Emptied the whole board (a perfect clear) in a Ranked run.', rule: best('perfectClears', 1) },
  { id: 'stacked-spins-10', title: 'Spin Doctor', tier: 'silver', category: 'spin', description: 'Locked 10 pieces with a spin in one Ranked run.', rule: best('spins', 10) },
  { id: 'stacked-chain-5', title: 'Five-Link Chain', tier: 'silver', category: 'combo', description: 'Reached a combo of 5 (6 clearing pieces in a row) in one Ranked run.', rule: best('maxCombo', 5) },
  { id: 'stacked-b2b-streak-2', title: 'Back-to-Back', tier: 'silver', category: 'back-to-back', description: 'Made two difficult clears (Halvings or spin clears) back to back.', rule: best('maxBackToBack', 2) },
  { id: 'stacked-survive-4m', title: 'Four-Minute Stack', tier: 'silver', category: 'survival', description: 'Survived 4 minutes in one Ranked run.', rule: minutes(4) },
  { id: 'stacked-score-100k', title: '100K Block', tier: 'silver', category: 'score', description: 'Scored 100,000 points in one Ranked run.', rule: best('score', 100_000) },
  { id: 'stacked-garbage-5', title: 'Garbage Day', tier: 'silver', category: 'garbage', description: 'Took 5 garbage rows in one Ranked run.', rule: best('garbageRowsReceived', 5) },
  { id: 'stacked-runs-25', title: 'Veteran Stacker', tier: 'silver', category: 'volume', description: 'Finished 25 verified Ranked runs.', rule: runs(25) },

  { id: 'stacked-level-20', title: 'Block Height 20', tier: 'gold', category: 'level', description: 'Reached level 20 in one Ranked run.', rule: best('level', 20) },
  { id: 'stacked-lines-300', title: 'Three Hundred Rows', tier: 'gold', category: 'lines', description: 'Cleared 300 rows in one Ranked run.', rule: best('lines', 300) },
  { id: 'stacked-halvings-10', title: 'Halving Cycle', tier: 'gold', category: 'halving', description: 'Made 10 Halvings in one Ranked run.', rule: best('quadClears', 10) },
  { id: 'stacked-perfect-clears-3', title: 'Audited Thrice', tier: 'gold', category: 'perfect-clear', description: 'Made 3 perfect clears in one Ranked run.', rule: best('perfectClears', 3) },
  { id: 'stacked-spins-25', title: 'Torque Master', tier: 'gold', category: 'spin', description: 'Locked 25 pieces with a spin in one Ranked run.', rule: best('spins', 25) },
  { id: 'stacked-chain-10', title: 'Ten-Link Chain', tier: 'gold', category: 'combo', description: 'Reached a combo of 10 (11 clearing pieces in a row) in one Ranked run.', rule: best('maxCombo', 10) },
  { id: 'stacked-b2b-streak-5', title: 'Difficulty Spike', tier: 'gold', category: 'back-to-back', description: 'Made 5 difficult clears (Halvings or spin clears) back to back.', rule: best('maxBackToBack', 5) },
  { id: 'stacked-survive-7m', title: 'Hashrate Forge', tier: 'gold', category: 'survival', description: 'Survived 7 minutes and reached the Hashrate Forge zone.', rule: minutes(7) },
  { id: 'stacked-score-500k', title: 'Half-Million Block', tier: 'gold', category: 'score', description: 'Scored 500,000 points in one Ranked run.', rule: best('score', 500_000) },

  { id: 'stacked-lines-1000', title: 'Thousand-Row Run', tier: 'platinum', category: 'lines', nft: true, description: 'Cleared 1,000 rows in one Ranked run.', rule: best('lines', 1000) },
  { id: 'stacked-survive-17m', title: 'Lattice Survivor', tier: 'platinum', category: 'survival', nft: true, description: 'Survived 17 minutes, deep in the Scrypt Lattice zone.', rule: minutes(17) },
  { id: 'stacked-score-4250k', title: 'Whale Stack', tier: 'platinum', category: 'score', nft: true, description: 'Scored 4,250,000 points in one Ranked run.', rule: best('score', 4_250_000) },
  { id: 'stacked-garbage-100', title: 'Garbage Collector', tier: 'platinum', category: 'garbage', nft: true, description: 'Took 100 garbage rows in one Ranked run and kept stacking.', rule: best('garbageRowsReceived', 100) },
  { id: 'stacked-b2b-streak-10', title: 'Unbroken Chain', tier: 'platinum', category: 'back-to-back', nft: true, description: 'Made 10 difficult clears (Halvings or spin clears) back to back.', rule: best('maxBackToBack', 10) },
];

const catalog = defineCatalog('stacked', specs, ({ tier }) => ({
  image: `/assets/generated/achievement-badges/stacked/${tier}.png`,
  lockedImage: `/assets/generated/achievement-badges/stacked/locked-${tier}.png`,
}));
export const STACKED_ACHIEVEMENTS = catalog.entries;
export const STACKED_HISTORY_FIELDS = catalog.historyFields;

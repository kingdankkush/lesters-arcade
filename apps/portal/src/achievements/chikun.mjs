// Chikun's Escape achievement catalog (gameId 'chikun', contract §6.1): 40 entries,
// 14 bronze, 11 silver, 9 gold, 6 platinum. Owner checkpoint O1 (2026-09-23) moved
// chikun-survive-6m silver->gold and chikun-survive-12m gold->platinum to match the
// difficulty harness; chikun-survive-12m is platinum but not an NFT candidate. Criteria read statsFromChikunResult
// (§6.3) of a replay-verified v6 run plus verified history (§6.5).
// Thresholds come from docs/qa/chikun-difficulty-harness-20260923.json and the
// near-miss-chasing sample in tests/fixtures/achievements/chikun-skim-calibration.json;
// the percentile behind each one is recorded in
// docs/game-design/achievement-catalogs-20260923.md.
// The four runtime ids of chikun-cabinet.mjs (result.achievements) are reused as
// bronze entries: first-flight, stack-three and fork-runner keep their thresholds;
// thread-needle is not reused because its 3 near misses sit above the novice median.
import { best, defineCatalog, runs, statAt, total, when } from './entry.mjs';

// Regions after farmland, in course order (chikun-course-regions.mjs CHIKUN_REGIONS).
export const CHIKUN_REGION_IDS = Object.freeze(['farmland', 'forest', 'town', 'city', 'industrial', 'suburbs', 'coast']);

// Reached when the run passed an obstacle in that region or finished a loop.
// Progress: a finished loop anywhere means every region, else the furthest loop-0 region.
const reach = (index) => when((s) => s.laps >= 1 || s.regionIndexReached >= index, {
  max: ['laps', 'regionIndexReached'],
  progress: (run, history) => {
    const laps = Math.max(statAt(history?.maxima, 'laps'), run ? statAt(run.stats, 'laps') : 0);
    const region = Math.max(statAt(history?.maxima, 'regionIndexReached'), run ? statAt(run.stats, 'regionIndexReached') : 0);
    return { current: Math.min(index, laps >= 1 ? CHIKUN_REGION_IDS.length - 1 : region), target: index };
  },
});
const minutes = (n) => best('survivalSeconds', n * 60);

const specs = [
  { id: 'chikun-first-flight', title: 'First Flight', tier: 'bronze', category: 'survival', description: 'Took off and survived the first 10 ticks of a Ranked run.', rule: best('survivalTicks', 10) },
  { id: 'chikun-stack-three', title: 'Stack Three', tier: 'bronze', category: 'coins', description: 'Collected 3 Litecoin in one Ranked run.', rule: best('coinsCollected', 3) },
  { id: 'chikun-fork-runner', title: 'Fork Runner', tier: 'bronze', category: 'forks', description: 'Passed 5 obstacles in one Ranked run.', rule: best('forksPassed', 5) },
  { id: 'chikun-reach-forest', title: 'Into the Forest', tier: 'bronze', category: 'region', description: 'Flew out of the Farmland and reached the Forest.', rule: reach(1) },
  { id: 'chikun-reach-town', title: 'Town Crossing', tier: 'bronze', category: 'region', description: 'Reached the Town in one Ranked run.', rule: reach(2) },
  { id: 'chikun-reach-city', title: 'City Lights', tier: 'bronze', category: 'region', description: 'Reached the City in one Ranked run.', rule: reach(3) },
  { id: 'chikun-reach-industrial', title: 'Smokestack Run', tier: 'bronze', category: 'region', description: 'Reached the Industrial zone in one Ranked run.', rule: reach(4) },
  { id: 'chikun-reach-suburbs', title: 'Suburban Sprint', tier: 'bronze', category: 'region', description: 'Reached the Suburbs in one Ranked run.', rule: reach(5) },
  { id: 'chikun-survive-2m', title: 'Two-Minute Flight', tier: 'bronze', category: 'survival', description: 'Survived 2 minutes in one Ranked run.', rule: minutes(2) },
  { id: 'chikun-coins-40', title: 'Coin Purse', tier: 'bronze', category: 'coins', description: 'Collected 40 Litecoin in one Ranked run.', rule: best('coinsCollected', 40) },
  { id: 'chikun-speed-1-5x', title: 'Picking Up Speed', tier: 'bronze', category: 'speed', description: 'Stayed alive until the course reached 1.5x speed.', rule: best('speedMultiplierReached', 1.5) },
  { id: 'chikun-close-call', title: 'Close Call', tier: 'bronze', category: 'near-miss', description: 'Scored 2 near misses in one Ranked run.', rule: best('nearMisses', 2) },
  { id: 'chikun-flawless-3', title: 'Clean Sweep', tier: 'bronze', category: 'flawless', description: 'Cleared 3 regions without a single near miss in one Ranked run.', rule: best('flawlessRegions', 3) },
  { id: 'chikun-runs-5', title: 'Coop Regular', tier: 'bronze', category: 'volume', description: 'Finished 5 verified Ranked runs.', rule: runs(5) },

  { id: 'chikun-reach-coast', title: 'Coastal Escape', tier: 'silver', category: 'region', description: 'Reached the Coast, the last region of the loop.', rule: reach(6) },
  { id: 'chikun-loop-1', title: 'Full Circuit', tier: 'silver', category: 'loop', description: 'Flew one full loop of all seven regions in one Ranked run.', rule: best('laps', 1) },
  { id: 'chikun-survive-4m', title: 'Four-Minute Flight', tier: 'silver', category: 'survival', description: 'Survived 4 minutes in one Ranked run.', rule: minutes(4) },
  { id: 'chikun-forks-50', title: 'Obstacle Course', tier: 'silver', category: 'forks', description: 'Passed 50 obstacles in one Ranked run.', rule: best('forksPassed', 50) },
  { id: 'chikun-coins-60', title: 'Coin Collector', tier: 'silver', category: 'coins', description: 'Collected 60 Litecoin in one Ranked run.', rule: best('coinsCollected', 60) },
  { id: 'chikun-combo-5', title: 'Combo Chick', tier: 'silver', category: 'combo', description: 'Built a 5-obstacle combo in one Ranked run: a coin or a near miss at every obstacle in a row.', rule: best('bestCombo', 5) },
  { id: 'chikun-near-miss-10', title: 'Feather Trimmer', tier: 'silver', category: 'near-miss', description: 'Scored 10 near misses in one Ranked run.', rule: best('nearMisses', 10) },
  { id: 'chikun-flawless-5', title: 'Spotless Flight', tier: 'silver', category: 'flawless', description: 'Cleared 5 regions without a single near miss in one Ranked run.', rule: best('flawlessRegions', 5) },
  { id: 'chikun-speed-2x', title: 'Double Time', tier: 'silver', category: 'speed', description: 'Stayed alive until the course reached 2x speed.', rule: best('speedMultiplierReached', 2) },
  { id: 'chikun-runs-25', title: 'Coop Veteran', tier: 'silver', category: 'volume', description: 'Finished 25 verified Ranked runs.', rule: runs(25) },
  { id: 'chikun-distance-50km', title: 'Long Haul', tier: 'silver', category: 'distance', description: 'Flew 50 km in total across Ranked runs.', rule: total('distanceMeters', 50_000) },

  { id: 'chikun-loop-2', title: 'Double Circuit', tier: 'gold', category: 'loop', description: 'Flew two full loops of all seven regions in one Ranked run.', rule: best('laps', 2) },
  { id: 'chikun-survive-6m', title: 'Six-Minute Flight', tier: 'gold', category: 'survival', description: 'Survived 6 minutes in one Ranked run.', rule: minutes(6) },
  { id: 'chikun-survive-8m', title: 'Eight-Minute Flight', tier: 'gold', category: 'survival', description: 'Survived 8 minutes in one Ranked run.', rule: minutes(8) },
  { id: 'chikun-survive-10m', title: 'Ten-Minute Flight', tier: 'gold', category: 'survival', description: 'Survived 10 minutes in one Ranked run.', rule: minutes(10) },
  { id: 'chikun-forks-90', title: 'Fork Veteran', tier: 'gold', category: 'forks', description: 'Passed 90 obstacles in one Ranked run.', rule: best('forksPassed', 90) },
  { id: 'chikun-coins-200', title: 'Coin Hoard', tier: 'gold', category: 'coins', description: 'Collected 200 Litecoin in one Ranked run.', rule: best('coinsCollected', 200) },
  { id: 'chikun-combo-20', title: 'Combo Rooster', tier: 'gold', category: 'combo', description: 'Built a 20-obstacle combo in one Ranked run: a coin or a near miss at every obstacle in a row.', rule: best('bestCombo', 20) },
  { id: 'chikun-flawless-13', title: 'Untouched Skies', tier: 'gold', category: 'flawless', description: 'Cleared 13 regions without a single near miss in one Ranked run.', rule: best('flawlessRegions', 13) },
  { id: 'chikun-near-miss-streak-8', title: 'Needle Streak', tier: 'gold', category: 'near-miss', description: 'Scored near misses on 8 obstacles in a row.', rule: best('nearMissStreakBest', 8) },

  { id: 'chikun-survive-12m', title: 'Twelve-Minute Flight', tier: 'platinum', category: 'survival', description: 'Survived 12 minutes in one Ranked run.', rule: minutes(12) },
  { id: 'chikun-survive-15m', title: 'Fifteen-Minute Legend', tier: 'platinum', category: 'survival', nft: true, description: 'Survived 15 minutes in one Ranked run.', rule: minutes(15) },
  { id: 'chikun-forks-150', title: 'Fork Master', tier: 'platinum', category: 'forks', nft: true, description: 'Passed 150 obstacles in one Ranked run.', rule: best('forksPassed', 150) },
  { id: 'chikun-coins-375', title: 'Golden Hoard', tier: 'platinum', category: 'coins', nft: true, description: 'Collected 375 Litecoin in one Ranked run.', rule: best('coinsCollected', 375) },
  { id: 'chikun-flawless-20', title: 'Flawless Flyer', tier: 'platinum', category: 'flawless', nft: true, description: 'Cleared 20 regions without a single near miss in one Ranked run.', rule: best('flawlessRegions', 20) },
  { id: 'chikun-combo-40', title: 'Combo Legend', tier: 'platinum', category: 'combo', nft: true, description: 'Built a 40-obstacle combo in one Ranked run: a coin or a near miss at every obstacle in a row.', rule: best('bestCombo', 40) },
];

const catalog = defineCatalog('chikun', specs, ({ tier }) => ({
  image: `/assets/generated/achievement-badges/chikun/${tier}.png`,
  lockedImage: `/assets/generated/achievement-badges/chikun/locked-${tier}.png`,
}));
export const CHIKUN_ACHIEVEMENTS = catalog.entries;
export const CHIKUN_HISTORY_FIELDS = catalog.historyFields;

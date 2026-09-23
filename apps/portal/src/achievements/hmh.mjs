// Hard Money Heroes achievement catalog (gameId 'lester-blaster', contract §6.1).
// The 57 ids, titles and tiers mirror ACHIEVEMENT_DEFINITIONS in arcade-core.mjs
// (a test pins that). Criteria read statsFromHmhRunSummary (§6.3) plus verified
// history (§6.5). Design notes, including every unavailable id and its reason:
// docs/game-design/achievement-catalogs-20260923.md.
import { best, defineCatalog, runs, total, when } from './entry.mjs';

// Reboot enemy roles (sdk/hmh-run-summary-schema.mjs enemyRoles) grouped into
// the legacy hunt families. The boss ('liquidator') belongs to no family.
export const HMH_ROLE_FAMILIES = Object.freeze({
  'bagholder-rusher': 'goblin',
  forkrunner: 'goblin',
  'liquidator-agent': 'drone',
  'validator-cultist': 'drone',
  'gas-bomber': 'gasBeast',
  'whale-enforcer': 'enforcer',
});
export const HMH_FAMILY_IDS = Object.freeze(['goblin', 'drone', 'gasBeast', 'enforcer']);
// The enemy ids the legacy resolver (arcade-core resolveAchievementUnlocksForRun) counts per family.
export const HMH_LEGACY_FAMILY_ENEMY_IDS = Object.freeze({ goblin: 'fud-goblin', drone: 'sybil-drone', gasBeast: 'gas-beast' });
// districtsVisited → the legacy stageIndexReached the resolver unlocks slums, foundry and getaway at.
export const HMH_DISTRICT_STAGES = Object.freeze([Object.freeze([6, 13]), Object.freeze([4, 8]), Object.freeze([2, 4])]);
// Remapped damage-chain threshold (one run's damageDealt); the legacy resolver reads the same value.
export const HMH_DAMAGE_CHAIN_DAMAGE = 20_000;

const bossDown = (s) => s.bossKills >= 1;
const soon = null; // unavailable: the reason is recorded in the catalog design doc

const specs = [
  { id: 'cabinet-pioneer', title: 'Cabinet Pioneer', tier: 'bronze', category: 'login', description: 'Signed in with a wallet and finished a verified Ranked run.', rule: runs(1) },
  { id: 'first-paid-run', title: 'First Ranked Run', tier: 'bronze', category: 'paid-run', description: 'Finished your first verified Ranked run.', rule: runs(1) },
  { id: 'first-1000-points', title: 'First 1,000 Points', tier: 'bronze', category: 'score', description: 'Scored at least 1,000 points in one Ranked run.', rule: best('score', 1000) },
  { id: 'first-blood', title: 'First Blood', tier: 'bronze', category: 'kill', description: 'Defeated your first enemy in a Ranked run.', rule: total('kills', 1) },
  { id: 'ten-enemy-kills', title: 'Ten-Enemy Cleanup', tier: 'bronze', category: 'kill', description: 'Defeated 10 enemies in one Ranked run.', rule: best('kills', 10) },
  { id: 'first-grenade-kill', title: 'Crypto Bomb Initiate', tier: 'bronze', category: 'grenade', description: 'Defeated your first enemy with a grenade in a Ranked run.', rule: total('grenadeKills', 1) },
  { id: 'first-powerup', title: 'Pickup Ready', tier: 'bronze', category: 'collection', description: 'Collected your first power-up or weapon cache in a Ranked run.', rule: total('powerUpsCollected', 1) },
  { id: 'beat-level-1-boss', title: 'Beat Level 1 Boss', tier: 'bronze', category: 'boss', description: 'Defeated the Liquidator, the Level 1 boss.', rule: best('bossKills', 1) },
  { id: 'five-minute-run', title: 'Five-Minute Fighter', tier: 'bronze', category: 'survival', description: 'Survived at least five minutes in one Ranked run.', rule: best('survivalSeconds', 300) },
  { id: 'combo-starter', title: 'Combo Starter', tier: 'bronze', category: 'combo', description: 'Reached a 5-kill combo.', rule: best('maxCombo', 5) },

  { id: 'gas-beast-hunter', title: 'Gas-Tax Hunter', tier: 'silver', category: 'enemy-hunt', description: 'Defeated 50 Gas Bombers across Ranked runs.', rule: total('familyKills.gasBeast', 50) },
  { id: 'goblin-cleanup', title: 'Wasteland Cleanup', tier: 'silver', category: 'enemy-hunt', description: 'Defeated 75 Bagholder Rushers or Forkrunners across Ranked runs.', rule: total('familyKills.goblin', 75) },
  { id: 'drone-swatter', title: 'Sybil Breaker', tier: 'silver', category: 'enemy-hunt', description: 'Defeated 60 Liquidator Agents or Validator Cultists across Ranked runs.', rule: total('familyKills.drone', 60) },
  { id: 'grenade-century', title: 'Grenade Century', tier: 'silver', category: 'grenade', description: 'Defeated 100 enemies with grenades across Ranked runs.', rule: total('grenadeKills', 100) },
  { id: 'blade-master', title: 'Blade Master', tier: 'silver', category: 'melee', description: 'Defeated 100 enemies with the Litecoin Knife or Forked Standard across Ranked runs.', rule: total('meleeKills', 100) },
  { id: 'hash-rail-specialist', title: 'Hash Rail Specialist', tier: 'silver', category: 'weapon', description: 'Fought with the Hash Rail in a Ranked run.', rule: when((s) => Array.isArray(s.weaponsUsed) && s.weaponsUsed.includes('hash-rail')) },
  { id: 'spread-ltc-specialist', title: 'Spread LTC Specialist', tier: 'silver', category: 'weapon', description: 'Fought with the Scatter Shotgun in a Ranked run.', rule: when((s) => Array.isArray(s.weaponsUsed) && s.weaponsUsed.includes('scatter-shotgun')) },
  { id: 'powerup-collector', title: 'Power-Up Collector', tier: 'silver', category: 'collection', description: 'Collected three or more different power-up types in one Ranked run.', rule: when((s) => Array.isArray(s.uniquePowerUps) && s.uniquePowerUps.length >= 3) },
  { id: 'score-5000', title: '5K Scorecard', tier: 'silver', category: 'score', description: 'Scored at least 5,000 points in one Ranked run.', rule: best('score', 5000) },
  { id: 'score-10000', title: '10K Neon Run', tier: 'silver', category: 'score', description: 'Scored at least 10,000 points in one Ranked run.', rule: best('score', 10000) },

  { id: 'boss-breaker', title: 'Boss Breaker', tier: 'gold', category: 'boss', description: 'Defeated a Hard Money Heroes boss in a Ranked run.', rule: best('bossKills', 1) },
  { id: 'no-damage-boss', title: 'Untouchable Boss Clear', tier: 'gold', category: 'skill', description: 'Beat a boss without taking damage during the boss phase.', rule: soon },
  { id: 'slums-clear', title: 'Wasteland Clear', tier: 'gold', category: 'level-clear', description: 'Visited two Level 1 districts in one Ranked run.', rule: best('districtsVisited', 2) },
  { id: 'foundry-clear', title: 'POI Clear', tier: 'gold', category: 'level-clear', description: 'Visited four Level 1 districts in one Ranked run.', rule: best('districtsVisited', 4) },
  { id: 'getaway-clear', title: 'Getaway Clear', tier: 'gold', category: 'level-clear', description: 'Visited all six Level 1 districts and defeated the boss in one Ranked run.', rule: when((s) => s.districtsVisited >= 6 && bossDown(s)) },
  { id: 'big-combo', title: 'Big Combo', tier: 'gold', category: 'combo', description: 'Reached a 15-kill combo.', rule: best('maxCombo', 15) },
  { id: 'damage-chain', title: 'Damage Chain', tier: 'gold', category: 'combo', description: 'Dealt 20,000 damage in one Ranked run.', rule: best('damageDealt', HMH_DAMAGE_CHAIN_DAMAGE) },
  { id: 'weapon-collector', title: 'Weapon Collector', tier: 'gold', category: 'collection', description: 'Fought with three different weapons in one Ranked run.', rule: best('uniqueWeaponCount', 3) },
  { id: 'lucky-survivor', title: 'Lucky Survivor', tier: 'gold', category: 'survival', description: 'Survived past 10 minutes after dropping below 20% health.', rule: soon },
  { id: 'ten-paid-runs', title: 'Ranked Regular', tier: 'gold', category: 'volume', description: 'Finished 10 verified Ranked runs.', rule: runs(10) },

  { id: 'master-survivor', title: 'Master Survivor', tier: 'platinum', category: 'survival', description: 'Survived at least fifteen minutes in one Ranked run.', rule: best('survivalSeconds', 900) },
  { id: 'score-25000', title: '25K Riot', tier: 'platinum', category: 'score', description: 'Scored at least 25,000 points in one Ranked run.', rule: best('score', 25000) },
  { id: 'score-50000', title: '50K Legend Run', tier: 'platinum', category: 'score', description: 'Scored at least 50,000 points in one Ranked run.', rule: best('score', 50000) },
  { id: 'no-damage-10-minutes', title: 'Glass Cannon Saint', tier: 'platinum', category: 'skill', description: 'Survived 10 minutes in a Ranked run without taking damage.', rule: soon },
  { id: 'all-bosses-scouted', title: 'Full Boss Roster Scouted', tier: 'platinum', category: 'collection', description: 'Encountered or defeated every major Hard Money Heroes boss.', rule: soon },
  { id: 'enemy-reaper-250', title: 'Enemy Reaper 250', tier: 'platinum', category: 'kill', description: 'Defeated 250 enemies across Ranked runs.', rule: total('kills', 250) },
  { id: 'enemy-reaper-500', title: 'Enemy Reaper 500', tier: 'platinum', category: 'kill', description: 'Defeated 500 enemies across Ranked runs.', rule: total('kills', 500) },
  { id: 'grenade-demolitionist', title: 'Grenade Demolitionist', tier: 'platinum', category: 'grenade', description: 'Defeated 250 enemies with grenades across Ranked runs.', rule: total('grenadeKills', 250) },
  { id: 'blade-samurai', title: 'Blade Samurai', tier: 'platinum', category: 'melee', description: 'Defeated 250 enemies with the Litecoin Knife or Forked Standard across Ranked runs.', rule: total('meleeKills', 250) },
  { id: 'powerup-hoarder', title: 'Power-Up Hoarder', tier: 'platinum', category: 'collection', description: 'Collected 250 power-ups and weapon caches across Ranked runs.', rule: total('powerUpsCollected', 250) },

  { id: 'ranked-regular', title: 'Ranked Regular+', tier: 'diamond', category: 'volume', description: 'Finished 50 verified Ranked runs.', rule: runs(50) },
  { id: 'boss-rush-ten', title: 'Boss Rush Ten', tier: 'diamond', category: 'boss', description: 'Defeated 10 bosses across Ranked runs.', rule: total('bossKills', 10) },
  { id: 'speed-clear', title: 'Speed Clear', tier: 'diamond', category: 'skill', description: 'Beat the Level 1 boss in under 8 minutes.', rule: soon },
  { id: 'hard-fork-hero', title: 'Hard Fork Hero', tier: 'diamond', category: 'grenade', description: 'Visited all six Level 1 districts with 20 grenade kills in one Ranked run.', rule: when((s) => s.districtsVisited >= 6 && s.grenadeKills >= 20) },
  { id: 'max-combo-30', title: '30-Combo Signal', tier: 'diamond', category: 'combo', description: 'Reached a 30-kill combo.', rule: best('maxCombo', 30) },

  { id: 'two-hundred-ranked-runs', title: '200 Ranked Runs', tier: 'mythic', category: 'volume', description: 'Finished 200 verified Ranked runs.', nft: true, rule: runs(200) },
  { id: 'two-fifty-ranked-runs', title: '250 Ranked Runs', tier: 'mythic', category: 'volume', description: 'Finished 250 verified Ranked runs.', nft: true, rule: runs(250) },
  { id: 'marathon-wallet', title: 'Marathon Wallet', tier: 'mythic', category: 'volume', description: 'Survived a total of 10 hours across Ranked runs.', rule: total('survivalSeconds', 36000) },
  { id: 'perfect-boss-gauntlet', title: 'Perfect Boss Gauntlet', tier: 'mythic', category: 'skill', description: 'Defeated three bosses without taking damage in their boss phases.', rule: soon },
  { id: 'arcade-legend-500', title: 'Arcade Legend 500', tier: 'mythic', category: 'volume', description: 'Finished 500 verified Ranked runs.', nft: true, rule: runs(500) },

  { id: 'l2-survive-5min', title: 'City Threshold', tier: 'gold', category: 'survival', description: 'Survive 5 minutes in Level 2: Litecoin City. Coming with Level 2.', rule: soon },
  { id: 'l2-bridge-exploiter', title: 'Bridge Breaker', tier: 'gold', category: 'boss', description: 'Defeat the Bridge Exploiter in DeFi Harbor. Coming with Level 2.', rule: soon },
  { id: 'l2-whale-slayer', title: 'Whale Slayer', tier: 'platinum', category: 'boss', description: 'Defeat The Whale in Financial Downtown. Coming with Level 2.', rule: soon },
  { id: 'l2-obfuscator', title: 'Privacy Piercer', tier: 'platinum', category: 'boss', description: 'Defeat The Obfuscator in MimbleWimble Grove. Coming with Level 2.', rule: soon },
  { id: 'l2-51-percent', title: 'Consensus Breaker', tier: 'platinum', category: 'boss', description: 'Defeat the 51% Boss in Hashrate District. Coming with Level 2.', rule: soon },
  { id: 'l2-ngmi', title: 'Not Gonna Make It... Did', tier: 'diamond', category: 'level-clear', description: 'Defeat Mr. NGMI and clear Level 2: Litecoin City. Coming with Level 2.', rule: soon },
  { id: 'l2-no-damage-ngmi', title: 'Influencer Immune', tier: 'mythic', category: 'skill', description: 'Defeat Mr. NGMI without taking damage during the boss phase. Coming with Level 2.', rule: soon },
];

const imagesFor = ({ id }) => (id.startsWith('l2-')
  ? { image: `/assets/generated/hmh-achievement-atlas/achievement-${id}.png`, lockedImage: `/assets/generated/hmh-achievement-atlas/locked-achievement-${id}.png` }
  : { image: `/assets/generated/achievement-badges/${id}.png`, lockedImage: `/assets/generated/achievement-badges/locked-${id}.png` });

const catalog = defineCatalog('lester-blaster', specs, imagesFor);
export const HMH_ACHIEVEMENTS = catalog.entries;
export const HMH_HISTORY_FIELDS = catalog.historyFields;

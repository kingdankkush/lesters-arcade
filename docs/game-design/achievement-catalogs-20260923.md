# Achievement catalogs: Hard Money Heroes, Chikun's Escape, STACKED (2026-09-23)

**Status:** proposed, for owner checkpoint **O1** (contract §10.1). It lands with the achievements slice and must be reviewed before the first production deploy (§13 step 3). From the first verified Ranked run on, every threshold is baked into `achievement_unlocks`, so changes after launch are hard to undo.

**Scope:** all 137 achievements: 57 for Hard Money Heroes (`lester-blaster`), 40 for Chikun's Escape (`chikun`), 40 for STACKED (`stacked`). The code is in `apps/portal/src/achievements/`. This document is the only place the calibration source for each threshold and the reason for each unavailable id are recorded.

## What to review

1. **Thresholds.**
   - Chikun's thresholds come from the difficulty harness (`docs/qa/chikun-difficulty-harness-20260923.json`, 200 bot runs per profile). Combo and near-miss thresholds also use a near-miss-chasing sample (below), because harness bots never aim for near misses.
   - STACKED's thresholds come from a soak pilot throttled to five human speeds. Halvings, spins, perfect clears, combos and back-to-back are anchored on the 16 Free medals, because the pilot never sets those up. Four of them (`stacked-spins-10`, `stacked-spins-25`, `stacked-perfect-clears-3`, `stacked-b2b-5`) have no medal to anchor on and are marked **estimate**.
   - These sit at the edge of their tier, or rest on estimates, and need a decision:
     - `chikun-survive-6m` and `chikun-speed-2x` are silver but only reached around the intermediate p90;
     - `chikun-survive-12m` is gold but reached around the exceptional median;
     - STACKED platinum assumes survival at 20G, and the bots handle 20G better than most people will;
     - HMH `damage-chain` now means 20,000 damage in one run, estimated from the reboot health curve with no measured runs.
2. **Unavailable HMH ids (13).**
   - The seven `l2-*` ids wait for Level 2.
   - `lucky-survivor`, `all-bosses-scouted` and `speed-clear` cannot be computed from the reboot summary, or cannot happen in the reboot at all.
   - **New finding:** `no-damage-boss`, `no-damage-10-minutes` and `perfect-boss-gauntlet` can never be earned in Ranked. Every verified HMH run ends `defeated`, so the summary always carries damage taken, and it records no damage per boss phase. They stay `available:false` until the child records boss-phase damage.
   - 44 of the 50 non-Level-2 ids are available (target 44).
3. **NFT proposal for phase 2 (13).** Nothing is defined on chain in phase 1, and no screen uses NFT wording (A32). The candidates are:
   - five Chikun platinum: `chikun-survive-15m`, `chikun-forks-150`, `chikun-coins-375`, `chikun-flawless-20`, `chikun-combo-40`;
   - five STACKED platinum: `stacked-lines-1000`, `stacked-survive-17m`, `stacked-score-4250k`, `stacked-garbage-100`, `stacked-b2b-10`;
   - three HMH mythic run totals: `two-hundred-ranked-runs`, `two-fifty-ranked-runs`, `arcade-legend-500`.

   `marathon-wallet` and `perfect-boss-gauntlet` are **not** candidates. HMH is plausibility-checked, not replayed (A9), and they rest only on client-attested survival and no-damage fields. The owner may revisit this in phase 2 (checkpoint O3).

## How the catalogs work

- **Entries.** Each catalog entry is frozen and has exactly these fields: `id, gameId, title, description, tier, category, nft, available, order, image, lockedImage, criteria, progress` (contract §6.1). Ids are unique across the three games. Titles and descriptions never mention NFTs, soulbound tokens or minting.
- **Criteria.** A criterion reads only the stats of the verified run (contract §6.3: `statsFromHmhRunSummary`, `statsFromChikunResult`, `statsFromStackedTuple`) plus the wallet's verified history (§6.5). There are three kinds:
  - **best run**: this run reaches the threshold;
  - **cumulative** (Σ): `history.sums[path] + run.stats[path]` reaches it;
  - **run count**: `history.runs + 1` reaches it, because history excludes the current session.
- **Progress.** `progress(run | null, history)` returns `{ current, target }`, with `current` capped at `target`. For best-run entries it reads `history.maxima`, for cumulative ones `history.sums`, for run counts `history.runs`. Compound and unavailable entries return `null`.
- **Derivation.** `deriveEarnedAchievements(gameId, verifiedRun, history)` returns, in catalog order, every available entry that the run earns and that the wallet has not unlocked yet. It throws when the run belongs to another game, so a Chikun run can never earn an HMH id. `historyFieldsFor(gameId)` lists the catalog-owned stats paths the index sums or maximizes. They match `^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)?$`, and a test checks each one exists as a number in real stats.
- **Browser resolver fixes** (`arcade-core.mjs`), so that the device-local profile and the server agree:
  - `maybeUnlockRunAchievements` now runs only for Hard Money Heroes progress, and its run count is the HMH-scoped `progress.paidRuns`. `profile.totalPaidRuns` still counts every game, as a display counter.
  - `recordScore` adds the run to HMH progress before it resolves unlocks, and the resolver adds the run's own enemy-family kills to the cumulative ones. So `maybeUnlockRunAchievements` passes the family totals from before this run. Before this fix a run's family kills counted twice: 38 goblin-family kills unlocked the 75-kill `goblin-cleanup`.
  - It counts weapons within this run only, as the server does. Before, `weapon-collector` counted weapons across runs.
  - `resolveAchievementUnlocksForRun` also accepts the canonical `weaponIds` (the Scatter Shotgun counts for `spread-ltc-specialist`) and `damageDealt` (`damage-chain`).
  - `ACHIEVEMENT_TIER_UNLOCK_PCT` gains `mythic: 1`.
  - The achievement-progress "completed Ranked runs" metric reads HMH progress.
- **Resolver inputs.** `hmhResolverInputsFromRunSummary(runSummary)` (contract §6.4) feeds the legacy resolver the same facts the server uses:
  - legacy enemy ids per family;
  - `stageIndexReached` from `districtsVisited` (6 → 13, 4 → 8, 2 → 4, else 1);
  - `bossId: 'boss-liquidator'` only on a boss kill.

  The resolver also reads run totals that the §6.4 keys leave out. `hmhRecordScoreInputsFromRunSummary(runSummary)` returns both `recordScore` arguments: `score`, and `runStats`, which is the §6.4 inputs plus `elapsedSeconds` (`totals.elapsedMs / 1000`), `kills`, `powerUpsCollected` and `damageDealt`. With the §6.4 mapper alone, the browser misses `first-blood`, `five-minute-run`, `damage-chain`, `master-survivor` and the kill totals.

  Two parity tests hold the browser to the server. One feeds the bare resolver. The other goes through the real `recordScore` path run by run: each fixture on a fresh profile, each after nine earlier runs, and a mixed sequence. Both return the same ids as the server, except the unavailable ones and `cabinet-pioneer`, which the browser grants at wallet connect.

### HMH enemy families

The three hunt achievements count families of reboot enemy roles (`HMH_ROLE_FAMILIES` in `hmh.mjs`). The boss (`liquidator`) belongs to no family. `familyKills` in the stats always has all four keys.

| Family | Reboot roles | Legacy resolver id | Hunt achievement |
| --- | --- | --- | --- |
| `goblin` | `bagholder-rusher` (rusher), `forkrunner` (flanker) | `fud-goblin` | `goblin-cleanup` (75) |
| `drone` | `liquidator-agent` (suppressor), `validator-cultist` (support) | `sybil-drone` | `drone-swatter` (60) |
| `gasBeast` | `gas-bomber` (demolition) | `gas-beast` | `gas-beast-hunter` (50) |
| `enforcer` | `whale-enforcer` (bruiser) | none | none yet |

### HMH stats definitions (choices recorded for review)

- **Grenade kills:** `grenades.kills`, which counts Satoshi Frag and Launcher Rig kills.
- **Melee kills:** `kills.byWeapon` for `litecoin-knife` plus `forked-standard`.
- **Weapons used:** the weapons with `equippedTicks > 0`, sorted.
- **Power-ups:** every collectible except `litecoin-token` (weapon caches, bonus life, Hash Rail core, time dilation, Berserk Candle, nuke).
- **Districts visited and POIs discovered:** the bits set in the exploration masks.
- **`noDamage`:** `damageTaken === 0`. **`perfectBossKill`:** a boss kill with `noDamage`.
- **`bossEngaged`:** `milestones.bossEngagedTick > 0` (schema 6), otherwise a boss kill.

## Calibration sources

- **Harness** is `docs/qa/chikun-difficulty-harness-20260923.json`, from the chikun-tune slice. It holds 200 seeded bot runs per profile on the v6 course:
  - the profiles are novice, intermediate, expert, hardcore and exceptional;
  - it gives p10, p50, p90 and p99 of every contract §6.3 stat, plus the loop-0 region reached.
- **Skim** is `tests/fixtures/achievements/chikun-skim-calibration.json`: the same harness bots, 40 runs per profile, rewarded for passing inside the 32 px near-miss band (`playBotRun` with `skim 800`). Chasing near misses trades survival for near misses and combo:
  - exceptional bestCombo reaches p90 39.1, against 17 when the bots avoid near misses;
  - chasers almost never clear a region flawlessly.

  So combo and near-miss thresholds take the larger of the two strategies. Flawless-region, coin and survival thresholds come from the harness.
- **Soak** is `tests/fixtures/achievements/stacked-calibration.json`: `apps/stacked/src/dev/soak-pilot.mjs` throttled to human speeds, 30 seeded runs per profile, capped at 30 minutes. Each profile sets:
  - a pause after each spawn (`thinkTicks`);
  - a pause after each input (`gapTicks`);
  - the chance that a hard drop is preceded by a one-column slip (`errorPct`).

  | Profile | Think / gap / slips | About | Survival p50 | Lines p50 | Level p50 |
  | --- | --- | --- | --- | --- | --- |
  | novice | 45 / 8 / 12% | 0.8 pieces/s | 2.65 min | 37.5 | 4.5 |
  | intermediate | 30 / 6 / 6% | 1.1 pieces/s | 4.77 min | 114.5 | 12 |
  | expert | 22 / 5 / 3% | 1.4 pieces/s | 5.27 min | 167 | 17.5 |
  | hardcore | 14 / 4 / 2% | 1.8 pieces/s | 7.17 min | 307 | 30 |
  | exceptional | 10 / 3 / 1% | 2.3 pieces/s | 14.39 min | 835 | 30 |

  The expert profile hits a wall at the level 17-20 lock delays. Only the hardcore and exceptional profiles survive 20G. The pilot plays for singles, so its Halvings, spins, perfect clears and back-to-back chains are accidental. Those thresholds are anchored on the Free medal order in `apps/stacked/src/free-medals.mjs`:
  1. `first-seal`, `first-quad`, `first-spin`, `combo-5`, `survive-180`;
  2. `lines-40`, `combo-10`, `zone-3`, `survive-360`, `quad-10`;
  3. `perfect-clear`, `lines-150`, `zone-6`, `survive-900`, `b2b-10`, `ranked-25`.
- **Rebuilding the samples.** `node tests/fixtures/achievements/build-fixtures.mjs --calibrate` rebuilds both samples (about 3 minutes on 24 logical CPUs). Without the flag it rebuilds the test fixtures.
- **Tests.** `tests/achievement-derivation.test.mjs` reads the harness, skim and soak JSON and checks the tier rules:
  - every bronze is earned in a first session of five novice-median runs;
  - every platinum fails just below the exceptional p90 and is reached at the exceptional p99;
  - Chikun silver and gold sit within intermediate-to-expert and hardcore reach;
  - bot-calibrated STACKED silver and gold hold at the intermediate and hardcore medians.

## Hard Money Heroes (57)

The ids, titles and tiers are unchanged from `ACHIEVEMENT_DEFINITIONS` (a test pins them). Σ means the verified history sum plus this run.

| # | Id | Title | Tier | Category | Criterion | Available | NFT proposal | Calibration / source |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `cabinet-pioneer` | Cabinet Pioneer | bronze | login | Any verified Ranked run (`history.runs + 1 ≥ 1`); settling one needs a signed-in wallet | yes | no | Remap: the browser grants it at wallet connect; the server grants it with the first verified run |
| 2 | `first-paid-run` | First Ranked Run | bronze | paid-run | `history.runs + 1 ≥ 1` | yes | no | Server-counted verified runs (`history.runs + 1`) |
| 3 | `first-1000-points` | First 1,000 Points | bronze | score | `score ≥ 1,000` in one run | yes | no | Legacy threshold (`ACHIEVEMENT_DEFINITIONS`) |
| 4 | `first-blood` | First Blood | bronze | kill | `kills` (history sum + this run) `≥ 1` | yes | no | Legacy threshold (`ACHIEVEMENT_DEFINITIONS`); cumulative, like the legacy resolver |
| 5 | `ten-enemy-kills` | Ten-Enemy Cleanup | bronze | kill | `kills ≥ 10` in one run | yes | no | Legacy threshold (`ACHIEVEMENT_DEFINITIONS`) |
| 6 | `first-grenade-kill` | Crypto Bomb Initiate | bronze | grenade | `grenadeKills` (sum + run) `≥ 1`; grenade kills are `grenades.kills` (Satoshi Frag and Launcher Rig kills) | yes | no | Legacy threshold (`ACHIEVEMENT_DEFINITIONS`); cumulative, like the legacy resolver |
| 7 | `first-powerup` | Pickup Ready | bronze | collection | `powerUpsCollected` (sum + run) `≥ 1`; every collectible except `litecoin-token` | yes | no | Legacy threshold (`ACHIEVEMENT_DEFINITIONS`); cumulative, like the legacy resolver |
| 8 | `beat-level-1-boss` | Beat Level 1 Boss | bronze | boss | `bossKills ≥ 1` | yes | no | Legacy threshold (`ACHIEVEMENT_DEFINITIONS`); a boss kill now, not a boss encounter |
| 9 | `five-minute-run` | Five-Minute Fighter | bronze | survival | `survivalSeconds ≥ 300` | yes | no | Legacy threshold (`ACHIEVEMENT_DEFINITIONS`) |
| 10 | `combo-starter` | Combo Starter | bronze | combo | `maxCombo ≥ 5` | yes | no | Legacy threshold (`ACHIEVEMENT_DEFINITIONS`) |
| 11 | `gas-beast-hunter` | Gas-Tax Hunter | silver | enemy-hunt | Σ `familyKills.gasBeast` (Gas Bomber kills) `≥ 50` | yes | no | Legacy threshold (`ACHIEVEMENT_DEFINITIONS`); family table above |
| 12 | `goblin-cleanup` | Wasteland Cleanup | silver | enemy-hunt | Σ `familyKills.goblin` (Bagholder Rusher + Forkrunner) `≥ 75` | yes | no | Legacy threshold (`ACHIEVEMENT_DEFINITIONS`); family table above |
| 13 | `drone-swatter` | Sybil Breaker | silver | enemy-hunt | Σ `familyKills.drone` (Liquidator Agent + Validator Cultist) `≥ 60` | yes | no | Legacy threshold (`ACHIEVEMENT_DEFINITIONS`); family table above |
| 14 | `grenade-century` | Grenade Century | silver | grenade | Σ `grenadeKills ≥ 100` | yes | no | Legacy threshold (`ACHIEVEMENT_DEFINITIONS`) |
| 15 | `blade-master` | Blade Master | silver | melee | Σ `meleeKills ≥ 100` (Litecoin Knife + Forked Standard kills) | yes | no | Legacy threshold (`ACHIEVEMENT_DEFINITIONS`) |
| 16 | `hash-rail-specialist` | Hash Rail Specialist | silver | weapon | `hash-rail` in `weaponsUsed` (equipped for at least one tick) | yes | no | Legacy threshold (`ACHIEVEMENT_DEFINITIONS`) |
| 17 | `spread-ltc-specialist` | Spread LTC Specialist | silver | weapon | `scatter-shotgun` in `weaponsUsed` | yes | no | Legacy threshold (`ACHIEVEMENT_DEFINITIONS`); the Scatter Shotgun is the reboot's spread weapon |
| 18 | `powerup-collector` | Power-Up Collector | silver | collection | 3 or more distinct `uniquePowerUps` in one run | yes | no | Legacy threshold (`ACHIEVEMENT_DEFINITIONS`) |
| 19 | `score-5000` | 5K Scorecard | silver | score | `score ≥ 5,000` | yes | no | Legacy threshold (`ACHIEVEMENT_DEFINITIONS`) |
| 20 | `score-10000` | 10K Neon Run | silver | score | `score ≥ 10,000` | yes | no | Legacy threshold (`ACHIEVEMENT_DEFINITIONS`) |
| 21 | `boss-breaker` | Boss Breaker | gold | boss | `bossKills ≥ 1` | yes | no | Legacy threshold (`ACHIEVEMENT_DEFINITIONS`) |
| 22 | `no-damage-boss` | Untouchable Boss Clear | gold | skill | Intended: Beat a boss without taking damage during the boss phase. | **no**: The summary records no boss-phase damage, and every verified run ends `defeated` with damage taken, so "no damage" never holds. | no | Unavailable |
| 23 | `slums-clear` | Wasteland Clear | gold | level-clear | `districtsVisited ≥ 2` (legacy stage 4) | yes | no | Legacy stage 4 mapped to districts (contract §6.4) |
| 24 | `foundry-clear` | POI Clear | gold | level-clear | `districtsVisited ≥ 4` (legacy stage 8) | yes | no | Legacy stage 8 mapped to districts |
| 25 | `getaway-clear` | Getaway Clear | gold | level-clear | `districtsVisited = 6` and `bossKills ≥ 1` (legacy stage 13 + boss) | yes | no | Legacy stage 13 mapped to districts; id kept (the Lester legacy migration key) |
| 26 | `big-combo` | Big Combo | gold | combo | `maxCombo ≥ 15` | yes | no | Legacy threshold (`ACHIEVEMENT_DEFINITIONS`) |
| 27 | `damage-chain` | Damage Chain | gold | combo | `damageDealt ≥ 20,000` in one run | yes | no | **Remap, estimate**: the summary records no damage chains; 20,000 is roughly a 12-15 minute run on the reboot health curve (enemies reach their full 64-240 HP at minute 10) |
| 28 | `weapon-collector` | Weapon Collector | gold | collection | `uniqueWeaponCount ≥ 3` in one run | yes | no | Remap: history keeps numeric sums only, so "three weapons across runs" became "three weapons in one run" |
| 29 | `lucky-survivor` | Lucky Survivor | gold | survival | Intended: Survived past 10 minutes after dropping below 20% health. | **no**: The summary has no health history, so "after dropping below 20% health" cannot be checked. | no | Unavailable |
| 30 | `ten-paid-runs` | Ranked Regular | gold | volume | `history.runs + 1 ≥ 10` | yes | no | Server-counted verified runs (`history.runs + 1`) |
| 31 | `master-survivor` | Master Survivor | platinum | survival | `survivalSeconds ≥ 900` | yes | no | Legacy threshold (`ACHIEVEMENT_DEFINITIONS`) |
| 32 | `score-25000` | 25K Riot | platinum | score | `score ≥ 25,000` | yes | no | Legacy threshold (`ACHIEVEMENT_DEFINITIONS`) |
| 33 | `score-50000` | 50K Legend Run | platinum | score | `score ≥ 50,000` | yes | no | Legacy threshold (`ACHIEVEMENT_DEFINITIONS`) |
| 34 | `no-damage-10-minutes` | Glass Cannon Saint | platinum | skill | Intended: Survived 10 minutes in a Ranked run without taking damage. | **no**: Every verified HMH run ends `defeated`, so the player always took damage; a no-damage Ranked run cannot exist. | no | Unavailable |
| 35 | `all-bosses-scouted` | Full Boss Roster Scouted | platinum | collection | Intended: Encountered or defeated every major Hard Money Heroes boss. | **no**: The reboot has one boss, the Liquidator; the roster achievement waits for more bosses. | no | Unavailable |
| 36 | `enemy-reaper-250` | Enemy Reaper 250 | platinum | kill | Σ `kills ≥ 250` | yes | no | Legacy threshold (`ACHIEVEMENT_DEFINITIONS`) |
| 37 | `enemy-reaper-500` | Enemy Reaper 500 | platinum | kill | Σ `kills ≥ 500` | yes | no | Legacy threshold (`ACHIEVEMENT_DEFINITIONS`) |
| 38 | `grenade-demolitionist` | Grenade Demolitionist | platinum | grenade | Σ `grenadeKills ≥ 250` | yes | no | Legacy threshold (`ACHIEVEMENT_DEFINITIONS`) |
| 39 | `blade-samurai` | Blade Samurai | platinum | melee | Σ `meleeKills ≥ 250` | yes | no | Legacy threshold (`ACHIEVEMENT_DEFINITIONS`) |
| 40 | `powerup-hoarder` | Power-Up Hoarder | platinum | collection | Σ `powerUpsCollected ≥ 250` | yes | no | Legacy threshold (`ACHIEVEMENT_DEFINITIONS`) |
| 41 | `ranked-regular` | Ranked Regular+ | diamond | volume | `history.runs + 1 ≥ 50` | yes | no | Server-counted verified runs (`history.runs + 1`) |
| 42 | `boss-rush-ten` | Boss Rush Ten | diamond | boss | Σ `bossKills ≥ 10` | yes | no | Legacy threshold (`ACHIEVEMENT_DEFINITIONS`) |
| 43 | `speed-clear` | Speed Clear | diamond | skill | Intended: Beat the Level 1 boss in under 8 minutes. | **no**: The boss band opens at tick 72,000 (20 minutes), so a boss kill under 8 minutes is impossible, and the summary has no boss-kill tick to remap to. | no | Unavailable |
| 44 | `hard-fork-hero` | Hard Fork Hero | diamond | grenade | `districtsVisited = 6` and `grenadeKills ≥ 20` in one run | yes | no | Legacy stage 13 mapped to districts |
| 45 | `max-combo-30` | 30-Combo Signal | diamond | combo | `maxCombo ≥ 30` | yes | no | Legacy threshold (`ACHIEVEMENT_DEFINITIONS`) |
| 46 | `two-hundred-ranked-runs` | 200 Ranked Runs | mythic | volume | `history.runs + 1 ≥ 200` | yes | **yes** (phase 2) | Server-counted verified runs (`history.runs + 1`) |
| 47 | `two-fifty-ranked-runs` | 250 Ranked Runs | mythic | volume | `history.runs + 1 ≥ 250` | yes | **yes** (phase 2) | Server-counted verified runs (`history.runs + 1`) |
| 48 | `marathon-wallet` | Marathon Wallet | mythic | volume | Σ `survivalSeconds ≥ 36,000` (10 hours) | yes | no | Legacy threshold (`ACHIEVEMENT_DEFINITIONS`); client-attested time, so not an NFT candidate |
| 49 | `perfect-boss-gauntlet` | Perfect Boss Gauntlet | mythic | skill | Intended: Defeated three bosses without taking damage in their boss phases. | **no**: Needs no-damage boss phases, which the summary does not record (and every Ranked run ends with damage taken). | no | Unavailable |
| 50 | `arcade-legend-500` | Arcade Legend 500 | mythic | volume | `history.runs + 1 ≥ 500` | yes | **yes** (phase 2) | Server-counted verified runs (`history.runs + 1`) |
| 51 | `l2-survive-5min` | City Threshold | gold | survival | Intended: Survive 5 minutes in Level 2: Litecoin City. | **no**: Coming with Level 2 (the reboot has no Level 2). | no | Coming with Level 2 |
| 52 | `l2-bridge-exploiter` | Bridge Breaker | gold | boss | Intended: Defeat the Bridge Exploiter in DeFi Harbor. | **no**: Coming with Level 2 (the reboot has no Level 2). | no | Coming with Level 2 |
| 53 | `l2-whale-slayer` | Whale Slayer | platinum | boss | Intended: Defeat The Whale in Financial Downtown. | **no**: Coming with Level 2 (the reboot has no Level 2). | no | Coming with Level 2 |
| 54 | `l2-obfuscator` | Privacy Piercer | platinum | boss | Intended: Defeat The Obfuscator in MimbleWimble Grove. | **no**: Coming with Level 2 (the reboot has no Level 2). | no | Coming with Level 2 |
| 55 | `l2-51-percent` | Consensus Breaker | platinum | boss | Intended: Defeat the 51% Boss in Hashrate District. | **no**: Coming with Level 2 (the reboot has no Level 2). | no | Coming with Level 2 |
| 56 | `l2-ngmi` | Not Gonna Make It... Did | diamond | level-clear | Intended: Defeat Mr. NGMI and clear Level 2: Litecoin City. | **no**: Coming with Level 2 (the reboot has no Level 2). | no | Coming with Level 2 |
| 57 | `l2-no-damage-ngmi` | Influencer Immune | mythic | skill | Intended: Defeat Mr. NGMI without taking damage during the boss phase. | **no**: Coming with Level 2 (the reboot has no Level 2). | no | Coming with Level 2 |

## Chikun's Escape (40)

The tiers are 14 bronze, 12 silver, 9 gold and 5 platinum. "Harness" is the harness JSON and "skim" is the near-miss-chasing sample. Region `i` counts as reached when the run passes an obstacle in it, or finishes a loop.

| # | Id | Title | Tier | Category | Criterion | Available | NFT proposal | Calibration / source |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `chikun-first-flight` | First Flight | bronze | survival | `survivalTicks ≥ 10` | yes | no | Runtime id and threshold of `chikun-cabinet.mjs`; every harness run |
| 2 | `chikun-stack-three` | Stack Three | bronze | coins | `coinsCollected ≥ 3` | yes | no | Runtime id and threshold; harness novice p10 19 |
| 3 | `chikun-fork-runner` | Fork Runner | bronze | forks | `forksPassed ≥ 5` | yes | no | Runtime id and threshold; harness novice p10 14.9 |
| 4 | `chikun-reach-forest` | Into the Forest | bronze | region | `laps ≥ 1` or `regionIndexReached ≥ 1` | yes | no | Harness novice loop-0 region p10 = 1 |
| 5 | `chikun-reach-town` | Town Crossing | bronze | region | `laps ≥ 1` or `regionIndexReached ≥ 2` | yes | no | Harness novice loop-0 region p10 1, p50 5 |
| 6 | `chikun-reach-city` | City Lights | bronze | region | `laps ≥ 1` or `regionIndexReached ≥ 3` | yes | no | Harness novice loop-0 region p50 5 |
| 7 | `chikun-reach-industrial` | Smokestack Run | bronze | region | `laps ≥ 1` or `regionIndexReached ≥ 4` | yes | no | Harness novice loop-0 region p50 5 |
| 8 | `chikun-reach-suburbs` | Suburban Sprint | bronze | region | `laps ≥ 1` or `regionIndexReached ≥ 5` | yes | no | Harness novice loop-0 region p50 5 |
| 9 | `chikun-survive-2m` | Two-Minute Flight | bronze | survival | `survivalSeconds ≥ 120` | yes | no | Harness novice p25 2.61 min (p10 1.49, p50 3.42) |
| 10 | `chikun-coins-40` | Coin Purse | bronze | coins | `coinsCollected ≥ 40` | yes | no | Harness novice p50 49 |
| 11 | `chikun-speed-1-5x` | Picking Up Speed | bronze | speed | `speedMultiplierReached ≥ 1.5` | yes | no | Harness novice p50 1.655x (reached at about 2 minutes) |
| 12 | `chikun-close-call` | Close Call | bronze | near-miss | `nearMisses ≥ 2` | yes | no | Harness novice p50 2; skim novice p50 6.5 |
| 13 | `chikun-flawless-3` | Clean Sweep | bronze | flawless | `flawlessRegions ≥ 3` | yes | no | Harness novice p50 3 |
| 14 | `chikun-runs-5` | Coop Regular | bronze | volume | `history.runs + 1 ≥ 5` | yes | no | A first session |
| 15 | `chikun-reach-coast` | Coastal Escape | silver | region | `laps ≥ 1` or `regionIndexReached ≥ 6` | yes | no | Harness intermediate loop-0 region p50 6 (novice p90 6) |
| 16 | `chikun-loop-1` | Full Circuit | silver | loop | `laps ≥ 1` | yes | no | Harness intermediate p50 1 (novice p90 1) |
| 17 | `chikun-survive-4m` | Four-Minute Flight | silver | survival | `survivalSeconds ≥ 240` | yes | no | Harness intermediate p50 4.78 min |
| 18 | `chikun-survive-6m` | Six-Minute Flight | silver | survival | `survivalSeconds ≥ 360` | yes | no | Harness intermediate p99 6.27 / expert p10 5.53 min: **top edge of silver** |
| 19 | `chikun-forks-50` | Obstacle Course | silver | forks | `forksPassed ≥ 50` | yes | no | Harness intermediate p50 50 |
| 20 | `chikun-coins-60` | Coin Collector | silver | coins | `coinsCollected ≥ 60` | yes | no | Harness intermediate p50 68 |
| 21 | `chikun-combo-5` | Combo Chick | silver | combo | `bestCombo ≥ 5` | yes | no | Harness intermediate p50 5; skim intermediate p50 5.5 |
| 22 | `chikun-near-miss-10` | Feather Trimmer | silver | near-miss | `nearMisses ≥ 10` | yes | no | Skim intermediate p50 10 (harness p99 is 7: players who avoid close calls rarely get it) |
| 23 | `chikun-flawless-5` | Spotless Flight | silver | flawless | `flawlessRegions ≥ 5` | yes | no | Harness intermediate p50 5 |
| 24 | `chikun-speed-2x` | Double Time | silver | speed | `speedMultiplierReached ≥ 2` | yes | no | Harness intermediate p90 2.28 / expert p10 2.09 (reached at 5.4 min): **top edge of silver** |
| 25 | `chikun-runs-25` | Coop Veteran | silver | volume | `history.runs + 1 ≥ 25` | yes | no | Volume |
| 26 | `chikun-distance-50km` | Long Haul | silver | distance | Σ `distanceMeters ≥ 50,000` | yes | no | About 8 intermediate-median runs (harness p50 6,132 m) |
| 27 | `chikun-loop-2` | Double Circuit | gold | loop | `laps ≥ 2` | yes | no | Harness hardcore p50 1.5, p90 2; exceptional p50 2 |
| 28 | `chikun-survive-8m` | Eight-Minute Flight | gold | survival | `survivalSeconds ≥ 480` | yes | no | Harness hardcore p50 9.05 min (expert p50 7.30) |
| 29 | `chikun-survive-10m` | Ten-Minute Flight | gold | survival | `survivalSeconds ≥ 600` | yes | no | Harness hardcore p75 10.32 min |
| 30 | `chikun-survive-12m` | Twelve-Minute Flight | gold | survival | `survivalSeconds ≥ 720` | yes | no | Harness exceptional p50 11.82 / hardcore p99 11.83 min |
| 31 | `chikun-forks-90` | Fork Veteran | gold | forks | `forksPassed ≥ 90` | yes | no | Harness hardcore p50 95.5 |
| 32 | `chikun-coins-200` | Coin Hoard | gold | coins | `coinsCollected ≥ 200` | yes | no | Harness hardcore p50 204 |
| 33 | `chikun-combo-20` | Combo Rooster | gold | combo | `bestCombo ≥ 20` | yes | no | Skim hardcore p50 20 (harness exceptional p99 25) |
| 34 | `chikun-flawless-13` | Untouched Skies | gold | flawless | `flawlessRegions ≥ 13` | yes | no | Harness hardcore p50 13 |
| 35 | `chikun-near-miss-streak-8` | Needle Streak | gold | near-miss | `nearMissStreakBest ≥ 8` | yes | no | Skim expert p50 6 / hardcore p50 9 (harness p99 2) |
| 36 | `chikun-survive-15m` | Fifteen-Minute Legend | platinum | survival | `survivalSeconds ≥ 900` | yes | **yes** (phase 2) | Harness exceptional p90 14.18, p95 14.84 min (D11: past 15 minutes is extraordinary) |
| 37 | `chikun-forks-150` | Fork Master | platinum | forks | `forksPassed ≥ 150` | yes | **yes** (phase 2) | Harness exceptional p90 150 (p99 166) |
| 38 | `chikun-coins-375` | Golden Hoard | platinum | coins | `coinsCollected ≥ 375` | yes | **yes** (phase 2) | Harness exceptional p90 367 (p99 418) |
| 39 | `chikun-flawless-20` | Flawless Flyer | platinum | flawless | `flawlessRegions ≥ 20` | yes | **yes** (phase 2) | Harness exceptional p90 19 (p99 22) |
| 40 | `chikun-combo-40` | Combo Legend | platinum | combo | `bestCombo ≥ 40` | yes | **yes** (phase 2) | Skim exceptional p90 39.1 (harness exceptional p90 17) |

## STACKED (40)

The tiers are 14 bronze, 12 silver, 9 gold and 5 platinum. "Soak" is the throttled soak-pilot sample and "medal" is the Free medal order. The criteria read only the result tuple.

| # | Id | Title | Tier | Category | Criterion | Available | NFT proposal | Calibration / source |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `stacked-first-line` | Genesis Row | bronze | lines | `lines ≥ 1` | yes | no | Medal `first-seal` (1st of 16); soak novice p10 9.9 lines |
| 2 | `stacked-level-2` | Block Height 2 | bronze | level | `level ≥ 2` | yes | no | Soak novice p10 1.9, p50 4.5 |
| 3 | `stacked-lines-25` | Twenty-Five Rows | bronze | lines | `lines ≥ 25` | yes | no | Soak novice p50 37.5 |
| 4 | `stacked-lines-total-100` | Hundred-Row Ledger | bronze | lines | Σ `lines ≥ 100` | yes | no | About 3 novice-median runs |
| 5 | `stacked-first-halving` | First Halving | bronze | halving | `quadClears ≥ 1` | yes | no | Medal `first-quad` (2nd of 16); the pilot never builds for Halvings |
| 6 | `stacked-halvings-total-5` | Halving Habit | bronze | halving | Σ `quadClears ≥ 5` | yes | no | Medal `first-quad`, over a few runs |
| 7 | `stacked-first-spin` | First Spin | bronze | spin | `spins ≥ 1` (spin locks, mini or full) | yes | no | Medal `first-spin` (3rd of 16; the medal counts spin clears, the tuple counts spin locks) |
| 8 | `stacked-first-hold` | Cold Storage | bronze | hold | `holdsUsed ≥ 1` | yes | no | Basic mechanic; the pilot never holds |
| 9 | `stacked-combo-2` | Chain Starter | bronze | combo | `maxCombo ≥ 2` (3 clearing pieces in a row) | yes | no | Soak novice p50 2 |
| 10 | `stacked-pieces-100` | Hundred Blocks | bronze | pieces | `pieces ≥ 100` | yes | no | Soak novice p50 124 |
| 11 | `stacked-survive-2m` | Two-Minute Stack | bronze | survival | `survivalSeconds ≥ 120` | yes | no | Soak novice p50 2.65 min |
| 12 | `stacked-score-20k` | 20K Block | bronze | score | `score ≥ 20,000` | yes | no | Soak novice p50 22,131 |
| 13 | `stacked-garbage-2` | Mempool Spill | bronze | garbage | `garbageRowsReceived ≥ 2` | yes | no | Soak novice p50 2 |
| 14 | `stacked-runs-5` | Regular Stacker | bronze | volume | `history.runs + 1 ≥ 5` | yes | no | A first session |
| 15 | `stacked-level-10` | Block Height 10 | silver | level | `level ≥ 10` | yes | no | Soak intermediate p50 12 |
| 16 | `stacked-lines-100` | Hundred Rows | silver | lines | `lines ≥ 100` | yes | no | Soak intermediate p50 114.5 |
| 17 | `stacked-lines-total-1000` | Row Miner | silver | lines | Σ `lines ≥ 1,000` | yes | no | About 9 intermediate-median runs |
| 18 | `stacked-halvings-3` | Triple Halving | silver | halving | `quadClears ≥ 3` | yes | no | Between medals `first-quad` (2nd) and `quad-10` (10th); soak exceptional p50 5 by accident |
| 19 | `stacked-first-perfect-clear` | Clean Books | silver | perfect-clear | `perfectClears ≥ 1` | yes | no | Medal `perfect-clear` (11th of 16); soak hardcore/exceptional p90 1 by accident |
| 20 | `stacked-spins-10` | Spin Doctor | silver | spin | `spins ≥ 10` | yes | no | Ten times medal `first-spin`; the pilot never spins (**estimate**) |
| 21 | `stacked-combo-5` | Five-Link Chain | silver | combo | `maxCombo ≥ 5` | yes | no | Medal `combo-5` (4th of 16); soak exceptional p90 5 by accident |
| 22 | `stacked-b2b-2` | Back-to-Back | silver | back-to-back | `maxBackToBack ≥ 2` | yes | no | The first real back-to-back; soak exceptional p99 2 |
| 23 | `stacked-survive-4m` | Four-Minute Stack | silver | survival | `survivalSeconds ≥ 240` | yes | no | Soak intermediate p50 4.77 min |
| 24 | `stacked-score-100k` | 100K Block | silver | score | `score ≥ 100,000` | yes | no | Soak intermediate p50 148,244 |
| 25 | `stacked-garbage-5` | Garbage Day | silver | garbage | `garbageRowsReceived ≥ 5` | yes | no | Soak intermediate p50 5.5 |
| 26 | `stacked-runs-25` | Veteran Stacker | silver | volume | `history.runs + 1 ≥ 25` | yes | no | Volume (medal `ranked-25` counts 25 Free runs) |
| 27 | `stacked-level-20` | Block Height 20 | gold | level | `level ≥ 20` | yes | no | Soak expert p90 19 (the expert profile walls at the level 17-20 lock delays); hardcore p50 30 |
| 28 | `stacked-lines-300` | Three Hundred Rows | gold | lines | `lines ≥ 300` | yes | no | Soak hardcore p50 307 |
| 29 | `stacked-halvings-10` | Halving Cycle | gold | halving | `quadClears ≥ 10` | yes | no | Medal `quad-10` (10th of 16); soak exceptional p99 10.4 |
| 30 | `stacked-perfect-clears-3` | Audited Thrice | gold | perfect-clear | `perfectClears ≥ 3` | yes | no | Beyond medal `perfect-clear`; soak exceptional p99 2.7 (**estimate**) |
| 31 | `stacked-spins-25` | Torque Master | gold | spin | `spins ≥ 25` | yes | no | The pilot never spins (**estimate**) |
| 32 | `stacked-combo-10` | Ten-Link Chain | gold | combo | `maxCombo ≥ 10` | yes | no | Medal `combo-10` (7th of 16); soak hardcore p99 6.4 |
| 33 | `stacked-b2b-5` | Difficulty Spike | gold | back-to-back | `maxBackToBack ≥ 5` | yes | no | Halfway to medal `b2b-10` (**estimate**) |
| 34 | `stacked-survive-7m` | Hashrate Forge | gold | survival | `survivalSeconds ≥ 420` (zone 2, Hashrate Forge) | yes | no | Soak hardcore p50 7.17 min |
| 35 | `stacked-score-500k` | Half-Million Block | gold | score | `score ≥ 500,000` | yes | no | Soak expert p50 277,447 / hardcore p50 839,023 |
| 36 | `stacked-lines-1000` | Thousand-Row Run | platinum | lines | `lines ≥ 1,000` | yes | **yes** (phase 2) | Soak exceptional p90 973 (p99 1,025) |
| 37 | `stacked-survive-17m` | Lattice Survivor | platinum | survival | `survivalSeconds ≥ 1,020` | yes | **yes** (phase 2) | Soak exceptional p90 16.38, p99 17.03 min |
| 38 | `stacked-score-4250k` | Whale Stack | platinum | score | `score ≥ 4,250,000` | yes | **yes** (phase 2) | Soak exceptional p90 4.11M (p99 4.33M) |
| 39 | `stacked-garbage-100` | Garbage Collector | platinum | garbage | `garbageRowsReceived ≥ 100` | yes | **yes** (phase 2) | Soak exceptional p90 92.3 (p99 115) |
| 40 | `stacked-b2b-10` | Unbroken Chain | platinum | back-to-back | `maxBackToBack ≥ 10` | yes | **yes** (phase 2) | Medal `b2b-10` "Difficulty Adjustment" (15th of 16, the hardest skill medal); soak max 2 |

## NFT proposal (phase 2, not defined on chain)

`nftAchievementIds(gameId)` returns the candidates in catalog order. It reads the code catalog, never the stored `achievement_unlocks.nft` flag (A20). In phase 1 the ids ride in `submitVerifiedSession`, and `mintFor` skips them quietly, because the three collections deploy empty.

| Game | Candidates | Why |
| --- | --- | --- |
| Chikun's Escape | `chikun-survive-15m`, `chikun-forks-150`, `chikun-coins-375`, `chikun-flawless-20`, `chikun-combo-40` | Platinum; single-run stats of a server-replayed v6 run, each at or above the exceptional p90 |
| STACKED | `stacked-lines-1000`, `stacked-survive-17m`, `stacked-score-4250k`, `stacked-garbage-100`, `stacked-b2b-10` | Platinum; the stats come from the server-replayed result tuple |
| Hard Money Heroes | `two-hundred-ranked-runs`, `two-fifty-ranked-runs`, `arcade-legend-500` | Mythic; they depend only on verified runs the server counts itself, not on anything the client reports |

## Metadata and badges

- **Metadata.** `npm run achievements:metadata` (`scripts/generate-achievement-metadata.mjs`) writes ERC-721 metadata for every **available** achievement: 44 HMH, 40 Chikun and 40 STACKED, 124 files in `apps/portal/achievements/<gameId>/<id>.json` (contract §6.6).
  - The token URI is `https://lestersarcade.io/achievements/<gameId>/<id>.json`, so the NFT subset can change without new paths.
  - Each file carries the name, description, image, `external_url` (`/games/<route-slug>`) and five attributes: Game, Tier, Category, Soulbound "Yes" and Season "LiteForge testnet".
  - `animation_url` is reserved for the 3D upgrade. It is emitted only when an entry gains an `animation` path (a `.glb` model or a self-contained `.html` viewer), so the art can be replaced without re-minting.
  - The output is deterministic, and a test compares it with the committed files.
- **Badges.** Hard Money Heroes keeps its existing badges:
  - `/assets/generated/achievement-badges/<id>.png` and `locked-<id>.png`;
  - the atlas files for the `l2-*` ids.

  Chikun and STACKED get **placeholder** tier badges from `scripts/generate-game-achievement-badges.py`:
  - each is the HMH tier frame plus a glyph cut from the game's cabinet art (the rooster head from the Chikun marquee, the three glowing blocks from the STACKED back panel);
  - 48x48 RGBA, unlocked and greyed locked versions, 16 files and 22 KB in total;
  - output goes to `apps/portal/assets/generated/achievement-badges/{chikun,stacked}/`;
  - the generator writes nothing else;
  - every entry of a tier shares that tier's badge until the owner's art upgrade.

## Follow-ups

- **ranked-client slice (brief amendment needed).** Its brief (item 3) names only `hmhResolverInputsFromRunSummary`, which leaves the run totals out. At the `submitCombatGameOver` call site, use `const { score, runStats } = hmhRecordScoreInputsFromRunSummary(runSummary)` and call `recordScore(state, currentSession, score, runStats)`. That passes the §6.4 inputs plus `elapsedSeconds`, `kills`, `powerUpsCollected` and `damageDealt`, so the device-local resolver matches the server. Do not keep the stale `bossId`, `killsByType` and `maxCombo` globals in `main.js`.
- **HMH child (post-launch).** Record boss-phase damage, a boss-kill tick and a lowest-health mark in the run summary. That makes `no-damage-boss`, `perfect-boss-gauntlet`, `speed-clear` and `lucky-survivor` computable. `no-damage-10-minutes` needs a Ranked end state other than defeat.
- **Owner at O1.** Confirm or change the edge thresholds above, the `damage-chain` remap and the STACKED estimates. Any change is a follow-up slice for the achievements owner.

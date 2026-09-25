# HMH run summary v7 contract

**Status:** contract for the verifier-first slice (branch `fable/hmh-verifier-v7`, base release `60ea173a`, production 1.8.1). The child (`apps/hmh-reboot/src/**`) is a later branch and must emit exactly this.
**Source:** `docs/hmh-reboot/design/LEVEL-1-DESIGN-PACKAGE-20260925.md` sections 3.7, 3.8, 3.9, 4.1, 4.2, 4.7, 5.x, 8.x and 9.4, read against today's `sdk/hmh-run-summary-schema.mjs`, `sdk/hmh-run-summary.mjs`, `server/verify/hmh-plausibility.mjs`, `server/verify/hmh.mjs`, `apps/portal/src/achievements/{stats,hmh}.mjs`, `tests/achievement-derivation.test.mjs`, `tests/server-verify-identity.test.mjs` and the 1.8.1 child (`main.mjs`, `run-progression.mjs`, `encounter-director.mjs`, `liquidator-boss.mjs`, `collectible-system.mjs`, `deterministic-hash.mjs`).

**Owner overrides of the package (binding):**
1. **No Ranked season or ruleset reset.** Scores are labelled by game version elsewhere. There is no season boundary and no `ruleset` field.
2. **v6 verifies forever.** 1.8.x children keep verifying with today's bounds. There is no grace window and no date cut-off. Neither verifier path reads a clock.

Tags used below: **NEW** (no v6 counterpart), **CHANGED** (v6 rule with a new v7 formula), **UNCHANGED** (same rule and constants as v6), **NOT ADOPTED** (in 9.4 but deliberately left out, with the reason).

---

## 1. Decisions at a glance

| # | Decision | Why |
|---|---|---|
| D1 | `schemaVersion` 7. The schema accepts 1–7. v1–v6 validate against the frozen v6 catalogues, and v7 validates against the v7 catalogues. `HMH_RUN_SUMMARY_CATALOGS` stays the v6 object | Existing importers (the 1.8.x accumulator, fixtures, stats) keep their bytes and meaning |
| D2 | **`kills.boss` in v7 counts the Liquidator only** and equals `byEnemyRole.liquidator.count` (0 or 1). District-boss kills live in `kills.byEnemyRole` and the `bosses` rows | Every existing consumer of `kills.boss` means "the Level 1 boss was beaten": `hmh.mjs` (`contract.bossId = 'boss-liquidator'`, which goes on chain), `stats.mjs` (`bossKills` and `bossId`), `main.js` (`bossDefeated`, a forbidden file), and the run recap ("Liquidator defeated"). Keeping that meaning makes `beat-level-1-boss` and `getaway-clear` mean the Liquidator with no parity break (section 10) |
| D3 | The v6 path is **frozen to literal 1.8.1 constants**. It stops importing `apps/hmh-reboot/src/**` | The child branch will change `liquidator-boss.mjs`, `run-progression.mjs` and the archetypes. A v6 bound derived from live child modules would drift, which breaks "today's bounds indefinitely" |
| D4 | The v7 gameplay constants live in a new **`sdk/hmh-run-contract-v7.mjs`**, imported by the verifier and (later) by the child. Parity tests pin them against the 1.8.1 child modules where the value is unchanged | Requirement 2: shared contract constants belong in `sdk/`, and the import graph stays DOM- and arcade-core-free |
| D5 | Boss timing is **per boss**: `firstInitiatedTick ≥ readyTick` and `defeatedTick − lastInitiatedTick ≥ 300`. `boss-before-band` and `HMH_BOSS_START_TICK` are not used for v7 | Section 8 explains why fabrication cannot exploit this |
| D6 | **minFight is structural**, at 300 ticks for every boss: an invulnerable intro of at least 120 ticks, plus 2 thresholds × a 90-tick invulnerable halt, with overshoot clamped. The HP-over-DPS term reduces soundly to one damaging tick per phase | The row carries no level at trigger, and burst damage (the Nuke's 999, stacked grenades) has no bound, so any finite DPS ceiling below the burst is unsound. Section 7.2 has the derivation |
| D7 | Scripted non-boss bodies (guard crews, secret ambushes, dormant Revenants, champion-arena waves) **draw from the director's capacity bank**, so they add no verifier term. Boss adds use a lifetime budget of 4 plus 4 per 960 active ticks for each boss slot | This matches the package's own "scripted spawns go through the capacity bank" (9.4 interim) and "a capacity-banked elite wave" (S2.6), and v6's own Liquidator add rate (6 per 1,440, which is 1 per 240) |
| D8 | Objective XP uses integer per-level constants: switch 18, gate 30, item 12, secret 60 (that is, k × 300 for k = 0.06 / 0.10 / 0.04 / 0.20) | Exact integers, with no floating-point k |
| D9 | The prisoner deal is one pure function in `sdk/`, and the verifier recomputes it from `identity.seed` | Only the OG Miner changes a ceiling (300 × level XP, unmultiplied). The types are never claimed, so they cannot be fabricated |
| D10 | Evidence encoding `hmh-run-summary-v6+json`, runtimeId `lester-blaster:hmh-run-summary-v6`, save schema 2, `hmh-bridge/v1` and the 65,536-byte limit are **unchanged**. The payload's `schemaVersion` selects the rules | These values are fixed by `ranked-identity.mjs` (a forbidden file), a Neon CHECK constraint and the on-chain runtimeId. A maximal v7 bridge message measures about 21.1 KB (section 12) |

---

## 2. Versioning and dispatch

| Item | v7 contract | Tag |
|---|---|---|
| Accepted versions | `validateRunSummaryPayload`: `schemaVersion ∈ {1,2,3,4,5,6,7}`. v1–v6 validate against `HMH_RUN_SUMMARY_CATALOGS_V6`; v7 validates against `HMH_RUN_SUMMARY_CATALOGS_V7` | CHANGED |
| Catalogue selector | `hmhRunSummaryCatalogs(schemaVersion)` returns V7 for 7 and V6 otherwise. `HMH_RUN_SUMMARY_CATALOGS === HMH_RUN_SUMMARY_CATALOGS_V6` (the same frozen object) | NEW |
| Plausibility dispatch | `validateRebootRunPlausibility(summary)`: `schemaVersion === 7` runs the v7 rules (section 7); anything else runs the frozen v6 rules (section 9). The flag shape `{id, severity, value, limit}` is unchanged | CHANGED |
| Time independence | Neither path reads `Date`, `nowMs` or any clock. There is no grace window (the 9.4 "30-day v6 grace window" is NOT ADOPTED, per owner override 2) | UNCHANGED |
| Ranked gate (`server/verify/hmh.mjs:67`) | Must accept `schemaVersion ∈ {6, 7}`. **This file is outside the agreed scope** (section 15). Until the change lands, a Ranked v7 summary is refused as `run-summary-invalid` before plausibility, which is fail-closed | out of scope |
| `hmh.mjs` `contract.bossId` | Stays `kills.boss > 0 ? 'boss-liquidator' : null`. By D2 this remains correct for v7 | UNCHANGED |

---

## 3. Catalogues

`HMH_RUN_SUMMARY_CATALOGS_V6` is today's object, byte-for-byte and frozen. `HMH_RUN_SUMMARY_CATALOGS_V7` is V6 plus the append-only additions below, plus four new catalogues. An id's index never moves.

### 3.1 Appends to existing catalogues

| Catalogue | V6 size | V7 appends, in this order | V7 size |
|---|---|---|---|
| `enemyRoles` | 7 | `rug-puller`, `pump-and-dump-bloater`, `tollkeeper`, `hodl-revenant`, `money-printer`, `oracle-marksman`, `rug-pull-baron`, `lockkeeper`, `fifty-one-percent-foreman` | 16 |
| `collectibles` | 13 | `genesis-seal` | 14 |
| `upgrades` | 24 | `scatter-pump`, `scatter-dump`, `scatter-shells`, `miner-hashrate`, `miner-asic`, `miner-pool`, `rail-blocktime`, `rail-proof`, `rail-mempool`, `launcher-airdrop`, `launcher-yield`, `launcher-bandolier` | 36 |
| `worldSites` | 6 | `relay-uplink`, `hashwood-log-pile`, `hashwood-beacon`, `hashwood-lookout`, `yard-bascule-lever` | 11 |
| `secrets` | 3 | `crossing-behind-the-falls`, `hashwood-hollow-grove`, `mining-collapsed-adit` | 6 |
| `weapons`, `districts`, `pointsOfInterest`, `defeatKinds` | 11 / 6 / 10 / 6 | none | unchanged |

- The enemy-role ids are archetype ids, matching the six existing ones: role `trapper` → `rug-puller`, `burster` → `pump-and-dump-bloater`, `warden` → `tollkeeper`, `revenant` → `hodl-revenant`, `artillery` → `money-printer`, `marksman` → `oracle-marksman`.
- Boss role ids are bare, like `liquidator`. The in-sim target id is `boss-<roleId>`, for example `boss-lockkeeper`; the package's illustrative `boss-the-lockkeeper` is normalised to that.
- The Foreman is `fifty-one-percent-foreman`, not the legacy `fifty-one-percent`, so it can never collide with the arcade-core Level 2 achievement `l2-51-percent`.
- The V7 `worldSites` are exactly the 11 switch-class objectives (the machines). The V7 `secrets` are exactly the 6 secret-class objectives.
- **NOT ADOPTED:** 9.4's "barn doors" and "5 boss triggers" as world sites. Barn doors is a gate objective (section 3.2). Boss triggers are the `bosses` rows; duplicating them as sites would add a second, redundant `firstInitiatedTick` to keep consistent, including the awkward Dark Pool case after a plaza win.

### 3.2 New catalogue `objectives` (25 ids, sorted by id)

`class` fixes the XP constant (section 5.4). `district` is used by flags only. `requires` is used by a flag only.

| # | objectiveId | class | district | requires (flag only) | worldSite / secret |
|---|---|---|---|---|---|
| 0 | `crossing-behind-the-falls` | secret | liquidity-crossing | | secret (S3) |
| 1 | `crossing-mill-storeroom` | gate | liquidity-crossing | | |
| 2 | `crossing-pump` | switch | liquidity-crossing | | site |
| 3 | `farmstead-hidden-supplies` | secret | frontier-relay | | secret (S1) |
| 4 | `hashwood-beacon` | switch | hashwood | `hashwood-lamp-oil` | site |
| 5 | `hashwood-hollow-grove` | secret | hashwood | | secret (S4) |
| 6 | `hashwood-lamp-oil` | item | hashwood | | |
| 7 | `hashwood-log-chute` | gate | hashwood | `hashwood-log-pile` | |
| 8 | `hashwood-log-pile` | switch | hashwood | | site |
| 9 | `hashwood-lookout` | switch | hashwood | | site |
| 10 | `hashwood-shrine` | switch | hashwood | | site |
| 11 | `mining-collapsed-adit` | secret | mining-camp | | secret (S5) |
| 12 | `mining-valve` | switch | mining-camp | | site |
| 13 | `ravine-rope-bridge` | gate | rugpull-ravine | `ravine-winch` | |
| 14 | `ravine-surveyor-cache` | secret | rugpull-ravine | | secret (S2) |
| 15 | `ravine-winch` | switch | rugpull-ravine | `ravine-winch-handle` | site |
| 16 | `ravine-winch-handle` | item | rugpull-ravine | | |
| 17 | `relay-barn-doors` | gate | frontier-relay | | |
| 18 | `relay-power` | switch | frontier-relay | | site |
| 19 | `relay-uplink` | switch | frontier-relay | | site |
| 20 | `warehouse-logbook` | secret | liquidation-yard | | secret (Dark Pool) |
| 21 | `yard-bascule-lever` | switch | liquidation-yard | | site |
| 22 | `yard-port-bascule` | gate | liquidation-yard | `yard-bascule-lever` | |
| 23 | `yard-warehouse` | switch | liquidation-yard | | site |
| 24 | `yard-warehouse-gate` | gate | liquidation-yard | `yard-warehouse` | |

- Class counts are switch 11, gate 6, item 2 and secret 6, matching 3.7 (11 / 6 / 2 / 6).
- Boss-reward gates (Diggings, Lock Gate walkway, Hoist Vault) are not objectives: they grant no XP.
- Havens, strongboxes, stations and re-arm uses are not objectives. A re-arming machine (`hashwood-shrine`) completes once, on its first use.
- The `requires` column holds the two key-item links the package states, plus four gate-to-switch links read from 3.4. Only a flag reads it. The child must wire gates to these switches or amend this table before it ships.

### 3.3 New catalogue `bosses` (4 ids, ordered west to east, which is also ready order)

| # | bossId (= enemy role id) | district | readyTick | threat | kill XP base | kill score base | silver burst | phase thresholds | package target seconds |
|---|---|---|---|---|---|---|---|---|---|
| 0 | `rug-pull-baron` | rugpull-ravine | 7,200 | 24 | 560 | 700 | 15 | 2 (60%, 25%) | 90 |
| 1 | `lockkeeper` | liquidity-crossing | 18,000 | 32 | 720 | 900 | 20 | 2 (65%, 30%) | 105 |
| 2 | `fifty-one-percent-foreman` | mining-camp | 27,000 | 40 | 880 | 1,100 | 20 | 2 (65%, 30%) | 120 |
| 3 | `liquidator` | liquidation-yard | 36,000 | 48 | 1,040 | 1,300 | 25 | 2 (66%, 33%) | 150 |

- Kill XP base is 80 + 20 × threat, and kill score base is 100 + 25 × threat (today's `recordRunDefeat` formula).
- The silver burst **replaces** the 1.8.1 boss drop of `value:10` in v7. A v7 child must not grant both.
- The Liquidator has one row for both triggers (Closing Bell and Dark Pool).
- A champion arena (S2.6 interim) records initiations in its boss's row and never sets `defeatedTick`.

### 3.4 New catalogue `prisonerSlots` (8 ids, sorted by id; the index is the deal index)

| # | slotId | district | held by |
|---|---|---|---|
| 0 | `h1-baron-diggings` | rugpull-ravine | `rug-pull-baron` |
| 1 | `h2-foreman-hoist-vault` | mining-camp | `fifty-one-percent-foreman` |
| 2 | `p1-relay-barn-yard` | frontier-relay | – |
| 3 | `p2-ravine-surveyor-camp` | rugpull-ravine | – |
| 4 | `p3-crossing-boathouse` | liquidity-crossing | – |
| 5 | `p4-hashwood-logging-camp` | hashwood | – |
| 6 | `p5-mining-bench` | mining-camp | – |
| 7 | `p6-yard-warehouse-compound` | liquidation-yard | – |

Prisoner kinds (`prisonerKinds`): `field-medic`, `quartermaster`, `pawnbroker`, `og-miner`.

### 3.5 New catalogue `evolutions` (8 ids, in weapon-catalogue order)

| # | evolutionId | weaponId | mastery (upgrade → rank), used by a flag only |
|---|---|---|---|
| 0 | `settler-rail` | coin-blaster | proof-of-work 3, hot-wallet 3, block-reward 3 |
| 1 | `double-spend` | scatter-shotgun | scatter-pump 3, scatter-dump 3, scatter-shells 3 |
| 2 | `hashstorm-overdrive` | auto-miner | miner-hashrate 3, miner-asic 3, miner-pool 3 |
| 3 | `crypto-bomb-orbit` | launcher-rig | launcher-airdrop 3, launcher-yield 3, launcher-bandolier 3 |
| 4 | `crit-candle` | hash-rail | rail-blocktime 3, rail-proof 3, rail-mempool 3 |
| 5 | `lightning-network` | lightning-ledger | ledger-conductivity 3, ledger-voltage 3, ledger-reconciliation 3, proof-of-network 1 |
| 6 | `burn-address` | bear-market-burner | burner-liquidity 3, burner-volatility 3, burner-contagion 3, total-selloff 1 |
| 7 | `chain-split` | forked-standard | standard-reach 3, standard-force 3, standard-tempo 3, canonical-fork 1 |

The ids for rows 0, 2, 3 and 4 equal today's `HMH_WEAPON_EVOLUTIONS` ids. Wave-2 rows (5–7) are reserved and stay 0 until their policies accept evolutions.

---

## 4. The v7 payload

Every v6 field stays, with v6 shape and v6 rules (sections 1–5 of the v6 validator apply unchanged, using V7 catalogue sizes). Five top-level fields are added. All counters and ticks are integers in 0…1,000,000,000 (the existing `integer()`), unless a narrower range is given. `T` means `identity.endTick`, which equals `totals.survivalTicks` because the start tick is 0. `L` means `totals.level`.

| Field | Shape | Tag |
|---|---|---|
| `schemaVersion` | `7` | CHANGED |
| `identity`, `totals`, `weapons`, `grenades`, `exploration`, `lightningLedger`, `bearMarketBurner`, `forkedStandard`, `defeat` | unchanged | UNCHANGED |
| `kills` | unchanged keys. `byEnemyRole` has 16 rows. **`boss` = Liquidator kills (D2)** | CHANGED (meaning pinned) |
| `collectibles` | 14 rows; `genesis-seal` has `collected` = seals picked up and `activeTicks` = 0 | CHANGED |
| `upgrades` | 36 rows `{upgradeId, offered, selected}` | CHANGED |
| `milestones` | unchanged keys; `sites` has 11 rows and `secrets` has 6. **`bossEngagedTick` = the Liquidator's `firstInitiatedTick`** | CHANGED |
| `objectives` | 25 rows `{objectiveId, completed, tick, levelAtCompletion}` | NEW |
| `prisoners` | 8 rows `{slotId, rescued, tick, levelAtRescue}` | NEW |
| `bosses` | 4 rows `{bossId, initiations, firstInitiatedTick, lastInitiatedTick, defeatedTick}` | NEW |
| `evolutions` | 8 rows `{evolutionId, offered, applied}` | NEW |
| `progression` | `{offersOpened, evolutionOffersOpened, rerolls, sealsFound, sealsBanked, evolutionsApplied, revivesUsed}` | NEW |

Rows are dense, in catalogue order, and keyed by id, exactly like `milestones.sites` in v6. The package wrote sparse `{objectiveIndex, …}` / `{slotIndex, …}` / `{bossIndex, …}` lists; dense id-keyed rows give the same information with exact-key validation and a fixed size. `evolutionOffersOpened` is added because the package's own reroll bound (`rerolls ≤ 2 × (offers + evolution offers)`) needs it. `ruleset` is NOT ADOPTED (owner override 1).

**Field semantics** (the child must emit exactly these):

| Field | Meaning |
|---|---|
| `objectives[i].completed` | 1 once the node first completes (the gate opens, the item is picked up, the secret's hidden volume is entered, the machine's channel or quick fill finishes), else 0 |
| `objectives[i].tick` | The completion tick, or 0 |
| `objectives[i].levelAtCompletion` | The run level on the completion tick, **before** this node's own XP grant, or 0 |
| `prisoners[i].rescued` / `tick` / `levelAtRescue` | The same pattern for the cage-open (rescue) tick |
| `bosses[i].initiations` | How many times this boss's trigger started an engagement (1 plus retreats re-triggered) |
| `bosses[i].firstInitiatedTick` / `lastInitiatedTick` | The first and last initiation ticks, or 0 |
| `bosses[i].defeatedTick` | The defeat tick, or 0 |
| `evolutions[i].offered` | Times the card was shown in an evolution panel, including cards shown by rerolls. "Bank the Seal" is not counted |
| `evolutions[i].applied` | 1 if the gun evolved this run (panel pick or automatic), else 0 |
| `progression.offersOpened` | Level-up offers opened (one per pending level that shows cards) |
| `progression.evolutionOffersOpened` | Evolution panels opened |
| `progression.rerolls` | Rerolls used, in level and evolution panels together |
| `progression.sealsFound` | Genesis Seals picked up |
| `progression.sealsBanked` | Seals banked at the end of the run |
| `progression.evolutionsApplied` | Evolutions applied |
| `progression.revivesUsed` | Golden Parachute revives used |

---

## 5. Shared gameplay contract: `sdk/hmh-run-contract-v7.mjs` (NEW)

A pure module: no imports from `apps/**`, no DOM, no clock. The verifier's v7 path reads **only** this module and the schema module. The child imports the same values. Tests pin every "unchanged" value against today's child modules (the column "pinned against").

### 5.1 Run rules

| Constant | Value | Pinned against (1.8.1) |
|---|---|---|
| `FIXED_STEP_MS` | 1000 / 60 | `simulation.mjs` `FIXED_STEP_MS` |
| `MAX_LEVEL` | 1,000 | `run-progression.mjs` `applyRunXp` |
| `levelThreshold(L)` | 150 × L × (L + 1) | `nextLevelThreshold` |
| `XP_MULTIPLIER_MAX` | 1.75 (validator-training: 0.25 per rank × maxRank 3) | `RUN_UPGRADE_CATALOG` |
| `SCORE_MULTIPLIER_MAX` | 1.75 (block-reward: 0.25 per rank × maxRank 3) | `RUN_UPGRADE_CATALOG` |
| `KILL_XP` | 80 + 20 × threat | `recordRunDefeat` |
| `KILL_SCORE` | 100 + 25 × threat | `recordRunDefeat` |
| `COMBO_MILESTONE_XP` | {5: 120, 10: 240, 20: 480, 30: 900} | `comboMilestoneXp` |
| `CACHE_XP` | {hash-rail-core: 160, lightning-ledger-cache: 220, bear-market-burner-cache: 260, forked-standard-cache: 240} | `COLLECTIBLE_EFFECTS` |
| `SILVER_SCORE_PER_COIN` | 10 | `SILVER_SCORE_PER_COIN` |
| `SILVER_PER_ENEMY_KILL_MAX` | 1 (the Revenant drops 0, per decision 8; 1 is the bound) | `addSilverDrop` default |
| `SILVER_PER_SECRET` | 20 | new (3.7) |
| `OPENING_ENEMIES` | 2 | `HMH_OPENING_ENEMY_ARCHETYPE_IDS.length` |
| `ENCOUNTER_BAND_SCHEDULE` | opening 0–3,599 every 150; build 3,600–17,999 every 90; pressure 18,000–35,999 every 60; elite 36,000–71,999 every 45; boss 72,000–75,599 every 60; endurance 75,600–∞ every 30 | `ENCOUNTER_BANDS` (package 1.2 #18 keeps ids, ticks and intervals) |
| `OBJECTIVE_XP_PER_LEVEL` | {switch: 18, gate: 30, item: 12, secret: 60} | new (3.7: k × 300) |
| `OG_MINER_XP_PER_LEVEL` | 300 (unmultiplied) | new (3.5) |

### 5.2 Enemy threat (`HMH_V7_ROLE_THREAT`)

| Role | Threat | Kill XP max (×1.75, rounded) | Kill score max (×1.75, rounded) |
|---|---|---|---|
| bagholder-rusher | 2 | 210 | 263 |
| forkrunner | 3 | 245 | 306 |
| liquidator-agent | 4 | 280 | 350 |
| gas-bomber | 5 | 315 | 394 |
| validator-cultist | 5 | 315 | 394 |
| whale-enforcer | 6 | 350 | 438 |
| rug-puller | 4 | 280 | 350 |
| pump-and-dump-bloater | 4 | 280 | 350 |
| tollkeeper | 6 | 350 | 438 |
| hodl-revenant | 5 | 315 | 394 |
| money-printer | 6 | 350 | 438 |
| oracle-marksman | 5 | 315 | 394 |
| rug-pull-baron | 24 | 980 | 1,225 |
| lockkeeper | 32 | 1,260 | 1,575 |
| fifty-one-percent-foreman | 40 | 1,540 | 1,925 |
| liquidator | 48 | 1,820 | 2,275 |

- Rounding is JavaScript `Math.round`.
- The first six rows and `liquidator` are pinned against `ENEMY_ARCHETYPES[…].costs.threat` and `LIQUIDATOR_THREAT_COST`.
- The new rows come from package 5.3–5.8 (costs and XP 160 / 160 / 200 / 180 / 200 / 180) and 4.2 (boss threat 24 / 32 / 40 / 48). The child branch pins its new archetypes against this table.

### 5.3 Boss kit (`HMH_V7_BOSS_RULES`) and the obligations it puts on the child

| Constant | Value | Child obligation that makes the verifier bound sound |
|---|---|---|
| `BOSS_INTRO_MIN_TICKS` | 120 | The boss takes **no damage of any kind** (including burn, DoT, hazards, nuke) at any tick `t` with `t − initiationTick < 120` |
| `BOSS_PHASE_HALT_TICKS` | 90 | Crossing an HP threshold at tick `t` clamps the overshoot to the threshold, and the boss takes no damage at ticks `t+1 … t+90`. Every boss has exactly 2 thresholds in v7 |
| `BOSS_MIN_FIGHT_TICKS` | 120 + 2 × 90 = **300** | This follows from the two rows above. An honest defeat is at least 302 ticks after the last initiation (first damage at +120, one tick per phase, 91 ticks between phase ticks); the 2-tick margin absorbs off-by-one tick conventions |
| `BOSS_REINITIATION_MIN_TICKS` | 600 + 120 + 1,800 = **2,520** | A retreat ring appears only after 600 engaged ticks, the retreat channel takes at least 120 ticks, and the boss is ready again only 1,800 ticks after the retreat completes. So consecutive initiations of one boss are at least 2,520 apart, even if "engaged" counts the intro |
| `BOSS_ADDS_FIRST` | 4 | Lifetime add budget for each boss slot: `inserted_b ≤ 4 + 4 × floor(activeTicks_b / 960)`. `activeTicks_b` counts every tick an engagement of slot b is live (initiation to defeat, retreat or run end). **Retreat and re-initiation never refill the budget.** Honours "at most 4 adds" (4.1) |
| `BOSS_ADDS_PER_WINDOW` | 4 | (as above) |
| `BOSS_ADD_WINDOW_TICKS` | 960 | (as above) 4 per 960 equals v6's Liquidator rate (6 per 1,440, i.e. 1 per 240) |
| Scripted bodies | 0 verifier allowance | Guard crews, secret ambushes, dormant Hollow Grove Revenants and champion-arena waves each consume director capacity-bank slots. The bank only accrues due, unused `ENCOUNTER_BAND_SCHEDULE` insertions, so all non-boss, non-opening bodies are at most `directorSpawnCapacity(T)` |
| One boss active | – | At most one boss slot is live at a time (4.1) |
| Seals | – | One Genesis Seal per boss id per run, dropped only on a real defeat (never by a champion arena) |

### 5.4 Objective XP

An objective completed at level L grants `baseXp = OBJECTIVE_XP_PER_LEVEL[class] × L` through `grantRunXp`, so it is multiplied by `xpMultiplier` like kill XP. At the maximum multiplier the grant is `Math.round(baseXp × 1.75)`: switch `round(31.5 L)`, gate `round(52.5 L)`, item `21 L`, secret `105 L`. Objectives never grant score. Level bounties are dropped (3.7).

### 5.5 Prisoner deal (`dealHmhPrisoners(seed)`, exact)

```js
// seededUnit is a byte-for-byte copy of apps/hmh-reboot/src/deterministic-hash.mjs
// seededUnit (FNV-1a with the seed XORed into the offset basis, prime 0x01000193,
// then an xorshift 13/17/5 finaliser). A parity test pins the copy.
export const HMH_PRISONER_KINDS = Object.freeze(['field-medic', 'quartermaster', 'pawnbroker', 'og-miner']);
const DEAL_BASE = ['field-medic', 'field-medic', 'quartermaster', 'quartermaster', 'pawnbroker', 'pawnbroker', 'og-miner', 'og-miner'];

export function dealHmhPrisoners(seed) {            // seed: uint32 (identity.seed)
  const kinds = [...DEAL_BASE];
  for (let i = kinds.length - 1; i > 0; i -= 1) {    // Fisher-Yates, descending
    const j = Math.floor(seededUnit(seed, `prisoner:${i}`) * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  // Repair: districts with two slots (rugpull-ravine = slots 0 and 3,
  // mining-camp = slots 1 and 6), taken in ascending order of their first slot.
  for (const [a, b] of [[0, 3], [1, 6]]) {
    if (kinds[a] !== kinds[b]) continue;
    const k = [0, 1, 2, 3, 4, 5, 6, 7].find((index) => index !== a && index !== b);
    [kinds[b], kinds[k]] = [kinds[k], kinds[b]];
  }
  return Object.freeze(kinds);                        // kinds[i] belongs to prisonerSlots[i]
}
```

- **Correctness.** Each kind appears exactly twice. A duplicate kind T sits only at a and b, so every other slot holds a kind other than T. After the swap, slot b and slot k's district partner both differ from T.
- **Termination.** One pass fixes both districts. A swap for the first district can clear the second's duplicate, but never creates one.
- **Measured** over seeds 0–9,999: 0 duplicates after repair, 2,554 repairs, and each kind appears in each slot 18.8–31.1% of the time.
- **Fixed vectors for tests:**
  - seed 0 → `pawnbroker, field-medic, quartermaster, field-medic, og-miner, quartermaster, og-miner, pawnbroker`
  - seed 1337 → `og-miner, field-medic, quartermaster, field-medic, pawnbroker, quartermaster, og-miner, pawnbroker`

### 5.6 Upgrade max ranks (`HMH_V7_UPGRADE_MAX_RANKS`, flag only)

- The 24 v6 ids keep their 1.8.1 `maxRank` (proof-of-work 3, diamond-hands 3, gas-optimization 2, cold-storage 3, block-reward 3, validator-training 3, compound-interest 25, precision-ledger 3, hard-fork-rounds 3, hot-wallet 3, layer-two 25, hardened-wallet 25, the ledger/burner/standard branch ids 3 each, and the capstones proof-of-network / total-selloff / canonical-fork 1 each). They are pinned against `RUN_UPGRADE_CATALOG`.
- The 12 new ids have `maxRank` 3 and `requiresWeaponId`: `scatter-*` → scatter-shotgun, `miner-*` → auto-miner, `rail-*` → hash-rail, `launcher-*` → launcher-rig (8.2).
- None of the 12 has an XP or score effect. The XP and score multipliers stay validator-training and block-reward only, and evolution `scoreMultiplier` stays unapplied (8.5).

---

## 6. Schema rules (`validateRunSummaryPayload`, v7 branch)

These are structural rules: they use only the payload, catalogue sizes and fixed small caps, and a failure is `run-summary-invalid`. The v6 rules for v1–v6 are byte-identical in behaviour.

| # | Rule | Tag |
|---|---|---|
| S0 | Every v6 rule (identity, totals, kills sums, weapons, ledger, burner, standard, defeat, milestones, grenades, collectibles, upgrades `selected ≤ offered`, exploration, Litecoin) applies with V7 catalogues | UNCHANGED |
| S1 | Payload keys: the v6 list plus `objectives`, `prisoners`, `bosses`, `evolutions`, `progression`, exact. Each new row list is dense, in catalogue order, with exact keys and integer fields | NEW |
| S2 | For each objective: `completed ∈ {0,1}`; completed=1 ⇒ `tick ≤ T` ∧ `1 ≤ levelAtCompletion ≤ L`; completed=0 ⇒ `tick = 0` ∧ `levelAtCompletion = 0` | NEW |
| S3 | For each prisoner: `rescued ∈ {0,1}`; rescued=1 ⇒ `tick ≤ T` ∧ `1 ≤ levelAtRescue ≤ L`; rescued=0 ⇒ `tick = 0` ∧ `levelAtRescue = 0` | NEW |
| S4 | For each boss: `initiations = 0` ⇒ `firstInitiatedTick = lastInitiatedTick = defeatedTick = 0`. `initiations ≥ 1` ⇒ `firstInitiatedTick ≤ lastInitiatedTick ≤ T`, with `initiations = 1 ⇔ firstInitiatedTick = lastInitiatedTick`. `defeatedTick = 0` or `lastInitiatedTick < defeatedTick ≤ T` (so a defeat needs an initiation) | NEW |
| S5 | For each boss b: `kills.byEnemyRole[b].count = (defeatedTick_b > 0 ? 1 : 0)`. This gives at most one kill per boss id, at most 4 boss kills, and at most one Liquidator | NEW (replaces v6's "more than one Liquidator kill") |
| S6 | `kills.boss = kills.byEnemyRole.liquidator.count` | CHANGED (v6: a soft `boss-count-mismatch` flag) |
| S7 | `milestones.bossEngagedTick = bosses.liquidator.firstInitiatedTick` | CHANGED (v6: `bossEngaged` tick from the runtime flag) |
| S8 | For each id in V7 `worldSites`: `sites[id].operated = objectives[id].completed` ∧ `sites[id].tick = objectives[id].tick`. For each id in V7 `secrets`: the same with `found` | NEW |
| S9 | Held prisoners: `h1-baron-diggings.rescued = 1` ⇒ `bosses.rug-pull-baron.initiations ≥ 1` ∧ `rescue tick ≥ its firstInitiatedTick`; `h2-foreman-hoist-vault` likewise with `fifty-one-percent-foreman`. Only an initiation is required, not a defeat, because a champion arena frees the held prisoner without a boss kill | NEW |
| S10 | For each evolution: `applied ∈ {0,1}`; `Σ applied = progression.evolutionsApplied` | NEW |
| S11 | `progression.sealsFound ≤ #{b : defeatedTick_b > 0}`; `evolutionsApplied ≤ sealsFound`; `sealsBanked = sealsFound − evolutionsApplied`; `evolutionOffersOpened ≤ sealsFound` | NEW |
| S12 | `collectibles.genesis-seal.collected = sealsFound` ∧ `collectibles.genesis-seal.activeTicks = 0` | NEW |
| S13 | `offersOpened ≤ L − 1`; `Σ upgrades.selected ≤ offersOpened` | NEW (v6's `upgrades-exceed-levels` is a flag) |
| S14 | `rerolls ≤ 2 × (offersOpened + evolutionOffersOpened)` | NEW |
| S15 | `Σ upgrades.offered ≤ 2 × offersOpened + rerolls`; `Σ evolutions.offered ≤ 2 × evolutionOffersOpened + rerolls` | NEW |
| S16 | `revivesUsed ∈ {0,1}`. revivesUsed=1 ⇒ `bosses.liquidator.defeatedTick > 0` ∧ `secrets.warehouse-logbook.found = 1` ∧ `secrets.warehouse-logbook.tick ≤ bosses.liquidator.lastInitiatedTick` (the Golden Parachute comes only from a Dark Pool win) | NEW |

S13–S15 follow v6's own placement of `selected ≤ offered` in the schema: they relate counters inside one payload.

---

## 7. Plausibility rules (`validateRebootRunPlausibility`, v7 branch)

**Notation**

| Symbol | Meaning |
|---|---|
| `T` | `totals.survivalTicks` |
| `R(role)` | `kills.byEnemyRole[role].count` |
| `B_b` | the bosses row for boss b |
| `D_b` | `B_b.defeatedTick > 0` |
| `I_b` | `B_b.initiations > 0` |
| `end_b` | `D_b ? B_b.defeatedTick : T` |
| `C` | `sdk/hmh-run-contract-v7.mjs` |
| `NEAR` | 0.9 (unchanged) |

### 7.1 Rejects

| id | Condition (reject when true) | value / limit | Tag |
|---|---|---|---|
| `summary-unreadable` | Required objects missing | null / null | UNCHANGED |
| `start-tick-invalid` | `identity.startTick ≠ 0` | startTick / 0 | UNCHANGED |
| `progress-without-time` | progress ∧ (`T = 0` ∨ `elapsedMs = 0`) | elapsedMs / 0 | UNCHANGED |
| `elapsed-time-mismatch` | `|elapsedMs − T × C.FIXED_STEP_MS| > 1` | elapsedMs / expected | UNCHANGED |
| `level-xp-mismatch` | `L ≠ levelForXp(totals.xp)` (curve 150·L·(L+1), cap 1,000) | L / expected | UNCHANGED |
| `boss-before-ready` | for each b with `I_b`: `B_b.firstInitiatedTick < readyTick_b` (7,200 / 18,000 / 27,000 / 36,000). One entry per offending boss, in catalogue order | firstInitiatedTick / readyTick | NEW (replaces `boss-before-band`) |
| `boss-fight-too-short` | for each b with `D_b`: `B_b.defeatedTick − B_b.lastInitiatedTick < 300` | elapsed / 300 | NEW |
| `boss-reinitiation-too-soon` | for each b with `initiations ≥ 2`: `lastInitiatedTick − firstInitiatedTick < (initiations − 1) × 2,520` | elapsed / bound | NEW |
| `kills-above-capacity` | `kills.total > capacity7` (7.3) | total / capacity7 | CHANGED |
| `xp-above-ceiling` | `totals.xp > xpCeiling7` (7.4) | xp / ceiling | CHANGED |
| `score-above-ceiling` | `totals.score > scoreCeiling7` (7.5) | score / ceiling | CHANGED |

### 7.2 minFight derivation (why 300, and why no HP term)

The package asks for `defeatedTick − lastInitiatedTick ≥ minFight`, "from HP scale over a DPS ceiling". The HP is `round(targetSeconds × referenceDps(level at trigger))`, frozen at the trigger.

That term cannot be made sound here:
1. The `bosses` row carries no level at trigger, so the verifier's HP lower bound is `targetSeconds × referenceDps(1)` = 720 / 840 / 960 / 1,200.
2. `referenceDps` is itself a placeholder that S0.3 recalibrates.
3. No sustained-DPS ceiling bounds a single tick: the Nuke deals 999, and stacked grenades and Lockkeeper charge blasts (150) add more.

What the boss kit does guarantee is structure. Threshold clamping limits any one tick to at most one phase's HP. So a 3-phase fight needs at least 3 damaging ticks, separated by the invulnerable intro (≥ 120) and two invulnerable halts (≥ 90 each). Evaluated soundly, "HP over a DPS ceiling" is therefore one damaging tick per phase, and `minFight = 120 + 2 × 90 = 300` (honest minimum 302).

A tighter term would need two things, both **NOT ADOPTED** because they change gameplay or the payload for a few ticks of margin:
- `levelAtTrigger` in the row;
- a per-tick boss damage cap in the kit.

### 7.3 Kill capacity (CHANGED)

```
U          = length of the union of the intervals [B_b.firstInitiatedTick, end_b] over bosses with I_b
capacity7  = C.OPENING_ENEMIES                                   // 2
           + directorSpawnCapacity(T, C.ENCOUNTER_BAND_SCHEDULE) // unchanged formula: per band, floor((min(T, max) − min) / interval) + 1
           + Σ_b [D_b]                                           // the boss bodies (S5 caps each at 1)
           + Σ_b [I_b] × C.BOSS_ADDS_FIRST                       // 4 per slot, once
           + C.BOSS_ADDS_PER_WINDOW × floor(U / C.BOSS_ADD_WINDOW_TICKS)   // 4 × floor(U / 960)
```

Soundness follows from 5.3:
- boss slots are live one at a time, so `Σ activeTicks_b ≤ U`;
- `Σ floor(x_b / 960) ≤ floor(Σ x_b / 960)`;
- every non-boss body except the two opening enemies uses a director schedule slot.

**Worst-case comparison with v6** (T in ticks; "fabricated" means all four bosses initiated at their ready ticks and never defeated; "quick" means each defeated 302 ticks after its ready tick):

| T | v6 capacity | v7 fabricated | v7 quick |
|---|---|---|---|
| 3,600 | 27 | 27 | 27 |
| 10,800 | 107 | 123 | 112 |
| 18,000 | 187 | 239 | 196 |
| 36,000 | 487 | 623 | 506 |
| 64,800 | 1,127 | 1,383 | 1,151 |
| 108,000 | 2,572 | 2,863 | 2,451 |

The worst-case loosening is at most +28% (at 10 minutes). That is v6's own Liquidator add rate (1 per 240) applied from each boss's ready tick instead of from 72,000; the price of bosses that exist from 2:00.

### 7.4 XP ceiling (CHANGED)

```
killXp   = Σ_role R(role) × round((80 + 20 × threat(role)) × 1.75)                           // table 5.2
comboXp  = ceil(kills.total × comboRate),  comboRate = (210 + 420 + 840 + 1575) / 30 = 101.5 // UNCHANGED
cacheXp  = Σ_e collectibles[e].collected × round(CACHE_XP[e] × 1.75)                         // 280 / 385 / 455 / 420, UNCHANGED
objXp    = Σ_{o : completed} round(OBJECTIVE_XP_PER_LEVEL[class(o)] × levelAtCompletion_o × 1.75)   // NEW
ogXp     = Σ_{s : rescued ∧ dealHmhPrisoners(identity.seed)[s] = 'og-miner'} 300 × levelAtRescue_s // NEW, unmultiplied
xpCeiling7 = killXp + comboXp + cacheXp + objXp + ogXp
```

v6's `OBJECTIVE_REWARD_XP` (0) is gone for v7: objective rewards (caches) are covered by `cacheXp`, and nodes by `objXp`.

The prisoner deal enters only here. The summary never claims a prisoner's kind, so "types consistent with XP" holds by construction: a rescue in a non-OG slot adds 0.

### 7.5 Score ceiling (CHANGED)

```
killScore   = Σ_role R(role) × round((100 + 25 × threat(role)) × 1.75)                   // table 5.2
silverCoins = (kills.total − Σ_b R(b)) × 1                                               // ordinary kills (UNCHANGED bound)
            + Σ_b [D_b] × silverBurst_b                                                  // 15 / 20 / 20 / 25, NEW (replaces 10 per Liquidator kill)
            + 20 × Σ_secrets milestones.secrets[s].found                                 // NEW
scoreCeiling7 = killScore + ceil(silverCoins × (10 × 1.75 + 0.5))                        // 18 per coin, UNCHANGED per-grant rounding bound
```

Objectives, prisoners, seals, evolutions and revives grant no score.

### 7.6 Flags (never reject)

| id | Condition | Tag |
|---|---|---|
| `kills-near-capacity` | `kills.total > 0.9 × capacity7` | UNCHANGED (new formula) |
| `xp-near-ceiling` | `totals.xp > 0.9 × xpCeiling7` | UNCHANGED |
| `score-near-ceiling` | `totals.score > 0.9 × scoreCeiling7` | UNCHANGED |
| `xp-above-selected-upgrades` | xp within the hard ceiling but above the ceiling at the claimed multiplier (`xm = 1 + 0.25 × min(3, selected[validator-training])`, applied to kill, combo, cache and objective terms; OG unmultiplied) | UNCHANGED (plus the objective term) |
| `score-above-selected-upgrades` | the same with `sm = 1 + 0.25 × min(3, selected[block-reward])`, and silver at `10 × sm + 0.5` per coin | UNCHANGED |
| `combo-exceeds-kills` | `maxCombo > kills.total` | UNCHANGED |
| `upgrade-rank-above-max` | any `upgrades[u].selected > HMH_V7_UPGRADE_MAX_RANKS[u]` | NEW |
| `evolution-without-mastery` | any `evolutions[e].applied = 1` whose mastery ranks (3.5) are not all met by `upgrades.selected` | NEW |
| `node-level-inconsistent` | Across completed objectives and rescued prisoners, any of: (a) two nodes with `tick_a < tick_b` but `level_a > level_b`; (b) `level ≥ 2` with `tick < milestones.firstLevelUpTick`; (c) `level < L` with `tick > milestones.lastLevelUpTick` | NEW |
| `objective-prerequisite-missing` | a completed objective whose `requires` (3.2) is not completed with a tick ≤ its own | NEW |
| `node-in-unvisited-district` | a completed objective, a rescued prisoner or an initiated boss whose district bit is 0 in `exploration.visitedDistrictMask` | NEW |

These flags cannot raise any ceiling: the hard ceilings use maximum ranks, and districts and prerequisites are free to claim. So they flag honest-client bugs for owner review rather than reject, following the verifier's documented policy.

The v6 flags `boss-count-mismatch`, `boss-engaged-before-band` and `boss-kill-without-engagement` do not apply to v7. They became S6, S7 and `boss-before-ready` / S4.

---

## 8. Dropped and relaxed rules: why fabrication cannot exploit them

| Rule | v6 | v7 | Why a fabricated summary gains nothing |
|---|---|---|---|
| `boss-before-band` (DROPPED for v7) | A boss kill with `T < 72,000` rejects | Per boss: `firstInitiatedTick ≥ readyTick_b` (7,200–36,000) and `defeatedTick − lastInitiatedTick ≥ 300`, with S4/S5 binding each kill to its row | A boss kill is worth a fixed, one-per-id amount (S5): at most 980 / 1,260 / 1,540 / 1,820 XP and 1,225 / 1,575 / 1,925 / 2,275 score plus 15 / 20 / 20 / 25 silver (×18), about **8,440 score for all four together**. It is available only in a run long enough to show that boss's ready tick plus a 300-tick fight. So the earliest claimable Baron kill is at tick 7,500 and the earliest Liquidator kill at 36,300; one tick earlier rejects |
| `HMH_BOSS_START_TICK` (NOT USED for v7) | The Liquidator's body and adds are counted from tick 72,000 | Boss bodies are counted only for defeated rows; adds are `4 × [I_b] + 4 × floor(U / 960)`, with U measured from each claimed `firstInitiatedTick ≥ readyTick` | Claiming extra or earlier initiations buys at most 4 bodies per slot once, plus v6's own Liquidator add rate over the claimed boss time. That is bounded by the run's own ticks (7.3 table: at most +28%). Re-initiation spacing (2,520) stops initiation spam, and the add term does not grow with initiations |

**Commit-message sentences (requirement 3):**
- *boss-before-band:* "v7 replaces the 72,000-tick boss band with per-boss readiness and a 300-tick minimum fight; a fabricated early boss kill still rejects (`boss-before-ready`, `boss-fight-too-short`), and a legitimate one is worth a fixed one-per-boss bonus (S5) that no earlier tick can multiply."
- *HMH_BOSS_START_TICK:* "v7 derives boss bodies and adds from the bosses rows instead of the fixed 72,000 start; adds grow only with claimed boss time at v6's own Liquidator rate (4 per 960 ticks) over the union of boss windows, so extra or earlier claimed initiations cannot raise kill capacity faster than the run's own ticks allow."

**Nearest-impossible rejection tests (all against a valid v7 fixture):**
1. `firstInitiatedTick = readyTick − 1` for each boss → `boss-before-ready`. At `readyTick` → accepted.
2. `defeatedTick − lastInitiatedTick = 299` → `boss-fight-too-short`. At 300 → accepted.
3. `initiations = 2` with `last − first = 2,519` → `boss-reinitiation-too-soon`. At 2,520 → accepted.
4. A Liquidator kill in a v7 run with `T = 36,299` (ready plus 299) → `boss-fight-too-short` (and `boss-before-ready` if the initiation moves earlier).
5. `kills.total = capacity7 + 1`, from adding one ordinary kill to a four-boss run → `kills-above-capacity`.
6. Two Baron kills (`R = 2`) → schema S5.
7. An OG Miner rescue at `levelAtRescue = L` pushing `xp` one past `xpCeiling7` → `xp-above-ceiling`. The same rescue moved to a slot the deal makes `field-medic` → `xp-above-ceiling` (the XP no longer has a source).
8. `silverCoins` one boss burst above the defeated rows → `score-above-ceiling`.

---

## 9. The v6 path, frozen (UNCHANGED behaviour)

`hmh-plausibility.mjs` keeps every v6 rule, flag id, export name and value. Its inputs become a literal `HMH_V6_RULES` table instead of live child imports:

| Input | Frozen value (1.8.1) |
|---|---|
| Bands | as `ENCOUNTER_BAND_SCHEDULE` in 5.1 |
| Opening enemies | 2 |
| `HMH_ROLE_THREAT` | bagholder-rusher 2, forkrunner 3, liquidator-agent 4, whale-enforcer 6, gas-bomber 5, validator-cultist 5, liquidator 48 |
| `MAX_GAINS` | killXp {210, 245, 280, 350, 315, 315, 1,820}; killScore {263, 306, 350, 438, 394, 394, 2,275}; comboRate 101.5; cacheXp {280, 385, 455, 420}; silverScorePerCoin 18 |
| Claimed-rank gains | `xm = 1 + 0.25 × min(3, rank[validator-training])`; `sm = 1 + 0.25 × min(3, rank[block-reward])`; kill XP `round((80 + 20t) × xm)`; kill score `round((100 + 25t) × sm)`; grant `round(base × xm)`; silver `10 × sm + 0.5` |
| `MAX_UPGRADE_RANKS` | the 24 v6 ids of 5.6 |
| `COMBO_MILESTONES` | [[5, 120], [10, 240], [20, 480], [30, 900]] |
| `HMH_BOSS_START_TICK` | 72,000 |
| Liquidator adds | boss-elapsed summons at 1,800 and 2,820 before the endless loop at 3,600, then one per 1,440-tick cycle at offset 1,020, with 6 adds each |
| Silver | 10 per boss kill, 1 per enemy kill, 10 score per coin |
| `OBJECTIVE_REWARD_XP` / `OBJECTIVE_REWARD_SCORE` | 0 / 0 |
| `FIXED_STEP_MS` | 1000 / 60 |
| `HMH_MAX_LEVEL` | 1,000 |

- The existing parity tests keep pinning each literal against the 1.8.1 child modules. When the child branch legitimately changes a module, the test re-points to the literal (the literal is the v6 authority) rather than letting v6 drift.
- **Acceptance:** `validateRebootRunPlausibility` returns deep-equal results before and after for `hmh-valid` (ok, no flags), `hmh-realistic` (ok, no flags), `hmh-level-90` (flagged: `xp-near-ceiling` 1,204,660 / 1,305,994 and `score-near-ceiling` 1,273,095 / 1,279,663), and for every mutation in `tests/server-verify-hmh-plausibility.test.mjs`.

---

## 10. Stats and achievements

The HMH lines of `apps/portal/src/achievements/stats.mjs` change in exactly two ways:
1. The catalogue comes from the summary: `C = hmhRunSummaryCatalogs(summary.schemaVersion)`. v6 summaries therefore produce the same keys, values and order, so the `FIXTURE_STATS_DIGESTS` pins in `tests/server-verify-identity.test.mjs` hold. v7 summaries get a `killsByRole` over 16 roles.
2. `NOT_POWER_UPS = ['litecoin-token', 'genesis-seal']`. This is a no-op for v6, which has no `genesis-seal` row.

Nothing else changes:
- `bossKills = kills.boss` and `bossId = bossKills > 0 ? 'boss-liquidator' : null` stay as they are, and by S6 they mean the Liquidator in v7.
- `HMH_ROLE_FAMILIES` gains nothing. New roles and bosses belong to no legacy hunt family, so `goblin-cleanup`, `drone-swatter` and `gas-beast-hunter` keep their named-enemy meaning.

**Why this and not a per-boss stat.** Three frozen constraints fix it:
- `tests/achievement-derivation.test.mjs` (not editable here) pins `beat-level-1-boss`, `boss-breaker` and `getaway-clear` to `bossKills`, and `boss-rush-ten` to cumulative `bossKills`. It also pins the exact 30 stats keys.
- arcade-core (forbidden) unlocks all of them from one `Boolean(bossId)`, and adds 1 to cumulative boss kills per run.
- A v7 `bossKills` counting district bosses would therefore break browser/server parity for a Baron-only run, and would multiply `boss-rush-ten` by up to 4 on the server only.

**Resulting v7 meaning** (recorded in `docs/game-design/achievement-catalogs-20260923.md`):
- `beat-level-1-boss`, `getaway-clear`, `boss-breaker`, `boss-rush-ten` and `perfectBossKill` all count **the Liquidator only**.
- District bosses count toward none of them until arcade-core and the parity test gain per-boss inputs (section 15).
- v6 meaning is unchanged, since the Liquidator was the only boss.

---

## 11. Emitter obligations for the child branch

The accumulator is `sdk/hmh-run-summary.mjs`. It is left byte-identical in this branch and is versioned in the child branch.

| API | Behaviour |
|---|---|
| `createRunSummaryAccumulator({…, schemaVersion})` | 6 (default until the child flips) or 7. It selects the catalogues, and v7 allocates the new tables |
| `recordRunObjective(state, {objectiveId, tick, level})` | First completion wins. For ids that are also worldSites or secrets it writes the milestone row with the same tick, so S8 holds by construction. In v7, `recordRunMilestone` routes here |
| `recordRunPrisonerRescue(state, {slotId, tick, level})` | First rescue wins |
| `recordRunBossInitiated(state, {bossId, tick})` | `initiations += 1`; `first ||= tick`; `last = tick` |
| `recordRunBossDefeated(state, {bossId, tick})` | Sets `defeatedTick` once. The kill itself still goes through `recordRunKill({enemyRoleId: bossId, …})` |
| `recordRunOfferOpened(state, {kind: 'level' \| 'evolution', cardIds})` | Increments `offersOpened` or `evolutionOffersOpened`, and `offered` for each shown upgrade or evolution id. It replaces `recordRunUpgradeOffer` in v7, and must be called **once per offer**, never again on resume |
| `recordRunReroll(state, {kind, cardId \| null})` | `rerolls += 1`; `offered += 1` for the new card (null for "Bank the Seal" or an exhausted strip) |
| `recordRunSealFound(state, {tick})` | `sealsFound += 1` and `collectibles.genesis-seal.collected += 1` |
| `recordRunEvolutionApplied(state, {evolutionId})` | `applied = 1`; `evolutionsApplied += 1` |
| `recordRunRevive(state, {tick})` | `revivesUsed += 1`, and **clears the pending `defeat`**, so `defeat` stays the killing hit that ended the run |
| `finalizeRunSummary` (v7) | Emits `schemaVersion: 7`. `kills.boss = byEnemyRole.liquidator` (the `boss` flag of `recordRunKill` is ignored for v7); `milestones.bossEngagedTick = bosses.liquidator.firstInitiatedTick`; `sealsBanked = sealsFound − evolutionsApplied` |
| `recordRunProjectileResolution` (v7) | `bossHits` counts hits on any `boss-*` target id, not only `boss-liquidator` |

Gameplay obligations: section 5.3. In addition:
- Objective XP goes through `grantRunXp(OBJECTIVE_XP_PER_LEVEL[class] × levelBeforeGrant)`.
- The OG Miner goes through a new `grantRunLevelSpan` adding exactly `300 × level` XP, unmultiplied.
- A boss defeat grants exactly its silver burst, with no extra 10-coin drop.
- Each found secret grants exactly 20 silver.
- Prisoner, strongbox, secret and haven grants are **not** collectible pickups: `collected` is unchanged, although timed effects they start count in `activeTicks`.

---

## 12. Bridge, save and size (UNCHANGED)

- `hmh-bridge/v1`, save schema 2 and `HMH_MAX_MESSAGE_BYTES = 65,536` do not change. The `boss-defeated` run event stays generic.
- **Size test (NEW):** build a maximal v7 payload (see the list below), wrap it in a `game:run-summary` envelope with a 128-character `sessionId` and a 64-character `messageId`, and assert that the UTF-8 byte length is at most 65,536.
  - every catalogue row present;
  - every integer at its widest admitted value (1,000,000,000; `score` and `xp` at 10^12);
  - float fields as 17-significant-digit values;
  - `buildHash` 128 characters, `heroId` and `causeId` 64.

  Measured at the time of writing: about **21,087 bytes** (the maximal v6 message is about 14,351). That leaves about 68% headroom.
- A valid v7 fixture must also pass `validateChildMessage` (from `sdk/hmh-bridge-protocol.mjs`) as a `game:run-summary`, inside a `createBridgeEnvelope` envelope.
- `server/verify/hmh.mjs` `HMH_RUN_SUMMARY_MAX_JSON` (262,144) is unaffected.

---

## 13. Tests and fixtures in this branch

| File | Contents |
|---|---|
| `tests/hmh-run-summary-schema-v7.test.mjs` (new) | V6 catalogues frozen and `===` to `HMH_RUN_SUMMARY_CATALOGS`; V7 appends exact and in order; one rejection per S1–S16 at its nearest boundary; v1–v6 behaviour unchanged; the bridge size test |
| `tests/server-verify-hmh-plausibility.test.mjs` | v6 results deep-equal (section 9 acceptance); frozen literals pinned against the 1.8.1 child; all the section 8 nearest-impossible tests; ceilings recomputed from `run-progression.mjs` functions for the v7 formulas; `dealHmhPrisoners` vectors, 10,000-seed properties and `seededUnit` parity |
| `tests/server-verify-hmh-v7.test.mjs` (new) | v7 fixtures pass summary-level verification. v7 achievement parity: a Baron-only v7 run unlocks `beat-level-1-boss`, `getaway-clear` and `boss-breaker` on neither side (browser `recordScore` against server derivation); a Liquidator v7 run unlocks them on both |
| Import graph | `tests/server-verify-identity.test.mjs` passes: the new sdk module is pure |

**Fixtures.** They are built only by `tests/fixtures/ranked/build-fixtures.mjs`.
- Existing `hmh-valid`, `hmh-realistic` and `hmh-level-90` bytes do not change.
- New fixtures `hmh-v7-districts` and `hmh-v7-four-bosses` are exported as **`HMH_V7_FIXTURE_NAMES`**, separate from `FIXTURE_NAMES`, so the `FIXTURE_STATS_DIGESTS` key pin and the all-fixtures `verifyRankedRun` loop in `server-verify-identity.test.mjs` are untouched. The no-flags drift check covers both lists.
- XP, level and score come from the real `run-progression.mjs` functions. The OG Miner span is granted while `validator-training` is rank 0, so `grantRunXp(300 × L)` equals the unmultiplied span.
- The v7 bodies are verified with `bindRankedIdentity`, `validateRunSummaryPayload` and `validateRebootRunPlausibility`. End-to-end `verifyRankedRun` waits for the `hmh.mjs` gate (section 15).

The tests to run are the touched files, `tests/*ranked*`, `*settle*` and `*jackpot*` fixture consumers, and the import-graph test. No browser runs and no full release gate.

---

## 14. Not adopted from 9.4

| 9.4 item | Why |
|---|---|
| 30-day v6 grace window | Owner override 2: v6 verifies forever, and the verifier is time-independent |
| Ranked season or ruleset boundary; `progression.ruleset` | Owner override 1: version labels are handled elsewhere |
| "Level entry recomputed from the new 5-entry table" | The summary carries no entry, and the entry confers no ceiling-relevant advantage (capacity, readiness and ceilings are position-free). v7 children span two tables: the S1.5 shipped-map table with the moved `yard` entry, and layout v2's Spawn Meadow / Ravine Approach / West Bank / Hashwood Cut / Mining floor at S2.6. Checking the entry would need the layout marker that override 1 removes |
| Boss triggers and barn doors as `worldSites` | Section 3.1 |
| An HP-over-DPS minFight term | Section 7.2 (unsound without level-at-trigger and a per-tick damage cap) |
| "Per-boss threat, XP and add capacity" as separate add caps per boss | One lifetime budget per slot plus the union-time term (7.3) is tighter and simpler; per-boss XP and threat are in 5.2 |

---

## 15. Required changes outside this branch's agreed scope

1. **`server/verify/hmh.mjs:67`** must accept `schemaVersion ∈ {6, 7}`. It is a one-line change and is neither in scope nor forbidden. `contract.bossId` needs no change (D2). Until this change lands, Ranked v7 is refused (fail-closed).
2. **Child branch** (`apps/hmh-reboot/src/**`, and versioning `sdk/hmh-run-summary.mjs`): sections 5.3 and 11, plus parity tests pinning the new archetypes, bosses and upgrades to `sdk/hmh-run-contract-v7.mjs`.
3. **Portal displays** (`hmh-run-recap.mjs`, `hmh-run-history.mjs`): district-boss kills are not shown. Their existing "Liquidator defeated" semantics stay correct by D2.
4. **arcade-core and `tests/achievement-derivation.test.mjs`**: per-boss achievement inputs (so `boss-breaker` and `boss-rush-ten` can count district bosses) and fencing of the legacy evolution map (8.1). Both files are forbidden or out of scope here.
5. **Parent consumers of the generic `boss-defeated` run event**: audit that none assumes the Liquidator before the child ships district bosses.

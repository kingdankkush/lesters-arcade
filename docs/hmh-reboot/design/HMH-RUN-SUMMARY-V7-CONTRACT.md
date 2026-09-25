# HMH run summary v7 contract

**Status:** contract for the verifier-first slice (branch `fable/hmh-verifier-v7`, base release `60ea173a`, production 1.8.1), implemented on that branch; section 16 records where the implementation had to settle something this contract left open or could not do as written (the schema-7 validator lives in its own sdk module because of the HMH initial-JS budget), and 16.4 records the red-team round that followed (the capacity bank model for boss adds, the build gate, per-level node XP, collectible capacity, the Dark Pool minimum fight and schema rules S9–S18). The child (`apps/hmh-reboot/src/**`) is a later branch and must emit exactly this.
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
| D5 | Boss timing is **per boss**: `firstInitiatedTick ≥ readyTick` and `defeatedTick − lastInitiatedTick ≥ minFightTicks` (300; 180 for the Liquidator). `boss-before-band` and `HMH_BOSS_START_TICK` are not used for v7. Only one boss is live at a time (`boss-fights-overlap`) | Section 8 explains why fabrication cannot exploit this |
| D6 | **minFight is structural**: 300 ticks for a start with an invulnerable intro of at least 120 ticks, plus 2 thresholds × a 90-tick invulnerable halt, with overshoot clamped; **180** for the Liquidator, whose Dark Pool start has no intro (package 4.3). The HP-over-DPS term reduces soundly to one damaging tick per phase | The row carries no level at trigger, and burst damage (the Nuke's 999, stacked grenades) has no bound, so any finite DPS ceiling below the burst is unsound. Section 7.2 has the derivation |
| D7 | Scripted non-boss bodies (guard crews, secret ambushes, dormant Revenants, champion-arena waves, paired spawns) **and every boss add beyond a slot's first 4 draw from the director's capacity bank**, so they add no verifier term. Beyond the director schedule, v7 counts one body per defeated boss and 4 adds per boss slot that had time to summon, once per run | The package's own "scripted spawns go through the capacity bank" (2.7, 9.4 interim) and "a capacity-banked elite wave" (S2.6). The earlier per-slot budget of 4 plus 4 per 960 live ticks let a fabricated summary claim boss time it could not have had (16.4) |
| D8 | Objective XP uses integer per-level constants: switch 18, gate 30, item 12, secret 60 (that is, k × 300 for k = 0.06 / 0.10 / 0.04 / 0.20) | Exact integers, with no floating-point k |
| D9 | The prisoner deal is one pure function in `sdk/`, and the verifier recomputes it from `identity.seed` | Only the OG Miner changes a ceiling (300 × level XP, unmultiplied). The types are never claimed, so they cannot be fabricated |
| D10 | Evidence encoding `hmh-run-summary-v6+json`, runtimeId `lester-blaster:hmh-run-summary-v6`, save schema 2, `hmh-bridge/v1` and the 65,536-byte limit are **unchanged**. The payload's `schemaVersion` selects the rules | These values are fixed by `ranked-identity.mjs` (a forbidden file), a Neon CHECK constraint and the on-chain runtimeId. A maximal v7 bridge message measures 21,235 bytes (section 12) |
| D11 | **Schema 7 only from a v7 build.** A schema-7 summary whose `identity.buildHash` names a game version below `HMH_RUN_SUMMARY_V7_MIN_GAME_VERSION` (1.9.0), or none, rejects (`build-predates-schema-7`). A schema-6 summary stays valid under any build hash | Scores are labelled by game version, and the build hash (the session's, bound to the seed ticket) is the only version a verified run carries, so a 1.8.x-labelled run keeps the 1.8.x bounds. The converse is not a rule: the build hash is the portal's, and a portal at 1.9.0 can host a 1.8.x child cached by the service worker, which still emits schema 6 (owner override 2). No clock is read |

---

## 2. Versioning and dispatch

| Item | v7 contract | Tag |
|---|---|---|
| Accepted versions | `validateRunSummaryPayload`: `schemaVersion ∈ {1,2,3,4,5,6,7}`. v1–v6 validate against `HMH_RUN_SUMMARY_CATALOGS_V6`; v7 validates against `HMH_RUN_SUMMARY_CATALOGS_V7` | CHANGED |
| Catalogue selector | `hmhRunSummaryCatalogs(schemaVersion)` returns V7 for 7 and V6 otherwise. `HMH_RUN_SUMMARY_CATALOGS === HMH_RUN_SUMMARY_CATALOGS_V6` (the same frozen object) | NEW |
| Plausibility dispatch | `validateRebootRunPlausibility(summary)`: `schemaVersion === 7` runs the v7 rules (section 7); anything else runs the frozen v6 rules (section 9). The flag shape `{id, severity, value, limit}` is unchanged | CHANGED |
| Time independence | Neither path reads `Date`, `nowMs` or any clock. There is no grace window (the 9.4 "30-day v6 grace window" is NOT ADOPTED, per owner override 2) | UNCHANGED |
| Build gate | The v7 path rejects `build-predates-schema-7` unless `isHmhV7Build(identity.buildHash)`: the `game-X.Y.Z` segment of the build hash is at least `HMH_RUN_SUMMARY_V7_MIN_GAME_VERSION` = 1.9.0 (`sdk/hmh-run-contract-v7.mjs`). The v6 path reads no build version (D11) | NEW |
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
- `minFightTicks` (5.3) is 300 for the Baron, the Lockkeeper and the Foreman, and 180 for the Liquidator, because its Dark Pool start has no intro.
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
| `objectives[i].levelAtCompletion` | The run level immediately **before** this node's own XP grant, after every earlier grant (including earlier grants on the same tick), or 0. `node-xp-above-level` (7.4) relies on this: a node's grant is received at the level it records |
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
| `HMH_V7_COLLECTIBLE_RULES` | `MAX_PLACEMENTS` 21 (13 world placements + 8 objective rewards), `MIN_REARM_TICKS` 7,200; `hmhV7CollectibleCapacity(T) = 21 × (1 + floor(T / 7,200))` pickups over every collectibles row but `genesis-seal` | `createCollectibleState` (10–13 placements, at most 8 objective rewards, `respawnTicks` 7,200 or 10,800) |
| `HMH_RUN_SUMMARY_V7_MIN_GAME_VERSION` | `'1.9.0'`; `hmhGameVersionOfBuild(buildHash)` reads the `game-X.Y.Z` segment, `isHmhV7Build(buildHash)` compares it | new (D11) |

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
| `BOSS_INTRO_MIN_TICKS` | 120 | A boss started with an intro (every start but the Dark Pool) takes **no damage of any kind** (including burn, DoT, hazards, nuke) at any tick `t` with `t − initiationTick < 120` |
| `BOSS_PHASE_HALT_TICKS` | 90 | Crossing an HP threshold at tick `t` clamps the overshoot to the threshold, and the boss takes no damage at ticks `t+1 … t+90`. Every boss has exactly 2 thresholds in v7 |
| `BOSS_MIN_FIGHT_TICKS` | 120 + 2 × 90 = **300** | This follows from the two rows above. An honest defeat after an intro is at least 302 ticks after the last initiation (first damage at +120, one tick per phase, 91 ticks between phase ticks); the 2-tick margin absorbs off-by-one tick conventions. `minFightTicks` of the Baron, the Lockkeeper and the Foreman |
| `BOSS_MIN_FIGHT_TICKS_WITHOUT_INTRO` | 2 × 90 = **180** | The Dark Pool start has no intro (package 4.3), so an honest Dark Pool kill is at least 182 ticks after the initiation (the two halts). `minFightTicks` of the Liquidator, whose one row covers both of its triggers |
| `BOSS_REINITIATION_MIN_TICKS` | 600 + 120 + 1,800 = **2,520** | A retreat ring appears only after 600 engaged ticks, the retreat channel takes at least 120 ticks, and the boss is ready again only 1,800 ticks after the retreat completes. So consecutive initiations of one boss are at least 2,520 apart, even if "engaged" counts the intro |
| Capacity bank | – | **Every insertion except the two opening enemies, a boss body and a slot's first `BOSS_ADDS_FIRST` adds is made only while the number of such insertions so far is below `directorSpawnCapacity(tick)`** over `ENCOUNTER_BAND_SCHEDULE`. The director's own scheduled insertions, guard crews, secret ambushes, dormant Hollow Grove Revenants, champion-arena waves, paired spawns and every further boss add draw from it; what it cannot cover waits or shrinks. While a boss is live the director is suppressed (`worldRecovery`, 4.1), so a fight refills the bank by at least one slot per 90 ticks (every band from 3,600 on) |
| `BOSS_ADDS_FIRST` | 4 | The adds a boss slot may insert outside the bank, **once per run**: a retreat and re-initiation never refill them |
| `BOSS_ADD_DELAY_TICKS` | 90 | A slot inserts no add in the first 90 ticks of an engagement. The intro bosses are untargetable and passive for at least 120 ticks (4.1); the Liquidator's first adds come in phase 2, after a threshold and its 90-tick halt (4.3) |
| One boss live | – | At most one boss slot is live at a time (4.1): no trigger starts a boss while another is live, so no two bosses are initiated on one tick and none is initiated during another's final fight (`boss-fights-overlap`) |
| Strikes after a defeat | 300 (`HMH_V7_BOSS_STRIKE_AFTER_DEFEAT_TICKS`) | A fallen boss's strikes stop landing within 300 ticks of its defeat (the child clears its telegraphs on defeat; the longest tell is 150). Schema rule S17 |
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
| S9 | Held prisoners: `h1-baron-diggings.rescued = 1` ⇒ `bosses.rug-pull-baron.initiations ≥ 1` ∧ `rescue tick ≥ its firstInitiatedTick` ∧ `rescue tick ≥ its defeatedTick`; `h2-foreman-hoist-vault` likewise with `fifty-one-percent-foreman`. Only an initiation is required, not a defeat, because a champion arena frees the held prisoner without a boss kill; when the boss was defeated, the cage behind its reward gate opens only from the defeat (3.5: "freed on the Baron's defeat") | NEW |
| S10 | For each evolution: `applied ∈ {0,1}`; `Σ applied = progression.evolutionsApplied`. The wave-2 rows (`HMH_V7_RESERVED_EVOLUTIONS`: `lightning-network`, `burn-address`, `chain-split`) have `offered = applied = 0`. `settler-rail.applied = 1` ⇒ `settler-rail.offered ≥ 1` (`HMH_V7_PANEL_ONLY_EVOLUTIONS`: the Pistol never evolves automatically, 8.4) | NEW |
| S11 | `progression.sealsFound ≤ #{b : defeatedTick_b > 0}`; `evolutionsApplied ≤ sealsFound`; `sealsBanked = sealsFound − evolutionsApplied`; `evolutionOffersOpened ≤ sealsFound` | NEW |
| S12 | `collectibles.genesis-seal.collected = sealsFound` ∧ `collectibles.genesis-seal.activeTicks = 0` | NEW |
| S13 | `offersOpened ≤ L − 1`; `Σ upgrades.selected ≤ offersOpened` | NEW (v6's `upgrades-exceed-levels` is a flag) |
| S14 | `rerolls ≤ 2 × (offersOpened + evolutionOffersOpened)` | NEW |
| S15 | `Σ upgrades.offered ≤ 2 × offersOpened + rerolls`; `Σ evolutions.offered ≤ 2 × evolutionOffersOpened + rerolls`; `Σ upgrades.offered + Σ evolutions.offered ≤ 2 × (offersOpened + evolutionOffersOpened) + rerolls` (a re-roll shows one card, in one kind of panel); each `upgrades[u].offered ≤ offersOpened` and each `evolutions[e].offered ≤ evolutionOffersOpened` (a card shown in an offer never comes back in that offer, 8.3) | NEW |
| S16 | `revivesUsed ∈ {0,1}`. revivesUsed=1 ⇒ `bosses.liquidator.defeatedTick > 0` ∧ `secrets.warehouse-logbook.found = 1` ∧ `secrets.warehouse-logbook.tick ≤ bosses.liquidator.firstInitiatedTick`. The Golden Parachute comes only from a Dark Pool win; the trigger that first initiates the Liquidator owns every later initiation (4.3, "one instance per run"), and the mission step records the logbook before the tick's boss starts (3.2, order within a tick), so the Dark Pool owns the fight only when the logbook was entered by the first initiation | NEW |
| S17 | `defeat.kind = 'boss'` ⇒ some boss b has `initiations ≥ 1`, `firstInitiatedTick ≤ defeat.tick` and (`defeatedTick = 0` or `defeat.tick ≤ defeatedTick + 300`). A boss defeat's `causeId` is `boss-<attackId>`, which names no boss, so this is the bound the payload supports | NEW |
| S18 | A gun's cards and evolution are shown only for a gun the run owns: for each upgrade u in `HMH_V7_UPGRADE_WEAPON_GATES` with `offered > 0`, and each evolution (row i ↔ `weapons[i]`) with `offered > 0` or `applied = 1`, the gun is `coin-blaster` (`HMH_V7_START_WEAPON`) or `weapons[gun].pickups ≥ 1` | NEW |

S13–S15 follow v6's own placement of `selected ≤ offered` in the schema: they relate counters inside one payload. S17 and S18 read the v6 rows (`defeat`, `weapons`) against the new ones.

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
| `C` | `sdk/hmh-run-contract-v7.mjs` |
| `NEAR` | 0.9 (unchanged) |

### 7.1 Rejects

| id | Condition (reject when true) | value / limit | Tag |
|---|---|---|---|
| `summary-unreadable` | Required objects missing | null / null | UNCHANGED |
| `build-predates-schema-7` | `¬ isHmhV7Build(identity.buildHash)` (D11) | game version or null / `'1.9.0'` | NEW |
| `start-tick-invalid` | `identity.startTick ≠ 0` | startTick / 0 | UNCHANGED |
| `progress-without-time` | progress ∧ (`T = 0` ∨ `elapsedMs = 0`) | elapsedMs / 0 | UNCHANGED |
| `elapsed-time-mismatch` | `|elapsedMs − T × C.FIXED_STEP_MS| > 1` | elapsedMs / expected | UNCHANGED |
| `level-xp-mismatch` | `L ≠ levelForXp(totals.xp)` (curve 150·L·(L+1), cap 1,000) | L / expected | UNCHANGED |
| `boss-before-ready` | for each b with `I_b`: `B_b.firstInitiatedTick < readyTick_b` (7,200 / 18,000 / 27,000 / 36,000). One entry per offending boss, in catalogue order | firstInitiatedTick / readyTick | NEW (replaces `boss-before-band`) |
| `boss-fight-too-short` | for each b with `D_b`: `B_b.defeatedTick − B_b.lastInitiatedTick < minFightTicks_b` (300; the Liquidator 180) | elapsed / minFightTicks | NEW |
| `boss-reinitiation-too-soon` | for each b with `initiations ≥ 2`: `lastInitiatedTick − firstInitiatedTick < (initiations − 1) × 2,520` | elapsed / bound | NEW |
| `boss-fights-overlap` | some pair of initiated bosses was live at once: an initiation tick (first or last) of one equals one of the other's, or lies strictly inside the other's final fight `(lastInitiatedTick, defeatedTick)`. A boss may start on the tick another falls | pairs / 0 | NEW |
| `kills-above-capacity` | `kills.total > capacity7` (7.3) | total / capacity7 | CHANGED |
| `collectibles-above-capacity` | `Σ_{e ≠ genesis-seal} collectibles[e].collected > hmhV7CollectibleCapacity(T)` (5.1) | pickups / capacity | NEW |
| `node-xp-above-level` | the node XP claimed at some level does not fit it (7.4) | node XP / room, at the first such level | NEW |
| `xp-above-ceiling` | `totals.xp > xpCeiling7` (7.4) | xp / ceiling | CHANGED |
| `score-above-ceiling` | `totals.score > scoreCeiling7` (7.5) | score / ceiling | CHANGED |

### 7.2 minFight derivation (why 300 and 180, and why no HP term)

The package asks for `defeatedTick − lastInitiatedTick ≥ minFight`, "from HP scale over a DPS ceiling". The HP is `round(targetSeconds × referenceDps(level at trigger))`, frozen at the trigger.

That term cannot be made sound here:
1. The `bosses` row carries no level at trigger, so the verifier's HP lower bound is `targetSeconds × referenceDps(1)` = 720 / 840 / 960 / 1,200.
2. `referenceDps` is itself a placeholder that S0.3 recalibrates.
3. No sustained-DPS ceiling bounds a single tick: the Nuke deals 999, and stacked grenades and Lockkeeper charge blasts (150) add more.

What the boss kit does guarantee is structure. Threshold clamping limits any one tick to at most one phase's HP. So a 3-phase fight needs at least 3 damaging ticks, separated by the invulnerable intro (≥ 120) and two invulnerable halts (≥ 90 each). Evaluated soundly, "HP over a DPS ceiling" is therefore one damaging tick per phase, and `minFight = 120 + 2 × 90 = 300` (honest minimum 302).

The Dark Pool start has no intro (package 4.3: he is found at a ledger table and takes ×1.25 damage for 300 ticks), so an honest Dark Pool kill needs only the three damaging ticks and the two halts: at least 182 ticks. The `liquidator` row covers both of its triggers and does not record which one fired, so the Liquidator's `minFightTicks` is `2 × 90 = 180`. The first version of this contract used 300 for every boss, which would have rejected an honest Dark Pool burst kill in 183–299 ticks (16.4).

A tighter term would need two things, both **NOT ADOPTED** because they change gameplay or the payload for a few ticks of margin:
- `levelAtTrigger` in the row;
- a per-tick boss damage cap in the kit.

### 7.3 Kill capacity (CHANGED)

```
capacity7  = C.OPENING_ENEMIES                                   // 2
           + directorSpawnCapacity(T, C.ENCOUNTER_BAND_SCHEDULE) // unchanged formula: per band, floor((min(T, max) − min) / interval) + 1
           + Σ_b [D_b]                                           // the boss bodies (S5 caps each at 1)
           + Σ_b [summon_b] × C.BOSS_ADDS_FIRST                  // 4 per slot that could summon, once

summon_b   = I_b ∧ (B_b.initiations ≥ 2 ∨ D_b ∨ stop_b − B_b.lastInitiatedTick ≥ BOSS_ADD_DELAY_TICKS)
stop_b     = min(T, the first initiation tick (first or last) of another boss after B_b.lastInitiatedTick)
```

Soundness follows from 5.3:
- every body except the two opening enemies, the boss bodies and each slot's first 4 adds draws from the capacity bank, whose total never exceeds `directorSpawnCapacity(T)`;
- each body yields at most one kill (the Revenant's finish is its single kill; a recycled enemy yields none);
- a slot inserts nothing in the first 90 ticks of an engagement. A defeat (at least 180 ticks after the last initiation) or a retreat (a second initiation, after at least 720 engaged ticks) shows an engagement that lasted longer; otherwise the single engagement lasted at most until the run's end or another boss's initiation (one boss live at a time), and a champion arena inserts no boss adds at all.

The first version of this contract added `4 × floor(U / 960)` adds over the union U of the windows `[firstInitiatedTick, defeat or run end]`. A fabricated summary could claim a boss never defeated, so its window ran to the end of the run, on top of the director slots of the same ticks and although another boss's later initiation shows the fight had ended (16.4, red-team finding 1).

**Comparison with v6** (T in ticks; "fabricated" means all four bosses initiated at their ready ticks and never defeated; "quick" means each defeated 302 ticks after its ready tick):

| T | v6 capacity | v7 fabricated | v7 quick |
|---|---|---|---|
| 3,600 | 27 | 27 | 27 |
| 7,200 | 67 | 67 | 67 |
| 7,290 | 68 | 72 | 72 |
| 10,800 | 107 | 111 | 112 |
| 18,000 | 187 | 191 | 192 |
| 36,000 | 487 | 499 | 502 |
| 64,800 | 1,127 | 1,143 | 1,147 |
| 72,000 | 1,288 | 1,303 | 1,307 |
| 108,000 | 2,572 | 2,443 | 2,447 |

At every run length v7 is at most 20 kills (four boss bodies and four slots of four adds) above the director schedule, so at most 20 above v6, and below v6 once v6's Liquidator adds run from 72,000. A boss initiated at its ready tick adds its 4 only when 90 ticks of the run remain (7,200 against 7,290).

### 7.4 XP ceiling (CHANGED)

```
killXp   = Σ_role R(role) × round((80 + 20 × threat(role)) × 1.75)                           // table 5.2
comboXp  = ceil(kills.total × comboRate),  comboRate = (210 + 420 + 840 + 1575) / 30 = 101.5 // UNCHANGED
cacheXp  = Σ_e collectibles[e].collected × round(CACHE_XP[e] × 1.75)                         // 280 / 385 / 455 / 420, UNCHANGED
g_n      = round(OBJECTIVE_XP_PER_LEVEL[class(n)] × ℓ_n × 1.75) for a completed objective,
           300 × ℓ_n for a rescue in a slot dealHmhPrisoners(identity.seed) makes an OG Miner  // ℓ_n = the node's level
nodeXp   = Σ_ℓ ( ℓ < L ? min(Σ_{ℓ_n = ℓ} g_n, 300 × ℓ − 1 + max_{ℓ_n = ℓ} g_n) : Σ_{ℓ_n = L} g_n )  // NEW, by level
xpCeiling7 = killXp + comboXp + cacheXp + nodeXp
```

v6's `OBJECTIVE_REWARD_XP` (0) is gone for v7: objective rewards (caches) are covered by `cacheXp`, and nodes by `nodeXp`.

The prisoner deal enters only here. The summary never claims a prisoner's kind, so "types consistent with XP" holds by construction: a rescue in a non-OG slot adds 0.

**Node levels are claims, so the levels bound them** (`node-xp-above-level`, a reject). A node's grant is received at the level it records (§4) and is at least its ×1 value `m_n` (`OBJECTIVE_XP_PER_LEVEL × ℓ`, or the OG Miner's exact `300 × ℓ`). While the run is at level ℓ below the final level L, every grant but the one that completes ℓ keeps the XP below `threshold(ℓ)`, so it fits in ℓ's span `threshold(ℓ) − threshold(ℓ − 1) = 300 × ℓ`; at L every grant fits in the XP gained since reaching L. The reject is therefore:
- for ℓ < L: `Σ_{ℓ_n = ℓ} m_n − max_{ℓ_n = ℓ} m_n > 300 × ℓ − 1`;
- for ℓ = L: `Σ_{ℓ_n = L} m_n > totals.xp − threshold(L − 1)`.

An OG Miner span always completes the level it is granted at, so no OG Miner is ever rescued at the final level. The same argument with the ×1.75 grants caps `nodeXp` per level (the `min` above): a fabricated summary cannot pack ×1 node minimums into a level and collect them at ×1.75. What remains is the node's level itself, which the rows do not tie to the XP earned by a tick. With the four-boss fixture's kills, every node claimed at the final level reached level 47 before this rule (the red team's honest nodes-last maximum is 46); the rule rejects that, and a greedy packing of the same nodes now reaches 44 (16.4).

### 7.5 Score ceiling (CHANGED)

```
killScore   = Σ_role R(role) × round((100 + 25 × threat(role)) × 1.75)                   // table 5.2
silverCoins = (kills.total − Σ_b R(b)) × 1                                               // ordinary kills (UNCHANGED bound)
            + Σ_b [D_b] × silverBurst_b                                                  // 15 / 20 / 20 / 25, NEW (replaces 10 per Liquidator kill)
            + 20 × Σ_secrets milestones.secrets[s].found                                 // NEW
scoreCeiling7 = killScore + ceil(silverCoins × (10 × 1.75 + 0.5))                        // 18 per coin, UNCHANGED per-grant rounding bound
```

Objectives, prisoners, seals, evolutions and revives grant no score.

The secret term is the one part of the ceiling that no tick bounds: the six secrets are worth at most 6 × 20 coins × 18 = 2,160 score in a run of any length, and a secret's XP grant must fit its level (`node-xp-above-level`). A time floor per secret would need the entry and secret positions and the hero's top speed, which the summary does not carry, the layout changes between the S1.5 fallback and layout v2, and the package keeps movement speed uncapped (8.7). NOT ADOPTED (16.4).

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

These flags cannot raise any ceiling: the hard ceilings use maximum ranks, `node-xp-above-level` and the per-level `nodeXp` cap bound the node levels whatever `firstLevelUpTick` and `lastLevelUpTick` claim, and districts and prerequisites are free to claim. So they flag honest-client bugs for owner review rather than reject, following the verifier's documented policy.

The v6 flags `boss-count-mismatch`, `boss-engaged-before-band` and `boss-kill-without-engagement` do not apply to v7. They became S6, S7 and `boss-before-ready` / S4.

---

## 8. Dropped and relaxed rules: why fabrication cannot exploit them

| Rule | v6 | v7 | Why a fabricated summary gains nothing |
|---|---|---|---|
| `boss-before-band` (DROPPED for v7) | A boss kill with `T < 72,000` rejects | Per boss: `firstInitiatedTick ≥ readyTick_b` (7,200–36,000) and `defeatedTick − lastInitiatedTick ≥ minFightTicks_b` (300; the Liquidator 180), with S4/S5 binding each kill to its row and one boss live at a time | A boss kill is worth a fixed, one-per-id amount (S5): at most 980 / 1,260 / 1,540 / 1,820 XP and 1,225 / 1,575 / 1,925 / 2,275 score plus 15 / 20 / 20 / 25 silver (×18), about **8,440 score for all four together**. It is available only in a run long enough to show that boss's ready tick plus its minimum fight. So the earliest claimable Baron kill is at tick 7,500 and the earliest Liquidator kill at 36,180; one tick earlier rejects |
| `HMH_BOSS_START_TICK` (NOT USED for v7) | The Liquidator's body and adds are counted from tick 72,000 | Boss bodies are counted only for defeated rows; boss adds beyond the director schedule are 4 per slot that could summon, once per run; every further add draws from the capacity bank | No claimed boss timing, fight length, overlap or initiation count adds more than 20 kills (4 bodies and 4 × 4 adds) to the director schedule at any run length (7.3). Re-initiation spacing (2,520) and `boss-fights-overlap` reject the impossible timings outright |
| Liquidator minimum fight (RELAXED within v7, 300 → 180) | – | `minFightTicks` 180 for the Liquidator (its Dark Pool start has no intro) | The kill is still one fixed bonus per run (S5), now claimable from 36,180 instead of 36,300: 120 ticks earlier, with nothing that grows with the earlier tick. An honest Dark Pool kill needs 182 ticks; 179 rejects |
| S16 revive (TIGHTENED) | – | The logbook by the Liquidator's first initiation, not its last | – (a tightening; it rejects a Closing Bell fight re-initiated after the logbook, which cannot earn the Golden Parachute) |

**Commit-message sentences (requirement 3):**
- *boss-before-band:* "v7 replaces the 72,000-tick boss band with per-boss readiness and a minimum fight (300 ticks, 180 for the Liquidator's intro-less Dark Pool start); a fabricated early boss kill still rejects (`boss-before-ready`, `boss-fight-too-short`), and a legitimate one is worth a fixed one-per-boss bonus (S5) that no earlier tick can multiply."
- *HMH_BOSS_START_TICK:* "v7 derives boss bodies and adds from the bosses rows instead of the fixed 72,000 start; beyond the director schedule it counts one body per defeated boss and the first four adds of each slot that could summon, and every further add draws from the capacity bank, so no claimed boss time, overlap or initiation count raises kill capacity by more than 20 over the schedule."
- *Liquidator minimum fight:* "The Liquidator's minimum fight drops from 300 to 180 ticks because its Dark Pool start has no intro; the kill stays one fixed bonus per run, so claiming it 120 ticks earlier gains nothing that grows with time, and a kill 179 ticks after the initiation still rejects."

**Nearest-impossible rejection tests (all against a valid v7 fixture):**
1. `firstInitiatedTick = readyTick − 1` for each boss → `boss-before-ready`. At `readyTick` → accepted.
2. `defeatedTick − lastInitiatedTick = minFightTicks − 1` (299; the Liquidator 179) → `boss-fight-too-short`. At `minFightTicks` → accepted.
3. `initiations = 2` with `last − first = 2,519` → `boss-reinitiation-too-soon`. At 2,520 → accepted.
4. A Liquidator kill in a v7 run with `T = 36,179` (ready plus 179) → `boss-fight-too-short` (and `boss-before-ready` if the initiation moves earlier). At 36,180 → accepted.
5. `kills.total = capacity7 + 1`, from adding one ordinary kill to a four-boss run → `kills-above-capacity`; the same with the Baron never defeated (the red team's 1,386 kills at score 602,974) → `kills-above-capacity`.
6. Two Baron kills (`R = 2`) → schema S5.
7. An OG Miner rescue at a free level ℓ below L pushing `xp` one past `xpCeiling7` → `xp-above-ceiling`. The same rescue moved to a slot the deal makes `field-medic` → `xp-above-ceiling` (the XP no longer has a source); at the final level L → `node-xp-above-level`.
8. `silverCoins` one boss burst above the defeated rows → `score-above-ceiling`.
9. A boss initiated on one tick with another, or inside another's final fight → `boss-fights-overlap`; back to back (initiated on the tick the other falls) → accepted.
10. A schema-7 summary on a `game-1.8.99` (or 1.8.1, or unparseable) build → `build-predates-schema-7`; `game-1.9.0` → accepted.

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
- Collectible pickups come only from authored placements within `HMH_V7_COLLECTIBLE_RULES` (at most 21, re-armed no sooner than 7,200 ticks after a pickup), as `createCollectibleState` enforces today.
- `levelAtCompletion` and `levelAtRescue` are the level immediately before the node's own grant, after every earlier grant of the tick (§4): record the node and grant its XP one node at a time.
- The mission step records `warehouse-logbook` before the tick's boss starts (package 3.2, order within a tick), so a Dark Pool initiation is never earlier than the logbook tick, and the first trigger to fire keeps the Liquidator for the run (4.3).
- Every gun but the starting Pistol records a weapon pickup (`recordRunWeaponEvent({type: 'pickup'})`) when the run first owns it, before any of its cards or its evolution is shown (S18).
- A boss hit keeps `weaponId: 'boss-<attackId>'`, and a fallen boss's strikes stop landing within 300 ticks of its defeat (S17).
- The capacity bank covers every insertion but the opening enemies, boss bodies and each slot's first 4 adds, the director's own scheduled insertions included (5.3). A boss inserts no add in the first 90 ticks of an engagement.
- The game version (`GAME_VERSION`, the `game-X.Y.Z` of the build hash) of the release that first emits schema 7 is at least `HMH_RUN_SUMMARY_V7_MIN_GAME_VERSION` (1.9.0). If the child ships under another version, the constant moves with it in the same commit.

---

## 12. Bridge, save and size (UNCHANGED)

- `hmh-bridge/v1`, save schema 2 and `HMH_MAX_MESSAGE_BYTES = 65,536` do not change. The `boss-defeated` run event stays generic.
- **Size test (NEW):** build a maximal v7 payload (see the list below), wrap it in a `game:run-summary` envelope with a 128-character `sessionId` and a 64-character `messageId`, and assert that the UTF-8 byte length is at most 65,536.
  - every catalogue row present;
  - every integer at its widest admitted value (1,000,000,000; `score` and `xp` at 10^12);
  - float fields at their widest JSON: 17 significant digits after five leading zeros (`0.0000012345678901234567`, 24 characters);
  - `buildHash` 128 characters, `heroId` and `causeId` 64.

  Measured: **21,235 bytes** (the maximal v6 message is 14,295). That leaves about 68% headroom.
- A valid v7 fixture must also pass `validateChildMessage` (from `sdk/hmh-bridge-protocol.mjs`) as a `game:run-summary`, inside a `createBridgeEnvelope` envelope.
- `server/verify/hmh.mjs` `HMH_RUN_SUMMARY_MAX_JSON` (262,144) is unaffected.

---

## 13. Tests and fixtures in this branch

| File | Contents |
|---|---|
| `tests/hmh-run-summary-schema-v7.test.mjs` (new) | V6 catalogues frozen and `===` to `HMH_RUN_SUMMARY_CATALOGS`; V7 appends exact and in order; the contract constants (minimum fights, add delay, weapon gates, reserved and panel-only evolutions, the build gate, collectible capacity); one rejection per S1–S18 at its nearest boundary, with the red-team payloads; v1–v6 behaviour unchanged; the bridge size test with the widest float |
| `tests/server-verify-hmh-plausibility.test.mjs` | v6 results deep-equal (section 9 acceptance, and unchanged under any build hash); frozen literals pinned against the 1.8.1 child; all the section 8 nearest-impossible tests; ceilings recomputed from `run-progression.mjs` functions for the v7 formulas; `dealHmhPrisoners` vectors, 10,000-seed properties and `seededUnit` parity; the 7.3 table and the 20-kill bound at every run length; the red-team payloads (undefeated and nested boss windows, bosses initiated at the end, overlapping fights, nodes at the final level, the zero-kill secret run, a 1.8.1 build, a million Railgun cores); the `createCollectibleState` limits pinned |
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
| "Per-boss threat, XP and add capacity" as separate add caps per boss | Every add beyond a slot's first 4 draws from the capacity bank (7.3), which is tighter and simpler; per-boss XP and threat are in 5.2 |
| A per-secret or per-objective time floor (red team) | Needs entry and node positions and a hero speed cap that the summary and contract do not carry (7.5, 16.4) |
| `engagedTicks` per boss row (red team) | A fabricated summary would claim the largest engaged time its rows allow, and the capacity bank model makes boss time irrelevant: it buys no capacity (7.3) |

---

## 15. Required changes outside this branch's agreed scope

1. **`server/verify/hmh.mjs`** must validate with the schema-7 module and accept `schemaVersion ∈ {6, 7}`: two lines, the import at `:7` (`validateRunSummaryPayload` from `../../sdk/hmh-run-summary-schema-v7.mjs`, see 16.1) and the gate at `:67`. Neither is in scope nor forbidden. `contract.bossId` needs no change (D2). Until both land, Ranked v7 is refused (fail-closed) with `run-summary-invalid` / `game:run-summary schemaVersion is invalid`; `tests/server-verify-hmh-v7.test.mjs` pins that answer, so it fails, as it should, when the gate opens.
6. **The bridge and the portal** (`sdk/hmh-bridge-protocol.mjs`, `apps/portal/src/hmh-run-history.mjs`, `apps/portal/src/hmh-reboot-bridge.mjs`): they validate run summaries with the base schema module, which accepts schema 1-6 only (16.1). The child branch switches them to `sdk/hmh-run-summary-schema-v7.mjs` when the child starts emitting schema 7, and funds the bytes (about 5.8 KB minified) from its own HMH initial-JS budget.
2. **Child branch** (`apps/hmh-reboot/src/**`, and versioning `sdk/hmh-run-summary.mjs`): sections 5.3 and 11, plus parity tests pinning the new archetypes, bosses and upgrades to `sdk/hmh-run-contract-v7.mjs`.
3. **Portal displays** (`hmh-run-recap.mjs`, `hmh-run-history.mjs`): district-boss kills are not shown. Their existing "Liquidator defeated" semantics stay correct by D2.
4. **arcade-core and `tests/achievement-derivation.test.mjs`**: per-boss achievement inputs (so `boss-breaker` and `boss-rush-ten` can count district bosses) and fencing of the legacy evolution map (8.1). Both files are forbidden or out of scope here.
5. **Parent consumers of the generic `boss-defeated` run event**: audit that none assumes the Liquidator before the child ships district bosses.

---

## 16. Implementation record (branch `fable/hmh-verifier-v7`)

Where the implementation settled a point this contract left open, or could not follow it as written.

### 16.1 The schema-7 validator is its own sdk module (D1 amended)

- **Finding.** `sdk/hmh-run-summary-schema.mjs` is on the initial path of the 1.8.x child (`apps/hmh-reboot/src/bridge.mjs` validates its own messages with `validateChildMessage`) and of the portal (`hmh-run-history.mjs`), in a shared chunk that `build.mjs` counts against the 1,048,576-byte HMH initial-JS cap. At `60ea173a` the build measured 1,046,713 bytes, so 1,863 bytes of headroom. Putting the V7 catalogues and the S1-S16 rules in that module adds 5,812 bytes minified, and the build then fails (`1,052,556 > 1,048,576`).
- **Decision.** `sdk/hmh-run-summary-schema.mjs` keeps a `validateRunSummaryPayload` that accepts schema 1-6 (its rules factored into an exported `validateRunSummaryRules(payload, catalogs, laterFields)`), exports `HMH_RUN_SUMMARY_CATALOGS_V6` and keeps `HMH_RUN_SUMMARY_CATALOGS` as the same object. **`sdk/hmh-run-summary-schema-v7.mjs`** holds `HMH_RUN_SUMMARY_CATALOGS_V7`, `hmhRunSummaryCatalogs`, `HMH_V7_HELD_PRISONER_BOSSES`, `HMH_V7_PROGRESSION_FIELDS`, and a `validateRunSummaryPayload` that accepts schema 1-7: it delegates 1-6 to the base module (the same answer, word for word) and validates 7 with the v6 rules on the V7 catalogues, then S1-S18. Since 16.4 it also holds the constants rules S10, S17 and S18 read (`HMH_V7_START_WEAPON`, `HMH_V7_UPGRADE_WEAPON_GATES`, `HMH_V7_RESERVED_EVOLUTIONS`, `HMH_V7_PANEL_ONLY_EVOLUTIONS`, `HMH_V7_BOSS_STRIKE_AFTER_DEFEAT_TICKS`); `sdk/hmh-run-contract-v7.mjs` refuses to load if its tables disagree with them.
- **Cost.** The factoring adds 48 bytes to the HMH initial JS (1,046,713 → 1,046,761; 1,815 bytes of headroom left); the child entry is unchanged (360,738 of 480,000). The V7 catalogues reach the portal's `main.js` only, through `achievements/stats.mjs` (about 2.2 KB minified, against the 2,710,000-byte main-bundle budget of `scripts/hmh-load-speed-report.mjs`; `main.js` measured 1,176,793 bytes at `60ea173a`), outside the HMH budget.
- **Guards.** `tests/hmh-run-summary-schema-v7.test.mjs` bundles what the child and the portal take from the base module with `build.mjs`'s esbuild options and holds it within 64 bytes of the 10,802 it measured at `60ea173a`, checks that the base module carries no V7 catalogue, and runs the 801-case schema 1-6 corpus through both validators against the digest taken at `60ea173a`.
- **Consequences.** Section 15 items 1 and 6.

### 16.2 Choices the contract left open

- **New soft flags.** `upgrade-rank-above-max`, `evolution-without-mastery`, `node-level-inconsistent`, `objective-prerequisite-missing` and `node-in-unvisited-district` are one entry each; `value` is the number of offending rows and `limit` is 0. The flag shape `{id, severity, value, limit}` is unchanged.
- **Boss window length** (superseded by 16.4: boss time no longer enters the capacity).
- **Prisoner kinds** are `HMH_PRISONER_KINDS` in `sdk/hmh-run-contract-v7.mjs`; they are not a summary catalogue (the summary never carries a kind), so V7 has the four new catalogues of 3.1 and no fifth.
- **Boss HP.** `hmhV7BossHp(bossId, referenceDps)` takes the child's calibrated reference DPS; the verifier never reads HP (7.2).
- **Node-level flag (b)** compares a node's tick with `milestones.firstLevelUpTick`, which the 1.8.1 accumulator stamps at the next `recordRunTick` after the level-up. A node completed in the same tick as the kill that caused the first level-up can therefore raise it for an honest run; it is a soft flag only. The child branch should stamp the level-up tick where it happens.
- **Maximal bridge message.** With a 128-character `sessionId` and a 64-character `messageId`: 21,235 bytes for schema 7 and 14,295 for schema 6 (section 12), with the widest float JSON (24 characters).

### 16.3 Fixtures

- Both carry the build hash `site-1.9.0:game-1.9.0` (`HMH_V7_FIXTURE_BUILD_HASH`, D11), so their seeds differ from the first version of this branch.
- `hmh-v7-districts` (verdict ok): 15 minutes through all six districts, 24 objectives, 7 prisoners (two OG Miners at this seed), the Baron and the Lockkeeper (after one retreat) defeated, two Seals banked, no Liquidator.
- `hmh-v7-four-bosses` (verdict flagged, `score-near-ceiling` only): 18 minutes, every objective and prisoner, all four bosses (the Baron at exactly its ready tick, the Liquidator through the Dark Pool at 55,200), the Pistol mastered and evolved (Settler Rail) with a boss's Seal, three Seals banked, one Golden Parachute revive. Its salt is `fixtureSalt('hmh-v7-four-bosses:1')`, the first whose seed deals the Pistol's mastery cards before the last boss falls. Block Reward is offered only three times at this seed, so mastery takes it early and the honest score sits near its ceiling, as in `hmh-level-90`.
- Both are the real 1.8.1 accumulator's summary extended to schema 7 by `tests/fixtures/ranked/build-fixtures.mjs` (the accumulator is versioned in the child branch), with XP, level and score from `run-progression.mjs`. They are listed as `HMH_V7_FIXTURE_NAMES`, apart from `FIXTURE_NAMES`, and record the binding, the plausibility verdict and the evidence digest instead of a VerifiedRun until the gate of 15.1 opens.

### 16.4 Red-team round (three attacks against `ff265ab8`)

Every reproduced hole has a failing test built from its payload, now passing; the v6 path and the existing fixture bytes are unchanged. "A0-1" is attack 0, finding 1.

| Finding | Disposition | Where |
|---|---|---|
| A0-1 (high): boss-add capacity ran to the end of the run for a boss never defeated (+83,448 score at 18 minutes), and variant A nested three fights inside one | **Fixed.** Every add beyond a slot's first 4 draws from the capacity bank (5.3, D7); capacity7 is the schedule plus boss bodies plus 4 per slot that could summon (7.3), at most 20 above the schedule at any run length. The red-team payload (1,386 kills, score 602,974) rejects `kills-above-capacity` at 1,146, under the red team's own honest bound of 1,162; variant A rejects `boss-fights-overlap` | `v7: claimed boss time buys no kill capacity beyond the first adds of each slot` |
| A0-2, A1-1 (medium): schema 7 accepted under any build hash, so a 1.8.x-labelled run could carry v7 rules | **Fixed.** `build-predates-schema-7` (D11). The reverse direction (reject schema 6 at 1.9.0 or later) is **not adopted**: the build hash is the portal's, and a newer portal can host a 1.8.x child cached by the service worker, which owner override 2 keeps valid | `v7: a schema-7 summary from a build older than the first v7 child rejects` |
| A0-3 (low): a boss initiated on the last tick still bought 4 adds | **Fixed.** No add in an engagement's first 90 ticks (`BOSS_ADD_DELAY_TICKS`); a single undefeated engagement ends at the run's end or at another boss's initiation. The red-team payload (two bosses initiated at T) also rejects `boss-fights-overlap` | `v7: a boss initiated too late to summon adds no first adds` |
| A0-4, A1-2 (low): two bosses fought at once; a held prisoner freed while its boss still lived | **Fixed.** `boss-fights-overlap`; S9 requires the rescue at or after a defeated boss's defeat | `v7: two bosses live at once reject`; `S9` |
| A0-5, A2-2 (low, XP only): node levels were free claims (every node at the final level: level 47 against an honest 46; 30 → 33 with verdict ok) | **Fixed.** `node-xp-above-level` and the per-level `nodeXp` cap (7.4). The free `firstLevelUpTick` / `lastLevelUpTick` claims feed only soft flags, which no longer guard a ceiling, so making `node-level-inconsistent` a reject is **not adopted** | `v7: node XP beyond what its level can hold rejects`; `v7: the XP ceiling counts at most one level span of node XP per level below the final one` |
| A0-6 (low, inherited from v6): `collectibles[*].collected` unbounded (a million Railgun cores funding level 1,000; 250 Berserk Candles) | **Fixed for v7** (`collectibles-above-capacity`, 5.1). The v6 path is frozen and keeps the inherited gap (owner override 2) | `v7: more collectible pickups than the placements can give reject` |
| A0-7 (info): a revive after a plaza win | **Dismissed** for its payload: under 4.3 "one instance per run" a Liquidator first initiated at the logbook tick is a Dark Pool fight. S16 now reads the **first** initiation, which rejects the real plaza case (a Closing Bell start, a retreat, then the logbook). A logbook found before the Liquidator was ready and a later start stays indistinguishable from a Dark Pool entry at that tick; a revive moves no ceiling | `S16` |
| A0-W1, A1-4: an honest Dark Pool kill in 183–299 ticks was rejected | **Fixed.** The Liquidator's `minFightTicks` is 180 (7.2); the relaxation's argument is in section 8 | `v7: a defeat one tick short of the minimum fight rejects; the minimum passes`; `v7: a Liquidator kill in a run of 36,179 ticks rejects; at 36,180 it passes` |
| A1-3 (low, display only): killed by a boss never initiated | **Fixed.** S17: a boss defeat needs a boss initiated by then and not fallen more than 300 ticks before. `causeId` names an attack (`boss-<attackId>`), not a boss, so this is the bound the payload supports | `S17` |
| A1-5 (low): the revive depended on an unstated same-tick order | **Fixed** as a child obligation (section 11), from package 3.2's order within a tick (mission step before boss starts) | section 11 |
| A1 documentation: the 7.3 envelope figures; `speed-clear`'s stale reason | Superseded by the new 7.3 table; `docs/game-design/achievement-catalogs-20260923.md` row 43 updated for schema 7 | – |
| A1: v6 `boss-count-mismatch` is only a flag | Unchanged by design (v6 frozen) | – |
| A2-1: six secrets in a zero-kill, few-tick run scored 1,260 with verdict ok | **Partly fixed.** The exact payload (XP 299) now rejects `node-xp-above-level`: the secrets' XP must fit their level. A tick floor per secret is **not adopted** (7.5): it needs positions and a speed cap the contract does not hold. Residual: at most 2,160 score per run from secret silver, independent of the run's length | `v7: node XP beyond what its level can hold rejects` |
| A2-3: wave-2 evolution applied; an evolution of a gun never owned; the Pistol evolved with no panel; evolution cards with no panel (re-rolls counted in both panels); one card shown more often than offers | **Fixed** in the schema: S10 (reserved rows, panel-only Pistol), S15 (combined count, one showing per offer), S18 (weapon ownership) | `S10-S12`, `S13-S15`, `S18` |
| A2-3: levels with no offers opened | **Dismissed.** A lower bound on offers is not sound: level-ups pending at the final defeat and levels with full rank capacity open no offer, and offers move no ceiling | – |
| A2-3: rank above max, evolution without mastery | Flags by design (the hard ceilings use maximum ranks) | – |
| A2-4: the bridge size test's float was not the widest | **Fixed.** The widest admitted float prints 24 characters (`0.0000012345678901234567`); the maximal v7 message is 21,235 bytes | `a maximal schema-7 run summary message fits the hmh-bridge/v1 limit` |

**Residuals** (accepted, recorded for the integration owner):
- Kill score and XP are credited at each claimed role's threat, so a fabricated summary can put its kills in the highest-threat ordinary role (threat 6). This is v6's rule too; tightening it needs a per-role spawn model the director does not expose.
- Secret silver: at most 2,160 score per run, independent of run length (7.5).
- Node levels: the per-level bound leaves a node's level otherwise free (7.4).
- A schema-6 summary can carry any build hash (D11).

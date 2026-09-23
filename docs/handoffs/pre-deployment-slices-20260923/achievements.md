# Slice brief: achievements (wave 1, starts after chikun-tune is merged)

**Worktree:** `C:/Users/just_/lesters-arcade-wt/achievements`, branch `fable/pd-achievements`, based on the integration branch **after** `fable/pd-chikun-tune` merges. Its Chikun stats and thresholds need the v6 counters and the harness JSON `docs/qa/chikun-difficulty-harness-20260923.json`.

**Read first:**
- contract `docs/handoffs/pre-deployment-interface-contract-20260922.md` (if it is missing from your worktree, read `C:/Users/just_/lesters-arcade-fable0916/docs/handoffs/pre-deployment-interface-contract-20260922.md`) §6 (all of it), §2.1, §5.3 (the contract field mapping), §10, §11;
- guide §5.5 item 2 and §5.6 items 1, 2, 4 (the recorded part), 6 (layout), 7 (data); decisions D5, D6, D7, D15.

## Goal

1. One pure achievement catalog per game, shared by browser and server:
   - Hard Money Heroes keeps its **57**;
   - Chikun's Escape gets **40**;
   - STACKED gets **40**.
2. The stats mappers (§6.3) and the pure `deriveEarnedAchievements`.
3. The HMH resolver fixes, so local and server agree.
4. The ERC-721 metadata generator and folder layout (published in phase 2).
5. A proposed NFT subset of 5 per game, flagged but **not** defined on chain.

## Acceptance criteria

1. `apps/portal/src/achievements/{index,hmh,chikun,stacked,stats,metadata}.mjs` exist with exactly the §6.1 and §6.2 APIs.
   - They are pure ESM with no DOM, `Date`, `Math.random` or `process`.
   - They import nothing from `arcade-core.mjs` or `hmh-run-integrity.mjs`: that would create a cycle, because `arcade-core` may import from here later.
   - They are importable from plain Node 24 (a test proves it).
2. Every catalog entry matches the §6.1 shape and is frozen. Ids are unique across all three games (test).
3. **HMH parity.** The 57 ids, titles and tiers equal `ACHIEVEMENT_DEFINITIONS` in `arcade-core.mjs:1509-1573`, and a test compares them via `ACHIEVEMENT_LIST`.
   - Every non-Level-2 entry is either `available:true` with criteria over §6.3 HMH stats plus history, or `available:false` with a one-line reason in the design doc.
   - Target: at least 44 of the 50 non-L2 ids available.
   - The 7 `l2-*` ids are `available:false` ("Coming with Level 2").
4. **Chikun (40):** 14 bronze, 12 silver, 9 gold, 5 platinum.
   - Themes from guide §5.6 item 2: reach each region after farmland; complete 1 and 2 loops; survive 2, 4, 6, 8, 10 and 12 minutes; forks passed; near-miss streaks; coins in one run; best combo; flawless regions; speed milestones; cumulative runs and cumulative distance.
   - **Thresholds are calibrated from the harness JSON**:

     | Tier | Reachable around |
     | --- | --- |
     | bronze | novice p50 |
     | silver | intermediate p50 |
     | gold | expert or hardcore p50 |
     | platinum | exceptional p90 or above ("top few percent") |

   - The design doc records the percentile each threshold came from.
5. **STACKED (40):** the same tier spread.
   - Criteria use **tuple-only** stats (§6.3 `statsFromStackedTuple`). There are no singles, doubles or triples, spin clears, stack height or zone snapshots beyond `zoneForTick(ticks)`.
   - Themes: first Halving and Halving counts; levels reached; perfect clears; spins; combo and back-to-back chains; lines in one run and cumulative; survival time; score milestones; garbage survived; cumulative sessions.
   - Calibrate from `apps/stacked/src/dev/soak-pilot.mjs` runs and the existing 16 Free medals (`apps/stacked/src/free-medals.mjs:5-22`) as anchors.
6. **NFT candidates** (contract §6.1): exactly 5 `nft:true` for Chikun and 5 for STACKED, and exactly 3 for HMH.
   - Chikun and STACKED: all platinum (replay-verified stats).
   - HMH: `two-hundred-ranked-runs`, `two-fifty-ranked-runs` and `arcade-legend-500` only. They depend on server-counted paid runs. `marathon-wallet` and `perfect-boss-gauntlet` stay `nft:false`, because HMH is plausibility-checked and those criteria rest only on client-attested survival and no-damage fields. Say so in the design doc, so the owner can revisit it in phase 2.
   - `nftAchievementIds(gameId)` returns them in catalog order. Nothing reads the stored `achievement_unlocks.nft` to decide a mint or a badge (contract A20); the catalog is the source.
   - No NFT wording anywhere in phase 1 (contract A32): the design doc may say "proposed for phase 2", but catalog titles and descriptions never mention NFTs.
7. `deriveEarnedAchievements` meets §6.2 (determinism, order, exclusion of `history.unlockedIds`, `available:false` never returned). `historyFieldsFor` returns only paths matching `^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)?$` that exist as numbers in that game's stats.
8. **Stats mappers:**
   - `statsFromChikunResult` works on a real v6 replay result;
   - `statsFromStackedTuple` works on a real tuple (`tests/fixtures/stacked-golden-run.json` or a soak-pilot run);
   - `statsFromHmhRunSummary` works on a summary built with `sdk/hmh-run-summary.mjs` `createRunSummaryAccumulator` / `recordRunKill` / `recordRunGrenade` / `recordRunCollectible` / `finalizeRunSummary`.
   - Output shapes match §6.3 exactly (tests deep-equal the key sets).
   - `hmhResolverInputsFromRunSummary` (§6.4) is exported with the **exact keys** of contract §6.4: `enemyKillsByType` keyed by the legacy ids the resolver reads (`'fud-goblin'`, `'sybil-drone'`, `'gas-beast'`, from `HMH_ROLE_FAMILIES`), and `stageIndexReached` derived from `districtsVisited` (`≥ 6 → 13`, `≥ 4 → 8`, `≥ 2 → 4`, else `1`), matching the catalog's slums, foundry and getaway criteria. The resolver's own reads are at `arcade-core.mjs:4700-4760`.
   - **Parity test:** the HMH fixtures go through both the legacy resolver (fed by the mapper) and `deriveEarnedAchievements`, and must produce the same HMH ids, except entries documented `available:false` and history-based ids.
9. **HMH resolver fixes in `arcade-core.mjs`:**
   - `maybeUnlockRunAchievements` (`:5503-5543`) returns `[]` for any game other than `lester-blaster`, so Chikun no longer gets HMH ids;
   - its `paidRuns` input is `progress.paidRuns` (HMH-scoped), not `profile.totalPaidRuns`;
   - `ACHIEVEMENT_TIER_UNLOCK_PCT` (`:6033`) gets a `mythic` value below `diamond`;
   - `achievement-progress.mjs` `METRICS.paidRuns` reads HMH progress and its label drops "(all games)".
   - `profile.totalPaidRuns` still increments (it is a display counter).
10. **Metadata:** `scripts/generate-achievement-metadata.mjs` (npm script `achievements:metadata`) writes `apps/portal/achievements/<lester-blaster|chikun|stacked>/<id>.json` for every available achievement, per §6.6.
    - The output is deterministic, with sorted keys and a trailing newline. Committed files equal the generator output (test).
    - Every `image` resolves to an existing file under `apps/portal`.
11. **Badges.** Chikun and STACKED have no badge art. Generate placeholder badges with `scripts/generate-game-achievement-badges.py` (Pillow): tier frame from `apps/portal/assets/generated/hmh-achievement-atlas/tier-<tier>.png`, plus a small game glyph taken from existing cabinet art. The output is 48×48 RGBA unlocked and locked (greyed) PNGs in `apps/portal/assets/generated/achievement-badges/{chikun,stacked}/<tier>.png` and `locked-<tier>.png`. Keep the total under 60 KB. Raw generator output that is not shipped goes to the vault or a gitignored folder, never the repo (AGENTS.md asset hygiene).
12. **Owner review doc** `docs/game-design/achievement-catalogs-20260923.md` lists all 137 achievements with id, title, tier, category, the criteria in plain words, availability and reason, NFT proposal flag, and the calibration source. The owner reviews it at checkpoint O1 (contract §10.1), which happens after this slice merges and before any production deploy. Put a short "What to review" list at the top: the thresholds, the unavailable HMH ids, and the NFT proposal.

## Files

- **You own:** contract §10.2, row achievements.
- **Read-only:**
  - every Chikun runtime file (chikun-tune owns them; request changes instead of making them);
  - `sdk/**` (**never** edit it: shared chunk, HMH child cap);
  - `apps/hmh-reboot/**`;
  - `main.js`;
  - `api/**`, `server/**`.

## Interfaces

- **Produced:** §6.1, §6.2, §6.3, §6.4 and §6.6. The verify slice consumes the stats mappers; settle consumes `deriveEarnedAchievements`, `historyFieldsFor` and `nftAchievementIds`; index's history SQL receives `historyFieldsFor` output by injection; results-share and profile-boards consume `catalogFor` and `achievementById`; contracts' `define-nft-achievements.mjs` consumes `nftAchievementIds` and `catalogFor`.
- **Consumed:** the chikun-tune v6 counters; `sdk/hmh-run-summary-schema.mjs` `HMH_RUN_SUMMARY_CATALOGS` (enemy roles, weapons); `stacked-sim.mjs` `zoneForTick`; `chikun-ground-course.mjs` `distanceAtTick`; `chikun-course-regions.mjs`.

## Plan

1. **`stats.mjs` and its fixtures first:** `tests/fixtures/achievements/{hmh-run-summary.json, chikun-v6-result.json, stacked-tuple.json}`, generated by a small script that you commit under `tests/fixtures/achievements/build-fixtures.mjs`. Define the HMH family table (`HMH_ROLE_FAMILIES`) mapping child `enemyRoles` to the legacy family names used by the three hunt achievements. Suggested mapping (UNVERIFIED; record the final choice in the doc):
   - `goblin`: `bagholder-rusher`, `forkrunner`;
   - `drone`: `liquidator-agent`, `validator-cultist`;
   - `gasBeast`: `gas-bomber`;
   - `enforcer`: `whale-enforcer`.

   Grenade kills are `grenades.kills`. Melee kills are the `kills.byWeapon` counts for `litecoin-knife` plus `forked-standard`. `weaponsUsed` lists weapons with `equippedTicks > 0`. `powerUpsCollected` is the sum of `collectibles[].collected`, excluding `litecoin-token`.
2. **`hmh.mjs`.** Suggested criteria for the tricky ids (G1-G6 of the HMH map); adopt or improve, and document each:

   | Id | Criterion |
   | --- | --- |
   | `beat-level-1-boss`, `boss-breaker` | `bossKills ≥ 1` |
   | `no-damage-boss` | `perfectBossKill = 1` (whole-run no damage; the boss phase is not tracked) |
   | `slums-clear` | `districtsVisited ≥ 2` |
   | `foundry-clear` | `districtsVisited ≥ 4` |
   | `getaway-clear` | `districtsVisited ≥ 6` and `bossKills ≥ 1`. **Keep the id**: it is the Lester legacy migration key (`hmh-character-config.mjs`). |
   | `hash-rail-specialist` | `hash-rail ∈ weaponsUsed` |
   | `spread-ltc-specialist` | `scatter-shotgun ∈ weaponsUsed` |
   | `damage-chain` | `damageDealt ≥ <calibrated>` in one run, or `available:false` |
   | `lucky-survivor`, `all-bosses-scouted` | `available:false` (inputs missing; the reboot has one boss) |
   | `speed-clear` | The boss appears at tick 72,000 (about 20 min), so "boss under 8 minutes" is impossible: `available:false` or a documented remap |
   | volume ids | `history.runs + 1 ≥ N` (HMH-scoped) |
   | cumulative ids | `history.sums[path] + run.stats[path] ≥ N` |

   Images:
   - available HMH ids: `/assets/generated/achievement-badges/<id>.png` and `/assets/generated/achievement-badges/locked-<id>.png`;
   - `l2-*` ids: the atlas files `/assets/generated/hmh-achievement-atlas/achievement-<id>.png`. Check the exact names in `hmh-achievement-atlas-manifest.mjs`, and normalize `./assets/…` to `/assets/…`.
3. **`chikun.mjs` and `stacked.mjs`** per acceptance 4 and 5, with `progress()` for cumulative and threshold entries.
4. **`index.mjs`** per §6.2, including `achievementId32(ethers, id) = ethers.id(id)`.
5. **`metadata.mjs` and the generator** per §6.6. Run the generator, commit the JSON, and add the npm script.
6. **Resolver fixes** in `arcade-core.mjs` and `achievement-progress.mjs` per acceptance 9. Update these pinned tests:

   | Test | Change |
   | --- | --- |
   | `tests/achievement-progress.test.mjs:142-148` "completed Ranked volume uses the parent all-game completion counter…" | Rewrite to assert the HMH-scoped counter. Keep the file's other tests. The `:132` rule "no truthy `minted` or `verified` on rows" still holds. |
   | `tests/arcade-core.test.mjs:260` "WO-58 profile v2 model …" | Chikun no longer grants HMH achievements. Keep the Lester legacy-migration expectation, which comes from `getaway-clear` in state. |
   | `tests/arcade-core.test.mjs:3072` `achievementRarityPct` ordering | Add mythic. |

   Tests `:558`, `:585` and `:1788` exercise the HMH resolver directly and should keep passing. If one fails because of the HMH-only gate, fix the test input (use `gameId 'lester-blaster'`) and not the gate.
7. **Tests:**

   | File | Test |
   | --- | --- |
   | `tests/achievement-catalogs.test.mjs` | "catalog sizes, tiers and NFT picks match the owner decisions" |
   | | "HMH catalog mirrors ACHIEVEMENT_DEFINITIONS ids, titles and tiers" |
   | | "every entry is frozen, uniquely identified and image-backed" |
   | | "catalog modules import without arcade-core or DOM" (static import-graph scan with acorn, which is already a devDependency) |
   | `tests/achievement-derivation.test.mjs` | "stats mappers produce the contract shapes from real runs" |
   | | "derivation excludes already-unlocked and unavailable entries" |
   | | "cumulative criteria add history sums to the current run" |
   | | "Chikun runs never earn HMH achievements" |
   | | "history field paths are safe SQL identifiers" |
   | | "bronze thresholds are reachable at the novice median, platinum sits at or above exceptional p90" (reads the harness JSON) |
   | | "HMH resolver inputs use the legacy enemy ids and stage thresholds" |
   | | "legacy resolver and server derivation agree on HMH fixtures" |
   | | "HMH NFT candidates are only server-counted run totals" |
   | `tests/achievement-metadata.test.mjs` | "generator output is deterministic and matches committed files" |
   | | "metadata carries soulbound attributes and reserves animation_url" |

8. Register the new modules and tests in `scripts/syntax-check.mjs` immediately after `"tests/achievement-progress.test.mjs",`. Register `scripts/generate-game-achievement-badges.py` in the separate `PY_COMPILE_FILES` list (`:754`) immediately after `'scripts/build-chikun-ground-motion.py',`.

## Verification

```
node --test tests/achievement-*.test.mjs tests/arcade-core.test.mjs tests/hmh-achievement-atlas.test.mjs tests/hmh-wo90-placeholder-redo.test.mjs tests/hmh-art-redo-queue.test.mjs
npm run achievements:metadata && git diff --exit-code apps/portal/achievements
npm test && npm run check && npm run contracts:check && npm run build && npm run test:release   # exactly 51
```

## Pitfalls

- **Do not add Chikun or STACKED entries to `ACHIEVEMENT_LIST` / `ACHIEVEMENTS` in `arcade-core`.** The atlas and art-queue tests pin 57, and `unlockAchievement` throws for foreign ids.
- **Do not change Chikun's in-runtime `result.achievements`** (the four `chikun-*` ids in `chikun-cabinet.mjs:50-55`). Replay equality compares them. The new catalog is separate. You may reuse those four ids as bronze entries (with the same thresholds), which keeps the profile view consistent.
- **`combo` in v5 equals `forksPassed`.** Use v6 `bestCombo` only.
- **HMH `maxCombo` / `bossId` / `killsByType` in `main.js` come from stale legacy globals** (HMH map §3.6). Do not wire the call site; that is the ranked-client slice's job. You only provide `hmhResolverInputsFromRunSummary`.
- **Keep the modules small.** They are portal-only, but share-card rendering and the server import them too.
- **No arcade-core imports.** `hmh-run-integrity.mjs` imports `arcade-core`, so importing it would pull the 362 KB module into the server path. Take the enemy and weapon catalogs from `sdk/hmh-run-summary-schema.mjs`.

## Definition of done

- The acceptance criteria hold and the owner-review doc is committed.
- The metadata JSON and placeholder badges are committed.
- The gate shows exactly 51. Do not commit the gate JSON.
- The syntax-check entries are added.
- The final commit message lists the 13 NFT candidates (5 Chikun, 5 STACKED, 3 HMH) and the count of `available:false` HMH ids, and asks the orchestrator to schedule owner checkpoint O1.

# HMH verifier round 3: hand-off

**Branch:** `fable/hmh-verifier-r3`, from `4f947386` (release 1.8.4, verifier v7).
**Scope:** the pre-deploy session's verdict on the holes that already exist in live 1.8.x Ranked: nine items and one owner decision, listed at the end. This note is written item by item as the branch lands them. The contract stays `docs/hmh-reboot/design/HMH-RUN-SUMMARY-V7-CONTRACT.md`; the v7 hand-off (`HMH-VERIFIER-V7-HANDOFF.md`) describes the twelve 1.8.4 rules this round builds on.

**Standing rule for every new reject in this round.** It needs (1) a rejection test of a faked summary, (2) proof that no run in either honest corpus is rejected, with every flag listed, and (3) a commit message that says why every honest run passes. The two corpora are:

- the **scripted model**, `tests/fixtures/ranked/hmh-honest-corpus.mjs` (75 runs, 3.6 million ticks). Its pilots move through the child's own world modules, accumulator and progression, but combat is scheduled, not simulated, so it reaches each rule's bound on purpose. It proves a rule's arithmetic against honest bounds; it does not prove what the child emits;
- the **real-child corpus**, `tests/fixtures/hmh-honest-corpus/real-child-<release>.json` (item 8, below): summaries the unmodified child emitted over `hmh-bridge/v1` while headless honest pilots drove it. It proves what the child emits; it does not reach every bound.

A rule that needs honest coverage the corpora lack (melee-only play, Forked Standard kills, tiny runs, brawler runs) gets a pilot style and plan rows in the harness first, and the runs are committed before the rule.

## Item 8: the real-child honest corpus

### What landed

- **The harness is in the repository:** `scripts/hmh-honest-corpus/` (its `README.md` has the commands). It boots `apps/hmh-reboot/src/main.mjs` in Node against browser-global and Pixi stand-ins, acts as the parent over `hmh-bridge/v1` with a Ranked `portal:init`, and drives the child one 60 Hz frame at a time with a virtual gamepad. Ten honest pilot styles (suicide, kamikaze, camper, idle, brawler, grenadier, hunter, explorer, turtle, greedy) read only what a player sees and answer with stick and button input; firing, melee and dodges stay automatic, as shipped. Read-only spies remember the state objects the child's factories return; nothing writes simulation state. Every message the child posts is validated with `validateChildMessage`.
- **Identities are real Ranked identities** under the public fixture secret of `tests/fixtures/ranked/build-fixtures.mjs`: a seed ticket per plan row, its salt searched until the ticket's seed lands on the planned level entry. The build hash is what this checkout's portal sends (`site-<SITE_VERSION>:game-<GAME_VERSION>:cabinet-<HMH_CABINET_VERSION>`), so every child release plays fresh seeds from the same 68-row plan. `verify` runs each summary through `verifyRankedRun` on a full §5.1 body (ticket, identity, a session envelope built from the child's own run events) and through `validateRebootRunPlausibility`, and records how close each run came to every v6 rule.
- **The 68 runs of the live 1.8.3 child** (source `3cbd2538`, `site-1.8.3:game-1.8.3:cabinet-0.5.0`, captured 2026-09-26 by the pre-deploy session from the vault batch) are committed as `tests/fixtures/hmh-honest-corpus/real-child-1.8.3.json`: 1,033,873 ticks (2,291 to 38,054; median 14,342), every level entry (13 to 14 runs each), both heroes (34 each), all ten styles; 54 ended by death and 14 by death after the pilot reached its tick cap and walked into the crowd. Under this branch's verifier: `verifyRankedRun` ok for all 68; plausibility 66 ok and 2 flagged, none rejected. The flags are `kills-near-capacity` on `r08-brawler-relay-3000` (78 kills against a capacity of 86 at 8,971 ticks) and `score-near-ceiling` on `r62-grenadier-yard-110000` (40,312 against 44,067). Two runs logged child errors that the 1.8.4 crash hotfix (`b300740a`) since fixed, and both still verify: r19 (six `hit bear-market-burner:...:boss-liquidator references unknown target` at tick 8,306) and r21 (one `cannot refill Lightning Ledger while channeling`).
- **The test** `tests/server-verify-hmh-real-corpus.test.mjs` pins each file's run count and summary digest (1.8.3: `ecd897f5…c697`), checks every summary is schema 6, bound to its harness identity (seed, build hash, hero, mode `ranked`, terminal reason `defeated`, end tick) and maps through `statsFromHmhRunSummary`, and asserts that no run is rejected and that each run carries exactly the flags listed for it. `tests/server-verify-hmh-real-corpus-harness.test.mjs` checks the plan, the identities (the committed 1.8.3 seeds are this plan's under the 1.8.3 build hash; the same rows play different seeds under 1.8.4), the corpus serializer, and boots this checkout's child headless through the bridge handshake (300 frames, no errors, every message valid, spawned at the seeded entry).
- **The scripted corpus is now labelled a model** in its test header and in the v7 hand-off's §1 and §4.

### The 1.8.4 sample

Pending in this note until the twelve-run sample of this checkout's child (`batch.mjs run --sample`: one run per style, every entry, both heroes, identity `site-1.8.4:game-1.8.4:cabinet-0.5.0`) has been verified and committed as `real-child-1.8.4.json`.

### What the real corpus does and does not cover

It covers the play the ten pilots produce: gun play with every weapon, grenades thrown and launched, pickups and machinery sites, full-map exploration, boss approaches (no pilot has yet killed the Liquidator), surrender runs, kamikaze self-damage. It does **not** yet cover melee-only or knife-heavy play, Forked Standard kills as a deliberate style, tiny runs (the shortest is 2,291 ticks), or a Liquidator kill. Items 1 to 6 of this round must add those pilots and runs before their rules land.

## Items 1 to 7, 9 and the owner decision

Not started in this note's first version. The verdict, verbatim from the pre-deploy session, is the authority:

1. Melee trail: knife kills need knife contacts/triggers (triggers ≤ ceil(T/20)); Forked Standard kills vs contacts only after the corpus models melee and Standard contacts. Add `meleeKills` to the stats-field inventory.
2. Tiny runs: district gate for placement capacity and a minimum end tick for non-empty defeated runs, keeping the empty 2-tick terminal-pilot run legal. Correct contract §16.6 "Fixed" to partial for R0-1, R0-4, P3.
3. Per-role kill capacity by band (`ENCOUNTER_BANDS.allowedRoles`, `DISTRICT_ROLE_GATES`) with a parity test.
4. XP and score lower bounds per kill.
5. Grenade contacts need `detonated > 0`; launcher-rig kills need launcher triggers.
6. `directorSpawnCapacity` starts at tick 600 (with item 2).
7. `reverifyStoredRun`: a failure only on rules newer than the row's `verified_at` is wait/owner-review, not a deterministic rejection. If that code lives outside this branch's scope, the exact patch and its test are described here for the pre-deploy session.
9. Docs: `seed.mjs:48` citation, §15 numbering, the §13 table.

Owner decision to surface: combo achievements (`big-combo`, `max-combo-30`) cannot be bounded from the v6 summary (`maxCombo ≤ kills` only): residual, or withhold.

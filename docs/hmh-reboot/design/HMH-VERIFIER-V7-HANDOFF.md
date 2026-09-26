# HMH verifier v7: hand-off

**Branch:** `fable/hmh-verifier-v7`, written from release `60ea173a` (production 1.8.1), rebased onto integration `da3c0756` (the jackpot-contracts merge), then onto integration `b7c8307a` (1.8.3 live, plus HMH perf steps 1–2 and the jackpot-ui slice for 1.8.4), and pushed to `origin`.
**Contract:** `docs/hmh-reboot/design/HMH-RUN-SUMMARY-V7-CONTRACT.md` (the authority; this note summarises it).
**Design source:** `docs/hmh-reboot/design/LEVEL-1-DESIGN-PACKAGE-20260925.md`, with two owner overrides: no Ranked season or ruleset boundary, and the v6 path verifies 1.8.x children indefinitely with today's bounds (no clock anywhere in the verifier).

## 1. Where things stand

- The server can verify a run summary of **schema 7** at summary level: `validateRunSummaryPayload` from `sdk/hmh-run-summary-schema-v7.mjs`, then `validateRebootRunPlausibility`.
- **Ranked still refuses schema 7**, and that is deliberate (fail-closed). `server/verify/hmh.mjs` validates with the base schema module and requires schema 6. It is outside this branch's scope; opening the gate is two lines, once the contract §15.1 preconditions hold.
- **The v6 path is in behaviour what 1.8.1 shipped, except twelve 1.8.4 rejects for fabricated inputs** (contract §16.5 and §16.6). The first four (`grenade-kills-above-weapon-kills`, `pickups-above-capacity`, `district-path-invalid`, `districts-before-travel-time`) close a live 1.8.2 issue: a paid run of 36 kills verified with 250 grenade kills, 250 bonus lives and all six districts, and earned five achievements. A second red team found fabricated summaries that still earned achievements (zero-tick runs, locked pickups, weapons never picked up, grenade kills with nothing launched, one damage field, a combo above the kills). Eight more rejects close them: `activity-without-time`, `equipped-ticks-above-run`, `weapon-without-source`, `grenade-kills-above-contacts`, `grenade-detonations-above-launches`, `grenades-thrown-above-supply`, `damage-dealt-mismatch` and `combo-above-kills`. The pickup capacity now also counts each placement only once it is unlocked and available. Two hashed corpora prove the rest against `60ea173a`: the 288 plausibility mutations (with the twelve new flags removed) and the 801 schema 1–6 cases. A pinned 75-run honest corpus shows no honest 1.8.x run is touched. That corpus is a **scripted model** of honest play (combat scheduled, not simulated); round 3 added the real child's own summaries, 68 headless runs of the live 1.8.3 child and a sample of the 1.8.4 child (`tests/fixtures/hmh-honest-corpus/`, `HMH-VERIFIER-R3-HANDOFF.md`), which the twelve rules also leave untouched.
- **One child change, for 1.8.4** (contract §16.6, R1-1 and R1-2). The portal forwards `?evidenceSafe=1` in any mode. Since 1.8.0 that made a Ranked hero invulnerable to everything but the Liquidator, and spawned it at the Frontier Relay for every seed. That spawn also made the Ranked e2e's terminal-pilot run fail `district-path-invalid` for four seeds in five. A Ranked session now ignores both (`apps/hmh-reboot/src/main.mjs`, three lines); Free evidence runs and the terminal pilot are unchanged. It is a runtime change, so the release needs browser certification, including the Ranked e2e's HMH leg (`scripts/ranked-live-browser-e2e.mjs`).
- The existing fixtures (`hmh-valid`, `hmh-realistic`, `hmh-level-90` and the Chikun and STACKED ones) are unchanged. The build-fixtures drift check passes for all nine.
- Save schema 2, `hmh-bridge/v1`, the 65,536-byte message limit, the evidence encoding `hmh-run-summary-v6+json` and the runtimeId are unchanged. A maximal v7 bridge message is 21,235 bytes.

## 2. What changed

**Commits (oldest first)**

The hashes are the ones after the second rebase, onto `b7c8307a`. Neither earlier set is an ancestor of the branch: the first-written ones (`128f6a8e` … `2e5230f5`), nor the ones after the rebase onto `da3c0756` (`6e6b477e` … `74a8546f`, in the same order as the table; that rebase's gate record `b56de0e9` was dropped in favour of the release line's). The red teams attacked `ff265ab8` (now `4f5023f4`) and `a9663a09` (now `7668da79`); code comments and contract §16.4 and §16.6 still name those attacked hashes.

| Commit | Change |
|---|---|
| `4a9f6005` | The design package and the run summary v7 contract (docs only) |
| `fe9046a0` | Schema 7 in the new `sdk/hmh-run-summary-schema-v7.mjs`, and the shared contract module `sdk/hmh-run-contract-v7.mjs` |
| `5823c382` | The v6 plausibility path frozen to literal 1.8.1 constants (`HMH_V6_RULES`); it no longer imports `apps/**` |
| `86a97b00` | The v7 plausibility rules and the two v7 fixtures |
| `19a233c3` | Achievement stats map schema 7; the boss achievements mean the Liquidator |
| `4f5023f4` | Contract §16: implementation decisions (the red team attacked it as `ff265ab8`, before the first rebase) |
| `0bc0a1be` | Red-team fixes: capacity bank model, build gate, per-level node XP, collectible capacity, Dark Pool minimum fight, schema rules S9–S18 (contract §16.4) |
| `3abece7a`, `a0148ae4` | This note, and the results of the rebase onto `da3c0756` |
| `0c03df53` | The 1.8.4 v6 consistency rejects (contract §16.5), with parity pins, boundary tests and the 1.8.2 payload end to end; the fixture builder walks districts from the seed's entry |
| `fe1667a2` | The pinned 75-run honest corpus for those rules |
| `08a283bd` | Each half of the v7 S8 comparison refused on its own, and the milestone-only A2-1 K1 variant |
| `0722882c` | The v7 ceilings, kill capacity and cache room pinned as literals; a hashed v7 mutation corpus; boss-before-ready at tick 0; each soft-flag sub-condition; `grenade-kills-above-weapon-kills` on the v7 path |
| `177bf1c8` | The S10 reserved rows with `applied = 1, offered = 0`; S14 and S15 per kind at their boundary |
| `7668da79` | The build-gate limits, the §15.1 preconditions and the first-round v6 rules in the contract and this note (attacked as `a9663a09`) |
| `4b6db050` | The second red-team round (contract §16.6): eight more v6 consistency rejects, the unlock-gated pickup capacity, and a Ranked session that ignores `evidenceSafe`'s spawn and invulnerability (the child's one change) |
| `7d0ef15d` | The second red-team round in the contract and this note |
| (this commit and the next) | The rebase onto `b7c8307a`: these hashes, the gate results and the new headroom; then the release gate record regenerated on the rebased branch |

**By file**

| File | What it now holds |
|---|---|
| `sdk/hmh-run-summary-schema.mjs` | Schema 1–6, unchanged in behaviour. The V6 catalogues are frozen. The rules are factored into `validateRunSummaryRules`, so schema 7 can reuse them. It stays small: the 1.8.x child and the portal load it on the HMH initial path (+48 bytes) |
| `sdk/hmh-run-summary-schema-v7.mjs` (new) | The V7 catalogues and a validator for schema 1–7. It delegates 1–6 to the base module and checks rules S1–S18 for 7. It also holds the small constants those rules read: start weapon, weapon gates, reserved and panel-only evolutions, strike grace |
| `sdk/hmh-run-contract-v7.mjs` (new) | The shared gameplay contract: run rules, threat for 16 roles, the boss kit and its obligations, the four bosses (ready ticks, minimum fights), objectives, prisoner slots and the seeded prisoner deal, evolutions, upgrades, collectible limits and the build gate. It is pure: no DOM, no clock, no `apps/**` import. It refuses to load if its tables disagree with the schema module |
| `server/verify/hmh-plausibility.mjs` | The v6 path, frozen apart from the twelve 1.8.4 consistency rejects (`HMH_V6_CONSISTENCY_RULES`), and the v7 path. The summary's `schemaVersion` chooses between them |
| `apps/hmh-reboot/src/main.mjs` | `evidenceGameplayEnabled` (`evidenceSafe` outside Ranked) now drives the evidence spawn and the hero's invulnerability; a Ranked session always spawns at its seeded entry and can be hurt |
| `apps/portal/src/achievements/stats.mjs`, `hmh.mjs` | Each summary reads its own schema's catalogues. `genesis-seal` is not a power-up. `bossKills` and `bossId` stay the Liquidator |
| `tests/fixtures/ranked/build-fixtures.mjs` + two JSON files | `hmh-v7-districts` and `hmh-v7-four-bosses`, built on `site-1.9.0:game-1.9.0` and listed apart as `HMH_V7_FIXTURE_NAMES` |
| `docs/game-design/achievement-catalogs-20260923.md` | Schema-7 meaning of the boss achievements, and the updated `speed-clear` reason |

**The v7 rules, briefly (contract §6–§7)**

- **Schema, S1–S18.** New dense rows: objectives, prisoners, bosses, evolutions and progression.
  - Each boss kill is tied to its own row, and `kills.boss` is the Liquidator.
  - Held prisoners are freed only after their boss (after its defeat, if it was defeated).
  - Seals, offers, re-rolls and shown cards must add up. A card is shown at most once per offer.
  - The wave-2 evolution rows stay 0. The Pistol evolves only from a panel.
  - The Golden Parachute needs the logbook by the Liquidator's first initiation.
  - A boss defeat needs a boss that was live then.
  - A gun's cards and evolution are shown only for a gun the run owns.
- **Plausibility rejects.** The v6 time and level rejects, plus these:
  - `build-predates-schema-7`;
  - `boss-before-ready`;
  - `boss-fight-too-short` (300 ticks; 180 for the Liquidator);
  - `boss-reinitiation-too-soon` (2,520);
  - `boss-fights-overlap`;
  - `kills-above-capacity`;
  - `collectibles-above-capacity`;
  - `node-xp-above-level`;
  - `xp-above-ceiling` and `score-above-ceiling`, with the v7 formulas.
- **Capacity.** Opening enemies + director schedule + one body per defeated boss + 4 adds per boss slot that could summon. At any run length that is at most 20 above v6.
- **XP ceiling.** Kill, combo and cache XP. Node XP is added level by level: an objective grants `k × 300 × level`, multiplied; an OG Miner grants exactly `300 × level`, only in slots that the seeded deal makes OG Miners.
- **Score ceiling.** Kill score, plus silver: one coin per ordinary kill, each defeated boss's burst, and 20 coins per secret.

## 3. Why no fabricated summary gains from the relaxed rules

| Rule | v6 | v7 | Security argument |
|---|---|---|---|
| `boss-before-band` (dropped for v7) | A boss kill before tick 72,000 rejects | Per boss: initiated at or after `readyTick`, and defeated at least `minFightTicks` after the last initiation. Each kill is tied to its row (S4/S5). One boss is live at a time | A boss kill is a fixed bonus, once per boss (S5): about 8,440 score for all four together. An earlier tick cannot multiply it. The earliest claimable kills are the Baron at 7,500 and the Liquidator at 36,180, and one tick earlier rejects |
| `HMH_BOSS_START_TICK` (not used for v7) | Liquidator body and adds counted from 72,000 | Bodies only for defeated rows. Beyond the director schedule, 4 adds per slot that could summon (none in an engagement's first 90 ticks), once per run. Every further add draws from the capacity bank | Claimed boss time, fight length, overlap or initiation count cannot add more than 20 kills to the schedule at any run length. Impossible timings reject outright (`boss-fights-overlap`, `boss-reinitiation-too-soon`). The red team's +83,448-score claim now rejects at a capacity of 1,146, under their own honest bound of 1,162 |
| Liquidator minimum fight (300 → 180) | – | 180 for the Liquidator, because its Dark Pool start has no intro | The kill is still one fixed bonus per run, now claimable 120 ticks earlier, and nothing about it grows with time. An honest Dark Pool kill needs 182 ticks; a kill at 179 rejects. The old 300 would have rejected honest Dark Pool burst kills |
| Schema 6 under any build hash (the converse of the build gate is not adopted) | – | Schema 7 needs a game version of 1.9.0 or later; schema 6 is accepted under any build hash | The build hash is the portal's. A newer portal can host a 1.8.x child cached by the service worker, and owner override 2 keeps that child valid. Such a run is held to the frozen 1.8.1 bounds, plus the 1.8.4 consistency rejects |

**`build-predates-schema-7` labels honest runs only; it is not a server gate.** The client chooses the build hash when it asks for the seed ticket, and the server checks only its format (`server/settle/seed.mjs:47` `validateSeedBody`, and `validateRankedIdentity` in `apps/portal/src/ranked-identity.mjs`). A fabricated run can therefore name `game-1.9.0`. So `server/verify/hmh.mjs` may accept schema 7 only in the deploy that serves the 1.9.0 child. If that ever cannot hold, first add a server check that the build's game version is no higher than the deployed `GAME_VERSION`, in both `validateSeedBody` and `validateRankedIdentity` (contract §15.1, precondition 1).

The nearest-impossible rejection tests for each rule are listed in contract §8.

**Residuals, accepted and recorded (contract §16.4)**
- **Role threat.** Kills are credited at each claimed role's threat, so a fabricated summary can put all its kills in the highest-threat ordinary role. v6 has the same rule.
- **Secret silver.** It adds at most 2,160 score to a run, whatever the run's length. A time floor per secret would need positions and a speed cap that the contract does not have.
- **Node levels.** Apart from the per-level XP bound, the level a node claims is free.
- **v6 grenade kills** need a consistent grenade trail since the second round, but a fabricated one still works: a launcher cache, one launch and one blast of n contacts credit n kills (hard-fork-hero in 50 s). A 1.8.x blast has no target cap.
- **v6 damage** has no time ceiling: a consistent `weapons[].damage` trail still earns damage-chain.
- **v6 site milestones** are claims bounded only by the end tick, so claiming every site at tick 1 keeps nearly the full pickup capacity.
- **v6 districts** in a long run are free within the contiguity rule (all six in 3 minutes is honestly reachable); the per-tick budget keeps its 2× margin.
- **Flags do not withhold achievements**; that policy is an owner decision (contract §16.6, R0-6).
- **A service-worker-cached 1.8.x child** still honours `evidenceSafe` in Ranked until it updates. Contract §16.5 and §16.6.

## 4. Tests

**Test files**

| File | Covers |
|---|---|
| `tests/hmh-run-summary-schema-v7.test.mjs` | The schema 1–6 corpus against the `60ea173a` digest, through both modules. The base module's bundle size. V6 and V7 catalogues. Contract constants, and the module's purity and freezing. S1–S18, each at its nearest boundary, including the red-team payloads. The maximal bridge message, using the widest admitted float |
| `tests/server-verify-hmh-plausibility.test.mjs` | The v6 corpus digest, and v6 unchanged under any build hash. Frozen literals pinned against the 1.8.1 child modules. The v7 ceilings recomputed with `run-progression.mjs`. The prisoner deal (fixed vectors, 10,000 seeds, `seededUnit` parity). Every §8 nearest-impossible case. The §7.3 table, with the 20-kill bound checked at every run length. Every red-team payload: undefeated and nested boss windows, bosses initiated at the end, overlapping fights, nodes at the final level, the zero-kill six-secret run, a 1.8.1 build, a million Railgun cores and 250 candles. The `createCollectibleState` limits are pinned |
| `tests/server-verify-hmh-honest-corpus.test.mjs` (new) | The 75-run **scripted** honest corpus, a model of honest play (`tests/fixtures/ranked/hmh-honest-corpus.mjs`): digest pinned; every run schema-valid, never rejected, free of consistency flags; each rule's neighbourhood reached, the second-round rules mostly at their bound |
| `tests/server-verify-hmh-real-corpus.test.mjs` (round 3) | The real-child corpus (`tests/fixtures/hmh-honest-corpus/real-child-<release>.json`): summaries the unmodified child emitted over `hmh-bridge/v1` under headless honest pilots. Count and digest pinned per child release; every summary schema-valid and bound to its harness identity; none rejected; the flags each run carries listed and asserted (`kills-near-capacity` on the brawler r08, `score-near-ceiling` on the grenadier r62) |
| `tests/server-verify-hmh-real-corpus-harness.test.mjs` (round 3) | The harness itself (`scripts/hmh-honest-corpus`): the 68-row plan, this checkout's Ranked identity (build hash, season, fixture seed tickets; the 1.8.3 corpus seeds are the plan's under the 1.8.3 build hash), the corpus serializer, and one headless boot of the child through the bridge handshake |
| `tests/server-verify-hmh-v7.test.mjs` | v7 fixtures bind, pass the schema and plausibility, keep the v6 evidence encoding and rebuild byte for byte. Ranked schema 7 is still refused (fail-closed). The fixtures fit `hmh-bridge/v1`. Schema-7 stats. Boss achievements on the device (`recordScore`) and the server, run by run over ten runs: district bosses unlock nothing, and the Liquidator unlocks them |

**Commands run on this branch** (no browser runs and no full release gate):
- The three files above. All pass.
- `tests/server-verify-hmh.test.mjs` and `tests/server-verify-identity.test.mjs` (the import graph: nothing under `server/verify` loads arcade-core or DOM code). Pass.
- `tests/achievement-derivation.test.mjs` and the other achievement tests. Pass.
- Every `tests/*ranked*` and `tests/*settle*` file. Pass. There is no `*jackpot*` test file.
- Every other test that reads `tests/fixtures/ranked`. Pass.
- Total: 498 tests, 0 failures.
- `node tests/fixtures/ranked/build-fixtures.mjs` with no flags: all nine fixtures are `ok`.
- `node scripts/docs-link-check.mjs`: passes.

**After the review fixes (`0c03df53` to `177bf1c8`):**
- The 42 verifier, ranked, settle, jackpot, achievement and integration-glue test files: 570 tests, 0 failures. The honest-corpus file takes about 6 s.
- `node tests/fixtures/ranked/build-fixtures.mjs`: all nine fixtures `ok` (the builder's new district walk leaves every committed byte unchanged).
- `npm run check` and `node scripts/docs-link-check.mjs`: pass.
- The release gate was not rerun and its record not regenerated: the integration owner regenerates it once after merging.

**After the second red-team round (`4b6db050`):**
- The five verifier files (plausibility, honest corpus, `server-verify-hmh`, `server-verify-hmh-v7`, `hmh-run-summary-schema-v7`): 113 tests, 0 failures. Every red-team payload was reproduced first, and each new test failed before its fix.
- The 118 verifier, ranked, settle, jackpot, achievement, fixture, evidence, integration-glue and HMH world-contract files: 1,195 tests, 1,183 pass. The 12 failures are in `hmh-level-one-curated-world-contract`, `hmh-level-one-ground` and `hmh-level-one-terrain-polish`. They look for generated art under `assets/generated/**`, which this worktree does not have, and none of them reads a changed file.
- `npm run check` passes. `node tests/fixtures/ranked/build-fixtures.mjs`: all nine fixtures `ok`.
- **Not run here:** `npm run build` (the HMH initial-JS budget; the child change adds a few dozen minified bytes), `npm run test:release`, and every browser suite. Another workflow's browser job was running, so these are left to the gate. The Ranked e2e's HMH leg is the runtime check the child change needs.

**Release gate, after the rebase onto `da3c0756`:**
- `npm run check`: passes.
- `npm run build`: passes its budgets. HMH initial JS + shared is 1,046,761 of 1,048,576 bytes (1.8 KB headroom); the base schema module adds 48 bytes to the HMH initial path, measured in the commit now `fe9046a0` (`a0c62030` as first written). The portal `main.js` takes the V7 catalogues through `achievements/stats.mjs`; the whole v7 schema module is 8,029 bytes minified with the base module left external.
- `npm run test:release`: PASS, 4,961 tests, 4,910 pass, exactly the 51 ledgered failures. The regenerated record was committed then (`b56de0e9`), and dropped in the rebase onto `b7c8307a`.
- The verifier, ranked, settle, jackpot and achievement tests (38 files, 524 tests) pass, and the fixture drift check is `ok` for all nine fixtures.
- `scripts/hmh-reboot-portal-e2e.mjs` (desktop): 7 flows pass, including `game-over-run-summary` with a schema-6 summary; `ranked-preview` is not run because the source has `SETTLEMENT_LIVE` on.

**Release gate, after the rebase onto `b7c8307a`** (2026-09-25; the only conflict was the gate record, where the release line's side was taken and the branch's `b56de0e9` dropped):
- `npm run check`: passes (1,003 JS modules and 118 Python scripts).
- `npm run build`: passes its budgets. HMH initial JS is 826,790 bytes (entry 361,044 of 480,000). HMH initial JS + shared is 1,047,679 of 1,048,576 bytes, so 897 bytes of headroom. The same base without this branch measures 1,047,594 (the STACKED settings branch's build on `b7c8307a`, which touches no HMH file): the branch adds 48 bytes in the shared schema chunk and 37 in the child entry (the `evidenceSafe` change).
- The 59 verifier, ranked, settle, jackpot, achievement, integration-glue and fixture-reading test files: 701 tests, 0 failures.
- `node tests/fixtures/ranked/build-fixtures.mjs`: all nine fixtures `ok`, no byte changed.
- `npm run test:release`: PASS, 5,184 tests, 5,133 pass, exactly the 51 ledgered failures. The regenerated record is committed on top.
- **Not run here:** the browser suites. The child's `evidenceSafe` change still needs the Ranked e2e's HMH leg (`scripts/ranked-live-browser-e2e.mjs`) in the release certification.

## 5. What the child branch must emit and honour

The child (`apps/hmh-reboot/src/**`, and a versioned `sdk/hmh-run-summary.mjs`) is a later branch. It must emit exactly contract §4 and §11, and honour the boss kit in §5.3.

**The summary**
- `schemaVersion: 7`.
- The 16 enemy-role rows, the 14 collectible rows (`genesis-seal` counts the Seals and is never timed), and the 36 upgrade rows.
- Sites (11) and secrets (6) equal to their objectives.
- Dense `objectives`, `prisoners`, `bosses`, `evolutions` and `progression` rows, with exactly the §4 semantics. In particular:
  - `levelAtCompletion` and `levelAtRescue` are the level just before that node's own grant, after every earlier grant, including earlier grants on the same tick;
  - `kills.boss` counts the Liquidator only;
  - `bossEngagedTick` is the Liquidator's first initiation;
  - `offered` counts each shown card once per offer, including cards shown by re-rolls ("Bank the Seal" is not counted).

**The build**
- The release that first emits schema 7 has game version 1.9.0 or later (`GAME_VERSION`, which appears as `game-X.Y.Z` in the build hash).
- If it ships under a different version, `HMH_RUN_SUMMARY_V7_MIN_GAME_VERSION` changes in the same commit.

**Gameplay obligations that keep the bounds sound**
- **Boss kit.**
  - An intro start takes no damage for 120 ticks.
  - Two HP thresholds, each clamped, then a 90-tick invulnerable halt.
  - Retreat: the ring appears at 600 engaged ticks, the channel takes at least 120, and the boss is ready again 1,800 ticks later.
  - Only one boss is live at a time: no trigger fires while another boss is live.
  - One Seal per boss, and only on a real defeat. The silver burst replaces the 10-coin drop.
- **Capacity bank.** Everything except the two opening enemies, the boss bodies and each slot's first 4 adds is inserted only while the number of such insertions stays below `directorSpawnCapacity(tick)`. That covers the director's own insertions, guard crews, ambushes, dormant Revenants, champion waves, paired spawns and every further boss add. No add is inserted in an engagement's first 90 ticks.
- **Collectible pickups.** Only from at most 21 authored placements, each re-armed no sooner than 7,200 ticks after a pickup. Prisoner, strongbox, secret and haven grants are not pickups.
- **Grants.**
  - An objective grants `grantRunXp(OBJECTIVE_XP_PER_LEVEL[class] × level)`.
  - An OG Miner grants exactly `300 × level`, unmultiplied.
  - A secret grants exactly 20 silver.
  - A defeated boss grants exactly its silver burst.
- **Order within a tick.** The mission step records the logbook before the tick's boss starts. The first trigger keeps the Liquidator for the rest of the run.
- **Weapons.** Every gun except the starting Pistol records a pickup the first time the run owns it, before any of its cards or its evolution is shown.
- **Boss hits.** They keep `weaponId: 'boss-<attackId>'`. A fallen boss's strikes stop landing within 300 ticks of its defeat.
- **Revive.** `recordRunRevive` clears the pending defeat.

**Parity tests the child branch adds.** Its new archetypes, bosses, upgrades and collectible layout, pinned to `sdk/hmh-run-contract-v7.mjs`. The v7 fixtures should then be rebuilt from the real v7 accumulator.

## 6. Outside this branch (contract §15)

1. **`server/verify/hmh.mjs`.** Import `validateRunSummaryPayload` from `../../sdk/hmh-run-summary-schema-v7.mjs` and accept `schemaVersion` 6 or 7, only once the contract §15.1 preconditions hold: the deploy that serves the 1.9.0 child (or a server-side game-version check), fixtures and an honest corpus from the real v7 accumulator, and the twelve 1.8.4 consistency rules (§16.5, §16.6) mirrored for v7.
   - The test `a Ranked schema-7 body is refused …` in `tests/server-verify-hmh-v7.test.mjs` then fails, as intended, and should be replaced by an end-to-end `verifyRankedRun` of the v7 fixtures.
   - `contract.bossId` needs no change.
2. **The bridge and the portal** (`sdk/hmh-bridge-protocol.mjs`, `hmh-run-history.mjs`, `hmh-reboot-bridge.mjs`). Switch them to the v7 schema module when the child emits schema 7. The child's HMH initial-JS budget pays for about 8 KB (the v7 module, minified, 8,029 bytes). Only 897 bytes of headroom are left on `b7c8307a` (1,815 at `da3c0756`, before 1.8.4's perf steps), so that needs about 7.1 KB of HMH initial-JS cuts first (6.2 KB at `da3c0756`), or the v7 module loaded lazily.
   - The portal `main.js` already carries the V7 catalogues through `achievements/stats.mjs`: +3,030 bytes, measured (the contract's first estimate was about 2.2 KB).
3. **arcade-core and `tests/achievement-derivation.test.mjs`.** Per-boss achievement inputs, if district bosses should ever count toward the boss achievements.
4. **Parent consumers of the generic `boss-defeated` event.** Audit them before district bosses ship.

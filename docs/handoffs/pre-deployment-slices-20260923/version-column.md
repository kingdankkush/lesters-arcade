# Slice brief: version-column (owner decision 2026-09-25: no testnet season resets; show the game version per score)

**Worktree:** `C:/Users/just_/lesters-arcade-wt/version-column`, branch `fable/pd-version-column`. Production is live (1.8.1, flags true). Base contains polish-2.
**Read first:** contract §2.1-§2.4 (identifiers, buildHash, A11), §4.3.5-§4.3.8 (E5, E6, E9), §7.8; `server/verify/**` (bindRankedIdentity, buildHash patterns), `apps/portal/src/ranked-identity.mjs`, `arcade-core.mjs` game entries (CHIKUN_CABINET_VERSION near :2294), `server/neon/queries.mjs`, the hosted leaderboard and profile views.

## Owner decision
Balance changes do NOT reset seasons on testnet (reset only at mainnet). Instead, every score shows the game version it was made on, as a column on leaderboard rows and in profile session history.

## Acceptance criteria
1. **HMH cabinet version.** New one-line module `apps/portal/src/hmh-cabinet-version.mjs` exporting `HMH_CABINET_VERSION = '0.5.0'` (the HMH roadmap session owns later bumps). The HMH game entry in `arcade-core.mjs` gets `cabinetVersion` from it, so new HMH buildHashes read `site-X:game-Y:cabinet-0.5.0`. The lester-blaster buildHash pattern accepts an optional `:cabinet-\d+\.\d+\.\d+` on both server (`server/verify`) and browser (`ranked-identity.mjs` / RANKED_GAMES), so 1.8.x rows without it stay valid. Keep the module out of the HMH child initial JS (it is portal-only).
2. **One pure label module** `apps/portal/src/game-version-labels.mjs` shared by server and browser: `versionLabelFor(gameId, { buildHash, runtimeId })` returns `HMH v0.5` / `HMH v0.6` (cabinet major.minor; no cabinet segment → `HMH v0.5`), `Chikun v7` (from runtimeId `chikun:canvas-runtime-vN`), `STACKED v0.2` (cabinet major.minor), and a safe fallback for anything unexpected. Exhaustive unit tests.
3. **Server.** E5 leaderboard rows, E6 profile recent sessions and E9 session reads carry `versionLabel` (and the raw `runtimeId`/`buildHash` only where already public). Find where the build hash is stored for verified sessions; if it is not queryable, derive it from the stored identity/evidence or add an additive migration (coordinate numbering: ops-health took migration 2; the Chikun jackpot slice plans migration 3, so use 3 only if the jackpot has not merged yet, otherwise the next free number, and keep it additive and A15-safe with a backfill for existing rows). Cache headers unchanged.
4. **UI.** Hosted Scores rows show a compact version column (desktop) / chip (phone, 320 px safe); profile session history shows the label per run; share page optional (only if trivial). Retro styling consistent; no layout shift; tests for both hosted views.
5. Gate: `npm test`, `npm run check`, `npm run build` (HMH initial + shared must not grow; report bytes), `npm run test:release` (exactly 51), curated inventory regenerated for new src modules.

## Handoff (fixer, review round 2, 2026-09-25)

This section describes the branch head, `fable/pd-version-column`, after the round-2 fixes. It supersedes the summary of `0630038b`. The commit messages record the gate results for each tree.

### What the slice does now
- **Cabinet.** `apps/portal/src/hmh-cabinet-version.mjs` exports `HMH_CABINET_VERSION = '0.5.0'` on one line. New HMH build hashes read `site-X:game-Y:cabinet-0.5.0`. The browser and the server (E3, E15) share one `lester-blaster` pattern, in which the cabinet segment is optional (contract A11).
- **Labels.** `apps/portal/src/game-version-labels.mjs` is contract §7.10. It is not import-free: it imports the two one-line cabinet constants.
  - `versionLabelFor` shows an HMH or STACKED cabinet only inside the range this deploy has shipped (`SHIPPED_CABINETS`). So `cabinet-0.6.x` reads `HMH v?` until the HMH session bumps `HMH_CABINET_VERSION`.
  - A well-formed HMH build without the segment reads `HMH v0.5`.
  - A row with no build hash (a `chain-index` row) reads the game's only shipped cabinet: `HMH v0.5` or `STACKED v0.2`.
  - Chikun reads its `runtime_id`: `Chikun v7`, or `Chikun v?` for a runtime the indexer could not map.
  - `versionLabelText(label, gameId)` accepts only HMH, Chikun or STACKED labels, and only the row's own game.
- **Server.** E5 rows, E6 `recentSessions` (both views) and E9 carry `versionLabel`, derived at read time from the migration-1 columns. There is no migration. The raw build hash is never returned. The E10 share page lists a known version.
- **UI.** From 1200 px up, the board has a Version column before Proof. From 601 to 1199 px, the version sits under the score and its VERSION header sits under SCORE, so each row keeps one column header per cell and the head keeps its 57 px height. On phones, it is a labelled chip. Published shows from 761 px up, as before. The profile shows one chip per run, and `v?` is muted everywhere.
- **Browser check.** `npm run smoke:scores-version` is manual (usage in the script header), because `npm test` pins only the CSS text. It measures the layout at 17 widths for each board and at 4 profile widths, and checks the accessibility tree through Chromium CDP. Run it before merging any change to the hosted Scores or profile layout.

### For the HMH roadmap session
- **Bumping.** Bump `HMH_CABINET_VERSION` alone when a balance change should show a new version. `HMH v0.6` appears only after that bump. Before it, a run claiming `cabinet-0.6.x` reads `HMH v?`.
- **Chain-index rows after the bump.** HMH `chain-index` rows change from `HMH v0.5` to `HMH v?` once 0.6 ships, because a row without a build hash can no longer be dated.
- **`RUNTIME_VERSION`.** No test ties the child's `RUNTIME_VERSION` (`apps/hmh-reboot/src/main.mjs`) to the cabinet any more. Round 1 added one; round 2 dropped it so that a bump never forces an edit to the certified child runtime.
- **Manifest version.** `HMH_CABINET_VERSION` tracks the 0.5.x vertical-slice runtime, not the manifest's `1.0.0`. Keep it that way.
- **Files this slice left alone.** It does not touch `server/verify/hmh-plausibility.mjs`.

### Rollback
A deployment without the optional segment rejects this release's HMH build hashes with a terminal 400. That covers 1.8.1 and earlier, and any release cut before this slice merged. Contract §13, step 4, has the procedure: pause Ranked, and re-promote before resuming.

### Expected merge conflicts (trial `git merge-tree` against the head)
All are trivial:
- **`fable/pd-jackpot-ui`**, in `apps/portal/src/routes/hosted-leaderboard-view.mjs` imports. Keep both: `import { versionLabelTitle } from '../game-version-labels.mjs';` and `import { JACKPOT_LIVE } from '../jackpot-config.mjs';`.
- **`fable/pd-jackpot-server`**, in the E9 key list of `tests/api-index-endpoints.test.mjs`. Take the union: `jackpotChampion` after `gameTitle`, and `versionLabel` after `verifiedAt`.
- **`fable/chikun-visuals`** and **`fable/hmh-perf-part1`**, in `tests/arcade-core.test.mjs`. These branches bump the site to 1.8.2. Resolve to `` `site-1.8.2:game-1.8.2:cabinet-${HMH_CABINET_VERSION}` `` and keep this slice's `cabinetVersion` assertion.
- **`package.json`.** The `smoke:scores-version` line merged cleanly with every branch.

### Not done, by design
- The hosted YOUR RANK card, the podium and E6 `bestScore` carry no version. Their runs are labelled rows elsewhere, and the brief covers rows and profile runs only (contract §4.3.5).
- The no-segment and future-cabinet tightenings of round-2 finding 4 were not made. Contract §12 gives the reasons.
- The constants still ride in a 51 B shared first-load chunk (contract §7.10).

### Verification (round-2 head)
These results are for the round-2 tree: `c4da36ff` and `e7f33d6d`, plus the docs commit that adds this section.

**Gates**
- `npm test`: 4,884 tests, 4,833 passed, 51 failed. All 51 failures are the ledgered art and asset tests.
- `npm run test:release`: `HMH_REBOOT_TEST_RETIREMENT_GATE PASS tests=4884 passed=4833 expected_failures=51`. The regenerated gate JSON was checked out, not committed.
- `npm run check`, `npm run contracts:check` and `npm run build`: all pass.
- `npm run smoke:scores-version` on port 8890: `ok: true`, no failures.

**Bytes (`npm run build`, against base `0248cd4b`)**

| Bundle | Size | Change |
| --- | --- | --- |
| HMH initial JS + shared | 1,046,713 B | +0 |
| STACKED initial | 572,902 B (entry 27,694 B) | +0 |
| Chikun entry | 42,573 B | +0 |
| Portal first load | 2,202,205 B, 25 files | +249 B and one file, the 51 B constants chunk; unchanged in round 2 |
| Lazy `hosted-leaderboard-view` | 14,764 B | +732 |
| Lazy `hosted-profile-view` | 24,664 B | +201 |

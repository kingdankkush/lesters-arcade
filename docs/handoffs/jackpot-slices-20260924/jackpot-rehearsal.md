# Slice brief: jackpot-rehearsal (wave J3)

**Worktree:** `C:/Users/just_/lesters-arcade-wt/jackpot-rehearsal`, branch `fable/jackpot-rehearsal`, based on the integration commit with jackpot-contracts, jackpot-server and jackpot-ui merged. Junction `node_modules`; never run `npm install`.

**Revision 2 (2026-09-24)** applies three reviews (design Appendix K). The main changes for this slice:
- adversarial scenarios R13-R20;
- R9 now expects `claim-pending` before `paid`;
- R2 and R10 use the server's documented test seams;
- the live checker adds the Ranked-coupling (J17), pause and block-list checks;
- the flip checklist's preconditions use `minFundWei` and the rules-page section markers.

**Read first:**
- the design `docs/game-design/chikun-weekly-jackpot-design-20260924.md`: §0 (J2-J4, J17 and the example timeline), §A.5, §A.7-§A.10, §A.16, §A.19, §B.3-§B.5, §C.1 (seams), §C.4-§C.5, §D.1, §D.6, §E (all, including the rubric), §G, Appendix K.
- the contract: §10.4, §11, §13.
- the code:
  - `scripts/lib/{local-chain,local-stack,local-http,rehearsal-driver,local-jackpot}.mjs`
  - `scripts/rehearse-ranked-e2e.mjs`, `scripts/rehearse-step7-dry-run.mjs`
  - `tests/local-chain-rehearsal*.test.mjs`
  - `docs/qa/pre-deployment-rehearsal-20260923.json`, `docs/qa/step7-dry-run-20260923.json` (the receipt style to copy)
  - `scripts/lib/chikun-evasion-pilots.mjs` (from jackpot-server)

**Hard safety rule:**
- Everything runs on the in-process chain, PGlite and in-process handlers.
- The live dry-run tool is written and tested against local fakes only. The owner session runs it live, read-only, at runbook E7, E9 and E11.
- No LiteForge transactions, no Vercel changes, never read the vault. `JACKPOT_LIVE` is never flipped in a committed file.

## Goal

Prove the whole jackpot works end to end, and resists the reviewed attacks, before anything touches LiteForge:
- full week cycles with real settles (and real seed tickets, so `seed_ticket_log` is populated), the real keeper cron, the real API and the UI's parser, with time travel;
- every branch: challenge, flag and admin decision, disqualification, relist, rollover, cap, late settlement, token failure, crash recovery;
- the adversarial set: sybil eviction, banked-session sniping, non-stock clients, an expected miss, stale keeper actions, a contested admin, dust funding, Ranked-setting drift;
- the read-only live checker and the exact flag-flip checklist for runbook step E10.

## Acceptance criteria

1. **Driver** `scripts/lib/jackpot-rehearsal-driver.mjs` exports:
   - `startJackpotStack()`: `startLocalStack()` + `deployLocalJackpot()`, the keeper env wired to the fixture keeper key, the server `nowMs` bound to **chain time**, the jackpot deployment passed through the `jackpotDeployment` seam, and the cron callable in process;
   - `playRankedChikunRun({ player, openedAt, profile | pilot | evidence, settleAt })`: sign in → seed ticket (logged) → pay the entry at a chosen chain time → generate evidence **for the issued seed** (`playBotRun` / `pilotFor` / an evasion pilot with the ticket's seed) → move chain time to `settleAt` (default: just past `openedAt + survival`) → settle until confirmed;
   - `advanceTo(isoOrOffset)`: sets the chain timestamp (`evm_setNextBlockTimestamp` + `mine`) and the server clock together;
   - `runJackpotCron(times = 1, { select, fault })`, passing the server's `deps.jackpotSelect` and `deps.keeperFault` seams through;
   - admin, operator, player, funder and winner helpers that call the contract from the fixture wallets, exactly as the owner page encodes the calls (import `jackpot-review-model.mjs`), plus `jackpot-actions.mjs` for operator actions.
2. **Scenarios** (`scripts/rehearse-jackpot-week.mjs`). Each asserts on-chain state, the Neon mirrors, `/api/jackpot` (through the UI's `parseJackpot`) and token balances, and checks `balanceOf(jackpot) ≥ liabilities` at the end:

   | Id | Scenario | Expected |
   | --- | --- | --- |
   | R1 | Happy path: fund 10,000 tCHIKUN; 3 players; the keeper selects at C + 2 h, screens, submits and clears | Anyone may finalize at C + 24 h (not at C + 24 h − 1 s); the winner is the board's top eligible wallet; `paid`; the profile shows the win with its token and date range; the share page shows the champion badge |
   | R2 | **Challenge:** the keeper's selection is made to miss a better session (`deps.jackpotSelect` drops it, simulating censorship); the player submits it on chain at C + 8 h | The keeper screens and clears the challenger within three cron runs; the challenger is paid |
   | R3 | **Flag → admin:** the leader is a scripted-pilot run (H4/H5/H6) | Flagged; at C + 24 h the week is `awaiting-admin` and finalize reverts `LEADER_NOT_CLEARED`. (a) The admin disqualifies → #2 is paid. (b) Replay variant: the admin clears → the leader is paid. |
   | R4 | **Integrity:** a session whose Neon evidence is deleted (simulating a forged record) is submitted publicly | Flagged `integrity`; never auto-paid |
   | R5 | **Rollover:** a funded week with no eligible run | The keeper finalizes (empty-leader row); `rolled`; the next week's pot = its own + the carried amount; the R1-style payout next week pays both |
   | R6 | **Late settlement:** a run opened in W settles at C + 6 h + 1 s | On-chain `SETTLED_LATE`; excluded by selection; the board still shows it in W (documented divergence) |
   | R7 | **Extension:** the admin extends W by 12 h after the keeper reached `review`; the late run of R6 now qualifies | The keeper re-selects (the `WeekExtended` row); the payout moves to C + 36 h |
   | R8 | **Prize cap:** with a cap in the week's rules (scheduled the week before) | The API shows `prizeWei` = the cap and the carry-over; pays the cap; the excess reaches the current week |
   | R9 | **Token failure:** a separate instance with the blacklist mock token; the winner is blacklisted | `PrizeTransferFailed`; the API and profile show `claim-pending` with `unclaimedWei`; the status page warns; `claim` to another address succeeds; then `paid` |
   | R10 | **Crash recovery:** `deps.keeperFault` throws at `after-cas`, `after-broadcast` and `before-receipt` | The next run confirms from chain state; there are no duplicate transactions (the keeper nonce advances by exactly the number of distinct actions) |
   | R11 | **Pause, hold and staff:** an admin pause blocks finalize and keeper clears but not submissions or funding; a held week waits; the staff wallets (admin, operator, keeper, including a rotated-out keeper) and the blocked test, verifier, relayer and funder wallets can never be candidates | As stated |
   | R12 | **Unfunded week** (below `minFundWei`) | `unfunded`; zero keeper transactions; the API reports no amount; the UI renders no amount |
   | R13 | **Sybil eviction:** honest players hold the top 5 and are cleared; five decoy wallets (routePilot runs, settled before C + 6 h) submit at C + 11 h 59 min | The honest rows are displaced; the keeper screens the decoys first and flags them; the admin disqualifies all five; the keeper re-lists the displaced honest rows; the honest leader is paid at C + 24 h. Variant: the honest #6, never listed, is added by `adminSubmit` after the decoys and #1-#5 are disqualified, and is paid. |
   | R14 | **Banked-session sniping:** a session opened on Sunday; at C + 5 h, after the standings are public, a run just above the leader is settled | Held by H9 (`late-evidence`); `awaiting-admin`; not auto-paid |
   | R15 | **Non-stock client:** a run with `maxTicks = 108000` (settles through the verifier) | Never submitted by the keeper; if submitted publicly, flagged `integrity` |
   | R16 | **Expected miss:** an exceptional-model bot on a real seed | It passes the screen and is cleared; the receipt records it under `expectedMisses` (this is B.5's residual, not a failure) |
   | R17 | **Stale keeper action:** the admin clears a flagged leader; the keeper then re-screens it (`jackpot-ops rescreen`) and a dropped flag transaction is re-signed | Both keeper actions end `skipped`/`review-locked` (the pre-send check); an on-chain keeper `flag` reverts `REVIEW_LOCKED`; the leader is paid |
   | R18 | **Contested admin:** the admin key is treated as compromised; it calls `transferAdmin` repeatedly and `unpause` | The operator's `operator-pause` holds; `force-admin <new>` succeeds in one transaction; the old admin's `transferAdmin` reverts `OPERATOR_LOCK`; the review API refuses the old admin within 60 s; the new admin reviews and the operator unpauses |
   | R19 | **Dust and end of life:** an attacker funds a far-future week with less than `minFundWei`, then with exactly `minFundWei` 8 weeks ahead; the operator schedules an end before that week | The first fund reverts `BELOW_MIN_FUND`; `scheduleEnd` succeeds; after the end, the attacker's `refund-after-end` returns its own funding; Louie's pre-funding of a later week is refunded to Louie; the final week's unwon pot becomes residual after 30 days; `sweepStray` of a double-entry mock reverts `LIABILITIES_BREACHED` |
   | R20 | **Ranked-setting drift:** mid-week, the operator lowers the settlement reserve to 0, and separately sets `rankedEntry` on the score registry to another address | With the reserve at 0 and `minPaidWei` = 0.1, runs stay eligible; the live checker flags the `rankedEntry` mismatch and the entry-modal row hides when the quote falls below `minPaidWei` (fees-off variant) |

   The script writes `docs/qa/jackpot-rehearsal-<date>.json` (`schema: 'lesters-jackpot-rehearsal-v2'`) with, per scenario: passed checks, week keys, transaction counts, keeper gas used, final balances, and `expectedMisses`.
3. **Test** `tests/jackpot-rehearsal.test.mjs` runs R1, R3a, R5, R10, **R13, R15 and R17** in under 60 s (bot runs capped at about 1.5 minutes, as `E2E_EVIDENCE` does; the decoys in R13 use 1-minute pilots). The full scenario set runs from the script, not from `npm test`.
4. **API contract test** `tests/jackpot-api-contract.test.mjs`: the real `/api/jackpot` handler output at every lifecycle stage (including capped, claim-pending, two-token history and UI-hidden) is accepted by the UI's `parseJackpot`, with no field the UI needs missing; and the real `/api/jackpot/review` output renders through `jackpot-review-model.mjs`'s timeline geometry.
5. **Live dry-run tool** `scripts/jackpot-live-dry-run.mjs --site <origin> [--rpc <url>]`. It is read-only (only `eth_call`, `eth_getCode`, `eth_getLogs` and HTTP GETs) and prints a JSON checklist:
   - code exists at the module's jackpot and token addresses (and every `retired[]` instance);
   - the immutables and roles equal `contracts/deployment-record.jackpot.json`;
   - `weekOf(now)` equals the server's current week key;
   - the rules in force, and `rulesFor(currentWeek).minFundWei > 0`;
   - **J17 coupling:** `ArcadeRankedEntry.quoteEntry(chikun).totalWei ≥ rulesFor(currentWeek).minPaidWei`; `ScoreSubmissionRegistry.rankedEntry() == jackpot.rankedEntry()`; the Chikun game id and season the server uses are in `rulesFor(currentWeek)`; the Chikun game is registered and playable;
   - the pot, prize and `funded` flag of the current and previous week from the chain equal `/api/jackpot`;
   - `paused()`, `operatorPaused()` and the env pause as reported by `/api/health`;
   - keeper balance ≥ 0.05 zkLTC;
   - `/api/health` reports the weekly-jackpot cron fresh, and no week `awaiting-admin` for more than 24 h or `claim-pending`;
   - the E5 block list is blocked on chain (test wallet `0x8841…ce824`, verifier, relayer, contest wallet, named funders) and the staff roles are `staffEver`;
   - `JACKPOT_LIVE` in the served bundle matches the expectation passed in (`--expect-live true|false`).
   It is tested against a local HTTP server plus the in-process chain, including a failing J17 case.
6. **Flag-flip dry run** `scripts/jackpot-flag-flip-dry-run.mjs`, the way `scripts/rehearse-step7-dry-run.mjs` works:
   - in a temporary copy of the tree, set `JACKPOT_LIVE = true`, run `node scripts/build-portal-pages.mjs` with a fixture legal text, and run the test suite;
   - record **exactly** which pinned tests and literals change (expected to include the live `noValue`, the FAQ entry, `trustStatus`, `llmsScope`, the sitemap and `llms.txt`, and any Chikun detail-copy pin);
   - write `docs/qa/jackpot-flag-flip-checklist.json`: the files to edit, the tests to update, the build command, the preconditions (`potOf(currentWeek).total ≥ rulesFor(currentWeek).minFundWei` on chain, no `LEGAL-REVIEW-PENDING`, every rules-page section marker present, the OJ2 receipt present with the gate met, the J17 coupling checks passing, an epoch with `adminClearOnly = false` scheduled for the flip week or a documented decision to keep it true), and the post-release smokes;
   - it never commits the flipped copy.
7. **Docs:** the `## Rehearsal and go-live` section of `docs/web3/weekly-jackpot-operations.md`: rehearsal commands, reading the receipts (including `expectedMisses`), the §E runbook with exact commands (copy the design, adjusted to the final script flags), the J17 weekly check, and the emergency stops.

## Files

**You own:**
- C `scripts/lib/jackpot-rehearsal-driver.mjs`, `scripts/rehearse-jackpot-week.mjs`, `scripts/jackpot-live-dry-run.mjs`, `scripts/jackpot-flag-flip-dry-run.mjs`
- C `tests/jackpot-rehearsal.test.mjs`, `tests/jackpot-api-contract.test.mjs`, `tests/jackpot-live-dry-run.test.mjs`
- C `docs/qa/jackpot-rehearsal-<date>.json`, `docs/qa/jackpot-flag-flip-checklist.json`
- E `docs/web3/weekly-jackpot-operations.md` (your section)
- E `scripts/syntax-check.mjs` (after `'tests/nft-phase2-rehearsal.test.mjs',`)
- Small hooks in `scripts/lib/local-stack.mjs`, only if needed (for example a `nowMs` override), named in the commit and additive

**Read-only:** all product code. **If a scenario fails because of a product bug, do not fix it here.** Record it in the receipt as `failed` with a minimal reproduction, and report it to the orchestrator. The owning slice fixes it. A missing test seam is a jackpot-server bug (design §C.4 lists them).

## Interfaces

- **Consumed:**
  - `deployLocalJackpot`, `launchRules`, `setChainTime` and the mock tokens (jackpot-contracts);
  - the cron handler with `jackpotDeployment`, `jackpotSelect` and `keeperFault`, `/api/jackpot`, `/api/jackpot/replay`, `/api/jackpot/review`, `jackpot-ops.mjs`, the evasion pilots (jackpot-server);
  - `parseJackpot` and `jackpot-review-model.mjs` (jackpot-ui);
  - `startLocalStack`, `rankedContracts`, `signIn`, `ticketedSession`, `payEntry`, `playAndBuildBody`, `settleUntilConfirmed` (the existing rehearsal libraries).
- **Produced:** the rehearsal receipt, the flip checklist and the live dry-run tool, used by runbook steps E1, E7, E9, E10 and E11.

## Plan

1. The driver: stack + jackpot deploy + clock binding + seams. Smoke: one funded week with one player reaches `paid`. Commit.
2. Scenarios R1-R12 in the script, with shared assertions; the receipt writer. Commit.
3. Scenarios R13-R20 (the adversarial set). Commit.
4. The fast test subset and the API contract test. Commit.
5. The live dry-run tool and its local test; the flag-flip dry run and the checklist. Commit.
6. Docs, syntax-check, the full gate, the receipt committed. Commit.

## Tests (titles)

- "a funded week pays the top eligible wallet at the payout time"
- "a flagged leader waits for the admin and a disqualification pays the next"
- "an unwon week rolls into the next week's pot"
- "a crashed keeper resumes without duplicate transactions"
- "five decoys cannot push the honest leader out of the prize"
- "a non-stock client is never submitted and is flagged if submitted"
- "a stale keeper action never overrides the admin"
- "the UI parser accepts the real API at every lifecycle stage"
- "the live dry run reads only, reports every check and catches Ranked-setting drift"

## Pitfalls

- **Two clocks.** The server's `nowMs` and the chain timestamp must move together, or settles fail A26 (`now ≥ openedAt + survival − 30 s`) and finalize fails `PAYOUT_NOT_DUE`. Bind `nowMs` to the latest block timestamp plus the wall-clock offset since the last mine.
- **The evidence must be generated for the seed the ticket issued.** Canned evidence fails `seed-mismatch`. Use `playBotRun({ profileName, seed })` or a pilot on that seed, with a short cap.
- **Seed-ticket freshness (A26).** `openedAt` must fall in `[issuedAt − 120 s, issuedAt + 1800 s]`. Pay the entry right after issuing, in chain time. For R14, bank the session (pay on Sunday) and delay only the settle.
- **Staff and blocked wallets.** The keeper, the operator and the admin (= `developer` in the local fixtures) cannot play for the jackpot. Use `player1`, `player2`, `player3` and `attacker`, plus freshly derived fixture wallets for R13's decoys and honest players.
- **Test runtime.** Full scenarios belong in the script. `npm test` runs inside `vercel:build` (via `test:release`), so the test file must stay offline and under 60 s.
- **Never hand-edit generated pages** in the flip dry run. Run the builder in the temporary copy.
- **R16 is not a failure.** An exceptional bot passing the screen is the documented residual risk; record it, do not "fix" thresholds to catch it.

## Definition of done

- Acceptance criteria 1-7 hold.
- The receipt shows R1-R20 passing (R16 as an expected miss), or lists product bugs routed to their owners, in which case the slice is not done until they are fixed and the receipt re-runs green.
- The flip checklist is committed.
- `npm test`, `npm run check`, `npm run contracts:check` and `npm run build` pass, and `npm run test:release` shows exactly 51. Do not commit the gate JSON.
- No LiteForge, Vercel or production Neon access.

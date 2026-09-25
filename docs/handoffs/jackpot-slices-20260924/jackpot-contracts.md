# Slice brief: jackpot-contracts (wave J1)

**Worktree:** `C:/Users/just_/lesters-arcade-wt/jackpot-contracts`, branch `fable/jackpot-contracts`, based on the integration commit that carries **revision 2** of the design doc and has **polish-2 merged** (design §G wave J0; ≥ `98e32740`). Junction `node_modules`; never run `npm install`.

**Revision 2 (2026-09-24)** applies three reviews. The contract gains: sticky staff exclusion, the `adminReviewed` keeper lock, `wasListed` re-listing, `adminSubmit`, a separate operator pause and one-step `forceAdmin`, `minFundWei`, `refundAfterEnd`, bounded rule epochs, a sweep post-condition, a self-nominated residual recipient, `CandidateSkipped`, no winner for a zero pot, and `firstWeek > currentWeek()`. Design Appendix K lists every finding.

**Read first:**
- the design `docs/game-design/chikun-weekly-jackpot-design-20260924.md` ("the design"): §0, §A (all, including §A.19), §B.3 item 4, §E steps E2-E5, E8, and the emergency stops, §G, Appendix K rows X1-X19.
- the contract `docs/handoffs/pre-deployment-interface-contract-20260922.md`: §8 (contract facts), §10.4, §11 (all rules), §13.
- the code:
  - `contracts/src/{ScoreSubmissionRegistry,ArcadeRankedEntry,GameRegistry}.sol`
  - `scripts/compile-contracts.mjs`, `scripts/contract-structure-check.mjs`
  - `scripts/lib/local-chain.mjs`, `tests/contracts-security-baseline.test.mjs` (the `runFor`/`sign`/`openPaidFor` helpers at `:73-104`), `tests/local-deploy-harness.test.mjs`
  - `scripts/operator-actions.mjs`, `scripts/lib/key-source.mjs`, `scripts/generate-litvm-addresses.mjs`

**Hard safety rule:**
- No transaction on LiteForge. No `--broadcast` against anything but the in-process chain.
- Never read `C:/Users/just_/lesters-arcade-vault/**`.
- Never edit `scripts/deploy-contracts.mjs`, the deployed-suite sources, or `apps/portal/src/generated/litvm-addresses.mjs`.

## Goal

Build the on-chain half of the Chikun Weekly Jackpot (design §A) and its tooling:
- `WeeklyJackpot` and `TestChikunToken` (tCHIKUN), with the read interfaces;
- mocks and tests;
- a local deploy helper;
- a two-phase deploy script;
- a generated address module;
- an operator CLI and a keeper-key generator.

All of it is proven on the in-process Hardhat chain.

## Acceptance criteria

1. **Sources** (design §A.1, §A.4-§A.13, §A.17):
   - `contracts/src/WeeklyJackpot.sol`, `contracts/src/TestChikunToken.sol` and `contracts/src/interfaces/IRankedReaders.sol` (`IRankedScoreReader`, `IRankedEntryReader`).
   - The ScoreRecord and PaidSession struct field orders match the deployed contracts exactly.
   - `pragma solidity ^0.8.24;`, `// SPDX-License-Identifier: MIT`.
   - OZ imports only: `IERC20`, `SafeERC20`, `ERC20`, `ReentrancyGuard`.
   - No `contracts/src/interfaces/IERC20.sol` and no `TournamentPool.sol`.
   - Every public function, event, constant, view and revert string in the design exists with exactly the names given there:
     - §A.2 constants (`RELIST_MARGIN`, `MAX_FUND_AHEAD_WEEKS = 8`, `MAX_PENDING_EPOCHS = 8`)
     - §A.3 roles, including `"Only platform operator"` / `"Only pending operator"`, `adminPaused`/`operatorPaused` with the `paused()` view, `forceAdmin`, `"OPERATOR_LOCK"`, and the sticky `staffEver` set in the constructor, `acceptAdmin`, `forceAdmin`, `acceptOperator` and `setKeeper`
     - §A.5 rule epochs (the constructor emits `RulesScheduled`; `minFundWei`; `RULES_TOO_FAR`; `TOO_MANY_EPOCHS`; binary-search `rulesFor`)
     - §A.6 funding with balance-delta accounting, `BELOW_MIN_FUND` and `fundedBy`
     - §A.7 `submitCandidate` checks, **in the listed order, with the listed revert strings**, including the re-list branch of the window check and `wasListed`, plus `checkEligibility`
     - §A.8 review (the `adminReviewed` lock, the `flag` guard, `reinstate` re-inserting only `wasListed` sessions, `adminSubmit` with `LIST_FULL`/`TOO_LATE`)
     - §A.9 finalize (the `staffEver` skip with `CandidateSkipped`; a zero pot records no winner), claim and recycle
     - §A.10 end of life (no funding precondition on `scheduleEnd`), `refundAfterEnd`, residue, `nominateResidualRecipient`/`acceptResidualRecipient`, and `sweepStray`/`recoverResidual` with the `LIABILITIES_BREACHED` post-condition
     - §A.13 events
     - §A.14 views
2. **Compile:**
   - Append the three sources to `contractFiles` in `scripts/compile-contracts.mjs`.
   - Artifacts land in `contracts/artifacts/`.
   - **The 9 existing artifacts stay byte-identical** (`git diff --exit-code` on them after `npm run contracts:compile`).
   - Add `--mocks`, which compiles `contracts/test/mocks/{FeeOnTransferToken,BlacklistToken,ReentrantToken,MaxTxToken,SenderFeeToken,DoubleEntryToken}.sol` into committed `tests/fixtures/contract-mocks/*.json`. The default run does not write mocks.
   - If the `WeeklyJackpot` runtime exceeds 24,576 B, split the string-returning views into `contracts/src/WeeklyJackpotLens.sol` (design §A.1); never change compiler settings for the existing 9 artifacts.
   - Optionally, add required signals for the new files to `scripts/contract-structure-check.mjs`, for example `function submitCandidate`, `function finalize`, `trySafeTransfer`, `nonReentrant`, `residualRecipient`. Do not change the existing lists.
3. **Opcode audit test.** It disassembles the creation and runtime bytecode of `WeeklyJackpot` and `TestChikunToken`, skipping PUSH data. It fails on any opcode outside the Cancun set: explicitly `0x1e` (CLZ), plus unassigned bytes in code positions. (The design lists this as UNVERIFIED LitVM osaka support.)
4. **Local deploy helper** `scripts/lib/local-jackpot.mjs` exports:
   - `deployLocalJackpot({ provider, wallets, record, firstWeek, rules, token, residualRecipient, keeper, admin })`, which returns `{ jackpot, token, record }` with the design §A.18 record shape;
   - `launchRules(record)`, the recommended launch rules of §A.5;
   - `weekIndexOf(tsSeconds)` and `weekKeyOf(weekIndex)`, pure, matching `periodKeyFor('weekly', …)`;
   - `setChainTime(chain, isoOrSeconds)`.
   - It deploys **after** `deployLocalSuite` and never touches the parity region of `tests/local-deploy-harness.test.mjs:112-113,208-234`.
   - It adds the named fixture wallets `keeper` and `player3`, derived from the Hardhat mnemonic at indexes 8 and 9 and funded with `setBalance`. It does **not** change `LOCAL_WALLET_ROLES`, which `tests/local-deploy-harness.test.mjs:172-174` pins.
   - `admin` defaults to `wallets.developer`, mirroring production, where the admin wallet is also the dev wallet.
   - It supports a second deploy on the same chain (`deployLocalJackpot({ …, token })` with a mock token), which the rehearsal uses for R9 and the `retired[]` path.
5. **Deploy script** `scripts/deploy-weekly-jackpot.mjs` (design §A.18):
   - a dry run by default;
   - `--broadcast --confirm DEPLOY_WEEKLY_JACKPOT_4441`;
   - the key only through `key-source` (`--key-env` or `--key-file --key-field`), required to equal the operator the script reads from `LITVM_DEPLOYMENT`, and the address must hold code;
   - `--rpc` and `--deployment` overrides only for loopback;
   - options `--game chikun`, `--first-week next|<future YYYY-Www>` (`current` and past weeks are refused), `--admin`, `--keeper`, `--residual`, `--rules launch|<json file>`, `--token <address>` (skips the tCHIKUN deploy), and `--retire-previous` (moves the current instance into `retired[]` and requires `firstWeek > previous.endAfterWeek`, read from chain);
   - `--rules launch` gives design §A.5's table: `minPaidWei` 0.1 zkLTC, `minFundWei` 100 tCHIKUN, `adminClearOnly` true for the first epoch;
   - the dry-run manifest lists predicted addresses from `pendingNonce`, constructor args, gas estimates, and an `eth_call` of each creation code (it proves the constructor executes);
   - after a broadcast it reads the immutables and roles back, writes `contracts/deployment-record.jackpot.json`, and calls the generator's writer.
6. **Generated module:**
   - `scripts/generate-litvm-jackpot.mjs` renders `apps/portal/src/generated/litvm-jackpot.mjs` deterministically (lowercase addresses, stable key order, banner) from the record, or as `status:'undeployed'` with null addresses and an empty `retired` list when no record exists. `--check` fails on a diff.
   - Commit the undeployed module.
   - Regenerate the curated source inventory with `npm run assets:hmh:curated-level-kit-runtime` and commit it (`tests/hmh-curated-level-kit-inventory.test.mjs` walks `apps/portal/src`).
   - Export a pure `renderLitvmJackpotModule(input)`.
7. **Operator CLI** `scripts/jackpot-actions.mjs`: every action and confirm phrase of design §A.18, including `force-admin`, `operator-pause`/`operator-unpause` and `refund-after-end`. There is no operator `transfer-admin` any more (the two-step transfer is the admin's own, from the owner page).
   - A dry run by default. The signer is checked against the on-chain role (operator, minter, or any key for `fund`/`finalize`). Secrets are never printed.
   - `fund` does `approve(exact)` + `fund(week, amount)` and accepts `--week current|<YYYY-Www>`.
   - `status` prints roles, both pause flags, the current week, the pots and prizes of the current and previous week, candidates, liabilities, rules and the keeper balance.
   - `set-keeper` prints a reminder to block the outgoing keeper wallet from the owner page.
8. **Keeper key generator** `scripts/jackpot-keeper-key.mjs --out <path>`:
   - writes `{ "address": …, "privateKey": … }` with mode 0600 where supported;
   - refuses to overwrite and prints only the address;
   - is tested in the OS temp directory only.
9. **Docs.** Create `docs/web3/weekly-jackpot-operations.md` with sections headed `## Contracts` (yours), `## Server` (left for jackpot-server) and `## Rehearsal and go-live` (left for jackpot-rehearsal). Yours covers what the contract guarantees (design §A.16, all 15 items), roles, the deploy commands, operator actions, the token acceptance checklist (§A.11, all 10 items), instance migration (§A.19), and the emergency stops that touch the contract.
10. **`package.json`:** one script, `"contracts:test:jackpot": "node --test tests/weekly-jackpot-*.test.mjs tests/jackpot-deploy-tooling.test.mjs"`.

## Files

**You own:**
- C `contracts/src/WeeklyJackpot.sol`, `contracts/src/TestChikunToken.sol`, `contracts/src/interfaces/IRankedReaders.sol` (and `contracts/src/WeeklyJackpotLens.sol` only if the size limit forces it)
- C `contracts/artifacts/{WeeklyJackpot,TestChikunToken,IRankedScoreReader,IRankedEntryReader}.json`
- C `contracts/test/mocks/*.sol`, `tests/fixtures/contract-mocks/*.json`
- C `scripts/lib/local-jackpot.mjs`, `scripts/deploy-weekly-jackpot.mjs`, `scripts/generate-litvm-jackpot.mjs`
- C `apps/portal/src/generated/litvm-jackpot.mjs`
- E `apps/portal/assets/generated/hmh-curated-level-kit/hmh-curated-level-kit-runtime.mjs` (regenerated, never hand-edited)
- C `scripts/jackpot-actions.mjs`, `scripts/jackpot-keeper-key.mjs`
- C `tests/weekly-jackpot-contract.test.mjs`, `tests/weekly-jackpot-lifecycle.test.mjs`, `tests/jackpot-deploy-tooling.test.mjs`
- C `docs/web3/weekly-jackpot-operations.md` (the Contracts section)
- E `scripts/compile-contracts.mjs` (append sources; the `--mocks` flag)
- E `scripts/contract-structure-check.mjs` (additions only)
- E `package.json` (one script)
- E `scripts/syntax-check.mjs` (after `'apps/portal/src/generated/litvm-addresses.mjs',`)

**Read-only:** everything else. In particular:
- `scripts/deploy-contracts.mjs`, `scripts/operator-actions.mjs`, `tests/operator-tooling.test.mjs`, `scripts/lib/local-chain.mjs`
- `server/**`, `api/**`, `apps/portal/src/generated/litvm-addresses.mjs`, `vercel.json`

If `local-chain.mjs` truly needs a hook, name it in the commit and keep it additive.

## Interfaces

- **Produced:**
  - the artifacts, consumed by `server/chain/abis.mjs` (jackpot-server) and `tests/chain-abis.test.mjs`;
  - `LITVM_JACKPOT` (design §A.18), consumed by the server config, the UI and the owner page;
  - `deployLocalJackpot`, `launchRules`, `weekIndexOf`, `weekKeyOf` and `setChainTime`, consumed by jackpot-server tests and jackpot-rehearsal;
  - the revert strings of design §A.15, consumed by `server/jackpot/errors.mjs`.
- **Consumed:** the deployed-suite artifacts and `deployLocalSuite`/`activateLocalGames` from `scripts/lib/local-chain.mjs`.

## Plan

1. Write `IRankedReaders.sol` and `TestChikunToken.sol`, append them to the compile list, compile, and confirm the old artifacts are unchanged. Add a tCHIKUN test: metadata, `mint` only by the minter, the per-call cap, the two-step minter transfer. Commit.
2. Write `WeeklyJackpot.sol` in this order, with tests per step in `tests/weekly-jackpot-contract.test.mjs`:
   1. roles
   2. week math
   3. rule epochs
   4. `fund`
   5. eligibility and `submitCandidate`
   6. review
   7. `finalize` / `claim` / `recycle`
   8. end of life and stray tokens
   9. views
3. Add the mocks, `--mocks`, and the lifecycle tests (`tests/weekly-jackpot-lifecycle.test.mjs`):
   - full weeks with time travel;
   - rollover chains;
   - cap excess;
   - a blacklisted winner followed by a claim to another address;
   - a max-transaction token that refuses the prize transfer (claim-pending, then a claim);
   - a fee-on-transfer fund, and a sender-fee token and a double-entry-point token against the sweep post-condition;
   - a reentrant token;
   - the randomized invariant run (design §A.12, §A.16).
   Then the opcode audit. Commit.
4. Add `local-jackpot.mjs`, the deploy script and the generator (+ undeployed module). Test in `tests/jackpot-deploy-tooling.test.mjs`: the dry run on the local chain, a loopback broadcast, the record shape, the module render and `--check`, operator refusal for a wrong key. Commit.
5. Add `jackpot-actions.mjs` and `jackpot-keeper-key.mjs`, with tests for every action on the local chain (dry run vs broadcast, confirm phrases, role checks, no secret in the output). Commit.
6. Docs, `package.json` and syntax-check entries. Run the full gate. Commit.

## Tests (names are the `test()` titles; one file stays under 60 s)

**`tests/weekly-jackpot-contract.test.mjs`:**
- "week math matches ISO weekly keys at every Monday boundary", including 2026-W39/W40 and 2026-W53 → 2027-W01, at ±1 s
- "rules can only be scheduled for weeks that have not started"
- "rulesFor returns the epoch in force for each week"
- "fund credits the received amount to current or future weeks only"
- "fund with a fee-on-transfer token credits the balance delta"
- "submitCandidate enforces every eligibility check in order", table-driven; one case per revert string of design §A.7
- "zero-fee and below-minimum sessions are ineligible"
- "a run settled after the cutoff is rejected and an extension moves the cutoff"
- "candidates are ordered like the board and kept one per wallet", including a tie on score broken by submittedAt, then by sessionId
- "a full list rejects a lower run and drops the last row for a higher one"
- "staff wallets can never be candidates"
- "keeper clears and flags, but cannot undo a flag or clear under adminClearOnly"
- "keeper cannot clear or flag a session the admin reviewed, and nobody flags a disqualified one"
- "admin disqualify removes the candidate and promotes the next"
- "a displaced session can be re-listed after the window until two hours before payout"
- "five decoys displace the honest list, the admin disqualifies them, and the honest leader is re-listed and paid"
- "adminSubmit fills a short list after the window and cannot displace anyone"
- "reinstate re-inserts only a session that was listed"
- "firstWeek must be after the deploy week"
- "any address that ever held a role is ineligible forever and finalize skips it publicly"
- "rule epochs are bounded in number and horizon"
- "funding below minFundWei is refused and no funding can block scheduleEnd"
- "role checks use the house revert strings"
- "operator and admin transfers are two-step"
- "a compromised admin cannot lift an operator pause or resist forceAdmin"

**`tests/weekly-jackpot-lifecycle.test.mjs`:**
- "a funded week pays the cleared leader at the payout time and not before"
- "finalize refuses an uncleared leader and never skips to a lower candidate"
- "a week with no eligible candidate rolls into the current week"
- "a zero pot records no winner"
- "the prize cap pays the cap and carries the excess forward"
- "a blacklisted winner's prize becomes claimable to another address"
- "unclaimed prizes recycle into the pool after 180 days"
- "pause stops payouts and keeper clears only"
- "a held week cannot finalize until released"
- "after a scheduled end, funders recover their own later-week funding and residue reaches only the residual recipient after 30 days"
- "only the residual recipient can nominate its successor"
- "sweepStray never touches liabilities, even for sender-fee and double-entry tokens"
- "a reentrant token cannot re-enter fund, finalize or claim"
- "randomized sequences keep balance at or above liabilities and the accounting identity exact"
- "native zkLTC is refused"
- "jackpot and test token bytecode use only Cancun opcodes"

**`tests/jackpot-deploy-tooling.test.mjs`:**
- "deploy dry run prints a manifest and sends nothing"
- "deploy refuses a current or past first week and an overlapping retire-previous"
- "deploy broadcast needs the confirm phrase and the operator key"
- "the record and generated module round-trip and --check detects drift"
- "the committed module is undeployed or consistent with the jackpot record"
- "jackpot actions dry-run by default and act only with the phrase"
- "fund approves the exact amount and credits the chosen week"
- "keeper key generator writes a new file, prints only the address, and never overwrites"

## Pitfalls

- **`isPaid` is true for zero-fee sessions, and settlement skips the paid check when `entryFeeWei` is 0.** Your eligibility must use `getPaidSession` and `minPaidWei`. Enable fees in tests, as the baseline does.
- **The `bytes32` ordering must equal lowercase-hex text order** (it does numerically). Test the sessionId tiebreak explicitly.
- **`trySafeTransfer` returns false and does not bubble a revert.** Assert the `PrizeTransferFailed` path with the blacklist mock.
- **Liabilities bookkeeping:**
  - `claim` and a successful `finalize` decrease it;
  - rollover, cap excess and recycle only move amounts between weeks;
  - residue decreases it only on `recoverResidual`.
  The randomized test must check the identity after every step.
- **Do not import `scripts/deploy-contracts.mjs`**: it has top-level side effects. Deploy with `ContractFactory` from the artifacts, as `local-chain.mjs` does.
- **`firstWeek` and `currentWeek` depend on chain time.** Set time with `evm_setNextBlockTimestamp` plus `mine`, never with the wall clock.
- **Keep the artifact namespace flat and collision-free.** Interface names must not reuse an existing artifact name.
- **Contract size must stay under 24,576 B of runtime.** Revision 2 adds functions; measure after the views step and split into a lens early if you are above about 22 KB. Record the numbers in the commit.
- **`staffEver` is sticky by design.** Never add a way to clear it; tests assert that a rotated-out admin, operator or keeper is still refused.
- **The re-list branch must require `wasListed`.** Without it, the window check means nothing.
- **`refundAfterEnd` must require `currentWeek() > endAfterWeek`,** so a cancelled end can never have paid out refunds.
- **The keeper lock is per session (`adminReviewed`), not per week.** A keeper action on another session of the same week is still allowed.
- **The `scripts/syntax-check.mjs` file uses LF endings.** Check with `git diff --stat` that only your lines changed.

## Definition of done

- Acceptance criteria 1-10 hold, and the listed tests pass offline in under 60 s per file.
- The existing artifacts are byte-identical.
- `apps/portal/src/generated/litvm-jackpot.mjs` is committed as `undeployed`.
- `npm test`, `npm run check`, `npm run contracts:check` and `npm run build` pass, and `npm run test:release` shows exactly 51. Do not commit the gate JSON.
- There are no chain writes outside the in-process chain.
- The final commit message records the runtime and creation bytecode sizes of both contracts.

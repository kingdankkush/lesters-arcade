# Chikun Weekly Jackpot: operations

The binding design is `docs/game-design/chikun-weekly-jackpot-design-20260924.md` ("the design"). This document is written in three parts, one per slice:
- **Contracts** (jackpot-contracts): what the contract guarantees, the roles, deploying, operator actions, the token checklist, instance migration and the contract-level emergency stops.
- **Server** (jackpot-server): environment, cron, keeper and the admin review rubric.
- **Rehearsal and go-live** (jackpot-rehearsal): rehearsal commands, receipts, the runbook with exact commands, and the weekly checks.

Nothing here is run against LiteForge by an agent. Every ⚠ step of the design's runbook (§E) needs the owner's approval in the moment.

## Contracts

### What is deployed

| Contract | Source | Size (solc 0.8.35, optimizer 200) |
| --- | --- | --- |
| `WeeklyJackpot` | `contracts/src/WeeklyJackpot.sol` | runtime 22,338 B (limit 24,576 B, so no lens contract), creation 24,851 B |
| `TestChikunToken` (tCHIKUN) | `contracts/src/TestChikunToken.sol` | runtime 2,588 B, creation 3,276 B |
| `IRankedScoreReader`, `IRankedEntryReader` | `contracts/src/interfaces/IRankedReaders.sol` | interfaces |

- One jackpot instance per (game, prize token). This phase deploys one: Chikun with tCHIKUN on LiteForge (chain 4441).
- The jackpot **only reads** the deployed 1.8.x `ScoreSubmissionRegistry.getSession` and `ArcadeRankedEntry.getPaidSession`. The Ranked contracts are not redeployed or changed.
- Immutables: `gameId`, `token`, `scoreRegistry`, `rankedEntry`, `firstWeek`. There is no `setToken`: a new token needs a new instance.
- tCHIKUN is a plain 18-decimal ERC-20 named "Lester's Arcade Test CHIKUN (no value)". Only the minter (the operator) mints, at most 10,000,000 per call, and the minter role moves in two steps. It has no burn-from, pause, blacklist or fee.
- The new bytecode uses Cancun opcodes only (`tests/weekly-jackpot-lifecycle.test.mjs` audits it; LitVM osaka support is unverified), and the deploy dry run `eth_call`s both creation codes against the target chain.

### The week

- `weekOf(ts) = (ts + 3 days) / 1 week`; weeks run Monday 00:00 UTC to the next Monday, the same ISO week as the weekly board (`periodKeyFor('weekly', …)`). A session's week is the week of its paid `openedAt`.
- For week W closing at C: runs must be settled on chain by **C + 6 h**, new candidates are accepted until **C + 12 h**, a listed-then-displaced candidate can be re-listed until **payout − 2 h**, and `finalize` is allowed from **C + 24 h**. The admin can extend one week by at most 72 h in total.
- `firstWeek` is after the deploy week (the constructor enforces it), so no run opened before the contract, its rules and its block list existed can win.

### What the contract guarantees (design §A.16, each one tested)

1. A prize reaches only the week's winner, or the `to` address the winner chooses in `claim`. The only other outflows are `refundAfterEnd` (a funder's own contribution to a week after a scheduled end, to that funder), `recoverResidual` (the residual recipient, only after a scheduled end and a 30-day delay) and `sweepStray` (only the excess over liabilities).
2. An open week's pot never decreases.
3. A week's rules never change after the week starts.
4. A session that fails on-chain eligibility is never listed: unverified, unpaid, wrong game, wrong season, settled late, over a cap, or from a staff, blocked or disqualified wallet.
5. `finalize` never pays a candidate while a higher, non-disqualified candidate exists, and never pays an uncleared leader.
6. The keeper cannot undo a flag, cannot clear under `adminClearOnly`, and cannot change any session the admin reviewed; nobody can flag a disqualified session.
7. A week finalizes at most once, and never before its payout time.
8. `token.balanceOf(jackpot) >= liabilities`, unless the token itself misbehaves (a rebase).
9. Native zkLTC is refused (no payable function, no `receive` or `fallback`).
10. An address that ever held the admin, operator or keeper role never wins, at any later time (`staffEver` is sticky and never cleared).
11. A displaced, non-disqualified session can always return before payout − 2 h when a slot is free, so a sybil flood of decoys is recoverable.
12. The admin cannot lift the operator's pause or block `forceAdmin`.
13. No funding (of any size, for any week) prevents `scheduleEnd`, and funding for a week after an end reaches nobody but its funder.
14. A week with a zero pot records no winner.
15. `reinstate` never inserts a session that was never listed.

The accounting identity `liabilities == Σ open (funded + carriedIn) + Σ unclaimed + residual` is asserted after every step of two seeded randomized runs. Each run pays winners, leaves a prize claim-pending and claims it, carries cap excess, rolls pots over, and ends with refunds and the residue recovery.

`finalize` books the prize as paid before the token transfer and books it back as claimable only if the transfer fails (checks-effects-interactions). A token callback during the transfer therefore never sees the prize as both paid and owed.

### Roles

| Role | Holder on the tCHIKUN instance | Powers |
| --- | --- | --- |
| Operator | `0x6Ac08Bed727A6951D755F0674f096E6A8AC06bfF` (vault key, CLI only, never in Vercel) | `scheduleRules`, `setKeeper`, `operatorPause`/`operatorUnpause`, `forceAdmin`, `scheduleEnd`/`cancelEnd`, `recoverResidual`, `sweepStray`, two-step `transferOperator` |
| Admin | `0x07cec6Fc49CAf6528F2f2F796042629cd3f48B26` (the owner's browser wallet, owner page) | `clear`, `flag`, `disqualify`, `reinstate`, `adminSubmit`, `setBlocked`, `holdWeek`/`releaseWeek`, `extendWeek`, `pause`/`unpause`, two-step `transferAdmin` |
| Keeper | the fresh `jackpot-keeper-key.mjs` wallet (server cron) | `clear` (only from none or its own clear, never under `adminClearOnly`, never while paused), `flag` (only from none or its own clear); never on a session the admin reviewed |
| Residual recipient | the owner wallet `0x07cec6Fc…8B26` on the tCHIKUN instance (owner decision, design §H.1) | receives the residue and stray tokens; only it can nominate its successor (`nominateResidualRecipient` → `acceptResidualRecipient`) |
| Anyone | | `fund`, `submitCandidate`, `finalize`, `recycleUnclaimed`; the winner `claim`s; a funder `refundAfterEnd`s |

- The operator, the admin and the keeper are `staffEver` from the constructor; every later `acceptOperator`, `acceptAdmin`, `forceAdmin` and `setKeeper` adds the new holder. They can never win. The owner wallet is the admin, so it can never win.
- Role checks revert with the house strings: `"Only platform operator"`, `"Only pending operator"`, `ONLY_ADMIN`, `ONLY_PENDING_ADMIN`, `ONLY_KEEPER` (keeper or admin), `ONLY_WINNER`, `ONLY_RESIDUAL_RECIPIENT`.
- A pause (`paused()` = admin pause or operator pause) stops payouts and keeper clears only. Funding, submissions, flags and claims continue.
- **Blocking does not free a slot.** `setBlocked` never removes a listed row. `finalize` skips a blocked row (`CandidateSkipped` "blocked"), but the row keeps its place, so a list full of blocked decoys stays full: a displaced honest run cannot be re-listed (`NOT_IN_TOP`), `adminSubmit` reverts `LIST_FULL`, and the pot rolls over. Against listed cheaters, first `disqualify(session, wholeWalletForWeek = true, …)` each listed session. That removes the rows and frees the slots, and the honest runs are re-listed with their clears. Then block the wallets (reason `cheating`) so the record is public. `tests/weekly-jackpot-contract.test.mjs` shows both paths.
- **`leaderOf(w)` is not a champion by itself.** It returns the highest row `finalize` would not skip, even in an unfunded week. `finalize` pays that row only if it is cleared and the pot (`funded + carriedIn`) is above zero; a zero pot records no winner. The UI and the keeper show or act on a leader only for a funded week.

### Interface notes for jackpot-server (and every other mirror of the contract)

These details go beyond the design's tables. Design §A.9, §A.13, §A.14 and §A.15 carry them as "J1 amendments" (2026-09-25), and the jackpot-server brief points here.

- **Order.** The eligibility checks of `submitCandidate` run in the order of design §A.7, and `checkEligibility(sessionId)` returns the same string without writing. A run that fails two checks reports the earlier one. The tests pin the pairs where the keeper's class would differ: `BEFORE_FIRST_WEEK` and `AFTER_END` before the rules, `WRONG_SEASON` before `SURVIVAL_CAP`, `SETTLED_LATE` before `STAFF_WALLET`, `STAFF_WALLET` before `WALLET_BLOCKED`, and `WALLET_BLOCKED` before `DISQUALIFIED`.
- **Revert classes the keeper needs beyond design §A.15's rev. 2 table:**

  | Revert | Where | Keeper class |
  | --- | --- | --- |
  | `AFTER_END` | `finalize` of a week after `endAfterWeek` | `already-done` (terminal). Such a week only holds refundable funding and never pays out, so it stays `Open` on chain until its funders `refundAfterEnd`. The cron never finalizes a week after the end and treats it as terminal ("refund-only"). |
  | `NOTHING_TO_CLAIM` | `recycleUnclaimed` (and `claim`) with nothing unclaimed | `already-done` |
  | `BAD_RULES` | `scheduleRules` and the constructor: no season, or `minFundWei` 0 | not sent by the keeper |
  | `END_FINAL` | `cancelEnd` or a new `scheduleEnd` after the last week has passed | not sent by the keeper |
  | `EMPTY_GAME_ID` | constructor only | not sent by the keeper |
- **`toWeek == 0` means the residue.** Amounts that reach the residue (a rollover, cap excess or recycle after a scheduled end) are reported with `toWeek = 0` in `RolledOver`, `CapExcessCarried` and `UnclaimedRecycled`. The mirror stores `rolled_to_week = NULL` for them; `weekStartOf(0)` is not a week.
- **`CandidateRemoved(w, id, "disqualified")`** names the disqualified session, and with `wholeWalletForWeek` also the wallet's OTHER listed session of that week, whose own `reviewOf` stays as it was. Mirror that row as removed and its wallet as `walletDisqualified[w]`; do not mark the sibling session itself disqualified.
- **`CandidateSkipped`** reasons are `blocked`, `disqualified-wallet` and `staff`, as designed. The contract also has a fourth, `disqualified`, which is unreachable today (disqualify removes a listed session, and a disqualified session is never listed); it is kept as a guard, and a mirror should accept it.
- **Leaders of unfunded weeks.** `leaderOf(w)` may name a cleared row while the pot is zero; `finalize` then records no winner (`Finalized(w, 0, 0, 0, 0)`, status `RolledOver`, no `RolledOver` event). Only a funded week has a champion.
- **Blocked rows keep their slots** (see Roles above): a keeper that sees a full list of blocked rows should put the week in `awaiting-admin`, not re-list.
- The constructor emits `OperatorTransferred(0, operator)`, `AdminTransferred(0, admin)`, `KeeperUpdated(keeper)` and `RulesScheduled` for the initial epoch, so an event mirror is complete from the deploy block.
- `weekBounds(w)` returns the calendar `start` and `close`; `settleCutoff`, `candidateUntil` and `payoutAt` include the admin extension.
- `reinstate` works before the payout time, or later while the week is held (the same rule as `adminSubmit`), so a hold keeps every admin correction open.

### Deploying (runbook E2 to E4)

1. **E2 ⚠ Keeper key** (the owner funds the printed address with 0.1 testnet zkLTC):

   ```bash
   node scripts/jackpot-keeper-key.mjs --out C:/Users/just_/lesters-arcade-vault/keys/jackpot-keeper.json
   ```

   It writes `{ "address", "privateKey" }` to a new file (mode 0600 where supported), prints only the address, and never overwrites. It refuses any path inside the repository: a directory named like `..keys` inside it counts as inside, and so does a junction or symlink that resolves into it.

2. **E3 Dry run** (reads LiteForge, sends nothing):

   ```bash
   node scripts/deploy-weekly-jackpot.mjs --game chikun --first-week next \
     --admin 0x07cec6Fc49CAf6528F2f2F796042629cd3f48B26 --keeper <keeper address> \
     --residual 0x07cec6Fc49CAf6528F2f2F796042629cd3f48B26 --rules launch
   ```

   The manifest lists the operator's pending nonce, the predicted tCHIKUN and jackpot addresses, the constructor arguments, gas estimates and an `eth_call` of both creation codes. Add `--json` for the raw manifest. `--first-week` takes `next` or a future `YYYY-Www`; `current` and past weeks are refused.

   `--rules launch` is design §A.5: season `chikun-season-preview-1`, `minPaidWei` 0.1 zkLTC (the flat fee alone), `maxSurvivalSeconds` 3599, no score cap, no prize cap, `minFundWei` 100 tCHIKUN and `adminClearOnly` true for the first epoch. `--rules <file.json>` takes the same fields (seasons as names or bytes32).

3. **E4 ⚠ Broadcast** (the same flags plus):

   ```bash
   … --broadcast --confirm DEPLOY_WEEKLY_JACKPOT_4441 --key-file <vault keys file> --key-field keys.operator
   ```

   The key must be `LITVM_DEPLOYMENT.deployer`, which must also be the score registry's on-chain operator. The script:
   - deploys tCHIKUN (minter = operator), then the jackpot;
   - reads every immutable and role back;
   - writes `contracts/deployment-record.jackpot.json`;
   - regenerates `apps/portal/src/generated/litvm-jackpot.mjs` (`status: 'deployed'`).

   Refusals before anything is signed (exit 2, "Blocked"):
   - **The owner's wallet must be staff.** Chikun's developer wallet on `GameRegistry` (`0x07cec6Fc…8B26`, the owner's wallet, which cannot be changed there) must be the `--admin`, the operator or the `--keeper`, so that it is `staffEver` and can never win (design §H.1). Otherwise the manifest warns and the broadcast is refused.
   - **`--token` must be a usable ERC-20.** It must answer `totalSupply`, `balanceOf` and `allowance`, and have metadata the record accepts: a 1-64 character printable-ASCII name, a symbol matching Neon's `^[A-Za-z0-9$]{1,16}$`, and decimals from 0 to 36.
   - **A real-value token needs manual payouts and a cap.** `--token` without `--token-testnet` means real value, and J16/OJ6 then require `adminClearOnly` true and a prize cap (`maxPrizeWei` > 0), so `--rules launch` is refused for it.
   - **A rules file states its safety fields.** `--rules <file.json>` must state `adminClearOnly`, `maxSurvivalSeconds`, `minPaidWei`, `minFundWei` and the season; a missing field is never silently weakened.
   - The manifest also warns when the first epoch has `adminClearOnly` false (the launch rules keep it true).

   **If something fails after a transaction was sent** (an RPC outage during the read-back, a refused jackpot deploy after tCHIKUN landed, a record that cannot be written), the script exits **3** and prints "STRANDED ON CHAIN" with every deployed address, transaction hash and the recovery step:
   - Only tCHIKUN landed: re-run with `--token <that address> --token-testnet`, or deploy a fresh one.
   - The jackpot landed but the record was not written: the complete record is printed when it was built. Save it as `contracts/deployment-record.jackpot.json`, run `node scripts/generate-litvm-jackpot.mjs`, and do not deploy again.
   - The jackpot landed before the read-back failed: keep the output and record the address in the release notes. It is in no module, so the keeper, the UI and the owner page ignore it, and an unfunded instance never pays anyone. Never fund it. Fix the cause before deploying again, with a later `--first-week` if in doubt.

   Commit both files. `JACKPOT_LIVE` stays false. Once the calibration gate (OJ2) is met, schedule an `adminClearOnly = false` epoch for the flip week with `schedule-rules`.

- `--token <address>` uses an existing token and skips the tCHIKUN deploy. The manifest then lists the token acceptance checklist below for owner sign-off.
- `--rpc`, `--deployment`, `--record` and `--module` are honoured only with a loopback `--rpc` (the in-process chain in tests). A local broadcast must name `--record` and `--module`, so it never overwrites the committed files.
- `node scripts/generate-litvm-jackpot.mjs --check` verifies that the committed module matches the record (or is the undeployed module while there is no record).

### Operator actions (`scripts/jackpot-actions.mjs`)

Every action but `status` is a dry run unless `--broadcast --confirm <PHRASE>` and a key (`--key-env <NAME>` or `--key-file <path> --key-field <field>`) are given. The key is read inside the process and never printed, and the signer is checked against the on-chain role before anything is sent.

| Action | Confirm phrase | Signer |
| --- | --- | --- |
| `status [--json]` | none (read-only) | none |
| `mint-test --to <addr> --amount <tokens>` | `MINT_TCHIKUN_4441` | the tCHIKUN minter (test token only) |
| `fund --week current\|<YYYY-Www> --amount <tokens>` | `FUND_JACKPOT_4441` | any funder (approve of the exact amount, then `fund`) |
| `set-keeper <addr\|none>` | `SET_JACKPOT_KEEPER_4441` | operator |
| `schedule-rules --from-week next\|<YYYY-Www> [--rules launch\|<json>] [--admin-clear-only true\|false] [--max-prize <tokens>] [--min-fund <tokens>] [--min-paid-wei <wei>] [--max-survival <s>] [--max-score <n>] [--season <name>] [--alt-season <name\|none>]` | `SCHEDULE_JACKPOT_RULES_4441` | operator |
| `force-admin <addr>` | `FORCE_JACKPOT_ADMIN_4441` | operator |
| `operator-pause` / `operator-unpause` | `PAUSE_JACKPOT_4441` | operator |
| `schedule-end <YYYY-Www>` / `cancel-end` | `END_JACKPOT_4441` | operator |
| `recover-residual` / `sweep-stray <token>` | `RECOVER_JACKPOT_4441` | operator |
| `finalize <YYYY-Www>` | `FINALIZE_JACKPOT_4441` | any key (manual fallback) |
| `refund-after-end <YYYY-Www>` | `REFUND_JACKPOT_4441` | the funder's own key |

- `status` prints the roles, both pause flags, the current and previous week (pot, what the winner can receive, prize, winner, claim-pending amount, candidates with their review states), liabilities, the residue, the rules and the keeper balance (warning below 0.05 zkLTC). It also works while the module is undeployed.
- `schedule-rules` starts from the epoch that would otherwise apply to that week and changes only the flags given. With `--rules <file.json>`, the file (plus the flags) must state `adminClearOnly`, `maxSurvivalSeconds`, `minPaidWei` and `minFundWei`. On an instance whose token is not a test token, every epoch must keep `adminClearOnly` true and a prize cap (J16, OJ6).
- `set-keeper` reminds you to block the outgoing keeper wallet from the owner page.
- `--instance <address>` targets a retired instance (for its last finalizes and refunds).
- There is no operator `transfer-admin`: the two-step admin transfer is the admin's own, from the owner page.
- **E8 ⚠ example:** `node scripts/jackpot-actions.mjs mint-test --to <addr> --amount 1000000 --broadcast --confirm MINT_TCHIKUN_4441 --key-file <vault> --key-field keys.operator`.
- Fund at most one or two weeks ahead (the contract allows eight), because the rules of a future week can still change until it starts.

### Token acceptance checklist (design §A.11)

Before any real token is plugged in (`--token`), the owner signs off on each item:
1. `decimals()` (display only; the contract is decimals-agnostic).
2. **Fee-on-transfer or a tax on the recipient side:** `fund` credits the received amount, but the winner receives the prize minus the tax.
3. **Fees charged to the sender on outgoing transfers:** the balance falls below liabilities and the last claims revert. Reject such a token, or make the jackpot contract exempt.
4. **Blacklist or pause:** handled by the pull claim. The residual recipient must not be blacklisted (it can nominate a successor).
5. **Max-transaction, max-wallet, cooldown, "trading not enabled" gates and anti-sniper/anti-bot blacklists:** each makes `transfer` revert, so the winner is left claim-pending. The jackpot contract must be exempt from all of them, and the prize cap must be at most the max-transaction amount. A winner above a max-wallet limit claims to another address.
6. **Double entry points** (a second address that moves the same balance): `sweepStray`'s post-condition blocks the drain, but list the token as unsupported.
7. **Rebasing:** unsupported. A negative rebase can make liabilities exceed the balance.
8. **Upgradeable proxy or owner mint/blacklist powers:** a trust note on the rules page; the token owner could freeze the jackpot.
9. **Callbacks (ERC-777 style):** covered by `nonReentrant`.
10. **Gas-griefing transfers:** they can block `finalize`. Only vetted tokens.

For any real-value instance the design also makes these mandatory (J16, OJ6): `adminClearOnly = true`, a prize cap, winner verification and a legal review.

### Instance migration (design §A.19; emergency stop 7)

A new instance is needed for a real $CHIKUN token, a repointed `rankedEntry`, or a new Chikun game id (the only on-chain way to route Chikun's developer share to Louie; `GameRegistry` has no dev-wallet setter).

1. `jackpot-actions.mjs schedule-end <lastWeek>` on the old instance, at least one full week ahead, and announce it.
2. Deploy the new instance with `deploy-weekly-jackpot.mjs --token <address> --first-week <a week after the old end> --retire-previous …`. The script reads the old `endAfterWeek` from chain and refuses an overlapping first week, so no session can win on both. With an existing record, `--retire-previous` is required.
3. The record and module move the old instance into `retired[]`. The server keeps servicing every retired instance until all its weeks are terminal.
4. After the old instance's last week is finalized, funders run `refund-after-end` for any week they pre-funded past the end (with `--instance <old address>`). An unwon final pot becomes residue, recoverable to the residual recipient 30 days later.

### Emergency stops that touch the contract

1. **Stop payouts:** `pause` from the owner page (admin), or `jackpot-actions.mjs operator-pause --broadcast --confirm PAUSE_JACKPOT_4441 …` (operator; the admin cannot lift it). Funding, submissions and claims continue.
2. **Stop one week:** `holdWeek` from the owner page; `finalize` reverts `WEEK_HELD` until `releaseWeek`.
4. **Keeper key leaked:** `jackpot-actions.mjs set-keeper <new> --broadcast --confirm SET_JACKPOT_KEEPER_4441 …`. The old keeper stays `staffEver`. Then block it from the owner page, rotate the server env, and check the reviews it touched (it can never have changed a session the admin reviewed).
5. **Admin wallet compromised:** `operator-pause`, then `force-admin <new>` (one step; the compromised admin cannot contest it, and `transferAdmin`/`acceptAdmin` revert `OPERATOR_LOCK` while the operator pause is on). The new admin reviews every decision the old one made, then `operator-unpause`.
7. **New instance:** see instance migration above.

Stops 3 (the keeper env switch) and 6 (hiding the UI) are server-side; see the Server section.

### Local helpers for the other slices

`scripts/lib/local-jackpot.mjs` deploys all of this on the in-process chain, after `deployLocalSuite` and with fees on:
- `deployLocalJackpot({ provider, wallets, record, firstWeek, rules, token, residualRecipient, keeper, admin, retirePrevious })` returns `{ jackpot, token, record, wallets }`. The admin defaults to the developer wallet, as in production, and `wallets` adds the fixture `keeper` and `player3` (mnemonic indexes 8 and 9).
- `launchRules(record)`, `weekIndexOf`, `weekKeyOf` and `setChainTime(chain, isoOrSeconds)`.
- The run helpers `settleLocalRun`, `openLocalSession` and `attestLocalRun`.
- `deployMockToken(name)`, for the test mocks compiled with `node scripts/compile-contracts.mjs --mocks` into `tests/fixtures/contract-mocks/`.
- `fastLocalProvider(chain)`: an ethers provider without the per-request timer delay, which on Windows is about 15 ms per call.

`npm run contracts:test:jackpot` runs the three contract test files.

## Server

_Written by the jackpot-server slice (design §B.4, §C, §E). Everything here is testnet-only until the owner-approved runbook steps; `JACKPOT_LIVE` stays `false` and, while `LITVM_JACKPOT` is `undeployed`, the keeper cron is a recorded no-op (`skipped: 'jackpot-not-configured'`)._

### Configuration (`server/config.mjs`, `config.jackpot`)

`config.jackpot` is its own frozen part. It never touches `missing[]` or `settlementReady`, so a jackpot misconfiguration can never 503 `/api/settle` or the settle-retry cron.

| Env | Meaning |
| --- | --- |
| `JACKPOT_KEEPER_PRIVATE_KEY` | The keeper key (`0x` + 64 hex). It lives only in the closure `config.jackpot.keeper.createWallet(ethers, provider)`; `toJSON`, `toString` and `inspect` never show it. Its own key, nonce stream and `relayer_lease` row (keyed by the keeper address), never the settle relayer's (J9). |
| `JACKPOT_CONTRACT_ADDRESS` | Cross-checked against `LITVM_JACKPOT.instances.chikun.address` (statically imported, so the Vercel tracer bundles it): `{ configured, address, matchesDeployment }`. |
| `JACKPOT_PAUSED` | `true` stops every keeper transaction (the cron answers `skipped: 'jackpot-paused'`, recorded as a success); the read APIs keep working. `/api/health` reports it as `jackpot.paused.env`. |
| `JACKPOT_UI_HIDDEN` | `true` makes `/api/jackpot` answer `{ ok: true, live: false, game: 'chikun' }` and the replay endpoint 404, which hides every surface once the CDN cache expires (at most about 150 s), without a client release. |
| `JACKPOT_MAX_TX_FEE_WEI` | The fee cap per keeper transaction; default `10000000000000000` (0.01 zkLTC). A send whose `gasLimit × maxFeePerGas` would exceed it waits (`fee-too-high`); a balance under it waits (`keeper-underfunded`). |
| `JACKPOT_ADMIN_WALLET` | Optional extra constraint on `/api/jackpot/review`: when set, the caller must equal it **and** the live on-chain `admin()`. A value that is not an address locks the review API (fail closed). |

`config.jackpot.ready = keeper.configured && contract.configured && contract.matchesDeployment && LITVM_JACKPOT.status === 'deployed'` gates the cron. The read endpoints (`/api/jackpot`, the replay and the owner review) need no key and use `config.jackpot.readable = contract.configured && contract.matchesDeployment && LITVM_JACKPOT.status === 'deployed'`: clearing a leaked keeper key stops the keeper but never hides the jackpot or locks the admin out of the review page ("reads continue", design §C.1). The server also needs the Ranked variables it already has (`NEON_DATABASE_URL`, `CRON_SECRET`, `SESSION_SECRET`, `RPC_URL`).

Test seams (never read from env): `readServerConfig(env, { deployment, jackpotDeployment })`; the jackpot handlers' `buildDeps` take `jackpotDeployment` next to `db`, `provider`, `deployment`, `nowMs`, `fetchImpl` and `crypto`, and the cron also `jackpotSelect`, `keeperFault` and `fundingLookup`.

### Database (migration 3, `0003_weekly_jackpot`)

Exactly the design §C.2 DDL: `jackpot_weeks`, `jackpot_candidates`, `jackpot_actions`, `jackpot_events`, `jackpot_wallet_flags`, `jackpot_rules`, `seed_ticket_log` and their indexes. Every handler migrates on first use (`ensureSchema`); the version lives in one constant (`JACKPOT_MIGRATION_VERSION`), so a merge that must renumber changes one line. Neon only mirrors the chain: every decision is on chain.

`seed_ticket_log` is written best-effort by `server/settle/seed.mjs` right after a ticket is issued (one background call; a failure, a missing table or a hung insert never changes or delays the seed response). It feeds seed provenance, H10, S11 and the ticket-to-pay delay. Prune it with `jackpot-ops prune-tickets` (below). H10 applies to runs of weeks at or after the week the log shipped (design §B.4), which the server reads as the week of the oldest logged ticket: a run from an earlier week has provenance `unlogged` and is not held, while a run with no ticket once the log has rows, or while the log is empty, is `missing` and held (the log should be writing). Runbook E6 (the release live before `firstWeek`) normally makes `unlogged` impossible; pruning only drops tickets older than 60 days, long after their weeks are terminal.

### The keeper cron (`/api/cron/weekly-jackpot`, every 5 minutes)

Gates, in order: `Authorization: Bearer ${CRON_SECRET}` (else 401); a database (else 503 `index-not-configured`); `config.jackpot.ready` (else 200 `skipped: 'jackpot-not-configured'`); `JACKPOT_PAUSED` (200 `skipped: 'jackpot-paused'`); then `ensureSchema` and one run. Every authorized run is recorded in `cron_runs` as `weekly-jackpot`. The function has `maxDuration: 300`, `memory: 1024` and the obstacle shapes in `includeFiles` (the re-replay fails closed with `verify-unavailable` without them); the run keeps a 120 s soft budget, indexing at most 15 s per instance, an 8 s timeout on every RPC call and at most 15 s per receipt wait.

Each run, for every instance (the active one and retired ones with unfinished weeks): index the jackpot events into `jackpot_events` and the mirrors (its own `indexer_state` stream, `litvm-4441-jackpot-<address>`), reconcile the views, then walk every unfinished week, oldest first:

| State | When | Action | Next |
| --- | --- | --- | --- |
| `open` | now ≥ close | nothing | `closed` |
| `closed` | now ≥ close + 2 h, pot < `minFundWei` | nothing is sent | `unfunded` (terminal) |
| `closed` | now ≥ close + 2 h, pot ≥ `minFundWei` | the selection query (top 10 eligible rows, keep 5) | `selecting` |
| `selecting`, `review`, `awaiting-admin` | every run | screen pending rows (on-chain rows by rank, then keeper selections, then displaced public rows; at most 5 per week per run): pass → `clear` (never under `adminClearOnly`), hold or integrity failure → `flag`; keeper selections that pass integrity → `submit`; never a clear or flag for an admin-reviewed or disqualified session. Send due actions (at most 3 per week per run). | |
| `selecting` | every keeper action settled, every keeper row screened (a row whose screen errored 6 times in a row still retries but no longer holds the week; the week keeps `last_error = screen-errors`), now ≥ settle cutoff + 10 min | one last re-select | `review` |
| `review`, `awaiting-admin` | fewer than 5 rows on chain, a displaced `was_listed` row that is not disqualified or integrity-failed, now < payout − 2 h | re-list the best one the chain would take back: blocked and staff wallets, wallets disqualified for the week, and a wallet whose listed row ranks at or above it (`NOT_BETTER`) are left out, and `checkEligibility` confirms up to 5 rows in order, so a doomed row never hides the next honest one | |
| `review` | now ≥ payout: `leaderOf` is cleared, or empty (the pot rolls over, even with rows still listed: `leaderOf` skips exactly the blocked, wallet-disqualified and staff rows `finalize` skips), the week is not held and not paused | `finalize` | `finalizing` |
| `review` | now ≥ payout, anything else (flagged or uncleared leader, held, paused) | set `admin_waiting_since`; health and the status page warn | `awaiting-admin` |
| `awaiting-admin` | re-evaluated every run | as `review` | `review` / `finalizing` |
| `finalizing` | `Finalized` indexed, or `weekState` no longer Open | nothing | `paid`, `claim-pending` or `rolled` |
| `claim-pending` | `PrizeClaimed` or `UnclaimedRecycled` | nothing | `paid` / `rolled` |
| any | an action is dead (3 deterministic failures) | nothing | `failed` (the owner requeues) |

Anyone may finalize: a `Finalized` event makes a week terminal whatever the mirror said. Weeks after a scheduled end are refund-only and never processed.

**Mirroring reviews.** A `Cleared` or `Flagged` from a keeper is the keeper's; from anyone else it is the admin's, and the row becomes `admin_reviewed` (the keeper never acts on it again). The keeper set is every keeper the instance ever had: the persisted `KeeperUpdated` events (the constructor emits the first one), the committed instance keeper and the configured keeper address; the admin set likewise from `AdminTransferred`. A rotated keeper, or a retired instance whose record names no keeper, is therefore never mistaken for the admin. `disqualify(session, wholeWalletForWeek = true)` marks the wallet's other rows of that week disqualified too (the chain refuses them, and `finalize` skips them as `disqualified-wallet`); `Reinstated` lifts it by reading those rows' review back from the chain.

**Sending.** One action at a time per keeper under the lease. The transaction is signed locally, and its hash and nonce are recorded (status `submitted`) before the broadcast, so a crash only ever re-checks that hash; with no receipt 180 s after `submitted_at`, the chain state decides: done → `confirmed`, otherwise the transaction was dropped and the action goes back to `signed`, to be re-signed after the pre-send check (a nonce error during the broadcast also moves it back to `signed` and retries inside the lease). Every RPC call, the nonce re-reads and the revert decode included, has its own timeout. Before every send a pre-send check reads the chain (`candidatesOf`, `checkEligibility`, `reviewOf`, `adminReviewed`, `paused`, `weekState`): already done → `confirmed`; an admin decision (`adminReviewed` or `Disqualified`) → `skipped` with `review-locked`, so a stale screen, a re-signed dropped transaction or a rescreen never overrides the admin. Fees are `maxFeePerGas = max(10 × base fee, 5 gwei)` with a zero tip, capped by `JACKPOT_MAX_TX_FEE_WEI`. Revert strings map to the design's error codes (`server/jackpot/errors.mjs`); only allowlisted codes are stored or logged.

**Measured replay time (the §C.4 budget).** Measured on the development machine on 2026-09-25 with the committed 60-minute solver fixture: the verifier re-replay takes 3.4-6.3 s and the screen's analysis replay about 6.4 s, so one 60-minute candidate costs about 10-13 s (runs of human length cost a fraction of that). The cron therefore screens at most 5 rows per week per run inside its 120 s budget and starts a screen only with 15 s left; `api/jackpot-review.mjs` replays at most 3 missing timelines per request inside its 30 s.

### Public read API

- `GET /api/jackpot` (`public, s-maxage=30, stale-while-revalidate=120`; only the `game` and `history` query keys): the jackpot-ui shape of design §C.5 from the Neon mirrors only. The current week, the previous one and up to `history` older weeks, each with its own token (from the week row, never a constant), the funded pot, the candidates with their public review value, the winner (a hidden profile shows only its short wallet) and the finalize transaction. Amounts come only from indexed `Funded`/`Finalized` events: nothing that was not funded on chain is ever reported. With `JACKPOT_UI_HIDDEN`, or without a contract address matching the deployed module, it answers `live: false` (a missing keeper key does not hide it). Details the jackpot-ui parser relies on:
  - `previous` carries its own `token` and `contract`, like every `history` row; after an instance migration (design §A.19) the retired instance's last week is `previous` until the new instance has a week of its own;
  - `previous.candidates` holds at most 10 rows: the listed rows by chain rank, then the newest disqualified rows that were listed (the only rows with a public `reason`);
  - `current` is `null` while the instance has no mirrored rules epoch (before the first index after a deployment); like the contract, a week before the first epoch reads epoch 0.
- `GET /api/jackpot/replay?session=0x…` (rewritten to `/api/jackpot-replay`): a Chikun replay file (`chikun-replay-file-v1`) for candidates of weeks that have closed; anything else is 404 `not-available` (`s-maxage=60`). A closed week's evidence never changes: `s-maxage=3600, stale-while-revalidate=86400`.

### Owner review API (`GET /api/jackpot/review?week=YYYY-Www`)

Rewritten to `/api/jackpot-review` (`maxDuration: 30`, `memory: 1024`, the obstacle shapes in `includeFiles`). `Cache-Control: no-store`. Gates, before anything is read: a valid Bearer session (401, or 503 without `SESSION_SECRET`); a contract address matching the deployed module (503 `jackpot-not-configured`; the keeper key is not needed); the session wallet equals the **live** on-chain `admin()` of the active instance (one `eth_call`, cached for 60 s, so after an emergency `forceAdmin` the old admin loses access within a minute without a redeploy) and, when set, `JACKPOT_ADMIN_WALLET` → else 403 `not-admin`.

The body (design §C.6): every candidate (listed, displaced, disqualified) with features, hold codes with their rule text, soft signals, integrity and provenance results, the on-chain review with `adminReviewed` and `wasListed`, keeper action states, explorer links, the wallet's last 20 Chikun runs and the `timeline` (intervals, altitude samples, each obstacle's visible tick and route-commit tick, and whether each fast pair changed the trajectory); plus `nextEligible`, the next 10 unlisted selection rows with their screen state, for `adminSubmit`. **There are no owner write endpoints:** every decision is an on-chain transaction from the admin wallet on the owner page.

### Health, status page, profile and share

- `/api/health` gains `crons.weeklyJackpot` and a `jackpot` part: `{ configured, keeperAddress, keeperBalanceWei, paused: { env, onChain }, uiHidden, awaitingAdmin, awaitingAdminOldestHours, claimPending, failed }`. A failed read is `null` with `jackpot` in `degradedParts`, never a 500. A jackpot pause does not make Ranked unhealthy.
- `/owner/status.html` lists the `weekly-jackpot` cron next to the other two and a "Weekly jackpot" section (configured, keeper and its balance, both pauses, awaiting-admin, claim-pending and failed weeks), and warns when the keeper holds under 0.05 zkLTC, when either pause is on (a skipped cron run is recorded as a success, so this is the only signal), when a week is `awaiting-admin` (with a link to `/owner/jackpot.html`; red after 7 days), `claim-pending` or `failed`, and when the `weekly-jackpot` cron has not succeeded for 20 minutes.
- Profiles always carry `jackpot.wins` (possibly empty): only `paid` or `claim-pending` weeks with a prize above 0, with the token and dates from the week row.
- A share page and card show "Weekly Jackpot Champion · Sep 28 – Oct 4, 2026" (a date range, never an ISO week key; a week across New Year reads "Dec 28, 2026 – Jan 3, 2027") for the winning session of such a week; the card revision includes it, so cached cards refresh. A leader is never shown on a cached share asset.
- **Interface note (E9).** The public session (`/api/session/<shareId>` and `/api/verified-session`, `readPublicSession`) gains one additive top-level key, `jackpotChampion`: `null`, or `{ weekKey, startsAt, closesAt, label }` for the winning session of a `paid` or `claim-pending` week with a prize above 0. No client rejects unknown keys; the interface contract's §4.3.8 shape should record it at its next revision.

### Scripts

All are dry runs by default, need a confirm phrase to write, read secrets in-process only and never print them (contract §11 rule 13).

- `node scripts/jackpot-secrets.mjs --key-file <vault jackpot-keeper.json> [--key-field privateKey]` (runbook E6): lists what it would set in production; `--apply --confirm SET_JACKPOT_SECRETS` pipes `JACKPOT_KEEPER_PRIVATE_KEY` (its address must be the module's keeper, and never the relayer's, the verifier's, the admin's or the residual recipient's) and `JACKPOT_CONTRACT_ADDRESS` (from the committed `LITVM_JACKPOT`, which must be `deployed`) to `vercel env add … production` over **stdin only**, then checks the listing. A `--key-field` named like another role's (`operator`, `deployer`, `admin`, …) is refused: the operator key never goes into Vercel. It never touches `JACKPOT_PAUSED`, `JACKPOT_UI_HIDDEN` or `JACKPOT_LIVE`.
- `node scripts/jackpot-ops.mjs status | requeue --week <key> | rescreen --session <id> | prune-tickets --older-than 60d` (Neon, the `moderate-profile.mjs` pattern; refuses while the schema is behind):
  - `status`: unfinished weeks (and the last three weeks' finished ones), their actions by status, the admin wait and the ticket-log size;
  - `requeue --week <key> [--contract 0x…]` with `--apply --confirm REQUEUE_JACKPOT`: dead actions back to `pending` and a `failed` week back to `selecting`;
  - `rescreen --session <id>` with `--apply --confirm RESCREEN_JACKPOT`: the candidate's screen back to `pending` for the next run; refused for a session the admin reviewed or disqualified (it never creates a clear or flag for one) and outside `selecting`/`review`/`awaiting-admin`;
  - `prune-tickets --older-than 60d` (60 days at least) with `--apply --confirm PRUNE_TICKET_LOG`.
- `node scripts/chikun-plausibility-calibrate.mjs` (below) and `node scripts/chikun-plausibility-calibrate.mjs --fixtures` (regenerates the two jackpot-server replay fixtures).

### Calibration protocol (design §B.4; owner checkpoint OJ2)

`node scripts/chikun-plausibility-calibrate.mjs --probe --bots 4 --seed-variance [--human-dir tests/fixtures/chikun-human-calibration] [--from-neon --vouched <file>]` re-runs every rule over three named populations and writes `docs/qa/chikun-plausibility-calibration-<date>.json`:

- **(a) Must-hold set** (gated at 100% held): `routePilot` landscape and portrait, `routePilotFullSnapshot`, a `maxTicks`-truncated run and a late-evidence fixture.
- **(b) Known-evasion set** (reported, not gated): the exceptional bot on real seeds, the committed humanised solver and the widened-view pilot (`scripts/lib/chikun-evasion-pilots.mjs`). The receipt records their miss rates, so the owner sees what the screen cannot catch.
- **(c) Human set:** at least 40 runs from at least 5 people known to the owner, with a screen recording of each session kept by the owner (not committed); at least 15 runs of 8 minutes or more; across portrait and landscape and across touch, mouse and keyboard, including two-key, two-finger and worn-mouse input styles. Free Mode replays ("Download replay") are enough; anonymised replays go to `tests/fixtures/chikun-human-calibration/*.json`. `--from-neon` (read-only) adds live Ranked rows only for wallets in `--vouched`; every other Neon row is reported separately and **never enters a gate denominator**. Wallets are never written to the receipt.
- `--probe` reproduces the B.4 probe table; `--seed-variance` runs the fixed-seed, varied-noise pass (the seed's share of the survival variance: how much seed shopping could buy).
- **Gate for `JACKPOT_LIVE`:** 0 human holds on H4-H6, and the human hold rate on every other rule recorded with its one-sided Clopper-Pearson 95% upper bound (0 of 40 still allows about 7%); 100% of set (a) held; set (b) miss rates recorded; the H2/H3/H9 human hold rate recorded and tuned so that a human record set in the first weeks is reviewed rather than auto-paid. H11 (`unexplainedDescents ≥ 2` as a hold) applies only under `adminClearOnly` or a non-testnet token, and only after calibration: `H11_CALIBRATED` in `server/jackpot/plausibility.mjs` stays `false` until a calibrated S8 lands in a reviewed commit. The first receipt (`docs/qa/chikun-plausibility-calibration-20260925.json`, set (a) 11 of 11 held, set (b) 8 of 10 missed, no human set yet) shows why: the bot human models and the reflex bots reach 9-11 unexplained descents, as many as the widened-view pilot, so S8 is a review-page signal only for now.
- Thresholds live in `server/jackpot/plausibility.mjs` only, never in a public module; the rules page describes categories, not numbers.

### Admin review rubric

The owner page links here from Clear and Disqualify (design §E, verbatim).

1. **Always check:** integrity results (replay, chain, `maxTicks`, seed provenance); every hold code; the look-ahead overlay and S8; the evidence delay (H9/S9); the wallet's history and previous flags; the cross-wallet funding result (S10); other candidate wallets with similar timing.
2. **Clear** only when integrity passes and every hold is explained by the evidence (for example a long run by a player with a history of long runs, fast pairs that never changed the trajectory, a documented pause).
3. **Disqualify** when integrity fails, when the look-ahead overlay shows route commitments before obstacles were visible on more than one obstacle, or when several wallets are shown to belong to one person (`multi-wallet`, all of them).
4. **Never** disqualify on H4 alone, on one soft signal alone, or on a gut feeling about a score.
5. **Videos and "proof" recordings are never evidence:** the replay renders exactly, so anyone can record one. Live verification, if wanted, is a fresh Ranked run on a new seed under observation.
6. Record the reason code on chain and a one-line note in the ops log.

### Review SLA and the 7-day default

From design §E, step E11:

- **review SLA:** the owner reviews any `awaiting-admin` week within 24 h (the status page warns) using the rubric below. If a week has waited 7 days, the documented default applies: the admin disqualifies the uncleared leader with reason `other` and a published note, and the pot rolls over;
- a `claim-pending` week: contact the winner through the arcade's channels well before the 180-day recycle;
- keep the keeper above 0.05 zkLTC.

(The rubric the SLA refers to is the one above.) Against listed decoys the admin first disqualifies with `wholeWalletForWeek` (which removes the rows and frees the slots for re-listing), then blocks (design J1 note, 2026-09-25).

### Server-side emergency stops

- **Stop the keeper:** set `JACKPOT_PAUSED=true` in production env and redeploy the current release. The status page shows it as paused.
- **Hide the UI:** set `JACKPOT_UI_HIDDEN=true` and redeploy the current release (surfaces disappear once the CDN cache expires, within about 150 s).
- **Keeper key leaked:** `jackpot-actions.mjs set-keeper <new>` (the old keeper stays `staffEver`), block the old keeper wallet, rotate the env with `jackpot-secrets.mjs`, and check the week reviews it touched. While the key is cleared the cron skips (`jackpot-not-configured`), but `/api/jackpot`, the replays and the owner review keep working (they need only the contract address).
- A failed week: `jackpot-ops.mjs status`, fix the cause, then `jackpot-ops.mjs requeue --week <key> --apply --confirm REQUEUE_JACKPOT`.

## Rehearsal and go-live

_Written by the jackpot-rehearsal slice (design §E, §G; brief jackpot-rehearsal): the rehearsal commands and receipts, the runbook with exact commands, the J17 weekly check and the emergency stops._

Everything in the rehearsal runs in process: the Hardhat chain (4441), PGlite for Neon and every `api/*.mjs` handler, with public fixture keys. Nothing touches LiteForge, Vercel or production Neon, nothing reads the vault, and `JACKPOT_LIVE` is never flipped in a committed file. Only the live dry run (below) reads production, and only the owner session runs it, read-only.

### Rehearsal commands

| Command | What it does | Time |
| --- | --- | --- |
| `node scripts/rehearse-jackpot-week.mjs` | Runs R1-R20 (plus R3b and R13v) on one local stack, each scenario in its own weeks, and writes `docs/qa/jackpot-rehearsal-<YYYYMMDD>.json`. `--only R1,R13` runs a subset, `--no-write` skips the receipt, `--out <path>` writes elsewhere, `--json` prints it. Exit 1 when a scenario fails. | about 1 minute |
| `node --test tests/jackpot-rehearsal.test.mjs` | The driver checks and the fast subset R1, R3a, R5, R10, R13, R15 and R17 (it also runs inside `npm test` and the release gate), plus the committed receipt and checklist checks. | about 25 s |
| `node --test tests/jackpot-api-contract.test.mjs` | The real `/api/jackpot` at every lifecycle stage through the UI's `parseJackpot` and surfaces, and the real review API through the owner model's timeline geometry. | about 10 s |
| `node --test tests/jackpot-live-dry-run.test.mjs` | The live dry run against a local HTTP server and the in-process chain (read-only proof, every check, J17 drift). | about 10 s |
| `node scripts/jackpot-flag-flip-dry-run.mjs --confirm-throwaway` | The E10 commit rehearsed in a throwaway worktree (E4 first, then the flip, the whole suite at each state); writes `docs/qa/jackpot-flag-flip-checklist.json`. Refuses the main worktree. | about 25 minutes |
| `node scripts/jackpot-live-dry-run.mjs --site https://lestersarcade.io [--expect-live false\|true] [--funder <address> ...]` | The read-only live checklist (below). The owner session only; exit 1 when a check fails. | seconds |

The driver (`scripts/lib/jackpot-rehearsal-driver.mjs`) is reusable for new scenarios: `startJackpotStack()`, `playRankedChikunRun({ player, openedAt, profile | pilot | evidence, maxMinutes, maxTicks, settleAt })`, `advanceTo(t)` (chain and server clock together), `runJackpotCron(times, { select, fault })`, `admin(action, params)` (the owner page's encoding), `operatorAction(action, { args, argv })` (`jackpot-actions.mjs`), `jackpotOps(argv)`, `fund`, `claim`, `submitCandidate`, and the reads (`weekRow`, `candidateRows`, `actionRows`, `chainWeek`, `jackpotApi`, `reviewApi`, `health`, `profile`, `invariant`).

### Reading the receipts

`docs/qa/jackpot-rehearsal-<date>.json` (schema `lesters-jackpot-rehearsal-v2`):

- `ok`, `summary` (scenarios, passed, failed ids, expected misses), `head`, `scriptSha256` (the receipt belongs to exactly that script; `tests/jackpot-rehearsal.test.mjs` refuses a stale receipt) and `stack` (the local addresses, the launch rules, the E5 list).
- `scenarios[]`, one per scenario: `status`, `weekKeys`, every `checks[]` entry (`id`, `ok`, `detail`), `transactions` by role (keeper, relayer, operator, admin, funder, players, and how many reverted on purpose), `keeperGasUsed`, `finalBalances`, `invariant` (for every instance the scenario used: `balanceOf(jackpot) >= liabilities`) and `notes` (findings worth reading).
- `expectedMisses`: runs the screen is known not to catch (design §B.5). **An expected miss is not a failure.** R16 records one: an exceptional-model bot on a real seed passes the screen, is cleared by the keeper and is paid. For tCHIKUN that residual is accepted; for real value, `adminClearOnly`, a prize cap and human review are mandatory (J16, OJ6).
- `productBugs`: anything a scenario exposed in the product, with the fixing commit. An entry that is not `fixed` means the rehearsal is not done.

What each scenario proves:

| Id | Proves |
| --- | --- |
| R1 | A funded week: the keeper selects at C + 2 h, screens, submits and clears; `finalize` reverts `PAYOUT_NOT_DUE` at C + 24 h − 1 s and anyone may call it at C + 24 h; the board's top eligible wallet is paid; the profile and the share page show the win |
| R2 | A censored keeper (`jackpotSelect` drops the best run): the player submits it at C + 8 h, the keeper clears it within three runs, it is paid |
| R3a / R3b | A scripted-pilot leader is held (H4-H6) and flagged; the week waits for the admin (`LEADER_NOT_CLEARED`, the status page warns); a disqualification pays #2, a clear pays the leader |
| R4 | A record without stored evidence (a forged attestation) is never selected; submitted publicly, it is flagged `integrity` and never auto-paid |
| R5 | An unwon funded week: the keeper finalizes the empty leader, the pot rolls into the next week, which pays both |
| R6 | A relayer outage: a run posted on time is published at C + 6 h + 1 s; `SETTLED_LATE` on chain, excluded by the keeper, still on the weekly board (the documented divergence) |
| R7 | The admin extends that week by 12 h; the keeper re-selects, the late run is paid at C + 36 h |
| R8 | A prize cap scheduled the week before: `/api/jackpot` shows the cap and the carry-over, the cap is paid, the excess is paid out the next week |
| R9 | A blacklist-token instance: the winner is `claim-pending` (API, profile, status page), claims to another address, then `paid` |
| R10 | The keeper killed at `after-cas`, `after-broadcast` and `before-receipt`: no duplicate transaction, no nonce gap; the keeper's nonce moves by exactly the distinct actions |
| R11 | A pause stops payouts and keeper clears, not submissions or funding; a hold waits; staff (admin, operator, rotated-out and current keeper) and blocked wallets (test wallet, verifier, relayer, funder) are never candidates |
| R12 | An unfunded week: no keeper transaction, no amount in the API or the UI; stray tokens are swept to the residual recipient only above liabilities |
| R13 / R13v | Five decoy wallets displace the honest top 5; the keeper flags them first; the admin disqualifies them (`multi-wallet`, whole wallet); the keeper re-lists the honest rows before payout − 2 h; the honest leader is paid. R13v: the literal C + 11 h 59 min timing, and the never-listed honest #6 added with `adminSubmit` and paid |
| R14 | A Sunday session settled at C + 5 h just above the public leader is held by H9 (`late-evidence`), never auto-paid |
| R15 | A non-stock client (`maxTicks` 108,000) settles through the verifier but is never submitted by the keeper; submitted publicly, it is flagged `integrity` |
| R16 | The expected miss (above) |
| R17 | A dropped keeper flag, re-signed after the admin cleared the run, and a `jackpot-ops rescreen` never override the admin: the flag ends `skipped`/`review-locked`, the keeper's on-chain `flag` reverts `REVIEW_LOCKED`, the leader is paid |
| R18 | A compromised admin: `operator-pause` holds against its `unpause`; its `transferAdmin` reverts `OPERATOR_LOCK`; `force-admin` succeeds in one transaction; the review API refuses the old admin within 60 s; the new admin reinstates and clears; the operator unpauses |
| R19 | Dust and end of life: `BELOW_MIN_FUND`; `scheduleEnd` with future weeks funded; `refund-after-end` returns each funder's own funding; the unwon final pot becomes residual after 30 days; `sweepStray` of a double-entry token reverts `LIABILITIES_BREACHED` |
| R20 | Ranked-setting drift: a reserve of 0 keeps runs eligible; a repointed `rankedEntry` and fees off fail the live checker; the entry-modal row hides below `minPaidWei` |

Findings the rehearsal recorded (none is a product bug; each is in the receipt's `notes`):

- **Decoys meet the keeper first (R13).** Decoy runs settled before the cutoff are in the keeper's own last re-select (cutoff + 10 min), so the keeper lists and flags them about 5 h before an attacker could list them at C + 11 h 59 min. The defence is the same either way; R13v forces the literal timing.
- **A pause holds a week in `selecting` (R11).** While paused, the keeper's clears wait, so the week does not reach `awaiting-admin` (and its SLA clock) until the pause is lifted; `finalize` reverts `PAUSED` and the status page shows the pause the whole time.
- **The settle floor is part of J17 (R20).** A reserve cut to 0 keeps runs jackpot-eligible (`minPaidWei` is the flat 0.1 fee), but the server refuses entries paid 0.1 zkLTC with `402 entry-underpaid` until `RANKED_MIN_PAID_WEI` is lowered to match (default 0.102). The same Monday step changes both.
- **A role change needs the record updated (R11, R18).** After `set-keeper` or `force-admin`, commit the updated `contracts/deployment-record.jackpot.json` (`keeper` or `admin`) and regenerate the module with `node scripts/generate-litvm-jackpot.mjs`; until then the live dry run's `roles` check fails, which is how drift is noticed.

`docs/qa/jackpot-flag-flip-checklist.json` (schema `lesters-jackpot-flag-flip-checklist-v1`): `e4` (what runbook E4 itself changes in the tree and which tests the E4 commit updates), `flip` (the two edits, the build, every file the flip changes with the changed literals in `literalsChanged`, and `testsToUpdate` with the file, test, line, expected and actual), and `checklist` (files to edit, commands, preconditions, the commit, the release, the post-release smokes and the rollback).

### The live dry run

`node scripts/jackpot-live-dry-run.mjs --site https://lestersarcade.io` reads only (JSON-RPC `eth_chainId`, `eth_blockNumber`, `eth_getBlockByNumber`, `eth_getBalance`, `eth_call`, `eth_getCode`, `eth_getLogs`; HTTP GETs) and prints a JSON checklist; exit 0 means every check passed. It never prints the RPC URL. The checks, in order:

`rpc-chain`, `jackpot-deployed`, `code-jackpot`, `code-token`, `code-retired`, `immutables`, `roles` (against `contracts/deployment-record.jackpot.json`), `api-live`, `week-key` (`weekOf(now)` against the server's week), `rules-in-force` (`minFundWei > 0`), `j17-quote`, `j17-ranked-entry`, `j17-season`, `j17-game-id`, `j17-game-registered`, `pot-current`, `pot-previous` (chain against `/api/jackpot`), `pause` (chain against `/api/health`), `keeper-balance` (≥ 0.05 zkLTC), `cron-fresh` (20 min), `admin-backlog` (no week awaiting the admin over 24 h, none claim-pending), `no-failed-weeks`, `block-list` (the test wallet `0x8841…ce824`, the verifier, the relayer, each `--funder`), `residual-recipient` (blocked or staff), `staff-ever` (admin, operator, keeper), `staff-history` (every address the role events named), `jackpot-live-flag` (the served `JACKPOT_LIVE` and the rules page's `noindex` against `--expect-live`).

`--deployment`, `--jackpot-module` and `--record` override the committed files only with a loopback `--rpc` (the local stack).

### The runbook with exact commands (design §E)

⚠ marks a step the owner approves in the moment. `<vault>` is `C:/Users/just_/lesters-arcade-vault`; only the owner session reads it.

| Step | Commands |
| --- | --- |
| E0 | The four jackpot slices merged, the integration gate green (exactly 51). OJ1 approved, OJ2 receipt present (before E10), OJ3 legal text supplied (before E10). `node scripts/jackpot-actions.mjs status` works on the undeployed module. |
| E1 | `node scripts/rehearse-jackpot-week.mjs` → commit `docs/qa/jackpot-rehearsal-<date>.json` (R1-R20 passed; R16 as the expected miss). |
| E2 ⚠ | `node scripts/jackpot-keeper-key.mjs --out <vault>/keys/jackpot-keeper.json` (prints the address only). The owner sends 0.1 testnet zkLTC to it (MetaMask: max base fee 5 gwei, priority 0). |
| E3 | `node scripts/deploy-weekly-jackpot.mjs --game chikun --first-week next --admin 0x07cec6Fc49CAf6528F2f2F796042629cd3f48B26 --keeper <keeper> --residual <recipient> --rules launch` (dry run: the manifest, predicted addresses, gas, and the read-only `eth_call` of both creation codes on LiteForge). The launch rules make the first epoch `adminClearOnly = true`. |
| E4 ⚠ | The same with `--broadcast --confirm DEPLOY_WEEKLY_JACKPOT_4441 --key-file <vault>/<keys file> --key-field keys.operator`; then commit `contracts/deployment-record.jackpot.json`, the regenerated `apps/portal/src/generated/litvm-jackpot.mjs` (check with `node scripts/generate-litvm-jackpot.mjs --check`) and the inventory from `npm run assets:hmh:curated-level-kit-runtime`, with the test updates listed in the checklist's `e4.failuresOutsideLedger`. `JACKPOT_LIVE` stays false. Once OJ2 is met: `node scripts/jackpot-actions.mjs schedule-rules --from-week <flip week> --admin-clear-only false --broadcast --confirm SCHEDULE_JACKPOT_RULES_4441 --key-file <vault>/<keys file> --key-field keys.operator`. |
| E5 ⚠ | On `/owner/jackpot.html` (served with `python -m http.server 8791 --directory apps/portal`, or production after E6), from the admin wallet: block the test wallet `0x8841ae6244dba71f620de450e71b0ef7e0cce824` (`test-wallet`), the verifier and the relayer (`staff`), the residual recipient if it is not staff (`staff`), named funders (`funder`; Louie's wallet is not configured yet, design §H.1), other staff or test wallets (`staff`). Then `node scripts/jackpot-live-dry-run.mjs --site https://lestersarcade.io` shows `block-list`, `residual-recipient` and `staff-ever` passing (after E6 for the API checks). |
| E6 ⚠ | `node scripts/jackpot-secrets.mjs --key-file <vault>/keys/jackpot-keeper.json` (names only), then `--apply --confirm SET_JACKPOT_SECRETS`. The next release (version and cache-marker bump, `npm run vercel:build`, deploy, promote) before `firstWeek` starts. |
| E7 | `node scripts/live-cron.mjs --site https://lestersarcade.io --path /api/cron/index-chain --secret-file <vault>/keys/cron-secret.txt` (the jackpot's `schemaVersion`), then `--path /api/cron/weekly-jackpot` (`ok`; note the replay time for the §C.4 budget); `/api/health` shows `crons.weeklyJackpot`, the keeper balance and `paused: { env: false, onChain: false }`; `node scripts/jackpot-live-dry-run.mjs --site https://lestersarcade.io` passes. |
| E8 ⚠ | `node scripts/jackpot-actions.mjs mint-test --to <owner or Louie> --amount 1000000 --broadcast --confirm MINT_TCHIKUN_4441 --key-file <vault>/<keys file> --key-field keys.operator`; the owner funds the soft-launch week from `/owner/jackpot.html` (or `jackpot-actions fund --week current --amount 10000 --broadcast --confirm FUND_JACKPOT_4441` from the funder's own key). |
| E9 | The soft-launch week (flag false, `adminClearOnly = true`): run `node scripts/jackpot-live-dry-run.mjs --site https://lestersarcade.io` at C + 2 h (selection), C + 12 h (window closed) and C + 24 h (payout); the admin clears the top eligible run under the rubric (never disqualify to steer the winner). Receipt `docs/qa/jackpot-soft-launch-<date>.json`. |
| E10 ⚠ | Follow `docs/qa/jackpot-flag-flip-checklist.json`: check every `checklist.preconditions` entry, make the two edits (`JACKPOT_LIVE = true`; remove the `LEGAL-REVIEW-PENDING` comment with the confirmed legal text in place), run `node scripts/build-portal-pages.mjs` and `npm run assets:hmh:curated-level-kit-runtime`, update exactly `flip.testsToUpdate`, commit, `npm run test:release` (exactly 51), release, then the `checklist.postReleaseSmokes` and `node scripts/jackpot-live-dry-run.mjs --site https://lestersarcade.io --expect-live true`. |
| E11 | Weekly: funders fund the next week before Monday (at most one or two weeks ahead); the live dry run before and after any Ranked setting change (below); review any `awaiting-admin` week within 24 h under the rubric (the 7-day default applies after that); contact a `claim-pending` winner well before the 180-day recycle; keep the keeper above 0.05 zkLTC. |

### The J17 weekly check

Every Ranked setting the jackpot depends on changes only at a Monday 00:00 UTC, together with a matching `schedule-rules`, with `node scripts/jackpot-live-dry-run.mjs --site https://lestersarcade.io` before and after:

- the entry fee, the settlement reserve, fees on or off: `j17-quote` needs `quoteEntry(chikun).totalWei >= minPaidWei` of the new week. **A reserve change also changes what the server accepts**: lower `RANKED_MIN_PAID_WEI` in the same step (R20), or new 0.1 entries are refused with `entry-underpaid`;
- the Chikun season: `j17-season` needs the server's season in `rulesFor(currentWeek)` (use `altSeasonId` for a week that spans a change);
- `ScoreSubmissionRegistry.setRankedEntry` or a new Chikun registration (game id): `j17-ranked-entry` / `j17-game-id` fail, and every new run becomes ineligible; these need a new instance (design §A.19, emergency stop 7);
- a new Chikun runtime version: on a Monday, so one week is never judged across two runtimes.

### Emergency stops

1. **Stop payouts:** `pause` from `/owner/jackpot.html` (admin), or `node scripts/jackpot-actions.mjs operator-pause --broadcast --confirm PAUSE_JACKPOT_4441 --key-file <vault>/<keys file> --key-field keys.operator` (the admin cannot lift it). Funding, submissions and claims continue; the week waits in `selecting` or `awaiting-admin` (R11).
2. **Stop one week:** `holdWeek` from the owner page; `releaseWeek` to continue.
3. **Stop the keeper:** `JACKPOT_PAUSED=true` in production env and redeploy the current release (the status page shows it).
4. **Keeper key leaked:** `node scripts/jackpot-actions.mjs set-keeper <new> --broadcast --confirm SET_JACKPOT_KEEPER_4441 --key-file <vault>/<keys file> --key-field keys.operator`, block the old keeper from the owner page (`staff`), rotate the env with `jackpot-secrets.mjs`, update the record and module, check the weeks it touched.
5. **Admin wallet compromised:** `operator-pause`, then `node scripts/jackpot-actions.mjs force-admin <new> --broadcast --confirm FORCE_JACKPOT_ADMIN_4441 --key-file <vault>/<keys file> --key-field keys.operator` (one step; the review API drops the old admin within 60 s), the new admin reviews every decision the old one made (reinstate, clear), update the record and module, then `operator-unpause` (R18).
6. **Hide the UI:** `JACKPOT_UI_HIDDEN=true` and redeploy the current release (surfaces disappear within about 150 s); a release with `JACKPOT_LIVE=false` if the hide is long-term.
7. **New instance** (real $CHIKUN, a new Chikun game id, a repointed `rankedEntry`): `node scripts/jackpot-actions.mjs schedule-end <last week> --broadcast --confirm END_JACKPOT_4441 …`, then `node scripts/deploy-weekly-jackpot.mjs --token <address> --first-week <after the end> --retire-previous …` after the token acceptance checklist; the cron keeps servicing the retired instance; funders run `refund-after-end <week>` from their own keys (R19; the API keeps each week's own token, `tests/jackpot-api-contract.test.mjs`).

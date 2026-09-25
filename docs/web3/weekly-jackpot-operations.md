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
| `WeeklyJackpot` | `contracts/src/WeeklyJackpot.sol` | runtime 22,328 B (limit 24,576 B, so no lens contract), creation 24,841 B |
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

The accounting identity `liabilities == Σ open (funded + carriedIn) + Σ unclaimed + residual` is asserted after every step of a randomized run.

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

### Reference: revert strings and events beyond the design's tables

- The eligibility checks of `submitCandidate` run in the order of design §A.7, and `checkEligibility(sessionId)` returns the same string without writing. Every other string is listed in design §A.15, plus these four:
  - `BAD_RULES` (a rules epoch without a season or with `minFundWei` 0);
  - `END_FINAL` (`cancelEnd` or a new `scheduleEnd` after the last week has passed);
  - `NOTHING_TO_CLAIM` (`claim` or `recycleUnclaimed` with nothing unclaimed);
  - `EMPTY_GAME_ID` (constructor only).
- `finalize` of a week **after** a scheduled end reverts `AFTER_END`: such a week only holds refundable funding and never pays out. The keeper treats it as terminal.
- Amounts that reach the residue (a rollover, cap excess or recycle after a scheduled end) are reported with `toWeek = 0` in `RolledOver`, `CapExcessCarried` and `UnclaimedRecycled`.
- The constructor emits `OperatorTransferred(0, operator)`, `AdminTransferred(0, admin)`, `KeeperUpdated(keeper)` and `RulesScheduled` for the initial epoch, so an event mirror is complete from the deploy block.
- `weekBounds(w)` returns the calendar `start` and `close`; `settleCutoff`, `candidateUntil` and `payoutAt` include the admin extension.
- `reinstate` works before the payout time, or later while the week is held (the same rule as `adminSubmit`), so a hold keeps every admin correction open.

### Deploying (runbook E2 to E4)

1. **E2 ⚠ Keeper key** (the owner funds the printed address with 0.1 testnet zkLTC):

   ```bash
   node scripts/jackpot-keeper-key.mjs --out C:/Users/just_/lesters-arcade-vault/keys/jackpot-keeper.json
   ```

   It writes `{ "address", "privateKey" }` to a new file (mode 0600 where supported), prints only the address, never overwrites, and refuses any path inside the repository.

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
- `schedule-rules` starts from the epoch that would otherwise apply to that week and changes only the flags given.
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

_Written by the jackpot-server slice: configuration, the keeper and its key, the jackpot cron and indexer, `JACKPOT_PAUSED` / `JACKPOT_UI_HIDDEN`, and the admin review rubric (design §C, §E)._

## Rehearsal and go-live

_Written by the jackpot-rehearsal slice: the rehearsal commands and receipts, the runbook with exact commands, the J17 weekly check and the flag flip (design §E, §G)._

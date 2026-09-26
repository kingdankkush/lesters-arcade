# Chikun's Escape Weekly Jackpot: design (binding spec)

- **Status:** revision 2, 2026-09-24. Revision 2 applies the exploit, anti-cheat and feasibility reviews; every finding and its disposition is in **Appendix K**. This is the binding spec for the jackpot slices in `docs/handoffs/jackpot-slices-20260924/`. Where it and a slice brief disagree, this document wins. Where it and the pre-deployment interface contract (`docs/handoffs/pre-deployment-interface-contract-20260922.md`, "the contract") disagree about anything the jackpot does not change, the contract wins. **Amended 2026-09-26:** the Ranked entry fee is 0.01 zkLTC (0.012 zkLTC per run with the reserve; owner decision 2026-09-26). The deployed 2961 epoch keeps `minPaidWei` 0.1 zkLTC, so no 0.012 run qualifies there; the jackpot is on hold until mainnet, whose instance is deployed with `minPaidWei` equal to the fee then in force (J17). The §F.1 legal draft's Entry line reads 0.012 accordingly; see `docs/handoffs/ranked-fee-20260926.md`.
- **Base:** `fable/master-list-20260916` at or after `98e32740` (release 1.8.1 verified live at `2ad899ec`; cache marker `lesters-arcade-v54-post-launch`). The ops-health, perf-lazy-hosted and live-ui-audit slices are merged, so migration 2 (`0002_cron_runs`), `server/ops/cron-runs.mjs`, `/api/health` and `apps/portal/owner/status.*` exist.
- **In-flight slices this plan must sequence after (§G):**
  - **polish-2** (`fable/pd-polish-2`, 3 commits: ethers off first paint, mode copy, profile labels). It edits `portal-content.mjs`, `hosted-leaderboard-view.mjs`, `hosted-profile-view.mjs`, `game-manifest.mjs`, generated pages and the byte baselines.
  - **version-column** (brief at `98e32740`). It edits `server/neon/queries.mjs`, both hosted views and may add a migration.
  - **Migration number.** This document says "migration 3" (`0003_weekly_jackpot`). If version-column merges first and takes 3, the jackpot takes the next free number and every pin in §C.2 moves with it. The server slice checks `server/neon/migrations.mjs` at its base.
- **Live facts** (read-only RPC at block 54396110 and `contracts/deployment-record.hardened.json`):
  - Chain 4441.
  - `ScoreSubmissionRegistry` `0xc5c5949a02fAC9a4115df182672C0f8cEB0Eaf55`, `ArcadeRankedEntry` `0x10cd09e694e2B2Cd70d37f8CDdDcdA3Ef1208190`, `GameRegistry` `0xCB0B695eBEE650aFcCe93F566259cb477B19bf23`.
  - Operator `0x6Ac08Bed727A6951D755F0674f096E6A8AC06bfF`. Relayer `0x494aF36ea4958c417260faf3efB3B672B343EAf6`.
  - Chikun `gameId32` `0xe293f354d567ca05ed272162a4f9056216cf9f40e9fe59bbf8b6227c0ce4f385`. Season `chikun-season-preview-1` → `0xdec4900d7408bc67cb59219f09a8afed684ab088cf7633784e5f97d6cda50e51`.
  - Entry was 0.1 zkLTC + 0.002 reserve = 0.102 at revision 2; since the owner's 2026-09-26 decision it is 0.01 + 0.002 = 0.012 zkLTC (applied on chain with `setEntryFee` after the matching server release). Split 85% developer / 15% arcade; the split does not change.
  - Role wallets that must never win (§A.3, J10): verifier signer `0x4d637a6C…20C7`, relayer `0x494aF36e…EAf6`, operator `0x6Ac08Bed…6bfF`, and `0x07cec6Fc…8B26`, which is the admin, the Chikun `devWallet` and every vault.
  - `GameRegistry` has **no setter for a game's `devWallet`** (`GameRegistry.sol:52-126`). Routing Chikun's 85% to Louie on chain therefore means registering a new game id, which needs a new jackpot instance (§A.19).
- **Owner decisions (2026-09-24), fixed here:**
  - The week is the ISO week closing Monday 00:00 UTC, the same as the weekly board.
  - Payout is 24 h after the close.
  - The prize is a $CHIKUN ERC-20 on LitVM. $CHIKUN is not launched yet, so testnet uses a stand-in, `tCHIKUN`.
  - The 1.8.x Ranked contracts are not redeployed.
  - Justin's wallet `0x07cec6Fc49CAf6528F2f2F796042629cd3f48B26` is the admin.
  - Justin and Louie load prizes each week.

---

## 0. Summary of decisions

| Id | Decision |
| --- | --- |
| J1 | A new, standalone `WeeklyJackpot` contract, one instance per (game, prize token). It **reads the truth** from the deployed `ScoreSubmissionRegistry.getSession` and `ArcadeRankedEntry.getPaidSession`, and nothing in 1.8.x changes. |
| J2 | Proposals and challenges are **one permissionless function**, `submitCandidate(sessionId)`. The keeper is simply its default caller. The contract keeps the **top 5 per week, one row per wallet**, ordered exactly like the board: `score DESC, submittedAt ASC, sessionId ASC`.<br>**Eviction is recoverable (rev. 2):** a session that was listed and then displaced, and is not disqualified, may be re-listed by anyone until `payoutAt − 2 h`. The admin may also `adminSubmit` any eligible session into a list that disqualifications have left short. A flood of decoys therefore cannot push honest runs out for good (A.7). |
| J3 | Timeline for week W, measured from its close C (Monday 00:00 UTC):<br>- **C + 2 h:** the keeper selects.<br>- **C + 6 h:** settlement cutoff. A record must be on chain by then.<br>- **C + 12 h:** the candidate window closes (no new proposals or challenges; displaced rows may still be re-listed).<br>- **C + 24 h:** payout, by anyone calling `finalize`.<br>The admin may extend one week's clock by up to 72 h in total, for incidents. |
| J4 | **Only a cleared leader is paid.** The keeper clears runs that pass re-verification and the plausibility screen, and flags the rest. A flagged leader waits for the admin, who clears or disqualifies it. `finalize` always takes the highest candidate that is not disqualified and reverts if that candidate is not cleared, so nobody can skip a higher run. **The keeper can never change a session the admin has reviewed** (A.8). |
| J5 | Each week's rules (season, minimum paid amount, survival cap, score cap, prize cap, minimum fund, admin-clear-only) are fixed **before the week starts**. Rule epochs can be scheduled for future weeks only, at most 8 pending and at most 8 weeks ahead. |
| J6 | A week without an eligible winner **rolls over into the current week** at finalize. The part of a pot above the prize cap does the same. A week with a zero pot records no winner. |
| J7 | The **token is immutable per instance.** The real $CHIKUN gets a fresh instance: mainnet is a fresh deployment set anyway (`docs/web3/contract-overhaul-20260916.md:7`). The test token is `tCHIKUN`. Neon rows, the indexer stream and every displayed prize are keyed by **contract**, so two instances never mix (§C.2). |
| J8 | **Nobody can withdraw a prize except its winner.** Recovery paths:<br>- An unclaimed prize recycles into the prize pool after 180 days (permissionless; disclosed on the rules page; a Claim button exists).<br>- After a scheduled end, **funders withdraw their own contributions to weeks after the end** (`refundAfterEnd`).<br>- A final pot nobody won goes to the residual recipient 30 days after the end.<br>- Stray tokens above the owed total can be swept to the same recipient.<br>The residual recipient is fixed at deploy and can be changed only by itself (two-step). OJ1 recommends a Justin + Louie multisig that is neither the admin nor the operator. |
| J9 | A **separate keeper key**, `JACKPOT_KEEPER_PRIVATE_KEY`, with its own `relayer_lease` row. The settle relayer's key, nonce stream and funds are untouched. The **operator key never goes into Vercel.** |
| J10 | **Staff exclusion is sticky:** any address that has ever held the admin, operator or keeper role can never win (`staffEver`). Every other role wallet (verifier signer, relayer, the dev/vault wallet, the residual recipient), every prize funder (Louie) and the test wallet `0x8841…ce824` are blocked on chain at setup (E5). |
| J11 | The plausibility screen only **holds a run for review; it never disqualifies**. It catches **unsophisticated automation only**; a careful in-view bot passes it (B.5). Its thresholds are provisional until a human calibration set with named populations exists, which is a launch gate. |
| J12 | Reason codes on chain and in public are coarse. Feature values and thresholds are served only to the current on-chain admin, through a SIWE-authenticated owner API. |
| J13 | The UI reads only `/api/jackpot`. It never shows an amount that is not funded on chain according to the indexed events. It shows the amount **the winner can actually receive**, `min(pot, cap)`, and only when the pot reaches the week's `minFundWei`. |
| J14 | Client flag `JACKPOT_LIVE` (in the import-free `apps/portal/src/jackpot-config.mjs`, committed `false`), server env `JACKPOT_PAUSED` (keeper stop) and `JACKPOT_UI_HIDDEN` (the API answers `live:false`: an emergency hide without a client release). The flag flips only in an owner-approved runbook step, and only while the current week is funded. |
| J15 | `pause` stops **payouts and keeper clears only**. Funding, submissions and claims continue, so a pause cannot be used to censor a challenger. The **operator's pause cannot be lifted by the admin**, and the operator can replace the admin in one step (`forceAdmin`), so a compromised admin can be stopped. |
| J16 | **Manual mode for real-value prizes:** the `adminClearOnly` rule makes every payout need the owner's click. It is **mandatory** (together with a prize cap, a written review rubric and winner verification) for any real $CHIKUN instance, and it is on for the testnet soft-launch week. |
| J17 | **Ranked settings change only on Monday boundaries.** The jackpot's rules are per week and immutable, while the operator can change the entry fee, the reserve, the season, the runtime, `rankedEntry` or the game registration at any time. Every such change is scheduled for a Monday 00:00 UTC together with `scheduleRules`, and the live checker verifies the coupling (§E, J17 checks). The launch `minPaidWei` is the flat-fee floor, 0.1 zkLTC, so reserve changes cannot silently disqualify runs. |
| J18 | **Anti-cheat additions (rev. 2):**<br>- the Chikun child never draws obstacles beyond the stock landscape view, so a CSS edit no longer reveals the course;<br>- late evidence (a run that finishes long after it was paid for) is held;<br>- non-stock `maxTicks` is an integrity failure;<br>- seed tickets are logged and re-checked;<br>- sybil play is in scope, with a relist path and cross-wallet signals. |

### 0.1 The owner's award-flow proposal, evaluated

The proposal was:
- after the close, the relayer **proposes** the week's best session with a verifier EIP-712 signature;
- during a 24 h window anyone may **challenge** with a strictly better verified session of the same week, proven on chain;
- the admin may **disqualify** a session or wallet;
- after the window anyone may **finalize**.

**Kept:** the close → propose → challenge → review → finalize shape, on-chain proof for challenges, admin disqualification, permissionless finalize, and the 24 h payout.

**Changed:**

1. **No extra proposal signature (J1).** Every candidate is checked against the two registries directly. That is stronger than trusting a signature, because the verifier already signed each run when it was settled (`ScoreSubmissionRegistry.sol:232`). A second signature would add a key and a failure mode without giving the contract a fact it can check. The server's judgement (the bot screen) is expressed as the keeper's `clear`/`flag` instead (J4).
2. **One function for proposals and challenges (J2).** A challenge is simply a better eligible session entering the top 5. The keeper cannot censor it: `submitCandidate` is open to anyone, and `finalize` pays the best candidate that is not disqualified.
3. **Challenges close 12 h before payout (J3).** Otherwise a challenge in the last minute of a 24 h window would be paid unreviewed. The payout time stays fixed at C + 24 h.
4. **Payout needs clearance (J4).** Automatic payout covers only runs that passed every automated check. Anything unusual waits for a human.
5. **Top 5, not a single proposal.** A disqualification promotes the next listed candidate with no new round. If disqualifications leave the list short (for example after a sybil flood of five decoys), displaced honest rows are re-listed by the keeper or anyone, and the admin can `adminSubmit` any other eligible session (A.7, A.8). Revision 1 claimed that "a disqualification promotes the next candidate" in every case; that was true only inside the top 5.
6. **Explicit settlement cutoff (C + 6 h).** The server accepts settles up to 7 days after `openedAt` (`server/settle/settle-core.mjs:52`, `RUN_STALE_SECONDS`), so without a cutoff the winner could change after payout.

### 0.2 Example timeline (week `2026-W40`, contract week index 2961)

| Moment | UTC |
| --- | --- |
| Week opens (`start`) | Mon 2026-09-28 00:00 |
| Week closes (`close`) | Mon 2026-10-05 00:00 |
| Keeper first selection pass | Mon 2026-10-05 02:00 |
| Settlement cutoff (`record.submittedAt ≤`) | Mon 2026-10-05 06:00 |
| Candidate window closes | Mon 2026-10-05 12:00 |
| Payout due (`finalize` allowed) | Tue 2026-10-06 00:00 |

---

## A. The `WeeklyJackpot` contract

### A.1 Files, toolchain and instances

- **Sources.** Everything uses `pragma solidity ^0.8.24;` and `// SPDX-License-Identifier: MIT`, and is appended to `contractFiles` in `scripts/compile-contracts.mjs`:
  - `contracts/src/WeeklyJackpot.sol`
  - `contracts/src/TestChikunToken.sol`
  - `contracts/src/interfaces/IRankedReaders.sol`, which holds the read interfaces `IRankedScoreReader` and `IRankedEntryReader`
- **Filename rules.** Do **not** create `contracts/src/interfaces/IERC20.sol` or anything named `TournamentPool.sol`; `scripts/contract-structure-check.mjs:41-47` fails on both. Import OZ `IERC20`, `SafeERC20`, `ERC20` and `ReentrancyGuard` from `@openzeppelin/contracts` 5.6.1. `trySafeTransfer` exists there (`SafeERC20.sol:52`).
- **Compile.** solc-js 0.8.35, optimizer 200 runs, default EVM version (osaka). The existing 9 artifacts must stay byte-identical; the probe in the contracts-chain map showed they do.
  - Add a test that disassembles the new artifacts' creation and runtime code and fails on any opcode outside the Cancun set (for example `0x1e` CLZ). It is UNVERIFIED that LitVM supports every osaka opcode.
  - The deploy runbook adds a read-only `eth_call` of the creation code against LiteForge, which proves the constructor executes there (§E step E3).
- **Size.** Revision 2 adds functions. If the `WeeklyJackpot` runtime exceeds 24,576 B, move the string-returning views (`checkEligibility`, `leaderOf`, `weekBounds`) into a stateless `contracts/src/WeeklyJackpotLens.sol` that reads the jackpot's public getters. Do not raise the optimizer runs or change the EVM version for the existing 9 artifacts.
- **Instances.** One instance per (game, token). This phase deploys one: Chikun + tCHIKUN on LiteForge.
  - A $CHIKUN instance is a new deployment.
  - A STACKED instance would be possible later.
  - HMH is plausibility-checked, not replayed (contract §12), so it must not get a real-value jackpot.

### A.2 Constants and week math

| Name | Value | Meaning |
| --- | --- | --- |
| `WEEK` | `7 days` | |
| `WEEK_SHIFT` | `3 days` | `weekOf(ts) = (ts + 3 days) / 1 weeks`. Week boundaries are Monday 00:00 UTC, because 1970-01-05 was a Monday, 4 days after the Thursday epoch. |
| `SETTLE_GRACE` | `6 hours` | `record.submittedAt ≤ close + 6 h + extension` |
| `CANDIDATE_WINDOW` | `12 hours` | `submitCandidate` is accepted while `block.timestamp < close + 12 h + extension` |
| `PAYOUT_DELAY` | `24 hours` | `finalize` is allowed from `close + 24 h + extension` |
| `MAX_EXTENSION` | `72 hours` | the cumulative admin extension per week |
| `MAX_CANDIDATES` | `5` | |
| `RELIST_MARGIN` | `2 hours` | a displaced candidate may be re-listed until `payoutAt − 2 h` (A.7) |
| `MAX_FUND_AHEAD_WEEKS` | `8` | rev. 1 had 52; shorter pre-funding limits dust griefing and funder exposure to future-rule changes |
| `MAX_PENDING_EPOCHS` | `8` | pending future rule epochs (A.5) |
| `UNCLAIMED_AFTER` | `180 days` | after this, an unclaimed prize recycles into the pool |
| `RESIDUAL_DELAY` | `30 days` | end-of-life residue delay |

- `weekStart(w) = w * 1 weeks − 3 days`, and `close(w) = weekStart(w) + 1 weeks`.
- Verified examples:
  - 2026-09-21 00:00 → index 2960 = `2026-W39`.
  - 2026-09-27 23:59:59 → 2960.
  - 2026-09-28 00:00 → 2961 = `2026-W40`.
  - 2027-01-01 → 2974 = `2026-W53`, which starts 2026-12-28. 2027-01-04 → 2975 = `2027-W01`.
- Off chain, the key is always `periodKeyFor('weekly', weekStart*1000)` (`apps/portal/src/leaderboard-engine.mjs`). The ISO year can differ from the calendar year.
- `firstWeek` is a constructor immutable. **The constructor requires `firstWeek > currentWeek()`** (`"BAD_WEEK"`), and the deploy script accepts only `next` or a future `YYYY-Www`. Sessions opened before `firstWeek` are ineligible, so no run opened before the contract, its rules and its block list existed can win.
- **The week of a session is `weekOf(paid.openedAt)`**, the block time of `openSession`. This matches the board (`server/settle/settle-core.mjs:549`, `periodKeysFor(openedAtMs)`).
- UNVERIFIED: LitVM's `block.timestamp` drift near the Monday boundary (an Orbit sequencer). Confirm against the LitVM docs. The board uses the same `openedAt`, so any drift affects board and jackpot equally.

### A.3 Roles and powers

Every role uses the house pattern (`GameRegistry.sol:134-146`):
- `onlyOperator` reverts with `"Only platform operator"`;
- `transferOperator(address)` sets `pendingOperator`, and `acceptOperator()` requires `"Only pending operator"`;
- the public getters are `operator()`, `pendingOperator()`, `admin()`, `pendingAdmin()` and `keeper()`;
- `operator()` is exposed so `operator-actions`-style tooling can check the signer.

| Power | Anyone | Keeper | Admin (Justin, browser wallet) | Operator (`0x6Ac0…6bfF`, CLI) |
| --- | --- | --- | --- | --- |
| `fund(week, amount)` (≥ the week's `minFundWei`) | yes | yes | yes | yes |
| `submitCandidate(sessionId)` (new rows until the window closes; re-listing a displaced row until `payoutAt − 2 h`) | yes | yes | yes | yes |
| `finalize(week)` (after payout time) | yes | yes | yes | yes |
| `claim(week, to)` | winner only | | | |
| `recycleUnclaimed(week)` (after 180 days) | yes | | | |
| `refundAfterEnd(week)` (a funder's own contribution to a week after a scheduled end) | funder only | | | |
| `clear(sessionId)` | | only from None or a keeper-set Cleared; never a session the admin reviewed; not while paused; not under `adminClearOnly` | yes (any state except Disqualified) | |
| `flag(sessionId, reason)` | | only from None or a keeper-set Cleared; never a session the admin reviewed | yes (any state except Disqualified) | |
| `disqualify(sessionId, wholeWalletForWeek, reason)` / `reinstate(sessionId)` | | | yes | |
| `adminSubmit(sessionId)` (only into a list with fewer than 5 rows, before `payoutAt`) | | | yes | |
| `setBlocked(wallet, blocked, reason)` (global) | | | yes | |
| `holdWeek(week, reason)` / `releaseWeek(week)` | | | yes | |
| `extendWeek(week, extraSeconds)` (≤ 72 h cumulative, before payout) | | | yes | |
| `pause()` / `unpause()` (the admin pause flag) | | | yes | |
| `operatorPause()` / `operatorUnpause()` (a separate flag the admin cannot clear) | | | | yes |
| `transferAdmin(newAdmin)` → `acceptAdmin()` (refused with `"OPERATOR_LOCK"` while the operator pause is on) | | | yes | |
| `forceAdmin(newAdmin)` (one step, uncontestable; clears any `pendingAdmin`) | | | | yes |
| `setKeeper(address)` (0 disables keeper powers; the new address becomes `staffEver`) | | | | yes |
| `scheduleRules(Rules)` (future weeks only) | | | | yes |
| `scheduleEnd(lastWeek)` / `cancelEnd()` | | | | yes |
| `recoverResidual()` (to the residual recipient, after the delay) | | | | yes |
| `sweepStray(token)` (only the excess over liabilities, with a post-condition) | | | | yes |
| `nominateResidualRecipient(addr)` → `acceptResidualRecipient()` | residual recipient only, then the nominee | | | |

- `paused()` is a view that returns `adminPaused || operatorPaused`. Every rule that says "paused" means this view.
- **Sticky staff set.** The constructor, `acceptAdmin`, `forceAdmin`, `acceptOperator` and `setKeeper` set `staffEver[address] = true` for every address that takes a role. It is never cleared. Eligibility (A.7 step 6) and `finalize` (A.9) use `staffEver`, not the current roles, so a rotation never makes a former staff wallet eligible, and `setKeeper(leader)` cannot silently censor a winner: the leader was not staff when listed, so `finalize` skips it with a public `CandidateSkipped(w, id, "staff")` event.

What a compromised key can do (rev. 2 adds the correlated server case):

| Key compromised | Worst case | Backstop |
| --- | --- | --- |
| Keeper | Clears a cheating leader, which is then auto-paid unless the admin disqualifies it inside the review window. Or flags everything (denial). It **cannot** touch a session the admin reviewed. | The admin reviews the leader; `setKeeper(new)`; `adminClearOnly` for valuable weeks; the prize cap |
| Admin (browser wallet) | Clears its own cheat run and disqualifies the others. **At most one week's capped prize per week** until noticed. Or denial (hold, extend, disqualify everything). | The operator's `operatorPause` (the admin cannot lift it) plus `forceAdmin(new)` in one uncontestable step; the prize cap |
| Operator (vault key) | Can `forceAdmin` itself, then act as admin above. Cannot touch liabilities directly. It is the root of trust. | Kept offline and never in Vercel; the prize cap; public events |
| Verifier key alone | Forges `verified` records; each still needs a paid 0.102 entry from the credited wallet | No stored evidence → `integrity` flag; the admin disqualifies; `rotate-verifier` |
| **Vercel production env or project** (holds `SESSION_SECRET`, `NEON_DATABASE_URL`, the verifier key, the relayer key and the keeper key together) | Every automated layer falls: forge a record (verifier), insert matching evidence and a ticket-log row (Neon), clear it (keeper), and keep the honest cron from flagging it. With `adminClearOnly = false` only a human noticing inside the 12 h review window stops the payout. | The prize cap; `adminClearOnly` (mandatory for real value); the admin review rubric; the operator and admin keys are not in Vercel, so the operator can still pause and rotate |

### A.4 State

```solidity
struct Rules {                  // one epoch; applies to weeks >= fromWeek until the next epoch
    uint64  fromWeek;
    uint64  maxSurvivalSeconds; // 0 = none; default 3599 (a run that reached the 60-minute limit is ineligible)
    bool    adminClearOnly;     // true: only the admin may clear, so every payout is manual
    uint128 minPaidWei;         // launch 100000000000000000 = the flat fee alone (J17; rev. 1 used fee + reserve)
    uint128 maxPrizeWei;        // 0 = no cap; excess rolls into the current week
    uint128 minFundWei;         // > 0; the minimum per fund call and the pot size that counts as "funded" off chain
    uint256 maxScore;           // 0 = none
    bytes32 seasonId;           // required, e.g. keccak256("chikun-season-preview-1")
    bytes32 altSeasonId;        // 0 = none; for a week that spans a season change
}
struct Candidate { bytes32 sessionId; address player; uint64 submittedAt; uint64 score; } // score <= MAX_SCORE 1e10
enum WeekStatus { Open, Paid, RolledOver }
struct Week {
    uint256 funded;      // Funded into this week
    uint256 carriedIn;   // rollovers and cap excess that arrived while this was the current week
    uint256 prize;       // set at finalize
    uint256 unclaimed;   // a prize whose transfer failed (pull claim)
    address winner;
    bytes32 winningSession;
    uint64  finalizedAt;
    uint32  extension;   // admin extension, seconds, cumulative <= 72 h
    uint8   count;       // candidates in _candidates[week]
    WeekStatus status;
    bool    held;
}
enum Review { None, Cleared, Flagged, Disqualified }

bytes32 public immutable gameId;
IERC20  public immutable token;
IRankedScoreReader public immutable scoreRegistry;
IRankedEntryReader public immutable rankedEntry;
uint64  public immutable firstWeek;
address public residualRecipient;              // the published contest wallet; only it can nominate a successor
address public pendingResidualRecipient;

address public operator; address public pendingOperator;
address public admin;    address public pendingAdmin;
address public keeper;
bool    public adminPaused;
bool    public operatorPaused;                  // only the operator clears it; paused() = adminPaused || operatorPaused
Rules[] private _rules;                         // ascending fromWeek
mapping(uint64 => Week) private _weeks;
mapping(uint64 => Candidate[5]) private _candidates;
mapping(bytes32 => Review) public reviewOf;     // a session belongs to exactly one week (its openedAt)
mapping(bytes32 => bytes32) public reviewReason;
mapping(bytes32 => bool) public adminReviewed;  // the admin cleared, flagged, disqualified or reinstated it; the keeper may no longer act on it
mapping(bytes32 => bool) public wasListed;      // it was inserted into its week's list at least once (relist, reinstate)
mapping(uint64 => mapping(address => bool)) public walletDisqualified;
mapping(address => bool) public blocked;
mapping(address => bool) public staffEver;      // sticky: every address that ever held admin, operator or keeper
mapping(uint64 => mapping(address => uint256)) public fundedBy; // per funder, for refundAfterEnd
uint256 public liabilities;                     // everything owed: open pots + carried + unclaimed + residual
uint256 public residual;  uint64 public residualAvailableAt;
uint64  public endAfterWeek;                    // 0 = no end scheduled
```

Revision 1's `lastFundedWeek` is removed: it let a 1-wei fund far in the future block `scheduleEnd` forever (Appendix K, X4).

**Interfaces** (`IRankedReaders.sol`):
- The structs repeat the deployed field order **exactly**, because the call is ABI-decoded:
  - `ScoreRecord`: `sessionId, player, gameId, score, kills, maxCombo, survivalSeconds, bossId, runtimeId, seasonId, submittedAt, verified, exists` (`ScoreSubmissionRegistry.sol:48-62`)
  - `PaidSession`: `player, gameId, amountWei, openedAt, exists` (`ArcadeRankedEntry.sol:20-26`)
- The functions are `getSession(bytes32)` (`:302`) and `getPaidSession(bytes32)` (`:215`).
- Leave `IArcadeRankedEntry.sol` untouched; `contracts:check` pins it.

### A.5 Rules epochs (J5)

- **Constructor.** `_rules.push(initial)` with `fromWeek = firstWeek`, and it **emits `RulesScheduled` for the initial epoch**, so the Neon rules mirror (§C.2 `jackpot_rules`) is complete from the first block.
- **`scheduleRules(Rules r)`** (operator):
  - requires `r.fromWeek > currentWeek()`, `r.fromWeek <= currentWeek() + MAX_FUND_AHEAD_WEEKS` (`"RULES_TOO_FAR"`), `r.seasonId != 0` and `r.minFundWei > 0`;
  - pops every epoch with `fromWeek >= r.fromWeek`, all of which are in the future;
  - requires that at most `MAX_PENDING_EPOCHS` epochs remain with `fromWeek > currentWeek()` after the push (`"TOO_MANY_EPOCHS"`), so `rulesFor` stays cheap;
  - pushes `r` and emits `RulesScheduled(fromWeek, seasonId, altSeasonId, minPaidWei, maxSurvivalSeconds, maxScore, maxPrizeWei, minFundWei, adminClearOnly)`.
- **`rulesFor(week)`** returns the last epoch with `fromWeek <= week`, by **binary search** over the ascending `fromWeek` values, so its gas is logarithmic however many past epochs accumulate.
- **Consequence:** the rules of any week that has started can never change. The rules of a **pre-funded future week can** still change until it starts; this is disclosed on the rules page and is why funders are advised to fund at most one or two weeks ahead (§E E11).
- **Coupling with Ranked settings (J17).** `minPaidWei`, `seasonId`/`altSeasonId`, the immutable `rankedEntry` and `gameId` all depend on settings the operator can change on the 1.8.x contracts at any time:
  - `ArcadeRankedEntry.setSettlementGasReserve` and `setEntryFeeEnabled`, and `GameRegistry.setEntryFee` (paid amounts);
  - the server's Chikun season (the testnet no-reset decision of 2026-09-25 makes this rare);
  - `ScoreSubmissionRegistry.setRankedEntry` (a repoint makes every new session `NOT_PAID` here);
  - a new Chikun registration (a new game id, for example to pay Louie on chain, makes every run `WRONG_GAME` here).
  Each change is therefore scheduled for a Monday 00:00 UTC and paired with a `scheduleRules` for that week, and the last two need a new jackpot instance (§A.19). A new Chikun runtime version (version-column) should also land on a Monday, so one week is never judged across two runtimes. The live checker (§G jackpot-rehearsal) fails when `quoteEntry(chikun).totalWei < rulesFor(currentWeek).minPaidWei`, when `scoreRegistry.rankedEntry() != jackpot.rankedEntry()`, or when the server's current Chikun season is not in `rulesFor(currentWeek)`. The entry-modal jackpot row hides when the current quote is below `minPaidWei`.
- **Recommended launch rules:**

  | Field | Value |
  | --- | --- |
  | `seasonId` | Chikun preview-1 |
  | `minPaidWei` | `100000000000000000` (the flat fee; it survives any reserve change, but not a lower fee or fees-off, which are meant to make runs ineligible) |
  | `maxSurvivalSeconds` | `3599` |
  | `maxScore` | 0 |
  | `maxPrizeWei` | 0 on testnet; the owner sets a cap for real value |
  | `minFundWei` | `100000000000000000000` (100 tCHIKUN); for a real token, the owner sets it (OJ5) |
  | `adminClearOnly` | **true** for the first epoch (the soft-launch week, E9); an epoch with false is scheduled from the flag-flip week on testnet; true for any real value |

### A.6 Funding, rollover and caps

- **`fund(uint64 week, uint256 amount)`** (`nonReentrant`, never paused):
  - requires `week >= max(firstWeek, currentWeek())` and `week <= currentWeek() + MAX_FUND_AHEAD_WEEKS` (8);
  - requires no end scheduled before `week` (`endAfterWeek == 0 || week <= endAfterWeek`, `"FUNDED_AFTER_END"`);
  - **balance-delta accounting:** `before = token.balanceOf(this); token.safeTransferFrom(msg.sender, this, amount); received = balanceOf(this) − before; require(received >= rulesFor(week).minFundWei, "BELOW_MIN_FUND")`. This handles fee-on-transfer tokens, and a 1-wei fund can no longer make a week look funded;
  - then `_weeks[week].funded += received`, `fundedBy[week][msg.sender] += received`, `liabilities += received`;
  - emits `Funded(week, msg.sender, received)`;
  - `fundCurrent(amount)` is sugar for `fund(currentWeek(), amount)`.
- **"Funded" off chain** means `funded + carriedIn >= rulesFor(w).minFundWei`. The keeper's selection gate, the UI honesty rule and the E10 flip precondition all use this, never `> 0` (Appendix K, X4).
- **Tokens sent directly with `transfer` are not attributed to any week.** They are stray (A.10), and the UI says so ("fund through the contract").
- **Rollover (J6).** When `finalize(W)` finds no eligible leader, the pot `funded + carriedIn` moves to `target = currentWeek()`:
  - `target` is at least W + 1, and it is always still open;
  - `_weeks[target].carriedIn += pot`, and `RolledOver(W, target, pot)` is emitted;
  - if `endAfterWeek != 0 && target > endAfterWeek`, the pot goes to `residual` instead (A.10).
  - An open week's pot only ever grows, so a displayed amount is never withdrawn.
- **Caps:**
  - **Prize cap** `maxPrizeWei`: `prize = min(pot, cap)`, and the excess rolls into the current week like a rollover (`CapExcessCarried`).
  - **Survival cap** and **score cap**: on-chain eligibility (A.7).
  - **Candidate cap:** 5.
  - **Fund-ahead cap:** 8 weeks; minimum fund `minFundWei`.
  - **Keeper fee cap:** off chain, §C.4.

### A.7 Candidates: proposal and challenge (J2)

**`submitCandidate(bytes32 sessionId)`** is permissionless, `nonReentrant`, and allowed while paused. It runs these checks in this order. The revert strings are the keeper's classification input (A.15).

1. `rec = scoreRegistry.getSession(id)`. Require `rec.exists` (`"NOT_FOUND"`), `rec.verified` (`"NOT_VERIFIED"`) and `rec.gameId == gameId` (`"WRONG_GAME"`).
2. `paid = rankedEntry.getPaidSession(id)`. Require `paid.exists && paid.player == rec.player && paid.gameId == gameId` (`"NOT_PAID"`).
   - This re-check is mandatory: settlement skips `isPaid` entirely when a game's `entryFeeWei` is 0 (`ScoreSubmissionRegistry.sol:221-224`), and zero-amount sessions `exist` while fees are disabled (`ArcadeRankedEntry.sol:146-147`).
3. `w = weekOf(paid.openedAt)`. Require `w >= firstWeek` (`"BEFORE_FIRST_WEEK"`) and `endAfterWeek == 0 || w <= endAfterWeek` (`"AFTER_END"`).
4. `r = rulesFor(w)`. Check, in order:
   - `paid.amountWei >= r.minPaidWei` (`"BELOW_MIN_PAID"`)
   - `rec.seasonId == r.seasonId || (r.altSeasonId != 0 && rec.seasonId == r.altSeasonId)` (`"WRONG_SEASON"`)
   - `r.maxSurvivalSeconds == 0 || rec.survivalSeconds <= r.maxSurvivalSeconds` (`"SURVIVAL_CAP"`)
   - `r.maxScore == 0 || rec.score <= r.maxScore` (`"SCORE_CAP"`)
   - `rec.score > 0` (`"ZERO_SCORE"`)
5. Timing:
   - `rec.submittedAt <= close(w) + SETTLE_GRACE + ext` (`"SETTLED_LATE"`)
   - The window: `block.timestamp < close(w) + CANDIDATE_WINDOW + ext`, **or** a re-list: `wasListed[id] && block.timestamp < payoutAt(w) − RELIST_MARGIN` (`"WINDOW_CLOSED"` otherwise). Submissions **during** week W are allowed, so a player may put their run on chain early. A re-list can only bring back a session that was publicly listed (and so visible and screenable) during the window.
   - `_weeks[w].status == Open` (`"WEEK_SETTLED"`)
6. The player:
   - not `staffEver` (`"STAFF_WALLET"`), which covers every current and former admin, operator and keeper
   - not `blocked` (`"WALLET_BLOCKED"`)
   - not `walletDisqualified[w]` (`"DISQUALIFIED"`)
   - `reviewOf[id] != Disqualified` (`"DISQUALIFIED"`)
7. Insert into `_candidates[w]` with ordering `score DESC, submittedAt ASC, sessionId ASC`, and set `wasListed[id] = true`. This is exactly the board order (`server/neon/queries.mjs:92-100`); `confirmed_at` is the block time, which equals `submittedAt`. `bytes32` compares numerically, which equals lowercase-hex text order.
   - The same session is already listed → `"ALREADY_CANDIDATE"`.
   - The same wallet is listed with a better or equal row → `"NOT_BETTER"`. With a worse row, replace it and re-sort; the replaced session's review state stays as it was (`CandidateRemoved(w, old, "replaced")`).
   - The list is full and the new row ranks below the last → `"NOT_IN_TOP"`. Otherwise the last row drops out (`CandidateRemoved(w, id, "displaced")`). **A displaced row keeps its review state and `wasListed`,** so it can be re-listed (step 5) when disqualifications free a slot.
8. Emit `CandidateSubmitted(w, sessionId, player, score, submittedAt, msg.sender, rank)`. If the rank-1 row changed, also emit `LeaderChanged(w, sessionId, player, score)`.

**`checkEligibility(bytes32 sessionId) view returns (bool ok, uint64 week, string reason)`** runs steps 1-7 without writing. The keeper and the owner page call it before sending anything.

**Why re-listing closes the sybil-eviction attack (Appendix K, X1/AC4).** An attacker settles five decoy runs from five wallets before C + 6 h and submits them at C + 11 h 59 min, displacing every honest candidate. The keeper screens the decoys (they are public rows, screened first by chain rank, §C.4) and flags them; the admin disqualifies them. Each disqualification frees a slot, and the keeper (or the honest player, or anyone) re-lists the displaced honest rows, which keep any clear they already had. Honest runs that were never listed because they ranked sixth or lower enter through `adminSubmit`. The attacker cannot re-list decoys after disqualification, and fresh decoys cannot enter after C + 12 h because they were never listed. The set of sessions that can still return is therefore finite and public (every `CandidateSubmitted` since the week opened), so the admin can disqualify all of an attacker's listed or displaced sessions in one pass (`wholeWalletForWeek`). If the admin needs more time, `extendWeek` moves the re-list deadline with `payoutAt`; `holdWeek` keeps `adminSubmit` open. Rehearsal R13 proves it.

### A.8 Review

- **Admin decisions are final for the keeper (rev. 2).** Every admin `clear`, `flag`, `disqualify` and `reinstate` sets `adminReviewed[id] = true`. The keeper's `clear` and `flag` revert `"REVIEW_LOCKED"` on any session with `adminReviewed`, so a stale screen result, a re-signed dropped transaction or a `jackpot-ops rescreen` can never undo an admin clear or a disqualification (Appendix K, X2).
- **`clear(sessionId)`:**
  - The keeper may clear only from `None` or a keeper-set `Cleared` (idempotent), never from `Flagged`, never with `adminReviewed`, not while `paused()`, and not when `rulesFor(week).adminClearOnly` (`"REVIEW_LOCKED"`, `"PAUSED"`).
  - The admin may clear any state except `Disqualified` (reinstate first).
  - Emits `Cleared(sessionId, msg.sender)`.
- **`flag(sessionId, bytes32 reason)`:**
  - reverts `"DISQUALIFIED"` on a `Disqualified` session for every caller;
  - the keeper may flag only from `None` or a keeper-set `Cleared`, never with `adminReviewed` (`"REVIEW_LOCKED"`);
  - the admin may flag from any other state;
  - sets `Flagged`, which the keeper can never undo. Emits `Flagged(week, sessionId, reason, msg.sender)`.
- **`disqualify(sessionId, bool wholeWalletForWeek, bytes32 reason)`** (admin):
  - allowed any time while the session's week is `Open`, including before it is ever submitted;
  - sets `Disqualified`, and with `wholeWalletForWeek` also `walletDisqualified[w][player]`;
  - removes the session from `_candidates[w]` if listed and shifts the rows up;
  - emits `Disqualified(w, sessionId, player, wholeWalletForWeek, reason)`.
- **`reinstate(sessionId)`** (admin, week `Open`, before payout time):
  - resets the session to `None` (still `adminReviewed`, so only the admin can clear it);
  - clears `walletDisqualified` for its week;
  - **re-inserts it only if `wasListed[id]`**, re-running checks 1-6 and step 7 without the window check. A session that was never listed is only reset; it re-enters like any other session, or through `adminSubmit`. This stops "disqualify, then reinstate" from inserting a new row after the window (Appendix K, X9);
  - emits `Reinstated`.
- **`adminSubmit(sessionId)`** (admin; rev. 2):
  - requires the week `Open`, the list holding fewer than `MAX_CANDIDATES` rows (`"LIST_FULL"`), and either `block.timestamp < payoutAt(w)` or the week held (`"TOO_LATE"`);
  - runs checks 1-6 and step 7, skipping only `WINDOW_CLOSED`; `SETTLED_LATE` still applies at the week's cutoff;
  - emits `CandidateSubmitted` with `submitter = admin`.
  - It refills a list that disqualifications emptied, from the next eligible sessions the owner page lists (§C.6). It cannot displace anyone, so it adds no power the admin's disqualification did not already have.
- **`setBlocked(wallet, blocked, reason)`** (admin, global): emits `WalletBlocked`. `finalize` skips blocked players even if they were listed before the block, with `CandidateSkipped(w, id, "blocked")`.
  - **J1 note (2026-09-25):** a block never removes a listed row, so a blocked row keeps its slot and a full list stays full. Against listed decoys the admin first disqualifies with `wholeWalletForWeek` (which removes the rows and frees the slots for re-listing), then blocks. The owner page and the review rubric follow that order.
- **`holdWeek(w, reason)` / `releaseWeek(w)`** (admin): while held, `finalize(w)` reverts `"WEEK_HELD"`.
- **`extendWeek(w, extra)`** (admin): allowed before `payoutAt(w)`; the cumulative extension is ≤ 72 h (`"EXTENSION_CAP"`). It shifts the settle cutoff, the candidate window and the payout time together, and is meant for relayer outages near a close. Emits `WeekExtended(w, totalExtension)`.
- **Pauses and admin rotation (rev. 2; Appendix K, X3):**
  - `pause()`/`unpause()` (admin) set `adminPaused`; `operatorPause()`/`operatorUnpause()` (operator) set `operatorPaused`. The admin cannot clear `operatorPaused`. Both emit `Paused(by, isOperator)` / `Unpaused(by, isOperator)`.
  - `transferAdmin(new)` (admin) reverts `"OPERATOR_LOCK"` while `operatorPaused`; `acceptAdmin()` (pending admin) likewise.
  - `forceAdmin(new)` (operator, `new != 0`): sets `admin = new` in one step, clears `pendingAdmin`, sets `staffEver[new]`, and emits `AdminTransferred(previous, new)`. A compromised admin cannot contest it.
  - The emergency sequence is therefore: the operator pauses, then forces a new admin, then the new admin reviews the weeks the old one touched, then the operator unpauses.
- **Reason codes** are `bytes32` short ASCII strings (`ethers.encodeBytes32String`). Public and coarse:

  | Action | Reason codes |
  | --- | --- |
  | Flag | `screen-hold`, `integrity`, `excluded-wallet`, `late-evidence` |
  | Disqualify | `automation`, `integrity`, `rules`, `excluded-wallet`, `multi-wallet`, `other` |
  | Block | `staff`, `test-wallet`, `funder`, `cheating`, `other` |
  | Hold | `investigation` |
  | Skip (finalize, `CandidateSkipped`) | `blocked`, `disqualified-wallet`, `staff` |

### A.9 Finalize, payout and claims

**`finalize(uint64 w)`** is permissionless and `nonReentrant`.

1. Require:
   - `w >= firstWeek`
   - `endAfterWeek == 0 || w <= endAfterWeek` (`"AFTER_END"`; J1 amendment: a week after a scheduled end only holds refundable funding and never finalizes, so it stays `Open` until its funders `refundAfterEnd`)
   - `_weeks[w].status == Open` (`"WEEK_SETTLED"`)
   - `block.timestamp >= payoutAt(w)` (`"PAYOUT_NOT_DUE"`)
   - `!paused()` (`"PAUSED"`)
   - `!held` (`"WEEK_HELD"`)
2. The leader is the first candidate in order whose player is not `blocked`, not `walletDisqualified[w]`, not `staffEver`, and whose review is not `Disqualified`. Each row skipped for its player emits `CandidateSkipped(w, id, reason)` with `blocked`, `disqualified-wallet` or `staff`, so no winner is ever passed over silently. If a leader exists, require `reviewOf == Cleared` (`"LEADER_NOT_CLEARED"`).
3. `pot = funded + carriedIn`.
   - **Zero pot:** no winner is recorded, whatever the candidates. `status = RolledOver` with amount 0, and `Finalized(w, address(0), 0, 0, 0)` is emitted. This makes "unfunded weeks have no champion" hold on chain too (Appendix K, X18).
   - **With a leader:** `prize = cap ? min(pot, cap) : pot`, and the excess goes to `carriedIn[currentWeek()]` (or to residual after an end). Set `status = Paid`, `winner`, `winningSession`, `prize` and `finalizedAt`, then transfer:
     - `token.trySafeTransfer(winner, prize)` succeeds: `liabilities −= prize`, emit `Finalized(w, winner, sessionId, score, prize)`.
     - It fails (a blacklist, a pause, a max-transaction or max-wallet limit, a trading gate in the token): `unclaimed = prize`, emit `Finalized(…)` and `PrizeTransferFailed(w, winner, prize)`. The API reports the week as `claim-pending`, the winner's profile shows a Claim button, and the status page warns (§C.5, §D.3).
   - **Without a leader:** `status = RolledOver`, the rollover of A.6 applies, emit `Finalized(w, address(0), 0, 0, 0)` and `RolledOver`.
4. **`claim(uint64 w, address to)`** (only the winner, `"ONLY_WINNER"`; `nonReentrant`; `to != 0`):
   - `amount = unclaimed`, `unclaimed = 0`, `liabilities −= amount`;
   - `token.safeTransfer(to, amount)`, which reverts on failure, so the claim can be retried;
   - emits `PrizeClaimed(w, winner, to, amount)`.
   - A winner blacklisted by the token can therefore claim to another address.
5. **`recycleUnclaimed(uint64 w)`** is permissionless once `block.timestamp >= finalizedAt + 180 days`. The unclaimed amount moves to `carriedIn[currentWeek()]`, or to residual after an end. Emits `UnclaimedRecycled(w, target, amount)`. **It never goes to a staff wallet.** The rules page discloses the 180-day limit, and the owner contacts a `claim-pending` winner through the status page alert well before it (§E E11).

### A.10 End of life, residue and stray tokens (J8, with justification)

- **`scheduleEnd(uint64 lastWeek)`** (operator):
  - requires `lastWeek > currentWeek()`, which gives at least one full week's notice. **There is no funding precondition** (rev. 1's `lastFundedWeek <= lastWeek` let anyone block every end with one dust fund far ahead);
  - emits `EndScheduled(lastWeek)`. `cancelEnd()` is allowed while `currentWeek() <= lastWeek`.
  - After an end, `fund` and `submitCandidate` reject weeks after `lastWeek`, and every later rollover, cap excess or recycle goes to `residual`, with `residualAvailableAt = now + 30 days` set at each deposit.
- **`refundAfterEnd(uint64 week)`** (rev. 2; any funder): once `endAfterWeek != 0`, `week > endAfterWeek` and `currentWeek() > endAfterWeek` (so the end can no longer be cancelled), it sends `fundedBy[week][msg.sender]` back to the funder, zeroes it, and reduces `_weeks[week].funded` and `liabilities` by the same amount. Emits `RefundedAfterEnd(week, funder, amount)`. Weeks after an end can only hold direct funding (carries always target a week ≤ `lastWeek`), so this returns every pre-funded amount to whoever paid it, never to the residual recipient (Appendix K, X4/X13).
- **`recoverResidual()`** (operator): after `residualAvailableAt`, sends `residual` to `residualRecipient` (the contest wallet named at deploy) and emits `ResidualRecovered`.
- **`nominateResidualRecipient(addr)`** (only the current `residualRecipient`) → **`acceptResidualRecipient()`** (only the nominee). This covers a recipient that the prize token blacklists. Neither the admin nor the operator can change the recipient. Emits `ResidualRecipientChanged(previous, current)`.
- **`sweepStray(address t)`** (operator):
  - for the prize token, sends `balanceOf(this) − liabilities` to `residualRecipient`;
  - for any other token, sends the whole balance;
  - **post-condition, for any `t`:** `token.balanceOf(this) >= liabilities` after the transfer (`"LIABILITIES_BREACHED"`). This catches a token with a second entry-point address (sweeping the second address would drain the prize token) and a token that charges the sender extra on outgoing transfers. `recoverResidual` has the same post-condition;
  - emits `StraySwept(t, amount)`.
  - It can never touch a liability.

**Why include recovery at all:**
- Without it, two cases leak tokens for good:
  - a winner who has lost their keys (the prize is unclaimable forever);
  - an instance that ends. Testnet ends at mainnet, and swapping to $CHIKUN means a fresh instance, whose final week may have no winner.
- The chosen design keeps the promise that **no funded, winnable prize can be redirected by the operator**:
  - unclaimed prizes return to *players* through the prize pool, not to the operator;
  - residue exists only after a publicly scheduled end, with at least one week's notice, and only for a final pot nobody won;
  - funding for weeks after an end goes back to its funders;
  - residue goes only to the recipient named at deployment (or its self-nominated successor), and only after a 30-day public delay.
- **What remains discretionary (disclosed on the rules page, §D.4):** the admin can hold or disqualify, so a pot can roll over without a time limit; the operator can change the rules of a pre-funded week before it starts, and can schedule an end. The residual recipient should be a Justin + Louie multisig distinct from the admin and operator keys (OJ1), and funders should fund at most one or two weeks ahead.

### A.11 Token pluggability (J7) and the token acceptance checklist

- `token` is a constructor immutable. There is no `setToken`. That is stronger than "settable while empty" and costs nothing, because the real $CHIKUN needs a fresh instance anyway:
  - **If $CHIKUN launches on LitVM mainnet** while Ranked is still on LiteForge, an automatic on-chain payout is impossible across chains. The jackpot must read registries on the same chain. The honest route is the mainnet fresh deployment set (Ranked + jackpot). A "testnet decides, mainnet pays" bridge would bring back operator trust; it is not recommended.
  - **If $CHIKUN appears on LiteForge,** deploy a second instance with `--token <address>` and run `scheduleEnd` on the tCHIKUN instance (§A.19 has the sequencing).
- **Before any real token is plugged in, the owner signs off on this checklist** (it is recorded in the deploy manifest):
  1. `decimals()` (display only; the contract is decimals-agnostic).
  2. **Fee-on-transfer or tax on the recipient side:** `fund` accounts the received amount, but the winner receives `prize` minus the tax.
  3. **Fees charged to the sender on outgoing transfers:** the balance falls below liabilities and the last claims revert. Reject such a token, or make the jackpot contract exempt.
  4. **Blacklist or pause:** handled by the pull claim. The residual recipient must not be blacklisted (it can nominate a successor, A.10).
  5. **Max-transaction, max-wallet, cooldown, "trading not enabled" gates and anti-sniper/anti-bot blacklists** (common in memecoins): each makes `transfer` revert, so a winner is left `claim-pending`. **The jackpot contract must be exempt from all of them, and prizes must be at most the max-transaction amount** (the prize cap enforces this). A winner above a max-wallet limit claims to another address.
  6. **Double entry points** (a second address that moves the same balance, TUSD style): `sweepStray`'s post-condition blocks the drain, but list the token as unsupported if it has one.
  7. **Rebasing:** unsupported. A negative rebase can make liabilities exceed the balance and make claims fail. Do not use such a token.
  8. **Upgradeable proxy or owner mint/blacklist powers:** a trust note on the rules page; the token owner could freeze the jackpot.
  9. **Callbacks (ERC-777 style):** covered by `nonReentrant`.
  10. **Gas-griefing transfer:** it can block `finalize`. Only vetted tokens.
  The rehearsal (R9) runs the blacklist mock; the contracts slice adds a max-transaction mock to its lifecycle test.

### A.12 Safety mechanics

- `ReentrancyGuard` (storage slot, the same as the live contracts) on `fund`, `submitCandidate`, `adminSubmit`, `finalize`, `claim`, `recycleUnclaimed`, `refundAfterEnd`, `recoverResidual` and `sweepStray`.
- Checks-effects-interactions everywhere: state is written before any token call.
- `SafeERC20` for every transfer: `safeTransferFrom` in `fund`, `trySafeTransfer` in `finalize`, `safeTransfer` elsewhere.
- **Balance-delta funding** (A.6).
- **Invariant:** `token.balanceOf(this) >= liabilities`, and `liabilities == Σ open (funded + carriedIn) + Σ unclaimed + residual` (open weeks include weeks after an end until refunded). The lifecycle tests assert it after every step of a randomized sequence, and `sweepStray`/`recoverResidual` enforce the first half as a post-condition.
- No `selfdestruct`, no `delegatecall`, no upgradeability, no `receive`/`fallback`: native zkLTC sent to the contract reverts.

### A.13 Events (all indexed by the jackpot indexer, §C.3)

```
Funded(uint64 indexed week, address indexed funder, uint256 amount)
RolledOver(uint64 indexed fromWeek, uint64 indexed toWeek, uint256 amount)
CapExcessCarried(uint64 indexed fromWeek, uint64 indexed toWeek, uint256 amount)
CandidateSubmitted(uint64 indexed week, bytes32 indexed sessionId, address indexed player, uint256 score, uint64 submittedAt, address submitter, uint8 rank)
CandidateRemoved(uint64 indexed week, bytes32 indexed sessionId, bytes32 reason)   // "displaced" | "replaced" | "disqualified" (J1: with wholeWalletForWeek, also the wallet's OTHER listed session, whose own review is unchanged)
CandidateSkipped(uint64 indexed week, bytes32 indexed sessionId, bytes32 reason)   // finalize: "blocked" | "disqualified-wallet" | "staff"
LeaderChanged(uint64 indexed week, bytes32 indexed sessionId, address indexed player, uint256 score)
Cleared(bytes32 indexed sessionId, address indexed by)
Flagged(uint64 indexed week, bytes32 indexed sessionId, bytes32 reason, address indexed by)
Disqualified(uint64 indexed week, bytes32 indexed sessionId, address indexed player, bool wholeWalletForWeek, bytes32 reason)
Reinstated(uint64 indexed week, bytes32 indexed sessionId)
WalletBlocked(address indexed wallet, bool blocked, bytes32 reason)
WeekHeld(uint64 indexed week, bytes32 reason)          WeekReleased(uint64 indexed week)
WeekExtended(uint64 indexed week, uint32 totalExtensionSeconds)
Finalized(uint64 indexed week, address indexed winner, bytes32 indexed sessionId, uint256 score, uint256 prize)
PrizeTransferFailed(uint64 indexed week, address indexed winner, uint256 amount)
PrizeClaimed(uint64 indexed week, address indexed winner, address to, uint256 amount)
UnclaimedRecycled(uint64 indexed week, uint64 indexed toWeek, uint256 amount)
RulesScheduled(uint64 indexed fromWeek, bytes32 seasonId, bytes32 altSeasonId, uint128 minPaidWei, uint64 maxSurvivalSeconds, uint256 maxScore, uint128 maxPrizeWei, uint128 minFundWei, bool adminClearOnly)   // also emitted by the constructor
KeeperUpdated(address indexed keeper)
AdminTransferStarted(address indexed current, address indexed pending)   AdminTransferred(address indexed previous, address indexed current)   // also forceAdmin
OperatorTransferStarted(address indexed current, address indexed pending) OperatorTransferred(address indexed previous, address indexed current)
Paused(address by, bool isOperator)  Unpaused(address by, bool isOperator)
EndScheduled(uint64 lastWeek)  EndCancelled()  ResidualRecovered(address to, uint256 amount)  StraySwept(address indexed token, uint256 amount)
RefundedAfterEnd(uint64 indexed week, address indexed funder, uint256 amount)
ResidualRecipientNominated(address indexed current, address indexed nominee)  ResidualRecipientChanged(address indexed previous, address indexed current)
```

**J1 amendment (2026-09-25):** `toWeek == 0` in `RolledOver`, `CapExcessCarried` and `UnclaimedRecycled` means the amount went to the residue (after a scheduled end); the mirror stores `rolled_to_week = NULL` for it (§C.2). `CandidateSkipped` may also carry `"disqualified"`, which is unreachable today (a disqualified session is never listed) and kept as a guard. The contracts slice's `docs/web3/weekly-jackpot-operations.md` ("Interface notes for jackpot-server") lists every such detail.

### A.14 Views

| View | Returns |
| --- | --- |
| `currentWeek()`, `weekOf(uint64 ts)` | week indexes |
| `weekBounds(w)` | `(start, close, settleCutoff, candidateUntil, payoutAt)`, extension included |
| `potOf(w)` | `(funded, carriedIn, total)` |
| `weekState(w)` | `(status, held, count, winner, winningSession, prize, unclaimed, finalizedAt, extension)` |
| `candidatesOf(w)` | `Candidate[]`, at most 5 |
| `leaderOf(w)` | `(sessionId, player, score, review)`, using the same skip rules as `finalize`. It also names the top row of an unfunded week, which `finalize` never records as the winner (a zero pot), so it is a champion only when the pot is funded (J13) |
| `rulesFor(w)`, `rulesCount()`, `rulesAt(i)` | rule epochs |
| `checkEligibility(sessionId)` | as in A.7 |
| `liabilities()`, `residual()`, `endAfterWeek()`, `fundedBy(w, funder)` | accounting |
| `paused()`, `adminPaused()`, `operatorPaused()` | pause state |
| `staffEver(a)`, `adminReviewed(id)`, `wasListed(id)`, `reviewOf(id)` | review and staff state |

### A.15 Revert strings and how the keeper classifies them

| Revert | Where | Keeper class (§C.4) |
| --- | --- | --- |
| `NOT_FOUND`, `NOT_VERIFIED`, `WRONG_GAME`, `NOT_PAID`, `BELOW_MIN_PAID`, `BEFORE_FIRST_WEEK`, `AFTER_END`, `WRONG_SEASON`, `SURVIVAL_CAP`, `SCORE_CAP`, `ZERO_SCORE`, `STAFF_WALLET` | submit | `deterministic` (the Neon filter and the chain disagree; alert) |
| `SETTLED_LATE`, `WINDOW_CLOSED`, `WALLET_BLOCKED`, `DISQUALIFIED`, `NOT_BETTER`, `NOT_IN_TOP` | submit | `skipped` (terminal, not an error) |
| `ALREADY_CANDIDATE`, `WEEK_SETTLED` | submit, finalize | `already-done` |
| `AFTER_END` (J1 amendment) | finalize of a week after `endAfterWeek` | `already-done` (terminal: the week is refund-only; the cron never finalizes a week after the end) |
| `NOTHING_TO_CLAIM` (J1 amendment) | recycle, claim | `already-done` |
| `PAYOUT_NOT_DUE`, `PAUSED`, `WEEK_HELD`, `LEADER_NOT_CLEARED` | finalize, clear | `wait` (the week goes to `awaiting-admin` for the last two) |
| `REVIEW_LOCKED` | keeper clear or flag | `skipped` (the admin's decision stands) + `awaiting-admin` if it is the leader |
| `DISQUALIFIED` on flag | keeper flag | `skipped` |
| `ONLY_KEEPER`, `ONLY_ADMIN`, `Only platform operator` | any | `deterministic` (configuration error; alert) |
| `NOTHING_RECEIVED`, `BELOW_MIN_FUND`, `BAD_WEEK`, `ONLY_WINNER`, `TOO_EARLY`, `TOO_LATE`, `LIST_FULL`, `RULES_NOT_FUTURE`, `RULES_TOO_FAR`, `TOO_MANY_EPOCHS`, `END_TOO_SOON`, `FUNDED_AFTER_END`, `NOT_AFTER_END`, `NOTHING_TO_REFUND`, `EXTENSION_CAP`, `OPERATOR_LOCK`, `LIABILITIES_BREACHED`, `ZERO_ADDRESS`, `Only pending operator`, `ONLY_PENDING_ADMIN`, `ONLY_RESIDUAL_RECIPIENT`, and (J1 amendment) `BAD_RULES`, `END_FINAL`, `EMPTY_GAME_ID` | fund, claim, refund, constructor and admin/operator paths | not sent by the keeper |

### A.16 What can never happen (tested invariants)

1. A prize reaches any address other than the week's winner, or `to` chosen by that winner in `claim`.
   - The only other outflows are `refundAfterEnd` (a funder's own contribution to a week after a scheduled end, to that funder), `recoverResidual` (the residual recipient, only after a scheduled end and a 30-day delay) and `sweepStray` (only the excess over liabilities).
2. An open week's pot decreases.
3. A week's rules change after the week starts.
4. A session that fails the on-chain eligibility is listed: it would need to be unverified, unpaid, a wrong game, a wrong season, settled late, over a cap, or from a staff, blocked or disqualified wallet.
5. `finalize` pays a candidate while a higher, non-disqualified candidate exists, or pays an uncleared leader.
6. The keeper undoes a flag, clears under `adminClearOnly`, or changes any session the admin reviewed; anyone flags a disqualified session.
7. A week finalizes twice, or before `payoutAt`.
8. `token.balanceOf(this) < liabilities`, unless the token itself misbehaves (a rebase).
9. Native zkLTC is accepted.
10. An address that ever held the admin, operator or keeper role wins, at any later time.
11. A displaced, non-disqualified session is barred from returning before `payoutAt − 2 h` when a slot is free (sybil eviction is recoverable).
12. The admin lifts an operator pause, or blocks `forceAdmin`.
13. Any funding (of any size, for any week) prevents `scheduleEnd`; funding for a week after an end reaches anyone but its funder.
14. A week with a zero pot records a winner.
15. `reinstate` inserts a session that was never listed.

### A.17 Test token `tCHIKUN`

- `contracts/src/TestChikunToken.sol`: OZ `ERC20("Lester's Arcade Test CHIKUN (no value)", "tCHIKUN")`, 18 decimals.
- `minter` is set in the constructor (the operator), with a two-step `transferMinter`/`acceptMinter`.
- `mint(to, amount)` is `onlyMinter`, with `require(amount <= 10_000_000e18)` per call.
- There is no burn-from, pause or blacklist: a plain token keeps the test honest.
- The name and symbol say "test" and "no value" so it can never pass for the real $CHIKUN.

### A.18 Tooling (contracts slice)

- **Mock tokens for tests** (fee-on-transfer, blacklist, reentrant callback) live in `contracts/test/mocks/*.sol`, never `contracts/src`. `node scripts/compile-contracts.mjs --mocks` compiles them into committed `tests/fixtures/contract-mocks/*.json`. The default compile output is unchanged.
- **`scripts/lib/local-jackpot.mjs`:** `deployLocalJackpot({ provider, wallets, record, rules, firstWeek, token })` deploys onto the in-process chain **after** `deployLocalSuite` and outside the parity region of `tests/local-deploy-harness.test.mjs:112-113,208-234`. It returns `{ jackpot, token, record }`. The keeper is a new named fixture wallet derived from the Hardhat mnemonic.
- **`scripts/deploy-weekly-jackpot.mjs`:**
  - two phases: a dry-run manifest by default (predicted addresses from `pendingNonce`, constructor args, gas estimate, immutables); `--broadcast --confirm DEPLOY_WEEKLY_JACKPOT_4441` to act;
  - the key comes through `scripts/lib/key-source.mjs` and must be the operator;
  - `--token <address>` skips the tCHIKUN deploy;
  - `--first-week next|<YYYY-Www>` accepts only a week after the current one (the constructor enforces it too); `current` is refused;
  - with `--retire-previous`, it requires `firstWeek > previous.endAfterWeek` read from chain (§A.19);
  - it reads the immutables back after deploy, writes `contracts/deployment-record.jackpot.json` (`schemaVersion 1`, `instances.chikun.{address, token, startBlock, deployTx, firstWeek, admin, keeper, residualRecipient, rules}`, plus `instances.chikun.retired[]` entries `{address, token, startBlock, firstWeek, endAfterWeek}` for ended instances), and regenerates the module;
  - `--rpc` is honoured only for loopback, as in `operator-actions.mjs:261-275`;
  - **it never touches `scripts/deploy-contracts.mjs`**, which redeploys the whole suite and is pinned by tests.
- **`scripts/generate-litvm-jackpot.mjs`** writes `apps/portal/src/generated/litvm-jackpot.mjs`. It is committed as `status:'undeployed'` until runbook step E4, and has `--check` parity. Export shape:
  ```js
  export const LITVM_JACKPOT = Object.freeze({ status: 'undeployed' | 'deployed', chainId: 4441,
    instances: Object.freeze({ chikun: Object.freeze({ address, startBlock, firstWeek, admin, keeper, residualRecipient,
      token: Object.freeze({ address, symbol, decimals, name, testnet }),
      retired: Object.freeze([ /* { address, startBlock, firstWeek, endAfterWeek, token: {…} } */ ]) }) }) });
  ```
  It is a separate module, because `tests/litvm-addresses-module.test.mjs` pins the key set of the Ranked module, a certified public file. Server consumers import it **statically**, as `server/deployment.mjs:27-29` does, so the Vercel file tracer bundles it. **Browser initial chunks never import it** (only the lazy jackpot chunks and the owner page do), because esbuild keeps the frozen object in a shared chunk (§D.1).
- The new `apps/portal/src/generated/litvm-jackpot.mjs` changes the curated source inventory. The contracts slice runs `npm run assets:hmh:curated-level-kit-runtime` and commits the regenerated inventory (`tests/hmh-curated-level-kit-inventory.test.mjs`); on a merge conflict the orchestrator regenerates it, never hand-merges.
- **`scripts/jackpot-actions.mjs <action>`** is a sibling of `operator-actions.mjs` with the same guards: a dry run by default; `--broadcast --confirm <PHRASE>`; the key read in-process; the signer checked against the on-chain role; loopback-only `--deployment`/`--rpc` overrides.

  | Action | Confirm phrase | Notes |
  | --- | --- | --- |
  | `status` | none (read-only) | |
  | `mint-test --to --amount` | `MINT_TCHIKUN_4441` | minter |
  | `fund --week current\|<YYYY-Www> --amount` | `FUND_JACKPOT_4441` | approve + fund from the given key |
  | `set-keeper <addr>` | `SET_JACKPOT_KEEPER_4441` | |
  | `schedule-rules --from-week … ` | `SCHEDULE_JACKPOT_RULES_4441` | |
  | `force-admin <addr>` | `FORCE_JACKPOT_ADMIN_4441` | operator; one step; emergency stop 5 |
  | `operator-pause` / `operator-unpause` | `PAUSE_JACKPOT_4441` | operator's own pause flag; the admin cannot lift it |
  | `schedule-end <week>` | `END_JACKPOT_4441` | |
  | `recover-residual` / `sweep-stray <token>` | `RECOVER_JACKPOT_4441` | |
  | `finalize <week>` | `FINALIZE_JACKPOT_4441` | manual fallback, from any key |
  | `refund-after-end <week>` | `REFUND_JACKPOT_4441` | from the funder's own key |

  The admin's own actions (clear, flag, disqualify, reinstate, `adminSubmit`, block/unblock, hold/release, extend, pause/unpause, `transferAdmin`) are on the owner page (§D.5), because the admin is a browser wallet. `set-keeper` in the runbook also blocks the outgoing keeper wallet (it is `staffEver` already; the block records the reason publicly).

- **`scripts/jackpot-keeper-key.mjs --out <path>`** generates a fresh key into a JSON file (mode 0600 where supported). It prints only the address and refuses to overwrite.

### A.19 Instance migration and Louie's payouts (rev. 2)

- **Why a new instance is sometimes needed.** `token`, `gameId`, `scoreRegistry` and `rankedEntry` are immutable. A real $CHIKUN token, a repointed `rankedEntry`, or a new Chikun game id (the only on-chain way to send Chikun's 85% developer share to Louie, since `GameRegistry` has no dev-wallet setter) each need a new jackpot instance.
- **Sequencing** (runbook stop 7):
  1. `schedule-end <lastWeek>` on the old instance, at least one full week ahead. Announce it.
  2. Deploy the new instance with `firstWeek > old.endAfterWeek` (the deploy script checks it), so no session can win both.
  3. Regenerate the module with the old instance in `retired[]`. The cron keeps indexing and servicing every retired instance until all its weeks are terminal; the API's `current` block uses the active instance, and history spans both, each row with its own token (§C.2 keys rows by contract).
  4. After the old instance's last week is finalized, funders call `refund-after-end` for any week they pre-funded past the end; any unwon final pot becomes residual after 30 days.
- **Louie's developer share.** Recommended: until mainnet, keep Chikun's `devWallet` as it is and forward Louie's share off chain; at mainnet, the fresh deployment set registers Chikun with Louie's wallet (or a splitter) and should add a two-step dev-wallet update to `GameRegistry`. Re-registering Chikun on testnet would split the board and end this jackpot instance (OJ7).

---

## B. Anti-cheat, end to end

### B.1 Threat model

What the prize makes worth attacking:
1. **Machine play:** scripts, reflex or computer-vision bots, and offline solvers that see beyond the screen.
2. **Look-ahead by a human:** a CSS edit that widens the Chikun view (the runtime already holds obstacles 1,850-5,000 px ahead and, before rev. 2, drew them all).
3. **Last-mover sniping with banked sessions:** open sessions during the week, wait for the final public standings at the close, then produce (offline search, tool assistance or pause-buffered play on the known seed) a run that just beats the leader, and settle it before C + 6 h.
4. **Forged records:** a leaked verifier key, or a compromise of the whole server environment (A.3).
5. **Staff, funder or test wallets winning,** including the developer wallet, which gets 85% of each entry back, so its holder plays for about 15% of the price.
6. **Late or out-of-week runs.**
7. **Multi-wallet (sybil) play.** Revision 1 put it out of scope; that was wrong. Every sanction and every per-wallet soft signal resets with a new wallet, seed shopping multiplies with the number of wallets, and five wallets can flood the top-5 list (A.7). Mitigations: the relist path and `adminSubmit`, `wholeWalletForWeek` disqualification, the rules-page one-person-one-wallet rule (a person found using several wallets is disqualified on all of them, reason `multi-wallet`), a cross-wallet funding soft signal (S10), and, for any real-value instance, personhood gating or winner verification as a **precondition** (OJ6).
8. **Operational faults:** the relayer stalls at the close, or the keeper crashes mid-send.
9. **Key compromise** (A.3).
10. **Review fatigue:** planted flagged decoys every week to force manual review and mistaken clears (the rubric in §E and the SLA address it).

Not in scope: collusion among staff beyond what the prize cap bounds.

### B.2 Existing layers (1.8.x, unchanged)

| Layer | What it proves | Reference |
| --- | --- | --- |
| Seed ticket (A25) | The seed was issued by the server to this wallet for this session identity. It stops replay theft and seed re-derivation. | `server/verify/seed-ticket.mjs` |
| Server replay (Chikun v6) | The flap inputs, replayed on the frozen runtime, give exactly the claimed score and fields. | `server/verify/chikun.mjs:31-83` |
| Wall-clock bound (A26) | The run cannot settle before `openedAt + survival − 30 s`. | `settle-core.mjs:525-529` |
| Paid entry + EIP-712 settlement | A paid session exists, and the verifier signed the run. | `ScoreSubmissionRegistry.sol:205-236` |
| Board moderation | `board_excluded` and `hidden` (wallet-wide, off chain) | `scripts/moderate-profile.mjs` |

**Accepted gap (contract §12):** replay proves the rules were followed, not that a human played. The seed is known before payment, and pause is allowed in Ranked (`apps/chikun/src/main.mjs:548-563`), so a solver has unlimited offline time.

### B.3 New layers

1. **Stricter selection than the board** (§C.4). The keeper only proposes rows that meet all of these:
   - `source='settle'` with stored evidence
   - `NOT chain_mismatch`
   - `status='confirmed'` and `confirmed_at ≤ settle cutoff`
   - `opened_at` inside the week
   - the week's season
   - the wallet is not board-excluded, not blocked or disqualified on chain, and not a staff wallet
2. **Integrity re-check** of every candidate, whoever submitted it:
   - the evidence is re-replayed with `deps.verify.reverifyStoredRun` (`server/verify/index.mjs:116-138`), and score, fields and envelope must match. `sameRun` is module-private in `server/settle/attestation.mjs:128`, so the server slice owns a copy in `server/jackpot/` with a parity test against settle's behaviour;
   - on chain, `getSession`/`getPaidSession` must match Neon (player, game, season, runtime, score, `openedAt` week, amount ≥ minimum). `createChainReader().getSession` returns only `{exists, player, submittedAt}` (`relayer.mjs:106-110`), so the server slice adds its own full `ScoreRecord` decoder in `server/jackpot/`;
   - **stock-client check:** evidence `maxTicks` must equal 216,000 (`MAX_RUN_TICKS`, `apps/chikun/src/main.mjs:86`). The verifier accepts 1-216,000 (`server/verify/chikun.mjs:40`) and a truncated run ends cleanly as `run-complete` below the on-chain survival cap, so any other value proves a non-stock client;
   - **seed provenance (rev. 2):** the candidate's seed ticket is looked up in `seed_ticket_log` (§C.2) by `(wallet, sessionId handle, gameId, seasonId, buildHash)`. Its MAC is recomputed with `SESSION_SECRET` (`seedTicketMacInput`, `server/verify/seed-ticket.mjs`), the seed is re-derived with `deriveRankedSeed` and compared with the stored identity's seed, and `issuedAt` is checked against `openedAt` (A26 bounds). A bad MAC or a seed mismatch is an integrity failure; a missing row is a hold (H10). This covers a verifier-key or Neon-only compromise; it does not cover a full server-environment compromise (A.3).
   - A failure means `flag(integrity)`, which blocks payout until the admin decides.
   - A session on chain with **no evidence** in Neon means either a forged attestation (a verifier key leak) or data loss. It is always flagged.
3. **Automated human-plausibility screen** (B.4). It only **holds**. A hold is `flag(screen-hold)` (or `flag(late-evidence)` for H9).
4. **On-chain eligibility and caps** (A.7). These cannot be bypassed by any caller:
   - the survival cap of 3,599 s makes a run that reached the 60-minute limit (a run-complete) ineligible;
   - the optional score cap;
   - the per-week prize cap;
   - staff wallets and the block list.
5. **Review window** (J3): proposals from C + 2 h; challenges until C + 12 h; the admin has at least 12 h after the last possible challenge; payout at C + 24 h.
6. **Owner review page** (`apps/portal/owner/jackpot.html`, §D.5):
   - the candidate list with flags and feature values, the evidence delay, seed provenance, and the next 10 eligible sessions not on the list;
   - a server-computed flap timeline with a look-ahead overlay, and the replay in the real cabinet;
   - one-click clear, flag, disqualify, reinstate, `adminSubmit`, block or unblock, hold or release, extend, pause, and finalize from the admin wallet;
   - the written review rubric (§E) linked from every decision.
7. **On-chain challenge** (J2): anyone can put a better eligible run on chain until C + 12 h. The keeper screens on-chain candidates first, by chain rank, up to 5 screens per run; a challenger is typically screened and cleared or flagged **within two to three cron runs (10-15 min)** (rev. 1 said one run, which the one-step-per-week state machine could not meet).
8. **Stock view in the Chikun child (rev. 2):** the child never draws an obstacle beyond the stock landscape view edge (logical x 1,280) or the portrait view edge, whatever the CSS box. A widened frame shows open sky, not the course. A cheater now needs to change JavaScript, not just CSS (§D.3).
9. **Transparency:**
   - `GET /api/jackpot` publishes each closed week's candidates, their review status, the winner, the prize, the transaction and a replay link;
   - the rules page and the Scores page show the history;
   - every decision is an on-chain event with a public reason code;
   - replays of candidates are downloadable once their week has closed.

### B.4 The plausibility screen

**Inputs.** Only what the server stores: `session_evidence.evidence` (v6 `flapDeltas`, `maxTicks`), `verified_sessions.{score, survival_seconds, stats, opened_at, verified_at}` (`stats.terminalReason`, `nearMisses`, `flapCount`), `seed_ticket_log` (§C.2), and the wallet's run history.

**What the screen is for (stated on the rules page).** It catches **unsophisticated automation only**: scripts with regular timing, runs far beyond the human envelope, late evidence and tampered clients. A careful bot that plays within the visible screen with human-like timing passes it; human review, caps and, for real value, personhood or winner verification are the defence against that (B.5).

**Features.** `server/jackpot/plausibility.mjs`, pure and deterministic. Here `d` is the list of inter-flap intervals in ticks (`flapDeltas.slice(1)`) and `minutes = survivalTicks / 3600`.

| Feature | Definition |
| --- | --- |
| `terminalReason` | from the replay result |
| `survivalSeconds`, `score` | as recorded |
| `fastPairs` | `count(d ≤ 2)`. Key auto-repeat is ignored (`main.mjs:839`), so holding a key does not produce them, but **humans can**: four inputs flap (Space, ArrowUp, Enter, pointer), and two-key rolls, mouse-switch chatter and touch double-registration give 1-2-tick gaps. A flap sets velocity rather than adding to it, so fast pairs give no advantage and a competent bot never produces them. H4 therefore catches naive scripts only and is **never grounds to disqualify on its own** (rubric, §E). The review page shows whether each fast pair changed the trajectory. |
| `maxTicks` | from the evidence; the stock client always uses 216,000 |
| `evidenceDelaySeconds` | `verified_at − (opened_at + survival_seconds)`: how long after the run could have ended the server first received it. Pause is unlimited in Ranked, so a large value means the run was paused or produced offline. |
| `topShare` | the share of `d` equal to its most common value |
| `longestSameRun` | the longest run of consecutive equal intervals |
| `entropyBits` | Shannon entropy of the histogram of `d` (1-tick bins) |
| `flapsPerMinute` | `flaps / minutes` |
| `adjSimilar` | the share of consecutive intervals within ±1 tick of each other |
| `nearMissPerMinute` | `stats.nearMisses / minutes` |

**Calibration evidence.** Probes run on 2026-09-24 against the live v6 runtime (`scripts/lib/chikun-bots.mjs` profiles, harness seeds 0-11, and `scripts/chikun-course-pilot.mjs` pilots). **Caveat (rev. 2):** the "human models" are the difficulty-harness bots, whose separating properties are built in (a 6-tick minimum press gap, `CHIKUN_BOT_MIN_PRESS_GAP_TICKS`, Gaussian timing noise, a 1,280-px view; `scripts/lib/chikun-bots.mjs:28-33,413-414`). The separation below is therefore partly circular and says nothing about real humans. The probes are not yet committed code; the server slice commits them as `scripts/chikun-plausibility-calibrate.mjs --probe` with a receipt, plus the humanised solver and a widened-view pilot as `scripts/lib/chikun-evasion-pilots.mjs`.

| Population | n | minutes | fpm | min Δ | fastPairs | topShare | longestSameRun | entropy (bits) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Bot "human models": novice → exceptional | 60 | 0.95-14.18 | 49.2-59.9 | 6 | 0 | 0.04-0.22 | 2-8 | 5.04-6.24 |
| Reflex bots (reaction 1-3 ticks, jitter ≤ 0.5, in-viewport) | 12 | 10.3-15.2 | 51.7-56.2 | 6-7 | 0 | 0.22-0.27 | 6-10 | 4.42-4.70 |
| Scripted pilots, visible-view (`routePilot` landscape and portrait) | 6 | 1.8-10.3 | 90-92 | 1 | 4-19 | 0.79-0.83 | 52-90 | 1.02-1.20 |
| Solver (`routePilotFullSnapshot`, sees the whole course) | 3 | **60.0 (run-complete)** | 95 | 1 | 107 | 0.83 | 95 | 1.09-1.13 |
| Naively "humanised" solver (jitter added, ≥ 6-tick gap) | 3 | 9.8-10.7 | 69-70 | 6 | 0 | 0.10 | 3 | 4.4-4.5 |

For reference, the difficulty-harness receipt (`docs/qa/chikun-difficulty-harness-20260923.json`) puts the exceptional profile at p99 15.7 min and a score p99 of 67,838.

**Key finding.** Past about 15 minutes, survival is limited by **information**, not reflexes. Reflex bots with 1-3-tick reactions die by 15.2 minutes, just like the exceptional model, while a solver that can see beyond the 1,280-px landscape view completes 60 minutes. Survival and score far beyond the human-model envelope therefore signal look-ahead: a solver, or a widened viewport.

**The widened viewport was a one-line CSS cheat (rev. 2 fix).** `buildChikunViewport` sizes the world view as 720 × the aspect ratio of the canvas's CSS box (`apps/chikun/src/viewport.mjs:3-9`, `main.mjs:37-43`); only `.game-frame{aspect-ratio:16/9}` keeps it at 1,280 (`apps/portal/chikun/game.css:8`). The runtime snapshot holds obstacles out to `max(1850, 1280 + 528·speed)` px (`apps/portal/src/chikun-ground-course.mjs:135`, about 5,000 px by minute 15), and `main.mjs:653` drew every one. A human who unticks `aspect-ratio` gets 2-4× look-ahead with genuinely human inputs that pass H4-H6, stops just above the leader so H2/H3 never fire, and the replay looks normal in the stock cabinet. Revision 2 therefore:
- caps the landscape logical view width at 1,280 in `buildChikunViewport` (a wider CSS box letterboxes), and culls forks beyond `view.left + view.width` before drawing (jackpot-ui owns it; free play is affected only visually and only for non-stock frames);
- implements S8 in v1, computed against the same view edge, shown on the review page as a look-ahead overlay, and promoted to a hold rule for any `adminClearOnly` or real-value instance once calibrated.
A cheater can still change JavaScript; that is the residual in B.5.

**Hold rules, v1 (provisional; any one holds the run):**

| Id | Rule | Reason |
| --- | --- | --- |
| H1 | `terminalReason ∈ {run-complete, flap-limit}` | never reached by any model or stock human play. (Rev. 1 said the on-chain survival cap rejects run-complete anyway; that is true only for a 60-minute run, since a truncated `maxTicks` also ends as run-complete. H7 now catches truncation as integrity.) |
| H2 | `survivalSeconds > 1080` (18 min) | 1.15 × the harness p99 and above every probe |
| H3 | `score > 80000` | 1.18 × the harness score p99 (about 4,400 points per minute at 18 min) |
| H4 | `fastPairs ≥ 5 AND fastPairs ≥ 1% of intervals` | scripts show 1.6-2.4%; models 0. Naive scripts only; see the feature note |
| H5 | `topShare ≥ 0.45 OR longestSameRun ≥ 25 OR entropyBits < 3.0` | scripts sit at ≥ 0.79 / ≥ 52 / ≤ 1.2; all models at ≤ 0.27 / ≤ 10 / ≥ 4.4 |
| H6 | `flapsPerMinute ≥ 85 AND minutes ≥ 3` | scripts 90-95; models ≤ 60; the humanised solver 69 |
| H7 | integrity failure: no evidence, replay mismatch, chain mismatch, `source='chain-index'`, **`maxTicks ≠ 216000`**, **a seed-ticket MAC or seed mismatch** | flagged as `integrity`, not `screen-hold`; rows with `maxTicks ≠ 216000` are also dropped before the keeper submits |
| H8 | the wallet is `board_excluded` in Neon | flagged as `excluded-wallet` |
| H9 (rev. 2) | `evidenceDelaySeconds > 1200` (20 min) | late evidence: a banked session played or searched after the close, or a long pause. Deterministic from stored server facts. Flagged as `late-evidence`. |
| H10 (rev. 2) | no `seed_ticket_log` row for the session (for weeks at or after the week the log shipped) | the ticket's issue time and provenance cannot be checked; `screen-hold` |
| H11 (rev. 2; only when `rulesFor(w).adminClearOnly` or the token is not a testnet token, and after calibration) | `unexplainedDescents ≥ 2` | look-ahead; `screen-hold` |

**Soft signals** are shown on the review page and never hold on their own:
- S1: the wallet's first Ranked run is less than 7 days old.
- S2: the best score is more than 1.5 × the wallet's previous best, with at least 5 earlier runs.
- S3: more than 40 **settled** Chikun Ranked runs this week (Neon indexes settled runs only; `RankedSessionOpened` is not indexed, `server/indexer/index-chain.mjs:244-249`).
- S4: `flapsPerMinute` outside [35, 75].
- S5: `adjSimilar > 0.35`.
- S6: `nearMissPerMinute > 1.5`.
- S7: the wallet was flagged or disqualified before.
- S8 (v1): `unexplainedDescents`, defined below.
- S9 (v1): `evidenceDelaySeconds` between 5 and 20 minutes.
- S10 (v1, best effort): other candidate or flagged wallets of the last 8 weeks that received their first zkLTC from the same address within 2 hops (an off-chain read of funding transactions, capped at 20 RPC calls per candidate; `null` on RPC failure).
- S11 (v1): seed tickets issued to the wallet this week per settled Ranked run (seed shopping; from `seed_ticket_log`).
- Every signal is per wallet, so a new wallet resets S1, S2, S3, S7 and S11; S10 is the only cross-wallet one.

**S8, `unexplainedDescents`.** Replay the run on the pure runtime and count the ground-route obstacles that were passed where all of the following hold:
- Chikun was airborne above y 400 at `visibleTick − 60`, where `visibleTick` is the first tick at which the obstacle is inside the stock view (`obstacle.x < view.left + view.width`, 1,280 in landscape; the portrait edge in portrait, using the run's orientation from `stats` where recorded, otherwise landscape);
- the last flap before the passage was at a tick earlier than `visibleTick`;
- no other obstacle was visible in between.

Every model scores 0 on this by construction, because a model perceives only what is on screen. The review page overlays, for each obstacle, the tick it became visible and the tick Chikun committed to its route, so the reviewer has something to look at besides a normal-looking replay.

**Calibration protocol and launch gate (owner checkpoint OJ2), rewritten in rev. 2 with named populations.**
- **(a) Must-hold set** (gated at 100% held): `routePilot` landscape and portrait, `routePilotFullSnapshot`, any `maxTicks`-truncated run, and a late-evidence fixture.
- **(b) Known-evasion set** (reported, not gated): the exceptional bot on real seeds, the committed humanised solver, and the widened-view pilot run against a pre-rev-2 view. The receipt records their miss rate explicitly (expected about 100% for the first two), so the owner sees what the screen cannot catch.
- **(c) Human set:** at least **40 runs from at least 5 people known to the owner**, with a screen recording of each session kept by the owner (not committed). At least **15 runs of 8 minutes or more**. Across portrait and landscape and across touch, mouse and keyboard, including two-key, two-finger and worn-mouse input styles.
  - Free Mode runs are enough: the child's "Download replay" (`apps/chikun/src/main.mjs:952`) exports the same v6 evidence.
  - `scripts/chikun-plausibility-calibrate.mjs --from-neon` may add live Ranked rows only for wallets the owner vouches for (`--vouched <file>`); other Neon rows are reported separately and **never enter a gate denominator**, because a live cheater would poison the human set. It is read-only, and wallets are never written to its output.
  - Anonymised replays go to `tests/fixtures/chikun-human-calibration/*.json` (replay-file-v1, evidence only).
- **Seed variance pass:** a fixed-seed, varied-noise harness run measures how much of the survival spread comes from the seed alone. It decides whether seed shopping is a small edge (B.5 item 4); until it runs, that claim is unproven.
- The script re-runs every rule over all three sets and writes `docs/qa/chikun-plausibility-calibration-<date>.json`.
- **Gate for `JACKPOT_LIVE`:**
  - 0 human holds on H4-H6, and the human hold rate on every other rule recorded (with the Clopper-Pearson 95% upper bound, since 0 of 40 still allows about 7.5%);
  - 100% of set (a) held;
  - set (b) miss rates recorded;
  - the H2/H3/H9 human hold rate recorded, and tuned so that a human record set in the first weeks is reviewed rather than auto-paid, which is intended.
- Thresholds live in `server/jackpot/plausibility.mjs`, never in a public module. The rules page describes categories, not numbers.
- If the repository is public, the thresholds are public too. Obscurity is a speed bump; the defence is review plus caps.

### B.5 Residual risk (honest)

1. **A well-built in-viewport bot is indistinguishable from an elite human by these features.** This covers reflex bots, a computer-vision bot, or a bot tuned like the "exceptional" model with 6-tick press gaps and jitter.
   - They top out around 15 minutes and 65,000 points, which is where a top human would be.
   - The screen will not catch them. Human review of the replay might.
   - For tCHIKUN (no value) this is accepted.
   - **For any real-value prize, the residual risk is high.** A real-value instance therefore requires **all** of these (OJ6), not some:
     - `adminClearOnly` (every payout reviewed), with the written rubric;
     - a prize cap;
     - H11 (S8 as a hold rule) calibrated and on;
     - proof-of-personhood gating (for example Gitcoin Passport or World ID) or winner verification (KYC above a threshold, which is also a legal question, §F);
     - optionally a longer review window in the new instance.
2. **A solver that deliberately stops at human-plausible levels** looks like case 1, unless it settles late (H9) or its look-ahead shows in S8/H11.
3. **A JavaScript-level look-ahead cheat** (a modified client that draws the whole course) is not stopped by the rev. 2 view cap. S8 and the reviewer's look-ahead overlay are the only detectors.
4. **Seed shopping.** A client can request up to 60 seed tickets per wallet per hour (`server/settle/seed.mjs:25`; the IP limit is 600), see each seed before paying, evaluate it offline with the publicly served runtime, and pay only for the course it likes. Sybil wallets multiply this. **Whether the edge is small is unproven** until the seed variance pass (B.4) runs. `seed_ticket_log` makes it measurable (S11). A commit-reveal of the seed after payment would remove it; it needs a versioned identity change, not a contract redeploy (§I).
5. **Sybil wallets** reset every per-wallet sanction and signal. On testnet, entry is effectively free (faucet zkLTC), so unlimited attempts and wallets are possible; mainnet economics change this. For real value, personhood gating or winner verification is a precondition (OJ6).
6. **A compromise of the Vercel environment** defeats every automated layer at once (A.3). Only the prize cap, `adminClearOnly` and human review remain.
7. **Insiders.** The Chikun developer wallet gets 85% of every entry back, so its holder plays for about 15% of the price. Today that wallet is the admin, which is `staffEver`. If Louie's wallet ever becomes a developer wallet (a new game id, §A.19), it must be blocked, and a block on a known wallet is evaded with a fresh one; the rules page excludes funders and developers as people, not only as wallets.
8. **Relayer outages longer than 6 h across a close** exclude honest late runs unless the admin extends the week (≤ 72 h).
9. **One compromised admin or operator key** can steal at most one week's capped prize (A.3); the operator can now stop a compromised admin.
10. **A ranking quirk.** The Neon weekly board can show a higher score that is not jackpot-eligible (settled late, excluded, staff, over the survival cap, or no evidence). The UI bases every jackpot line on the jackpot's own leader, never the board rank (§D).
11. **Human false positives.** 0 holds out of 40 human runs still allows a true hold rate of about 7.5%. Holds only delay; the rubric (§E) keeps an admin from disqualifying on one soft signal.

---

## C. Server

### C.1 Configuration (`server/config.mjs`)

A new frozen `config.jackpot` sub-object. **It never touches `missing[]` or `settlementReady`** (`server/config.mjs:138-148`), so a jackpot misconfiguration cannot 503 `/api/settle` or the settle-retry cron.

| Env | Meaning |
| --- | --- |
| `JACKPOT_KEEPER_PRIVATE_KEY` | the keeper key (`/^0x[0-9a-fA-F]{64}$/`). It lives only inside the closure `config.jackpot.keeper.createWallet(ethers, provider)`. |
| `JACKPOT_CONTRACT_ADDRESS` | Cross-checked against `LITVM_JACKPOT.instances.chikun.address`, giving `{ configured, address, matchesDeployment }` as for `scoreRegistry` |
| `JACKPOT_PAUSED` | `true` stops every keeper transaction; reads continue. Health reports it (§C.4). |
| `JACKPOT_UI_HIDDEN` | `true` makes `/api/jackpot` answer `{ ok:true, live:false, game }`, which hides every surface once the CDN cache expires (≤ 150 s) without a client release |
| `JACKPOT_MAX_TX_FEE_WEI` | default `10000000000000000` (0.01 zkLTC) per transaction |
| `JACKPOT_ADMIN_WALLET` | optional **additional constraint** on `/api/jackpot/review`: when set, the caller must equal both it and the live on-chain `admin()` (§C.6) |

- `config.jackpot.ready = keeper.configured && contract.configured && contract.matchesDeployment && LITVM_JACKPOT.status === 'deployed'`.
- **Test seam:** `readServerConfig(env, { deployment, jackpotDeployment })`. `jackpotDeployment` overrides the statically imported `LITVM_JACKPOT` (it is committed `undeployed`, so without the seam every cron and API test would answer `jackpot-not-configured`). The jackpot handlers' `buildDeps` accept the same `jackpotDeployment` override next to `db`, `provider`, `deployment`, `nowMs`, `fetchImpl` and `crypto`; update the override-list assertion (`tests/server-settle-core.test.mjs:978` pattern) only for the jackpot handlers.
- `summary()` and `toJSON` gain a redacted `jackpot` part.
- The redaction test (contract §9.2) is extended with a fixture keeper key.
- **Secrets placement.** The keeper key joins `SESSION_SECRET`, `NEON_DATABASE_URL` and the verifier and relayer keys in one Vercel environment, which is the correlated risk in A.3. The operator key and the admin wallet must never be placed there.

### C.2 Neon migration 3 (`0003_weekly_jackpot`)

The migration follows the house rules:
- additive only, `CREATE … IF NOT EXISTS`, one statement per array entry;
- selects return text, int4 or bool only (A15);
- the same regex checks as `verified_sessions`.

Revision 2 keys every mirror by **contract** (J7), adds the rules mirror and the seed-ticket log, and fixes the action-id format. The DDL below is binding.

```sql
CREATE TABLE IF NOT EXISTS jackpot_weeks (
  contract         TEXT NOT NULL CHECK (contract ~ '^0x[0-9a-f]{40}$'),
  game_id          TEXT NOT NULL CHECK (game_id IN ('chikun')),
  week_key         TEXT NOT NULL CHECK (week_key ~ '^[0-9]{4}-W[0-9]{2}$'),
  week_index       INTEGER NOT NULL CHECK (week_index > 0),
  token_address    TEXT NOT NULL CHECK (token_address ~ '^0x[0-9a-f]{40}$'),
  token_symbol     TEXT NOT NULL CHECK (token_symbol ~ '^[A-Za-z0-9$]{1,16}$'),
  token_decimals   INTEGER NOT NULL CHECK (token_decimals BETWEEN 0 AND 36),
  token_testnet    BOOLEAN NOT NULL,
  starts_at        TIMESTAMPTZ NOT NULL,
  closes_at        TIMESTAMPTZ NOT NULL,
  settle_cutoff_at TIMESTAMPTZ NOT NULL,
  candidate_until  TIMESTAMPTZ NOT NULL,
  payout_at        TIMESTAMPTZ NOT NULL,
  status           TEXT NOT NULL CHECK (status IN ('open','closed','selecting','review','awaiting-admin','finalizing','paid','claim-pending','rolled','unfunded','failed')),
  funded_wei       TEXT NOT NULL DEFAULT '0' CHECK (funded_wei ~ '^[0-9]{1,78}$'),
  carried_in_wei   TEXT NOT NULL DEFAULT '0' CHECK (carried_in_wei ~ '^[0-9]{1,78}$'),
  prize_wei        TEXT NULL CHECK (prize_wei IS NULL OR prize_wei ~ '^[0-9]{1,78}$'),
  unclaimed_wei    TEXT NOT NULL DEFAULT '0' CHECK (unclaimed_wei ~ '^[0-9]{1,78}$'),
  winner           TEXT NULL CHECK (winner IS NULL OR winner ~ '^0x[0-9a-f]{40}$'),
  winning_session  TEXT NULL CHECK (winning_session IS NULL OR winning_session ~ '^0x[0-9a-f]{64}$'),
  winning_score    BIGINT NULL,
  finalize_tx_hash TEXT NULL CHECK (finalize_tx_hash IS NULL OR finalize_tx_hash ~ '^0x[0-9a-f]{64}$'),
  finalized_at     TIMESTAMPTZ NULL,
  rolled_to_week   TEXT NULL CHECK (rolled_to_week IS NULL OR rolled_to_week ~ '^[0-9]{4}-W[0-9]{2}$'),
  held             BOOLEAN NOT NULL DEFAULT false,
  extension_s      INTEGER NOT NULL DEFAULT 0 CHECK (extension_s BETWEEN 0 AND 259200),
  last_error       TEXT NULL CHECK (last_error IS NULL OR last_error ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  admin_waiting_since TIMESTAMPTZ NULL,             -- set on entering awaiting-admin (SLA, §E E11)
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contract, week_key)
)
CREATE TABLE IF NOT EXISTS jackpot_candidates (
  contract       TEXT NOT NULL CHECK (contract ~ '^0x[0-9a-f]{40}$'),
  game_id        TEXT NOT NULL CHECK (game_id IN ('chikun')),
  week_key       TEXT NOT NULL CHECK (week_key ~ '^[0-9]{4}-W[0-9]{2}$'),
  session_id32   TEXT NOT NULL CHECK (session_id32 ~ '^0x[0-9a-f]{64}$'),
  wallet         TEXT NOT NULL CHECK (wallet ~ '^0x[0-9a-f]{40}$'),
  score          BIGINT NOT NULL CHECK (score BETWEEN 0 AND 10000000000),
  submitted_at   TIMESTAMPTZ NULL,                 -- record.submittedAt (chain)
  source         TEXT NOT NULL CHECK (source IN ('keeper','public')),
  on_chain       BOOLEAN NOT NULL DEFAULT false,   -- currently in candidatesOf(week)
  was_listed     BOOLEAN NOT NULL DEFAULT false,   -- mirror of wasListed (relist eligibility)
  chain_rank     INTEGER NULL CHECK (chain_rank IS NULL OR chain_rank BETWEEN 1 AND 5),
  review         TEXT NOT NULL DEFAULT 'none' CHECK (review IN ('none','cleared','flagged','disqualified')),
  review_reason  TEXT NULL CHECK (review_reason IS NULL OR review_reason ~ '^[a-z][a-z0-9-]{1,31}$'),
  admin_reviewed BOOLEAN NOT NULL DEFAULT false,   -- mirror of adminReviewed; the keeper never acts on these
  screen         TEXT NOT NULL DEFAULT 'pending' CHECK (screen IN ('pending','pass','hold','integrity-fail','error')),
  screen_codes   TEXT NOT NULL DEFAULT '' CHECK (screen_codes ~ '^[A-Z0-9,]{0,64}$'),   -- e.g. 'H2,H9'
  features       JSONB NULL,                       -- owner-only (served by /api/jackpot/review)
  screened_at    TIMESTAMPTZ NULL,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contract, session_id32)
)
CREATE INDEX IF NOT EXISTS jc_week ON jackpot_candidates (contract, week_key, score DESC)
CREATE TABLE IF NOT EXISTS jackpot_actions (
  -- id = '<game>:<contract first 8 hex>:<week index>:<kind>:<session32|->', all lowercase,
  -- e.g. 'chikun:1a2b3c4d:2961:submit:0x…'. Rev. 1 used the week key, whose capital W failed this CHECK.
  id              TEXT PRIMARY KEY CHECK (id ~ '^[a-z0-9:-]{8,160}$'),
  contract        TEXT NOT NULL CHECK (contract ~ '^0x[0-9a-f]{40}$'),
  game_id         TEXT NOT NULL CHECK (game_id IN ('chikun')),
  week_key        TEXT NOT NULL CHECK (week_key ~ '^[0-9]{4}-W[0-9]{2}$'),
  kind            TEXT NOT NULL CHECK (kind IN ('submit','clear','flag','finalize')),
  session_id32    TEXT NULL CHECK (session_id32 IS NULL OR session_id32 ~ '^0x[0-9a-f]{64}$'),
  reason          TEXT NULL CHECK (reason IS NULL OR reason ~ '^[a-z][a-z0-9-]{1,31}$'),
  status          TEXT NOT NULL CHECK (status IN ('pending','signed','submitted','confirmed','skipped','failed','dead')),
  keeper          TEXT NULL CHECK (keeper IS NULL OR keeper ~ '^0x[0-9a-f]{40}$'),
  tx_hash         TEXT NULL CHECK (tx_hash IS NULL OR tx_hash ~ '^0x[0-9a-f]{64}$'),
  tx_nonce        BIGINT NULL,
  attempts        INTEGER NOT NULL DEFAULT 0,
  infra_failures  INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT NULL CHECK (last_error IS NULL OR last_error ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  next_attempt_at TIMESTAMPTZ NULL,
  submitted_at    TIMESTAMPTZ NULL,
  confirmed_at    TIMESTAMPTZ NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ja_submitted_has_tx CHECK (status <> 'submitted' OR tx_hash IS NOT NULL)
)
CREATE INDEX IF NOT EXISTS ja_due ON jackpot_actions (status, next_attempt_at) WHERE status IN ('pending','signed','submitted','failed')
CREATE TABLE IF NOT EXISTS jackpot_events (
  tx_hash       TEXT NOT NULL CHECK (tx_hash ~ '^0x[0-9a-f]{64}$'),
  log_index     INTEGER NOT NULL,
  block_number  BIGINT NOT NULL,
  block_time    TIMESTAMPTZ NOT NULL,
  contract      TEXT NOT NULL CHECK (contract ~ '^0x[0-9a-f]{40}$'),
  event         TEXT NOT NULL CHECK (event ~ '^[A-Za-z]{3,32}$'),
  week_key      TEXT NULL CHECK (week_key IS NULL OR week_key ~ '^[0-9]{4}-W[0-9]{2}$'),
  session_id32  TEXT NULL CHECK (session_id32 IS NULL OR session_id32 ~ '^0x[0-9a-f]{64}$'),
  wallet        TEXT NULL CHECK (wallet IS NULL OR wallet ~ '^0x[0-9a-f]{40}$'),
  amount_wei    TEXT NULL CHECK (amount_wei IS NULL OR amount_wei ~ '^[0-9]{1,78}$'),
  reason        TEXT NULL CHECK (reason IS NULL OR reason ~ '^[a-z][a-z0-9-]{0,31}$'),
  PRIMARY KEY (tx_hash, log_index)
)
CREATE INDEX IF NOT EXISTS je_week ON jackpot_events (contract, week_key, block_number)
CREATE TABLE IF NOT EXISTS jackpot_wallet_flags (
  contract    TEXT NOT NULL CHECK (contract ~ '^0x[0-9a-f]{40}$'),
  wallet      TEXT NOT NULL CHECK (wallet ~ '^0x[0-9a-f]{40}$'),
  blocked     BOOLEAN NOT NULL DEFAULT false,          -- mirror of WalletBlocked
  staff_ever  BOOLEAN NOT NULL DEFAULT false,          -- mirror of the role events (staffEver)
  reason      TEXT NULL CHECK (reason IS NULL OR reason ~ '^[a-z][a-z0-9-]{0,31}$'),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contract, wallet)
)
CREATE TABLE IF NOT EXISTS jackpot_rules (
  contract          TEXT NOT NULL CHECK (contract ~ '^0x[0-9a-f]{40}$'),
  from_week         INTEGER NOT NULL CHECK (from_week > 0),
  season_id32       TEXT NOT NULL CHECK (season_id32 ~ '^0x[0-9a-f]{64}$'),
  alt_season_id32   TEXT NULL CHECK (alt_season_id32 IS NULL OR alt_season_id32 ~ '^0x[0-9a-f]{64}$'),
  min_paid_wei      TEXT NOT NULL CHECK (min_paid_wei ~ '^[0-9]{1,78}$'),
  max_survival_s    INTEGER NOT NULL CHECK (max_survival_s >= 0),
  max_score         TEXT NOT NULL CHECK (max_score ~ '^[0-9]{1,78}$'),
  max_prize_wei     TEXT NOT NULL CHECK (max_prize_wei ~ '^[0-9]{1,78}$'),
  min_fund_wei      TEXT NOT NULL CHECK (min_fund_wei ~ '^[0-9]{1,78}$'),
  admin_clear_only  BOOLEAN NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contract, from_week)
)
CREATE TABLE IF NOT EXISTS seed_ticket_log (
  mac            TEXT PRIMARY KEY CHECK (mac ~ '^[0-9a-f]{64}$'),
  wallet         TEXT NOT NULL CHECK (wallet ~ '^0x[0-9a-f]{40}$'),
  session_handle TEXT NOT NULL CHECK (session_handle ~ '^game-session-[0-9a-f-]{36}$'),
  game_id        TEXT NOT NULL CHECK (game_id ~ '^[a-z0-9-]{1,40}$'),
  season_id      TEXT NOT NULL CHECK (length(season_id) BETWEEN 1 AND 80),
  build_hash     TEXT NOT NULL CHECK (length(build_hash) BETWEEN 1 AND 120),
  salt           TEXT NOT NULL CHECK (salt ~ '^[0-9a-f]{32}$'),
  issued_at      TIMESTAMPTZ NOT NULL,
  week_key       TEXT NOT NULL CHECK (week_key ~ '^[0-9]{4}-W[0-9]{2}$'),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
)
CREATE INDEX IF NOT EXISTS stl_session ON seed_ticket_log (wallet, session_handle)
CREATE INDEX IF NOT EXISTS stl_week ON seed_ticket_log (game_id, week_key, wallet)
```

- **`jackpot_rules`** is filled from `RulesScheduled` (which the constructor now emits for the initial epoch). A `RulesScheduled` with `fromWeek = F` deletes this contract's rows with `from_week >= F`, then inserts; the post-index reconcile re-reads `rulesCount()`/`rulesAt(i)` for epochs at or after the previous week and heals any gap. The public API, the selection query and the honesty rules read seasons, `minPaidWei`, `maxSurvivalSeconds`, `maxPrizeWei` and `minFundWei` from here, so `/api/jackpot` can stay Neon-only (Appendix K, F3).
- **`seed_ticket_log`** (rev. 2) is written best-effort by `server/settle/seed.mjs` right after a ticket is issued (§C.4, "Seed tickets"). It serves the seed-provenance integrity check, H10, S11 and the ticket-to-pay delay. `jackpot-ops prune-tickets --older-than 60d` deletes old rows; the trust page's `serverRecords` list gains it (§D.6).
- The keeper reuses `relayer_lease` (migration 1) unchanged; its row key is the keeper address.
- The indexer cursor is one `indexer_state` row **per contract**: stream `litvm-4441-jackpot-<contract lowercase hex without 0x>`.
- A migration test inserts one real `jackpot_actions` id of every kind (`submit`, `clear`, `flag`, `finalize`, with and without a session) and one row in every table.
- Tests that pin the schema version move from 2 to 3 (or to the jackpot's number, see the header):
  - `tests/cron-runs.test.mjs:53,60,69,86,92,111,207` (the "only migration 2 runs on v1" case becomes `applied: [2, 3]`, and a new case covers v2 → `[3]`)
  - `tests/chain-indexer.test.mjs:331,332,338,373,392,395`
  - `tests/api-health.test.mjs:161`
  - `tests/moderate-profile.test.mjs:135,154`
  - `tests/neon-migrations.test.mjs`
  The server slice greps the whole `tests/` tree for `schemaVersion`, `appliedMigrations` and `[1, 2]` at its base and lists every hit in its first commit.

### C.3 Jackpot event index

- **Module:** `server/jackpot/indexer.mjs`, run inside the jackpot cron, not the index-chain cron, so the index-chain cron stays untouched.
- **Instances:** the active instance and every `retired[]` instance whose weeks are not all terminal (§A.19). Each has its own cursor.
- **Cursor:** `indexer_state('litvm-4441-jackpot-<contract hex>')`, starting at the instance's `startBlock`.
- **Reads:** 5,000-block chunks within a 15 s budget per run. **Every RPC call has its own timeout** (8 s, through `AbortSignal` or `Promise.race`), because an in-flight call cannot be stopped by a soft budget (the index-chain 504s of 2026-09-24, `de2e6733`). Every `getLogs` carries the jackpot `address`, and returned logs are re-filtered by address, as in `server/indexer/index-chain.mjs:235-240`. Logs are sorted by block, then log index.
- **Error handling** mirrors the existing indexer:
  - RPC failures and timeouts abort the chunk without moving the cursor (`chainRead`, `{chainIo:true}`);
  - permanent row errors (SQLSTATE 22xxx/23xxx, `BAD_DATA`) are skipped (`guarded`), **except** that a reason that does not match the CHECK, or a `bytes32` that `decodeBytes32String` rejects, is stored as `'other'` instead of skipping the event, so a `Disqualified` or `Flagged` event is never lost.
- **Each event:**
  - upserts `jackpot_events`;
  - updates the mirrors: `jackpot_weeks` (funded, carried-in, status, winner, prize, unclaimed, finalize transaction, held, extension, bounds, token), `jackpot_candidates` (`on_chain`, `was_listed`, `chain_rank`, `review`, `review_reason`, `admin_reviewed` when `by` is the admin; a `CandidateSubmitted` from a non-keeper creates a `source='public'` row with `screen='pending'`), `jackpot_wallet_flags` (`blocked`; `staff_ever` from the constructor roles in the deployment record, `KeeperUpdated` and `AdminTransferred`/`OperatorTransferred`), and `jackpot_rules`.
- Mirrors are idempotent. Replaying a range yields the same rows.
- **The mirrors are the only source for amounts in the public API,** so a lagging index can only under-report. It never shows unfunded amounts.
- After indexing, the cron reads `candidatesOf(w)`, `weekState(w)` and **`reviewOf` plus `adminReviewed` for every listed candidate** of every non-terminal closed week, and the rules epochs (above). It reconciles `on_chain`, `chain_rank`, `review`, `admin_reviewed`, `status` and `unclaimed`. The view read heals any missed or skipped log.

### C.4 The jackpot cron

- **Files:**
  - `api/cron/weekly-jackpot.mjs`, using the handler seam of `api/cron/settle-retry.mjs:15-33` (`buildDeps`, `…Request`, `createHandler`, default export);
  - `server/jackpot/{weeks,select,screen,plausibility,store,keeper,indexer,errors,api-model,review-model}.mjs`.
- **Wrapper:** `withCronRun('weekly-jackpot', deps, () => runJackpot(deps))`. Add `weeklyJackpot: 'weekly-jackpot'` to `CRON_NAMES` and the jackpot codes to `CRON_ERROR_CODES` (`server/ops/cron-runs.mjs:22-28`), or they are stored as `unknown-error`.
- **Schedule and function config:** `*/5 * * * *`, with `{ maxDuration: 300, memory: 1024, includeFiles: 'apps/chikun/assets/obstacle-shapes.json' }`. 300 s (Pro) matches index-chain after its 2026-09-24 production 504s (`de2e6733`); a 60 s limit would kill a run mid-RPC and skip the `withCronRun` bookkeeping, so the status page would show a stale cron instead of an error. The obstacle shapes are needed by the re-replay; without them it fails closed with `verify-unavailable`. `tests/vercel-routing.test.mjs:242-265` deep-equals `functions` and `crons`, so update both, with a comment like index-chain's.
- **Deps:** `attachSettleDeps(base, { env, relayer: false })` (`settle-core.mjs:657-681`) provides `deps.verify` and `deps.chain` without ever creating the settle relayer. The keeper wallet comes from `config.jackpot.keeper.createWallet` and only when a send is due.
- **Gate order:**
  1. `cron.matches` → 401.
  2. `!db` → 503 `index-not-configured`.
  3. `!config.jackpot.ready` → 200 `{ ok:true, skipped:'jackpot-not-configured' }`. An undeployed jackpot is not a failure.
  4. `JACKPOT_PAUSED` → 200 `{ ok:true, skipped:'jackpot-paused' }`. The health `jackpot` part reports it, so a forgotten pause is visible (below).
  5. `ensureSchema(db)`.
- **Budget:** a soft budget of 120 s inside the 300 s limit. Indexing ≤ 15 s per instance. Every RPC call has an 8 s timeout and every receipt wait 15 s. At most one re-replay per candidate per run (a 60-minute run replays in about 5.3 s locally; E7 records the time measured on a 1,024 MB Vercel function, and the budget is re-set if it is more than 2× that). Each send keeps a 5 s reserve. A run never starts a step it cannot finish inside the budget.

**State machine** (per instance, per closed week, oldest first; idempotent; at-least-once safe). Rev. 2 allows **up to 5 screens and up to 3 sends per week per run** within the budget (rev. 1 allowed one step, so screening a challenger took several runs), and adds the rollover, relist and re-select rows.

| From | Condition | Work | To |
| --- | --- | --- | --- |
| (none) / `open` | now ≥ `closes_at` | Ensure the row (bounds from `weekBounds(w)`, token from the instance) | `closed` |
| `closed` | now ≥ close + 2 h; pot total < the week's `min_fund_wei` | Nothing is sent. | `unfunded` (terminal; a dust pot stays in the open on-chain week, which is harmless) |
| `closed` | now ≥ close + 2 h; pot total ≥ `min_fund_wei` | **Select** (below): insert up to 5 keeper candidates (screen `pending`) | `selecting` |
| `selecting` / `review` / `awaiting-admin` | a candidate is `screen='pending'` | **Screen** (below; order: on-chain rows by chain rank, then keeper-selected rows, then displaced public rows). `pass` → action `clear`; `hold`/`integrity-fail` → action `flag`. Keeper-selected rows that pass integrity also get a `submit` action; integrity-failed rows are never submitted. No clear or flag action is created for a row with `admin_reviewed` or `review='disqualified'`. | same |
| `selecting` / `review` / `awaiting-admin` | a due action exists | **Send** (below) | same |
| `selecting` | every keeper action is settled, and now ≥ settle cutoff + 10 min | One last re-select (it catches rows confirmed between C + 2 h and the cutoff) | `review` |
| `review` / `awaiting-admin` | `WeekExtended` indexed and now < the new settle cutoff | Re-select after the new cutoff | `selecting` |
| `review` / `awaiting-admin` | fewer than 5 on-chain rows; a displaced row that is `was_listed`, not disqualified and not `integrity-fail` exists; now < `payout_at − 2 h` | Action `submit` (a re-list) for the best such row | same |
| `review` | now ≥ `payout_at`; `leaderOf(w)` is cleared; not held; not paused | Action `finalize` | `finalizing` |
| `review` | now ≥ `payout_at`; **`leaderOf(w)` is empty**; not held; not paused | Action `finalize` (the pot rolls over) | `finalizing` |
| `review` | now ≥ `payout_at`; the leader is flagged or uncleared, or the week is held or paused | Nothing. Set `admin_waiting_since`. `/api/health` and the owner status page warn; after 7 days the warning escalates (§E E11). | `awaiting-admin` |
| `awaiting-admin` | any event that can change `leaderOf` or finalize eligibility is indexed: `Cleared`, `Flagged`, `Disqualified`, `Reinstated`, `CandidateSubmitted`, `CandidateRemoved`, `WalletBlocked`, `WeekReleased`, `WeekExtended`, `Unpaused`, `AdminTransferred` | Re-evaluate | `review` |
| `finalizing` | `Finalized` indexed, or `weekState(w).status != Open` | Mirror the winner, prize, unclaimed amount or rollover | `paid` / `claim-pending` / `rolled` |
| `claim-pending` | `PrizeClaimed` or `UnclaimedRecycled` indexed | Mirror | `paid` / `rolled` (terminal) |
| any | an action goes `dead` (3 deterministic failures) | Record `last_error` | `failed` (the owner requeues) |

- `claim-pending` is in the `jackpot_weeks` status CHECK (§C.2).
- **Anyone may finalize.** If a `Finalized` event appears, the row becomes terminal whatever its state.
- **Unfunded weeks:** nothing is sent, and no champion is claimed (a zero pot never records a winner on chain either, A.9).

**Selection query** (`server/jackpot/select.mjs`; every parameter a string, A15). Rev. 2 sorts on the **numeric** columns in every `ORDER BY` and casts only in the final projection, as `readLeaderboard` does (`server/neon/queries.mjs:91-114`); rev. 1 cast `score` to text inside the subquery, so `'9999'` would have ranked above `'48213'`. The minimum paid amount is compared in SQL as `numeric`.

```sql
WITH best AS (
  SELECT DISTINCT ON (vs.wallet) vs.session_id32, vs.wallet, vs.score, vs.confirmed_at, vs.opened_at, vs.entry_amount_wei
  FROM verified_sessions vs
  JOIN session_evidence e ON e.session_id32 = vs.session_id32
  WHERE vs.game_id = 'chikun' AND vs.week_key = $1
    AND vs.season_id = ANY(string_to_array($2, ','))                 -- the week's seasons (jackpot_rules → catalog text)
    AND vs.status = 'confirmed' AND vs.source = 'settle' AND NOT vs.chain_mismatch
    AND vs.opened_at >= $3::timestamptz AND vs.opened_at < $4::timestamptz
    AND vs.confirmed_at <= $5::timestamptz                            -- settle cutoff (with extension); NULL = no cutoff (open-week leader)
    AND vs.survival_seconds <= $6::bigint                              -- maxSurvivalSeconds (or 86400 when 0)
    AND vs.entry_amount_wei IS NOT NULL AND vs.entry_amount_wei::numeric >= $7::numeric   -- minPaidWei
    AND vs.wallet <> ALL(string_to_array($8, ','))                      -- staff (jackpot_wallet_flags.staff_ever) + role wallets
    AND NOT EXISTS (SELECT 1 FROM wallet_profiles p WHERE p.wallet = vs.wallet AND p.board_excluded)
    AND NOT EXISTS (SELECT 1 FROM jackpot_wallet_flags f WHERE f.contract = $9 AND f.wallet = vs.wallet AND (f.blocked OR f.staff_ever))
    AND NOT EXISTS (SELECT 1 FROM jackpot_candidates c WHERE c.contract = $9 AND c.session_id32 = vs.session_id32 AND c.review = 'disqualified')
  ORDER BY vs.wallet, vs.score DESC, vs.confirmed_at ASC, vs.session_id32 ASC
)
SELECT b.session_id32, b.wallet, b.score::text AS score,
       <isoSql(b.confirmed_at)> AS confirmed_at, <isoSql(b.opened_at)> AS opened_at, b.entry_amount_wei
FROM best b
ORDER BY b.score DESC, b.confirmed_at ASC, b.session_id32 ASC
LIMIT $10::int
```

- The keeper asks for 10 rows, drops any whose evidence has `maxTicks ≠ 216000` (H7), and keeps the first 5. `current.leader` (§C.5) asks for 3 and uses the first that passes the same code checks, so one filtered row never blanks the leader.
- A select test covers scores 9,999 and 48,213, a `minPaidWei` of 0.1 against 0.102 and 0.0999 amounts, and every other filter.
- The period bounds come from `periodStartMs('weekly', key)` and `periodKeyResetAt('weekly', key)` (`server/neon/period-keys.mjs:59-91`).
- `$2` is the season text list. It comes from mapping the week's `jackpot_rules` `season_id32` and `alt_season_id32` (bytes32 = `ethers.id(text)`) back to text through the known season catalog (`server/neon/rows.mjs` `INDEX_GAMES`, plus any retired Chikun seasons kept there). An unknown hash selects nothing and records `last_error = 'unknown-season'`. Add `unknown-season` to both allowlists.
- `$8` holds every `staff_ever` wallet of the instance plus the role wallets of the deployment record (verifier, relayer, operator, dev/vaults) and the residual recipient.
- The existing index `vs_board_week` serves the filter.

**Screen** (`server/jackpot/screen.mjs`) returns `{ result: 'pass'|'hold'|'integrity-fail'|'error', codes, features, soft, timeline }`:
1. The Neon row and the stored evidence (`readStoredEvidence`, `server/settle/store.mjs:199`).
2. `reverifyStoredRun`, then compare with the jackpot-local copy of `sameRun` (§B.3).
3. A chain cross-check through the jackpot-local full `getSession` decoder and `createChainReader().getPaidSession`, plus `checkEligibility(sessionId)` on the jackpot.
4. The stock-client check (`maxTicks`) and the seed-provenance check against `seed_ticket_log` (§B.3).
5. Features and hold rules H1-H11 (B.4).
6. Soft signals S1-S11.
7. The review timeline for the owner page: inter-flap intervals, altitude samples every 6 ticks, and for each obstacle its visible tick and the tick Chikun committed to its route (§C.6, §D.5).

Infrastructure errors (RPC, verify unavailable) return `error`. The row stays `pending`, is retried with backoff, and is **never** flagged. After 6 consecutive errors the week is marked for attention (`last_error`) but still not flagged, because the finalize check requires clearance anyway.

**Screening order and flood resistance.** Each run screens, per week: first the rows currently on chain, by `chain_rank`; then keeper-selected rows; then displaced public rows. Up to 5 screens per week per run within the budget. A burst of self-displacing public submissions therefore cannot delay the screening of the real on-chain leader.

**Send protocol** (`server/jackpot/keeper.mjs`) copies the reference protocol of `createRelayer().submit` (`relayer.mjs:389-554`) against `jackpot_actions`. `submit` itself is hard-wired to `verified_sessions`.

0. **Pre-send idempotency and authority read:**
   - submit → `candidatesOf(w)` contains the session, or `checkEligibility` says `ALREADY_CANDIDATE`;
   - clear/flag → `reviewOf(session)` is already the target → `confirmed` with `already-done`; **`adminReviewed(session)` is true, or `reviewOf` is `Disqualified` → `skipped` with `review-locked`**. An admin decision is terminal for the keeper; a stale screen, a re-signed dropped transaction or a `rescreen` never overrides it;
   - finalize → `weekState(w).status != Open`.
   - If already done, the action becomes `confirmed` with `already-done`, and nothing is sent.
1. **Lease:** `ensureLeaseRow`, `acquireLease(db, { relayer: keeperAddress, holder, leaseMs: 40_000 })`, then `releaseLease` in `finally` (all exported from `relayer.mjs:53-81`). It is the keeper's own row (J9).
2. `estimateGas` × 1.25.
3. **Fees:** the same fields as player transactions, `maxFeePerGas = max(10 × latest base fee, 5 gwei)` with a 0 tip (`apps/portal/src/liteforge-fees.mjs`; LiteForge charges only the base fee).
   - `gasLimit × maxFee > JACKPOT_MAX_TX_FEE_WEI` → wait code `fee-too-high`.
   - The balance is below `gasLimit × maxFee` → wait code `keeper-underfunded`.
4. **Nonce** = `max(pending, lease.next_nonce)`, with gap guard 8.
5. Sign locally. `txHash = keccak256(raw)`. CAS `pending|signed → submitted` with `tx_hash`/`tx_nonce` **before** broadcasting. Check the remaining lease before and after the CAS.
6. **Broadcast.** A nonce error retries inside the lease. An ambiguous transport failure keeps the hash as broadcast.
7. Release the lease with `nextNonce`, then wait up to 15 s for the receipt.
8. **Receipt handling:**
   - The receipt shows success → `confirmed`.
   - It reverts → decode (`decodeRevertReason`, `server/settle/errors.mjs:97`) and classify with `JACKPOT_REVERTS` (A.15), falling back to `classifyRelayError` for infrastructure.
   - Missing for more than 180 s after `submitted_at` → read chain state. If it shows done → `confirmed`; otherwise the transaction was dropped: back to `signed`, and `next_nonce` resets under the lease. **Step 0 runs again before any re-send.**

**Test seams (J2 → J3 interface, test-only, documented in the module headers):**
- `deps.jackpotDeployment` (C.1);
- `deps.jackpotSelect(rows) → rows`, an injectable filter over the selection result (rehearsal R2 simulates keeper censorship with it);
- `deps.keeperFault(stage)`, called at `'after-cas'`, `'after-broadcast'` and `'before-receipt'`; a test makes it throw to simulate a killed cron (rehearsal R10);
- all three default to no-ops and are never read from env.

**Retries** copy `failureTransition` (`server/settle/store.mjs:267-304`):
- `wait`: `min(60 s·2^n, 15 min)`; it never dead-letters on its own.
- `deterministic`: `min(30 s·2^n, 30 min)`, `dead` after 3 attempts.

**Codes.** `server/jackpot/errors.mjs` has its own allowlist (`allowlistedJackpotCode`). The same codes are added to `CRON_ERROR_CODES`:

```
jackpot-not-configured, jackpot-paused, jackpot-address-mismatch, keeper-underfunded, fee-too-high,
already-done, skipped, not-eligible, window-closed, settled-late, payout-not-due, leader-not-cleared,
week-held, review-locked, replay-mismatch, evidence-missing, chain-mismatch, verify-unavailable,
chain-read-failed, rpc-timeout, nonce-conflict, tx-dropped, unknown-season, non-stock-client,
ticket-invalid, ticket-missing, late-evidence, unknown-error
```

Log with `logSafeError`/`errorLogFields` (name, code and SQLSTATE only; never message text, which can embed the RPC URL).

**Health and status page:**
- `server/ops/health.mjs` gains:
  - `crons.weeklyJackpot`;
  - a `jackpot` part: `{ configured, keeperAddress, keeperBalanceWei, paused: { env, onChain }, uiHidden, awaitingAdmin, awaitingAdminOldestHours, claimPending, failed }`.
  - Its failure reports `null` plus `degraded`, never 500.
- `apps/portal/owner/status.mjs` gains:
  - `CRON_LABELS.weeklyJackpot`;
  - `staleCronSeconds.weeklyJackpot = 20 * 60`;
  - a warning when the keeper balance is under 0.05 zkLTC;
  - a warning when `paused.env` or `paused.onChain` is true (a skipped cron is recorded as a success, so this is the only signal);
  - a warning when any week is `awaiting-admin`, with a link to `/owner/jackpot.html`, escalating to an error after 7 days;
  - a warning when any week is `claim-pending` (a failed prize transfer; contact the winner before the 180-day recycle);
  - a warning when any week is `failed`.

**Seed tickets (rev. 2; promoted from v1.1).** `server/settle/seed.mjs` gains **one additive, best-effort call** after `issueSeedTicket` succeeds: `logSeedTicket(db, {...})` from `server/jackpot/ticket-log.mjs`, which inserts into `seed_ticket_log` (§C.2). It runs inside `try/catch`, logs failures with `logSafeError`, never delays or changes the response, and does nothing when the table does not exist yet. A test proves a database failure still returns 200 with the ticket. This is the only edit to `server/settle/**` the jackpot makes; it is reviewed as a settle-path change (§G).

### C.5 Public read API

**`GET /api/jackpot`** (`api/jackpot.mjs`, `maxDuration 10`):
- Query allowlist: `game` (only `chikun`, the default) and `history` (0-26, default 8). Anything else → 400 `invalid-query`.
- `Cache-Control: public, s-maxage=30, stale-while-revalidate=120`. No database rate limit: it is CDN-cached like `/api/leaderboard` (`api/leaderboard.mjs:14`). A response can therefore be up to about 150 s old; the client corrects for it (§D.2).
- Reads Neon only: the mirrors (including `jackpot_rules`), plus the provisional leader query. It makes no RPC call.
- `JACKPOT_UI_HIDDEN=true`, or an unconfigured or undeployed jackpot → `{ "ok": true, "live": false, "game": "chikun" }`.

```json
{
  "ok": true, "live": true, "game": "chikun", "chainId": 4441,
  "contract": "0x…", "explorer": "https://liteforge.explorer.caldera.xyz",
  "token": { "address": "0x…", "symbol": "tCHIKUN", "decimals": 18, "testnet": true },
  "serverTime": "2026-10-01T12:00:00.000Z",
  "indexedBlock": 54400000,
  "current": {
    "weekKey": "2026-W40", "weekIndex": 2961, "status": "open",
    "startsAt": "2026-09-28T00:00:00.000Z", "closesAt": "2026-10-05T00:00:00.000Z",
    "settleCutoffAt": "2026-10-05T06:00:00.000Z", "candidateUntil": "2026-10-05T12:00:00.000Z", "payoutAt": "2026-10-06T00:00:00.000Z",
    "rules": { "minPaidWei": "100000000000000000", "maxSurvivalSeconds": 3599, "minFundWei": "100000000000000000000", "adminClearOnly": false },
    "pot": { "fundedWei": "10000000000000000000000", "carriedInWei": "0", "totalWei": "10000000000000000000000",
             "prizeCapWei": null, "prizeWei": "10000000000000000000000", "carryOverWei": "0", "funded": true },
    "leader": { "score": 48213, "provisional": true, "screened": false }
  },
  "previous": {
    "weekKey": "2026-W39", "status": "review", "payoutAt": "…", "token": { "symbol": "tCHIKUN", "decimals": 18, "testnet": true }, "pot": { "…": "…" },
    "candidates": [ { "rank": 1, "walletShort": "0x…", "displayName": null, "score": 51022, "review": "cleared", "replay": "/api/jackpot/replay?session=0x…" } ],
    "winner": null, "prizeWei": null, "unclaimedWei": "0", "finalizeTx": null
  },
  "history": [ { "weekKey": "2026-W38", "startsAt": "…", "closesAt": "…", "status": "paid",
                 "token": { "symbol": "tCHIKUN", "decimals": 18, "testnet": true }, "contract": "0x…",
                 "winner": { "walletShort": "…", "wallet": "0x…", "displayName": "…" },
                 "score": 50110, "prizeWei": "…", "unclaimedWei": "0", "finalizeTx": "0x…", "replay": "/api/jackpot/replay?session=0x…", "rolledTo": null } ],
  "rulesUrl": "/jackpot/chikun"
}
```

- **Pot fields (rev. 2).** `prizeWei = min(totalWei, prizeCapWei)` when a cap is set, else `totalWei`; `carryOverWei = totalWei − prizeWei`; `funded = totalWei ≥ rules.minFundWei`. Surfaces display `prizeWei` (J13).
- **Leader.** `current.leader` comes from the selection query for the open week, with no cutoff and the code checks (§C.4). It is provisional and `null` if nothing is eligible. For the **open** week it carries only the score (no wallet or name), because the run has not been screened and a solver's name must not be advertised all week (Appendix K, F9). `screened` is true only once the keeper has screened that session (after the close).
- **Status values** in `previous` and `history`: `open | review | awaiting-admin | paid | claim-pending | rolled | unfunded`. `claim-pending` carries `unclaimedWei > 0`: the prize transfer failed and the winner must claim (§D.3).
- **Token per week.** Every `previous` and `history` row carries its own `token` and `contract` from `jackpot_weeks`, never the current module, so a tCHIKUN win is never shown as $CHIKUN after a token swap.
- **Names.** `displayName` follows `publicDisplay` (`server/neon/rows.mjs:108`): hidden wallets show only `walletShort`.
- **Review values in public.** `review` is `cleared | in-review | disqualified` (with `flagged` mapped to `in-review`). Reasons are shown only for disqualified rows, as the coarse code.
- **Amounts** are decimal wei strings from the mirrors. The client formats them with `token.decimals`.

**`GET /api/jackpot/replay?session=0x…`** (`api/jackpot-replay.mjs`):
- Serves `{ format:'chikun-replay-file-v1', game:'chikun', evidence }`, importable by `importChikunReplay` (`apps/chikun/src/replay-file.mjs`).
- Only for sessions that are rows of `jackpot_candidates` of a week with `now ≥ closes_at`. Otherwise 404 `not-available`.
- `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`.

**Rewrites** (in `vercel.json`, by the server slice):
- `/api/jackpot/replay` → `/api/jackpot-replay`
- `/api/jackpot/review` → `/api/jackpot-review`
- `/jackpot/chikun` → `/jackpot/chikun.html`

### C.6 Owner API

- **`GET /api/jackpot/review?week=YYYY-Www`** (`api/jackpot-review.mjs`, `{ maxDuration: 30, memory: 1024, includeFiles: 'apps/chikun/assets/obstacle-shapes.json' }`):
  - `bearerAuthHook` (`server/auth/bearer.mjs`), then the session wallet must equal the **live on-chain `admin()`** of the instance (one `eth_call`, cached in memory for 60 s), and also `JACKPOT_ADMIN_WALLET` when that env is set → otherwise 403 `not-admin`. After an emergency `forceAdmin`, the old admin loses access within a minute, without a redeploy;
  - `Cache-Control: no-store`.
- It returns every candidate of the week (listed, displaced and disqualified) with:
  - `features` and hold codes (H1-H11) with the rule text;
  - soft signals S1-S11, including `evidenceDelaySeconds`, seed provenance and the cross-wallet funding result;
  - integrity results;
  - on-chain review state, `adminReviewed` and `wasListed`;
  - keeper action states;
  - explorer links for the wallet;
  - the wallet's last 20 Chikun Ranked runs (score, survival, week);
  - **`timeline`**, the server-computed series of §C.4 screen step 7 (intervals, altitude samples, obstacle visible ticks, route-commit ticks, and whether each fast pair changed the trajectory). The owner page draws it without loading the Chikun runtime, which cannot load unbundled (`chikun-obstacles.mjs:1` imports JSON from outside the web root).
- It also returns **`nextEligible`**: the next 10 selection-query rows for the week that are not listed, with their screen state, for `adminSubmit` from the owner page.
- **There are no owner write endpoints.** Every decision is an on-chain transaction from the admin wallet on the owner page. Neon only mirrors it.
- **`scripts/jackpot-ops.mjs`** (Neon; dry run by default; the `moderate-profile.mjs` pattern; refuses while the schema is behind):
  - `status`;
  - `requeue --week <key>` (`--apply --confirm REQUEUE_JACKPOT`), which moves `dead` actions back to `pending`;
  - `rescreen --session <id>` (never creates a clear or flag action for an admin-reviewed session);
  - `prune-tickets --older-than 60d` (`--apply --confirm PRUNE_TICKET_LOG`).

### C.7 Profile and share additions (server slice)

- **Profile.** `readPublicProfile` (`server/neon/queries.mjs:184-281`) gains `jackpot: { wins: [{ weekKey, startsAt, closesAt, prizeWei, unclaimedWei, status, token: { symbol, decimals, testnet }, contract, score, sessionId, finalizeTx }] }` from `jackpot_weeks WHERE winner = $wallet AND status IN ('paid','claim-pending') AND prize_wei::numeric > 0`, with the token taken **from the week row**. It is always present (possibly empty), so the shape is stable.
- **Share.** The share page and card (`server/share/render-page.mjs`, `render-card.mjs`) show a "Weekly Jackpot Champion · Sep 28 – Oct 4, 2026" badge when the shared session is the `winning_session` of a week with `prize_wei > 0` and status `paid` or `claim-pending`.
  - `cardRevision` (`queries.mjs:284-287`) includes the champion flag, so cached cards refresh.
  - A volatile "leader" status is **never** rendered on cached share assets.

### C.8 Calibration tooling (server slice)

`scripts/chikun-plausibility-calibrate.mjs` implements the B.4 protocol (named populations) and writes the QA receipt:
- `--human-dir <dir>` (set (c));
- `--from-neon` (read-only; `NEON_DATABASE_URL` from the environment, never printed; wallets dropped) with `--vouched <file>`; unvouched rows are reported separately and never enter a gate denominator;
- `--bots N`;
- `--probe` (reproduces the B.4 probe table: bot models, reflex bots, pilots, solver, humanised solver, widened-view pilot) and `--seed-variance` (the fixed-seed pass);
- `--out <path>`.

`scripts/lib/chikun-evasion-pilots.mjs` commits the humanised solver and the widened-view pilot (set (b)). A test runs the tool on the committed bot fixtures (`tests/fixtures/chikun-v6-replays.json`) plus short pilot runs (3-minute cap), asserts the H4-H6 separation shown in B.4 for set (a), and asserts that set (b) is **reported** (a miss is expected, not a failure).

---

## D. UI

### D.1 Flag, configuration and honesty rules

- **`apps/portal/src/jackpot-config.mjs`** (pure; **no imports**; no `window` or `process`):
  - `export const JACKPOT_LIVE = false;` is a literal the build and tests read;
  - `JACKPOT_GAMES = ['chikun']` and `JACKPOT_RULES_PATH = '/jackpot/chikun'`;
  - it does **not** re-export `LITVM_JACKPOT`. esbuild keeps the frozen generated object (it cannot prove it pure) in a shared chunk that the entries import statically, about 550 B once deployed, and `if (JACKPOT_LIVE)` is not constant-folded across modules. Only the lazy jackpot chunks and the owner page import `generated/litvm-jackpot.mjs`;
  - **invariant test** (imports both): `JACKPOT_LIVE ⇒ SETTLEMENT_LIVE && LITVM_JACKPOT.status === 'deployed'`.
- While `JACKPOT_LIVE` is false:
  - no surface fetches `/api/jackpot`;
  - no jackpot copy is rendered, except the soft-launch honesty copy of §D.6;
  - the child's existing tease, `CHIKUN_REWARDS_TEASE = 'High-score rewards coming soon'` (pinned by `tests/chikun-regions.test.mjs:145`), stays exactly as it is.
- **Never claim an unfunded or unpayable prize:**
  - a surface shows an amount only if `api.live === true` and `current.pot.funded === true` (the pot reaches the week's `minFundWei`);
  - the amount shown is `current.pot.prizeWei`, what the winner can actually receive this week. When `carryOverWei > 0`, surfaces with room (Scores, rules page, mode select) add "up to {cap}; the rest rolls over";
  - otherwise it shows "No jackpot funded this week" (Scores and rules page only) or nothing (every other surface);
  - on fetch failure or timeout (4 s), it shows nothing;
  - no static HTML ever contains an amount.
- **Testnet honesty.** Every amount carries the token symbol of **its own week** (history rows carry their own token). The first mention on each surface adds "(testnet token, no value)" while `token.testnet`.
- **Leader wording.** It is always "provisional" or "pending review" until the week is `paid`. For the open week, surfaces show the leading **score** only, never a name or wallet (the run is unscreened).
- **Dates.** Users never see ISO week keys. Weeks are shown as local date ranges ("Sep 28 – Oct 4"), with the close time in the viewer's local zone next to UTC ("closes Sun 8:00 PM EDT · Mon 00:00 UTC"), through `Intl.DateTimeFormat` in the lazy modules.

### D.2 Shared client modules (`apps/portal/src/jackpot/`)

- **`jackpot-client.mjs`:**
  - `fetchJackpot({ fetchImpl, game, timeoutMs })` with an in-memory 30 s cache;
  - `parseJackpot(json)`, which validates the §C.5 shape strictly and returns `null` when it is invalid;
  - `formatTokenAmount(wei, decimals)` using BigInt, never floats;
  - `serverClock(response, nowMs)`: the skew is computed from `serverTime` **plus the response's `Age` header** (or `Date` when `Age` is absent), and applied only when it exceeds 5 s. A CDN-cached response can be about 150 s old, so the raw `serverTime` would make "closes in" run up to about 3 minutes late;
  - `phaseOf(current, correctedNowMs)`: derives `open`/`closed` from `closesAt` **on the client**, never from the cached `current.status`;
  - `countdownParts(targetIso, correctedNowMs)`, shared with the Scores board header's "resets in" (`leaderboard-view.mjs:53` `formatResetCountdown` takes the corrected clock when the jackpot header is on screen), so the two countdowns on one page never disagree.
  - Pure, with injected fetch and clock.
- **`jackpot-view.mjs`:** small DOM helpers (`el`/`appendText` style; no `.innerHTML`).
- **`apps/portal/src/styles/jackpot.css`:** loaded lazily through a `link[data-jackpot-css]`, as `ranked-results.mjs:46-50` does. Retro arcade styling: neon-bordered "coin-slot" marquee, pixel font, gold coin glyph.

### D.3 Placements (all lazy; all behind `JACKPOT_LIVE`)

| Surface | Trigger | Content | Files (C = create, E = edit) | Byte budget |
| --- | --- | --- | --- | --- |
| Chikun mode select (the SPA; also covers the `/games/chikun` prerender, which boots the SPA) | Mode select renders with `gameId==='chikun'` | Marquee: "WEEKLY JACKPOT · {prize} {symbol} · closes in 2d 4h · top score {score} (provisional) · Rules" | C `jackpot/chikun-jackpot-panel.mjs`; E `routes/official-play-routes.mjs` (a one-line loader in the Ranked copy application) | eager ≤ 150 B; chunk ≤ 5 KB |
| Chikun cabinet (child) start screen, Ranked | Ranked `portal:init` and `JACKPOT_LIVE` | Replaces the tease line with "Weekly Jackpot: {prize} {symbol} · closes in …" **and the detail line** with "Top verified Ranked score of the week wins. See the rules." Live but unfunded: "Weekly Jackpot: no prize funded this week" with the same detail. (The current detail, "First to a set Ranked score, plus the top Ranked score of the week, month and year.", would promise prizes that do not exist.) The child fetches `/api/jackpot?game=chikun` itself (same origin, CSP `connect-src 'self'`). No bridge protocol change. | E `apps/chikun/src/main.mjs` (`renderModeTease`); E `apps/chikun/src/presentation.mjs` (an additive `buildChikunJackpotTease(api)`; `buildChikunModeTease` unchanged) | child growth ≤ 1,500 B |
| Chikun child replay deep link | `/chikun/index.html?replay=/api/jackpot/replay?session=0x…` (strict regex, same origin) | Imports the replay into the existing viewer | E `apps/chikun/src/main.mjs` | counted in the 1,500 B above |
| **Chikun child stock view (anti-cheat; not flag-gated)** | Always | `buildChikunViewport` caps the landscape logical width at 1,280 (a wider CSS box letterboxes); the draw loop skips forks with `x > view.left + view.width + 40`. A CSS-widened frame shows sky, not the course (§B.4). Portrait is unchanged. | E `apps/chikun/src/viewport.mjs`, `apps/chikun/src/main.mjs` (draw loop) | counted in the 1,500 B above |
| Ranked entry modal (Chikun only) | `requestRankedEntry` for `chikun` | A hidden row `#rankedEntryJackpot`: "This week's jackpot · {prize} {symbol} · Entries don't fund the prize · Rules ↗". The Rules link opens in a new tab (`target="_blank" rel="noopener"`), so a click during a pending wallet confirmation cannot orphan a paid entry. The row hides when the quoted total is below `current.rules.minPaidWei` or after `closesAt` (corrected clock); in the last 5 minutes before the close it reads "Runs paid after 00:00 UTC count toward next week". It never blocks or delays payment. | E `apps/portal/index.html` (one hidden row in `.ranked-entry-rows`); E `main.js` (loader in `requestRankedEntry`); C `jackpot/jackpot-entry-line.mjs` | eager ≤ 150 B; chunk ≤ 3 KB |
| Results screen | `openRankedResults` for Chikun, after the run's result loads | Based on the **jackpot** leader, never the board rank (the board includes staff, over-cap, late and chain-index rows): if the run is jackpot-eligible (survival ≤ the week's cap, paid ≥ `minPaidWei`) and its score is above `current.leader.score`, "You'd lead this week's jackpot race (pending review)"; if eligible and below, "{n} points behind the jackpot leader (provisional)"; otherwise nothing. The leader may be up to 150 s stale, so a new record always compares against the run's own score first. Share label **"Jackpot lead (pending)"** (22 characters, passed as the existing `standingLabel`; **`share-links.mjs` is not edited**). | E `ranked-results.mjs` (nested lazy import); E `ranked-results-model.mjs` (the `standingLabel` override, `:165`, `:286`); C `jackpot/jackpot-results-line.mjs` | results chunk ≤ +300 B; new chunk ≤ 3 KB |
| Scores page, Chikun · Weekly | Hosted view, `gameId==='chikun'` and the weekly period | Header: prize, countdown (shared helper), provisional top score, last winner; a "Past winners" list (date range, name, score, prize with its own token, transaction link, "Watch" replay link, "Claim pending" when `unclaimedWei > 0`); a note that the jackpot leader can differ from board #1 (eligibility; link to the rules) | E `routes/hosted-leaderboard-view.mjs` (nested lazy); C `jackpot/jackpot-board-header.mjs` | view chunk ≤ +200 B; new chunk ≤ 6 KB |
| Profile | Hosted profile with `jackpot.wins.length > 0` | "Jackpot Champion" section: date range, prize (its own token), score, transaction. For a `claim-pending` win viewed by its connected owner: a **Claim** button that calls `claim(week, to)` with `to` defaulting to the connected wallet and an editable address field, plus the 180-day notice | E `routes/hosted-profile-view.mjs`; C `jackpot/jackpot-profile-wins.mjs` | ≤ +200 B; chunk ≤ 4 KB |
| Home page promo | Home route, flag live, `pot.funded` | A card in the scores section: "This week's Chikun Jackpot: {prize} {symbol} → Play Ranked" | E `apps/portal/index.html` (a hidden `<section id="jackpotPromo" hidden>`); E `main.js` (loader); C `jackpot/jackpot-home-promo.mjs` | eager ≤ 150 B; chunk ≤ 3 KB |
| Share | Results share text; server share page and card | Client: "Jackpot lead (pending)" label. Server (§C.7): the champion badge for paid winners with a prize. | see above | 0 B in `share-links.mjs` |
| Rules page | `/jackpot/chikun` | §D.4 | C `apps/portal/jackpot/chikun.html`, `apps/portal/jackpot/chikun-rules.mjs` | static page + module ≤ 10 KB |
| Owner review page | `/owner/jackpot.html` | §D.5 | C `apps/portal/owner/jackpot.html`, `jackpot.mjs`, `jackpot-review-model.mjs` | not in any bundle |

**Totals** (measured on the base after polish-2, with a **deployed-shaped** fixture `litvm-jackpot.mjs`, because the committed undeployed module understates the shared chunk):
- `dist/main.js` grows by ≤ 600 B;
- the HMH child by 0 B;
- the STACKED entry by 0 B (`share-links.mjs` untouched);
- the Chikun child by ≤ 1,500 B (including the stock-view cull).

Each slice records its measured deltas in its final commit message (contract §11 rule 5).

### D.4 Rules page (`/jackpot/chikun`)

- **Generation.** `scripts/build-portal-pages.mjs` builds it from `portal-content.mjs` (`jackpotRulesCopy(flags)`) through `copy:` blocks, and writes it with the other generated pages.
- **Indexing.** While `JACKPOT_LIVE` is false it carries `<meta name="robots" content="noindex">` and the soft-launch banner (§D.6), and it is not in `sitemap.xml`. When live it joins the sitemap and `llms.txt`.
- **Name.** "Weekly Jackpot" is the working name. OJ3 asks the lawyer whether a neutral name ("Weekly High Score Prize") is safer; the copy uses one constant, so a rename is a one-line change.
- **Sections** (each wrapped in a `<!-- copy:jackpot-rules-<id> -->` marker):
  1. `what` — What it is, and who sponsors it (Lester's Arcade and Louie, Chikun's original developer, as co-funders) with a contact.
  2. `eligible` — Who can win:
     - Ranked Chikun runs of that week, by the time the entry was paid, with a paid entry of at least the Ranked flat fee, in the week's season;
     - runs that reached the 60-minute limit are **not** eligible (survival cap 3,599 s);
     - one person, one wallet: a person found using several wallets is disqualified on all of them;
     - staff, developers, prize funders and their households are excluded, as people, not only as wallets; test and blocked wallets are excluded;
     - entry fees do not fund the prize.
  3. `winner` — How the winner is chosen: highest verified score, then earliest on-chain publish time, then session id.
  4. `timeline` — the close at Monday 00:00 UTC (shown also in the viewer's local time); the 6 h publish cutoff; the 12 h challenge window; the 24 h payout; possible admin extension of up to 72 h, which will be announced.
  5. `verification` — server replay, the on-chain record, automated checks, human review, and what "in review" means. **The automated checks catch only unsophisticated automation; human review decides.** Runs that finish long after they were paid for are reviewed.
  6. `disqualification` — the reason categories, the organiser's discretion to disqualify runs it believes were not played by a human in real time, that decisions are published on chain, and that decisions are final (disputes to the contact within 7 days; the organiser's answer is final).
  7. `challenges` — anyone can put an eligible, better run on chain before the window closes.
  8. `rollover` — Rollover and caps: an unwon pot rolls to the next week without a time limit; the part above a prize cap rolls over.
  9. `funding` — who funds; the contract and token addresses with explorer links; "fund only through the contract"; the rules of a pre-funded future week can change before it starts.
  10. `claims` — **Unclaimed prizes:** a prize the token refuses to transfer can be claimed by the winner to another address; after 180 days an unclaimed prize returns to the prize pool.
  11. `end` — **End of the jackpot:** at least one week's notice; funders get back what they paid in for weeks after the end; an unwon final pot goes to the published contest wallet 30 days later.
  12. `published` — **What is published:** the winning and candidate wallets, display names (unless hidden), scores, downloadable replays of candidates after the close, and permanent on-chain decisions.
  13. `no-guarantee` — a week may have no prize, roll over, be held or be paused; the service is provided as is.
  14. `testnet` — tCHIKUN has no value and cannot be redeemed or exchanged through the arcade; testnet records are wiped at mainnet; real $CHIKUN prizes need a new contract, new rules and a legal review.
  15. `legal` — Taxes, eligibility by jurisdiction, and age: a **legal placeholder block**, `<!-- copy:jackpot-legal:start -->`, whose default text contains the token `LEGAL-REVIEW-PENDING`.
  16. `history` — loaded lazily from `/api/jackpot`.
- **Guard test:** when `JACKPOT_LIVE` is true, the built rules page must not contain `LEGAL-REVIEW-PENDING` **and must contain every section marker above**. The owner supplies reviewed text (OJ3) before the flip.

### D.5 Owner review and funding page (`/owner/jackpot.html`)

The page follows the conventions of `apps/portal/owner/confirm-dev-wallet.*`:
- noindex; one module script; no inline script (CSP);
- DOM built with `createElement`/`textContent`;
- plain `window.ethereum`;
- switch or add chain 4441;
- vendored `/vendor/ethers.min.js` for public reads;
- `liteForgeFeeOverrides` for writes.
- It never imports the Chikun runtime or `chikun-cabinet.mjs` (they cannot load unbundled; §C.6).

Owner pages are publicly served, so all authority is on chain.

1. **Gate.** Read `admin()`, `keeper()`, `operator()`, `paused()` and `operatorPaused()` from the contract. If the connected account ≠ `admin()`, the page is read-only apart from the Fund section and a winner's Claim.
2. **Sign-in.** SIWE through the existing `/api/session` flow, only to read `/api/jackpot/review`.
3. **Week view.**
   - Bounds and countdowns (local time and UTC), status, pot, prize, held/paused/extension, time waiting for the admin.
   - A candidate table: rank, wallet (explorer), score, survival, screen result, hold codes with plain-English text, soft signals, evidence delay, seed provenance, on-chain review state, `adminReviewed`.
   - **Next eligible:** the `nextEligible` rows from the review API, each with an "Add to list" (`adminSubmit`) button that is enabled only while the list has fewer than 5 rows.
4. **Per candidate:**
   - **Flap timeline**: an SVG drawn from the review API's server-computed `timeline` (intervals, altitude, and the look-ahead overlay: each obstacle's visible tick against the tick Chikun committed to its route; fast pairs marked by whether they changed the trajectory);
   - "Watch in cabinet" (opens `/chikun/index.html?replay=…`);
   - "Download replay".
5. **Actions (admin wallet):**
   - Clear; Flag (reason);
   - Disqualify session, or session + wallet for the week, with a reason select (including `multi-wallet`);
   - Reinstate;
   - Add to list (`adminSubmit`);
   - Block or unblock a wallet globally (reason);
   - Hold or release the week;
   - Extend the week (hours, with the remaining cap shown);
   - Pause or unpause (the admin flag; the operator flag is shown read-only);
   - Finalize (any wallet, once due);
   - Each action shows `checkEligibility` or the state first, then the transaction hash with an explorer link, and refreshes.
   - A link to the review rubric (§E) sits next to Clear and Disqualify.
6. **Fund (any wallet):**
   - the token balance and allowance;
   - `approve` (exact amount, never unlimited);
   - `fund(week, amount)` for the current week or a chosen future week (≤ 8 ahead; the page recommends at most 2), with the week's `minFundWei` shown;
   - the resulting pot and prize.
   - Louie funds from here with his own wallet.
   - After a scheduled end: "Refund my contributions" (`refundAfterEnd`) per week.
7. **Claim (the connected winner of a `claim-pending` week):** `claim(week, to)`.
8. **Pure model.** `jackpot-review-model.mjs` (week math, action call encoding, hold-code text, timeline-to-SVG geometry) is tested with a fake `window.ethereum` backed by the local chain, as `tests/owner-confirm-page.test.mjs` does.

### D.6 Copy changes (`portal-content.mjs`)

- `portalCopyFor` gains `chikunJackpotLive`. `PORTAL_FLAGS` gains `chikunJackpotLive: JACKPOT_LIVE === true`.
- `resolvePortalFlags` (`scripts/build-portal-pages.mjs:12-24`) accepts the third boolean, optional and defaulting to false. `PORTAL_FLAG_OVERRIDES` gains a `jackpot` override for tests and the flip dry run.
- **Soft-launch honesty (rev. 2; flag false).** During the soft-launch week (E9) the production keeper pays the week's top eligible public wallet, so "there are no prizes" would be false. The flag-false copy therefore changes, once, in the jackpot-ui slice:
  - `noValue` becomes "Testnet zkLTC has no value. Any test prizes are paid in testnet tokens that also have no value.";
  - the preview rules-page banner reads "Soft launch: test prizes in tCHIKUN, a token with no value, may be paid to the week's top eligible Ranked Chikun player. Every payout is reviewed by hand.";
  - the soft-launch epoch runs with `adminClearOnly = true` (§A.5), and **disqualification is never used to steer the soft-launch winner**.
  The pinned tests for `noValue` (`tests/portal-trust-copy.test.mjs` and the generated pages) are updated in the same commit and named in it.
- **When live:**
  - `noValue` becomes "Testnet zkLTC has no value. The only prize is the Chikun's Escape Weekly Jackpot, paid in {symbol}, a testnet token with no value; see the rules.";
  - the FAQ gains "Is there a jackpot?";
  - `trustStatus` and `llmsScope` gain one sentence each;
  - the trust page's `serverRecords` list (`portal-content.mjs:103-111`) gains the jackpot review data, the published candidate replays and the seed-ticket log (this item ships with the slice, flag-independent, because the log is written from E6 on).
- Apart from the named soft-launch and `serverRecords` lines, every flag-false generated file is byte-identical to the post-polish-2 base. The flip commit (§E step E10) changes the pinned literals listed by the rehearsal's flip checklist, including `tests/chikun-regions.test.mjs:146` if the live detail copy is asserted there.

---

## E. Deployment and runbook

⚠ marks a step where the owner approves in the moment, in "ask before each action" mode. No slice performs any ⚠ step (contract §11 rule 9).

| Step | What | Who |
| --- | --- | --- |
| E0 | Prerequisites:<br>- polish-2 merged (and version-column, if it is ahead in the queue), then all four jackpot slices merged and the integration gate green (exactly 51);<br>- OJ1 (this design) approved, including the residual-recipient multisig and the block list;<br>- OJ2 calibration receipt present with the gate met;<br>- OJ3 legal note acknowledged and rules-page legal text supplied (needed before E10);<br>- `node scripts/jackpot-actions.mjs status` (read-only) works against the undeployed module. | orchestrator + owner |
| E1 | Local rehearsal: `node scripts/rehearse-jackpot-week.mjs` (in-process chain, time travel, full cycles, R1-R20, §G jackpot-rehearsal). Commit `docs/qa/jackpot-rehearsal-<date>.json`. | session |
| E2 ⚠ | Keeper key: `node scripts/jackpot-keeper-key.mjs --out C:/Users/just_/lesters-arcade-vault/keys/jackpot-keeper.json`. It prints only the address. The owner sends 0.1 testnet zkLTC to that address (MetaMask: max base fee 5 gwei, priority 0). | owner |
| E3 | Dry run: `node scripts/deploy-weekly-jackpot.mjs --game chikun --first-week next --admin 0x07cec6Fc49CAf6528F2f2F796042629cd3f48B26 --keeper <keeper> --residual <contest multisig> --rules launch`. It prints the manifest (predicted addresses from the operator's pending nonce, constructor args, gas). The launch rules make the first epoch `adminClearOnly = true`. The dry run also performs a **read-only `eth_call` of both creation codes** against LiteForge, proving the bytecode executes on LitVM. | session |
| E4 ⚠ | Broadcast: `… --broadcast --confirm DEPLOY_WEEKLY_JACKPOT_4441 --key-file <vault> --key-field keys.operator`. Commit `contracts/deployment-record.jackpot.json` and the regenerated `litvm-jackpot.mjs` (`status:'deployed'`). `JACKPOT_LIVE` stays false. Then schedule the flip-week epoch with `adminClearOnly = false` (`schedule-rules`) only once OJ2 is met. | owner approves; session runs |
| E5 ⚠ | Admin setup from `/owner/jackpot.html`, served locally (`python -m http.server 8791 --directory apps/portal`) or from production after E6. Block on chain (`setBlocked`, with the reason in brackets):<br>- the test wallet `0x8841ae6244dba71f620de450e71b0ef7e0cce824` (`test-wallet`);<br>- the verifier signer `0x4d637a6C…20C7` and the relayer `0x494aF36e…EAf6` (`staff`);<br>- the residual recipient / contest multisig (`staff`);<br>- every prize funder, Louie's wallet included (`funder`);<br>- any other staff or test wallets the owner names (`staff`).<br>The admin, operator, dev/vault wallet `0x07ce…8B26` and keeper are `staffEver` from the constructor. Confirm that `admin()` reads back as the owner. | owner (browser wallet) |
| E6 ⚠ | Vercel env with `node scripts/jackpot-secrets.mjs` (a dry run lists names only), then `--apply --confirm SET_JACKPOT_SECRETS`. It pipes `JACKPOT_KEEPER_PRIVATE_KEY` from the vault file and `JACKPOT_CONTRACT_ADDRESS` from the module over stdin. The operator key is never placed in Vercel. Then a release with the cron (next version, cache marker bump), `npm run vercel:build`, deploy, promote. **The release must be live before `firstWeek` starts**, so every eligible ticket is in `seed_ticket_log`. | owner approves |
| E7 | Migration and cron checks:<br>- `node scripts/live-cron.mjs --site https://lestersarcade.io --path /api/cron/index-chain --secret-file <vault cron-secret>` → the jackpot's `schemaVersion`;<br>- the same for `/api/cron/weekly-jackpot` → `ok`, and record the measured replay time for the §C.4 budget;<br>- `/api/health` shows the cron, the keeper balance and `paused: { env:false, onChain:false }`;<br>- `node scripts/jackpot-live-dry-run.mjs --site https://lestersarcade.io` (read-only checks, including the J17 coupling checks). | session |
| E8 ⚠ | Mint tCHIKUN to the owner (and Louie): `node scripts/jackpot-actions.mjs mint-test --to <addr> --amount 1000000 --broadcast --confirm MINT_TCHIKUN_4441 …`. The owner funds the soft-launch week (for example 10,000 tCHIKUN, ≥ `minFundWei`) from the owner page. | owner |
| E9 | Soft-launch week, still flag false, with the soft-launch copy of §D.6 live and `adminClearOnly = true`: real runs by at least one non-staff tester. Watch selection at C + 2 h, screening, submit, the admin's clear at the review, and payout or rollover at C + 24 h, with `jackpot-live-dry-run.mjs` at each phase. **Never disqualify to steer the winner**; the week's top eligible public player is paid if cleared under the rubric. Receipt: `docs/qa/jackpot-soft-launch-<date>.json`. | session + owner |
| E10 ⚠ | Flag flip:<br>- the checklist from the rehearsal (`docs/qa/jackpot-flag-flip-checklist.json`): set `JACKPOT_LIVE = true`, run `node scripts/build-portal-pages.mjs`, update exactly the listed pinned tests, and commit;<br>- **only if** `potOf(currentWeek).total ≥ rulesFor(currentWeek).minFundWei` on chain, the legal text is in place, every rules-page section marker is present, the OJ2 gate is met, and the J17 coupling checks pass;<br>- release (version bump, gate, deploy, promote);<br>- live smokes of the D.3 surfaces. | owner approves |
| E11 | Weekly operations:<br>- funders fund the next week before Monday, **at most one or two weeks ahead** (the contract allows 8), because future-week rules can still change;<br>- **Ranked setting changes (J17):** any change to the entry fee, the reserve, fees on/off, the Chikun season or runtime, `rankedEntry`, or the Chikun registration is scheduled for a Monday 00:00 UTC with a matching `schedule-rules`, and `jackpot-live-dry-run.mjs` runs before and after. A new game id or a repointed `rankedEntry` needs a new instance (§A.19);<br>- **review SLA:** the owner reviews any `awaiting-admin` week within 24 h (the status page warns) using the rubric below. If a week has waited 7 days, the documented default applies: the admin disqualifies the uncleared leader with reason `other` and a published note, and the pot rolls over;<br>- a `claim-pending` week: contact the winner through the arcade's channels well before the 180-day recycle;<br>- keep the keeper above 0.05 zkLTC. | owner |

**Admin review rubric** (committed in `docs/web3/weekly-jackpot-operations.md` by the server slice; linked from the owner page):
1. **Always check:** integrity results (replay, chain, `maxTicks`, seed provenance); every hold code; the look-ahead overlay and S8; the evidence delay (H9/S9); the wallet's history and previous flags; the cross-wallet funding result (S10); other candidate wallets with similar timing.
2. **Clear** only when integrity passes and every hold is explained by the evidence (for example a long run by a player with a history of long runs, fast pairs that never changed the trajectory, a documented pause).
3. **Disqualify** when integrity fails, when the look-ahead overlay shows route commitments before obstacles were visible on more than one obstacle, or when several wallets are shown to belong to one person (`multi-wallet`, all of them).
4. **Never** disqualify on H4 alone, on one soft signal alone, or on a gut feeling about a score.
5. **Videos and "proof" recordings are never evidence:** the replay renders exactly, so anyone can record one. Live verification, if wanted, is a fresh Ranked run on a new seed under observation.
6. Record the reason code on chain and a one-line note in the ops log.

**Emergency stops:**
1. **Stop payouts:** `pause` from the owner page (admin), or `node scripts/jackpot-actions.mjs operator-pause --broadcast --confirm PAUSE_JACKPOT_4441 …` (operator; the admin cannot lift it). Submissions, funding and claims continue.
2. **Stop one week:** `holdWeek` from the owner page.
3. **Stop the keeper:** set `JACKPOT_PAUSED=true` in production env and redeploy the current release. The status page shows it as paused.
4. **Keeper key leaked:** `jackpot-actions.mjs set-keeper <new>` (the old keeper stays `staffEver`), block the old keeper wallet, rotate the env, and check the week reviews it touched.
5. **Admin wallet compromised:** `operator-pause`, then `force-admin <new>` (one step; the compromised admin cannot contest it); the new admin reviews every decision the old one made since the compromise; then `operator-unpause`.
6. **Hide the UI:** set `JACKPOT_UI_HIDDEN=true` and redeploy the current release (surfaces disappear once the CDN cache expires, within about 150 s); a release with `JACKPOT_LIVE=false` follows if the hide is long-term. The contract and prizes are unaffected.
7. **New instance** (real $CHIKUN, a new Chikun game id, or a repointed `rankedEntry`): §A.19. `schedule-end` on the old instance, a new deployment through `deploy-weekly-jackpot.mjs --token <address> --first-week <after the old end> --retire-previous`, after the token acceptance checklist (A.11) and OJ3/OJ6 for real value; the keeper keeps servicing the old instance until its weeks are terminal; funders `refund-after-end`. On mainnet this is part of the fresh deployment set.

---

## F. Legal and compliance note for the owner (not legal advice)

1. **Paid entry + skill + prize.** A contest where players pay to enter and a prize of value goes to the best performer is regulated differently by country and by US state.
   - Many places allow true skill contests.
   - Some restrict or forbid paid-entry contests even when skill decides, or require registration or bonding.
   - Some treat any element of chance as gambling. Chikun's seeded courses and the rollover mechanics could be argued to add chance.
   - The Ranked entry fee (0.1 zkLTC split 85/15 plus the reserve) is consideration even though the prize is funded separately.
   - **The organiser receives 100% of each paid entry today:** Justin's wallet is both the Chikun developer wallet (85%) and the arcade vaults (15%). That sharpens the paid-entry analysis; a lawyer may ask for the prize sponsor and the entry recipient to be separated, or for a free alternative method of entry.
2. **The word "jackpot"** is gambling language. Skill-contest counsel and ad or social platforms (X promotion, Google and Meta crypto and gambling policies) often object to it. A neutral name such as "Weekly High Score Prize" is a lawyer-reviewable alternative (§D.4).
3. **A memecoin as the prize** adds questions:
   - the promotion of a token (avoid any claim of value or returns);
   - the token's own regulatory status;
   - **material-connection disclosure:** funders and staff who hold $CHIKUN and promote it through the contest may need to disclose that they hold it;
   - tax reporting for winners (prizes are generally income; US platforms may need winner tax information above thresholds);
   - sanctions screening of winning wallets. The design has no mechanism for it yet; for real value it would be a winner-verification step before `clear` under `adminClearOnly`.
4. **Privacy.** Publishing candidate wallets, names, scores and downloadable replays, and keeping the seed-ticket log, are privacy-notice items (§D.4 section `published`, §D.6 `serverRecords`).
5. **Age, residency and terms.** You will likely need age (18+) and residency eligibility terms, void-where-prohibited language, official rules and a privacy notice, plus a way to enforce them (for example geoblocking or winner verification) before real-value prizes.
6. **Recommendation:**
   - **Get a review by a lawyer who knows sweepstakes, contests and digital assets before any prize with real value** (real $CHIKUN, or anything exchangeable).
   - Until then, run only the tCHIKUN testnet jackpot, and keep it honest:
     - say plainly that tCHIKUN has no value;
     - never promise conversion to $CHIKUN;
     - never imply testnet wins carry over.
   - The rules page's legal block stays a visible placeholder until the owner provides reviewed text (the D.4 guard).
7. **Design levers a lawyer may ask for:**
   - `adminClearOnly` (every payout manually approved);
   - a prize cap;
   - an excluded-wallet list;
   - pausing;
   - a neutral name;
   - a new instance with different timing, or free alternative entry.
   All of these already exist in this design or are cheap to add in a new instance.

OJ3's checklist includes items 1-5 above.

---

### F.1 Draft legal block for the rules page (owner-requested, 2026-09-25; not legal advice)

The jackpot-ui slice uses this text for the `copy:jackpot-legal` block. It keeps the `LEGAL-REVIEW-PENDING` guard marker in an HTML comment beside the block until the owner confirms the text at E10.

> **Weekly Jackpot rules**
> - **Skill contest.** The eligible wallet with the highest verified Ranked Chikun's Escape score for the week (Monday 00:00 UTC to the next Monday 00:00 UTC) wins that week's funded prize, paid on chain after a 24-hour review.
> - **Entry.** Only Ranked runs count (0.012 testnet zkLTC per run). Free Mode is always free but is not eligible.
> - **Prizes.** A prize exists only when it is funded on chain; the amount shown is the funded amount. If no eligible run qualifies, the prize rolls over to the next week.
> - **Fair play.** Runs are replay-verified by the arcade server. Bots, scripts, exploits, shared or rented accounts, or any attempt to manipulate results lead to disqualification. Review decisions are final.
> - **Eligibility.** You must be 18 or older (or the age of majority where you live). Lester's Arcade staff and service wallets are not eligible. Void where prohibited; you are responsible for the laws, age limits and taxes that apply to you.
> - **Testnet.** During the LiteForge testnet, prizes are testnet tokens with no monetary value. Real $CHIKUN prizes will come with updated rules.
> - **Changes.** We may change, pause or end the Weekly Jackpot at any time; prizes already paid are unaffected.
> - Nothing here is financial advice. Memecoins are volatile.

## G. Slice plan

Briefs: `docs/handoffs/jackpot-slices-20260924/{jackpot-contracts,jackpot-server,jackpot-ui,jackpot-rehearsal}.md`.

| Wave | Slices | Depends on |
| --- | --- | --- |
| J0 | (not jackpot) **polish-2** merges; version-column merges if it is ahead in the queue | — |
| J1 | `jackpot-contracts` | the integration commit after J0 |
| J2 | `jackpot-server` and `jackpot-ui` in parallel. Merge the server first; the UI rebases before its final gate. **If version-column has not merged yet, it goes before J2** (it edits `server/neon/queries.mjs`, both hosted views and may take migration 3). | J1 merged (artifacts, the generated module, `local-jackpot.mjs`) |
| J3 | `jackpot-rehearsal` | J2 merged |
| — | Runbook §E, with owner approvals | J3 merged, OJ1-OJ3 |

**Merge rules.** Contract §10.4 applies, with these changes:
- worktrees are `C:/Users/just_/lesters-arcade-wt/<key>` on branch `fable/<key>`;
- `node_modules` is junctioned; never run `npm install`;
- commit per logical step, with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`;
- `npm run test:release` must show exactly 51, and slices never commit `docs/testing/hmh-reboot-test-retirement-gate.json`; the orchestrator regenerates it once per integration;
- generated portal pages are regenerated with `node scripts/build-portal-pages.mjs`, never hand-merged;
- **the curated source inventory** (`apps/portal/assets/generated/hmh-curated-level-kit/hmh-curated-level-kit-runtime.mjs`, checked by `tests/hmh-curated-level-kit-inventory.test.mjs`) is regenerated with `npm run assets:hmh:curated-level-kit-runtime` by every slice that adds an `apps/portal/src/**/*.mjs` (jackpot-contracts: `generated/litvm-jackpot.mjs`; jackpot-ui: `jackpot-config.mjs`, `jackpot/*.mjs`), and on a merge conflict the orchestrator regenerates it, never hand-merges;
- the one settle-path edit (`server/settle/seed.mjs`, §C.4 "Seed tickets") gets its own commit in jackpot-server, and the integration review reads it as a live Ranked change.

**`scripts/syntax-check.mjs` anchors** (insert new entries immediately after):

| Slice | Anchor line |
| --- | --- |
| jackpot-contracts | `'apps/portal/src/generated/litvm-addresses.mjs',` |
| jackpot-server | `'tests/moderate-profile.test.mjs',` |
| jackpot-ui | `'tests/ranked-results-model.test.mjs',` |
| jackpot-rehearsal | `'tests/nft-phase2-rehearsal.test.mjs',` |

**Shared files with one owner:**

| File | Owner |
| --- | --- |
| `vercel.json` | jackpot-server only (functions, cron, all three rewrites) |
| `server/chain/abis.mjs` | jackpot-server |
| `server/neon/queries.mjs`, `server/share/*` | jackpot-server |
| `server/settle/seed.mjs` (one additive call) | jackpot-server |
| `apps/portal/owner/status.mjs` | jackpot-server |
| `apps/portal/owner/jackpot.*` | jackpot-ui |
| `portal-content.mjs`, `build-portal-pages.mjs`, `index.html`, `main.js`, routes, `ranked-results*.mjs`, `apps/chikun/src/{main,viewport,presentation}.mjs` | jackpot-ui |
| `scripts/compile-contracts.mjs`, `contracts/**`, `scripts/lib/local-jackpot.mjs`, `apps/portal/src/generated/litvm-jackpot.mjs` | jackpot-contracts |
| `docs/web3/weekly-jackpot-operations.md` | created by jackpot-contracts; extended by server (env, cron, rubric) and rehearsal (commands), each in its own section |

**Test file names are exclusive per slice** (rev. 1's `tests/jackpot-*.test.mjs` glob overlapped):

| Slice | Test files |
| --- | --- |
| jackpot-contracts | `tests/weekly-jackpot-contract.test.mjs`, `tests/weekly-jackpot-lifecycle.test.mjs`, `tests/jackpot-deploy-tooling.test.mjs` |
| jackpot-server | `tests/jackpot-server-*.test.mjs` (exact names in the brief) |
| jackpot-ui | `tests/jackpot-ui-*.test.mjs`, `tests/owner-jackpot-page.test.mjs`, `tests/chikun-stock-view.test.mjs` |
| jackpot-rehearsal | `tests/jackpot-rehearsal.test.mjs`, `tests/jackpot-api-contract.test.mjs`, `tests/jackpot-live-dry-run.test.mjs` |

**J2 → J3 interfaces** (server): `readServerConfig(env, { deployment, jackpotDeployment })`, `deps.jackpotDeployment`, `deps.jackpotSelect`, `deps.keeperFault(stage)` (§C.1, §C.4). (UI): `parseJackpot`, `jackpot-review-model.mjs`.

**The API contract between server and UI** is §C.5. The UI builds against fixtures copied from it (`tests/fixtures/jackpot/*.json`). The rehearsal slice adds `tests/jackpot-api-contract.test.mjs`, which feeds the real handler's output into the UI's `parseJackpot`.

---

## H. Owner checkpoints and open questions

| Id | When | What |
| --- | --- | --- |
| OJ1 | before J1 starts (the slices can start on this revision) | Approve J1-J18, especially:<br>- the timeline (6 h / 12 h / 24 h) and the relist rule;<br>- cleared-only payouts and the review rubric;<br>- the keeper key;<br>- the block list: **Louie's wallet blocked as a funder** (recommended yes), verifier, relayer, contest wallet;<br>- the residual recipient: a **Justin + Louie multisig** that is neither the admin nor the operator (recommended);<br>- the soft-launch copy and `adminClearOnly` for the soft-launch week (§D.6);<br>- `minFundWei` (100 tCHIKUN on testnet) and funding at most 1-2 weeks ahead. |
| OJ2 | before E10 | Human calibration runs (B.4 set (c)): at least 40 from at least 5 people you know, with at least 15 runs of 8 minutes or more, screen-recorded |
| OJ3 | before E10; again before any real-value prize | The legal note (§F, items 1-5) and the reviewed text for the rules page's legal block; the public name ("Weekly Jackpot" or a neutral one) |
| OJ4 | E2-E10 | The ⚠ steps |
| OJ5 | before E8 | The prize schedule (tCHIKUN amounts per week), the cap policy, and `minFundWei` |
| OJ6 | when $CHIKUN launches | The token acceptance checklist (A.11, including memecoin transfer limits and exemptions), mainnet timing, and the **mandatory** real-value set: `adminClearOnly = true`, a prize cap, H11 on, personhood gating or winner verification, sanctions screening |
| OJ7 | whenever Louie's wallet is ready | How Louie receives Chikun's developer share. Recommended: off-chain forwarding until mainnet, and a dev-wallet update function (or a splitter) in the mainnet `GameRegistry`. Re-registering Chikun on testnet splits the board and ends this jackpot instance (§A.19). |

### H.1 Owner answers (Justin, 2026-09-25)

- **OJ1 approved** as designed, with these specifics:
  - **Can never win:** the owner/admin wallet `0x07cec6Fc49CAf6528F2f2F796042629cd3f48B26`, the operator `0x6Ac08Bed727A6951D755F0674f096E6A8AC06bfF` and the keeper wallet (plus the verifier, relayer and any wallet that ever held a role, per J-rules).
  - **Louie's wallet is not blocked** and not configured anywhere yet: the address is not known.
  - **Leftover / residual recipient:** deferred by the owner ("until we load it up first"). The tCHIKUN testnet instance uses the owner wallet above as its fixed recipient; the real $CHIKUN instance is a new deployment and decides its recipient then.
- **OJ2:** the owner is recruiting players to play Ranked and submit scores; the calibration set is collected from production evidence once enough human runs exist. `JACKPOT_LIVE` stays false until OJ2 is met.
- **OJ3:** the owner asked the orchestrator to draft the legal block, short and concise. The draft is in §F.1; it is not legal advice, and the owner confirms it (or supplies reviewed text) at E10.
- **OJ5:** the prize schedule is set when the owner and Louie fund a week.

**Open or UNVERIFIED:**
- LitVM `block.timestamp` semantics at the boundary.
- Osaka opcode support on LitVM (guarded by the opcode test and the E3 `eth_call`).
- Vercel cron firing precision (the design assumes at least once, and is idempotent).
- The re-replay time on a 1,024 MB Vercel function (E7 measures it).
- $CHIKUN's chain, decimals and transfer behaviour.
- The number of human evidence rows in production Neon.
- Whether seed shopping is a small edge (the seed variance pass decides).

## I. Future extensions (not in this phase)

- **Monthly and yearly jackpots.** These are not fixed-length periods. They need a new instance whose period function maps timestamps to month or year keys, which is simple to add as a variant contract.
- **"First to reach score X" bounty.** A separate contract. It reuses the same eligibility reads, with an immediate claim after review.
- **Proof-of-personhood eligibility rule** (B.5); a precondition for real value (OJ6).
- **Seed commit-reveal:** the server commits to a seed before payment and reveals it after `openSession`, removing seed shopping. It needs a versioned Ranked identity change, not a contract redeploy.
- **Jackpots for STACKED.** Replay-verified, so they are feasible with the same server screen pattern and a STACKED-specific feature set.

---

## K. Review disposition (revision 2)

Three reviews of revision 1 (2026-09-24): **X** = exploits (19 findings), **AC** = anti-cheat (12), **F** = feasibility, UX and copy (23). Every finding was checked against the code at `98e32740`; the evidence citations held in every case. There were no blockers. Verdicts: **Fixed** (the design and briefs now require the change), **Fixed (modified)** (the concern is addressed another way), **Accepted as residual** (documented, with a mitigation or an owner decision).

| Id | Severity | Finding (short) | Verdict | Where |
| --- | --- | --- | --- | --- |
| X1 | major | Top-5 eviction by five decoy wallets is permanent after C + 12 h | Fixed: `wasListed` re-list until `payoutAt − 2 h`; `adminSubmit` into a short list; keeper relist row; B.1 claim removed; R13 | J2, A.7, A.8, C.4, rehearsal R13 |
| X2 | major | `flag` has no state guard; a stale keeper flag overrides an admin clear or disqualification | Fixed: `adminReviewed` locks the keeper out; `flag` reverts on Disqualified for everyone; pre-send check skips admin-reviewed sessions; R17 | A.8, A.16 #6, C.4 step 0 |
| X3 | major | The operator cannot stop a compromised admin (unpause; contested two-step rotation) | Fixed: separate `operatorPaused` the admin cannot lift; one-step `forceAdmin`; `transferAdmin` locked while operator-paused; R18 | A.3, A.8, E stop 5 |
| X4 | major | 1-wei funding far ahead blocks `scheduleEnd`; dust satisfies "pot > 0" checks | Fixed: `lastFundedWeek` removed; `minFundWei` per call and as the "funded" threshold; fund-ahead 8 weeks; `refundAfterEnd`; R19 | A.4, A.5, A.6, A.10, C.4, D.1, E10 |
| X5 | major | Ranked fee/reserve/season/rankedEntry/registration changes silently break eligibility mid-week | Fixed: `minPaidWei` = flat fee 0.1; J17 Monday-boundary rule; live-checker coupling checks; entry-modal row hides below `minPaidWei`; new-instance rule for Louie's game id or a repoint; R20 | J17, A.5, A.19, D.3, E11, rehearsal AC5 |
| X6 | major | A failed prize transfer is unrecoverable in practice; memecoin limits missing from the checklist | Fixed: `claim-pending` status, `unclaimedWei`, Claim button, status alert, rules-page disclosure, checklist items 3-6, R9 asserts claim-pending then paid | A.9, A.11, C.4, C.5, C.7, D.3, D.4 |
| X7 | major | Keeper state machine has no rollover path; triggers missing | Fixed: empty-leader finalize row; full trigger list; WeekExtended re-select; owner-page finalize/reinstate/unblock/flag | C.4, D.5 |
| X8 | minor | Staff exclusion uses current roles; relayer and verifier not excluded | Fixed: sticky `staffEver`; `CandidateSkipped`; role wallets blocked at E5 | A.3, A.7, A.9, E5 |
| X9 | minor | Disqualify-then-reinstate inserts a candidate after the window | Fixed: reinstate re-inserts only `wasListed` sessions | A.8, A.16 #15 |
| X10 | minor | `sweepStray` and double-entry-point / sender-fee tokens; blacklisted residual recipient | Fixed: post-condition `balance ≥ liabilities`; checklist items; recipient-initiated successor | A.10, A.11 |
| X11 | minor | `firstWeek = current` admits pre-deploy sessions | Fixed: constructor requires `firstWeek > currentWeek()`; the script refuses `current` | A.2, A.18 |
| X12 | minor | Instance migration: single-instance server; double payout across instances | Fixed: rows keyed by contract; `retired[]` instances serviced; `firstWeek > old.endAfterWeek` | A.18, A.19, C.2, C.3 |
| X13 | minor | Owner discretion over funded pots undisclosed; residual goes to the operator's choice | Fixed (modified): refunds after an end go to funders; disclosures on the rules page; multisig recipient (OJ1); fund just in time | A.10, D.4, E11, H |
| X14 | minor | Keeper screening can be flooded by public submissions | Fixed: on-chain rows first by rank; up to 5 screens per run | C.4 |
| X15 | minor | No wall-clock slack signal | Fixed: H9 (hold) and S9 from `verified_at − (opened_at + survival)` | B.4 |
| X16 | minor | Unbounded rule epochs | Fixed: ≤ 8 pending, ≤ 8 weeks ahead, binary search | A.5 |
| X17 | minor | Keeper, verifier and Neon share one env | Fixed (documented): correlated row in A.3; `adminClearOnly` mandatory for real value; operator key never in Vercel | A.3, C.1, J16 |
| X18 | minor | Zero-pot "champions" | Fixed: a zero pot records no winner; profile and share filter `prize > 0` | A.9, C.7 |
| X19 | minor | Review API gated on a static admin address | Fixed: live `admin()` read, env as an extra constraint | C.1, C.6 |
| AC1 | major | Screen not calibrated against humans or evasion | Fixed: named populations (must-hold, known-evasion reported, vouched human set with ≥ 15 long runs); `--from-neon` excluded from denominators; probe script and evasion pilots committed; screen scope stated | B.4, C.8, D.4 |
| AC2 | major | CSS-widened view gives a human look-ahead; S8 soft and optional | Fixed: view cap + draw cull in the child; S8 in v1 with overlay; H11 for real value | B.3 #8, B.4, D.3 |
| AC3 | major | Banked-session sniping; no timing feature | Fixed: H9 late-evidence hold; seed-ticket log (issue time, counts); rules-page note; R14 | B.3, B.4, C.2, C.4 |
| AC4 | major | Disqualification cannot restore runs outside the top 5 | Fixed with X1 (`adminSubmit`, relist, `nextEligible` on the owner page, R13, §0.1 corrected) | A.7, A.8, C.6, D.5 |
| AC5 | major | "Sybils gain nothing" is false | Fixed: sybil in scope; one-person-one-wallet rule and `multi-wallet` reason; S10 cross-wallet signal; personhood/verification a real-value precondition | B.1, B.4, B.5, D.4, OJ6 |
| AC6 | major | Correlated env compromise defeats the "no evidence" backstop | Fixed (modified): A.3 row; seed-ticket log with MAC re-check covers verifier-only and Neon-only leaks; full-env compromise accepted as residual with cap + `adminClearOnly` + rubric | A.3, B.3, B.5 |
| AC7 | minor | Truncated `maxTicks` passes the survival cap; H1 rationale wrong | Fixed: `maxTicks ≠ 216000` is integrity (H7) and filtered before submit; H1 rationale corrected; R15 | B.3, B.4, C.4 |
| AC8 | minor | H4 premise incomplete (humans can make fast pairs) | Fixed: feature note, trajectory-change display, rubric "never on H4 alone", input styles in the human set | B.4, E rubric |
| AC9 | minor | No review rubric, no stuck-week timeout, review load, wrong screening-time claim | Fixed: rubric, SLA with 7-day default, escalation, timing claim corrected to 2-3 runs | B.3 #7, C.4, E11 |
| AC10 | minor | Other role wallets not excluded; insider dev-rebate economics | Fixed: E5 block list; `set-keeper` blocks the outgoing wallet; B.5 item 7 | A.3, B.5, E5 |
| AC11 | minor | Seed-shopping edge unsupported | Fixed (modified): seed variance pass before any claim; S11 from the ticket log; commit-reveal listed as future | B.4, B.5, I |
| AC12 | minor | Rehearsal has no adversarial scenarios | Fixed: R13-R20, with R13, R15 and R17 in the fast subset | rehearsal brief |
| F1 | major | `jackpot_actions.id` CHECK rejects its own id format | Fixed: numeric week index, lowercase, per-kind insert test | C.2 |
| F2 | major | Selection SQL sorts score as text | Fixed: numeric sort, cast only in projection, `numeric` minPaid filter, 9,999 vs 48,213 test | C.4 |
| F3 | major | API is Neon-only but rules are never mirrored | Fixed: `jackpot_rules` table; constructor emits `RulesScheduled` | A.5, C.2, C.5 |
| F4 | major | Sequencing vs polish-2 (and version-column) | Fixed: wave J0; budgets and byte identity re-based after polish-2; version-column ordered before J2 | header, G |
| F5 | major | Owner page cannot load the Chikun runtime unbundled | Fixed (option a): server-computed timeline in the review API; the page never imports the runtime | C.4, C.6, D.5 |
| F6 | major | No test or rehearsal seams | Fixed: `jackpotDeployment`, `jackpotSelect`, `keeperFault` | C.1, C.4, G |
| F7 | major | Keeper cron copies the 60 s timeout that 504'd index-chain | Fixed: `maxDuration 300`, per-call RPC timeouts, 120 s soft budget, measured in E7 | C.3, C.4 |
| F8 | major | Countdowns use stale `serverTime`; close-time invitations to pay for the wrong week | Fixed: skew from `Age`/`Date`; client-side phase; last-5-minutes note; shared countdown helper | D.2, D.3 |
| F9 | major | Results line uses the board rank; share label and marquee not provisional | Fixed: jackpot-leader-based line; "Jackpot lead (pending)"; open-week leader shows score only | C.5, D.1, D.3 |
| F10 | major | UI shows the whole pot despite a cap; zero-prize champions | Fixed: `prizeWei`/`carryOverWei`; cap note; `prize > 0` filter; zero pot records no winner | A.9, C.5, C.7, D.1 |
| F11 | major | Chikun child detail line promises monthly/yearly/first-to prizes | Fixed: live and live-unfunded detail copy; flip commit updates the pin | D.3, D.6 |
| F12 | major | Soft-launch payout contradicts "there are no prizes" | Fixed: option (a) soft-launch copy plus `adminClearOnly` for that week; never steer with disqualification | D.6, E9 |
| F13 | major | Neon mirrors keyed by game, not contract; token from the current module | Fixed: contract in every key; token stored per week; per-contract stream | C.2, C.3, C.5, C.7 |
| F14 | major | Rules page missing prize-affecting sections | Fixed: 16 marked sections incl. claims, end of life, survival cap, published data, sponsor, multi-wallet, entries don't fund, disputes, local times; guard checks markers | D.4 |
| F15 | minor | Legal note gaps | Fixed: §F items 1-4 and 7; OJ3 checklist | F, H |
| F16 | minor | `jackpot-config` re-export pulls the module into initial chunks; budgets understated | Fixed: import-free config; lazy chunks import the module; deployed-shaped fixture for budgets | A.18, D.1, D.3 |
| F17 | minor | Curated inventory regeneration unassigned | Fixed: assigned to contracts and UI; orchestrator regenerates on conflict | A.18, G |
| F18 | minor | `sameRun` private; `getSession` reader too thin; `ranked-results-model.mjs` not owned | Fixed: jackpot-local copies with parity tests; file added to jackpot-ui | B.3, C.4, D.3, G |
| F19 | minor | Schema-version pin list incomplete | Fixed: full list plus a grep step | C.2 |
| F20 | minor | Paused keeper invisible; review gate diverges after rotation | Fixed: `paused { env, onChain }` in health with a status warning; live `admin()` gate | C.4, C.6 |
| F21 | minor | Non-conforming reason skipped → wrong review in the mirror | Fixed: map to `other`; reconcile reads `reviewOf` | C.3 |
| F22 | minor | Rules link in the payment modal; ISO keys shown; no server kill switch | Fixed: new-tab link, "Entries don't fund the prize", local date ranges, `JACKPOT_UI_HIDDEN` | C.1, D.1, D.3, E stop 6 |
| F23 | minor | S3 needs unindexed entries; test glob overlap | Fixed: S3 counts settled runs; exclusive test names per slice | B.4, G |

**Residual risks after revision 2** (B.5): a careful in-view bot or a JavaScript-level look-ahead client passes the automated screen; a full Vercel-environment compromise defeats every automated layer; sybil wallets reset per-wallet signals; seed shopping is unmeasured until the variance pass. For tCHIKUN these are accepted. For any real-value prize the OJ6 set is mandatory.

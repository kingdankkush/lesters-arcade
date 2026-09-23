# Pre-deployment guide: Web3, Ranked, profiles, leaderboards, achievements and sharing

**Written:** 2026-09-22
**For:** a fresh session that finishes everything needed before the LitVM smart contracts are deployed, then deploys them.
**Owner decisions:** answered 2026-09-22 (section 9). They are applied throughout this guide.
**Repo:** `kingdankkush/lesters-arcade`, branch `fable/master-list-20260916`, worktree `C:\Users\just_\lesters-arcade-fable0916`
**Live site:** https://lestersarcade.io, version 1.7.0, cache marker `lesters-arcade-v52-owner-round`, production deployment `dpl_2Q1MYFG9YQWypPjs84VLKdTkwdsu`

---

## 0. How to start the new session

Open the new session in the worktree above and give it this prompt:

> Read `docs/handoffs/pre-deployment-web3-guide-20260922.md` end to end. Work through the workstreams in the order given in section 6, one committed slice at a time, keeping the release gate green. Do not deploy contracts or change Vercel secrets until section 7 says to, and ask me before each of those steps.

Before that session touches contracts or Vercel secrets, switch its **permission mode** to the one that asks you before each action. In auto mode, the safety classifier blocks edits to the contracts' operator, verifier and relayer addresses as "permission grants", even with approval given in chat (this happened on 2026-09-22).

---

## 1. Where things stand right now

### 1.1 Already done

| Item | State |
| --- | --- |
| `SESSION_SECRET` | Set in Vercel **production** as a sensitive secret (64 random characters, never written anywhere). |
| Neon database | Provisioned through the Vercel marketplace as `lesters-arcade-profiles`, connected to production. `NEON_DATABASE_URL` and related `NEON_*` variables exist. No table has been created yet; `api/profile.mjs` creates `arcade_profiles` on first use. |
| Service keys | Generated 2026-09-22 into `C:\Users\just_\lesters-arcade-vault\keys\litvm-liteforge-testnet-keys.json` (outside the repo). **Never print, paste, commit or log the private keys.** Read them only inside a script that pipes them where they go. |
| Operator funding | Operator wallet holds **0.4 zkLTC**, nonce **0**. |

The three service keys:

| Role | Address | Job |
| --- | --- | --- |
| Operator (also deployer) | `0x6Ac08Bed727A6951D755F0674f096E6A8AC06bfF` | Deploys every contract and administers them (fees, reserve, relayer list, achievement definitions, playable flags). |
| Verifier | `0x4d637a6C5b5c6f97cFA3d98BD53deeb8510120C7` | Signs EIP-712 score attestations inside Vercel functions. Never holds funds. |
| Relayer | `0x494aF36ea4958c417260faf3efB3B672B343EAf6` | Submits verified scores for players. Funded by the settlement reserve every Ranked entry pays. |

> **Do not use the operator key for any transaction before deployment.** Contract addresses are predicted from its nonce (currently 0). If the nonce moves, regenerate the dry-run manifest.

### 1.2 Not done yet

- `contracts/deploy-config.testnet.json` still lists the **old June deployer** `0x24501ad9…20d4` for every role. The edit to the addresses above was blocked by the classifier and reverted. Target values:

  ```json
  "deployer": "0x6Ac08Bed727A6951D755F0674f096E6A8AC06bfF",
  "operator": "0x6Ac08Bed727A6951D755F0674f096E6A8AC06bfF",
  "verifier": "0x4d637a6C5b5c6f97cFA3d98BD53deeb8510120C7",
  "relayer": "0x494aF36ea4958c417260faf3efB3B672B343EAf6",
  "relayerVault": "0x494aF36ea4958c417260faf3efB3B672B343EAf6",
  "settlementGasReserveWei": "100000000000000"
  ```

  The reserve of 0.0001 zkLTC is sized from measured LiteForge gas (0.01 gwei base, 0.02 gwei max on 2026-09-22). It buys about 5M gas per settlement, well above a verified submit with achievement mints. The old 0.02 zkLTC placeholder was about 3,000 times too high.
- No contract is deployed. `VERIFIER_PRIVATE_KEY`, `RELAYER_PRIVATE_KEY` and `SCORE_REGISTRY_ADDRESS` are not in Vercel.
- `SETTLEMENT_LIVE` and `HOSTED_PROFILE_SYNC` in `apps/portal/src/settlement.mjs` are both `false`.
- The Neon installer dropped `.agents/` and `skills-lock.json` into the worktree. Never commit them; add both to `.gitignore` in the first slice.

### 1.3 Environment facts for the new session

- `node_modules` and `benchmarks/hmh-engine-bakeoff/node_modules` are junctions to the Codex checkout. Browser smokes need `PLAYWRIGHT_PACKAGE_PATH=C:/Users/just_/lesters-arcade-fable0916/benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs`.
- Serve the portal locally from `apps/portal` as the web root, for example `python -m http.server 8797 --directory apps/portal`. The origin variables are `HMH_REBOOT_ORIGIN`, `CHIKUN_PORTAL_ORIGIN` and `STACKED_ORIGIN`.
- The static server has no `/api`. Test API code with Node unit tests, or with `npx vercel dev` if you need the functions live.
- Release gate: `npm run vercel:build`. It currently passes 3,892 of 3,943 tests with exactly **51** tolerated retired exceptions, and `docs/testing/hmh-reboot-test-retirement-gate.json` regenerates and must be committed.
- HMH's initial JavaScript has a hard cap of 1,048,576 bytes, with about 2 KB of headroom. **Any new portal or HMH UI must load through dynamic `import()`.**
- `scripts/syntax-check.mjs` has CRLF line endings. Register every new module there.
- Ship cycle: bump the version (`apps/portal/src/version-tracking.mjs` plus its pinned tests) and the service-worker cache marker (`apps/portal/sw.js`, README, three pinned tests), run `npm run vercel:build`, then `npx vercel deploy --yes`, then `npx vercel promote <preview-url> --yes`. Verify with the public-hash script and live smokes, then update the README and release receipt.

---

## 2. Rules for this work

1. **Security first.** Private keys live only in the vault file and in Vercel secrets. Scripts read them without echoing them. Never paste keys into prompts, commits or logs.
2. **The chain is the proof, the server is the judge.** The browser never decides a Ranked score, stat or achievement. It sends inputs; the server replays or checks them, signs, and publishes.
3. **Free Mode never touches Web3.** It needs no wallet prompt, no fee and no chain call.
4. **Testnet epoch.** Everything on LiteForge is wiped at mainnet. Design for a clean redeploy, not a migration.
5. **Commit per slice with tests.** Keep the gate green, and push after each slice.
6. **Ask before** any contract deployment, operator-key transaction, Vercel secret write, flag flip or production promote.

---

## 3. The player experience this must deliver

These are the acceptance criteria. Every workstream serves one of them.

### 3.1 Sign-in is easy

- One **Sign in** button. A wallet picker lists installed wallets (EIP-6963), with MetaMask and Rabby featured. On mobile it offers WalletConnect and wallet-app deep links (decision D9, approved).
- The wallet adds or switches to LiteForge automatically, with one clear prompt that explains why.
- **One signature** with a human-readable message: "Sign in to Lester's Arcade. This does not cost anything or send a transaction."
- The session lasts 24 hours and survives reloads. A returning player is signed in silently, with no new signature until the token expires.
- If the wallet has no zkLTC, the player sees a friendly faucet link and their balance. Free Mode stays one click away.

### 3.2 The Ranked transaction is seamless

- The pre-flight (network, balance, contracts, quote) runs **in the background as soon as the player opens a game's Ranked mode**, so the modal already shows the exact total when it opens.
- The modal shows: entry 0.1 zkLTC, settlement reserve 0.0001 zkLTC, total, and where the money goes (85% developer / 15% arcade). There is **one** wallet confirmation.
- The run **starts as soon as the transaction is broadcast**, with a small "entry confirming…" chip that turns green on confirmation. LiteForge blocks are fast. If the entry fails, the run finishes as unranked practice and the player is told plainly.
- Wallet rejection, wrong network and insufficient funds each get one specific, actionable message and a retry button.
- **Play again** in Ranked always opens a fresh paid entry. Today a Chikun Ranked restart skips payment, and the contract would reject its settlement with `SESSION_NOT_PAID`.

### 3.3 The Ranked results screen shows the run going on chain

One shared results screen for all three games, rendered by the parent portal and lazy-loaded.

- **Hero block:** the score, big, and the player's handle.
- **Standing:** "#3 today · #12 all-time · New personal best (+4,210)", read from the leaderboard index after settlement.
- **Game stats:**
  - Hard Money Heroes: kills, time, combo, level, boss.
  - Chikun: distance or region reached, laps, forks passed, near-misses, coins, best combo.
  - STACKED: lines, level, Halvings, perfect clears, best combo, time.
- **A live on-chain status timeline:**
  1. Entry confirmed.
  2. Run verified by the arcade server.
  3. Publishing to LitVM.
  4. **Published**, with a link to the transaction on `https://liteforge.explorer.caldera.xyz`.
  5. Achievements recorded (phase 2 adds "NFT minted" for the few soulbound ones).
- **Achievements earned this run:** badge art with tier colour, recorded on the server against the wallet and shown instantly. (When soulbound NFTs are switched on in phase 2, those few get a bigger reveal: "minting on LitVM…" then "minted", linking to the token.)
- **Actions:** **Share on X** is the primary button. Copy for Discord and Facebook sit in a secondary menu. Then Play again (Ranked), Practice (Free) and View profile.
- **Failure states:** "Saved; publishing will retry automatically" with a Retry button. Never a dead end, never a fake success.

### 3.4 Sharing looks good, with X as the focus

- X posts mention **@LestersArcade** (https://x.com/LestersArcade, confirmed in D12) so the owner sees every share in that account's mentions and can reply. **No hashtags** (D13): every character goes to the player's run and the game.
- Every Ranked share links to a **public session page** at `https://lestersarcade.io/s/<sessionId>`. That page has its own dynamically generated **1200×630 score card image** in its Open Graph and Twitter card tags, so X, Discord and Facebook all unfurl a proper card. The card shows game key art, score, standing, the headline stats, the player handle and a "Verified on LitVM" badge.
- The page shows the verified run, the transaction link, earned badges and a **Play** button.
- Text templates live in section 5.12.

### 3.5 Profiles and leaderboards are accurate and wallet-based

- A **public profile for every wallet** at `/profile/<wallet>`:
  - its **on-chain display name** and avatar;
  - per-game best scores and ranks;
  - Ranked runs played;
  - recent verified sessions with transaction links;
  - achievements: every unlocked achievement, with the few soulbound NFT achievements highlighted as tokens held on chain.
- All stats come from **verified sessions only**. Players change their name and avatar with a small on-chain transaction they pay for (decision D3). Preferences stay off-chain.
- **Global leaderboards** per game for **Weekly, Monthly and All-time** (decision D2), best score per wallet. Daily is added later as the headline board once activity grows. The data comes from the server index with transaction proof per row, is paginated and searchable, and loads fast on phones.
- **Launch is a clean slate** (decision D4). No earlier run, preview row or local unlock carries over.

---

## 4. Architecture to build

```
Browser ──inputs + SIWE token──▶ /api/settle (Vercel)
                                   │ 1. auth: token wallet == session player
                                   │ 2. check entry paid on chain (ArcadeRankedEntry.isPaid)
                                   │ 3. replay (Chikun, STACKED) or plausibility (HMH)
                                   │ 4. derive score, stats, achievements server-side
                                   │ 5. verifier signs EIP-712 VerifiedRun
                                   │ 6. relayer submits (nonce-safe queue)
                                   │ 7. write verified_sessions + evidence to Neon
                                   ▼
LitVM LiteForge ◀── ScoreSubmissionRegistry.submitVerifiedSession ──▶ AchievementRegistry.mintFor
                                   ▲
Neon index ◀── backfill cron reads ScoreSubmitted / AchievementUnlocked events
    │
    ├─▶ /api/leaderboard   (per game, period, page, search)
    ├─▶ /api/profile       (public stats from verified_sessions + editable fields)
    └─▶ /api/share-card    (OG image) and /s/<sessionId> page
```

**Why this shape:**

- The contract stores score, kills, combo, survival time, runtime, season, timestamp and an envelope hash. It cannot sort or filter by game (`ScoreSubmissionRegistry.sol:302-343`, insertion order only), and it has no fields for STACKED lines and level. The Neon index holds the full server-derived stats and serves fast queries. The chain row and its `envelopeHash`, which commits to the stored evidence, stay the proof.
- The server must derive achievements. Today the browser sends "achievements newly unlocked on this device" and the verifier signs any list of up to 32 strings (`api/attest.mjs:64`).

---

## 5. Workstreams

References are `file:line` as of commit `d0e26c78`; lines drift, so re-grep before editing.

### 5.1 Server verification and settlement hardening (P0, security)

**Problems found:**

- `/api/attest` and `/api/settle` require **no authentication**. Anyone who learns a paid `sessionId` can have the relayer publish a made-up score for that player first. The contract then blocks the real score with `SESSION_EXISTS`.
- Chikun and STACKED scores are signed on shape checks only (`api/attest.mjs:53-66`). Only HMH gets a plausibility check (`:67-75`).
- The SIWE nonce is generated by the browser (`wallet-auth.mjs` `buildSiweChallenge`), so a captured signed login can be replayed within its 10-minute freshness window.

**Build:**

1. **Server-issued SIWE nonce.** Add `GET /api/session/nonce`, returning an HMAC-signed nonce with expiry, or a Neon row. `/api/session` accepts each nonce once. Add `www.lestersarcade.io` to the allowed domains, and keep `localhost` only outside production.
2. **Authenticated settle.** `/api/settle` requires `Authorization: Bearer <session token>`, and the token wallet must equal the run's player. Deprecate `/api/attest` for browsers, or give it the same auth.
3. **Paid-entry check.** Before signing, read `ArcadeRankedEntry.isPaid(sessionId, player, gameId)` over the **public RPC**, not the wallet provider.
4. **Chikun replay on the server.**
   - Accept the flap evidence (`chikun-flap-evidence-v5`: seed, fixedStepHz, maxTicks, flapSteps).
   - Rebuild the seed with `deriveSessionSeed` (`arcade-core.mjs:5302`).
   - Run `verifyChikunReplayClaim` / `replayChikunRun` (`apps/portal/src/chikun-cabinet.mjs:120-180`). These are pure and Node-safe: about 37 ms for a 1-minute run, 271 ms for 10 minutes, and roughly 1.6 s at the cap.
   - Make sure Vercel bundles `apps/chikun/assets/obstacle-shapes.json`, which is imported by `chikun-obstacles.mjs:1`.
5. **STACKED replay on the server.**
   - Accept the SIC1 replay bytes as base64.
   - Run `replayStackedRun(evidence, { expectedSeed, maxTicks, config })` (`apps/portal/src/stacked-sim.mjs:1019-1034`). It is pure: about 50 ms for 15 minutes and 342–391 ms for the 2-hour maximum.
   - Require the tuple to match. Payloads run 20–160 KB typically and 432 KB at the 2-hour maximum.
6. **HMH.** Keep `validateRunPlausibility`. Fix the seasonId mismatch first (section 5.5). Server replay is out of scope because the simulation is too heavy for a function. State this in the UI copy only if you choose to (decision D11).
7. **Body limits.** Raise the 16 KB cap (`api/attest.mjs:30`) to about 600 KB for `/api/settle`, and reject oversize bodies early.
8. **Relayer nonce safety.** Two concurrent settles from one relayer key collide on nonces. Serialise submissions with a Neon advisory lock (`pg_advisory_xact_lock`) or a `settle_queue` table and a single worker. Retry on `nonce too low` / `replacement underpriced`.
9. **Idempotency and retries.**
   - One Neon row per `sessionId` with status `pending → signed → submitted → confirmed | failed`.
   - The endpoint returns the existing state instead of double-submitting.
   - A Vercel cron (every 5 minutes) retries `failed` and `submitted` rows that have stalled.
10. **Function config.** Set `maxDuration` for `api/settle.mjs` in `vercel.json` (for example 30 s) and return early with `status: submitted` if confirmation takes long. The browser polls `/api/settle/status?sessionId=`.
11. **Rate limits.** Per wallet and per IP, for example 20 settles per hour, stored in Neon.
12. **Score ceilings.** STACKED allows up to 1e12 (`stacked-contracts.mjs:42`), but settlement caps at 1e10 (`verifier-attestation.mjs:38`). Align them.

**Tests:**

- Unit tests with fixture replays for both games: valid runs, a tampered score, a wrong seed, the wrong player token, an unpaid session, duplicate settles and concurrent settles.
- Extend `tests/server-session-profile.test.mjs`.

### 5.2 The Neon verified-session index and read APIs (P0)

**Today:** one table, `arcade_profiles(wallet, document jsonb, updated_at)` (`server-neon.mjs:30-51`). There is no session index.

**Build:**

1. **Migrations** in a `server-neon.mjs` `ensureSchema` with a version table:
   - `verified_sessions`: session_id (pk), wallet, game_id, score, stats jsonb, runtime_id, season_id, period keys (ISO week starting Monday UTC, calendar month UTC; store the UTC day too so Daily can switch on later without a migration), achievements text[], tx_hash, block_number, status, created_at, confirmed_at.
   - `session_evidence`: session_id, evidence bytea or text, digest.
   - `wallet_profiles`: wallet, display_name, avatar_uri (both **mirrored from `PlayerProfileRegistry` events**, never written by the browser), preferences jsonb, hidden boolean (moderation).
   - `achievement_unlocks`: wallet, game_id, achievement_id, session_id, unlocked_at, **nft boolean**, token_id, tx_hash. Every achievement lands here; NFT achievements also carry their token.
   - `settle_queue` and `rate_limits` as needed.
   - Indexes: `(game_id, season_id, score desc)`, `(wallet, game_id)`, and the period keys.
2. **`GET /api/leaderboard?game=&period=weekly|monthly|all-time&page=&q=`.** Best per wallet (decision D1), ties by earliest `confirmed_at`, 25 rows per page. Each row carries display name, shortened wallet, score, headline stats, tx hash and date. Cache with `s-maxage=15, stale-while-revalidate=60`. Accept `period=daily` in the API from day one, but do not show it in the UI until the owner turns it on (decision D2).
3. **`GET /api/profile?wallet=` becomes public and server-derived.** It returns the on-chain name and avatar, per-game bests and ranks, run counts, recent sessions (with tx) and every achievement unlock (NFT ones flagged). `PUT` accepts **preferences only**; name and avatar change on chain.
4. **Backfill cron** (`/api/cron/index-chain`, every 5 minutes, protected by `CRON_SECRET`). It reads `ScoreSubmitted` / `SessionSubmitted`, `AchievementUnlocked` and `PlayerProfileRegistry` `ProfileCreated` / `ProfileUpdated` events since the last indexed block, and upserts rows. Name changes should also be picked up immediately: after a player's rename transaction confirms, the browser calls `POST /api/profile/refresh?wallet=`, which reads `getProfile` from chain. This covers player-signed fallback submissions and any missed writes. Events exist at `ScoreSubmissionRegistry.sol:82-94` and `AchievementRegistry.sol:39-41`.
5. **Fix the sanitizer.** `sanitizeProfileDocument` strips `:`, which breaks ISO timestamps, and strips emoji avatars (`server-session.mjs:84`).
6. **Public RPC for all chain reads.** Reads currently go through the wallet provider (`litvm-chain-client.mjs:98-104`) and fail when the wallet is on another network.

### 5.3 Chikun's Escape Ranked path (P0)

**Today:** Ranked Chikun replays twice in the browser, then **discards** the settlement input.

- `chikun-portal-lifecycle.mjs:323-344` runs the replay and `recordScore`, then drops the result.
- The `onComplete` handler (`main.js:5233-5246`) never settles.

**Build:**

1. Return `settlementInput` from the lifecycle and call a game-agnostic `settleRankedRun`. Refactor `main.js:2930+` so the envelope and plausibility steps are per game. Today `finalizeCurrentSessionEvidence` hashes HMH combat state (`main.js:2859-2863`) with the HMH season (`main.js:2837`).
2. Build a **Chikun envelope** from the flap evidence and the canonical final state. The envelope hash must commit to the evidence the server replays.
3. Map the contract fields:
   - `kills` = forks passed.
   - `maxCombo` = best combo.
   - `survivalSeconds` = survival time.
   - `runtimeId` = a real Chikun runtime id such as `chikun:canvas-runtime-v6`, not the site version.
   - `seasonId` = `chikun-season-preview-1`, used consistently in the entry key and in settlement (today the entry key uses the HMH season at `main.js:5578`).
4. Stop HMH achievement ids leaking into Chikun runs. `maybeUnlockRunAchievements` (`arcade-core.mjs:5503-5543`) uses the cross-game `totalPaidRuns`.
5. **Ranked restart must pay a fresh entry.** `main.js:5208-5213` currently goes straight to `startMode('paid')`.
6. **Retune difficulty to the owner's play-length targets** (decision D11). Today speed climbs only 100% every 8 minutes (`speedAtTick = 1 + tick/28800`, `chikun-ground-course.mjs:7`; level every 7,200 ticks, `chikun-ground-runtime.mjs:4`), so the autopilot survives about 43 minutes.

   | Player | Target survival |
   | --- | --- |
   | Beginner to intermediate | 2–6 minutes |
   | Intermediate to expert | 6–8 minutes |
   | Expert to hardcore | 8–12 minutes |
   | Exceptional | past 15 minutes should be very rare |

   - Build a headless **difficulty harness** on the pure runtime: bot profiles with different reaction delays, timing error and look-ahead, 200+ seeded runs each, reporting survival percentiles.
   - Tune the speed ramp (steeper and front-loaded), obstacle spacing and gap height per region until the percentiles land on the targets. Re-check that a strong run still sees farmland through coast in its first loop.
   - Pin the tuned curves and the harness percentiles in tests. Bump the evidence version to v6 because the course changes.
7. **Replay size cap.** With the retune, runs past 15 minutes are rare, so the 4,096-flap evidence cap (`chikun-ground-runtime.mjs:27`) stops being a practical limit. Still make it fail safe: raise it to cover 60 minutes (delta-encode the flap ticks so the payload stays small), and end the run gracefully instead of throwing `game:error` if a limit is ever hit.
8. Keep the evidence locally until settlement is confirmed, so a failed publish can retry after a reload.
9. Update the copy on the child result overlay and in the parent.

### 5.4 STACKED Ranked path (P0)

**Today:**

- The host verifies the run in a worker, then `recordStackedScore` writes a `local-replay-preview` row with `acceptedForGlobalLeaderboard:false` (`arcade-core.mjs:5585-5615`).
- The UI says "Online settlement is disabled" (`main.js:1918-1921`).
- The evidence is thrown away after verification (`arcade-core.mjs:5609`), and `stacked-replay-store.mjs` is never used.

**Build:**

1. Produce a `settlementInput` from the verified tuple and route it to the shared `settleRankedRun`. `sessionKey` must equal the paid entry's `sessionId32`.
2. Map the contract fields:
   - `kills` = lines.
   - `maxCombo` = max combo.
   - `survivalSeconds` = ticks / 60.
   - The full tuple (lines, level, Halvings, spins, perfect clears) goes to the Neon `stats`.
   - `envelopeHash` = the evidence digest.
3. Persist the replay bytes in `stacked-replay-store.mjs` until confirmed, so publishing can be retried.
4. Stop forcing `official` to `local` for STACKED (`official-leaderboard-route.mjs:88`, `leaderboard-view.mjs:304`).
5. Update the copy: "RANKED PREVIEW" (`apps/stacked/src/main.mjs:204`) and "local … not an online leaderboard" (`stacked-host.mjs:65`).
6. Use one seasonId throughout (`stacked-season-preview-1`).

### 5.5 Hard Money Heroes fixes (P0/P1)

1. **Entry key season.** The entry key uses `CURRENT_RANKED_SEASON_ID` for all games (`main.js:2837`, `main.js:5578`). Make it per game.
2. **Achievement unlock bugs** found in the investigation:
   - `bossId` is set when a boss **appears**, not when it is beaten (`main.js:2904`, `main.js:7515`). This grants Boss Breaker and Speed Clear on encounter.
   - `killsByType` is sent where the resolver expects `enemyKillsByType`.
   - `stageIndexReached`, grenade kills and melee kills are never passed.
   - The seven Level 2 achievements are never evaluated.
   - Once the server derives achievements (section 5.6) these become server inputs. Fix them in the shared resolver so browser and server agree.
3. HMH settlement must adopt the authenticated `/api/settle` flow and the new results screen.
4. **Duplicate rows.** The local row (stamped with a tx hash) and the `chain:` row have different ids (`main.js:4833-4891`). Dedup by sessionId.

### 5.6 Achievements: server-recorded at launch, soulbound NFTs in phase 2 (P0 for phase 1)

**Phasing (decision D15, 2026-09-22): soulbound NFTs come later, as a separate phase.** This needs no redeploy, because `AchievementRegistry` was written for it (checked in `contracts/src/AchievementRegistry.sol`):

- `defineAchievement` can be called by the operator at any time, and re-defining an id updates its metadata.
- `setMinter` can add a minter (for example the relayer) at any time.
- `mintFor(player, achievementId, sessionId)` accepts past sessions, never mints a duplicate (one deterministic token id per wallet and achievement), and returns quietly for undefined ids, so settlement is never blocked.

**Phase 1, before deployment (this guide):** build the catalogs, server derivation and the Neon `achievement_unlocks` table, show unlocks on profiles and results, and deploy the three per-game collections **empty** (the deploy script already creates them and makes the score registry a minter). Items 1, 2, 4 (server-recorded part only), 7 and the metadata folder layout from item 6 are phase 1.

**Phase 2, later:** approve the NFT subset (item 3), commission the art, publish metadata, `defineAchievement` for the subset, `setMinter(relayer, true)`, then **backfill-mint** every wallet that already earned one, straight from `achievement_unlocks`. From then on settlement mints them live. Items 3, 5, 6 (publishing) and 8 are phase 2.

**Owner model (decisions D5–D7):**

- **Most achievements are unlocked and stored on the server**, tied to the wallet in the Neon `achievement_unlocks` table and derived only from verified sessions. They cost no gas and appear on the profile immediately.
- **A select few high-tier achievements per game are soulbound NFTs**, minted on chain the moment they are earned.
- **Catalog sizes:** Chikun's Escape **40**, STACKED **40**, Hard Money Heroes keeps its **57**. Each game spans bronze to platinum by difficulty; HMH also keeps its diamond and mythic tiers.
- **Art:** launch with the existing badge images. The owner plans spectacular upgrades later (highly detailed 3D models with effects), so the metadata must support that without re-minting.

**Today:**

- The deploy script **never calls `defineAchievement`**, so every mint is silently skipped (`AchievementRegistry.sol:133-136`).
- HMH's 57 achievements (`arcade-core.mjs:1509-1572`) have no gameId and several are computed wrongly (section 5.5).
- Chikun has 4 (`chikun-cabinet.mjs:50-55`), outside the main table. STACKED has none for Ranked play, only 16 device-local Free medals (`apps/stacked/src/free-medals.mjs:5-22`).
- No metadata JSON exists. There are 100 badge PNGs under `apps/portal/assets/generated/achievement-badges/`.

**Build:**

1. **One catalog module per game** with a `gameId` field (for example `apps/portal/src/achievements/{hmh,chikun,stacked}.mjs`), shared by browser and server. Each entry: id, gameId, title, description, tier, `nft: true|false`, criteria as a pure function of verified stats plus the wallet's verified history, and image.
2. **Write the Chikun and STACKED catalogs, 40 each.** Suggested spread: 14 bronze, 12 silver, 9 gold, 5 platinum. Calibrate thresholds to the play-length targets (section 5.3 item 6) using the difficulty harness, so bronze is reachable in a first session and platinum marks the top few percent.
   - **Chikun themes:** reach each of the seven regions; complete one and two loops; survive 2, 4, 6, 8, 10 and 12 minutes; forks passed; near-miss streaks; coins in one run; best combo; flawless region (no near misses); speed milestones; cumulative runs and distance across sessions.
   - **STACKED themes:** first Halving and Halving counts; levels reached; perfect clears; spins; combo and back-to-back chains; lines in one run and cumulative; survival time; score milestones; clean boards; garbage survived; cumulative sessions.
3. **Choose the NFT subset:** about **5 per game**, drawn from the top tier (platinum for Chikun and STACKED; mythic for HMH). The session proposes the list and the owner approves it before deployment.
4. **Server derivation.** `/api/settle` computes every newly earned achievement from the replayed stats and the wallet's verified history in Neon. It writes all of them to `achievement_unlocks`, and passes only the **NFT** ones into `submitVerifiedSession` for minting (well under the contract's 32 per submit). If an NFT mint fails or arrives late, a backfill path mints it through the relayer allowed as minter (`AchievementRegistry.setMinter`, `mintFor(player, id, sessionId)`).
5. **Deploy script (phase 2).** For each game, call `defineAchievement(id, gameId, title, category, tokenUriPath)` **only for the NFT subset**, from a separate script such as `scripts/define-nft-achievements.mjs`, so it runs after the art is ready. Server-recorded achievements need nothing on chain. Phase 1 deploys the collections with no definitions.
6. **Metadata built for the art upgrade.** Generate `apps/portal/achievements/<slug>/<achievement-id>.json` with ERC-721 metadata:
   - name, description, `image` (a still, for wallets that only show images);
   - **`animation_url`** reserved for the future 3D and effects version (a GLB model or a small self-contained HTML viewer), so upgrading means replacing files, not re-minting;
   - attributes: game, tier, category, "Soulbound: yes", season "LiteForge testnet".
   - `setBaseTokenUri` stays available if the hosting path ever moves.
7. **Display.** The profile lists every unlock, marks NFT achievements with a "⛓ Soulbound NFT" badge, and links each to its token on the explorer. Read holdings from the Neon mirror and confirm with `fetchPlayerAchievements` (currently imported but never called). Remove the "device-local … not NFTs" copy (`official-profile-route.mjs:56`).
8. **The results screen** celebrates NFT unlocks distinctly: a larger reveal, "minting on LitVM…" then "minted", plus a share prompt.

### 5.7 Profiles and on-chain names (P1)

- Add a public `/profile/<wallet>` route. The current profile route shows only the connected wallet's device state (`official-profile-route.mjs:134-147`).
- Stats come from `/api/profile` (server-derived). Drop client-pushed xp, run counts, achievements and runHistory from the hosted document. They are spoofable today (`profile-sync-client.mjs:72-81`), and they gate HMH character unlocks (`hmh-character-config.mjs:218-227`). Character unlocks should read verified run counts.
- **Names are on chain** (decision D3) through the already-written `PlayerProfileRegistry`:
  - It stores the display name and avatar URI per wallet and enforces unique names of 3–18 characters with an allowed character set (`PlayerProfileRegistry.sol:30-125`).
  - It emits `ProfileCreated`, `ProfileUpdated` and `HandleReserved`, which the index mirrors.
  - The player pays gas for every create or change. On LiteForge that is a tiny fraction of a zkLTC; show the estimate before the wallet opens.
- **Name-change UX:**
  - Check availability and validity **before** the wallet prompt: read `handleOwners(normalizedHandle)` and apply the same rules as the contract, so no transaction ever reverts.
  - Run a profanity and impersonation check in the browser before sending. Names cannot be filtered on chain, so add a moderation flag in Neon (`wallet_profiles.hidden`) that falls back to the shortened wallet in every display.
  - After confirmation, call `POST /api/profile/refresh` so the new name shows everywhere at once.
  - First-time Ranked players get a friendly optional prompt to claim a name; skipping shows the shortened wallet.
- Avatars: the contract stores an avatar URI. Offer a set of arcade avatars hosted on the site. Custom image upload is out of scope for launch.
- Make sure `PlayerProfileRegistry`'s address flows into the generated address module (section 5.14).

### 5.8 Leaderboards UI (P1)

- Switch the Scores page (`leaderboard-view.mjs`, `routes/official-leaderboard-route.mjs`) to `/api/leaderboard`, keeping the existing banners, search and jump-to-rank.
- Period tabs at launch: **Weekly** (default), **Monthly**, **All-time**. Remove Daily and Yearly from the UI for now; Daily returns later as the headline tab (decision D2). Show when the current period resets.
- Retire the 200-session chain scan (`litvm-chain-client.mjs:326-337`), or keep it only as an offline fallback.
- Show a per-row "⛓ verified" link to the explorer transaction.
- Remove the House and Local Preview tabs at launch (decision D4: clean slate). Empty boards show an inviting "Be the first on this week's board" state with a Play Ranked button.

### 5.9 Sign-in UX (P1)

- Show a wallet picker from the existing EIP-6963 registry, with MetaMask and Rabby featured and install links when neither is present.
- After `eth_requestAccounts`, call `wallet_addEthereumChain` / `wallet_switchEthereumChain` for chain 4441 with a single explainer. Today the chain switch is deferred to the Ranked modal (`main.js:6248`).
- Replace the SIWE statement with plain language (`wallet-auth.mjs:36+`), and use the server nonce from section 5.1.
- Silent re-auth: on load, if `eth_accounts` returns the same wallet and the stored session token is valid, skip the signature.
- Show a balance chip with a faucet link (`https://liteforge.hub.caldera.xyz`).
- **Mobile first** (decision D9: whatever makes mobile smoother):
  - **WalletConnect / Reown AppKit**, loaded lazily. It lets players sign in from any mobile browser with MetaMask, Rabby, Trust, Coinbase Wallet and others, and approve the Ranked entry in their wallet app with an automatic hand-off back. Needs a Reown project ID from the owner (section 10).
  - **Wallet deep links** when no wallet is detected on a phone: "Open in MetaMask" (`https://metamask.app.link/dapp/lestersarcade.io`) and the equivalent for Rabby and Trust, so the site opens inside the wallet's own browser.
  - Keep every wallet prompt reachable with a thumb, keep the Ranked modal readable at 320 px, and never open a wallet prompt from inside the game canvas's input handler, which some mobile browsers block.
  - Later option to evaluate: email or social sign-in with an embedded wallet (Privy, Dynamic, thirdweb) for players who have no wallet at all. It needs an owner account with the provider and a custody review, so it is not in the launch scope.

### 5.10 Ranked entry UX (P1)

- Start the pre-flight when the player opens a game's Ranked mode, and cache the `quoteEntry` result.
- Keep one confirmation. Start the run on broadcast and confirm in the background (section 3.2). The settle step already rechecks `isPaid`, so a failed entry can never publish.
- Refresh the modal copy: total, split, reserve explanation, and the "Free Mode is always free" link.

### 5.11 The shared Ranked results screen (P1)

- Add a new lazy module, for example `apps/portal/src/ranked-results.mjs`, with styles in the portal stylesheet.
- Hard Money Heroes shows it in place of the current parent game-over summary. Chikun and STACKED hand off to it after a Ranked run, while their own child result panels stay for Free Mode.
- It drives the status timeline from `/api/settle/status` and the standing from `/api/leaderboard?wallet=`.
- Badges animate from "minting" to "minted" and link to the token on the explorer.
- It must be fully keyboard and touch navigable, respect reduced motion, and work at 320 px.

### 5.12 Sharing: X first, @LestersArcade, share pages with cards (P1)

**Today:** `apps/portal/src/share-links.mjs` builds plain one-line text, for example `I scored 48,210 points in Hard Money Heroes: … Ranked run at lestersarcade.io`. X, Facebook and Discord get equal weight, and every share links to the generic site with the generic splash image.

**Build:**

1. **X is primary.** Use `https://x.com/intent/post` with `text` and `url`, and put `@LestersArcade` in the text (the owner's account, https://x.com/LestersArcade, where replies and engagement happen). Add `related=LestersArcade` so X suggests following the account after posting. Skip `via`, which would duplicate the mention. **Send no `hashtags` parameter** and remove hashtag handling from `buildShareLinks`.
2. **Templates.** Keep them under 280 characters; X counts every URL as 23. Ranked:

   Hard Money Heroes:
   ```
   🏆 RANKED · Hard Money Heroes
   48,210 pts · #3 today
   ☠ 312 kills · 🔥 ×42 combo · ⏱ 12:04
   ⛓ Verified on LitVM
   Can you beat it? @LestersArcade
   https://lestersarcade.io/s/<sessionId>
   ```

   Chikun's Escape:
   ```
   🐔 RANKED · Chikun's Escape
   19,475 pts · Lap 2 · Farmland
   🌾 52 forks · ⚡ 18 near-misses · 🪙 41 coins
   ⛓ Verified on LitVM
   Beat my flight @LestersArcade
   https://lestersarcade.io/s/<sessionId>
   ```

   STACKED:
   ```
   🧱 RANKED · STACKED
   412,900 pts · #1 this week
   📈 186 lines · Lv 14 · 5 Halvings
   ⛓ Verified on LitVM
   Stack higher @LestersArcade
   https://lestersarcade.io/s/<sessionId>
   ```

   A new personal best adds a `🔥 New personal best!` line. Free runs use a lighter template ending "Practising on @LestersArcade" with no verification line. **No hashtags** (decision D13).
3. **Share page `/s/<sessionId>`.**
   - Add a Vercel rewrite to a lightweight page that reads `/api/session/<id>` (from Neon).
   - It shows the score card, stats, standing, badges, the transaction link and **Play** buttons.
   - It must set `og:title`, `og:description`, `og:image`, `twitter:card=summary_large_image` and `twitter:site=@LestersArcade`. X reads these from server-rendered HTML, so render the tags in a function, not in client JavaScript.
4. **Score card image.** `/api/share-card/<sessionId>.png` renders 1200×630 with `@vercel/og` (Satori, new dependency). It shows game key art as the background, the score, handle, standing, three headline stats, earned badges and "Verified on LitVM". Cache it immutably once the session is confirmed.
5. **Facebook and Discord:** secondary. Facebook's sharer takes the share-page URL and shows the card. Discord gets copied text plus the URL, which unfurls the card. The native share sheet (mobile) passes the same text and URL.
6. **Tests:** template length under 280 with a 23-character URL, `@LestersArcade` present exactly once, no `#` hashtags, no raw wallet addresses in text, and OG tags (including `twitter:site=@LestersArcade`) present on the share page.

### 5.13 Unlockables (P2, approved by the owner in D8)

- An unlockable is granted by **holding** a soulbound achievement token, so it follows the wallet across devices.
- Suggested sets:
  - Hard Money Heroes: hero and weapon skins. The display text already exists in `LESTER_BLASTER_UNLOCKABLES` (`arcade-core.mjs:2025-2035`).
  - Chikun: coat colours, trails, hats.
  - STACKED: piece skins and visualizer scenes.
- Holding is checked through `/api/profile` holdings. Unlockables work in Free Mode too.
- Existing real unlocks: Lester and Lilly heroes gated on local paid-run counts (`hmh-character-config.mjs:20-38`). Move them to verified counts.

### 5.14 Contract and deploy-script updates (P0, before deployment)

1. Update `contracts/deploy-config.testnet.json` with the addresses and reserve in section 1.2.
2. Add `defineAchievement` calls from the catalogs (section 5.6). Allow the relayer as a minter on each collection if you use backfill minting.
3. Have the deploy script write `contracts/deployment-record.hardened.json`. Make the portal **read addresses from a generated module** (for example `apps/portal/src/generated/litvm-addresses.mjs`, produced from the record), so nobody hand-edits `LITVM_CONTRACT_ADDRESSES` (`settlement.mjs:39-53`, still the June addresses, with all achievement registries `null`).
4. **Owner confirmation page.** Add `apps/portal/owner/confirm-dev-wallet.html`, a noindex page using plain `window.ethereum`.
   - It adds or switches to chain 4441 and checks that the connected account is the owner wallet `0x07cec6Fc49CAf6528F2f2F796042629cd3f48B26`.
   - It sends `GameRegistry.confirmDevWallet(gameId)` for each of the three games, then shows the transactions.
   - The contracts require this so nobody can redirect fees. After that the operator calls `setPlayable(gameId, true)`.
5. **Contract changes.** None are required. Score, kills, combo and survival carry the headline numbers, and the envelope hash commits to the evidence Neon stores. Revisit only if the owner wants lines and level on chain.
6. **Local chain rehearsal (approved, D14).** Add Hardhat as an npm dev dependency and rehearse the full flow locally before touching LiteForge: deploy, confirm payout wallets, entry, settle through the real `/api/settle` code, profile name change, leaderboard rows. Add a phase 2 rehearsal script for define → backfill mint so that phase is proven too. Foundry is not installed, so the forge `SecurityBaseline.t.sol` suite has never run; port its key cases to Hardhat tests.

### 5.15 Tests, evidence and docs (throughout)

- **Unit:** replay verification per game, achievement derivation, leaderboard SQL (with a fake client), share templates, results-screen state machine, SIWE nonce.
- **Browser smokes:** sign-in with a fixture wallet (the Chikun smoke already signs SIWE with test key `0x11…11`), Ranked entry modal, results screen, share page tags.
- **Integration:** the local-chain rehearsal (section 5.14 item 6), with a script that runs one Ranked session per game end to end.
- **Docs:** update `docs/web3/contract-overhaul-20260916.md` and the README, and write a release receipt under `docs/qa/`.

---

## 6. Recommended order

| Step | Slice | Depends on |
| --- | --- | --- |
| 1 | `.gitignore` for installer files; confirm owner decisions in section 9 | — |
| 2 | Chikun difficulty harness and retune (5.3 item 6) | D11 |
| 2b | Achievement catalogs for all three games (40 Chikun, 40 STACKED, 57 HMH) and shared resolver fixes (5.5 item 2, 5.6 items 1–2), server-recorded only | 2, D5, D7 |
| 3 | Neon schema + migrations + read APIs (5.2) | — |
| 4 | Server nonce, authenticated settle, server replay, derivation, nonce-safe relayer, queue and cron (5.1, 5.6 item 3) | 2, 3 |
| 5 | Chikun Ranked path (5.3) | 4 |
| 6 | STACKED Ranked path (5.4) | 4 |
| 7 | HMH settlement on the new flow + fixes (5.5) | 4 |
| 8 | Sign-in and Ranked entry UX (5.9, 5.10) | D9 |
| 9 | Shared Ranked results screen (5.11) | 5–7 |
| 10 | Sharing: templates, share page, OG card (5.12) | 3, D12, D13 |
| 11 | Profiles with on-chain names, leaderboards UI on the index (5.7, 5.8) | 3, D1–D4 |
| 12 | Deploy-script updates (collections deployed empty), generated addresses, owner page (5.14) | 2 |
| 13 | Local-chain rehearsal (5.14 item 6) | 12 |
| 14 | Unlockables (5.13) | D8 |
| 15 | Deployment (section 7) | all of the above |
| Later | **Phase 2: soulbound NFTs** (5.6 phase 2), after the owner's art upgrade | owner art, D15 |

---

## 7. Deployment runbook (only after section 6 is complete)

Every step with ⚠ needs the owner's approval in the moment, with the session in "ask before each action" mode.

1. Run `npm run vercel:build` green. Commit.
2. Check the operator balance and that its nonce is still 0. Run the dry run (`node scripts/deploy-contracts.mjs`) and review `docs/web3/hardened-ranked-deployment-manifest.json`: predicted addresses, gas, achievement definitions.
3. ⚠ **Broadcast.** Read `DEPLOYER_PRIVATE_KEY` from the vault file inside the command without echoing it, and set `LITVM_DEPLOY_CONFIRM=DEPLOY_HARDENED_NATIVE_FEE_RANKED_4441`. Run `node scripts/deploy-contracts.mjs --broadcast`. Commit the deployment record.
4. ⚠ **Owner signs** three `confirmDevWallet` transactions on the owner page, from MetaMask or Rabby on the owner wallet.
5. ⚠ **Operator** calls `setPlayable(gameId, true)` for each game.
6. ⚠ Add Vercel production secrets by piping values from the vault file. **Do not echo them.**
   - `VERIFIER_PRIVATE_KEY`
   - `RELAYER_PRIVATE_KEY`
   - `SCORE_REGISTRY_ADDRESS`
   - `CRON_SECRET` (new)
   - Optional: `RPC_URL`, `SESSION_ALLOWED_DOMAINS`
7. Regenerate the portal address module from the deployment record. Set `HOSTED_PROFILE_SYNC = true` and `SETTLEMENT_LIVE = true`, and update the tests that pin them (`tests/settlement.test.mjs`, `tests/litvm-ranked-contract-gate.test.mjs`).
8. Bump the version (1.8.0) and cache marker (v53). Run `npm run vercel:build`, then `npx vercel deploy --yes`, then ⚠ `npx vercel promote … --yes`.
9. **Live end-to-end, one Ranked run per game,** using a test player wallet funded with a little zkLTC (about 0.35 zkLTC for three runs; the 0.1 fees return to the owner wallet). For each run, confirm all of:
   - the entry transaction;
   - `/api/settle` confirmed;
   - `getSession` exists on chain;
   - the Neon row;
   - the leaderboard row;
   - the profile stats;
   - achievements recorded in Neon and shown on the profile and results screen (NFT minting is phase 2);
   - the share page card rendering in X's card validator or an unfurl preview.
10. Verify public file hashes, run the live smokes, then update the README and write the receipt `docs/qa/…-release-<date>.json`.

**Rollback:** the site rolls back with `npx vercel promote dpl_2Q1MYFG9YQWypPjs84VLKdTkwdsu` (1.7.0). Contracts are testnet. If something is wrong on chain, flip `SETTLEMENT_LIVE` back to false and redeploy the site. `ArcadeRankedEntry.setEntryFeeEnabled(false)` stops fees immediately.

---

## 8. Post-launch hardening (not blocking testnet launch)

- Move the operator role to the owner's wallet with `transferOperator` → `acceptOperator` on all five contracts, once tuning settles.
- Get an external contract audit before mainnet.
- Add monitoring: relayer balance alerts, settle failure rate, cron lag.
- Retune the reserve with `setSettlementGasReserve` from measured settlement gas.
- Server replay for HMH (worker or queue service) if cheating appears.

---

## 9. Owner decisions

Answered by Justin on 2026-09-22 unless marked pending. Where an answer was "recommended", the recommendation is the decision.

| # | Decision | Answer |
| --- | --- | --- |
| D1 | Leaderboard ranking | **Recommended:** best score per wallet, per game, per period; ties go to whoever got there first. |
| D2 | Periods and resets | **Weekly and Monthly** (plus All-time) at launch. Weekly resets Monday 00:00 UTC, Monthly on the 1st at 00:00 UTC. **Daily is added later** as the main focus once activity grows. |
| D3 | Display names | **On chain**, tied to the wallet through `PlayerProfileRegistry`. Players pay the gas for each change. |
| D4 | Past runs | **None carry over.** The new contracts are a full reset. |
| D5 | Achievements vs NFTs | **Hybrid:** most achievements are unlocked and stored on the server; a **select few high-tier achievements per game** are soulbound NFTs minted on unlock. |
| D6 | Badge art | **Recommended** existing badges at launch. The owner will soon upgrade all badge art and make the NFT achievements spectacular: **highly detailed 3D models with effects**. Metadata must be ready for that (section 5.6 item 6). |
| D7 | Catalog sizes | **40 for Chikun's Escape and 40 for STACKED**, spread bronze → platinum by difficulty. |
| D8 | Unlockables | **Yes to everything proposed:** HMH hero/weapon skins; Chikun coats, trails, hats; STACKED piece skins and scenes; unlocks work in Free Mode too. |
| D9 | Mobile wallets | **Whatever makes it smoother, especially on mobile:** WalletConnect/Reown AppKit plus wallet deep links (section 5.9). Needs the Reown project ID. |
| D10 | Failed publishes | **Recommended:** auto-retry, retry button on the profile, no refunds on testnet. |
| D11 | Chikun run length | **Retune difficulty.** Targets: beginner–intermediate 2–6 min, intermediate–expert 6–8 min, expert–hardcore 8–12 min; surviving past 15 min should be extraordinary. This is the frame of reference for the level's difficulty and pacing. |
| D12 | X handle to mention | **`@LestersArcade`** (https://x.com/LestersArcade). The owner watches its mentions to engage with players. |
| D13 | Hashtags on X | **None.** Characters are reserved for the player's session, the game and Lester's Arcade. |
| D14 | Local-chain rehearsal | **Recommended:** Hardhat dev dependency and a full local rehearsal before LiteForge. The goal is a fully operational Lester's Arcade on LiteForge testnet. |
| D15 | Soulbound NFTs | **Deferred to phase 2.** Launch with server-recorded achievements; the three collections deploy empty and NFTs are defined, minted and backfilled later without a redeploy. |

## 10. Owner actions

1. Back up `C:\Users\just_\lesters-arcade-vault\keys\litvm-liteforge-testnet-keys.json` to a thumb drive and a password manager. **The operator key controls the contracts.**
2. Review the Chikun and STACKED achievement catalogs (40 each) when the session presents them. The NFT subset waits for phase 2.
3. **Create a free Reown project** for mobile wallet sign-in (D9): sign up at https://cloud.reown.com, create a project named "Lester's Arcade", add `lestersarcade.io` and `www.lestersarcade.io` under allowed domains, and send the project ID to the session. The ID is public, not a secret.
4. At deployment:
   - switch the session to "ask before each action" mode;
   - approve each ⚠ step;
   - sign the three payout-wallet confirmations from your wallet;
   - fund a test player wallet with about 0.35 zkLTC for the live end-to-end check (or let the session use a fresh test key that you fund).

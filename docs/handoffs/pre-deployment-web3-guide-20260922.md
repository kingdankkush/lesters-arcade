# Pre-deployment guide: Web3, Ranked, profiles, leaderboards, achievements and sharing

**Written:** 2026-09-22
**For:** a fresh session that finishes everything needed before the LitVM smart contracts are deployed, then deploys them.
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

- One **Sign in** button. A wallet picker lists installed wallets (EIP-6963), with MetaMask and Rabby featured. On mobile it falls back to WalletConnect if that is approved (decision D9).
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
  5. Achievements minted.
- **Achievements earned this run:** badge art with tier colour, shown as "minting…" then "minted", each linking to the token.
- **Actions:** **Share on X** is the primary button. Copy for Discord and Facebook sit in a secondary menu. Then Play again (Ranked), Practice (Free) and View profile.
- **Failure states:** "Saved; publishing will retry automatically" with a Retry button. Never a dead end, never a fake success.

### 3.4 Sharing looks good, with X as the focus

- X posts mention **@LestersArcade** (decision D12 confirms the exact handle).
- Every Ranked share links to a **public session page** at `https://lestersarcade.io/s/<sessionId>`. That page has its own dynamically generated **1200×630 score card image** in its Open Graph and Twitter card tags, so X, Discord and Facebook all unfurl a proper card. The card shows game key art, score, standing, the headline stats, the player handle and a "Verified on LitVM" badge.
- The page shows the verified run, the transaction link, earned badges and a **Play** button.
- Text templates live in section 5.12.

### 3.5 Profiles and leaderboards are accurate and wallet-based

- A **public profile for every wallet** at `/profile/<wallet>`: handle, avatar, per-game best scores and ranks, Ranked runs played, recent verified sessions with transaction links, and the soulbound achievement collection read from chain.
- All stats come from **verified sessions only**. The player can edit only their handle, avatar and preferences.
- **Global leaderboards** per game and per period (daily, weekly, monthly, yearly, all-time), best score per wallet. The data comes from the server index with transaction proof per row, is paginated, searchable, and fast on phones.

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
   - `verified_sessions`: session_id (pk), wallet, game_id, score, stats jsonb, runtime_id, season_id, period keys (day/week/month/year UTC), achievements text[], tx_hash, block_number, status, created_at, confirmed_at.
   - `session_evidence`: session_id, evidence bytea or text, digest.
   - `wallet_profiles`: wallet, handle unique citext, avatar, preferences jsonb, handle_changed_at.
   - `achievement_holdings`: wallet, game_id, achievement_id, token_id, tx_hash.
   - `settle_queue` and `rate_limits` as needed.
   - Indexes: `(game_id, season_id, score desc)`, `(wallet, game_id)`, and the period keys.
2. **`GET /api/leaderboard?game=&period=&page=&q=`.** Best per wallet (decision D1), ties by earliest `confirmed_at`, 25 rows per page. Each row carries handle, shortened wallet, score, headline stats, tx hash and date. Cache with `s-maxage=15, stale-while-revalidate=60`.
3. **`GET /api/profile?wallet=` becomes public and server-derived.** It returns editable fields plus per-game bests and ranks, run counts, recent sessions (with tx) and holdings. `PUT` accepts only handle, avatar and preferences.
4. **Backfill cron** (`/api/cron/index-chain`, every 5 minutes, protected by `CRON_SECRET`). It reads `ScoreSubmitted` / `SessionSubmitted` and `AchievementUnlocked` events since the last indexed block, and upserts rows. This covers player-signed fallback submissions and any missed writes. Events exist at `ScoreSubmissionRegistry.sol:82-94` and `AchievementRegistry.sol:39-41`.
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
6. **Lift the 4,096-flap cap.** It kills runs at about 43 minutes (`chikun-ground-runtime.mjs:27`), and a capped result nearly fills the 64 KB bridge limit. Chunk the evidence like STACKED does, or delta-encode the flap ticks.
7. Keep the evidence locally until settlement is confirmed, so a failed publish can retry after a reload.
8. Update the copy on the child result overlay and in the parent.

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

### 5.6 Soulbound achievements (P0)

**Today:**

- The deploy script **never calls `defineAchievement`**, so every mint is silently skipped (`AchievementRegistry.sol:133-136`).
- Hard Money Heroes has 57 achievements (`arcade-core.mjs:1509-1572`): bronze 10, silver 10, gold 12, platinum 13, diamond 6, mythic 6.
- Chikun has 4 (`chikun-cabinet.mjs:50-55`), which are not in the main table.
- STACKED has none for Ranked play, only 16 device-local Free medals (`apps/stacked/src/free-medals.mjs:5-22`).
- No metadata JSON exists anywhere. There are 100 badge PNGs under `apps/portal/assets/generated/achievement-badges/`.

**Build:**

1. **One catalog module per game** with a `gameId` field (for example `apps/portal/src/achievements/{hmh,chikun,stacked}.mjs`), shared by browser and server. Each entry: id, gameId, title, description, tier, criteria as a pure function of verified stats plus the wallet's verified history, and image.
2. **Draft catalogs** for Chikun and STACKED, about 12 each, spread bronze → platinum. Get owner approval (decision D7).
   - Chikun ideas: reach each region; complete a lap; complete two laps; a near-miss streak; a coin haul; survive at 150% speed.
   - STACKED ideas: first Halving; levels 5, 10 and 15; a perfect clear; a combo streak; a back-to-back chain; 100 and 500 lines; 15 minutes survived.
3. **Server derivation.** `/api/settle` computes earned achievements from the replayed stats and the wallet's verified history in Neon, excluding ones already held. Cap at 32 per submit (the contract limit). Queue the rest, and mint them later through a relayer allowed as minter (`AchievementRegistry.setMinter`) using `mintFor(player, id, sessionId)`. That also handles backfill.
4. **Deploy script.** For each game, after deploying its collection, call `defineAchievement(id, gameId, title, category, tokenUriPath)` for every catalog entry. Record it in the manifest.
5. **Metadata hosting.** Generate `apps/portal/achievements/<slug>/<achievement-id>.json` with ERC-721 metadata:
   - name, description and image (`https://lestersarcade.io/achievements/<slug>/img/<id>.png`);
   - attributes: game, tier, category, "Soulbound: yes", season "LiteForge testnet".
   - Add a build step so the owner's final illustrations can replace images with no re-mint. The base URI is updatable with `setBaseTokenUri`.
6. **Display.** The profile reads holdings from chain (`fetchPlayerAchievements`, currently imported but never called) or from the Neon mirror. Remove the "device-local … not NFTs" copy (`official-profile-route.mjs:56`).

### 5.7 Profiles (P1)

- Add a public `/profile/<wallet>` route. The current profile route shows only the connected wallet's device state (`official-profile-route.mjs:134-147`).
- Stats come from `/api/profile` (server-derived). Drop client-pushed xp, run counts, achievements and runHistory from the hosted document. They are spoofable today (`profile-sync-client.mjs:72-81`), and they gate HMH character unlocks (`hmh-character-config.mjs:218-227`). Character unlocks should read verified run counts.
- **Handles** (decision D3): unique, 3–18 characters, a profanity filter, changeable once a week. Show the handle on leaderboards, results and share cards, with a shortened wallet as the fallback.
- Leave `PlayerProfileRegistry` unused for now unless the owner chooses on-chain names.

### 5.8 Leaderboards UI (P1)

- Switch the Scores page (`leaderboard-view.mjs`, `routes/official-leaderboard-route.mjs`) to `/api/leaderboard`, keeping the existing banners, tabs, search and jump-to-rank.
- Retire the 200-session chain scan (`litvm-chain-client.mjs:326-337`), or keep it only as an offline fallback.
- Show a per-row "⛓ verified" link to the explorer transaction.
- Keep House and Local Preview as clearly labelled secondary tabs, or hide them after launch (decision D4).

### 5.9 Sign-in UX (P1)

- Show a wallet picker from the existing EIP-6963 registry, with MetaMask and Rabby featured and install links when neither is present.
- After `eth_requestAccounts`, call `wallet_addEthereumChain` / `wallet_switchEthereumChain` for chain 4441 with a single explainer. Today the chain switch is deferred to the Ranked modal (`main.js:6248`).
- Replace the SIWE statement with plain language (`wallet-auth.mjs:36+`), and use the server nonce from section 5.1.
- Silent re-auth: on load, if `eth_accounts` returns the same wallet and the stored session token is valid, skip the signature.
- Show a balance chip with a faucet link (`https://liteforge.hub.caldera.xyz`).
- **WalletConnect for mobile** (decision D9): needs a Reown project ID from the owner and an allowed-origins entry. Load it lazily.

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

1. **X is primary.** Use `https://x.com/intent/post` with `text` and `url`, and put `@LestersArcade` in the text. Optionally add `related=LestersArcade` so X suggests following the account after posting. Skip `via`, which would duplicate the mention.
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

   A new personal best adds a `🔥 New personal best!` line. Free runs use a lighter template ending "Practising on @LestersArcade" with no verification line. Hashtags (`#Litecoin #LitVM`) are optional per decision D13, added only when characters allow.
3. **Share page `/s/<sessionId>`.**
   - Add a Vercel rewrite to a lightweight page that reads `/api/session/<id>` (from Neon).
   - It shows the score card, stats, standing, badges, the transaction link and **Play** buttons.
   - It must set `og:title`, `og:description`, `og:image`, `twitter:card=summary_large_image` and `twitter:site=@LestersArcade`. X reads these from server-rendered HTML, so render the tags in a function, not in client JavaScript.
4. **Score card image.** `/api/share-card/<sessionId>.png` renders 1200×630 with `@vercel/og` (Satori, new dependency). It shows game key art as the background, the score, handle, standing, three headline stats, earned badges and "Verified on LitVM". Cache it immutably once the session is confirmed.
5. **Facebook and Discord:** secondary. Facebook's sharer takes the share-page URL and shows the card. Discord gets copied text plus the URL, which unfurls the card. The native share sheet (mobile) passes the same text and URL.
6. **Tests:** template length under 280 with a 23-character URL, the mention present, no raw wallet addresses in text, and OG tags present on the share page.

### 5.13 Unlockables (P2, after owner decision D8)

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
6. **Local chain rehearsal (recommended).** Add Hardhat or Anvil as a dev tool and rehearse the full deploy → entry → settle → mint flow locally before touching LiteForge. Foundry is not installed; the forge `SecurityBaseline.t.sol` suite has never run. Get owner approval before installing tools.

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
| 2 | Achievement catalogs for all three games + shared resolver fixes (5.5 item 2, 5.6 items 1–2) | D5, D7 |
| 3 | Neon schema + migrations + read APIs (5.2) | — |
| 4 | Server nonce, authenticated settle, server replay, derivation, nonce-safe relayer, queue and cron (5.1, 5.6 item 3) | 2, 3 |
| 5 | Chikun Ranked path (5.3) | 4 |
| 6 | STACKED Ranked path (5.4) | 4 |
| 7 | HMH settlement on the new flow + fixes (5.5) | 4 |
| 8 | Sign-in and Ranked entry UX (5.9, 5.10) | D9 |
| 9 | Shared Ranked results screen (5.11) | 5–7 |
| 10 | Sharing: templates, share page, OG card (5.12) | 3, D12, D13 |
| 11 | Profiles and leaderboards UI on the index (5.7, 5.8) | 3, D1–D4 |
| 12 | Deploy-script updates, metadata JSON, generated addresses, owner page (5.6 items 4–5, 5.14) | 2 |
| 13 | Local-chain rehearsal (5.14 item 6) | 12 |
| 14 | Unlockables (5.13) | D8 |
| 15 | Deployment (section 7) | all of the above |

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
   - achievements minted, with `tokenURI` resolving to metadata and an image;
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

> **Status: answers pending.** Justin is posting answers; record them here and treat the recommendation as the default for any decision still blank.

| # | Decision | Recommendation | Answer |
| --- | --- | --- | --- |
| D1 | Leaderboard ranking | Best score per wallet, per game, per period; ties go to whoever got there first. | _pending_ |
| D2 | Period resets | Daily at 00:00 UTC; weekly on Monday 00:00 UTC; calendar months and years in UTC. | _pending_ |
| D3 | Display names | Free unique off-chain names, 3–18 characters, filtered, changeable once a week. | _pending_ |
| D4 | Past runs and preview boards | Only runs published after launch count. Local preview runs stay on the device, and preview tabs are hidden after launch. | _pending_ |
| D5 | Which achievements become NFTs | Every achievement, one soulbound token per wallet each. | _pending_ |
| D6 | Badge art until the owner's illustrations arrive | Launch with the existing 100 badge images; swap art later without re-minting. | _pending_ |
| D7 | Chikun and STACKED achievement lists | Session drafts about 12 per game (bronze → platinum), owner reviews before deploy. | _pending_ |
| D8 | Unlockables | HMH hero/weapon skins; Chikun coats, trails, hats; STACKED piece skins and scenes; unlocks apply in Free Mode too. | _pending_ |
| D9 | Mobile wallets | Add WalletConnect; owner creates a free Reown project and supplies the project ID. | _pending_ |
| D10 | Failed publishes | Auto-retry, retry button on the profile, no refunds on testnet. | _pending_ |
| D11 | HMH verification level | Plausibility-checked (no server replay) for testnet; no special UI label. | _pending_ |
| D12 | X handle to mention | `@LestersArcade`; owner confirms the exact handle and that the account exists. | _pending_ |
| D13 | Hashtags on X | `#Litecoin #LitVM` only when characters allow; never more than two. | _pending_ |
| D14 | Long Chikun runs | Lift the ~43-minute cap. | _pending_ |
| D15 | Local-chain rehearsal tooling | Add Hardhat (npm dev dependency) for a local rehearsal before LiteForge. | _pending_ |

---

## 10. Owner actions

1. Back up `C:\Users\just_\lesters-arcade-vault\keys\litvm-liteforge-testnet-keys.json` to a thumb drive and a password manager. **The operator key controls the contracts.**
2. Answer section 9.
3. If D9 is yes: create a free project at https://cloud.reown.com, add `lestersarcade.io` and `www.lestersarcade.io` as allowed origins, and send the project ID. It is public, not a secret.
4. Confirm the X handle (D12).
5. At deployment:
   - switch the session to "ask before each action" mode;
   - approve each ⚠ step;
   - sign the three payout-wallet confirmations from your wallet;
   - fund a test player wallet with about 0.35 zkLTC for the live end-to-end check (or let the session use a fresh test key that you fund).

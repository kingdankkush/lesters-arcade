# Slice brief: ranked-client (wave 3, parallel with signin-entry, results-share, profile-boards and site-copy)

**Worktree:** `C:/Users/just_/lesters-arcade-wt/ranked-client`, branch `fable/pd-ranked-client`, based on the integration branch after waves 1 and 2 have merged.

**Read first:**
- contract `docs/handoffs/pre-deployment-interface-contract-20260922.md` (if it is missing from your worktree, read `C:/Users/just_/lesters-arcade-fable0916/docs/handoffs/pre-deployment-interface-contract-20260922.md`) §1 (A3, A9, A10, A16, A17, A18, A22, A25, A26, A27, A31, A32), §2, §4.4 (owner and public views), §5.1, §6.3, §6.4, §7.1, §7.2 (including the result context), §7.7, §9.1, §10.3 (your `main.js` ranges), §11 (rule 5 byte budgets), §14 (rows F5, S5, C13, C15);
- guide §5.3 items 1-5, 8 and 9; §5.4 (except item 4, which profile-boards owns); §5.5 items 1, 3 and 4.

## Goal

1. One game-agnostic Ranked settlement client.
2. All three games feed it from their canonical results:
   - HMH from the reboot run summary;
   - Chikun from the verified v6 evidence;
   - STACKED from the SIC1 bytes and tuple.
3. Per-game seasons in both key sites; Ranked restarts that always pay; deduped local rows; no HMH achievement leak into Chikun; truthful child copy.
4. In preview (`SETTLEMENT_LIVE=false`) everything stays network-free and local, exactly as today.

## Acceptance criteria

1. **`apps/portal/src/ranked-settlement.mjs`** implements §7.2: its API, its client state machine and pending persistence. With `live:false` it makes no fetch at all. In particular:
   - error bodies with `retryable: true` (`entry-pending`, `run-timing-early`) go to `retrying` and re-POST the full body after `max(retryAfterMs, 5 s)`; `entry-pending` gives up after 10 minutes into `saved-locally`;
   - `402 entry-not-paid` and `entry-underpaid` are terminal `rejected` (the server returns them only when the chain proves them);
   - `503 settlement-paused` is `saved-locally` with the paused message;
   - `queued` POSTs `{retry:true}` at most 20 times, then polls GET status every 15 s;
   - POSTs **and** status GETs send the Bearer token, so status responses are the owner view;
   - it dispatches `lesters:ranked-pending` `{ count }` whenever the number of unpublished persisted bodies changes (and once after boot), and handles `lesters:ranked-retry-request` `{ sessionId32|null }` (a handle's `retry()`, or `resume()` for null). Register both inside your `:1895-1955` range.

   **`apps/portal/src/ranked-requests.mjs`** implements the three §7.2 builders, producing exactly the §5.1 body, with `identity = rankedIdentityFor(session, { scoreRegistryAddress: LITVM_CONTRACT_ADDRESSES.scoreSubmissionRegistry })`, `sessionId32 = await rankedSessionKey(identity)`, `seedTicket = session.seedTicket` (signin-entry applies it before the entry, A25) and `entryTxHash = session.entryReceipt?.txHash ?? null`. A builder throws when live and `session.seedTicket` is missing. Both modules are lazy-loaded from `main.js` with `import()`.
2. **One identity helper (A10).** `currentCanonicalSessionIdentity()` (`main.js:2831-2841`) returns `rankedIdentityFor(currentSession, …)`, so the `seasonId: CURRENT_RANKED_SEASON_ID` override is gone. The entry site at `:5578` belongs to signin-entry, which makes the same change. A test asserts that the key built at settlement equals the key built at entry for each game, using the builders and `rankedIdentityFor` on the same session.
3. **HMH** (`submitCombatGameOver` `:2889-2964`, `settleRankedRun` `:2971-3171`):
   - Local `recordScore` inputs come from `hmhResolverInputsFromRunSummary(lastHmhRunSummary)` (achievements slice), not the stale `combat.*` legacy fields (HMH map §3.6 and G1).
   - `lastRunStatsForSettlement` comes from the summary.
   - The envelope's `finalState` comes from the summary totals: `{hp:0, score, kills, maxCombo, survivalSeconds, level: totals.level, bossKills: kills.boss, characterId: identity.heroId, killedBy: defeat.causeId}`.
   - `lastSettlement*` resets at the start of every run (reboot path included).
   - HMH evidence never overflows its caps. Stop recording one gameplay event per enemy kill in the reboot bridge (`:5138-5165`): the server does not verify events, and the 10,000-event cap makes `finalizeSessionEvidence` throw on long runs. Keep the boss-defeated and score-result events.
   - When live, build the request with `buildHmhSettleRequest` and start the settlement handle. **No player-signed submit and no `/api/attest` call remain** (A3).
4. **Chikun:**
   - `createChikunPortalLifecycle` returns, in addition to today's fields, `settlementInput` (from `recordScoreRef`) and `evidence` (the verified v6 evidence object from the replay claim).
   - `mountChikunSession` `onComplete` (`:5233-5246`) builds `buildChikunSettleRequest` and starts settlement for Ranked sessions.
   - `restartChikunSession` (`:5208-5213`) calls `startOfficialMode('ranked')` for a finished Ranked run (A16), and restarts Free as today.
5. **STACKED:**
   - `mountStackedSession` `persistRanked` (`:1922-1926`) still records the local archive through `persistStackedScore`. It also writes the replay store: `createStackedReplayStore(localStorage).write({ sessionId, score, encoded: base64url, mode:'ranked', resultHash: evidenceDigest })`, where `resultHash` is the host's `'0x'+sha256` digest. Pass it through `stacked-portal-lifecycle.mjs` metadata from `stacked-host.mjs`, and do not recompute it.
   - Then it builds `buildStackedSettleRequest` and starts settlement.
   - Bodies over 240,000 base64 characters are not persisted (§7.2).
   - `onResult` (`:1918-1921`) no longer says "Online settlement is disabled".
   - **Restart pays (A16):** the STACKED `onRestart` (`:1927`, today `setOfficialView('mode-select')`) calls `startOfficialMode('ranked')` for a finished Ranked run, and restarts Free as today. Test it.
   - The `stacked-host.mjs:65` Ranked copy is truthful in both modes, at most 512 characters:
     - live: "Replay verified. Publishing your run on LitVM — see the results panel."
     - preview: "Replay verified. Ranked preview: nothing is published while online settlement is off."

     The host learns the mode through a new optional `settlementLive` option.
6. **Restart pays (A16).** HMH `restartCombatRun` (`:4111-4147`) for a Ranked run calls `startOfficialMode('ranked')` (reboot and legacy branches). Free restart behaviour is unchanged.
7. **Results hand-off (A18).** After each Ranked run (preview included), dispatch `lesters:ranked-run` with the §7.7 detail:
   - `handle`: the settlement handle, whose state is `preview` when not live;
   - `context.localStats`: `statsFrom*` from the local canonical result;
   - `context.displayName` and `context.previousBest` (§7.2 result context): in hosted mode from one `GET /api/profile?wallet=` (public view: `profile.displayName`, `games[g].bestScore`) fetched when the Ranked run starts (in `startMode`, `:6301-6320`); in preview from local state, recomputed in your own code without touching results-share's `currentPlayerBestScoreForMode`. A device-local best is never used in hosted mode, so the results screen never shows a false "New personal best";
   - `actions`:
     - `playAgainRanked` → `startOfficialMode('ranked')`;
     - `practiceFree` → `startOfficialMode('free')`;
     - `viewProfile` → `setOfficialView('profile')`;
     - `backToArcade` → `exitToArcade()`.

   Do **not** import `ranked-results.mjs` (results-share owns it).
8. **Resume.** When `SETTLEMENT_LIVE` is true and the event `lesters:wallet-session` reports `authenticated:true`, call `client.resume()` once per page load. Register the listener inside your `:1895-1955` range.
9. **Dedup (guide §5.5 item 4).**
   - `arcade-core.mjs` `applySettlement` (`:5802-5868`) stamps `onChainSessionId32` (the session key) on the flat leaderboard row, the cadence rows and the `officialSessions` row.
   - `mergeChainRecordIntoState` (`:4833-4891`) skips a chain record when any local row has `onChainSessionId32 === rec.sessionId32`.
   - Keep `tests/hmh-chain-hydration-provenance.test.mjs` green. Its VM context whitelists identifiers, so use only `state` and `recordCadenceScore`, or add names to its context in the same commit.
   - `recordScore` `settlementInput.runtimeId` = `RANKED_GAMES[gameId].runtimeId`.
10. **Copy.** Every string must be true in both preview and live modes:
    - Chikun overlay Ranked copy (`apps/chikun/src/main.mjs:467-537`, only the Ranked eyebrow and copy): "Ranked run sent to Lester's Arcade for verification."
    - STACKED child: `main.mjs:204` `'RANKED PREVIEW'` → `'RANKED'`; `:260`; `:108`; `:76` (the 15-minute pause allowance copy stays accurate).
    - `apps/portal/stacked/index.html:55` "Local ledger" → "Verified runs".
    - The STACKED mode descriptor in `arcade-core.mjs:589-611`.

    Watch the STACKED entry-JS cap: 29,000 B, and the real baseline at `06ebe4ca` is **27,756 B** (the 26,277 B comment in `stacked-contracts.mjs:84` is stale), so only 1,244 B remain for every slice. Your net entry growth is ≤ 400 B (results-share has 300 B, unlockables 400 B). Record the measured delta in your final commit message.
11. **Chikun leak.** Confirm no HMH achievement ids reach Chikun runs (the achievements slice gated `maybeUnlockRunAchievements`). Add a portal-level regression test.
12. **Preview parity.** With both flags false:
    - Ranked HMH, Chikun and STACKED behave like today (the local record, the "Canonical Ranked preview saved locally…" status text), except that the results screen now opens in `preview`;
    - zero `/api` requests and zero RPC calls, proved by a VM or unit test with a fetch spy.

## Files

- **You own:** contract §10.2 row ranked-client, and §10.3 ranges only.
- **Read-only:** everything else. In particular:
  - `main.js` outside your ranges;
  - `share-links.mjs` and `main.js:2621-2824` (results-share);
  - `requestRankedEntry` and the wallet functions (signin-entry);
  - the leaderboard and profile routes and `official-leaderboard-route.mjs` (profile-boards, including `sourceForGame`);
  - `server/**`, `api/**`, `sdk/**`, `apps/hmh-reboot/**`.

## Interfaces

- **Produced:** §7.2 (the client and builders); the `lesters:ranked-run` event; `session`-level `entryReceipt` consumption.
- **Consumed:**
  - §7.1 `ranked-identity.mjs` (verify);
  - §6.3 and §6.4 `stats.mjs` (achievements);
  - §4.3.3, §4.3.4 and §4.4 (settle);
  - `session.entryReceipt` and `session.entryConfirmed` (signin-entry, A17). Code against the contract: absent means `status:'none'`.

## Plan

1. `ranked-settlement.mjs` and `ranked-requests.mjs`, with pure tests (`tests/ranked-settlement-client.test.mjs`: every state transition in §7.2 with a scripted fake fetch and fake timers; "preview never fetches"; "401 saves locally with sign-in-required"; "entry-pending retries and keeps the body"; "an early settle waits retryAfterMs and retries"; "entry-not-paid and entry-underpaid are final"; "paused publishing saves locally with the paused message"; "queued runs fall back to status polling after twenty retries"; "pending requests persist and resume after reload"; "pending count and retry-request events drive retries"; "oversize STACKED bodies are not persisted"; "Bearer token on POST and status GET"; "every request uses no-store"). `tests/ranked-requests.test.mjs`: "builders produce the settle body with per-game season, ticket, entry hash and matching session key"; "entry and settlement keys match for all three games after a seed ticket is applied"; "builders refuse a live session without a ticket"; "chikun, stacked and hmh evidence encodings match the contract". Commit.
2. `main.js` identity and HMH (acceptance 2, 3, 6). Keep the pinned literals:
   - `if (!SETTLEMENT_LIVE)` and `Canonical Ranked preview saved locally` (`tests/ship-readiness.test.mjs`);
   - `finalizeSessionEvidence(`, `recordSessionEvent(currentSession.evidence`, `saveActiveSessionCheckpoint(`, `clearActiveSessionCheckpoint(` (`tests/session-integrity.test.mjs`);
   - `retryPublishGameOver` (it now calls `handle.retry()`);
   - `combat.gameOverSubmitted`;
   - `submitCombatGameOver` (`tests/arcade-core.test.mjs:2880`);
   - `finalizeRanked: ({ runSummary }) => submitCombatGameOver(runSummary)` (`tests/hmh-reboot-portal-lifecycle.test.mjs:149`).

   The same test file pins the restart `beginTrackedSession` line; update that regex in the same commit as the restart change. Update `tests/hmh-reboot-restart-authority.test.mjs` only if the Free path changes (it should not). Commit.
3. Chikun (acceptance 4) and `tests/chikun-portal-lifecycle.test.mjs` (add "ranked result carries settlementInput and verified v6 evidence"). Commit.
4. STACKED (acceptance 5), the host/lifecycle metadata digest, and tests (`tests/stacked-ranked-settlement.test.mjs`: "persistRanked writes the replay store with the evidence digest and builds the settle body"; "ranked copy is truthful in preview and live"; "a finished Ranked STACKED run restarts through a paid entry"). Commit.
5. Dedup and `applySettlement` stamping. Test: "a settled local row and its chain record appear once". Commit.
6. Copy updates in the children and the mode descriptor. Update `tests/stacked-public-beta.test.mjs` (the "beta mode selection explicitly discloses…" assertions become "truthful Ranked copy in preview and live"; keep the other tests). Check `npm run build` for the STACKED entry cap. Commit.
7. **The audit.** `scripts/hmh-web3-settlement-audit.mjs` and `tests/hmh-web3-settlement-audit.test.mjs`:
   - drop the required literals `submitRankedSession(provider` and `fetchGlobalLeaderboard` (the latter is profile-boards' retirement);
   - require `createRankedSettlementClient`, `rankedIdentityFor(` and `lesters:ranked-run` instead;
   - leave the contracts slice's `safe-ranked-live-gate` logic intact.
8. Register the new files in `scripts/syntax-check.mjs` immediately after `"apps/portal/src/session-integrity.mjs",`.

## Verification

```
node --test tests/ranked-*.test.mjs tests/chikun-portal-lifecycle.test.mjs tests/stacked-*.test.mjs tests/hmh-reboot-*.test.mjs tests/session-integrity.test.mjs tests/ship-readiness.test.mjs tests/hmh-web3-settlement-audit.test.mjs tests/hmh-chain-hydration-provenance.test.mjs tests/arcade-core.test.mjs
npm test && npm run check && npm run contracts:check && npm run build && npm run test:release   # exactly 51
```

**Browser**, with `apps/portal` as the web root (`python -m http.server 8803 --directory apps/portal`), both flags false:
1. Play one Ranked run in each game with the simulated wallet flow, or with the Chikun smoke's stub-provider approach.
2. Confirm the preview results screen event fires (listen in DevTools: `addEventListener('lesters:ranked-run', console.log)`, because results-share's UI is not in your branch).
3. Confirm no `/api` or RPC request appears in the Network panel, and the console is clean.
4. Ranked restart shows the entry modal again.

## Pitfalls

- **VM-executed tests whitelist identifiers** (`tests/ranked-entry-preflight.test.mjs`, `tests/hmh-chain-hydration-provenance.test.mjs`, `tests/hmh-reboot-restart-authority.test.mjs`, `tests/hmh-reboot-player-flow.test.mjs`). A new identifier on an executed path must be added to that test's context.
- **`recordStackedScore` replays a second time on the main thread and throws on duplicates.** Never call it twice for one session; a retry must go through the settlement handle.
- **`stacked-replay-store`** keeps only 2 records (newest and best), so a third run can evict an unconfirmed one. The pending body in `ranked-settlement` storage is the retry source. The replay store is a secondary copy.
- **`chikun-host.mjs` `game:error` destroys the iframe.** Do not route settlement errors through it.
- **Do not touch `main.js:2621-2824`** (results-share), or `requestRankedEntry` and the wallet code (signin-entry). Coordinate through events and the session fields only.
- **Leave unused import names on `main.js:1-316`** (the browser-e2e slice does import hygiene in wave 4b).
- **`lastSettlementTxUrl` is never read today.** Either drop it or let the results screen show links, but do not render the explorer link twice.

## Definition of done

- Acceptance criteria 1-12 hold, with preview parity proved by tests.
- The gate shows exactly 51. Do not commit the gate JSON.
- The HMH and STACKED bundle budgets pass. The syntax-check entries are added.
- The final commit message lists every smoke assertion now outdated. At least these; the browser-e2e slice updates them:
  - Chikun smoke: "accepted for your profile";
  - Chikun smoke: local leaderboard rows;
  - Chikun smoke: `/Replay Verified Ranked/` share text.

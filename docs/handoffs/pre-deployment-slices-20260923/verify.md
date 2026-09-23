# Slice brief: verify (wave 2, parallel with settle; merged first)

**Worktree:** `C:/Users/just_/lesters-arcade-wt/verify`, branch `fable/pd-verify`, based on the integration branch after all of wave 1 has merged (chikun-tune, achievements, index, contracts).

**Read first:**
- contract `docs/handoffs/pre-deployment-interface-contract-20260922.md` (if it is missing from your worktree, read `C:/Users/just_/lesters-arcade-fable0916/docs/handoffs/pre-deployment-interface-contract-20260922.md`) §1 (A9, A10, A11, A12, A25, A26), §2 (all, especially §2.3 and §2.7), §5 (all), §6.3, §7.1, §10, §11, §14 (rows S1, S16, F1, F4, F8);
- guide §5.1 items 4-6 and 12, and §5.5 item 1.

## Goal

1. Pure server verifiers, one per game, that turn a settle request body (§5.1) into the canonical **VerifiedRun** (§5.3) or a precise rejection:
   - Chikun: server replay of the v6 flap evidence;
   - STACKED: server replay of SIC1;
   - HMH: run-summary validation plus a **reboot-calibrated** plausibility check, with the session-envelope binding.
2. The seed-ticket primitives (A25, §2.7): `deriveRankedSeed`, and the server's `issueSeedTicket` / `checkSeedTicket`.
3. The shared `ranked-identity.mjs` that the browser and server use for session keys, share ids, the v2 envelope hash and applying a seed ticket.

## Acceptance criteria

1. **`apps/portal/src/session-seed.mjs`** exports:
   - a `deriveSessionSeed` byte-identical to `arcade-core.mjs:5302-5311`;
   - `async deriveRankedSeed({ sessionId, wallet, gameId, seasonId, buildHash, salt })` per §2.7 (first 32 bits of `sha256Hex(canonicalSessionJson({ v:'lesters-ranked-seed-v1', … }))`, `>>> 0`). It imports only `session-integrity.mjs`.

   `arcade-core.mjs` replaces its function with **exactly** this form, because `startPlaySession` (`:5353`) calls it and needs a local binding:
   ```
   import { deriveSessionSeed } from './session-seed.mjs';
   export { deriveSessionSeed };
   ```
   A bare `export { deriveSessionSeed } from …` would throw a `ReferenceError` in every session start. The existing seed tests pass unchanged. New tests pin `deriveSessionSeed({sessionId:'la-000001', gameId:'chikun', seasonId:'chikun-season-preview-1', buildHash:'site-1.7.0:game-1.7.0:cabinet-0.8.0'}) === 561861267`, one `deriveRankedSeed` fixture value, and that `startPlaySession` still returns an integer seed.
2. **`server/verify/seed-ticket.mjs`** exports `issueSeedTicket({ crypto, secret, nowMs, randomBytes, sessionId, wallet, gameId, seasonId, buildHash }) → { seedTicket, seed }` and `checkSeedTicket(seedTicket, { crypto, secret, nowMs, sessionId, wallet, gameId, seasonId, buildHash }) → { ok, error }` per §2.7: MAC over the exact pipe-joined string, `timingSafeEqual`, `issuedAt ≤ now + 60 s`, 32-hex salt, 64-hex MAC. Settle's E15 imports `issueSeedTicket` after it rebases onto you.
3. **`apps/portal/src/ranked-identity.mjs`** implements §7.1 exactly, including `applySeedTicket(session, { seed, seedTicket })`. It imports only `session-integrity.mjs` and `session-seed.mjs`; there is no DOM and no `process` access.
   - `RANKED_GAMES` values equal §2.1 and §2.2.
   - Tests assert:
     - `RANKED_GAMES[g].seasonId === getPlaySessionIdentity(g).seasonId` for all three games;
     - `RANKED_GAMES.chikun.runtimeId === 'chikun:' + CHIKUN_RUNTIME_VERSION` (`'chikun:canvas-runtime-v7'` after chikun-tune);
     - every `ethers.id` value in the §2 tables.
   - `rankedIdentityFor(session, { chainId, scoreRegistryAddress })` takes `seasonId` from `session.seasonId` (**never** `CURRENT_RANKED_SEASON_ID`), `seed` from `session.seed` and `nonce` from `session.sessionNonce`. It returns exactly the 9 keys of §2.4.
   - `rankedSessionKey(identity)` equals `createCanonicalSessionIdentity(identity).sessionKey`.
   - `applySeedTicket` replaces `session.seed` and `session.canonicalContext.seed` (a new frozen object) and sets `session.seedTicket`; the key built afterwards uses the ticket seed.
4. **`server/verify/index.mjs`** exports:
   - `bindRankedIdentity(body, { chainId, scoreRegistryAddress, wallet, nowMs, seedSecret, crypto })` (§5.2): every identity check and error code in order, then the ticket (`seed-ticket-invalid`), the ticket seed (`identity-seed-mismatch`) and the session key. No replay. Settle calls it **before** the paid check (§4.3.3 step 7).
   - `verifyRankedRun(body, { …, bound })` (§5.3): binds first unless `bound` is given, then dispatches per game.
   - `computeEvidenceDigest(body)` returning `{ encoding, text, bytes, digest }` **without** replaying (settle's idempotency check needs it).
   - `reverifyStoredRun({ gameId, identity, evidence: { encoding, text } })`: replays or re-checks stored evidence without the ticket, paid and timing checks, and returns the same VerifiedRun (settle's re-sign rule, §3.3).
5. **`server/verify/chikun.mjs`**, **`server/verify/stacked.mjs`** and **`server/verify/hmh.mjs`** each implement their §5.3 bullet, returning the §5.3 VerifiedRun with:
   - `stats` from `apps/portal/src/achievements/stats.mjs` (achievements slice);
   - contract fields per the §5.3 mapping table, clamped per A12;
   - `score > 1e10` rejected with `score-out-of-bounds`;
   - `envelopeHash = rankedEnvelopeHash(...)`;
   - `evidence.text` exactly as §2.6 stores it.
6. **HMH plausibility is reboot-calibrated** (§5.3; feasibility review F1). Do **not** use `validateRunPlausibility` from `hmh-run-integrity.mjs`: its ceilings come from the legacy economy (`MAX_XP_PER_KILL = 115`, a level-80 hard reject) and would reject normal paid reboot runs. Write `server/verify/hmh-plausibility.mjs` `validateRebootRunPlausibility(runSummary) → { verdict:'ok'|'flagged'|'rejected', flags }`, with every ceiling derived from constants imported from the pure reboot modules (`apps/hmh-reboot/src/run-progression.mjs`, `enemy-archetypes.mjs`, `collectible-system.mjs`, `encounter-director.mjs`, `objective-rewards.mjs`; check each imports only pure helpers such as `value-guards.mjs`; if one pulls in rendering or DOM code, copy the constant with a parity test instead):
   - reject only hard impossibilities: progress with zero elapsed time; a boss kill before the boss band (`minTick 72_000`); `totals.level` inconsistent with `totals.xp` under the level curve `150 × L × (L + 1)` (levels run to 1000); XP above the ceiling from kills by role and threat (`(80 + 20 × threat)` per kill), the maximum `xpMultiplier` ranks, combo milestones (120/240/480/900) and weapon caches (160-260 each); kills above the encounter director's spawn capacity for the elapsed ticks; score above the ceiling from `(100 + 25 × threat) × maxScoreMultiplier` per kill, silver coins and objective rewards;
   - everything else near a ceiling is a soft flag: the run verifies, and the flags are returned as `plausibility` on the VerifiedRun so settle stores them in the non-public column;
   - `HMH_HERO_GATES` (hero id → required runs) is exported from `server/verify/hmh.mjs`, read from `hmh-character-config.mjs` `HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG.unlockableCharacters` (that module has no imports).

   With this, the HMH verifier no longer needs `arcade-core.mjs` at all. Keep it that way.
7. **Server replay is authoritative (A9).** Client `claim.score` is never read by the verifiers; settle stores it in `client_claim`. A mismatch is not an error.
8. **Node safety.** `node -e "import('./server/verify/index.mjs')"` works on Node 24 with no flags. A test imports it, which proves the Chikun JSON import attribute and the vendored-ethers path load in Node.
9. **Timing.** A test asserts a 10-minute Chikun v6 fixture verifies in under 1.5 s and a 15-minute STACKED fixture in under 0.5 s, on the test machine with 3× headroom. Do not pin anything tighter. Both fixtures are committed; the test only replays them.

## Files

- **You own:** contract §10.2, row verify.
- **Read-only:**
  - every game runtime (`chikun-*.mjs`, `stacked-*.mjs`, `sdk/**`, `apps/hmh-reboot/**`);
  - `achievements/**`;
  - `server/neon/**`, `server/http.mjs`, `server/config.mjs`;
  - `api/**` (settle owns `api/settle.mjs` and `api/ranked-seed.mjs`);
  - `main.js`.
- **Never edit** `stacked-sim.mjs` (purity-audited) or `stacked-contracts.mjs` (frozen, pinned).

## Interfaces

- **Produced:** §7.1 `ranked-identity.mjs` (settle, ranked-client, signin-entry and results-share consume it); `session-seed.mjs`; `seed-ticket.mjs`; `bindRankedIdentity`, `verifyRankedRun`, `computeEvidenceDigest`, `reverifyStoredRun`, `HMH_HERO_GATES` (settle consumes them); the fixtures and generators in `tests/fixtures/ranked/`, reused by settle and rehearsal.
- **Consumed:**
  - `replayChikunRun`, `decodeFlapDeltas` (chikun-tune, `chikun-cabinet.mjs`);
  - `replayStackedRun` (`stacked-sim.mjs:1019`), `createStackedRuntime`, `createStackedInputRecorder`, `decodeStackedBase64`, `assertStackedEvidenceHeader` (`stacked-evidence-transport.mjs`), `STACKED_MAX_TICKS`, `STACKED_MAX_EVIDENCE_BYTES`;
  - `validateRunSummaryPayload` (`sdk/hmh-run-summary-schema.mjs:134`);
  - `createCanonicalSessionIdentity`, `sha256Hex`, `canonicalSessionJson` (`session-integrity.mjs`);
  - `statsFrom*` (achievements).

## Plan

1. `session-seed.mjs` (both functions) and the arcade-core import-and-export, with tests. Commit.
2. `seed-ticket.mjs` with tests (`tests/server-seed-ticket.test.mjs`): "a ticket verifies for its own session and wallet only"; "tampered salt, time or MAC is rejected"; "future-dated tickets are rejected"; "the ticket seed matches deriveRankedSeed". Commit.
3. `ranked-identity.mjs`, with tests (`tests/ranked-identity.test.mjs`):
   - "ranked games table matches session identities and on-chain ids";
   - "rankedIdentityFor uses the per-game season and the session nonce";
   - "applySeedTicket replaces the seed everywhere the key reads it";
   - "session key is the canonical sha256 preimage";
   - "share ids round-trip and reject 0x-less garbage";
   - "v2 envelope hash commits to game, session, encoding and digest";
   - "sha256BytesHex matches node:crypto".
4. **Fixtures**, built by `tests/fixtures/ranked/build-fixtures.mjs` (committed). It exports reusable generators, because settle and rehearsal must rebuild evidence for their own ticket seeds and registry addresses:
   - `buildChikunEvidence({ seed, profile, maxMinutes })` using `scripts/lib/chikun-bots.mjs` (chikun-tune);
   - `buildStackedEvidence({ seed, buildHash, seasonId, topOutAtTick })`: the soak pilot never tops out on its own (`tests/stacked-soak-pilot.test.mjs` asserts ≥ 100,000 ticks; a 54,000-tick run takes about 20 s), and server replay requires `maxTicks = STACKED_MAX_TICKS` (432,000) with a terminal tuple (`stacked-sim.mjs:1019-1034`, and a `tick-ceiling` end must equal `maxTicks`). So construct `createStackedRuntime({ seed, maxTicks: STACKED_MAX_TICKS, startLevel: 1, buildHash, seasonId })` (match `replayStackedRun`'s config exactly) and `createStackedSoakPilot({ mode: 'free' })` (the pilot refuses any other mode; it only samples masks, so this is safe), record with `createStackedInputRecorder({ seed })`, run the pilot until `topOutAtTick`, then force hard drops (the hard-drop bit of the input mask; if the sim is edge-triggered, alternate hard-drop and empty ticks) until the board blocks out. The result is a short terminal run under the real `maxTicks`. Use `topOutAtTick` 3,600 for fixtures rebuilt at test time (about 1-2 s) and 54,000 only for the committed 15-minute timing fixture;
   - `buildHmhEvidence({ seed, buildHash, identity })`: a `runSummary` v6 built with `sdk/hmh-run-summary.mjs` (`createRunSummaryAccumulator({ seed, buildHash, mode:'ranked', heroId:'lit-commando' })`, realistic `recordRunKill` / `recordRunTick` calls, `finalizeRunSummary` with `terminalReason:'defeated'`), plus a `sessionEnvelope` from `finalizeSessionEvidence(...)`;
   - `buildFixtureBody({ gameId, wallet, registry, secret, salt, issuedAt, … })`: a complete §5.1 body with a real seed ticket MAC'd by a fixture `SESSION_SECRET`, the ticket seed, and evidence built at that seed.

   Committed files: `chikun-valid.json` (about 2 minutes of bot play), `chikun-10min.json` (timing), `stacked-valid.json` (`topOutAtTick` 3,600), `stacked-15min.json` (timing, `topOutAtTick` 54,000), `hmh-valid.json`, `hmh-realistic.json` (§5.3: 300 kills of threat 4-6, one `xpMultiplier` rank, a combo reaching 30, 4 weapon caches, about 18 minutes), `hmh-level-90.json` (consistent XP above level 80). Use a fixed uuid (`11111111-1111-4111-8111-111111111111`), the Hardhat account 1 wallet, the §8.1 predicted registry and `buildHash` `site-1.7.0:game-1.7.0:cabinet-0.9.0`.
5. The three verifiers, `hmh-plausibility.mjs` and `index.mjs`, with tests:
   - `tests/server-verify-chikun.test.mjs`: "valid v6 run verifies with server-derived stats and envelope"; "tampered claim score is ignored, not trusted"; "wrong seed in evidence is rejected"; "evidence copied from another wallet's ticket does not verify"; "v5 evidence is rejected for Ranked"; "malformed deltas are rejected"; "10-minute replay stays within budget".
   - `tests/server-verify-stacked.test.mjs`: "valid SIC1 replays to the canonical tuple"; "header seed mismatch is rejected"; "truncated or non-canonical base64 is rejected"; "startLevel other than 1 is rejected"; "maxCombo is clamped to the contract bound while stats keep the full value"; "score above 1e10 is rejected" (a hand-crafted tuple through the internal mapper); "15-minute replay stays within budget".
   - `tests/server-verify-hmh.test.mjs`: "valid summary and envelope verify"; "a realistic reboot run verifies"; "a run above level 80 with consistent XP verifies"; "level inconsistent with XP is rejected"; "a boss kill before the boss band is rejected"; "XP above the reboot ceiling is rejected"; "near-ceiling runs verify with flags"; "summary seed, build or mode mismatch is rejected"; "non-defeated terminal reason is rejected"; "tampered envelope hash is rejected"; "boss kill maps to the boss-liquidator id"; "hero gates match hmh-character-config".
   - `tests/server-verify-identity.test.mjs`: one test per §5.2 error code, in order (including `seed-ticket-invalid`); "wallet must equal the token wallet"; "the FNV seed is refused for a live settle"; "evidence digest is computed without replay"; "binding does no replay" (spy on the per-game modules); "stored runs re-verify to the same VerifiedRun".
6. Register the files in `scripts/syntax-check.mjs` immediately after `'apps/portal/src/verifier-attestation.mjs',`.

## Verification

```
node --test tests/ranked-identity.test.mjs tests/server-seed-ticket.test.mjs tests/server-verify-*.test.mjs tests/arcade-core.test.mjs tests/chikun-cabinet.test.mjs
npm test && npm run check && npm run contracts:check && npm run build && npm run test:release   # exactly 51
```

## Pitfalls

- **`replayStackedRun`** needs `maxTicks` equal to the client's (432,000) and exactly `config: { startLevel:1, buildHash, seasonId }`. The header seed is raw, and the tuple seed is normalized (0 becomes 1).
- **`decodeStackedBase64`** defaults to `maxBytes = 42000` (chunk size). Pass `STACKED_MAX_EVIDENCE_BYTES`.
- **`verifyChikunReplayClaim`** compares `finalState` JSON and `achievements`. The server does **not** use it. Replay the evidence with `replayChikunRun` and read `result`.
- **Keep server imports narrow.** Import `chikun-cabinet.mjs`, `stacked-sim.mjs`, `stacked-evidence-transport.mjs`, `sdk/hmh-run-summary-schema.mjs` and the pure reboot modules directly. Never import `arcade-core.mjs` or `hmh-run-integrity.mjs` from `server/verify/**`. `server/verify/index.mjs` imports the per-game modules lazily (`await import()`), so each settle only loads what it needs.
- **The HMH `sessionEnvelope.identity` includes `version` and `sessionKey`.** Compare it with the canonical identity from `createCanonicalSessionIdentity(body.identity)`.
- **Never trust `body.claim`.** Never read achievements from the body.
- **Test speed.** Tests replay committed fixtures; only small fixtures (`topOutAtTick` 3,600, 1-2 minute Chikun) are rebuilt at test time. Every file stays under 60 s.

## Definition of done

- The acceptance criteria hold, and the fixtures are committed and reproducible from `build-fixtures.mjs`.
- The gate shows exactly 51. Do not commit the gate JSON.
- Branch ready. The orchestrator merges **verify before settle**, then settle rebases onto it.

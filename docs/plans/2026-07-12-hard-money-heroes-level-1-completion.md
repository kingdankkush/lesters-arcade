# Hard Money Heroes Level 1 Completion Plan

> **For Hermes:** Execute this plan as small TDD work orders. Preserve unrelated working-tree changes. No contract deployment, transaction, address rotation, or leaderboard reset without Justin's explicit approval of the final deploy plan.

**Goal:** Ship Hard Money Heroes Level 1 as a polished, replayable, long-duration isometric score-survival game with four viable heroes, readable enemies, a unique signature boss, trustworthy session records, and a hardened free-ranked LitVM testnet path.

**Architecture:** Keep gameplay deterministic and off-chain. The browser owns immediate simulation and local Practice history. Official Ranked Testnet submissions use a canonical session envelope and hardened GameRegistry/ScoreSubmissionRegistry contracts. Paid entry, escrow, prizes, and mainnet remain disabled until a verifier and economy receive separate approval.

**Tech stack:** Canvas 2D, JavaScript ES modules, Node test runner, esbuild, Playwright/browser smoke and visual harnesses, Solidity 0.8.24, Foundry, Slither, ethers, LitVM LiteForge testnet.

---

## Release definition

Level 1 is complete when all P0 and P1 work orders below pass and the release-candidate evidence is reviewed.

The canonical Level 1 rule is:

- Open-ended score survival on the authored 100×100 Crypto Wasteland map.
- Pressure escalates continuously.
- Mini-bosses and the signature boss recur on an authored schedule.
- Defeating the boss grants rewards and opens traversal, but does not end the run.
- The run ends on player death or explicit quit.
- Elite/mastery play targets the 20–25 minute band; progression remains useful after the level-80 cap through score conversion.
- Level 2, Level 3, paid entry, tournaments, and additional cabinets stay frozen until this release gate passes.

## Evidence snapshot, 2026-07-12

| Area | Current evidence | Verdict |
| --- | --- | --- |
| World | Authored World v3, deterministic seed tour, persistent props, textured terrain, visual regression | Strong foundation |
| Heroes | Four playable identities and 8-direction core state coverage | Playable; signature mechanics and strict sprite QA remain |
| Enemies | 22 Level 1 ship rows report complete runtime coverage | Playable; native/readability and dense-swarm proof remain |
| Bosses | Three mini-boss beats plus one major boss schedule | Major boss is still an explicit temporary proxy |
| Balance | Formula snapshot reaches 30 minutes; level cap 80 and post-cap score conversion exist | No real 20–30 minute gameplay certification yet |
| Art | Global compliance 80/100; 34/38 global actors complete | Not final; strict Sprite QA fails 8/8 sampled actors |
| Audio | 25 cues, 13 sample-backed | Functional; key moments still use synth fallback |
| Security source | Static audit 0 findings, npm audit 0 vulnerabilities, sandbox 3/3, Web3 audit 9/9 | Critical source fixes largely landed; residual findings remain |
| Contract tests | Structure/compile/ABI checks pass; Foundry 15/15; Slither 0 findings across 18 contracts/63 detectors | Hardened source is green; deployed bytecode is still old |
| Deployed contracts | June 22 deployment, 13 score rows, GameRegistry has 0 games | Predates July security remediation; hardened redeploy required |
| Sessions | Local persistence, dedupe, plausibility checks, draft replay envelope | Global IDs, live input/event hashes, verifier, recovery, and attestation unfinished |

### Progress recorded 2026-07-12

- Fixed obsolete balance-report fields; elite-band kills, target level, and drop progression now render real values with regression coverage.
- Removed the active Level 1 extraction ending, extraction grade, and misleading 20-minute win copy while preserving dormant future-level extraction policy.
- Kept the existing 14:30, 20:30, and 26:30 major rematches spawning/scaling, fixed phase choreography after the first major boss, and added explicit future `major-rematch` type compatibility.
- Restored Foundry 1.7.1 and Slither 0.11.5; 15/15 Foundry tests pass and Slither reports 0 findings.
- Proved through read-only RPC calls that the June 22 contracts predate hardening and require a new testnet deployment after session/verifier completion and explicit approval.
- Prepared `docs/plans/2026-07-12-hmh-ranked-testnet-contract-migration.md`; no transactions were sent.
- WO-C01 source behavior is complete. Its 25–30 minute active browser evidence remains part of WO-C02/RC verification.

---

# P0 release blockers

## WO-C01: Reconcile Level 1 survival canon and remove extraction victory

**Objective:** Make every player-facing and runtime path agree that Level 1 is open-ended and death-only.

**Files:**
- Modify: `apps/portal/index.html`
- Modify: `apps/portal/main.js`
- Modify: `apps/portal/src/arcade-core.mjs`
- Modify: relevant campaign/objective and game-over tests under `tests/`

**Work:**
1. Add failing tests proving Level 1 never completes from the 20:00 extraction or boss defeat.
2. Replace “Reach the 20:00 extraction to win” with open-ended survival copy.
3. Prevent `syncCampaignProgression()` from spawning a run-ending Level 1 extraction.
4. Convert the extraction landmark into a non-ending boss reward, route unlock, or score-cache landmark.
5. Remove Level 1 use of the old five-minute `HMH_LEVEL_TARGETS` extraction score.
6. Make game-over summary score survival, bosses, builds, combos, and post-cap XP without a clear grade.
7. Keep Level 2/3 campaign extraction code isolated and dormant.

**Acceptance:** A 30-minute debug run continues after every boss beat; only death/quit ends it; no visible Level 1 copy promises extraction victory.

## WO-C02: Build deterministic long-run simulation and telemetry

**Objective:** Replace formula-only balance claims with repeatable 5, 10, 20, 30, and 45-minute evidence.

**Files:**
- Create: `apps/portal/src/hmh-long-run-simulator.mjs`
- Create: `tests/hmh-long-run-simulator.test.mjs`
- Create: `scripts/hmh-long-run-certification.mjs`
- Generate: `docs/qa/hard-money-heroes-long-run-certification.{json,md}`
- Modify: `package.json`

**Metrics:** hero, seed, elapsed time, level, XP, post-cap score, score, kills/minute, damage taken, health recovery, enemy family counts, concurrent enemies, projectiles, attack tokens, bosses, upgrades, rerolls, dropped/collected pickups, object counts, frame budget proxy, and terminal reason.

**Acceptance:**
- Run at least 10 deterministic seeds per hero through 30 simulated minutes.
- All four heroes remain viable; median survival/score spread stays within an approved balance band.
- Level progression remains useful through the 20–25 minute elite band.
- No unbounded array/object growth or impossible state.
- Reports contain no missing, null, NaN, or `undefined` certification values.

## WO-C03: Replace the temporary Bandit Captain proxy with a signature Level 1 boss

**Objective:** Ship one unique Level 1 boss with original art, mechanics, phases, rewards, and recurring long-run scaling.

**Files:**
- Modify: `apps/portal/src/arcade-core.mjs`
- Modify: boss/runtime sections in `apps/portal/main.js`
- Modify: animated roster and runtime manifests under `apps/portal/assets/generated/`
- Create or update boss tests under `tests/`
- Generate contact sheet and QA report under `docs/art/`

**Required boss kit:**
- Unique idle, locomotion, attack tell, attack, hit, phase transition, special, and death states in all required directions.
- At least three readable baseline attacks plus one signature super move.
- Distinct phase-two behavior, add rules, arena boundaries, health bar, reward drop, music layer, and death payoff.
- Repeat encounters scale composition and patterns, not only health.

**Acceptance:** No Level 1 boss row or runtime text calls the actor a proxy; deterministic browser captures prove telegraph, active, recovery, phase transition, death, reward, and continued survival.

## WO-C04: Certify the Level 1 ship art set

**Objective:** Make the actual Level 1 runtime actors and critical effects pass strict technical and human review.

**Files:**
- Modify: `scripts/sprite-qa.mjs`
- Modify: `tests/sprite-qa.test.mjs`
- Repair approved runtime frames/manifests under `apps/portal/assets/generated/hmh-animated-roster/`
- Generate: `assets/generated/qa/`
- Update: `docs/art/ROSTER_COVERAGE.md`, `GLOBAL_ART_CENSUS.md`, contact sheets

**Work:**
1. Add a strict mode that exits nonzero when a Level 1 ship actor fails.
2. Calibrate palette checks so intentional actor colors are allowed without hiding matte halos or pivot drift.
3. Repair matte halos, unstable foot pivots, dimension drift, and real palette violations for all four heroes and Level 1 boss/enemy samples.
4. Replace runtime-derived tells/hit/death states with native frames where repetition is visibly obvious.
5. Human-review gameplay-scale contact sheets before promotion.

**Acceptance:** 0 strict failures for the Level 1 ship roster; no copied stills masquerade as animation; no visible placeholders, matte boxes, foot sliding, or direction pops.

## WO-C05: Finalize canonical session identity and persistence

**Objective:** Give every run one collision-resistant identity and a recoverable lifecycle across parent, cabinet, local persistence, and chain submission.

**Files:**
- Modify: `apps/portal/src/arcade-core.mjs`
- Modify: `apps/portal/src/persistence.mjs`
- Modify: `apps/portal/src/arcade-sdk.mjs`
- Modify: `apps/portal/main.js`
- Modify/create session tests under `tests/`

**Canonical record:**
- Internal UUID/random 128-bit run ID.
- Deterministic bytes32 chain session ID derived from version, game, wallet or guest namespace, random run ID, and start time.
- Human display handle separate from identity; do not rely on a local global counter for uniqueness.
- Lifecycle states: created, active, paused, ended, pending-publish, published, rejected, abandoned.
- Atomic recovery for unfinished and pending-publish sessions.

**Acceptance:** No collision across fresh browser states; retry/rehydration produces exactly one official session and one row per board cadence; corrupt storage fails safely; export/delete controls are tested.

## WO-C06: Wire cryptographic replay/integrity envelopes into live runs

**Objective:** Bind official submissions to actual run metadata and prepare deterministic verifier replay.

**Files:**
- Modify: `apps/portal/src/hmh-run-integrity.mjs`
- Modify: `apps/portal/src/litvm-chain-client.mjs`
- Modify: `apps/portal/src/settlement.mjs`
- Modify: `apps/portal/main.js`
- Modify/create integrity, settlement, and ABI tests

**Envelope fields:** session ID, wallet, game ID, build hash, balance version, season, seed, hero, starting loadout, assists/settings affecting rank, survival time, score, kills, combo, boss results, upgrade history, RNG stream counters, input-log digest, event-log digest, and integrity verdict.

**Work:**
1. Replace the custom digest with Web Crypto SHA-256 or keccak-256 over canonical bytes.
2. Record bounded input/event logs or deterministic rolling digests during live play.
3. Build the envelope at game over and persist it before any wallet prompt.
4. Verify locally before publish; rejected runs never submit.
5. Keep suspicious unverified rows visibly separate from verifier-attested rows.

**Acceptance:** Mutating any bound field invalidates the digest; same seed/input stream reproduces the final summary; live ranked submission carries the canonical session identity and envelope hash.

## WO-C07: Close residual source-security findings

**Objective:** Resolve every non-deployment item still partial/open in `docs/security/REMEDIATION_LOG.md`.

**Required work:**
- Generate `IntegrityBounds.sol` from the same versioned JavaScript constants.
- Implement verifier-attested `submitVerifiedSession` using EIP-712 and `GameRegistry.trustedVerifier`.
- Add byte-equal planner/client ABI payload fixtures.
- Decide the proprietary project/SDK license split.
- Keep paid entry disabled.
- Restore Foundry and Slither locally or in CI; rerun fuzz/invariant/security gates.
- Update remediation log so every finding has a current test and status.

**Acceptance:** No Critical/High finding remains open except explicitly deferred paid/mainnet functionality that is unreachable and documented; Foundry, Slither, dependency, CSP, sandbox, settlement, and secret-log gates are green.

## WO-C08: Rewrite the canonical free-ranked testnet deploy path

**Objective:** Make deployment match the chosen free-ranked architecture instead of the current seven-module mixed path.

**Files:**
- Modify: `scripts/deploy-contracts.mjs`
- Create: `contracts/deploy-config.testnet.json`
- Create: `scripts/verify-contract-wiring.mjs`
- Modify: deploy/security tests
- Update only after approved deployment: `contracts/deployment-record.json`, runtime address config

**Recommended deployment set:**
1. Keep the existing profile registry only if bytecode/ABI remains compatible and its security behavior is acceptable; otherwise migrate it deliberately.
2. Deploy hardened GameRegistry.
3. Register Hard Money Heroes with approved developer wallet and 75/25 economy metadata, but zero paid entry.
4. Require developer-wallet confirmation and operator `setPlayable(true)`.
5. Deploy hardened ScoreSubmissionRegistry with verifier support.
6. Deploy ArcadePaymentRouter only if retained as disabled future infrastructure; do not deploy SessionLedger/PaymentRouter/TournamentPool in the free-ranked release.
7. Deploy AchievementRegistry only after its authorized caller is aligned with the chosen score/verifier path.

**Mandatory HALT:** Before transactions, present exact contracts, constructors, config, addresses, gas estimate, old/new behavior, archive/reset impact, and rollback plan to Justin.

**Migration:** Archive all 13 old testnet score records, preserve old addresses as read-only history, announce the beta reset, deploy new contracts, verify wiring by RPC readback, then update frontend addresses.

## WO-C09: Active Level 1 release-candidate certification

**Objective:** Prove the real browser game, not only source models.

**Required evidence:**
- READY activation and simulation advance.
- First 90 seconds: movement, shot, kill, XP, pickup, grenade, first upgrade.
- 5-, 10-, 20-, and 30-minute captures.
- Every mini-boss and major boss phase/death.
- All four heroes and six build archetypes.
- Death, recap, same-seed retry, new-seed retry, quit, persistence recovery.
- Desktop keyboard/mouse, gamepad, Android portrait/landscape, iOS portrait/landscape.
- p50/p95/worst frame time, long tasks, memory growth, enemies/projectiles/particles/props.
- No console errors, undecoded rendered assets, disappearing authored objects, blocked routes, or visual regression.

---

# P1 required polish

## WO-C10: Give every hero a signature mechanic

- Lit Commando: durable bruiser mechanic and heavy starting weapon/passive.
- Lit Valkyrie: mobility/critical mechanic and agile starting weapon/passive.
- Lester: consistency/reroll mechanic and balanced reliable kit.
- Lilly: precision/tactical mechanic and distinct weapon silhouette.
- Balance all four against identical deterministic suites.

## WO-C11: Audit every upgrade and certify six builds

- Trace every upgrade from offer eligibility through simulation, rendering, HUD, summary, and replay envelope.
- Remove or hide dead cards.
- Certify rapid-fire, pierce/rail, demolition, tank, critical, and economy/pickup builds.
- Prevent dead offers and redundant max-rank choices.
- Guarantee at least one evolution/power moment in a healthy 15–20 minute run.

## WO-C12: Enemy pressure and attack-token orchestration

- Cap simultaneous hostile tells and active attacks by pressure tier.
- Keep non-token enemies repositioning/flanking rather than stacking.
- Validate water, walls, gates, corners, narrow routes, spawn exclusion, and separation at 140-enemy cap.
- Add telemetry for role counts, tokens, projectile density, unfair hits, and path recovery.

## WO-C13: Finish critical VFX, UI chrome, and audio

- Wire and visually certify coin pickup, grenade ring, level-up burst, achievement burst, HUD frame, level-up frame, and achievement toast.
- Replace synth-only grenade explosion, XP, level-up, enemy death, boss phase/death, shield break, and low-health cues where final samples materially improve feel.
- Add distance attenuation, family concurrency caps, ducking, and auto quality tiers.

## WO-C14: Production package and cache discipline

- Keep HMH code/art outside the landing import closure until cabinet launch.
- Lazy-load wallet/ethers only on wallet action.
- Build an allowlisted production directory.
- Exclude source sheets, raw still libraries, editor data, QA PNGs, and deprecated art.
- Add bundle, request-count, file-count, largest-file, deploy-size, and cache-version gates.

## WO-C15: Accessibility and device completion

- Implement real Gamepad API movement/aim, dead zones, mapping, reconnect, and vibration toggle.
- Complete key rebinding with conflict handling.
- Verify touch pointer controls on physical Android and iOS devices.
- Verify reduced motion, reduced flash, contrast, focus, canvas state alternatives, and 44px touch targets.

---

# P2 after Level 1 release

- Paid entry, escrow, revenue routing, tournaments, prizes, and mainnet.
- Cross-device cloud profile synchronization beyond signed on-chain profile fields.
- Public verifier service scaling, moderation dashboard, and anomaly review UI.
- Level 2 and Level 3 implementation.
- Additional cabinet games.
- Full global roster art cleanup for actors not used by Level 1.
- Advanced chunk rendering, spatial buckets, and object pooling beyond measured Level 1 needs.

---

# Canonical verification gate

Run before any release handoff:

```bash
npm run assets:verify
npm test
npm run check
npm run contracts:check
npm run contracts:compile
npm run contracts:test
npm run contracts:slither
npm run design:audit
npm run design:roster
npm run design:art-census
npm run design:balance
npm run design:boss-balance
npm run design:session-analytics
npm run design:security-audit
npm run design:web3-audit
npm run smoke:portal
npm run smoke:portal:interactions
npm run visual:regression
npm run build
git diff --check
```

Additional release-specific commands to add during execution:

```bash
npm run assets:qa:strict
npm run design:long-run
npm run security:full
npm run contracts:verify-wiring
```

# Approval boundaries

- Local gameplay, tests, docs, security fixes, art repair, and testnet deploy-plan preparation may proceed autonomously.
- Generated art credit spend or broad asset generation requires the existing art-tool approval policy.
- Contract deployment, transaction signing, address changes, leaderboard reset, fund movement, and production push require explicit approval.
- Mainnet and real-value paid play are not part of this Level 1 completion release.

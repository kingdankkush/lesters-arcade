# Lester's Arcade and Hard Money Heroes: Claude/Fable Engineering Handoff

**Date:** 2026-07-24

**Repository:** `C:\Users\just_\Desktop\Projects\Web3 Gaming\Lesters-Arcade`

**GitHub:** https://github.com/kingdankkush/Lesters-Arcade

**Working branch:** `reboot/hmh-aaa-continuous`

**Audience:** Claude/Fable agents continuing local source, GitHub, game, portal, art, QA, profile, leaderboard, session, and Web3 work

> This document is the current cross-system handoff. Read it before older HMH handoffs. The June 2026 handoffs describe an earlier Canvas/isometric/procedural direction and are historical only. Current source, tests, release certificates, and the AAA master plan outrank older prose.

---

## 1. Mission

Lester's Arcade is a retro Litecoin and LitVM arcade portal. It owns player identity, profile data, cabinet selection, Free and Ranked mode boundaries, official sessions, leaderboards, achievements, analytics, and all wallet or contract interaction.

Hard Money Heroes is the primary playable child cabinet. It has shifted from a large Canvas-based isometric/procedural prototype into a standalone PixiJS reboot with a deterministic fixed-step simulation, authored 2.5D world, browser-certified controls, production hero atlases, enemy families, boss logic, progression, and a secure parent/child bridge.

Chikun's Escape is the first third-party cabinet integration. It currently provides a development-only cabinet, SDK integration, deterministic parent-seeded replay core, fail-closed mode selection, and cabinet art. It is not publicly playable yet.

The long-term vision is:

1. Make Hard Money Heroes a highly polished, readable, replayable top-down 2.5D roguelike run-and-gun.
2. Keep gameplay deterministic and independently verifiable.
3. Let the portal own durable wallet profiles, official sessions, cadence leaderboards, achievements, and Web3 publication.
4. Support additional child cabinets such as Chikun's Escape through a clear, secure SDK and manifest contract.
5. Enable player-signed LitVM testnet publication only after hardened contracts, trusted verification, and real-wallet end-to-end certification are complete.
6. Keep real-value settlement disabled until economy, legal, security, payment-token, routing, and vault decisions are explicitly approved.

---

## 2. Mandatory authority order

When documents disagree, use this order:

1. Current user instruction.
2. `AGENTS.md`.
3. `.hermes/plans/2026-07-23_225852-hmh-aaa-continuous-improvement-master-plan.md`.
4. Latest release and preview certificates under `docs/hmh-reboot/`.
5. `docs/hmh-reboot/COMPATIBILITY.json` for frozen IDs, protocol, persistence, and authority boundaries only.
6. Current source and tests.
7. This handoff.
8. Older HMH design and Claude handoff documents as historical context only.

Important compatibility snapshot warning:

- `docs/hmh-reboot/COMPATIBILITY.json` preserves historical identifiers and boundaries.
- Some narrative fields still contain older side-scroller language.
- Preserve the identifiers and contracts, but do not restore the older camera, procedural-isometric, or side-scroller design from that prose.

---

## 3. Current checkpoint

### Repository

| Item | Current value |
| --- | --- |
| Branch | `reboot/hmh-aaa-continuous` |
| Deployable Cycle 002 source commit | `ab8eecdbe7ec40e3451ef8b10f58ae3095a3a170` |
| Cycle 002 evidence commit before this handoff | `af86dfadbd4861d76f56c7198a62739e57ab9543` |
| Cycle 002 exact staged review hash | `21bf563967c0e2746c0dcd95476350fef7df031e0dbcc93615756d275ec563e9` |
| Authoritative review batch | `deleg_93b9cb6c`, three PASS verdicts, no blockers |
| Main branch at final Cycle 002 check | `fa9585be7014db6515c536f9a09fdba5a3a2572f` |

### Deployments

| Role | Deployment | URL | State |
| --- | --- | --- | --- |
| Cycle 002 candidate | `dpl_7jXSC1fjXSPtnAzEkzZx97CgTNXN` | https://lesters-arcade-ck25dqelb-justin-agent-projects.vercel.app | Ready, artifact verified, production approval pending |
| Current production | `dpl_AvXkk8eXSGzX4jcviDNzVSsr9ap9` | https://lestersarcade.io | Ready, unchanged by Cycles 001 and 002 |
| Preserved rollback | `dpl_3ku2fQ42yybTB5bWoZgifX9AnAPk` | Vercel deployment record | Ready |

Do not promote the candidate without explicit approval for deployment `dpl_7jXSC1fjXSPtnAzEkzZx97CgTNXN`.

Do not deploy contracts, issue LitVM transactions, change contract authority, or enable settlement without a separate explicit HALT approval.

---

## 4. What changed during this product shift

## 4.1 Chikun's Escape entered the arcade platform

Reachable Git history documents this progression:

| Date | Commit | Change |
| --- | --- | --- |
| 2026-06-09 | `71c57dc6` | Platform extensibility and smart-contract foundation work |
| 2026-06-10 | `2d9a980f` | Chikun third-party onboarding and LitVM foundation |
| 2026-06-22 | `9cb2fb62` | Game SDK sandbox adapter and Chikun manifest |
| 2026-06-22 | `8232ccf6` through `9e28ef57` | Cabinet art slicing, transparent rotating cabinet frames, cache refresh |
| 2026-07-03 | `2452d7f7` | Cabinet SDK vertical slice |
| 2026-07-03 | `8bae7184` | Chikun gated behind Coming Soon |
| 2026-07-14 | `51def63a` / PR #2 | External Chikun source handoff imported for integration |
| 2026-07-14 | `174ff8d1` | Raw source handoff vaulted out of the active tree |
| 2026-07-14 | `9b07b141` | Parent-seeded deterministic replay core |
| 2026-07-14 | `e60e4014` | Parent replay verification enforced |
| 2026-07-14 | `3e6cd029` | Canonical manifest references corrected |
| 2026-07-14 | `0d16a984` | Game-aware mode selection |
| 2026-07-14 | `d3c9ee68` | Missing mode configuration fails closed |

Current state:

- Public cabinet status: `coming-soon`.
- Public `playable`: `false`.
- Development harness `devPlayable`: `true`.
- Cabinet version: `0.2.0`.
- Runtime: `deterministic-core-v2`.
- Simulation: fixed 60 Hz.
- Input evidence is bounded to 4,096 flap transitions.
- Ranked preview uses parent-provided seed, build hash, season ID, canonical replay, and result comparison.
- Free practice does not produce official progress.
- Production art and full public-launch gates remain incomplete.

The complete raw React/Supabase handoff is not in the current tree. It remains recoverable from Git commit `51def63af5ebbc84bab3b0dd51273d5c805b47b5` and PR #2:

- Commit: https://github.com/kingdankkush/Lesters-Arcade/commit/51def63af5ebbc84bab3b0dd51273d5c805b47b5
- Pull request: https://github.com/kingdankkush/Lesters-Arcade/pull/2
- Historical root: `docs/handoffs/chikuns-escape/`

Use the distilled current runtime as authority. Do not blindly restore the full historical handoff directory.

## 4.2 Hard Money Heroes left the old monolithic prototype direction

Earlier versions combined portal code, a large Canvas renderer, an isometric/procedural game direction, stale side-scroller constants, generated actor catalogs, and simulated Web3 behavior. The reboot deliberately separated those concerns.

The active direction is now:

- PixiJS `8.19.0` renderer.
- Top-down 2.5D authored world.
- Deterministic 60 Hz simulation.
- Maximum four fixed-step catch-up ticks per render frame.
- Projection-only camera interpolation and art.
- Secure same-origin sandboxed iframe child.
- Parent-owned wallet, profile, leaderboard, analytics, official-session, and settlement authority.
- Human survivors and zombies only for active actors.
- Fixed authored macro routes with controlled deterministic encounter behavior.
- Production hero art from a reproducible Blender-to-atlas pipeline.
- Free Mode remains local/practice-only.
- Ranked preview creates canonical local evidence but does not currently publish on-chain.

The renderer bakeoff selected PixiJS because it had lower payload and stronger stress throughput while allowing HMH to retain its own timing, physics, collision, AI, and replay authority. See `docs/hmh-reboot/ENGINE-BAKEOFF.md`.

## 4.3 Reboot foundation and content delivered

The reboot iterations delivered:

- Secure child shell and sandbox.
- Deterministic timing and simulation.
- Input, touch, gamepad, aim, movement, dash, collision, and elevation systems.
- Projectile physics, weapon system, melee, grenades, combat events, lifecycle, and audio.
- Six enemy families with deterministic role pressure.
- Encounter director and Liquidator boss logic.
- Authored Level 1 world, The Forked Frontier.
- Six ordered districts, loops, bridge, water, ramps, ledges, hazards, POIs, encounter areas, minimap, and reveal data.
- Run progression and cockpit UI.
- Four approved production heroes.
- Production enemy and world art projection layers.
- Performance budgets and pools.
- Parent/child lifecycle integration.
- Full release, browser, security, Web3-boundary, asset, soak, and preview certification.

## 4.4 AAA Cycle 001

Cycle 001 added observability and movement polish:

- Identified the historical local 404 as Vercel Analytics loading on localhost.
- Added hosted-origin-only analytics loading.
- Added a fail-closed HMH network and console audit.
- Made acceleration vector-magnitude bounded, removing diagonal acceleration advantage.
- Added velocity interpolation.
- Moved projection-only camera following to interpolated render state.
- Corrected retained-memory harness behavior across Windows and Linux.
- Updated browser smokes to current roster and production art.
- Removed hidden broken references to retired actor art.
- Added static image path resolution coverage.

Cycle 001 preview was verified but superseded by Cycle 002.

## 4.5 AAA Cycle 002

Cycle 002 fixed render-partition-dependent loss of rapid one-shot actions:

- Buffers rising edges for `fire`, `melee`, `grenade`, and `dash` for 100 ms.
- Preserves pending actions through render frames with zero fixed steps.
- Consumes each action once after simulation admits a step.
- Expires stale actions.
- Clears through existing blur, visibility, pointer-cancel, touch-cancel, and controller teardown paths.
- Gives keyboard, pointer, touch, and gamepad equivalent rising-edge semantics.
- Stores no more than one pending edge per action, avoiding an unbounded event queue.
- Does not alter recoil, collision, elevation, persistence, replay, wallet, settlement, or parent authority.

Cycle 002 release evidence:

- Release ledger: 1,619 total, 1,567 passed, exactly 52 accepted legacy failures in 35 files, 0 unexpected.
- Focused controls/combat: 75/75.
- Chrome: five viewport profiles passed.
- Edge: five viewport profiles passed.
- Four production heroes passed desktop/mobile smokes.
- Security: 5/5, zero findings.
- Sandbox security: 3/3.
- Web3 authority: 9/9.
- Network/console: 4/4, zero failures.
- Bundle: 963,568 bytes under the 1,050,000-byte gate.
- Desktop/mobile p95 frame time: 7 ms.
- Bounded input soak: 260,000 cycles, 2,000-byte retained delta, pending size 0.

Memory disclosure:

- The Cycle 002 input state is bounded and did not introduce a retained-memory regression.
- A broader browser heap threshold fails on both Cycle 002 and current production.
- Cycle 002 retained 42,492 fewer bytes than production in the matched A/B run.
- Exact release language: `PASS for Cycle 002 regression safety; pre-existing browser retained-memory debt remains open.`

---

## 5. Current architecture

## 5.1 Authority map

### Parent portal owns

- Wallet discovery and connection.
- SIWE-shaped login challenge and local account binding.
- Player profile and preferences.
- Character unlock authority.
- Free versus Ranked selection.
- Canonical session IDs and parent session seed.
- Session evidence and final envelope hash.
- Official session history.
- Cadence leaderboards.
- Achievement and progress writes.
- Analytics.
- Contract reads and player-signed transactions.
- Settlement policy and enablement.

### HMH child owns

- Input capture.
- Fixed-step gameplay simulation.
- Movement, collision, elevation, combat, AI, spawning, progression, and boss state.
- Render projection and cockpit game UI.
- Child-side state and score candidate messages.

### HMH child must never

- Request a wallet.
- Ask for a signature.
- Send a transaction.
- Decide settlement.
- Write parent persistence.
- Grant official achievements or Ranked status.
- Replace the parent-provided session identity or seed.

## 5.2 Parent/child bridge

Protocol:

- Version: `hmh-bridge/v1`.
- Maximum message size: 65,536 bytes.
- Same-origin source checks.
- Expected iframe source checks.
- Per-session channel token.
- Monotonic sequence checks.
- Fail-closed schema validation.
- Duplicate and replay rejection.
- Bounded pre-ready command queue.

The child sends state, pause, game-over, score-result, run-event, achievement, settings, error, and exit messages. The parent only finalizes a run after the score candidate matches the game-over summary and the session has not already been finalized.

## 5.3 Determinism model

- Fixed 60 Hz authority.
- At most four catch-up steps per render frame.
- Render interpolation is non-authoritative.
- Seeded encounter and run state.
- Stable IDs and bounded collections.
- Canonical input and event evidence.
- Final-state and envelope hashes.
- Free and Ranked share gameplay rules, while parent persistence and publication differ.

## 5.4 World model

Level 1 is `12,000 x 4,800` world units and contains:

1. Frontier Relay.
2. Rugpull Ravine.
3. Liquidity Crossing.
4. Hashwood.
5. Mining Camp.
6. Liquidation Yard.

One world contract supplies visible geometry, collision, elevation, minimap, reveal areas, routes, loops, landmarks, hazards, and encounter ownership. Do not create a second divergent collision or minimap representation.

## 5.5 Active hero roster

| ID | Role | Visual identity | Unlock authority |
| --- | --- | --- | --- |
| `lit-commando` | Starter | Broad silver/Litecoin-blue commando, cyan visor | Parent portal |
| `lit-valkyrie` | Starter | Agile teal/plasma commando, short teal hair | Parent portal |
| `lester-original` | Unlockable | Blue full-head mask, white stripe, scarf, cargo kit | Settled Ranked match gate or one-time legacy migration |
| `lilly` | Unlockable | Long teal hair, round glasses, gold/teal veteran kit | Settled Ranked match gate |

All four share `human-medium-collision-v1`. Art cannot alter hitboxes or gameplay.

## 5.6 Actor canon

Every active actor must visibly read as a human survivor or zombie. Do not use:

- Animals.
- Vehicles.
- Robots.
- Mechs.
- Abstract polygons.
- Retired generic isometric actor sheets.
- QA-green placeholders as final production identity.

Neutral anatomical grayboxes are acceptable only in explicit regression/evidence modes and must still include a head, torso, two arms, and two legs.

---

## 6. Chikun's Escape source map

### Current canonical runtime

- `apps/portal/src/chikun-cabinet.mjs`
  - Deterministic simulation, replay evidence, parent replay claim, result verification, Cabinet SDK adapter.
- `apps/portal/src/games/chikun/loader.mjs`
  - Portal loader.
- `apps/portal/games/chikun/game.manifest.json`
  - Current manifest.
- `apps/portal/games/chikun/main.mjs`
  - Child entry wrapper.
- `apps/portal/src/arcade-core.mjs`
  - Cabinet listing, Coming Soon gate, mode copy, parent session verification and score integration.
- `apps/portal/src/game-adapter.mjs`
  - In-process SDK adapter.
- `apps/portal/src/arcade-sdk.mjs`
  - Parent SDK contract.

### Current cabinet art

- `apps/portal/assets/cabinet-chikun.svg`
- `apps/portal/assets/cartridge-chikun.svg`
- `apps/portal/assets/generated/chikun-cabinet/chikun-cabinet-front.png`
- `apps/portal/assets/generated/chikun-cabinet/chikun-cabinet-front-right.png`
- `apps/portal/assets/generated/chikun-cabinet/chikun-cabinet-right.png`
- `apps/portal/assets/generated/chikun-cabinet/chikun-cabinet-back.png`
- `apps/portal/assets/generated/chikun-cabinet/chikun-cabinet-left.png`
- `apps/portal/assets/generated/chikun-cabinet/chikun-cabinet-front-right-low.png`
- `apps/portal/assets/generated/chikun-mode-select/chikun-mode-select-art.webp`

### Historical full-game handoff

The removed handoff contained:

- `src/ArisGame.tsx`.
- `src/Leaderboard.tsx`.
- Audio, config, sprite, local storage, and Supabase modules.
- Next route references.
- Source artwork and soundtrack.
- Integration and SDK mapping docs.
- Supabase schema.

Inspect it from commit `51def63a`, then migrate intentionally into current portal architecture. Do not restore its Supabase or wallet assumptions without reconciling parent authority, deterministic replay, security, bundle, and persistence rules.

### Chikun remaining work

1. Decide whether to port the historical React game or continue the distilled deterministic vertical slice.
2. Create a production child runtime with responsive desktop/mobile controls and complete art/audio.
3. Map all output through the current SDK and parent session contract.
4. Preserve deterministic parent-seeded replay for Ranked eligibility.
5. Add full child sandbox, network, CSP, save, pause/resume, teardown, and restart tests.
6. Add browser matrices and visual certification.
7. Decide whether Chikun shares HMH cadence leaderboards or receives cabinet-specific categories.
8. Keep it `playable: false` until all public-launch gates pass.

---

## 7. Hard Money Heroes source map

### Child runtime

- `apps/portal/hmh-reboot/index.html`
- `apps/portal/hmh-reboot/styles.css`
- `apps/hmh-reboot/src/main.mjs`
- `apps/hmh-reboot/src/simulation.mjs`
- `apps/hmh-reboot/src/input.mjs`
- `apps/hmh-reboot/src/touch-controls.mjs`
- `apps/hmh-reboot/src/aim.mjs`
- `apps/hmh-reboot/src/movement.mjs`
- `apps/hmh-reboot/src/dash.mjs`
- `apps/hmh-reboot/src/collision.mjs`
- `apps/hmh-reboot/src/elevation.mjs`
- `apps/hmh-reboot/src/world-space.mjs`

### Combat

- `apps/hmh-reboot/src/weapon-system.mjs`
- `apps/hmh-reboot/src/projectile-physics.mjs`
- `apps/hmh-reboot/src/melee.mjs`
- `apps/hmh-reboot/src/grenades.mjs`
- `apps/hmh-reboot/src/combat-events.mjs`
- `apps/hmh-reboot/src/combat-lifecycle.mjs`
- `apps/hmh-reboot/src/combat-audio.mjs`

### Enemies, boss, and progression

- `apps/hmh-reboot/src/enemy-archetypes.mjs`
- `apps/hmh-reboot/src/enemy-simulation.mjs`
- `apps/hmh-reboot/src/enemy-combat.mjs`
- `apps/hmh-reboot/src/encounter-director.mjs`
- `apps/hmh-reboot/src/liquidator-boss.mjs`
- `apps/hmh-reboot/src/opening-balance.mjs`
- `apps/hmh-reboot/src/run-progression.mjs`
- `apps/hmh-reboot/src/run-adapters.mjs`

### World and presentation

- `apps/hmh-reboot/src/level-one-world.mjs`
- `apps/hmh-reboot/src/world-production-art.mjs`
- `apps/hmh-reboot/src/enemy-production-art.mjs`
- `apps/hmh-reboot/src/production-hero-atlas.mjs`
- `apps/hmh-reboot/src/cockpit-ui.mjs`
- `apps/hmh-reboot/src/runtime-performance.mjs`

### Parent integration

- `apps/portal/main.js`
- `apps/portal/src/hmh-reboot-host.mjs`
- `apps/portal/src/hmh-reboot-bridge.mjs`
- `apps/portal/src/hmh-reboot-portal-lifecycle.mjs`
- `sdk/hmh-bridge-protocol.mjs`
- `apps/portal/hmh-reboot/index.html`
- `apps/portal/dist/hmh-reboot/game.js`

### Profiles, sessions, leaderboards, and Web3

- `apps/portal/src/arcade-core.mjs`
- `apps/portal/src/persistence.mjs`
- `apps/portal/src/session-integrity.mjs`
- `apps/portal/src/leaderboard-engine.mjs`
- `apps/portal/src/hmh-profile-parity.mjs`
- `apps/portal/src/wallet-auth.mjs`
- `apps/portal/src/settlement.mjs`
- `apps/portal/src/litvm-chain-client.mjs`
- `apps/portal/src/hmh-run-integrity.mjs`

---

## 8. Production art and asset map

### Editable HMH sources

- `apps/hmh-reboot/assets/source/blender/hmh-character-template.blend`
- `apps/hmh-reboot/assets/source/blender/hmh-commando-concepts.blend`
- `apps/hmh-reboot/assets/source/blender/hmh-production-heroes.blend`
- `apps/hmh-reboot/assets/source/blender/hmh-character-pipeline.json`
- `apps/hmh-reboot/assets/source/blender/hmh-commando-concepts.json`
- `apps/hmh-reboot/assets/source/blender/hmh-production-heroes.json`

Blender version used for the certified hero pipeline: `5.1.2`.

### Production hero atlases

Root:

- `apps/portal/assets/generated/hmh-reboot-production-heroes/`

Actor directories:

- `lit-commando/`
- `lit-valkyrie/`
- `lester-original/`
- `lilly/`

Each contains atlas JSON, atlas PNG, contact sheet, and metrics JSON.

### Canonical world and enemy projections

- `apps/portal/assets/generated/hmh-curated-level-kit/`
- `apps/portal/assets/generated/hmh-curated-level-art/`
- `apps/portal/assets/generated/hmh-level-one-world-v3/`
- `apps/portal/assets/generated/hmh-level-one-authored-stamp-art/`
- `apps/portal/assets/generated/hmh-level-one-ground/`
- `apps/portal/assets/generated/hmh-final-setpiece-kit/`
- `apps/portal/assets/generated/hmh-final-combat-vfx/`
- `apps/portal/assets/generated/hmh-vfx-ui-chrome/`
- `apps/portal/assets/generated/hmh-pickup-icons/`
- `apps/portal/assets/generated/hmh-achievement-atlas/`

### Do not reactivate

Treat these as legacy/reference unless a current source manifest explicitly imports them:

- `apps/portal/assets/generated/hmh-isometric-pixellab/`
- Retired generated roster sheets.
- Old generic canonical-art actors that conflict with current human/zombie canon.
- Hidden portal image references removed during Cycle 001.
- Mannequin and prototype actor art outside explicit regression modes.

### Local evidence

Cycle 002 action evidence:

- `.hermes/evidence/hmh-aaa-cycle-002/action-buffer/desktop.png`
- `.hermes/evidence/hmh-aaa-cycle-002/action-buffer/mobile.png`
- `.hermes/evidence/hmh-aaa-cycle-002/browser/`

Additional release evidence and machine-readable records are in `docs/hmh-reboot/` and `.tmp/hmh-aaa-cycle-002/` locally. `.tmp` evidence may be untracked and must not be assumed to exist in a fresh clone.

---

## 9. Profile, session, leaderboard, and settlement readiness

## 9.1 What is functional now

### Local profile and preferences

Implemented:

- Wallet-normalized profile identity.
- Local display name, handle, avatar data URL, avatar URI, and selected character preference.
- Local persistence and profile presentation.
- Character selection and unlock authority in the parent.
- Profile parity normalization between local and optional chain profile records.

Status: **functional locally and in portal flows**.

### Canonical sessions

Implemented:

- Canonical session handles.
- Parent-owned session seed, build hash, season, and mode.
- Bounded input and event evidence.
- Final-state and envelope hashes.
- Active session checkpoints.
- Local run history and official-session records.
- Duplicate-finalization protection.
- Free/Ranked separation.
- HMH score candidate and game-over matching.
- Chikun deterministic parent replay verification.

Status: **functional locally and in the verified preview**.

### Local leaderboards

Implemented:

- Daily, weekly, monthly, yearly, and all-time cadence boards.
- Wallet and display-name entries.
- Local official-session ingestion.
- Seed/demo rows marked with provenance.
- Profile run history and personal records.
- Chain-record merge and dedup paths.

Status: **functional locally**. Chain-backed current reads are not functional against the legacy registry because the hardened client ABI does not match it.

### Local/simulated settlement

Implemented:

- Deterministic settlement plans.
- Local receipts and persistence.
- Profile, score, achievement, and cadence updates.
- Game-over integration.
- Retry UI and fail-closed user messaging.

Status: **simulation/local state only**. `SETTLEMENT_LIVE` remains `false`.

## 9.2 Current LitVM facts, verified 2026-07-24

Network:

- LitVM LiteForge testnet.
- Chain ID `4441` / `0x1159`.
- RPC: https://liteforge.rpc.caldera.xyz/http
- Explorer: https://liteforge.explorer.caldera.xyz

### June legacy deployment

The following recorded legacy addresses currently contain bytecode:

| Contract | Address | Bytecode observed |
| --- | --- | --- |
| GameRegistry | `0x09C6f94e73f6aA16177549952Dc47dB5AEb83406` | Yes |
| PlayerProfileRegistry | `0x5ba410d2A0ccCc00D070d0C45Dc7102e0FfABe96` | Yes |
| ScoreSubmissionRegistry | `0x7C05C9596c6c77302ae0479B1Db550E9baD1acf0` | Yes |
| ArcadePaymentRouter | `0x7c999E9570D44090b9279dbAbE33B361e94bf78B` | Yes |
| SessionLedger | `0x699c2313884A68B7dfCffC01337eB429b6609798` | Yes |

These contracts are legacy and must not be treated as the hardened launch deployment.

A read-only test through the current `litvm-chain-client.mjs` failed to decode both global and player session records from the legacy score registry. The current ABI expects hardened verified records, while the deployed legacy tuple is different. The client returned failure and no chain leaderboard records. This is an active integration blocker, not a transaction failure.

### Hardened verifier-based deployment

The hardened manifest is an unsigned dry run:

- `docs/web3/hardened-ranked-deployment-manifest.json`

Predicted contracts:

| Contract | Predicted address | Bytecode observed 2026-07-24 |
| --- | --- | --- |
| GameRegistry | `0x5c53432CEf0Cf023b46Be522888330b07f52f33E` | None |
| PlayerProfileRegistry | `0xd49EdAD8c5247ce99D12e70a95293291d2Ee191C` | None |
| ScoreSubmissionRegistry | `0x55D37C5516F17e12bBd7Ec9ab520D10Cc5098782` | None |

The hardened score contract requires:

- Canonical nonzero envelope hash.
- Expiring verifier attestation.
- Trusted verifier signature.
- Player-signed transaction.
- Registered and playable game.
- Bounded score, kills, combo, survival, and achievement fields.
- Unique session ID.

The browser client can consume `settlementInput.verifierAttestation`, but this repository does not currently produce a trusted verifier attestation. A secure verifier service or separately controlled signing process is still required.

## 9.3 Honest readiness assessment

### Playable game

**Hard Money Heroes:** technically one approved production promotion away from a strong public beta candidate. The current preview is playable and broadly certified. It is not a finished AAA game. Remaining work includes collision/elevation polish, deeper combat identities, authored district depth, bosses, animation coverage, VFX/audio, build variety, accessibility, physical-device QA, and retained-memory investigation.

**Chikun's Escape:** deterministic integration proof and cabinet harness exist, but it is not a finished public game. It remains a development cabinet.

### Functional local platform rails

Profiles, canonical sessions, local official history, cadence leaderboards, achievements, persistence, and simulated settlement are largely implemented and integrated.

### Functional verified Web3 score/profile sync

Not end-to-end ready. Three major engineering gates remain:

1. Deploy and verify the hardened free-Ranked GameRegistry, PlayerProfileRegistry, and ScoreSubmissionRegistry after HALT approval.
2. Implement a trusted replay/evidence verifier that returns bounded, expiring attestations without exposing the verifier key to the browser.
3. Run a real wallet end to end on chain 4441: connect, fund, start Ranked, complete a run, verify evidence, sign attestation, publish, read score/profile/session back, merge into leaderboards, reload, deduplicate, and inspect explorer records.

### Functional paid settlement

Not close enough for launch. In addition to the three gates above, paid play requires:

1. Approved payment asset and decimals.
2. Approved entry fee.
3. Approved 75/25 or other exact split configuration and legal framing.
4. Confirmed dev, platform, liquidity, and treasury vault addresses.
5. Contract security review, tests, fuzzing, static analysis, and independent audit.
6. PaymentRouter and SessionLedger deployment/configuration.
7. Allowance, payment, cancellation, abandoned session, refund, duplicate settlement, and failure UX.
8. Real-wallet settlement tests and receipt reconciliation.
9. Mainnet-specific approval later. Testnet approval does not authorize mainnet.

### Practical distance

- HMH public beta gameplay: **candidate ready, approval and post-promotion checks remain**.
- Local profile/session/leaderboard experience: **substantially functional**.
- Hardened free Ranked testnet publication: **three major work packages remain**.
- Paid testnet economy: **at least six additional product/security/economy work packages remain**.
- Mainnet or real-value launch: **not authorized and not release-ready**.

---

## 10. Prioritized handoff backlog

## P0: Preserve the certified checkpoint

1. Read the current Git state and deployment state again before changing files.
2. Do not rebuild or promote the existing candidate as a new deployment unless required.
3. Do not claim that the evidence commit is deployable source. Runtime source is commit `ab8eecd…`.
4. Preserve production and rollback deployment IDs.
5. Keep the work on `reboot/hmh-aaa-continuous` or a new branch from it.
6. Do not write ordinary work directly to `main`.

Acceptance:

- Clean branch and exact remote equality.
- Production untouched unless exact promotion approval is present.
- No LitVM transaction without explicit HALT approval.

## P1: Next HMH gameplay cycle, earliest incomplete Phase 2 work

Audit and select one bounded vertical slice from:

- Swept collision and corner sliding.
- Elevation and bridge/ledge traversal.
- Low-FPS collision safety.
- Stale aim and focus/device switching.
- Camera look-ahead, boss framing, and mobile framing as projection-only changes.

Primary files:

- `apps/hmh-reboot/src/collision.mjs`
- `apps/hmh-reboot/src/elevation.mjs`
- `apps/hmh-reboot/src/world-space.mjs`
- `apps/hmh-reboot/src/aim.mjs`
- `apps/hmh-reboot/src/main.mjs`
- Corresponding `tests/hmh-reboot-*.test.mjs`

Do not combine unrelated physics, art, and economy changes in one cycle.

## P1: Permanent portal E2E test

Build the missing permanent E2E harness for:

- Free run.
- Ranked preview.
- Wallet connect/reconnect.
- Profile reload.
- Score and session history.
- Game over and duplicate rejection.
- Restart and Play Again.
- Pause/resume.
- Keyboard, controller, and touch.
- Audio and service worker.
- Offline/update and stale cache.

Suggested files from the master plan:

- Create `scripts/hmh-reboot-portal-e2e.mjs`.
- Create `tests/hmh-reboot-portal-e2e-contract.test.mjs`.
- Modify portal and lifecycle source only as RED evidence requires.

## P1: Investigate browser retained-memory debt

- Reproduce against unchanged production and current source with matched runs.
- Separate asset decode caches, Pixi renderer pools, texture lifecycle, audio, iframe teardown, service worker, and test harness effects.
- Require explicit GC where the metric is retained heap.
- Do not claim a fix from absolute heap movement without A/B controls.
- Preserve the exact Cycle 002 conclusion until new evidence supersedes it.

Primary files:

- `scripts/hmh-browser-soak.mjs`
- `apps/hmh-reboot/src/runtime-performance.mjs`
- `apps/hmh-reboot/src/main.mjs`
- `docs/hmh-reboot/MEMORY-AUDIT-AAA-CYCLE-002.md`

## P1: Hardened Web3 deployment preparation, HALT-gated

Read-only preparation may proceed. Broadcast may not.

1. Reconcile current contracts and current browser ABI.
2. Define trusted verifier deployment architecture.
3. Build replay/evidence verification and attestation test vectors.
4. Add expiry, player binding, chain binding, contract binding, session uniqueness, and replay rejection tests.
5. Run compile, contract tests, fuzzing, Slither, and independent review.
6. Produce an exact deployment packet and request HALT approval.

Primary files:

- `contracts/src/GameRegistry.sol`
- `contracts/src/PlayerProfileRegistry.sol`
- `contracts/src/ScoreSubmissionRegistry.sol`
- `contracts/deploy-config.testnet.json`
- `scripts/deploy-contracts.mjs`
- `docs/web3/hardened-ranked-deployment-manifest.json`
- `apps/portal/src/litvm-chain-client.mjs`
- `apps/portal/src/session-integrity.mjs`
- New verifier service/tooling, location to be approved before implementation.

## P2: Real-wallet free Ranked E2E, after hardened deploy approval

Acceptance must include:

- Right chain and funded wallet preflight.
- Real browser wallet.
- Real verifier attestation.
- Player signature and transaction.
- Explorer-confirmed event.
- Profile readback.
- Score/session readback.
- Verified-only global leaderboard ingestion.
- Reload and deduplication.
- Wrong-chain, expired-attestation, duplicate-session, rejected-signature, RPC outage, and user-cancel flows.

Synthetic wallet tests and static audits are not sufficient.

## P2: Chikun public vertical slice

1. Decide current runtime versus historical React migration.
2. Build production art/audio and responsive gameplay.
3. Keep parent-seeded replay deterministic.
4. Add full SDK, profile, session, mode, leaderboard, and sandbox tests.
5. Keep public cabinet gated until browser and asset certification passes.

## P2: HMH content and quality roadmap

Follow the master plan in order:

1. Combat identities and truthful projectile feedback.
2. Combat juice with bounded effects.
3. Enemy role depth and readable attack-token behavior.
4. Liquidator completion and later distinct bosses.
5. Three authored districts/acts over time.
6. Full hero/enemy/boss animation state coverage.
7. Production world, props, VFX, shaders, lighting, and atmosphere.
8. Audio, music intensity, haptics, and voice budgets.
9. Build synergies, weapon evolutions, and non-dominant choices.
10. Ethical replay loop, seeded challenges, achievements, and run summaries.
11. Accessibility and remapping.
12. Payload, memory, thermal, and long-run durability.

## P3: Paid economy, separate product and security project

Do not treat paid settlement as a small toggle. Create a dedicated plan with:

- Economy design.
- Legal review.
- Payment asset and faucet/test flow.
- Vault custody and permissions.
- Revenue split governance.
- Contract pause and recovery.
- Session payment lifecycle.
- Failure/refund policy.
- Independent security review.
- Testnet pilot.
- Separate mainnet decision.

---

## 11. Vision for future updates

## Milestone A: AAA-quality core loop

- Five-minute run is immediately readable and fun.
- Movement, aim, dash, shooting, melee, grenades, hit feedback, rewards, and level-up drafting feel precise on keyboard/mouse, controller, and touch.
- One authored level and one boss are visually and mechanically complete.
- Active actor art has no proxies or broken states.
- No P0/P1 gameplay, persistence, session, visual, or mobile-control defects.

## Milestone B: roguelike depth

- Three authored districts or encounter acts with distinct routes, hazards, enemies, and visual identities.
- Multiple bosses with readable deterministic phases.
- Distinct weapon roles and evolutions.
- Deep but understandable skills, power-ups, synergies, achievements, and build variety.
- Meta progression that rewards replay without invalidating player skill.

## Milestone C: platform durability

- Long-run deterministic, memory, load, audio, save/reload, bridge, profile, session, leaderboard, and service-worker gates pass.
- Chrome and Edge pass all five certified viewport profiles.
- Physical mobile devices receive dedicated QA.
- Preview and production artifacts, CSP, cache, routes, and assets are verified.
- Rollback remains recoverable.

## Milestone D: verified Web3 publishing

- Hardened verifier-based contracts deployed and verified on LitVM testnet.
- Trusted attestation service or controlled signer operational.
- Real wallet publishes verified sessions.
- Profiles and leaderboards read verified chain records.
- Duplicate, replay, wrong-chain, and expiration controls proven.

## Milestone E: optional paid settlement

- Economy and legal model approved.
- Payment contracts hardened and audited.
- Real-wallet testnet settlement proven.
- Clear player consent, failure, refund, and receipt UX.
- Mainnet remains a separate explicit decision.

---

## 12. Commands that work in this checkout

Use Git Bash/MSYS shell syntax on Windows.

Install:

```bash
npm install
```

Build:

```bash
npm run build
```

Do not use `pnpm run build` on this machine without first resolving the parent `C:\Users\just_\package.json` package-manager conflict. The repository build itself succeeds with npm.

Serve from the portal root:

```bash
cd apps/portal
python -m http.server 8791 --bind 127.0.0.1
```

Open:

- Portal: `http://127.0.0.1:8791/`
- HMH child: `http://127.0.0.1:8791/hmh-reboot/index.html`

Do not serve `apps/portal/dist` as the local root. Its HMH index is a generated redirect shell.

Core validation:

```bash
npm run check
npm run test:release
npm run build
npm run assets:qa:hmh-reboot
npm run design:security-audit
npm run design:third-party-security
npm run design:web3-audit
npm run design:web3-live
npm run audit:hmh:network
npm run certify:hmh:browser
npm run smoke:hmh:cockpit
npm run smoke:hmh:performance
npm run smoke:portal
npm run smoke:portal:interactions
npm run repo:health:strict
npm run repo:cdn-gate
npm run docs:links
```

Contract checks without broadcasting:

```bash
npm run contracts:check
npm run contracts:compile
npm run contracts:test
npm run contracts:slither
```

`contracts:test` requires Foundry. `contracts:slither` requires Slither. Missing local tools are not passes.

---

## 13. Release workflow

For every source-changing HMH cycle:

1. Re-read current branch, remote, production, rollback, certificates, compatibility, and master plan.
2. Select one bounded vertical slice from the earliest incomplete phase.
3. Capture RED evidence.
4. Implement the smallest deterministic change.
5. Run focused tests and real browser evidence.
6. Inspect desktop and mobile visuals.
7. Run the complete release gate.
8. Restore generated reports that changed incidentally.
9. Stage only intended files.
10. Freeze exact staged binary diff SHA-256.
11. Obtain independent exact-index gameplay, security/authority, and release-evidence reviews.
12. Re-review after any staged edit.
13. Commit and push only the continuation branch.
14. Deploy a branch preview.
15. Byte-verify HTML, game bundle, service worker, and representative active assets.
16. Stop for exact production approval.

Production promotion and LitVM deployment are separate approvals.

---

## 14. Known traps

1. Older HMH Claude handoffs describe the previous isometric/procedural prototype.
2. The compatibility snapshot contains frozen legacy narrative language.
3. Chikun's historical full source handoff is in Git history, not the active tree.
4. Chikun is a dev cabinet, not public playable content.
5. The current production site does not contain Cycle 002.
6. Preview URLs can require authenticated Vercel access for artifact extraction.
7. Vercel may inject deployment feedback into preview HTML. Verify expected provider injection separately from local source bytes.
8. The June deployed contracts contain code but are legacy ABI contracts.
9. The hardened predicted contracts contain no bytecode.
10. Static Web3 audits do not prove current legacy ABI compatibility or a real transaction.
11. `SETTLEMENT_LIVE=false` means no chain write happens.
12. The browser consumes `verifierAttestation` but does not produce a trusted attestation.
13. Seeded leaderboard rows are demo provenance, not verified chain results.
14. Free Mode must never write Ranked progress.
15. Art and interpolation must remain projection-only.
16. Retired isometric/Pixellab actor assets must not return to active pools.
17. Production actors must read as humans or zombies.
18. Firefox and WebKit are not locally certified. Chrome and Edge are proven.
19. Browser retained-memory debt remains open.
20. Any source edit invalidates the old source digest and affected release certificate.

---

## 15. Recommended first Fable assignment

Start with a read-only reconciliation, not a broad rewrite:

1. Confirm Git branch, HEAD, origin SHA, clean state, production deployment, preview deployment, and rollback.
2. Read `AGENTS.md`, this handoff, the AAA master plan, Cycle 002 certificate, preview verification, and memory audit.
3. Run the focused Cycle 002 input tests and current release gate without changing source.
4. Reproduce the current legacy-chain ABI decode failure with read-only calls.
5. Write a short proposed plan for:
   - one bounded Phase 2 HMH gameplay slice;
   - the permanent portal E2E harness;
   - hardened Web3 verifier architecture and deployment preparation;
   - Chikun public vertical-slice decision.
6. Do not deploy, promote, transact, or change economy configuration.

Suggested prompt:

```text
Work in C:\Users\just_\Desktop\Projects\Web3 Gaming\Lesters-Arcade on the current continuation branch.

Read AGENTS.md, docs/handoffs/2026-07-24-lesters-arcade-chikun-to-hmh-reboot-fable-handoff.md, .hermes/plans/2026-07-23_225852-hmh-aaa-continuous-improvement-master-plan.md, and the latest Cycle 002 release/preview certificates before changing anything.

First perform a read-only current-state reconciliation. Distinguish current production, the verified Cycle 002 preview, local/simulated profile-session-leaderboard rails, the June legacy deployed contracts, and the undeployed hardened verifier contracts.

Then propose one bounded, test-first next HMH gameplay slice from the earliest incomplete master-plan phase plus separate plans for the portal E2E harness, Chikun's public vertical slice, and hardened Web3 readiness. Do not combine these into one patch.

Do not promote production. Do not deploy contracts, send transactions, expose keys, enable SETTLEMENT_LIVE, or alter paid economy settings without explicit approval for that exact action.
```

---

## 16. Final state statement

Hard Money Heroes is a real, playable, browser-certified reboot candidate with a deterministic gameplay core and integrated local platform rails. It is much closer to a public beta than the earlier prototype, but it still has planned AAA gameplay, content, art, accessibility, physical-device, and memory work.

Profiles, canonical sessions, local leaderboards, achievements, and simulated settlement are substantially functional. Hardened Web3 publication is not yet end-to-end functional because the hardened contracts are undeployed, the legacy score ABI is incompatible with the current client, no trusted verifier attestation producer is wired, and no real-wallet hardened run has been certified.

Paid settlement is a later, separately approved product and security phase. It must not be represented as a launch-ready toggle.

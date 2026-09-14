# STACKED — remaining work and independent development handoff

Prepared September 13, 2026. This document separates the playable beta and completed visual upgrades from unfinished production, online-service and future-mode work. It is intended to be usable independently of the HMH and Chikun handoffs. Older plans preserve requirements; their original “coming soon” or launch-hold wording is superseded by the approved public beta and the owner's latest request to publish tested completed work.

## Release and starting point

<!-- RELEASE_FACTS_START -->
Combined release certification is in progress. The public predecessor is deployment `dpl_F4d723CFGYcZDANn1rNU6Avz3cV7` at https://lestersarcade.io. The candidate preserves its HMH world polish and adds the completed STACKED rotating cabinet and living visualizers plus Chikun open-air flight. Candidate-only work must not be described as live until this block is replaced by the final receipt.
<!-- RELEASE_FACTS_END -->

- Integrated repository: `C:/Users/just_/Documents/Codex/2026-09-12/my/work/lesters-arcade`.
- Integration branch: `codex/arcade-combined-release-20260913`. Begin from its final release commit and recheck live state.
- Completed input commits: rotating cabinet `e7e28d57ba2964dfba419e4aa31804939ed142bc`; living visualizers `9aab1203`, integrated as `fae3bd5a`.
- STACKED is a public playable `0.2.0` beta, with Free Mode and wallet-bound, replay-verified **device-local** Ranked preview. There are no online competitive boards, fees, prizes or real settlement.
- Gameplay/render source: `apps/stacked/src/`. Parent simulation/codec/host/settings/persistence: `apps/portal/src/stacked-*.mjs`. Shell: `apps/portal/stacked/`.
- Authoritative planning references: `docs/stacked/STATUS.md` current September 13 section, `STACKED-MASTER-PLAN.md`, `STACKED-CYCLES.md`, `STACKED-CONTRACTS.md`, `DECISIONS.md`, and `spec/`. Historical status entries are not current acceptance evidence.
- Other task checkouts contain preserved unfinished work, including an interrupted merge. Do not copy their entire working trees. Import reviewed completed commits only; never reset or discard another task's changes.

## Completed foundations — preserve

1. Deterministic board/pieces, rotation, bag, hold, gravity, lock delay, clears/scoring, rising ledger, top-out and result tuple; frozen identity/schema contracts and deterministic replay evidence.
2. Input encoding/transport, replay verification, worker/inline parity foundations, run summaries and parent lifecycle. A previously saved 432,000-tick replay reproduced its exact terminal tuple; that evidence does not certify every long physical-device run.
3. Public cabinet entry, Free starting levels/practice, Free medal shelf, settings, keyboard/touch/controller inputs, pause/results/restart focus and parent-owned session handling.
4. Device-local Ranked verification, non-destructive persistence, session history surviving reload and source-labelled results. Free practice does not become canonical Ranked progress.
5. Board renderer, ghost/preview/hold, responsive layouts, atmosphere, quality/reduced-effects controls, audio-reactive presentation and shared music integration.
6. A rotating native cabinet presentation with frame-count-driven motion, plus the new living-field visualizer: swimming organisms, music-reactive movement, a line-clear particle burst and reformation into a new generation. Reduced motion produces a still presentation.

The beta launch is authorized. Final physical-device, competitive fairness, artistic and long-session acceptance remain open. Do not re-lock the cabinet because an older planning table says it is unfinished.

## Priorities and acceptance convention

Independent game tasks still share one portal and deployment. Assign a single owner for shared account, profile, verification and leaderboard APIs; the other game tasks consume that same versioned contract. Do not create three competing persistence/auth services or overwrite shared files from an older checkout. Integrate completed work from every game before publishing the shared site.

P0 = defect/integrity/performance prerequisite. P1 = production completion and requested polish. P2 = separately scoped future content. “Partial” means implemented but incompletely accepted; “Verify” means reproduce before modifying; “Proposed” means a recommendation rather than a shipped requirement. Checkboxes close only with source and actual-runtime evidence.

Recommended order: sustained device/input acceptance → visual/audio polish → complete profile/score surfaces → durable shared services → optional modes → separately authorized Web3. A performance optimization must not change piece timing, RNG, scoring or the ranked result.

## P0: responsiveness, determinism and performance

- [ ] **ST-P01 — Partial: physical mobile acceptance.** Run touch play on actual iOS Safari and low/mid-range Android, portrait and landscape, with browser bars, orientation changes and thermal load. Measure frame intervals, input-to-movement latency, long tasks, memory and dropped simulation time over a complete session. Acceptance: reliable rotations/drops/movement without accidental scrolling or lost releases; acceptable sustained performance documented per device.
- [ ] **ST-P02 — Partial: long-session visualizer budget.** Profile ordinary and reduced-effects play through all zones and many clears. Bound points, links, emitters, textures, event queues and allocations. Test audio analyzer disconnected/silent and rapid level changes. Acceptance: no accumulating work or degradation after repeated rounds; distinguish real wall-clock measurements from synthetic presentation fixtures.
- [ ] **ST-P03 — Partial: input reliability and accessibility.** Verify held-key release, focus loss, pointer cancellation, simultaneous gamepads, controller disconnect, repeat handling, touch sensitivity and safe-area containment. Offer useful remapping/left-handed choices only where implemented end to end. Acceptance: no stuck direction, duplicate hard drop or menu action leaking into play.
- [ ] **ST-P04 — Open measurement: cross-input fairness.** The adopted G-19 policy is one Ranked board with input-device disclosure; preserve it unless the owner changes it. Determinism is not proof that keyboard, touch and controller are equally competitive. Compare handling behavior and real players; retain input-device provenance and evaluate useful filters. Acceptance: published rule and evidence, with no silent historical leaderboard mixing.
- [ ] **ST-P05 — Partial: replay/verifier capacity.** Exercise maximum evidence size, long runs, malformed chunks, reordered/duplicate messages, worker failure and timeout. Current cold replay evidence had narrow headroom against the existing 400 ms benchmark; measure on representative hardware rather than raising the limit. Acceptance: bounded work, exact tuple/hash parity and fail-closed malformed submissions.
- [ ] **ST-P06 — Partial: loading and lifecycle.** Keep the stable Pixi vendor split, correctly cache mutable assets, avoid loading other games' heavy assets for STACKED and release resources on exit. Combined build reports 566,864 bytes of initial STACKED JS including vendor/shared modules. Acceptance: cold/warm cabinet entry, slow-network retry, repeated launch/exit, background/resume and WebGL context-loss behavior with no stale state.
- [ ] **ST-P07 — Verify: pause and suspended runs.** G-7 adopts a shared 15-minute Ranked pause budget, neutral input release and resume countdown; over-limit behavior must advance genuine neutral-input simulation to natural terminal before submitting replay-valid evidence. Audit actual implementation and recorded pause count/time against this policy. Test tab sleep, device lock, resumed audio and canonical timers. Acceptance: no huge catch-up burst, silent run loss or easier unrecorded pause exploit.

## P1: visuals, cabinet and motion

- [ ] **ST-V01 — Partial: living organism art direction.** Review the new swimming/burst/reforming sequence at normal play scale for recognizable silhouettes, variety and coherence with each zone. Tune flow and spatial composition around the board. Acceptance: desktop, small phone, tall phone and reduced-motion full-resolution captures; clears remain readable and organism motion never masks minos.
- [ ] **ST-V02 — Partial: all six zones.** Give every zone finished palettes, lighting, background forms, depth and transition identity; reconcile existing zone content before replacing it. Preserve the frozen six-zone contract, luminance/flash/bloom constraints and piece contrast. Acceptance: all piece colors and ghost cells legible in all zones and quality modes, including color-vision alternatives.
- [ ] **ST-V03 — Partial: gameplay animation polish.** Refine lock impact, line clear, combo, quad/“Halving” celebration, level transition, danger, top-out and results choreography. Confirm the current accepted player-facing terminology from `DECISIONS.md`. Acceptance: timing supports the canonical event without delaying the next piece or changing collision; reduced motion/flash still communicates the event.
- [ ] **ST-V04 — Partial: cabinet final acceptance.** Inspect the rotating cabinet's signage, screen content, lighting, edge quality and responsive crop; ensure animation pauses when offscreen/hidden and respects reduced motion. The frame-count-driven rotator and native artwork are already delivered. Acceptance: no stale six-frame assumption or excessive decoding on phones; visual quality matches the arcade's other cabinet cards.
- [ ] **ST-V05 — Partial: UI typography and containment.** Improve score/level/lines/hold/next clarity, empty states and tiny-phone spacing. Keep the board the dominant visual area. Acceptance: no cropped labels/buttons at 320 px width, landscape safe areas or increased text scale; focus is visible without adding visual clutter.
- [ ] **ST-V06 — Proposed further polish: effects preferences.** Offer clear intensity controls and a preview, subject to current settings ownership. Keep motion, flash and bloom independently useful where practical. Acceptance: settings persist and change only presentation; equal simulation result with every combination.
- [ ] **ST-V07 — Partial: final menu/loading art.** Inventory Free/Ranked/loading and achievement surfaces against the requested bespoke artwork. The recorded art direction calls for ChatGPT image generation for final menu/loading artwork; current procedural/vector zone art was explicitly accepted as placeholder work. Do not label those placeholders final bespoke art. Acceptance: approved coherent assets, readable foreground controls, provenance and measured encoded/decoded loading cost.

## P1: sound and music

- [ ] **ST-S01 — Partial: event sound identity.** Complete/tune move, rotate, hold, soft/hard drop, lock, single/double/triple/quad clear, combo, ledger rise, danger, level, top-out and menu/medal sounds. Audit actual registration/playback. Acceptance: recognizable cues with restrained repetition and no sound on invalid actions unless explicitly designed.
- [ ] **ST-S02 — Partial: musically coherent reactions.** Tune bass/high-frequency response, envelope smoothing, beat emphasis and clear/reformation transitions for quiet, dense, vocal and percussive tracks. Keep analyser data entirely outside simulation/scoring. Acceptance: recorded same-input result/hash equality with different tracks, mute and audio failure, plus visible fallback when music is unavailable.
- [ ] **ST-S03 — Partial: mix and voice limits.** Establish peaks/loudness, category volume, priority, ducking and maximum simultaneous voices. Prevent rapid drop/clear bursts from clipping. Acceptance: phone/headphone/desktop listening, mute persistence, pause/resume, background interruptions and no double music on restart.
- [ ] **ST-S04 — Partial: soundtrack curation and provenance.** Reconcile available licensed tracks and audio assets, length/gaps/loop transitions and support copy. Acceptance: no unlicensed additions or abrupt dead-air transitions; failures have a useful silent fallback and do not block play.

## P1: menus, onboarding and gameplay completion

- [ ] **ST-U01 — Partial: first-game teaching.** Explain move/rotate/drop/hold, rising ledger, danger and practice options in a short skippable guide adapted to active input. Acceptance: first-time players can start and understand top-out; returning players enter quickly without forced tutorials.
- [ ] **ST-U02 — Partial: settings and pause consistency.** Audit every visible setting, control mapping, effect toggle, music control and return/resume action against current parent/child ownership. Acceptance: no dead setting, focus trap, accidental drop, double pause or preference reset when switching games.
- [ ] **ST-U03 — Partial: results and practice loop.** Improve cause of top-out, score components, lines/level/combo, earned medals, personal-best comparison and fresh restart. Clearly separate Free medals from Ranked achievements. Acceptance: one result per run, current stats after retry/reload and no cross-mode writes.
- [ ] **ST-U04 — Partial: difficulty and endurance balance.** Measure early learning, increasing gravity/ledger pressure, cap behavior and survival-versus-skill scoring. Preserve frozen constants until a deliberate versioned balance slice. Acceptance: replay/fixture updates justified by a measured change, with old records partitioned if comparability changes.
- [ ] **ST-U05 — Partial: accessibility.** Finish keyboard/gamepad menu navigation, screen-reader menu semantics, readable contrast, color-independent piece cues, reduced motion/flash and optional haptics. Acceptance: controls remain operable without audio or touch precision and haptics fail silently on unsupported devices.

## P1: User Profile and Scores / Leaderboards

The shared parent already has profiles, usernames/avatars, local storage, cadence board rendering and source filtering. STACKED adds its own settings, persistence, summaries and replay store. These foundations must be reused; they do not constitute cross-device accounts or a trusted global scoreboard.

- [ ] **ST-D01 — Partial: complete STACKED profile surface.** Reconcile every recorded statistic with the contracts/run-summary schema: best score, lines, level, clear types, combos, survival, handling/input device and ledger data where present. Add missing display/aggregation only from captured facts. Acceptance: result → history → profile agreement, unknown older fields stay unknown, no HMH/Chikun stat leakage.
- [ ] **ST-D02 — Partial: achievement and medal completion.** Reconcile the sixteen planned achievement definitions with actual resolver/atlas/profile consumers. Implement or finish missing progress/date details and accessible requirement disclosures. Acceptance: game-scoped canonical unlocks, duplicate prevention, correct Free shelf isolation and migration.
- [ ] **ST-D03 — Partial: local leaderboard clarity.** Verify cadence filtering, best-per-wallet selection, tie breaks, input-device metadata, reload history and House/demo/local separation. Acceptance: the interface consistently says device-local preview and never presents a local verification stamp as a chain/global result.
- [ ] **ST-D04 — Open shared service: durable account sync.** Implement authenticated parent APIs/storage for identity, preferences, per-game records and paginated history. Plan migration from local preview without silently promoting unverifiable local scores. Acceptance: cross-device synchronization, wallet/account-change isolation, export/deletion and honest offline/quota/error states.
- [ ] **ST-D05 — Open shared service: trusted online boards.** Build server-side replay verification, bounded evidence ingestion, idempotent results, season/cadence partitioning, pagination, moderation and rate limits. Specify pause/input-device/fairness rules first. Acceptance: forged/replayed/wrong-game/wrong-season submissions rejected; a second device reads the confirmed score and provenance.
- [ ] **ST-D06 — Partial/proposed: replay retention and viewer.** Current evidence/replay storage exists; finish an accessible seek-safe results viewer, bounded retention and explicit export/import policy. Do not run expensive full replays on each scrub. Acceptance: seeking does not mutate stored results, memory stays bounded and malformed imports are rejected.
- [ ] **ST-D07 — Open: privacy and operations.** Define retention, support/error reporting, consent-aware funnel and metrics that help balance without logging wallet secrets or unnecessary input streams. Acceptance: documented incident/replay dispute flow and a truthful account/score status page.

## P2: future modes — not required to describe the current beta as playable

These are retained roadmap directions, not completed features. Scope each separately after the base game is stable; confirm product decisions before backend spending or changing competition.

- [ ] **ST-F01 — Proposed: local two-player.** Implement two boards, keyboard split/two gamepads, garbage routing and clear winner/rematch flow using the existing match seam. Decide whether results are machine-local and whether portrait tablets are supported. Acceptance: independent inputs, deterministic match result, readable layout and no accidental profile write.
- [ ] **ST-F02 — Proposed: same-seed ghost board.** Replay a retained best stream as a noninteractive comparison; obtain opt-in before using another player's stream. Acceptance: replay/retention versioning and no effect on canonical play.
- [ ] **ST-F03 — Proposed: daily challenge.** Use a parent-owned UTC seed and explicit version/season, with a clear dedicated board/filter decision. Acceptance: equal course across time zones, rollover during an active game handled and no Ranked seed supplied by the child.
- [ ] **ST-F04 — Gated future project: online versus.** Decide relay/backend operator and cost, matchmaking, lockstep/desync/forfeit policy, ranking and privacy before implementation. Test network delay/dropout/reconnect, authority and abuse. Do not activate paid competition, rating backend or new service credentials on the basis of the beta release request.
- [ ] **ST-F05 — Proposed: further cabinet/zone content.** Reconcile the new rotating cabinet and completed living visuals before planning additional art/themes. Keep shared portal changes compatible with HMH/Chikun and within loading/texture budgets.

## Web3 implementation and activation

`SETTLEMENT_LIVE=false`. Wallet-bound local Ranked is not an on-chain score, NFT, payment or prize. The portal's existing simulated settlement path and legacy contract addresses do not prove current hardened ABI compatibility. The original STACKED Phase 1 did not include paid entry.

- [ ] **ST-B01 — Open design: choose the actual Web3 product.** Define whether STACKED needs wallet identity only, durable verified scores, optional achievements or a later paid mode. Preserve free play and avoid requiring a wallet for basic practice. Acceptance: documented user benefit and truthful UI state for each feature.
- [ ] **ST-B02 — Open shared implementation: trusted attestation.** Add server replay validation and domain/chain/game/season/wallet/session/nonce/expiry-bound signing. Keep keys server-side and support rotation/revocation. Acceptance: invalid/duplicate/replayed evidence cannot become an official score; verifier outage is recoverable.
- [ ] **ST-B03 — Partial source/open end-to-end: contract compatibility and readback.** Reconcile deployed versus hardened planned contracts, register the correct STACKED version and verify score/profile/achievement readback in an explicitly approved environment. Acceptance: real confirmed records match canonical values and wrong-chain/account submissions fail safely.
- [ ] **ST-B04 — Gated: activation and economics.** Any contract deployment, real transaction, authority change, fee, prize, token or NFT activation requires separate explicit approval and finalized recipients/economics/disclosures. Prepare tests and a reviewable proposal first. Acceptance after approval: actual receipt, indexer/readback, idempotency, transaction failure/replacement and incident recovery.
- [ ] **ST-B05 — Open assurance: shared account and epoch isolation.** Partition test/local/verified/mainnet records, maintain replay version compatibility and avoid converting local medals into financial assets. Acceptance: no cross-game or cross-epoch progress leakage and no display of simulated hashes as confirmed transactions.

## Original S-01–S-22 crosswalk

The original cycle map remains useful for acceptance details. It is not a list of 22 unstarted features.

| Cycles | Current reconciliation | Remaining lane |
| --- | --- | --- |
| S-01–03 identity/core/scoring | Implemented, preserve golden behavior | U04 for deliberately scoped balance; P05 integrity |
| S-04 codec/replay | Substantial implementation and saved parity evidence | P05, D06 long-run/worker/viewer acceptance |
| S-05 difficulty/soak | Foundations and soak evidence exist | P01/P02/U04 sustained human/device acceptance |
| S-06 cabinet | Public beta enabled; old dev-only launch hold superseded | V04 final cabinet polish |
| S-07 board hygiene; S-08 summary; S-09 schema; S-10 verifier/scoping | Source implementations exist; audit exact consumers rather than redo | D01–D05, P05 migration and global-service work |
| S-11–14 build/renderer/zones/audio | Playable renderer and reactive visuals implemented | P02/P06, V01–V06, S01–S04 |
| S-15 mobile/input/thermal | Automated layouts/input implemented | P01/P03/P04 actual-device and fairness acceptance |
| S-16–18 lifecycle/settings/Ranked | Playable Free and device-local Ranked preview implemented | P07/U01–U03/D03–D05 |
| S-19 achievements; S-20 profiles/boards | Free medals and local surfaces exist | D01–D03 completeness; D04–D05 durable services |
| S-21 QA/performance/security | Release checks exist; full device acceptance open | P01/P02/P05 and release checklist below |
| S-22 ship | Tested public beta authorized; no fee/global/settlement authorization | Incremental release checks; financial lane remains B01–B05 |

Original gate records include naming, pause policy, device fairness and future multiplayer decisions. Inspect `DECISIONS.md` before reopening a question. The old per-deployment launch hold is superseded for the owner-authorized tested beta/website work; financial and new backend commitments are not.

## Verification, release and completion criteria

- [ ] **ST-Q01 — Open: human acceptance.** Record first-time keyboard/controller/touch play, readability in all zones, full game/result/retry flow and physical-device listening. Record issues and fixes; emulation is not hardware certification.
- [ ] **ST-Q02 — Per slice: behavioral and visual evidence.** Run relevant STACKED deterministic/input/settings/persistence tests, actual `scripts/stacked-playable-browser-smoke.mjs`, cabinet smoke, living visualizer smoke and performance measurement. The visualizer fixture proves presentation phases only; it does not prove a human played a long session.
- [ ] **ST-Q03 — Per release: combined regression.** Run full baseline-aware release gate, syntax, build/asset/docs/contract checks and HMH/Chikun browser flows after shared changes. Preserve the exact existing 51 retirement exceptions; reject new failures. Do not accept visual baseline changes blindly.
- [ ] **ST-Q04 — Per release: coordinated deployment.** Import only completed reviewed commits into the current combined release. Inspect current live deployment immediately before promotion; reconcile any newer release. Deploy privately, verify ready build and file hashes, promote tested candidate, check all three public games and cache migration, and retain an exact rollback.
- [ ] **ST-Q05 — After acceptance: launch materials.** Capture real gameplay in each zone, line-clear sequences, phone controls and cabinet motion. Publish a truthful feature matrix and help/support content. Do not advertise online versus, prizes, NFTs or global ranking before they work and are authorized.

Completion means the selected scope has tested implementation, visual/audio/device evidence, truthful profile/score behavior and a verified published release. It does not mean every optional future mode or financial feature is automatically authorized. Website publishing and public editable-source/model disclosure remain separate scopes.

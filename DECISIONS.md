# Decisions

## 2026-09-10 — Verified website update with explicit remaining acceptance debt

The owner requested "please continue and push live" and then explicitly selected **"Yes, publish the verified update with those items open."** The question named the combined website/game update, automated checks, browser review and Preview verification as prerequisites, while retaining unfinished AAA art and human playtests as open work and keeping financial activation disabled.

This supersedes the publication-only hold for this verified combined website update; it does not certify the five first-time desktop/five mobile playtests, physical-device coverage, complete native art, or all-register AAA acceptance. Those tasks remain open and must be reported truthfully. Hermes remains the single integration/publisher owner. Preserve approved heroes, Chikun, the mixed candidate, and STACKED's pause. Keep `SETTLEMENT_LIVE=false`; no wallet/contract/funds/Mainnet or irreversible authority activation is included.

## 2026-09-09 — Ranked data, wallet-locked achievements and launch reset

The owner reaffirmed visuals, animation, physics, effects, sound and measured gameplay/balance completion before the final Web3 acceptance pass. Codex continues its isolated level/interactions/animation/controls lane; Hermes remains integration/release owner.

Required Testnet outcomes: MetaMask, Rabby and other compatible wallet connection on LitVM; Ranked entry at least **.1 zkLTC** and settlement of the game session; in-depth history for **every** Ranked session under the player's game profile, with a curated best-stat global leaderboard; achievement NFTs locked to the recipient wallet and non-transferable. All Testnet scores, achievements and unlocks are provisional, with a universal logical reset before Mainnet launch. Mainnet also requires an additional Ranked platform fee; its amount and adopted recipient/split are not yet specified.

Implementation and acceptance requirements are in `docs/hmh-reboot/RANKED-DATA-AND-LAUNCH-EPOCH-REQUIREMENTS.md`. The current device-local 50-summary cache is not the required durable ranked archive. A transaction string or format-valid local summary is not verified on-chain gameplay. A launch reset must separate chain/deployment/epoch and all stores; it does not erase historical Testnet transactions.

These are product requirements, not performed network operations. Keep `SETTLEMENT_LIVE=false`; mainnet deployment, real funds, settlement activation and irreversible authority actions retain separate approval gates. No fee or split proposal is adopted by this record. Preserve Chikun, STACKED's pause and exact-candidate human/device/publication gates.

## 2026-09-09 — Owner identity, acceptance recommendation and concurrent integration

The owner supplied **KingDankKush** and **kingdankkush420@gmail.com** for the operator/support copy and delegated the recommended acceptance choice. The portal now has a support/privacy/terms/accessibility/testnet surface using that public identity; no registered-entity verification or legal-compliance certification is claimed.

Retain the existing five first-time desktop and five mobile human playtests, physical-device coverage and exact-candidate owner visual acceptance as full-release gates. The recommendation does not fabricate those results or silently relabel the project an approved beta.

The owner confirms Codex is continuing level design, interactions, animation and controls in its isolated copy. Preserve that work, the existing mixed Hermes worktree/index and single-publisher authority. Exchange immutable bounded before/after packets and required dependencies, stop on divergent target hashes, and reconcile later rather than force a clean tree or replace a working copy. Do not apply a second bundle-factoring scheme without measuring the complete combined startup closure.

Current evidence and remaining blockers: `docs/qa/hmh-owner-return-checkpoint.json`. Website publication still requires the combined candidate's acceptance. Chikun is preserved, STACKED remains paused, `SETTLEMENT_LIVE=false`; mainnet, funds and irreversible authority actions remain separately gated.

## 2026-09-08 — Confirm existing atlas decision and bounded hardening authority

H-0 is resolved by `docs/hmh-reboot/cycles/MODEL-COMPLETION-AUTHORITY.md`: exact lossless WebP, 4,194,304 bytes maximum per hero and 16,777,216 bytes for all four compressed gameplay atlases, 2048 atlas maximum, all 648 frame IDs retained, lazy loading and unchanged reproducibility gates. Native masters remain full-resolution source-only assets. Fresh source-density exports are 256 px Commando/Valkyrie, 216 px Lilly and 224 px Lester; these are raster derivatives, not replacement models. Separate transfer bytes, decode cost and GPU memory; certification is still required. Do not reopen the earlier three-option question as an unanswered gate.

The owner supplied Claude's `fable/hmh-open-work-register` guide and said "Excellent. Please proceed." This authorizes one additional pass on the already proposed six hero-hardening issues: logical-coordinate precision, private drift-report routing, exporter destinations, measured camera pitch, private quality limits and runner provenance. It does not authorize remodeling, increased limits, failed-gate publication or a further automatic correction loop. Preserve the original adjudication; record approval and worker scope separately.

Continue the existing rollout, keep STACKED paused, preserve the ruined-yard town direction and use repo-owned synthesis or already-approved licensed audio without new spending. Existing website-layer delivery authority remains conditional on certification; no contract/funds/settlement/credential or irreversible authority action is included.

## 2026-09-05 — Performance-first reference hero upgrade

Owner direction: recreate the four supplied heroes in Blender, preserve established game systems, complete roadmap improvements and push verified major upgrades live. Follow-up: "Do whatever is recommended to ensure the best gameplay (fast framerates, fast action, good visuals, responsiveness, etc)."

Decision: use lossless WebP (`exact=True`) for candidate 256px gameplay hero atlases; retain PNG render intermediates outside the runtime package and preserve selected-hero lazy loading. Measure actual full-clip packing, cold decoder cost, GPU texture allocation and active mobile performance before selecting page layout or final numerical caps. Prefer the lowest measured memory/layout cost that preserves frame quality and interaction latency, not an automatic 4096px expansion. Keep existing reproducibility limits unchanged. The shipped PNG pipeline and all existing budgets remain active until the complete replacement candidate is measured and certified.

Reference policy: the eight supplied PNGs are approved source design references. Preserve original bytes, per-file SHA-256 and filenames under `assets/source/reference/heroes/` using LFS. They are not runtime textures. Supplied images supersede older outfit briefs and handoff transcription errors; document anatomical side discrepancies explicitly.

Boundaries: no engine migration, save/bridge/schema break, unrelated branch merge, contract deployment, settlement activation or real-funds action. Public website deployment approval applies to gate-passing upgrades only; source drafts are not approved production art.

Tripo approval: owner reports a new Pro subscription with 6,000 monthly credits and explicitly authorizes Tripo to help produce all 3D models. Upload the supplied game references and use existing subscription credits for this project; no additional-credit purchase or subscription change is authorized. Prove one Commando pilot through visual review, Blender cleanup/rigging/animation and measured game export before scaling generation. Record actual task IDs, settings, credit charges, returned assets and provenance. The rejected procedural Commando remains an uncertified source experiment, not a replacement.

Revisit atlas decisions if measured mobile upload/decode or memory violates the current gameplay performance floor. KTX2 requires a measured quality and memory benefit, including transcoder payload, before adoption.

## 2026-06-04 — Lester's Arcade replaces Dungeon Ledger as the primary Web3 game direction

Decision: Treat Lester's Arcade as the main Web3 game/platform concept going forward.

Rationale: It better matches Justin's interests in Litecoin, retro gaming, arcade machines, pixel art, EVM wallets, and a scalable dapp ecosystem.

Tradeoffs: The concept is larger than a single game, so the MVP must stay narrow: one portal, one playable cabinet, simulated paid mode, and modular smart contract skeletons.

Revisit when: The first local prototype and LitVM testnet contract deployment plan are complete.

## 2026-06-04 — Start with local/off-chain gameplay and on-chain rails

Decision: Gameplay runs in-browser/off-chain while contracts handle profiles, paid sessions, score eligibility, achievements, tournaments, and revenue routing.

Rationale: Arcade gameplay needs speed and smoothness; on-chain game loops would be expensive, slow, and hard to ship.

Tradeoffs: The MVP uses a trusted score verifier path before fully trustless anti-cheat is solved.

Revisit when: There is enough gameplay value to justify deterministic replay verification or stronger score proofs.

## 2026-06-04 — Free play is untracked; paid play is official

Decision: Each game should support free casual mode and paid official mode.

Rationale: Free mode lets users enjoy and test games without friction; paid mode makes leaderboards, achievements, tournaments, and developer royalties economically meaningful.

Tradeoffs: Paid mode requires anti-cheat, payment UX, and clear rulesets.

Revisit when: First paid-mode UX is tested on LitVM testnet.

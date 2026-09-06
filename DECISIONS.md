# Decisions

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

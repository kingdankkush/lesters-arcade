# Decisions

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

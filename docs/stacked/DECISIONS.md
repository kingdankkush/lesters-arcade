# STACKED owner decisions

## Delegated development authority — 2026-09-06

After requesting the complete game, polish, optimization, playtesting, bug fixes,
Web3 integration, leaderboards, achievements and menus, the owner directed:
**“Use your best judgetment and whatever you recommend.”**

The choices below exercise that delegation for reversible development. They do not
claim a human device pass, authorize funds or contract deployment, or authorize
production promotion. Earlier unanswered questions are superseded by this direction.

| Gate | Status | Decision | Blocks / remaining condition |
| --- | --- | --- | --- |
| G-1 | ADOPTED | Display HALVING; preserve quad identifiers. | Copy and ship use this name. |
| G-2 | CONDITIONAL | A playable release candidate is authorized after actual acceptance gates. | Public flip waits for S-22 and recorded on-device acceptance; production promotion is G-15. |
| G-3 | CONDITIONAL | Implement zero-fee, local, unshared replay-verified Ranked writes in the parent. | Enable only after end-to-end integrity/isolation gates; retain prototype and seed-shopping disclosures. |
| G-4 | ADOPTED | Level cap 30 and combo-bonus cap 20. | Preserve frozen tuning until evidence justifies a versioned mechanics correction. |
| G-5 | ADOPTED | Dedicated versioned STACKED Pixi vendor entry; do not mutate HMH's vendor chunk or relax its budgets. | Measure actual STACKED bundles and record budgets; no guessed permissive caps. |
| G-6 | CONDITIONAL | Author strict CSP first. A route-specific exception may be considered only from a recorded Pixi violation and quoted call site. | No global unsafe-eval; fresh browser/security certification before accepting a necessary exception. |
| G-7 | ADOPTED | Shared 15-minute Ranked pause budget, neutral input release and explicit resume countdown. Over-limit forfeits control, advances genuine neutral-input sim ticks to a natural terminal, then submits only replay-valid evidence. | Never fabricate a terminalReason or write an unverifiable nonterminal result. Preserve lifecycle cause separately. |
| G-8 | ADOPTED | Fix game-scoped achievement resolution with HMH/Chikun regression fixtures. | No cross-game unlocks and no bulk revocation of existing player achievements. |
| G-9 | ADOPTED | Dedicated stacked-season-preview-1. | Registration may proceed. |
| G-10 | ADOPTED | Free undo, start levels 1–15, optional aids and device-local medal shelf. | No profile, XP, leaderboard, official session or Ranked achievement writes from Free. |
| G-11 | ADOPTED | Ghost piece enabled in Ranked. | Projection-only, identical availability for all players. |
| G-12 | ADOPTED | Registry-driven shared parent settings panel. | Child pause controls may request it; do not fork the persisted settings model. |
| G-13 | ADOPTED | Browser gates belong to ship:gate, not vercel:build. | Keep the cloud build Node-only. |
| G-14 | ADOPTED | Development-only autoplay for soak/testing; reject it in Ranked. | Pilot evidence is automation, never human playtest evidence. |
| G-15 | OPEN | Production promotion requires explicit approval naming the exact deployment ID. | No production promotion, real funds, paid entry, settlement activation, authority change or contract deployment is authorized. |
| G-16 | DEFERRED | Online versus and its relay/backend are outside Phase 1. | No new recurring service or multiplayer infrastructure purchase. |
| G-17 | ADOPTED | Fix comparator correctness now. Retention must be non-lossy: archive and verify old buckets before any removal, retain all-time, and do not prune if archival fails. | No unbacked irreversible cleanup of existing saves. Record this safer refinement in S-07. |
| G-18 | ADOPTED | Six data-driven zones; consistent procedural/vector placeholder art, with accessible palettes and polish. | Do not change zone count or claim bespoke final art. |
| G-19 | ADOPTED | One Ranked board, with input-device disclosure in row/detail metadata where persistence permits. | Do not split scores into separate boards or call determinism a fairness proof. |

## Interpretation of the spec

Use contract precedence. When a frozen rule is demonstrably unsound rather than
merely inconvenient, first produce a failing counterexample, then record the smallest
correction, update the affected specification and any required simulation version,
and obtain independent code review. Do not silently change constants, weaken a gate,
forge evidence, or transplant unrelated HMH work from the historical source branch.

The pause-limit refinement keeps all five sim terminals and the recorded-mask format
intact: forfeited runs step the real simulation with neutral inputs; the verifier sees
those same ticks. A lifecycle timeout is not itself a forged sixth sim terminal.

The retention refinement replaces the plan's unbacked deletion with verified archival.
Quota or archival failure must leave original buckets untouched and visible as a
maintenance warning, never be interpreted as permission to discard player history.

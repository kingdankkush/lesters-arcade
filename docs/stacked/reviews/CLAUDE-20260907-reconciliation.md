# Independent review reconciliation

Checkpoint: 2026-09-07T19:17:59.692429+00:00

The supplied Claude review is evidence to verify, not an acceptance or owner-gate ruling. Findings below use current files; counts in the supplied report are historical. Machine-readable details: [reconciliation receipt](CLAUDE-20260907-reconciliation.json).

## Finding disposition

| Finding | Current disposition | Evidence / action |
| --- | --- | --- |
| F-1 | partly confirmed; source durability repaired | All four directories are registered linked Git worktrees with .git pointer files in one common repository; 16 total worktrees observed. Uncommitted candidate work was real. Four preservation refs now hold 87 raw-byte-verified changed files, with remote readback. |
| F-2 | variants confirmed; claimed gameplay divergence not demonstrated | Renderer changes only STACKED_ENTRY_JS_CAP null→16384 and STACKED_INITIAL_JS_CAP null→557056. Release adds STACKED_Q16_SCALE=65536 and STACKED_MAX_MESSAGE_BYTES=65536. No conflicting gameplay values in the diff. Release is canonical; renderer budgets require fresh measurement before adoption. Existing contract tests already enforce exact export values and generated JSON bytes. |
| F-3 | confirmed integration risk | Renderer sim is 12662 bytes; accepted sim is 39328; current unaccepted S-04 sim is 48573. Old renderer results are not current integration acceptance. Preserve first, selectively port renderer/shell without replacing current core. |
| F-4 | partly stale, still needs more precise status | Current STATUS says implementation resumed, not blocked before implementation. Its clean-worktree wording and incomplete inventory needed correction. S-04/S-05 and partial S-08 are implemented but unaccepted. |
| F-5 | previously repaired; current regression passes | Fresh current suite passes stop forces one neutral commit even when physical input is resampled before resume. A generic rejection of mask 255 is not adopted: the contract allows eight bits and defines simultaneous-bit precedence. Neutral-on-stop is mandatory; arbitrary chord-count restrictions are not. |
| F-6 | confirmed; repair pending | Current purity script is a substring scan of the sim only. Replace with AST-based dependency/global checks and positive/negative fixtures, including seeded-rng. Treat this as a structural audit, not a formal proof or sandbox. |
| F-7 | valid coupling test requested; proposed equality needs terminator accounting | SIC1 exists and codec tests cover short/general/terminator forms and maximal density. Add direct real-run equality of encoded size against the runtime prediction plus the required terminator, rather than changing simulation semantics to satisfy a header/body-only comparison. |
| F-8 | confirmed documentation improvement | Gravity uses direct level indexing with index zero unused/duplicated; lock tables use min(level, LOCK_LEVEL_CAP)-1. Preserve values and document conventions. |
| F-9 | clarification warranted, not a new codec | Contracts already specify edge-triggered movement, external DAS/ARR and one level-triggered softDrop bit, but held-state phrasing obscures committed pulse encoding. Clarify in an amendment without changing action order or byte format. |
| F-10 | delegated decision recorded; no mechanics change | Retain current true I-piece 180 geometry and shared STACKED_KICKS_180, without an extra in-place correction. This selects the accepted behavior rather than silently tuning it. |
| F-11 | contradicted by authoritative plan | STACKED-MASTER-PLAN.md §4.6 explicitly requires createStackedMatch in S-03 and says computeAttack/resolveGarbageExchange ship unused and tested. Retain the seam; attack table remains injection-only with zero runtime importers; no multiplayer UI/service in Phase 1. |
| F-12 | confirmed deliberate behavior to pin | drawStackedPieces refills two bags before its draw loop, including count zero. Add helper/runtime bag equivalence and zero-count cursor tests without altering canonical RNG behavior. |

## Delivery order and task coverage

- **T-1:** Completed: four preservation refs pushed and independently read back. These are WIP snapshots, not feature/release certifications.
- **T-2:** Current STATUS and this source-backed reconciliation replace stale assumptions.
- **T-3:** Use the Release contract module; regenerate/check JSON. Old preservation refs retain historical bytes. New integrations must not import an old core or budgets.
- **T-4:** Re-run neutral-release and resampling tests; retain valid simultaneous-bit input semantics.
- **T-5:** Add real-run encoder/predictor coupling, accounting for the terminator.
- **T-6:** Harden and falsify the AST/transitive purity audit before adding explanatory comments.
- **T-7:** Port renderer to the accepted integration baseline and recertify; no wholesale stale-core merge.
- **T-8:** Integrate the dev-only portal candidate with coming-soon status.
- **T-9:** Finish S-04 and S-08 against their full bars; current bridge regressions and pilot failure remain blockers.
- **T-10:** Clarify pulses versus physical held input in a versioned amendment.
- **T-11:** Keep current I-piece true 180/shared-kick behavior; record decision, not a tuning change.
- **T-12:** Keep the explicitly planned, tested match seam; multiplayer remains unexposed.
- **T-13:** Comment the two indexing conventions without changing tables.
- **T-14:** Add direct helper/runtime bag-sequence equivalence across seeds.
- **T-15:** Pin zero-count two-bag prefill and RNG draw accounting.
- **T-16:** The existing shared linked worktrees are valid. Only the parent owns active Release edits; other candidates remain preserved until selected integration.
- **T-17:** Continue feature/stacked-release-live with its production ancestry; never rewrite history, reset to stale main, or land on main. Re-read remote and production state before final integration/promotion.

## Acceptance boundary

S-01–S-03 remain accepted. S-04/S-05/S-08 work and the S-06/S-11/S-12 candidates are not accepted by this review. Complete remaining S-04–S-22 gates in dependency order. Browser gates run serially and outside the Node-only deployment build. Public launch still requires actual on-device acceptance; no automation receipt stands in for that. No real funds, paid entry, settlement, authority changes or contract deployment.

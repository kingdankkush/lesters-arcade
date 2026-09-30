# C1 — existing cockpit startup headroom

## Behavior and authority

The combined gathered prototype had only 1,132 bytes of initial headroom. Move the unchanged cockpit factory into the existing memoized Promise.all startup loader. It still resolves before its constructor, world creation, session initialization and bridge activation; the ticker remains stopped while waiting. No factory/callback, simulation, collision, AI, RNG, evidence, server, version or budget-cap change.

If the lazy join rejects after renderer initialization, release the already-owned early bridge and Pixi Application. Always attempt renderer destruction if bridge stop throws, report cleanup failure and retain the original download error. Successful joins keep both resources. App initialization failure before this join remains outside this slice.

## Actual evidence

- Existing-loader tests first failed 3/3; after loading change they passed 3/3. New cleanup checks then failed 3/3; final six tests pass, including stopped bridge/render resource attempts, standalone failure, successful retention and preservation of the original error. Counts are phases, not additive tests.
- Independent source/lifecycle and private-harness review passes; final receipt review is recorded in PROGRESS.
- Serialized local gate: 95/95 focused, zero skips; 1,225 JavaScript and 143 Python syntax checks; fresh build; three actual held-download cases; existing cockpit smoke at desktop/tablet/phone/landscape; four optional-pilot captured-state/evidence cases; four owned-text recovery cases with terrain streaming; all 12 visual scenes unchanged. This is not the full release gate.
- Initial total 1,047,444 → 1,039,992 B, recovering 7,452 B. Headroom 8,584 B under unchanged 1,048,576 B cap. Initial entry 317,647 B + static shared 251,487 B + pinned Pixi 470,858 B. Actual static traversal excludes cockpit and retains simulation modules.
- New test passes 6/6 from copied source with no .git or Git on PATH and only the declared Acorn parser. No test invokes Git.
- Source hashes remain identical throughout the local gate. Private browser entry and observations leave source/release-dist bytes untouched. Real failed download closes both owned resources and never constructs cockpit or advertises READY.

Receipts: [gate](../receipts/hmh-cockpit-c1-gate-20260929.json), [actual download cases](../receipts/hmh-cockpit-c1-lazy-browser-20260929.json), [compatibility and visuals](../receipts/hmh-cockpit-c1-compatibility-20260929.json). Original logs, RED phases, private emitted chunks and full screenshots remain in the task work archive. Original desktop/phone captures were inspected at full resolution.

## Limits and next work

Phone evidence is Windows Chrome (414×896/DPR1 in the new download cases; other harnesses use their recorded viewports), not physical XS Max acceptance. Fixed-clock captured-state equality is scoped optional-pilot correctness, not timing or complete Ranked parity. Recovery covers the four owned world texts; complete GPU/context recovery remains open. No baseline acceptance, integration merge, release version, deployment, credits or production art acceptance. Further runtime features still need lazy loading and fresh measured budgets.

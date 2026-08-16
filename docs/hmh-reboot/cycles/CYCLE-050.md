# HMH AAA Continuous Improvement Cycle 050

Date: `2026-08-15` (scheduled-run certification and commit: `2026-08-16`)
Status: `LOCAL CERTIFIED · COMMITTED fc6ad3da · PRODUCTION UNCHANGED`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `b14fbbeb` (Wave 10 formation-pressure closeout and handoff)

## Scope: deterministic Whale Enforcer authored-nav chokepoint pressure

1. **Authored-nav choke discovery** — `sampleChokepointDirection(...)` derives bounded heavy targets from the existing shared navigation graph. A valid choke is a walkable cell with exactly two opposite legal exits. Selection is limited to four authored-nav hops, must progress toward the player, follows the first stable legal edge around a blocked direct segment, and rejects candidates without a connected authored-nav route. No parallel lane map, pathfinder, or movement authority was added.
2. **Whale Enforcer role depth** — outside its 210-unit attack reservation and within a bounded 520-unit activation range, the Whale Enforcer approaches the nearest validated choke and holds within 65% of one nav cell. Hazards remain higher priority; cover logic is unchanged; committed tells cannot refresh the decision; formation pressure does not override the heavy role. Holding faces the player but produces zero movement velocity.
3. **Canonical authority preserved** — every approach step still runs through the existing fixed-tick swept collision, traversal, elevation, bounds, safety, and stuck-recovery path. Tests prove the heavy cannot teleport, cannot reserve a distant attack token while holding, and remains source-order invariant.
4. **Truthful observability** — immutable intent distinguishes `chokepointSeeking` from actual `chokepointHolding` and exposes `chokepointTarget`; the step report and runtime dataset expose separate seeking/holding counts. The 128-body benchmark now includes a forward/reversed two-heavy seeking fixture.
5. **Cache invalidation** — runtime bytes changed, so the parent service-worker marker advances locally from `v17-hmh-formation-pressure` to `v18-hmh-heavy-chokepoints`, with matching shell/load-speed contracts.

Replay note: this changes deterministic Whale Enforcer movement where a qualifying authored choke exists; pre-Cycle-050 replays in those encounters diverge.

## TDD evidence

RED was observed before implementation:

- `sampleChokepointDirection` was not exported;
- runtime telemetry lacked `enemyChokepointHolding`;
- the simulation report had no `chokepointHolding` count;
- a near-target hold regression test initially showed ordinary 96-unit velocity instead of zero, then passed after the hold-state fix;
- adversarial benchmark review found the synthetic flat-ground stub caused both heavy fixture traversal steps to be rejected. A new non-vacuity assertion failed with both enemies still at `x = 0`; replacing the stub with the canonical authored elevation query made both advance exactly one 96-units/second fixed step to `x = 1.6`.

GREEN coverage includes synthetic open/rerouted/disconnected nav fixtures, real Level One authored-nav traversal for 120 fixed ticks, hazard/tell precedence, source-order equality, immutable telemetry, canonical speed, and no teleporting.

## Verified local gates

- Focused enemy/nav/runtime suites: `35 / 35` PASS.
- Shell suite after build: `12 / 12` PASS.
- Syntax: `336 JavaScript modules + 49 Python scripts` PASS.
- Release retirement ledger: `2,195 evaluated = 2,144 passed + 51 exact expected legacy failures`; unexpected failures `0`.
- Thirty-minute deterministic long-run certification: PASS.
- 128-enemy benchmark: PASS; `90.45%` broadphase candidate reduction; `15,360` canonical safety steps; heavy fixture `2/2` chokepoint intents, `2/2` safety steps, and `2/2` actual canonical movements of `1.6` units; forward/reversed result equal.
- Build: PASS; HMH entry `384,816` bytes; Pixi vendor `575,891` bytes; aggregate initial HMH JavaScript `960,707 / 1,048,576` bytes; headroom `87,869` bytes.
- Local Chrome enemy-detail smoke: desktop + portrait mobile PASS; six production archetypes loaded, one canvas, zero console/network/runtime errors, no horizontal overflow.
- Five-profile release browser certification rerun against the explicit local origin: desktop, ultrawide, tablet landscape, portrait mobile, and landscape mobile PASS; all five profiles had `0` changed anchor pixels, and touch/control geometry remained contained.
- Browser performance rerun: desktop/mobile p95 `8.2 / 8.2 ms`; retained-heap deltas `-511,220 / -559,015` bytes; zero steady-state long tasks and zero runtime errors.

Scheduled-run revalidation on 2026-08-16 independently reran the live checkout rather than relying on the prior transcript: focused enemy/nav tests `35/35`, the 128-body benchmark, syntax, release ledger, build, shell `12/12`, long-run certification, desktop/mobile enemy-detail smoke, the serial five-profile browser matrix, browser performance, four-scenario network/console audit, asset QA, security checks, Web3 read-only audits, strict repository health, CDN gate, and documentation links all completed with their expected verdicts. The rebuilt HMH entry remained `384,816` bytes and Pixi vendor `575,891` bytes (`960,707 / 1,048,576` combined; `87,869` bytes headroom). Current browser p95 was desktop/mobile `8.5 / 8.1 ms`, retained-heap deltas `-4,244,591 / -3,883,414` bytes, with zero steady-state long tasks or runtime errors. All five responsive profiles again had zero changed anchor pixels and contained touch/control geometry.

Final closeout on 2026-08-16 reran the focused `35/35` tests, 128-body benchmark, syntax gate, release retirement gate (`2,195 / 2,144 / 51 / 0`), build, and post-build shell suite (`12/12`) against the frozen index. An independent offline `qwen3.5-4b-64k` review returned `PASS` with no blockers for staged binary SHA-256 `f6a1c656ed045c0d0cb3f86589fec83ff76f1cb0f0f2882c7fd090b181be533e`. That exact reviewed patch was committed as `fc6ad3da15d4cd134f565f1e6e579a7d63a087ba`; its one-parent binary patch has the same SHA-256.

A combined Node invocation of the load-speed test and shell test briefly failed because the load-speed test intentionally rebuilds and atomically replaces `dist` while Node ran the shell stat concurrently. This was a test-process race, not a candidate failure: the project build passed and the shell suite passed `12/12` when run serially, matching repository browser-serialization policy.

## Boundaries

- Production, Preview, aliases, and rollback deployments were not changed.
- No branch was pushed and `main` was not changed.
- No wallet, contract, settlement, RPC-write, transaction, paid service, asset upload, or LitVM action occurred.
- Parent authority and `SETTLEMENT_LIVE=false` remain unchanged.
- The first three hosted reviewer paths were unavailable: Hermes delegation lacked its configured Nous token, the local Codex CLI returned `401 Unauthorized`, and the scheduled-run Claude reviewer returned `401 OAuth access token has been revoked`. The final frozen index was instead reviewed by the independent offline local model named above before commit; no timeout or partial transcript was counted as approval.

## Recommended next bounded slice

Close the remaining Wave 10 evidence gap by extending the 100+ body soak with truthful attack-token occupancy plus projectile/effect-pressure maxima, then prove same-seed equality, different-seed divergence, two recurring encounter cycles, and low-FPS blocker safety. Keep the benchmark read-only over existing simulation/combat authority; do not create a second combat engine.

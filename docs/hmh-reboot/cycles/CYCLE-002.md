# HMH AAA Continuous Improvement Cycle 002

Date: 2026-07-24
Status: `PREVIEW VERIFIED · PRODUCTION APPROVAL PENDING`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `b2488667db7a634b975484d426b7f8103988a00a`

## Objective

Complete one bounded Phase 2 responsiveness slice: prevent rapid fire, melee, grenade, and dash taps from disappearing when a render frame admits zero fixed simulation steps.

## Preserved invariants

- PixiJS remains `8.19.0`.
- Simulation remains fixed at `60 Hz` with at most four catch-up steps.
- Input buffering is outside gameplay authority and is converted to canonical booleans before fixed-step callbacks.
- Replay/session IDs, RNG, collision, elevation, save schema `2`, bridge `hmh-bridge/v1`, and the `65,536`-byte bridge cap are unchanged.
- Child HMH does not request wallets, issue transactions, calculate settlement, or write Ranked authority.
- Free Mode does not write Ranked progress.
- Parent portal remains authoritative for identity, profiles, leaderboards, analytics, official completion, and settlement.
- No LitVM action occurred. HALT approval is still absent.
- No production deployment or alias change occurred.

## Audit decision

The earliest incomplete master-plan area remained Phase 2 controls/physics. Existing collision, elevation, low-FPS catch-up, dash traversal, and device mapping tests were already green. The highest-impact uncovered defect was render-partition-dependent loss of one-shot input edges.

Selected contract:

- buffer `fire`, `melee`, `grenade`, and `dash` rising edges for 100 ms
- preserve pending edges across zero-step frames
- consume after the first frame that admits one or more fixed steps
- expire instead of creating stale post-pause actions
- clear on existing blur, visibility, pointer-cancel, touch-cancel, and controller-destroy reset paths
- preserve held-action semantics and all authoritative gameplay systems

## Changed source

- `apps/hmh-reboot/src/input.mjs`
- `apps/hmh-reboot/src/main.mjs`
- `apps/portal/assets/generated/hmh-curated-level-kit/hmh-curated-level-kit-runtime.mjs` (deterministic Vercel-build refresh for existing portal lifecycle and analytics modules)
- `tests/hmh-reboot-input.test.mjs`

Documentation and certification files are not deployable runtime source.

## TDD evidence

- Initial focused baseline: `38/38` passed.
- RED zero-step/expiry: `0/2` passed for the intended missing-buffer assertions.
- RED pointer/touch/gamepad parity: `0/1` passed for the intended missing-edge assertion.
- GREEN focused controls/combat: `75/75` passed.

See `docs/hmh-reboot/RED-EVIDENCE-AAA-CYCLE-002.md`.

## Browser evidence

Same-task down/up events were shorter than a render frame and were verified through simulation consequences, not DOM input state.

Desktop:

- manual pointer fire reduced ammo `8 -> 7`
- melee accepted at tick `33`
- grenade charges changed `3 -> 2`
- dash entered cooldown through ready tick `637`

Mobile touch:

- melee accepted at tick `32`
- grenade charges changed `3 -> 2`
- dash entered cooldown through ready tick `637`

Both screenshots use the active `lit-commando` production atlas. Visual review found no missing assets, corruption, proxy actor regression, or touch-control overlap. Browser, console, and HTTP error counts were zero.

## Gates completed

- build: PASS
- HMH bundle: `963,568 / 1,050,000` bytes
- release ledger: `1,619 total / 1,567 passed / 52 accepted / 0 unexpected`
- syntax: `319` JavaScript modules + `40` Python scripts
- active production atlases: `4/4`
- security: `5/5`, zero findings
- sandbox security: `3/3`
- Web3 authority: `9/9`
- network/console: `4/4`, zero failures
- Chrome five-profile matrix: PASS
- Edge five-profile matrix: PASS
- combat browser smoke: PASS
- cockpit desktop/mobile smoke: PASS
- portal flow and interaction smokes: PASS
- performance smoke: PASS, desktop/mobile p95 `7 ms`
- input-buffer explicit-GC soak: PASS, `260,000` cycles, `2,000`-byte retained delta, pending size `0`
- reboot combat explicit-GC soak: PASS, stable 60/30/20 FPS outcomes and `618,136`-byte retained delta
- browser retained-memory A/B: NO REGRESSION; local Cycle 002 retained `42,492` fewer bytes than untouched production under the same held-action run

The experimental absolute 4 MB browser threshold fails on both untouched production and local Cycle 002. This pre-existing renderer/runtime debt is recorded in `MEMORY-AUDIT-AAA-CYCLE-002.md`; it is not attributed to or hidden by this cycle.

## Service-worker decision

No service-worker cache identity bump is required. The portal shell and service-worker source are unchanged, and scripts/styles use network-first caching; `/dist/hmh-reboot/game.js` refreshes from the network and updates the cache on a successful response.

## Deployment state

- Production remains the preserved deployment and rollback remains available.
- Cycle 002 preview `dpl_7jXSC1fjXSPtnAzEkzZx97CgTNXN` is Ready and byte-verified.
- Cycle 001 previews are superseded and remain unpromoted.
- Production promotion requires explicit approval for the exact Cycle 002 deployment.
- LitVM deployment or transaction activity requires separate explicit HALT approval.

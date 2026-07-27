# HMH AAA Continuous Improvement Cycle 021

Date: 2026-07-27
Status: `LOCAL CERTIFIED · ELIGIBLE FOR IMMUTABLE PREVIEW`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `9ff359eaf28b81a792a10a41b0d59db5f9ae5440`

## Bounded vertical slice

Add projection-only animated district-landmark signals to the 48 responsive atlas landmarks introduced in Cycle 014 without moving grounded prop sprites or changing collision, simulation, RNG, spawning, progression, evidence, results, or parent authority.

Five existing production prop types now carry district-matched ambient signal kits:

- `relay-console` — cyan relay scan
- `proof-pylon` — ice-blue proof pulse
- `warning-beacon` — amber warning sweep
- `crystal-cluster` — green crystal shimmer
- `liquidation-terminal` — magenta margin signal

Those assets span all six authored districts. The shared Pixi graphics pass draws bounded rings and cores behind visible props, reuses existing authored placements, respects camera culling, and does not alter sprite grounding.

## RED evidence

The focused authored-prop suite first failed because `resolveAuthoredLandmarkSignal` did not exist. New behavioral contracts require:

1. Multiple signaled landmarks in all six districts.
2. Stable output for identical placement/tick inputs.
3. Bounded pulse, alpha, and radius values.
4. Frozen `projection-only` results.
5. Fail-closed behavior for invalid ticks and non-landmark props.
6. Real Pixi geometry for visible signal anchors.
7. Separate visible and onscreen telemetry.
8. Zero animated signals under user or operating-system reduced motion.
9. Browser enforcement in fixed landmark scenes rather than the default spawn view.

Focused result: `7/7` PASS.

## Runtime and accessibility integration

- `createAuthoredPropDisplay` owns one shared `Graphics` object behind the grounded prop sprites.
- The render pass clears and redraws only cull-visible signal geometry.
- `settings.reduceMotion` freezes decorative motion at a stable midpoint.
- An operating-system reduced-motion performance profile also freezes the signals.
- Release telemetry publishes the actual onscreen animated-signal count as `data-authored-landmark-animated`.
- The four-profile cockpit smoke verifies the user preference persists through Restart and resolves to zero animated signals.
- The visual regression harness verifies at least one animated signal in every active certification scene and separately proves six visible landmarks with zero animated signals under OS reduced motion.

## Visual review

Full-resolution Frontier Relay mobile, Mining Camp desktop, and Hashwood desktop evidence was inspected.

- Signal rings remain behind prop crowns and do not float or move collision-bearing sprites.
- Colors reinforce district identity.
- Signals remain distinguishable from combat warnings and attack telegraphs.
- No route, actor, enemy, minimap, HUD, touch-control, clipping, or depth-sorting blocker was found.
- Machine-readable visual comparison remained within the approved unchanged tolerance, so no baseline acceptance was required.

## Certification evidence

- Syntax: `332` JavaScript modules and `49` Python scripts PASS.
- Release retirement gate: `1,721 total / 1,669 passing / 52 accepted legacy / 0 unexpected`.
- Raw `npm run test` continues to exit nonzero only for the same superseded Canvas/isometric generated-art contracts classified by the retirement gate.
- Production asset QA: four hero atlases, seven roster atlases, one selector atlas, and 29 prop assets PASS.
- Deterministic visual regression: `8/8` unchanged.
- Reduced-motion browser evidence: `6` landmarks visible, `0` animated signals.
- Browser matrix: desktop, ultrawide, tablet landscape, mobile portrait, and mobile landscape PASS.
- Cockpit matrix: desktop, tablet, mobile portrait, and short landscape PASS with zero browser errors.
- Production hero smoke: Lit Commando, Lit Valkyrie, Lester Original, and Lilly PASS on desktop/mobile.
- Collectible browser smoke: PASS.
- Network audit: four scenarios; zero HTTP, request, console, or page errors.
- Performance: desktop/mobile p95 `7 ms / 7 ms`.
- HMH bundle: `1,012,139 / 1,050,000` bytes.
- HMH bundle SHA-256: `7e6938dbad83dd1b36d71cc2cdc03008f36b30213754b2fb36bc13d4643492da`.
- Authored prop atlas: `57,080` bytes; SHA-256 `91350b6ce292f42bf36d100eac68bb66b309996f2468dc788cc362862f129d96`.
- Security: `5/5` PASS.
- Third-party sandbox: `3/3` PASS.
- Settlement boundary: `9/9` PASS.
- Strict repository health, CDN gate, and documentation link checks: PASS.
- Web3 live readiness remains `PARTIAL 3/4`; hardened Web3 promotion remains blocked.

## Deployment input hardening

The pre-deploy audit found that `.vercelignore` already excluded Git metadata, dependencies, and credentials but did not explicitly exclude local Hermes evidence/plans, temporary build state, the project-local Vercel Python target, or Blender backup files.

- RED contract failed on missing `.hermes` exclusion.
- `.vercelignore` now excludes `.hermes`, `.tmp`, `.vercel-python`, and `*.blend1`.
- Focused Vercel build/deploy contract: `3/3` PASS.
- No build-required source, test, validator, or tracked production asset is excluded.

## Other synchronized correction

The animation coverage generator refreshed the canonical display title for `gas-beast` from `Gas Beast` to `Gas-Tax Zombie Brute`. No actor ID, animation state, runtime behavior, or authority changed.

## Safety statement

- PixiJS `8.19.0`, fixed `60 Hz`, four-step catch-up maximum, render partitions, save schema, bridge contract, and deterministic gameplay remain unchanged.
- `SETTLEMENT_LIVE=false` remains unchanged.
- No wallet request, signature request, transaction, LitVM operation, contract operation, authority change, or real settlement occurred.
- Promotion is limited to the exact independently reviewed web candidate. The existing production deployment remains the rollback until post-promotion verification passes.

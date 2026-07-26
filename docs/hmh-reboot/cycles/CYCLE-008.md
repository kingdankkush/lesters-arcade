# HMH AAA Continuous Improvement Cycle 008

Date: 2026-07-26
Status: `LOCAL CERTIFIED · COMMIT PENDING · PRODUCTION UNTOUCHED`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `73e7dc92d88a021469c0a95475d93d0b48bc6c65`

## Objective

Close the remaining Phase 3 ledge-combat dead zones without weakening authored
elevation authority. A shot fired from a 64-unit platform could cross an enemy
at the ledge base before its bounded vertical settle reached the target hurtbox,
and the retained Litecoin Blade rejected the same downhill sweep on height.
Cycle 008 makes those interactions deterministic and surface-aware. It also
repairs the combat browser smoke, whose expected art telemetry still described
the pre-Cycle-007 graybox/vector defaults.

## Preserved invariants

- PixiJS remains `8.19.0`.
- Simulation remains fixed at `60 Hz` with at most four catch-up steps.
- Projectile, melee, target, cover, and terrain authority remain simulation data;
  rendering does not decide hits.
- Uphill shots and uphill melee remain illegal. The new melee reach is available
  only through an authored one-way drop and only in its authored direction.
- Cover still blocks combat, target order remains deterministic, and every target
  can be damaged at most once per attack policy.
- Save schema `2`, deterministic replay, bridge `hmh-bridge/v1`, Free/Ranked
  boundaries, and parent authority are unchanged.
- The child runtime does not request a wallet, sign, transact, or settle.
  `SETTLEMENT_LIVE` remains false.

## RED evidence

Current HEAD before implementation reproduced both defects:

```json
{"ledgeBaseProjectileHit":false,"ledgeBaseMeleeHits":0,"meleeRejection":"height"}
```

The first focused test run then failed because
`planProjectileFlightStep` did not exist, `main.mjs` did not route projectile
collision through it, and the authored one-way downward melee contract could not
produce a hit.

## Projectile terrain transitions

`projectile-physics.mjs` now owns the pure `planProjectileFlightStep` contract.
The live runtime carries each shot's current authored `groundZ` and asks the
planner for its next fixed-step position.

- Flat and small continuous downward changes preserve linear height behavior.
- A sharp authored drop greater than eight world units is located with 16 fixed
  binary-search iterations.
- Collision remains at the upper flight band before that boundary and switches
  to the lower flight band after it. A single fast step can therefore hit a
  target on either side without inventing a dead zone.
- Upward terrain never pulls the projectile upward, preserving high-ground
  authority.
- Optional transition metadata is validated and frozen with projectile state;
  cover, stop, pierce, pellet, hitscan, splash, and ricochet continue through the
  same deterministic resolver.

The synthetic cliff contract and the real ravine-overlook and mining-loader-deck
surfaces both resolve the transition. The two authored ledges produced the same
boundary fraction (`0.454559326171875`) and lower flight state (`groundZ=0`,
`z=34`) for the certified fixed-step sample.

## Authored downward melee

The retained Litecoin Blade adds a bounded `maxDownwardDrop: 64` attack band,
but that reach is dormant by default. `main.mjs` passes the current authored
surface's `oneWayDrop` direction into `stepMeleeState`; the resolver enables the
extra downward band only when the attack direction points through that drop.

Behavioral contracts prove:

- a legal downhill sweep hits;
- the same geometry without authored drop metadata remains height-rejected;
- attacking opposite the authored drop remains height-rejected;
- uphill attacks remain height-rejected; and
- existing range, arc, cover, ordering, cooldown, and duplicate-target rules are
  unchanged.

## Browser gate correction

The combat browser smoke still expected `prototype-human-graybox`,
`production-vector-enemies-v1`, and `production-vector-liquidator-v1` in normal
shipped runs. Cycle 007 intentionally made the certified hero and roster atlases
the default, with the older projections retained as explicit fallbacks. The
smoke now expects:

- `production-hero-atlas` for the player;
- `production-roster-atlas-v1` for live enemies and the active boss; and
- the certified mobile particle budget of 30 instead of the desktop budget of
  50.

Desktop, mobile, and bridge world-tour smoke states now pass and report no
console errors.

## Certification

### Focused and deterministic

- Ledge projectile + melee: `33/33` pass.
- Adjacent collision, elevation, projectile-origin, weapons, grenades, combat
  events, and lifecycle: `48/48` pass.
- Projectile fuzz: 20,000 cases, hash `8d88d351`, PASS.
- Projectile soak: 3,600 ticks, capacity 128, hash `e57ed205`, peak 128,
  458,688 resolutions, PASS.
- Projectile broadphase benchmark: scan/grid parity PASS at 100 and 150 targets;
  measured speedups 2.12x and 3.84x.

### Full release and assets

- `npm run check`: 332 JavaScript modules + 49 Python scripts pass.
- `npm run test:release`: `PASS tests=1695 passed=1643 expected_failures=52`;
  zero unexpected.
- `npm run build`: HMH bundle 993,876 bytes, below the 1,050,000-byte gate.
- `npm run assets:qa:hmh-reboot`: four hero atlases, seven roster atlases,
  29 authored props, all budgets and projection-only authority pass.

### Browser and visual

- Five-profile Chrome certification passes at desktop, ultrawide, tablet
  landscape, mobile portrait, and mobile landscape.
- Every profile's two anchor captures is byte-identical; changed pixels and
  maximum channel delta are zero.
- Live movement, pause, responsive geometry, one canvas, and touch controls pass.
- Eight-scene reboot visual regression passes unchanged.
- Performance smoke passes: 993,876-byte bundle, desktop/mobile p95 frame time
  7 ms, bounded active enemies/particles, zero captured errors.
- Cockpit smoke passes desktop and mobile.
- Combat browser smoke passes desktop, mobile, and bridge world tour.
- Parent portal E2E passes all six implemented flows with zero console errors.

### Security and repository

- HMH security audit: PASS, 5/5 checks, zero findings.
- Third-party sandbox security: `3/3` pass.
- Strict repository health: pass.
- CDN gate: 33 candidates / 101 MB, no destructive action.
- Documentation links: eight current/public documents pass.
- Repository audit: 596 files scanned, 24,127 unique references, 1,207 concrete
  referenced files. Generated audit timestamp drift was restored.
- No `.blend1`, pipeline lock, raw render, or Blender scratch artifact remains.

## Known debt

- Route clipping and ground-detail-over-road/water cleanup remain the next
  authored-world debt. They are not part of this combat slice.
- Projectiles intentionally never rise with terrain. A shot that descends into a
  depression can remain visually low after exiting it; gameplay hurtboxes still
  accept that band, but a future projection-only readability pass may improve
  the tracer without restoring uphill hit authority.
- Firefox and WebKit are not locally available; Chrome is the certified browser.
- Hardened Web3 remains blocked on deployment and trusted-attestation
  prerequisites. No live-wallet readiness claim is made.

## Deployment state

No push, preview or production deployment, promotion, LitVM action, transaction,
wallet/signature request, or settlement change occurred. Production remains the
Cycle 006 deployment `dpl_AvXkk8eXSGzX4jcviDNzVSsr9ap9` and
`SETTLEMENT_LIVE=false`.

## Exact-index policy

After documentation and generated-output cleanup, the intended candidate is
staged and frozen with literal `git diff --cached --binary | sha256sum`.
Independent reviewers must examine that exact binary patch. Any edit after the
freeze invalidates their verdict.

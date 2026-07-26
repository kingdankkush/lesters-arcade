# HMH AAA Continuous Improvement Cycle 010

Date: 2026-07-26
Status: `COMMITTED LOCALLY · 774522ad · PRODUCTION UNTOUCHED`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `2a579cf784364241fe1bd4326e9e94a3efd8bb49` — Cycle 009 world composition

## Objective

Close the carried projectile depression-recovery debt without weakening authored
elevation authority:

1. preserve the source projectile flight band as an immutable ceiling,
2. descend into authored depressions exactly as before,
3. recover at the far bank only up to that source ceiling,
4. locate sharp recovery boundaries deterministically inside the fixed-step sweep,
5. preserve low-side and far-bank contacts in the same fast projectile step,
6. retain collision, damage, replay, save, portal, Ranked/Free, and Web3 boundaries.

## Reproduction

Current committed Cycle 009 produced this synthetic `0 -> -24 -> 0` crossing:

```json
[
  { "x": 120, "z": 10, "groundZ": -24 },
  { "x": 150, "z": 10, "groundZ": -24 },
  { "x": 180, "z": 10, "groundZ": -24 },
  { "x": 210, "z": 10, "groundZ": 0 },
  { "x": 240, "z": 10, "groundZ": 0 },
  { "x": 270, "z": 10, "groundZ": 0 }
]
```

The real authored `liquidity-river` reproduced the same defect:

```json
[
  { "tick": 0, "x": 4512, "z": 10, "groundZ": -24 },
  { "tick": 23, "x": 5018, "z": 10, "groundZ": 0 },
  { "tick": 29, "x": 5150, "z": 10, "groundZ": 0 }
]
```

A ground-origin shot begins at Z 34, descends to Z 10 over the river, and then
remains visually and physically stuck at Z 10 after returning to ground Z 0.
Current ordinary enemy hurtboxes still overlap that band, but a higher-minZ
far-bank target would be silently missed.

## RED

`tests/hmh-reboot-projectile-physics.test.mjs` first required:

- synthetic depression recovery from Z 10 back to the source ceiling Z 34;
- a higher-minZ far-bank target to become hittable after legal recovery;
- a low-origin projectile to remain low when terrain rises above its source;
- malformed ceiling state below the current projectile height to fail closed;
- a sharp one-step recovery to preserve both water-side and far-bank contacts;
- the real `liquidity-river` query to recover on the east bank;
- live runtime propagation from muzzle spawn through every fixed step.

Before implementation the focused suite reported `22 pass / 3 fail`. The failures
were the synthetic recovery, authored river recovery, and missing runtime state
propagation contracts.

## Implementation

### Immutable source flight ceiling

`apps/hmh-reboot/src/main.mjs` records `flightCeilingZ: muzzle.z` when each live
projectile spawns and passes that value into every
`planProjectileFlightStep(...)` call.

The value is derived from canonical spawn state and does not enter save, replay,
bridge, or entity schemas.

### Bounded recovery

`apps/hmh-reboot/src/projectile-physics.mjs` computes the local desired flight
band as:

```text
min(nextGroundZ + flightHeight, flightCeilingZ)
```

A projectile may descend with terrain and may recover when terrain rises, but it
can never exceed its original source ceiling. Therefore:

- ground-origin fire still cannot rise onto a higher ledge;
- river-origin fire still cannot rise onto the bank;
- high-origin fire can recover after a lower depression only to its original
  legal height.

A supplied ceiling below the current projectile height is rejected.

### Bidirectional sharp-boundary planning

The existing fixed-count 16-step terrain-boundary search now handles both sharp
drops and legal sharp recovery. The existing frozen `heightTransition.time`
contract remains the collision authority:

- previous height before the boundary;
- current height at and after the boundary.

This preserves low-side and high-side contacts inside one fast sweep without
adding curved trajectories, extra broadphase work, or arbitrary uphill hits.

## Preserved invariants

- PixiJS remains `8.19.0`.
- Simulation remains fixed at 60 Hz with at most four catch-up steps.
- Projectile XY sweep, target ordering, damage, policies, cover, broadphase,
  ricochet, splash, pellet, and hitscan logic are unchanged.
- Level One terrain, collision, movement, routes, bridges, and encounter state
  are unchanged.
- Replay/session IDs, RNG, save schema 2, and bridge `hmh-bridge/v1` are unchanged.
- Free Mode does not write Ranked progress.
- Parent portal remains authoritative for identity, leaderboards, official
  completion, analytics, wallet, and settlement.
- `SETTLEMENT_LIVE=false` remains unchanged.

## Verification

### Focused and deterministic

- Projectile physics: `26/26` pass.
- Projectile, melee, elevation, collision, weapon, grenade, combat lifecycle,
  world-space, and Level One matrix: `106/106` pass.
- Deterministic projectile fuzz: PASS, seed `0x8f31d2a7`, 20,000 cases,
  hash `8d88d351`, 69,839 candidates, 5,331 hits.
- Projectile soak: PASS, 3,600 ticks, 150 targets, hash `e57ed205`, capacity 128,
  heap delta 266,192 bytes.
- Broadphase benchmark parity: PASS at 100 and 150 targets; 2.48x and 3.89x
  median speedup in this run.
- Syntax check: 332 JavaScript modules and 49 Python scripts.
- Build: PASS; HMH child bundle `994,575 / 1,050,000` bytes.

### Browser and visual

- Visual regression: all eight scenes pass without baseline acceptance.
- Combat browser smoke: pass on desktop, mobile, and bridge world-tour state.
- Five-profile release browser certification: desktop, ultrawide, tablet
  landscape, mobile portrait, and mobile landscape pass.
- Performance smoke:
  - desktop p95 `7 ms`, max `20.9 ms`;
  - mobile p95 `7 ms`, max `14.2 ms`;
  - bundle remains under budget and both profiles report zero errors.
- Cockpit browser smoke: desktop and mobile pass.
- Parent portal E2E: six implemented flows pass with zero console errors.
- Network/console audit: portal clean/warm and HMH clean/warm pass with zero HTTP,
  request, console, or page errors.

### Full release and repository

- Retirement ledger: `1,699 total / 1,647 passed / 52 accepted / 0 unexpected`.
- HMH security audit: 5/5, zero findings.
- Third-party sandbox security: 3/3 pass.
- Production asset QA: four hero atlases, seven enemy/boss atlases, and 29
  authored props pass unchanged.
- Strict repository health: pass.
- CDN gate: 33 candidates / 101 MB, no destructive action.
- Documentation links: eight current/public documents pass.
- Repository audit: 598 files scanned and 24,127 unique references; generated
  CDN report drift was restored.

## Known debt

- The muzzle-flash VFX still uses `actor.groundZ + 34` separately from
  `PROJECTILE_FLIGHT_HEIGHT`; both values match today, so this is drift risk only.
- Browser retained-memory debt from Cycle 002 remains open.
- `#combatMenuPanel` retains a hidden stale paused data attribute after restart.
- `grenades.mjs` blocker bounce still ignores `maxBounces` and
  `minimumBounceSpeed`; the bounded fuse prevents player-visible runaway state.
- Boss hurtbox/art coverage for endless cadence still lacks a dedicated visual pass.
- Firefox and WebKit are not locally available; Chrome remains the certified browser.
- Hardened Web3 remains blocked on deployment and trusted-attestation prerequisites.

## Deployment state

No push, preview or production deployment, promotion, LitVM action, transaction,
wallet/signature request, or settlement change occurred. Production remains
`dpl_AvXkk8eXSGzX4jcviDNzVSsr9ap9` and `SETTLEMENT_LIVE=false`.

## Exact-index policy

The intended candidate will be staged and frozen with literal
`git diff --cached --binary | sha256sum`. Independent review must examine that
exact binary patch. Any edit after the freeze invalidates the verdict.

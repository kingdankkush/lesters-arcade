# RED Evidence — HMH AAA Continuous Improvement Cycle 003

Date: 2026-07-25
Branch: `reboot/hmh-aaa-continuous`
Baseline: `f78e38f1` (Chikun-to-HMH Fable handoff commit)

## Slice A: world-boundary authority through depenetration

### Defect

`resolveSweptCircleMotion` clamped the starting position to world bounds only
**before** the depenetration passes. A blocker overlapping the world boundary
could depenetrate a body **through** the boundary, and because the swept
boundary check only fires for motion moving further outward, the body remained
outside the legal playfield permanently.

### Reproduction (pre-fix)

```text
body: player radius 16
blocker: circle x=40 y=200 r=30 (overlaps left boundary corridor)
bounds: minX 0, legal minimum x = 16
start: x=24 y=200 (embedded in blocker)

final position: { x: -6.000001, y: 200, z: 0 }
legal minimum x: 16
escaped world bounds: true
```

All four movement paths route through this resolver: player step, dash,
knockback, and enemy simulation.

### RED test run (before fix)

`node --test tests/hmh-reboot-collision.test.mjs`

```text
✖ depenetration cannot eject a body through the world boundary
✖ boundary-pinned depenetration slides tangentially toward legal space and stays deterministic
✖ bounded movement after boundary-adjacent depenetration keeps the final position inside the world
ℹ tests 12  pass 9  fail 3
```

### GREEN (after fix)

```text
ℹ tests 12  pass 12  fail 0
```

Neighboring suites (input, movement, dash, aim, elevation, touch controls,
enemy simulation, weapon system, projectile physics): `98/98` passed,
unchanged behavior away from the boundary case.

## Slice B: permanent portal E2E harness (previously missing entirely)

### RED state

`scripts/hmh-reboot-portal-e2e.mjs` and
`tests/hmh-reboot-portal-e2e-contract.test.mjs` did not exist. The prior
"portal smokes" were static marker checks only; no harness drove the real
portal DOM through guest boot, cabinet select, Free run, pause/resume,
restart, reload persistence, and exit in a real browser.

First harness run also produced genuine RED findings against wrong harness
assumptions, fixed in-harness (not in product code):

- `#hmhRebootStage` exposes no `data-simulation-tick` in normal mode (debug
  telemetry is intentionally absent outside evidence modes) — liveness is now
  proven by composited child-frame pixel comparison: frames change while
  running and are byte-identical while paused.
- The portal's "runtime connected" status copy is transient; readiness is now
  read from the child bridge status and session identity.
- The gameplay control bar is intentionally CSS-hidden during reboot runs;
  restart/settings/exit are driven through the pause-menu action grid.

### GREEN

Two consecutive full runs:

```text
PASS guest-boot
PASS guest-free-run
PASS pause-resume
PASS mid-run-restart
PASS settings-persistence-reload
PASS guest-exit-to-splash
Portal E2E passed for all implemented flows. (0 console/page errors)
```

Contract test `tests/hmh-reboot-portal-e2e-contract.test.mjs`: `5/5` passed.

### Observation (not fixed in this cycle)

After restart from the pause menu, `#combatMenuPanel` is correctly hidden but
retains a stale `data-state="paused"` attribute. Cosmetic only; recorded as
debt.

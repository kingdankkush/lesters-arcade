# Hard Money Heroes deterministic runtime contract

Status: reboot foundation contract for `apps/hmh-reboot`

## Fixed-step simulation

- Authoritative gameplay advances in integer ticks at exactly 60 Hz (`FIXED_STEP_MS = 1000 / 60`).
- Render-frame time is admitted through a fixed maximum before accumulation.
- A render frame may execute at most four ordinary simulation steps. Catch-up never multiplies movement, collision, or AI stride.
- Raw wall-clock time rejected by the frame clamp and time rejected by the accumulator ceiling are separate metrics. Each millisecond is counted once.
- Loss metrics persist until `takeLossMetrics()` marks an explicit certified measurement boundary.
- Rendering uses interpolation alpha to blend immutable previous/current spatial transforms. Interpolation never changes authoritative state.
- `start`, `active`, `paused`, `upgrade`, `game-over`, and `exit` are explicit states. Paused, hidden, upgrade, game-over, and exited frames do not accumulate future catch-up.

## Replay and randomness

- Every admitted fixed step emits an immutable replay tick containing its tick number, fixed delta, and immutable canonical action snapshot.
- The same seed and action sequence must produce the same tick event sequence regardless of render-frame partitioning.
- Encounter and drop randomness use independently consumed named streams. Reading one stream must never advance the other.
- Wall-clock timestamps and input-latency diagnostics are metadata and never enter deterministic gameplay inputs.

## World coordinates

The single canonical convention is:

- `x`: world right
- `y`: world down
- `z`: physical world height, positive upward
- `groundZ`: authoritative queried floor height at `(x, y)`
- `visualLiftZ`: render-only lift; never collision or gameplay authority
- Depth ordering: stable render-band base plus `y + depthBias`; neither physical nor visual height silently changes depth

Stable bands are `ground`, `lowProps`, `actors`, `highProps`, `projectiles`, `canopy`, and `overlays`.

Actor spatial state uses `x, y, z, vx, vy, vz, heading, groundZ, visualLiftZ, locomotion, combat, depthBias`.

Spatial resolution order is fixed:

1. Integrate a candidate from fixed-step velocity.
2. Resolve collision in canonical world coordinates.
3. Query one authoritative ground contact at resolved `(x, y)`.
4. Resolve physical elevation against that contact.
5. Update the world-space camera target.
6. Apply world-to-screen transforms for rendering.

Visible geometry and collision must consume the same world-space source data. Screen-space approximations are not gameplay authority.

## Camera and transforms

- Camera position, smoothing velocity, bounded aim/velocity look-ahead, zoom, and shake are independent fields.
- The dead zone is defined in world units.
- Camera follow uses a critically damped render-time response; it does not modify simulation movement.
- Aim/velocity look-ahead is magnitude-clamped before the dead-zone target is solved.
- Camera position is clamped to finite authored world bounds while accounting for viewport size and zoom.
- Shake affects only the rendered transform; it never mutates camera target or simulation state.
- `worldToScreen()` and `screenToGround()` are the shared transform pair used by rendering and pointer aim.
- Append `?debugGrid=1` to the child URL to draw the world grid with `x`, `y`, and sampled height labels.

## Canonical input actions

Gameplay receives one device-independent immutable action shape:

```js
{
  move: { x, y },
  aim: { x, y, active },
  fire,
  melee,
  grenade,
  dash,
  pause
}
```

- Movement and aim are independent channels and may be active simultaneously.
- Diagonal axes are normalized to unit magnitude.
- Pointer screen coordinates are converted through the canonical camera to a world direction before gameplay sees them.
- Touch and gamepad provide explicit aim directions.
- Device identity, aim source, last input timestamp, observed source latency, and reset reason remain metadata-only.
- Blur, hidden visibility, pointer cancellation, touch cancellation, and controller teardown clear sticky state.
- Gameplay surfaces disable browser touch scrolling and text selection.

## Verification files

- `tests/hmh-reboot-simulation.test.mjs`
- `tests/hmh-reboot-world-space.test.mjs`
- `tests/hmh-reboot-input.test.mjs`
- `tests/hmh-reboot-shell.test.mjs`

# HMH AAA Cycle 002 RED Evidence

Date: 2026-07-24
Branch: `reboot/hmh-aaa-continuous`
Baseline commit: `b2488667db7a634b975484d426b7f8103988a00a`

## Selected defect

Rapid one-shot combat inputs were represented only by current held state. A press and release that occurred before the next admitted fixed step was absent from the next `InputState.snapshot()`. This made short fire, melee, grenade, and dash taps frame-partition dependent even though authoritative simulation remained fixed at 60 Hz.

The bounded acceptance contract is:

1. Rising edges from keyboard, pointer, touch, and gamepad remain visible for at most 100 ms.
2. A render frame with zero fixed steps must not consume the edge.
3. The first render frame with at least one admitted fixed step consumes it.
4. The action must then clear unless the physical control remains held.
5. Reset paths clear all pending actions.
6. The simulation, replay, collision, persistence, Web3, and settlement boundaries remain unchanged.

## RED 1: zero-step render frame

Command:

```text
node --test --test-name-pattern='rapid one-shot|unconsumed one-shot' tests/hmh-reboot-input.test.mjs
```

Preserved log:

```text
.tmp/hmh-aaa-cycle-002/red-action-buffer.log
```

Observed before implementation:

```text
fire tap must remain buffered after release
false !== true

tests 2
pass 0
fail 2
```

The second failure established the exact inclusive response window: available at 100 ms, expired at 101 ms.

## RED 2: device parity

Command:

```text
node --test --test-name-pattern='pointer touch and gamepad rising edges' tests/hmh-reboot-input.test.mjs
```

Preserved log:

```text
.tmp/hmh-aaa-cycle-002/red-action-buffer-device-parity.log
```

Observed before pointer/touch/gamepad edge capture:

```text
pointer touch and gamepad rising edges receive the same one-shot action buffering as keyboard
false !== true

tests 1
pass 0
fail 1
```

## GREEN

Implementation:

- `apps/hmh-reboot/src/input.mjs`
  - adds a 100 ms pending-action window for `fire`, `melee`, `grenade`, and `dash`
  - captures only aggregate false-to-true transitions across input sources
  - expires pending actions by live input timestamp
  - clears pending actions on existing reset paths
  - requires the latest snapshot sequence for consumption
- `apps/hmh-reboot/src/main.mjs`
  - consumes pending actions only when `DeterministicSimulation.update()` admits one or more fixed steps
- `tests/hmh-reboot-input.test.mjs`
  - proves zero-step retention, one-step consumption, expiry, and device parity

Focused GREEN:

```text
.tmp/hmh-aaa-cycle-002/green-action-buffer-all-focused.log
75 tests
75 passed
0 failed
```

## Browser consequence proof

A disposable Playwright harness dispatched down/up synchronously in one JavaScript task, which is shorter than a render frame. It ran at the isolated bridge world-tour location with the active `lit-commando` production atlas.

Evidence:

```text
.hermes/evidence/hmh-aaa-cycle-002/action-buffer/report.json
.hermes/evidence/hmh-aaa-cycle-002/action-buffer/desktop.png
.hermes/evidence/hmh-aaa-cycle-002/action-buffer/mobile.png
.tmp/hmh-aaa-cycle-002/rapid-action-browser-production-art.log
```

Measured results:

- desktop pointer fire: ammo `8 -> 7`
- desktop melee: attack accepted at tick `33`
- desktop grenade: hand charges `3 -> 2`
- desktop dash: cooldown ready tick set to `637`
- mobile melee: attack accepted at tick `32`
- mobile grenade: hand charges `3 -> 2`
- mobile dash: cooldown ready tick set to `637`
- console errors: `0`
- page errors: `0`
- HTTP errors: `0`

The bridge can stop a dash on authored traversal boundaries; cooldown transition, rather than unbounded displacement, is the correct action-consumption proof there.

# HMH AAA Cycle 002 Memory Audit

Date: 2026-07-24

## Result

**PASS for Cycle 002 regression safety; pre-existing browser retained-memory debt remains open.**

The new `InputState` buffer is bounded and does not retain action history. A live-browser absolute 4 MB threshold still fails on both the untouched production deployment and the Cycle 002 candidate by statistically equivalent amounts. Cycle 002 does not improve or worsen that pre-existing renderer/runtime slope.

## Input-only explicit-GC soak

A single `InputState` completed 260,000 rapid press/release/snapshot/consume cycles across fire, melee, grenade, and dash.

```text
cycles: 260000
heap samples: 4618544, 4618112, 4617896, 4617928, 4617272, 4620544
retained delta: 2000 bytes
retained range: 3272 bytes
pending actions: 0
```

Evidence:

```text
.tmp/hmh-aaa-cycle-002/input-buffer-soak.mjs
.tmp/hmh-aaa-cycle-002/input-buffer-soak.log
```

## Reboot combat explicit-GC soak

The reboot-specific combat soak passed:

- 60/30/20 FPS: identical tick, weapon, fire-event, and zero-dropped-time outcome
- fixed catch-up cap: four steps
- weapon, melee, grenade, combat, and replay hashes: stable
- active projectile/grenade pools: bounded
- explicit GC: active
- retained heap delta: `618,136` bytes

Evidence:

```text
.tmp/hmh-aaa-cycle-002/reboot-combat-soak.log
```

## Legacy harness incompatibility

`scripts/hmh-browser-soak.mjs --minutes=5` targets the legacy parent combat runtime and waits for `[data-stat="survived"]`. It timed out before measurement because that marker is not the reboot runtime’s durability surface. This failure is not presented as browser-soak evidence.

Evidence:

```text
.tmp/hmh-aaa-cycle-002/browser-soak.log
```

## Live browser A/B

A disposable Chrome harness used normal release rendering, explicit GC, the same `lit-commando` production hero, the same bridge world-tour location, the same 15-second stabilization, and the same 30-second measurement window. Fire and melee were held for 20 ms so both the old production input mapper and Cycle 002 mapper consumed equivalent actions.

| Build | Held actions | Retained delta | Errors |
| --- | ---: | ---: | ---: |
| Local Cycle 002 | 182 | 10,154,499 bytes | 0 |
| Untouched `https://lestersarcade.io` production | 182 | 10,196,991 bytes | 0 |

Cycle 002 retained `42,492` fewer bytes than production in the equivalent run. The absolute 4 MB experimental threshold fails for both builds and is therefore recorded as pre-existing debt, not hidden or waived as a new failure.

Evidence:

```text
.tmp/hmh-aaa-cycle-002/local-held-action-memory-control.log
.tmp/hmh-aaa-cycle-002/production-held-action-memory-control.log
.tmp/hmh-aaa-cycle-002/reboot-browser-soak.mjs
```

## Follow-up debt

A future bounded performance cycle should replace the legacy portal soak with a permanent reboot-native CDP harness and identify the shared production/local retained-memory slope. That work is outside Cycle 002’s four-entry input-buffer scope and must begin with its own RED/baseline evidence.

# HMH WO-101 — Hold-to-Aim Grenades

## Shipped behavior

- **Tap grenade / tap `F` or `G`**: quick throw at the minimum sensible range for the equipped grenade type.
- **Hold grenade / hold `F`, `G`, or right mouse**: enters aim mode with a landing reticle.
- **Release**: throws to the reticle using the same deterministic `planLevelOneGrenadeThrow` path as normal grenades.
- **Cancel**: drag upward into the marked `CANCEL` zone on touch, use a second-finger tap, or press `Escape` while aiming.
- Movement and auto-fire continue while aiming; no time slow is introduced.

## Type-specific preview tuning

| Type | Max range | Preview |
|---|---:|---|
| `satoshi-frag` | 7 tiles | lob ellipse + blast ring |
| `launcher-rig` | 11 tiles | flatter cyan line/ring style |
| `homing-cluster` | lock current largest nearby enemy pack | green pulsing cluster lock |
| `block-buster` | 6 tiles | heavier orange blast ring |

The pure module is `apps/portal/src/hmh-grenade-aim.mjs`. It owns charge curve, release classification, type preview metadata, cancel detection, and homing pack selection. Runtime rendering reuses the grenade reticle/telegraph language and passes the preview radius into the real throw planner so the preview does not lie.

## Known dependency

Hero throw aim-hold/release animation frames from WO-93/94 are not available yet. The input/reticle/throw state is wired now; animation tagging can bind to the same `combat.grenadeAim.active` state after the canon hero sheets land.

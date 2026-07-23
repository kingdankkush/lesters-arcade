# HMH Reboot Movement, Aim, and Touch Contract

## Scope

This phase adds deterministic locomotion, independent aiming, default autofire, manual aim/fire behavior, regular-enemy yielding, boss-contact escape rules, recoil/stun response, and browser touch controls. Pixi renders state but does not own gameplay decisions.

## Fixed-step movement

- `movement.mjs` is pure gameplay code and is called once per admitted 60 Hz simulation tick.
- Input movement is normalized, so diagonal travel cannot exceed cardinal travel.
- Target velocity uses short acceleration and deceleration constants instead of long momentum.
- Reversal uses the same bounded velocity approach and cannot preserve an unwanted drift tail.
- `speedMultiplier` is the deterministic extension point for terrain, upgrades, buffs, and debuffs.
- Movement, velocity, leg facing, and torso aim are separate fields.
- Leg and torso facing use stable eight-way quantization while authoritative aim remains continuous.
- Recoil is an explicit decaying velocity impulse. It never changes the base movement speed.
- Stun suppresses locomotion through explicit state; recovery returns through normal bounded acceleration.

## Aim and fire

- `aim.mjs` selects the nearest active, targetable, in-range, line-of-sight target.
- Equal-distance ties resolve by stable target ID.
- Default autofire remains active while a target is valid.
- Manual aim overrides direction without disabling the normal autofire cadence.
- Explicit fire input remains usable when autofire is disabled.
- Manual aim persists for a fixed tick count, never wall-clock milliseconds.
- Touch/controller correction uses bounded angle rotation and configurable magnetism.
- Pointer/mouse aim remains exact.
- The canonical input action record carries only an `aimAssist` eligibility boolean. Device names, source latency, and wall-clock timestamps remain metadata and cannot affect replay results.

## Enemy pressure

- Regular enemies receive deterministic yielding displacement when the player overlaps them.
- The player is not trapped by a rigid ring of regular enemies.
- Bosses remain blocking bodies.
- Inward velocity against a boss is removed while tangential movement is preserved.
- A deterministic tangent escape is supplied when a direct pin would otherwise leave no movement component.
- Full swept world collision and authored wall/ledge resolution remain the responsibility of the next collision phase.

## Touch boundary

- `TouchControlState` owns each pointer ID independently.
- Move stick, aim stick, fire, melee, grenade, Dash, and pause can coexist.
- Pointer up, pointer cancel, lost capture, blur, visibility loss, and teardown clear owned state.
- UI events prevent default behavior and stop propagation before reaching the gameplay canvas.
- Stick radius, dead zone, and sensitivity are configurable.
- Control positions use the shared responsive layout plus measured CSS safe-area insets.
- Resize and orientation changes relayout controls.
- Stick knobs mirror normalized authoritative touch vectors.

## Runtime integration

The fixed-step order in `main.mjs` is:

1. Snapshot previous actor state.
2. Resolve target and deterministic aim intent.
3. Apply edge-triggered recoil events.
4. Step player movement once.
5. Resolve enemy pressure once.
6. Copy authoritative motion into world spatial state.
7. Interpolate previous/current world state for rendering.
8. Update the render-time camera and Pixi display.

The `?debugGrid=1` development route exposes read-only actor, target, aim-source, and firing values through stage data attributes for automated browser evidence. It does not expose mutation, persistence, bridge, wallet, or settlement authority.

## Certification evidence

Focused unit coverage verifies:

- Cardinal/diagonal parity, acceleration, reversal, release, and terrain modifiers.
- Separate movement, velocity, leg, and torso directions.
- Recoil, stun, and recovery.
- Regular-enemy yielding and boss tangent escape.
- Stable target selection, manual hold, default autofire, explicit fire, and aim correction bounds.
- Multi-pointer ownership, cancellation, safe areas, relayout, and teardown.
- Existing simulation, world-space, input, shell, bridge, and build contracts.

Real Chrome smoke evidence verifies desktop movement, pointer aim with continuing autofire, target yielding, simultaneous mobile movement/aim/grenade input, sticky-input release, portal embedding, sandboxing, pause, and resume.

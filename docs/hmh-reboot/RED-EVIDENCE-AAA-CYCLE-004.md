# RED Evidence — HMH AAA Continuous Improvement Cycle 004

Date: 2026-07-25
Branch: `reboot/hmh-aaa-continuous`
Baseline: `b951d7bb`

Three parallel source audits (combat/physics/animation, enemy AI/boss,
progression/audio/VFX) produced ranked candidates with file:line evidence and
node repros. Every candidate below was reproduced before any fix was written.

---

## A. Boss encounter was unreachable and uncredited

### A1. First hit on the Liquidator threw and killed the frame loop

`main.mjs` read `damageEvent.amount`; `resolveCombatHits` emits
`damageApplied`. `applyLiquidatorDamage` validates with `finite(amount)`:

```text
r.damageEvents[0].amount            // undefined
applyLiquidatorDamage({ boss, amount: undefined, tick: 1 })
// TypeError: damage amount must be finite
```

Thrown from inside the Pixi ticker callback with no try/catch, so camera
follow, world render, and marker update never ran for that frame and the boss
could never lose health.

Same root cause: `if (damageEvent.amount <= 0) continue` was inert
(`undefined <= 0` is `false`), so shielded/zero-damage hits still produced
audio and impact VFX; and `if (state.dead)` never fired because combat target
clones expose `active`/`health`, never `dead`.

### A2. Boss defeat awarded no score, XP, or kill credit

The score loop resolved defeated actors only through `grayboxEnemies`, which
never contains the boss. The `enemy:defeated` event for the run's capstone kill
was silently dropped while the portal-facing `boss-defeated` bridge event still
fired — the two authorities disagreed.

### A3. Boss went permanently passive at full health

`LIQUIDATOR_ATTACK_PLAN` ends at elapsed tick 3,420 with no loop and no
HP-gated phases. Stepping 0 → 7,200 with no damage:

```text
last boss event at elapsed tick 3,465
events after 3,600: 0
health: 12,000 / 12,000   (phase stuck at total-liquidation)
```

Any player under ~3.34 damage/tick faced a motionless boss forever.
Related: `pending.resolveTick !== tick` used exact equality, so a single
skipped tick stranded a lit telegraph permanently.

### RED run

```text
✖ boss attack plan loops after the authored plan is exhausted instead of going passive
✖ pending boss attacks resolve even when their exact resolve tick was not stepped
✖ main wires combat damage and score events with fields that actually exist
ℹ tests 13  pass 10  fail 3
```

GREEN: `13/13`.

---

## B. Enemy AI pacing and fairness

### B1. Encounter director hard-deadlocked on a saturated ranged cap

`selectEncounterArchetype` is a pure function of `spawnOrdinal`, and the
ordinal only advanced on successful insertion. With the ranged cap saturated,
the same capped role was re-picked every tick forever — blocking melee spawns
too:

```text
100 consecutive ticks -> reasons { 'ranged-cap': 100 }, inserted 0, ordinal frozen at 2
```

After the fix: `{ 'ranged-cap': 1, ... }`, ordinal advances, melee spawns resume.

### B2. Simultaneous melee tells stacked unavoidable damage

Nothing staggered tell starts, so every in-range melee token holder resolved on
the same tick. Three rushers equidistant from the player → 3 hits, 36 damage in
a single tick against a 100 HP player. In the `elite` band (5 melee tokens),
five whale-enforcers at 20 damage each is a 100-damage one-frame kill.

### B3. Recovering enemies held tokens away from ready attackers

`allocateAttackTokens` ranked a `recovery` enemy identically to a `ready` one;
being closer, it won the only token and did nothing with it for its whole
recovery window (54 ticks for whale-enforcers — nearly a second of dead air).

### B4. The enemy `attack` visual state was unreachable

`resolveEnemyRuntimeVisualState` returns `'attack'` only for
`attackPhase === 'attack'`, but the phase machine went
`ready → tell → recovery → ready`. No code ever assigned `'attack'`, so the
strike frame rendered as `idle` and the arm-swing art branches never executed.

### RED run

```text
✖ a saturated ranged cap advances the spawn ordinal instead of deadlocking every spawn
✖ a resolved attack passes through a visible strike phase before recovery
✖ simultaneous melee attackers are staggered so one tick cannot stack their damage
✖ enemies in recovery do not hold attack tokens away from ready attackers
ℹ tests 22  pass 18  fail 4
```

GREEN: `37/37` across director, combat, simulation, and archetype suites.

---

## C. Combat physics

### C1. Knockback resistance was inverted

`knockback * knockbackResistance` meant the most resistant bodies flew
farthest. Identical 10-unit hit:

```text
whale-enforcer (resistance 1.8, 260 HP) -> 18 px
forkrunner     (resistance 0.65, 58 HP) ->  6.5 px
```

The 260 HP bruiser was shoved 2.8× farther than the light flanker, directly
contradicting the authored archetype intent.

### C2. Player recoil/knockback was ~60× too weak to see

Decay ran at `maxSpeed / recoilDecayTime` = 2,000 px/s², consuming any impulse
below ~33 px/s within one tick. A 32-unit impulse produced **0.53 px** of
travel, making every weapon `recoil` value and all enemy knockback against the
player dead config.

After the proportional-decay fix, response is linear and settles exactly to
rest:

```text
impulse 22 -> 2.64 px   impulse 32 -> 3.84 px
impulse 64 -> 7.68 px   impulse 74 -> 8.88 px   (residual velocity 0.0000)
```

### C3. Shots from authored ledges could never connect

Projectiles held a constant `z = shooter.groundZ + 34` while enemy hurtboxes
are relative to the *target's* ground. Any elevation delta ≥ 28 units was a
total lockout, in both directions:

```text
player groundZ  0 -> hits 1
player groundZ 28 -> hits 0
player groundZ 48 -> hits 0   (mining-loader-deck)
player groundZ 64 -> hits 0   (ravine-overlook)
```

Melee failed identically, so authored high ground silently became
grenade-only.

### C4. Auto-aim and auto-fire ignored cover

`resolveAimIntent` accepts a `lineOfSight` predicate and `main` never supplied
one, while `aim.mjs` forces `fire: true` whenever any target is in range.
Enemies already run `traceHeightAwareLineOfSight` before they may fire, so the
cover rule was enforced in one direction only: the player would lock onto and
empty a clip into a wall while ignoring a visible enemy.

### C5. Separation resolved as a pop, not a push

Two overlapping whale-enforcers produced a single-tick delta of **23.45 units**
against an intended per-tick walk of 1.53 — ~15× the locomotion term whenever
bodies touched.

### RED run

```text
✖ knockback resistance reduces knockback instead of amplifying it
✖ recoil and knockback impulses produce readable displacement that scales with magnitude
✖ separation push is bounded so overlapping bodies slide apart instead of popping
✖ a shot fired from an authored ledge connects with a target on the ground below
✖ main spawns and advances projectiles at flight height over the ground beneath them
```

GREEN: all pass; projectile, aim, and elevation suites `39/39`.

Two of these RED runs also exposed defects in my own test geometry (a ledge
shot whose descent had not yet reached the hurtbox band at the target, and an
over-strict source assertion that would have banned the legitimately
shooter-relative muzzle-flash VFX). Both tests were corrected rather than the
product bent to fit them.

---

## D. Progression, audio, VFX telemetry, animation

### D1. Upgrade pool exhausted at level 18; every later level was dead XP

Six authored upgrades hold 17 total ranks. `recordRunDefeat` incremented
`pendingLevels` unconditionally to a cap of 1000, while `resolveChoices`
returned `[]` past the ceiling. Verified (seed 7, threatCost 3, greedy picks):

```text
after 420 kills: level 24, pendingLevels 6, pendingChoices 0, all six upgrades maxed
```

The cockpit renders `${pendingLevels} pending`, so the phantom queue was
user-visible and permanent.

### D2. Rejected audio playback leaked voices permanently

`cleanup()` only released voices on `ended` or explicit steal. A rejected
`play()` promise fires neither. Every shipped sample is `.ogg`, which WebKit
cannot decode — so on Safari every voice leaked until the 16-slot pool filled
with priority-protected voices and weapon, melee, and hit audio went
**permanently silent** with no recovery short of pause/resume.

### D3. World particle telemetry reported fiction

`particleCount` hardcoded the desktop `10` per hazard while the render path
correctly honoured the profile (6 on mobile, **0** on reduced-motion). Any perf
gate or HUD reading `worldParticles` got a number up to infinitely wrong.

### D4. The hero `hurt` pose was 16 shipped atlas frames nothing could select

`productionAction` was only ever `'pistol-fire'` or `'aim'`. The `hurt` state —
2 frames × 8 directions, 9.5% of the shipped atlas — was reachable only from a
unit test. Separately, the dash branch skips `stepPlayerMovement`, so
`locomotion` and `legDirection` held stale pre-dash values and a sideways or
backward dash rendered idle legs facing the old direction for all 8 dash ticks.

### RED run

```text
✖ the pending level queue is always drainable — no level awards dead XP
✖ late-run mastery picks keep offering choices after the authored ranks are exhausted
✖ voices whose playback is rejected by the browser do not leak the voice pool
✖ stale voices are reaped so a never-ending sample cannot hold a slot forever
```

GREEN: progression `7/7`, audio `7/7`, atlas/world-art `11/11`.

---

## Full-suite result

```text
HMH_REBOOT_TEST_RETIREMENT_GATE PASS tests=1647 passed=1595 expected_failures=52
```

+20 tests over Cycle 003's 1,627, exact legacy failure multiset preserved,
zero unexpected results.

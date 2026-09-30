# HMH cover and traversal rules — `cover-v1` / `traversal-v1`

Branch `claude/200-cover` on the 2.0 integration commit `a9c93bc81`. Owner
contract: handoff `docs/handoffs/lesters-arcade-2.0-visual-overhaul-handoff-20260929.md`
§2.4b (cover) and §2.2 / §2.4c (climb and drop ledges).

This lane ships the **pure rule set and its tests only**. `main.mjs` is being
refactored by another lane, so nothing here is wired into the tick yet; §3 is
the exact integration plan for whoever owns that wiring. Until it lands, no
Ranked run summary, verifier verdict, collision result or replay changes.

## 1. What shipped

| File | Purpose |
|---|---|
| `apps/hmh-reboot/src/cover-system.mjs` | Cover faces, enter/shuffle/peek/leave rules, damage multiplier, enemy signal, state hash |
| `apps/hmh-reboot/src/traversal-system.mjs` | Climb (mantle) and drop markers, land recovery, invulnerability windows, state hash |
| `apps/hmh-reboot/src/collision.mjs` | `createStaticBlocker` gains optional `coverKind: 'tall' \| 'short' \| 'none' \| null` (default `null`, validated) |
| `apps/hmh-reboot/src/dev/greybox-kit.mjs` | `cover-tall` / `cover-short` pieces declare `coverKind` on their blocker |
| `tests/hmh-reboot-cover-system.test.mjs` | 19 tests |
| `tests/hmh-reboot-traversal-system.test.mjs` | 10 tests |

Both modules are pure: no DOM, no Pixi, no `Math.random`, no `Date`, no
`performance.now` (the tests grep the source for all of them). Every rule
constant lives in a frozen object with a `rulesVersion` so a later run-summary
schema can pin it: `COVER_RULES_V1.rulesVersion === 'cover-v1'`,
`TRAVERSAL_RULES_V1.rulesVersion === 'traversal-v1'`.

### 1.1 Cover rules (`COVER_RULES_V1`)

| Rule | Value | Note |
|---|---|---|
| Cover faces | outward edges of any solid blocker with `combatCover: true` whose kind is tall or short | polygon: every edge; capsule: the two long sides at ±radius; circle: none (no straight face) |
| Kind | declared `coverKind`, else from height `maxZ − minZ` (infinite `minZ` counts as 0; infinite `maxZ` is tall) | ≥ 96 tall; 24–72 short; otherwise none |
| Minimum face length | 32 units | shorter edges are not indexed |
| Enter | hero edge within **24** units of a face, on its outward side, standing within 8 units of the blocker base, pushing within 60° of the face's inward direction for **6 consecutive ticks** | a dodge on any tick resets the count; a change of candidate face restarts at 1; nearest gap wins, exact tie → lexically first face id |
| Snap | `along = clamp(round(projection), ceil(r), length − ceil(r))`, position = `a + tangent·along + normal·(r + 1)` | integer `along`, integer standoff; the collision solver never depenetrates a hero in cover |
| Facing | tall: `normal` (back to the wall); short: `−normal` (toward the wall) | |
| Shuffle | tangent input ≥ 0.25 moves `along` by **2 units a tick** (120 u/s), clamped to the face | already at the clamp and still pushing → `leave-run` |
| Peek, tall | fire or `aimHeld` with the rest position within **40** units of a face end → lean: `along` becomes 0 or `length` (hero centre on the corner), `peekMode: 'lean-l' \| 'lean-r'` (screen-space side relative to facing) | further in: fire → `blind` (no position change); aim only → idle |
| Peek, short | fire or `aimHeld` → `pop`, no position change | |
| Release | `along` returns to the rest position, `peeking: false` | |
| Leave | pushing within 60° of `normal` for **4 consecutive ticks** → `leave-step`; dodge → `leave-roll` (immediate); past the end → `leave-run` | all three clear the state and return `position: null` so free movement resumes on the same tick |
| Damage | attack origin within 60° of the face's inward direction (from the hero) → **×0.4 tall, ×0.6 short**; from behind, from along the face, at zero range, or from a shooter whose `z ≥ face top` → ×1 | `applyCoverToDamage` rounds `damage × multiplier` with `Math.round` |
| Counters | `coverTicks` (every tick spent in cover, roll-out tick included), `enters` | for the run summary |

### 1.2 Traversal rules (`TRAVERSAL_RULES_V1`)

| Rule | Value |
|---|---|
| Marker | `{ id, kind: 'climb' \| 'drop', zone (rect), direction (unit), fromZ, toZ, travel, areaId }`, frozen and validated |
| Climb rise | 24–192 units; drop fall 24–480 units |
| Trigger | hero centre inside the zone, `groundZ` within 8 of `fromZ`, pushing within 60° of `direction`, for `triggerTicks` (1) |
| Mantle | **18 ticks**, movement locked, x/y interpolate linearly from the trigger point to `trigger + direction·travel` (default travel 48), `z` switches to `toZ` on the final tick; **melee-invulnerable, not projectile-invulnerable** |
| Drop | instant move to `trigger + direction·travel` (default 32) at `toZ`, then **6 ticks** land recovery, movement locked, no invulnerability |
| Elevation layer drops | `beginLandRecovery(state, { tick, position })` gives an authored `oneWayDrop` resolved by `resolveSweptTraversalPath` the same 6-tick recovery; no-op during a mantle or another landing |
| Overlapping markers | lexically first id |
| Counters | `mantles`, `drops`, `mantleTicks`, `landTicks` |

## 2. Module API

```js
import {
  COVER_RULES_V1, COVER_POSES, COVER_KINDS,
  coverFaceIndex, coverKindForBlocker,
  createCoverState, stepCover,
  coverDamageMultiplier, applyCoverToDamage,
  coverSignal, hashCoverState, canonicalCoverJson,
} from './cover-system.mjs';

const faces = coverFaceIndex(WORLD_BLOCKERS);          // frozen, sorted by id, cached per frozen array
const cover = createCoverState();
const result = stepCover(cover, {
  player: { x, y, groundZ, radius },                  // this tick's pre-movement hero
  input: { move, fire, aimHeld, dodge, reload, hit }, // all optional; dodge = a dash started this tick
  faces, tick,                                        // rules defaults to COVER_RULES_V1
});
// result (frozen): { inCover, position | null, movementLocked, pose, event, faceId, blockerId, kind, peeking, peekMode, facing }
coverDamageMultiplier(cover, { x, y, z? });           // 1 | 0.4 | 0.6
applyCoverToDamage(cover, origin, damage);            // rounded integer
coverSignal(cover, tick);                             // { playerInCover, kind, faceId, blockerId, normal, position, peeking, ticksInCover }
```

```js
import {
  TRAVERSAL_RULES_V1, TRAVERSAL_POSES, TRAVERSAL_KINDS,
  createTraversalMarker, traversalMarkerFromGreybox,
  createTraversalState, stepTraversal, beginLandRecovery,
  traversalInvulnerability, hashTraversalState, canonicalTraversalJson,
} from './traversal-system.mjs';

const markers = pieces.filter(isMarker).map((piece) => traversalMarkerFromGreybox(piece, { direction, fromZ, toZ, travel }));
const traversal = createTraversalState();
const step = stepTraversal(traversal, { player: { x, y, groundZ, radius }, input: { move }, markers, tick });
// step (frozen): { phase: 'free'|'mantling'|'landing', position {x,y,z} | null, movementLocked, meleeInvulnerable, projectileInvulnerable, pose, event, markerId, kind, remainingTicks }
traversalInvulnerability(traversal);                  // { melee, projectile }
```

Events: cover `enter`, `leave-step`, `leave-run`, `leave-roll`; traversal
`mantle-start`, `mantle-complete`, `drop`, `land-start`, `land-complete`.
`event` is set only on the tick it happens.

## 3. Integration plan for `main.mjs` (the other lane)

Line anchors are against integration commit `a9c93bc81`; the refactor will move
them, the order is what matters.

### 3.1 Setup (session start, beside `dashState`)

1. `const COVER_FACES = coverFaceIndex(WORLD_BLOCKERS);` once per world load.
   `WORLD_BLOCKERS` is already a frozen array of `createStaticBlocker` results, so the index is cached.
2. `const TRAVERSAL_MARKERS = Object.freeze([...])` from the world's marker
   metadata (§5). Level One today has none; the ten-area world authors them.
3. `coverState = createCoverState(); traversalState = createTraversalState();`
   reset wherever `dashState` is reset (`beginRun`, restart).

### 3.2 Fixed step order

The current order is: dodge intent → `beginDash` → `stepDash` →
`resolveDashWorldStep` (dashing) or `stepPlayerMovement` → enemy pressure →
`resolveSweptCircleMotion` → `resolveSweptTraversalPath` → enemy population →
hazards → attacks → combat hits. Insert as follows.

| Step | Where | What |
|---|---|---|
| A | after `dodgePressed` / `resolveDodgeIntent` (~3776), before `beginDash` | `const dashStartedThisTick = Boolean(dashStart?.started)` is needed by cover; if the hero is in cover the dodge direction defaults to `coverState.facing` when the stick is neutral (roll out away from tall cover, over/away from short) — pass `lastMove: coverState.phase === 'cover' ? coverState.facing : lastMoveDirection` |
| B | immediately after `stepDash` (~3791), before the `dashFrame.active` branch | `const traversalStep = stepTraversal(traversalState, { player: { x: motion.x, y: motion.y, groundZ: actor.groundZ, radius: playerBody.radius }, input: { move: tickInput.move }, markers: TRAVERSAL_MARKERS, tick })`. Markers are only consulted while `traversalState.phase === 'free'`; while mantling or landing the step just advances. |
| C | right after B | `const coverStep = traversalStep.movementLocked ? null : stepCover(coverState, { player: {...same}, input: { move: tickInput.move, fire: aimIntent.fire, aimHeld: <deliberate aim, see below>, dodge: dashStartedThisTick, reload: weaponLoadout.reloading, hit: playerWasHitLastTick }, faces: COVER_FACES, tick })`. A mantle or landing never runs cover; a dash started this tick rolls the hero out before the dash moves it. |
| D | the movement branch (~3845–3925) | If `traversalStep.movementLocked`: skip `stepPlayerMovement`, enemy pressure, the collision sweep and the traversal sweep; set `motion.x/y = traversalStep.position.x/y`, `motion.vx = motion.vy = 0`, `motion.recoilVx = motion.recoilVy = 0`, `lastGround = queryGround(motion.x, motion.y)` **only on `mantle-complete` / `land-complete`** (mid-mantle the hero is off the walkable grid and the ground query must not be trusted). Else if `coverStep.inCover`: skip `stepPlayerMovement` and both sweeps, set `motion.x/y = coverStep.position`, zero velocities, keep `lastGround`; still run `resolveEnemyPressure` with `velocity: {0,0}` so bosses cannot overlap the hero (a boss overlap delta larger than the standoff should force `leave-step` on the next tick — open question 5). Else: unchanged path. |
| E | after the traversal sweep, where `lastTraversal.dropped` plays `land` (~3928) | replace the one-off audio/visual with `beginLandRecovery(traversalState, { tick, position: { x: motion.x, y: motion.y, z: lastGround.groundZ } })` so authored ledge drops get the same 6-tick recovery; keep the audio and the `landing` visual event. |
| F | `actor.locomotion` assignment (~3953) | `actor.locomotion = dashFrame.active ? 'dash' : traversalStep.phase !== 'free' ? traversalStep.phase : coverState.phase === 'cover' ? 'cover' : motion.locomotion`. Presentation only. |
| G | `playerInvulnerable` (~4199) | unchanged for projectiles and hazards. Melee: pass `invulnerable: playerInvulnerable \|\| traversalInvulnerability(traversalState).melee` to `resolveEnemyAttackAgainstPlayer` for `melee-circle` / `shove-lane` geometry only; `lane` and `area-circle` (ranged and blasts) keep the projectile rule. |
| H | enemy population (~4129) | add `coverSignal: coverSignal(coverState, tick)` to the `stepEnemyPopulation` options and thread it into `planEnemyIntent` as `playerInCover`. This slice only exposes the signal; flank / grenade / rush behaviours are a later AI slice and must not change intent yet (keep the field unread until then so replays of `a9c93bc81` still verify). |
| I | enemy attack resolution (~4903) | after `resolved.hit`, `damage: applyCoverToDamage(coverState, { x: event.origin.x, y: event.origin.y, z: event.origin.groundZ ?? actor.groundZ }, resolved.damage)`. Enemy projectiles already stop on `combatCover` geometry through `resolveProjectilePath` (`coverHit`), so the multiplier only applies to what still reaches the hero: melee reach through a short wall, blast splash and lanes that clear the cover height. |
| J | authoritative hit intents (~5014) | player-targeted hits from boss attacks and grenade splash go through the same `applyCoverToDamage` with the hit's `point` as origin, **before** `heroModifiers.incomingDamageMultiplier` so the order is cover → hero perk → armor, matching the enemy path. |
| K | HUD / presentation | read `coverState.pose`, `coverState.peekMode`, `coverState.facing`, `traversalState.pose` on the render side (§4). Never read positions back from the render. |

`aimHeld`: `stepPlayerMovement` is fed `aim.active: true` every tick, so the
persistent aim direction cannot mean "peek". Pass a deliberate aim: right stick
past its dead zone on gamepad, right mouse held on desktop, the fire button on
touch (touch has no separate aim, so touch peeks only while firing, matching
"no extra button" in the owner contract).

### 3.3 Ordering guarantees

- Cover and traversal both read the **pre-movement** hero position and this
  tick's input, so a replay reproduces them from the input stream alone.
- Neither module reads the collision solver; the snap position keeps a
  one-unit integer standoff so the solver's depenetration pass leaves it
  untouched. If the refactor ever runs the sweep on a cover tick anyway, the
  result is the same position.
- `stepCover` is skipped while a mantle or landing runs; `stepTraversal` is
  never skipped. A dash started on a cover tick rolls out first, then moves.
- Same-seed determinism: both modules hash to identical values across two
  runs of a 400-tick / 200-tick scripted input (tested), and a single changed
  input tick diverges only from that tick onward.

## 4. Presentation: pose → clip

The pose is a simulation string chosen once per tick; presentation blends
clips from it and never writes back. Tall and short share pose names; the
rig picks the tall or short clip from `coverState.kind`.

| `coverState.pose` | Tall clip | Short clip | Notes |
|---|---|---|---|
| `cover-enter` | enter cover (back to wall) | enter (slide or duck) | one tick; the clip plays out over the following idle ticks (`event === 'enter'`) |
| `cover-idle-l` / `cover-idle-r` | idle facing left / right | crouch idle | the side is the end the hero would peek from, screen-space relative to `facing` |
| `cover-shuffle` | shuffle along cover | crouch shuffle | direction = sign of the tangent input; 2 units a tick |
| `cover-peek-fire` | peek and fire at the edge (`peekMode` `lean-l` / `lean-r`) | pop up and fire over (`peekMode` `pop`) | with `aimHeld` and no fire, hold the pre-fire frame |
| `cover-blind-fire` | blind fire | blind fire over | tall mid-face only (`peekMode` `blind`); short never blind-fires because the pop covers every position |
| `cover-reload` | reload in cover | reload crouched | `input.reload` |
| `cover-hit` | hit in cover | hit crouched | `input.hit` (the previous tick's player damage event); overrides every other in-cover pose for that tick |
| `cover-leave-step` | step out | back off | one tick, `event === 'leave-step'` |
| `cover-leave-run` | run out | vault forward | one tick, `event === 'leave-run'`; the short vault is presentation only, the hero runs past the end |
| `cover-leave-roll` | roll out | roll out | one tick, `event === 'leave-roll'`; the dash clip follows |
| `none` | — | — | free movement; `actor.locomotion` drives idle / walk / run / dash |

| `traversalState.pose` | Clip | Notes |
|---|---|---|
| `mantle` | grab, climb, mantle (18 ticks) | `remainingTicks` counts 17 → 0; the hero's rendered z may ease from `from.z` to `to.z` over the clip while the simulation z switches on the last tick |
| `drop` | hop down (short) / tall drop with a roll | one tick, `event === 'drop'`; pick by `to.z − from.z` (≤ 64 short, else tall) |
| `land` | land (small / big) | 6 ticks (`landTicks`), pick small/big by the same height |

The "cover-slide celebration" moment (handoff §2.4f) triggers on a multi-kill
while `coverState.phase === 'cover'`; it is presentation and reads the pose.

## 5. Greybox kit metadata the world authors must supply

`createGreyboxPiece` already accepts these kinds; the cover kinds now stamp
`coverKind` on the blocker. The traversal fields are **not** on the kit yet:
until the kit carries them, a world module builds markers with
`traversalMarkerFromGreybox(piece, extras)`.

| Kit kind | Field | Required | Meaning |
|---|---|---|---|
| `cover-tall` | `height` | yes, 96–192 | blocker top; `coverKind: 'tall'` is set for you |
| `cover-short` | `height` | yes, 24–72 | blocker top; `coverKind: 'short'` is set for you |
| `cover-*` | `bounds` | yes | the face is each outward edge; edges under 32 units are ignored |
| `mass` / `cliff` with `combatCover` | `coverKind` | optional | pass `'none'` to keep a solid mass out of the face index (ruins, dense trees) even though projectiles still stop on it |
| any cover blocker | `minZ` | default 0 | the base the hero must stand within 8 units of; raise it for cover on a deck |
| `climb-marker` | `bounds` | yes | trigger zone on the **low** side, at least 24 deep along `direction` |
| `climb-marker` | `direction` | yes | unit vector across the edge, low → high |
| `climb-marker` | `fromZ`, `toZ` | yes | rise 24–192 |
| `climb-marker` | `travel` | default 48 | horizontal distance the mantle covers; the landing point must be walkable at `toZ` |
| `drop-marker` | `bounds` | yes | trigger zone on the **high** side |
| `drop-marker` | `direction` | yes | high → low |
| `drop-marker` | `fromZ`, `toZ` | yes | fall 24–480 |
| `drop-marker` | `travel` | default 32 | landing offset; must be walkable at `toZ` |
| both markers | `areaId` | optional | streaming / analytics only |
| both markers | `id` | yes | lexical order breaks overlapping-zone ties, so keep ids unique per area |

Layout checker additions (W1 `hmh-greybox-layout-check`): every marker zone
lies on ground at `fromZ`, its landing point lies on ground at `toZ`, no two
markers of the same kind overlap, and every ledge with a `oneWayDrop` has a
matching drop marker or is documented as elevation-only.

## 6. Run summary (schema 8 proposal) and verifier review

Nothing in schema 7 changes. When the tick wiring lands, the next schema adds
these under a new `movement` row, dense in this order:

| Field | Source | Verifier check |
|---|---|---|
| `rulesVersion` | `\`${COVER_RULES_V1.rulesVersion}+${TRAVERSAL_RULES_V1.rulesVersion}\`` (`cover-v1+traversal-v1`) | must equal the build's pinned string; a later rule change bumps the version and old runs verify against their own |
| `coverTicks` | `coverState.coverTicks` | `≤ survivalTicks` |
| `coverEnters` | `coverState.enters` | `≤ floor(survivalTicks / 6)` (one enter needs six ticks) |
| `coverLeaves` | count of leave events | `≤ coverEnters` and `≥ coverEnters − 1` |
| `coverKills` | kills whose hit intent was created while `coverState.phase === 'cover'` | `≤ kills.total`; `coverKills > 0` requires `coverTicks > 0` |
| `coverDamageReduced` | Σ (pre-cover damage − applied) over player hits | `0` when `coverTicks === 0`; `≤ Σ` enemy attack damage catalogue × hits (existing per-role damage tables) |
| `mantles`, `drops` | traversal counters | `mantles × 18 + drops × 6 ≤ survivalTicks`; both `0` on a build whose world has no markers (`build-has-no-markers` reject otherwise) |
| `mantleTicks`, `landTicks` | traversal counters | `mantleTicks === mantles × 18`; `landTicks ≤ drops × 6 + ledgeDrops × 6` |

`server/verify/hmh-plausibility.mjs` gets a `checkV8Movement` beside
`checkV7Consistency` with those rejects, plus an `HMH_V8_MOVEMENT_RULES`
frozen copy of the two constants objects so the verifier never imports the
child. The existing `damage-dealt-mismatch` stays as is: cover reduces damage
taken, never dealt.

Replays: `coverState` and `traversalState` are part of the child's replay
hash input (the same place `dashState` is folded in). No new inputs are
introduced; `aimHeld` is derived from the existing aim / fire stream.

## 7. Test evidence

```
node --test tests/hmh-reboot-cover-system.test.mjs tests/hmh-reboot-traversal-system.test.mjs
  tests 29  pass 29  fail 0
node --test  (movement, turn-assist, collision, broadphase, elevation, grenades ×3, dash,
              manual-dodge, dodge-determinism, greybox-world, greybox-kit-polygon-contract,
              projectile-physics, enemy-combat, level-one-traversal, level-one-world)
  tests 158  pass 158  fail 0
node scripts/syntax-check.mjs
  Syntax check passed: 1342 JS modules + 151 Python scripts.
```

Covered edge cases: two faces in range (nearest, exact tie), corner entry
clamp, running past a face end, dash out, front / back / side / above-the-top
damage, projectile blocked by tall and short geometry, an elevated shot
passing over short cover but not tall, ground-level mismatch, interrupted
enter and leave counts, marker rise / fall bounds, overlapping markers, and
elevation-layer drops feeding land recovery.

## 8. Open questions for the integration owner

1. **Peek exposure.** The multiplier applies whenever the hero is in cover,
   peeking included. If a leaning or popped hero should forfeit part of the
   reduction, add `peekDamageMultiplier` to the rules (a `cover-v2`).
2. **Lean distance.** A tall lean moves the simulated centre onto the corner
   (up to 40 units in one tick). If that reads as a teleport under the 3D rig,
   lower `peekReach` or interpolate the lean over 3 ticks; both are rule
   changes and need a version bump.
3. **Capsule cover on Level One.** The current capsule blockers (containers,
   wreck rows, machinery) get two flat faces at ±radius; the rounded ends are
   not faces. Fine for the ten-area kit (rectangles); confirm for the legacy
   world or set `coverKind: 'none'` on them.
4. **Circles.** Circular blockers never index a face. If the tank / silo props
   should be cover, model them as octagons in the kit.
5. **Boss overlap in cover.** A boss pushing into a covered hero is not
   handled by this slice. Proposed rule: a pressure delta beyond the one-unit
   standoff forces `leave-step` next tick.
6. **Touch aim.** With no aim button on touch, peeking is fire-only. Confirm
   with the mobile controls owner.
7. **Enemy AI.** `playerInCover` is exposed; flank / grenade / rush is a later
   slice. Reading it before then would change intents and therefore replays.
8. **Schema 8 timing.** The `movement` row above is a proposal; the schema
   owner decides whether it rides the next schema bump or waits for the AI
   slice so one bump covers both.

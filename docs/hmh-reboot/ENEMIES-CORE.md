# Phase 14: Six Enemy Roles and Deterministic AI Foundation

Status: candidate implemented on `reboot/hmh-topdown-2_5d`. Final production art remains gated for later art phases.

## Approved roster

All six enemies are people or undead people. None is represented by an animal, vehicle, robot, or mech proxy.

| ID | Display name | Form / faction | Role | Token | Prototype silhouette | Counterplay |
|---|---|---|---|---|---|---|
| `bagholder-rusher` | Bagholder Rusher | zombie / Bad Debt Undead | direct rusher | melee | red wedge | Sidestep the locked lunge or punish recovery. |
| `forkrunner` | Forkrunner | human / Forked Frontier Raiders | flank pressure | melee | cyan diamond | Cut across the curved entry or break its route with cover. |
| `liquidator-agent` | Liquidator Agent | human / Liquidation Authority | ranged suppressor | ranged | magenta square | Leave the locked burst lane or use authored cover. |
| `whale-enforcer` | Whale Enforcer | human / Liquidation Authority | heavy bruiser | melee | gold hexagon | Rotate around the shoulder tell or lead the shove into cover. |
| `gas-bomber` | Gas Bomber | human / Liquidation Authority | delayed area denial | area | orange orb | Leave the locked landing circle or interrupt the raised charge. |
| `validator-cultist` | Validator Cultist | zombie / Bad Debt Undead | support pressure | support | violet star | Break line of sight or eliminate the marked support. |

The names and faction split above are the approved Phase 14 source of truth. `enemy-archetypes.mjs` owns gameplay values, costs, tell/recovery timing, movement limits, visual identity, and counterplay text.

## Visual and elite gate

Each archetype declares all six prototype states:

- idle
- run
- tell
- attack
- hit
- death

The current Pixi vector silhouettes are explicit prototype coverage used to test combat readability before final sprite production. `productionComplete` is `false` for every role, so `visualMode: "normal"` fails closed. Prototype insertion must explicitly use `visualMode: "prototype"`.

Elite spawning remains disabled for every role. Elite variants cannot be enabled until the base production silhouettes and animation matrices pass their later art review.

## Deterministic simulation

`enemy-simulation.mjs` owns the pure enemy population boundary.

- Fixed body cap: 192.
- AI LOD: near decisions every tick through 640 world units, mid every 3 ticks through 1,400 units, far every 12 ticks beyond 1,400 units.
- Collision and elevation traversal still execute every fixed tick at every LOD. Decision cadence never strides movement or safety checks.
- Stable ordering uses enemy IDs for decisions, insertion, token allocation, separation, and emitted events.
- Separation examines no more than eight neighbors per enemy.
- Deep water, invisible cliffs, authored blockers, one-way drops, ramps, curbs, and world boundaries use the same canonical collision/elevation contracts as the player.
- Runtime preserves tick-start enemy transforms through pressure plus AI movement so projectile hurtbox sweeps remain truthful.

## Role pressure

- Bagholder Rusher: direct pursuit.
- Forkrunner: deterministic stable-side flank.
- Liquidator Agent: approaches from long range, holds a suppression band, retreats when crowded.
- Whale Enforcer: slower direct pressure with a larger body and stronger knockback resistance.
- Gas Bomber: maintains area-denial distance and retreats when crowded.
- Validator Cultist: maintains support distance and deals no direct player damage.

The player-pressure system still allows regular enemies to yield. Boss contact behavior remains separate and is not introduced by this phase.

## Attack readability and budgets

Independent default token caps are:

- melee: 3
- ranged: 2
- area: 1
- support: 1

Existing tells reserve their family token before new attackers. Distant melee enemies cannot reserve a token. A tell locks its target position at start, stops AI and separation movement while still running collision/traversal safety, remains dodgeable, resolves exactly once, and enters explicit recovery. Ranged lanes consult height-aware authored line of sight before damage. Dash invulnerability suppresses eligible player hits at the combat-authority boundary.

Enemy attack events are capped at 64 per tick. Overflow is counted instead of growing storage. Support-ring events have zero player damage.

## Honest insertion accounting

`attemptScheduledEnemyInsertion` validates the exact selected candidate before changing schedule state.

A failed placement, duplicate ID, incomplete visual mode, exhausted body cap, exhausted threat cap, not-due timer, or completed burst does not advance the next-spawn tick or consume a burst slot. Only successful insertion advances both counters.

Canonical retirement removes the active body, subtracts its exact archetype threat cost, advances a monotonic retirement count, and retains the stable ID in the run-scoped `seenIds` set. Retired IDs cannot be inserted again.

The Phase 15 encounter director must consume this API rather than pre-incrementing abstract spawn timers.

## Runtime integration

The current debug arena creates one explicit prototype instance of each archetype. Every fixed tick runs:

1. tick-start transform snapshot;
2. player movement and pressure;
3. enemy LOD decision plus every-tick collision/elevation movement;
4. moving hurtbox construction;
5. player weapon, melee, and grenade intent collection;
6. enemy tell/attack state resolution;
7. Dash invulnerability filtering;
8. canonical combat resolution;
9. child-to-parent defeat evidence only.

The child still has no wallet, contract, settlement, persistence, achievement, score, analytics, or economy authority. Enemy defeat remains a `game:run-event`; parent code remains responsible for ranked score.

## Current evidence

- Phase 14 core tests: 23/23 passing.
- Shell/cache tests: 26/26 passing.
- Reboot-focused suite: 193/193 passing.
- Full repository suite: 1,445 passing plus exactly 53 ledgered retired-art failures, with zero unexpected, missing, cancelled, skipped, or todo outcomes.
- Syntax gate: 319 JavaScript modules and 40 Python scripts passing.
- Security audit: PASS, 507 files scanned, 5/5 hardening checks, zero findings.
- Load-speed audit: PASS, 1.19 MB main entry, zero production source maps.
- Strict repository-health gate: PASS.
- Pixi build: passing; child bundle 850.5 KB.
- Desktop browser: six archetypes present, one active tell sampled, six safety steps sampled, zero attack drops, zero console/page errors.
- Mobile browser: six archetypes present, two active tells sampled, six safety steps sampled, zero attack drops, zero console/page errors.
- Desktop and mobile visual review: passing after moving the combat label from the player to a fixed safe HUD strip.
- 128-body soak: 3,600 fixed ticks at 60/30/20 FPS partitions, equal hash `ed43da9dd1b81626f923b720d265e0fc8c54035bcc7c501144f633557d5ea1fc`.
- Soak safety: 460,800 canonical safety steps per partition, max eight neighbors, max three observed catch-up steps, 747 attack events, zero dropped attack events.
- Soak speed: 1.023677 / 0.975504 / 0.987452 ms average per fixed tick at 60/30/20 partitions.
- Soak heap delta after exposed GC: +555,624 bytes.

Temporary evidence artifacts:

- `.tmp/hmh-reboot-phase14-browser.json`
- `.tmp/hmh-reboot-phase14-enemy-soak.json`
- `.hermes/evidence/hmh-reboot-phase8-combat/desktop-combat.png`
- `.hermes/evidence/hmh-reboot-phase8-combat/mobile-combat.png`

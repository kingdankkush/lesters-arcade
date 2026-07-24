# Run progression, cockpit, and adapters

`reboot-16` adds a deterministic run progression layer and a responsive liquid-glass cockpit to the top-down reboot. It does not move profile, wallet, ranked eligibility, or settlement authority into the child game.

## Run state

`apps/hmh-reboot/src/run-progression.mjs` owns only current-run state:

- score;
- XP and level;
- unique authoritative enemy retirement IDs;
- pending level-up choices;
- selected skill ranks;
- bounded run effects.

A retirement awards:

```text
base score = 100 + threat cost × 25
base XP    = 80 + threat cost × 20
```

Future score and XP gains apply the current authored multipliers. Level thresholds are deterministic cumulative values:

```text
next threshold = 150 × level × (level + 1)
```

Enemy IDs are accepted once. Duplicate IDs, impossible threat costs, invalid ticks, unoffered upgrades, and over-cap choices fail closed.

## Skill tree

The six authored upgrades are:

| Upgrade | Branch | Max rank | Current-run effect |
|---|---:|---:|---|
| Proof of Work | power | 3 | +8% outgoing player damage per rank |
| Diamond Hands | survival | 3 | +20 maximum health per rank |
| Gas Optimization | mobility | 2 | advances the authored Dash cooldown tier |
| Cold Storage | utility | 3 | +1 Crypto Bomb per rank |
| Block Reward | power | 3 | +25% future score gain per rank |
| Validator Training | utility | 3 | +25% future XP gain per rank |

Exactly three eligible choices are derived from the session seed, level, pending queue, and selection sequence. Selection never consumes the simulation encounter or drop RNG streams.

The simulation enters its explicit `upgrade` state only after the current fixed-step batch finishes. Fixed steps and run time stop; Pixi rendering continues so the modal cannot interrupt renderer initialization. Combat audio pauses until the queue is resolved.

## Cockpit

The child page exposes:

- live score, level, XP, and Dash status;
- compact desktop/mobile combat readouts;
- music toggle backed by the existing local retained-sample audio system;
- pause/resume/restart and portal exit controls;
- active profile, hero, mode, and season;
- a three-choice responsive upgrade dialog;
- explicit standalone or portal adapter status.

Controls are native buttons with focus styles, pressed/expanded states, dialog labels, and live status output. The full-screen modal uses a solid translucent scrim instead of a viewport-sized `backdrop-filter`; this avoids Chromium compositor/WebGL instability while the inner liquid-glass panels retain blur and saturation.

## Audio

`combat-audio.mjs` remains the audio authority for the child runtime:

- retained local HMH samples only;
- fixed voice pool and priority stealing;
- cue cooldowns;
- pause suppression;
- user-gesture gating;
- looped standalone music;
- portal/standalone settings synchronization.

The cockpit toggle updates local music immediately and emits the existing exact-schema `game:settings` message when embedded.

## Profile and Web3 boundary

`apps/hmh-reboot/src/run-adapters.mjs` creates deterministic score-result and game-over payloads. Checksums use a stable 64-bit FNV-1a projection with the `hmh-score:` prefix. The adapter contains no wallet provider, transaction, signing, chain, contract, storage, or analytics access.

- Standalone: `Offline run · no wallet requested`; exit is visibly unavailable.
- Embedded free run: `Portal run tracking · wallet remains parent-owned`.
- Embedded ranked-eligible run: `Portal ranked settlement · wallet remains parent-owned`.

The child sends only protocol-valid `game:state`, `game:run-event`, `game:score-result`, `game:game-over`, `game:pause`, `game:settings`, and `game:exit` messages. The portal remains authoritative for profile identity, wallet access, ranked eligibility, settlement, and persistence.

## Browser evidence

`npm run smoke:hmh:cockpit` verifies desktop `1440×900` and mobile `390×844`:

- deterministic three-choice level-up;
- score `600`, level `2`, and `180 / 600 XP` after the evidence-safe retirement;
- upgrade selection and return to active simulation;
- profile disclosure;
- music on/off state;
- pause/resume;
- standalone exit clarity;
- zero browser errors.

`hmh-reboot-embedded-browser-smoke.mjs` also verifies the portal profile, parent-owned wallet label, enabled portal exit, music setting, and synchronized parent pause/resume lifecycle inside the sandboxed iframe.

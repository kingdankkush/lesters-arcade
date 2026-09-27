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

The catalogue has grown since: the repeatable mastery cards, crits, speed, the special weapons' branches and capstones, and (progression release, design package 8.2) twelve gun-branch cards for the Shotgun (`scatter-*`), the Machine Gun (`miner-*`), the Railgun (`rail-*`) and the Grenade Launcher (`launcher-*`): rate of fire, damage and Magazine & Salvage, rank 3 each, gated on the gun and mapped by `progressionByWeapon`. The catalogue is the v7 run-summary upgrades catalogue, in its order.

Each pending level is its own offer of two cards (design package 8.3), opened once by `openRunUpgradeOffer`:

- **Card 1** is a general draw over every eligible card.
- **Card 2** is "your gun": a card of the first candidate gun, where the candidates are the focus gun, then the weapon order, limited to owned non-Pistol guns that have ammo (the runtime passes `weaponIdsWithAmmo`; the War Fork always counts) and still have a card left. With no candidate it is a second general draw. It never focuses the Pistol. The focus gun is the last non-Pistol gun the player selected by hand or newly picked up; the automatic Pistol fallback never moves it. `HMH_CARD_TWO_INTERVAL` is the agreed fallback switch (2 draws card 2 from the focus gun on every second offer only); it is 1.
- **One re-roll per card** (`rerollRunUpgradeSlot`). A card shown in an offer never comes back in it; card 2 re-rolls through its gun's other cards, then the next candidate gun, then the general pool; with nothing left the strip reads "No other upgrades". A re-roll never selects, closes the panel or advances a tick, and it is silent.
- Every draw is the pure FNV `hashChoice` over `offer:<kind>:<level>:<pendingLevels>:<selectionSequence>:s<slot>:d<draw>:<upgradeId>`. Opening, re-rolling and picking never touch the simulation RNG, so menu use cannot move a drop or a spawn.
- Run progression counts what the v7 run summary needs: `offersOpened`, `rerolls`, and each card's offered (re-rolls included) and selected counts (`runUpgradeRows`, `runProgressionRow`). The v6 summary records the 24 v6 cards only; schema 7 carries all 36.

Without an open offer, `pendingChoices` is a pure preview of the offer the runtime would open with every owned gun armed; `selectRunUpgrade` opens it implicitly for callers that never opened one.

The simulation enters its explicit `upgrade` state at the end of the tick whose XP produced the level (design package 8.3 timing fix, S0.2), unless the run ended on that tick. Entering it stops the catch-up batch, so the offer tick does not depend on the frame partition. The frame loop only paints the panel. Fixed steps and run time stop; Pixi rendering continues so the modal cannot interrupt renderer initialization. Combat audio pauses until the queue is resolved. The panel is the lazy `upgrade-panel.mjs` chunk and its card text is `progression-content.mjs`.

## Cockpit

The child page exposes:

- live score, level, XP, and Dash status;
- compact desktop/mobile combat readouts;
- music toggle backed by the existing local retained-sample audio system;
- pause/resume/restart and portal exit controls;
- active profile, hero, mode, and season;
- a two-card responsive upgrade dialog with a re-roll strip under each card (keyboard R and gamepad X re-roll the armed card) and card 2's gun chip (for example SHOTGUN 4/9);
- explicit standalone or portal adapter status.

Controls are native buttons with focus styles, pressed/expanded states, dialog labels, and live status output. The full-screen modal uses a solid translucent scrim instead of a viewport-sized `backdrop-filter`; this avoids Chromium compositor/WebGL instability while the inner liquid-glass panels retain blur and saturation.

## Audio

`combat-audio.mjs` remains the audio authority for the child runtime:

- retained local HMH samples only;
- in the game's audio mode, only the owner's list (2026-09-25): gunfire and the guns' own sounds, Litecoin/silver pickups, power-up and weapon pickups (health and ammo pickups count), grenades, enemy hits and enemy deaths (`HMH_GAMEPLAY_AUDIO_CUES`). No voices, footsteps, level-up, objective, tell, reload-complete, arena-change or restock cues;
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

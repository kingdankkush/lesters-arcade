# HMH reboot enemy and boss production art

## Runtime authority

`apps/hmh-reboot/src/enemy-production-art.mjs` is presentation-only. Every kit is classified `production-art` with `runtimeAuthority: projection-only`. Visual code reads combat state and may not change health, damage, collision, attack tokens, spawning, score, bridge events, persistence, wallet state, settlement, or Web3 behavior.

## Six families

| Actor ID | Readable identity cues |
|---|---|
| `bagholder-rusher` | Ragged magenta hoodie, pale undead face, red debt satchel |
| `forkrunner` | Split cyan runner jacket, forked twin blades, agile diamond silhouette |
| `liquidator-agent` | Magenta authority visor, black liquidation suit, suppression rifle |
| `whale-enforcer` | Gold whale shoulder plates, black heavy armor, broad charging gauntlets |
| `gas-bomber` | Orange blast hood, twin gas canisters, glowing thrown charge |
| `validator-cultist` | Violet validator hood, undead green face, ring-topped validation staff |

All six support deterministic `idle`, `run`, `tell`, `attack`, `hit`, and `death` poses.

## Elite treatment

Elite presentation is a stable FNV-derived classification of the immutable enemy ID. Roughly one in eight IDs receives an aura, crown, and outline. The classification has no gameplay effect and does not alter the entity or spawn schedule.

## Death and hit coverage

- Enemy hit flash: six simulation ticks.
- Enemy death projection: 30 simulation ticks, queued before immediate authoritative retirement.
- Liquidator hit flash: six simulation ticks.
- Liquidator death projection: 45 simulation ticks after authoritative defeat.

These timers exist only in the renderer.

## The Liquidator

The boss reads as an executive exosuit with a red liquidation tie, gold market crown, and margin-call shoulder cannons. Existing phase, attack, telegraph, safe-zone, damage, and run-event authority is unchanged.

## Browser evidence

The combat smoke certifies:

- `production-vector-enemies-v1` and `production-vector-liquidator-v1` telemetry.
- All six families present.
- Two deterministic elite projections in the authored preview population.
- A real death projection observed on mobile.
- Attack tells and boss tells present.
- Desktop/mobile controls, minimap, movement, combat, and world-tour behavior remain valid.
- No console errors, failed requests, or dropped authoritative events.

# HMH reboot production hero roster

## Authority boundary

All production hero atlases are presentation-only projections over the shared `human-medium-collision-v1` gameplay body. Actor art must not write collision, movement, damage, spawning, score, persistence, wallet, bridge, settlement, analytics, or Web3 state.

The canonical repository source is:

- `apps/hmh-reboot/assets/source/blender/hmh-production-heroes.blend`
- `apps/hmh-reboot/assets/source/blender/hmh-production-heroes.json`

Every actor is rendered from the same named 14-bone armature and `weapon_socket` across eight semantic directions and four independent layers. Generated output must pass two separate Blender 5.1.2 processes with zero changed visible pixels, zero maximum channel delta, and zero total channel delta.

## Approved roster

| Actor ID | Production variant | Unlock authority | Required visual identity |
| --- | --- | --- | --- |
| `lit-commando` | `reserve-vanguard` | Starter | Broad silver/Litecoin-blue commando, cyan visor |
| `lit-valkyrie` | `plasma-striker` | Starter | Agile teal/plasma commando, short teal hair, no glasses |
| `lester-original` | `blue-mask-original` | 10 settled Ranked matches, or one-time legacy `getaway-clear` Lester migration | Blue full-head mask, white vertical stripe, large eyes, blue scarf, black/tan cargo kit, bandolier |
| `lilly` | `gold-teal-veteran` | 20 settled Ranked matches | Long teal hair, round glasses, gold/teal/black veteran tactical kit |

Free runs never advance either Ranked-match gate. Lilly has no legacy migration path.

## Runtime selection

`apps/portal/src/hmh-character-config.mjs` remains the unlock and selected-character authority. The portal sends the exact approved actor ID through `portal:init.heroId`. The reboot runtime validates that ID against `PRODUCTION_HERO_ASSETS` and uses it only to select projection assets.

During art-pilot checkpoints, production rendering remains opt-in through `?productionPilot=1&productionHero=<actor-id>`. The default graybox path and mannequin pilot remain available for regression testing until the final replacement checkpoint.

Unknown actor IDs fail closed in the bridge/runtime path and fall back to the Reserve Vanguard only for an untrusted local query parameter before a production session exists.

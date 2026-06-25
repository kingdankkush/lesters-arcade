# Hard Money Heroes Pixel-Art Asset Inventory

Audit generated from local repo `C:/Users/just_/lesters-arcade` on 2026-06-24.

## Executive summary

- **Animated runtime roster:** 37 entries: hero 4, boss 3, enemy 26, miniboss 4
- **Playable runtime choices:** Lit Commando, Lit Valkyrie, Lester (Original). Max Mempool is parked/non-canon.
- **Enemy catalog:** 23 configured enemy archetypes; 23 have an explicit animated-roster mapping.
- **Boss catalog:** 10 design/campaign bosses, but only 3 animated boss roster entries currently exist in `hmh-animated-roster`.
- **Environment assets:** 148 Level 1 environment PNGs in the user-provided/runtime environment inventory, plus 179 PixelLab Wave 2 tile/prop images and 148 generated level-environment images.

## How to reference assets in hand-drawn level plans

- For the current environment inventory, reference the stable IDs like `env-034`, `env-096`, etc. The full source ID is `env-###-timestamp` in `docs/game-design/hard-money-heroes-environment-asset-inventory.json`.
- Existing visual contact sheets for the 148 Level 1 environment assets are in `docs/game-design/hmh-environment-contact-sheets/sheet-01.png` through `sheet-08.png`.
- Semantic names like `Tree 1`, `Building 6`, `Rock 4` do **not** exist yet as first-class aliases in the manifest. We should add a follow-up semantic alias table once you decide which assets you like. For now, use `env-###` plus a short note, e.g. `env-096 fallen tree/structure prop`, `env-059 ghost-town structure`, `env-034 desert structure`.
- For generated 64×64 tiles, use the PixelLab Wave 2 pack/slug and tile index, e.g. `urban-ground-road-kit #003`, `desert-sand-gravel-nature-kit #014`, `water-river-waterfall-kit #002`.

## Player / hero assets

### Current canonical playable roster

| Character | Runtime status | Canon role | Art direction | Design-required animations |
|---|---|---|---|---|
| `lit-commando` / Lit Commando | starter | main playable Hard Money Hero — tanky bruiser | high-detail 16-bit/Neo-Geo commando: silver + Litecoin-blue armor, glowing cyan visor helmet, readable muzzle flashes and blade arcs, 8-direction isometric. | idle, walk, run, fire-pistol, melee-knife, throw-axe, fire-shotgun, fire-machinegun, hurt, stun, pickup, levelup, death |
| `lit-valkyrie` / Lit Valkyrie | starter | playable Hard Money Hero — agile glass-cannon | teal/cyan plasma armor, short teal hair, agile silhouette, glowing energy trim, readable fire/crit VFX, 8-direction isometric. | idle, walk, run, fire-pistol, melee-knife, throw-axe, fire-shotgun, fire-machinegun, hurt, stun, pickup, levelup, death |
| `max-mempool` / Max Mempool | parked/non-canon | parked future character concept | chunky arcade bruiser placeholder only; do not produce final assets until approved. | idle, run, jump, double-jump, shoot, melee, grenade, hurt, victory |
| `lester-original` / Lester (Original) | unlockable | unlockable Hard Money Hero — the original arcade commando | classic 8-bit/Neo-Geo arcade commando: green bandana, leather jacket, readable muzzle flashes, 8-direction isometric. | idle, walk, run, shoot, melee, throw, hurt, death, victory |

### Runtime animated roster coverage

Core audit target for heroes: `idle`, `walk`, `run`, `shoot`, `melee`, `throw`, `hurt`, `death`, ideally all 8 isometric directions. `victory`, `jump`, `crouch`, etc. are useful extras.

| Roster key | Role | States present | Total frames | Full 8-dir core? | Missing states | Direction gaps |
|---|---:|---|---:|---|---|---|
| `lester` | hero | walk, idle, victory, hurt, death, run, melee, throw, shoot | 149 | NO | none | hurt: 7 dirs; death: 7 dirs; run: 7 dirs; melee: 7 dirs; throw: 7 dirs; shoot: 7 dirs |
| `lilly` | hero | death, melee, hurt, throw, shoot, walk, run, idle | 476 | YES | none | none |
| `lit-commando` | hero | hurt, walk, shoot-shotgun, throw, melee, shoot, levelup, run, idle | 490 | NO | death | hurt: 1 dirs; shoot: 1 dirs |
| `lit-valkyrie` | hero | death, throw, hurt, shoot, melee, run, walk, idle | 441 | NO | none | death: 1 dirs |

### Lester production sheet

- Source: `apps/portal/assets/lester-production/lester-production-sprite-manifest.json` (Justin-provided production sprite sheets).
- Production-sheet states: `idle` 25 frames, `walk` 25 frames, `run` 25 frames, `jump` 25 frames
- Runtime frame size: {'width': 128, 'height': 128}; draw size: {'width': 104, 'height': 104}.
- Note: `hmh-character-config.mjs` still records this as Lester/Lit Commando visual-kit source, but current live combat frame selection in `main.js` uses `HMH_ANIMATED_ROSTER` via `HERO_LOCKED_ROSTER` so the game does not mix designs mid-run.

### Legacy Justin-provided character assets

| Character | 128×128 animation frames | Weapon/action stills | Weapon animations |
|---|---|---|---|
| `lester` | idle:8, walk:8, run:8, jump:8, attack:8 | machineGunFacing, machineGunRight, machineGunLeft, knifeFacing, knifeRight, grenadeFacing, grenadeRight, grenadeLeft | knife/stabAnimation:8 |
| `lilly` | idle:8, walk:8, run:8, jump:8, attack:8 | machineGunFacing, machineGunRight, machineGunLeft, knifeFacing, knifeRight, knifeLeft, grenadeFacing, grenadeRight, grenadeLeft, pistolFacing, shotgunFacing | none |

## Enemy assets

### Runtime enemy catalog mapped to art

Core audit target for enemies: `idle`, `walk`, `run`, `attack-tell`, `attack`, `hit`, `death`, ideally all 8 directions. Runtime falls back within the same roster if a preferred state is missing (`run → walk → idle`, `attack-tell → attack → walk → idle`).

| Enemy id | Title | Class | Animated roster key | Roster exists | Coverage | Missing states | Direction gaps | Districts/biomes |
|---|---|---|---|---|---|---|---|---|
| `fud-goblin` | FUD Goblin | grunt | `fud-goblin` | yes | gaps |  | attack-tell:north | ghost_town, country_road, residential_edge |
| `gas-fee-wisp` | Gas Fee Wisp | hazard-flyer | `gas-fee-wisp` | yes | gaps |  | run:north-east | desert_approach, inner_city |
| `paper-hand` | Paper Hands | panic-melee | `paper-hand` | yes | gaps | attack-tell |  | ghost_town, inner_city |
| `fud-goblin-cave` | Cave FUD Goblin | cave-grunt | `trench-degen` | yes | gaps | run, attack-tell, attack, hit, death |  | country_road, dry_forest_cave |
| `claim-jumper` | Claim Jumper | rifle-bandit | `claim-jumper` | yes | gaps | idle, walk, run, attack, hit, death |  | ghost_town, residential_edge |
| `claim-jumper-sheriff` | Claim-Jumper Sheriff | rifle-bandit-miniboss | `claim-jumper` | yes | gaps | idle, walk, run, attack, hit, death |  | ghost_town |
| `scam-cult-zealot` | Scam Cult Zealot | fan-shot-zealot | `scam-cult-zealot` | yes | gaps | idle, walk, attack, hit, death |  | ghost_town |
| `crypto-bro` | Crypto Bro | kol-ranged-grunt | `crypto-bro-rusher` | yes | gaps | idle, walk, run, attack-tell, attack, hit, death |  | inner_city, residential_edge |
| `gas-beast` | Gas Beast | armored-bruiser | `gas-beast-tank` | yes | gaps | idle, walk, run, attack-tell, attack, hit, death |  | inner_city, residential_edge |
| `sybil-drone` | Bot Swarm (Sybil Drones) | formation-flyer | `sybil-drone` | yes | gaps | walk, hit, death | attack-tell:north-east | desert_approach, inner_city |
| `rug-rat` | Rug Rat | disruptor | `rug-rat` | yes | gaps | walk, attack-tell, attack, death |  | ghost_town, country_road |
| `honeypot-turret` | Honeypot Turret | stationary-trap | `honeypot-turret` | yes | gaps | attack-tell | idle:south | country_road, inner_city |
| `coyote-pack-runner` | Coyote Pack Runner | pack-ambusher | `coyote-pack-runner` | yes | full |  |  | country_road, dry_forest_cave |
| `wild-boar` | Wild Boar | charger-animal | `wild-boar` | yes | full |  |  | country_road, dry_forest_cave |
| `buzzard` | Buzzard | flyer-animal | `crypto-bro-rusher` | yes | gaps | idle, walk, run, attack-tell, attack, hit, death |  | desert_approach, oasis_lakeside |
| `rattlesnake` | Rattlesnake | ambusher-animal | `rattlesnake` | yes | full |  |  | desert_approach, residential_edge, oasis_lakeside |
| `scorpion-ambusher` | Scorpion Ambusher | burrow-trap | `scorpion-ambusher` | yes | gaps | idle, walk, run, attack-tell, attack, hit |  | desert_approach, oasis_lakeside |
| `bandit-captain` | Bandit Captain | elite-ranged-human | `evil-banker-ranged` | yes | gaps | idle, walk, run, attack-tell, attack, hit, death |  | country_road, ghost_town |
| `ridge-raider` | Ridge Raider | sniper-human | `evil-banker-ranged` | yes | gaps | idle, walk, run, attack-tell, attack, hit, death |  | residential_edge |
| `slippage-skater` | Slippage Skater | mid-tier-rusher | `slippage-skater` | yes | gaps | attack-tell |  | country_road, inner_city |
| `phishing-angler` | Phishing Angler | zoning-hook | `phishing-angler` | yes | gaps | walk, attack-tell, hit, death |  | residential_edge, inner_city |
| `mev-reaper` | MEV Reaper | elite-flanker | `mev-reaper` | yes | gaps | idle, walk, attack-tell, attack, hit, death |  | inner_city, residential_edge |
| `liquidation-cascade-golem` | Liquidation Cascade Golem | armored-elite | `liquidation-cascade-golem` | yes | gaps | idle, walk, run, attack-tell, attack, hit, death |  | inner_city |

### Animated enemy/miniboss/boss roster entries

| Roster key | Role | States present | Total frames | Full core? | Missing states | Direction gaps |
|---|---|---|---:|---|---|---|
| `bit-whale-boss` | boss |  | 0 | NO | idle, walk, attack-tell, attack, attack-ranged, special, hit, death | none |
| `chain-reaper-boss` | boss |  | 0 | NO | idle, walk, attack-tell, attack, attack-ranged, special, hit, death | none |
| `whale-dumper-boss` | boss | idle, walk, death, attack-ranged, attack, attack-tell, special | 96 | NO | hit | walk: 7 dirs; death: 7 dirs; attack-ranged: 7 dirs; attack: 7 dirs; attack-tell: 7 dirs; special: 7 dirs |
| `bitcoin-maximalist-riot-cop` | enemy | attack-tell, attack | 96 | NO | idle, walk, run, hit, death | none |
| `buzzard` | enemy | death, attack-tell, hit, attack, walk, idle, run | 402 | YES | none | none |
| `claim-jumper` | enemy | shoot, attack-tell | 96 | NO | idle, walk, run, attack, hit, death | none |
| `coyote-pack-runner` | enemy | death, hit, attack, attack-tell, run, walk, idle | 424 | YES | none | none |
| `crypto-bro-rusher` | enemy |  | 0 | NO | idle, walk, run, attack-tell, attack, hit, death | none |
| `evil-banker-ranged` | enemy |  | 0 | NO | idle, walk, run, attack-tell, attack, hit, death | none |
| `fud-goblin` | enemy | attack-tell, attack, run, walk, idle, death, hit, hurt | 402 | NO | none | attack-tell: 1 dirs |
| `gas-beast-tank` | enemy |  | 0 | NO | idle, walk, run, attack-tell, attack, hit, death | none |
| `gas-fee-wisp` | enemy | hit, attack-tell, attack, walk, run, idle, death | 391 | NO | none | run: 1 dirs |
| `honeypot-turret` | enemy | death, hit, run, attack, walk, idle | 377 | NO | attack-tell | idle: 1 dirs |
| `influencer-camera-drone` | enemy | death | 63 | NO | idle, walk, run, attack-tell, attack, hit | death: 1 dirs |
| `liquidation-cascade-golem` | enemy |  | 0 | NO | idle, walk, run, attack-tell, attack, hit, death | none |
| `mev-reaper` | enemy | run | 72 | NO | idle, walk, attack-tell, attack, hit, death | none |
| `nft-valet` | enemy | death, attack | 119 | NO | idle, walk, run, attack-tell, hit | death: 1 dirs |
| `paper-hand` | enemy | death, hit, attack, run, walk, idle | 384 | NO | attack-tell | none |
| `phishing-angler` | enemy | shoot, attack, idle, run | 240 | NO | walk, attack-tell, hit, death | none |
| `rattlesnake` | enemy | death, attack-tell, attack, run, walk, idle, hit | 405 | YES | none | none |
| `rug-rat` | enemy | run, idle, hit | 168 | NO | walk, attack-tell, attack, death | none |
| `rugpull-summoner` | enemy |  | 0 | NO | idle, walk, run, attack-tell, attack, hit, death | none |
| `scam-cult-zealot` | enemy | run, attack-tell | 112 | NO | idle, walk, attack, hit, death | none |
| `scorpion-ambusher` | enemy | death | 72 | NO | idle, walk, run, attack-tell, attack, hit | none |
| `slippage-skater` | enemy | hit, run, walk, idle, death, attack | 384 | NO | attack-tell | none |
| `stablecoin-socialite` | enemy | idle | 56 | NO | walk, run, attack-tell, attack, hit, death | none |
| `sybil-drone` | enemy | run, attack-tell, attack, idle | 219 | NO | walk, hit, death | attack-tell: 1 dirs |
| `trench-degen` | enemy | walk, idle, hurt | 119 | NO | run, attack-tell, attack, hit, death | none |
| `wild-boar` | enemy | death, run, hit, attack, attack-tell, walk, idle | 424 | YES | none | none |
| `bridge-exploiter` | miniboss | attack-tell, idle, run, attack | 224 | NO | walk, hit, death | none |
| `plaza-warden` | miniboss | hit, run, death, attack-tell | 224 | NO | idle, walk, attack | none |
| `the-obfuscator` | miniboss | shoot, death, hit, attack-tell | 208 | NO | idle, walk, run, attack | none |
| `warren-spear-rider` | miniboss |  | 0 | NO | idle, walk, run, attack-tell, attack, hit, death | none |

### Complete-animation staging manifest

`apps/portal/assets/generated/hmh-complete-animations/hmh-complete-animations.mjs` is a newer staging manifest for generated kits, but these are not the same thing as the current `HMH_ANIMATED_ROSTER` runtime table above.

| Roster key | Role | States present | Total frames | Full core? | Missing states | Direction gaps |
|---|---|---|---:|---|---|---|
| `lit-commando` | hero | crouch, death, hurt, idle, melee, run, shoot, walk | 368 | NO | throw | hurt: 4 dirs; melee: 4 dirs; run: 4 dirs; walk: 1 dirs |
| `warren-spear-rider` | enemy | attack-tell, death, hit, idle, walk | 154 | NO | run, attack | attack-tell: 6 dirs; death: 3 dirs; hit: 5 dirs; idle: 1 dirs; walk: 1 dirs |

### Legacy/static enemy assets

| Legacy enemy | Title | 128×128 animation frames | Stills |
|---|---|---|---:|
| `trench-degen` | trench-degen | idle:8, walk:8, run:8, jump:8, attack:8 | 3 |
| `evil-banker` | evil-banker | idle:8, walk:8, run:8, jump:8, attack:8 | 3 |
| `warren-spear-rider` | warren-spear-rider | idle:8, walk:8, run:8, jump:8, attack:8 | 3 |
| `crypto-bro` | crypto-bro | idle:8, walk:8, run:8, jump:8, attack:8 | 3 |
| `gas-beast` | gas-beast | idle:8, walk:8, run:8, jump:8, attack:8 | 3 |

### 4-direction still enemy wave

Source: `PixelLab generated HMH enemies wave (4-direction stills)`. These are stills, not full animation kits, with directions south, east, north, west.

| Enemy | Archetype | Biome | Frame size |
|---|---|---|---|
| `diamond-hands-whale` / Diamond Hands Whale | bruiser | rock | [92, 92] |
| `influencer-shill` / Influencer Shill | caster | pavement | [92, 92] |
| `rug-pull-dev` / Rug-Pull Dev | saboteur | grass | [92, 92] |
| `maxi-zealot` / Maxi Zealot | zealot | sand | [92, 92] |
| `mempool-bot-runner` / Mempool Bot Runner | runner | water | [92, 92] |
| `taxman-validator` / Taxman Validator | enforcer | gravel | [92, 92] |

## Boss assets

| Boss id | Title | Design status | Animated roster asset? | Notes |
|---|---|---|---|---|
| `rug-pull-baron` | The Rug Pull Baron | campaign/design boss | NO | tilting rug arena reveals grinding foundry press / phase-1-pattern-learn; phase-2-arena-shift; phase-3-enrage |
| `mt-goxzilla` | Mt. Goxzilla | campaign/design boss | NO | withdrawals-paused beam and offline weak point / phase-1-pattern-learn; phase-2-enrage |
| `the-whale` | The Whale | campaign/design boss | NO | market-dump pressure waves and flooded platforming / phase-1-pattern-learn; phase-2-enrage |
| `sir-fud-bear-king` | Sir FUD, the Bear King | campaign/design boss | NO | red-candlestick warhammer, goblin summons, burning floor zones / phase-1-pattern-learn; phase-2-arena-shift; phase-3-enrage |
| `fifty-one-percent-hydra` | The 51% Hydra | campaign/design boss | NO | mining-rig heads and central consensus node puzzle / phase-1-pattern-learn; phase-2-enrage |
| `tetherra-stable-queen` | Tetherra, the Stable Queen | campaign/design boss | NO | peg-pillar invulnerability and depeg panic fire / phase-1-pattern-learn; phase-2-enrage |
| `the-maximalist` | The Maximalist | campaign/design boss | NO | corrupted Lester mirror duel using player-like moveset / phase-1-pattern-learn; phase-2-arena-shift; phase-3-enrage |
| `gas-titan` | Gas Titan (The Congestion) | campaign/design boss | NO | fee spike floor hazards with low-fee damage windows / phase-1-pattern-learn; phase-2-enrage |
| `mr-ngmi` | The Influencer (Mr. NGMI) | campaign/design boss | NO | Sybil Swarm shield, shill beams, sponsored-post bombs / phase-1-pattern-learn; phase-2-enrage |
| `quantum-hacker` | The Quantum Hacker | campaign/design boss | NO | three fork phases, illusions, vault damage race, leaked seed-phrase reveal / phase-1-pattern-learn; phase-2-arena-shift; phase-3-enrage |

Animated boss roster entries that exist:
- `whale-dumper-boss`: states idle, walk, death, attack-ranged, attack, attack-tell, special; total frames 96; full boss core = NO; missing hit.
- `chain-reaper-boss`: states ; total frames 0; full boss core = NO; missing idle, walk, attack-tell, attack, attack-ranged, special, hit, death.
- `bit-whale-boss`: states ; total frames 0; full boss core = NO; missing idle, walk, attack-tell, attack, attack-ranged, special, hit, death.

## Map / level / tileset assets

### Level 1 environment runtime inventory

| Stage / biome bucket | Count | Notes |
|---|---:|---|
| `desert_approach` | 42 | hot desert, rocky mountains, cactus silhouettes, dust, approach roads |
| `ghost_town` | 36 | saloon/bank/church facades, porches, lamps, wooden cover |
| `country_road` | 26 | trees, road barriers, fences, shrubs, roadside cover |
| `residential_edge` | 22 | houses/suburban edge/city approach props |
| `inner_city` | 22 | city buildings, streets, urban facades, skyline pieces |

| Runtime role | Count | How to use in drawings |
|---|---:|---|
| `wide-background` | 58 | large horizon/backdrop strip |
| `vertical-background-or-large-prop-reference` | 20 | tall prop/background reference |
| `square-tileset-or-building-reference` | 43 | reference board or square tile/building composition |
| `structure-prop` | 6 | transparent/alpha prop-like structure, easiest current prop refs |
| `scenic-background` | 7 | single scenic backdrop/setpiece image |
| `wide-parallax-or-road-strip` | 14 | long strip for road/parallax/ground band |

Current alpha structure props worth referencing first:
- `env-034` (`env-034-03-36-49-pm`) — desert_approach, 1024×1024, alpha coverage 0.3912; runtime path `apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-034-03-36-49-pm.png`.
- `env-059` (`env-059-03-54-15-pm`) — ghost_town, 1536×1024, alpha coverage 0.6049; runtime path `apps/portal/assets/hard-money-heroes/environment/runtime/ghost_town/env-059-03-54-15-pm.png`.
- `env-073` (`env-073-04-02-22-pm`) — ghost_town, 1536×1024, alpha coverage 0.4538; runtime path `apps/portal/assets/hard-money-heroes/environment/runtime/ghost_town/env-073-04-02-22-pm.png`.
- `env-096` (`env-096-04-15-23-pm`) — country_road, 1024×1536, alpha coverage 0.1624; runtime path `apps/portal/assets/hard-money-heroes/environment/runtime/country_road/env-096-04-15-23-pm.png`.
- `env-105` (`env-105-04-18-04-pm`) — residential_edge, 1536×1024, alpha coverage 0.3552; runtime path `apps/portal/assets/hard-money-heroes/environment/runtime/residential_edge/env-105-04-18-04-pm.png`.
- `env-123` (`env-123-04-22-41-pm`) — residential_edge, 1536×1024, alpha coverage 0.0965; runtime path `apps/portal/assets/hard-money-heroes/environment/runtime/residential_edge/env-123-04-22-41-pm.png`.

### Generated level-environment pack

Source: `apps/portal/assets/generated/hmh-level-environment/hmh-level-environment.mjs`; total 140, counts: parallax-bg:70, prop:70, decor:8.

### PixelLab Wave 2 tiles / props

Contact sheet: `./assets/generated/hmh-environment-pixellab-wave-2/contact-sheets/hmh-environment-pixellab-wave-2-contact-sheet.png`

| Pack slug | Name | Type | Role | Images | Tile size |
|---|---|---|---|---:|---|
| `urban-ground-road-kit` | Urban Ground And Road Kit | tiles_pro | tileset_urban_roads | 16 | 64x64 |
| `desert-sand-gravel-nature-kit` | Desert Sand Gravel Nature Kit | tiles_pro | tileset_desert_nature | 16 | 64x64 |
| `water-river-waterfall-kit` | Water River Waterfall Kit | tiles_pro | tileset_water_edges | 16 | 64x64 |
| `ground-dirt` | Ground Dirt | isometric_tile | tile_static | 1 | 56x56 |
| `ground-rock` | Rocky Ground | isometric_tile | tile_static | 1 | 56x56 |
| `concrete-road` | Concrete Road | isometric_tile | tile_static | 1 | 56x56 |
| `asphalt-road` | Asphalt Road | isometric_tile | tile_static | 1 | 56x56 |
| `asphalt-road-stripe` | Asphalt Road Stripe | isometric_tile | tile_static | 1 | 56x56 |
| `sand` | Sand | isometric_tile | tile_static | 1 | 56x56 |
| `gravel` | Gravel | isometric_tile | tile_static | 1 | 56x56 |
| `wood-plank` | Wood Plank Floor | isometric_tile | tile_static | 1 | 56x56 |
| `shallow-water` | Shallow Water | isometric_tile | tile_static | 1 | 56x56 |
| `river-bank` | River Bank | isometric_tile | tile_static | 1 | 56x56 |
| `waterfall-lip` | Waterfall Lip | isometric_tile | tile_static | 1 | 56x56 |
| `flower-grass-ground` | Flower Grass Ground | isometric_tile | tile_static | 1 | 56x56 |
| `rock-cluster` | Rock Cluster | static_map_object | prop_static | 1 | 96x72 |
| `large-boulder` | Large Boulder | static_map_object | prop_static | 1 | 128x96 |
| `concrete-barrier` | Concrete Barrier | static_map_object | prop_collision | 1 | 144x72 |
| `traffic-cone` | Traffic Cone | static_map_object | prop_decor | 1 | 64x72 |
| `wood-log-stack` | Wood Log Stack | static_map_object | prop_collision | 1 | 128x88 |
| `gravel-pile` | Gravel Pile | static_map_object | prop_static | 1 | 112x80 |
| `sand-pile` | Sand Pile | static_map_object | prop_static | 1 | 112x80 |
| `blank-street-sign` | Blank Street Sign | static_map_object | prop_decor | 1 | 80x112 |
| `water-surface-ripple` | Water Surface Ripple | animated_object_base | animated_water | 1 | 192x192 |
| `river-rapids-flow` | River Rapids Flow | animated_object_base | animated_river | 1 | 192x192 |
| `waterfall-cascade` | Waterfall Cascade | animated_object_base | animated_waterfall | 1 | 192x192 |
| `leafy-tree-wind` | Leafy Tree Wind | animated_object_base | animated_tree | 1 | 192x192 |
| `palm-tree-wind` | Palm Tree Wind | animated_object_base | animated_tree | 1 | 192x192 |
| `flower-patch-sway` | Flower Patch Sway | animated_object_base | animated_flowers | 1 | 192x192 |
| `cactus-heat-shimmer` | Cactus Heat Shimmer | animated_object_base | animated_cactus | 1 | 192x192 |
| `parked-car-blink` | Parked Car Blink | animated_object_base | animated_vehicle | 1 | 192x192 |
| `wrecked-car-smoke` | Wrecked Car Smoke | animated_object_base | animated_vehicle | 1 | 192x192 |
| `garbage-can-wobble` | Garbage Can Wobble | animated_object_base | animated_garbage | 1 | 192x192 |
| `trash-bag-rustle` | Trash Bag Rustle | animated_object_base | animated_garbage | 1 | 192x192 |
| `road-sign-sway` | Road Sign Sway | animated_object_base | animated_sign | 1 | 192x192 |
| `neon-sign-flicker` | Neon Sign Flicker | animated_object_base | animated_sign | 1 | 192x192 |
| `traffic-light-blink` | Traffic Light Blink | animated_object_base | animated_sign | 1 | 192x192 |
| `tumbleweed-roll` | Tumbleweed Roll | animated_object_base | animated_desert_prop | 1 | 192x192 |
| `water-surface-ripple-ambient` | Water Surface Ripple Ambient Loop | object_animation | animated_water | 6 | 192x192 |
| `river-rapids-flow-ambient` | River Rapids Flow Ambient Loop | object_animation | animated_river | 6 | 192x192 |
| `waterfall-cascade-ambient` | Waterfall Cascade Ambient Loop | object_animation | animated_waterfall | 8 | 192x192 |
| `leafy-tree-wind-ambient` | Leafy Tree Wind Ambient Loop | object_animation | animated_tree | 6 | 192x192 |
| `palm-tree-wind-ambient` | Palm Tree Wind Ambient Loop | object_animation | animated_tree | 6 | 192x192 |
| `flower-patch-sway-ambient` | Flower Patch Sway Ambient Loop | object_animation | animated_flowers | 6 | 192x192 |
| `cactus-heat-shimmer-ambient` | Cactus Heat Shimmer Ambient Loop | object_animation | animated_cactus | 6 | 192x192 |
| `parked-car-blink-ambient` | Parked Car Blink Ambient Loop | object_animation | animated_vehicle | 6 | 192x192 |
| `wrecked-car-smoke-ambient` | Wrecked Car Smoke Ambient Loop | object_animation | animated_vehicle | 8 | 192x192 |
| `garbage-can-wobble-ambient` | Garbage Can Wobble Ambient Loop | object_animation | animated_garbage | 6 | 192x192 |
| `trash-bag-rustle-ambient` | Trash Bag Rustle Ambient Loop | object_animation | animated_garbage | 6 | 192x192 |
| `road-sign-sway-ambient` | Road Sign Sway Ambient Loop | object_animation | animated_sign | 6 | 192x192 |
| `neon-sign-flicker-ambient` | Neon Sign Flicker Ambient Loop | object_animation | animated_sign | 6 | 192x192 |
| `traffic-light-blink-ambient` | Traffic Light Blink Ambient Loop | object_animation | animated_sign | 6 | 192x192 |
| `tumbleweed-roll-ambient` | Tumbleweed Roll Ambient Loop | object_animation | animated_desert_prop | 8 | 192x192 |

### Existing L1 design asset manifest

`docs/game-design/hmh-l1-asset-manifest.md` already records the intended sprite/code inventory: terrain tiles (sand, cracked earth, scrub, dirt road, cobble, dry grass, rocky ground, water/riverbank/sandbar/stepping stones), flora/nature, rocks/terrain forms, structures, set dressing, characters, enemies/bosses, VFX, and systems. Treat that as the target checklist, not proof that every item has an individually named runtime PNG yet.

## Animation gaps and production recommendations

- **Hero gap:** 3 hero roster entries are missing at least one core state/direction.
- **Enemy gap:** 22 enemy roster entries are missing at least one core state/direction.
- **Boss gap:** 3 animated boss entries are incomplete against the boss target, and most campaign bosses have no bespoke animated roster yet.
- **Highest-value next art pass:** decide which enemy designs to keep, then regenerate/replace enemies as complete 8-direction kits with `idle`, `walk`, `run`, `attack-tell`, `attack`, `hit`, `death`; avoid shipping isolated stills because the runtime will otherwise rely on fallback frames.
- **World/level pass:** create a semantic alias table for the environment inventory (`Tree 1`, `Rock 4`, `Building 6`) and point each alias to a stable path/ID before you draw detailed level layouts. This will let your sketches map directly to runtime prop placement metadata.

## Source files audited

- `apps/portal/assets/generated/hmh-animated-roster/hmh-animated-roster.mjs`
- `apps/portal/assets/generated/hmh-complete-animations/hmh-complete-animations.mjs`
- `apps/portal/assets/hard-money-heroes/hard-money-heroes-user-asset-manifest.json`
- `apps/portal/assets/lester-production/lester-production-sprite-manifest.json`
- `apps/portal/src/arcade-core.mjs`
- `apps/portal/src/hmh-encounter-visuals.mjs`
- `apps/portal/assets/hard-money-heroes/environment/hmh-environment-manifest.json`
- `docs/game-design/hard-money-heroes-environment-asset-inventory.json`
- `docs/game-design/hmh-l1-asset-manifest.md`
- `apps/portal/assets/generated/hmh-environment-pixellab-wave-2/hmh-environment-pixellab-wave-2.mjs`
- `apps/portal/assets/generated/hmh-level-environment/hmh-level-environment.mjs`

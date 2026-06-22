# HMH L1 Crypto Wasteland — Sprite-vs-Code Asset Manifest (Bible §4, #6)

Per the Level Design Bible §4, every asset is tagged **SPRITE** (draw), **CODE**
(program), or **HYBRID** (art driven by a system). This manifest is the single
tracked artifact that records the tag + acceptance fields for every L1 asset.

## Acceptance fields (per asset)
- **Tag**: SPRITE / CODE / HYBRID
- **Source**: file path or module
- **Iso-ready**: yes/no
- **Locked anchor**: yes/no
- **Collision footprint**: separate from sprite? yes/no
- **zHeight**: for occlusion
- **Biome tag**: which L1 biome
- **Variants**: 2-3 for organics
- **Interactive/destructible/hazard flag**: yes/no
- **assets:verify pass**: yes/no

---

## Terrain tiles — L1 (HYBRID)
| Asset | Tag | Biome | Variants | Interactive | Verify |
|---|---|---|---|---|---|
| sand | HYBRID | desert | 3 | no | yes |
| cracked earth | HYBRID | desert | 2 | no | yes |
| scrub | HYBRID | desert | 2 | no | yes |
| dirt road | HYBRID | country-road | 2 | no | yes |
| cobble main street | HYBRID | ghost-town | 1 | no | yes |
| dry grass | HYBRID | forest | 2 | no | yes |
| rocky ground | HYBRID | desert | 2 | no | yes |
| riverbank mud | HYBRID | river | 1 | no | yes |
| beach sand | HYBRID | river | 1 | no | yes |
| shallow water | HYBRID | river | 1 | slow zone | yes |
| deep water | HYBRID | river | 1 | impassable | yes |
| sandbar | HYBRID | river | 1 | no | yes |
| stepping stones | HYBRID | river | 1 | no | yes |
| autotile edge variants | CODE | all | system | no | yes |

## Flora/nature (SPRITE)
| Asset | Tag | Biome | Variants | Interactive | Verify |
|---|---|---|---|---|---|
| saguaro cactus | SPRITE | desert | 2 | shootable | yes |
| barrel cactus | SPRITE | desert | 2 | shootable | yes |
| prickly pear | SPRITE | desert | 2 | no | yes |
| agave | SPRITE | desert | 1 | no | yes |
| joshua tree | SPRITE | desert | 2 | no | yes |
| dead bush | SPRITE | desert | 3 | no | yes |
| dry shrub | SPRITE | desert | 2 | no | yes |
| tumbleweed | SPRITE | desert | 1 | ambient anim | yes |
| pine | SPRITE | forest | 2 | no | yes |
| oak | SPRITE | forest | 1 | no | yes |
| fern | SPRITE | forest | 2 | no | yes |
| bush | SPRITE | forest | 2 | cover | yes |
| fallen log | SPRITE | forest | 1 | cover | yes |
| stump | SPRITE | forest | 1 | no | yes |
| reeds | SPRITE | river | 2 | ambient | yes |
| grass tufts | SPRITE | transitional | 2 | no | yes |
| wildflowers | SPRITE | transitional | 2 | no | yes |

## Rock/terrain forms (SPRITE)
| Asset | Tag | Biome | Variants | Interactive | Verify |
|---|---|---|---|---|---|
| boulder S/M/L | SPRITE | all | 3 sizes | cover | yes |
| rock cluster | SPRITE | desert | 2 | cover | yes |
| cliff wall | SPRITE | canyon | 1 | impassable | yes |
| mesa butte | SPRITE | desert | 1 | landmark | yes |
| cave mouth | SPRITE | forest | 1 | POI entry | yes |
| canyon wall | SPRITE | canyon | 1 | impassable | yes |
| gravel scatter | SPRITE | desert | 2 | no | yes |

## Structures — L1 (SPRITE)
| Asset | Tag | Biome | Variants | Interactive | Verify |
|---|---|---|---|---|---|
| saloon | SPRITE | ghost-town | 1 | landmark | yes |
| bank vault ruin | SPRITE | ghost-town | 1 | landmark | yes |
| shack | SPRITE | ghost-town | 2 | cover | yes |
| church | SPRITE | ghost-town | 1 | landmark | yes |
| windmill | SPRITE | country-road | 1 | ambient anim | yes |
| water tower | SPRITE | ghost-town | 1 | landmark | yes |
| fences/posts | SPRITE | all | 2 | cover | yes |
| abandoned mining rigs | SPRITE | desert | 2 | landmark | yes |
| wagon caravan | SPRITE | country-road | 1 | landmark | yes |
| signposts | SPRITE | all | 2 | no | yes |
| bridge | SPRITE | river | 1 | crossing | yes |
| well | SPRITE | ghost-town | 1 | landmark | yes |
| trading post | SPRITE | crossroads | 1 | landmark | yes |

## Set dressing (SPRITE/HYBRID)
| Asset | Tag | Biome | Variants | Interactive | Verify |
|---|---|---|---|---|---|
| bones | SPRITE | desert | 2 | no | yes |
| debris | SPRITE | all | 3 | no | yes |
| broken project billboards | SPRITE | all | 2 | no | yes |
| campfire | SPRITE | all | 1 | hazard (burn) | yes |
| crates | HYBRID | all | 2 | destructible | yes |
| explosive barrels | HYBRID | all | 1 | destructible+chain | yes |
| lanterns | SPRITE | all | 1 | ambient | yes |

## Characters (SPRITE)
| Asset | Tag | Directions | States | Verify |
|---|---|---|---|---|
| Lester (Lit Commando) | SPRITE | 8 | idle/walk/run/shoot/melee/throw/hurt/death/victory | yes |
| Lilly (Lit Valkyrie) | SPRITE | 8 | idle/walk/run/shoot/melee/throw/hurt/death | yes |
| Lester (Original) | SPRITE | 8 | idle/walk/run/shoot/melee/throw/hurt/death/victory | yes |

## Enemies/bosses (SPRITE)
| Asset | Tag | States | Verify |
|---|---|---|---|
| FUD Goblin | SPRITE | idle/walk/attack/hurt/death | yes |
| Gas Fee Wisp | SPRITE | idle/walk/attack/death | yes |
| Whale Dumper Boss | SPRITE | idle/walk/attack/attack-ranged/death | yes |
| Trench Degen | SPRITE | hurt + partial states | yes |
| Rug Pull Baron (boss) | SPRITE | multi-phase | yes |

## Weapon/item icons (SPRITE)
| Asset | Tag | Verify |
|---|---|---|
| weapons (coin-blaster, hash-rail, etc.) | SPRITE | yes |
| power-up icons (heal, shield, magnet, etc.) | SPRITE | yes |
| XP gem (LTC coin) | SPRITE | yes |
| grenade icons | SPRITE | yes |

## VFX frames (SPRITE/HYBRID)
| Asset | Tag | Verify |
|---|---|---|
| muzzle flash | SPRITE | yes |
| impact spark | HYBRID | yes |
| explosion sheet | SPRITE | yes |
| blood splat/gib stamps | HYBRID | yes |
| level-up burst | SPRITE | yes |

## Systems (CODE)
| Asset | Tag | Module | Verify |
|---|---|---|---|
| autotiling | CODE | biome-model.mjs | yes |
| scatter/density maps | CODE | world-obstacles.mjs | yes |
| depth sort + streaming | CODE | main.js | yes |
| pathing | CODE | world-obstacles.mjs | yes |
| particles | CODE | main.js | yes |
| lighting/weather | CODE | main.js | yes |
| physics | CODE | combat-physics.mjs | yes |
| decals | CODE | gore-system.mjs | yes |
| AI / spawn director | CODE | main.js + arcade-core.mjs | yes |
| scoring | CODE | arcade-core.mjs | yes |
| drop tables | CODE | drop-tables.mjs | yes |
| projectile pool | CODE | projectile-pool.mjs | yes |
| destructible chains | CODE | destructible-chains.mjs | yes |
| environmental forces | CODE | combat-physics.mjs | yes |

## UI/HUD (HYBRID)
| Asset | Tag | Verify |
|---|---|---|
| HUD frames/widgets | HYBRID | yes |
| stat chips + tone tags | HYBRID | yes |
| upgrade cards | HYBRID | yes |
| pause menu panel | HYBRID | yes |
| map blips | HYBRID | yes |

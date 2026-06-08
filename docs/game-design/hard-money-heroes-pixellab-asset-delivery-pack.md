# Hard Money Heroes — Pixellab Asset Delivery Pack
Use this as the execution brief for the next Pixellab generation campaign. Keep generator output under `apps/portal/assets/generated/` and route slices into `apps/portal/assets/generated/sliced/`.

## Generation order
1. weapon-fx
2. damage-death
3. isometric-props-trees-buildings
4. power-ups
5. roguelite-ui-menus
6. sniper-rifle recoil and breath

## Prompt batch: weapon special effects
Run 1 sheet per weapon or group where the poses differ more than the palette.

| job | prompt |
| --- | --- |
| settler-flash | 16-bit pixel-art muzzle flash and bullet impact sprite sheet for a revolver-style weapon called The Settler in an isometric retro run-and-gun roguelite. Clean flat background, grid frames, no text, readable silhouette, 4x4 contact sheet. |
| block-breaker-laser | 16-bit pixel-art laser blast and ricochet hit sprite sheet for a crypto/cannon-style weapon called Block Breaker. Electric blue and white laser, impact sparks, clean dark background, 4x4 grid, no text, arcade screen use. |
| hashstorm-plasma | 16-bit pixel-art plasma bolt and chain-lightning fragment sprite sheet for a energy weapon called Hashstorm. Purple-green bolt, trailing sparks, no text, grid frames, consistent scale. |
| litecoin-blade | 16-bit pixel-art energy slash and parry flash sprite sheet for a melee weapon called Litecoin Blade. Isometric facing, swing arcs, hit flash, no text, clean background. |
| crypto-bomb | 16-bit pixel-art grenade and explosion sprite sheet for Crypto Bombs. Fuse spark, toss arc, explosion cloud, smoke tail, no text, grid sheet. |
| hard-fork | 16-bit pixel-art fragmentation blast and upgraded version sprite sheet for Hard Forks. Ground shock wave, debris cloud, no text, readable motion. |
| hash-rail | 16-bit pixel-art guided beam and charge-up sprite sheet for Hash Rail. Charge aura, beam line, overload flash, no text, grid sheet. |
| oracle-slayer | 16-bit pixel-art heavy shot and armor-piercing impact sprite sheet for Oracle Slayer. Big recoil flash, hit mark, armor crack, no text. |

## Prompt batch: damage and death
| job | prompt |
| --- | --- |
| hit-feedback | 16-bit pixel-art hit feedback sprite sheet for an isometric roguelite. Hit flash, staggered knockback, knockdown dust, rising impact stars, no text, 4x4 grid. |
| death-core | 16-bit pixel-art death animation sprite sheet for humanoid and robot enemies. Fade-out, collapse, rising soul/coin sparkles, no text, clean background. |
| death-boss | 16-bit pixel-art boss death stage sprite sheet. Screen shake aura, explosion burst, core collapse, cleanup smoke, no text, 4x4 grid. |

## Prompt batch: isometric props, trees, buildings
| job | prompt |
| --- | --- |
| slums-props | 16-bit pixel-art isometric prop sheet for Slums environment in Hard Money Heroes. Items: street lamp, neon sign, dumpster, garbage can, park bench, mailbox, parked car, shipping container, billboard frame, tunnel entrance. Isometric angle, consistent scale, no text, flat background. |
| foundry-props | 16-bit pixel-art isometric prop sheet for Foundry/Tower environment. Items: furnace vent, catwalk edge, pipe cluster, crate stack, ladder, chain barricade, molten puddle, control panel, blast door frame, tool rack. No text, flat background. |
| getaway-props | 16-bit pixel-art isometric prop sheet for Getaway environment. Items: convertible roof, highway barrier, money bag stack, street cone, traffic light, billboard, overpass, construction barrel, taxi body, tunnel mouth. No text, flat background. |
| foliage-a | 16-bit pixel-art isometric tree and foliage sheet A for chunky retro roguelite. Items: palm tree, leafy tree, barrel cactus, pine tree, shrub, palm cluster, dead tree, fence line, street tree planter, utility pole. No text. |
| foliage-b | 16-bit pixel-art isometric tree and foliage sheet B for chunky retro roguelite. Items: flowering bush, tall grass clump, oak tree, bamboo cluster, potted tree, hedgerow, ivy wall, rooftop garden pot, trellis, treetop crow nest. No text. |
| buildings-a | 16-bit pixel-art isometric building facade sheet A for Hard Money Heroes. Items: apartment block, corner store, bodega, laundromat, diner front, bank facade, pawn shop, electronics store, bike shop, rooftop access door. No text, no readable signage. |
| buildings-b | 16-bit pixel-art isometric building facade sheet B. Items: warehouse wall, foundry door, subway entrance, tunnel mouth, rooftop unit, access panel, billboard back, walkway junction, loading dock, street clock. No text. |

## Prompt batch: power-ups
| job | prompt |
| --- | --- |
| consumables-a | 16-bit pixel-art power-up sprite sheet for arcade roguelite. Items: health syringe, armor plate, ammo box, speed boost, shield bubble, score multiplier token, mystery crate, one-up token. Grid sheet, clean icons, no text. |
| consumables-b | 16-bit pixel-art power-up sprite sheet extension. Items: cold storage key, gas mask, rail charge pack, hard fork upgrade, oracle lure, time slow, magnet pickup, coin stack, score flash token, rare drop crate. No text. |
| pickup-vfx | 16-bit pixel-art pickup attract and collect sprite sheet. Items: spin idle, attract rise, collect puff, sparkle trail, glow-out fade. No text, 4x4 contact sheet. |

## Prompt batch: roguelite UI / menus
Use a separate design tool pass for UI chrome/text legibility; these prompts are for structural concept art.

| job | prompt |
| --- | --- |
| main-menu | 16-bit retro arcade RPG main menu concept art. Central character slot, two cabinet choices, neon start button cluster, top bar, footer hint field. Strong color hierarchy, readable field placement, no actual readable text. |
| hud-top | 16-bit retro arcade RPG HUD top bar concept art. Health bar, armor bar, ammo counter, weapon slots, minimap frame, run timer, wallet ping. Panel shapes only, no text labels. |
| pause-panel | 16-bit retro arcade RPG pause/esc panel concept art. Resume, restart, cabinet, sound, save-and-exit slots. Clear button zones, no text. |
| run-select | 16-bit retro arcade RPG run select and upgrade picker concept art. Three card slots, cost field, reroll button, discard pile, finalize launch field. No text. |
| level-intro | 16-bit retro arcade RPG level intro banner and mission panel concept art. Title field, level tag, weather tag, risk tag, special modifier field. No text. |
| leaderboard | 16-bit retro arcade RPG leaderboard and achievement panel concept art. Top rows, avatar wells, rank block, badge tray, filter tabs. No text. |

## Prompt batch: sniper weapon feel (recoil / breath)
| job | prompt |
| --- | --- |
| sniper-recoil | 16-bit pixel-art sniper recoil and sway sprite sheet. Sway offset A/B, hold-breath wobble, zoom slide, recoil drop, dust kick. Isometric and clean background, no text, grid frames. |
| ammo-spent | 16-bit pixel-art spent casing and detents sprite sheet for sniper and rifle classes. Magazine out, detent latch, belt link, casing pile, no text, 4x4 grid. |

## QA rules before integration
- Use only text-free revisions for any asset shown in-game or in portal.
- Drop pseudo-text or accidental letters; re-run only the affected job rather than regenerating everything.
- Confirm sprite scale reads correctly against existing `sliced/` hero and enemy frames before accepting larger batches.

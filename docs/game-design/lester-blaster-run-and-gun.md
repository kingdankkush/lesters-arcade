# Hard Money Heroes — Infinite Run-and-Gun Spec

Note: this file kept its original `lester-blaster` filename for continuity, but the player-facing first-game title is now **Hard Money Heroes**.

## Genre

Metal Slug-inspired infinite side-scrolling shooter built around Lester and Litecoin arcade energy.

## Core run target

- Average player run: **~5 minutes**
- Veteran/master run: **15–20 minutes**
- Boss cadence: **every 3–5 minutes**
- Boss roster: **10 rotating bosses**
- Multiple playthroughs are required to see all bosses.

## Player verbs

- Move/run
- Jump
- Double jump
- Basic shooting
- Basic melee
- Grenade throw

## Pickups

- Grenade pickup
- Health pack
- Bonus life
- LTC cache
- Score multiplier

## Weapon upgrades

1. **Spread LTC**
   - wider cone shot
   - best for crowd control

2. **Hash Rail**
   - piercing heavy shot
   - best for bosses and armored enemies

## Difficulty scaling

The longer the player survives, the game increases:

- enemy AI aggression
- enemy spawn count
- enemy projectile speed
- boss battle frequency/intensity
- power-up scarcity
- health scarcity

The game decreases:

- bonus life chance
- health availability
- forgiveness windows

## Boss roster

1. Rug Pull Tank
2. FUD Copter
3. Gas Goblin Mech
4. Paper Hand Phantom
5. MEV Mantis
6. Bridge Wraith
7. Botnet Brute
8. Fiat Ogre
9. Oracle Hydra
10. Finality Dragon

## Current prototype

The browser prototype includes a canvas combat test:

- scrolling arcade background
- pixel-style Lester player
- jump/double-jump behavior
- shoot button
- melee button
- grenade button
- enemy spawning
- boss display window
- accelerating difficulty preview

This is not yet the final game; it is a vertical-slice sandbox for validating controls, game feel, and parent-account integration.

## Parent system integration

Every run is treated as a session owned by Lester's Arcade:

- free run: practice-only, no parent progress or records
- paid run: official score + transaction + achievement + leaderboard sync

The game itself should not own the account system. It should talk to Lester's Arcade as a child dapp cartridge.

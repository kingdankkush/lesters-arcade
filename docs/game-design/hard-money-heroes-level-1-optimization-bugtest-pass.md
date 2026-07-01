# Hard Money Heroes Level 1 Optimization + Bug Test Pass

Date: 2026-06-30

## Goal

Improve the Level 1 8-minute swarm curve after the first balance pass, then bug-test the runtime seams that can fail when the screen is dense with enemies, XP gems, power-ups, floating text, and VFX.

## Bugs found

### Liquidation Nuke could bypass the final boss extraction gate

The `screenNuke` power-up killed enemies through a separate code path:

- marked enemies dead
- called `killEnemy(enemy)` directly
- manually added a tiny XP gem
- wiped `combat.enemies = []`

That bypassed the new Level 1 final-boss proxy side effects. If the nuke killed the temporary boss proxy, the game could leave:

```text
combat.bossDefeated === false
combat.scriptedBossTriggered === true
```

That means extraction could stay blocked after the boss was dead.

## Fix

Added a shared roguelike death resolver in:

```text
apps/portal/main.js
```

```js
resolveRoguelikeEnemyDeath(enemy, options)
```

Now normal combat kills and screen-nuke kills both:

- call `killEnemy(enemy)`
- award XP through `calculateRoguelikeKillXp(...)`
- track kills by enemy type
- trigger rare/normal drops when allowed
- detect `enemy.finalBossProxy`
- set `combat.bossDefeated = true`
- release the boss scroll lock
- allow extraction to spawn

The nuke no longer wipes the enemy array directly before boss-gate side effects run.

## Optimization model added

Added Level 1-specific helpers in:

```text
apps/portal/src/arcade-core.mjs
```

```js
levelOneRoguelikePickupAssistAt({ elapsedSeconds, activeEnemies })
levelOneRoguelikePerformanceBudgetAt({ elapsedSeconds, activeEnemies, reduceMotion })
```

### Pickup assist

Late-game swarms require players to kite in circles. XP and drops now become easier to collect as the 8-minute wall approaches:

- XP attraction radius scales up
- XP attraction speed scales up
- XP TTL scales from `900` to `1260` frames
- power-up TTL scales from `720` to `900` frames
- loose XP gems cap at `180`
- loose power-ups cap at `42`

This keeps the fight-swarms loop rewarding without letting reward arrays grow forever.

### VFX/readability budget

The 8-minute wall can allow about 100 enemies, so visual spam is now capped:

- particle budget scales from `210` opening to `150` at wall
- floating text budget scales from `84` opening to `64` at wall
- hit sparks sample every third hit at the wall instead of every hit
- death bursts shrink to `0.62x` at the wall
- reduce-motion mode applies an additional `0.58x` visual budget

This is cosmetic-only and does not reduce damage, XP, coins, or enemy pressure.

## Runtime wiring

Updated:

```text
apps/portal/main.js
```

Wired the new helpers into:

- `updateParticles(...)`
- `updateFloatingTexts(...)`
- `damageEnemy(...)`
- `killEnemy(...)`
- `updateRoguelikeXpGems(...)`
- `spawnRoguelikePowerUp(...)`
- `updateRoguelikePowerUps(...)`
- `applyRoguelikePowerUp(...)` screen-nuke path

## Regression tests

Updated:

```text
tests/arcade-core.test.mjs
```

New tests assert:

- late-swarm pickup assist makes rewards more collectible
- loose XP/power-up caps prevent unbounded arrays
- late-swarm particle/text budgets cap visual spam
- reduce-motion lowers particle budgets further
- `main.js` contains a centralized death resolver
- screen nuke uses that resolver instead of directly wiping `combat.enemies`

## Remaining risks

- Still needs a hands-on feel pass for whether `150` particles and `64` texts are the right visual caps.
- The final boss proxy still uses enemy AI plus scaled stats; bespoke boss phases are still future work.
- Browser smoke catches startup/click/runtime errors, but not long-duration human combat feel.

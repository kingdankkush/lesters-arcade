# Hard Money Heroes Level 1 Playtest Balance Pass

Date: 2026-06-30

## Goal

Tune Level 1 for an 8-minute roguelike shooter session where difficulty clearly ramps, fighting swarms is rewarded, and extraction is gated behind temporary boss/miniboss enemies until bespoke boss art exists.

## Playtest bugs found

1. **Level 1 was still using the 20-minute survival-wall director.**
   - At 8:00 the old director only reached `pressure: 0.4`.
   - Result: the final minutes were too soft for the intended Level 1 endpoint.

2. **The live world was still `2000 x 2000`.**
   - Too large for a Level 1 map players should learn after ~4-5 sessions.
   - Also too large for the target of seeing roughly 50-65% of the map per run while circling and fighting.

3. **Normal kill rewards were too sparse.**
   - Normal enemies only attempted drops on one out of every twelve kills, then rolled a drop table.
   - This undercut the intended “fight swarms, level up, stay alive” loop.

4. **Level 1 had no true roguelike final boss hook.**
   - The existing boss function belongs to the old side-scroller combat path.
   - The isometric roguelike loop needed a boss proxy spawned as an enemy entity instead.

## New Level 1 balance model

Implemented in:

```text
apps/portal/src/arcade-core.mjs
```

Exports:

```js
HMH_LEVEL_ONE_PLAYTEST_BALANCE
buildLevelOnePlaytestBalanceModel()
buildLevelOneRunWorldDimensions()
levelOneRoguelikeSpawnDirectorAt(seconds)
levelOneRoguelikeDropChance({ elapsedSeconds, rare })
levelOneRoguelikeBossProxyRoster()
```

### Difficulty curve

| Time | Pressure | Spawn interval | Max enemies | Chase share | Ranged share | Elite share | Label |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 0:00 | 0.00 | 2.45s | 14 | 0.62 | 0.18 | 0.02 | opening |
| 2:00 | 0.25 | 1.98s | 36 | 0.65 | 0.21 | 0.07 | volatile |
| 4:00 | 0.50 | 1.51s | 57 | 0.68 | 0.24 | 0.13 | market-crash |
| 6:00 | 0.75 | 1.03s | 79 | 0.71 | 0.28 | 0.18 | panic |
| 8:00 | 1.00 | 0.56s | 100 | 0.74 | 0.31 | 0.24 | survival-wall |

Design intent:

- Late game gets dense and chase-heavy.
- Ranged share grows but stays capped below one-third so difficulty comes from swarms, not unavoidable bullet spam.
- Elite share ramps hard enough to make late kills valuable and dangerous.

### XP pacing probe

Automated probe over 8 minutes using existing enemy selection and kill XP:

| Kill rate | Kills | Resulting level |
| ---: | ---: | ---: |
| 8/min | 64 | Level 4 |
| 12/min | 96 | Level 5 |
| 16/min | 128 | Level 6 |
| 20/min | 160 | Level 7 |
| 24/min | 192 | Level 7, near Level 8 |

Design intent:

- Passive/running players reach only around Level 4.
- Active swarm fighters reach Level 7+, enough augments to survive the 6-8 minute wall.
- `grantRoguelikeXp` still pauses after one level-up, so a huge pack cannot chain multiple level-ups at once.

### Drops / Litecoin / power-ups

Normal enemy drops are now checked on every normal kill, scoped to Level 1:

| Time | Normal drop chance |
| --- | ---: |
| 0:00 | 16% |
| 4:00 | 24% |
| 8:00 | 32% |

Elite, mini-boss, and boss proxy kills still force rare drops.

Design intent:

- More LTC caches, shields, ammo, magnet, and other drops from actually fighting.
- Players who flee miss XP gems and drops, making later pressure harder.

### Map traversal size

Level 1 is now:

```text
1050 x 900
```

Traversal model:

```text
base speed: 4.15 tiles/sec
8-minute path budget: 1992 tiles
circle-kite/exploration efficiency: 0.32
expected unique traversal: ~637 tiles
expected map-axis coverage: 60.7%
```

This hits the requested 50-65% map exposure target.

## Temporary boss / mini-boss proxy roster

Until bespoke bosses exist, Level 1 uses fully animated humanoid-ish curated enemies:

| Role | Zone | Runtime enemy | Display title | Curated art basis |
| --- | --- | --- | --- | --- |
| Mini-boss | Ghost Saloon Main Street | `claim-jumper-sheriff` | Claim-Jumper Sheriff | `universal/enemy/claim-jumper` |
| Mini-boss | Dead Forest Mushroom Grove | `scam-cult-zealot` | Scam Cult Zealot Alpha | `universal/enemy/scam-cult-zealot` |
| Mini-boss | Warehouse / Gas Station Yard | `gas-beast` | Gas Beast Tank | `universal/enemy/gas-beast-tank` |
| Boss | Rugpull Gulch Boss Yard | `bandit-captain` | Bandit Captain | `universal/enemy/evil-banker-ranged` |

## Runtime wiring

Implemented in:

```text
apps/portal/main.js
```

Changes:

- Level 1 uses `levelOneRoguelikeSpawnDirectorAt()`.
- Level 1 world dimensions use `buildLevelOneRunWorldDimensions()`.
- Level 1 final boss proxy spawns at `bossSpawnSeconds` as a roguelike enemy entity.
- Extraction is blocked until the final boss proxy dies.
- Normal drops use Level 1-specific chance, while later levels keep old generic drop tuning.
- Start status copy no longer says “survive 20 minutes” for Level 1.

## Remaining playtest risks

1. This was an automated balance pass, not a human feel pass with hands on keyboard.
2. The `100` enemy cap at 8:00 may stress readability/performance on weaker machines. The gore/readability dampening systems should help, but browser profiling is still needed.
3. Final boss proxy uses normal enemy AI plus scaled HP/score. It is acceptable as a placeholder, but needs bespoke attack phases later.
4. POI triggers still depend on current authored district/POI runtime placement, so the curated world contract should be wired deeper into encounter placement next.

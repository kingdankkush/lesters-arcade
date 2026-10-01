# HMH-TEN-AREA-GAMEPLAY-WIRING — live district bosses, 2.0 enemies, cover and traversal

Branch `claude/200-gameplay-wiring`, based on integration `7d26c1880`, with
the boss registry commit `b2288bfb2` cherry-picked (`b682f6074`) and
integration `3b2028079` (district boss GLBs and 3D registration) merged in.

**Scope rule:** everything below is live only in the unofficial ten-area Free
world (`?mode=free&world=ten-area`, `HMH_WORLD_CONTEXT.official === false`).
The legacy Ranked world (`forked-frontier` v1, schema 6/7) runs the same code
with the same arguments; §6 is the proof.

## 1. Shape of the wiring

| Piece | Where | Initial bundle |
|---|---|---|
| `world-v2-combat.mjs` | new, reached only from `world-v2-runtime-context.mjs` (lazy) | no |
| `context.combat` | built once per ten-area page by `createWorldV2RuntimeContext` | no |
| `TEN_AREA_COMBAT` / `tenAreaRun` | two `main.mjs` bindings, `null` in the legacy world | call sites only |
| `registerEnemyArchetypes` / `findEnemyArchetype` | `enemy-archetypes.mjs`: an extension map, empty unless the ten-area world registers | yes (small) |
| `districtArchetypes` option | `encounter-director.mjs`: stands in for `ROLE_ARCHETYPES` in listed districts, `null` by default | yes (small) |
| whale charge | `enemy-simulation.mjs`: keys on `balanceSource ?? id` (legacy rows have no `balanceSource`) | yes (one expression) |

`main.mjs` never names the new module. Every ten-area call is `TEN_AREA_COMBAT?.x()`,
`tenAreaRun?.x()`, or a ternary whose legacy branch is the original expression.

## 2. District bosses live

- **Dispatch.** After the lazy runtime modules resolve, a ten-area page rebinds
  `stepLiquidatorBoss`, `applyLiquidatorDamage`, `isLiquidatorTargetable`,
  `getLiquidatorVulnerability`, `liquidatorPose`, `defeatBossSlot` and
  `dropGenesisSeal` through `combat.bossDispatch(...)`. A call for a district boss
  goes to its kit (`district-boss-kit.mjs` via `DISTRICT_BOSS_KITS`); a Liquidator
  call goes to the original function with the original arguments (tested).
  `resolveLiquidatorAttack` is already shape-generic and `getLiquidatorRoleCheck`
  is reused as is (multiplier ≤ 1.15, inside the kit's 1.25 cap).
- **One live boss.** `liquidatorBoss` (name kept: 153 tests pin `main.mjs` text)
  is the live slot's boss in the ten-area world (`activeWorldV2Boss`: the live
  slot, else the most recently started one so a death beat plays). Lock walls
  come from every slot (`closedWorldV2BossWalls`), so a court seals and its
  navigation patches like the Liquidator's floor; a restart reopens them.
- **Defeat.** The defeat block still names `'liquidator'` (the legacy map's only
  boss, and a verifier-pinned literal); the dispatch settles the live slot
  instead, and the following Seal drop lands on that court's pedestal
  (`dropCourtGenesisSeal`; the ten-area Liquidator drops on his floor's centre).
  Rewards, the court unlock (`rewards.opened` → navigation), the silver burst
  and the XP are the shared path.
- **Telegraphs.** The kits' tells use the boss geometry kit (lane, charge-lane,
  circle, ring, chain-link, panels, union); the existing
  `renderLiquidatorTelegraph` draws all of them.
- **HUD.** `bossHudState` already names the live boss; the DOM bar shows
  "Rug Pull Baron", "The 51% Foreman" or "The Lockkeeper". Accessible status
  lines for start, withdraw and defeat name the district boss.
- **Presentation.** Sprite: the Liquidator roster body, tinted and scaled per
  boss (`DISTRICT_BOSS_LOOK`: Baron 0xff7a6a ×0.98, Foreman 0xffb45a ×1.09,
  Lockkeeper 0x8fd99a ×1.00), posed on the Liquidator atlas's own phase
  silhouettes (the atlas knows only his phase ids). 3D (`actor3dPilot=1`): the
  live district boss goes to the controller's district-boss list (the 6th
  `updateGame` argument, never passed on the legacy path) with its own GLB
  (`boss-rug-pull-baron`, `boss-51-foreman`, `boss-lockkeeper`) and a ten-clip
  pose from `districtBoss3dPose`: `death`, `hit`, `stagger` (the ×1.25 window),
  `super-tell` / `tell` while a tell is pending, `attack` / `attack-2` / `super`
  for 30 ticks after a strike (the attack row's own `clip`), `run` while it
  moves, else `idle`. If a boss GLB is not resident the controller keeps the
  sprite.

## 3. New enemies spawn

- `createWorldV2Combat` registers runtime rows of the six 2.0 archetypes
  (`WORLD_V2_NEW_ENEMY_RUNTIME`: the 2.0 table verbatim, with
  `visual.productionComplete: true` and `runtimePresentation: 'sprite-fallback'`
  so the shared insertion gate admits them; the source table keeps `false` for
  the art review).
- Per-area pools (`WORLD_V2_DISTRICT_ARCHETYPES`) reach `stepEncounterDirector`
  as `districtArchetypes`; areas whose tier gate lacks the role gain it
  (`WORLD_V2_EXTRA_ROLES`); the encounter bands still gate by time:

| Area (tier) | Role pool | First band |
|---|---|---|
| Litecoin City (2) | flanker: Rug Puller, Forkrunner; demolition (+): Money Printer, Gas Bomber | opening / pressure |
| Rugpull Woods (3) | flanker: Rug Puller, Forkrunner | opening |
| Halving Farms (2) | bruiser (+): Pump-and-Dump Bloater | pressure |
| Scrypt Bayou (3) | bruiser (+): Bloater, Whale Enforcer | pressure |
| Hashwood River (3, bridges) | bruiser (+): Tollkeeper | pressure |
| Fork Fortress (5) | bruiser: Tollkeeper, Whale Enforcer | pressure |
| Hollow Pines (4) | rusher: HODL Revenant, Bagholder | opening |
| Ledger Ridge (4) | suppressor: Oracle Marksman, Liquidator Agent | build |
| MWEB Meadows (1), Silver Coast (2) | legacy roster | — |

- Simulation: the same insertion, movement, token, attack and damage paths;
  stats are the declared balance source's; Bloater and Tollkeeper charge like
  the Whale Enforcer.
- Sprites: `createRosterOrVectorDisplay` draws a 2.0 enemy with its declared
  legacy roster sprite and tint; the display pool keys it per id and atlas
  readiness. 3D: the six ids are already in `ACTOR3D_ENEMY_IDS`, so
  `actor3dPilot=1` loads their GLBs by archetype id.

## 4. Cover + traversal live (HMH-COVER-TRAVERSAL-V1 §3.2)

| Step | Wiring |
|---|---|
| A | a dodge is refused while a mantle or landing runs; out of cover a neutral-stick dodge rolls along `coverState.facing` |
| B, C | after `stepDash`: `tenAreaRun.step` runs `stepTraversal`, then `stepCover` unless locked, on the pre-movement hero; move is zeroed during a dash (a dash never triggers a ledge) and a dash start rolls out of cover |
| D | `else if (tenAreaStep?.position)`: no free movement, no sweeps, velocities zeroed, ground re-read only on `drop` / `mantle-complete` / `land-complete`; enemies still yield to a covered hero |
| E | an authored `oneWayDrop` (`lastTraversal.dropped`) calls `landRecovery` |
| F | `actor.locomotion` is `cover`, `mantling` or `landing` when held |
| G | `invulnerable: playerInvulnerable \|\| tenAreaRun?.meleeInvulnerable(event) === true` (melee-circle, shove-lane only) |
| H | `playerInCover` stays unread (later AI slice) |
| I, J | enemy and boss damage on the hero pass `applyCoverToDamage` with the attacker's origin |
| K | `heroClip(tick)` → named library clip into `updateGame` (`clip`, `clipTick`); `drawPrompts` rings |

- **Faces:** `coverFaceIndex(world.collisionBlockers)`: 124 faces (80 tall, 44
  short) from the 31 `cover-tall` / `cover-short` blockers.
- **Markers:** the greybox `climb-marker` / `drop-marker` pieces carry a zone but
  no direction or heights. `deriveWorldV2TraversalMarkers` completes each one
  from the ground: the zone's short axis crosses the edge, the side that falls
  ≥ 24 to flat walkable ground is the low side, the trigger strip (40 deep, 6
  off the edge) sits on the low side for a climb and on the deck for a drop,
  travel 96, and every landing from the strip's corners and mid-lines must be
  clear ground at the far height. 12 of 20 qualify (climbs: Fortress, Farms,
  Pines, Ridge, City, Meadows, Woods, Coast; drops: Farms, City, Meadows,
  Coast). The other 8 sit on a ramp, water or a lip with no 24-unit fall and
  are left out (`rejectedTraversalMarkers`).
- **Clips:** `cover-enter-tall/short`, `cover-idle-tall-l/r`, `cover-idle-short`,
  `cover-shuffle-l/r`, `cover-peek-fire-l/r`, `cover-popup-fire`,
  `cover-blind-fire`, `cover-reload`, `cover-hit`, `cover-leave-step/run/roll`,
  `mantle`, `drop`, `land`; enter, leave and drop are held as one-shots.
- **Prompt ring:** a small pulsing ground ring (cyan for cover, gold for a
  ledge) on the cover spot within 72 units of any enterable face, or on the
  ledge strip within 64 units; nothing while in cover or mid-transition.

## 5. Tests and evidence

- `tests/hmh-ten-area-gameplay-wiring.test.mjs` (16): the pinned legacy
  selection digest; the legacy table; spawn selection per area and band; a
  director-inserted Revenant and a Tollkeeper through insertion, movement,
  tokens and attack; sprite fallbacks; per boss: court after the ready tick →
  spawn → damage → both phases → death → Seal on the court pedestal → court
  unlock, with the 3D pose walking idle / tell / super-tell / strike clips;
  seed determinism; the Liquidator dispatch pass-through; one live boss; faces
  and markers; cover enter / blind fire / roll / step and ×0.4 damage; mantle
  18 ticks with melee refused, drop with 6 landing ticks; prompts and clips
  read-only; evidence spawns.
- `tests/hmh-ten-area-real-child.test.mjs` (3): the real child headless on the
  ten-area page through `scripts/hmh-ten-area-wiring-probe.mjs`: cover, the
  Baron's full fight, and the Meadows mantle + drop.
- Receipts `docs/2.0/receipts/gameplay-wiring-20260930/real-child-*.json`:

| Scenario | Result |
|---|---|
| court:rug-pull-baron | live 120, sealed 120, 3 phases, dead 3,656, court open, Seal at 6,600 / 12,650 |
| court:fifty-one-percent-foreman | live 120, 3 phases, dead 6,831, court open, Seal at 12,600 / 2,250 |
| court:lockkeeper | live 120, 3 phases, dead 5,388 (orbit 480: 2,523), court open, Seal at 1,550 / 12,250 |
| cover-under-boss-fire | held in Bayou cover at orbit 480: since the reach fix (§9) the Lockkeeper walks to where he can see the hero, so all 9 hits come from the open side, unreduced. (Before the fix he stood inside the tall screen and 14 of 16 hits were cut to 60%.) |
| field-cover | Free entry, no evidence: walked to the Meadows court wall, 18 open-side hits unreduced (rule) |
| ledge | Meadows climb: 1 mantle (18 ticks), 1 drop (6 landing ticks) |

- Browser (headless Chrome, under the heavy lock, built child):
  `scripts/hmh-ten-area-wiring-browser.mjs`, receipt `browser-receipt.json`, no
  page errors in any scenario:

| Screenshot | Shows |
|---|---|
| `court-rug-pull-baron-3d-fight.jpg`, `-fight-later.jpg` | walked into the Hashwood River court: bar "RUG PULL BARON // GRAND OPENING", the Baron's own GLB (top hat, cane) in his tell with the Cane Thrust lane on the hero (`actor3dPilot=1`, 2 actors) |
| `court-rug-pull-baron-sprite-fight.jpg` | the same fight on the sprite path: the Liquidator body tinted red |
| `court-51-foreman-sprite-fight.jpg` | "THE 51% FOREMAN // SHIFT START", Hash Cannon lane, orange-tinted body |
| `cover-tall-prompt-ring.jpg` | the cyan prompt ring at the Meadows court wall |
| `cover-tall-entered-in-cover.jpg` | the hero in tall cover, back to the wall (`cover-idle-r`, 3D hero clip `cover-idle-tall-r`) |

## 6. Legacy identity proof

1. **Real child, 128 runs.** `scripts/hmh-honest-corpus` full plan (all
   styles, entries, heroes; 1,933,648 ticks, longest 41,960) on the base
   `b682f6074` and again on this branch after the main wiring and after the
   harness change, and again on the final head: 128 / 128 runs identical in every emitted field (frames,
   final tick, run events, run summary, score result, game-over, upgrade log,
   pilot statistics, health, errors). Corpus digest
   `e6464972404f07e22acce6859163b55cfe72fc7efe618515a90f713d330cb101` both times.
2. **Legacy Liquidator fight.** `?boss=1` Free on the legacy map (the Liquidator
   from tick 1, 7,510 ticks to game over) on an archive of integration
   `3b2028079` and on this branch: identical digest
   `6cfb17555d1e7be4ee59c518a2130ef9701dc084e15176daae624fee89210d24` over every
   child message.
3. **Selection digest.** 86,400 legacy director picks hash to
   `e08fd02a…2004f` before and after (pinned in the test).
4. **Source pins.** `main.mjs` keeps every verifier- and test-pinned literal
   (the defeat block, `ENEMY_ARCHETYPES[...]` threat cost, the restart loop, the
   evidence spawn line, the roster factory); `server/verify` is untouched;
   `tests/hmh-world-v2-verifier-freeze.test.mjs` passes.
5. Three tests were updated for intended ten-area facts: the 2.0 table now has
   one lazy importer (`world-v2-combat.mjs`); the ten-area role-gate tier order
   is checked on the tier roles (the hosted roles are listed); no legacy
   assertion changed.

## 7. Bytes

`node build.mjs`: HMH initial + shared **996,019 B** against the 1,048,576 B cap
(52,557 B headroom). The merged integration base (`3b2028079`, built from an
archive) is 993,366 B, so the slice adds **2,653 B** (entry +2,373, shared
+280): the null-guarded call sites in `main.mjs` and the small default-off
seams. Everything else (bosses dispatch, archetype rows, markers, cover and
traversal rules, clips, prompts) is in the lazy ten-area chunk.

## 8. Open items

- Peek exposure, lean distance, boss pressure in cover, touch aim: unchanged
  open questions 1, 2, 5 and 6 of HMH-COVER-TRAVERSAL-V1.
- 8 greybox markers do not describe a usable ledge; the greybox kit should
  carry direction and heights (§5 of the cover slice) so they can be authored.
- The district bosses have no adds and their arena hooks (`arena:*`) are not
  bound to props yet.
- No run summary row records cover, traversal or district bosses (the ten-area
  world records no run summary); schema 8 stays a proposal.
- Balance: the 2.0 enemies are `balancePending`; Bloater, Tollkeeper and
  Money Printer only appear from the pressure band (18,000 ticks).

## 9. Fix: a district boss out of the hero's reach (pre-release)

**Symptom.** With the probe orbiting the Bayou court at radius 480 the
Lockkeeper fight stalled: his health stopped moving while the hero lived.

**Cause** (reproduced with `HMH_PROBE_DEBUG=1 HMH_PROBE_ORBIT=480 node
scripts/hmh-ten-area-wiring-probe.mjs court:lockkeeper`, then at the kit level
with a stationary hero):

1. Every third attack the boss retreats to the court mark *farthest* from the
   hero. Courts are 1,800 square, so that mark is often 900 to 1,300 away,
   beyond the hero's 720 automatic aim. Outside the last phase he never
   approaches, so a hero holding a spot (in cover, or pinned on the low stack)
   never got a shot.
2. District bosses swept only against the court locks, so a boss walking
   toward the hero went straight through props and could park inside one: the
   Lockkeeper stood inside `scrypt-bayou-court-tall-screen`, where no shot
   reaches him.

**Fix** (district kit and ten-area dispatch only; the Liquidator and the legacy
map are untouched):

- `retreatMark` replaces `farthestMark`: the farthest mark within
  `DISTRICT_BOSS_ENGAGE_RANGE` (600) of the hero that the hero can see, else
  the farthest in range, else the nearest.
- When an action comes due and he is beyond 660, or screened from the hero
  and beyond 280, he closes in first. He walks to the nearest vantage point on
  rings of 360 and 240 around the hero that is inside the court, clear for his
  body and in the hero's sight, preferring a straight walk. With no vantage
  point he walks straight at the hero to 480 (in sight) or 220.
- The ten-area dispatch passes the world's collision list to the kit for
  movement (he walks around props) and for sight (`sightBlockers`). Called
  without it, the kit behaves as before apart from the 600 retreat cap and
  the closing step. `tests/hmh-district-bosses.test.mjs` is green.

**Consequence.** A boss now walks to where he can see a hero hiding in cover,
which is the open side, so cover does not cut his damage there. That follows
the cover rules: cover protects from the wall side. Enemy flanking AI is
still deferred.

**Evidence.**

- Regression test (in `hmh-ten-area-gameplay-wiring.test.mjs`): a
  stationary hero at the centre and four corners of each court. Over 6,000
  ticks the boss is never out of a clear 720 shot for more than 900 ticks in a
  row, and is in reach at least half the time. Before the fix this fails
  (Baron from 5,860 / 11,910 and Lockkeeper from 810 / 11,510: 6,001 ticks out
  of reach).
- Real child, orbit 480 and 300, all three courts: every fight ends. Baron
  4,805 / 3,656; Lockkeeper 2,523 / 5,388; Foreman 6,831 at 300, and at 480 the
  hero dies at boss HP 51 (a lost fight, steady damage, no stall). Legacy
  corpus 128 / 128 identical, digest `e6464972…cb101`; legacy `?boss=1`
  Liquidator digest `6cfb1755…10d24`. Initial + shared bundle unchanged at
  996,019 B.

# HMH-BOSSES-2-4 — the Rug Pull Baron, the 51% Foreman and the Lockkeeper

Status: **simulation checkpoint green; art WIP.** The three district bosses of the ten-area world exist as deterministic modules, are registered in the ten-area world's gameplay table only, and are covered by `tests/hmh-district-bosses.test.mjs`. The shipped Level 1 map, `boss-arenas.mjs`, `boss-drops.mjs` and the legacy verifier (`server/verify/hmh.mjs`, `HMH_BOSS_ID = 'boss-liquidator'`) are byte-identical to `7cac31fa9`, and a test proves the legacy map never spawns them. Runtime GLBs, reimport receipts and the contact sheet are not accepted yet (see "Art status").

Brief: `docs/handoffs/lesters-arcade-2.0-visual-overhaul-handoff-20260929.md` §2.6; area briefs 05 (Scrypt Bayou), 06 (Hashwood River), 09 (Fork Fortress); pilot: the Liquidator (`liquidator-boss.mjs`, `docs/2.0/receipts/the-liquidator-glb-reimport.json`).

## 1. Casting

The owner's read-only Tripo models under `LestersArcade-Assets\*.glb` were inspected (SHA-256, triangles, rigging, textures) and rendered front/side/back. Findings that drove the cast:

- Every owner GLB is a **static, unrigged** Tripo mesh of ~470–500k triangles; none carries a skin or animation.
- The "part" models (`heavy armor suit`, `dark armored warrior`, `armored warrior`, `armored soldier (2)`, `post apocalyptic warrior`, `military minigun`, …) have **no textures and no vertex colours** (grey clay, one flat material).
- Several textured models are **three-view turnaround sheets modelled as one mesh** (three standing figures plus detail heads): `armored soldier` (the Whiteout Armored Mercenary sheet), `armored soldier (1)` (the Rugged Riot Enforcer sheet), `military character`, `female combatant`.
- `battered zombie warrior`, `military action figure`, `fantasy character` and `military mascot` are already the Bagholder, Commando, Lilly and Lester bodies.

The 18 reference sheets in `Enemy and Boss References` were viewed. The boss sheets are: the 51% Foreman (bearded industrial giant, pie-chart plate, furnace pack, steam hammer; ~1.7× human on its scale silhouette), the Rug Pull Baron (ringmaster in a red velvet coat, top hat, whip/cane, carpet cape, two pistols) and the Lockkeeper (mossy long coat, wide hat, great key, padlocks, chains, hand-crank winch). The other fifteen are the six new ordinary enemies (ENEMIES lane).

| Boss | Cast owner model | SHA-256 | Source triangles | Body budget | Model height | Scale vs hero (2.1 m) |
| --- | --- | --- | --- | --- | --- | --- |
| Rug Pull Baron (`boss-rug-pull-baron`) | `military soldier 3d model.glb` (single textured figure) | `0cbc32bd…2044c2` | 491,054 | 15,000 | 2.25 m | 1.07× |
| The 51% Foreman (`boss-51-foreman`) | `armored soldier 3d model.glb`, front figure of the Whiteout sheet; prop `military minigun 3d model.glb` (`a9b38654…fb5188`, 470,880 tris → 1,600) | `10c589cb…f35509c` | 480,424 | 15,000 | 2.50 m | 1.19× |
| The Lockkeeper (`boss-lockkeeper`) | `armored soldier 3d model (1).glb`, front figure of the Riot Enforcer sheet | `2aa5a15c…299ef47` | 485,447 | 15,000 | 2.30 m | 1.10× |

All three read as large humans (one zombie: the Lockkeeper, identity form `zombie` through his mossy cloak and stoop). Role identity comes from authored gear on the shared rig: top hat, epaulettes, long red coat, cane, whip coil and holsters (Baron); hard hat and lamp, furnace pack, hazard plates, steam hammer, the owner's minigun on the left forearm (Foreman); wide hat, moss cloak, chest chains and padlocks, the great key, the shoulder winch drum with crank (Lockkeeper). Full owner-model bytes are never copied into Git.

## 2. Action sets (three phases each)

Phases sit at the v7 contract thresholds (`sdk/hmh-run-contract-v7.mjs`): Baron `[0.6, 0.25]` over 90 s, Foreman `[0.65, 0.3]` over 120 s, Lockkeeper `[0.65, 0.3]` over 105 s. Every boss: untargetable intro, a 90-tick invulnerable halt on each threshold (overshoot clamped, pending tells cleared, the super as the phase opener), walks to the arena mark farthest from the hero after every third attack, steers at the hero in the last phase, loops an endless cycle after its stall budget. Every tell locks one boss-geometry-kit shape and obeys the walk-escape rule `tell >= ceil((clear + 24) / 4) + 12` (tested from three floor positions per attack). A super leaves the boss **staggered** for 90 ticks at ×1.25 damage (the punish window). Damage uses the Liquidator conventions (`boss-reference-dps.mjs` HP freeze through `hmhV7BossHp`, role multiplier ≤ 1.15, combined cap ×1.25, no environmental killing blow).

Clip names in brackets are the GLB clips: `idle`, `run`, `tell`, `attack`, `attack-2`, `super-tell`, `super`, `hit`, `stagger`, `death`.

### Rug Pull Baron — Hashwood River marquee clearing (intro 120)

| Phase | Tells and attacks |
| --- | --- |
| 0 `grand-opening` | **Cane Thrust** [tell/attack]: lane 60 wide at the hero, tell 40, 12 dmg. **Whip Crack** [tell/attack-2]: 120 disk on the hero's spot, tell 54, 14 dmg. |
| 1 `the-rug-pull` | adds **Rug Pull** [attack-2]: 90-wide charge lane, the Baron dashes along it (a dash into a lock staggers him), tell 60, 16 dmg, 40 knockback. |
| 2 `curtain-call` | Cane Thrust fires twice (centre lane, then a ±10° fan 16 ticks later); he steers at the hero between tells. |
| Super | **Marquee Collapse** [super-tell/super]: the canvas section above the hero drops, a 420 disk locked at the tell (walk 123 ≤ 150), 26 dmg; first at +900, repeats every 1,200. Phase opener for phases 1 and 2. |

Arena hook: `arena:marquee-collapse` `{ bossId, attackId, telegraphId, tick, phaseId, ordinal, geometry, section, posts, stage, bossX, bossY }` on the super's resolve tick. The world binds the marquee canvas drop, dust and post sway to it later; nothing in the simulation moves a prop or changes collision.

### The 51% Foreman — Fork Fortress keep work court (intro 150)

| Phase | Tells and attacks |
| --- | --- |
| 0 `shift-start` | **Hammer Slam** [tell/attack]: 130 disk on himself (melee, chosen under 200), tell 50, 18 dmg, 40 knockback. **Hash Cannon** [attack-2]: 64-wide lane from the forearm minigun, tell 48, 12 dmg. |
| 1 `overtime` | Hash Cannon fans (centre lane, then a ±11° pair 18 ticks later); adds **Quarry Charge** [attack-2]: 80-wide charge lane with a dash, tell 42, 16 dmg. |
| 2 `majority-rule` | steers at the hero between tells. |
| Super | **Machinery Cycle** [super-tell/super]: the four quarry presses fire column by column (450-wide columns, 24 ticks apart, one seeded safe row per column moving at most one row between neighbours), tell 140 (sideways escape 131), 18 dmg; first at +1,080, repeats every 1,500. |

Arena hook: `arena:machinery-cycle` per column `{ …, geometry (panels), column, safeRow, columns, rows, sequence, stage }`.

### The Lockkeeper — Scrypt Bayou lock court (intro 120)

| Phase | Tells and attacks |
| --- | --- |
| 0 `high-water` | **Key Sweep** [tell/attack]: ring 40–150 around him (melee, chosen under 190), tell 50, 14 dmg. **Chain Lash** [attack-2]: chain-link 56 wide from him past the hero (≤ 560), tell 44, 12 dmg, 30 knockback. |
| 1 `lock-down` | adds **Lock Down** [attack-2]: two 104 padlock seals stamped along the hero's movement line 18 ticks apart, tell 56, 14 dmg. |
| 2 `drained` | Lock Down stamps three seals; he steers at the hero between tells. |
| Super | **Winch** [super-tell/super]: the gate chains sweep a 480 disk around the drum on his shoulder, tell 140 (walk 138), 24 dmg; first at +960, repeats every 1,300. |

Arena hook: `arena:winch` `{ …, geometry (circle), drum, decks, pullUnitsPerTick (1.5 + 0.5 × phase), stage }`. The world may bind the gate, the drum and a footing pull to it later; the simulation applies no pull.

### Hit, stagger and death

`hit` uses the roster damage responses (Baron `snapback-stumble-v1`, Foreman `armored-shoulder-absorb-v1`, Lockkeeper `staff-braced-shock-v1`); `stagger` is a three-frame reel and knee-bent recovery; `death` is the four-frame roster collapse. Death emits one `game:run-event boss-defeated` (`bossId` = target id), the slot pays the contract `silverBurst`/unlock objective, and the court drops its Genesis Seal at the court pedestal (`dropCourtGenesisSeal`, `boss-drops.mjs` rules unchanged).

## 3. Registry (ten-area world only)

- `apps/hmh-reboot/src/district-boss-kit.mjs` — the shared engine (`defineDistrictBoss`, `createDistrictBoss`, `stepDistrictBoss`, `applyDistrictBossDamage`, `resolveDistrictBossAttack` = the Liquidator resolver, `bindDistrictBoss`).
- `rug-pull-baron-boss.mjs`, `fifty-one-foreman-boss.mjs`, `lockkeeper-boss.mjs` — pure data plus each boss's `strikes` function; v7 boss ids `rug-pull-baron`, `fifty-one-percent-foreman`, `lockkeeper`; target ids `boss-rug-pull-baron`, `boss-51-foreman`, `boss-lockkeeper`.
- `boss-courts-world-v1.mjs` — `DISTRICT_COURT_LAYOUTS` (each court relative to its centre: 1,800 square, two exit locks, marks, hook sites, pedestal, threshold disk, retreat) and `createDistrictCourt(bossId, { centre, id })`; the greybox reference courts `WORLD_V1_DISTRICT_COURTS` (`hashwood-river-court` 6,600/12,650; `scrypt-bayou-court` 1,550/12,250; `fork-fortress-court` 12,600/2,250) and `dropCourtGenesisSeal`.
- `boss-slots.mjs` — keeps the W4a mechanism: `createBossSlots({ seed, definitions })` takes the run world's boss table. `createDistrictBossDefinition(kit, court)` builds a district row (court as the only arena, threshold trigger at the contract `readyTick`, one retreat ring, `create` factory), `DISTRICT_BOSS_KITS` and the reference table `WORLD_V1_BOSS_DEFINITIONS` are exported; the default `BOSS_DEFINITIONS` still holds only the Liquidator. Every step reads the slot's own definition and loops every slot, so the single Liquidator slot behaves exactly as before (existing suites green). One boss lives at a time; locks, retreat, rewards and the v7 `bosses` rows go through the existing lifecycle.
- `world-v2-gameplay.mjs` (lazy, W4a) — the ten-area table now registers all four bosses: the Liquidator on his exchange floor plus the three district rows on courts placed on the world's own `encounterArenas` anchors (`createWorldV2DistrictCourts`), with a retreat ring row per court in `missionBossZones`, the court exit locks appended to `bossLockBlockers`, and `stubbedBosses` empty. `main.mjs` already passes this table through `createBossSlots({ definitions })`, so a hero crossing a court threshold at or after the ready tick initiates the district boss and seals the court. **Runtime gap:** `main.mjs` still steps, damages and resolves only `bossSlots.slots.liquidator.boss`; a live district boss is not yet stepped by the fixed tick. Binding the district engine into the runtime (and the telegraph/HUD presentation for the new shapes) is the next slice and touches the initial bundle, so it is deliberately not in this checkpoint.
- Initial/shared JS growth: zero. Every module above is reached only through `main.mjs`'s dynamic `import('./boss-slots.mjs')`; `boss-arenas.mjs` and `boss-drops.mjs` were left untouched so nothing statically imported changes.

Deferred to later slices: binding the courts' threshold to the world-v1 runtime (`greybox-playtest.mjs` only labels arenas today), the HUD/telegraph renderers for the new shapes (the Liquidator telegraph renderer draws lane/circle/panels/safe-zones already), arena prop animation for the three hooks, adds/summons for district bosses, and elite waves.

## 4. Art pipeline and status

Producer tooling (boss-specific files, no shared exporter edits, so the ENEMIES lane's files do not conflict):

- `scripts/hmh-blender/hmh_boss_poses.py` — the ten boss clips on the roster's `_Pose` vocabulary.
- `scripts/hmh-blender/build-hmh-boss-native.py` — imports the owner GLB (hash-checked), keeps the standing front figure of a sheet model, decimates to 15,000, grounds/centres/scales to the boss height, fits the 19-bone native rig (`root, pelvis, spine, chest, neck, head, upper_arm/forearm/hand ×2, thigh/shin/foot ×2, weapon_socket` under `forearm.R`) to measured landmarks, binds gated nearest-segment weights (Blender's bone heat fails outright on decimated Tripo shells), re-rests the limbs onto the shared roster skeleton directions so `hmh_enemy_poses.BONE_REST` retargets exactly, adds the gear and garment, authors the clips and saves a private `.blend` + `source-receipt.json` under `.tmp/hmh-boss-native/<boss-id>/`.
- `scripts/hmh-blender/export-hmh-boss-glb.py` — one body primitive (textures ≤ 1,024) plus one packed costume primitive (palette atlas: base colour, metallic-roughness, emission cells; no Cycles bake), muted NLA clip tracks with the foot-grounding root, ≤ 30,000 triangles, ≤ 8.5 MB, to `apps/portal/assets/generated/hmh-actor-3d-pilot/<boss-id>.glb`.
- `scripts/hmh-blender/verify-hmh-boss-glb.py` — reimport, five-fraction bounds per clip, native foot residual, and (`--render`, under the heavy lock) the 55° fit renders that the contact sheet is built from.

Status per boss:

| Boss | Source build | GLB | Reimport receipt | Fit review |
| --- | --- | --- | --- | --- |
| Rug Pull Baron | built (12,522 body vertices, 25 gear meshes, coat) | exported, 5,264,004 B, 19,727 tris, 10 clips, foot residual 6e-7 m | private only | **rejected**: the coat garment reads oversized and the palette atlas renders black in the fit pass; the fit camera crops the head. Fixes queued: coat scale 0.95, palette PNG save-before-pack, ortho scale 2.2× height. |
| 51% Foreman | not built | — | — | — |
| Lockkeeper | not built | — | — | — |

No boss GLB, manifest or reimport receipt is committed on the green checkpoint. The Baron's WIP export travels on the WIP commit only. `.blend` sources stay out of Git (archive copy to `LestersArcade-Assets\2.0\Source\Legacy-Integration-04366747\…\native-enemies\<boss-id>\` with SHA-256 receipts is part of the acceptance step, not done yet).

## 5. Tests

`node --test tests/hmh-district-bosses.test.mjs` (18 tests): per boss — same-seed timeline hash equality and a different seed differing, every tell a fair walk-escape window and resolving exactly `tellTicks` later, phase transitions with halt/cleared tells/super opener, the super's arena hook and ×1.25 stagger, death run event and court Seal; plus the registry split, the court threshold trigger with contract HP and v7 rows, and the legacy-map/verifier proof. Together with the existing boss suites (`hmh-boss-slots`, `hmh-boss-determinism`, `hmh-genesis-seal*`, `hmh-boss-geometry`, `hmh-reboot-liquidator-*`, `hmh-boss-balance-pass`, `hmh-boss-summary-damage`, `server-verify-hmh-plausibility`): 153 pass, 0 fail. `node scripts/syntax-check.mjs`: pass.

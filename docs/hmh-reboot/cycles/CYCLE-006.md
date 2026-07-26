# HMH AAA Continuous Improvement Cycle 006

Date: 2026-07-25
Status: `LOCAL GATES PASSED · PREVIEW VERIFICATION PENDING · PRODUCTION UNTOUCHED`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `a8ead9b8`

## Objective

Author real character art for the enemy roster and the boss. Cycle 005 replaced
the placeholder player with the certified hero atlas; this cycle closes the
same gap for everything the player shoots at. All six enemy families and the
Liquidator were procedural vector shapes drawn from `Graphics` primitives, and
the boss had no art of its own — `resolveBossPose` proxied whale-enforcer poses.

## Preserved invariants

- Projection-only. Collision radius, damage, AI, spawn order, RNG, progression
  and results all continue to come from `enemy-archetypes.mjs`; nothing is
  derived from atlas metadata. A test strips comments from the new module and
  asserts it contains no gameplay vocabulary.
- Every actor reads as a human survivor or a zombie, per `AGENTS.md` canon.
  Enforced by a test over `identityForm`.
- Fixed 60 Hz, four catch-up steps, `hmh-bridge/v1`, save schema 2, parent
  authority — unchanged. `SETTLEMENT_LIVE` remains false.

## The pipeline

A second Blender pipeline mirroring the certified hero one:

- `apps/hmh-reboot/assets/source/blender/hmh-enemy-roster.json` — manifest.
- `scripts/hmh-blender/create-hmh-enemy-roster.py` — one parametric humanoid
  rig; identity comes from `build` proportions, `palette`, and a single
  silhouette prop per family.
- `scripts/hmh-blender/export-hmh-enemy-roster.py` — authored poses for every
  required visual state across eight compass directions.
- `scripts/run-hmh-enemy-roster-pipeline.py` — orchestrator, trimmer,
  shelf-packer, contact-sheet writer. Blender 5.1.2 pinned and version-checked.

Output: 7 actors x 152 frames = 1,064 frames, 4.13 MB of atlases. Every frame
is pixel-unique per actor, so no state is a silent duplicate of another.

Two render passes were needed. The first framed the actors too small, blew the
accent materials to near-white, and clipped the boss. Lighting was dropped
(key 620 -> 330, fill 210 -> 120, rim 320 -> 190), emission cut (1.6 -> 0.55),
the camera tightened (ortho 2.9 -> 2.15) and re-aimed at torso height, and the
boss given its own ortho scale of 3.1.

## Runtime wiring

`apps/hmh-reboot/src/enemy-roster-atlas.mjs` indexes metadata and builds the
display. `main.mjs` requests each archetype's atlas on demand, asynchronously,
and rebuilds live bodies when it resolves. The boss display is swapped for its
own authored crown-rig silhouette instead of proxying a whale-enforcer.

Carrying forward the lessons from cycle 005: boot never blocks on art (that
blew the parent's 8 s bridge timeout), the vector projection remains the
fallback, and art telemetry reports what actually rendered
(`dataset.enemyArt`, `dataset.bossArt`, `dataset.enemyRosterLoaded`,
`dataset.enemyRosterError`). `?vectorEnemies=1` forces the old art for
comparison.

## Release gates

- `npm run check` — 319 JS modules + 40 Python scripts pass. (The Blender
  scene/export scripts under `scripts/hmh-blender/` are outside the checker's
  scan set, as the existing hero pipeline scripts already are.)
- `npm run test:release` — `PASS tests=1671 passed=1619 expected_failures=52`,
  zero unexpected (+9 over cycle 005).
- `npm run build` — bundle 980,423 bytes, under the 1,050,000 gate.
- `npm run visual:reboot` — 8 scenes; baselines re-accepted after inspecting
  the PNGs. Three baselines moved, not one: `combat-engaged-desktop` (enemies
  now render as authored sprites) plus `frontier-relay-desktop` and
  `frontier-relay-mobile`. An earlier draft of this ledger claimed only one
  scene changed; review caught that, and the extra deltas were traced to the
  oversized-sprite defect described below, which is now fixed.
- `assets:qa:hmh-reboot` pass; `design:security-audit` 5/5 zero findings;
  `design:web3-audit` 9/9; `repo:health:strict`; `docs:links` — all pass.
- Chrome five-viewport certification clean; six portal E2E flows pass;
  performance and cockpit smokes clean.
- Enemy, director/boss, combat soaks and projectile fuzz all exit 0.
- In-browser evidence captured at `.tmp/art-review/enemy-roster-ingame.png`
  showing authored enemy bodies rendering in a live run with zero console
  errors and 200s on the roster atlas requests.

## Independent review

The staged index was reviewed adversarially. Verdict: **BLOCK**, five items,
all fixed before commit. None compromised simulation authority — the
projection-only contract held throughout — but three were user-visible art
defects:

1. **Enemy facing was mirrored.** `enemy-roster-atlas.mjs` reused the
   manifest's own compass ordering as the simulation heading index, which
   mirrors the certified `DIRECTION_BY_SIMULATION_INDEX` about index 1. Six of
   eight headings faced the wrong way and turning right on screen turned the
   sprite left. Fixed by adopting the hero mapping verbatim; the test now
   asserts the two modules agree rather than asserting the roster against
   itself.
2. **Sprites rendered ~2.4x oversized.** `renderWorld` overwrites
   `scale.set(camera.zoom)` every frame, which nullified
   `ENEMY_ROSTER_RUNTIME_SCALE` and `BOSS_ROSTER_RUNTIME_SCALE` entirely —
   trash mobs rendered larger than the vector art they replaced and the boss
   lost its size advantage. Displays now carry `rosterScale` and the render
   pass multiplies by it, matching the hero path.
3. **Unbounded per-frame retry.** The boss atlas request is issued from the
   render path and the error handler cleared the request guard, so a 404 would
   have produced roughly 120 requests/second indefinitely. Failures are now
   recorded permanently.
4. **The advertised duplicate-frame detection was dead code** — the hash map
   was built and never read. It now raises, and a re-pack confirms
   `duplicateFrames: 0` against the committed art.
5. **No reproducibility verifier and no npm entry.** Added
   `--verify-reproducible` (renders twice, requires byte-identical atlases)
   plus `assets:hmh:enemy-roster` and `assets:hmh:enemy-roster:verify`.

Also applied: the display is now built and validated *before* publishing to
the shared index/texture maps, so a bad atlas can no longer throw from inside
`resetEnemyMarkers` after the old markers were destroyed and leave every enemy
permanently invisible behind a swallowed exception.

## Known debt

- Roster limbs render pale; skin material wants a warmer, less reflective
  treatment. Lighting is tuned but not final.
- Idle enemies face east: `atan2(0, 0)` is `0`, so a stationary body has no
  facing. Should hold last movement facing.
- The roster is rendered at a 45-degree camera pitch while the certified hero
  pipeline uses 55 degrees, so heroes and enemies do not sit in exactly the
  same projection. Worth reconciling in the next art slice.
- `assets:qa:hmh-reboot` still inspects only the four hero atlases; the seven
  roster atlases are ungated by it.
- Per-clip `fps` in the roster metadata is not read; every state plays at a
  fixed cadence.
- Boss phases still render identically apart from the health bar.
- Heroes still lack death/dash/melee/grenade animation states.
- Weapons, pickups and power-up icons remain vector — next slice.
- Level art is authored-material but not authored-texture; open terrain has no
  scattered props.
- Carried: legacy `visual:regression` broken, melee height-lock, ledge-base
  projectile dead zone, route dashes unclipped, ground detail over roads,
  browser retained-memory debt.

## Deployment state

No production change. Production remains `dpl_AvXkk8eXSGzX4jcviDNzVSsr9ap9`;
rollback `dpl_3ku2fQ42yybTB5bWoZgifX9AnAPk`. This cycle stops at the branch
push; preview verification needs Vercel access unavailable in this checkout.

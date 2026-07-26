# Hard Money Heroes — Art & Animation Handoff (for Hermes)

**Date:** 2026-07-25
**Repository:** `C:\Users\just_\Desktop\Projects\Web3 Gaming\Lesters-Arcade`
**Branch:** `reboot/hmh-aaa-continuous`
**Supersedes for art matters:** the art sections of
`docs/handoffs/2026-07-24-lesters-arcade-chikun-to-hmh-reboot-fable-handoff.md`.
Everything else in that document still stands.

Read this with `AGENTS.md`, the AAA master plan, and cycle ledgers
`docs/hmh-reboot/cycles/CYCLE-003.md` through `CYCLE-006.md`.

---

## 1. What changed in cycles 003-006

| Cycle | Commit | Focus |
| --- | --- | --- |
| 003 | `b951d7bb` | World-bounds depenetration fix; permanent portal E2E harness |
| 004 | `cbbdd5d5` | Boss integrity, AI fairness, combat physics, progression depth, audio |
| 005 | `a8ead9b8` | Shipped the production hero atlas; combat feedback; level materials; working visual gate |
| 006 | *this cycle* | **Authored enemy + boss sprite roster via Blender** |

The art headline across 005-006: **the game shipped with placeholder art in two
places, and both are now authored.** The player was an 8-segment vector
prototype (the certified hero atlas existed but required a query flag the
portal never set), and all six enemy families plus the boss were procedural
vector shapes drawn with `Graphics` primitives. The boss additionally proxied
whale-enforcer poses and had no art of its own.

---

## 2. The art pipeline (this is the important part)

There are now **two** reproducible Blender->atlas pipelines. They share the
same shape: a manifest describes the actors, a scene script builds them from
primitives on a shared rig, an export script renders 8 compass directions per
animation state, and a packer trims, shelf-packs and emits atlas PNG + metadata
JSON + a contact sheet for human review.

### Heroes (pre-existing, certified)

```
apps/hmh-reboot/assets/source/blender/hmh-production-heroes.json
scripts/hmh-blender/create-hmh-production-hero-pilot.py
scripts/hmh-blender/export-hmh-production-hero-pilot.py
scripts/run-hmh-production-hero-pilot.py
-> apps/portal/assets/generated/hmh-reboot-production-heroes/<actor>/
```

Four heroes, four layers (shadow / lower-body / torso-head / weapon), 168
frames each.

### Enemies and boss (NEW in cycle 006)

```
apps/hmh-reboot/assets/source/blender/hmh-enemy-roster.json     <- manifest
apps/hmh-reboot/assets/source/blender/hmh-enemy-roster.blend    <- generated scene
scripts/hmh-blender/create-hmh-enemy-roster.py                  <- parametric bodies
scripts/hmh-blender/export-hmh-enemy-roster.py                  <- pose + render
scripts/run-hmh-enemy-roster-pipeline.py                        <- orchestrator + packer
-> apps/portal/assets/generated/hmh-reboot-enemy-roster/<actor>/
```

Rebuild everything:

```bash
npm run assets:hmh:enemy-roster
```

Prove it is reproducible (renders twice, requires byte-identical atlases):

```bash
npm run assets:hmh:enemy-roster:verify
```

Useful flags: `--skip-scene` (reuse the committed `.blend`), `--skip-render`
(repack existing raw frames). Blender path comes from `$BLENDER_EXECUTABLE`,
default `D:\Apps\Blender\blender.exe`. **Blender 5.1.2 is pinned and version
checked** — the pipeline refuses to run on anything else, matching the hero
pipeline.

**Current output:** 7 actors, 152 frames each, 1,064 frames total, 4.13 MB of
atlases (5.1 MB including contact sheets). Every frame is pixel-unique — the
packer now **raises** on any duplicate rendered frame, so a pose regression
that made two states render identically fails the build instead of shipping
silently.

### How an actor is defined

One parametric humanoid drives all seven. Identity comes from three things in
`hmh-enemy-roster.json`, nothing else:

- `build` — `height`, `shoulders`, `bulk`, `stoop`. This is what reads at a
  glance: the whale-enforcer is 1.16/1.35/1.42, the forkrunner is
  0.94/0.88/0.78, the boss is 1.42/1.72/1.80.
- `palette` — skin / primary / secondary / accent / boot.
- `prop` — exactly one silhouette cue per family (chest wedge, back satchel,
  shoulder rifle, pauldrons, back canister, hand staff, crown rig).

`identityForm` is `human` or `zombie`; zombies get a visible rib cue and a
larger stoop. **Every actor must read as a human survivor or a zombie** — that
is an `AGENTS.md` canon rule, and a test enforces it.

**To add or restyle an actor:** edit the manifest, rerun the pipeline. You
should not need to touch the scene script unless you need a new `prop.kind`.

### Animation states

`idle` (2f) · `run` (6f) · `tell` (2f) · `attack` (3f) · `hit` (2f) ·
`death` (4f), each across 8 directions. These are exactly
`REQUIRED_ENEMY_VISUAL_STATES` from `enemy-archetypes.mjs`, and a test asserts
the roster covers every state the runtime can select. Poses live in
`apply_pose()` in the export script — that is where to tune animation feel.

---

## 3. Runtime wiring

`apps/hmh-reboot/src/enemy-roster-atlas.mjs` (new) indexes the metadata and
builds the Pixi display. `main.mjs` loads each archetype's atlas **on demand,
asynchronously**, and rebuilds live bodies when it resolves.

**Direction mapping is the trap here.** Heading index -> compass name MUST
match `DIRECTION_BY_SIMULATION_INDEX` in `production-hero-atlas.mjs`
(`east, south-east, south, south-west, west, north-west, north, north-east`).
The first implementation reused the manifest's own compass ordering, which
mirrors that mapping about index 1 and left six of eight headings facing the
wrong way. A test now asserts the enemy and hero mappings are identical.

**Runtime scale is the second trap.** `renderWorld` sets
`scale.set(camera.zoom)` on every marker each frame, so a scale baked into the
display container is wiped. Displays carry a `rosterScale` property and the
render pass multiplies by it — same pattern as
`actorVisual.scale.set(PRODUCTION_HERO_RUNTIME_SCALE * camera.zoom)`.

Three more rules learned the hard way (numbered 1-5 for reference):

1. **Never block boot on art.** Awaiting a 650 KB atlas before the shell
   signals READY blew the parent's 8 s bridge timeout and broke every portal
   E2E flow. Art loads async and swaps in.
2. **Always keep a fallback.** If an atlas fails, the vector projection
   (`enemy-production-art.mjs`) still renders and the run continues.
   `dataset.enemyRosterError` reports why.
3. **Telemetry must report what actually rendered**, never what was requested
   (`dataset.enemyArt`, `dataset.bossArt`, `dataset.enemyRosterLoaded`,
   `dataset.actorArtSource`, `dataset.actorArtFallbackReason`).
4. **Never retry an asset from the render path without a permanent-failure
   flag.** The boss atlas request is issued per frame; clearing the guard on
   error produced ~120 requests/second on a 404 until it was fixed.
5. **Build and validate a display before publishing it to shared maps.**
   Publishing first meant a bad atlas threw from inside `resetEnemyMarkers`
   *after* the old markers were destroyed, leaving every enemy permanently
   invisible behind a swallowed exception.

Escape hatches: `?vectorEnemies=1` forces the old vector enemies, `?graybox=1`
forces the prototype hero. Both are for regression comparison only.

---

## 4. The visual gate — use it

`npm run visual:reboot` (`--accept` to update baselines).

The legacy `npm run visual:regression` is **still broken for the reboot** — it
drives the legacy canvas and waits for `#hmhReadyOverlay`, which the reboot
never renders. Do not cite it as a gate. Retiring or repointing it is
outstanding work.

The reboot gate captures 8 tick-pinned scenes (both viewports, six districts,
plus water/foliage/building scenes), decodes the real screenshot PNG, and
compares a 32x18 luma signature bounded on **mean, worst-cell, and
changed-cell** deltas. Baselines are committed under
`docs/testing/VISUAL_BASELINES/hmh-reboot/`.

Two traps this gate already fell into, both fixed — do not reintroduce them:

- Reading the canvas in-page (`drawImage`/`getImageData`) returns a **cleared
  buffer** because the WebGL context uses `preserveDrawingBuffer: false`. It
  produced all-zero signatures that passed forever. Decode the screenshot in
  Node instead.
- Mean delta alone cannot see a lost hero sprite (under 1% of frame area moves
  the mean by ~0.9). The per-cell and changed-cell bounds are what make it a
  real gate.

**When you change art, expect the gate to fail, look at the PNGs in
`.hermes/evidence/hmh-reboot-visual/current/`, and only then `--accept`.**

---

## 5. Current health

- **Release gate:** `PASS tests=1671 passed=1619 expected_failures=52`, zero
  unexpected. Bundle 980,423 bytes, under the 1,050,000 gate.
- **Web3 rails:** 54/54 tests pass across wallet auth, session integrity,
  leaderboards, persistence, profile parity, settlement and the LitVM chain
  client. `design:web3-audit` 9/9. `design:security-audit` 5/5, zero findings.
  `SETTLEMENT_LIVE` remains `false`. Web3 live-readiness is 3/4 with the one
  BLOCKED gate being the pre-existing HALT-gated paid-economy item.
- **Browser:** Chrome five-viewport certification clean; six portal E2E flows
  pass; performance and cockpit smokes clean.
- **Production untouched.** `dpl_AvXkk8eXSGzX4jcviDNzVSsr9ap9` still serves
  lestersarcade.io; rollback `dpl_3ku2fQ42yybTB5bWoZgifX9AnAPk` preserved. No
  contract or settlement activity.

---

## 6. Highest-leverage next slices, in order

1. **Weapons, pickups and power-up icons through the same pipeline.** These are
   still vector/procedural. The enemy roster manifest is the template: add a
   `hmh-prop-kit.json` with a prop list, reuse the render/pack scripts. This is
   the single biggest remaining art gap and it is now a well-worn path.
2. **World props and environment set dressing.** The ground has authored
   materials and district motifs now, but open terrain still has no scattered
   props. A Blender prop kit (rocks, wreckage, crates, signage) rendered to a
   sprite sheet and scattered deterministically by world cell would close the
   "visually stunning areas" gap. Level *layout* is good; it is dressing that
   is missing.
3. **Hero animation coverage.** Heroes have idle/run/aim/pistol-fire/hurt. No
   death, dash, melee or grenade states — the player still freezes mid-pose on
   defeat. Extend `hmh-production-heroes.json` clips and `apply_pose()`.
4. **Boss phase identity.** The boss has authored art now, but all three phases
   render identically apart from the health bar. Phase-specific tint/prop
   swaps are cheap and would make the fight readable.
5. **Retire or repoint the legacy visual harness** so there is exactly one
   visual gate.

---

## 7. Known art debt

- Enemy roster limbs render pale; the skin material could use a warmer,
  less-reflective treatment. Lighting is tuned but not final.
- The boss is framed at its own ortho scale (3.1); very large future actors
  will need the same treatment or they will clip.
- **The roster renders at a 45-degree camera pitch; the certified hero
  pipeline uses 55 degrees.** Heroes and enemies therefore do not sit in
  exactly the same projection. Reconciling this is worth an early slice.
- `npm run assets:qa:hmh-reboot` inspects only the four hero atlases. The
  seven roster atlases are not covered by any asset gate yet.
- Per-clip `fps` in the roster metadata is authored but never read; every
  state plays at a fixed cadence.
- Idle enemies all face east — `atan2(0, 0)` is `0`, so a stationary body has
  no facing. Should hold last movement facing.
- Level art is authored-*material* but not authored-*texture*: everything is
  still procedural vector drawing at runtime. No baked lighting.
- Route dash marks are not clipped to the visible span; ground detail draws
  over roads and water.
- Melee remains height-locked at ledges; ledge-base projectile dead zone.
- Browser retained-memory debt from cycle 002 remains open.

---

## 8. Hard rules (unchanged, and enforced by tests)

- Art, animation, camera and VFX are **projection-only**. They must never
  change collision, damage, AI, spawn order, RNG, progression, session
  evidence or results. Camera shake offsets the render container, never
  `camera.shakeX/Y` — those are read back by `screenToGround` for pointer aim.
- No `Math.random` in the runtime. Effects use a seeded hash so replays match.
- Deterministic fixed 60 Hz, four catch-up steps; `hmh-bridge/v1`; save schema
  2; parent owns wallet/profile/leaderboard/session/settlement.
- Work on `reboot/hmh-aaa-continuous`. No production promotion without explicit
  approval for that exact deployment; no contract deploy or settlement without
  a separate HALT approval.
- Run the full release gate before every commit, and get an adversarial review
  of the exact staged index. That review caught real defects in cycles 004,
  005 **and** 006 — it is not optional.

# Hard Money Heroes — Hermes handoff, Cycles 025–026

Date: `2026-07-27`
Branch: `reboot/hmh-aaa-continuous`
Head at handoff: `a43da3a8`
Production: **still Cycle 021 (`a81f1c8f`)** — see Deployment below.

This supersedes `2026-07-27-hmh-cycle-021-production-claude-handoff.md` as the
first document in the mandatory read order.

---

## Standing brief for the receiving agent

Your ongoing mandate, from the project owner:

> Continually upgrade the game world, level design, level assets, and character
> and enemy models to be much more visually appealing and detailed. Improve the
> movement, combat, and the balancing of weapons and levelling up.

Treat this as a **standing brief, not a one-shot task**. Each session takes one
bounded slice of it, ships it behind the full gate battery, and hands back a
ledger. Do not attempt all of it in a single pass — the last three cycles each
took one slice and each still uncovered real defects.

### Non-negotiable invariants

1. **Determinism.** Fixed 60 Hz, max four catch-up steps. Identical inputs must
   produce identical results. No `Date.now()`, no `Math.random()` in simulation.
2. **Projection-only art.** Art, camera, lighting and VFX may never change
   collision, damage, AI, spawn order, RNG, progression, session evidence, or
   results. Sprites are pixels; the world contract is authority.
3. **Parent/child authority.** The portal owns wallet, profile, leaderboard and
   settlement. The child owns simulation. `SETTLEMENT_LIVE` stays `false`.
   Never enable live settlement or broadcast a transaction without explicit
   per-action approval.
4. **Branch discipline.** Commit and push only to `reboot/hmh-aaa-continuous`.
   Never push ordinary work to `main`. Stop for approval before any production
   promotion.

### Session shape

1. Read-only health check: branch state, and the Web3 rails (wallet sign-in,
   profiles, leaderboards, session tracking, Ranked settlement, audits).
2. Fix any broken Web3 rail first, with the smallest change that works.
3. One bounded, test-first vertical slice of the standing brief.
4. Full gate battery, adversarial review of the **staged index**, ledger, push.

---

## Where to take the visual work next

Cycle 026 unified how assets are **lit**. It did not touch how much geometry
they carry. That is the next and larger piece.

**Highest value first:**

1. **Model geometry detail.** Every enemy and prop is built from primitives
   (cubes, cylinders, cones, spheres) in the `create-hmh-*.py` scene scripts.
   Enemies render at 128px, props at 128px. Adding real silhouette detail —
   gear, straps, weapon shapes, damage states — is the single biggest visual
   gain available.
2. **Buildings and trees.** `world-prop` assets (`relay-console`,
   `hashwood-stump`, `ore-cart`, `proof-pylon`, …) are simple solids. They read
   as placeholders next to the terrain material work from Cycle 022.
3. **Level design.** Elevation, water, foliage, roads and pathing all exist and
   are readable, but the districts are sparse. More authored set-pieces,
   landmarks and traversal interest.
4. **Animation.** The roster has 8-direction sets per state. Frame counts and
   secondary motion (cloth, recoil, weight shift) are minimal.

**Read before touching art:** the "Art pipelines" and "Hard-won lessons"
sections below. Several of these cost a full cycle to learn.

---

## What changed in Cycles 025–026

### Cycle 025 (`77f81c70`) — mobile controls P0, weapon capstones, movement

- **Mobile movement was completely broken on device**, for two independent
  reasons: the layout measured `window.innerHeight` (the *layout* viewport,
  which on a phone includes the strip behind the URL bar) so controls were
  placed below the visible area; and drag tracking was bound to the stick
  element, so a thumb dragged past its radius stopped delivering events wherever
  `setPointerCapture` is unreliable. Now measures `visualViewport` and tracks on
  the window surface.
- **Control set reduced to MOVE / AIM / POWER / pause.** POWER maps onto the
  existing `grenade` action, so the `ACTIONS` vocabulary and the input snapshot
  the simulation consumes are unchanged. Autofire was verified on before the
  fire button was removed. Double-tapping the move stick dashes.
- **Five of nine tier-three weapon capstones were inert.** `burst-fire`,
  `armor-piercing`, `double-barrel`, `explosive` and `tracer-rounds` were
  collected into `specials` and then read by nothing — three tiers spent for the
  numeric bonus alone. All five now resolve through a `SPECIAL_EFFECTS` table.
  `buildShots` also read `pelletCount`/`spread`/`speed`/`range` from the raw
  definition, so any capstone touching those would have stayed inert anyway.
- **`launcher-rig` had no upgrade tree at all.** It now has all three branches.
- **Movement turn assist.** Reversing used the same response time as starting
  from rest. Response now scales with how much input opposes velocity; cruise
  and top speed are bit-identical.

### Cycle 026 (`6804fa99`) — shared art direction, mobility upgrades

- **Three pipelines had three art directions.** Rim lights were warm orange on
  heroes, green on enemies, cyan on props; the fill was cool on two families and
  warm on the third. `scripts/hmh-blender/hmh-light-rig.json` is now the single
  source of truth and all four scene scripts load it via
  `shared_light_channels(family)`.
- **Colour is shared; energy is per-family on purpose.** The first attempt
  shared the key/fill ratios too and washed the contrast out of every pickup and
  gun. The rig file records this in a `contract` field — read it before changing
  the rig.
- **Mobility branch had one upgrade capped at two ranks** against 28+ ranks
  elsewhere. Added `hot-wallet` and repeatable `layer-two`.
- Heroes, enemies and props all re-rendered and reproducibility-verified.

### Follow-up (`a43da3a8`) — two sets of touch controls on mobile

The reboot runs in a sandboxed iframe hosted by the portal. The portal builds
its own joystick and buttons for the legacy cabinet on any touch device, at
`position: fixed; inset: 0; z-index: 60` — covering the iframe. Players saw two
complete control sets, and the portal's set drove nothing.

Fixed by making the embedded cabinet **own input** while mounted: the host sets
`documentElement.dataset.embeddedCabinet` on mount and clears it on destroy; the
portal's `ensureTouchControls()` bails out while it is set, with a CSS backstop
because `applyDeviceProfile()` only runs on resize and orientation change.

---

## Art pipelines

Blender **5.1.2**, version-pinned, at `D:\Apps\Blender\blender.exe`.

| Family | Command | Scene script that actually ships |
| --- | --- | --- |
| Heroes | `assets:hmh:production-hero-pilot` | `create-hmh-commando-concepts.py` |
| Enemies + boss | `assets:hmh:enemy-roster:verify` | `create-hmh-enemy-roster.py` |
| Props / pickups / guns | `assets:hmh:authored-props:verify` | `create-hmh-authored-props.py` |
| Terrain tiles | `assets:hmh:terrain` | `build-hmh-terrain-tiles.py` |

**Traps, each of which cost real time:**

- `create-hmh-character-template.py` is **not** the file that builds the shipped
  heroes. `create-hmh-production-hero-pilot.py` imports
  `create-hmh-commando-concepts.py`. Editing the template does nothing visible.
- Always use the `:verify` variant. `assets:qa:hmh-reboot` fails closed if
  `reproducibleVerified` is false.
- The hero pipeline **deletes and regenerates each actor in sequence**. A
  mid-run `git status` will show actors missing. That is not data loss.
- After relighting heroes, rebuild the derived selector atlas:
  `npm run build:hmh:hero-selector`.
- Adding a prop means updating **three** places: the manifest, the id list in
  `authored-prop-atlas.mjs`, and re-rendering. The two count guards now derive
  from `AUTHORED_PROP_ASSET_COUNT`, so they no longer need editing.
- **Adding a run upgrade without a matching prop icon breaks the upgrade panel.**
  `authoredPropItemUrl` throws on an unknown id and the cockpit sets that URL
  inside its render loop, so the panel silently renders fewer choices. Only
  `certify:hmh:browser` catches it.
- The props reproducibility gate is **one LSB from flaking**. It demands two
  pixel-identical EEVEE renders; certain light values land on an 8-bit
  quantisation boundary. Cycle 026 nudged the prop energies (428/164/226) until
  it cleared. That is a workaround. The durable fix — a small tolerance, or
  pinned EEVEE sampling — is open debt and a good early task.

---

## Gate battery

Run all of these before committing:

```bash
npm run check && npm run test:release && npm run build && npm run certify:hmh:browser && npm run visual:reboot && npm run assets:qa:hmh-reboot && npm run smoke:hmh:mobile-controls && npm run smoke:portal:e2e && npm run smoke:hmh:performance && npm run design:security-audit && npm run design:web3-audit && npm run repo:health:strict && npm run docs:links
```

Baseline at handoff: `test:release` **1766 total / 1714 passing / 52 accepted
legacy / 0 unexpected**; `visual:reboot` 8/8; bundle **996.9 KB**; p95 frame
time **7 ms / 7 ms**.

`certify:hmh:browser` is the one most easily forgotten and has caught two real
regressions in two cycles. Legacy `visual:regression` is **broken** for the
reboot — do not cite it.

---

## Hard-won lessons

1. **A gate that cannot fail is worthless.** The Cycle 025 mobile harness passed
   with *both* fixes reverted. Prove every new gate red against a deliberately
   broken build before trusting it.
2. **Adversarially review the exact staged index.** This has caught real defects
   in cycles 004, 005, 006, 022 and 025 — including two that would have shipped
   visibly broken.
3. **Green suites can still mean a broken screen.** The duplicate-controls bug
   passed every gate because the child harness loads the child directly and the
   portal gates only checked the portal. Test the composition, not just the
   parts.
4. Pixi `Graphics.fill({texture})` **cannot tile** — use `TilingSprite` and set
   `source.style.addressMode*` plus `update()`.
5. An unassigned Pixi mask renders as a visible white stroke — hide it until
   assigned.
6. Opaque tiles bury cues drawn into the same layer; give cues their own layer
   above.
7. Never block boot on art (an awaited atlas blew the 8s bridge timeout); always
   keep a fallback.
8. `renderWorld` overwrites `scale.set(camera.zoom)` — carry a runtime scale
   property and multiply.
9. Top-down readability comes from **plan footprint**, not elevation. Cones all
   look identical from above.
10. On mobile, `innerHeight` is the layout viewport — measure `visualViewport`,
    and bind stick tracking to the window, not the stick element.
11. Watch for **collected-then-ignored** config. Both the weapon capstones and
    the mobility multiplier were assembled correctly and read by nothing.
    Whenever you add a tunable, assert the consumer actually consumes it.

---

## Open items

| Item | Notes |
| --- | --- |
| **Model geometry detail** | The main outstanding visual ask. Primitives only, 128px. |
| **Melee and weapon switching unreachable on touch** | Removed with their buttons in Cycle 025. Cheapest fix: long-press POWER to cycle weapons. |
| **Props reproducibility gate brittleness** | One LSB from flaking; needs tolerance or pinned sampling. |
| **Portal E2E does not launch the cabinet on a phone viewport** | Would have caught the duplicate controls. Worth adding. |
| **Roster camera pitch** | Enemies render at 45°, heroes at 55°. |
| **Human device acceptance** | Never formally recorded. The owner playtests on a real phone and has found what the gates missed, three times. |
| Whether the relit props look *better* | Needs a human eye on the contact sheet. |

---

## Deployment

Pushing this branch creates a Vercel **Preview** deployment only. It does
**not** auto-promote. Production still serves Cycle 021 (`a81f1c8f`).

Promotion requires the Vercel dashboard or an authenticated CLI, neither of
which exists in this checkout, **and** explicit owner approval for that exact
action. Do not attempt to promote. Do not enable live settlement.

Ledgers for full detail: `docs/hmh-reboot/cycles/CYCLE-025.md` and
`CYCLE-026.md` (the latter includes the duplicate-controls addendum).

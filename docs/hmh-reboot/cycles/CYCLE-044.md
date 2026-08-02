# HMH AAA Continuous Improvement Cycle 044

Date: `2026-08-01`
Status: `IN PROGRESS`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `d8c05f1d` (Cycle 043 closeout; production promoted)

## Scope: gameworld visual arc — art direction, prop library, dressing, minimap fog

Owner brief: high-quality explorable gameworld, strong creative direction
studied from reference games, expanded asset library, minimap done right.

### 1. Creative direction (`docs/hmh-reboot/ART-DIRECTION-GAMEWORLD.md`)

Reference study (Hades' painted value discipline, Nuclear Throne's junk
clusters, Gungeon's prop silhouette language, survivor-likes' swarm
readability, Death's Door's landmark negative space) distilled into applied
rules: per-biome palettes with sparing neon accents (electricity means
something), density targets, actors always the highest local contrast.

### 2. Eight new 3D world props (deterministic Blender pipeline, 37 → 45)

`dead-pine`, `moss-boulder`, `reed-cluster`, `driftwood-log`, `ruined-wall`,
`watchtower`, `cargo-container`, `ore-conveyor` — authored as joined
flat-shaded solids (prism_mesh) plus faceted primitives, 256px frames,
byte-reproducible across cold rebuilds (verified twice). Quality bar
honestly applied: the first cargo-container/ruined-wall/driftwood-log renders
failed as flat slivers from the 55° camera; container and wall were rebuilt
taller with a 3/4 yaw and shipped, `driftwood-log` remains atlas-only until
its polish pass (Cycle 038 hold-out policy).

### 3. Biome dressing densified (43 → 75 placements)

Every district now carries an authored density override and a biome-true
prop mix: relay gets its watchtower and ruined walls, the ravine reads rocky
with dead pines, the crossing banks grow reeds, hashwood leads at 18 props,
the camp gains conveyor/containers, the yard doubles container wreckage.

### 4. MAP-REDO slice 4: minimap fog, markers, neon-noir restyle

- New pure module `minimap-model.mjs` (RED-first, 6 tests): live enemies
  exist only inside the 420-unit current-visibility radius and never
  persist; boss marks distinctly; POIs are discovered inside visibility and
  persist as knowledge; undiscovered POIs never leak; markers cap at 64;
  fully deterministic.
- Renderer: fog inverted — geometry now exists only where explored
  (run-merged void rects per row instead of the old additive wash), water is
  the one saturated fill, routes are lit filaments, the player is a heading
  chevron, enemies are hot pips, POIs mint diamonds, boss a ringed pip.
- Discovery state resets in `initializeSession` (the Cycle 043 restart
  lesson, applied on day one).

### Performance regression caught and fixed by the gate

The first renderer rebuilt the reveal Set and the full marker model every
render frame; the performance smoke failed with 35 MB of desktop heap
growth (budget 24 MB). Fixed with an identity-keyed reveal-Set cache and a
6-tick marker-model bucket (both reset on session restart alongside
discovery). Heap growth after the fix: 3.8 MB — below the pre-cycle
baseline, because the run-merged void rects also issue fewer Graphics
commands than the old per-cell wash.

## Gates

(recorded at closeout)

## Production promotion (owner-approved standing "push live")

| Release fact | Verified value |
| --- | --- |
| Branch head deployed | `cdfbe038` |
| Production deployment ID | `dpl_Hbm8q8H4vJ4JQz8sEroeoiatPQH1` |
| Immutable production URL | <https://lesters-arcade-j467qqotx-justin-agent-projects.vercel.app> |
| Public alias | <https://lestersarcade.io> |
| Live HMH bundle SHA-256 | `8c3932760f5c979c147118ba28867dca715773040379da86a2290468ab3e3076` — byte-identical to the local build |
| Live prop atlas | 45 assets |
| Live certification | five profiles PASS against the public alias |
| Rollback | `dpl_EFrNTXNpSWk4XmrAfgNcT78DCNUu` (Cycle 043 production) |

`SETTLEMENT_LIVE` untouched.

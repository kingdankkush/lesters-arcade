# HMH AAA Continuous Improvement Cycle 042

Date: `2026-08-01`
Status: `LOCAL GATES PASSED`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `8cf0dccd` (Cycle 041 closeout)

## Production promotion of Cycle 041 (owner-approved)

The owner approved "push live" on 2026-08-01. Record:

| Release fact | Verified value |
| --- | --- |
| Git branch head deployed | `8cf0dccd` (runtime boundary `53f3145c`) |
| Preview deployment | `lesters-arcade-qfrgfap7a` (Ready) |
| Production deployment ID | `dpl_GCzM6feNQxWF4ye6ZCXDspk82Bvx` |
| Immutable production URL | <https://lesters-arcade-2gpn9l44m-justin-agent-projects.vercel.app> |
| Public alias | <https://lestersarcade.io> (HTTP 200) |
| Live HMH bundle SHA-256 | `ecc1b72fc8f7f81e197ec71175d28514732f67566f43ac98a59058d6fa2badc3` — byte-identical to the local Cycle 041 build |
| Live certification | five profiles PASS against the public alias |
| Immediate rollback | `dpl_5mUEBJ6dZYaW6PANwSc1SfBnJRWo` (Cycle 036 production) |

`SETTLEMENT_LIVE` untouched. Promotion used the authenticated Vercel CLI
(`vercel promote --yes`), which rebuilds the commit against the production
environment; the served bundle was verified byte-for-byte after the alias
flipped.

## Scope: MAP-REDO slice 2 — terrain fidelity

1. **512px painted bake** — `build-hmh-terrain-tiles.py` upgraded to
   `hmh-terrain-tiles-v2`: `TILE_SIZE 512`, `FRINGE_HEIGHT 128`. Noise
   octave periods are lattice cell counts (`cell = size / period`) and thus
   already resolution-independent — the exact-index review caught the first
   implementation wrongly doubling them, which halved every feature's world
   size; only pixel-domain values (structure joint periods, the fringe edge
   profile) carry `PERIOD_SCALE`. The bigger bake therefore buys texel
   density at the owner-tuned feature scale. All 11 materials re-baked with
   `--verify-seamless` (runtime-fetched PNGs, not bundle bytes).
2. **Painted-style layering** (deterministic, seam-safe):
   - *underpainting*: broad low-frequency blotches pulling toward the
     material's highlight/shadow tones, mean-centred;
   - *directional strokes*: the detail grain is sampled through an integer
     45° shear (modulo tile size, so wrapping is exact), turning isotropic
     noise into brushwork;
   - *value banding*: lighting quantized into 6 bands and mixed 24% under
     the continuous shade, so surfaces read as blocked-in paint rather than
     photo gradients.
3. **Resolution-independent renderer scale** — `TERRAIN_TILE_WORLD_SCALE`
   (0.26, tuned for 256px) replaced with `TERRAIN_TILE_REPEAT_WORLD`
   (66.56 world units per repeat); tile and fringe scales now derive from
   the registry's `tileSize`/`fringeHeight`, so any future bake resolution
   renders identically. The fringe renderer stops hardcoding `0.26` and
   `/64`. The review also caught `validateTerrainManifest` stripping
   `fringeHeight` (the getter silently fell back to its default); the
   validated manifest now carries it, making the derivation real.
4. **RED-first**: `tiles are baked at 512px with painted layering and
   proportional fringes` failed against the 256px manifest before the bake
   (`tileSize 256 is below the 512px fidelity bar`), passes after.

Remaining slice-2 debt (bounded out): path decals and shore banks ride with
a later dressing pass; more fringe pairings currently ship implicitly since
every material has a fringe strip and district boundaries blend west→east.

## Gates

- check 337+49 (now 338 JS with the navgrid module landing in Cycle 043)
- terrain tests 13/13 (new 512px/painted/fringe assertions RED-first),
  fringe suite 5/5
- bake `--verify-seamless` PASS, 11 materials, 3,202,923 bytes of PNGs
- test:release `1,827 / 1,775 / 52 / 0` at the slice-2 boundary
- visual regression: changed scenes inspected at full resolution before
  `--accept` (texel density up, feature scale preserved after the review
  fix)
- exact-index review: two BLOCKERs found (inverted octave scaling;
  `fringeHeight` stripped by the manifest validator) — both fixed and
  re-verified before commit
- certification five profiles, combat/collectibles/mobile smokes, p95 7 ms,
  bundle within budget (recorded in CYCLE-043 for the combined state)

## Deployment

Slice-2 work is committed to the continuation branch only; it is NOT in the
promoted Cycle 041 production build. Next promotion requires fresh owner
approval per the standing gates.

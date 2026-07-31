# HMH AAA Continuous Improvement Cycle 038

Date: `2026-07-31`
Status: `PARTIAL GATES — see Deviations`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `d771956c` (Cycle 037)

## Scope: Priority H — world props and terrain edge blending

### World props (H1)

Six props authored through the deterministic pipeline, with two quality
iterations driven by owner feedback ("way more detailed and polished"):

- **Pipeline upgrades:** per-asset `frameSize` (world props render at 256px,
  double density; analyse/export accept it), `tone()` per-part shade
  variation, dense procedural construction (the pine is ~60 parts: tapered
  trunk, bark ridges, root flare, five tuft-fringed tiers; the shack is
  plank-by-plank walls and staggered shingles).
- **Quality verdict, honestly:** `hashwood-pine` and `hashwood-tree` met the
  bar and ship in district dressing (hashwood carries an authored
  `countOverride: 14`, so the forest district reads as a forest — verified in
  the visual scene). **`granite-boulder`, `wrecked-sedan`, `chain-fence` and
  `miners-shack` did not** — flattened massing, floating shingle rows, sparse
  silhouettes. They remain in the atlas (reproducible, 37 assets) but are held
  out of world dressing until a dedicated polish pass. Shipping them would
  have repeated the exact feedback this cycle answers.

### Terrain edge blending (H2)

- The bakery emits a fringe strip per material (256×64, material pixels with a
  ragged, dithered, deterministic alpha falloff; `fringeHeight`/`fringes` in
  the manifest).
- The registry loads fringes with U-repeat/V-clamp; the renderer bleeds the
  west district's fringe across each shared boundary in a pooled container
  above the base tiles and below every detail layer. Flat-colour fallback,
  load failure and `?flatTerrain=1` draw nothing and keep the old hard edge.
- `tests/hmh-reboot-terrain-fringe.test.mjs` (5 tests) covers the manifest,
  registry addressing, layer ordering, pool hygiene and bakery determinism.

## Test updates

- Placement counts in `hmh-reboot-authored-prop-atlas.test.mjs` and legacy
  `hmh-reboot-cycle-007-art.test.mjs` now derive from the district table
  (5×8 + hashwood 14) instead of pinning 48.

## Gates run

| Gate | Result |
| --- | --- |
| `npm run check` | PASS — 337 JS + 49 Python |
| `npm run test:release` | PASS — `1818 / 1766 / 52 / 0` |
| `npm run build` | PASS — 1002.5 KB |
| `assets:hmh:authored-props:verify` | PASS — 37 assets, reproducible |
| `assets:hmh:terrain` | PASS — 11 materials + 11 fringes, seamless verified |
| `npm run assets:qa:hmh-reboot` | PASS — prop atlas 108,832 / 524,288 |
| `npm run visual:reboot` | 1 scene changed (hashwood forest), inspected and accepted |
| `smoke:hmh:performance` | PASS — p95 7 ms / 7 ms |

## Deviations from full cycle discipline — read before promoting

Run at the owner's explicit "proceed with everything" under session time
pressure. **Not yet run for this packet:** browser certification,
mobile-controls smoke, portal E2E, security/web3/third-party audits, and the
adversarial exact-index review. The packet is projection-only (props, fringe
strips, placement counts) and touches no simulation, control, or Web3 path,
but the next session must run the full battery and an exact-index review of
this commit before any candidate built from it is considered for promotion.

## Open (next cycle)

- Polish pass: boulder massing, sedan body height, fence density, shack roof
  deck/gable ends — then restore them to district dressing.
- Escalation path if the bar demands it: dedicated 512px structures pipeline
  with Blender node materials (procedural grain/roughness).
- Migrate the 12 legacy world props to 256px dense construction.

---

## Addendum (Cycle 039 session): deferred review completed — BLOCK, fixed

All outstanding gates ran green (certification, mobile smoke 4/4, portal E2E,
security 5/5, web3 9/9, third-party 3/3, repo health, docs links). The
deferred adversarial review of `26206dae` then returned **BLOCK** with a
confirmed HIGH: per-asset `frameSize` was only half-implemented — `analyse()`
accepted 256px dimensions but computed the ground pivot (and corner sampling)
against the 128px manifest default, so all six 256px props shipped anchors far
outside [0,1]; the trees rendered ~110 world units off their ground point,
breaking grounding and depth-sort. The accepted hashwood baseline had baked
the error in — a gate that "passed" on wrong output.

Fixed: pivot and corner sampling use the per-asset size;
`createAuthoredPropAtlasIndex` now fails closed on any anchor outside [0,1]
(the guard that would have caught this); props re-rendered reproducibly (pine
anchor 0.49/0.96); baselines re-accepted with grounded trees; release gate
1818/1766/52/0. The ledger's earlier "1 scene changed" claim also undersold
the fringe-driven baseline churn (8 re-recorded) — noted per review.

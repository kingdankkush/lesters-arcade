# HMH AAA Continuous Improvement Cycle 009

Date: 2026-07-26
Status: `LOCAL CERTIFIED · COMMIT PENDING · PRODUCTION UNTOUCHED`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `d061ac3f` — Cycle 008 truthful ledge combat

## Objective

Close the carried projection-only world-composition debt without changing level
graphs, collision, elevation, simulation, encounters, or portal authority:

1. keep deterministic district motifs and micro-scatter beneath authored roads,
2. keep tangible destructible and explosive-zone details above world surfaces,
3. prevent route dashes beneath water from bleeding through the water base,
4. preserve raised bridge, ledge, route, and water readability,
5. retain all gameplay and Web3 boundaries.

## Reproduction

Current committed Cycle 008 reported:

```json
{
  "layers": [
    "terrain",
    "routes",
    "surfaces",
    "details",
    "blockers",
    "landmarks",
    "interactions",
    "particles",
    "lighting",
    "vignette"
  ],
  "motifLayer": "details",
  "waterBaseAlpha": 0.92
}
```

This proved two composition defects:

- ground motifs and micro-scatter used the post-route `details` layer, so they
  could cross the road surface;
- water rendered after routes but its 0.92-alpha base allowed underlying route
  marks to remain visible.

`layers.details` also contains destructible and explosive-zone props, so simply
moving that entire layer below routes would have buried tangible objects.

## RED

`tests/hmh-reboot-world-production-art.test.mjs` first required:

- a dedicated `groundDetails` layer between `terrain` and `routes`;
- an exported, frozen `resolveWorldSurfaceBase(...)` contract;
- opaque deep-water and shallow-water bases;
- preserved raised-surface material behavior;
- district motifs routed through `layers.groundDetails`;
- tangible detail props retained on `layers.details`.

The focused test failed before implementation because
`resolveWorldSurfaceBase` did not exist.

## Implementation

### Split material detail from tangible detail

`WORLD_PRODUCTION_ART.layers` now orders:

```text
terrain → groundDetails → routes → surfaces → details → blockers → landmarks
→ interactions → particles → lighting → vignette
```

`drawDistrictMaterial(...)` writes motifs and micro-scatter to
`groundDetails`. Destructible crates and explosive-zone props continue to use
`details`, preserving their foreground read.

### Opaque water authority

`resolveWorldSurfaceBase({ kind, districtId })` is a pure frozen resolver for:

- water and shallow-water colors,
- district-derived ramp/ledge fallback materials,
- opaque base alpha,
- water versus raised-surface classification,
- deterministic stroke color.

Water now uses an opaque base. Shimmer, caustic flecks, and depth bands remain
translucent overlays above it, so water keeps visual depth without exposing road
marks underneath.

### Authority boundaries

This cycle changes only Pixi projection composition. It does not alter:

- `LEVEL_ONE_WORLD`, routes, surfaces, blockers, queryGround, or movement;
- 60 Hz simulation and four catch-up steps;
- enemy navigation, encounter direction, damage, replay, or persistence;
- parent/child bridge messages;
- Free/Ranked separation or settlement.

## Verification

### Focused and adjacent

- World production-art tests: `6/6` pass.
- World, elevation, material, and production-art group: `29/29` pass.
- Syntax check: `332` JavaScript modules and `49` Python scripts.
- Bundle build: `994,237` child bytes under the `1,050,000` budget.

### Browser and visual

- Visual regression: all eight scenes pass.
- Liquidity bridge delta: mean `0.429`, max `5`, seven changed signature cells,
  all within the `2.5` gate.
- Direct 1440×900 liquidity-crossing inspection: no route marks bleed through
  water; ground motifs do not cross the road; road, water, bridge deck, rails,
  and shorelines retain a clean hierarchy; zero console errors.
- Five-profile release browser certification: pass on desktop, ultrawide,
  tablet landscape, mobile portrait, and mobile landscape.
- Combat browser smoke: pass on desktop, mobile, and bridge world-tour state.
- Cockpit browser smoke: pass on desktop and mobile.
- Parent portal E2E: six implemented flows pass, zero console errors.
- Performance smoke:
  - desktop: p95 `7 ms`, max `13.8 ms`;
  - mobile: p95 `7 ms`, max `14.3 ms`;
  - no browser errors.

### Full release and repository

- Retirement ledger: `1,696 total / 1,644 passed / 52 accepted / 0 unexpected`.
- Production asset QA: four hero atlases, seven roster atlases, and 29 authored
  props pass unchanged.
- HMH security audit: 5/5, zero findings.
- Third-party sandbox security: `3/3` pass.
- Strict repository health: pass.
- CDN gate: 33 candidates / 101 MB, no destructive action.
- Documentation links: eight current/public documents pass.
- Repository audit: 597 files scanned and 24,127 unique references; generated
  report drift was restored or remained ignored.

## Known debt

- Projectiles intentionally never rise with terrain after a downward transition.
  A shot can remain visually low after leaving a depression; gameplay remains
  legal, but a future projection-only tracer pass may improve the read.
- Firefox and WebKit are not locally available; Chrome remains the certified
  browser.
- Broader world art remains authored-material rather than authored-texture in
  open terrain. This cycle fixes composition, not art-source scope.
- Hardened Web3 remains blocked on deployment and trusted-attestation
  prerequisites.

## Deployment state

No push, preview or production deployment, promotion, LitVM action, transaction,
wallet/signature request, or settlement change occurred. Production remains
`dpl_AvXkk8eXSGzX4jcviDNzVSsr9ap9` and `SETTLEMENT_LIVE=false`.

## Exact-index policy

The intended candidate will be staged and frozen with literal
`git diff --cached --binary | sha256sum`. Independent review must examine that
exact binary patch. Any edit after the freeze invalidates the verdict.

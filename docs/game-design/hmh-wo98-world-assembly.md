# HMH WO-98 — Level 1 Six-Biome World Assembly

Status: runtime-assembly-ready deterministic map assembly.

This slice consumes the approved WO-97 six-biome world assets and preserves the WO-96 12 × 7 macro map plan. It does not replace the whole renderer yet; it creates the deterministic assembly contract used by the next runtime swap.

## Runtime module

- `apps/portal/src/hmh-wo98-world-assembly.mjs`
- Acceptance seed: `1337`
- Source manifest: `hmh-level-one-wo97-six-biome-world-assets-v1`

## Guarantees

- Critical path stays west → east:
  1. Neon City Core
  2. Industrial Yard
  3. Old Canal & Riverfront
  4. Lakeside Park & Old-Growth Forest
  5. Farmstead Outskirts
  6. Extraction Plaza
- Connectors include road, trail, and water.
- Canal/lake water is a continuous readable band, not decorative puddle scatter.
- Micro-scenes are authored and use WO-97 asset families by biome.
- Seed `1337` acceptance tour lists expected families and representative objects for each route biome.

## Acceptance tour

The exported `buildLevelOneWo98AcceptanceTour({ seed: 1337 })` returns six ordered steps, one per critical-path biome, with expected object keys and acceptance criteria.

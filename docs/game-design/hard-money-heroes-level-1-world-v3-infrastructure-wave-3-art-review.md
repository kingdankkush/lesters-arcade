# Hard Money Heroes Level 1 World v3 Infrastructure Art Wave 3 Review

**Date:** 2026-07-12
**Scope:** authored route infrastructure, finite west-boundary identity, Crossroads focal composition, Pine Creek bridge readability, Rugpull Gulch boss framing, and extraction separation
**Deterministic seed:** `1337`

## Accepted runtime artwork

| Asset key | Runtime file | Role |
| --- | --- | --- |
| `world-v3-infrastructure/canyon-boundary-straight` | `infrastructure/canyon-boundary-straight.png` | straight west-edge canyon segment |
| `world-v3-infrastructure/canyon-boundary-bend` | `infrastructure/canyon-boundary-bend.png` | eroded west-edge turn variant |
| `world-v3-infrastructure/canyon-boundary-buttress` | `infrastructure/canyon-boundary-buttress.png` | tall west-edge escarpment variant |
| `world-v3-infrastructure/pine-creek-timber-bridge` | `infrastructure/pine-creek-timber-bridge.png` | single traversable bridge overlay |
| `world-v3-infrastructure/crossroads-wagon-trading-post` | `infrastructure/crossroads-wagon-trading-post.png` | Crossroads focal landmark |
| `world-v3-infrastructure/rugpull-gulch-sheriff-water-tower` | `infrastructure/rugpull-gulch-sheriff-water-tower.png` | boss-yard perimeter landmark |

The normalized runtime contact sheet is `docs/art/qa/hmh-world-v3-art-wave-3-contact-sheet.png`.

## Generation and provenance

- PixelLab `create_map_object` was attempted first with a resumable external-vault ledger. Twelve jobs were accepted but remained unavailable through repeated collection attempts and transient HTTP 503 responses.
- The release used the approved FAL fallback, provider `fal.ai`, model `flux-2-klein-9b`.
- Two initial FAL candidates were rejected:
  - canyon buttress read as an isolated square mesa instead of connectable boundary geography;
  - Rugpull landmark contained pseudo-lettering.
- Only those two sources were regenerated. The accepted replacements have continuous silhouettes and no text, logo, coin mark, or character.
- Every accepted source has a path-free source-artifact filename and immutable SHA-256 in `hmh-level-one-world-v3-landmarks.mjs`.
- Raw sources, generation URLs, rejected candidates, PixelLab job IDs, and processing logs remain outside the repository in the art vault.

## Normalization

- Flat magenta backgrounds were removed with a hue/saturation chroma key.
- Alpha bounds were cropped and nearest-neighbor normalized to transparent runtime canvases.
- The Pine Creek source was horizontally mirrored to match the authored bridge axis; that transform is explicit in provenance and locked by a source test.
- Runtime files contain no residual magenta fringe, internal alpha holes, clipping, pseudo-text, or recognizable third-party marks.

## Authored level-design changes

### West finite boundary

The west edge now cycles three connected canyon-wall variants. Generic water pools, ruin stacks, and portal-like blue fragments are no longer used as the west boundary. Existing finite-edge collision remains authoritative and unchanged.

### Pine Creek

The legacy bridge image is no longer decoded and redrawn on every bridge cell. Semantic bridge cells use batched canvas paths, and one non-solid authored overlay is anchored to `pine-creek-wood-bridge` at world `(27,-39)`. Traversability, bridge cells, and route metadata remain authoritative.

### Crossroads

The `shoreline-ford-bank` World v3 stamp and duplicated `crossroads-wagon-core` encounter object were retired. The wagon trading post is the primary focal landmark; signpost and lantern encounter cues remain. The solid landmark is outside the five-tile arena-clearance radius.

### Rugpull Gulch and extraction

The legacy `innercity-gate-barricade` and `industrial-power-yard-extraction-pocket` World v3 placements were retired. The sheriff/water-tower landmark frames the boss yard from the upper-left perimeter with a 6.2×4.2 collision footprint and a smaller five-tile visual footprint. The arena center remains open.

The Litecoin City gate moved four authored cells east and remains `solid: false` with no collision polygon. The final boss and extraction captures have distinct focal hierarchies.

## Deterministic visual acceptance

Reviewed seed-`1337` frames:

- render anchor and live spawn;
- Crossroads Trading Post;
- Pine Creek bridge;
- Rugpull Gulch boss yard;
- Litecoin City extraction;
- west finite boundary.

The accepted baseline was followed immediately by `npm run visual:regression`, which passed with an exact render-anchor match.

## Runtime evidence

- Main-scene ground pass: 2.5–3.6 ms across accepted and final QA runs
- Boundary ground pass: 1.1–1.2 ms
- Average render time: 4.27–4.31 ms
- p95 render time: 5.9–6.3 ms
- Prop persistence: 38 unique rendered IDs, zero reappearance failures, zero rendered-while-undecoded IDs
- Collision probe: Ghost Saloon landmark stopped horizontal and vertical movement as expected
- All six new asset families decoded during the deterministic tour
- West-boundary clamping remained active

## Release decision

**Approved for release.** The wave replaces placeholder infrastructure with authored art, reduces duplicate composition, improves route and POI readability, and preserves semantic collision, traversal, arena-clearance, and extraction contracts.

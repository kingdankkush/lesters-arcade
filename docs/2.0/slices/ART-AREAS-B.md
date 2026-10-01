# ART — area plans lane B (River, Pines, Ridge, Fortress)

2026-09-30. Branch `claude/200-areas-b` from integration `8cc3c9e3f`. Projection-only
dressing plans on the `hmh-area-art-plan/v1` schema (`ART-AREA-SYSTEM.md`): no
blocker, surface, objective, RNG, progression or result changes; no paid
generation; every card is a frame on the existing HD kit pages. **Owner art
acceptance is not claimed.** The lane was cut off by the release freeze after
the first area; see "Status" below.

## Status

| Area | Plan | Hook / scene | Test | State |
| --- | --- | --- | --- | --- |
| Hashwood River (06) | `apps/hmh-reboot/src/world-v2-area-plans/hashwood-river.mjs` | `WORLD_V2_AREA_ART_HOOKS['hashwood-river']`, private scene `arts` | `tests/hmh-world-v2-area-plans.test.mjs` "Hashwood River follows brief 06" | **shipped** (`80d9c3227`) |
| Hollow Pines (07) | — | — | — | not started (release cut-off) |
| Ledger Ridge (08) | — | — | — | not started (release cut-off) |
| Fork Fortress (09) | — | — | — | not started (release cut-off) |

Private-scene screenshots were **not** captured for River: the capture needs
the private build and headless Chrome under the shared heavy lock, which did
not fit inside the cut-off window. The plan is proven by the validator and the
placement regression only; visual inspection of card heights against the
72-unit human remains open, as it does for Woods and Meadows.

## Hashwood River (`hashwood-river`)

Pages `plants-00` + `structures-01` + shared `props-00`: encoded 6,170,898 B,
decoded 50,331,648 B (12,582,912 B at `@0.5x`); tiles `forest-floor`,
`ledge-top`, `packed-earth`, `wet-bank` (5,242,880 B). Counts: 352 props,
7 solids, 9 zones, 28 trails, 0 decals.

| Element | Source | Placement |
| --- | --- | --- |
| Tall conifers | `b2-72` ×96 (plan tint `0xd6dcc0` toward foliage `#65735A`), `b1-50` ×68 (renderer teal rule + pale tint) | rooted on the waterfall shelf top (`groundZ` 190), on the closed woodland beyond the area edge (road mouths stay open), and in thirteen enclosed-bank groves through the guard |
| Understory | `b1-04` ×99, `b1-01` ×25 | grove skirts, radius-16 guard |
| Riverbank iris | `b1-09` ×44 | 72–98 units outside both channel edges, on the marsh bank strips |
| Crossings | `b2-41` stone arch ×2 | pivot 10 units south of each authored bridge deck, height 430, `fade: true`, no shadow. Both crossings are authored north–south (`axis: 'y'` ramps), so the vertical-span card reads along the deck. The guard is bypassed on purpose (the deck is the inspection route); the card fades to 0.38 while the actor crosses behind it |
| Waterfall shelf | `bank` solid (roof `rock`), `b2-76` rock arch on top, `b1-42` sandstone ×6 (shelf top and bank foot), `rock` zone at the shelf foot | stone tint `0x9cacb4` pulls the warm sandstone toward rock `#77796D` |
| Theatrical clearing | `marquee-backing` → `b1-13` covered stall row (worn-cloth tint), posts → `stakes`, `court-low-stack` → `b2-79` log-pile hedge, `court-tall-screen` → `stakes`, `dirt` zone, `b2-79`/`b1-02` at the clearing edges | arena centre and both exits stay clear |
| Capstan house | `b2-67` signal box (fit `height`), `earth` apron | objective frontage clear |
| Ground | base `forest`; `marsh` strips on both banks; `earth` compaction on the four bridge approaches; trails on every inspection route (52 main / 40 optional) | |

Documented omissions: the timber trestle (`b2-42`) and rope span (`b2-44`)
are on `structures-00`, which would be a third exclusive page, so the stone
arch stands on both crossings; the quiet east bank keeps only trees, iris and
a stump so it reads as a trail.

Regression (`tests/hmh-world-v2-area-plans.test.mjs`): determinism across two
authored worlds, two-page budget, ≤ 4 tiles, the two arch placements, conifer
and iris counts, iris within 130 units of the channel, the shelf arch rooted
on the shelf, named solids and styles, and for every non-bridge prop: inside
bounds, outside blockers (or on a matching-height bank), out of water, ≥ 64
from inspection routes, outside road corridors, ≥ 140 from objective / exit /
secret / height-option / area / entrance sites, outside spawn clearance, and a
clear lower-bank centre.

Hook-side tests updated: `tests/hmh-world-v2-runtime-world.test.mjs` (River
hook resolves), `tests/hmh-world-v2-local-scene.test.mjs` (import seam),
`tests/hmh-world-v2-area-art-binding.test.mjs` (four plans, still four distinct
kit pages because River shares the Woods pages).

## Tests

`node --test tests/hmh-world-v2-area-plans.test.mjs tests/hmh-world-v2-*.test.mjs tests/hmh-greybox-*.test.mjs`:
215 tests, 214 pass, 1 fail — `tests/hmh-world-v2-verifier-freeze.test.mjs`
"the portal never forwards a world parameter" fails identically on the base
commit `8cc3c9e3f` with this lane's changes stashed, so it is not caused here.
`node scripts/syntax-check.mjs` passes (1380 JS modules + 167 Python scripts).

## Weak spots / next

- No River screenshots: capture `river-center`, `river-city-crossing`,
  `river-shelf` and `river-marquee` at 1280×800 under the heavy lock and
  inspect the 430-unit arch against the 420-deep deck and the 72-unit human.
- Sandstone/rock-arch cards stay warm under a multiplicative tint; a cooler
  render or a desaturated frame would match the rock swatch better.
- Pines, Ridge and Fortress were designed but not authored (page sets:
  Pines `plants-00 + structures-01`, Ridge `structures-01 + plants-00`,
  Fortress `structures-00 + structures-01`; lanterns `b2-52` omitted from Pines
  as implausible; `b2-70` scaled up via a `card` solid with `fit: 'height'`
  and `massAlpha: 0` on `hollow-pines-dead-tree-roots` for the giant dead tree).

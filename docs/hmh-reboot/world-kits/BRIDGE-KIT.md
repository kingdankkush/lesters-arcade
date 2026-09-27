# HMH bridge kit (S4.9)

Status: **dark**. The eight layout v2 crossings are built, rendered and
registered. Nothing on the shipped map draws them; the layout v2 lane places
them. Level 1 design package sections 2.4 and 9.2 (S4.9).

## What exists

| Crossing | Style | Deck (x0, y0, x1, y1) | z | Layers and states |
|---|---|---|---|---|
| Settler Viaduct | stone-arch viaduct | 2430, 2240, 2870, 2480 | 0 | deck, near parapet |
| Rugpull Rope Bridge | plank suspension | 2430, 1020, 2870, 1180 | 0 | towers, 6-frame sway (deck and near ropes), `raised` |
| Old Mill Bridge | stone arch | 4500, 845, 5000, 1105 | 16 | deck with ramps, near parapet |
| Proof-of-Work Bridge | steel through-truss | 4500, 2290, 5000, 2510 | 16 | deck and far truss, near truss, overhead bracing |
| Fork Trestle | timber trestle | 4180, 3150, 4470, 3350 | 0 | deck, near rail |
| Lock Gate walkway | steel lock-gate walkway | 5230, 3450, 5520, 3700 | 0 | deck, near rail and lamps, `chained`, `open` |
| Hashwood Run Bridge | log and plank (timber variant) | 6930, 2250, 7130, 2600 | 0 | deck (no rails) |
| Canal Bascule | steel bascule (spans y) | 10700, 1280, 10920, 1500 | 0 | quays, cabin, leaf `raised`, `lowering-1`, `lowering-2`, `lowered` |

The rectangles are the layout v2 `DECKS` from `fable/hmh-layout-v2` at
`f4289a33`. `tests/hmh-bridge-kit.test.mjs` compares them with
`LAYOUT_V2_MAP.decks` whenever `layout-v2-map.mjs` is present, so a deck that
moves on the layout fails the build until the kit is re-rendered.

## How it is made

- `scripts/hmh-blender/create-hmh-bridge-kit.py` builds every crossing from
  shared modules (parapet segments, arch spans, piers, truss planes, rail
  runs, planks, piles, lamp posts, gate leaves) sized from the deck rectangle,
  saves `apps/hmh-reboot/assets/source/models/world-kits/bridge-kit/hmh-bridge-kit.blend`
  (Git LFS), and renders each layer, state and sway phase in Cycles.
- Camera: orthographic, 35 degrees below the horizon (the hero camera).
  Geometry sits under an oblique root scaled (S, -S / sin 35, S / cos 35),
  which makes the render reproduce the game projection `screen = (x, y - z)`
  exactly. Every frame carries probes; the worst deck-corner error is recorded
  in `docs/testing/hmh-bridge-kit/hmh-bridge-kit-metrics.json` (gate 0.5 px).
- Light: the shared rig (`scripts/hmh-blender/hmh-light-rig.json`), family
  `world-kit` (sun strengths). A shadow catcher gives ground-contact shadows on
  the banks and water in the static deck layer only.
- Density: 2 texels per world unit, drawn at `runtimeScale` 0.5.
- `scripts/run-hmh-bridge-kit-pipeline.py` trims, splits sparse frames into
  pieces, checks alignment on real pixels (deck coverage, rail coverage over
  the r14 capsule lines), packs WebP pages per district group with an exact
  `@0.5x.webp` mobile page each, and writes the atlas, metrics, contact sheet
  and per-crossing alignment previews.

```
npm run assets:hmh:bridge-kit          # build, render (about 10 minutes), pack
npm run assets:hmh:bridge-kit:verify   # render twice, compare
python scripts/run-hmh-bridge-kit-pipeline.py --skip-render   # repack only
python scripts/run-hmh-bridge-kit-pipeline.py --preview 0.25  # quick look-dev in .tmp
```

## Placing it (layout lane)

`apps/hmh-reboot/src/bridge-kit.mjs` is the only runtime surface. Load it by
dynamic import behind `?evidenceSafe=1&bridgeKit=1`
(`bridgeKitEnabled({ params, mode })`), and call
`assertBridgeKitSessionMode(mode)` before a session starts: the kit never runs
Ranked until it is promoted. A test forbids any static import of the module.

1. `loadBridgeKitAtlas({ fetchJson })`, then load the pages from
   `bridgeKitPageUrls(index, { mobile })`. Pages are grouped by district
   (`ravine`, `crossing`, `east`), so a district can load only its own.
2. `createBridgeKitDisplay({ index, pageTextures, depthLayer, ... })`. Add
   `ground` to the world ground layer (under actors) and `overhead` above
   actors; actor-band sprites join `depthLayer` with their `sortY`.
3. Each frame call `update({ camera, view, presentationTick, gateStates, hero })`.
   - `gateStates['rugpull-rope-bridge']`: `raised` until the winch gate opens,
     then `lowered` (the sway loop).
   - `gateStates['lock-gate-walkway']`: `chained` until the Lockkeeper falls,
     then `open`.
   - `gateStates['canal-bascule']`: `bridgeSequenceState(crossing, ticksSinceLever)`
     steps `raised` to `lowered` over three 12-tick steps.
   - `hero` fades the Proof-of-Work near truss (0.55) and overhead bracing
     (0.22) while the hero is on the deck or its ramps.

Everything is projection-only. Rails, gates, decks and ramps stay the layout's
capsules and surfaces; the sway moves pixels only and is a pure function of
the integer presentation tick (7 Hz, 6 frames).

## Budgets

Seven WebP pages, about 2.1 MB in total, each under the 1 MiB prop page
budget, with about 1.0 MB of mobile half pages. Page edges are multiples of 64
(at most 2048). The metrics file records bytes and decoded bytes per page.

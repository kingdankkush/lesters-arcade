#!/usr/bin/env python3
"""Slice Justin-approved HMH ChatGPT Image tree/forest/ground sheets into runtime assets.

The runtime manifest intentionally redacts local source paths. Ground sheets are
converted to 56x56 transparent isometric diamonds; tree/forest sheets use a
magenta chroma-key and are normalized onto 256x256 transparent prop canvases.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
PORTAL = ROOT / "apps" / "portal"
ATTACHMENTS = ROOT / ".hermes" / "desktop-attachments"
OUT = PORTAL / "assets" / "generated" / "hmh-curated-level-art"
COHERENT_OUT = PORTAL / "assets" / "generated" / "hmh-coherent-world" / "curated"

TREE_SHEET = ATTACHMENTS / "ChatGPT Image Jul 8, 2026, 08_31_56 PM.png"
NEW_TREE_ANIMATION_SHEETS = [
    ("jul9-riparian", ATTACHMENTS / "ChatGPT Image Jul 9, 2026, 10_29_55 PM.png", [
        ("jul9-riparian-juniper", "compact juniper with six wind-sway frames"),
        ("jul9-riparian-dead-tree", "dead snag with six subtle idle frames"),
        ("jul9-riparian-cottonwood", "broad cottonwood with six leaf-sway frames"),
    ]),
    ("jul9-desert", ATTACHMENTS / "ChatGPT Image Jul 9, 2026, 10_32_47 PM.png", [
        ("jul9-desert-acacia", "flat-canopy acacia with six idle frames"),
        ("jul9-desert-mesquite", "thorny mesquite with six idle frames"),
        ("jul9-desert-joshua", "Joshua tree with six idle frames"),
    ]),
]
FOREST_SHEETS = [
    ("forest-boundary-a", ATTACHMENTS / "Jul 8, 2026, 08_40_02 PM.png"),
    ("forest-boundary-b", ATTACHMENTS / "Jul 8, 2026, 08_40_00 PM.png"),
]
GROUND_SHEETS = [
    ("ground-rock-grass-dirt-a", ATTACHMENTS / "ChatGPT Image Jul 8, 2026, 08_52_18 PM.png", "rocky", ["grass", "dirt", "rocky"]),
    ("ground-grass-dirt-path-a", ATTACHMENTS / "ChatGPT Image Jul 8, 2026, 08_50_57 PM.png", "grass", ["grass", "dirt", "grass-to-dirt"]),
    ("ground-dirt-rock-gravel-a", ATTACHMENTS / "ChatGPT Image Jul 8, 2026, 10_31_15 PM.png", "dirt", ["dirt", "rocky"]),
    ("ground-water-grass-sand-a", ATTACHMENTS / "ChatGPT Image Jul 8, 2026, 10_30_58 PM.png", "shore", ["water", "shore", "grass", "sand"]),
    ("megatexture-dirt-scrub-a", ATTACHMENTS / "ChatGPT Image Jul 8, 2026, 10_26_15 PM.png", "dirt", ["dirt", "grass", "rocky"]),
    ("ground-sand-gravel-road-a", ATTACHMENTS / "ChatGPT Image Jul 8, 2026, 10_24_16 PM.png", "sand", ["sand", "dirt-to-sand", "road"]),
    ("ground-asphalt-moss-grass-a", ATTACHMENTS / "ChatGPT Image Jul 8, 2026, 10_24_06 PM.png", "road", ["road", "grass", "grass-to-dirt"]),
    ("ground-cracked-asphalt-concrete-a", ATTACHMENTS / "ChatGPT Image Jul 8, 2026, 10_22_49 PM.png", "road", ["road", "dirt"]),
    ("ground-sand-dune-dirt-a", ATTACHMENTS / "ChatGPT Image Jul 8, 2026, 10_22_13 PM.png", "sand", ["sand", "dirt-to-sand", "dirt"]),
    ("ground-water-grass-shore-a", ATTACHMENTS / "ChatGPT Image Jul 8, 2026, 10_20_39 PM.png", "water", ["water", "shore", "grass", "sand"]),
    ("ground-rock-gravel-dirt-a", ATTACHMENTS / "ChatGPT Image Jul 8, 2026, 10_20_33 PM.png", "rocky", ["rocky", "dirt", "grass"]),
    ("ground-dark-grass-puddles-a", ATTACHMENTS / "ChatGPT Image Jul 8, 2026, 08_58_37 PM.png", "grass", ["grass", "water", "shore"]),
    ("ground-rock-grass-dirt-b", ATTACHMENTS / "ChatGPT Image Jul 8, 2026, 08_52_18 PM-2.png", "rocky", ["grass", "dirt", "rocky"]),
    ("ground-grass-dirt-path-b", ATTACHMENTS / "ChatGPT Image Jul 8, 2026, 08_50_57 PM-2.png", "grass", ["grass", "dirt", "grass-to-dirt"]),
    ("megatexture-water-rock-dirt-a", ATTACHMENTS / "Megatexture-groundtile-02.png", "shore", ["water", "shore", "dirt", "rocky"]),
    ("megatexture-grass-path-a", ATTACHMENTS / "Megatexture-groundtile-01.png", "grass", ["grass", "dirt", "grass-to-dirt"]),
    ("megatexture-shore-grass-rock-a", ATTACHMENTS / "Megatexture-groundtile-03.png", "shore", ["water", "shore", "grass", "rocky"]),
    ("jul9-master-ground-terrain-a", ATTACHMENTS / "jul9-master-ground-terrain.png", "dirt", ["grass", "dirt", "rocky", "sand", "grass-to-dirt", "dirt-to-sand"]),
    ("jul9-transition-ground-edges-a", ATTACHMENTS / "jul9-transition-ground-edges.png", "grass-to-dirt", ["grass", "dirt", "road", "shore", "water", "grass-to-dirt", "grass-to-road", "dirt-to-sand"]),
    ("jul9-street-asphalt-parking-a", ATTACHMENTS / "jul9-street-asphalt-terrain.png", "road", ["road", "grass-to-road", "dirt"]),
    ("jul9-water-shore-mud-a", ATTACHMENTS / "jul9-water-shore-mud-terrain.png", "shore", ["water", "shore", "dirt", "grass"]),
    ("jul9-neighborhood-ground-a", ATTACHMENTS / "jul9-neighborhood-ground-terrain.png", "grass", ["grass", "dirt", "road", "grass-to-road"]),
    ("jul9-lakeside-pond-a", ATTACHMENTS / "jul9-lakeside-pond-terrain.png", "water", ["water", "shore", "grass", "dirt"]),
    ("jul9-park-path-plaza-a", ATTACHMENTS / "jul9-park-path-plaza-terrain.png", "grass", ["grass", "dirt", "road", "grass-to-road"]),
    ("jul9-road-transition-a", ATTACHMENTS / "jul9-road-transition-terrain.png", "road", ["road", "grass-to-road", "dirt"]),
]

VARIABLE_GROUND_SHEETS = [
    ("jul9-extraction-plaza-b", ATTACHMENTS / "ChatGPT Image Jul 9, 2026, 10_29_39 PM.png", "road", ["road", "rocky", "grass-to-road"], 4, 4),
    ("jul9-riverbank-slabs-b", ATTACHMENTS / "ChatGPT Image Jul 9, 2026, 10_33_15 PM.png", "shore", ["water", "shore", "rocky"], 6, 4),
    ("jul9-rapid-water-b", ATTACHMENTS / "ChatGPT Image Jul 9, 2026, 10_49_58 PM.png", "water", ["water", "shore"], 6, 4),
]

ENVIRONMENT_PROP_SHEETS = [
    ("jul9-tree-brush", ATTACHMENTS / "jul9-tree-brush-props.png", 4, 4, "tree", [
        "small-dead-tree", "small-leafy-tree", "scrubby-pine", "burnt-sapling",
        "medium-dead-tree", "medium-oak", "crooked-pine", "trash-branch-tree",
        "large-gnarled-tree", "large-dead-trunk", "dense-bush", "bramble-cluster",
        "two-tree-cluster", "stump-roots", "fallen-log", "bush-rock-cluster",
    ]),
    ("jul9-vehicles-street-junk", ATTACHMENTS / "jul9-vehicle-street-junk-props.png", 4, 4, "vehicle", [
        "rusted-compact-car", "burned-sedan", "pickup-wreck", "armored-cash-van-wreck",
        "barrel-cone-cluster", "tire-pile", "broken-streetlight", "cracked-vending-machine",
        "trash-heap", "wooden-crate-stack", "metal-barricade", "chainlink-fence",
        "gas-pump-pair", "crypto-atm-wreck", "generator-box", "roadside-sign-frame",
    ]),
    ("jul9-buildings-landmarks", ATTACHMENTS / "jul9-building-landmark-props.png", 4, 3, "landmark", [
        "roadside-store", "gas-station-kiosk", "farm-shed",
        "collapsed-mining-shack", "loan-office-front", "motel-office",
        "ruined-garage", "billboard-frame", "utility-shed",
        "power-pole-cluster", "water-tower", "boarded-house-porch",
    ]),
    ("jul9-rocks-boulders", ATTACHMENTS / "jul9-rock-boulder-props.png", 5, 5, "rock", [
        "single-stone", "pebble-pile", "mossy-rock", "cracked-stone", "dark-shale",
        "round-boulder", "angular-boulder", "stacked-rocks", "lichen-boulder", "broken-stone-slab",
        "tall-boulder", "two-boulder-cover", "cave-mouth-rock", "mining-outcrop", "jagged-wasteland-rock",
        "short-cliff-face", "eroded-dirt-ledge", "rocky-ridge-chunk", "gravel-mound", "broken-retaining-wall",
        "ltc-carved-stone", "mining-rubble-pile", "cracked-concrete-chunk", "warning-marker-rock", "bone-rock-pile",
    ]),
    ("jul9-landmark-microscene", ATTACHMENTS / "jul9-landmark-microscene-props.png", 4, 4, "landmark", [
        "dry-forest-cave", "ruined-camp", "roadside-checkpoint", "broken-picnic-area",
        "atm-kiosk-wreck", "vending-nook", "toll-booth", "payphone-shelter",
        "coin-pile-shrine", "broken-arcade-cabinet", "trader-stall", "generator-camp",
        "drainage-culvert", "ditch-bridge-crossing", "cracked-concrete-pad", "water-pump-station",
    ]),
    ("jul9-industrial-mining", ATTACHMENTS / "jul9-industrial-mining-props.png", 4, 4, "industrial", [
        "mining-rig-rack", "server-rack-wreck", "cooling-fan-unit", "small-generator",
        "cable-spool", "tangled-cables", "transformer-box", "battery-bank",
        "shipping-crate", "metal-pallet", "coolant-barrels", "scrap-electronics",
        "antenna-mast", "solar-panel-wreck", "satellite-dish", "utility-transformer",
    ]),
    ("jul9-fences-barricades", ATTACHMENTS / "jul9-fences-barricades-props.png", 5, 5, "boundary", [
        "wood-fence-straight", "short-wood-fence", "broken-wood-fence", "wood-fence-corner", "wood-gate",
        "chainlink-straight", "broken-chainlink", "chainlink-corner", "open-chainlink-gate", "fallen-chainlink-panel",
        "concrete-barrier", "cracked-jersey-barrier", "sandbag-barrier", "metal-road-barricade", "roadblock-cluster",
        "ruined-wall-chunk", "brick-wall-segment", "collapsed-wall", "retaining-wall", "burned-wall-panel",
        "crate-fence-cluster", "barrel-barricade-cluster", "rubble-barricade", "broken-gate-post", "warning-post",
    ]),
    ("jul9-roadside-buildings-large", ATTACHMENTS / "jul9-roadside-buildings-large.png", 2, 2, "building_large", [
        "motel-office-front", "gas-station-service-canopy", "roadside-convenience-store", "laundromat-wash-house",
    ]),
    ("jul9-civic-buildings-large", ATTACHMENTS / "jul9-civic-buildings-large.png", 2, 2, "building_large", [
        "town-hall-front", "old-fire-station", "small-clinic-office", "community-center-front",
    ]),
    ("jul9-industrial-buildings-large", ATTACHMENTS / "jul9-industrial-buildings-large.png", 2, 2, "building_large", [
        "warehouse-rollup-front", "auto-repair-garage", "power-utility-building", "crypto-mining-service-shed",
    ]),
    ("jul9-residential-block-buildings-large", ATTACHMENTS / "jul9-residential-block-buildings-large.png", 2, 2, "building_large", [
        "two-story-apartment-block", "worn-duplex-building", "rowhouse-corner-facade", "boarding-house-front",
    ]),
    ("jul9-main-street-storefronts-large", ATTACHMENTS / "jul9-main-street-storefronts-large.png", 2, 2, "building_large", [
        "boarded-general-store", "old-diner-front", "bank-loan-office-front", "collapsed-corner-shop",
    ]),
    ("jul9-garages-sheds-large", ATTACHMENTS / "jul9-garages-sheds-large.png", 2, 2, "building_large", [
        "detached-garage", "backyard-shed", "torn-carport-frame", "workshop-shack",
    ]),
    ("jul9-residential-house-facades-large", ATTACHMENTS / "jul9-residential-house-facades-large.png", 2, 2, "building_large", [
        "boarded-ranch-house", "two-story-farmhouse", "split-level-garage-house", "rental-duplex-facade",
    ]),
    ("jul9-neighborhood-fences-hedges", ATTACHMENTS / "jul9-neighborhood-fences-hedges.png", 5, 5, "boundary", [
        "picket-fence-segment", "broken-picket-fence", "picket-fence-corner", "open-picket-gate", "fallen-picket-section",
        "privacy-fence-segment", "broken-privacy-fence", "privacy-fence-corner", "sagging-wooden-gate", "missing-board-fence",
        "chainlink-residential-fence", "bent-chainlink-fence", "chainlink-residential-corner", "open-chainlink-residential-gate", "fallen-chainlink-roll",
        "hedge-segment", "overgrown-hedge", "hedge-corner", "dead-hedge", "hedge-with-gap",
        "mailbox-fence-cluster", "trash-can-fence-cluster", "hedge-rock-edge", "broken-gate-posts", "low-yard-barrier",
    ]),
    ("jul9-neighborhood-yard-clutter", ATTACHMENTS / "jul9-neighborhood-yard-clutter.png", 5, 5, "yard", [
        "mailbox", "broken-mailbox", "yard-light", "blank-address-post", "cracked-birdbath",
        "lawn-chair", "tipped-lawn-chair", "cooler", "charcoal-grill", "wheelbarrow",
        "tire-stack", "woodpile", "garden-hose-coil", "tarp-covered-object", "toolbox-crate",
        "garbage-bag-pile", "trash-can", "tipped-trash-can", "cracked-planter", "dead-flower-pot",
        "mailbox-weeds", "chair-cooler", "grill-crates", "hose-tools", "abandoned-yard-corner",
    ]),
    ("jul9-park-rest-area", ATTACHMENTS / "jul9-park-rest-area-props.png", 5, 5, "park", [
        "park-bench", "broken-park-bench", "picnic-table", "overturned-picnic-table", "park-trash-can",
        "park-light-post", "cracked-drinking-fountain", "bike-rack", "blank-newspaper-box", "blank-map-board",
        "broken-swing-frame", "cracked-slide-piece", "sandbox-edge", "spring-rider-wreck", "playground-rubble",
        "planter-box", "dead-flower-bed", "low-hedge-planter", "tree-planter", "concrete-planter-barrier",
        "bench-trash-cluster", "picnic-cooler-cluster", "broken-playground-cluster", "planter-lamp-cluster", "park-entry-posts",
    ]),
    ("jul9-neighborhood-combo", ATTACHMENTS / "jul9-neighborhood-combo-props.png", 5, 5, "yard", [
        "mailbox-alt", "broken-mailbox-alt", "yard-lantern", "blank-yard-post", "birdbath-alt",
        "folding-lawn-chair", "patched-lawn-chair", "cooler-alt", "kettle-grill", "rusty-wheelbarrow",
        "picket-fence-short", "picket-fence-broken", "chainlink-short", "hedge-short", "garden-border",
        "tire-stack-alt", "open-stash-crate", "tarp-object-alt", "woodpile-alt", "hose-coil-alt",
        "weedy-yard-cluster", "yard-chair-cluster", "grill-yard-cluster", "trash-bin-cluster", "brush-hole-cluster",
    ]),
    ("jul9-creek-canal-culvert", ATTACHMENTS / "jul9-creek-canal-culvert-props.png", 4, 4, "water", [
        "concrete-culvert-mouth", "metal-pipe-outflow", "storm-drain-grate", "drainage-ditch-intake",
        "small-footbridge", "broken-footbridge", "plank-crossing", "concrete-slab-crossing",
        "pump-station-box", "water-valve-cluster", "rusty-pipe-cluster", "sewer-access-hatch",
        "reeds-around-pipe", "trash-caught-in-grate", "muddy-culvert-bank", "broken-canal-wall",
    ]),
    ("jul9-small-cover-loot", ATTACHMENTS / "jul9-small-cover-loot-props.png", 5, 5, "cover", [
        "low-crate-stack", "broken-pallet", "short-concrete-block", "trash-pile", "sandbag-nub",
        "abstract-coin-pile", "ammo-crate-blank", "glowing-pickup-pedestal", "small-stash-box", "broken-cash-bag",
        "spark-box", "oil-puddle-marker", "exposed-wire-coil", "small-fire-barrel", "smoking-battery",
        "cone-cluster", "warning-post-blank", "cracked-road-marker", "low-bollard", "wordless-barricade-arrow",
        "crate-barrel-cover", "pallet-cable-pile", "coin-stash-rubble", "small-generator-cover", "broken-checkpoint-clutter",
    ]),
    ("jul9-power-yard-extraction", ATTACHMENTS / "jul9-power-yard-extraction-props.png", 5, 4, "industrial", [
        "lit-extraction-beacon", "small-power-pylon", "warning-light-tripod", "blank-crypto-terminal",
        "generator-bank", "battery-cabinet", "transformer-cluster", "cooling-fan-tower",
        "cable-trench", "bundled-power-cables", "broken-conduit-bridge", "glowing-floor-pad-edge",
        "beacon-crates", "power-yard-barricade", "cable-spool-checkpoint", "dead-server-shrine",
        "extraction-pad-base", "lit-stanchion-pair", "power-spool-platform", "server-shrine-cluster",
    ]),
    ("jul9-cliff-ditch-boundary", ATTACHMENTS / "jul9-cliff-ditch-boundary-props.png", 5, 5, "boundary", [
        "low-dirt-ledge", "low-dirt-ledge-corner", "cracked-rock-ledge", "eroded-embankment", "dry-ditch-lip",
        "short-cliff-face-alt", "jagged-rock-wall", "broken-retaining-wall-alt", "muddy-drainage-wall", "timber-bank-wall",
        "culvert-side-wall", "small-plank-crossing", "broken-concrete-crossing", "washed-out-road-edge", "ditch-rubble-edge",
        "boulder-wall-segment", "rubble-slope", "collapsed-bank", "cave-edge-wall", "dry-creek-wall",
        "cliff-weeds", "ditch-reeds", "road-cut-barrier", "water-eroded-bank", "rocky-arena-edge",
    ]),
    ("jul9-ghost-town-facade-modules", ATTACHMENTS / "jul9-ghost-town-facade-modules.png", 4, 4, "landmark", [
        "boarded-storefront-front", "motel-office-facade", "ruined-pawnshop-blank", "collapsed-roadside-shop",
        "side-wall-module", "corner-storefront-module", "roofline-awning-module", "broken-porch-front",
        "small-garage-front", "rollup-door-facade", "boarded-window-wall", "alley-service-door",
        "storefront-crates", "boarded-shop-fence", "collapsed-awning-scene", "arcade-front-shell-blank",
    ]),
    ("jul9-vegetation-crop-edge", ATTACHMENTS / "jul9-vegetation-crop-edge-props.png", 5, 5, "vegetation", [
        "short-grass-clump", "tall-grass-clump", "dead-grass-clump", "yellow-weeds", "dark-weeds",
        "reed-cluster", "cattails", "swamp-grass", "muddy-reeds", "water-edge-brush",
        "dead-corn-stalks", "broken-crop-row", "dry-farm-weeds", "hay-clump", "trampled-field-edge",
        "thorn-bush", "burnt-bush", "low-hedge", "berry-bush", "scraggly-roadside-shrub",
        "weeds-around-stump", "reeds-around-puddle", "grass-rock-cluster", "crop-edge-barrier", "dead-brush-wall",
    ]),
    ("jul9-extraction-monuments-b", ATTACHMENTS / "ChatGPT Image Jul 9, 2026, 10_29_22 PM.png", 2, 2, "landmark", [
        "extraction-arch", "closed-boss-gate", "open-boss-gate", "ltc-beacon-pad",
    ]),
    ("jul9-neighborhood-small-props-b", ATTACHMENTS / "ChatGPT Image Jul 9, 2026, 10_30_16 PM.png", 2, 2, "yard", [
        "weathered-picket-fence", "trash-can-bags", "mailbox-weeds", "stone-well",
    ]),
    ("jul9-forest-obstacles-b", ATTACHMENTS / "ChatGPT Image Jul 9, 2026, 10_30_24 PM.png", 2, 2, "forest", [
        "mossy-fallen-log", "rooted-tree-stump", "forest-boulder-cluster", "rotting-log-pile",
    ]),
    ("jul9-river-obstacles-b", ATTACHMENTS / "ChatGPT Image Jul 9, 2026, 10_32_40 PM.png", 4, 2, "water", [
        "waterlogged-log", "concrete-river-block", "submerged-stone-slab", "broken-spillway",
        "river-boulder-cluster", "submerged-cart-wreck", "shallow-rapid-strip", "deep-rapid-strip",
    ]),
    ("jul9-route-signs-beacons-b", ATTACHMENTS / "ChatGPT Image Jul 9, 2026, 10_32_52 PM.png", 6, 4, "signal", [
        "amber-hanging-lamp", "amber-lantern-sign", "green-hanging-sign", "green-double-sign",
        "amber-route-sign", "green-route-sign", "green-crossroad-sign", "green-town-sign",
        "amber-short-lamp", "cyan-short-lamp", "cyan-beacon-post", "cyan-square-beacon",
        "low-rock-marker", "mossy-rock-marker", "broken-log-marker", "low-stone-marker",
        "amber-bollard", "cyan-bollard", "amber-pylon", "cyan-pylon",
        "green-floor-marker", "stone-floor-marker", "cyan-floor-marker", "broken-floor-marker",
    ]),
    ("jul9-desert-props-b", ATTACHMENTS / "ChatGPT Image Jul 9, 2026, 10_33_09 PM.png", 2, 2, "desert", [
        "desert-brush-cluster", "bone-pile", "rusted-buried-barrel", "sandstone-rubble",
    ]),
    ("jul9-desert-rock-formations-b", ATTACHMENTS / "ChatGPT Image Jul 9, 2026, 10_49_43 PM.png", 3, 2, "rock", [
        "sandstone-arch", "hollow-skull-rock", "cracked-flat-rock", "sandstone-spire",
        "cracked-flat-rock-alt", "sandstone-spire-alt",
    ]),
    ("jul9-ambient-water-glow-b", ATTACHMENTS / "ChatGPT Image Jul 9, 2026, 10_49_53 PM.png", 4, 4, "ambient", [
        "firefly-drift-01", "firefly-drift-02", "firefly-drift-03", "firefly-drift-04",
        "moss-glow-01", "moss-glow-02", "moss-glow-03", "moss-glow-04",
        "water-glint-01", "water-glint-02", "water-glint-03", "water-glint-04",
        "water-spark-01", "water-spark-02", "water-spark-03", "water-spark-04",
    ]),
]
AUTO_MATTE_PROP_SHEETS = frozenset({
    "jul9-extraction-monuments-b",
    "jul9-neighborhood-small-props-b",
    "jul9-forest-obstacles-b",
    "jul9-river-obstacles-b",
    "jul9-route-signs-beacons-b",
    "jul9-desert-props-b",
    "jul9-desert-rock-formations-b",
    "jul9-ambient-water-glow-b",
})
TREE_ROWS = [
    ("juniper-tree", "dusty desert juniper / scrub pine"),
    ("dead-tree", "dead twisted wasteland mesquite"),
    ("cottonwood-tree", "roadside cottonwood / battered broadleaf"),
]

FOREST_LABELS = [
    "single-pine", "single-broadleaf", "dead-twisted-tree", "stump-root-debris",
    "two-tree-narrow", "two-tree-wide", "mixed-three-tree-cluster", "dense-thicket",
    "left-edge", "right-edge", "back-edge", "front-edge",
    "dense-block", "corner-cluster", "sparse-gap", "dead-accent-cluster",
]

GROUND_LABELS = [
    "base-01", "base-02", "base-03", "base-04", "base-05",
    "blend-01", "blend-02", "blend-03", "blend-04", "blend-05",
    "edge-01", "edge-02", "edge-03", "edge-04", "edge-05",
    "detail-01", "detail-02", "detail-03", "detail-04", "detail-05",
    "accent-01", "accent-02", "accent-03", "accent-04", "accent-05",
]


def rel_portal(path: Path) -> str:
    return "./" + path.relative_to(PORTAL).as_posix()


def grid_crop(image: Image.Image, rows: int, cols: int, row: int, col: int) -> Image.Image:
    width, height = image.size
    left = round(col * width / cols)
    top = round(row * height / rows)
    right = round((col + 1) * width / cols)
    bottom = round((row + 1) * height / rows)
    return image.crop((left, top, right, bottom))


def crop_cell_border(cell: Image.Image, inset: int = 5) -> Image.Image:
    # ChatGPT contact sheets often have 1-3px light grid separators between
    # cells. Drop that border before chroma keying so white divider lines do not
    # become in-game prop pixels. Terrain sheets keep full-cell art elsewhere.
    if cell.width <= inset * 2 or cell.height <= inset * 2:
        return cell
    return cell.crop((inset, inset, cell.width - inset, cell.height - inset))


def magenta_key(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    px = rgba.load()
    width, height = rgba.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = px[x, y]
            # ChatGPT magenta backgrounds land around #F702FA/#FB02FB/#FF00FF.
            # Keep foliage: only remove high-red/high-blue and very low-green pixels.
            magenta_energy = min(r, b) - g
            if r >= 170 and b >= 170 and g <= 135 and abs(r - b) <= 95:
                px[x, y] = (r, g, b, 0)
            elif r >= 120 and b >= 120 and g <= 145 and abs(r - b) <= 110 and magenta_energy >= 34:
                px[x, y] = (r, g, b, 0)
            elif r >= 95 and b >= 90 and g <= 150 and abs(r - b) <= 125 and magenta_energy >= 18:
                # Soften antialias fringes instead of leaving pink halos.
                px[x, y] = (r, g, b, min(a, 38))
    cleaned = rgba.filter(ImageFilter.MedianFilter(size=3))
    # A second fringe pass catches isolated hot-pink antialias pixels that the
    # median step can pull inward around leaf clusters and roots.
    px = cleaned.load()
    for y in range(height):
        for x in range(width):
            r, g, b, a = px[x, y]
            purple_fringe = r >= 80 and b >= 75 and g <= 135 and b > g * 1.18 and r > g * 1.05 and ((r + b) / 2 - g) >= 16
            if a and (
                (r >= 105 and b >= 95 and g <= 155 and abs(r - b) <= 125 and (min(r, b) - g) >= 18)
                or purple_fringe
            ):
                px[x, y] = (r, g, b, 0)
    return cleaned


def has_useful_alpha(image: Image.Image) -> bool:
    return "A" in image.getbands() and image.getchannel("A").getextrema()[0] < 250


def has_magenta_matte(image: Image.Image) -> bool:
    rgb = image.convert("RGB")
    probes = [
        rgb.getpixel((0, 0)),
        rgb.getpixel((rgb.width - 1, 0)),
        rgb.getpixel((0, rgb.height - 1)),
        rgb.getpixel((rgb.width - 1, rgb.height - 1)),
    ]
    return sum(1 for r, g, b in probes if r >= 170 and b >= 170 and g <= 135) >= 2


def clear_light_edge_background(image: Image.Image) -> Image.Image:
    """Flood-clear ChatGPT's baked white/checkerboard matte without erasing prop interiors."""
    rgba = image.convert("RGBA")
    px = rgba.load()
    width, height = rgba.size
    seen = bytearray(width * height)
    stack = []
    for x in range(width):
        stack.extend([(x, 0), (x, height - 1)])
    for y in range(height):
        stack.extend([(0, y), (width - 1, y)])
    while stack:
        x, y = stack.pop()
        index = y * width + x
        if seen[index]:
            continue
        seen[index] = 1
        r, g, b, _a = px[x, y]
        neutral_light = max(r, g, b) - min(r, g, b) <= 20 and min(r, g, b) >= 205
        if not neutral_light:
            continue
        px[x, y] = (r, g, b, 0)
        if x > 0:
            stack.append((x - 1, y))
        if x + 1 < width:
            stack.append((x + 1, y))
        if y > 0:
            stack.append((x, y - 1))
        if y + 1 < height:
            stack.append((x, y + 1))
    return rgba


def prop_alpha(image: Image.Image) -> Image.Image:
    if has_useful_alpha(image):
        return image.convert("RGBA")
    if has_magenta_matte(image):
        return magenta_key(image)
    return clear_light_edge_background(image)


def normalize_prop(cell: Image.Image, canvas_size: int = 256, max_fill: int = 236, preserve_small: bool = False, matte_mode: str = "magenta") -> Image.Image:
    keyed = prop_alpha(cell) if matte_mode == "auto" else magenta_key(cell)
    bbox = keyed.getbbox()
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    if not bbox:
        return canvas
    sprite = keyed.crop(bbox)
    # Preserve canopy/root proportions and transparent breathing room.
    scale = min(max_fill / max(sprite.width, 1), max_fill / max(sprite.height, 1), 1.35)
    new_size = (max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale)))
    sprite = sprite.resize(new_size, Image.Resampling.LANCZOS)
    # Pixel-art polish: sharpen after resize, but do not quantize away foliage colors.
    sprite = ImageEnhance.Sharpness(sprite).enhance(1.35)
    x = (canvas_size - sprite.width) // 2
    y = canvas_size - sprite.height - 10
    canvas.alpha_composite(sprite, (x, y))
    return canvas if preserve_small else remove_tiny_alpha_islands(canvas)


def remove_tiny_alpha_islands(image: Image.Image, min_pixels: int = 90) -> Image.Image:
    """Drop disconnected chroma-key specks/slivers without trimming real canopies."""
    rgba = image.convert("RGBA")
    px = rgba.load()
    width, height = rgba.size
    seen = bytearray(width * height)
    for sy in range(height):
        for sx in range(width):
            start = sy * width + sx
            if seen[start] or px[sx, sy][3] <= 24:
                seen[start] = 1
                continue
            stack = [(sx, sy)]
            seen[start] = 1
            component = []
            while stack:
                x, y = stack.pop()
                component.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if nx < 0 or ny < 0 or nx >= width or ny >= height:
                        continue
                    idx = ny * width + nx
                    if seen[idx]:
                        continue
                    seen[idx] = 1
                    if px[nx, ny][3] > 24:
                        stack.append((nx, ny))
            if len(component) < min_pixels:
                for x, y in component:
                    r, g, b, _ = px[x, y]
                    px[x, y] = (r, g, b, 0)
    return rgba


def make_iso_tile(cell: Image.Image, size: int = 56) -> Image.Image:
    # Terrain is full-cell art. Convert it to a transparent isometric diamond that
    # the existing renderer can draw in the same path as PixelLab iso tiles.
    texture = cell.convert("RGB")
    texture = ImageEnhance.Color(texture).enhance(1.08)
    texture = ImageEnhance.Contrast(texture).enhance(1.08)
    texture = ImageEnhance.Sharpness(texture).enhance(1.18)
    texture = texture.resize((size, size), Image.Resampling.LANCZOS).convert("RGBA")
    mask = Image.new("L", (size, size), 0)
    draw = Image.new("L", (size, size), 0)
    # Draw a crisp diamond by filling row spans.
    mp = mask.load()
    center = (size - 1) / 2
    for y in range(size):
        half = int((size / 2) - abs(y - center))
        left = max(0, int(center - half))
        right = min(size - 1, int(center + half))
        for x in range(left, right + 1):
            mp[x, y] = 255
    texture.putalpha(mask)
    return texture


def make_texture_tile(cell: Image.Image, size: int = 160) -> Image.Image:
    """Opaque square texture for the pattern-based terrain renderer."""
    texture = cell.convert("RGB")
    texture = ImageEnhance.Color(texture).enhance(1.08)
    texture = ImageEnhance.Contrast(texture).enhance(1.08)
    texture = ImageEnhance.Sharpness(texture).enhance(1.16)
    return texture.resize((size, size), Image.Resampling.LANCZOS)


VARIABLE_GROUND_BASE_COLORS = {
    "road": (78, 75, 69, 255),
    "shore": (71, 89, 82, 255),
    "water": (31, 86, 102, 255),
}


def make_variable_texture_tile(cell: Image.Image, primary_role: str, size: int = 160) -> Image.Image:
    """Normalize isolated alpha/checkerboard isometric tiles into opaque terrain textures."""
    isolated = prop_alpha(cell)
    bbox = isolated.getbbox()
    base = Image.new("RGBA", (size, size), VARIABLE_GROUND_BASE_COLORS.get(primary_role, (82, 72, 58, 255)))
    if not bbox:
        return base.convert("RGB")
    sprite = isolated.crop(bbox)
    scale = min((size - 6) / max(sprite.width, 1), (size - 6) / max(sprite.height, 1))
    sprite = sprite.resize((max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale))), Image.Resampling.LANCZOS)
    x = (size - sprite.width) // 2
    y = (size - sprite.height) // 2
    base.alpha_composite(sprite, (x, y))
    texture = ImageEnhance.Color(base.convert("RGB")).enhance(1.06)
    texture = ImageEnhance.Contrast(texture).enhance(1.06)
    return ImageEnhance.Sharpness(texture).enhance(1.14)


def variable_ground_label(row: int, col: int) -> str:
    return f"tile-r{row + 1}-c{col + 1}"


def write_json(path: Path, data: object) -> None:
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def write_module(path: Path, const_name: str, data: object) -> None:
    path.write_text(
        f"export const {const_name} = Object.freeze({json.dumps(data, indent=2)});\n",
        encoding="utf-8",
    )


def ensure_sources(paths: Iterable[Path]) -> None:
    missing = [str(p) for p in paths if not p.exists()]
    if missing:
        raise FileNotFoundError("Missing source sheet(s):\n" + "\n".join(missing))


def material_roles_for_cell(sheet_slug: str, default_roles: list[str], row: int, col: int) -> list[str]:
    if sheet_slug == "jul9-master-ground-terrain-a":
        by_row = [
            ["grass"],
            ["grass", "dirt", "grass-to-dirt"],
            ["rocky", "dirt"],
            ["sand", "dirt-to-sand", "dirt"],
            ["dirt", "rocky", "grass-to-dirt"],
        ]
        return by_row[row]
    if sheet_slug == "jul9-transition-ground-edges-a":
        by_row = [
            ["grass", "dirt", "grass-to-dirt"],
            ["grass", "road", "grass-to-road"],
            ["dirt", "road", "dirt-to-sand"],
            ["grass", "shore", "water"],
            ["road", "dirt", "grass-to-dirt"],
        ]
        return by_row[row]
    if sheet_slug == "jul9-street-asphalt-parking-a":
        by_row = [
            ["road"],
            ["road", "grass-to-road", "dirt"],
            ["road"],
            ["road", "dirt"],
            ["road", "rocky", "dirt"],
        ]
        return by_row[row]
    if sheet_slug == "jul9-water-shore-mud-a":
        by_row = [
            ["water", "shore"],
            ["dirt", "shore", "water"],
            ["dirt", "water", "road"],
            ["grass", "shore", "water"],
            ["dirt", "sand", "water", "rocky"],
        ]
        return by_row[row]
    if sheet_slug == "jul9-neighborhood-ground-a":
        by_row = [
            ["grass"],
            ["dirt", "road", "grass-to-road"],
            ["road", "grass-to-road"],
            ["grass", "dirt", "grass-to-dirt"],
            ["grass", "dirt", "road"],
        ]
        return by_row[row]
    if sheet_slug == "jul9-lakeside-pond-a":
        by_row = [
            ["water"],
            ["shore", "grass", "water"],
            ["dirt", "shore", "water"],
            ["grass", "shore", "water"],
            ["water", "shore", "dirt"],
        ]
        return by_row[row]
    if sheet_slug == "jul9-park-path-plaza-a":
        by_row = [
            ["grass"],
            ["dirt", "grass-to-dirt"],
            ["road", "grass-to-road"],
            ["grass-to-road", "dirt", "road"],
            ["grass", "dirt", "road"],
        ]
        return by_row[row]
    if sheet_slug == "jul9-road-transition-a":
        by_row = [
            ["road"],
            ["road", "grass-to-road", "dirt"],
            ["road", "grass-to-road"],
            ["road", "dirt"],
            ["road", "rocky", "dirt"],
        ]
        return by_row[row]
    return default_roles


def main() -> None:
    ensure_sources([
        TREE_SHEET,
        *(p for _slug, p, _trees in NEW_TREE_ANIMATION_SHEETS),
        *(p for _, p in FOREST_SHEETS),
        *(p for _, p, _role, _materials in GROUND_SHEETS),
        *(p for _, p, _role, _materials, _rows, _cols in VARIABLE_GROUND_SHEETS),
        *(p for _, p, _rows, _cols, _category, _labels in ENVIRONMENT_PROP_SHEETS),
    ])
    OUT.mkdir(parents=True, exist_ok=True)
    COHERENT_OUT.mkdir(parents=True, exist_ok=True)

    tree_animations = []
    tree_img = Image.open(TREE_SHEET)
    for row, (tree_slug, description) in enumerate(TREE_ROWS):
        frames = []
        for col in range(6):
            cell = grid_crop(tree_img, 3, 6, row, col)
            frame = normalize_prop(cell)
            frame_dir = OUT / "props" / "trees" / tree_slug / "idle"
            frame_dir.mkdir(parents=True, exist_ok=True)
            frame_path = frame_dir / f"{col:02d}.png"
            frame.save(frame_path, optimize=True)
            frames.append({
                "id": f"{tree_slug}-idle-{col:02d}",
                "src": rel_portal(frame_path),
                "width": frame.width,
                "height": frame.height,
                "frame": col,
            })
            if col == 0:
                coherent = COHERENT_OUT / f"{tree_slug}-idle-00.png"
                frame.save(coherent, optimize=True)
        tree_animations.append({
            "slug": f"{tree_slug}-idle",
            "tree": tree_slug,
            "description": description,
            "loop": True,
            "frameDurationMs": 140,
            "frames": frames,
            "coherentWorldKey": f"curated/{tree_slug}-idle-00",
        })

    # The Jul 9 sheets are portrait grids: three tree variants across and six
    # animation frames down. Preserve that orientation instead of treating each
    # row as a different tree.
    for _sheet_slug, sheet_path, variants in NEW_TREE_ANIMATION_SHEETS:
        tree_img = Image.open(sheet_path)
        for col, (tree_slug, description) in enumerate(variants):
            frames = []
            for row in range(6):
                cell = grid_crop(tree_img, 6, 3, row, col)
                frame = normalize_prop(cell, matte_mode="auto")
                frame_dir = OUT / "props" / "trees" / tree_slug / "idle"
                frame_dir.mkdir(parents=True, exist_ok=True)
                frame_path = frame_dir / f"{row:02d}.png"
                frame.save(frame_path, optimize=True)
                frames.append({
                    "id": f"{tree_slug}-idle-{row:02d}",
                    "src": rel_portal(frame_path),
                    "width": frame.width,
                    "height": frame.height,
                    "frame": row,
                })
                if row == 0:
                    coherent = COHERENT_OUT / f"{tree_slug}-idle-00.png"
                    frame.save(coherent, optimize=True)
            tree_animations.append({
                "slug": f"{tree_slug}-idle",
                "tree": tree_slug,
                "description": description,
                "loop": True,
                "frameDurationMs": 140,
                "frames": frames,
                "coherentWorldKey": f"curated-tree/{tree_slug}-idle-00",
            })

    forest_props = []
    for sheet_slug, sheet_path in FOREST_SHEETS:
        img = Image.open(sheet_path)
        for row in range(4):
            for col in range(4):
                index = row * 4 + col
                label = FOREST_LABELS[index]
                cell = grid_crop(img, 4, 4, row, col)
                prop = normalize_prop(cell)
                prop_dir = OUT / "props" / "forest" / sheet_slug
                prop_dir.mkdir(parents=True, exist_ok=True)
                prop_path = prop_dir / f"{index:02d}-{label}.png"
                prop.save(prop_path, optimize=True)
                coherent_key = f"{sheet_slug}-{index:02d}"
                coherent_path = COHERENT_OUT / f"{coherent_key}.png"
                prop.save(coherent_path, optimize=True)
                forest_props.append({
                    "id": coherent_key,
                    "sheet": sheet_slug,
                    "label": label,
                    "grid": {"row": row + 1, "col": col + 1},
                    "src": rel_portal(prop_path),
                    "coherentWorldKey": f"curated/{coherent_key}",
                    "width": prop.width,
                    "height": prop.height,
                    "collision": "visual-first; use trunk/root footprint later, not full canopy",
                })

    environment_props = []
    for sheet_slug, sheet_path, rows, cols, category, labels in ENVIRONMENT_PROP_SHEETS:
        img = Image.open(sheet_path)
        prop_dir = OUT / "props" / "environment" / sheet_slug
        prop_dir.mkdir(parents=True, exist_ok=True)
        for row in range(rows):
            for col in range(cols):
                index = row * cols + col
                label = labels[index]
                cell = crop_cell_border(grid_crop(img, rows, cols, row, col))
                if category == "building_large":
                    prop = normalize_prop(cell, canvas_size=384, max_fill=356, matte_mode="auto" if sheet_slug in AUTO_MATTE_PROP_SHEETS else "magenta")
                else:
                    prop = normalize_prop(
                        cell,
                        canvas_size=256,
                        max_fill=232 if category in {"tree", "rock", "boundary"} else 238,
                        preserve_small=category == "ambient",
                        matte_mode="auto" if sheet_slug in AUTO_MATTE_PROP_SHEETS else "magenta",
                    )
                prop_path = prop_dir / f"{index:02d}-{label}.png"
                prop.save(prop_path, optimize=True)
                coherent_key = f"{sheet_slug}-{index:02d}-{label}"
                coherent_path = COHERENT_OUT / f"{coherent_key}.png"
                prop.save(coherent_path, optimize=True)
                environment_props.append({
                    "id": coherent_key,
                    "sheet": sheet_slug,
                    "label": label,
                    "category": category,
                    "grid": {"row": row + 1, "col": col + 1},
                    "src": rel_portal(prop_path),
                    "width": prop.width,
                    "height": prop.height,
                })

    ground_tiles = []
    ground_textures = []
    role_indexes = {}
    for sheet_slug, sheet_path, primary_role, material_roles in GROUND_SHEETS:
        img = Image.open(sheet_path)
        tile_dir = OUT / "ground" / sheet_slug
        texture_dir = OUT / "terrain-textures" / sheet_slug
        tile_dir.mkdir(parents=True, exist_ok=True)
        texture_dir.mkdir(parents=True, exist_ok=True)
        for row in range(5):
            for col in range(5):
                index = row * 5 + col
                label = GROUND_LABELS[index]
                slug = f"{sheet_slug}-r{row + 1}-c{col + 1}"
                cell = grid_crop(img, 5, 5, row, col)
                cell_material_roles = material_roles_for_cell(sheet_slug, material_roles, row, col)
                tile = make_iso_tile(cell)
                texture = make_texture_tile(cell)
                tile_path = tile_dir / f"{row + 1}-{col + 1}-{label}.png"
                texture_path = texture_dir / f"{row + 1}-{col + 1}-{label}.png"
                tile.save(tile_path, optimize=True)
                texture.save(texture_path, optimize=True)
                ground_tiles.append({
                    "id": slug,
                    "slug": slug,
                    "sheet": sheet_slug,
                    "label": label,
                    "grid": {"row": row + 1, "col": col + 1},
                    "src": rel_portal(tile_path),
                    "width": tile.width,
                    "height": tile.height,
                    "role": "isometric_tile",
                    "primaryTerrainRole": primary_role,
                    "materialRoles": cell_material_roles,
                })
                texture_key = f"chatgpt-terrain/{slug}"
                ground_textures.append({
                    "key": texture_key,
                    "slug": slug,
                    "sheet": sheet_slug,
                    "label": label,
                    "grid": {"row": row + 1, "col": col + 1},
                    "src": rel_portal(texture_path),
                    "width": texture.width,
                    "height": texture.height,
                    "role": primary_role,
                    "materialRoles": cell_material_roles,
                    "preferred": index in {0, 6, 12, 18, 24},
                })
                for role in cell_material_roles:
                    role_indexes.setdefault(role, []).append(texture_key)

    for sheet_slug, sheet_path, primary_role, material_roles, rows, cols in VARIABLE_GROUND_SHEETS:
        img = Image.open(sheet_path)
        tile_dir = OUT / "ground" / sheet_slug
        texture_dir = OUT / "terrain-textures" / sheet_slug
        tile_dir.mkdir(parents=True, exist_ok=True)
        texture_dir.mkdir(parents=True, exist_ok=True)
        for row in range(rows):
            for col in range(cols):
                index = row * cols + col
                label = variable_ground_label(row, col)
                slug = f"{sheet_slug}-r{row + 1}-c{col + 1}"
                cell = grid_crop(img, rows, cols, row, col)
                texture = make_variable_texture_tile(cell, primary_role)
                tile = make_iso_tile(texture)
                tile_path = tile_dir / f"{row + 1}-{col + 1}-{label}.png"
                texture_path = texture_dir / f"{row + 1}-{col + 1}-{label}.png"
                tile.save(tile_path, optimize=True)
                texture.save(texture_path, optimize=True)
                ground_tiles.append({
                    "id": slug,
                    "slug": slug,
                    "sheet": sheet_slug,
                    "label": label,
                    "grid": {"row": row + 1, "col": col + 1},
                    "src": rel_portal(tile_path),
                    "width": tile.width,
                    "height": tile.height,
                    "role": "isometric_tile",
                    "primaryTerrainRole": primary_role,
                    "materialRoles": material_roles,
                })
                texture_key = f"chatgpt-terrain/{slug}"
                ground_textures.append({
                    "key": texture_key,
                    "slug": slug,
                    "sheet": sheet_slug,
                    "label": label,
                    "grid": {"row": row + 1, "col": col + 1},
                    "src": rel_portal(texture_path),
                    "width": texture.width,
                    "height": texture.height,
                    "role": primary_role,
                    "materialRoles": material_roles,
                    "preferred": index == 0,
                })
                for role in material_roles:
                    role_indexes.setdefault(role, []).append(texture_key)

    manifest = {
        "id": "hmh-curated-level-art-chatgpt-2026-07-08",
        "generatedFrom": "Justin-approved ChatGPT Image tree, forest, and ground tile sheets; local source paths redacted",
        "gridCounts": {
            "treeIdleFrames": sum(len(tree["frames"]) for tree in tree_animations),
            "forestProps": len(forest_props),
            "environmentProps": len(environment_props),
            "groundTiles": len(ground_tiles),
            "groundTextures": len(ground_textures),
        },
        "runtime": {
            "coherentWorldRoot": "./assets/generated/hmh-coherent-world/curated",
            "groundRoot": "./assets/generated/hmh-curated-level-art/ground",
            "terrainTextureRoot": "./assets/generated/hmh-curated-level-art/terrain-textures",
            "propRoot": "./assets/generated/hmh-curated-level-art/props",
        },
        "treeAnimations": tree_animations,
        "forestProps": forest_props,
        "environmentProps": environment_props,
        "groundTiles": ground_tiles,
        "groundTextures": ground_textures,
        "terrainRoles": {role: keys for role, keys in sorted(role_indexes.items())},
        "recommendedGroundSlugs": {
            "grassDominant": "jul9-master-ground-terrain-a-r1-c1",
            "grassAccent": "jul9-transition-ground-edges-a-r1-c3",
            "forestFloor": "jul9-master-ground-terrain-a-r2-c1",
            "rockyAccent": "jul9-master-ground-terrain-a-r3-c3",
            "dirtPath": "jul9-master-ground-terrain-a-r2-c2",
            "water": "jul9-water-shore-mud-a-r1-c4",
            "shoreGrassWater": "jul9-water-shore-mud-a-r2-c5",
            "mudLowland": "jul9-water-shore-mud-a-r3-c1",
            "sand": "jul9-master-ground-terrain-a-r4-c3",
            "sandRoadBlend": "jul9-transition-ground-edges-a-r3-c2",
            "asphalt": "jul9-street-asphalt-parking-a-r1-c2",
            "parkingLot": "jul9-street-asphalt-parking-a-r3-c4",
            "grassRoadBlend": "jul9-street-asphalt-parking-a-r2-c4",
            "megaGrassPath": "jul9-master-ground-terrain-a-r2-c1",
        },
    }
    ground_manifest = {
        "id": manifest["id"] + "-ground-runtime",
        "generatedFrom": manifest["generatedFrom"],
        "gridCounts": {
            "groundTiles": len(ground_tiles),
            "groundTextures": len(ground_textures),
        },
        "runtime": {
            "groundRoot": manifest["runtime"]["groundRoot"],
            "terrainTextureRoot": manifest["runtime"]["terrainTextureRoot"],
        },
        "groundTiles": ground_tiles,
        "groundTextures": ground_textures,
        "terrainRoles": manifest["terrainRoles"],
        "recommendedGroundSlugs": {
            **manifest["recommendedGroundSlugs"],
            "neighborhoodLawn": "jul9-neighborhood-ground-a-r1-c1",
            "neighborhoodDriveway": "jul9-neighborhood-ground-a-r2-c2",
            "parkGrass": "jul9-park-path-plaza-a-r1-c2",
            "parkPath": "jul9-park-path-plaza-a-r2-c2",
            "lakesideWater": "jul9-lakeside-pond-a-r1-c2",
            "lakesideBank": "jul9-lakeside-pond-a-r2-c3",
            "roadJunction": "jul9-road-transition-a-r3-c3",
        },
    }
    role_code_by_name = {
        "grass": "g",
        "dirt": "d",
        "rocky": "k",
        "sand": "s",
        "road": "r",
        "shore": "h",
        "water": "w",
        "grass-to-dirt": "gd",
        "dirt-to-sand": "ds",
        "grass-to-road": "gr",
    }
    def encode_roles(roles: list[str]) -> str:
        return ",".join(role_code_by_name.get(role, role) for role in roles)

    compact_ground_runtime = {
        "id": manifest["id"] + "-compact-ground-runtime",
        "terrainTextureRoot": manifest["runtime"]["terrainTextureRoot"],
        "tileSize": 160,
        "roleCodes": {code: role for role, code in role_code_by_name.items()},
        "groundLabels": "|".join(GROUND_LABELS),
        "sheets": [
            [
                sheet_slug,
                role_code_by_name.get(primary_role, primary_role),
                "|".join(encode_roles(material_roles_for_cell(sheet_slug, material_roles, row, 0)) for row in range(5)),
                5,
                5,
            ]
            for sheet_slug, _sheet_path, primary_role, material_roles in GROUND_SHEETS
        ] + [
            [
                sheet_slug,
                role_code_by_name.get(primary_role, primary_role),
                "|".join(encode_roles(material_roles) for _row in range(rows)),
                rows,
                cols,
            ]
            for sheet_slug, _sheet_path, primary_role, material_roles, rows, cols in VARIABLE_GROUND_SHEETS
        ],
    }
    write_json(OUT / "hmh-curated-level-art.json", manifest)
    write_module(OUT / "hmh-curated-level-art.mjs", "HMH_CURATED_LEVEL_ART", manifest)
    write_json(OUT / "hmh-curated-ground-art.json", ground_manifest)
    write_module(OUT / "hmh-curated-ground-art.mjs", "HMH_CURATED_GROUND_ART", ground_manifest)
    write_json(OUT / "hmh-curated-ground-runtime.json", compact_ground_runtime)
    write_module(OUT / "hmh-curated-ground-runtime.mjs", "HMH_CURATED_GROUND_RUNTIME", compact_ground_runtime)
    print(json.dumps({
        "treeFrames": manifest["gridCounts"]["treeIdleFrames"],
        "forestProps": manifest["gridCounts"]["forestProps"],
        "environmentProps": manifest["gridCounts"]["environmentProps"],
        "groundTiles": manifest["gridCounts"]["groundTiles"],
        "groundTextures": manifest["gridCounts"]["groundTextures"],
        "out": str(OUT.relative_to(ROOT)),
    }, indent=2))


if __name__ == "__main__":
    main()

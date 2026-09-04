"""Deterministic seamless terrain tile bakery for Hard Money Heroes.

Playtest feedback: "the level design doesn't have very good terrain tiling and
it's hard to know what you're walking on, what's elevated, what's water."

The runtime drew every surface as a flat colour fill, so water, walkable
ground, road and raised decks were distinguishable only by hue. This bakes a
distinct, physically-shaded material per surface type.

Seamlessness is mathematical, not eyeballed: value noise is sampled on a
periodic lattice whose period divides the tile size, so the left edge is the
same lattice column as the right edge by construction. Tiles cannot seam.
Every later pass -- scatter stamps, ambient occlusion, the cast shadow -- is
built from wrapped neighbour reads (`np.roll`) for the same reason.

Shading is a real lit surface -- multi-octave height field -> screen-space
normal -> Lambert + specular against a fixed light -- so each material reads
as a physical substance rather than a colour.

Cycle 072 W-1 (v3, "lit micro-terrain"): the owner's standing verdict was
"still single color, no texture". Two things caused it. The runtime drew a
512-texel tile across 66.56 world units, point-sampling roughly every eighth
texel, so all baked detail collapsed into salt-and-pepper aliasing with a
visible 67px grid; the runtime repeat is now 399.36. And the bake had no
object-scale relief at all: no pebbles, no tufts, no contact shading. This
version adds a broad macro height component, hashed scatter stamps pressed
into the HEIGHT field before shading (so they receive the same real light as
everything else), a multi-scale wrapped ambient-occlusion term, and a
directional pseudo-shadow -- then vectorises the whole pipeline with numpy so
the extra work stays affordable.

Output is projection-only art: nothing here informs collision, elevation,
damage or AI.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "apps" / "portal" / "assets" / "generated" / "hmh-terrain-tiles"
TILE_SIZE = 512
# Authored periods below are tuned against the original 256px bake. Scaling
# them with the tile size keeps every feature the same size in world units --
# a bigger bake buys texel density, not bigger pebbles.
PERIOD_SCALE = TILE_SIZE // 256
PIPELINE_ID = "hmh-terrain-tiles-v3"

# Light direction for every material, so surfaces share one lighting model and
# read as one world. Normalised at use.
LIGHT = (-0.55, -0.72, 0.42)

UINT32 = np.uint64(0xFFFFFFFF)


def hex_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4))


def mix(a, b, t):
    """Blend two RGB triples or two (h, w, 3) arrays by scalar or array `t`."""
    if isinstance(a, tuple):
        t = max(0.0, min(1.0, t))
        return tuple(round(a[index] + (b[index] - a[index]) * t) for index in range(3))
    return a + (b - a) * t


def hash01(x, y, seed: int):
    """Deterministic 0..1 hash over integer arrays. No RNG, so output is
    reproducible bit for bit on any machine with the same numpy integer
    semantics."""
    x = np.asarray(x, dtype=np.int64).astype(np.uint64)
    y = np.asarray(y, dtype=np.int64).astype(np.uint64)
    h = (x * np.uint64(374761393) + y * np.uint64(668265263)
         + np.uint64(int(seed) & 0xFFFFFFFF) * np.uint64(2246822519)) & UINT32
    h = ((h ^ (h >> np.uint64(13))) * np.uint64(1274126177)) & UINT32
    return ((h ^ (h >> np.uint64(16))) & UINT32).astype(np.float64) / float(0xFFFFFFFF)


def smootherstep(t):
    return t * t * t * (t * (t * 6 - 15) + 10)


def wrapped_value_noise(size: int, period: int, seed: int) -> np.ndarray:
    """Value noise on a lattice of `period` cells across `size` pixels.

    Lattice coordinates wrap modulo `period`, so sampling at x = size is
    identical to x = 0. That is what guarantees a seamless tile.
    """
    cell = size / period
    coords = np.arange(size, dtype=np.float64) / cell
    base = np.floor(coords)
    index0 = base.astype(np.int64) % period
    index1 = (index0 + 1) % period
    frac = smootherstep(coords - base)

    x0 = index0[None, :]
    x1 = index1[None, :]
    fx = frac[None, :]
    y0 = index0[:, None]
    y1 = index1[:, None]
    fy = frac[:, None]

    n00 = hash01(x0, y0, seed)
    n10 = hash01(x1, y0, seed)
    n01 = hash01(x0, y1, seed)
    n11 = hash01(x1, y1, seed)
    top = n00 + (n10 - n00) * fx
    bottom = n01 + (n11 - n01) * fx
    return top + (bottom - top) * fy


def fbm(size: int, octaves, seed: int) -> np.ndarray:
    """Sum of wrapped octaves. Every period divides `size`, so the sum wraps."""
    total = np.zeros((size, size), dtype=np.float64)
    weight = 0.0
    for index, (period, amplitude) in enumerate(octaves):
        total += wrapped_value_noise(size, period, seed + index * 7919) * amplitude
        weight += amplitude
    if weight > 0:
        total /= weight
    return total


def normalise(vector):
    length = math.sqrt(sum(component * component for component in vector))
    return tuple(component / length for component in vector) if length else vector


def wrapped_blur(field: np.ndarray, radius: int) -> np.ndarray:
    """Separable box blur with wraparound, so the blur is seamless too."""
    if radius <= 0:
        return field
    width = 2 * radius + 1
    padded = np.concatenate([field[-radius:], field, field[:radius]], axis=0)
    sums = np.cumsum(padded, axis=0)
    sums = np.concatenate([np.zeros((1, field.shape[1])), sums], axis=0)
    rows = (sums[width:] - sums[:-width]) / width
    padded = np.concatenate([rows[:, -radius:], rows, rows[:, :radius]], axis=1)
    sums = np.cumsum(padded, axis=1)
    sums = np.concatenate([np.zeros((rows.shape[0], 1)), sums], axis=1)
    return (sums[:, width:] - sums[:, :-width]) / width


def scatter_height(size: int, stamp: dict, seed: int):
    """Press pebbles / grass tufts into the height field on a wrapped lattice.

    Returns (relief, albedo). Every stamp is chosen, sized, turned and tinted by
    integer hash, and each pixel tests its own lattice cell plus the eight
    wrapped neighbours, so a stamp straddling an edge is drawn identically on
    both sides. Scatter lands in the HEIGHT field -- before shading -- so
    pebbles catch the same light, cast the same directional shadow and occlude
    in the same AO pass as the terrain they sit on. The albedo channel is what
    stops them reading as bubbles in the ground colour: a stone is a different
    colour from the dirt around it, not just a different height.
    """
    cells = int(stamp["cells"])
    cell = size / cells
    radius = float(stamp["radius"])
    amount = float(stamp["amount"])
    density = float(stamp.get("density", 0.5))
    tint = float(stamp.get("tint", 0.45))
    kind = stamp.get("kind", "pebble")

    grid_y, grid_x = np.mgrid[0:size, 0:size].astype(np.float64)
    cell_x = np.floor(grid_x / cell).astype(np.int64)
    cell_y = np.floor(grid_y / cell).astype(np.int64)
    # Fine wrapped field reused as surface chip on stones and as blade strands
    # inside tufts, so neither reads as a smooth dome.
    strands = wrapped_value_noise(size, 192, seed ^ 0x2B71_9C3D)
    relief = np.zeros((size, size), dtype=np.float64)
    albedo = np.zeros((size, size), dtype=np.float64)
    for offset_y in (-1, 0, 1):
        for offset_x in (-1, 0, 1):
            wrapped_x = (cell_x + offset_x) % cells
            wrapped_y = (cell_y + offset_y) % cells
            pick = hash01(wrapped_x, wrapped_y, seed)
            jitter_x = hash01(wrapped_x, wrapped_y, seed + 7919)
            jitter_y = hash01(wrapped_x, wrapped_y, seed + 104729)
            scale = 0.5 + hash01(wrapped_x, wrapped_y, seed + 15485863) * 1.0
            angle = hash01(wrapped_x, wrapped_y, seed + 32452843) * math.tau
            aspect = 0.52 + hash01(wrapped_x, wrapped_y, seed + 49979687) * 0.86
            shade_pick = (hash01(wrapped_x, wrapped_y, seed + 86028121) - 0.5) * 2.0
            centre_x = (cell_x + offset_x + jitter_x) * cell
            centre_y = (cell_y + offset_y + jitter_y) * cell
            span = np.maximum(1.0, radius * scale)
            local_x = grid_x - centre_x
            local_y = grid_y - centre_y
            # Per-stamp rotation and aspect: round blobs read as bubbles,
            # elongated chips read as stones and clumps.
            turned_x = local_x * np.cos(angle) + local_y * np.sin(angle)
            turned_y = (-local_x * np.sin(angle) + local_y * np.cos(angle)) / aspect
            distance = (turned_x * turned_x + turned_y * turned_y) / (span * span)
            inside = np.clip(1.0 - distance, 0.0, 1.0)
            if kind == "tuft":
                # Blades, not a dome: the clump's height is broken by the fine
                # strand field so the lighting pass carves it into strokes, and
                # the envelope fades out well before the rim so no clump reads
                # as a disc.
                profile = (inside ** 1.7) * (0.28 + 1.05 * strands)
                # Colour fades with the clump instead of ending at a circle.
                weight = inside
            else:
                # A flatter crown with steeper sides gives the AO pass a real
                # contact ring, and the chip field keeps the top from glazing.
                profile = (inside ** 0.42) * (0.82 + 0.36 * strands)
                # A stone has a definite edge, so its colour holds almost to
                # the rim and then feathers over the last few texels.
                weight = np.clip(inside * 2.4, 0.0, 1.0)
            live = (pick < density).astype(np.float64)
            contribution = profile * live * amount * (0.5 + scale * 0.6)
            higher = contribution > relief
            albedo = np.where(higher, shade_pick * tint * live * weight, albedo)
            relief = np.where(higher, contribution, relief)
    return relief, albedo


def ambient_occlusion(height: np.ndarray, radii=(2, 6, 18), weights=(0.62, 0.44, 0.24)) -> np.ndarray:
    """Multi-scale wrapped AO: how much lower a pixel sits than its surroundings.

    Contact darkening under pebbles and inside grooves is the single strongest
    cue that a flat texture is a lit surface with objects sitting on it.
    """
    span = float(height.max() - height.min())
    scale = 1.0 / span if span > 1e-6 else 0.0
    occlusion = np.zeros_like(height)
    for radius, weight in zip(radii, weights):
        occlusion += np.clip((wrapped_blur(height, radius) - height) * scale, 0.0, 1.0) * weight
    return np.clip(1.0 - occlusion, 0.28, 1.0)


def cast_shadow(height: np.ndarray, steps=(1, 2, 3, 5, 8), strength: float = 0.5) -> np.ndarray:
    """Directional pseudo-shadow: march a few texels toward the light and see
    whether anything upslope blocks it. Wrapped, so shadows cross the seam."""
    span = float(height.max() - height.min())
    scale = 1.0 / span if span > 1e-6 else 0.0
    light = normalise(LIGHT)
    length = math.hypot(light[0], light[1]) or 1.0
    step_x = -light[0] / length
    step_y = -light[1] / length
    shadow = np.zeros_like(height)
    for step in steps:
        shift_x = int(round(step_x * step))
        shift_y = int(round(step_y * step))
        occluder = np.roll(np.roll(height, -shift_y, axis=0), -shift_x, axis=1)
        rise = (occluder - height) * scale - step * 0.018
        shadow = np.maximum(shadow, np.clip(rise * 2.6, 0.0, 1.0) / (1.0 + step * 0.55))
    return 1.0 - shadow * strength


def shade(height: np.ndarray, relief: float):
    """Return (lambert, specular) per pixel from the height field.

    Neighbours are sampled with wraparound so the lighting is seamless too --
    shading a tile with clamped edges would reintroduce a visible seam.
    """
    light = normalise(LIGHT)
    slope_x = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * relief
    slope_y = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * relief
    length = np.sqrt(slope_x * slope_x + slope_y * slope_y + 1.0)
    normal_x = -slope_x / length
    normal_y = -slope_y / length
    normal_z = 1.0 / length
    lambert = np.maximum(0.0, normal_x * light[0] + normal_y * light[1] + normal_z * light[2])
    # Blinn-style highlight against a straight-down viewer.
    half = normalise((light[0], light[1], light[2] + 1.0))
    spec = np.maximum(0.0, normal_x * half[0] + normal_y * half[1] + normal_z * half[2]) ** 24
    return lambert, spec


def apply_structure(height: np.ndarray, size: int, structure: str, period: int) -> np.ndarray:
    """Carve regular joints into the height field.

    Periods divide the tile size so the structure wraps with the noise.
    """
    rows = np.arange(size, dtype=np.int64)[:, None]
    columns = np.arange(size, dtype=np.int64)[None, :]
    if structure == "planks":
        # Long boards across X with a recessed seam every `period` pixels.
        seam = (rows % period) / period
        groove = ((seam < 0.045) | (seam > 0.955)).astype(np.float64)
        board = (rows // period) * 7919
        height = height * 0.55 + 0.22 + hash01(board, 0, 31) * 0.12
        height = height - groove * 0.42
        # End-joint every two board lengths, offset per row.
        joint = (((columns + (rows // period) * (period * 3)) % (period * 8)) < 3).astype(np.float64)
        height = height - joint * 0.34
    elif structure == "slab-grid":
        grid_x = (columns % period) / period
        grid_y = (rows % period) / period
        joint = ((grid_x < 0.04) | (grid_x > 0.96) | (grid_y < 0.04) | (grid_y > 0.96)).astype(np.float64)
        panel = hash01(columns // period, rows // period, 613)
        height = height * 0.6 + 0.2 + panel * 0.16
        height = height - joint * 0.4
    return height


DEFAULT_SCATTER = [
    {"kind": "pebble", "cells": 34, "radius": 5.5, "amount": 0.30, "density": 0.5, "tint": 0.5},
    {"kind": "tuft", "cells": 15, "radius": 14.0, "amount": 0.30, "density": 0.42, "tint": 0.4},
]


def bake_surface(material: dict) -> Image.Image:
    size = TILE_SIZE
    seed = material["seed"]
    # Octave periods are lattice CELL COUNTS per tile (cell = size / period),
    # so they are already resolution-independent: a period-8 field spans the
    # same world distance at any bake size. Only pixel-domain values
    # (structure joints, fringe profile) need PERIOD_SCALE.
    height = fbm(size, material["octaves"], seed)
    # Macro relief: two very low-frequency lobes so the lit surface gains broad
    # mounds and hollows. At the 399.36 runtime repeat a period-2 lobe spans
    # ~200 screen px, which is the macro variation the flat-fill complaint was
    # actually about; it costs one extra octave, not a second texture.
    macro_amount = material.get("macroAmount", 0.42)
    if macro_amount > 0:
        macro = fbm(size, material.get("macroOctaves", [(2, 1.0), (3, 0.55)]), seed + 20011)
        height = height * (1.0 - macro_amount) + macro * macro_amount
    structure = material.get("structure")
    if structure:
        height = apply_structure(height, size, structure, material.get("structurePeriod", 64) * PERIOD_SCALE)
    # Scatter goes in before shading so pebbles and tufts are lit, occluded and
    # shadowed by the same passes as the ground they sit on.
    scatter_albedo = np.zeros((size, size), dtype=np.float64)
    for index, stamp in enumerate(material.get("scatter", DEFAULT_SCATTER)):
        relief, albedo = scatter_height(size, stamp, seed + 3001 + index * 911)
        height = height + relief
        scatter_albedo = np.clip(scatter_albedo + albedo, -1.0, 1.0)
    lighting = shade(height, material["relief"])
    occlusion = ambient_occlusion(height) if material.get("occlusion", True) else 1.0
    shadow = cast_shadow(height, strength=material.get("shadowStrength", 0.5))
    detail = fbm(size, material.get("detailOctaves", [(64, 1.0)]), seed + 4001)
    # Painted-style layering: broad colour blotches, as if underpainted with a
    # wide brush before the detail pass. Low-frequency and wrapped, so the
    # paint reads as deliberate variation rather than noise or a seam.
    paint = fbm(size, [(3, 1.0), (6, 0.55)], seed + 8009)

    base = np.array(hex_rgb(material["base"]), dtype=np.float64)
    shadow_colour = np.array(hex_rgb(material["shadow"]), dtype=np.float64)
    highlight = np.array(hex_rgb(material["highlight"]), dtype=np.float64)
    accent = np.array(hex_rgb(material.get("accent", material["highlight"])), dtype=np.float64)
    accent_amount = material.get("accentAmount", 0.0)
    accent_threshold = material.get("accentThreshold", 0.82)

    ambient = material.get("ambient", 0.42)
    spec_amount = material.get("specular", 0.16)

    # Cycle 049 visibility pass: the owner read the ground as "single color,
    # no texture" at gameplay zoom -- the painted layering was real but
    # value-compressed into invisibility. Underpainting, banding, and grain
    # all step up; per-material grain/accent scale below.
    paint_amount = material.get("paintAmount", 0.30)
    band_count = material.get("valueBands", 5)
    band_mix = material.get("bandMix", 0.34)

    lambert, spec = lighting
    light_amount = ambient + (1.0 - ambient) * lambert
    # Contact shading and the cast shadow modulate the light itself, so they
    # darken toward the material's own shadow colour rather than to grey.
    light_amount = light_amount * occlusion * shadow
    # Quantized value bands underneath the continuous shading make the
    # lighting read as blocked-in brushwork instead of a photo gradient.
    banded = np.round(light_amount * band_count) / band_count
    light_amount = light_amount * (1.0 - band_mix) + banded * band_mix

    colour = mix(shadow_colour, base, np.clip(light_amount * 1.15, 0.0, 1.0)[:, :, None])
    colour = mix(colour, highlight, np.clip((light_amount - 0.72) * 1.6, 0.0, 1.0)[:, :, None])
    # Underpainting: broad warm/cool blotches pulling toward shadow or
    # highlight, centred so the mean colour is unchanged.
    blotch = (paint - 0.5) * 2.0
    warm = np.clip(blotch, 0.0, 1.0)[:, :, None] * paint_amount
    cool = np.clip(-blotch, 0.0, 1.0)[:, :, None] * paint_amount
    colour = mix(colour, highlight, warm)
    colour = mix(colour, shadow_colour, cool)
    # Scattered stones and tufts carry their own albedo, so they separate from
    # the ground by colour as well as by relief.
    stone = np.array(hex_rgb(material.get("scatterLight", material["highlight"])), dtype=np.float64)
    silt = np.array(hex_rgb(material.get("scatterDark", material["shadow"])), dtype=np.float64)
    colour = mix(colour, stone, np.clip(scatter_albedo, 0.0, 1.0)[:, :, None])
    colour = mix(colour, silt, np.clip(-scatter_albedo, 0.0, 1.0)[:, :, None])
    # Grain: fine detail modulating value, keeps flats from reading dead.
    # Sampling the detail field with an integer 45-degree shear turns
    # isotropic noise into directional strokes; the shear is modulo the
    # tile size, so seamlessness is preserved exactly. The 1.6x
    # visibility multiplier is the Cycle 049 contrast step.
    rows = np.arange(size)[:, None]
    columns = np.arange(size)[None, :]
    stroke = detail[rows, (columns + rows) % size]
    grain = (stroke - 0.5) * material.get("grain", 0.12) * 1.6
    colour = colour * (1.0 + grain[:, :, None])
    if accent_amount > 0:
        flecks = (detail > accent_threshold).astype(np.float64)[:, :, None] * accent_amount
        colour = mix(colour, accent, flecks)
    if spec_amount > 0:
        colour = mix(colour, np.array([255.0, 255.0, 255.0]), (spec * spec_amount)[:, :, None])

    pixels = np.empty((size, size, 4), dtype=np.uint8)
    pixels[:, :, :3] = np.clip(np.round(colour), 0, 255).astype(np.uint8)
    pixels[:, :, 3] = 255
    return Image.fromarray(pixels, "RGBA")


PATCH_MASK_PERIODS = [2, 4, 8]
PATCH_MASK_OCTAVES = [(2, 1.0), (4, 0.55), (8, 0.25)]


def material_variant(base: dict, variant: dict) -> dict:
    """Resolve one named sub-material without leaking patch metadata into baking."""
    resolved = {key: value for key, value in base.items() if key != "patchVariants"}
    resolved.update({key: value for key, value in variant.items() if key != "id"})
    return resolved


def bake_material(name: str, material: dict) -> tuple[Image.Image, dict | None]:
    """Bake one runtime tile, folding district variation into the existing asset.

    Districts keep one texture request and one pooled TilingSprite. Three authored
    sub-materials are composited with a low-frequency wrapped FBM mask at build
    time, so the visual patches add no child-JS bytes and cannot gain gameplay
    authority. Shared world-locked sampling in the renderer keeps the result from
    swimming under the camera.
    """
    variants = material.get("patchVariants")
    if not variants:
        return bake_surface(material), None
    if len(variants) != 3:
        raise ValueError(f"{name}: district materials require exactly three patch variants")

    resolved = [material_variant(material, variant) for variant in variants]
    variant_tiles = [np.asarray(bake_surface(spec), dtype=np.float64) for spec in resolved]
    mask_seed = int(material["seed"]) ^ 0x544831
    mask_periods = [4, 8, 16] if name == "road" else PATCH_MASK_PERIODS
    mask_octaves = [(period, amplitude) for period, (_, amplitude) in zip(mask_periods, PATCH_MASK_OCTAVES)]
    selector = fbm(TILE_SIZE, mask_octaves, mask_seed)

    # The centre variant is the connective material. Low and high wrapped-FBM
    # lobes fade into the other two variants, producing broad readable patches
    # without threshold seams or runtime mask sprites.
    if name == "road":
        # Road patches must not resolve as district-scale coloured islands.
        # Continuously crossfade gravel -> asphalt -> dirt; medium wrapped
        # periods keep the texture varied but calm at gameplay zoom.
        position = smootherstep(selector) * 2.0
        low = np.clip(position.astype(np.int64), 0, 1)
        amount = smootherstep(position - low)[:, :, None]
        left = np.where((low == 0)[:, :, None], variant_tiles[0], variant_tiles[1])
        right = np.where((low == 0)[:, :, None], variant_tiles[1], variant_tiles[2])
        blended = left + (right - left) * amount
    else:
        centre = variant_tiles[1]
        low_amount = smootherstep(np.clip((0.46 - selector) / 0.18, 0.0, 1.0))
        high_amount = smootherstep(np.clip((selector - 0.54) / 0.18, 0.0, 1.0))
        amount = np.where(selector < 0.46, low_amount, np.where(selector > 0.54, high_amount, 0.0))
        source = np.where((selector < 0.46)[:, :, None], variant_tiles[0],
                          np.where((selector > 0.54)[:, :, None], variant_tiles[2], centre))
        blended = centre + (source - centre) * amount[:, :, None]

    output = Image.fromarray(np.clip(np.round(blended), 0, 255).astype(np.uint8), "RGBA")
    return output, {
        "id": name,
        "bakedInto": name,
        "mask": {
            "source": "wrapped-fbm",
            "seed": mask_seed,
            "periods": mask_periods,
        },
        "variants": [
            {
                "id": variant["id"],
                "base": spec["base"],
                "shadow": spec["shadow"],
                "highlight": spec["highlight"],
            }
            for variant, spec in zip(variants, resolved)
        ],
    }


# Surface materials. Each must be identifiable at a glance from the others --
# that is the whole point of the change.
MATERIALS = {
    # Walkable ground per district.
    "packed-earth": {
        "seed": 11, "base": "#2f5f52", "shadow": "#173a32", "highlight": "#4d8a76",
        "accent": "#6fbfa1", "accentAmount": 0.3, "octaves": [(8, 1.0), (16, 0.5), (32, 0.25), (64, 0.12)],
        "detailOctaves": [(64, 1.0), (128, 0.5)], "relief": 46, "grain": 0.14, "specular": 0.06,
        "scatterLight": "#8fae8c", "scatterDark": "#1d3b31",
        "scatter": [
            {"kind": "tuft", "cells": 13, "radius": 16.0, "amount": 0.34, "density": 0.52, "tint": 0.42},
            {"kind": "pebble", "cells": 36, "radius": 5.0, "amount": 0.24, "density": 0.42, "tint": 0.55},
        ],
        "patchVariants": [
            {"id": "relay-loam", "seed": 111, "base": "#315b4d", "shadow": "#17352d", "highlight": "#56806d"},
            {"id": "gravelly-earth", "seed": 112, "base": "#4b6258", "shadow": "#273b35", "highlight": "#748a7d", "relief": 58, "grain": 0.2},
            {"id": "signal-lichen", "seed": 113, "base": "#365f46", "shadow": "#183825", "highlight": "#68926a", "accent": "#9ecf7e"},
        ],
    },
    "red-rock": {
        "seed": 23, "base": "#6b3b33", "shadow": "#3a1d19", "highlight": "#a3614a",
        "accent": "#d97852", "accentAmount": 0.35, "octaves": [(6, 1.0), (12, 0.6), (24, 0.3), (48, 0.16)],
        "detailOctaves": [(48, 1.0), (96, 0.6)], "relief": 62, "grain": 0.18, "specular": 0.08,
        "scatterLight": "#c69277", "scatterDark": "#341a16",
        "scatter": [
            {"kind": "pebble", "cells": 24, "radius": 8.5, "amount": 0.42, "density": 0.5, "tint": 0.62},
            {"kind": "pebble", "cells": 44, "radius": 4.0, "amount": 0.26, "density": 0.5, "tint": 0.5},
        ],
        "patchVariants": [
            {"id": "iron-dust", "seed": 231, "base": "#724036", "shadow": "#3d211c", "highlight": "#ad674d"},
            {"id": "shale-scree", "seed": 232, "base": "#5d4542", "shadow": "#302524", "highlight": "#8b7069", "relief": 70, "grain": 0.23},
            {"id": "sunbaked-clay", "seed": 233, "base": "#7e4938", "shadow": "#45251d", "highlight": "#bd7452", "accent": "#e49a63"},
        ],
    },
    "wet-bank": {
        "seed": 37, "base": "#2a5a63", "shadow": "#123239", "highlight": "#4d8f95",
        "accent": "#7fc4c8", "accentAmount": 0.27, "octaves": [(8, 1.0), (16, 0.5), (32, 0.28)],
        "detailOctaves": [(64, 1.0), (128, 0.45)], "relief": 40, "grain": 0.12, "specular": 0.2,
        "scatterLight": "#8fc0a4", "scatterDark": "#123036",
        "scatter": [
            {"kind": "tuft", "cells": 13, "radius": 15.0, "amount": 0.32, "density": 0.46, "tint": 0.4},
            {"kind": "pebble", "cells": 38, "radius": 4.5, "amount": 0.2, "density": 0.4, "tint": 0.5},
        ],
        "patchVariants": [
            {"id": "river-silt", "seed": 371, "base": "#365d5e", "shadow": "#1a3638", "highlight": "#618b89"},
            {"id": "reed-mud", "seed": 372, "base": "#31564b", "shadow": "#17342d", "highlight": "#5c8670", "accent": "#87b883"},
            {"id": "mineral-wash", "seed": 373, "base": "#326875", "shadow": "#163a43", "highlight": "#61a1a8", "specular": 0.24},
        ],
    },
    "forest-floor": {
        "seed": 53, "base": "#2c5434", "shadow": "#14301c", "highlight": "#4a8850",
        "accent": "#7fc878", "accentAmount": 0.41, "octaves": [(6, 1.0), (14, 0.6), (28, 0.32), (56, 0.18)],
        "detailOctaves": [(56, 1.0), (112, 0.6)], "relief": 56, "grain": 0.2, "specular": 0.05,
        "scatterLight": "#93c17f", "scatterDark": "#1a3520",
        "scatter": [
            {"kind": "tuft", "cells": 12, "radius": 19.0, "amount": 0.44, "density": 0.6, "tint": 0.5},
            {"kind": "tuft", "cells": 26, "radius": 7.5, "amount": 0.3, "density": 0.52, "tint": 0.42},
        ],
        "patchVariants": [
            {"id": "needle-litter", "seed": 531, "base": "#40513a", "shadow": "#222f20", "highlight": "#68775a", "accent": "#9b8b5d"},
            {"id": "mossy-floor", "seed": 532, "base": "#315d38", "shadow": "#17351f", "highlight": "#559258", "accent": "#8ed17f"},
            {"id": "root-mat", "seed": 533, "base": "#4a5535", "shadow": "#29301d", "highlight": "#77805a", "relief": 64, "grain": 0.24},
        ],
    },
    "crushed-ore": {
        "seed": 71, "base": "#4a4b4e", "shadow": "#26272a", "highlight": "#78797d",
        "accent": "#f0ae4c", "accentAmount": 0.32, "octaves": [(10, 1.0), (20, 0.55), (40, 0.3), (80, 0.18)],
        "detailOctaves": [(64, 1.0), (128, 0.5)], "relief": 58, "grain": 0.22, "specular": 0.14,
        "scatterLight": "#9a9ca2", "scatterDark": "#222327",
        "scatter": [
            {"kind": "pebble", "cells": 22, "radius": 9.0, "amount": 0.46, "density": 0.55, "tint": 0.66},
            {"kind": "pebble", "cells": 42, "radius": 4.0, "amount": 0.28, "density": 0.55, "tint": 0.55},
        ],
        "patchVariants": [
            {"id": "granite-tailings", "seed": 711, "base": "#55575a", "shadow": "#2d2f32", "highlight": "#85878a"},
            {"id": "coal-fines", "seed": 712, "base": "#3b3d42", "shadow": "#1d1f23", "highlight": "#676a70", "grain": 0.26},
            {"id": "oxidized-ore", "seed": 713, "base": "#5d4e47", "shadow": "#302924", "highlight": "#8e7566", "accent": "#e49b45"},
        ],
    },
    "industrial-slab": {
        "seed": 89, "base": "#4a2b3f", "shadow": "#24121e", "highlight": "#734a63",
        "structure": "slab-grid", "structurePeriod": 64,
        "accent": "#ff527e", "accentAmount": 0.18, "accentThreshold": 0.88,
        "octaves": [(4, 1.0), (16, 0.4), (32, 0.2)],
        "detailOctaves": [(64, 1.0), (128, 0.4)], "relief": 30, "grain": 0.1, "specular": 0.12,
        "macroAmount": 0.22,
        "scatterLight": "#6f5266", "scatterDark": "#1e1219",
        "scatter": [
            {"kind": "pebble", "cells": 40, "radius": 4.0, "amount": 0.14, "density": 0.26, "tint": 0.4},
        ],
        "patchVariants": [
            {"id": "patched-slab", "seed": 891, "base": "#55384a", "shadow": "#2c1d27", "highlight": "#805c70"},
            {"id": "oil-darkened-slab", "seed": 892, "base": "#3d2a37", "shadow": "#1d131a", "highlight": "#664756", "specular": 0.18},
            {"id": "rust-stained-slab", "seed": 893, "base": "#5b3440", "shadow": "#2d1920", "highlight": "#8a5661", "accent": "#d96a4f"},
        ],
    },
    # Shared, non-district surfaces. These carry the semantic load the player
    # complained about: am I on a road, in water, or on something raised?
    "road": {
        "seed": 101, "base": "#8a7350", "shadow": "#4f4130", "highlight": "#bda278",
        "accent": "#d8c199", "accentAmount": 0.22, "octaves": [(12, 1.0), (24, 0.5), (48, 0.3), (96, 0.2)],
        "detailOctaves": [(64, 1.0), (128, 0.55)], "relief": 52, "grain": 0.16, "specular": 0.07,
        "macroAmount": 0.24,
        "scatterLight": "#b8a488", "scatterDark": "#3f3527",
        "scatter": [
            {"kind": "pebble", "cells": 40, "radius": 4.5, "amount": 0.26, "density": 0.55, "tint": 0.5},
        ],
        # T4: the runtime keeps one pooled/masked road texture request. These
        # three materials are composited into that tile with the same wrapped
        # mask as district patches, so roads gain local material identity with
        # no child code, request, collision, or navigation authority.
        "patchVariants": [
            {"id": "gravel-shoulder", "seed": 1011, "base": "#766f62", "shadow": "#454039", "highlight": "#a69b89", "relief": 62, "grain": 0.2},
            {"id": "cracked-asphalt", "seed": 1012, "base": "#625f59", "shadow": "#33312e", "highlight": "#8b877e", "relief": 68, "grain": 0.22, "specular": 0.04},
            {"id": "dirt-track", "seed": 1013, "base": "#7a6855", "shadow": "#44372c", "highlight": "#aa9075", "relief": 56, "grain": 0.18, "accent": "#c3a483"},
        ],
    },
    "water": {
        "seed": 131, "base": "#12617f", "shadow": "#07374d", "highlight": "#3fa7c4",
        "accent": "#a8ecff", "accentAmount": 0.34, "accentThreshold": 0.86,
        "octaves": [(6, 1.0), (12, 0.55), (24, 0.3)],
        # Ripples must stay small at the raised runtime repeat, or the caustic
        # accents resolve as white blobs instead of sparkle.
        "detailOctaves": [(64, 1.0), (128, 0.6)], "relief": 26, "grain": 0.08, "specular": 0.42, "ambient": 0.5,
        "macroAmount": 0.3, "scatter": [], "occlusion": False, "shadowStrength": 0.18,
    },
    "shallow-water": {
        "seed": 137, "base": "#1c7f92", "shadow": "#0d4a58", "highlight": "#5fc6d6",
        "accent": "#bff4ff", "accentAmount": 0.36, "accentThreshold": 0.84,
        "octaves": [(6, 1.0), (12, 0.6), (24, 0.34)],
        "detailOctaves": [(64, 1.0), (128, 0.6)], "relief": 22, "grain": 0.08, "specular": 0.38, "ambient": 0.54,
        "macroAmount": 0.3, "scatter": [], "occlusion": False, "shadowStrength": 0.18,
    },
    "bridge-deck": {
        "seed": 149, "base": "#7a5c3c", "shadow": "#3f2e1d", "highlight": "#a98254",
        "structure": "planks", "structurePeriod": 32,
        "accent": "#c9a878", "accentAmount": 0.27, "octaves": [(4, 1.0), (32, 0.35), (64, 0.2)],
        "detailOctaves": [(64, 1.0), (128, 0.4)], "relief": 44, "grain": 0.14, "specular": 0.1,
        "macroAmount": 0.16, "scatter": [],
    },
    "ledge-top": {
        "seed": 163, "base": "#5d5344", "shadow": "#2e2820", "highlight": "#8d7f68",
        "accent": "#b8a888", "accentAmount": 0.27, "octaves": [(8, 1.0), (16, 0.5), (32, 0.28), (64, 0.16)],
        "detailOctaves": [(64, 1.0), (128, 0.5)], "relief": 50, "grain": 0.16, "specular": 0.1,
        "scatterLight": "#a99a86", "scatterDark": "#2a241c",
        "scatter": [
            {"kind": "pebble", "cells": 26, "radius": 7.5, "amount": 0.36, "density": 0.5, "tint": 0.55},
            {"kind": "pebble", "cells": 44, "radius": 3.8, "amount": 0.22, "density": 0.48, "tint": 0.45},
        ],
    },
}


FRINGE_HEIGHT = 64 * PERIOD_SCALE
OVERLAY_HEIGHT = 64 * PERIOD_SCALE

# Authored edge strips. These are NOT runtime materials: they carry no district
# or surface semantics, they repeat along U only, and they live in their own
# manifest array so the material size/count contracts stay exact.
OVERLAYS = {
    "road-shoulder": {
        "seed": 211, "base": "#7b7263", "shadow": "#453f38", "highlight": "#ab9f8c",
        "accent": "#c8bba2", "accentAmount": 0.2, "octaves": [(10, 1.0), (20, 0.55), (40, 0.3)],
        "detailOctaves": [(64, 1.0), (128, 0.5)], "relief": 60, "grain": 0.2, "specular": 0.06,
        "macroAmount": 0.3,
        "scatterLight": "#c4b79e", "scatterDark": "#3a352d",
        "scatter": [
            {"kind": "pebble", "cells": 30, "radius": 6.5, "amount": 0.42, "density": 0.58, "tint": 0.6},
            {"kind": "tuft", "cells": 16, "radius": 12.0, "amount": 0.24, "density": 0.3, "tint": 0.4},
        ],
        "profile": "shoulder",
        # Depth of the compacted, oil-darkened rut where the shoulder meets the
        # travelled surface, as a fraction of the strip height.
        "rutDepth": 0.16,
    },
    # W-4: the land side of every waterline. Row 0 is the waterline itself, so
    # the strip reads foam -> wet dark sand -> dry bank as it moves inland.
    "shore-band": {
        "seed": 223, "base": "#6f6a55", "shadow": "#3b3a30", "highlight": "#a09a80", "profile": "shore",
        "accent": "#c6bfa4", "accentAmount": 0.18, "octaves": [(10, 1.0), (20, 0.5), (40, 0.28)],
        "detailOctaves": [(64, 1.0), (128, 0.5)], "relief": 46, "grain": 0.16, "specular": 0.1,
        "macroAmount": 0.3,
        "scatterLight": "#c0b79c", "scatterDark": "#332f26",
        "scatter": [
            {"kind": "pebble", "cells": 34, "radius": 5.5, "amount": 0.32, "density": 0.5, "tint": 0.5},
            {"kind": "tuft", "cells": 17, "radius": 11.0, "amount": 0.22, "density": 0.3, "tint": 0.38},
        ],
        "wetColour": "#2c3f46", "foamColour": "#d7f4ff",
    },
    # W-4: the debris skirt that a cliff face or a ledge front sheds onto the
    # ground below it, so a height change stops ending at a drawn line.
    "scree-skirt": {
        "seed": 227, "base": "#6a4a3f", "shadow": "#352220", "highlight": "#9e7259",
        "accent": "#c08a63", "accentAmount": 0.24, "octaves": [(8, 1.0), (16, 0.55), (32, 0.3)],
        "detailOctaves": [(48, 1.0), (96, 0.6)], "relief": 66, "grain": 0.2, "specular": 0.08,
        "macroAmount": 0.26, "profile": "scree",
        "scatterLight": "#bb8a6c", "scatterDark": "#2b1a16",
        "scatter": [
            {"kind": "pebble", "cells": 22, "radius": 9.0, "amount": 0.52, "density": 0.62, "tint": 0.62},
            {"kind": "pebble", "cells": 42, "radius": 4.2, "amount": 0.3, "density": 0.6, "tint": 0.5},
        ],
    },
}


def bake_fringe(name: str, tile: Image.Image, seed: int) -> Image.Image:
    """Cut a horizontally-tileable fringe strip from a baked tile.

    The strip carries the material's own pixels with a ragged, dithered alpha
    falloff, so two ground materials meet as a broken organic edge instead of
    a hard flat rectangle. Deterministic: the edge profile and dither derive
    from the same integer hash as the tile noise.
    """
    pixels = np.asarray(tile, dtype=np.uint8)[:FRINGE_HEIGHT].copy()
    profile = wrapped_value_noise(TILE_SIZE, 32, seed ^ 0x0F12_19E5)[0]
    edge = (10 + profile * 26) * PERIOD_SCALE
    rows = np.arange(FRINGE_HEIGHT, dtype=np.float64)[:, None]
    columns = np.arange(TILE_SIZE, dtype=np.int64)[None, :]
    fade = np.maximum(0.0, 1.0 - (rows - edge[None, :]) / (FRINGE_HEIGHT * 0.62 - edge[None, :] * 0.4))
    # Ordered dither keeps the falloff from reading as an airbrush gradient at
    # gameplay zoom.
    dither = ((columns * 7 + rows.astype(np.int64) * 13 + (seed & 31)) % 4) / 8.0
    alpha = np.clip(fade - dither, 0.0, 1.0) * 255.0
    alpha = np.where(rows <= edge[None, :], 255.0, alpha)
    pixels[:, :, 3] = alpha.astype(np.uint8)
    return Image.fromarray(pixels, "RGBA")


def bake_overlay(name: str, overlay: dict) -> Image.Image:
    """Bake one authored edge strip: a full material, cropped to strip height,
    shaped by its own profile, with a ragged alpha falloff outward.

    U repeats along the edge; V clamps, so the strip always presents its opaque
    inner edge to the surface it borders and dissolves into the ground. Three
    profiles: `shoulder` (packed rut beside a road), `shore` (foam and wet sand
    at a waterline), `scree` (chips thinning away from a cliff or ledge front).
    """
    tile = np.asarray(bake_surface(overlay), dtype=np.float64)[:OVERLAY_HEIGHT].copy()
    rows = np.arange(OVERLAY_HEIGHT, dtype=np.float64)[:, None]
    columns = np.arange(TILE_SIZE, dtype=np.int64)[None, :]
    profile = wrapped_value_noise(TILE_SIZE, 24, overlay["seed"] ^ 0x51D0_2C77)[0]
    kind = overlay.get("profile", "shoulder")
    depth = rows / OVERLAY_HEIGHT

    if kind == "shoulder":
        # Compacted rut: traffic packs and darkens the first band of the shoulder.
        rut = float(overlay.get("rutDepth", 0.16)) * OVERLAY_HEIGHT
        packed = np.clip(1.0 - rows / max(1.0, rut), 0.0, 1.0) ** 1.4
        tile[:, :, :3] *= (1.0 - packed * 0.34)[:, :, None]
        edge = (0.32 + profile * 0.34) * OVERLAY_HEIGHT
        falloff = 1.6
    elif kind == "shore":
        # Wet sand darkens and saturates toward the waterline, and a broken
        # foam line sits in the first few texels where the water actually meets
        # the bank.
        wet = np.array(hex_rgb(overlay.get("wetColour", overlay["shadow"])), dtype=np.float64)
        foam = np.array(hex_rgb(overlay.get("foamColour", "#ffffff")), dtype=np.float64)
        soak = np.clip(1.0 - depth / 0.55, 0.0, 1.0) ** 1.3
        tile[:, :, :3] = mix(tile[:, :, :3], wet, (soak * 0.62)[:, :, None])
        foam_edge = (0.03 + profile * 0.075)[None, :] * OVERLAY_HEIGHT
        crest = np.clip(1.0 - rows / np.maximum(1.0, foam_edge), 0.0, 1.0) ** 0.8
        broken = wrapped_value_noise(TILE_SIZE, 40, overlay["seed"] ^ 0x2A17_51B3)[0][None, :]
        tile[:, :, :3] = mix(tile[:, :, :3], foam, (crest * np.clip(broken * 1.7 - 0.35, 0.0, 1.0))[:, :, None])
        edge = (0.44 + profile * 0.3) * OVERLAY_HEIGHT
        falloff = 1.2
    else:
        # Scree thins with distance from the face that shed it, so the last
        # third is mostly bare ground showing through.
        thinning = np.clip(1.0 - depth * 1.25, 0.0, 1.0) ** 0.7
        tile[:, :, 3] = 255.0
        edge = (0.12 + profile * 0.2) * OVERLAY_HEIGHT
        falloff = 1.0

    span = np.maximum(1.0, (OVERLAY_HEIGHT - edge[None, :]) * falloff)
    fade = np.clip(1.0 - (rows - edge[None, :]) / span, 0.0, 1.0)
    dither = ((columns * 5 + rows.astype(np.int64) * 11 + (overlay["seed"] & 31)) % 4) / 9.0
    alpha = np.clip(fade - dither, 0.0, 1.0)
    alpha = np.where(rows <= edge[None, :], 1.0, alpha)
    if kind == "scree":
        alpha = alpha * thinning
    tile[:, :, 3] = alpha * 255.0
    return Image.fromarray(np.clip(np.round(tile), 0, 255).astype(np.uint8), "RGBA")


def seam_report(name: str, image: Image.Image, axes: str = "xy") -> dict:
    """A seam is not "opposite edges are identical" -- for high-frequency detail
    they should differ as much as any neighbouring pair. A seam is when the WRAP
    difference is anomalous versus normal interior variation. Compare directly.
    """
    pixels = np.asarray(image, dtype=np.float64)[:, :, :3]

    def mean_abs(a, b):
        return float(np.abs(a - b).mean())

    stats = {}
    if "x" in axes:
        wrap_x = mean_abs(pixels[:, -1], pixels[:, 0])
        # Sample the whole interior distribution, not one midline column: a
        # single sample that happens to land on a structural joint inflates the
        # limit and lets a genuine edge step through. Median is robust to the
        # joints that make a few samples large.
        columns = sorted(mean_abs(pixels[:, col], pixels[:, col + 1]) for col in range(0, pixels.shape[1] - 1, 8))
        interior_x = columns[len(columns) // 2]
        # Allow a small absolute floor so near-flat materials, where interior
        # delta is ~0, do not divide by nothing.
        if wrap_x > max(2.0, interior_x * 3.0):
            raise RuntimeError(f"{name}: seam detected -- wrap delta x={wrap_x:.2f} vs interior x={interior_x:.2f}")
        stats["wrapX"] = round(wrap_x, 3)
        stats["interiorX"] = round(interior_x, 3)
    if "y" in axes:
        wrap_y = mean_abs(pixels[-1, :], pixels[0, :])
        rows = sorted(mean_abs(pixels[row, :], pixels[row + 1, :]) for row in range(0, pixels.shape[0] - 1, 8))
        interior_y = rows[len(rows) // 2]
        if wrap_y > max(2.0, interior_y * 3.0):
            raise RuntimeError(f"{name}: seam detected -- wrap delta y={wrap_y:.2f} vs interior y={interior_y:.2f}")
        stats["wrapY"] = round(wrap_y, 3)
        stats["interiorY"] = round(interior_y, 3)
    return stats


def bake_everything(verify_seamless: bool):
    """Bake every image once. Returns (images, patch_records, seam_stats).

    Kept as one pure function so --verify-reproducible can call it twice and
    compare pixels, with no state carried between runs.
    """
    images = {}
    patch_records = []
    seam_stats = {}
    for name, material in sorted(MATERIALS.items()):
        image, patch_record = bake_material(name, material)
        if patch_record:
            patch_records.append(patch_record)
        if verify_seamless:
            seam_stats[name] = seam_report(name, image)
        images[name] = image
        images[f"{name}-fringe"] = bake_fringe(name, image, material["seed"])
    for name, overlay in sorted(OVERLAYS.items()):
        strip = bake_overlay(name, overlay)
        if verify_seamless:
            # Strips repeat along U only, so only the X wrap can seam.
            seam_stats[name] = seam_report(name, strip, axes="x")
        images[name] = strip
    return images, patch_records, seam_stats


def digest_pixels(images) -> dict:
    return {name: hashlib.sha256(image.tobytes()).hexdigest() for name, image in sorted(images.items())}


def main() -> None:
    parser = argparse.ArgumentParser(description="Bake seamless HMH terrain tiles.")
    parser.add_argument("--verify-seamless", action="store_true",
                        help="Assert opposite edges match within tolerance.")
    parser.add_argument("--verify-reproducible", action="store_true",
                        help="Bake twice and assert every pixel and every PNG byte matches.")
    args = parser.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    images, patch_records, seam_stats = bake_everything(args.verify_seamless)

    if args.verify_reproducible:
        second, _, _ = bake_everything(False)
        first_pixels = digest_pixels(images)
        second_pixels = digest_pixels(second)
        if first_pixels != second_pixels:
            drifted = [name for name in first_pixels if first_pixels[name] != second_pixels.get(name)]
            raise RuntimeError(f"bake is not reproducible -- pixel drift in {sorted(drifted)}")

    records = []
    fringe_records = []
    overlay_records = []
    file_digests = {}

    def write(name: str, image: Image.Image) -> tuple[Path, str]:
        path = OUTPUT_DIR / f"{name}.png"
        image.save(path, optimize=True, compress_level=9)
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        file_digests[name] = digest
        return path, digest

    for name in sorted(MATERIALS):
        path, digest = write(name, images[name])
        records.append({
            "id": name,
            "file": f"./{path.name}",
            "size": TILE_SIZE,
            "bytes": path.stat().st_size,
            "sha256": digest,
        })
        fringe_name = f"{name}-fringe"
        fringe_path, fringe_digest = write(fringe_name, images[fringe_name])
        fringe_records.append({
            "id": name,
            "file": f"./{fringe_path.name}",
            "width": TILE_SIZE,
            "height": FRINGE_HEIGHT,
            "bytes": fringe_path.stat().st_size,
            "sha256": fringe_digest,
        })
    for name in sorted(OVERLAYS):
        path, digest = write(name, images[name])
        overlay_records.append({
            "id": name,
            "file": f"./{path.name}",
            "width": TILE_SIZE,
            "height": OVERLAY_HEIGHT,
            "addressV": "clamp-to-edge",
            "bytes": path.stat().st_size,
            "sha256": digest,
        })

    if args.verify_reproducible:
        # File-level reproducibility is a separate claim from pixel-level: the
        # same pixels can still encode differently under another zlib.
        for name, image in sorted(second.items()):
            path = OUTPUT_DIR / f"{name}.png.verify"
            image.save(path, format="PNG", optimize=True, compress_level=9)
            replay = hashlib.sha256(path.read_bytes()).hexdigest()
            path.unlink()
            if replay != file_digests[name]:
                raise RuntimeError(f"bake is not reproducible -- PNG byte drift in {name}")

    manifest = {
        "schemaVersion": 3,
        "pipelineId": PIPELINE_ID,
        "classification": "production-art",
        "runtimeAuthority": "projection-only",
        "tileSize": TILE_SIZE,
        "fringeHeight": FRINGE_HEIGHT,
        "overlayHeight": OVERLAY_HEIGHT,
        "paintedLayering": True,
        "intraDistrictPatches": True,
        "litMicroTerrain": True,
        "districtPatches": [record for record in patch_records if record["id"] != "road"],
        "roadNetwork": next((record for record in patch_records if record["id"] == "road"), None),
        "fringes": fringe_records,
        "overlays": overlay_records,
        "seamlessVerified": bool(args.verify_seamless),
        "reproducibleVerified": bool(args.verify_reproducible),
        "seamStatistics": seam_stats,
        "materials": records,
    }
    manifest_path = OUTPUT_DIR / "hmh-terrain-tiles.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps({
        "status": "pass",
        "pipelineId": PIPELINE_ID,
        "materialCount": len(records),
        "overlayCount": len(overlay_records),
        "totalBytes": sum(entry["bytes"] for entry in records),
        "seamlessVerified": manifest["seamlessVerified"],
        "reproducibleVerified": manifest["reproducibleVerified"],
    }, sort_keys=True))


if __name__ == "__main__":
    main()

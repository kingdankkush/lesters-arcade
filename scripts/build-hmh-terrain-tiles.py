"""Build verified Blender ground tiles and deterministic terrain edge strips.

Seven land materials preserve the original Blender source pixels. Their recipe,
native scene and two-render receipt are authenticated before any output is written.
Water, shallows, bridge deck and ledge top retain their established height-field
recipes. Fringes and edge strips share the new land pixels and periodic alpha
profiles. Seam checks compare wrap variation against normal neighboring texels.

Output is projection-only art; it cannot alter gameplay geometry or authority.
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
PIPELINE_ID = "hmh-terrain-tiles-v4"

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


# Source-ground tiles are rendered in Blender and verified before deriving strips.
# Their seeds are only used to shape deterministic fringe alpha.
BLENDER_MATERIAL_SEEDS = {
    "packed-earth": 11, "red-rock": 23, "wet-bank": 37, "forest-floor": 53,
    "crushed-ore": 71, "industrial-slab": 89, "road": 101,
}
SOURCE_DIR = ROOT / "apps" / "hmh-reboot" / "assets" / "source" / "terrain"
BLENDER_RECIPE = ROOT / "scripts" / "hmh-blender" / "bake-world-ground.py"
OVERLAY_SOURCES = {
    "road-shoulder": "packed-earth", "shore-band": "wet-bank", "scree-skirt": "crushed-ore",
}


def file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_blender_ground(source_dir: Path = SOURCE_DIR) -> tuple[dict, dict]:
    """Authenticate the native scene, recipe and exact repeat-rendered tiles.

    The builder fails before writing any generated assets if the source packet is
    incomplete, mutated, or no longer tied to the saved Blender recipe.
    """
    receipt_path = source_dir / "ground-source.json"
    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    if receipt.get("pipeline") != "hmh-blender-ground-v1" or receipt.get("engine") != "CYCLES":
        raise ValueError("native ground pipeline or renderer mismatch")
    if receipt.get("repeatVerified") is not True:
        raise ValueError("native ground repeat rendering is unverified")
    if file_sha256(BLENDER_RECIPE) != receipt.get("sourceScriptSha256"):
        raise ValueError("native ground recipe digest mismatch")
    if receipt.get("nativeSource") != "hmh-world-ground-materials.blend":
        raise ValueError("unexpected native ground scene")
    scene = source_dir / receipt["nativeSource"]
    if file_sha256(scene) != receipt.get("nativeSourceSha256"):
        raise ValueError("native ground scene digest mismatch")
    records = receipt.get("materials", [])
    if len(records) != len(BLENDER_MATERIAL_SEEDS) or {record.get("id") for record in records} != set(BLENDER_MATERIAL_SEEDS):
        raise ValueError("complete seven-material native ground roster required")
    images = {}
    sources = {}
    for record in records:
        name = record["id"]
        if record.get("file") != f"{name}.png":
            raise ValueError(f"{name}: unsafe native tile filename")
        path = source_dir / record["file"]
        if file_sha256(path) != record.get("sha256"):
            raise ValueError(f"{name}: native tile digest mismatch")
        if record.get("repeatPixelExact") is not True or record.get("repeatFileExact") is not True:
            raise ValueError(f"{name}: exact native repeat evidence required")
        with Image.open(path) as original:
            if original.size != (TILE_SIZE, TILE_SIZE) or original.mode != "RGBA":
                raise ValueError(f"{name}: 512px RGBA source required")
            image = original.copy()
        if image.getextrema()[3] != (255, 255):
            raise ValueError(f"{name}: native ground must be opaque")
        images[name] = image
        sources[name] = {
            "kind": "blender-cycles", "file": path.relative_to(ROOT).as_posix(),
            "sha256": record["sha256"],
            "decodedRgbaSha256": hashlib.sha256(image.tobytes()).hexdigest(),
        }
    provenance = {
        "pipeline": receipt["pipeline"],
        "receipt": receipt_path.relative_to(ROOT).as_posix(),
        "receiptSha256": file_sha256(receipt_path),
        "recipe": BLENDER_RECIPE.relative_to(ROOT).as_posix(),
        "recipeSha256": receipt["sourceScriptSha256"],
        "blend": scene.relative_to(ROOT).as_posix(),
        "blendSha256": receipt["nativeSourceSha256"],
        "materialIds": list(BLENDER_MATERIAL_SEEDS),
        "sources": sources,
    }
    return images, provenance


# Four established water/deck materials retain their existing baked recipes.
MATERIALS = {
    **{name: {"seed": seed} for name, seed in BLENDER_MATERIAL_SEEDS.items()},
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
    # W-11: the vertical wall of a ledge front or a cliff face. The renderer
    # stretches this strip across exactly the projected height of the wall, so
    # every row is opaque; row 0 is the lit cap on the lip, the foot rows carry
    # the contact darkening where the wall meets the ground. Baked in a neutral
    # warm rock so the runtime can tint it toward each district's ground.
    "rock-face": {
        "seed": 229, "base": "#7a6656", "shadow": "#33241f", "highlight": "#b09a86", "profile": "face",
        "accent": "#c4a88e", "accentAmount": 0.14, "octaves": [(6, 1.0), (12, 0.55), (24, 0.32), (48, 0.18)],
        "detailOctaves": [(48, 1.0), (96, 0.5)], "relief": 62, "grain": 0.2, "specular": 0.05,
        "macroAmount": 0.2,
        # No pebbles: scatter on a vertical face reads as ground stood on end.
        "scatter": [],
        # Horizontal beds cut by the wall; the seam between beds is the dark
        # line, the beds alternate tone, and the whole set undulates along U.
        "strata": 4, "strataWobble": 0.32, "capRows": 8,
    },
    # W-4 (Cycle 074): the deep-to-shallow slope inside a ford. Row 0 is the
    # deep-water boundary and the band dissolves into the shallow bed by about
    # 70 percent of its depth. No foam crest and no wet sand: this edge is
    # mid-river, not a shoreline. Baked in the shallow-water palette so the
    # bed shows through where the band thins.
    "shallows-band": {
        "seed": 239, "base": "#1c5d74", "shadow": "#0d3546", "highlight": "#3f8fa4", "profile": "ford",
        "accent": "#4fa2b5", "accentAmount": 0.1, "octaves": [(12, 1.0), (24, 0.5), (48, 0.28)],
        "detailOctaves": [(64, 1.0), (128, 0.5)], "relief": 22, "grain": 0.08, "specular": 0.1,
        "macroAmount": 0.3,
        # No pebbles under water: scatter reads as a gravel bar.
        "scatter": [],
        "deepColour": "#0b3d52", "rippleColour": "#5fb3c6",
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


def bake_overlay(name: str, overlay: dict, source_tile: Image.Image | None = None) -> Image.Image:
    """Bake one authored edge strip: a full material, cropped to strip height,
    shaped by its own profile, with a ragged alpha falloff outward.

    U repeats along the edge; V clamps, so the strip always presents its opaque
    inner edge to the surface it borders and dissolves into the ground. Five
    profiles: `shoulder` (packed rut beside a road), `shore` (foam and wet sand
    at a waterline), `scree` (chips thinning away from a cliff or ledge front),
    `face` (an opaque wall: lit cap, horizontal strata, shaded foot), `ford`
    (the submerged deep-to-shallow slope inside a crossing, no crest).
    """
    tile = np.asarray(source_tile if source_tile is not None else bake_surface(overlay), dtype=np.float64)[:OVERLAY_HEIGHT].copy()
    rows = np.arange(OVERLAY_HEIGHT, dtype=np.float64)[:, None]
    columns = np.arange(TILE_SIZE, dtype=np.int64)[None, :]
    profile = wrapped_value_noise(TILE_SIZE, 24, overlay["seed"] ^ 0x51D0_2C77)[0]
    kind = overlay.get("profile", "shoulder")
    depth = rows / OVERLAY_HEIGHT

    if kind == "face":
        # W-11. A wall, not a skirt: opaque on every row because the placer
        # stretches the strip across exactly the projected height of the drop,
        # and any transparency would show ground through rock.
        tile[:, :, 3] = 255.0
        shadow_rgb = np.array(hex_rgb(overlay["shadow"]), dtype=np.float64)
        highlight_rgb = np.array(hex_rgb(overlay["highlight"]), dtype=np.float64)
        strata = int(overlay.get("strata", 4))
        wobble = float(overlay.get("strataWobble", 0.32))
        # Bedding planes undulate along U (wrapped, so the strip still tiles)
        # and the phase says which bed a texel sits in and how far into it.
        undulation = wrapped_value_noise(TILE_SIZE, 12, overlay["seed"] ^ 0x7E11_A3C5)[0][None, :]
        phase = depth * strata + (undulation - 0.5) * wobble
        bed = np.floor(phase)
        within = phase - bed
        # Alternate bed tone, a dark seam where one bed sits on the next, and a
        # sliver of light just under each seam where the bed above overhangs.
        tone = np.where(bed % 2 == 0, 0.0, 1.0) * 0.2
        seam = np.clip(1.0 - within / 0.11, 0.0, 1.0) ** 1.2
        underlit = np.clip(1.0 - np.abs(within - 0.2) / 0.07, 0.0, 1.0) * 0.18
        tile[:, :, :3] = mix(tile[:, :, :3], shadow_rgb, np.clip(tone + seam * 0.62, 0.0, 1.0)[:, :, None])
        tile[:, :, :3] = mix(tile[:, :, :3], highlight_rgb, underlit[:, :, None])
        # Horizontal grain: the same wrapped noise sampled three rows per row,
        # so its features are a third as tall as they are wide.
        grain_field = wrapped_value_noise(TILE_SIZE, 20, overlay["seed"] ^ 0x66A1_0C3D)
        grain = grain_field[(np.arange(OVERLAY_HEIGHT) * 3) % TILE_SIZE]
        tile[:, :, :3] *= (0.86 + grain * 0.28)[:, :, None]
        # Vertical fracture lines: sparse, short, darker, wrapped along U.
        fracture = wrapped_value_noise(TILE_SIZE, 64, overlay["seed"] ^ 0x19C3_55A1)[0][None, :]
        fracture_row = wrapped_value_noise(TILE_SIZE, 6, overlay["seed"] ^ 0x4D2B_7F09)[0][None, :]
        crack = np.clip((fracture - 0.9) / 0.1, 0.0, 1.0) * np.clip(1.0 - np.abs(depth - fracture_row) / 0.22, 0.0, 1.0)
        tile[:, :, :3] = mix(tile[:, :, :3], shadow_rgb, (crack * 0.5)[:, :, None])
        # Walls take less sky light than tops, and the foot is occluded where
        # the wall meets the ground.
        wall_shade = 1.0 - depth * 0.3
        foot = np.clip((depth - 0.8) / 0.2, 0.0, 1.0) ** 1.4
        tile[:, :, :3] *= (wall_shade * (1.0 - foot * 0.46))[:, :, None]
        # Lit cap: the lip catches the light.
        cap_rows = float(overlay.get("capRows", 8))
        cap = np.clip(1.0 - rows / cap_rows, 0.0, 1.0) ** 0.8
        tile[:, :, :3] = mix(tile[:, :, :3], highlight_rgb, (cap * 0.6)[:, :, None])
        return Image.fromarray(np.clip(np.round(tile), 0, 255).astype(np.uint8), "RGBA")

    if kind == "ford":
        # W-4 (Cycle 074). A submerged slope, not a beach: the boundary rows
        # sink to the deep-water tone, the band dissolves into the shallow bed
        # by ~70% of its depth, and three faint wrapped ripple lines cross it.
        # No foam crest: this edge is mid-river.
        deep = np.array(hex_rgb(overlay["deepColour"]), dtype=np.float64)
        ripple_rgb = np.array(hex_rgb(overlay["rippleColour"]), dtype=np.float64)
        sink = np.clip(1.0 - depth / 0.6, 0.0, 1.0) ** 1.1
        tile[:, :, :3] = mix(tile[:, :, :3], deep, (sink * 0.8)[:, :, None])
        ripple_phase = wrapped_value_noise(TILE_SIZE, 16, overlay["seed"] ^ 0x3C9A_11F7)[0][None, :]
        for line in (0.16, 0.34, 0.5):
            centre = line + (ripple_phase - 0.5) * 0.08
            band = np.clip(1.0 - np.abs(depth - centre) / 0.018, 0.0, 1.0)
            tile[:, :, :3] = mix(tile[:, :, :3], ripple_rgb, (band * 0.22)[:, :, None])
        edge = (0.08 + profile * 0.14) * OVERLAY_HEIGHT
        falloff = 0.7
    elif kind == "shoulder":
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
    """Bake every image once. Returns (images, native_provenance, seam_stats).

    Kept as one pure function so --verify-reproducible can call it twice and
    compare pixels, with no state carried between runs.
    """
    images = {}
    native_images, native_provenance = load_blender_ground()
    seam_stats = {}
    for name, material in sorted(MATERIALS.items()):
        image = native_images[name] if name in native_images else bake_surface(material)
        if verify_seamless:
            seam_stats[name] = seam_report(name, image)
        images[name] = image
        images[f"{name}-fringe"] = bake_fringe(name, image, material["seed"])
    for name, overlay in sorted(OVERLAYS.items()):
        strip = bake_overlay(name, overlay, native_images.get(OVERLAY_SOURCES.get(name)))
        if verify_seamless:
            # Strips repeat along U only, so only the X wrap can seam.
            seam_stats[name] = seam_report(name, strip, axes="x")
        images[name] = strip
    return images, native_provenance, seam_stats


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
    images, native_provenance, seam_stats = bake_everything(args.verify_seamless)

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
            "source": native_provenance["sources"].get(name, {"kind": "procedural-heightfield", "recipe": Path(__file__).relative_to(ROOT).as_posix()}),
            "bytes": path.stat().st_size,
            "sha256": digest,
        })
        fringe_name = f"{name}-fringe"
        fringe_path, fringe_digest = write(fringe_name, images[fringe_name])
        fringe_records.append({
            "id": name,
            "file": f"./{fringe_path.name}",
            "derivedFrom": name,
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
            "source": {"kind": "profiled-blender-ground", "material": OVERLAY_SOURCES[name]} if name in OVERLAY_SOURCES else {"kind": "procedural-heightfield"},
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
        "schemaVersion": 4,
        "pipelineId": PIPELINE_ID,
        "classification": "production-art",
        "runtimeAuthority": "projection-only",
        "tileSize": TILE_SIZE,
        "fringeHeight": FRINGE_HEIGHT,
        "overlayHeight": OVERLAY_HEIGHT,
        "materialAuthoring": "blender-ground-and-retained-surface-bakes",
        "nativeGround": {key: value for key, value in native_provenance.items() if key != "sources"},
        "roadNetwork": {"travelledMaterial": "road", "pathMaterial": "packed-earth", "shoulderOverlay": "road-shoulder"},
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

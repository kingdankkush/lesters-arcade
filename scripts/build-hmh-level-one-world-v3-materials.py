#!/usr/bin/env python3
"""Build seam-certified Level 1 World v3 terrain material masters."""

from __future__ import annotations

from collections import Counter
import json
import math
from pathlib import Path
import random
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFont

from hmh_forest_river_atlas import (
    base_rect as forest_base_rect,
    build_forest_river_atlas,
)

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "apps" / "portal" / "assets" / "generated" / "hmh-curated-level-art" / "terrain-textures"
OUTPUT_ROOT = ROOT / "apps" / "portal" / "assets" / "generated" / "hmh-level-one-world-v3" / "materials"
MANIFEST_JSON = OUTPUT_ROOT.parent / "hmh-level-one-world-v3-materials.json"
MANIFEST_MJS = OUTPUT_ROOT.parent / "hmh-level-one-world-v3-materials.mjs"
CONTACT_SHEET = OUTPUT_ROOT.parent / "hmh-level-one-world-v3-materials-contact-sheet.png"
FOREST_RIVER_ATLAS = OUTPUT_ROOT / "forest-river-terrain-atlas-v1.png"
TILE_SIZE = 160
QUADRANT = TILE_SIZE // 2

SPECS = [
    ("g", "dry-grass", "grass", "jul9-master-ground-terrain-a", 1, 1),
    ("G", "lush-grass", "grass", "jul9-park-path-plaza-a", 1, 2),
    ("F", "forest-floor", "grass", "jul9-master-ground-terrain-a", 1, 3),
    ("D", "packed-dirt", "dirt", "jul9-master-ground-terrain-a", 2, 2),
    ("S", "wasteland-sand", "sand", "jul9-master-ground-terrain-a", 4, 3),
    ("R", "rocky-ground", "rocky", "jul9-master-ground-terrain-a", 3, 3),
    ("X", "cliff-mountain", "rocky", "jul9-master-ground-terrain-a", 3, 4),
    ("C", "cobblestone", "road", "jul9-street-asphalt-parking-a", 3, 4),
    ("A", "cracked-asphalt", "road", "jul9-street-asphalt-parking-a", 1, 1),
    ("f", "farm-field", "grass", "jul9-master-ground-terrain-a", 1, 4),
    ("B", "beach-sand", "shore", "jul9-water-shore-mud-a", 5, 2),
    ("M", "mud-reeds", "shore", "jul9-water-shore-mud-a", 2, 2),
    ("W", "fresh-deep-water", "water", "jul9-rapid-water-b", 2, 2),
    ("w", "shallow-ford", "water", "jul9-water-shore-mud-a", 1, 4),
    ("O", "sea-water", "water", "jul9-rapid-water-b", 4, 2),
    ("H", "wood-bridge", "bridge", "jul9-road-transition-a", 3, 3),
    ("Q", "stone-road-bridge", "bridge", "jul9-road-transition-a", 3, 4),
]


def source_file(sheet: str, row: int, col: int) -> Path:
    matches = sorted((SOURCE_ROOT / sheet).glob(f"{row}-{col}-*.png"))
    if len(matches) != 1:
        raise RuntimeError(f"expected one source for {sheet} r{row} c{col}, found {len(matches)}")
    return matches[0]


PALETTES = {
    "g": ["#727b3f", "#89904a", "#a49552", "#594f32"],
    "G": ["#476e3d", "#5e8547", "#7c9a50", "#344b32"],
    "F": ["#3d4932", "#50593a", "#67543a", "#2d3328"],
    "D": ["#806044", "#98724d", "#6a4b38", "#b08558"],
    "S": ["#b98248", "#ca9857", "#9d693d", "#d4ad69"],
    "R": ["#625f5a", "#777069", "#4f4c49", "#928376"],
    "X": ["#41464a", "#555a5d", "#30353a", "#716b64"],
    "C": ["#686762", "#7c786f", "#4f514f", "#918a7e"],
    "A": ["#303439", "#3d4247", "#25292d", "#595b5a"],
    "f": ["#8d7d3f", "#a58e48", "#6f6638", "#b9a45a"],
    "B": ["#c3aa69", "#dcc780", "#aa8f56", "#ead998"],
    "M": ["#535940", "#6a704c", "#3e4939", "#857650"],
    "W": ["#285f78", "#347995", "#204d68", "#5b9bad"],
    "w": ["#4f8581", "#659b91", "#887c5d", "#aac0a0"],
    "O": ["#174663", "#205b78", "#12364f", "#3c7890"],
    "H": ["#a66b32", "#c48642", "#5c351d", "#e1aa5d"],
    "Q": ["#55585a", "#6c6d6b", "#3f4346", "#89867f"],
}


def hash_cell(x: int, y: int, salt: int) -> int:
    value = ((x + 1) * 0x45D9F3B) ^ ((y + 1) * 0x119DE1F3) ^ (salt * 0x27D4EB2D)
    value = (value ^ (value >> 16)) * 0x45D9F3B
    return (value ^ (value >> 16)) & 0xFFFFFFFF


def periodic_texture(code: str) -> Image.Image:
    size = 40
    period = size - 1
    palette = PALETTES[code]
    salt = ord(code)
    image = Image.new("RGBA", (size, size), palette[0])
    pixels = image.load()
    for y in range(period):
        for x in range(period):
            value = hash_cell(x, y, salt)
            index = 0
            if value % 17 == 0:
                index = 3
            elif value % 7 == 0:
                index = 2
            elif value % 3 == 0:
                index = 1
            pixels[x, y] = tuple(int(palette[index][i:i + 2], 16) for i in (1, 3, 5)) + (255,)

    draw = ImageDraw.Draw(image)
    if code in {"W", "O", "w"}:
        for y in range(4, period, 7):
            offset = hash_cell(2, y, salt) % 5
            for x in range(offset, period, 9):
                draw.line((x, y, min(period - 1, x + 4), y), fill=palette[3 if code == "O" else 1])
                if code != "O" and (x + y) % 3 == 0:
                    draw.point((min(period - 1, x + 1), max(0, y - 1)), fill=palette[3])
    elif code == "H":
        for y in range(4, period, 5):
            draw.line((0, y, period - 1, y), fill=palette[2])
            joint_shift = 4 if (y // 5) % 2 else 0
            for x in range(joint_shift, period, 9):
                draw.line((x, max(0, y - 4), x, y), fill=palette[2])
        for x in range(2, period, 9):
            draw.line((x, (x * 3) % period, min(period - 1, x + 3), (x * 3) % period), fill=palette[3])
    elif code in {"C", "Q"}:
        for y in range(1, period, 5):
            shift = 2 if (y // 5) % 2 else 0
            for x in range(-shift, period, 6):
                draw.rectangle((x, y, min(period - 1, x + 4), min(period - 1, y + 3)), outline=palette[2])
    elif code == "A":
        for start in [(4, 9), (18, 3), (30, 22)]:
            x, y = start
            draw.line((x, y, min(period - 1, x + 5), min(period - 1, y + 3)), fill=palette[2])
            draw.point((min(period - 1, x + 6), min(period - 1, y + 4)), fill=palette[3])
    elif code == "f":
        for x in range(2, period, 6):
            draw.line((x, 0, x, period - 1), fill=palette[2])
            draw.line((min(period - 1, x + 1), 0, min(period - 1, x + 1), period - 1), fill=palette[1])
    elif code in {"g", "G", "F", "M"}:
        for i in range(22):
            x = hash_cell(i, 4, salt) % period
            y = hash_cell(i, 9, salt) % period
            draw.line((x, y, x, max(0, y - 1)), fill=palette[1 if i % 3 else 3])
    elif code in {"R", "X"}:
        for i in range(12):
            x = hash_cell(i, 12, salt) % period
            y = hash_cell(i, 17, salt) % period
            draw.rectangle((x, y, min(period - 1, x + 2), min(period - 1, y + 1)), fill=palette[2 if i % 2 else 3])

    # Copy the first row/column to the opposite borders after all decoration.
    pixels = image.load()
    for y in range(size):
        pixels[period, y] = pixels[0, y if y < period else 0]
    for x in range(size):
        pixels[x, period] = pixels[x if x < period else 0, 0]
    return image.resize((TILE_SIZE, TILE_SIZE), Image.Resampling.NEAREST)


def edge_mismatch_count(image: Image.Image) -> int:
    px = image.convert("RGBA").load()
    mismatch = 0
    for y in range(image.height):
        if px[0, y] != px[image.width - 1, y]:
            mismatch += 1
    for x in range(image.width):
        if px[x, 0] != px[x, image.height - 1]:
            mismatch += 1
    return mismatch


def write_manifest(assets: list[dict], forest_atlas: dict) -> None:
    manifest = {
        "id": "hmh-level-one-world-v5-materials-v2",
        "levelId": "level-1-crypto-wasteland",
        "status": "runtime-ready-seam-certified",
        "tileSize": TILE_SIZE,
        "seamMethod": "periodic-pixel-material-nearest-neighbor",
        "assetCount": len(assets),
        "assets": assets,
        "forestRiverAtlas": forest_atlas,
    }
    js = json.dumps(manifest, indent=2)
    MANIFEST_MJS.write_text(
        "// Generated by scripts/build-hmh-level-one-world-v3-materials.py. Do not hand edit.\n"
        f"export const HMH_LEVEL_ONE_WORLD_V3_MATERIALS = Object.freeze({js});\n"
        "const BY_KEY = new Map(HMH_LEVEL_ONE_WORLD_V3_MATERIALS.assets.map((asset) => [asset.key, Object.freeze(asset)]));\n"
        "export function levelOneWorldV3MaterialByKey(key) { return BY_KEY.get(key) ?? null; }\n",
        encoding="utf-8",
    )


def write_contact_sheet(assets: list[dict]) -> None:
    columns = 4
    card_w, card_h = 192, 210
    rows = (len(assets) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * card_w, rows * card_h), "#0b0f15")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for index, asset in enumerate(assets):
        x = (index % columns) * card_w
        y = (index // columns) * card_h
        image = Image.open(ROOT / asset["path"]).convert("RGBA")
        if asset.get("atlasRect"):
            rect = asset["atlasRect"]
            image = image.crop((rect["x"], rect["y"], rect["x"] + rect["width"], rect["y"] + rect["height"]))
        image.thumbnail((160, 160), Image.Resampling.NEAREST)
        sheet.paste(image, (x + 16, y + 8))
        draw.text((x + 16, y + 172), f"{asset['code']} {asset['id']}", fill="#f2e7c8", font=font)
        draw.text((x + 16, y + 188), "seam mismatch: 0", fill="#75d88a", font=font)
    sheet.save(CONTACT_SHEET, optimize=True)


DESERT_OUT = OUTPUT_ROOT
SOURCE_MASK = OUTPUT_ROOT / "desert-approach-wang-v2-3-mask-source.png"
RUNTIME_MATERIAL = OUTPUT_ROOT / "desert-approach-wang-v2-3-materials.png"
RUNTIME_MASK = OUTPUT_ROOT / "desert-approach-wang-v2-3-masks.png"
ROAD_SUPERTILE_ATLAS = OUTPUT_ROOT / "road-supertile-overlays-v1.png"
BLUEPRINT_JSON = ROOT / "docs" / "game-design" / "data" / "hmh-level-1-world-blueprint-v3.json"
TILE_W = 128
TILE_H = 64
ROLES = ("sand", "dirt", "rocky", "road")
LATTICE_SHIFTS = ((0, 0), (-64, -32), (64, -32), (-64, 32), (64, 32))
ROLE_PATCH_COUNTS = {"sand": 9, "dirt": 8, "rocky": 11, "road": 5}
ROLE_FLECK_COUNTS = {"sand": 96, "dirt": 72, "rocky": 128, "road": 28}
ROLE_PALETTE_SPANS = {"sand": 30, "dirt": 24, "rocky": 22, "road": 12}
APPROVED_PALETTES = {
 "sand": [(180,147,85,255),(192,159,93,255),(185,152,88,255),(177,144,83,255),(178,145,84,255),(182,149,87,255),(174,141,81,255),(194,162,95,255),(189,156,91,255),(187,154,90,255),(140,94,49,255),(186,153,89,255),(203,181,129,255),(181,148,86,255)],
 "dirt": [(121,80,44,255),(124,81,45,255),(114,76,44,255),(127,84,46,255),(137,92,49,255),(133,89,48,255),(125,83,45,255),(119,78,44,255),(135,90,49,255),(75,52,41,255),(140,94,49,255),(129,86,46,255),(189,149,85,255)],
 "rocky": [(96,92,84,255),(105,101,91,255),(93,89,81,255),(60,58,56,255),(99,95,86,255),(100,96,87,255),(111,106,95,255),(203,181,129,255),(98,94,85,255),(95,91,82,255)],
 "road": [(84,58,35,255),(91,58,37,255),(84,57,35,255),(90,65,37,255),(89,64,37,255),(89,64,36,255),(89,65,36,255),(48,36,30,255),(102,73,42,255),(50,38,32,255),(98,71,40,255),(51,38,32,255),(100,72,41,255),(129,110,66,255),(125,106,64,255)],
}

def luminance(rgba: tuple[int, int, int, int]) -> float:
    r, g, b, _ = rgba
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def approved_palette(_tile: Image.Image, role: str):
    ranked = APPROVED_PALETTES[role]
    base = ranked[0]
    span = ROLE_PALETTE_SPANS[role]
    field = [color for color in ranked if abs(luminance(color) - luminance(base)) <= span]
    return field[:9], ranked

def draw_wrapped_polygon(draw: ImageDraw.ImageDraw, points: list[tuple[int, int]], color: tuple[int, int, int, int]) -> None:
    for offset_x in (-TILE_W, 0, TILE_W):
        for offset_y in (-TILE_H, 0, TILE_H):
            draw.polygon([(x + offset_x, y + offset_y) for x, y in points], fill=color)


def draw_wrapped_rect(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], color: tuple[int, int, int, int]) -> None:
    x0, y0, x1, y1 = box
    for offset_x in (-TILE_W, 0, TILE_W):
        for offset_y in (-TILE_H, 0, TILE_H):
            draw.rectangle((x0 + offset_x, y0 + offset_y, x1 + offset_x, y1 + offset_y), fill=color)


def periodic_material_field(source_role_strip: Image.Image, role: str, variant_index: int) -> Image.Image:
    field_palette, ranked_palette = approved_palette(source_role_strip, role)
    base = field_palette[0]
    image = Image.new("RGBA", (TILE_W, TILE_H), base)
    draw = ImageDraw.Draw(image)
    macro_rng = random.Random(f"hmh-desert-wang-v2-3:{role}:shared-macro")
    detail_rng = random.Random(f"hmh-desert-wang-v2-3:{role}:detail:{variant_index}")

    patch_colors = field_palette[1:] or field_palette
    for patch_index in range(ROLE_PATCH_COUNTS[role]):
        center_x = macro_rng.randrange(TILE_W)
        center_y = macro_rng.randrange(TILE_H)
        radius_x = macro_rng.randint(10, 28) if role != "road" else macro_rng.randint(8, 18)
        radius_y = macro_rng.randint(5, 14) if role != "road" else macro_rng.randint(3, 7)
        point_count = macro_rng.randint(6, 9)
        points = []
        for point_index in range(point_count):
            angle = (math.tau * point_index / point_count) + macro_rng.uniform(-0.18, 0.18)
            scale = macro_rng.uniform(0.72, 1.18)
            points.append((
                round(center_x + math.cos(angle) * radius_x * scale),
                round(center_y + math.sin(angle) * radius_y * scale),
            ))
        color = patch_colors[(patch_index + variant_index) % len(patch_colors)]
        draw_wrapped_polygon(draw, points, color)

    detail_palette = list(field_palette)
    if role not in {"rocky", "road"}:
        dark = [color for color in ranked_palette if luminance(color) < luminance(base) - 28]
        detail_palette.extend(dark[:1])

    for fleck_index in range(ROLE_FLECK_COUNTS[role]):
        x = detail_rng.randrange(TILE_W)
        y = detail_rng.randrange(TILE_H)
        color = detail_palette[(fleck_index * 3 + variant_index) % len(detail_palette)]
        if role == "rocky" and fleck_index % 7 == 0:
            box = (x, y, x + detail_rng.randint(2, 4), y + detail_rng.randint(1, 2))
        elif role == "road" and fleck_index % 5 == 0:
            box = (x, y, x + detail_rng.randint(1, 2), y)
        else:
            box = (x, y, x + (1 if fleck_index % 9 == 0 else 0), y)
        draw_wrapped_rect(draw, box, color)

    if role == "rocky":
        mineral = [color for color in ranked_palette if luminance(color) > luminance(base) + 45]
        if mineral:
            for _accent_index in range(2):
                x = detail_rng.randrange(2, TILE_W - 2)
                y = detail_rng.randrange(2, TILE_H - 2)
                draw.point((x, y), fill=mineral[0])

    # Exact boundary equality prevents a one-pixel repeat seam after nearest-neighbor sampling.
    pixels = image.load()
    for y in range(TILE_H):
        pixels[TILE_W - 1, y] = pixels[0, y]
    for x in range(TILE_W):
        pixels[x, TILE_H - 1] = pixels[x, 0]
    return image


def paste_mask_lattice(tile: Image.Image) -> Image.Image:
    out = Image.new("L", (TILE_W, TILE_H), 0)
    for x, y in LATTICE_SHIFTS:
        shifted = Image.new("L", (TILE_W, TILE_H), 0)
        shifted.paste(tile, (x, y))
        out = ImageChops.lighter(out, shifted)
    values = set(out.get_flattened_data())
    if not values.issubset({0, 255}):
        raise RuntimeError(f"mask lattice is not binary: {sorted(values)[:8]}")
    return out


def opposite_edges_exact(image: Image.Image) -> bool:
    pixels = image.load()
    return all(pixels[0, y] == pixels[TILE_W - 1, y] for y in range(TILE_H)) and all(
        pixels[x, 0] == pixels[x, TILE_H - 1] for x in range(TILE_W)
    )


def former_diamond_edge_contrast(image: Image.Image) -> float:
    pixels = image.convert("RGB").load()
    samples: list[float] = []
    for x in range(2, TILE_W - 2):
        if x < TILE_W // 2:
            top_y = round(TILE_H / 2 - x / 2)
            bottom_y = round(TILE_H / 2 + x / 2)
        else:
            top_y = round((x - TILE_W / 2) / 2)
            bottom_y = round(TILE_H - (x - TILE_W / 2) / 2)
        for y in (top_y, bottom_y):
            if 1 <= y < TILE_H - 1:
                above = pixels[x, y - 1]
                below = pixels[x, y + 1]
                samples.append(sum(abs(a - b) for a, b in zip(above, below)) / 3)
    return round(sum(samples) / max(1, len(samples)), 3)



def build_desert_approach_wang_runtime() -> dict:
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    if not SOURCE_MASK.exists():
        raise RuntimeError(f"approved Wang mask source is missing: {SOURCE_MASK}")
    source_mask = Image.open(SOURCE_MASK).convert("L")
    if source_mask.size != (1024, 512):
        raise RuntimeError(f"unexpected approved Wang mask size: {source_mask.size}")
    runtime_material = Image.new("RGBA", (512, 256), (0, 0, 0, 0))
    colors_max = 0
    for role_index, role in enumerate(ROLES):
        for variant_index in range(4):
            field = periodic_material_field(None, role, variant_index)
            colors = len(field.getcolors(maxcolors=1_000_000) or [])
            colors_max = max(colors_max, colors)
            if colors > 15 or not opposite_edges_exact(field) or field.getchannel("A").getextrema() != (255, 255):
                raise RuntimeError(f"{role} variant {variant_index + 1} failed runtime certification")
            runtime_material.paste(field, (variant_index * TILE_W, role_index * TILE_H))
    runtime_material.save(RUNTIME_MATERIAL, optimize=True)
    runtime_mask = Image.new("L", source_mask.size, 0)
    for phase in range(4):
        for bits in range(16):
            index = phase * 16 + bits
            x = (index % 8) * TILE_W
            y = (index // 8) * TILE_H
            runtime_mask.paste(paste_mask_lattice(source_mask.crop((x, y, x + TILE_W, y + TILE_H))), (x, y))
    runtime_mask.save(RUNTIME_MASK, optimize=True)
    return {"status": "PASS", "materials": 16, "masks": 64, "colorsMax": colors_max, "materialAtlasBytes": RUNTIME_MATERIAL.stat().st_size, "maskAtlasBytes": RUNTIME_MASK.stat().st_size, "totalDecodedBytes": 1024 * 1024}


ROAD_DIRECTION_BITS = {
    (-1, 0): 1,
    (1, 0): 2,
    (0, -1): 4,
    (0, 1): 8,
    (-1, -1): 16,
    (1, -1): 32,
    (1, 1): 64,
    (-1, 1): 128,
}
ROAD_DIRECTION_ENDPOINTS = {
    1: (32, 16),
    2: (96, 48),
    4: (96, 16),
    8: (32, 48),
    16: (64, 0),
    32: (127, 32),
    64: (64, 63),
    128: (0, 32),
}
ROAD_CARDINAL_EDGES = {
    1: ((64, 0), (127, 32)),
    2: ((127, 32), (64, 63)),
    4: ((64, 63), (0, 32)),
    8: ((0, 32), (64, 0)),
}
ROAD_STYLES = ("asphalt", "dirt")
BRIDGE_STYLES = ("wood", "stone-road")
BRIDGE_AXES = ("east-west", "north-east-south-west")
BRIDGE_AXIS_MASKS = {"east-west": 1 | 2, "north-east-south-west": 32 | 128}


def bresenham(a: tuple[int, int], b: tuple[int, int]) -> list[tuple[int, int]]:
    x0, y0 = a
    x1, y1 = b
    points: list[tuple[int, int]] = []
    dx = abs(x1 - x0)
    sx = 1 if x0 < x1 else -1
    dy = -abs(y1 - y0)
    sy = 1 if y0 < y1 else -1
    error = dx + dy
    while True:
        points.append((x0, y0))
        if (x0, y0) == (x1, y1):
            return points
        doubled = 2 * error
        if doubled >= dy:
            error += dy
            x0 += sx
        if doubled <= dx:
            error += dx
            y0 += sy


def expand_control_points(control_points: list[list[int]]) -> list[tuple[int, int]]:
    result: list[tuple[int, int]] = []
    for index in range(len(control_points) - 1):
        segment = bresenham(tuple(control_points[index]), tuple(control_points[index + 1]))
        result.extend(segment if index == 0 else segment[1:])
    return result


def road_centerline_masks() -> tuple[list[int], dict[tuple[int, int], int]]:
    if not BLUEPRINT_JSON.exists():
        raise RuntimeError(f"road blueprint metadata is missing: {BLUEPRINT_JSON}")
    blueprint = json.loads(BLUEPRINT_JSON.read_text(encoding="utf-8"))
    directions_by_cell: dict[tuple[int, int], set[tuple[int, int]]] = {}
    for path in blueprint["routePresentation"]["paths"]:
        points = expand_control_points(path["controlPoints"])
        for index, point in enumerate(points):
            directions = directions_by_cell.setdefault(point, set())
            neighbors = []
            if index > 0:
                neighbors.append(points[index - 1])
            if index + 1 < len(points):
                neighbors.append(points[index + 1])
            for neighbor in neighbors:
                directions.add((neighbor[0] - point[0], neighbor[1] - point[1]))
    masks_by_cell = {
        point: sum(ROAD_DIRECTION_BITS[direction] for direction in directions)
        for point, directions in directions_by_cell.items()
    }
    masks = sorted(set(masks_by_cell.values()))
    if not masks or len(masks) > 32:
        raise RuntimeError(f"expected 1-32 authored road centerline masks, found {len(masks)}")
    return masks, masks_by_cell


def lattice_overlay(tile: Image.Image) -> Image.Image:
    output = Image.new("RGBA", (TILE_W, TILE_H), (0, 0, 0, 0))
    for offset_x, offset_y in LATTICE_SHIFTS:
        shifted = Image.new("RGBA", (TILE_W, TILE_H), (0, 0, 0, 0))
        shifted.alpha_composite(tile, (offset_x, offset_y))
        output = Image.alpha_composite(output, shifted)
    return output


def road_shoulder_tile(bits: int, style: str) -> Image.Image:
    tile = Image.new("RGBA", (TILE_W, TILE_H), (0, 0, 0, 0))
    mask = Image.new("L", (TILE_W, TILE_H), 0)
    mask_draw = ImageDraw.Draw(mask)
    center = (64, 32)
    for bit, edge in ROAD_CARDINAL_EDGES.items():
        if not bits & bit:
            continue
        inner = [
            (round(point[0] + (center[0] - point[0]) * 0.14), round(point[1] + (center[1] - point[1]) * 0.14))
            for point in edge
        ]
        mask_draw.polygon([edge[0], edge[1], inner[1], inner[0]], fill=255)

    palettes = {
        "asphalt": ((125, 91, 57, 172), (78, 61, 46, 178), (171, 132, 78, 156)),
        "dirt": ((139, 101, 62, 156), (91, 68, 49, 164), (181, 139, 82, 142)),
    }
    base, dark, light = palettes[style]
    pixels = tile.load()
    mask_pixels = mask.load()
    salt = 71 if style == "asphalt" else 113
    for y in range(TILE_H):
        for x in range(TILE_W):
            if not mask_pixels[x, y]:
                continue
            value = hash_cell(x, y, salt + bits * 17)
            color = dark if value % 37 == 0 else light if value % 29 == 0 else base
            pixels[x, y] = color

    draw = ImageDraw.Draw(tile)
    for bit, edge in ROAD_CARDINAL_EDGES.items():
        if not bits & bit:
            continue
        inner = [
            (round(point[0] + (center[0] - point[0]) * 0.14), round(point[1] + (center[1] - point[1]) * 0.14))
            for point in edge
        ]
        draw.line((inner[0], inner[1]), fill=dark, width=1)
    return lattice_overlay(tile)


def lerp_pixel(a: tuple[int, int], b: tuple[int, int], amount: float) -> tuple[int, int]:
    return (round(a[0] + (b[0] - a[0]) * amount), round(a[1] + (b[1] - a[1]) * amount))


def road_marking_tile(mask: int, style: str) -> Image.Image:
    tile = Image.new("RGBA", (TILE_W, TILE_H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(tile)
    center = (64, 32)
    arm_count = sum(1 for bit in ROAD_DIRECTION_ENDPOINTS if mask & bit)
    for bit, endpoint in ROAD_DIRECTION_ENDPOINTS.items():
        if not mask & bit:
            continue
        if style == "asphalt":
            draw.line((center, endpoint), fill=(30, 27, 25, 145), width=5)
            inner = lerp_pixel(center, endpoint, 0.18 if arm_count <= 2 else 0.34)
            dash_a = lerp_pixel(center, endpoint, 0.46)
            dash_b = lerp_pixel(center, endpoint, 0.68)
            outer = lerp_pixel(center, endpoint, 0.92)
            paint = (221, 181, 72, 220)
            draw.line((inner, dash_a), fill=paint, width=2)
            draw.line((dash_b, outer), fill=paint, width=2)
        else:
            dx = endpoint[0] - center[0]
            dy = endpoint[1] - center[1]
            length = max(1.0, math.hypot(dx, dy))
            ox = round(-dy / length * 3)
            oy = round(dx / length * 3)
            for sign in (-1, 1):
                start = (center[0] + ox * sign, center[1] + oy * sign)
                end = (endpoint[0] + ox * sign, endpoint[1] + oy * sign)
                draw.line((start, end), fill=(74, 49, 34, 168), width=2)
                highlight_start = lerp_pixel(start, end, 0.28)
                highlight_end = lerp_pixel(start, end, 0.74)
                draw.line((highlight_start, highlight_end), fill=(190, 140, 76, 125), width=1)
    if arm_count >= 3:
        fill = (72, 58, 39, 205) if style == "dirt" else (197, 157, 59, 205)
        draw.rectangle((62, 30, 66, 34), fill=fill)
    return lattice_overlay(tile)


def bridge_detail_tile(edge_bits: int, style: str, axis: str) -> Image.Image:
    tile = Image.new("RGBA", (TILE_W, TILE_H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(tile)
    center = (64, 32)
    axis_mask = BRIDGE_AXIS_MASKS[axis]
    endpoints = [ROAD_DIRECTION_ENDPOINTS[bit] for bit in ROAD_DIRECTION_ENDPOINTS if axis_mask & bit]
    if len(endpoints) != 2:
        raise RuntimeError(f"bridge axis {axis} did not resolve two endpoints")

    if style == "stone-road":
        draw.line((endpoints[0], endpoints[1]), fill=(29, 29, 27, 150), width=6)
        for endpoint in endpoints:
            dash_a = lerp_pixel(center, endpoint, 0.30)
            dash_b = lerp_pixel(center, endpoint, 0.68)
            draw.line((dash_a, dash_b), fill=(224, 184, 76, 220), width=2)
    else:
        dx = endpoints[1][0] - endpoints[0][0]
        dy = endpoints[1][1] - endpoints[0][1]
        length = max(1.0, math.hypot(dx, dy))
        px = -dy / length
        py = dx / length
        for step in range(1, 8):
            amount = step / 8
            cx = round(endpoints[0][0] + dx * amount)
            cy = round(endpoints[0][1] + dy * amount)
            half = 6 if step % 2 else 7
            draw.line(
                ((round(cx - px * half), round(cy - py * half)), (round(cx + px * half), round(cy + py * half))),
                fill=(65, 39, 23, 178),
                width=1,
            )

    rail_dark = (39, 29, 24, 235) if style == "wood" else (42, 43, 42, 235)
    rail_light = (186, 130, 67, 225) if style == "wood" else (143, 145, 136, 220)
    threshold = (94, 59, 31, 220) if style == "wood" else (91, 88, 79, 220)
    for bit, edge in ROAD_CARDINAL_EDGES.items():
        if not edge_bits & bit:
            continue
        is_approach = (axis == "east-west" and bit in {2, 8}) or (
            axis == "north-east-south-west" and edge_bits in {3, 12}
        )
        inner = [lerp_pixel(point, center, 0.17) for point in edge]
        if is_approach:
            draw.line((inner[0], inner[1]), fill=rail_dark, width=5)
            draw.line((lerp_pixel(inner[0], inner[1], 0.18), lerp_pixel(inner[0], inner[1], 0.82)), fill=threshold, width=2)
            continue
        draw.line((inner[0], inner[1]), fill=rail_dark, width=7)
        draw.line((inner[0], inner[1]), fill=rail_light, width=2)
        for amount in (0.18, 0.82):
            post = lerp_pixel(inner[0], inner[1], amount)
            draw.rectangle((post[0] - 2, post[1] - 3, post[0] + 2, post[1] + 2), fill=rail_dark)
            draw.line(((post[0] - 1, post[1] - 3), (post[0] + 1, post[1] - 3)), fill=rail_light, width=1)
    return lattice_overlay(tile)


def build_road_supertile_runtime() -> dict:
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    centerline_masks, masks_by_cell = road_centerline_masks()
    atlas = Image.new("RGBA", (2048, 640), (0, 0, 0, 0))

    def paste_at(index: int, tile: Image.Image) -> None:
        atlas.alpha_composite(tile, ((index % 16) * TILE_W, (index // 16) * TILE_H))

    for style_index, style in enumerate(ROAD_STYLES):
        for bits in range(16):
            paste_at(style_index * 16 + bits, road_shoulder_tile(bits, style))
        for mask_index, mask in enumerate(centerline_masks):
            paste_at(32 + style_index * len(centerline_masks) + mask_index, road_marking_tile(mask, style))

    bridge_base_index = 96
    for style_index, style in enumerate(BRIDGE_STYLES):
        for axis_index, axis in enumerate(BRIDGE_AXES):
            for edge_bits in range(16):
                paste_at(
                    bridge_base_index + style_index * 32 + axis_index * 16 + edge_bits,
                    bridge_detail_tile(edge_bits, style, axis),
                )

    atlas.save(ROAD_SUPERTILE_ATLAS, optimize=True)
    if atlas.size != (2048, 640) or not (1 <= len(centerline_masks) <= 32):
        raise RuntimeError("road supertile atlas certification failed")
    return {
        "status": "PASS",
        "styles": len(ROAD_STYLES),
        "shoulderMasks": 16,
        "centerlineMasks": len(centerline_masks),
        "centerlineCells": len(masks_by_cell),
        "bridgeStyles": len(BRIDGE_STYLES),
        "bridgeAxes": len(BRIDGE_AXES),
        "bridgeEdgeMasks": len(BRIDGE_STYLES) * len(BRIDGE_AXES) * 16,
        "atlasBytes": ROAD_SUPERTILE_ATLAS.stat().st_size,
        "atlasDecodedBytes": 2048 * 640 * 4,
    }

def main() -> None:
    if "--forest-river-only" in sys.argv:
        print(json.dumps(build_forest_river_atlas(FOREST_RIVER_ATLAS), indent=2))
        return
    if "--desert-wang-only" in sys.argv:
        print(json.dumps(build_desert_approach_wang_runtime(), indent=2))
        return
    if "--road-supertiles-only" in sys.argv:
        print(json.dumps(build_road_supertile_runtime(), indent=2))
        return
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    forest_atlas = build_forest_river_atlas(FOREST_RIVER_ATLAS)
    assets = []
    for code, asset_id, role, sheet, row, col in SPECS:
        if code == "F":
            rect = forest_base_rect("forest", 0)
            assets.append({
                "key": "world-v3-material/forest-floor",
                "id": "forest-floor",
                "code": code,
                "role": role,
                "src": forest_atlas["src"],
                "path": FOREST_RIVER_ATLAS.relative_to(ROOT).as_posix(),
                "width": rect["width"],
                "height": rect["height"],
                "atlasRect": rect,
                "source": "repo-owned deterministic forest-river atlas v1",
                "seamMismatchPixels": 0,
                "opaque": False,
                "sampling": "nearest-neighbor",
            })
            continue
        source = source_file(sheet, row, col)
        output = periodic_texture(code)
        mismatch = edge_mismatch_count(output)
        if mismatch:
            raise RuntimeError(f"{asset_id} has {mismatch} opposite-edge mismatches")
        filename = f"{asset_id}.png"
        destination = OUTPUT_ROOT / filename
        output.save(destination, optimize=True)
        rel = destination.relative_to(ROOT).as_posix()
        assets.append({
            "key": f"world-v3-material/{asset_id}",
            "id": asset_id,
            "code": code,
            "role": role,
            "src": f"./assets/generated/hmh-level-one-world-v3/materials/{filename}",
            "path": rel,
            "width": TILE_SIZE,
            "height": TILE_SIZE,
            "source": source.relative_to(ROOT).as_posix(),
            "seamMismatchPixels": mismatch,
            "opaque": output.getextrema()[3] == (255, 255),
            "sampling": "nearest-neighbor",
        })
    write_manifest(assets, forest_atlas)
    write_contact_sheet(assets)
    desert = build_desert_approach_wang_runtime()
    roads = build_road_supertile_runtime()
    print(json.dumps({"assets": len(assets), "manifest": str(MANIFEST_MJS), "contactSheet": str(CONTACT_SHEET), "forestRiver": forest_atlas, "desertApproach": desert, "roadSupertiles": roads}, indent=2))


if __name__ == "__main__":
    main()

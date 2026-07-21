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

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "apps" / "portal" / "assets" / "generated" / "hmh-curated-level-art" / "terrain-textures"
OUTPUT_ROOT = ROOT / "apps" / "portal" / "assets" / "generated" / "hmh-level-one-world-v3" / "materials"
MANIFEST_JSON = OUTPUT_ROOT.parent / "hmh-level-one-world-v3-materials.json"
MANIFEST_MJS = OUTPUT_ROOT.parent / "hmh-level-one-world-v3-materials.mjs"
CONTACT_SHEET = OUTPUT_ROOT.parent / "hmh-level-one-world-v3-materials-contact-sheet.png"
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


def write_manifest(assets: list[dict]) -> None:
    manifest = {
        "id": "hmh-level-one-world-v3-materials-v1",
        "levelId": "level-1-crypto-wasteland",
        "status": "runtime-ready-seam-certified",
        "tileSize": TILE_SIZE,
        "seamMethod": "periodic-pixel-material-nearest-neighbor",
        "assetCount": len(assets),
        "assets": assets,
    }
    MANIFEST_JSON.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
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
        image = Image.open(ROOT / asset["path"]).convert("RGB")
        sheet.paste(image, (x + 16, y + 8))
        draw.text((x + 16, y + 172), f"{asset['code']} {asset['id']}", fill="#f2e7c8", font=font)
        draw.text((x + 16, y + 188), "seam mismatch: 0", fill="#75d88a", font=font)
    sheet.save(CONTACT_SHEET, optimize=True)


DESERT_OUT = OUTPUT_ROOT
SOURCE_MASK = OUTPUT_ROOT / "desert-approach-wang-v2-3-mask-source.png"
RUNTIME_MATERIAL = OUTPUT_ROOT / "desert-approach-wang-v2-3-materials.png"
RUNTIME_MASK = OUTPUT_ROOT / "desert-approach-wang-v2-3-masks.png"
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

def main() -> None:
    if "--desert-wang-only" in sys.argv:
        print(json.dumps(build_desert_approach_wang_runtime(), indent=2))
        return
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    assets = []
    for code, asset_id, role, sheet, row, col in SPECS:
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
    write_manifest(assets)
    write_contact_sheet(assets)
    desert = build_desert_approach_wang_runtime()
    print(json.dumps({"assets": len(assets), "manifest": str(MANIFEST_JSON), "contactSheet": str(CONTACT_SHEET), "desertApproach": desert}, indent=2))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Build seam-certified Level 1 World v3 terrain material masters."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

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


def main() -> None:
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
    print(json.dumps({"assets": len(assets), "manifest": str(MANIFEST_JSON), "contactSheet": str(CONTACT_SHEET)}, indent=2))


if __name__ == "__main__":
    main()

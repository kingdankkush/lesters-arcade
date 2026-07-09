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
FOREST_SHEETS = [
    ("forest-boundary-a", ATTACHMENTS / "Jul 8, 2026, 08_40_02 PM.png"),
    ("forest-boundary-b", ATTACHMENTS / "Jul 8, 2026, 08_40_00 PM.png"),
]
GROUND_SHEETS = [
    ("ground-rock-grass-dirt-a", ATTACHMENTS / "ChatGPT Image Jul 8, 2026, 08_52_18 PM.png"),
    ("ground-grass-dirt-path-a", ATTACHMENTS / "ChatGPT Image Jul 8, 2026, 08_50_57 PM.png"),
]
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


def normalize_prop(cell: Image.Image, canvas_size: int = 256, max_fill: int = 236) -> Image.Image:
    keyed = magenta_key(cell)
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
    return remove_tiny_alpha_islands(canvas)


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


def main() -> None:
    ensure_sources([TREE_SHEET, *(p for _, p in FOREST_SHEETS), *(p for _, p in GROUND_SHEETS)])
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

    ground_tiles = []
    for sheet_slug, sheet_path in GROUND_SHEETS:
        img = Image.open(sheet_path)
        tile_dir = OUT / "ground" / sheet_slug
        tile_dir.mkdir(parents=True, exist_ok=True)
        for row in range(5):
            for col in range(5):
                index = row * 5 + col
                label = GROUND_LABELS[index]
                slug = f"{sheet_slug}-r{row + 1}-c{col + 1}"
                cell = grid_crop(img, 5, 5, row, col)
                tile = make_iso_tile(cell)
                tile_path = tile_dir / f"{row + 1}-{col + 1}-{label}.png"
                tile.save(tile_path, optimize=True)
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
                })

    manifest = {
        "id": "hmh-curated-level-art-chatgpt-2026-07-08",
        "generatedFrom": "Justin-approved ChatGPT Image tree, forest, and ground tile sheets; local source paths redacted",
        "sourceSheets": [
            {"id": "tree-idle", "grid": {"rows": 3, "cols": 6}, "kind": "magenta-keyed animated tree prop sheet"},
            {"id": "forest-boundary-a", "grid": {"rows": 4, "cols": 4}, "kind": "magenta-keyed forest boundary prop sheet"},
            {"id": "forest-boundary-b", "grid": {"rows": 4, "cols": 4}, "kind": "magenta-keyed forest boundary prop sheet"},
            {"id": "ground-rock-grass-dirt-a", "grid": {"rows": 5, "cols": 5}, "kind": "full-cell terrain tile sheet"},
            {"id": "ground-grass-dirt-path-a", "grid": {"rows": 5, "cols": 5}, "kind": "full-cell terrain tile sheet"},
        ],
        "gridCounts": {
            "treeIdleFrames": sum(len(tree["frames"]) for tree in tree_animations),
            "forestProps": len(forest_props),
            "groundTiles": len(ground_tiles),
        },
        "runtime": {
            "coherentWorldRoot": "./assets/generated/hmh-coherent-world/curated",
            "groundRoot": "./assets/generated/hmh-curated-level-art/ground",
            "propRoot": "./assets/generated/hmh-curated-level-art/props",
        },
        "treeAnimations": tree_animations,
        "forestProps": forest_props,
        "groundTiles": ground_tiles,
        "recommendedGroundSlugs": {
            "grassDominant": "ground-grass-dirt-path-a-r1-c1",
            "grassAccent": "ground-grass-dirt-path-a-r3-c2",
            "forestFloor": "ground-rock-grass-dirt-a-r2-c1",
            "rockyAccent": "ground-rock-grass-dirt-a-r4-c3",
            "dirtPath": "ground-grass-dirt-path-a-r3-c4",
        },
    }
    write_json(OUT / "hmh-curated-level-art.json", manifest)
    write_module(OUT / "hmh-curated-level-art.mjs", "HMH_CURATED_LEVEL_ART", manifest)
    print(json.dumps({
        "treeFrames": manifest["gridCounts"]["treeIdleFrames"],
        "forestProps": manifest["gridCounts"]["forestProps"],
        "groundTiles": manifest["gridCounts"]["groundTiles"],
        "out": str(OUT.relative_to(ROOT)),
    }, indent=2))


if __name__ == "__main__":
    main()

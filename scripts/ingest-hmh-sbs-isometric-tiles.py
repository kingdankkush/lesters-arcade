#!/usr/bin/env python
"""Ingest CC0 Screaming Brain Studios 128x64 isometric tiles for HMH Level 1.

Inputs stay in Justin's Downloads folder. Outputs are cleaned, role-named PNGs
and manifests under the portal generated-assets tree.
"""

from __future__ import annotations

import json
import re
import zipfile
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
DOWNLOADS = Path(r"C:/Users/just_/Downloads")
OUT_DIR = ROOT / "apps/portal/assets/generated/hmh-level-one-ground/sbs-cc0"
DOC_ASSET_DIR = ROOT / "docs/game-design/assets"
DOC_PATH = ROOT / "docs/game-design/hard-money-heroes-sbs-ground-ingestion.md"

SRC_SMALL = DOWNLOADS / "sbs_-_isometric_floor_tiles_-_small_128x64.zip"
SRC_AUTOTILES = DOWNLOADS / "sbs_-_floor_tile_update_1_-_autotiles.zip"
SRC_WATER = DOWNLOADS / "sbs_-_floor_tile_update_2_-_water.zip"
SRC_OVERWORLD = DOWNLOADS / "sbs_-_isometric_overworld_pack_-_small.zip"

LICENSE = "CC0/Public Domain"
SOURCE_URLS = [
    "https://screamingbrainstudios.itch.io/isotilepack",
    "https://opengameart.org/content/1000-isometric-floor-tiles",
]

@dataclass(frozen=True)
class TileSpec:
    key: str
    role: str
    category: str
    archive: Path
    member: str
    col: int
    row: int
    cell_w: int
    cell_h: int
    description: str
    preferred: bool = False
    animated: bool = False


def extract_member(archive: Path, member: str) -> Image.Image:
    with zipfile.ZipFile(archive) as zf:
        with zf.open(member) as fh:
            return Image.open(BytesIO(fh.read())).convert("RGBA")


def transparentize_background(img: Image.Image) -> Image.Image:
    """Remove sheet matte colors while preserving textured tile pixels.

    SBS sheets use black and/or magenta backgrounds. A flood-fill from the edges
    avoids deleting legitimate dark pixels inside a tile.
    """
    img = img.convert("RGBA")
    pix = img.load()
    w, h = img.size
    bg = Image.new("L", (w, h), 0)
    bg_pix = bg.load()
    stack = []
    for x in range(w):
        stack.append((x, 0)); stack.append((x, h - 1))
    for y in range(h):
        stack.append((0, y)); stack.append((w - 1, y))

    def is_bg(px: tuple[int, int, int, int]) -> bool:
        r, g, b, a = px
        if a <= 8:
            return True
        # black sheet matte, near-black antialias, magenta chroma key, or white preview matte
        if r <= 12 and g <= 12 and b <= 12:
            return True
        if r >= 215 and b >= 215 and g <= 80:
            return True
        if r >= 242 and g >= 242 and b >= 242:
            return True
        return False

    while stack:
        x, y = stack.pop()
        if x < 0 or y < 0 or x >= w or y >= h or bg_pix[x, y]:
            continue
        if not is_bg(pix[x, y]):
            continue
        bg_pix[x, y] = 255
        stack.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))

    out = img.copy()
    out_pix = out.load()
    for y in range(h):
        for x in range(w):
            if bg_pix[x, y]:
                r, g, b, _a = out_pix[x, y]
                out_pix[x, y] = (r, g, b, 0)
    return out


def crop_tile(spec: TileSpec) -> Image.Image:
    sheet = extract_member(spec.archive, spec.member)
    x0 = spec.col * spec.cell_w
    y0 = spec.row * spec.cell_h
    tile = sheet.crop((x0, y0, x0 + spec.cell_w, y0 + spec.cell_h))
    tile = transparentize_background(tile)
    # Trim only fully transparent padding, then repad to preserve source tile size.
    bbox = tile.getbbox()
    if not bbox:
        raise RuntimeError(f"blank tile after cleanup: {spec.key}")
    return tile


def safe_png_name(key: str) -> str:
    return re.sub(r"[^a-z0-9-]+", "-", key.lower()).strip("-") + ".png"


SPECS: list[TileSpec] = [
    # Base floor roles
    TileSpec("grass-base-01", "grass", "terrain", SRC_SMALL, "Small 128x64/Worldmap/1 Forests 128x64.png", 0, 0, 128, 64, "SBS small forest/grass base tile", True),
    TileSpec("grass-base-02", "grass", "terrain", SRC_OVERWORLD, "Overworld - Small/Flat/Overworld - Forest - Flat 128x64.png", 1, 1, 128, 64, "SBS overworld forest/grass variation"),
    TileSpec("dirt-base-01", "dirt", "terrain", SRC_SMALL, "Small 128x64/Pathways/1 Basic Ground - 128x72.png", 3, 0, 128, 72, "SBS brown dirt ground tile", True),
    TileSpec("dirt-base-02", "dirt", "terrain", SRC_AUTOTILES, "Autotiles/128x64 Ground Tiles - Update 1.png", 0, 0, 128, 64, "SBS update dirt ground variation"),
    TileSpec("sand-base-01", "sand", "terrain", SRC_SMALL, "Small 128x64/Worldmap/2 Ground - Dry 128x64.png", 0, 0, 128, 64, "SBS dry sand/desert ground tile", True),
    TileSpec("sand-base-02", "sand", "terrain", SRC_SMALL, "Small 128x64/Worldmap/2 Ground - Dry 128x64.png", 1, 1, 128, 64, "SBS dry sand/desert variation"),
    TileSpec("rocky-base-01", "rocky", "terrain", SRC_SMALL, "Small 128x64/Worldmap/2 Ground - Rocky 128x64.png", 0, 0, 128, 64, "SBS rocky ground tile", True),
    TileSpec("rocky-base-02", "rocky", "terrain", SRC_OVERWORLD, "Overworld - Small/Flat/Overworld - Terrain 3 - Flat 128x64.png", 1, 1, 128, 64, "SBS overworld rocky/mesa variation"),

    # Water and shores
    TileSpec("water-flat-01", "water", "water", SRC_WATER, "Water/Flat/Solid Tiles Flat 128x88.png", 5, 0, 128, 64, "SBS flat water tile", True, True),
    TileSpec("water-flat-02", "water", "water", SRC_OVERWORLD, "Overworld - Small/Flat/Overworld - Water - Flat 128x64.png", 1, 0, 128, 64, "SBS blue-green flat water variation", False, True),
    TileSpec("shore-grass-water-01", "shore", "water", SRC_WATER, "Water/Height Mapped/Grass A - Water HM 128x88.png", 0, 0, 128, 88, "SBS grass-to-height-mapped-water shore", True),
    TileSpec("shore-dirt-water-01", "shore", "water", SRC_WATER, "Water/Height Mapped/Dirt A - Water HM 128x88.png", 0, 0, 128, 88, "SBS dirt-to-height-mapped-water shore"),
    TileSpec("shore-sand-water-01", "shore", "water", SRC_WATER, "Water/Height Mapped/Sand A - Water HM 128x88.png", 0, 0, 128, 88, "SBS sand-to-height-mapped-water shore", True),
    TileSpec("water-overworld-01", "water", "water", SRC_OVERWORLD, "Overworld - Small/Flat/Overworld - Water - Flat 128x64.png", 0, 0, 128, 64, "SBS overworld water base"),

    # Transitions / biome seams
    TileSpec("transition-grass-dirt-01", "grass-to-dirt", "transition", SRC_AUTOTILES, "Autotiles/128x64 Grass A to Dirt A.png", 0, 0, 128, 64, "SBS grass A to dirt A transition", True),
    TileSpec("transition-grass-dirt-02", "grass-to-dirt", "transition", SRC_AUTOTILES, "Autotiles/128x64 Grass B to Dirt B.png", 1, 1, 128, 64, "SBS grass B to dirt B transition"),
    TileSpec("transition-dirt-sand-01", "dirt-to-sand", "transition", SRC_AUTOTILES, "Autotiles/128x64 Dirt A to Sand A.png", 0, 0, 128, 64, "SBS dirt A to sand A transition", True),
    TileSpec("transition-dirt-sand-02", "dirt-to-sand", "transition", SRC_AUTOTILES, "Autotiles/128x64 Dirt B to Sand A.png", 1, 1, 128, 64, "SBS dirt B to sand A transition"),
    TileSpec("transition-grass-sand-01", "grass-to-sand", "transition", SRC_AUTOTILES, "Autotiles/128x64 Grass A to Sand A.png", 0, 0, 128, 64, "SBS grass A to sand A transition"),
    TileSpec("transition-grass-water-01", "grass-to-water", "transition", SRC_WATER, "Water/Flat/Grass A - Water Flat 128x64.png", 0, 0, 128, 64, "SBS flat grass-to-water transition"),

    # Roads/path surface support; these remain under custom HMH road-paint overlays.
    TileSpec("road-basic-ground-01", "road", "road", SRC_SMALL, "Small 128x64/Pathways/1 Basic Ground - 128x72.png", 1, 0, 128, 72, "SBS dark gravel/asphalt road surface", True),
    TileSpec("road-yellow-grass-01", "road", "road", SRC_SMALL, "Small 128x64/Pathways/Grass A - Road Yellow 128x72.png", 0, 0, 128, 72, "SBS road-yellow with grass shoulders"),
    TileSpec("road-cyber-dark-01", "road", "road", SRC_SMALL, "Small 128x64/Pathways/2 Cyber Road -128x72.png", 0, 0, 128, 72, "SBS dark road-like surface for HMH asphalt proxy"),
]


def make_manifest(records: list[dict]) -> dict:
    role_map: dict[str, list[str]] = {}
    for r in records:
        role_map.setdefault(r["role"], []).append(r["key"])
    return {
        "id": "hmh-level-one-sbs-ground-v1",
        "source": "Screaming Brain Studios isometric floor/autotile/water packs",
        "license": LICENSE,
        "sourceUrls": SOURCE_URLS,
        "sourcePolicy": "Direct runtime use allowed: SBS tile collection verified CC0/Public Domain; credit optional.",
        "tileWidth": 128,
        "tileHeights": sorted(set(r["height"] for r in records)),
        "assetCount": len(records),
        "roles": role_map,
        "assets": records,
    }


def write_mjs(manifest: dict) -> None:
    mjs = OUT_DIR / "sbs-level-one-ground-manifest.mjs"
    json_text = json.dumps(manifest, indent=2)
    mjs.write_text(
        "// Generated by scripts/ingest-hmh-sbs-isometric-tiles.py\n"
        "// CC0/Public Domain Screaming Brain Studios Level 1 ground tiles.\n"
        f"export const HMH_LEVEL_ONE_SBS_GROUND = Object.freeze({json_text});\n\n"
        "export function sbsGroundAssetByKey(key) {\n"
        "  return HMH_LEVEL_ONE_SBS_GROUND.assets.find((asset) => asset.key === key) ?? null;\n"
        "}\n\n"
        "export function sbsGroundAssetsForRole(role) {\n"
        "  const keys = HMH_LEVEL_ONE_SBS_GROUND.roles?.[role] ?? [];\n"
        "  return keys.map((key) => sbsGroundAssetByKey(key)).filter(Boolean);\n"
        "}\n",
        encoding="utf-8",
    )


def make_contact_sheet(records: list[dict]) -> None:
    DOC_ASSET_DIR.mkdir(parents=True, exist_ok=True)
    thumbs = []
    for r in records:
        im = Image.open(ROOT / "apps/portal" / r["src"].lstrip("./")).convert("RGBA")
        bg = Image.new("RGBA", im.size, (32, 34, 40, 255))
        bg.alpha_composite(im)
        thumb = bg.convert("RGB")
        thumb.thumbnail((170, 112), Image.Resampling.NEAREST)
        thumbs.append((r, thumb))
    cellw, cellh = 220, 158
    cols = 4
    rows = (len(thumbs) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cellw, rows * cellh + 46), (24, 26, 32))
    d = ImageDraw.Draw(sheet)
    d.text((12, 12), "HMH Level 1 SBS CC0 ground tiles", fill=(245, 245, 245))
    for idx, (r, im) in enumerate(thumbs):
        x = (idx % cols) * cellw
        y = (idx // cols) * cellh + 46
        d.rectangle([x + 5, y + 5, x + cellw - 5, y + cellh - 5], outline=(76, 84, 98), fill=(38, 41, 50))
        px = x + (cellw - im.width) // 2
        py = y + 12
        sheet.paste(im, (px, py))
        d.text((x + 10, y + 116), r["key"][:30], fill=(182, 222, 255))
        d.text((x + 10, y + 134), f"{r['role']} · {r['width']}x{r['height']}", fill=(205, 205, 205))
    sheet.save(DOC_ASSET_DIR / "hmh-level-1-sbs-ground-contact-sheet.png", quality=95)


def write_doc(manifest: dict) -> None:
    roles = "\n".join(f"- `{role}`: {len(keys)} tile(s)" for role, keys in manifest["roles"].items())
    DOC_PATH.write_text(f"""# HMH Level 1 SBS CC0 ground ingestion

_Last updated: 2026-06-25_

This pass ingests the strongest direct-use downloaded terrain candidates: Screaming Brain Studios 2:1 isometric floor, autotile, water, and overworld tiles.

## Source and license

- Source: Screaming Brain Studios isometric tile packs from Justin's `Downloads` folder.
- License: **{manifest['license']}**.
- Verification sources:
  - {SOURCE_URLS[0]}
  - {SOURCE_URLS[1]}

The runtime assets emitted by this script are cleaned/sliced derivatives of the CC0 SBS sheets. Attribution is optional but the manifest preserves source metadata.

## Outputs

```text
apps/portal/assets/generated/hmh-level-one-ground/sbs-cc0/
apps/portal/assets/generated/hmh-level-one-ground/sbs-cc0/sbs-level-one-ground-manifest.json
apps/portal/assets/generated/hmh-level-one-ground/sbs-cc0/sbs-level-one-ground-manifest.mjs
docs/game-design/assets/hmh-level-1-sbs-ground-contact-sheet.png
```

## Role coverage

{roles}

Total cleaned tiles: **{manifest['assetCount']}**.

## Runtime use

The ground renderer prefers these cleaned SBS tiles for the Level 1 base terrain layer:

- grass / forest floor
- dirt / road shoulders
- sand / desert
- rocky ground
- water
- height-mapped shore tiles
- grass-to-dirt and dirt-to-sand seams

Authored HMH props/templates still render above this base layer, so the level keeps its Lester's Arcade identity while using production-safe isometric ground geometry.
""", encoding="utf-8")


def main() -> None:
    for p in [SRC_SMALL, SRC_AUTOTILES, SRC_WATER, SRC_OVERWORLD]:
        if not p.exists():
            raise SystemExit(f"missing source archive: {p}")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    records = []
    for spec in SPECS:
        tile = crop_tile(spec)
        out_name = safe_png_name(spec.key)
        out_path = OUT_DIR / out_name
        tile.save(out_path, optimize=True)
        rel = "./" + str(out_path.relative_to(ROOT / "apps/portal")).replace("\\", "/")
        records.append({
            "key": f"sbs-cc0/{spec.key}",
            "role": spec.role,
            "category": spec.category,
            "src": rel,
            "width": tile.width,
            "height": tile.height,
            "preferred": spec.preferred,
            "animated": spec.animated,
            "sourceArchive": spec.archive.name,
            "sourceMember": spec.member,
            "sourceCell": {"col": spec.col, "row": spec.row, "width": spec.cell_w, "height": spec.cell_h},
            "description": spec.description,
        })
    manifest = make_manifest(records)
    (OUT_DIR / "sbs-level-one-ground-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    write_mjs(manifest)
    make_contact_sheet(records)
    write_doc(manifest)
    print(json.dumps({"assetCount": len(records), "outDir": str(OUT_DIR), "roles": manifest["roles"]}, indent=2))


if __name__ == "__main__":
    main()

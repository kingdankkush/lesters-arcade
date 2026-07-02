#!/usr/bin/env python
"""Build the Hard Money Heroes curated Level 1 kit manifest and derived assets.

The curated kit is Justin-approved source art. The full raw source drop lives in
the asset vault; the repo keeps only the manifest-referenced source subset under
apps/portal/assets/generated/hmh-curated-level-kit/source. This script does not
pull from the old noisy 17k editor index. It inventories that canonical subset,
slices high-priority terrain/water sheets into runtime 128x64 isometric cells,
auto-trims oversized transparent props, and emits JSON/MJS manifests plus contact
sheets for visual review.
"""

from __future__ import annotations

import json
import math
import re
import shutil
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PORTAL = ROOT / "apps/portal"
OUT = PORTAL / "assets/generated/hmh-curated-level-kit"
KIT = OUT / "source"
SLICED = OUT / "sliced-ground"
TRIMMED = OUT / "trimmed-props"
CONTACTS = OUT / "contact-sheets"
TILE_W = 128
TILE_H = 64
SOURCE_ROOT_REF = "./assets/generated/hmh-curated-level-kit/source"

SLICE_SHEETS = {
    "Universal/Ground-textures/dirt_tiles.png": "dirt",
    "Universal/Ground-textures/dirt_tiles_w_trans.png": "dirt",
    "Universal/Ground-textures/grass_tiles.png": "grass",
    "Universal/Ground-textures/grass_tiles_w_trans.png": "grass",
    "Universal/Ground-textures/sand_tiles.png": "sand",
    "Universal/Ground-textures/sand_tiles_w_trans.png": "sand",
    "Universal/Ground-textures/water_v01.png": "water",
    "Universal/Ground-textures/water_v02.png": "water",
    "Universal/Ground-textures/ground_grasses.png": "grass-detail",
    "Universal/Ground-textures/sand_cliff_trans.png": "sand-cliff",
    "Universal/Ground-textures/dirt_cliff_trans.png": "dirt-cliff",
    "Universal/Ground-textures/grass_cliff_trans.png": "grass-cliff",
    "Universal/Ground-textures/rock_cliffs.png": "rock-cliff",
}

TRIM_DIRS = [
    "Universal/Trees",
    "Universal/Bushes",
    "Universal/Rocks",
    "level-1-crypto-wasteland/Trees-Plants",
    "level-1-crypto-wasteland/Random-Assets",
    "level-1-crypto-wasteland/Buildings",
]

GRAMMAR = {
    "groundRoles": ["grass", "dirt", "sand", "rocky", "road", "water", "shore", "cliff", "interior-floor"],
    "propRoles": ["landmark-building", "tree", "plant", "rock", "ruin", "camp", "sign", "loot-prop", "hazard-prop"],
    "placementZones": [
        "safe-spawn",
        "main-route",
        "secondary-loop",
        "hard-boundary",
        "soft-dressing",
        "poi-landmark",
        "open-arena",
        "mini-boss-arena",
        "boss-arena",
        "extraction-zone",
        "negative-space",
    ],
    "levelOneIdentity": ["ghost-town", "crypto-wasteland", "forest-edge", "shoreline", "desert-road", "ruined-camp"],
}


def slug(text: str) -> str:
    text = Path(text).stem if "." in Path(text).name else text
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    return text or "asset"


def rel_to_portal(path: Path) -> str:
    return "./" + path.relative_to(PORTAL).as_posix()


def alpha_bbox(image: Image.Image):
    rgba = image.convert("RGBA")
    return rgba.getchannel("A").getbbox()


def non_empty_tile(tile: Image.Image) -> bool:
    rgba = tile.convert("RGBA")
    alpha = rgba.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        return False
    histogram = alpha.histogram()
    opaque = sum(histogram[17:])
    return opaque >= 32


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, optimize=True)


def classify_raw(relative: str) -> tuple[str, str, str]:
    lower = relative.lower()
    name = Path(relative).stem
    if lower.startswith("universal/enemies/"):
        return "enemy", "enemies", "Universal enemy animation source"
    if lower.startswith("universal/heroes-playable-characters/"):
        return "hero", "heroes", "Universal playable-character animation source"
    if lower.startswith("universal/ground-textures/") or lower.startswith("universal/building-interiors-builder-set/"):
        return "source-sheet", "source-sheets", "curated sheet requiring slicing"
    if "/water-assets/" in lower or "/water-seabed/" in lower or "water" in lower or "coral" in lower or "anchor" in lower:
        return "water", "water", "Level 1 water/shoreline dressing"
    if "/ground-tiles/" in lower:
        if "road" in lower:
            return "road", "ground", "Level 1 authored road tile/source"
        return "ground", "ground", "Level 1 authored ground tile/source"
    if "/buildings/" in lower:
        if "interior" in lower or "/interiors/" in lower:
            return "interior-prop", "buildings", "Level 1 interior prop"
        return "landmark-building", "buildings", "Level 1 landmark/building"
    if "tree" in lower or "plant" in lower or "mushroom" in lower or "bush" in lower or "palm" in lower:
        return ("tree" if "tree" in lower or "palm" in lower else "plant"), "flora", "Level 1 flora dressing"
    if "rock" in lower or "boulder" in lower or "crystal" in lower or "ruin" in lower:
        return ("ruin" if "ruin" in lower else "rock"), "boundaries", "Level 1 blocker/dressing prop"
    if "bone" in lower or "skull" in lower or "shell" in lower or "wagon" in lower or "tent" in lower or "barrel" in lower or "sign" in lower:
        return "hazard-prop" if "bone" in lower or "skull" in lower else "set-dressing", "props", "Level 1 set dressing"
    return "set-dressing", "props", "curated Level 1 prop"


def infer_scope(relative: str) -> str:
    parts = relative.split("/")
    return parts[0] if parts else "unknown"


def representative_key(relative: str, category: str) -> str:
    parts = relative.split("/")
    if relative.startswith("Universal/Enemies/") and len(parts) >= 3:
        return f"universal/enemy/{parts[2]}"
    if relative.startswith("Universal/Heroes-Playable-Characters/") and len(parts) >= 3:
        return f"universal/hero/{parts[2]}"
    if relative.startswith("Universal/Ground-textures/"):
        return f"universal/sheet/Ground-textures/{slug(parts[-1])}"
    if relative.startswith("Universal/Building-interiors-builder-set/"):
        return f"universal/sheet/Building-interiors-builder-set/{slug('/'.join(parts[2:]))}"
    if relative.startswith("level-1-crypto-wasteland/Buildings/"):
        return f"level-1/building/{slug(parts[-1])}"
    if relative.startswith("level-1-crypto-wasteland/Ground-tiles/"):
        return f"level-1/road/{slug(parts[-1])}" if "road" in relative.lower() else f"level-1/ground/{slug(parts[-1])}"
    if relative.startswith("level-1-crypto-wasteland/Water-assets/"):
        return f"level-1/water/{slug(parts[-1])}"
    if relative.startswith("level-1-crypto-wasteland/Water-seabed/"):
        return f"level-1/water-seabed/{slug(parts[-1])}"
    if relative.startswith("level-1-crypto-wasteland/Trees-Plants/"):
        return f"level-1/flora/{slug(parts[-1])}"
    if relative.startswith("level-1-crypto-wasteland/Random-Assets/"):
        return f"level-1/prop/{slug(parts[-1])}"
    return f"raw/{slug(relative)}"


def raw_assets() -> tuple[list[dict], dict]:
    assets = []
    seen = set()
    summary = {
        "rawImages": 0,
        "scopes": defaultdict(lambda: {"rawImages": 0, "categories": Counter()}),
        "topDimensions": Counter(),
        "sheetCandidates": [],
    }
    for path in sorted(KIT.rglob("*.png"), key=lambda p: p.relative_to(KIT).as_posix().lower()):
        rel = path.relative_to(KIT).as_posix()
        scope = infer_scope(rel)
        with Image.open(path) as im:
            width, height = im.width, im.height
        category, family, role = classify_raw(rel)
        key = representative_key(rel, category)
        # Collapse huge actor frame folders into one representative manifest entry.
        if key in seen:
            summary["rawImages"] += 1
            summary["scopes"][scope]["rawImages"] += 1
            summary["scopes"][scope]["categories"][category] += 1
            summary["topDimensions"][(width, height)] += 1
            continue
        seen.add(key)
        record = {
            "key": key,
            "label": Path(rel).stem.replace("_", " ").replace("-", " ").title(),
            "category": category,
            "family": family,
            "scope": scope,
            "role": role,
            "source": rel,
            "src": rel_to_portal(path),
            "width": width,
            "height": height,
            "needsSlicing": rel in SLICE_SHEETS or width >= 384 or height >= 384,
        }
        assets.append(record)
        summary["rawImages"] += 1
        summary["scopes"][scope]["rawImages"] += 1
        summary["scopes"][scope]["categories"][category] += 1
        summary["topDimensions"][(width, height)] += 1
        if record["needsSlicing"]:
            summary["sheetCandidates"].append({"source": rel, "width": width, "height": height, "category": category})
    # Include empty level folders explicitly.
    for scope in ["Universal", "level-1-crypto-wasteland", "level-2-litecoin-city", "level-3-getaway"]:
        summary["scopes"][scope]
    return assets, summary


def slice_ground_sheets() -> list[dict]:
    if SLICED.exists():
        shutil.rmtree(SLICED)
    out_assets: list[dict] = []
    for rel, role in SLICE_SHEETS.items():
        source = KIT / rel
        if not source.exists():
            continue
        with Image.open(source) as src_image:
            image = src_image.convert("RGBA")
        cols = image.width // TILE_W
        rows = image.height // TILE_H
        if cols < 1 or rows < 1:
            continue
        for row in range(rows):
            for col in range(cols):
                box = (col * TILE_W, row * TILE_H, col * TILE_W + TILE_W, row * TILE_H + TILE_H)
                tile = image.crop(box)
                if not non_empty_tile(tile):
                    continue
                sheet_slug = slug(Path(rel).stem)
                key = f"curated-ground/{sheet_slug}/{row:02d}-{col:02d}"
                dest = SLICED / sheet_slug / f"{row:02d}-{col:02d}.png"
                save_png(tile, dest)
                out_assets.append({
                    "key": key,
                    "role": role,
                    "category": "water" if role == "water" else ("road" if "road" in role else "terrain"),
                    "scope": "Universal",
                    "source": rel,
                    "src": rel_to_portal(dest),
                    "width": TILE_W,
                    "height": TILE_H,
                    "grid": {"row": row, "col": col, "frameWidth": TILE_W, "frameHeight": TILE_H},
                    "runtimeReady": True,
                })
    return out_assets


def trim_props() -> list[dict]:
    if TRIMMED.exists():
        shutil.rmtree(TRIMMED)
    out_assets: list[dict] = []
    for dirname in TRIM_DIRS:
        base = KIT / dirname
        if not base.exists():
            continue
        for path in sorted(base.rglob("*.png"), key=lambda p: p.relative_to(KIT).as_posix().lower()):
            rel = path.relative_to(KIT).as_posix()
            category, family, role = classify_raw(rel)
            with Image.open(path) as raw:
                image = raw.convert("RGBA")
            bbox = alpha_bbox(image)
            if not bbox:
                continue
            pad = 4
            crop_box = (
                max(0, bbox[0] - pad),
                max(0, bbox[1] - pad),
                min(image.width, bbox[2] + pad),
                min(image.height, bbox[3] + pad),
            )
            cropped = image.crop(crop_box)
            # Do not emit tiny duplicate noise; keep useful gameplay props.
            if cropped.width < 8 or cropped.height < 8:
                continue
            dest = TRIMMED / Path(dirname).as_posix().replace("/", "-") / f"{slug(path.stem)}.png"
            # Avoid collisions from similarly named nested files.
            if dest.exists():
                stem = slug(path.relative_to(base).as_posix())
                dest = dest.with_name(stem + ".png")
            save_png(cropped, dest)
            out_assets.append({
                "key": f"curated-prop/{slug(rel)}",
                "category": category,
                "family": family,
                "scope": infer_scope(rel),
                "role": role,
                "source": rel,
                "src": rel_to_portal(dest),
                "width": cropped.width,
                "height": cropped.height,
                "originalWidth": image.width,
                "originalHeight": image.height,
                "trimBox": list(crop_box),
                "runtimeReady": True,
            })
    return out_assets


def contact_sheet(title: str, records: list[dict], dest: Path, max_items=80, cols=8) -> None:
    if not records:
        return
    try:
        font = ImageFont.truetype("arial.ttf", 11)
    except Exception:
        font = ImageFont.load_default()
    thumb_w, thumb_h = 148, 156
    records = records[:max_items]
    rows = math.ceil(len(records) / cols)
    sheet = Image.new("RGB", (cols * thumb_w, 34 + rows * thumb_h), (14, 16, 20))
    draw = ImageDraw.Draw(sheet)
    draw.text((10, 10), f"{title} — {len(records)} shown", fill=(245, 245, 245), font=font)
    for idx, record in enumerate(records):
        x = (idx % cols) * thumb_w
        y = 34 + (idx // cols) * thumb_h
        src = PORTAL / record["src"].replace("./", "")
        try:
            image = Image.open(src).convert("RGBA")
        except Exception:
            continue
        checker = Image.new("RGBA", (thumb_w, thumb_h - 34), (25, 27, 32, 255))
        cd = ImageDraw.Draw(checker)
        for cy in range(0, checker.height, 10):
            for cx in range(0, checker.width, 10):
                if (cx // 10 + cy // 10) % 2 == 0:
                    cd.rectangle((cx, cy, cx + 9, cy + 9), fill=(35, 38, 45, 255))
        image.thumbnail((thumb_w - 8, thumb_h - 46), Image.LANCZOS)
        checker.alpha_composite(image, ((thumb_w - image.width) // 2, 4))
        sheet.paste(checker.convert("RGB"), (x, y))
        label = record.get("key", record.get("source", "asset"))[-34:]
        draw.text((x + 4, y + thumb_h - 31), label, fill=(220, 220, 220), font=font)
        draw.text((x + 4, y + thumb_h - 16), f"{record.get('width')}x{record.get('height')}", fill=(165, 185, 255), font=font)
    dest.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(dest, quality=90)


def write_outputs(raw: list[dict], summary_data: dict, sliced: list[dict], trimmed: list[dict]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    scopes = {}
    for scope, data in summary_data["scopes"].items():
        scopes[scope] = {
            "rawImages": data["rawImages"],
            "categories": dict(data["categories"].most_common()),
        }
    summary = {
        "id": "hmh-curated-level-kit-audit-v1",
        "sourceRoot": SOURCE_ROOT_REF,
        "rawImages": summary_data["rawImages"],
        "manifestAssets": len(raw),
        "slicedGround": len(sliced),
        "trimmedProps": len(trimmed),
        "scopes": scopes,
        "topDimensions": [
            {"width": w, "height": h, "count": count}
            for (w, h), count in summary_data["topDimensions"].most_common(20)
        ],
        "sheetCandidates": summary_data["sheetCandidates"][:120],
        "levelDesignReadiness": {
            "level-1-crypto-wasteland": "ready-for-authored-layout-after-slicing",
            "level-2-litecoin-city": "empty-folder-deferred",
            "level-3-getaway": "empty-folder-deferred",
        },
    }
    manifest = {
        "id": "hmh-curated-level-kit-v1",
        "sourceRoot": SOURCE_ROOT_REF,
        "generatedRoot": "./assets/generated/hmh-curated-level-kit",
        "sourcePolicy": "Justin-curated approved assets only; old editor/runtime sprite library is intentionally ignored.",
        "tileSize": {"width": TILE_W, "height": TILE_H, "projection": "isometric-2to1"},
        "grammar": GRAMMAR,
        "summary": summary,
        "assets": raw,
        "slicedGround": {"assets": sliced},
        "trimmedProps": {"assets": trimmed},
    }
    (OUT / "audit-summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    (OUT / "hmh-curated-level-kit-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    mjs = "// Generated by scripts/build-hmh-curated-level-kit.py.\n"
    mjs += "// Curated approved assets for HMH Level 1 worldbuilding.\n\n"
    mjs += "export const HMH_CURATED_LEVEL_KIT = Object.freeze(" + json.dumps(manifest, indent=2) + ");\n\n"
    mjs += "export function curatedLevelKitAssetByKey(key) {\n"
    mjs += "  return HMH_CURATED_LEVEL_KIT.assets.find((asset) => asset.key === key)\n"
    mjs += "    ?? HMH_CURATED_LEVEL_KIT.slicedGround.assets.find((asset) => asset.key === key)\n"
    mjs += "    ?? HMH_CURATED_LEVEL_KIT.trimmedProps.assets.find((asset) => asset.key === key)\n"
    mjs += "    ?? null;\n}\n"
    (OUT / "hmh-curated-level-kit-manifest.mjs").write_text(mjs, encoding="utf-8")

    contact_sheet("Curated Level 1 raw assets", [a for a in raw if a["scope"] == "level-1-crypto-wasteland"], CONTACTS / "level-1-raw-assets.jpg", 96, 8)
    contact_sheet("Curated sliced ground", sliced, CONTACTS / "sliced-ground.jpg", 120, 8)
    contact_sheet("Curated trimmed props", trimmed, CONTACTS / "trimmed-props.jpg", 120, 8)


def main() -> int:
    if not KIT.exists():
        raise SystemExit(f"Missing curated kit root: {KIT}")
    OUT.mkdir(parents=True, exist_ok=True)
    raw, summary = raw_assets()
    sliced = slice_ground_sheets()
    trimmed = trim_props()
    write_outputs(raw, summary, sliced, trimmed)
    print(json.dumps({
        "rawImages": summary["rawImages"],
        "manifestAssets": len(raw),
        "slicedGround": len(sliced),
        "trimmedProps": len(trimmed),
        "out": OUT.as_posix(),
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python
"""Inventory user-provided Hard Money Heroes Level 1 environment assets.

The source drop uses timestamped filenames, so this script creates repeatable
metadata plus visual contact sheets before the deterministic ingest step assigns
semantic runtime roles.
"""
from __future__ import annotations

import json
import math
import os
import re
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageStat

REPO_ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR_ENV = "HMH_ENVIRONMENT_SOURCE_DIR"
SOURCE_DIR = Path(os.environ[SOURCE_DIR_ENV]) if os.environ.get(SOURCE_DIR_ENV) else None
SOURCE_DIR_LABEL = "user-provided Hard Money Heroes Level 1 environment art assets (source path redacted)"
DOC_DIR = REPO_ROOT / "docs" / "game-design"
CONTACT_DIR = DOC_DIR / "hmh-environment-contact-sheets"
INVENTORY_JSON = DOC_DIR / "hard-money-heroes-environment-asset-inventory.json"
INVENTORY_MD = DOC_DIR / "hard-money-heroes-environment-asset-inventory.md"
THUMB_SIZE = 160
CELL_W = 220
CELL_H = 214
COLUMNS = 4
ROWS = 5
PER_SHEET = COLUMNS * ROWS


@dataclass(frozen=True)
class AssetMetrics:
    id: str
    index: int
    filename: str
    sourcePath: str
    width: int
    height: int
    mode: str
    hasAlphaChannel: bool
    transparentPixels: int
    opaquePixels: int
    alphaCoverage: float
    alphaBBox: list[int] | None
    averageRgb: list[int]
    heuristicRole: str
    runtimeRole: str
    suggestedStage: str


def sort_key(path: Path) -> tuple[str, int, str]:
    match = re.search(r"(\d{2})_(\d{2})_(\d{2})\s+PM", path.stem)
    if match:
        hour, minute, second = (int(part) for part in match.groups())
        return ("timestamp", hour * 3600 + minute * 60 + second, path.name.lower())
    return ("name", 0, path.name.lower())


def slug_for(index: int, path: Path) -> str:
    return f"env-{index:03d}-{path.stem.lower().replace('chatgpt image jun 6, 2026, ', '').replace(' ', '-').replace(',', '').replace('_', '-') }"


def heuristic_role(width: int, height: int, alpha_coverage: float, bbox: tuple[int, int, int, int] | None) -> str:
    aspect = width / max(1, height)
    if alpha_coverage > 0.985 and width >= 900 and height >= 600:
        return "full-background-or-large-tileset"
    if alpha_coverage > 0.94 and 0.65 <= aspect <= 1.55:
        return "large-scene-or-tile-sheet"
    if bbox:
        bw = bbox[2] - bbox[0]
        bh = bbox[3] - bbox[1]
        bbox_aspect = bw / max(1, bh)
        if bh >= height * 0.68 and bw >= width * 0.45:
            return "building-or-large-structure"
        if bh >= height * 0.45 and bbox_aspect < 0.95:
            return "tree-cactus-signpost-or-vertical-prop"
        if bbox_aspect > 2.2 and bh < height * 0.55:
            return "road-ground-strip-or-horizontal-prop"
        if alpha_coverage < 0.55:
            return "isolated-prop-or-object"
    return "environment-prop-or-tileset"


def runtime_role(width: int, height: int, alpha_coverage: float, heuristic: str) -> str:
    """Classify how the runtime should treat the asset.

    Most of this drop is opaque full-scene pixel art. Rather than pretending
    every file is an isolated prop, classify by aspect ratio and transparency so
    the ingest step can pick stable parallax layers, focal backgrounds, ground
    strips, and structure props.
    """
    aspect = width / max(1, height)
    if alpha_coverage < 0.85 and "building" in heuristic:
        return "structure-prop"
    if alpha_coverage < 0.85:
        return "isolated-prop"
    if aspect >= 3.2:
        return "wide-parallax-or-road-strip"
    if aspect >= 2.15:
        return "wide-background"
    if aspect <= 0.82:
        return "vertical-background-or-large-prop-reference"
    if aspect <= 1.35:
        return "square-tileset-or-building-reference"
    return "scenic-background"


def suggested_stage(filename: str, index: int, role: str) -> str:
    name = filename.lower()
    if any(term in name for term in ["desert", "rock", "mountain", "cactus"]):
        return "desert_approach"
    if any(term in name for term in ["town", "saloon", "sheriff", "bank", "ghost"]):
        return "ghost_town"
    if any(term in name for term in ["road", "country", "tree", "farm"]):
        return "country_road"
    if any(term in name for term in ["house", "residential", "yard"]):
        return "residential_edge"
    if any(term in name for term in ["city", "street", "building", "downtown"]):
        return "inner_city"
    # Timestamp order came from the user prompt: early desert/ghost-town concepts,
    # later variants drift toward roads, buildings, and denser city/residential props.
    if index <= 42:
        return "desert_approach"
    if index <= 78:
        return "ghost_town"
    if index <= 104:
        return "country_road"
    if index <= 126:
        return "residential_edge"
    return "inner_city"


def inspect_asset(index: int, path: Path) -> AssetMetrics:
    with Image.open(path) as image:
        rgba = image.convert("RGBA")
        width, height = rgba.size
        alpha = rgba.getchannel("A")
        alpha_values = list(alpha.getdata())
        opaque_pixels = sum(1 for value in alpha_values if value > 8)
        transparent_pixels = width * height - opaque_pixels
        alpha_coverage = opaque_pixels / max(1, width * height)
        bbox = alpha.getbbox()
        rgb_stat = ImageStat.Stat(rgba.convert("RGB"))
        avg_rgb = [round(value) for value in rgb_stat.mean]
        role = heuristic_role(width, height, alpha_coverage, bbox)
        run_role = runtime_role(width, height, alpha_coverage, role)
        return AssetMetrics(
            id=slug_for(index, path),
            index=index,
            filename=path.name,
            sourcePath=f"source path redacted/{path.name}",
            width=width,
            height=height,
            mode=image.mode,
            hasAlphaChannel="A" in image.getbands(),
            transparentPixels=transparent_pixels,
            opaquePixels=opaque_pixels,
            alphaCoverage=round(alpha_coverage, 4),
            alphaBBox=list(bbox) if bbox else None,
            averageRgb=avg_rgb,
            heuristicRole=role,
            runtimeRole=run_role,
            suggestedStage=suggested_stage(path.name, index, role),
        )


def font(size: int) -> ImageFont.ImageFont:
    candidates = [
        "C:/Windows/Fonts/consola.ttf",
        "C:/Windows/Fonts/arial.ttf",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


def draw_contact_sheet(paths: list[Path], metrics: list[AssetMetrics]) -> list[str]:
    CONTACT_DIR.mkdir(parents=True, exist_ok=True)
    title_font = font(16)
    small_font = font(11)
    sheet_paths: list[str] = []
    for sheet_index in range(math.ceil(len(paths) / PER_SHEET)):
        start = sheet_index * PER_SHEET
        end = min(len(paths), start + PER_SHEET)
        sheet = Image.new("RGB", (COLUMNS * CELL_W, ROWS * CELL_H), (18, 15, 23))
        draw = ImageDraw.Draw(sheet)
        for slot, (path, meta) in enumerate(zip(paths[start:end], metrics[start:end], strict=True)):
            x = (slot % COLUMNS) * CELL_W
            y = (slot // COLUMNS) * CELL_H
            draw.rectangle([x + 6, y + 6, x + CELL_W - 6, y + CELL_H - 6], outline=(72, 62, 91), width=2)
            checker = Image.new("RGB", (THUMB_SIZE, THUMB_SIZE), (34, 31, 42))
            checker_draw = ImageDraw.Draw(checker)
            for cy in range(0, THUMB_SIZE, 16):
                for cx in range(0, THUMB_SIZE, 16):
                    if (cx // 16 + cy // 16) % 2:
                        checker_draw.rectangle([cx, cy, cx + 15, cy + 15], fill=(47, 43, 57))
            with Image.open(path) as image:
                thumb = image.convert("RGBA")
                thumb.thumbnail((THUMB_SIZE, THUMB_SIZE), Image.Resampling.LANCZOS)
                px = (THUMB_SIZE - thumb.width) // 2
                py = (THUMB_SIZE - thumb.height) // 2
                checker.paste(thumb, (px, py), thumb)
            sheet.paste(checker, (x + 12, y + 12))
            draw.text((x + 178, y + 14), f"#{meta.index:03d}", fill=(255, 232, 77), font=title_font)
            draw.text((x + 178, y + 38), f"{meta.width}x{meta.height}", fill=(209, 216, 235), font=small_font)
            draw.text((x + 178, y + 56), f"α {meta.alphaCoverage:.2f}", fill=(69, 255, 138), font=small_font)
            label = meta.heuristicRole.replace("-", " ")[:30]
            draw.text((x + 12, y + 176), label, fill=(190, 197, 220), font=small_font)
            time_label = meta.filename.replace("ChatGPT Image Jun 6, 2026, ", "")[:31]
            draw.text((x + 12, y + 192), time_label, fill=(138, 147, 177), font=small_font)
        out = CONTACT_DIR / f"sheet-{sheet_index + 1:02d}.png"
        sheet.save(out, "PNG", optimize=True)
        sheet_paths.append(str(out))
    return sheet_paths


def write_markdown(metrics: list[AssetMetrics], sheet_paths: list[str]) -> None:
    stage_counts: dict[str, int] = {}
    role_counts: dict[str, int] = {}
    runtime_counts: dict[str, int] = {}
    for meta in metrics:
        stage_counts[meta.suggestedStage] = stage_counts.get(meta.suggestedStage, 0) + 1
        role_counts[meta.heuristicRole] = role_counts.get(meta.heuristicRole, 0) + 1
        runtime_counts[meta.runtimeRole] = runtime_counts.get(meta.runtimeRole, 0) + 1
    lines = [
        "# Hard Money Heroes Level Environment Asset Inventory",
        "",
        f"Source: `{SOURCE_DIR_LABEL}`",
        f"Assets inventoried: **{len(metrics)}** PNGs",
        "",
        "## Contact sheets",
        "",
    ]
    for path in sheet_paths:
        rel = Path(path).relative_to(REPO_ROOT).as_posix()
        lines.append(f"- `{rel}`")
    lines.extend(["", "## Heuristic stage counts", ""])
    for stage, count in sorted(stage_counts.items()):
        lines.append(f"- `{stage}`: {count}")
    lines.extend(["", "## Heuristic role counts", ""])
    for role, count in sorted(role_counts.items()):
        lines.append(f"- `{role}`: {count}")
    lines.extend(["", "## Runtime role counts", ""])
    for role, count in sorted(runtime_counts.items()):
        lines.append(f"- `{role}`: {count}")
    lines.extend(["", "## Assets", "", "| # | Filename | Size | Alpha coverage | Heuristic role | Runtime role | Suggested stage |", "|---:|---|---:|---:|---|---|---|"])
    for meta in metrics:
        lines.append(
            f"| {meta.index:03d} | `{meta.filename}` | {meta.width}×{meta.height} | {meta.alphaCoverage:.4f} | {meta.heuristicRole} | {meta.runtimeRole} | {meta.suggestedStage} |"
        )
    INVENTORY_MD.parent.mkdir(parents=True, exist_ok=True)
    INVENTORY_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    if SOURCE_DIR is None:
        raise FileNotFoundError(f"Set {SOURCE_DIR_ENV} to the Hard Money Heroes Level 1 environment source folder before running this inventory script.")
    if not SOURCE_DIR.exists():
        raise FileNotFoundError(f"Environment source folder not found: {SOURCE_DIR}")
    paths = sorted(SOURCE_DIR.glob("*.png"), key=sort_key)
    if not paths:
        raise FileNotFoundError(f"No PNG assets found under {SOURCE_DIR}")
    metrics = [inspect_asset(index, path) for index, path in enumerate(paths, start=1)]
    sheet_paths = draw_contact_sheet(paths, metrics)
    payload = {
        "id": "hard-money-heroes-environment-inventory-v1",
        "sourceDir": SOURCE_DIR_LABEL,
        "assetCount": len(metrics),
        "contactSheets": [str(Path(path).relative_to(REPO_ROOT).as_posix()) for path in sheet_paths],
        "assets": [meta.__dict__ for meta in metrics],
    }
    INVENTORY_JSON.parent.mkdir(parents=True, exist_ok=True)
    INVENTORY_JSON.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    write_markdown(metrics, sheet_paths)
    print(json.dumps({
        "assetCount": len(metrics),
        "inventoryJson": str(INVENTORY_JSON),
        "inventoryMarkdown": str(INVENTORY_MD),
        "contactSheets": sheet_paths,
    }, indent=2))


if __name__ == "__main__":
    main()

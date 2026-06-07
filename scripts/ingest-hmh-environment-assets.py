#!/usr/bin/env python
"""Ingest Justin-provided Hard Money Heroes Level 1 environment assets.

This pass keeps the original source files outside the repo and creates deterministic,
web-friendly runtime PNGs plus a manifest that the browser runtime can load without
fetching arbitrary local paths.
"""
from __future__ import annotations

import json
import math
import shutil
from pathlib import Path
from typing import Any

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[1]
INVENTORY_JSON = REPO_ROOT / "docs" / "game-design" / "hard-money-heroes-environment-asset-inventory.json"
OUT_DIR = REPO_ROOT / "apps" / "portal" / "assets" / "hard-money-heroes" / "environment"
RUNTIME_DIR = OUT_DIR / "runtime"
MANIFEST_JSON = OUT_DIR / "hmh-environment-manifest.json"
MANIFEST_MJS = OUT_DIR / "hmh-environment-manifest.mjs"
DOC_MD = REPO_ROOT / "docs" / "game-design" / "hard-money-heroes-environment-runtime-manifest.md"

STAGES: list[dict[str, Any]] = [
    {
        "id": "desert_approach",
        "title": "Stage 1-2 // Desert Rocky Mountain Approach",
        "stageRange": [1, 2],
        "narrativeRole": "open the level outside Litecoin City with hot desert, rocky mountains, cactus silhouettes, dust, and long approach roads",
        "palette": ["#2d160c", "#7b3f1d", "#d88945", "#f6c66f", "#4b6a7c"],
        "ambient": ["heat-shimmer", "dust-motes", "cactus-wind-sway"],
        "propMood": "rocks, cactus shapes, mine-town signs, low ruined cover",
    },
    {
        "id": "ghost_town",
        "title": "Stage 3-5 // Ghost Town Main Street",
        "stageRange": [3, 5],
        "narrativeRole": "push through the abandoned frontier town: saloons, sheriff/bank facades, wooden porches, lamps, and shootout cover",
        "palette": ["#1f1714", "#6c3f25", "#b87945", "#f1b15a", "#17253b"],
        "ambient": ["lantern-flicker", "dust-motes", "loose-sign-sway"],
        "propMood": "saloon boards, banks, lamps, wooden cover, haunted town facades",
    },
    {
        "id": "country_road",
        "title": "Stage 6-8 // Country Road Cutback",
        "stageRange": [6, 8],
        "narrativeRole": "leave town, re-enter countryside roads, trees, fences, scrub, and vehicle lanes before the city edge",
        "palette": ["#172018", "#2f4a2e", "#8b6a3c", "#d6a45e", "#6e8a79"],
        "ambient": ["tree-wind-sway", "grass-bob", "road-dust"],
        "propMood": "trees, road barriers, fences, shrubs, roadside cover",
    },
    {
        "id": "residential_edge",
        "title": "Stage 9-10 // Residential Edge",
        "stageRange": [9, 10],
        "narrativeRole": "suburban edge of Litecoin City: houses, yards, parked-car cover, power poles, and neighborhood lights",
        "palette": ["#111827", "#29465a", "#8f6a3d", "#d2a15f", "#84c7d5"],
        "ambient": ["window-light-flicker", "bush-wind-sway", "porch-lamp-glow"],
        "propMood": "houses, porches, shrubs, street lamps, residential cover",
    },
    {
        "id": "inner_city",
        "title": "Stage 11-13 // Inner City Boss Push",
        "stageRange": [11, 13],
        "narrativeRole": "dense inner-city run-up where old frontier dust becomes neon financial panic, billboards, towers, and boss pressure",
        "palette": ["#050913", "#14244a", "#345dcc", "#19f7ff", "#ff7b2f"],
        "ambient": ["neon-flicker", "sign-spark", "window-light-pulse"],
        "propMood": "downtown buildings, streetlights, signs, parked cars, billboard cover",
    },
]

LAYER_TEMPLATES = [
    {"id": "distant-skyline", "role": "background", "y": 0, "h": 128, "speed": 0.10, "opacity": 0.88, "animation": "slow-drift"},
    {"id": "far-midground", "role": "parallax", "y": 62, "h": 150, "speed": 0.22, "opacity": 0.92, "animation": "heat-or-haze"},
    {"id": "near-buildings", "role": "parallax", "y": 122, "h": 152, "speed": 0.44, "opacity": 0.98, "animation": "ambient-flicker"},
    {"id": "ground-street", "role": "road-ground", "y": 214, "h": 116, "speed": 0.82, "opacity": 1.0, "animation": "ground-scroll"},
]


def portal_src(path: Path) -> str:
    return "./" + path.relative_to(REPO_ROOT / "apps" / "portal").as_posix()


def safe_read_inventory() -> dict[str, Any]:
    if not INVENTORY_JSON.exists():
        raise FileNotFoundError(
            f"Missing {INVENTORY_JSON}. Run scripts/inventory-hmh-environment-assets.py first."
        )
    return json.loads(INVENTORY_JSON.read_text(encoding="utf-8"))


def runtime_size(asset: dict[str, Any]) -> tuple[int, int]:
    width = int(asset["width"])
    height = int(asset["height"])
    aspect = width / max(1, height)
    alpha = float(asset["alphaCoverage"])
    role = asset.get("runtimeRole", "")

    if alpha < 0.85:
        max_edge = 512 if role == "structure-prop" else 384
        scale = min(1.0, max_edge / max(width, height))
    elif aspect >= 3.2:
        scale = min(1.0, 960 / width)
    elif aspect >= 2.15:
        scale = min(1.0, 960 / width)
    elif aspect <= 0.82:
        scale = min(1.0, 560 / height)
    elif aspect <= 1.35:
        scale = min(1.0, 640 / max(width, height))
    else:
        scale = min(1.0, 820 / width)
    return (max(1, round(width * scale)), max(1, round(height * scale)))


def resize_asset(asset: dict[str, Any], output_path: Path) -> tuple[int, int]:
    source = Path(asset["sourcePath"])
    target_size = runtime_size(asset)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        mode = "RGBA" if float(asset["alphaCoverage"]) < 0.995 or "A" in image.getbands() else "RGB"
        resized = image.convert(mode).resize(target_size, Image.Resampling.NEAREST)
        resized.save(output_path, "PNG", optimize=True)
    return target_size


def spread_pick(items: list[dict[str, Any]], count: int) -> list[dict[str, Any]]:
    if len(items) <= count:
        return list(items)
    if count <= 1:
        return [items[0]]
    picked: list[dict[str, Any]] = []
    seen: set[str] = set()
    for slot in range(count):
        index = round(slot * (len(items) - 1) / (count - 1))
        item = items[index]
        if item["id"] not in seen:
            picked.append(item)
            seen.add(item["id"])
    for item in items:
        if len(picked) >= count:
            break
        if item["id"] not in seen:
            picked.append(item)
            seen.add(item["id"])
    return picked


def layer_candidates(stage_assets: list[dict[str, Any]]) -> list[dict[str, Any]]:
    wide = [asset for asset in stage_assets if asset.get("runtimeRole") in {"wide-parallax-or-road-strip", "wide-background"} and float(asset["alphaCoverage"]) > 0.95]
    scenic = [asset for asset in stage_assets if asset.get("runtimeRole") == "scenic-background" and float(asset["alphaCoverage"]) > 0.95]
    square = [asset for asset in stage_assets if asset.get("runtimeRole") == "square-tileset-or-building-reference" and float(asset["alphaCoverage"]) > 0.95]
    return wide + scenic + square + [asset for asset in stage_assets if asset not in wide + scenic + square]


def prop_candidates(stage_assets: list[dict[str, Any]]) -> list[dict[str, Any]]:
    transparent = [asset for asset in stage_assets if float(asset["alphaCoverage"]) < 0.85]
    vertical_or_square = [asset for asset in stage_assets if asset.get("runtimeRole") in {"vertical-background-or-large-prop-reference", "square-tileset-or-building-reference"}]
    scenic = [asset for asset in stage_assets if asset.get("runtimeRole") == "scenic-background"]
    combined: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in transparent + spread_pick(vertical_or_square, 3) + spread_pick(scenic, 2):
        if item["id"] not in seen:
            combined.append(item)
            seen.add(item["id"])
    return combined


def prop_draw_box(asset: dict[str, Any], slot: int) -> dict[str, Any]:
    width = int(asset["runtimeWidth"])
    height = int(asset["runtimeHeight"])
    aspect = width / max(1, height)
    is_structure = asset.get("runtimeRole") == "structure-prop" or float(asset["alphaCoverage"]) < 0.85
    draw_height = 168 if is_structure else 118
    draw_width = max(42, round(draw_height * aspect))
    if draw_width > 240:
        draw_width = 240
        draw_height = max(58, round(draw_width / max(0.01, aspect)))
    return {
        "width": draw_width,
        "height": draw_height,
        "groundOffset": 8 + (slot % 2) * 4,
        "spacing": 260 + slot * 56,
        "slotOffset": 118 + slot * 94,
        "scrollSpeed": round(0.34 + slot * 0.05, 2),
    }


def build_stage(stage_def: dict[str, Any], stage_assets: list[dict[str, Any]]) -> dict[str, Any]:
    selected_layers = spread_pick(layer_candidates(stage_assets), len(LAYER_TEMPLATES))
    layers = []
    for index, asset in enumerate(selected_layers):
        template = LAYER_TEMPLATES[index]
        layers.append({
            **template,
            "id": f"{stage_def['id']}-{template['id']}",
            "assetId": asset["id"],
            "src": asset["runtimeSrc"],
            "sourceIndex": asset["index"],
            "sourceFilename": asset["filename"],
            "naturalSize": [asset["runtimeWidth"], asset["runtimeHeight"]],
        })

    props = []
    for slot, asset in enumerate(spread_pick(prop_candidates(stage_assets), 3)):
        animation = {
            "desert_approach": "heat-shimmer-and-cactus-sway",
            "ghost_town": "lantern-flicker-and-sign-sway",
            "country_road": "tree-and-bush-wind-sway",
            "residential_edge": "window-flicker-and-bush-sway",
            "inner_city": "neon-flicker-and-sign-spark",
        }[stage_def["id"]]
        props.append({
            "id": f"{stage_def['id']}-prop-{slot + 1}",
            "assetId": asset["id"],
            "src": asset["runtimeSrc"],
            "sourceIndex": asset["index"],
            "sourceFilename": asset["filename"],
            "role": "ambient-structure-prop" if float(asset["alphaCoverage"]) < 0.85 else "scenic-prop-card",
            "naturalSize": [asset["runtimeWidth"], asset["runtimeHeight"]],
            "draw": prop_draw_box(asset, slot),
            "animation": animation,
            "collision": "visual-only; gameplay cover props remain deterministic combat objects",
        })

    return {
        **stage_def,
        "assetCount": len(stage_assets),
        "layerCount": len(layers),
        "propCount": len(props),
        "layers": layers,
        "props": props,
        "ground": {
            "y": 276,
            "roadColor": stage_def["palette"][1],
            "stripeColor": "#ffe84d" if stage_def["id"] in {"country_road", "inner_city"} else "#e8a94f",
            "dustColor": stage_def["palette"][2],
        },
        "proportionGuide": {
            "heroDrawSize": [104, 104],
            "enemyDrawSize": [78, 78],
            "buildingPropHeightRange": [118, 168],
            "bossArenaBackdrops": "drawn behind collision props so Warren/boss sprites stay foreground-readable",
        },
    }


def write_manifest_mjs(manifest: dict[str, Any]) -> None:
    MANIFEST_MJS.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_MJS.write_text(
        "export const HMH_ENVIRONMENT_ASSET_MANIFEST = Object.freeze("
        + json.dumps(manifest, indent=2)
        + ");\n\nexport default HMH_ENVIRONMENT_ASSET_MANIFEST;\n",
        encoding="utf-8",
    )


def write_doc(manifest: dict[str, Any]) -> None:
    lines = [
        "# Hard Money Heroes Environment Runtime Manifest",
        "",
        f"Manifest: `{MANIFEST_JSON.relative_to(REPO_ROOT).as_posix()}`",
        f"Browser module: `{MANIFEST_MJS.relative_to(REPO_ROOT).as_posix()}`",
        f"Runtime assets: `{RUNTIME_DIR.relative_to(REPO_ROOT).as_posix()}`",
        "",
        f"Source inventory count: **{manifest['assetCount']}** PNGs",
        f"Runtime output count: **{manifest['runtimeAssetCount']}** PNGs",
        "",
        "## Level 1 progression",
        "",
        "The runtime now stages Justin's new environment art as a ground-outward first level: desert approach → ghost town → country road → residential edge → inner city boss push.",
        "",
    ]
    for stage in manifest["levelOneStages"]:
        lines.extend([
            f"### {stage['title']}",
            "",
            f"- Stage range: `{stage['stageRange'][0]}-{stage['stageRange'][1]}`",
            f"- Assets classified: `{stage['assetCount']}`",
            f"- Runtime layers: `{stage['layerCount']}`",
            f"- Runtime props: `{stage['propCount']}`",
            f"- Ambient hooks: {', '.join(stage['ambient'])}",
            f"- Proportion guide: hero `{stage['proportionGuide']['heroDrawSize'][0]}×{stage['proportionGuide']['heroDrawSize'][1]}`, enemies `{stage['proportionGuide']['enemyDrawSize'][0]}×{stage['proportionGuide']['enemyDrawSize'][1]}`, buildings `{stage['proportionGuide']['buildingPropHeightRange'][0]}-{stage['proportionGuide']['buildingPropHeightRange'][1]}px`",
            "",
            "Layers:",
            "",
        ])
        for layer in stage["layers"]:
            lines.append(f"- `{layer['id']}` ← #{layer['sourceIndex']:03d} `{layer['sourceFilename']}` (`{layer['src']}`)")
        lines.extend(["", "Props:", ""])
        for prop in stage["props"]:
            lines.append(f"- `{prop['id']}` ← #{prop['sourceIndex']:03d} `{prop['sourceFilename']}` ({prop['animation']})")
        lines.append("")
    DOC_MD.parent.mkdir(parents=True, exist_ok=True)
    DOC_MD.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    inventory = safe_read_inventory()
    assets = sorted(inventory["assets"], key=lambda item: item["index"])
    if len(assets) != 148:
        raise ValueError(f"Expected 148 environment assets, got {len(assets)}")

    if RUNTIME_DIR.exists():
        shutil.rmtree(RUNTIME_DIR)
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)

    stage_lookup = {stage["id"]: [] for stage in STAGES}
    runtime_assets = []
    for asset in assets:
        stage_id = asset["suggestedStage"]
        if stage_id not in stage_lookup:
            raise ValueError(f"Unknown stage {stage_id} for asset {asset['filename']}")
        runtime_name = f"{asset['id']}.png"
        output_path = RUNTIME_DIR / stage_id / runtime_name
        runtime_width, runtime_height = resize_asset(asset, output_path)
        enriched = {
            **asset,
            "runtimeWidth": runtime_width,
            "runtimeHeight": runtime_height,
            "runtimeSrc": portal_src(output_path),
            "runtimePath": output_path.relative_to(REPO_ROOT).as_posix(),
            "recommendedRuntimeUse": asset.get("runtimeRole", "environment-asset"),
        }
        stage_lookup[stage_id].append(enriched)
        runtime_assets.append(enriched)

    stages = [build_stage(stage_def, stage_lookup[stage_def["id"]]) for stage_def in STAGES]
    manifest = {
        "id": "hard-money-heroes-level1-environment-assets-v1",
        "generatedFrom": inventory["sourceDir"],
        "inventory": "docs/game-design/hard-money-heroes-environment-asset-inventory.json",
        "contactSheets": inventory["contactSheets"],
        "assetCount": len(assets),
        "runtimeAssetCount": len(runtime_assets),
        "stageOrder": [stage["id"] for stage in STAGES],
        "levelOneStages": stages,
        "assets": runtime_assets,
        "runtimeNotes": {
            "sorting": "timestamp-order source filenames; deterministic stage bands from Justin's desert-to-city level brief",
            "proportions": "player remains 104px tall; enemies 78px; environment prop cards stay 118-168px high and never obscure combat readability",
            "animationHooks": ["heat shimmer", "dust motes", "wind sway", "lantern/window/neon flicker", "sign sparks"],
        },
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    MANIFEST_JSON.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    write_manifest_mjs(manifest)
    write_doc(manifest)
    print(json.dumps({
        "assetCount": manifest["assetCount"],
        "runtimeAssetCount": manifest["runtimeAssetCount"],
        "stages": {stage["id"]: stage["assetCount"] for stage in stages},
        "manifest": MANIFEST_JSON.relative_to(REPO_ROOT).as_posix(),
        "module": MANIFEST_MJS.relative_to(REPO_ROOT).as_posix(),
        "doc": DOC_MD.relative_to(REPO_ROOT).as_posix(),
    }, indent=2))


if __name__ == "__main__":
    main()

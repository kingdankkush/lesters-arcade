#!/usr/bin/env python3
"""Generate WO-97 six-biome Level 1 world asset families.

Original repo-owned deterministic pixel-art production pass based on the approved
WO-96 macro plan. No third-party pixels are copied.
"""
from __future__ import annotations

import json
import math
import re
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont

REPO = Path(__file__).resolve().parents[1]
OUT_ROOT = REPO / "apps" / "portal" / "assets" / "generated" / "hmh-coherent-world" / "level1-wo97-six-biome"
DOC_ASSET_DIR = REPO / "docs" / "game-design" / "assets"
DOC_PATH = REPO / "docs" / "game-design" / "hmh-wo97-world-assets.md"
MANIFEST_JSON = OUT_ROOT / "level1-wo97-six-biome-manifest.json"
MANIFEST_MJS = OUT_ROOT / "level1-wo97-six-biome-manifest.mjs"

SOURCE_POLICY = "Original repo-owned WO-97 six-biome Level 1 pixel-art assets generated from Justin-approved WO-96 macro plan; no third-party pixels copied."
BIOMES = [
    {
        "id": "neon-city-core",
        "label": "Neon City Core",
        "abbr": "N",
        "palette": ["#10192c", "#2a345c", "#1de7ff", "#f048ff", "#ffd166", "#5b6b8b"],
        "accent": "#1de7ff",
        "shadow": "#080c16",
    },
    {
        "id": "industrial-yard",
        "label": "Industrial Yard",
        "abbr": "I",
        "palette": ["#15181d", "#38424b", "#ff8a22", "#ffd35a", "#6b7780", "#20252a"],
        "accent": "#ff8a22",
        "shadow": "#090b0f",
    },
    {
        "id": "old-canal-riverfront",
        "label": "Old Canal & Riverfront",
        "abbr": "C",
        "palette": ["#0d1f2c", "#173a4a", "#2bd0d6", "#7fc8a9", "#c9a46a", "#263742"],
        "accent": "#2bd0d6",
        "shadow": "#071016",
    },
    {
        "id": "lakeside-park-old-growth",
        "label": "Lakeside Park & Old-Growth Forest",
        "abbr": "P",
        "palette": ["#0d2217", "#1f5534", "#42a65a", "#8ed16f", "#294775", "#152719"],
        "accent": "#8ed16f",
        "shadow": "#06120c",
    },
    {
        "id": "farmstead-outskirts",
        "label": "Farmstead Outskirts",
        "abbr": "F",
        "palette": ["#34220f", "#7a4a1b", "#d9902f", "#e7c76a", "#6b8f3a", "#1b140b"],
        "accent": "#e7c76a",
        "shadow": "#0f0a05",
    },
    {
        "id": "extraction-plaza",
        "label": "Extraction Plaza",
        "abbr": "E",
        "palette": ["#16171f", "#303241", "#aab7c4", "#ffd166", "#31f7a5", "#090a0f"],
        "accent": "#ffd166",
        "shadow": "#05060a",
    },
]
FAMILIES = ["ground", "water", "vegetation", "buildings", "vehicles", "critters", "poi"]


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def ensure_dirs() -> None:
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    DOC_ASSET_DIR.mkdir(parents=True, exist_ok=True)


def font(size: int = 12) -> ImageFont.ImageFont:
    try:
        return ImageFont.truetype("DejaVuSans.ttf", size)
    except Exception:
        return ImageFont.load_default()


def px(draw: ImageDraw.ImageDraw, xy, fill, outline=None) -> None:
    draw.rectangle(xy, fill=fill, outline=outline)


def diamond(draw: ImageDraw.ImageDraw, cx: int, cy: int, w: int, h: int, fill: str, outline: str | None = None) -> None:
    pts = [(cx, cy - h // 2), (cx + w // 2, cy), (cx, cy + h // 2), (cx - w // 2, cy)]
    draw.polygon(pts, fill=fill, outline=outline)


def new_rgba(w: int, h: int) -> Image.Image:
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def draw_ground(biome: dict[str, Any]) -> Image.Image:
    p = biome["palette"]
    img = new_rgba(128, 64)
    d = ImageDraw.Draw(img)
    diamond(d, 64, 32, 124, 60, p[1], biome["shadow"])
    for i in range(0, 128, 8):
        y = 32 + int(math.sin((i + len(biome["id"])) * 0.22) * 8)
        d.line([(i, y), (i + 14, y + 4)], fill=p[2 if i % 24 == 0 else 0], width=2)
    if "city" in biome["id"] or "plaza" in biome["id"]:
        for x in range(12, 116, 24):
            d.line([(x, 22), (x + 28, 36)], fill=p[5], width=2)
            d.line([(x, 42), (x + 28, 28)], fill=p[0], width=1)
    if "farm" in biome["id"]:
        for x in range(14, 116, 12):
            d.line([(x, 20), (x + 22, 32)], fill=p[3], width=2)
    if "park" in biome["id"]:
        for x in range(18, 112, 17):
            d.ellipse([x, 26, x + 5, 31], fill=p[3])
    if "canal" in biome["id"]:
        d.line([(20, 34), (64, 18), (108, 34)], fill=p[2], width=4)
    return img


def draw_water_sheet(biome: dict[str, Any]) -> Image.Image:
    p = biome["palette"]
    frames, fw, fh = 6, 128, 48
    sheet = new_rgba(fw * frames, fh)
    for frame in range(frames):
        img = new_rgba(fw, fh)
        d = ImageDraw.Draw(img)
        diamond(d, 64, 24, 124, 42, p[1], biome["shadow"])
        for x in range(8, 124, 16):
            y = 22 + int(math.sin((x + frame * 7) * 0.22) * 5)
            d.line([(x, y), (x + 12, y - 2)], fill=p[2], width=2)
            d.point((x + 7, y + 5), fill=p[3])
        if "industrial" in biome["id"]:
            d.rectangle([12, 32, 118, 36], fill="#5c4631")
        if "farm" in biome["id"]:
            d.line([(16, 34), (112, 28)], fill=p[3], width=1)
        sheet.alpha_composite(img, (frame * fw, 0))
    return sheet


def draw_vegetation(biome: dict[str, Any]) -> Image.Image:
    p = biome["palette"]
    img = new_rgba(96, 96)
    d = ImageDraw.Draw(img)
    for i, x in enumerate([18, 38, 58, 74]):
        base = 78 - (i % 2) * 5
        trunk = "#5a3719" if "farm" in biome["id"] or "park" in biome["id"] else p[5]
        d.rectangle([x, base - 22, x + 6, base], fill=trunk)
        if "city" in biome["id"] or "industrial" in biome["id"] or "plaza" in biome["id"]:
            d.rectangle([x - 5, base - 38, x + 11, base - 22], fill=p[1], outline=p[2])
            d.rectangle([x - 2, base - 34, x + 8, base - 30], fill=biome["accent"])
        else:
            d.polygon([(x + 3, base - 52), (x - 13, base - 20), (x + 19, base - 20)], fill=p[2], outline=p[0])
            d.polygon([(x + 3, base - 42), (x - 10, base - 14), (x + 16, base - 14)], fill=p[3])
    d.ellipse([10, 76, 86, 90], fill=(0, 0, 0, 80))
    return img


def draw_building(biome: dict[str, Any]) -> Image.Image:
    p = biome["palette"]
    img = new_rgba(160, 128)
    d = ImageDraw.Draw(img)
    d.ellipse([18, 104, 142, 122], fill=(0, 0, 0, 80))
    if "farm" in biome["id"]:
        d.rectangle([38, 52, 124, 104], fill="#8f2f23", outline=p[5])
        d.polygon([(32, 52), (80, 24), (130, 52)], fill="#c45b35", outline=p[5])
        d.rectangle([68, 72, 92, 104], fill="#4a2415")
        d.rectangle([112, 34, 130, 104], fill="#b7b2a1", outline=p[5])
    elif "canal" in biome["id"]:
        d.rectangle([32, 58, 122, 104], fill="#5d4c36", outline=p[5])
        d.rectangle([45, 40, 105, 58], fill="#83735c", outline=p[5])
        d.rectangle([22, 88, 140, 98], fill="#8d6b3e")
        d.line([(22, 84), (140, 84)], fill=p[2], width=2)
    elif "industrial" in biome["id"]:
        d.rectangle([24, 50, 132, 106], fill=p[1], outline=p[5])
        d.polygon([(24, 50), (52, 30), (132, 50)], fill=p[4], outline=p[5])
        for x in [38, 68, 98]: d.rectangle([x, 64, x + 16, 80], fill=p[2])
        d.rectangle([116, 20, 128, 50], fill="#8b6a36")
    elif "plaza" in biome["id"]:
        d.rectangle([32, 50, 128, 106], fill=p[1], outline=p[2])
        d.polygon([(32, 50), (80, 22), (128, 50)], fill=p[3], outline=p[5])
        d.rectangle([68, 66, 92, 106], fill=p[4])
        d.text((49, 38), "EXIT", fill=p[3], font=font(13))
    elif "park" in biome["id"]:
        d.rectangle([42, 54, 118, 104], fill="#7a4a26", outline=p[5])
        d.polygon([(36, 54), (80, 30), (124, 54)], fill="#2d6b3e", outline=p[5])
        d.rectangle([92, 68, 110, 104], fill="#321b10")
    else:
        d.rectangle([28, 48, 132, 106], fill=p[1], outline=p[5])
        for x in [40, 70, 100]: d.rectangle([x, 60, x + 16, 80], fill=biome["accent"])
        d.rectangle([60, 86, 100, 106], fill=p[5])
        d.text((42, 34), biome["abbr"] + "-CORE", fill=p[2], font=font(12))
    return img


def draw_vehicle(biome: dict[str, Any]) -> Image.Image:
    p = biome["palette"]
    img = new_rgba(128, 80)
    d = ImageDraw.Draw(img)
    d.ellipse([14, 56, 112, 72], fill=(0, 0, 0, 80))
    if "farm" in biome["id"]:
        d.rectangle([32, 34, 82, 56], fill="#9b3028", outline=p[5])
        d.rectangle([78, 40, 104, 58], fill="#d9902f", outline=p[5])
    elif "industrial" in biome["id"] or "canal" in biome["id"]:
        d.rectangle([22, 38, 96, 58], fill=p[4], outline=p[5])
        d.rectangle([72, 26, 100, 44], fill=p[1], outline=p[5])
        d.line([(18, 35), (52, 18), (96, 20)], fill=p[2], width=3)
    elif "park" in biome["id"]:
        d.rectangle([24, 36, 90, 56], fill="#315d38", outline=p[5])
        d.rectangle([72, 28, 100, 52], fill="#56391d", outline=p[5])
    elif "plaza" in biome["id"]:
        d.rectangle([20, 34, 104, 56], fill=p[1], outline=p[3])
        d.rectangle([84, 26, 112, 48], fill=p[4], outline=p[5])
        d.text((36, 39), "LTC", fill=p[3], font=font(12))
    else:
        d.rectangle([18, 36, 104, 56], fill=p[1], outline=p[5])
        d.rectangle([42, 26, 82, 40], fill=p[2], outline=p[5])
        d.line([(20, 48), (104, 48)], fill=biome["accent"], width=2)
    for x in [34, 92]:
        d.ellipse([x, 52, x + 16, 68], fill=p[5], outline=p[2])
    return img


def draw_critter_sheet(biome: dict[str, Any]) -> Image.Image:
    p = biome["palette"]
    fw, fh, frames = 96, 64, 4
    sheet = new_rgba(fw * frames, fh)
    for f in range(frames):
        img = new_rgba(fw, fh)
        d = ImageDraw.Draw(img)
        xoff = f % 2 * 3
        d.ellipse([24 + xoff, 30, 66 + xoff, 50], fill=p[2], outline=p[5])
        d.ellipse([56 + xoff, 22, 78 + xoff, 42], fill=p[3], outline=p[5])
        d.rectangle([34 + xoff, 48, 40 + xoff, 56 - (f % 2) * 3], fill=p[5])
        d.rectangle([58 + xoff, 48, 64 + xoff, 56 - ((f + 1) % 2) * 3], fill=p[5])
        if "city" in biome["id"] or "industrial" in biome["id"] or "plaza" in biome["id"]:
            d.rectangle([38 + xoff, 26, 54 + xoff, 34], fill=biome["accent"])
        else:
            d.polygon([(70 + xoff, 25), (84 + xoff, 18), (78 + xoff, 35)], fill=p[3], outline=p[5])
        d.ellipse([18, 54, 80, 62], fill=(0, 0, 0, 70))
        sheet.alpha_composite(img, (f * fw, 0))
    return sheet


def draw_poi_sheet(biome: dict[str, Any]) -> Image.Image:
    p = biome["palette"]
    fw, fh, frames = 160, 128, 6
    sheet = new_rgba(fw * frames, fh)
    for f in range(frames):
        img = new_rgba(fw, fh)
        d = ImageDraw.Draw(img)
        pulse = f % 3
        d.ellipse([20, 102, 140, 122], fill=(0, 0, 0, 80))
        d.rectangle([58, 56, 102, 104], fill=p[1], outline=p[5])
        d.polygon([(50, 56), (80, 26 - pulse), (110, 56)], fill=p[3], outline=p[5])
        d.rectangle([68, 72, 92, 104], fill=p[5])
        d.line([(42, 104), (118, 104)], fill=biome["accent"], width=4)
        if "canal" in biome["id"]:
            d.rectangle([30, 86, 130, 98], fill="#6a4a2a")
            d.line([(34, 90 + pulse), (126, 88 - pulse)], fill=p[2], width=3)
        elif "park" in biome["id"]:
            d.rectangle([74, 34, 86, 104], fill="#59391c")
            d.polygon([(80, 12), (54, 58), (106, 58)], fill=p[2], outline=p[5])
        elif "farm" in biome["id"]:
            d.line([(38, 88), (122, 38)], fill=p[3], width=4)
            for a in range(0, 360, 90):
                d.line([(80, 48), (80 + int(math.cos(math.radians(a + f * 12)) * 34), 48 + int(math.sin(math.radians(a + f * 12)) * 34))], fill=p[3], width=3)
        elif "plaza" in biome["id"]:
            d.arc([30 - pulse, 22 - pulse, 130 + pulse, 110 + pulse], 200, 340, fill=p[3], width=5)
            d.text((62, 40), "LTC", fill=p[3], font=font(16))
        elif "industrial" in biome["id"]:
            d.rectangle([30, 34, 46, 104], fill=p[4], outline=p[5])
            d.line([(38, 34), (112, 52 + pulse)], fill=p[3], width=4)
        else:
            d.text((46, 38), "BUS", fill=p[2], font=font(17))
            d.rectangle([34, 72, 126, 92], fill=p[5])
            d.line([(40, 82), (120, 82)], fill=biome["accent"], width=2)
        sheet.alpha_composite(img, (f * fw, 0))
    return sheet


def asset_specs() -> list[dict[str, Any]]:
    specs = []
    for biome in BIOMES:
        for family in FAMILIES:
            key = f"level1-wo97-six-biome/{biome['id']}-{family}"
            role = {
                "ground": "ground-tile",
                "water": "water-strip",
                "vegetation": "tree",
                "buildings": "building",
                "vehicles": "vehicle",
                "critters": "critter",
                "poi": "landmark",
            }[family]
            animated = family in {"water", "critters", "poi"}
            frames = {"water": 6, "critters": 4, "poi": 6}.get(family, 1)
            frame_width = {"ground": 128, "water": 128, "vegetation": 96, "buildings": 160, "vehicles": 128, "critters": 96, "poi": 160}[family]
            frame_height = {"ground": 64, "water": 48, "vegetation": 96, "buildings": 128, "vehicles": 80, "critters": 64, "poi": 128}[family]
            specs.append({
                "key": key,
                "biomeId": biome["id"],
                "biomeLabel": biome["label"],
                "family": family,
                "category": family,
                "role": role,
                "animated": animated,
                "frames": frames,
                "frameMs": 120 if animated else None,
                "frameWidth": frame_width,
                "frameHeight": frame_height,
                "sourcePolicy": SOURCE_POLICY,
                "notes": f"WO-97 {family} asset for {biome['label']} macro biome.",
            })
    return specs


def render_asset(spec: dict[str, Any], biome: dict[str, Any]) -> Image.Image:
    return {
        "ground": draw_ground,
        "water": draw_water_sheet,
        "vegetation": draw_vegetation,
        "buildings": draw_building,
        "vehicles": draw_vehicle,
        "critters": draw_critter_sheet,
        "poi": draw_poi_sheet,
    }[spec["family"]](biome)


def write_contact_sheet(family: str, entries: list[dict[str, Any]]) -> str:
    thumb_w, thumb_h = 180, 150
    sheet = Image.new("RGB", (thumb_w * 3, thumb_h * 2), "#101018")
    d = ImageDraw.Draw(sheet)
    for idx, entry in enumerate(entries):
        x = (idx % 3) * thumb_w
        y = (idx // 3) * thumb_h
        img = Image.open(REPO / "apps" / "portal" / entry["src"].replace("./", "")).convert("RGBA")
        if entry["animated"]:
            img = img.crop((0, 0, entry["frameWidth"], entry["frameHeight"]))
        img.thumbnail((150, 96), Image.Resampling.NEAREST)
        d.rectangle([x + 6, y + 6, x + thumb_w - 6, y + thumb_h - 6], outline="#34344a")
        sheet.paste(Image.new("RGB", img.size, "#20202a"), (x + 15, y + 22))
        sheet.paste(img.convert("RGB"), (x + 15, y + 22), img)
        d.text((x + 12, y + 8), entry["biomeLabel"][:24], fill="#e8e8f2", font=font(11))
        d.text((x + 12, y + 124), entry["key"].split("/")[-1], fill="#aab7c4", font=font(10))
    out = DOC_ASSET_DIR / f"hmh-wo97-{family}-contact-sheet.png"
    sheet.save(out)
    return out.relative_to(REPO).as_posix()


def main() -> None:
    ensure_dirs()
    specs = asset_specs()
    entries = []
    by_biome = {b["id"]: b for b in BIOMES}
    for spec in specs:
        biome = by_biome[spec["biomeId"]]
        img = render_asset(spec, biome)
        out = OUT_ROOT / f"{spec['biomeId']}-{spec['family']}.png"
        img.save(out)
        entry = dict(spec)
        entry["src"] = f"./assets/generated/hmh-coherent-world/{spec['key']}.png"
        entry["width"] = img.width
        entry["height"] = img.height
        if not entry["animated"]:
            entry.pop("frameMs", None)
        else:
            entry["sheetWidth"] = img.width
            entry["sheetHeight"] = img.height
        entries.append(entry)
    contact_sheets = {family: write_contact_sheet(family, [e for e in entries if e["family"] == family]) for family in FAMILIES}
    manifest = {
        "id": "hmh-level-one-wo97-six-biome-world-assets-v1",
        "levelId": "level-1-crypto-wasteland",
        "status": "approved-generated-runtime-ready",
        "sourcePolicy": SOURCE_POLICY,
        "macroPlan": "docs/game-design/hmh-wo96-level1-macro-map.md",
        "assetCount": len(entries),
        "families": FAMILIES,
        "biomes": [{"id": b["id"], "label": b["label"]} for b in BIOMES],
        "contactSheets": contact_sheets,
        "assets": entries,
    }
    MANIFEST_JSON.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    MANIFEST_MJS.write_text(
        "// Generated by scripts/generate-hmh-wo97-world-assets.py\n"
        f"export const HMH_LEVEL_ONE_WO97_WORLD_ASSETS = Object.freeze({json.dumps(manifest, indent=2)});\n"
        "export function levelOneWo97WorldAssetByKey(key) {\n"
        "  return HMH_LEVEL_ONE_WO97_WORLD_ASSETS.assets.find((asset) => asset.key === key) ?? null;\n"
        "}\n",
        encoding="utf-8",
    )
    lines = [
        "# HMH WO-97 — Level 1 Six-Biome World Assets",
        "",
        "Status: approved generated asset families for WO-98 assembly.",
        "",
        f"- Asset count: {len(entries)}",
        f"- Families: {', '.join(FAMILIES)}",
        "- Source policy: original repo-owned deterministic pixel art; no third-party pixels copied.",
        "- Runtime manifest: `apps/portal/assets/generated/hmh-coherent-world/level1-wo97-six-biome/level1-wo97-six-biome-manifest.mjs`",
        "",
        "## Contact sheets",
        "",
    ]
    for family, path in contact_sheets.items():
        lines.append(f"- {family}: `{path}`")
    lines += ["", "## Biome coverage", "", "| biome | assets | families |", "|---|---:|---|"]
    for biome in BIOMES:
        biome_entries = [e for e in entries if e["biomeId"] == biome["id"]]
        lines.append(f"| {biome['label']} | {len(biome_entries)} | {', '.join(e['family'] for e in biome_entries)} |")
    DOC_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"manifest": MANIFEST_JSON.relative_to(REPO).as_posix(), "mjs": MANIFEST_MJS.relative_to(REPO).as_posix(), "assetCount": len(entries), "contactSheets": contact_sheets}, indent=2))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""WO-103 continuous ground runtime variants.

The approved Level 1 final-paint and water frames are isometric diamond PNGs with
transparent corners. That is correct when drawing each tile as an image, but the
current high-performance renderer fills grouped diamond paths with a repeating
CanvasPattern. Transparent corners in a pattern source create the visible black
checkerboard Justin reported.

This script does not draw placeholder art. It post-processes approved repo-owned
final-paint terrain into opaque pattern sources by alpha-compositing each source
frame over a sampled color field from its own opaque pixels. The result keeps the
painted terrain/water pixels while removing transparent pattern holes.
"""
from __future__ import annotations

import json
import statistics
from pathlib import Path
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
PORTAL_DIR = ROOT / "apps/portal"
SRC_DIR = PORTAL_DIR / "assets/generated/hmh-level-one-ground/final-paint"
OUT_DIR = PORTAL_DIR / "assets/generated/hmh-level-one-ground/wo103-continuous"
MANIFEST_JSON = OUT_DIR / "wo103-continuous-ground-manifest.json"
MANIFEST_MJS = OUT_DIR / "wo103-continuous-ground-manifest.mjs"
CONTACT_SHEET = ROOT / "docs/game-design/assets/hmh-wo103-continuous-ground-contact-sheet.png"

SOURCES = [
    ("wo103-continuous/grass", "grass", "grass-handpaint-01.png", False, 1, 128, 64, "continuous meadow/park grass fill from final-paint grass"),
    ("wo103-continuous/forest-floor", "grass", "grass-handpaint-02.png", False, 1, 128, 64, "continuous forest floor/leafy grass fill from final-paint grass variant"),
    ("wo103-continuous/dirt", "dirt", "dirt-handpaint-01.png", False, 1, 128, 64, "continuous packed dirt route fill"),
    ("wo103-continuous/field-stubble", "dirt", "dirt-handpaint-02.png", False, 1, 128, 64, "continuous field stubble and rural dirt fill"),
    ("wo103-continuous/sand", "sand", "sand-handpaint-01.png", False, 1, 128, 64, "continuous lakeshore/desert sand fill"),
    ("wo103-continuous/rocky", "rocky", "rocky-handpaint-01.png", False, 1, 128, 64, "continuous rocky cliff-foot fill"),
    ("wo103-continuous/asphalt", "road", "road-asphalt-handpaint-01.png", False, 1, 128, 64, "continuous wet asphalt / ghost town road fill"),
    ("wo103-continuous/dirt-road", "road", "road-dirt-handpaint-01.png", False, 1, 128, 64, "continuous rural dirt road fill"),
    ("wo103-continuous/scorched-yard", "rocky", "rocky-handpaint-02.png", False, 1, 128, 64, "continuous scorched boss yard fill"),
    ("wo103-continuous/grass-dirt-transition", "grass-to-dirt", "grass-dirt-handpaint-01.png", False, 1, 128, 64, "continuous torn grass-to-dirt transition"),
    ("wo103-continuous/dirt-sand-transition", "dirt-to-sand", "dirt-sand-handpaint-01.png", False, 1, 128, 64, "continuous dirt-to-sand transition"),
    ("wo103-continuous/water-ripple", "water", "water-ripple-handpaint-01.png", True, 6, 128, 64, "continuous six-frame animated water ripple fill"),
    ("wo103-continuous/water-glint", "water", "water-litecoin-glint-01.png", True, 6, 128, 64, "continuous six-frame moonlight/glint water fill"),
    ("wo103-continuous/shore-grass-water", "shore", "shore-grass-water-handpaint-01.png", True, 6, 128, 64, "continuous grass shoreline foam transition"),
    ("wo103-continuous/shore-dirt-water", "shore", "shore-dirt-water-handpaint-01.png", True, 6, 128, 64, "continuous dirt shoreline foam transition"),
    ("wo103-continuous/shore-sand-water", "shore", "shore-sand-water-handpaint-01.png", True, 6, 128, 64, "continuous sand shoreline foam transition"),
]

ROLE_PREF_ORDER = [
    "grass", "dirt", "sand", "rocky", "road", "grass-to-dirt", "dirt-to-sand", "water", "shore",
]


def sampled_base(frame: Image.Image) -> Image.Image:
    rgba = frame.convert("RGBA")
    pixels = [(r, g, b) for r, g, b, a in rgba.getdata() if a > 80]
    if not pixels:
        color = (24, 22, 20)
    else:
        # Median avoids one bright highlight driving the whole fill.
        color = tuple(int(statistics.median(ch)) for ch in zip(*pixels))
    base = Image.new("RGBA", rgba.size, (*color, 255))
    # Feather a blurred copy of the opaque art into the base so transparent
    # corners inherit local terrain color rather than a flat card color.
    alpha = rgba.getchannel("A")
    blurred = rgba.copy()
    blurred.putalpha(alpha.filter(ImageFilter.GaussianBlur(radius=10)))
    base.alpha_composite(blurred)
    base.alpha_composite(rgba)
    return base.convert("RGBA")


def split_frames(img: Image.Image, frames: int, frame_width: int, frame_height: int) -> list[Image.Image]:
    if frames <= 1:
        return [img.crop((0, 0, frame_width, frame_height))]
    return [img.crop((idx * frame_width, 0, (idx + 1) * frame_width, frame_height)) for idx in range(frames)]


def write_manifest(assets: list[dict]) -> None:
    roles: dict[str, list[str]] = {}
    for asset in assets:
        roles.setdefault(asset["role"], []).append(asset["key"])
    payload = {
        "id": "hmh-wo103-continuous-ground-v1",
        "source": "WO-103 post-process of repo-owned final-paint terrain",
        "sourcePolicy": "Derived from approved repo-owned final-paint ground; transparent pattern holes removed for runtime CanvasPattern use. No placeholder/script-drawn art.",
        "tileWidth": 128,
        "tileHeights": [64],
        "assetCount": len(assets),
        "roles": roles,
        "contactSheet": "docs/game-design/assets/hmh-wo103-continuous-ground-contact-sheet.png",
        "assets": assets,
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    MANIFEST_JSON.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    MANIFEST_MJS.write_text(
        "// Generated by scripts/generate-wo103-continuous-ground.py\n"
        f"export const HMH_WO103_CONTINUOUS_GROUND = Object.freeze({json.dumps(payload, indent=2)});\n\n"
        "export function wo103ContinuousGroundAssetByKey(key) {\n"
        "  return HMH_WO103_CONTINUOUS_GROUND.assets.find((asset) => asset.key === key) ?? null;\n"
        "}\n",
        encoding="utf-8",
    )


def make_contact_sheet(assets: list[dict]) -> None:
    CONTACT_SHEET.parent.mkdir(parents=True, exist_ok=True)
    thumb_w, thumb_h = 192, 96
    pad, label_h, cols = 12, 34, 3
    rows = (len(assets) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (thumb_w + pad) + pad, rows * (thumb_h + label_h + pad) + pad), (20, 22, 30))
    from PIL import ImageDraw, ImageFont
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("arial.ttf", 11)
    except Exception:
        font = ImageFont.load_default()
    for idx, asset in enumerate(assets):
        src = PORTAL_DIR / asset["src"].replace("./", "")
        img = Image.open(src).convert("RGBA")
        if asset.get("animated"):
            img = img.crop((0, 0, asset["frameWidth"], asset["frameHeight"]))
        img.thumbnail((thumb_w, thumb_h), Image.Resampling.NEAREST)
        x = pad + (idx % cols) * (thumb_w + pad)
        y = pad + (idx // cols) * (thumb_h + label_h + pad)
        card = Image.new("RGBA", (thumb_w, thumb_h), (9, 12, 18, 255))
        card.alpha_composite(img, ((thumb_w - img.width) // 2, (thumb_h - img.height) // 2))
        sheet.paste(card.convert("RGB"), (x, y))
        draw.text((x, y + thumb_h + 3), asset["key"].replace("wo103-continuous/", ""), fill=(210, 230, 255), font=font)
        draw.text((x, y + thumb_h + 17), f"{asset['role']} {'anim' if asset.get('animated') else 'static'}", fill=(142, 255, 190), font=font)
    sheet.save(CONTACT_SHEET)


def main() -> None:
    assets: list[dict] = []
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for key, role, filename, animated, frames, frame_width, frame_height, description in SOURCES:
        src = SRC_DIR / filename
        image = Image.open(src).convert("RGBA")
        out_name = key.split("/", 1)[1] + ".png"
        out = OUT_DIR / out_name
        frame_imgs = split_frames(image, frames, frame_width, frame_height)
        processed = [sampled_base(frame) for frame in frame_imgs]
        if animated:
            sheet = Image.new("RGBA", (frame_width * frames, frame_height), (0, 0, 0, 255))
            for idx, frame in enumerate(processed):
                sheet.alpha_composite(frame, (idx * frame_width, 0))
            sheet.save(out)
        else:
            processed[0].save(out)
        asset = {
            "key": key,
            "role": role,
            "category": "terrain" if role not in {"water", "shore"} else role,
            "src": "./" + str(out.relative_to(PORTAL_DIR)).replace("\\", "/"),
            "width": frame_width,
            "height": frame_height,
            "preferred": role in ROLE_PREF_ORDER,
            "animated": animated,
            "description": description,
            "sourcePolicy": "WO-103 post-process of approved repo-owned final-paint terrain; alpha-composited for CanvasPattern runtime use.",
        }
        if animated:
            asset.update({"frames": frames, "frameWidth": frame_width, "frameHeight": frame_height, "sheetWidth": frame_width * frames, "frameDuration": 8, "frameMs": 120})
        assets.append(asset)
    write_manifest(assets)
    make_contact_sheet(assets)
    print(json.dumps({"assets": len(assets), "manifest": str(MANIFEST_MJS.relative_to(ROOT)), "contactSheet": str(CONTACT_SHEET.relative_to(ROOT))}, indent=2))


if __name__ == "__main__":
    main()

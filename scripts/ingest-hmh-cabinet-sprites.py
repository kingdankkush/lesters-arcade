"""Ingest the user-provided Hard Money Heroes cabinet sprite sheet.

The source art is one PNG sprite sheet with six cabinet views. Newer exports ship
with real transparency; older previews had checkerboard/white matting. This script
copies the original source into the repo, removes any preview matting when present,
normalizes each view onto a stable transparent canvas, and writes the runtime
manifest consumed by every rotating Hard Money Heroes cabinet preview.
"""

from __future__ import annotations

import json
import os
import shutil
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[1]
SOURCE_ENV = "HMH_CABINET_SOURCE_PNG"
SOURCE = Path(os.environ[SOURCE_ENV]) if os.environ.get(SOURCE_ENV) else None
PUBLIC_ROOT = REPO_ROOT / "apps" / "portal"
CABINET_ROOT = PUBLIC_ROOT / "assets" / "hard-money-heroes" / "cabinet"
SOURCE_OUT = CABINET_ROOT / "source" / "Hard-Money-Heroes-ArcadeCabinet.png"
ROTATION_OUT = CABINET_ROOT / "rotation"
MANIFEST_JSON = CABINET_ROOT / "hmh-cabinet-sprite-manifest.json"
MANIFEST_MJS = CABINET_ROOT / "hmh-cabinet-sprite-manifest.mjs"

CANVAS_SIZE = (512, 560)
FRAME_PADDING = 10
CACHE_BUST_VERSION = "hmh-cabinet-white-bg-v1"

# Manual crop boxes are based on the six cabinet views in the 1448×1086
# transparent PNG the user supplied. Keeping the crop boxes explicit makes this
# deterministic and avoids accidentally treating title text, weapon flashes, or
# cabinet highlights as separate sprites.
FRAME_CROPS = [
    ("front", "Front marquee cabinet", (78, 19, 475, 552)),
    ("front-right", "Front-right three-quarter cabinet", (540, 13, 1017, 568)),
    ("right-side", "Right-side cabinet art", (1078, 11, 1383, 551)),
    ("back", "Back service-panel cabinet", (104, 571, 449, 1049)),
    ("left-side", "Left-side cabinet art", (571, 572, 846, 1049)),
    ("front-left", "Front-left three-quarter cabinet", (941, 557, 1357, 1064)),
]


def preview_matte_to_alpha(image: Image.Image) -> Image.Image:
    """Remove transparent/neutral/orange preview matting from a cropped frame."""

    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    # Source sheets use a flat preview matte. Sample the crop corners so the
    # keyed color follows both the orange matte in the latest drop and older
    # neutral/white previews without damaging similarly-bright cabinet details.
    corner_colors = [
        pixels[0, 0][:3],
        pixels[width - 1, 0][:3],
        pixels[0, height - 1][:3],
        pixels[width - 1, height - 1][:3],
    ]

    def close_to_corner(red: int, green: int, blue: int) -> bool:
        return any(abs(red - cr) <= 42 and abs(green - cg) <= 42 and abs(blue - cb) <= 42 for cr, cg, cb in corner_colors)

    for y in range(height):
        for x in range(width):
            red, green, blue, alpha = pixels[x, y]
            neutral_spread = max(red, green, blue) - min(red, green, blue)
            neutral_preview = max(red, green, blue) >= 205 and neutral_spread <= 32
            if alpha < 8 or neutral_preview or close_to_corner(red, green, blue):
                pixels[x, y] = (red, green, blue, 0)
    return rgba


def trim_to_art(image: Image.Image, padding: int = FRAME_PADDING) -> Image.Image:
    """Trim transparent edges while preserving a small glow-safe pad."""

    bbox = image.getchannel("A").getbbox()
    if not bbox:
        return image
    left, top, right, bottom = bbox
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(image.width, right + padding)
    bottom = min(image.height, bottom + padding)
    return image.crop((left, top, right, bottom))


def normalize_frame(image: Image.Image) -> Image.Image:
    """Place the crop on a consistent transparent canvas so the animation does not jump."""

    canvas_width, canvas_height = CANVAS_SIZE
    max_width = canvas_width - FRAME_PADDING * 2
    max_height = canvas_height - FRAME_PADDING * 2
    frame = image.copy()
    frame.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
    x = (canvas_width - frame.width) // 2
    y = canvas_height - frame.height - 2
    canvas.alpha_composite(frame, (x, y))
    return canvas


def public_src(path: Path, *, cache_bust: bool = False) -> str:
    src = "./" + path.relative_to(PUBLIC_ROOT).as_posix()
    return f"{src}?v={CACHE_BUST_VERSION}" if cache_bust else src


def frozen_js(value) -> str:
    return "Object.freeze(" + json.dumps(value, indent=2) + ")"


def main() -> None:
    if SOURCE is None:
        raise FileNotFoundError(f"Set {SOURCE_ENV} to the Hard Money Heroes cabinet source PNG before running this ingest script.")
    if not SOURCE.exists():
        raise FileNotFoundError(f"Cabinet sprite source not found: {SOURCE}")

    CABINET_ROOT.mkdir(parents=True, exist_ok=True)
    SOURCE_OUT.parent.mkdir(parents=True, exist_ok=True)
    ROTATION_OUT.mkdir(parents=True, exist_ok=True)
    shutil.copy2(SOURCE, SOURCE_OUT)

    source_image = Image.open(SOURCE).convert("RGBA")
    frames = []
    for index, (frame_id, label, crop_box) in enumerate(FRAME_CROPS):
        crop = source_image.crop(crop_box)
        keyed = preview_matte_to_alpha(crop)
        trimmed = trim_to_art(keyed)
        normalized = normalize_frame(trimmed)
        out_path = ROTATION_OUT / f"hmh-cabinet-rotation-{index:02d}-{frame_id}.png"
        normalized.save(out_path, optimize=True)
        frames.append(
            {
                "id": frame_id,
                "label": label,
                "src": public_src(out_path, cache_bust=True),
                "width": normalized.width,
                "height": normalized.height,
                "durationMs": 720,
                "sourceCrop": crop_box,
            }
        )

    manifest = {
        "id": "hard-money-heroes-arcade-cabinet-rotation",
        "source": public_src(SOURCE_OUT),
        "generatedFrom": SOURCE.name,
        "layout": "six-view-rotation",
        "canvas": {"width": CANVAS_SIZE[0], "height": CANVAS_SIZE[1]},
        "frameDurationMs": 720,
        "loopDurationMs": 720 * len(frames),
        "frames": frames,
        "usage": {
            "desktopSplash": "Featured rotating cabinet beside the selected Hard Money Heroes game on the Lester's Arcade splash.",
            "cabinetSelect": "Playable cabinet card media preview.",
        },
    }

    MANIFEST_JSON.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    MANIFEST_MJS.write_text(
        "export const HMH_CABINET_SPRITE_MANIFEST = " + frozen_js(manifest) + ";\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(frames)} cabinet rotation frames to {ROTATION_OUT}")
    print(f"Wrote manifest {MANIFEST_MJS.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()

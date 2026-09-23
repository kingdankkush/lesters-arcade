"""Build the 1200x630 share-card backgrounds (contract section 7.5, E11).

The card renderer (server/share/render-card.mjs, api/share-card.mjs) paints the
score, handle, standing, stats and badges over one background per game. This
script derives those backgrounds from key art that is already committed:

  lester-blaster  apps/portal/assets/generated/hmh-banners/hard-money-heroes-ranked-banner.jpg
  chikun          apps/portal/assets/generated/chikun-mode-select/chikuns-escape-ranked-mode.webp
  stacked         apps/portal/assets/stacked-mode-select/stacked-ranked-v1.png

Each source is cover-cropped to 1200x630, pixel-doubled (600x315 art scaled
up with nearest neighbour: the arcade's chunky pixel look, and a quarter of
the detail to store), darkened towards the left and the bottom (where the
card text sits), given a faint CRT scanline, and written as an adaptive
palette PNG under 300 KB to apps/portal/assets/share-cards/.
No raw sources are added to the repo (AGENTS.md asset hygiene).

It also mirrors the achievement badge art the card draws. The card function
bundle holds only apps/portal/assets/share-cards/** (vercel.json
includeFiles), so every image of the achievement catalogs
(apps/portal/src/achievements, listed through Node) is copied byte for byte
from apps/portal/assets/generated/<path>.png to
apps/portal/assets/share-cards/badges/<path>.png, and copies that no catalog
uses are removed. tests/share-card.test.mjs fails when the copies drift.

Usage:
  python scripts/build-share-card-backgrounds.py          # write the PNGs and badge copies
  python scripts/build-share-card-backgrounds.py --check  # verify size and bytes only
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "apps" / "portal" / "assets" / "share-cards"
BADGE_DIR = OUT_DIR / "badges"
GENERATED_DIR = ROOT / "apps" / "portal" / "assets" / "generated"
CATALOG_MODULE = ROOT / "apps" / "portal" / "src" / "achievements" / "index.mjs"
CATALOG_IMAGE_PREFIX = "/assets/generated/"
WIDTH, HEIGHT = 1200, 630
MAX_BYTES = 300_000
PALETTE_COLORS = 192

SOURCES = {
    # gameId: (source path, horizontal focus 0..1, vertical focus 0..1)
    "lester-blaster": ("apps/portal/assets/generated/hmh-banners/hard-money-heroes-ranked-banner.jpg", 0.5, 0.45),
    "chikun": ("apps/portal/assets/generated/chikun-mode-select/chikuns-escape-ranked-mode.webp", 0.45, 0.5),
    "stacked": ("apps/portal/assets/stacked-mode-select/stacked-ranked-v1.png", 0.62, 0.5),
}


def cover_crop(image: Image.Image, focus_x: float, focus_y: float) -> Image.Image:
    """Scale to cover 1200x630 and crop around the focus point."""
    scale = max(WIDTH / image.width, HEIGHT / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    left = round((resized.width - WIDTH) * focus_x)
    top = round((resized.height - HEIGHT) * focus_y)
    return resized.crop((left, top, left + WIDTH, top + HEIGHT))


def legibility_mask() -> Image.Image:
    """Alpha of a navy overlay: strong on the left and bottom, light top right."""
    mask = Image.new("L", (WIDTH, HEIGHT), 0)
    pixels = mask.load()
    for y in range(HEIGHT):
        bottom = max(0.0, (y / HEIGHT - 0.55) / 0.45)
        for x in range(WIDTH):
            left = max(0.0, 1.0 - x / (WIDTH * 0.78))
            strength = min(1.0, 0.34 + 0.52 * left * left + 0.4 * bottom * bottom)
            pixels[x, y] = round(255 * strength)
    return mask


def scanlines(image: Image.Image) -> Image.Image:
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for y in range(0, HEIGHT, 3):
        draw.line([(0, y), (WIDTH, y)], fill=(0, 0, 0, 34))
    return Image.alpha_composite(image.convert("RGBA"), overlay)


def build_background(game_id: str) -> Image.Image:
    source, focus_x, focus_y = SOURCES[game_id]
    with Image.open(ROOT / source) as raw:
        art = cover_crop(raw.convert("RGB"), focus_x, focus_y)
    art = art.resize((WIDTH // 2, HEIGHT // 2), Image.Resampling.LANCZOS).resize((WIDTH, HEIGHT), Image.Resampling.NEAREST)
    navy = Image.new("RGB", (WIDTH, HEIGHT), (5, 7, 18))
    darkened = Image.composite(navy, art, legibility_mask())
    lined = scanlines(darkened).convert("RGB")
    return lined.quantize(colors=PALETTE_COLORS, method=Image.Quantize.MEDIANCUT)


def check(path: Path) -> list[str]:
    problems = []
    if not path.exists():
        return [f"{path.relative_to(ROOT)} is missing"]
    size = path.stat().st_size
    if size >= MAX_BYTES:
        problems.append(f"{path.relative_to(ROOT)} is {size} bytes (limit {MAX_BYTES})")
    with Image.open(path) as image:
        if image.size != (WIDTH, HEIGHT):
            problems.append(f"{path.relative_to(ROOT)} is {image.size[0]}x{image.size[1]}, expected {WIDTH}x{HEIGHT}")
        if image.format != "PNG":
            problems.append(f"{path.relative_to(ROOT)} is {image.format}, expected PNG")
    return problems


def catalog_badge_images() -> list[str]:
    """Every catalog image path (`/assets/generated/...png`), read through Node."""
    script = (
        "const m = await import(process.argv[1]);"
        "const out = new Set();"
        "for (const game of m.ACHIEVEMENT_GAME_IDS) for (const entry of m.catalogFor(game)) out.add(entry.image);"
        "console.log(JSON.stringify([...out].sort()));"
    )
    result = subprocess.run(
        ["node", "--input-type=module", "-e", script, CATALOG_MODULE.as_uri()],
        check=True, capture_output=True, text=True, cwd=ROOT,
    )
    images = json.loads(result.stdout)
    for image in images:
        relative = image[len(CATALOG_IMAGE_PREFIX):]
        if not image.startswith(CATALOG_IMAGE_PREFIX) or ".." in relative.split("/") or not relative.endswith(".png"):
            raise ValueError(f"unexpected catalog image path {image}")
    return images


def sync_badges(write: bool) -> list[str]:
    """Mirror the catalog badge art under share-cards/badges (or check it)."""
    problems = []
    wanted = {}
    for image in catalog_badge_images():
        relative = image[len(CATALOG_IMAGE_PREFIX):]
        wanted[relative] = GENERATED_DIR / relative
    present = {path.relative_to(BADGE_DIR).as_posix(): path for path in BADGE_DIR.rglob("*.png")} if BADGE_DIR.exists() else {}
    for relative, source in sorted(wanted.items()):
        target = BADGE_DIR / relative
        if not source.exists():
            problems.append(f"catalog image {source.relative_to(ROOT).as_posix()} is missing")
            continue
        data = source.read_bytes()
        if target.exists() and target.read_bytes() == data:
            continue
        if write:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        else:
            problems.append(f"{target.relative_to(ROOT).as_posix()} is missing or differs from its catalog art")
    for relative, path in sorted(present.items()):
        if relative in wanted:
            continue
        if write:
            path.unlink()
        else:
            problems.append(f"{path.relative_to(ROOT).as_posix()} is not a catalog image")
    if write:
        for directory in sorted((path for path in BADGE_DIR.rglob("*") if path.is_dir()), reverse=True):
            if not any(directory.iterdir()):
                directory.rmdir()
    total = sum((BADGE_DIR / relative).stat().st_size for relative in wanted if (BADGE_DIR / relative).exists())
    print(f"{BADGE_DIR.relative_to(ROOT).as_posix()}: {len(wanted)} badges, {total} bytes")
    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true", help="verify the committed PNGs without rewriting them")
    parser.add_argument("--badges-only", action="store_true", help="sync the badge copies and leave the backgrounds as they are")
    args = parser.parse_args()
    problems: list[str] = []
    if not args.check:
        OUT_DIR.mkdir(parents=True, exist_ok=True)
    for game_id in SOURCES:
        path = OUT_DIR / f"{game_id}.png"
        if not args.check and not args.badges_only:
            build_background(game_id).save(path, format="PNG", optimize=True)
        problems.extend(check(path))
        if path.exists():
            print(f"{path.relative_to(ROOT).as_posix()}: {path.stat().st_size} bytes")
    problems.extend(sync_badges(write=not args.check))
    if problems:
        print("\n".join(problems), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

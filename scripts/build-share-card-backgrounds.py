"""Build the 1200x630 share-card backgrounds (contract section 7.5, E11).

The card renderer (server/share/render-card.mjs, api/share-card.mjs) paints the
score, handle, standing, stats and badges over one background per game. This
script derives those backgrounds from key art that is already committed:

  lester-blaster       apps/portal/assets/hmh-art/share/hmh-rankedmode-share-1600.webp  (Ranked share cover)
  lester-blaster-free  apps/portal/assets/hmh-art/share/hmh-freemode-share-1600.webp    (Free share cover)
  chikun               apps/portal/assets/generated/chikun-mode-select/chikuns-escape-ranked-mode.webp
  stacked              apps/portal/assets/stacked-mode-select/stacked-ranked-v1.png

Each source is cover-cropped to 1200x630, darkened towards the left and the
bottom (where the card text sits), given a faint CRT scanline, and written as
an adaptive palette PNG under 300 KB to apps/portal/assets/share-cards/.
Chikun and STACKED are pixel-doubled first (600x315 art scaled up with nearest
neighbour: the arcade's chunky pixel look). The Hard Money Heroes covers
(owner art, 2026-09-26; scripts/build-hmh-banner-art.py writes their 1600 px
sources) keep full resolution: pixel-doubling turned the violet horde glow grey
and coarsened the faces. They use up to 256 colours and stay at or under
280,000 bytes. Changing lester-blaster.png changes every HMH Ranked card, so
server/share/card-art.mjs records its SHA-256 and art revision (the card's
cache key; tests/share-card-art.test.mjs fails when they drift).
lester-blaster-free.png is the Free share card background for the Free share
branch (fable/free-share: api/free-card.mjs BACKGROUNDS['lester-blaster']).
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
import io
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "apps" / "portal" / "assets" / "share-cards"
BADGE_DIR = OUT_DIR / "badges"
GENERATED_DIR = ROOT / "apps" / "portal" / "assets" / "generated"
CATALOG_MODULE = ROOT / "apps" / "portal" / "src" / "achievements" / "index.mjs"
CATALOG_IMAGE_PREFIX = "/assets/generated/"
WIDTH, HEIGHT = 1200, 630
MAX_BYTES = 300_000
PALETTE_COLORS = 192

FULL_MAX_BYTES = 280_000

SOURCES = {
    # card id: (source path, horizontal focus 0..1, vertical focus 0..1, pixel-doubled)
    "lester-blaster": ("apps/portal/assets/hmh-art/share/hmh-rankedmode-share-1600.webp", 0.74, 0.0, False),
    "lester-blaster-free": ("apps/portal/assets/hmh-art/share/hmh-freemode-share-1600.webp", 0.73, 0.0, False),
    "chikun": ("apps/portal/assets/generated/chikun-mode-select/chikuns-escape-ranked-mode.webp", 0.45, 0.5, True),
    "stacked": ("apps/portal/assets/stacked-mode-select/stacked-ranked-v1.png", 0.62, 0.5, True),
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


# The HMH covers put the heroes' faces in the top fifth of the frame, where the
# card's status pill sits (top right, about y 44-104), and the nearest hero at
# x ~700, where the score ends. The art moves down by PILL_DROP px and right by
# SCORE_SHIFT px; the bands it leaves are the art's own edges, blurred, under
# the legibility mask (which is strongest on the left anyway).
PILL_DROP = 44
SCORE_SHIFT = 60


def drop_below_status_pill(art: Image.Image) -> Image.Image:
    band = art.crop((0, 0, WIDTH, PILL_DROP)).resize((WIDTH, PILL_DROP), Image.Resampling.LANCZOS)
    base = art.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(14))
    base.paste(band.filter(ImageFilter.GaussianBlur(10)), (0, 0))
    base.paste(art.crop((0, 0, WIDTH - SCORE_SHIFT, HEIGHT - PILL_DROP)), (SCORE_SHIFT, PILL_DROP))
    edge = Image.new("L", (WIDTH, HEIGHT), 0)
    ImageDraw.Draw(edge).rectangle((0, 0, WIDTH, PILL_DROP + 18), fill=255)
    ImageDraw.Draw(edge).rectangle((0, 0, SCORE_SHIFT + 18, HEIGHT), fill=255)
    edge = edge.filter(ImageFilter.GaussianBlur(10))
    blurred_top = base.filter(ImageFilter.GaussianBlur(8))
    return Image.composite(blurred_top, base, edge)


# The Free card (fable/free-share, server/share/render-free-card.mjs) stands the player's hero
# portrait in PORTRAIT_BOX (x 738-1180, y 188-630) under a ribbon across the top right. The
# painted heroes of the Free cover sit in the same place, so the Free background blurs and
# darkens that zone: the painted cast recedes into the forest and the portrait reads first.
FREE_PORTRAIT_ZONE_X = (720, 820)  # the recess ramps in over this span
FREE_PORTRAIT_RECESS = 0.62        # navy strength inside the zone


def recess_portrait_zone(art: Image.Image) -> Image.Image:
    soft = art.filter(ImageFilter.GaussianBlur(7))
    navy = Image.new("RGB", (WIDTH, HEIGHT), (5, 7, 18))
    receded = Image.blend(soft, navy, FREE_PORTRAIT_RECESS)
    mask = Image.new("L", (WIDTH, HEIGHT), 0)
    pixels = mask.load()
    start, end = FREE_PORTRAIT_ZONE_X
    for x in range(WIDTH):
        value = 0 if x <= start else 255 if x >= end else round(255 * (x - start) / (end - start))
        for y in range(HEIGHT):
            pixels[x, y] = value
    return Image.composite(receded, art, mask)


def build_background(game_id: str) -> Image.Image:
    source, focus_x, focus_y, pixel_doubled = SOURCES[game_id]
    with Image.open(ROOT / source) as raw:
        art = cover_crop(raw.convert("RGB"), focus_x, focus_y)
    if pixel_doubled:
        art = art.resize((WIDTH // 2, HEIGHT // 2), Image.Resampling.LANCZOS).resize((WIDTH, HEIGHT), Image.Resampling.NEAREST)
    else:
        art = drop_below_status_pill(art)
    if game_id == "lester-blaster-free":
        art = recess_portrait_zone(art)
    navy = Image.new("RGB", (WIDTH, HEIGHT), (5, 7, 18))
    darkened = Image.composite(navy, art, legibility_mask())
    lined = scanlines(darkened).convert("RGB")
    if pixel_doubled:
        return lined.quantize(colors=PALETTE_COLORS, method=Image.Quantize.MEDIANCUT)
    return lined


def encode_background(game_id: str) -> bytes:
    """PNG bytes; the full-resolution HMH covers step their palette down until they fit."""
    image = build_background(game_id)
    if image.mode == "P":
        buffer = io.BytesIO()
        image.save(buffer, format="PNG", optimize=True)
        return buffer.getvalue()
    for colors in (256, 224, 192, 160, 128):
        buffer = io.BytesIO()
        image.quantize(colors=colors, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(buffer, format="PNG", optimize=True)
        if buffer.tell() <= FULL_MAX_BYTES:
            break
    return buffer.getvalue()


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
    parser.add_argument("--only", default="", help="comma-separated card ids to rebuild (the others are only checked)")
    args = parser.parse_args()
    only = {item for item in args.only.split(",") if item}
    unknown = only - set(SOURCES)
    if unknown:
        parser.error(f"unknown card ids: {', '.join(sorted(unknown))}")
    problems: list[str] = []
    if not args.check:
        OUT_DIR.mkdir(parents=True, exist_ok=True)
    for game_id in SOURCES:
        path = OUT_DIR / f"{game_id}.png"
        if not args.check and not args.badges_only and (not only or game_id in only):
            path.write_bytes(encode_background(game_id))
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

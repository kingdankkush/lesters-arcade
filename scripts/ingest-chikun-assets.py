#!/usr/bin/env python3
"""Build production-ready Chikun mode cards and transparent gameplay sprites.

Mode cards come from user-supplied artwork. Gameplay sprites are recovered from
Lester's Arcade's own historical Chikun handoff commit, background-keyed, cropped,
and compressed for the public canvas runtime.
"""
from __future__ import annotations

import argparse
import io
import subprocess
from pathlib import Path

from PIL import Image, ImageChops

HISTORICAL_COMMIT = "51def63af5ebbc84bab3b0dd51273d5c805b47b5"
HISTORICAL_ROOT = "docs/handoffs/chikuns-escape/public/arise"


def save_mode_card(source: Path, destination: Path) -> None:
    with Image.open(source) as image:
        image = image.convert("RGB")
        destination.parent.mkdir(parents=True, exist_ok=True)
        image.save(destination, "WEBP", quality=90, method=6)


def git_blob(repo: Path, relative: str) -> bytes:
    return subprocess.check_output(
        ["git", "show", f"{HISTORICAL_COMMIT}:{HISTORICAL_ROOT}/{relative}"],
        cwd=repo,
    )


def keyed_sprite(repo: Path, source_name: str, destination: Path) -> None:
    with Image.open(io.BytesIO(git_blob(repo, source_name))) as source:
        image = source.convert("RGB")
    image.thumbnail((920, 520), Image.Resampling.LANCZOS)
    width, height = image.size
    points = [
        (2, 2), (width - 3, 2), (2, height - 3), (width - 3, height - 3),
        (width // 2, 2), (width // 2, height - 3), (2, height // 2), (width - 3, height // 2),
    ]
    samples = [image.getpixel((x, y)) for x, y in points]
    background = tuple(round(sum(pixel[channel] for pixel in samples) / len(samples)) for channel in range(3))
    backdrop = Image.new("RGB", image.size, background)
    red, green, blue = ImageChops.difference(image, backdrop).split()
    distance = ImageChops.lighter(ImageChops.lighter(red, green), blue)
    alpha = distance.point(lambda value: 0 if value <= 34 else 255 if value >= 70 else round((value - 34) * 255 / 36))
    image = image.convert("RGBA")
    image.putalpha(alpha)
    bbox = image.getchannel("A").getbbox()
    if bbox:
        padding = 12
        left, top, right, bottom = bbox
        bbox = (
            max(0, left - padding), max(0, top - padding),
            min(width, right + padding), min(height, bottom + padding),
        )
        image = image.crop(bbox)
    target_height = 320
    target_width = max(1, round(image.width * target_height / image.height))
    image = image.resize((target_width, target_height), Image.Resampling.LANCZOS)
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, "WEBP", lossless=True, method=6)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--free", type=Path, required=True)
    parser.add_argument("--ranked", type=Path, required=True)
    args = parser.parse_args()
    repo = args.repo.resolve()

    mode_dir = repo / "apps/portal/assets/generated/chikun-mode-select"
    game_dir = repo / "apps/portal/assets/generated/chikun-game"
    save_mode_card(args.free, mode_dir / "chikuns-escape-free-mode.webp")
    save_mode_card(args.ranked, mode_dir / "chikuns-escape-ranked-mode.webp")
    for source, target in [
        ("chikun-coast.png", "chikun-coast.webp"),
        ("chikun-fall.png", "chikun-fall.webp"),
    ]:
        keyed_sprite(repo, source, game_dir / target)

    for path in [*mode_dir.glob("chikuns-escape-*-mode.webp"), *game_dir.glob("chikun-*.webp")]:
        with Image.open(path) as image:
            print(f"{path.relative_to(repo)}\t{image.width}x{image.height}\t{path.stat().st_size} bytes")


if __name__ == "__main__":
    main()

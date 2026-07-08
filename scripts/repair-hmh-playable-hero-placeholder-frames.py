#!/usr/bin/env python3
"""Replace leftover QA/robot placeholder frames in playable HMH hero sheets.

The bad `qa-green-native-*` generation pass padded missing playable hero states with
very small, low-color blue triangle robot frames. Those frames can still pop during
runtime animation even after the main hero art directories were restored.

This repair is intentionally conservative: it never invents a new character design.
It replaces detected placeholders with same-hero frames from established animations:
- dash -> run/walk same direction
- victory -> idle same direction
- isolated tail placeholders -> previous non-placeholder frame in same animation/direction
"""

from __future__ import annotations

from pathlib import Path
from shutil import copyfile
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ROSTER_ROOT = ROOT / "apps/portal/assets/generated/hmh-animated-roster"
PLAYABLE_HEROES = ("lit-commando", "lit-valkyrie", "lester", "lilly")
DIRECTIONS = ("east", "north", "north-east", "north-west", "south", "south-east", "south-west", "west")


def frame_stats(path: Path) -> tuple[int, int]:
    im = Image.open(path).convert("RGBA")
    nontransparent = [(r, g, b) for r, g, b, a in im.getdata() if a > 0]
    return path.stat().st_size, len(set(nontransparent))


def is_placeholder(path: Path) -> bool:
    size, colors = frame_stats(path)
    # The blue triangle robot files are ~620-700 bytes and 5 colors.
    # Keep the threshold tight enough to avoid flagging legitimate low-palette pixel art.
    return size < 950 and colors <= 8


def sorted_pngs(directory: Path) -> list[Path]:
    return sorted(directory.glob("*.png"), key=lambda p: int(p.stem) if p.stem.isdigit() else p.name)


def same_index_source(hero_root: Path, candidates: tuple[str, ...], direction: str, index: int) -> Path | None:
    for anim in candidates:
        directory = hero_root / anim / direction
        frames = sorted_pngs(directory)
        usable = [p for p in frames if not is_placeholder(p)]
        if usable:
            return usable[index % len(usable)]
    return None


def previous_good(frames: list[Path], index: int) -> Path | None:
    for probe in range(index - 1, -1, -1):
        if not is_placeholder(frames[probe]):
            return frames[probe]
    for probe in range(index + 1, len(frames)):
        if not is_placeholder(frames[probe]):
            return frames[probe]
    return None


def repair() -> list[tuple[str, str, str]]:
    replacements: list[tuple[str, str, str]] = []
    for hero in PLAYABLE_HEROES:
        hero_root = ROSTER_ROOT / hero
        if not hero_root.exists():
            raise FileNotFoundError(hero_root)
        for anim_dir in sorted(p for p in hero_root.iterdir() if p.is_dir()):
            anim = anim_dir.name
            for direction in DIRECTIONS:
                directory = anim_dir / direction
                if not directory.exists():
                    continue
                frames = sorted_pngs(directory)
                for index, frame in enumerate(frames):
                    if not is_placeholder(frame):
                        continue
                    if anim == "dash":
                        source = same_index_source(hero_root, ("run", "walk", "idle"), direction, index)
                    elif anim == "victory":
                        source = same_index_source(hero_root, ("idle", "walk"), direction, index)
                    else:
                        source = previous_good(frames, index)
                        if source is None:
                            source = same_index_source(hero_root, ("idle", "walk", "run"), direction, index)
                    if source is None:
                        raise RuntimeError(f"No same-hero source frame for {frame.relative_to(ROOT)}")
                    copyfile(source, frame)
                    replacements.append((str(frame.relative_to(ROOT)), str(source.relative_to(ROOT)), anim))
    return replacements


if __name__ == "__main__":
    replacements = repair()
    print(f"replaced {len(replacements)} playable hero placeholder frames")
    by_anim: dict[str, int] = {}
    for _, _, anim in replacements:
        by_anim[anim] = by_anim.get(anim, 0) + 1
    for anim, count in sorted(by_anim.items()):
        print(f"  {anim}: {count}")

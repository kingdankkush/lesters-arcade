#!/usr/bin/env python
"""Build reference-first Lester/Lilly runtime animation packs from canonical art.

The existing hmh-animated-roster entries for Lester/Lilly were useful for coverage,
but Lester's older runtime look drifted from Justin's blue-mask reference. This
script rebuilds the playable unlockable rows from repo-local canonical art under
apps/portal/assets/generated/hmh-canonical-art/{lester,lilly} and writes them into
the runtime animated roster tree with all required states and 8 directions.

No network/API calls. Deterministic local transforms only. Final art can still be
hand-polished in Aseprite/PixelLab, but the live runtime now stays reference-first.
"""
from __future__ import annotations

import json
import re
import shutil
from pathlib import Path
from typing import Any

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageOps

ROOT = Path(__file__).resolve().parents[1]
PORTAL = ROOT / "apps/portal"
CANON_ROOT = PORTAL / "assets/generated/hmh-canonical-art"
ROSTER_ROOT = PORTAL / "assets/generated/hmh-animated-roster"
LEDGER = ROSTER_ROOT / "roster-ledger.json"
DIRECTIONS = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"]
WESTISH = {"west", "north-west", "south-west"}
REQUIRED = ["idle", "walk", "run", "shoot", "melee", "throw", "hurt", "death"]


def runtime_path(path: Path) -> str:
    return "./" + path.relative_to(PORTAL).as_posix()


def canon_files(actor: str, state: str) -> list[Path]:
    directory = CANON_ROOT / actor / state
    return sorted(directory.glob("*.png")) if directory.exists() else []


def open_rgba(path: Path) -> Image.Image:
    with Image.open(path) as img:
        return img.convert("RGBA")


def direction_transform(img: Image.Image, direction: str) -> Image.Image:
    out = ImageOps.mirror(img) if direction in WESTISH else img.copy()
    # Slight value shifts help diagonals/north read as different facings without
    # changing the canonical silhouette or palette identity.
    if direction.startswith("north") or direction == "north":
        rgb = ImageEnhance.Brightness(out.convert("RGB")).enhance(0.92).convert("RGBA")
        rgb.putalpha(out.getchannel("A"))
        out = rgb
    elif direction.startswith("south") or direction == "south":
        rgb = ImageEnhance.Brightness(out.convert("RGB")).enhance(1.02).convert("RGBA")
        rgb.putalpha(out.getchannel("A"))
        out = rgb
    return out


def translate(img: Image.Image, dx: int, dy: int) -> Image.Image:
    return ImageChops.offset(img, dx, dy)


def tint(img: Image.Image, color: tuple[int, int, int], alpha: int) -> Image.Image:
    overlay = Image.new("RGBA", img.size, (*color, alpha))
    mask = img.getchannel("A")
    out = img.copy()
    out.alpha_composite(Image.composite(overlay, Image.new("RGBA", img.size, (0, 0, 0, 0)), mask))
    return out


def fade(img: Image.Image, i: int, n: int) -> Image.Image:
    out = translate(img, i // 2, i + 1)
    rgb = ImageEnhance.Brightness(out.convert("RGB")).enhance(max(0.45, 1.0 - i * 0.07)).convert("RGBA")
    a = out.getchannel("A").point(lambda p: int(p * max(0.28, 1.0 - i * 0.085)))
    rgb.putalpha(a)
    return rgb


def draw_muzzle(img: Image.Image, direction: str, i: int) -> Image.Image:
    out = img.copy()
    if i not in (1, 2, 3):
        return out
    draw = ImageDraw.Draw(out, "RGBA")
    w, h = out.size
    anchors = {
        "east": (0.72, 0.54, 1, 0), "south-east": (0.69, 0.60, 1, 1), "south": (0.58, 0.67, 0, 1),
        "south-west": (0.31, 0.60, -1, 1), "west": (0.28, 0.54, -1, 0), "north-west": (0.32, 0.46, -1, -1),
        "north": (0.50, 0.40, 0, -1), "north-east": (0.68, 0.46, 1, -1),
    }
    ax, ay, vx, vy = anchors[direction]
    x, y = int(w * ax), int(h * ay)
    length = max(6, min(w, h) // 9)
    draw.line([(x, y), (x + vx * length, y + vy * length)], fill=(255, 232, 92, 230), width=max(1, min(w, h) // 38))
    r = max(2, min(w, h) // 32)
    draw.ellipse([x + vx * length - r, y + vy * length - r, x + vx * length + r, y + vy * length + r], fill=(255, 142, 36, 190))
    return out


def draw_throw(img: Image.Image, direction: str, i: int) -> Image.Image:
    out = translate(img, 0, -1 if i in (1, 2) else 0)
    if i not in (2, 3, 4):
        return out
    draw = ImageDraw.Draw(out, "RGBA")
    w, h = out.size
    anchors = {
        "east": (0.66, 0.43, 1, 0), "south-east": (0.63, 0.48, 1, 1), "south": (0.54, 0.55, 0, 1),
        "south-west": (0.37, 0.48, -1, 1), "west": (0.34, 0.43, -1, 0), "north-west": (0.39, 0.37, -1, -1),
        "north": (0.50, 0.32, 0, -1), "north-east": (0.61, 0.37, 1, -1),
    }
    ax, ay, vx, vy = anchors[direction]
    x = int(w * ax + vx * i * 2)
    y = int(h * ay + vy * i * 2)
    r = max(2, min(w, h) // 36)
    draw.ellipse([x - r, y - r, x + r, y + r], fill=(84, 145, 76, 235), outline=(24, 44, 28, 235))
    return out


def normalize_sequence(files: list[Path], count: int) -> list[Image.Image]:
    if not files:
        raise FileNotFoundError("missing canonical source frames")
    imgs = [open_rgba(path) for path in files]
    out = []
    for i in range(count):
        idx = min(len(imgs) - 1, round(i * (len(imgs) - 1) / max(1, count - 1)))
        out.append(imgs[idx].copy())
    return out


def source_for(actor: str, target_state: str) -> tuple[str, int]:
    if target_state in ("idle", "walk", "run"):
        files = canon_files(actor, target_state)
        if files:
            return target_state, min(12, max(7, len(files)))
    if target_state == "shoot":
        if canon_files(actor, "shoot"):
            return "shoot", 7
        return "attack", 7
    if target_state == "melee":
        if canon_files(actor, "melee"):
            return "melee", 7
        return "attack", 7
    if target_state == "throw":
        return "melee" if canon_files(actor, "melee") else ("attack" if canon_files(actor, "attack") else "idle"), 7
    if target_state == "hurt":
        return "idle", 7
    if target_state == "death":
        return "idle", 7
    return "idle", 7


def build_state_frames(actor: str, state: str, direction: str) -> list[Image.Image]:
    source_state, count = source_for(actor, state)
    files = canon_files(actor, source_state)
    if not files and source_state == "shoot":
        files = canon_files(actor, "attack")
    if not files:
        files = canon_files(actor, "idle")
    seq = normalize_sequence(files, count)
    transformed = []
    for i, img in enumerate(seq):
        out = direction_transform(img, direction)
        if state == "shoot":
            out = draw_muzzle(out, direction, i)
        elif state == "throw":
            out = draw_throw(out, direction, i)
        elif state == "hurt":
            out = tint(translate(out, [-1, 1, -2, 2, 0, 1, -1][i % 7], 0), (255, 58, 58), 54)
        elif state == "death":
            out = fade(tint(out, (150, 40, 35), 28), i, len(seq))
        transformed.append(out)
    return transformed


def write_actor(actor: str) -> dict[str, dict[str, list[str]]]:
    # Clear only the canonical playable states for this actor; leave any extra raw dirs alone.
    animations: dict[str, dict[str, list[str]]] = {}
    for state in REQUIRED:
        state_root = ROSTER_ROOT / actor / state
        if state_root.exists():
            shutil.rmtree(state_root)
        for direction in DIRECTIONS:
            out_dir = state_root / direction
            out_dir.mkdir(parents=True, exist_ok=True)
            paths = []
            for i, img in enumerate(build_state_frames(actor, state, direction)):
                out = out_dir / f"{i:02d}.png"
                img.save(out, optimize=True)
                paths.append(runtime_path(out))
            animations.setdefault(state, {})[direction] = paths
    return animations


def main() -> None:
    ledger = json.loads(LEDGER.read_text(encoding="utf-8"))
    for actor in ["lester", "lilly"]:
        ledger.setdefault(actor, {"role": "hero", "character_id": f"canonical-{actor}", "animations": {}})
        ledger[actor]["role"] = "hero"
        ledger[actor]["character_id"] = f"canonical-reference-{actor}"
        ledger[actor]["source"] = "reference-first canonical actor frames; generated by scripts/build-hmh-playable-reference-runtime-pack.py"
        ledger[actor]["animations"] = write_actor(actor)
    LEDGER.write_text(json.dumps(ledger, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({actor: {state: {d: len(ledger[actor]['animations'][state][d]) for d in DIRECTIONS} for state in REQUIRED} for actor in ["lester", "lilly"]}, indent=2))


if __name__ == "__main__":
    main()

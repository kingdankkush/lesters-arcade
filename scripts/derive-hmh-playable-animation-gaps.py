#!/usr/bin/env python
"""Derive missing playable-character animation frames for HMH runtime coverage.

This is a deterministic, local, no-network completion pass for playable runtime
coverage. It fills missing directions/states from the same character's existing
frames using conservative transforms/overlays so the renderer never blanks or
falls back to the wrong playable design while final Aseprite/PixelLab polish can
continue.

Generated frames are written under:
  apps/portal/assets/generated/hmh-animated-roster/<character>/<state>/<direction>/

Then roster-ledger.json is updated. Run consolidate-hmh-roster-directions.py build
afterwards to regenerate hmh-animated-roster.mjs.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUT_ROOT = ROOT / "apps/portal/assets/generated/hmh-animated-roster"
LEDGER = OUT_ROOT / "roster-ledger.json"

DIRECTIONS = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"]
REQUIRED = ["idle", "walk", "run", "shoot", "melee", "throw", "hurt", "death"]
MIRROR = {
    "east": "west",
    "west": "east",
    "north-east": "north-west",
    "north-west": "north-east",
    "south-east": "south-west",
    "south-west": "south-east",
}


def rel_to_abs(src: str) -> Path:
    clean = src.replace("./", "", 1)
    # Runtime paths are relative to apps/portal.
    return ROOT / "apps/portal" / clean


def abs_to_runtime(path: Path) -> str:
    rel = path.relative_to(ROOT / "apps/portal").as_posix()
    return f"./{rel}"


def load_frame(src: str) -> Image.Image:
    with Image.open(rel_to_abs(src)) as img:
        return img.convert("RGBA")


def save_frame(img: Image.Image, character: str, state: str, direction: str, index: int) -> str:
    out_dir = OUT_ROOT / character / state / direction
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f"{index:02d}.png"
    # Avoid palette surprises; keep transparent PNGs stable.
    img.save(out, optimize=True)
    return abs_to_runtime(out)


def get_frames(ledger: dict[str, Any], character: str, state: str, direction: str) -> list[str]:
    return list(ledger.get(character, {}).get("animations", {}).get(state, {}).get(direction, []) or [])


def set_frames(ledger: dict[str, Any], character: str, state: str, direction: str, frames: list[str]) -> None:
    ledger[character]["animations"].setdefault(state, {})[direction] = frames


def first_existing_frames(ledger: dict[str, Any], character: str, state_candidates: list[str], direction: str) -> list[str]:
    for state in state_candidates:
        frames = get_frames(ledger, character, state, direction)
        if frames:
            return frames
    mirror_dir = MIRROR.get(direction)
    if mirror_dir:
        for state in state_candidates:
            frames = get_frames(ledger, character, state, mirror_dir)
            if frames:
                return frames
    for state in state_candidates:
        for fallback_dir in DIRECTIONS:
            frames = get_frames(ledger, character, state, fallback_dir)
            if frames:
                return frames
    return []


def maybe_mirror(img: Image.Image, source_direction: str | None, target_direction: str) -> Image.Image:
    if source_direction and MIRROR.get(target_direction) == source_direction:
        return ImageOps.mirror(img)
    return img.copy()


def detect_source_direction(ledger: dict[str, Any], character: str, state_candidates: list[str], target_direction: str, src_frames: list[str]) -> str | None:
    if not src_frames:
        return None
    needle = src_frames[0]
    for state in state_candidates:
        for direction, frames in ledger.get(character, {}).get("animations", {}).get(state, {}).items():
            if frames and frames[0] == needle:
                return direction
    return None


def translate(img: Image.Image, dx: int, dy: int) -> Image.Image:
    return ImageChops.offset(img, dx, dy)


def alpha_composite_tint(img: Image.Image, color: tuple[int, int, int], alpha: int) -> Image.Image:
    tinted = Image.new("RGBA", img.size, (*color, alpha))
    mask = img.getchannel("A")
    out = img.copy()
    out.alpha_composite(Image.composite(tinted, Image.new("RGBA", img.size, (0, 0, 0, 0)), mask))
    return out


def darken(img: Image.Image, factor: float) -> Image.Image:
    rgb = img.convert("RGB")
    rgb = ImageEnhance.Brightness(rgb).enhance(factor)
    out = rgb.convert("RGBA")
    out.putalpha(img.getchannel("A"))
    return out


def fade_alpha(img: Image.Image, factor: float) -> Image.Image:
    out = img.copy()
    a = out.getchannel("A").point(lambda p: int(p * factor))
    out.putalpha(a)
    return out


def draw_muzzle_flash(img: Image.Image, direction: str, frame_index: int) -> Image.Image:
    out = img.copy()
    draw = ImageDraw.Draw(out, "RGBA")
    w, h = out.size
    # Approximate actor center/barrel positions for 96-128 px sprite canvases and larger.
    anchors = {
        "east": (0.64, 0.53, 1, 0),
        "south-east": (0.63, 0.60, 1, 1),
        "south": (0.55, 0.68, 0, 1),
        "south-west": (0.37, 0.60, -1, 1),
        "west": (0.36, 0.53, -1, 0),
        "north-west": (0.39, 0.45, -1, -1),
        "north": (0.50, 0.39, 0, -1),
        "north-east": (0.61, 0.45, 1, -1),
    }
    ax, ay, vx, vy = anchors[direction]
    x = int(w * ax)
    y = int(h * ay)
    length = max(5, min(w, h) // 13)
    if frame_index in (1, 2, 3):
        draw.line([(x, y), (x + vx * length, y + vy * length)], fill=(255, 232, 92, 210), width=max(1, min(w, h) // 48))
        r = max(2, min(w, h) // 36)
        draw.ellipse([x + vx * length - r, y + vy * length - r, x + vx * length + r, y + vy * length + r], fill=(255, 160, 45, 185))
    return out


def draw_melee_arc(img: Image.Image, direction: str, frame_index: int) -> Image.Image:
    out = img.copy()
    draw = ImageDraw.Draw(out, "RGBA")
    w, h = out.size
    cx, cy = int(w * 0.5), int(h * 0.56)
    radius = max(10, min(w, h) // 5)
    angles = {
        "east": (-35, 45),
        "south-east": (5, 95),
        "south": (45, 135),
        "south-west": (85, 175),
        "west": (135, 225),
        "north-west": (185, 275),
        "north": (225, 315),
        "north-east": (275, 365),
    }
    if frame_index in (1, 2, 3, 4):
        start, end = angles[direction]
        box = [cx - radius, cy - radius, cx + radius, cy + radius]
        draw.arc(box, start=start, end=end, fill=(220, 235, 242, 220), width=max(2, min(w, h) // 36))
    return out


def draw_throw_cue(img: Image.Image, direction: str, frame_index: int) -> Image.Image:
    out = img.copy()
    draw = ImageDraw.Draw(out, "RGBA")
    w, h = out.size
    anchors = {
        "east": (0.61, 0.45, 1, 0),
        "south-east": (0.60, 0.50, 1, 1),
        "south": (0.54, 0.58, 0, 1),
        "south-west": (0.40, 0.50, -1, 1),
        "west": (0.39, 0.45, -1, 0),
        "north-west": (0.42, 0.39, -1, -1),
        "north": (0.50, 0.34, 0, -1),
        "north-east": (0.58, 0.39, 1, -1),
    }
    ax, ay, vx, vy = anchors[direction]
    if frame_index in (2, 3, 4):
        x = int(w * ax + vx * frame_index * 2)
        y = int(h * ay + vy * frame_index * 2)
        r = max(2, min(w, h) // 45)
        draw.ellipse([x - r, y - r, x + r, y + r], fill=(83, 145, 80, 230), outline=(24, 44, 28, 230))
    return out


def derive_sequence(base_frames: list[str], target_count: int, transform) -> list[Image.Image]:
    if not base_frames:
        return []
    images = [load_frame(src) for src in base_frames]
    out: list[Image.Image] = []
    for i in range(target_count):
        src = images[min(len(images) - 1, round(i * (len(images) - 1) / max(1, target_count - 1)))]
        out.append(transform(src.copy(), i, target_count))
    return out


def fill_from_mirror(ledger: dict[str, Any], character: str, state: str, target_dir: str) -> int:
    source_dir = MIRROR.get(target_dir)
    if not source_dir:
        return 0
    source = get_frames(ledger, character, state, source_dir)
    if not source:
        return 0
    generated = []
    for i, src in enumerate(source):
        generated.append(save_frame(ImageOps.mirror(load_frame(src)), character, state, target_dir, i))
    set_frames(ledger, character, state, target_dir, generated)
    return len(generated)


def fill_commando(ledger: dict[str, Any]) -> int:
    written = 0
    if not get_frames(ledger, "lit-commando", "shoot", "south-east"):
        written += fill_from_mirror(ledger, "lit-commando", "shoot", "south-east")
    if not get_frames(ledger, "lit-commando", "hurt", "north"):
        base = first_existing_frames(ledger, "lit-commando", ["idle", "walk"], "north")
        seq = derive_sequence(base, 7, lambda img, i, n: alpha_composite_tint(translate(img, (-1 if i % 2 else 1), 0), (255, 58, 58), 46))
        frames = [save_frame(img, "lit-commando", "hurt", "north", i) for i, img in enumerate(seq)]
        set_frames(ledger, "lit-commando", "hurt", "north", frames)
        written += len(frames)
    for direction in DIRECTIONS:
        if get_frames(ledger, "lit-commando", "death", direction):
            continue
        base = first_existing_frames(ledger, "lit-commando", ["hurt", "idle"], direction)
        source_direction = detect_source_direction(ledger, "lit-commando", ["hurt", "idle"], direction, base)
        seq = derive_sequence(base, 7, lambda img, i, n, sd=source_direction, td=direction: fade_alpha(darken(translate(maybe_mirror(img, sd, td), i // 2, i + 1), 1.0 - i * 0.07), max(0.35, 1.0 - i * 0.08)))
        frames = [save_frame(img, "lit-commando", "death", direction, i) for i, img in enumerate(seq)]
        set_frames(ledger, "lit-commando", "death", direction, frames)
        written += len(frames)
    return written


def fill_valkyrie(ledger: dict[str, Any]) -> int:
    if get_frames(ledger, "lit-valkyrie", "death", "north-west"):
        return 0
    return fill_from_mirror(ledger, "lit-valkyrie", "death", "north-west")


def fill_lester(ledger: dict[str, Any]) -> int:
    written = 0
    state_sources = {
        "run": ["walk"],
        "shoot": ["idle", "walk"],
        "melee": ["idle", "walk"],
        "throw": ["idle", "walk"],
        "hurt": ["idle", "walk"],
        "death": ["hurt", "idle", "walk"],
    }
    for state, sources in state_sources.items():
        for direction in DIRECTIONS:
            if get_frames(ledger, "lester", state, direction):
                continue
            base = first_existing_frames(ledger, "lester", sources, direction)
            source_direction = detect_source_direction(ledger, "lester", sources, direction, base)
            target_count = 7
            def transform(img: Image.Image, i: int, n: int, st=state, sd=source_direction, td=direction) -> Image.Image:
                img = maybe_mirror(img, sd, td)
                if st == "run":
                    # Walk-derived run: stronger bob/stride and slightly higher contrast.
                    img = translate(img, 0, -1 if i in (1, 2, 5) else (1 if i in (3, 6) else 0))
                    rgb = ImageEnhance.Contrast(img.convert("RGB")).enhance(1.08).convert("RGBA")
                    rgb.putalpha(img.getchannel("A"))
                    return rgb
                if st == "shoot":
                    return draw_muzzle_flash(translate(img, -1 if i in (1, 2) else 0, 0), td, i)
                if st == "melee":
                    return draw_melee_arc(translate(img, 1 if i in (2, 3) else 0, 0), td, i)
                if st == "throw":
                    return draw_throw_cue(translate(img, 0, -2 if i in (1, 2) else 0), td, i)
                if st == "hurt":
                    return alpha_composite_tint(translate(img, (-2, 2, -1, 1, 0, 1, -1)[i % 7], 0), (255, 58, 58), 52)
                if st == "death":
                    return fade_alpha(darken(translate(img, i // 2, i + 1), 1.0 - i * 0.075), max(0.35, 1.0 - i * 0.08))
                return img
            seq = derive_sequence(base, target_count, transform)
            frames = [save_frame(img, "lester", state, direction, i) for i, img in enumerate(seq)]
            set_frames(ledger, "lester", state, direction, frames)
            written += len(frames)
    return written


def summarize(ledger: dict[str, Any]) -> dict[str, Any]:
    summary = {}
    for character in ["lit-commando", "lit-valkyrie", "lester", "lilly"]:
        anims = ledger[character]["animations"]
        summary[character] = {}
        for state in REQUIRED:
            summary[character][state] = {direction: len(anims.get(state, {}).get(direction, []) or []) for direction in DIRECTIONS}
    return summary


def main() -> None:
    ledger = json.loads(LEDGER.read_text(encoding="utf-8"))
    before = summarize(ledger)
    written = 0
    written += fill_commando(ledger)
    written += fill_valkyrie(ledger)
    written += fill_lester(ledger)
    LEDGER.write_text(json.dumps(ledger, indent=2) + "\n", encoding="utf-8")
    after = summarize(ledger)
    print(json.dumps({"framesWritten": written, "before": before, "after": after}, indent=2))


if __name__ == "__main__":
    main()

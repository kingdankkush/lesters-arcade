#!/usr/bin/env python3
"""Generate disk-backed native animation matrices for critical HMH runtime actors.

This is a repo-owned deterministic fallback art pass for actors that were still
zero-animation or critical-partial in the Level-1 runtime scope. It intentionally
writes transparent PNG frame matrices under the canonical hmh-animated-roster
folder so `rebuild-hmh-animated-roster-from-disk.py` can emit truthful manifest
coverage.
"""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ROSTER = ROOT / "apps/portal/assets/generated/hmh-animated-roster"
LEDGER = ROSTER / "roster-ledger.json"
PROOF_DIR = ROOT / "docs/game-design/hmh-critical-native-animation-pass"

DIRECTIONS = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"]
STATE_FRAME_COUNTS = {
    "idle": 8,
    "walk": 8,
    "run": 8,
    "attack-tell": 8,
    "attack": 8,
    "hit": 6,
    "death": 8,
    "spawn-in": 6,
    "enrage": 6,
    "special": 8,
    "phase-transition": 6,
}

ACTORS = {
    "bit-whale-boss": {
        "role": "boss",
        "character_id": "critical-native-bit-whale-boss-v1",
        "states": ["idle", "walk", "run", "attack-tell", "attack", "hit", "death", "spawn-in", "special", "phase-transition"],
        "palette": ["#173B72", "#345D9D", "#4E82D8", "#8CB7FF", "#C9D2DE", "#F1D37A", "#0B0F1A"],
        "motif": "whale",
    },
    "chain-reaper-boss": {
        "role": "boss",
        "character_id": "critical-native-chain-reaper-boss-v1",
        "states": ["idle", "walk", "run", "attack-tell", "attack", "hit", "death", "spawn-in", "special", "phase-transition"],
        "palette": ["#0B0F1A", "#222A3A", "#3A465C", "#8CB7FF", "#E8ECF2", "#E040A0", "#F1D37A"],
        "motif": "reaper",
    },
    "rugpull-summoner": {
        "role": "enemy",
        "character_id": "critical-native-rugpull-summoner-v1",
        "states": ["idle", "walk", "run", "attack-tell", "attack", "hit", "death", "spawn-in"],
        "palette": ["#4B1844", "#992B78", "#E040A0", "#F1D37A", "#C9A34E", "#141A2A", "#E8ECF2"],
        "motif": "summoner",
    },
    "warren-spear-rider": {
        "role": "miniboss",
        "character_id": "critical-native-warren-spear-rider-v1",
        "states": ["idle", "walk", "run", "attack-tell", "attack", "hit", "death", "spawn-in", "enrage"],
        "palette": ["#B07A3D", "#6A3D22", "#D8C28A", "#E8ECF2", "#345D9D", "#F1D37A", "#0B0F1A"],
        "motif": "rider",
    },
    "whale-dumper-boss": {
        "role": "boss",
        "character_id": "critical-native-whale-dumper-boss-completion-v1",
        "states": ["idle", "walk", "run", "attack-tell", "attack", "hit", "death", "spawn-in", "special", "phase-transition"],
        "palette": ["#173B72", "#345D9D", "#4E82D8", "#8CB7FF", "#C9D2DE", "#F1D37A", "#0B0F1A"],
        "motif": "whale",
    },
    "bridge-exploiter": {
        "role": "miniboss",
        "character_id": "critical-native-bridge-exploiter-completion-v1",
        "states": ["idle", "walk", "run", "attack-tell", "attack", "hit", "death", "spawn-in", "enrage"],
        "palette": ["#3A465C", "#5C6B80", "#C9D2DE", "#F1D37A", "#C9A34E", "#173B72", "#0B0F1A"],
        "motif": "bridge",
    },
    "plaza-warden": {
        "role": "miniboss",
        "character_id": "critical-native-plaza-warden-completion-v1",
        "states": ["idle", "walk", "run", "attack-tell", "attack", "hit", "death", "spawn-in", "enrage"],
        "palette": ["#222A3A", "#3A465C", "#8CB7FF", "#E8ECF2", "#F1D37A", "#E040A0", "#0B0F1A"],
        "motif": "warden",
    },
    "the-obfuscator": {
        "role": "miniboss",
        "character_id": "critical-native-obfuscator-completion-v1",
        "states": ["idle", "walk", "run", "attack-tell", "attack", "hit", "death", "spawn-in", "enrage"],
        "palette": ["#141A2A", "#222A3A", "#4B1844", "#992B78", "#8CB7FF", "#E8ECF2", "#F1D37A"],
        "motif": "obfuscator",
    },
}

# Master-palette colours only, to satisfy Sprite QA palette threshold.
TRANSPARENT = (0, 0, 0, 0)


def hex_rgba(hex_color: str, alpha: int = 255) -> tuple[int, int, int, int]:
    clean = hex_color.lstrip("#")
    return (int(clean[0:2], 16), int(clean[2:4], 16), int(clean[4:6], 16), alpha)


def draw_pixel_rect(draw: ImageDraw.ImageDraw, x: float, y: float, w: float, h: float, color: tuple[int, int, int, int]) -> None:
    x0 = round(x)
    y0 = round(y)
    x1 = round(x + w)
    y1 = round(y + h)
    draw.rectangle([min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)], fill=color)


def draw_diamond(draw: ImageDraw.ImageDraw, cx: float, cy: float, rx: float, ry: float, color: tuple[int, int, int, int]) -> None:
    draw.polygon([
        (round(cx), round(cy - ry)),
        (round(cx + rx), round(cy)),
        (round(cx), round(cy + ry)),
        (round(cx - rx), round(cy)),
    ], fill=color)


def actor_scale(actor: str) -> float:
    if "boss" in actor:
        return 1.18
    if actor in {"warren-spear-rider", "bridge-exploiter", "plaza-warden", "the-obfuscator"}:
        return 1.04
    return 0.92


def direction_offsets(direction: str) -> tuple[int, int]:
    return {
        "south": (0, 2), "south-east": (3, 1), "east": (4, 0), "north-east": (3, -1),
        "north": (0, -2), "north-west": (-3, -1), "west": (-4, 0), "south-west": (-3, 1),
    }[direction]


def state_pose(state: str, frame: int, frame_count: int) -> tuple[float, float, float, float]:
    t = frame / max(1, frame_count - 1)
    wave = math.sin(t * math.tau)
    bob = {
        "idle": wave * 1.0,
        "walk": abs(wave) * 2.0,
        "run": abs(wave) * 3.0,
        "attack-tell": -2.0 - t * 3.0,
        "attack": -2.0 + math.sin(t * math.pi) * 5.0,
        "hit": -1.5,
        "death": t * 10.0,
        "spawn-in": (1 - t) * 7.0,
        "enrage": wave * 2.0,
        "special": math.sin(t * math.pi) * 3.0,
        "phase-transition": wave * 2.5,
    }.get(state, 0.0)
    reach = {
        "attack-tell": t * 2.0,
        "attack": math.sin(t * math.pi) * 9.0,
        "special": math.sin(t * math.pi) * 12.0,
        "enrage": 4.0 + abs(wave) * 4.0,
    }.get(state, 0.0)
    squash = 1.0
    alpha = 1.0
    if state == "death":
        squash = 1.0 - 0.22 * t
        alpha = 1.0 - 0.45 * t
    if state == "spawn-in":
        alpha = 0.45 + 0.55 * t
    if state == "hit":
        squash = 0.96
    return bob, reach, squash, alpha


def draw_actor_frame(actor: str, spec: dict, state: str, direction: str, frame: int, frame_count: int) -> Image.Image:
    img = Image.new("RGBA", (96, 96), TRANSPARENT)
    d = ImageDraw.Draw(img)
    pal = [hex_rgba(c) for c in spec["palette"]]
    dark, mid, bright, hi, silver, gold, outline = pal[0], pal[1], pal[2], pal[3], pal[4], pal[5], pal[6]
    dx, dy = direction_offsets(direction)
    bob, reach, squash, alpha = state_pose(state, frame, frame_count)
    opacity = int(255 * alpha)
    dark = (*dark[:3], opacity); mid = (*mid[:3], opacity); bright = (*bright[:3], opacity); hi = (*hi[:3], opacity); silver = (*silver[:3], opacity); gold = (*gold[:3], opacity); outline = (*outline[:3], opacity)
    scale = actor_scale(actor)
    cx = 48 + dx
    base = 75 + dy + bob
    body_h = 34 * scale * squash
    body_w = 22 * scale
    head_r = 9 * scale

    # Shadow/contact pad keeps pivots stable and connected.
    d.ellipse([round(cx - 17 * scale), round(78), round(cx + 17 * scale), round(86)], fill=(11, 15, 26, 150))

    # Legs / lower mass.
    draw_pixel_rect(d, cx - 10 * scale, base - 17 * scale, 7 * scale, 18 * scale, outline)
    draw_pixel_rect(d, cx + 3 * scale, base - 17 * scale, 7 * scale, 18 * scale, outline)
    gait = math.sin((frame / max(1, frame_count)) * math.tau)
    if state in {"walk", "run"}:
        draw_pixel_rect(d, cx - 12 * scale, base - 3 + gait * 2, 10 * scale, 4 * scale, mid)
        draw_pixel_rect(d, cx + 2 * scale, base - 3 - gait * 2, 10 * scale, 4 * scale, mid)

    # Torso as connected diamond/rectangle mass.
    draw_diamond(d, cx, base - body_h * 0.74, body_w * 0.86, body_h * 0.64, outline)
    draw_diamond(d, cx, base - body_h * 0.76, body_w * 0.70, body_h * 0.50, mid)
    draw_pixel_rect(d, cx - 5 * scale, base - body_h - 2, 10 * scale, 4 * scale, bright)

    # Head / visor.
    d.ellipse([round(cx - head_r), round(base - body_h - head_r * 1.8), round(cx + head_r), round(base - body_h + head_r * 0.2)], fill=outline)
    d.ellipse([round(cx - head_r + 2), round(base - body_h - head_r * 1.65), round(cx + head_r - 2), round(base - body_h),], fill=dark)
    draw_pixel_rect(d, cx - 5 * scale + dx * 0.25, base - body_h - head_r, 10 * scale, 3 * scale, hi)

    # Actor-specific silhouettes, kept connected to torso to avoid stray islands.
    motif = spec["motif"]
    side = 1 if direction in {"east", "south-east", "north-east"} else -1 if direction in {"west", "south-west", "north-west"} else 0
    side = side or (1 if frame % 2 == 0 else -1)
    arm_y = base - body_h * 0.76
    if motif == "whale":
        # Whale-fin/market-dump bulk with coin spill shoulder.
        draw_pixel_rect(d, cx - 22 * scale, arm_y - 2, 44 * scale, 8 * scale, mid)
        draw_diamond(d, cx + side * (21 * scale + reach * 0.35), arm_y - 1, 9 * scale, 6 * scale, bright)
        draw_pixel_rect(d, cx - 6, base - body_h - 15, 12, 3, silver)
        if state in {"special", "phase-transition", "death"}:
            draw_pixel_rect(d, cx - 15, arm_y + 8, 30, 4, gold)
    elif motif == "reaper":
        draw_pixel_rect(d, cx - side * 4, arm_y - 5, side * (24 + reach), 4 * scale, silver)
        draw_diamond(d, cx + side * (25 + reach), arm_y - 9, 8 * scale, 13 * scale, hi)
        draw_pixel_rect(d, cx - 15 * scale, base - body_h + 2, 30 * scale, 5 * scale, dark)
    elif motif == "rider":
        draw_pixel_rect(d, cx - 21 * scale, base - 25 * scale, 42 * scale, 10 * scale, mid)
        draw_pixel_rect(d, cx + side * 8, arm_y - 11, side * (28 + reach), 3 * scale, silver)
        draw_diamond(d, cx + side * (36 + reach), arm_y - 11, 5 * scale, 5 * scale, gold)
    elif motif == "bridge":
        draw_pixel_rect(d, cx - 18 * scale, arm_y + 3, 36 * scale, 6 * scale, silver)
        draw_pixel_rect(d, cx + side * (13 + reach), arm_y - 8, 8 * scale, 18 * scale, gold)
    elif motif == "warden":
        draw_pixel_rect(d, cx - 20 * scale, arm_y - 4, 40 * scale, 6 * scale, silver)
        draw_diamond(d, cx + side * (18 + reach * 0.5), arm_y - 2, 9 * scale, 15 * scale, hi)
    elif motif == "obfuscator":
        draw_pixel_rect(d, cx - 17 * scale, arm_y + 8, 34 * scale, 5 * scale, dark)
        draw_diamond(d, cx + side * (16 + reach * 0.7), arm_y - 6, 8 * scale, 8 * scale, hi)
        if state in {"attack-tell", "attack", "enrage"}:
            draw_pixel_rect(d, cx - 12, arm_y - 17, 24, 3, bright)
    else:
        draw_pixel_rect(d, cx - 18 * scale, arm_y, 36 * scale, 5 * scale, bright)

    # State telegraph overlays are connected by one pixel/bar to body.
    if state == "attack-tell":
        draw_pixel_rect(d, cx - 15, base - body_h - 21, 30, 3, gold)
        draw_pixel_rect(d, cx - 2, base - body_h - 20, 4, 9, gold)
    elif state == "hit":
        draw_pixel_rect(d, cx - 18, base - body_h - 8, 36, 5, hi)
    elif state == "enrage":
        draw_pixel_rect(d, cx - 18, base - body_h - 21, 36, 5, hex_rgba("#E040A0", opacity))
        draw_pixel_rect(d, cx - 2, base - body_h - 18, 4, 12, hex_rgba("#E040A0", opacity))
    elif state == "phase-transition":
        draw_pixel_rect(d, cx - 23, base - body_h - 18, 46, 4, hi)
        draw_pixel_rect(d, cx - 17, base - body_h - 24, 34, 3, gold)
    elif state == "spawn-in":
        draw_pixel_rect(d, cx - 14, base - 1, 28, 3, hi)
    elif state == "death":
        # Keep the component connected while showing collapse.
        draw_pixel_rect(d, cx - 19, base - 8 + frame, 38, 5, mid)

    return img


def write_actor(actor: str, spec: dict) -> int:
    count = 0
    for state in spec["states"]:
        frames = STATE_FRAME_COUNTS[state]
        for direction in DIRECTIONS:
            out_dir = ROSTER / actor / state / direction
            out_dir.mkdir(parents=True, exist_ok=True)
            for i in range(frames):
                out_path = out_dir / f"{i:02d}.png"
                if out_path.exists():
                    continue
                img = draw_actor_frame(actor, spec, state, direction, i, frames)
                img.save(out_path)
                count += 1
    return count


def main() -> None:
    ledger = json.loads(LEDGER.read_text(encoding="utf-8")) if LEDGER.exists() else {}
    written = {}
    for actor, spec in ACTORS.items():
        frames = write_actor(actor, spec)
        prior = ledger.get(actor, {})
        ledger[actor] = {
            **prior,
            "role": spec["role"],
            "character_id": spec["character_id"],
            "animations": prior.get("animations", {}),
        }
        written[actor] = {"role": spec["role"], "states": spec["states"], "frameCount": frames}
    LEDGER.write_text(json.dumps(ledger, indent=2), encoding="utf-8")
    PROOF_DIR.mkdir(parents=True, exist_ok=True)
    (PROOF_DIR / "README.md").write_text(
        "# HMH Critical Native Animation Pass\n\n"
        "Generated by `scripts/generate-hmh-critical-native-animations.py`. "
        "Writes repo-owned transparent PNG matrices into `apps/portal/assets/generated/hmh-animated-roster/` "
        "for the zero-animation and critical partial Level-1 actors. Rebuild the roster manifest with "
        "`python scripts/rebuild-hmh-animated-roster-from-disk.py` after generation.\n\n"
        + "\n".join(f"- `{actor}`: {meta['role']}, {len(meta['states'])} states, {meta['frameCount']} frames" for actor, meta in written.items())
        + "\n",
        encoding="utf-8",
    )
    print(json.dumps({"generatedActors": len(written), "actors": written}, indent=2))


if __name__ == "__main__":
    main()

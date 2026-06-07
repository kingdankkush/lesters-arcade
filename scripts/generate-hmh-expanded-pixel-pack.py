#!/usr/bin/env python
"""Generate deterministic supplemental Hard Money Heroes pixel-art assets.

The repo already has Justin-provided/generated production art. This script adds a
small, original, reproducible pixel pack for achievement badges plus extra
character/enemy/boss/prop/environment placeholders that are intentionally
pixel-snapped and browser-friendly while fuller art is being produced.
"""

from __future__ import annotations

import json
import math
import os
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BADGE_DIR = ROOT / "apps" / "portal" / "assets" / "generated" / "achievement-badges"
PACK_DIR = ROOT / "apps" / "portal" / "assets" / "generated" / "hmh-expanded-pixel-pack"
MANIFEST_PATH = ROOT / "apps" / "portal" / "assets" / "generated" / "hmh-expanded-pixel-pack.mjs"

ACHIEVEMENT_IDS = [
    "cabinet-pioneer", "first-paid-run", "first-1000-points", "first-blood", "ten-enemy-kills",
    "first-grenade-kill", "first-powerup", "beat-level-1-boss", "five-minute-run", "combo-starter",
    "gas-beast-hunter", "goblin-cleanup", "drone-swatter", "grenade-century", "blade-master",
    "hash-rail-specialist", "spread-ltc-specialist", "powerup-collector", "score-5000", "score-10000",
    "boss-breaker", "no-damage-boss", "slums-clear", "foundry-clear", "getaway-clear",
    "big-combo", "damage-chain", "weapon-collector", "lucky-survivor", "ten-paid-runs",
    "master-survivor", "score-25000", "score-50000", "no-damage-10-minutes", "all-bosses-scouted",
    "enemy-reaper-250", "enemy-reaper-500", "grenade-demolitionist", "blade-samurai", "powerup-hoarder",
    "ranked-regular", "boss-rush-ten", "speed-clear", "hard-fork-hero", "max-combo-30",
    "two-hundred-ranked-runs", "two-fifty-ranked-runs", "marathon-wallet", "perfect-boss-gauntlet", "arcade-legend-500",
]

PALETTE = [
    (25, 247, 255, 255), (255, 232, 77, 255), (69, 255, 138, 255),
    (255, 61, 242, 255), (255, 71, 111, 255), (200, 211, 232, 255),
    (123, 47, 255, 255), (255, 123, 47, 255),
]


def ensure_dirs() -> None:
    BADGE_DIR.mkdir(parents=True, exist_ok=True)
    PACK_DIR.mkdir(parents=True, exist_ok=True)


def empty_canvas(width: int, height: int, color=(0, 0, 0, 0)) -> list[list[tuple[int, int, int, int]]]:
    return [[color for _ in range(width)] for _ in range(height)]


def rect(canvas, x, y, w, h, color) -> None:
    height = len(canvas)
    width = len(canvas[0])
    for yy in range(max(0, y), min(height, y + h)):
        row = canvas[yy]
        for xx in range(max(0, x), min(width, x + w)):
            row[xx] = color


def circle(canvas, cx, cy, radius, color) -> None:
    r2 = radius * radius
    for y in range(cy - radius, cy + radius + 1):
        for x in range(cx - radius, cx + radius + 1):
            if (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r2:
                rect(canvas, x, y, 1, 1, color)


def line(canvas, x0, y0, x1, y1, color) -> None:
    dx = abs(x1 - x0)
    dy = -abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx + dy
    x, y = x0, y0
    while True:
        rect(canvas, x, y, 1, 1, color)
        if x == x1 and y == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x += sx
        if e2 <= dx:
            err += dx
            y += sy


def write_png(path: Path, canvas) -> None:
    height = len(canvas)
    width = len(canvas[0])
    raw = bytearray()
    for row in canvas:
        raw.append(0)  # filter type 0
        for pixel in row:
            raw.extend(pixel)
    def chunk(kind: bytes, data: bytes) -> bytes:
        return len(data).to_bytes(4, "big") + kind + data + zlib.crc32(kind + data).to_bytes(4, "big")
    ihdr = width.to_bytes(4, "big") + height.to_bytes(4, "big") + bytes([8, 6, 0, 0, 0])
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(png)


def draw_badge(achievement_id: str, index: int, locked: bool = False):
    c = empty_canvas(48, 48)
    base = PALETTE[index % len(PALETTE)]
    accent = PALETTE[(index + 3) % len(PALETTE)]
    if locked:
        base = (86, 91, 110, 210)
        accent = (155, 160, 176, 220)
    rect(c, 4, 6, 40, 36, (8, 6, 22, 255))
    rect(c, 6, 4, 36, 40, (18, 11, 44, 255))
    rect(c, 8, 8, 32, 32, (*base[:3], 180))
    rect(c, 10, 10, 28, 28, (7, 5, 18, 255))
    circle(c, 24, 24, 12, (*base[:3], 255))
    circle(c, 24, 24, 7, (8, 6, 22, 255))
    symbol = index % 8
    if locked:
        rect(c, 18, 21, 12, 12, accent)
        rect(c, 20, 16, 8, 8, accent)
        rect(c, 22, 18, 4, 5, (8, 6, 22, 255))
    elif symbol == 0:
        rect(c, 20, 13, 8, 24, accent)
        rect(c, 15, 21, 18, 6, accent)
    elif symbol == 1:
        line(c, 15, 32, 33, 14, accent)
        line(c, 16, 33, 34, 15, accent)
    elif symbol == 2:
        rect(c, 14, 16, 20, 8, accent)
        rect(c, 18, 24, 12, 12, accent)
    elif symbol == 3:
        circle(c, 24, 18, 6, accent)
        rect(c, 21, 24, 6, 13, accent)
    elif symbol == 4:
        rect(c, 16, 18, 20, 5, accent)
        rect(c, 16, 28, 20, 5, accent)
        rect(c, 24, 12, 5, 24, accent)
    elif symbol == 5:
        for step in range(0, 16, 3):
            line(c, 16 + step, 34, 25 + step // 2, 13, accent)
    elif symbol == 6:
        rect(c, 15, 29, 18, 5, accent)
        rect(c, 19, 24, 14, 5, accent)
        rect(c, 23, 19, 10, 5, accent)
        rect(c, 27, 14, 6, 5, accent)
    else:
        circle(c, 24, 24, 3, accent)
        circle(c, 16, 18, 3, accent)
        circle(c, 32, 18, 3, accent)
        circle(c, 18, 32, 3, accent)
        circle(c, 30, 32, 3, accent)
    rect(c, 4, 6, 40, 2, accent)
    rect(c, 4, 40, 40, 2, accent)
    rect(c, 4, 6, 2, 36, accent)
    rect(c, 42, 6, 2, 36, accent)
    return c


def draw_character(actor: str, state: str, frame: int):
    c = empty_canvas(64, 64)
    color = (25, 247, 255, 255) if actor == "lester" else (255, 61, 242, 255) if actor == "lilly" else (255, 232, 77, 255)
    accent = (200, 211, 232, 255)
    bob = int(math.sin(frame / 2) * 2)
    stride = (frame % 4) - 1
    rect(c, 27, 14 + bob, 10, 9, accent)
    rect(c, 25, 23 + bob, 14, 19, color)
    rect(c, 20 - stride, 25 + bob, 6, 18, color)
    rect(c, 39 + stride, 25 + bob, 6, 18, color)
    rect(c, 26 + stride, 42 + bob, 6, 16, accent)
    rect(c, 36 - stride, 42 + bob, 6, 16, accent)
    if state == "shoot":
        rect(c, 43, 28 + bob, 13, 4, accent)
        rect(c, 55, 26 + bob, 5, 8, (255, 232, 77, 255))
    if state == "melee":
        line(c, 42, 20 + bob, 58, 36 + bob, (255, 255, 255, 255))
        line(c, 43, 20 + bob, 59, 36 + bob, (255, 123, 47, 255))
    if state == "grenade":
        circle(c, 50, 18 + (frame % 3), 3, (69, 255, 138, 255))
    if state == "hurt":
        rect(c, 18, 18, 8, 8, (255, 71, 111, 255))
    if state == "victory":
        rect(c, 31, 5, 4, 12, (255, 232, 77, 255))
    return c


def draw_enemy(enemy: str, state: str, frame: int):
    c = empty_canvas(48, 48)
    palette = {
        "gas-beast": (69, 255, 138, 255),
        "fud-goblin": (255, 71, 111, 255),
        "sybil-drone": (123, 47, 255, 255),
        "rug-rat": (255, 123, 47, 255),
        "paper-hand": (200, 211, 232, 255),
        "crypto-bro": (255, 232, 77, 255),
    }
    color = palette.get(enemy, (25, 247, 255, 255))
    wobble = int(math.sin(frame) * 2)
    if "drone" in enemy:
        rect(c, 13, 19 + wobble, 22, 11, color)
        rect(c, 8, 17 + wobble, 7, 4, (200, 211, 232, 255))
        rect(c, 34, 17 + wobble, 7, 4, (200, 211, 232, 255))
    else:
        rect(c, 17 + wobble, 13, 14, 13, color)
        rect(c, 14 + wobble, 25, 20, 14, color)
        rect(c, 18 + wobble, 39, 5, 7, (8, 6, 22, 255))
        rect(c, 28 + wobble, 39, 5, 7, (8, 6, 22, 255))
    if state == "attack":
        rect(c, 6, 25, 8, 5, (255, 232, 77, 255))
    if state == "hit":
        rect(c, 9, 9, 30, 8, (255, 255, 255, 180))
    if state == "death":
        rect(c, 12, 34, 27, 5, (255, 71, 111, 255))
    return c


def draw_boss(boss: str, state: str, frame: int):
    c = empty_canvas(80, 80)
    color = PALETTE[(len(boss) + frame) % len(PALETTE)]
    rect(c, 18, 22, 44, 42, color)
    rect(c, 24, 12, 32, 18, (200, 211, 232, 255))
    rect(c, 25, 34, 8, 8, (8, 6, 22, 255))
    rect(c, 47, 34, 8, 8, (8, 6, 22, 255))
    if state == "attack":
        for i in range(4):
            line(c, 16, 45 + i * 3, 3, 40 + i * 5, (255, 232, 77, 255))
    if state == "hurt":
        rect(c, 14, 20, 52, 10, (255, 255, 255, 170))
    if state == "death":
        rect(c, 12, 60, 56, 8, (255, 71, 111, 255))
    return c


def draw_prop(name: str, index: int):
    c = empty_canvas(48, 48)
    color = PALETTE[index % len(PALETTE)]
    if "tree" in name:
        rect(c, 21, 24, 7, 19, (113, 79, 43, 255))
        circle(c, 24, 20, 13, color)
    elif "car" in name:
        rect(c, 8, 24, 34, 12, color)
        rect(c, 16, 16, 18, 9, (25, 247, 255, 190))
        circle(c, 16, 37, 4, (8, 6, 22, 255))
        circle(c, 34, 37, 4, (8, 6, 22, 255))
    elif "building" in name:
        rect(c, 10, 8, 28, 38, (18, 11, 44, 255))
        for y in range(13, 39, 8):
            for x in range(15, 34, 8):
                rect(c, x, y, 4, 4, color)
    else:
        rect(c, 11, 18, 28, 25, color)
        rect(c, 15, 12, 20, 7, (200, 211, 232, 255))
    return c


def rel(path: Path) -> str:
    return "./" + path.relative_to(ROOT / "apps" / "portal").as_posix()


def generate() -> None:
    ensure_dirs()
    badges = []
    for i, achievement_id in enumerate(ACHIEVEMENT_IDS):
        icon_path = BADGE_DIR / f"{achievement_id}.png"
        locked_path = BADGE_DIR / f"locked-{achievement_id}.png"
        write_png(icon_path, draw_badge(achievement_id, i, locked=False))
        write_png(locked_path, draw_badge(achievement_id, i, locked=True))
        badges.append({"id": achievement_id, "src": rel(icon_path), "lockedSrc": rel(locked_path), "size": [48, 48]})

    characters = []
    for actor in ["lester", "lilly", "max-mempool"]:
        animations = {}
        for state in ["idle", "run", "jump", "shoot", "melee", "grenade", "hurt", "victory"]:
            frames = []
            for frame in range(6):
                path = PACK_DIR / "characters" / actor / state / f"{actor}-{state}-{frame:02d}.png"
                write_png(path, draw_character(actor, state, frame))
                frames.append({"src": rel(path), "size": [64, 64], "durationMs": 84})
            animations[state] = frames
        characters.append({"id": actor, "animations": animations})

    enemies = []
    for enemy in ["gas-beast", "fud-goblin", "sybil-drone", "rug-rat", "paper-hand", "crypto-bro"]:
        animations = {}
        for state in ["idle", "walk", "attack", "hit", "death"]:
            frames = []
            for frame in range(5):
                path = PACK_DIR / "enemies" / enemy / state / f"{enemy}-{state}-{frame:02d}.png"
                write_png(path, draw_enemy(enemy, state, frame))
                frames.append({"src": rel(path), "size": [48, 48], "durationMs": 96})
            animations[state] = frames
        enemies.append({"id": enemy, "animations": animations})

    bosses = []
    for boss in ["level-1-boss", "rug-pull-tank", "gas-king", "whale-baron"]:
        animations = {}
        for state in ["idle", "attack", "hurt", "death"]:
            frames = []
            for frame in range(6):
                path = PACK_DIR / "bosses" / boss / state / f"{boss}-{state}-{frame:02d}.png"
                write_png(path, draw_boss(boss, state, frame))
                frames.append({"src": rel(path), "size": [80, 80], "durationMs": 112})
            animations[state] = frames
        bosses.append({"id": boss, "animations": animations})

    props = []
    for index, name in enumerate(["tree-neon", "tree-burnt", "car-cyber", "car-wreck", "building-slum", "building-bank", "grenade-crate", "ltc-barrel", "cover-kiosk", "street-sign"]):
        path = PACK_DIR / "props" / f"{name}.png"
        write_png(path, draw_prop(name, index))
        props.append({"id": name, "src": rel(path), "size": [48, 48]})

    total_frames = (
        sum(len(frames) for char in characters for frames in char["animations"].values())
        + sum(len(frames) for enemy in enemies for frames in enemy["animations"].values())
        + sum(len(frames) for boss in bosses for frames in boss["animations"].values())
        + len(props)
        + len(badges) * 2
    )
    manifest = {
        "id": "hmh-expanded-pixel-pack-v1",
        "generatedFrom": "scripts/generate-hmh-expanded-pixel-pack.py",
        "pixelStyle": "original chunky 16-bit/Neo-Geo-inspired deterministic procedural pixel art",
        "totalFrames": total_frames,
        "achievementBadges": badges,
        "characters": characters,
        "enemies": enemies,
        "bosses": bosses,
        "props": props,
        "environment": {
            "usage": "Supplemental trees, buildings, cars, destructible cover, and neon street props for browser runtime/future atlas composition.",
            "props": props,
        },
    }
    MANIFEST_PATH.write_text(
        "export const HMH_EXPANDED_PIXEL_PACK_MANIFEST = Object.freeze(" + json.dumps(manifest, indent=2) + ");\n",
        encoding="utf-8",
    )
    print(json.dumps({"manifest": str(MANIFEST_PATH.relative_to(ROOT)), "totalFrames": total_frames, "badges": len(badges)}, indent=2))


if __name__ == "__main__":
    generate()

from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "apps" / "portal" / "assets" / "generated"
OUT_DIR.mkdir(parents=True, exist_ok=True)

FRAME_W = 128
FRAME_H = 128
COLUMNS = 16

# Dense 60fps-friendly source coverage. Runtime can step these at per-animation fps
# while keeping game logic fixed at 60fps.
ANIMATIONS = [
    ("lester", "idle", 12, 8, True),
    ("lester", "run", 16, 24, True),
    ("lester", "jump", 10, 14, False),
    ("lester", "double-jump", 10, 16, False),
    ("lester", "shoot", 16, 24, False),
    ("lester", "melee", 18, 26, False),
    ("lester", "grenade", 12, 18, False),
    ("lester", "reload", 12, 12, False),
    ("lester", "hurt", 8, 16, False),
    ("lester", "death", 14, 10, False),
    ("lester", "victory", 12, 10, True),

    ("fud-goblin", "spawn", 6, 12, False),
    ("fud-goblin", "move", 12, 16, True),
    ("fud-goblin", "attack-tell", 6, 12, False),
    ("fud-goblin", "attack", 8, 16, False),
    ("fud-goblin", "hit", 5, 14, False),
    ("fud-goblin", "death", 10, 18, False),

    ("paper-hand", "spawn", 6, 12, False),
    ("paper-hand", "move", 12, 16, True),
    ("paper-hand", "attack-tell", 6, 12, False),
    ("paper-hand", "attack", 8, 16, False),
    ("paper-hand", "hit", 5, 14, False),
    ("paper-hand", "death", 10, 18, False),

    ("gas-fee-wisp", "spawn", 6, 12, False),
    ("gas-fee-wisp", "move", 14, 18, True),
    ("gas-fee-wisp", "attack-tell", 6, 12, False),
    ("gas-fee-wisp", "attack", 8, 16, False),
    ("gas-fee-wisp", "hit", 5, 14, False),
    ("gas-fee-wisp", "death", 10, 18, False),

    ("sybil-drone", "spawn", 6, 12, False),
    ("sybil-drone", "move", 14, 18, True),
    ("sybil-drone", "attack-tell", 6, 12, False),
    ("sybil-drone", "attack", 8, 16, False),
    ("sybil-drone", "hit", 5, 14, False),
    ("sybil-drone", "death", 10, 18, False),

    ("mev-reaper", "spawn", 6, 12, False),
    ("mev-reaper", "move", 12, 18, True),
    ("mev-reaper", "attack-tell", 8, 14, False),
    ("mev-reaper", "attack", 10, 18, False),
    ("mev-reaper", "hit", 5, 14, False),
    ("mev-reaper", "death", 12, 20, False),

    ("honeypot-turret", "spawn", 6, 12, False),
    ("honeypot-turret", "move", 8, 10, True),
    ("honeypot-turret", "attack-tell", 8, 14, False),
    ("honeypot-turret", "attack", 10, 18, False),
    ("honeypot-turret", "hit", 5, 14, False),
    ("honeypot-turret", "death", 12, 20, False),

    ("slippage-skater", "spawn", 6, 12, False),
    ("slippage-skater", "move", 14, 22, True),
    ("slippage-skater", "attack-tell", 6, 14, False),
    ("slippage-skater", "attack", 8, 20, False),
    ("slippage-skater", "hit", 5, 14, False),
    ("slippage-skater", "death", 10, 20, False),

    ("liquidation-cascade-golem", "spawn", 8, 10, False),
    ("liquidation-cascade-golem", "move", 10, 12, True),
    ("liquidation-cascade-golem", "attack-tell", 8, 12, False),
    ("liquidation-cascade-golem", "attack", 10, 16, False),
    ("liquidation-cascade-golem", "hit", 6, 14, False),
    ("liquidation-cascade-golem", "death", 14, 18, False),

    ("dock-loader-mech", "intro", 10, 10, False),
    ("dock-loader-mech", "move", 12, 12, True),
    ("dock-loader-mech", "attack-tell", 10, 12, False),
    ("dock-loader-mech", "attack", 12, 16, False),
    ("dock-loader-mech", "hit", 8, 14, False),
    ("dock-loader-mech", "death", 16, 18, False),

    ("rug-pull-baron", "intro", 12, 10, False),
    ("rug-pull-baron", "phase-1", 14, 12, True),
    ("rug-pull-baron", "phase-2", 14, 14, True),
    ("rug-pull-baron", "phase-3-enrage", 14, 16, True),
    ("rug-pull-baron", "super-move", 16, 18, False),
    ("rug-pull-baron", "defeat", 20, 12, False),

    ("fx", "muzzle-flash", 10, 30, False),
    ("fx", "shell-casing", 8, 24, True),
    ("fx", "blade-arc", 18, 30, False),
    ("fx", "explosion-spark", 20, 24, False),
    ("fx", "pickup-spin", 16, 18, True),
    ("fx", "coin-burst", 16, 24, False),
    ("fx", "shield-pulse", 16, 18, True),
    ("fx", "damage-spark", 12, 30, False),
]

P = {
    "outline": (5, 6, 16, 255),
    "black": (2, 3, 9, 255),
    "shadow": (0, 0, 0, 92),
    "navy": (13, 20, 39, 255),
    "vest": (67, 90, 54, 255),
    "vest_hi": (109, 141, 83, 255),
    "vest_dark": (38, 54, 38, 255),
    "bandana": (255, 86, 28, 255),
    "bandana_dark": (166, 42, 21, 255),
    "skin": (255, 198, 139, 255),
    "skin_shadow": (202, 124, 82, 255),
    "hair": (74, 43, 25, 255),
    "beard": (89, 48, 29, 255),
    "pants": (65, 92, 64, 255),
    "pants_dark": (38, 59, 41, 255),
    "boot": (82, 50, 28, 255),
    "boot_dark": (43, 27, 20, 255),
    "silver": (215, 225, 240, 255),
    "silver_dark": (123, 143, 166, 255),
    "cyan": (25, 247, 255, 255),
    "cyan_dark": (20, 122, 185, 255),
    "green": (69, 255, 138, 255),
    "yellow": (255, 232, 77, 255),
    "orange": (255, 123, 47, 255),
    "red": (255, 71, 111, 255),
    "purple": (138, 84, 255, 255),
    "pink": (255, 68, 132, 255),
    "white": (248, 247, 255, 255),
    "paper": (238, 244, 255, 255),
    "gold": (255, 202, 67, 255),
}


def clamp_byte(v: float) -> int:
    return max(0, min(255, int(round(v))))


def tint(color, factor: float):
    r, g, b, a = color
    return (clamp_byte(r * factor), clamp_byte(g * factor), clamp_byte(b * factor), a)


def rect(draw: ImageDraw.ImageDraw, x: float, y: float, w: float, h: float, fill, outline=None, width: int = 0) -> None:
    x0, y0 = int(round(x)), int(round(y))
    x1, y1 = int(round(x + w - 1)), int(round(y + h - 1))
    draw.rectangle([x0, y0, x1, y1], fill=fill, outline=outline, width=width)


def orect(draw: ImageDraw.ImageDraw, x: float, y: float, w: float, h: float, fill, outline=P["outline"], border: int = 2) -> None:
    rect(draw, x, y, w, h, outline)
    if w > border * 2 and h > border * 2:
        rect(draw, x + border, y + border, w - border * 2, h - border * 2, fill)


def ellipse(draw: ImageDraw.ImageDraw, x: float, y: float, w: float, h: float, fill, outline=None, width: int = 0) -> None:
    draw.ellipse([int(round(x)), int(round(y)), int(round(x + w)), int(round(y + h))], fill=fill, outline=outline, width=width)


def line(draw: ImageDraw.ImageDraw, pts, fill, width: int = 1) -> None:
    draw.line([(int(round(x)), int(round(y))) for x, y in pts], fill=fill, width=width)


def poly(draw: ImageDraw.ImageDraw, points, fill, outline=None) -> None:
    draw.polygon([(int(round(x)), int(round(y))) for x, y in points], fill=fill, outline=outline)


def arc(draw: ImageDraw.ImageDraw, box, start: float, end: float, fill, width: int = 1) -> None:
    draw.arc([int(round(v)) for v in box], start=int(round(start)), end=int(round(end)), fill=fill, width=width)


def draw_shadow(draw: ImageDraw.ImageDraw, cx: int, baseline: int, w: int, alpha: int = 95) -> None:
    ellipse(draw, cx - w // 2, baseline - 8, w, 10, (0, 0, 0, alpha))


def pixel_sparks(draw: ImageDraw.ImageDraw, cx: int, cy: int, color, frame: int, count: int, amount: int = 10, radius: int = 24) -> None:
    phase = frame / max(count - 1, 1)
    for i in range(amount):
        angle = phase * math.tau * 0.8 + i * math.tau / amount + ((i * 17) % 9) * 0.05
        dist = 5 + ((frame * 3 + i * 11) % max(radius, 1))
        x = cx + math.cos(angle) * dist
        y = cy + math.sin(angle) * dist
        s = 2 + ((i + frame) % 3)
        rect(draw, x, y, s, s, color)
        if i % 3 == 0:
            rect(draw, x + s, y + 1, 2, 2, P["white"])


def draw_speed_lines(draw: ImageDraw.ImageDraw, x: int, y: int, frame: int, color=P["cyan"]) -> None:
    for j in range(3):
        line(draw, [(x - 8 - j * 7 - frame % 5, y + j * 8), (x - 25 - j * 8, y + 4 + j * 8)], color, 2)


def draw_lester(draw: ImageDraw.ImageDraw, state: str, i: int, count: int) -> None:
    phase = i / max(count - 1, 1)
    cycle = math.sin(phase * math.tau)
    cx = 54
    base = 114
    body_shift = 0
    if state == "run":
        body_shift = int(math.sin(phase * math.tau * 2) * 2)
    if state in {"jump", "double-jump"}:
        base -= 16 + int(math.sin(phase * math.pi) * 15)
    if state == "hurt":
        cx += (-1) ** i * 3
    if state == "death":
        cx += min(20, i * 2)
        base += min(14, i)
        body_shift += min(10, i)

    draw_shadow(draw, cx + 5, 116, 58 if state != "death" else 70)

    leg_a = int(cycle * 12) if state == "run" else 0
    leg_b = -leg_a
    if state == "jump":
        leg_a, leg_b = -7, 7
    if state == "double-jump":
        leg_a, leg_b = -11, 12
    if state == "death":
        leg_a, leg_b = 14, 22

    # Legs and boots.
    orect(draw, cx - 18 + leg_a, base - 39 + body_shift, 13, 32, P["pants"], border=2)
    rect(draw, cx - 15 + leg_a, base - 34 + body_shift, 5, 23, P["pants_dark"])
    orect(draw, cx + 2 + leg_b, base - 38 + body_shift, 13, 31, P["pants"], border=2)
    rect(draw, cx + 6 + leg_b, base - 33 + body_shift, 5, 22, P["pants_dark"])
    orect(draw, cx - 24 + leg_a, base - 10 + body_shift, 25, 9, P["boot"], border=2)
    orect(draw, cx + 1 + leg_b, base - 10 + body_shift, 25, 9, P["boot"], border=2)
    rect(draw, cx - 21 + leg_a, base - 4 + body_shift, 18, 3, P["boot_dark"])
    rect(draw, cx + 4 + leg_b, base - 4 + body_shift, 18, 3, P["boot_dark"])

    # Torso / vest / harness.
    orect(draw, cx - 25, base - 78 + body_shift, 48, 43, P["vest"], border=3)
    rect(draw, cx - 20, base - 73 + body_shift, 16, 28, P["vest_hi"])
    rect(draw, cx + 3, base - 73 + body_shift, 15, 29, P["vest_dark"])
    rect(draw, cx - 24, base - 45 + body_shift, 47, 9, P["outline"])
    rect(draw, cx - 21, base - 42 + body_shift, 41, 4, P["boot"])
    poly(draw, [(cx - 21, base - 76 + body_shift), (cx - 11, base - 76 + body_shift), (cx + 22, base - 36 + body_shift), (cx + 13, base - 36 + body_shift)], P["cyan_dark"])
    poly(draw, [(cx - 18, base - 76 + body_shift), (cx - 13, base - 76 + body_shift), (cx + 17, base - 38 + body_shift), (cx + 14, base - 38 + body_shift)], P["cyan"])
    orect(draw, cx - 5, base - 57 + body_shift, 14, 17, P["silver"], border=2)
    rect(draw, cx - 2, base - 53 + body_shift, 8, 4, P["white"])

    # Head, hair, bandana, face.
    orect(draw, cx - 16, base - 105 + body_shift, 35, 29, P["skin"], border=3)
    rect(draw, cx - 16, base - 108 + body_shift, 36, 10, P["hair"], P["outline"], 1)
    rect(draw, cx - 18, base - 98 + body_shift, 38, 6, P["bandana"], P["outline"], 1)
    rect(draw, cx + 17, base - 96 + body_shift, 14, 5, P["bandana_dark"], P["outline"], 1)
    poly(draw, [(cx + 30, base - 96 + body_shift), (cx + 39, base - 101 + body_shift), (cx + 34, base - 91 + body_shift)], P["bandana"])
    rect(draw, cx + 4, base - 88 + body_shift, 5, 4, P["outline"])
    rect(draw, cx + 12, base - 84 + body_shift, 10, 5, P["beard"])
    rect(draw, cx - 12, base - 80 + body_shift, 27, 5, P["skin_shadow"])

    # Back arm.
    back_arm_lift = -12 if state in {"grenade", "victory"} else int(-cycle * 6 if state == "run" else 0)
    orect(draw, cx - 34, base - 69 + body_shift + back_arm_lift, 14, 27, P["skin"], border=2)
    rect(draw, cx - 33, base - 46 + body_shift + back_arm_lift, 15, 6, P["boot_dark"], P["outline"], 1)

    # Action arm / weapons.
    arm_y = base - 62 + body_shift
    if state == "shoot":
        recoil = 6 if i % 3 == 0 else 1
        orect(draw, cx + 16, arm_y - 3, 19, 12, P["skin"], border=2)
        orect(draw, cx + 31 - recoil, arm_y - 8, 48, 14, P["navy"], border=2)
        rect(draw, cx + 36 - recoil, arm_y - 4, 31, 5, P["silver_dark"])
        rect(draw, cx + 70 - recoil, arm_y - 5, 18, 7, P["silver"], P["outline"], 1)
        rect(draw, cx + 45 - recoil, arm_y + 7, 11, 13, P["vest_dark"], P["outline"], 1)
        if i < 8:
            poly(draw, [(cx + 88 - recoil, arm_y - 1), (cx + 122, arm_y - 14), (cx + 115, arm_y + 12)], P["yellow"])
            poly(draw, [(cx + 91 - recoil, arm_y + 1), (cx + 112, arm_y - 6), (cx + 108, arm_y + 8)], P["white"])
    elif state == "melee":
        sweep = 15 + phase * 95
        orect(draw, cx + 10, arm_y - 8, 17, 15, P["skin"], border=2)
        arc(draw, [cx + 8, arm_y - 50, cx + 95, arm_y + 62], 292 - sweep, 338 - sweep * 0.35, P["silver"], 7)
        arc(draw, [cx + 18, arm_y - 44, cx + 104, arm_y + 55], 295 - sweep, 350 - sweep * 0.35, P["cyan"], 3)
        pixel_sparks(draw, cx + 68 + int(phase * 18), arm_y + 4, P["orange"], i, count, 5, 18)
    elif state == "grenade":
        throw = int(math.sin(phase * math.pi) * 32)
        orect(draw, cx + 9, arm_y - 24 - throw, 16, 35, P["skin"], border=2)
        orect(draw, cx + 33 + i * 4, arm_y - 36 - throw - i, 16, 16, P["orange"], border=2)
        rect(draw, cx + 38 + i * 4, arm_y - 42 - throw - i, 6, 5, P["silver"])
        arc(draw, [cx + 10, arm_y - 72, cx + 115, arm_y + 8], 205, 325, P["yellow"], 2)
    elif state == "reload":
        orect(draw, cx + 13, arm_y - 1, 16, 18, P["skin"], border=2)
        orect(draw, cx + 25, arm_y - 3, 35, 11, P["navy"], border=2)
        rect(draw, cx + 38, arm_y + 8 + int(phase * 18), 9, 17, P["silver_dark"], P["outline"], 1)
        if i > count // 2:
            rect(draw, cx + 38, arm_y + 7, 9, 13, P["green"], P["outline"], 1)
    elif state == "victory":
        orect(draw, cx + 12, arm_y - 34, 14, 36, P["skin"], border=2)
        orect(draw, cx + 6, arm_y - 46, 26, 13, P["silver"], border=2)
        pixel_sparks(draw, cx + 19, arm_y - 47, P["cyan"], i, count, 8, 19)
    else:
        swing = int(cycle * 5) if state == "run" else 0
        orect(draw, cx + 15, arm_y - 2 + swing, 15, 25, P["skin"], border=2)
        orect(draw, cx + 28, arm_y + 8 + swing, 31, 8, P["navy"], border=1)
        rect(draw, cx + 55, arm_y + 10 + swing, 16, 4, P["green"])

    if state == "double-jump":
        arc(draw, [cx - 42, base - 106 + body_shift, cx + 56, base + 12 + body_shift], 24, 128, P["cyan"], 4)
        arc(draw, [cx - 33, base - 96 + body_shift, cx + 43, base + 2 + body_shift], 31, 125, P["white"], 2)
        pixel_sparks(draw, cx - 5, base - 6, P["cyan"], i, count, 7, 23)
    if state == "hurt":
        pixel_sparks(draw, cx + 4, base - 67 + body_shift, P["red"], i, count, 12, 21)
        rect(draw, 12, 18, 100, 3, (255, 71, 111, 80))
    if state == "death":
        pixel_sparks(draw, cx + 4, base - 66 + body_shift, P["red"], i, count, 12, 26)


def draw_enemy(draw: ImageDraw.ImageDraw, actor: str, state: str, i: int, count: int) -> None:
    phase = i / max(count - 1, 1)
    cx = 62
    base = 110
    bob = int(math.sin(phase * math.tau) * 4)
    if state == "spawn":
        bob += int((1 - phase) * 24)
    if state == "hit":
        cx += (-1) ** i * 4
    if state == "death":
        pixel_sparks(draw, cx, base - 48, P["orange"], i, count, 18, 36)
        pixel_sparks(draw, cx + 8, base - 38, P["silver"], i + 4, count, 9, 24)
        return

    draw_shadow(draw, cx, base, 46)
    tell = state == "attack-tell"
    attack = state == "attack"

    if actor == "fud-goblin":
        orect(draw, cx - 25, base - 45 + bob, 46, 30, P["purple"], border=3)
        rect(draw, cx - 19, base - 37 + bob, 11, 7, P["red"])
        rect(draw, cx + 5, base - 37 + bob, 11, 7, P["red"])
        orect(draw, cx - 20, base - 18 + bob, 11, 11, P["bandana"], border=1)
        orect(draw, cx + 8, base - 18 + bob, 11, 11, P["bandana"], border=1)
        if attack:
            rect(draw, cx + 20, base - 35 + bob, 34, 8, P["red"], P["outline"], 1)
    elif actor == "paper-hand":
        orect(draw, cx - 20, base - 57 + bob, 34, 48, P["red"], border=3)
        rect(draw, cx - 16, base - 52 + bob, 28, 30, P["pink"])
        poly(draw, [(cx + 14, base - 44 + bob), (cx + 43 + (12 if attack else 0), base - 42 + bob), (cx + 43, base - 35 + bob), (cx + 14, base - 35 + bob)], P["paper"], P["outline"])
        rect(draw, cx - 3, base - 67 + bob, 22, 13, P["paper"], P["outline"], 1)
    elif actor == "gas-fee-wisp":
        ellipse(draw, cx - 22, base - 58 + bob, 40, 46, P["orange"], P["outline"], 3)
        rect(draw, cx - 8, base - 69 + bob, 17, 14, P["silver"], P["outline"], 2)
        rect(draw, cx + 16, base - 40 + bob, 36 + (14 if attack else 0), 6, P["yellow"])
        pixel_sparks(draw, cx - 4, base - 31 + bob, P["orange"], i, count, 4, 14)
    elif actor == "sybil-drone":
        orect(draw, cx - 32, base - 56 + bob, 58, 28, P["cyan"], border=3)
        rect(draw, cx - 22, base - 48 + bob, 37, 8, P["cyan_dark"])
        rect(draw, cx + 18, base - 45 + bob, 23 + (16 if attack else 0), 5, P["pink"])
        line(draw, [(cx - 37, base - 43 + bob), (cx - 51, base - 37 + bob)], P["silver"], 3)
        line(draw, [(cx + 31, base - 43 + bob), (cx + 45, base - 37 + bob)], P["silver"], 3)
    elif actor == "mev-reaper":
        poly(draw, [(cx - 25, base - 14 + bob), (cx - 12, base - 72 + bob), (cx + 18, base - 74 + bob), (cx + 34, base - 14 + bob)], P["navy"], P["outline"])
        rect(draw, cx - 4, base - 58 + bob, 18, 8, P["red"])
        if attack:
            arc(draw, [cx + 0, base - 75 + bob, cx + 74, base - 6 + bob], 300, 26, P["silver"], 5)
            arc(draw, [cx + 6, base - 70 + bob, cx + 82, base - 11 + bob], 304, 34, P["red"], 2)
    elif actor == "honeypot-turret":
        orect(draw, cx - 25, base - 45 + bob, 50, 35, P["gold"], border=3)
        rect(draw, cx - 17, base - 35 + bob, 34, 11, P["orange"], P["outline"], 1)
        rect(draw, cx + 22, base - 32 + bob, 33 + (20 if attack else 0), 8, P["navy"], P["outline"], 2)
        rect(draw, cx - 11, base - 61 + bob, 24, 17, P["silver"], P["outline"], 2)
    elif actor == "slippage-skater":
        orect(draw, cx - 20, base - 56 + bob, 35, 45, P["pink"], border=3)
        rect(draw, cx - 12, base - 66 + bob, 22, 13, P["cyan"], P["outline"], 2)
        rect(draw, cx - 28, base - 9 + bob, 36, 6, P["silver"], P["outline"], 1)
        rect(draw, cx + 4, base - 11 + bob, 38, 6, P["silver"], P["outline"], 1)
        if attack:
            draw_speed_lines(draw, cx - 18, base - 28 + bob, i, P["cyan"])
    elif actor == "liquidation-cascade-golem":
        for b in range(4):
            x = cx - 32 + (b % 2) * 27 + int(math.sin(phase * math.tau + b) * 2)
            y = base - 70 + b * 15 + bob
            orect(draw, x, y, 34, 19, [P["red"], P["orange"], P["navy"], P["silver_dark"]][b], border=2)
        rect(draw, cx + 14, base - 49 + bob, 24 + (20 if attack else 0), 9, P["red"], P["outline"], 1)
    else:
        orect(draw, cx - 24, base - 50 + bob, 45, 38, P["red"], border=3)

    if tell:
        rect(draw, cx - 33, base - 80 + bob, 68, 5, P["yellow"])
        pixel_sparks(draw, cx, base - 61 + bob, P["yellow"], i, count, 6, 17)
    if state == "hit":
        rect(draw, 18, 18, 92, 4, (255, 247, 255, 120))
        pixel_sparks(draw, cx, base - 43 + bob, P["silver"], i, count, 6, 17)


def draw_mini_boss(draw: ImageDraw.ImageDraw, state: str, i: int, count: int) -> None:
    phase = i / max(count - 1, 1)
    cx, base = 60, 116
    bob = int(math.sin(phase * math.tau) * 2)
    if state == "death":
        pixel_sparks(draw, cx, base - 48, P["orange"], i, count, 28, 42)
        pixel_sparks(draw, cx + 12, base - 58, P["silver"], i + 5, count, 12, 28)
        return
    draw_shadow(draw, cx, base, 74, 110)
    orect(draw, cx - 38, base - 60 + bob, 76, 47, P["orange"], border=4)
    rect(draw, cx - 29, base - 51 + bob, 53, 14, P["gold"], P["outline"], 2)
    orect(draw, cx - 23, base - 75 + bob, 48, 20, P["silver_dark"], border=3)
    rect(draw, cx + 24, base - 55 + bob, 35 + (22 if state == "attack" else 0), 10, P["navy"], P["outline"], 2)
    rect(draw, cx - 34, base - 16 + bob, 18, 8, P["silver"], P["outline"], 1)
    rect(draw, cx + 16, base - 16 + bob, 18, 8, P["silver"], P["outline"], 1)
    if state == "attack-tell":
        rect(draw, cx - 38, base - 86 + bob, 76, 6, P["yellow"])
        pixel_sparks(draw, cx + 22, base - 43 + bob, P["yellow"], i, count, 7, 21)
    if state == "hit":
        pixel_sparks(draw, cx, base - 48 + bob, P["red"], i, count, 10, 24)
    if state == "intro":
        rect(draw, cx - 44, base - 95 + bob + int((1 - phase) * 26), 88, 6, P["cyan"])


def draw_boss(draw: ImageDraw.ImageDraw, state: str, i: int, count: int) -> None:
    phase = i / max(count - 1, 1)
    cx, base = 64, 117
    bob = int(math.sin(phase * math.tau) * 2)
    phase_color = P["purple"] if state in {"intro", "phase-1"} else P["orange"] if state == "phase-2" else P["red"]
    if state == "defeat":
        pixel_sparks(draw, cx, base - 63, P["yellow"], i, count, 32, 48)
        pixel_sparks(draw, cx + 8, base - 54, P["red"], i + 4, count, 22, 42)
        return
    draw_shadow(draw, cx, base, 88, 120)
    orect(draw, cx - 42, base - 72 + bob, 84, 58, phase_color, border=5)
    rect(draw, cx - 30, base - 60 + bob, 60, 18, P["gold"], P["outline"], 2)
    rect(draw, cx - 27, base - 55 + bob, 54, 8, P["silver"], P["outline"], 1)
    orect(draw, cx - 28, base - 91 + bob, 56, 24, P["navy"], border=3)
    eye_color = P["red"] if state == "phase-3-enrage" else P["cyan"]
    rect(draw, cx - 17, base - 83 + bob, 34, 7, eye_color, P["outline"], 1)
    rect(draw, cx - 37, base - 14 + bob, 20, 8, P["silver"], P["outline"], 1)
    rect(draw, cx + 17, base - 14 + bob, 20, 8, P["silver"], P["outline"], 1)
    if state == "super-move":
        arc(draw, [cx - 50, base - 104 + bob, cx + 50, base + 0 + bob], 210 - phase * 120, 340 + phase * 50, P["yellow"], 6)
        arc(draw, [cx - 42, base - 94 + bob, cx + 58, base + 10 + bob], 213 - phase * 120, 345 + phase * 50, P["red"], 3)
        rect(draw, cx - 50, base - 99 + bob, 100, 5, P["red"])
        pixel_sparks(draw, cx + 34, base - 60 + bob, P["yellow"], i, count, 10, 26)
    if state == "intro":
        rect(draw, cx - 43, base - 104 + bob + int((1 - phase) * 30), 86, 8, P["yellow"])


def draw_fx(draw: ImageDraw.ImageDraw, state: str, i: int, count: int) -> None:
    phase = i / max(count - 1, 1)
    cx, cy = 64, 66
    if state == "muzzle-flash":
        scale = 1 - phase * 0.4
        poly(draw, [(cx - 18, cy), (cx + 4, cy - 22 * scale), (cx + 54, cy), (cx + 3, cy + 22 * scale)], P["yellow"])
        poly(draw, [(cx - 7, cy), (cx + 10, cy - 10 * scale), (cx + 33, cy), (cx + 8, cy + 10 * scale)], P["white"])
        rect(draw, cx - 26, cy - 3, 22, 6, P["cyan"])
    elif state == "shell-casing":
        x = cx - 30 + int(phase * 60)
        y = cy - 16 + int(math.sin(phase * math.pi) * 25)
        rect(draw, x, y, 12, 5, P["gold"], P["outline"], 1)
        rect(draw, x + 8, y + 1, 3, 3, P["silver"])
    elif state == "blade-arc":
        arc(draw, [18, 16, 116, 118], 300 - phase * 126, 360 - phase * 42, P["silver"], 8)
        arc(draw, [24, 23, 110, 110], 304 - phase * 126, 362 - phase * 42, P["cyan"], 4)
        pixel_sparks(draw, 72 + int(phase * 20), 65, P["orange"], i, count, 5, 18)
    elif state == "explosion-spark":
        pixel_sparks(draw, cx, cy, P["orange"], i, count, 28, int(44 * phase) + 8)
        pixel_sparks(draw, cx + 3, cy - 2, P["white"], i + 2, count, 12, int(30 * phase) + 6)
        ellipse(draw, cx - 9 - phase * 8, cy - 9 - phase * 8, 18 + phase * 16, 18 + phase * 16, (255, 123, 47, int(190 * (1 - phase))))
    elif state == "pickup-spin":
        w = 12 + abs(math.sin(phase * math.tau)) * 26
        orect(draw, cx - w / 2, cy - 18, w, 36, P["cyan"], border=2)
        rect(draw, cx - w / 4, cy - 10, max(3, w / 2), 7, P["white"])
        pixel_sparks(draw, cx, cy, P["green"], i, count, 5, 22)
    elif state == "coin-burst":
        pixel_sparks(draw, cx, cy, P["gold"], i, count, 22, int(38 * phase) + 5)
        for k in range(5):
            angle = phase * math.tau + k * math.tau / 5
            rect(draw, cx + math.cos(angle) * (12 + phase * 35), cy + math.sin(angle) * (9 + phase * 26), 7, 7, P["gold"], P["outline"], 1)
    elif state == "shield-pulse":
        arc(draw, [cx - 34 - phase * 6, cy - 42 - phase * 6, cx + 34 + phase * 6, cy + 42 + phase * 6], 205, 515, P["cyan"], 5)
        arc(draw, [cx - 26, cy - 34, cx + 26, cy + 34], 210, 510, P["white"], 2)
    elif state == "damage-spark":
        pixel_sparks(draw, cx, cy, P["red"], i, count, 20, int(28 * phase) + 7)
        rect(draw, cx - 38, cy - 2, 76, 4, P["white"])
    else:
        pixel_sparks(draw, cx, cy, P["yellow"], i, count, 12, 24)


def draw_frame(actor: str, state: str, i: int, count: int) -> Image.Image:
    frame = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(frame)
    if actor == "lester":
        draw_lester(draw, state, i, count)
    elif actor == "dock-loader-mech":
        draw_mini_boss(draw, state, i, count)
    elif actor == "rug-pull-baron":
        draw_boss(draw, state, i, count)
    elif actor == "fx":
        draw_fx(draw, state, i, count)
    else:
        draw_enemy(draw, actor, state, i, count)
    return frame


def frame_meta(actor: str, state: str, start: int, count: int, fps: int, loop: bool):
    if actor == "lester":
        anchor = {"x": 58, "y": 114}
        hitbox = {"x": 35, "y": 22, "w": 48, "h": 88}
    elif actor == "fx":
        anchor = {"x": 64, "y": 64}
        hitbox = {"x": 18, "y": 18, "w": 92, "h": 92}
    elif actor in {"dock-loader-mech", "rug-pull-baron"}:
        anchor = {"x": 64, "y": 116}
        hitbox = {"x": 18, "y": 20, "w": 92, "h": 96}
    else:
        anchor = {"x": 62, "y": 110}
        hitbox = {"x": 25, "y": 26, "w": 68, "h": 82}
    return {
        "actor": actor,
        "state": state,
        "start": start,
        "count": count,
        "fps": fps,
        "loop": loop,
        "anchor": anchor,
        "hitbox": hitbox,
    }


def build_atlas():
    total_frames = sum(count for *_prefix, count, _fps, _loop in ANIMATIONS)
    rows = math.ceil(total_frames / COLUMNS)
    atlas = Image.new("RGBA", (FRAME_W * COLUMNS, FRAME_H * rows), (0, 0, 0, 0))
    manifest_animations = {}
    groups = []
    frame_index = 0

    current_actor = None
    group_start = 0
    group_states = []
    group_count = 0

    for actor, state, count, fps, loop in ANIMATIONS:
        if current_actor is None:
            current_actor = actor
            group_start = frame_index
        if actor != current_actor:
            groups.append({"actor": current_actor, "start": group_start, "states": group_states, "frameCount": group_count})
            current_actor = actor
            group_start = frame_index
            group_states = []
            group_count = 0

        start = frame_index
        manifest_animations[f"{actor}.{state}"] = frame_meta(actor, state, start, count, fps, loop)
        group_states.append(state)
        group_count += count

        for i in range(count):
            frame = draw_frame(actor, state, i, count)
            x = (frame_index % COLUMNS) * FRAME_W
            y = (frame_index // COLUMNS) * FRAME_H
            atlas.alpha_composite(frame, (x, y))
            frame_index += 1

    if current_actor is not None:
        groups.append({"actor": current_actor, "start": group_start, "states": group_states, "frameCount": group_count})

    return atlas, {
        "id": "hmh-hd-sprite-atlas-v2",
        "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "style": "high-resolution 128x128 source-frame 16-bit / Neo-Geo-inspired pixel art; crisp transparent frames; large readable silhouettes; silver-blue hero accents; orange/red enemy tells; sparks-first impact feedback",
        "image": {
            "src": "./assets/generated/hmh-hd-sprite-atlas.png",
            "previewSrc": "./assets/generated/hmh-hd-sprite-atlas-preview.png",
            "width": FRAME_W * COLUMNS,
            "height": FRAME_H * rows,
            "frameWidth": FRAME_W,
            "frameHeight": FRAME_H,
            "columns": COLUMNS,
            "rows": rows,
        },
        "totalFrames": total_frames,
        "groups": groups,
        "playableStates": ["idle", "run", "jump", "double-jump", "shoot", "melee", "grenade", "reload", "hurt", "death", "victory"],
        "runtimeNotes": [
            "Use fixed 60fps gameplay logic; select atlas frames by animation fps and combat frame clock.",
            "All enemy attacks include attack-tell frames before damage frames for readable, fair play.",
            "Draw source frames with imageSmoothing disabled and pixel-snapped destination coordinates.",
            "Large v2 coverage supports fast run, shooting, blade, grenade, reload, boss, and FX cadence without duplicate static poses.",
        ],
        "animations": manifest_animations,
    }


def make_preview(atlas: Image.Image, manifest: dict) -> Image.Image:
    preview_w, preview_h = 1760, 1500
    bg = Image.new("RGB", (preview_w, preview_h), (5, 4, 15))
    draw = ImageDraw.Draw(bg)
    try:
        font = ImageFont.truetype("DejaVuSans.ttf", 18)
        small = ImageFont.truetype("DejaVuSans.ttf", 14)
        label = ImageFont.truetype("DejaVuSans-Bold.ttf", 16)
    except OSError:
        font = small = label = ImageFont.load_default()

    draw.text((28, 24), f"Hard Money Heroes HD Sprite Atlas v2 — {manifest['totalFrames']} transparent 128x128 source frames", fill=(25, 247, 255), font=font)
    draw.text((28, 58), "Expanded frame counts: Lester 11 states, 8 enemy families, mini-boss, Rug Pull Baron, and gameplay FX for smooth 60fps runtime sampling.", fill=(215, 225, 240), font=small)

    rows = [
        ("Lester production action kit", ["lester.idle", "lester.run", "lester.shoot", "lester.melee", "lester.grenade", "lester.reload", "lester.double-jump", "lester.hurt", "lester.victory"]),
        ("Enemy movement + readable attack tells", ["fud-goblin.move", "fud-goblin.attack-tell", "paper-hand.attack", "gas-fee-wisp.move", "sybil-drone.attack", "mev-reaper.attack-tell", "honeypot-turret.attack", "slippage-skater.move", "liquidation-cascade-golem.attack-tell"]),
        ("Scroll locks + boss phases", ["dock-loader-mech.intro", "dock-loader-mech.attack", "dock-loader-mech.death", "rug-pull-baron.phase-1", "rug-pull-baron.phase-2", "rug-pull-baron.phase-3-enrage", "rug-pull-baron.super-move", "rug-pull-baron.defeat"]),
        ("Arcade VFX + pickups", ["fx.muzzle-flash", "fx.shell-casing", "fx.blade-arc", "fx.explosion-spark", "fx.pickup-spin", "fx.coin-burst", "fx.shield-pulse", "fx.damage-spark"]),
    ]

    y = 110
    for title, keys in rows:
        draw.text((28, y), title, fill=(255, 232, 77), font=label)
        y += 34
        x = 40
        for key in keys:
            anim = manifest["animations"][key]
            # Show first, middle, and last-ish frame for dense motion readability.
            sample_offsets = [0, max(0, anim["count"] // 2), max(0, anim["count"] - 1)] if anim["count"] >= 8 else [0, max(0, anim["count"] - 1)]
            for offset in sample_offsets[:3]:
                idx = anim["start"] + offset
                sx = (idx % COLUMNS) * FRAME_W
                sy = (idx // COLUMNS) * FRAME_H
                crop = atlas.crop((sx, sy, sx + FRAME_W, sy + FRAME_H)).resize((96, 96), Image.Resampling.NEAREST)
                bg.paste(crop.convert("RGB"), (x, y), crop)
                x += 102
            draw.text((x - 304, y + 100), f"{key} ({anim['count']} @ {anim['fps']}fps)", fill=(215, 225, 240), font=small)
            x += 28
            if x > preview_w - 340:
                x = 40
                y += 142
        y += 164

    draw.text((28, preview_h - 50), f"Atlas image: {manifest['image']['width']}×{manifest['image']['height']}px, {manifest['image']['columns']} columns × {manifest['image']['rows']} rows. Transparent PNG runtime source; preview is downsampled contact view.", fill=(69, 255, 138), font=small)
    return bg


def write_manifest(manifest: dict) -> None:
    manifest_path = OUT_DIR / "hmh-hd-sprite-atlas.mjs"
    manifest_json = json.dumps(manifest, indent=2)
    manifest_path.write_text(
        "// Generated by scripts/generate-hmh-hd-sprite-atlas.py. Do not edit the frame coordinates by hand.\n"
        f"export const HMH_HD_SPRITE_ATLAS_MANIFEST = Object.freeze({manifest_json});\n\n"
        "export default HMH_HD_SPRITE_ATLAS_MANIFEST;\n",
        encoding="utf-8",
    )


def main() -> None:
    atlas, manifest = build_atlas()
    atlas_path = OUT_DIR / "hmh-hd-sprite-atlas.png"
    preview_path = OUT_DIR / "hmh-hd-sprite-atlas-preview.png"
    atlas.save(atlas_path, optimize=True)
    make_preview(atlas, manifest).save(preview_path, optimize=True)
    write_manifest(manifest)
    print(json.dumps({"atlas": str(atlas_path), "preview": str(preview_path), "frames": manifest["totalFrames"], "size": [atlas.width, atlas.height], "rows": manifest["image"]["rows"]}, indent=2))


if __name__ == "__main__":
    main()

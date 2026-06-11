#!/usr/bin/env python
"""Generate the Hard Money Heroes production art pass from PixelLab source assets.

This script is intentionally deterministic and secret-free: it reads the checked-in
PixelLab runtime manifest, creates local derived animation frames/UI/cabinet/VFX
PNGs under apps/portal/assets/generated/hmh-production-art-pass, and writes a
runtime manifest consumed by apps/portal/main.js.
"""
from __future__ import annotations

import json
import math
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
PORTAL = ROOT / "apps" / "portal"
PIXELLAB_MANIFEST = PORTAL / "assets" / "generated" / "hmh-isometric-pixellab" / "hmh-isometric-pixellab-wave-1.mjs"
OUT = PORTAL / "assets" / "generated" / "hmh-production-art-pass"
MANIFEST = OUT / "hmh-production-art-pass.mjs"
DOC = ROOT / "docs" / "game-design" / "hard-money-heroes-production-art-pass.md"

TARGET_FPS = 60
DIRECTION_ORDER = ["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"]
DIRECTION_MATCH_ORDER = sorted(DIRECTION_ORDER, key=len, reverse=True)

CHARACTER_BINDINGS = {
    "lester": "lester-iso-hero",
    "lilly": "lilly-iso-alt-hero",
    "trenchDegen": "trench-degen-chaser",
    "evilBanker": "evil-banker-ranged",
    "cryptoBro": "crypto-bro-rusher",
    "gasBeast": "gas-beast-tank",
    "rugpullSummoner": "rugpull-summoner",
    "warrenSpearRider": "warren-spear-rider-miniboss",
    "bitWhale": "bit-whale-boss",
    "chainReaper": "chain-reaper-boss",
}

ANIMATION_DEFS = {
    "idle": {"frames": 8, "fps": 12, "bob": 2, "sway": 0, "scale": 1.0},
    "run": {"frames": 12, "fps": 16, "bob": 5, "sway": 3, "scale": 1.0},
    "shoot": {"frames": 8, "fps": 18, "bob": 1, "sway": -4, "scale": 1.0, "flash": True},
    "hit": {"frames": 6, "fps": 15, "bob": 1, "sway": 0, "scale": 1.0, "tint": (255, 82, 120, 80)},
    "death": {"frames": 10, "fps": 14, "bob": 3, "sway": 2, "scale": 0.98, "fade": True},
}

UI_ASSETS = {
    "hud-panel": (640, 118),
    "xp-bar-frame": (320, 48),
    "upgrade-card-frame": (160, 224),
    "level-up-modal-frame": (360, 236),
    "reroll-button-frame": (128, 64),
    "mobile-joystick-ring": (128, 128),
    "mobile-fire-button": (128, 128),
    "pause-menu-panel": (420, 280),
}

PICKUP_ASSETS = {
    "health-pack": (56, 56),
    "ammo-pack": (56, 56),
    "crypto-bomb": (56, 56),
}

WEAPON_ASSETS = {
    "coin-blaster": (96, 48),
    "hash-rail": (112, 48),
    "oracle-slayer": (112, 52),
}

VFX_ASSETS = {
    "muzzle-flash": (64, 64, 6, 24),
    "impact-sparks": (64, 64, 8, 24),
    "projectile-trail": (96, 48, 6, 24),
    "level-up-burst": (128, 128, 10, 18),
    "boss-telegraph-ring": (160, 96, 8, 16),
}

LEVELS = [
    {
        "id": "litecoin-city-after-dark",
        "title": "Litecoin City After Dark",
        "tiles": ["asphalt-street", "sidewalk-concrete", "alley-floor", "neon-puddle", "road-marking", "sewer-grate"],
        "props": ["dumpster", "garbage-can", "wood-crate", "streetlight", "traffic-barricade", "blank-neon-sign", "loot-crate-8dir"],
    },
    {
        "id": "foundry-rooftop-run",
        "title": "Foundry Rooftop Run",
        "tiles": ["foundry-metal-floor", "rooftop-tar", "stairs-ramp", "curb-edge", "chainlink-footprint"],
        "props": ["terminal-kiosk", "vending-machine", "explosive-barrel", "broken-car", "loot-crate-8dir"],
    },
    {
        "id": "financial-plaza-siege",
        "title": "Financial Plaza Siege",
        "tiles": ["financial-plaza", "sidewalk-concrete", "road-marking", "neon-puddle"],
        "props": ["cyber-palm-tree", "dead-urban-tree", "blank-neon-sign", "traffic-barricade", "loot-crate-8dir"],
    },
]


def rel(path: Path) -> str:
    return "./" + path.resolve().relative_to(PORTAL.resolve()).as_posix()


def load_pixellab_manifest() -> dict[str, Any]:
    text = PIXELLAB_MANIFEST.read_text(encoding="utf-8")
    payload = text.split("Object.freeze(", 1)[1].rsplit(");", 1)[0]
    return json.loads(payload)


def asset_by_slug(data: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {asset["slug"]: asset for asset in data.get("assets", [])}


def portal_path(src: str) -> Path:
    src = src[2:] if src.startswith("./") else src
    return PORTAL / src


def direction_from_src(src: str, fallback_index: int) -> str:
    name = Path(src).stem.lower()
    for direction in DIRECTION_MATCH_ORDER:
        if name == direction:
            return direction
    for direction in DIRECTION_MATCH_ORDER:
        if direction in name:
            return direction
    return DIRECTION_ORDER[fallback_index % len(DIRECTION_ORDER)]


def transparent_canvas(size: tuple[int, int]) -> Image.Image:
    return Image.new("RGBA", size, (0, 0, 0, 0))


def alpha_bounds(image: Image.Image) -> tuple[int, int, int, int]:
    return image.getbbox() or (0, 0, image.width, image.height)


def fit_sprite(image: Image.Image, max_size: int) -> Image.Image:
    sprite = image.convert("RGBA")
    bbox = alpha_bounds(sprite)
    sprite = sprite.crop(bbox)
    ratio = min(max_size / max(sprite.width, 1), max_size / max(sprite.height, 1), 1.8)
    return sprite.resize((max(1, round(sprite.width * ratio)), max(1, round(sprite.height * ratio))), Image.Resampling.NEAREST)


def apply_tint(sprite: Image.Image, tint: tuple[int, int, int, int] | None) -> Image.Image:
    if not tint:
        return sprite
    overlay = Image.new("RGBA", sprite.size, tint)
    out = sprite.copy()
    out.alpha_composite(overlay)
    out.putalpha(sprite.getchannel("A"))
    return out


def save_character_animation(slug: str, source_src: str, role: str) -> dict[str, Any]:
    source_path = portal_path(source_src)
    source = Image.open(source_path).convert("RGBA")
    canvas_size = 176 if role in {"boss", "mini_boss"} or "boss" in slug else 136
    max_sprite = 132 if canvas_size > 140 else 108
    base = fit_sprite(source, max_sprite)
    out_dir = OUT / "characters" / slug
    animations: dict[str, Any] = {}
    for anim_name, spec in ANIMATION_DEFS.items():
        frames = []
        frame_count = int(spec["frames"])
        for index in range(frame_count):
            phase = index / frame_count
            sway = round(math.sin(phase * math.tau) * spec.get("sway", 0))
            bob = round(math.sin(phase * math.tau + math.pi / 5) * spec.get("bob", 0))
            scale = spec.get("scale", 1.0)
            if anim_name == "run":
                scale += math.sin(phase * math.tau * 2) * 0.018
            if anim_name == "death":
                scale *= max(0.76, 1 - phase * 0.22)
            sprite = base.resize((max(1, round(base.width * scale)), max(1, round(base.height * scale))), Image.Resampling.NEAREST)
            sprite = apply_tint(sprite, spec.get("tint"))
            if spec.get("fade"):
                alpha = sprite.getchannel("A").point(lambda value: int(value * max(0.18, 1 - phase * 0.72)))
                sprite.putalpha(alpha)
            canvas = transparent_canvas((canvas_size, canvas_size))
            draw = ImageDraw.Draw(canvas, "RGBA")
            shadow_w = int(sprite.width * (0.58 + 0.08 * math.sin(phase * math.tau)))
            shadow_h = max(5, int(sprite.height * 0.08))
            shadow_x = canvas_size // 2 - shadow_w // 2
            shadow_y = canvas_size - 18
            draw.ellipse((shadow_x, shadow_y, shadow_x + shadow_w, shadow_y + shadow_h), fill=(0, 0, 0, 90))
            x = canvas_size // 2 - sprite.width // 2 + sway
            y = canvas_size - sprite.height - 20 + bob
            canvas.alpha_composite(sprite, (x, y))
            if spec.get("flash") and index in {1, 2, 3}:
                fx = x + int(sprite.width * 0.78)
                fy = y + int(sprite.height * 0.44)
                draw.polygon([(fx, fy), (fx + 28, fy - 10), (fx + 18, fy + 2), (fx + 32, fy + 12)], fill=(255, 232, 77, 225))
                draw.polygon([(fx + 2, fy), (fx + 21, fy - 5), (fx + 15, fy + 7)], fill=(25, 247, 255, 190))
            path = out_dir / anim_name / f"frame-{index:02d}.png"
            path.parent.mkdir(parents=True, exist_ok=True)
            canvas.save(path)
            frames.append({"src": rel(path), "durationMs": round(1000 / int(spec["fps"])), "index": index})
        animations[anim_name] = {
            "fps": int(spec["fps"]),
            "loop": anim_name != "death",
            "frames": frames,
            "frameCount": frame_count,
        }
    return animations


def draw_neon_rect(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], fill: tuple[int, int, int, int], border=(25, 247, 255, 220), width=3) -> None:
    x1, y1, x2, y2 = box
    draw.rounded_rectangle(box, radius=10, fill=fill, outline=border, width=width)
    draw.rounded_rectangle((x1 + 5, y1 + 5, x2 - 5, y2 - 5), radius=7, outline=(255, 232, 77, 120), width=1)


def save_ui_asset(slug: str, size: tuple[int, int]) -> dict[str, Any]:
    w, h = size
    image = transparent_canvas(size)
    draw = ImageDraw.Draw(image, "RGBA")
    if slug == "mobile-joystick-ring":
        draw.ellipse((8, 8, w - 8, h - 8), outline=(25, 247, 255, 190), width=5)
        draw.ellipse((43, 43, 85, 85), fill=(25, 247, 255, 45), outline=(255, 232, 77, 170), width=3)
    elif slug == "mobile-fire-button":
        draw.ellipse((8, 8, w - 8, h - 8), fill=(255, 71, 111, 35), outline=(255, 71, 111, 210), width=5)
        draw.polygon([(44, 66), (75, 48), (82, 58), (54, 80)], fill=(255, 232, 77, 220))
        draw.polygon([(74, 48), (99, 44), (86, 62)], fill=(25, 247, 255, 180))
    elif slug == "xp-bar-frame":
        draw_neon_rect(draw, (4, 8, w - 4, h - 8), (4, 11, 26, 210), border=(69, 255, 138, 220), width=3)
        draw.rectangle((18, 20, w - 18, h - 20), fill=(25, 247, 255, 32))
    elif slug == "upgrade-card-frame":
        draw_neon_rect(draw, (4, 4, w - 4, h - 4), (8, 6, 22, 230), border=(184, 108, 255, 230), width=3)
        draw.rectangle((18, 30, w - 18, 92), fill=(25, 247, 255, 28), outline=(25, 247, 255, 100))
        draw.rectangle((18, 112, w - 18, h - 28), fill=(255, 232, 77, 18), outline=(255, 232, 77, 90))
    elif slug == "level-up-modal-frame":
        draw_neon_rect(draw, (4, 4, w - 4, h - 4), (3, 7, 17, 235), border=(255, 232, 77, 230), width=4)
        for x in (28, 190):
            draw.rounded_rectangle((x, 54, x + 132, h - 30), radius=9, fill=(18, 31, 55, 210), outline=(184, 108, 255, 150), width=2)
        draw.rectangle((30, 22, w - 30, 38), fill=(25, 247, 255, 42))
    elif slug == "reroll-button-frame":
        draw_neon_rect(draw, (5, 8, w - 5, h - 8), (18, 31, 55, 220), border=(255, 123, 47, 230), width=3)
        draw.arc((40, 20, 86, 58), 20, 320, fill=(255, 232, 77, 220), width=4)
        draw.polygon([(82, 19), (100, 22), (88, 36)], fill=(255, 232, 77, 220))
    else:
        draw_neon_rect(draw, (4, 4, w - 4, h - 4), (4, 11, 26, 220), border=(25, 247, 255, 210), width=3)
        for i in range(0, w, 28):
            draw.line((i, h - 12, i + 18, h - 22), fill=(69, 255, 138, 42), width=2)
    path = OUT / "ui" / f"{slug}.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path)
    return {"slug": slug, "src": rel(path), "width": w, "height": h, "role": "ui"}


def save_pickup_asset(slug: str, size: tuple[int, int]) -> dict[str, Any]:
    w, h = size
    image = transparent_canvas(size)
    draw = ImageDraw.Draw(image, "RGBA")
    cx, cy = w // 2, h // 2
    if "health" in slug:
        draw.rounded_rectangle((10, 16, w - 10, h - 12), radius=7, fill=(12, 54, 35, 230), outline=(69, 255, 138, 230), width=3)
        draw.rectangle((cx - 5, 22, cx + 5, h - 18), fill=(249, 247, 255, 220))
        draw.rectangle((18, cy - 5, w - 18, cy + 5), fill=(249, 247, 255, 220))
    elif "ammo" in slug:
        draw.rounded_rectangle((9, 17, w - 9, h - 11), radius=6, fill=(13, 38, 72, 230), outline=(25, 247, 255, 230), width=3)
        for x in (18, 27, 36):
            draw.rectangle((x, 20, x + 5, h - 16), fill=(255, 232, 77, 220))
    elif "bomb" in slug:
        draw.ellipse((12, 16, w - 10, h - 8), fill=(20, 22, 36, 235), outline=(255, 123, 47, 230), width=3)
        draw.line((cx, 14, cx + 10, 5), fill=(255, 232, 77, 220), width=3)
        draw.line((18, cy, w - 18, cy - 8), fill=(25, 247, 255, 180), width=2)
    else:
        draw.polygon([(cx, 4), (w - 6, cy), (cx, h - 4), (6, cy)], fill=(25, 247, 255, 180), outline=(249, 247, 255, 220))
        draw.polygon([(cx, 12), (w - 16, cy), (cx, h - 12), (16, cy)], fill=(69, 255, 138, 130))
    path = OUT / "pickups" / f"{slug}.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path)
    return {"slug": slug, "src": rel(path), "width": w, "height": h, "role": "pickup"}


def save_weapon_asset(slug: str, size: tuple[int, int]) -> dict[str, Any]:
    w, h = size
    image = transparent_canvas(size)
    draw = ImageDraw.Draw(image, "RGBA")
    color = (25, 247, 255, 230) if slug == "hash-rail" else (184, 108, 255, 230) if slug == "oracle-slayer" else (255, 232, 77, 230)
    draw.rounded_rectangle((8, 18, w - 22, h - 13), radius=5, fill=(18, 31, 55, 230), outline=color, width=3)
    draw.rectangle((w - 34, 22, w - 8, 31), fill=color)
    draw.rectangle((22, h - 18, 42, h - 8), fill=(255, 123, 47, 200))
    draw.rectangle((44, 12, 70, 20), fill=(249, 247, 255, 100))
    path = OUT / "weapons" / f"{slug}.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path)
    return {"slug": slug, "src": rel(path), "width": w, "height": h, "role": "weapon"}


def save_vfx_asset(slug: str, size: tuple[int, int], count: int, fps: int) -> dict[str, Any]:
    w, h = size
    frames = []
    for index in range(count):
        phase = index / max(1, count - 1)
        image = transparent_canvas(size)
        draw = ImageDraw.Draw(image, "RGBA")
        cx, cy = w // 2, h // 2
        if slug == "muzzle-flash":
            length = 14 + int(phase * 26)
            alpha = int(240 * (1 - phase * 0.7))
            draw.polygon([(cx - 8, cy), (cx + length, cy - 14), (cx + length // 2, cy), (cx + length, cy + 14)], fill=(255, 232, 77, alpha))
            draw.polygon([(cx, cy), (cx + length - 6, cy - 5), (cx + length - 10, cy + 6)], fill=(25, 247, 255, max(80, alpha - 40)))
        elif slug == "projectile-trail":
            alpha = int(220 * (1 - phase * 0.55))
            draw.rounded_rectangle((8 + int(phase * 8), cy - 5, w - 8, cy + 5), radius=4, fill=(25, 247, 255, alpha))
            draw.rounded_rectangle((18, cy - 2, w - 20, cy + 2), radius=2, fill=(249, 247, 255, alpha))
        elif slug == "boss-telegraph-ring":
            margin_x = 12 + int(math.sin(phase * math.tau) * 4)
            margin_y = 12 + int(math.sin(phase * math.tau) * 2)
            draw.ellipse((margin_x, margin_y, w - margin_x, h - margin_y), outline=(255, 71, 111, 210), width=4)
            draw.ellipse((margin_x + 10, margin_y + 7, w - margin_x - 10, h - margin_y - 7), outline=(255, 232, 77, 110), width=2)
        elif slug == "level-up-burst":
            radius = 10 + int(phase * 48)
            for spoke in range(12):
                angle = spoke / 12 * math.tau + phase * 0.4
                x2 = cx + math.cos(angle) * radius
                y2 = cy + math.sin(angle) * radius
                draw.line((cx, cy, x2, y2), fill=(255, 232, 77, int(220 * (1 - phase * 0.45))), width=3)
            draw.ellipse((cx - radius // 3, cy - radius // 3, cx + radius // 3, cy + radius // 3), outline=(25, 247, 255, 180), width=3)
        else:
            for spoke in range(9):
                angle = spoke / 9 * math.tau + phase
                length = 8 + int(phase * 22) + spoke % 4
                x1 = cx + math.cos(angle) * 5
                y1 = cy + math.sin(angle) * 5
                x2 = cx + math.cos(angle) * length
                y2 = cy + math.sin(angle) * length
                draw.line((x1, y1, x2, y2), fill=(255, 123, 47, int(230 * (1 - phase * 0.5))), width=3)
        path = OUT / "vfx" / slug / f"frame-{index:02d}.png"
        path.parent.mkdir(parents=True, exist_ok=True)
        image.save(path)
        frames.append({"src": rel(path), "durationMs": round(1000 / fps), "index": index})
    return {"slug": slug, "role": "vfx", "fps": fps, "frameCount": count, "frames": frames, "loop": slug in {"boss-telegraph-ring"}}



def sorted_directional_images(asset: dict[str, Any]) -> list[dict[str, Any]]:
    images = []
    for index, image in enumerate(asset.get("images", [])):
        src = image.get("src", "")
        if src and portal_path(src).exists():
            images.append({**image, "direction": direction_from_src(src, index)})
    return sorted(images, key=lambda image: DIRECTION_ORDER.index(image["direction"]) if image["direction"] in DIRECTION_ORDER else 99)


def save_rotating_object_frames(
    asset: dict[str, Any],
    out_slug: str,
    category: str,
    role: str,
    canvas_size: tuple[int, int],
    max_sprite: int,
    frame_duration_ms: int,
) -> dict[str, Any] | None:
    images = sorted_directional_images(asset)
    if not images:
        return None
    out_dir = OUT / category / out_slug
    frames = []
    for index, image in enumerate(images):
        source = Image.open(portal_path(image["src"])).convert("RGBA")
        sprite = fit_sprite(source, max_sprite)
        canvas = transparent_canvas(canvas_size)
        y_pad = 10 if canvas_size[1] <= 130 else 14
        x = canvas_size[0] // 2 - sprite.width // 2
        y = canvas_size[1] - sprite.height - y_pad
        shadow = transparent_canvas(canvas_size)
        draw = ImageDraw.Draw(shadow, "RGBA")
        shadow_w = max(18, int(sprite.width * 0.72))
        shadow_h = max(5, int(sprite.height * 0.09))
        shadow_x = canvas_size[0] // 2 - shadow_w // 2
        shadow_y = min(canvas_size[1] - y_pad + 1, y + sprite.height - max(7, shadow_h // 2))
        draw.ellipse((shadow_x, shadow_y, shadow_x + shadow_w, shadow_y + shadow_h), fill=(0, 0, 0, 92))
        canvas = Image.alpha_composite(shadow, canvas)
        canvas.alpha_composite(sprite, (x, y))
        path = out_dir / f"{index:02d}-{image['direction']}.png"
        path.parent.mkdir(parents=True, exist_ok=True)
        canvas.save(path)
        frames.append({
            "src": rel(path),
            "durationMs": frame_duration_ms,
            "index": index,
            "direction": image["direction"],
            "sourceSrc": image["src"],
            "width": canvas_size[0],
            "height": canvas_size[1],
        })
    return {
        "id": out_slug,
        "slug": out_slug,
        "name": asset.get("name", out_slug),
        "role": role,
        "sourceJobKey": asset.get("jobKey"),
        "fps": round(1000 / frame_duration_ms, 2),
        "frameDurationMs": frame_duration_ms,
        "frameCount": len(frames),
        "frames": frames,
    }

def save_cabinet_frames(by_slug: dict[str, dict[str, Any]]) -> dict[str, Any]:
    pixellab_cabinet = save_rotating_object_frames(
        by_slug.get("hard-money-heroes-arcade-cabinet-8dir", {}),
        "hard-money-heroes-pixellab-cabinet",
        "cabinet",
        "arcade_cabinet",
        (220, 260),
        220,
        120,
    )
    if pixellab_cabinet:
        return {**pixellab_cabinet, "id": "hard-money-heroes-production-cabinet"}
    frames = []
    w, h = 180, 260
    for index in range(8):
        phase = index / 8
        lean = math.sin(phase * math.tau) * 10
        side = math.cos(phase * math.tau)
        image = transparent_canvas((w, h))
        draw = ImageDraw.Draw(image, "RGBA")
        cx = w // 2 + int(lean * 0.35)
        top_w = 82 + int(abs(side) * 18)
        body_w = 112 + int(abs(side) * 22)
        screen_w = 76 + int(abs(side) * 12)
        draw.ellipse((34, h - 24, w - 34, h - 8), fill=(0, 0, 0, 105))
        draw.polygon([(cx - top_w // 2, 22), (cx + top_w // 2, 22), (cx + body_w // 2, 214), (cx - body_w // 2, 214)], fill=(7, 12, 30, 245), outline=(25, 247, 255, 220))
        draw.polygon([(cx - top_w // 2 + 8, 32), (cx + top_w // 2 - 8, 32), (cx + top_w // 2 - 12, 70), (cx - top_w // 2 + 12, 70)], fill=(18, 31, 55, 235), outline=(255, 232, 77, 180))
        draw.rounded_rectangle((cx - screen_w // 2, 82, cx + screen_w // 2, 148), radius=8, fill=(3, 7, 17, 255), outline=(184, 108, 255, 200), width=3)
        draw.rectangle((cx - screen_w // 2 + 8, 96, cx + screen_w // 2 - 8, 134), fill=(25, 247, 255, 35))
        draw.rectangle((cx - body_w // 2 + 17, 158, cx + body_w // 2 - 17, 184), fill=(18, 31, 55, 235), outline=(69, 255, 138, 160))
        for n, color in enumerate([(255, 71, 111, 230), (255, 232, 77, 230), (25, 247, 255, 230)]):
            draw.ellipse((cx + 5 + n * 15, 164, cx + 15 + n * 15, 174), fill=color)
        draw.rectangle((cx - 38, 165, cx - 8, 171), fill=(249, 247, 255, 160))
        draw.polygon([(cx - body_w // 2, 214), (cx + body_w // 2, 214), (cx + body_w // 2 - 12, 244), (cx - body_w // 2 + 12, 244)], fill=(4, 11, 26, 250), outline=(25, 247, 255, 140))
        glow = image.filter(ImageFilter.GaussianBlur(3))
        image = Image.alpha_composite(glow.point(lambda value: int(value * 0.18)), image)
        path = OUT / "cabinet" / f"hard-money-heroes-cabinet-{index:02d}.png"
        path.parent.mkdir(parents=True, exist_ok=True)
        image.save(path)
        frames.append({"src": rel(path), "durationMs": 110, "index": index, "direction": DIRECTION_ORDER[index]})
    return {"id": "hard-money-heroes-production-cabinet", "role": "arcade_cabinet", "fps": 9, "frameDurationMs": 110, "frames": frames}


def main() -> None:
    data = load_pixellab_manifest()
    by_slug = asset_by_slug(data)
    OUT.mkdir(parents=True, exist_ok=True)

    characters: dict[str, Any] = {}
    for key, slug in CHARACTER_BINDINGS.items():
        asset = by_slug.get(slug)
        if not asset or not asset.get("images"):
            continue
        images = []
        for idx, img in enumerate(asset["images"]):
            src = img["src"]
            if portal_path(src).exists():
                images.append({**img, "direction": direction_from_src(src, idx)})
        if not images:
            continue
        east = next((img for img in images if img["direction"] == "east"), images[0])
        animations = save_character_animation(slug, east["src"], asset.get("role", "character"))
        characters[key] = {
            "slug": slug,
            "name": asset.get("name", slug),
            "role": asset.get("role"),
            "sourceJobKey": asset.get("jobKey"),
            "directions": images,
            "stills": {img["direction"]: img["src"] for img in images},
            "animations": animations,
            "anchor": {"x": 0.5, "y": 0.86},
        }

    tiles = []
    props = []
    source_pickups = []
    source_ui = []
    source_vfx_by_slug = {}
    rotating_props = []
    for asset in data.get("assets", []):
        if not asset.get("images"):
            continue
        image = asset["images"][0]
        record = {
            "slug": asset["slug"],
            "name": asset.get("name"),
            "role": asset.get("role"),
            "src": image["src"],
            "width": image.get("width"),
            "height": image.get("height"),
            "sourceJobKey": asset.get("jobKey"),
        }
        role = asset.get("role") or ""
        if asset.get("assetType") == "isometric_tile":
            tiles.append(record)
        elif asset.get("assetType") == "rotating_object" and role != "arcade_cabinet":
            rotating = save_rotating_object_frames(
                asset,
                asset["slug"],
                "rotating-props",
                role or "rotating_prop",
                (112, 112),
                104,
                120,
            )
            if rotating:
                rotating_props.append(rotating)
                props.append({
                    "slug": asset["slug"],
                    "name": asset.get("name"),
                    "role": role,
                    "src": rotating["frames"][0]["src"],
                    "width": rotating["frames"][0]["width"],
                    "height": rotating["frames"][0]["height"],
                    "frames": rotating["frames"],
                    "fps": rotating["fps"],
                    "frameDurationMs": rotating["frameDurationMs"],
                    "sourceJobKey": asset.get("jobKey"),
                })
        elif asset.get("assetType") == "map_object" and role == "pickup":
            source_pickups.append(record)
        elif asset.get("assetType") == "map_object" and role in {"ui", "mobile_ui"}:
            source_ui.append(record)
        elif asset.get("assetType") == "map_object" and role == "vfx":
            source_vfx_by_slug[asset["slug"]] = record
        elif asset.get("assetType") == "map_object" and role.startswith("prop_"):
            props.append(record)

    source_ui_slugs = {item["slug"] for item in source_ui}
    source_pickup_slugs = {item["slug"] for item in source_pickups}
    ui = [
        *[save_ui_asset(slug, size) for slug, size in UI_ASSETS.items() if slug not in source_ui_slugs],
        *source_ui,
    ]
    pickups = [
        *[save_pickup_asset(slug, size) for slug, size in PICKUP_ASSETS.items() if slug not in source_pickup_slugs],
        *source_pickups,
    ]
    weapons = [save_weapon_asset(slug, size) for slug, size in WEAPON_ASSETS.items()]
    vfx = []
    for slug, (w, h, count, fps) in VFX_ASSETS.items():
        item = save_vfx_asset(slug, (w, h), count, fps)
        if slug in source_vfx_by_slug:
            item["sourceStill"] = source_vfx_by_slug[slug]
        vfx.append(item)
    cabinet = save_cabinet_frames(by_slug)

    payload = {
        "source": "PixelLab wave 1 plus deterministic Python/Pillow UI and animation derivatives",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "targetFps": TARGET_FPS,
        "sourceManifest": rel(PIXELLAB_MANIFEST),
        "contactSheet": data.get("contactSheet"),
        "characters": characters,
        "tiles": tiles,
        "props": props,
        "rotatingProps": rotating_props,
        "pickups": pickups,
        "weapons": weapons,
        "vfx": vfx,
        "ui": ui,
        "cabinet": cabinet,
        "levels": LEVELS,
        "animationPass": {
            "hero": "8-frame idle, 12-frame run, 8-frame shoot, hit, and death loops generated from Lester PixelLab source art",
            "enemies": "same loop families generated for enemy, mini-boss, and boss silhouettes",
            "ui": "PixelLab cabinet rotation, rotating loot container, level-up modal, XP bar, mobile controls, pickup, weapon, and VFX frame metadata included",
            "rendering": "nearest-neighbor pixel rendering at 60fps with per-sprite fps metadata",
        },
    }
    MANIFEST.write_text(
        "export const HMH_PRODUCTION_ART_PASS = Object.freeze(" + json.dumps(payload, indent=2) + ");\n",
        encoding="utf-8",
    )

    DOC.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# Hard Money Heroes — Production Art Pass",
        "",
        f"Generated: {payload['generatedAt']}",
        "",
        "## Scope",
        "",
        "This generated pack promotes the PixelLab isometric source art into runtime-ready assets: high-frame-rate character loops, enemy/boss loops, level tiles/props, pickups, weapons, VFX, UI frames, mobile controls, and an animated cabinet.",
        "",
        "## Counts",
        "",
        f"- Characters with derived animation loops: {len(characters)}",
        f"- Level tile sprites: {len(tiles)}",
        f"- Prop sprites: {len(props)}",
        f"- Rotating prop sets: {len(rotating_props)}",
        f"- Pickup sprites: {len(pickups)}",
        f"- Weapon sprites: {len(weapons)}",
        f"- VFX animations: {len(vfx)}",
        f"- UI sprites: {len(ui)}",
        f"- Cabinet rotation frames: {len(cabinet['frames'])}",
        f"- Cabinet source: {cabinet.get('sourceJobKey', 'deterministic fallback')}",
        "",
        "## Runtime manifest",
        "",
        f"`{MANIFEST.relative_to(ROOT).as_posix()}`",
        "",
        "## QA notes",
        "",
        "- The remote PixelLab job cap is not a blocker for UI/cabinet/VFX because those are generated locally from deterministic design primitives.",
        "- Character/enemy/boss animation frames are derivative runtime loops from checked-in PixelLab source sprites.",
        "- No secret, credential, or local absolute source path is written to the public manifest.",
    ]
    DOC.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({
        "manifest": MANIFEST.relative_to(ROOT).as_posix(),
        "doc": DOC.relative_to(ROOT).as_posix(),
        "characters": len(characters),
        "tiles": len(tiles),
        "props": len(props),
        "rotatingProps": len(rotating_props),
        "pickups": len(pickups),
        "weapons": len(weapons),
        "vfx": len(vfx),
        "ui": len(ui),
        "cabinetFrames": len(cabinet["frames"]),
    }, indent=2))


if __name__ == "__main__":
    main()

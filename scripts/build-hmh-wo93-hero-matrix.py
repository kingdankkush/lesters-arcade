#!/usr/bin/env python3
"""Build WO-93 Lester/Lilly 8-direction hero matrix pilot frames.

This is a deterministic, reference-first production pass. It does not invent new
identity; it normalizes approved canon refs into transparent fixed-canvas frames
for every required gameplay state/direction, then writes sprite-pipeline style
manifests and contact sheets.
"""

from __future__ import annotations

import json
import math
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFont, ImageOps

REPO = Path(__file__).resolve().parents[1]
CANON_MANIFEST = REPO / "docs" / "art" / "canon" / "hero-canon-manifest.json"
OUT_ROOT = REPO / "apps" / "portal" / "assets" / "generated" / "hmh-hero-matrix" / "wo93-v1"
DOC_PATH = REPO / "docs" / "game-design" / "hmh-wo93-hero-matrix.md"

DIRECTIONS = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"]
STATES = {
    "idle": {"frames": 4, "fps": 6, "loop": True, "role": "idle"},
    "walk": {"frames": 6, "fps": 10, "loop": True, "role": "walk"},
    "run": {"frames": 6, "fps": 14, "loop": True, "role": "run"},
    "shoot-pistol": {"frames": 4, "fps": 16, "loop": False, "role": "pistol"},
    "shoot-shotgun": {"frames": 4, "fps": 14, "loop": False, "role": "shotgun"},
    "shoot-mg": {"frames": 4, "fps": 18, "loop": False, "role": "machine-gun"},
    "melee": {"frames": 4, "fps": 16, "loop": False, "role": "melee-knife"},
    "throw-grenade": {"frames": 4, "fps": 14, "loop": False, "role": "grenade"},
    "hurt": {"frames": 2, "fps": 10, "loop": False, "role": "idle"},
    "death": {"frames": 4, "fps": 8, "loop": False, "role": "idle"},
    "dash": {"frames": 3, "fps": 18, "loop": False, "role": "run"},
    "victory": {"frames": 4, "fps": 8, "loop": True, "role": "idle"},
}
FRAME_SIZE = {
    "lester": (128, 128),
    "lilly": (128, 128),
}
FIT_HEIGHT = {
    "lester": 92,
    "lilly": 98,
}
LOOK = {
    "lester": "blue spherical head/helmet, white Litecoin-style L mark, compact arcade commando body",
    "lilly": "teal hair, glasses, gold/teal tactical companion armor",
}

@dataclass(frozen=True)
class SourceChoice:
    path: Path
    role: str
    direction: str
    id: str
    mirrored: bool = False
    source_note: str = "direct"


def load_manifest() -> dict[str, Any]:
    return json.loads(CANON_MANIFEST.read_text(encoding="utf-8"))


def choose_entry(entries: list[dict[str, Any]], role: str, direction: str, hero: str) -> SourceChoice:
    # Prefer exact role+direction, then role+front/side, then idle/reference.
    candidates = []
    for e in entries:
        score = 0
        if e["role"] == role:
            score += 100
        elif role == "pistol" and hero == "lester" and e["role"] == "machine-gun":
            score += 70
        elif role == "pistol" and hero == "lester" and e["role"] == "reference":
            score += 18
        elif role in ("walk", "run", "idle") and e["role"] in (role, "reference"):
            score += 75
        elif role in ("idle", "run") and e["role"] == "character-sheet":
            score += 20
        elif e["role"] == "idle":
            score += 10
        else:
            continue
        if e["direction"] == direction:
            score += 40
        elif direction in ("south-east", "south-west") and e["direction"] == "south":
            score += 28
        elif direction in ("east", "north-east") and e["direction"] == "east":
            score += 32
        elif direction in ("west", "north-west") and e["direction"] == "west":
            score += 32
        elif direction == "east" and e["direction"] == "west":
            score += 22
        elif direction == "west" and e["direction"] == "east":
            score += 22
        elif direction == "north" and e["direction"] == "turnaround":
            score += 24
        elif e["direction"] == "unspecified":
            score += 8
        if "copy" in e["id"]:
            score -= 2
        if e["role"] == "character-sheet" and role != "idle":
            score -= 25
        candidates.append((score, e))
    if not candidates:
        raise ValueError(f"No candidate for {hero} {role} {direction}")
    candidates.sort(key=lambda item: (item[0], item[1]["width"] * item[1]["height"]), reverse=True)
    entry = candidates[0][1]
    mirrored = False
    note = "direct"
    if direction in ("east", "north-east", "south-east") and entry["direction"] == "west":
        mirrored = True
        note = "mirrored-west-source"
    elif direction in ("west", "north-west", "south-west") and entry["direction"] == "east":
        mirrored = True
        note = "mirrored-east-source"
    return SourceChoice(REPO / entry["repo_path"], entry["role"], entry["direction"], entry["id"], mirrored, note)


def alpha_from_edges(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    alpha = rgba.getchannel("A")
    if alpha.getextrema()[0] < 250:
        return rgba
    pix = rgba.load()
    w, h = rgba.size
    visited = bytearray(w * h)
    stack = []
    for x in range(w):
        stack.append((x, 0, pix[x, 0][:3]))
        stack.append((x, h - 1, pix[x, h - 1][:3]))
    for y in range(h):
        stack.append((0, y, pix[0, y][:3]))
        stack.append((w - 1, y, pix[w - 1, y][:3]))
    out_alpha = Image.new("L", (w, h), 255)
    ap = out_alpha.load()
    tol = 42
    while stack:
        x, y, seed = stack.pop()
        if x < 0 or y < 0 or x >= w or y >= h:
            continue
        idx = y * w + x
        if visited[idx]:
            continue
        visited[idx] = 1
        r, g, b = pix[x, y][:3]
        dist = abs(r - seed[0]) + abs(g - seed[1]) + abs(b - seed[2])
        # Most source backgrounds are white, gray, checkerboard, or very dark transparent previews.
        bg_like = dist <= tol or (r > 210 and g > 210 and b > 210) or (abs(r - g) < 8 and abs(g - b) < 8 and r < 45)
        if not bg_like:
            continue
        ap[x, y] = 0
        stack.append((x + 1, y, seed))
        stack.append((x - 1, y, seed))
        stack.append((x, y + 1, seed))
        stack.append((x, y - 1, seed))
    rgba.putalpha(ImageChops.multiply(alpha, out_alpha))
    return rgba


def crop_foreground(img: Image.Image) -> Image.Image:
    rgba = alpha_from_edges(img)
    alpha = rgba.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        return rgba
    return rgba.crop(bbox)


def existing_canonical_frame(hero: str, role: str, frame: int) -> Path | None:
    role_dir = role
    if role_dir not in ("idle", "walk", "run"):
        return None
    root = REPO / "apps" / "portal" / "assets" / "generated" / "hmh-canonical-art" / hero / role_dir
    if not root.exists():
        return None
    frames = sorted(root.glob("*.png"))
    if not frames:
        return None
    return frames[frame % len(frames)]


def normalize_to_frame(src: Path, hero: str, direction: str, mirrored: bool) -> Image.Image:
    with Image.open(src) as img:
        fg = crop_foreground(img)
    if mirrored:
        fg = ImageOps.mirror(fg)
    # If a character sheet survived as a wide crop, center-crop the most character-like vertical band.
    if fg.width > fg.height * 1.25:
        side = int(min(fg.width, fg.height * 0.72))
        left = max(0, (fg.width - side) // 2)
        fg = fg.crop((left, 0, left + side, fg.height))
    target_h = FIT_HEIGHT[hero]
    scale = min((FRAME_SIZE[hero][0] - 18) / max(1, fg.width), target_h / max(1, fg.height))
    nw = max(1, int(fg.width * scale))
    nh = max(1, int(fg.height * scale))
    fg = fg.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", FRAME_SIZE[hero], (0, 0, 0, 0))
    x = (canvas.width - fg.width) // 2
    y = canvas.height - fg.height - 10
    if direction in ("east", "north-east", "south-east"):
        x += 3
    elif direction in ("west", "north-west", "south-west"):
        x -= 3
    canvas.alpha_composite(fg, (x, y))
    return canvas


def animation_variant(base: Image.Image, state: str, frame: int, total: int) -> Image.Image:
    canvas = Image.new("RGBA", base.size, (0, 0, 0, 0))
    phase = 0 if total <= 1 else frame / (total - 1)
    dx = 0
    dy = 0
    img = base
    if state in ("idle", "victory"):
        dy = int(round(math.sin(frame / max(1, total) * math.tau) * 1.5))
    elif state == "walk":
        dx = int(round(math.sin(frame / max(1, total) * math.tau) * 2))
        dy = -1 if frame % 2 else 1
    elif state == "run":
        dx = int(round(math.sin(frame / max(1, total) * math.tau) * 3))
        dy = -2 if frame % 2 else 1
    elif state == "dash":
        dx = int((phase - 0.5) * 8)
        img = ImageEnhance.Brightness(base).enhance(1.05)
    elif state.startswith("shoot"):
        dx = int((0.5 - phase) * 3)
        if frame == 1:
            img = ImageEnhance.Contrast(base).enhance(1.12)
    elif state in ("melee", "throw-grenade"):
        dx = int((phase - 0.35) * 6)
        dy = -1 if frame in (1, 2) else 0
    elif state == "hurt":
        overlay = Image.new("RGBA", base.size, (255, 52, 44, 46 if frame == 0 else 20))
        img = Image.alpha_composite(base, overlay)
        dx = -2 if frame == 0 else 2
    elif state == "death":
        angle = -8 * phase
        img = base.rotate(angle, resample=Image.Resampling.BICUBIC, center=(base.width // 2, base.height - 16))
        dy = int(phase * 10)
    canvas.alpha_composite(img, (dx, dy))
    return canvas


def rel(path: Path) -> str:
    return path.relative_to(REPO).as_posix()


def build_event_anchors(hero: str) -> dict[str, Any]:
    # Approximate bottom-center anchored points for 128x128 frames. These are
    # intentionally conservative and per-direction so projectile/VFX code can
    # attach to the correct side without renderer-specific conditionals.
    by_direction = {
        "south": {"muzzle": [82, 74], "mainHand": [78, 76], "offHand": [52, 76], "feet": [64, 118]},
        "south-east": {"muzzle": [91, 72], "mainHand": [82, 76], "offHand": [58, 77], "feet": [64, 118]},
        "east": {"muzzle": [96, 73], "mainHand": [84, 77], "offHand": [62, 78], "feet": [64, 118]},
        "north-east": {"muzzle": [89, 69], "mainHand": [80, 75], "offHand": [59, 77], "feet": [64, 118]},
        "north": {"muzzle": [72, 69], "mainHand": [76, 75], "offHand": [54, 76], "feet": [64, 118]},
        "north-west": {"muzzle": [39, 69], "mainHand": [48, 75], "offHand": [69, 77], "feet": [64, 118]},
        "west": {"muzzle": [32, 73], "mainHand": [44, 77], "offHand": [66, 78], "feet": [64, 118]},
        "south-west": {"muzzle": [37, 72], "mainHand": [46, 76], "offHand": [70, 77], "feet": [64, 118]},
    }
    if hero == "lilly":
        # Lilly's taller hair shifts readable weapon/hand anchors down slightly.
        return {direction: {key: [value[0], value[1] + (2 if key != "feet" else 0)] for key, value in anchors.items()} for direction, anchors in by_direction.items()}
    return by_direction


def build_state_events() -> dict[str, Any]:
    return {
        "shoot-pistol": [{"frame": 1, "event": "muzzle-flash", "anchor": "muzzle"}, {"frame": 1, "event": "shell-casing", "anchor": "mainHand"}],
        "shoot-shotgun": [{"frame": 1, "event": "muzzle-flash-heavy", "anchor": "muzzle"}, {"frame": 2, "event": "pump", "anchor": "mainHand"}],
        "shoot-mg": [{"frame": 1, "event": "muzzle-flash-auto", "anchor": "muzzle"}, {"frame": 2, "event": "shell-casing", "anchor": "mainHand"}],
        "melee": [{"frame": 1, "event": "slash-start", "anchor": "mainHand"}, {"frame": 2, "event": "slash-active", "anchor": "mainHand"}],
        "throw-grenade": [{"frame": 1, "event": "grenade-windup", "anchor": "mainHand"}, {"frame": 2, "event": "grenade-release", "anchor": "mainHand"}],
        "walk": [{"frame": 1, "event": "footstep", "anchor": "feet"}, {"frame": 4, "event": "footstep", "anchor": "feet"}],
        "run": [{"frame": 1, "event": "footstep", "anchor": "feet"}, {"frame": 4, "event": "footstep", "anchor": "feet"}],
        "dash": [{"frame": 0, "event": "dash-start", "anchor": "feet"}],
        "death": [{"frame": 3, "event": "death-settle", "anchor": "feet"}],
    }


def write_contact_sheet(hero: str, manifest: dict[str, Any], samples: list[tuple[str, str, Path]]) -> Path:
    cell = 96
    label_h = 32
    cols = len(DIRECTIONS)
    rows = len(STATES)
    sheet = Image.new("RGB", (cols * cell, rows * (cell + label_h)), (13, 15, 23))
    draw = ImageDraw.Draw(sheet, "RGBA")
    try:
        font = ImageFont.truetype("arial.ttf", 9)
    except Exception:
        font = ImageFont.load_default()
    sample_map = {(state, direction): path for state, direction, path in samples}
    for r, state in enumerate(STATES):
        for c, direction in enumerate(DIRECTIONS):
            x = c * cell
            y = r * (cell + label_h)
            draw.rectangle([x, y, x + cell - 1, y + cell + label_h - 1], outline=(65, 90, 140, 160), width=1)
            path = sample_map[(state, direction)]
            img = Image.open(path).convert("RGBA")
            img.thumbnail((cell - 12, cell - 12), Image.Resampling.NEAREST)
            bg = Image.new("RGB", (cell, cell), (34, 36, 46))
            bg.paste(img, ((cell - img.width) // 2, cell - img.height - 5), img)
            sheet.paste(bg, (x, y))
            draw.text((x + 3, y + cell + 2), f"{state}\n{direction}", fill=(238, 242, 255), font=font)
    out = OUT_ROOT / hero / f"{hero}-wo93-matrix-contact-sheet.jpg"
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out, quality=92)
    return out


def build_hero(hero: str, entries: list[dict[str, Any]]) -> dict[str, Any]:
    hero_root = OUT_ROOT / hero
    if hero_root.exists():
        shutil.rmtree(hero_root)
    hero_root.mkdir(parents=True, exist_ok=True)
    states: dict[str, Any] = {}
    samples: list[tuple[str, str, Path]] = []
    provenance: list[dict[str, Any]] = []
    for state, cfg in STATES.items():
        state_frames: dict[str, list[str]] = {}
        for direction in DIRECTIONS:
            choice = choose_entry(entries, cfg["role"], direction, hero)
            frame_paths: list[str] = []
            out_dir = hero_root / state / direction
            out_dir.mkdir(parents=True, exist_ok=True)
            for i in range(cfg["frames"]):
                base_source = existing_canonical_frame(hero, cfg["role"], i)
                if base_source is not None:
                    base = normalize_to_frame(base_source, hero, direction, direction in ("west", "north-west", "south-west"))
                    source_id = f"existing-canonical-{cfg['role']}-{i:02d}"
                    source_role = cfg["role"]
                    source_direction = "south-derived"
                    source_note = "existing-single-frame"
                    mirrored = direction in ("west", "north-west", "south-west")
                else:
                    base = normalize_to_frame(choice.path, hero, direction, choice.mirrored)
                    source_id = choice.id
                    source_role = choice.role
                    source_direction = choice.direction
                    source_note = choice.source_note
                    mirrored = choice.mirrored
                frame = animation_variant(base, state, i, cfg["frames"])
                out = out_dir / f"{state}-{direction}-{i:02d}.png"
                frame.save(out)
                frame_paths.append(f"./assets/generated/hmh-hero-matrix/wo93-v1/{hero}/{state}/{direction}/{out.name}")
                if i == 0:
                    samples.append((state, direction, out))
            state_frames[direction] = frame_paths
            provenance.append({
                "state": state,
                "direction": direction,
                "sourceId": source_id,
                "sourceRole": source_role,
                "sourceDirection": source_direction,
                "mirrored": mirrored,
                "sourceNote": source_note,
            })
        states[state] = {"fps": cfg["fps"], "loop": cfg["loop"], "frames": state_frames}
    manifest = {
        "id": f"{hero}-wo93-hero-matrix",
        "role": "hero",
        "frameSize": list(FRAME_SIZE[hero]),
        "anchor": "bottom-center",
        "directions": DIRECTIONS,
        "defaultDirection": "south",
        "targetFps": 60,
        "source": "WO-93 reference-first generated matrix from Justin-approved HERO_CANON refs",
        "look": LOOK[hero],
        "stateAliases": {
            "shoot": "shoot-mg",
            "attack": "shoot-mg",
            "grenade": "throw-grenade",
            "throw": "throw-grenade",
            "hit": "hurt",
        },
        "eventAnchors": build_event_anchors(hero),
        "stateEvents": build_state_events(),
        "atlas": {
            "mode": "loose-png-frames",
            "contactSheet": f"./assets/generated/hmh-hero-matrix/wo93-v1/{hero}/{hero}-wo93-matrix-contact-sheet.jpg",
            "prewarm": True,
        },
        "states": states,
        "provenance": provenance,
    }
    contact = write_contact_sheet(hero, manifest, samples)
    manifest["contactSheet"] = rel(contact)
    js_name = "HMH_WO93_LESTER_MATRIX" if hero == "lester" else "HMH_WO93_LILLY_MATRIX"
    mjs = hero_root / f"{hero}.mjs"
    state_config = {
        state: {"fps": cfg["fps"], "loop": cfg["loop"], "frames": cfg["frames"]}
        for state, cfg in STATES.items()
    }
    runtime_payload = {
        key: value for key, value in manifest.items()
        if key not in ("states", "provenance")
    }
    runtime_payload["provenance"] = {
        "mode": "expanded-json-sidecar",
        "path": f"./assets/generated/hmh-hero-matrix/wo93-v1/{hero}/{hero}.json",
    }
    mjs.write_text(
        "\n".join([
            f"// WO-93 generated 8-direction hero matrix for {hero}.",
            "// Compact runtime module: frame arrays are generated from STATE_CONFIG to keep dist/main.js under budget.",
            "// Expanded audit manifest is stored beside this file as JSON. Regenerate with scripts/build-hmh-wo93-hero-matrix.py.",
            f"const DIRECTIONS = Object.freeze({json.dumps(DIRECTIONS)});",
            f"const STATE_CONFIG = Object.freeze({json.dumps(state_config, separators=(',', ':'))});",
            f"const BASE = './assets/generated/hmh-hero-matrix/wo93-v1/{hero}';",
            "function pad(index) { return String(index).padStart(2, '0'); }",
            "function framesFor(state, direction, count) { return Array.from({ length: count }, (_, index) => `${BASE}/${state}/${direction}/${state}-${direction}-${pad(index)}.png`); }",
            "function buildStates() { return Object.fromEntries(Object.entries(STATE_CONFIG).map(([state, config]) => [state, Object.freeze({ fps: config.fps, loop: config.loop, frames: Object.freeze(Object.fromEntries(DIRECTIONS.map((direction) => [direction, Object.freeze(framesFor(state, direction, config.frames))]))) })])); }",
            f"export const {js_name} = Object.freeze({{...{json.dumps(runtime_payload, separators=(',', ':'))}, directions: DIRECTIONS, states: Object.freeze(buildStates())}});",
            "",
        ]),
        encoding="utf-8",
    )
    (hero_root / f"{hero}.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return {"hero": hero, "manifest": rel(mjs), "json": rel(hero_root / f"{hero}.json"), "contactSheet": rel(contact), "frames": sum(cfg["frames"] * len(DIRECTIONS) for cfg in STATES.values())}


def write_doc(results: list[dict[str, Any]]) -> None:
    lines = [
        "# HMH WO-93 — Hero 8-Direction Matrix",
        "",
        "Status: reference-first pilot matrix generated from Justin-approved HERO_CANON refs.",
        "",
        "This pass creates transparent fixed-canvas frames for every required state/direction so WO-94 runtime wiring can proceed against a complete manifest. It is deterministic and can be regenerated with `scripts/build-hmh-wo93-hero-matrix.py`.",
        "",
        "## Scope",
        "",
        f"- Directions: {', '.join(DIRECTIONS)}",
        f"- States: {', '.join(STATES.keys())}",
        "- Frame size: 128×128 PNG, bottom-center anchor",
        "- Source of truth: `docs/art/HERO_CANON.md` and `docs/art/canon/hero-canon-manifest.json`",
        "",
        "## Generated outputs",
        "",
        "| hero | frames | manifest | contact sheet |",
        "|---|---:|---|---|",
    ]
    for result in results:
        lines.append(f"| {result['hero']} | {result['frames']} | `{result['manifest']}` | `{result['contactSheet']}` |")
    lines += [
        "",
        "## QA notes",
        "",
        "- These are production-pipeline frames derived from approved refs, not generic lookalikes.",
        "- South/east/west weapon poses use direct source refs where available; diagonals/north directions use deterministic source selection/mirroring when no direct canon drawing exists.",
        "- WO-94 should wire these manifests behind the canonical actor import and run visual regression before replacing the current runtime hero actors.",
    ]
    DOC_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    data = load_manifest()
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    results = []
    for hero in ("lester", "lilly"):
        results.append(build_hero(hero, data["heroes"][hero]["entries"]))
    write_doc(results)
    print(json.dumps({"results": results, "doc": rel(DOC_PATH)}, indent=2))


if __name__ == "__main__":
    main()

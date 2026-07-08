#!/usr/bin/env python
"""Generate WO-117 HMH world/audio/VFX/UI polish assets.

Small repo-owned pixel-art utility pack for route readability, HUD objective
chips, minimap pips, coded VFX sync rings, boss warnings, and pickup-lane
polish. No downloaded pixels or source references are copied.
"""
from __future__ import annotations

import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps/portal/assets/generated/hmh-wo117-polish-pack"
DOC = ROOT / "docs/game-design/wo117-world-audio-vfx-ui-polish"

ASSETS = [
    {"key": "route-beacon-chevron", "kind": "world-cue", "role": "route", "size": (64, 32), "draw": "chevron", "notes": "Small cyan/gold road-edge route beacon for authored critical path turns."},
    {"key": "district-risk-chip", "kind": "ui-chrome", "role": "hud-objective", "size": (128, 40), "draw": "chip", "notes": "HUD objective chip backplate for current district/pressure read."},
    {"key": "minimap-objective-pip", "kind": "ui-chrome", "role": "minimap", "size": (24, 24), "draw": "pip", "notes": "High-contrast objective pip for fogged minimap routing."},
    {"key": "audio-vfx-sync-ring", "kind": "coded-vfx", "role": "sync", "size": (64, 64), "draw": "ring", "frames": 4, "frameMs": 64, "notes": "Short pulse ring for VFX events that also trigger SFX cues."},
    {"key": "boss-gate-warning-sigil", "kind": "coded-vfx", "role": "boss-warning", "size": (64, 64), "draw": "boss", "frames": 4, "frameMs": 72, "notes": "Boss gate warning sigil for BLACKOUT/Rug Pull Baron warning windows."},
    {"key": "pickup-lane-glint", "kind": "coded-vfx", "role": "pickup-lane", "size": (48, 32), "draw": "glint", "frames": 4, "frameMs": 56, "notes": "Small lane glint for pickup/extraction reward readability."},
]

COLORS = {
    "bg": (0, 0, 0, 0),
    "cyan": (25, 247, 255, 255),
    "gold": (255, 232, 77, 255),
    "pink": (255, 71, 111, 255),
    "green": (69, 255, 138, 255),
    "dark": (13, 16, 31, 235),
    "edge": (73, 86, 126, 255),
    "white": (249, 247, 255, 255),
}

def make_canvas(w: int, h: int) -> Image.Image:
    return Image.new("RGBA", (w, h), COLORS["bg"])

def draw_chevron(img: Image.Image, frame: int = 0) -> None:
    d = ImageDraw.Draw(img)
    shift = frame % 2
    d.polygon([(8+shift,16),(26+shift,5),(22+shift,13),(55,13),(59,19),(22+shift,19),(26+shift,27)], fill=COLORS["cyan"])
    d.line([(8+shift,16),(26+shift,5),(22+shift,13),(55,13)], fill=COLORS["gold"], width=2)
    d.rectangle((3,28,61,30), fill=(0,0,0,80))

def draw_chip(img: Image.Image, frame: int = 0) -> None:
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((2,4,125,35), radius=7, fill=COLORS["dark"], outline=COLORS["edge"], width=2)
    d.polygon([(8,20),(20,9),(33,20),(20,31)], fill=COLORS["gold"], outline=COLORS["cyan"])
    d.rectangle((42,13,112,17), fill=(25,247,255,180))
    d.rectangle((42,23,92,26), fill=(255,232,77,190))
    d.rectangle((118,12,121,28), fill=COLORS["pink"])

def draw_pip(img: Image.Image, frame: int = 0) -> None:
    d = ImageDraw.Draw(img)
    d.ellipse((2,2,21,21), fill=(13,16,31,245), outline=COLORS["cyan"], width=2)
    d.polygon([(12,4),(19,19),(12,15),(5,19)], fill=COLORS["gold"])

def draw_ring(img: Image.Image, frame: int = 0) -> None:
    d = ImageDraw.Draw(img)
    cx = cy = 32
    r = 12 + frame * 5
    d.ellipse((cx-r,cy-r,cx+r,cy+r), outline=(*COLORS["cyan"][:3], 230-frame*35), width=3)
    d.ellipse((24,24,40,40), outline=COLORS["gold"], width=2)
    d.line((10,32,22,32), fill=COLORS["cyan"], width=2)
    d.line((42,32,54,32), fill=COLORS["cyan"], width=2)

def draw_boss(img: Image.Image, frame: int = 0) -> None:
    d = ImageDraw.Draw(img)
    pulse = frame * 2
    d.polygon([(32,5+pulse),(57,31),(32,58-pulse),(7,31)], fill=(55,9,31,220), outline=COLORS["pink"])
    d.rectangle((20,24,44,38), fill=COLORS["dark"], outline=COLORS["gold"], width=2)
    d.line((16,17,48,47), fill=COLORS["pink"], width=3)
    d.line((48,17,16,47), fill=COLORS["pink"], width=3)

def draw_glint(img: Image.Image, frame: int = 0) -> None:
    d = ImageDraw.Draw(img)
    x = 11 + frame * 7
    d.line((4,24,44,24), fill=(0,0,0,80), width=3)
    d.polygon([(x,3),(x+4,13),(x+14,16),(x+4,20),(x,30),(x-4,20),(x-14,16),(x-4,13)], fill=COLORS["gold"])
    d.line((x-17,16,x+17,16), fill=COLORS["cyan"], width=2)

DRAWERS = {
    "chevron": draw_chevron,
    "chip": draw_chip,
    "pip": draw_pip,
    "ring": draw_ring,
    "boss": draw_boss,
    "glint": draw_glint,
}

def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    DOC.mkdir(parents=True, exist_ok=True)
    manifest_assets = []
    proof = Image.new("RGBA", (900, 220), (8, 6, 22, 255))
    pd = ImageDraw.Draw(proof)
    pd.text((20, 16), "WO-117 world/audio/VFX/UI polish pack", fill=COLORS["white"])
    pd.text((20, 36), "route cues, HUD chips, minimap pips, SFX/VFX sync, boss warning, pickup glints", fill=(180,199,255,255))
    x = 24
    for spec in ASSETS:
        w, h = spec["size"]
        frames = spec.get("frames", 1)
        frame_paths = []
        for frame in range(frames):
            img = make_canvas(w, h)
            DRAWERS[spec["draw"]](img, frame)
            suffix = f"-frame-{frame:02d}" if frames > 1 else ""
            filename = f"{spec['key']}{suffix}.png"
            img.save(OUT / filename)
            frame_paths.append(f"./assets/generated/hmh-wo117-polish-pack/{filename}")
        src = frame_paths[0]
        if frames > 1:
            sheet = Image.new("RGBA", (w * frames, h), COLORS["bg"])
            for frame, src_path in enumerate(frame_paths):
                sheet.alpha_composite(Image.open(OUT / Path(src_path).name), (frame * w, 0))
            sheet_name = f"{spec['key']}.png"
            sheet.save(OUT / sheet_name)
            src = f"./assets/generated/hmh-wo117-polish-pack/{sheet_name}"
        entry = {
            "key": spec["key"], "kind": spec["kind"], "role": spec["role"], "src": src,
            "width": w * frames if frames > 1 else w, "height": h,
            "frameWidth": w, "frameHeight": h, "frames": frames, "frameMs": spec.get("frameMs", 0),
            "frameList": [{"index": i, "src": p, "width": w, "height": h, "durationMs": spec.get("frameMs", 0)} for i, p in enumerate(frame_paths)],
            "sourcePolicy": "Original repo-owned WO-117 polish asset; no downloaded pixels copied.",
            "notes": spec["notes"],
        }
        manifest_assets.append(entry)
        thumb = Image.open(OUT / Path(frame_paths[0]).name).resize((w*2, h*2), Image.Resampling.NEAREST)
        pd.rectangle((x-6, 66, x+138, 190), fill=(13,16,31,255), outline=COLORS["edge"])
        proof.alpha_composite(thumb, (x + 16, 84))
        pd.text((x, 172), spec["key"][:22], fill=COLORS["gold"])
        x += 144
    manifest = {
        "id": "hmh-wo117-polish-pack-v1",
        "sourcePolicy": "Original repo-owned WO-117 world, audio/VFX sync, and UI polish pack; no downloaded pixels copied.",
        "assetCount": len(manifest_assets),
        "assets": manifest_assets,
    }
    (OUT / "hmh-wo117-polish-pack-manifest.mjs").write_text(
        "// Generated by scripts/generate-wo117-polish-pack.py.\n"
        f"export const HMH_WO117_POLISH_PACK = Object.freeze({json.dumps(manifest, indent=2)});\n",
        encoding="utf-8",
    )
    proof.save(DOC / "wo117-polish-proof.png")
    (DOC / "README.md").write_text(
        "# WO-117 World, Audio, VFX, and UI Polish\n\n"
        "Generated by `scripts/generate-wo117-polish-pack.py`. The pack adds small repo-owned, text-free polish assets for Level 1 route readability, HUD objective chips, minimap objective pips, SFX/VFX sync pulses, boss warning sigils, and pickup/extraction lane glints.\n\n"
        "The certification module binds these assets to authored route beats, central SFX cue registry rows, coded special effects, and UI surfaces so the work improves live gameworld readability instead of remaining a loose art dump.\n",
        encoding="utf-8",
    )
    (DOC / "wo117-polish-certification.json").write_text(json.dumps({"id": "hmh-wo117-world-audio-vfx-ui-polish-v1", "packId": manifest["id"], "assetCount": len(manifest_assets)}, indent=2) + "\n", encoding="utf-8")
    print(f"WO-117 generated {len(manifest_assets)} polish assets at {OUT.relative_to(ROOT)}")

if __name__ == "__main__":
    main()

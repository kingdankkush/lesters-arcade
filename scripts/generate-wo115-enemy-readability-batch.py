#!/usr/bin/env python
"""Generate WO-115 enemy readability batch-2 runtime frames.

Fills five Level-1 runtime-spawnable partial roster rows with repo-owned,
text-free, 8-direction matrices for readable combat states. This is a
continuation of the WO-109 batch pattern, focused on encounter/level-design
clarity for rifle, zealot, drone, disruptor, and turret roles.
"""
from __future__ import annotations

import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ROSTER = ROOT / "apps/portal/assets/generated/hmh-animated-roster"
LEDGER = ROSTER / "roster-ledger.json"
PROOF_DIR = ROOT / "docs/game-design/wo115-enemy-readability-batch"
DIRECTIONS = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"]
STATES = ["idle", "walk", "run", "attack-tell", "attack", "hit", "death", "spawn-in"]

BATCH = {
    "claim-jumper": {"role": "enemy", "body": (154, 103, 58, 255), "accent": (255, 218, 95, 255), "shape": "rifle"},
    "scam-cult-zealot": {"role": "enemy", "body": (119, 71, 190, 255), "accent": (255, 68, 115, 255), "shape": "zealot"},
    "sybil-drone": {"role": "enemy", "body": (70, 202, 230, 255), "accent": (255, 255, 120, 255), "shape": "drone"},
    "rug-rat": {"role": "enemy", "body": (151, 95, 54, 255), "accent": (255, 70, 92, 255), "shape": "rat"},
    "honeypot-turret": {"role": "enemy", "body": (226, 166, 55, 255), "accent": (255, 245, 137, 255), "shape": "turret"},
}

STATE_OFFSET = {
    "idle": (0, 0), "walk": (-1, 1), "run": (2, -1), "attack-tell": (0, -3),
    "attack": (4, -1), "hit": (-3, 0), "death": (0, 8), "spawn-in": (0, 5),
}
DIR_BIAS = {
    "south": (0, 2), "south-east": (3, 2), "east": (5, 0), "north-east": (3, -2),
    "north": (0, -3), "north-west": (-3, -2), "west": (-5, 0), "south-west": (-3, 2),
}

def px(draw: ImageDraw.ImageDraw, box, fill) -> None:
    draw.rectangle(tuple(int(v) for v in box), fill=fill)

def outline_shadow(draw: ImageDraw.ImageDraw, cx: int, floor: int) -> None:
    draw.ellipse((cx - 26, floor - 7, cx + 26, floor + 5), fill=(0, 0, 0, 64))

def draw_actor(actor: str, state: str, direction: str) -> Image.Image:
    spec = BATCH[actor]
    img = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    bx, by = DIR_BIAS[direction]
    sx, sy = STATE_OFFSET[state]
    cx = 48 + bx + sx
    floor = 78 + by + sy
    body = spec["body"]
    accent = spec["accent"]
    shade = tuple(max(0, c - 48) for c in body[:3]) + (255,)
    dark = (16, 18, 28, 255)
    warn = (255, 70, 105, 255) if state in {"attack-tell", "attack", "hit"} else accent
    outline_shadow(d, cx, floor)
    if state == "spawn-in":
        for r, a in [(34, 38), (25, 58), (15, 92)]:
            d.ellipse((cx-r, floor-r//4, cx+r, floor+r//4), outline=(*accent[:3], a), width=2)
    if spec["shape"] == "rifle":
        px(d, (cx-12, floor-43, cx+12, floor-10), body); px(d, (cx-9, floor-62, cx+9, floor-44), shade)
        px(d, (cx-17, floor-39, cx-11, floor-10), dark); px(d, (cx+10, floor-38, cx+16, floor-10), dark)
        px(d, (cx-8, floor-9, cx-2, floor), dark); px(d, (cx+3, floor-9, cx+9, floor), dark)
        px(d, (cx+11, floor-45, cx+35+(state == 'attack')*8, floor-40), warn)
        px(d, (cx+26, floor-48, cx+32, floor-36), accent)
    elif spec["shape"] == "zealot":
        px(d, (cx-13, floor-44, cx+13, floor-9), body); px(d, (cx-10, floor-62, cx+10, floor-44), shade)
        d.polygon([(cx-20, floor-42), (cx, floor-66), (cx+20, floor-42)], fill=shade)
        px(d, (cx-18, floor-34, cx-12, floor-12), shade); px(d, (cx+12, floor-34, cx+18, floor-12), shade)
        if state in {"attack-tell", "attack"}: d.arc((cx-31, floor-58, cx+31, floor-18), 200, 340, fill=warn, width=3)
        px(d, (cx-7, floor-54, cx-3, floor-50), accent); px(d, (cx+4, floor-54, cx+8, floor-50), accent)
    elif spec["shape"] == "drone":
        d.ellipse((cx-19, floor-48, cx+19, floor-20), fill=body, outline=shade, width=3)
        for ox in (-29, 29):
            d.ellipse((cx+ox-8, floor-44, cx+ox+8, floor-28), fill=dark)
            d.line((cx+ox-13, floor-36, cx+ox+13, floor-36), fill=accent, width=2)
        px(d, (cx-5, floor-34, cx+5, floor-29), warn)
        if state == "attack": d.line((cx+4, floor-31, cx+35, floor-20), fill=warn, width=3)
    elif spec["shape"] == "rat":
        d.ellipse((cx-23, floor-28, cx+21, floor-8), fill=body, outline=shade, width=3)
        d.ellipse((cx+10, floor-38, cx+29, floor-20), fill=shade)
        px(d, (cx+23, floor-31, cx+32+(state == 'attack')*8, floor-26), warn)
        d.line((cx-23, floor-17, cx-39, floor-12), fill=accent, width=3)
        for ox in (-13, 8): d.line((cx+ox, floor-13, cx+ox-5, floor), fill=dark, width=3)
    else:
        px(d, (cx-22, floor-34, cx+22, floor-8), body); px(d, (cx-16, floor-49, cx+16, floor-34), shade)
        px(d, (cx-26, floor-8, cx+26, floor-1), dark)
        px(d, (cx-10, floor-57, cx+10, floor-50), accent)
        px(d, (cx+18, floor-44, cx+38+(state == 'attack')*7, floor-38), warn)
        if state in {"attack-tell", "attack"}: d.rectangle((cx-27, floor-55, cx+27, floor-4), outline=(*warn[:3], 165), width=2)
    if state == "hit":
        d.rectangle((cx-30, floor-68, cx+30, floor+2), outline=(255, 255, 255, 145), width=2)
    if state == "death":
        img = img.rotate(-12 if spec["shape"] in {"rifle", "zealot"} else 13, resample=Image.Resampling.NEAREST, center=(cx, floor), fillcolor=(0,0,0,0))
    return img

def main() -> None:
    ledger = json.loads(LEDGER.read_text(encoding="utf-8"))
    PROOF_DIR.mkdir(parents=True, exist_ok=True)
    thumbs = []
    for actor, spec in BATCH.items():
        entry = ledger.setdefault(actor, {"role": spec["role"], "character_id": f"wo115-{actor}", "animations": {}})
        entry["role"] = spec["role"]
        entry.setdefault("character_id", f"wo115-{actor}")
        anims = entry.setdefault("animations", {})
        for state in STATES:
            dirs = anims.setdefault(state, {})
            for direction in DIRECTIONS:
                out_dir = ROSTER / actor / state / direction
                out_dir.mkdir(parents=True, exist_ok=True)
                out = out_dir / "00.png"
                draw_actor(actor, state, direction).save(out)
                dirs[direction] = [f"./assets/generated/hmh-animated-roster/{actor}/{state}/{direction}/00.png"]
        thumbs.append((actor, draw_actor(actor, "attack", "south-east")))
    LEDGER.write_text(json.dumps(ledger, indent=2) + "\n", encoding="utf-8")
    sheet = Image.new("RGBA", (1040, 278), (8, 6, 22, 255))
    sd = ImageDraw.Draw(sheet)
    sd.text((20, 18), "WO-115 enemy readability batch 2: Level 1 encounter clarity matrices", fill=(249,247,255,255))
    sd.text((20, 38), "claim-jumper, scam-cult-zealot, sybil-drone, rug-rat, honeypot-turret", fill=(180,199,255,255))
    for i, (actor, img) in enumerate(thumbs):
        x = 24 + i * 202
        sd.rectangle((x, 66, x+176, 250), outline=(58,68,94,255), fill=(13,16,31,255))
        sheet.alpha_composite(img.resize((144,144), Image.Resampling.NEAREST), (x+16, 78))
        sd.text((x+10, 234), actor, fill=(255,232,77,255))
    sheet.save(PROOF_DIR / "wo115-enemy-readability-batch2-proof.png")
    (PROOF_DIR / "README.md").write_text(
        "# WO-115 Enemy Readability Batch 2\n\n"
        "Generated by `scripts/generate-wo115-enemy-readability-batch.py`. This batch completes five Level 1 runtime-spawnable partial actors with repo-owned, text-free, 8-direction matrices for `idle`, `walk`, `run`, `attack-tell`, `attack`, `hit`, `death`, and `spawn-in`.\n\n"
        "The selected actors improve Level 1 encounter readability across rifle cover lanes, zealot fan-shot pressure, drone formation fire, rug-rat disruption, and stationary honeypot turret traps.\n",
        encoding="utf-8",
    )
    (ROOT / "docs/game-design/wo115-level-design-readability-lock.md").write_text(
        "# WO-115 Level Design Readability Lock\n\n"
        "WO-115 ties the next enemy-art batch to Level 1 encounter clarity. The completed actors cover five distinct lane/POI roles:\n\n"
        "- `claim-jumper`: ghost-town/residential cover-peek rifle lanes.\n"
        "- `scam-cult-zealot`: saloon/forest fan-shot mini-boss pressure.\n"
        "- `sybil-drone`: desert/city formation flyer pressure.\n"
        "- `rug-rat`: ghost-town/country-road low disruptor pressure.\n"
        "- `honeypot-turret`: country-road/city stationary trap silhouette.\n\n"
        "Each actor now has full 8-direction `idle`, `walk`, `run`, `attack-tell`, `attack`, `hit`, `death`, and `spawn-in` coverage, so authored districts can use their intended enemy roles without falling back to partial/missing combat reads.\n",
        encoding="utf-8",
    )
    print(f"WO-115 generated {len(BATCH)} actors into {ROSTER.relative_to(ROOT)}")

if __name__ == "__main__":
    main()

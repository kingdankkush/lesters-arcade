#!/usr/bin/env python
"""Generate WO-109 enemy redesign batch-1 runtime frames.

This is a deterministic repo-local fallback art generator for the first five
Level-1 spawnable roster gaps. It writes text-free pixel-art frame matrices under
apps/portal/assets/generated/hmh-animated-roster/<actor>/<state>/<direction>/
and updates roster-ledger.json so consolidate-hmh-roster-directions.py can rebuild
the runtime HMH_ANIMATED_ROSTER manifest.
"""
from __future__ import annotations

import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ROSTER = ROOT / "apps/portal/assets/generated/hmh-animated-roster"
LEDGER = ROSTER / "roster-ledger.json"
PROOF_DIR = ROOT / "docs/game-design/wo109-enemy-redesign-batch"
DIRECTIONS = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"]
STATES = ["idle", "walk", "run", "attack-tell", "attack", "hit", "death", "spawn-in"]

BATCH = {
    "crypto-bro-rusher": {"role": "enemy", "body": (67, 185, 255, 255), "accent": (255, 214, 79, 255), "shape": "humanoid"},
    "gas-beast-tank": {"role": "enemy", "body": (80, 207, 112, 255), "accent": (171, 255, 122, 255), "shape": "tank"},
    "evil-banker-ranged": {"role": "enemy", "body": (134, 92, 255, 255), "accent": (255, 236, 120, 255), "shape": "ranged"},
    "liquidation-cascade-golem": {"role": "enemy", "body": (109, 132, 166, 255), "accent": (255, 91, 126, 255), "shape": "golem"},
    "scorpion-ambusher": {"role": "enemy", "body": (213, 121, 48, 255), "accent": (255, 210, 83, 255), "shape": "scorpion"},
}

STATE_OFFSET = {
    "idle": (0, 0), "walk": (-1, 1), "run": (2, -1), "attack-tell": (0, -3),
    "attack": (4, -1), "hit": (-3, 0), "death": (0, 7), "spawn-in": (0, 4),
}
DIR_BIAS = {
    "south": (0, 2), "south-east": (3, 2), "east": (5, 0), "north-east": (3, -2),
    "north": (0, -3), "north-west": (-3, -2), "west": (-5, 0), "south-west": (-3, 2),
}

def px(draw, box, fill):
    draw.rectangle(tuple(int(v) for v in box), fill=fill)

def draw_actor(actor: str, state: str, direction: str) -> Image.Image:
    spec = BATCH[actor]
    img = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    bx, by = DIR_BIAS[direction]
    sx, sy = STATE_OFFSET[state]
    cx = 48 + bx + sx
    floor = 77 + sy
    body = spec["body"]
    accent = spec["accent"]
    shade = tuple(max(0, c - 42) for c in body[:3]) + (255,)
    dark = (18, 20, 33, 255)
    tell = (255, 80, 118, 255) if state in {"attack-tell", "attack", "hit"} else accent
    if state == "spawn-in":
        for r, a in [(32, 42), (24, 62), (16, 90)]:
            d.ellipse((cx-r, floor-r//3, cx+r, floor+r//3), outline=(*accent[:3], a), width=2)
    if spec["shape"] == "humanoid":
        px(d, (cx-10, floor-39, cx+10, floor-12), body); px(d, (cx-7, floor-58, cx+7, floor-42), body)
        px(d, (cx-14, floor-36, cx-9, floor-13), shade); px(d, (cx+9, floor-36, cx+14, floor-13), shade)
        px(d, (cx-8, floor-11, cx-2, floor), dark); px(d, (cx+2, floor-11, cx+8, floor), dark)
        px(d, (cx+12, floor-47, cx+25+(state == 'attack')*6, floor-42), tell)
        px(d, (cx-6, floor-53, cx-2, floor-49), dark); px(d, (cx+4, floor-53, cx+8, floor-49), dark)
    elif spec["shape"] == "tank":
        d.ellipse((cx-24, floor-37, cx+24, floor-3), fill=body, outline=shade, width=3)
        px(d, (cx-16, floor-55, cx+16, floor-31), body); px(d, (cx-23, floor-25, cx+23, floor-18), accent)
        for ox in (-18, 18): d.ellipse((cx+ox-7, floor-15, cx+ox+7, floor-1), fill=dark)
        if state in {"attack", "attack-tell"}: d.ellipse((cx+22, floor-45, cx+38, floor-29), outline=tell, width=3)
    elif spec["shape"] == "ranged":
        px(d, (cx-14, floor-42, cx+14, floor-8), body); px(d, (cx-10, floor-62, cx+10, floor-43), shade)
        px(d, (cx-20, floor-35, cx-14, floor-8), dark); px(d, (cx+14, floor-35, cx+20, floor-8), dark)
        px(d, (cx+12, floor-43, cx+36+(state == 'attack')*8, floor-38), tell); px(d, (cx+28, floor-47, cx+34, floor-34), accent)
        px(d, (cx-6, floor-55, cx-2, floor-51), accent); px(d, (cx+3, floor-55, cx+7, floor-51), accent)
    elif spec["shape"] == "golem":
        px(d, (cx-23, floor-48, cx+23, floor-9), body); px(d, (cx-16, floor-69, cx+16, floor-49), shade)
        for ox in (-27, 27): px(d, (cx+ox-8, floor-42, cx+ox+8, floor-12), shade)
        px(d, (cx-17, floor-8, cx-6, floor), dark); px(d, (cx+6, floor-8, cx+17, floor), dark)
        if state in {"attack", "attack-tell"}: d.line((cx-31, floor-54, cx+31, floor-54), fill=tell, width=3)
    else:
        d.ellipse((cx-24, floor-31, cx+24, floor-5), fill=body, outline=shade, width=3)
        for ox in (-26, -15, 15, 26): d.line((cx+ox, floor-15, cx+ox + (4 if ox > 0 else -4), floor+1), fill=dark, width=3)
        d.arc((cx+7, floor-58, cx+39, floor-18), 195, 330, fill=tell, width=4)
        px(d, (cx+24, floor-23, cx+36+(state == 'attack')*7, floor-17), tell)
    if state == "hit":
        d.rectangle((cx-28, floor-66, cx+28, floor+1), outline=(255, 255, 255, 130), width=2)
    if state == "death":
        img = img.rotate(11, resample=Image.Resampling.NEAREST, center=(cx, floor), fillcolor=(0,0,0,0))
    return img

def main() -> None:
    ledger = json.loads(LEDGER.read_text(encoding="utf-8"))
    PROOF_DIR.mkdir(parents=True, exist_ok=True)
    thumbs = []
    for actor, spec in BATCH.items():
        entry = ledger.setdefault(actor, {"role": spec["role"], "character_id": f"wo109-{actor}", "animations": {}})
        entry.setdefault("role", spec["role"])
        entry.setdefault("character_id", f"wo109-{actor}")
        anims = entry.setdefault("animations", {})
        for state in STATES:
            if actor == "scorpion-ambusher" and state == "death" and anims.get("death"):
                continue
            dirs = anims.setdefault(state, {})
            for direction in DIRECTIONS:
                out_dir = ROSTER / actor / state / direction
                out_dir.mkdir(parents=True, exist_ok=True)
                out = out_dir / "00.png"
                draw_actor(actor, state, direction).save(out)
                dirs[direction] = [f"./assets/generated/hmh-animated-roster/{actor}/{state}/{direction}/00.png"]
        thumbs.append((actor, draw_actor(actor, "attack", "south-east")))
    LEDGER.write_text(json.dumps(ledger, indent=2) + "\n", encoding="utf-8")
    sheet = Image.new("RGBA", (1040, 260), (8, 6, 22, 255))
    sd = ImageDraw.Draw(sheet)
    sd.text((20, 18), "WO-109 enemy redesign batch 1: five runtime-spawnable 8-dir matrices", fill=(249,247,255,255))
    for i, (actor, img) in enumerate(thumbs):
        x = 24 + i * 202
        sd.rectangle((x, 56, x+176, 232), outline=(58,68,94,255), fill=(13,16,31,255))
        sheet.alpha_composite(img.resize((144,144), Image.Resampling.NEAREST), (x+16, 72))
        sd.text((x+10, 214), actor, fill=(255,232,77,255))
    sheet.save(PROOF_DIR / "wo109-enemy-redesign-batch1-proof.png")
    (PROOF_DIR / "README.md").write_text(
        "# WO-109 Enemy Redesign Batch 1\n\n"
        "Generated by `scripts/generate-wo109-enemy-redesign-batch.py`. The batch fills five Level-1 runtime-spawnable roster gaps with repo-owned, text-free, 8-direction matrices for `idle`, `walk`, `run`, `attack-tell`, `attack`, `hit`, `death`, and `spawn-in`.\n\n"
        "The runtime consumes these frames through `hmh-animated-roster.mjs`; once renderable, `hmh-art-repair.mjs` stops auto-repairing these keys to old fallback actors.\n",
        encoding="utf-8",
    )
    print(f"WO-109 generated {len(BATCH)} actors into {ROSTER.relative_to(ROOT)}")

if __name__ == "__main__":
    main()

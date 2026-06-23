#!/usr/bin/env python
"""Create missing quadruped enemy characters on PixelLab and queue 8-dir animations.

PixelLab requires a `template` param for quadruped body type: bear, cat, dog, horse, lion.

Usage: python scripts/create-quadruped-enemies.py
"""
from __future__ import annotations

import asyncio
import json
import re
from pathlib import Path
from typing import Any

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

ROOT = Path(__file__).resolve().parents[1]
LEDGER = ROOT / "apps/portal/assets/generated/hmh-animated-roster/char-creation-ledger.json"

DIRECTIONS = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"]

STYLE = "isometric pixel art, high top-down 3/4 view, bold single-color dark outline, clean readable silhouette, transparent background"
PALETTE = "Litecoin silver and warm desert palette with subtle cyan accents"

# Quadruped characters: key -> (template, description)
# Templates: bear, cat, dog, horse, lion
QUAD_CHARS = [
    {
        "key": "coyote-pack-runner",
        "template": "dog",
        "description": f"lean hungry coyote pack runner, tawny brown fur with grey markings, pinned back ears, yellow eyes, low aggressive stance, {STYLE}, {PALETTE}, 96px game sprite",
        "size": 96,
    },
    {
        "key": "wild-boar",
        "template": "bear",
        "description": f"muscular wild boar charger, dark bristled brown fur, curved white tusks, heavy head-down charge stance, hoof-scrape ready, {STYLE}, {PALETTE}, 96px game sprite",
        "size": 96,
    },
    {
        "key": "buzzard",
        "template": "lion",
        "description": f"scavenger buzzard flyer, dark feathers with bald pink head, tattered wing spread, sharp talons, circling silhouette, {STYLE}, {PALETTE}, 96px game sprite",
        "size": 96,
    },
    {
        "key": "rattlesnake",
        "template": "cat",
        "description": f"diamondback rattlesnake, coiled tan and brown patterned body, raised head with flicking tongue, visible rattle tail, {STYLE}, {PALETTE}, 96px game sprite",
        "size": 96,
    },
    {
        "key": "scorpion-ambusher",
        "template": "lion",
        "description": f"large desert scorpion, armored dark teal carapace, raised stinger tail with venom glow, snapping pincers, {STYLE}, {PALETTE}, 96px game sprite",
        "size": 96,
    },
    {
        "key": "rug-rat",
        "template": "cat",
        "description": f"small sneaky rug rat enemy, tiny rolling rug body, beady red eyes, dragging carpet scrap tail, low scurrying silhouette, {STYLE}, {PALETTE}, 96px game sprite",
        "size": 96,
    },
]

ANIMATIONS = [
    ("idle", "idle breathing animation, subtle body movement, alert stance", 6),
    ("walk", "walking animation, steady forward movement, limb cycle", 8),
    ("run", "running animation, fast pursuit movement, aggressive stride", 8),
    ("attack", "attack animation, aggressive lunge or strike with telegraph wind-up", 6),
    ("hit", "hit reaction, flinch backward, damage taken response", 5),
    ("death", "death animation, collapse and dissolve into pixels or dust", 8),
]

UUID_RE = re.compile(r'[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}')


def load_server():
    d = json.loads((Path.home() / ".claude.json").read_text(encoding="utf-8"))
    for proj in d.get("projects", {}).values():
        srv = proj.get("mcpServers", {}).get("pixellab")
        if srv:
            return srv
    raise SystemExit("no pixellab server")


def load_ledger():
    if LEDGER.exists():
        return json.loads(LEDGER.read_text(encoding="utf-8"))
    return {}


def save_ledger(ledger):
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    LEDGER.write_text(json.dumps(ledger, indent=2), encoding="utf-8")


def text_of(res):
    return "\n".join(c.text for c in getattr(res, "content", []) or [] if hasattr(c, "text"))


async def count_processing(session, char_id):
    txt = text_of(await session.call_tool("get_character", {"character_id": char_id}))
    return txt.lower().count("processing")


async def main():
    server = load_server()
    ledger = load_ledger()

    print("=== Creating quadruped characters ===")
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (r, w, _):
        async with ClientSession(r, w) as session:
            await session.initialize()

            for spec in QUAD_CHARS:
                key = spec["key"]
                if key in ledger and ledger[key].get("character_id"):
                    print(f"  {key}: already created ({ledger[key]['character_id'][:12]}...), skipping")
                    continue

                print(f"  Creating: {key} (template={spec['template']})")
                args = {
                    "description": spec["description"],
                    "body_type": "quadruped",
                    "template": spec["template"],
                    "mode": "v3",
                    "n_directions": 8,
                    "size": spec["size"],
                    "view": "high top-down",
                    "outline": "single color outline",
                    "shading": "detailed shading",
                }
                try:
                    result = await session.call_tool("create_character", args)
                    text = text_of(result)
                    match = UUID_RE.search(text)
                    if match:
                        char_id = match.group(0)
                        ledger[key] = {"character_id": char_id, "animations": {}}
                        save_ledger(ledger)
                        print(f"    -> {char_id}")
                    else:
                        print(f"    -> ERROR: no UUID in response: {text[:300]}")
                except Exception as e:
                    print(f"    -> ERROR: {e}")
                await asyncio.sleep(3)

    print("\n=== Queuing animations ===")
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (r, w, _):
        async with ClientSession(r, w) as session:
            await session.initialize()

            for spec in QUAD_CHARS:
                key = spec["key"]
                char_data = ledger.get(key, {})
                char_id = char_data.get("character_id")
                if not char_id:
                    print(f"  {key}: no character_id, skipping")
                    continue

                anims = char_data.get("animations", {})

                for anim_name, anim_desc, frame_count in ANIMATIONS:
                    if anim_name in anims and anims[anim_name].get("queued"):
                        print(f"  {key}/{anim_name}: already queued, skipping")
                        continue

                    # Slot-aware: wait for processing count to drop
                    while True:
                        processing = await count_processing(session, char_id)
                        if processing < 4:
                            break
                        print(f"  {key}: {processing} processing, waiting 20s...", flush=True)
                        await asyncio.sleep(20)

                    try:
                        result = await session.call_tool("animate_character", {
                            "character_id": char_id,
                            "action_description": anim_desc,
                            "animation_name": anim_name,
                            "directions": DIRECTIONS,
                            "frame_count": frame_count,
                            "confirm_cost": True,
                        })
                        text = text_of(result)
                        ledger[key]["animations"][anim_name] = {"queued": True, "raw": text[:200]}
                        save_ledger(ledger)
                        print(f"  queued {key}/{anim_name}", flush=True)
                        await asyncio.sleep(3)
                    except Exception as e:
                        print(f"  ERROR {key}/{anim_name}: {e}", flush=True)
                        await asyncio.sleep(5)

    print("\n=== DONE ===")


asyncio.run(main())

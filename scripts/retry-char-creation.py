#!/usr/bin/env python3
"""Retry script: create missing characters and queue remaining animations.
Fixes: hit frame_count=6 (even), better slot management."""
import asyncio
import json
import os
import re
import time
from pathlib import Path
from mcp.client.streamable_http import streamablehttp_client
from mcp import ClientSession

LEDGER_PATH = os.path.join(os.path.dirname(__file__), "..", "apps", "portal", "assets", "generated", "hmh-animated-roster", "char-creation-ledger.json")
LEDGER_PATH = os.path.abspath(LEDGER_PATH)

STYLE_BASE = "isometric pixel art, high top-down 3/4 view, bold single-color dark outline, clean readable silhouette, transparent background"
PALETTE = "Litecoin silver and warm desert palette with subtle cyan accents"

# PixelLab v3 does not support quadruped character creation; pro/standard
# quadrupeds require a template. Keep old retry scripts aligned with the
# recreation pipeline so they do not produce broken no-rotation characters.
QUADRUPED_TEMPLATES = {
    "coyote-pack-runner": "dog",
    "wild-boar": "bear",
    "buzzard": "cat",
    "rattlesnake": "cat",
    "scorpion-ambusher": "cat",
    "rug-rat": "cat",
}

# Only the missing characters
MISSING_CHARACTERS = [
    {
        "key": "coyote-pack-runner",
        "description": f"lean hungry coyote pack runner, tawny brown fur with grey markings, pinned back ears, yellow eyes, low aggressive stance, {STYLE_BASE}, {PALETTE}, 96px game sprite",
        "body_type": "quadruped",
        "size": 96,
    },
    {
        "key": "wild-boar",
        "description": f"muscular wild boar charger, dark bristled brown fur, curved white tusks, heavy head-down charge stance, hoof-scrape ready, {STYLE_BASE}, {PALETTE}, 96px game sprite",
        "body_type": "quadruped",
        "size": 96,
    },
    {
        "key": "buzzard",
        "description": f"scavenger buzzard flyer, dark feathers with bald pink head, tattered wing spread, sharp talons, circling silhouette, {STYLE_BASE}, {PALETTE}, 96px game sprite",
        "body_type": "quadruped",
        "size": 96,
    },
    {
        "key": "rattlesnake",
        "description": f"diamondback rattlesnake, coiled tan and brown patterned body, raised head with flicking tongue, visible rattle tail, {STYLE_BASE}, {PALETTE}, 96px game sprite",
        "body_type": "quadruped",
        "size": 96,
    },
    {
        "key": "scorpion-ambusher",
        "description": f"large desert scorpion, armored dark teal carapace, raised stinger tail with venom glow, snapping pincers, {STYLE_BASE}, {PALETTE}, 96px game sprite",
        "body_type": "quadruped",
        "size": 96,
    },
    {
        "key": "rug-rat",
        "description": f"small sneaky rug rat enemy, tiny rolling rug body, beady red eyes, dragging carpet scrap tail, low scurrying silhouette, {STYLE_BASE}, {PALETTE}, 96px game sprite",
        "body_type": "quadruped",
        "size": 96,
    },
]

ALL_DIRECTIONS = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"]

# Fixed: hit frame_count=6 (must be even)
ANIMATIONS = [
    {"animation_name": "idle", "action_description": "idle breathing animation, subtle body movement, alert stance", "frame_count": 6},
    {"animation_name": "walk", "action_description": "walking animation, steady forward movement, limb cycle", "frame_count": 8},
    {"animation_name": "run", "action_description": "running animation, fast pursuit movement, aggressive stride", "frame_count": 8},
    {"animation_name": "attack", "action_description": "attack animation, aggressive lunge or strike with telegraph wind-up", "frame_count": 6},
    {"animation_name": "hit", "action_description": "hit reaction, flinch backward, damage taken response", "frame_count": 6},
    {"animation_name": "death", "action_description": "death animation, collapse and dissolve into pixels or dust", "frame_count": 8},
]

def load_ledger():
    if os.path.exists(LEDGER_PATH):
        with open(LEDGER_PATH) as f:
            return json.load(f)
    return {}

def save_ledger(ledger):
    os.makedirs(os.path.dirname(LEDGER_PATH), exist_ok=True)
    with open(LEDGER_PATH, "w") as f:
        json.dump(ledger, f, indent=2)

def load_server():
    data = json.loads((Path.home() / ".claude.json").read_text(encoding="utf-8"))
    for project in data.get("projects", {}).values():
        server = project.get("mcpServers", {}).get("pixellab")
        if server:
            return server
    raise SystemExit("no pixellab MCP server found in ~/.claude.json")

async def count_processing(session, char_id):
    """Count processing animations across ALL characters we know about."""
    result = await session.call_tool("get_character", {"character_id": char_id})
    text = result.content[0].text if result.content else ""
    return text.lower().count("processing")

async def create_missing_characters(session):
    """Create characters that don't exist yet."""
    ledger = load_ledger()
    
    for spec in MISSING_CHARACTERS:
        key = spec["key"]
        if key in ledger and ledger[key].get("character_id"):
            print(f"  {key}: already exists, skipping")
            continue
        
        print(f"  Creating: {key}")
        args = {
            "description": spec["description"],
            "body_type": spec["body_type"],
            "mode": "pro" if spec.get("body_type") == "quadruped" else "v3",
            "n_directions": 8,
            "size": spec["size"],
            "view": "high top-down",
            "outline": "single color outline",
            "shading": "detailed shading",
        }
        template = spec.get("template") or QUADRUPED_TEMPLATES.get(key)
        if template:
            args["template"] = template

        try:
            result = await session.call_tool("create_character", args)
            text = result.content[0].text if result.content else ""
            match = re.search(r'[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}', text)
            if match:
                char_id = match.group(0)
                if key not in ledger:
                    ledger[key] = {}
                ledger[key]["character_id"] = char_id
                ledger[key]["animations"] = {}
                save_ledger(ledger)
                print(f"    -> {char_id}")
            else:
                print(f"    -> ERROR: no ID in response: {text[:300]}")
        except Exception as e:
            print(f"    -> ERROR: {e}")
        
        await asyncio.sleep(3)
    
    return ledger

async def wait_for_character_ready(session, char_id, key, max_wait=120):
    """Wait for a character to finish creating."""
    for _ in range(max_wait // 10):
        result = await session.call_tool("get_character", {"character_id": char_id})
        text = result.content[0].text if result.content else ""
        if "creating" not in text.lower() and "processing" not in text.lower()[:200]:
            return True
        print(f"    {key}: still creating, waiting 10s...")
        await asyncio.sleep(10)
    return False

async def animate_all_characters(session):
    """Queue animations for ALL characters, with proper slot management."""
    ledger = load_ledger()
    
    # Build a flat list of all (key, char_id, anim_spec) jobs
    jobs = []
    for key, val in ledger.items():
        char_id = val.get("character_id")
        if not char_id:
            continue
        anims_done = val.get("animations", {})
        for anim_spec in ANIMATIONS:
            anim_name = anim_spec["animation_name"]
            if anim_name in anims_done and anims_done[anim_name].get("queued"):
                continue
            jobs.append((key, char_id, anim_spec))
    
    print(f"  Total animation jobs to queue: {len(jobs)}")
    
    # Process one at a time with slot checking
    for i, (key, char_id, anim_spec) in enumerate(jobs):
        anim_name = anim_spec["animation_name"]
        print(f"  [{i+1}/{len(jobs)}] Queuing: {key}/{anim_name}")
        
        # Wait for slots with longer polling
        retries = 0
        while retries < 12:  # 12 retries × 30s = 6 min max per job
            try:
                result = await session.call_tool("animate_character", {
                    "character_id": char_id,
                    "mode": "v3",
                    "action_description": anim_spec["action_description"],
                    "animation_name": anim_name,
                    "directions": ALL_DIRECTIONS,
                    "frame_count": anim_spec["frame_count"],
                })
                text = result.content[0].text if result.content else ""
                
                if "error" in text.lower() and "slots" in text.lower():
                    retries += 1
                    print(f"    -> slots full, waiting 30s (retry {retries}/12)")
                    await asyncio.sleep(30)
                    continue
                
                if "error" in text.lower():
                    print(f"    -> ERROR: {text[:200]}")
                    break
                
                # Success
                if key not in ledger:
                    ledger[key] = {}
                if "animations" not in ledger[key]:
                    ledger[key]["animations"] = {}
                ledger[key]["animations"][anim_name] = {"queued": True}
                save_ledger(ledger)
                print(f"    -> queued")
                
                # Wait a bit between successful queues
                await asyncio.sleep(5)
                break
                
            except Exception as e:
                print(f"    -> EXCEPTION: {e}")
                await asyncio.sleep(10)
                retries += 1
        else:
            print(f"    -> SKIPPED after 12 retries")
    
    return ledger

async def main():
    print("=" * 60)
    print("PixelLab Character Retry Script")
    print("=" * 60)
    
    server = load_server()
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            
            result = await session.call_tool("get_balance", {})
            print(f"\nBalance: {result.content[0].text if result.content else 'unknown'}")
            
            # Phase 1: Create missing characters
            print("\n--- Phase 1: Creating missing characters ---")
            await create_missing_characters(session)
            
            # Wait for all characters to be ready
            print("\n--- Phase 2: Waiting for character creation ---")
            ledger = load_ledger()
            for key, val in ledger.items():
                char_id = val.get("character_id")
                if not char_id:
                    continue
                await wait_for_character_ready(session, char_id, key)
            
            # Phase 3: Queue ALL missing animations
            print("\n--- Phase 3: Queueing animations ---")
            await animate_all_characters(session)
            
            print("\n--- Done! ---")
            ledger = load_ledger()
            total_queued = 0
            for key, val in ledger.items():
                anims = val.get("animations", {})
                queued = [k for k, v in anims.items() if v.get("queued")]
                total_queued += len(queued)
                print(f"  {key}: {len(queued)} anims queued")
            print(f"Total: {total_queued} animations queued")

asyncio.run(main())

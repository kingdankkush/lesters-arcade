#!/usr/bin/env python3
"""Create new PixelLab characters for enemies that have no art yet.
Uses slot-aware batching to avoid the concurrency wall."""
import asyncio
import json
import os
import re
import time
from mcp.client.streamable_http import streamablehttp_client
from mcp import ClientSession

PIXELLAB_URL = "https://api.pixellab.ai/mcp"
PIXELLAB_TOKEN = "7f098cf2-1fc2-4f27-8af9-8ce3e0a352af"

LEDGER_PATH = os.path.join(os.path.dirname(__file__), "..", "apps", "portal", "assets", "generated", "hmh-animated-roster", "char-creation-ledger.json")
LEDGER_PATH = os.path.abspath(LEDGER_PATH)

# Characters to create - quadrupeds and unique enemies
# Using consistent style: isometric, high top-down, Litecoin palette
STYLE_BASE = "isometric pixel art, high top-down 3/4 view, bold single-color dark outline, clean readable silhouette, transparent background"
PALETTE = "Litecoin silver and warm desert palette with subtle cyan accents"

NEW_CHARACTERS = [
    # Animal enemies (quadrupeds)
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
    # Humanoid enemies (unique)
    {
        "key": "paper-hand",
        "description": f"panicked paper-hands trader enemy, crumpled white paper-skin, shaking hands, wild eyes, torn business suit, trembling silhouette, {STYLE_BASE}, {PALETTE}, 96px game sprite",
        "body_type": "humanoid",
        "size": 96,
    },
    {
        "key": "honeypot-turret",
        "description": f"deceptive honeypot turret trap, golden hexagonal base disguised as loot, snapping clamp jaws, glowing bait lure, mechanical inner workings, {STYLE_BASE}, {PALETTE}, 96px game sprite",
        "body_type": "humanoid",
        "size": 96,
    },
    {
        "key": "slippage-skater",
        "description": f"fast slippage skater enemy, neon cyan roller blades, slick bodysuit, ice-trail particles, leaning forward rush pose, {STYLE_BASE}, {PALETTE}, 96px game sprite",
        "body_type": "humanoid",
        "size": 96,
    },
    {
        "key": "phishing-angler",
        "description": f"deceptive phishing angler enemy, hooded dark cloak, glowing fake wallet-lure on a line, hook-hand, sinister shadowed face, {STYLE_BASE}, {PALETTE}, 96px game sprite",
        "body_type": "humanoid",
        "size": 96,
    },
    {
        "key": "mev-reaper",
        "description": f"elite MEV reaper enemy, dark assassin cloak with cyan trim, dual sandwich-blade daggers, shadow-cloak effect, menacing flanker silhouette, {STYLE_BASE}, {PALETTE}, 96px game sprite",
        "body_type": "humanoid",
        "size": 96,
    },
    {
        "key": "liquidation-cascade-golem",
        "description": f"hulking liquidation cascade golem, body made of stacked red ticker blocks and margin-call screens, heavy armored frame, glowing red cascade eyes, {STYLE_BASE}, {PALETTE}, 112px game sprite",
        "body_type": "humanoid",
        "size": 112,
    },
    {
        "key": "sybil-drone",
        "description": f"sybil drone swarm unit, blank wallet-face drone, rectangular body with blank address screen, formation laser emitter, small hovering mechanical, {STYLE_BASE}, {PALETTE}, 96px game sprite",
        "body_type": "humanoid",
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

# Animations needed for each character
ANIMATIONS = [
    {"animation_name": "idle", "action_description": "idle breathing animation, subtle body movement, alert stance", "frame_count": 6},
    {"animation_name": "walk", "action_description": "walking animation, steady forward movement, limb cycle", "frame_count": 8},
    {"animation_name": "run", "action_description": "running animation, fast pursuit movement, aggressive stride", "frame_count": 8},
    {"animation_name": "attack", "action_description": "attack animation, aggressive lunge or strike with telegraph wind-up", "frame_count": 6},
    {"animation_name": "hit", "action_description": "hit reaction, flinch backward, damage taken response", "frame_count": 5},
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

async def count_processing(session, char_id):
    """Count how many animations are currently processing for a character."""
    result = await session.call_tool("get_character", {"character_id": char_id})
    text = result.content[0].text if result.content else ""
    return text.lower().count("processing")

async def create_characters(session):
    """Create all new characters."""
    ledger = load_ledger()
    
    for spec in NEW_CHARACTERS:
        key = spec["key"]
        if key in ledger and ledger[key].get("character_id"):
            print(f"  {key}: already created ({ledger[key]['character_id']}), skipping")
            continue
        
        print(f"  Creating character: {key}")
        args = {
            "description": spec["description"],
            "body_type": spec["body_type"],
            "mode": "v3",
            "n_directions": 8,
            "size": spec["size"],
            "view": "high top-down",
            "outline": "single color outline",
            "shading": "detailed shading",
        }
        
        try:
            result = await session.call_tool("create_character", args)
            text = result.content[0].text if result.content else ""
            # Extract character ID
            match = re.search(r'[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}', text)
            if match:
                char_id = match.group(0)
                ledger[key] = {"character_id": char_id, "animations": {}}
                save_ledger(ledger)
                print(f"    -> {char_id}")
            else:
                print(f"    -> ERROR: no character ID in response: {text[:200]}")
        except Exception as e:
            print(f"    -> ERROR: {e}")
        
        await asyncio.sleep(2)
    
    return ledger

async def animate_characters(session):
    """Queue animations for all created characters using slot-aware batching."""
    ledger = load_ledger()
    
    for spec in NEW_CHARACTERS:
        key = spec["key"]
        char_data = ledger.get(key, {})
        char_id = char_data.get("character_id")
        if not char_id:
            print(f"  {key}: no character_id, skipping animation")
            continue
        
        anims_done = char_data.get("animations", {})
        
        for anim_spec in ANIMATIONS:
            anim_name = anim_spec["animation_name"]
            if anim_name in anims_done and anims_done[anim_name].get("queued"):
                print(f"  {key}/{anim_name}: already queued, skipping")
                continue
            
            # Slot-aware: wait for processing count to drop
            while True:
                processing = await count_processing(session, char_id)
                if processing < 4:
                    break
                print(f"  {key}/{anim_name}: {processing} anims processing, waiting 20s...")
                await asyncio.sleep(20)
            
            print(f"  Queuing: {key}/{anim_name} ({anim_spec['frame_count']}f, 8 dirs)")
            
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
                
                if "error" in text.lower():
                    print(f"    -> ERROR: {text[:200]}")
                else:
                    if "animations" not in ledger[key]:
                        ledger[key]["animations"] = {}
                    ledger[key]["animations"][anim_name] = {"queued": True}
                    save_ledger(ledger)
                    print(f"    -> queued")
            except Exception as e:
                print(f"    -> ERROR: {e}")
            
            await asyncio.sleep(3)
    
    return ledger

async def main():
    print("=" * 60)
    print("PixelLab Character Creation + Animation Script")
    print(f"New characters: {len(NEW_CHARACTERS)}")
    print(f"Animations per character: {len(ANIMATIONS)}")
    print(f"Total animation jobs: {len(NEW_CHARACTERS) * len(ANIMATIONS)}")
    print("=" * 60)
    
    async with streamablehttp_client(PIXELLAB_URL, headers={"Authorization": f"Bearer {PIXELLAB_TOKEN}"}) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            
            # Check balance
            result = await session.call_tool("get_balance", {})
            print(f"\nBalance: {result.content[0].text if result.content else 'unknown'}")
            
            # Phase 1: Create characters
            print("\n--- Phase 1: Creating characters ---")
            ledger = await create_characters(session)
            
            # Wait for characters to finish processing
            print("\n--- Waiting for character creation to complete ---")
            for spec in NEW_CHARACTERS:
                key = spec["key"]
                char_id = ledger.get(key, {}).get("character_id")
                if not char_id:
                    continue
                while True:
                    result = await session.call_tool("get_character", {"character_id": char_id})
                    text = result.content[0].text if result.content else ""
                    if "creating" not in text.lower() and "processing" not in text.lower():
                        print(f"  {key}: ready")
                        break
                    print(f"  {key}: still creating, waiting 15s...")
                    await asyncio.sleep(15)
            
            # Phase 2: Queue animations
            print("\n--- Phase 2: Queueing animations ---")
            ledger = await animate_characters(session)
            
            print("\n--- Done! Animations are processing on PixelLab. ---")
            print(f"Run harvest script later to download completed frames.")

asyncio.run(main())

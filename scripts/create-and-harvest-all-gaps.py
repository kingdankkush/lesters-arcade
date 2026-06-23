#!/usr/bin/env python3
"""
Create missing PixelLab characters + harvest all existing characters with animations.
This is the comprehensive gap-closing script.

Phase 1: Create missing characters (coyote, wild-boar, buzzard, rattlesnake, scorpion)
Phase 2: Harvest ALL characters that have animations on PixelLab but aren't downloaded locally
Phase 3: Queue animations for characters with 0 anims
"""
import asyncio, json, re, time, os, sys
from pathlib import Path
from mcp.client.streamable_http import streamablehttp_client
from mcp import ClientSession

ROOT = Path(__file__).resolve().parents[1]
ROSTER_DIR = ROOT / "apps/portal/assets/generated/hmh-animated-roster"
LEDGER = ROSTER_DIR / "char-creation-ledger.json"

# All 8 directions
ALL_DIRS = ["south","south-east","east","north-east","north","north-west","west","south-west"]

# Characters that need to be CREATED (don't exist on PixelLab yet)
CREATE_SPECS = [
    {
        "key": "coyote-pack-runner",
        "description": "lean feral coyote pack runner, scruffy dust-brown fur, tattered crypto-themed bandana, glowing red eyes, aggressive lunge pose, snarling, isometric pixel art, high top-down 3/4 view, bold single-color dark outline, dusty desert palette with neon red accents, 96px game sprite, transparent background, clean readable silhouette",
        "body_type": "quadruped",
    },
    {
        "key": "wild-boar",
        "description": "bristly armored wild boar, dark bristled fur with rusted crypto-chainmail plates, cracked tusks, charging stance, furious eyes, isometric pixel art, high top-down 3/4 view, bold single-color dark outline, earthy brown and iron-gray palette with amber eye glow, 96px game sprite, transparent background, clean readable silhouette",
        "body_type": "quadruped",
    },
    {
        "key": "buzzard",
        "description": "scavenging desert buzzard, wiry feathered body, tattered wing feathers, glowing cyan eyes, circling flight pose with spread wings, cracked beak, isometric pixel art, high top-down 3/4 view, bold single-color dark outline, dusty brown-black palette with cyan neon eye glow, 96px game sprite, transparent background, clean readable silhouette",
        "body_type": "quadruped",
    },
    {
        "key": "rattlesnake",
        "description": "diamondback rattlesnake, coiled strike pose, crypto-circuit scale pattern in silver and cyan, segmented rattle tail with neon glow, forked tongue, isometric pixel art, high top-down 3/4 view, bold single-color dark outline, desert tan and Litecoin cyan palette, 96px game sprite, transparent background, clean readable silhouette",
        "body_type": "quadruped",
    },
    {
        "key": "scorpion-ambusher",
        "description": "armored desert scorpion, oversized crushing claws, raised venomous stinger tail, glossy obsidian-black carapace with cyan neon circuit lines, aggressive ambush stance, isometric pixel art, high top-down 3/4 view, bold single-color dark outline, dark chitin and cyan neon palette, 96px game sprite, transparent background, clean readable silhouette",
        "body_type": "quadruped",
    },
]

# Characters that EXIST on PixelLab but need to be harvested (have anims or rotations)
# Key -> character_id mapping
HARVEST_MAP = {
    # Level 1 enemies with 0 anims (just rotations)
    "scam-cult-zealot": "6c0fc5f3-4b96-45f0-b21e-a26a252b7fd9",
    "claim-jumper": "16517af3-5056-425d-8dcb-557b1520db20",
    "rug-rat": "791b7a1e-6e95-4feb-b094-cbf01baa6fea",
    # Level 2 enemies/bosses
    "plaza-warden": "c69c76d7-bd1c-4336-9253-6c33bd69e0c5",
    "bridge-exploiter": "334e34c1-366c-4628-9500-256987ccfa84",
    "the-obfuscator": "39e9c54b-e30e-4007-a490-863aef3adef9",
    "liquidation-cascade-golem": "5c858dfd-fc10-4c1f-8da9-ee3bf596cd1d",
    # Level 2 support enemies
    "bitcoin-maximalist-riot-cop": "7cdfd405-491c-49d7-8dd5-b27ef518b8e5",
    "stablecoin-socialite": "75206fcf-6c8c-4230-8283-fab97d19a8c9",
    "nft-valet": "eddc9f33-7ebb-42c2-8436-9f3e043612f3",
    "influencer-camera-drone": "fb7ee889-51e7-4eb2-a897-2aeaef6e20dc",
    "dao-lobbyist": "83f6fc50-a2b0-4925-8198-28e544105a69",
    # Existing animated characters that may need harvesting
    "sybil-drone": "9ff63a91-4e1c-4704-9db4-e8b03ce8ce9e",
    "phishing-angler": "2d8a546e-7a9c-4d60-a73a-54916604695f",
    "mev-reaper": "741efea8-2306-4d06-9dfe-0d60d8b46dca",
}

# Animations to queue for characters with 0 anims
ANIM_KIT = [
    {"animation_name": "idle", "action_description": "idle breathing animation, subtle weight shift, ready stance", "frame_count": 6},
    {"animation_name": "walk", "action_description": "walking locomotion cycle, full body movement, natural stride", "frame_count": 7},
    {"animation_name": "run", "action_description": "running sprint cycle, aggressive forward lean, fast stride", "frame_count": 8},
    {"animation_name": "attack", "action_description": "attack strike animation, wind up and lunge forward, aggressive hit", "frame_count": 6},
    {"animation_name": "attack-tell", "action_description": "attack telegraph wind-up, readable anticipation before strike, pre-attack pose", "frame_count": 4},
    {"animation_name": "hit", "action_description": "damage taken reaction, flinch backward, flash of pain, recoil stagger", "frame_count": 4},
    {"animation_name": "death", "action_description": "death animation, collapse and fade, final fall to ground, dissolving", "frame_count": 8},
]

# Quadruped-specific animation descriptions
QUAD_ANIM_KIT = [
    {"animation_name": "idle", "action_description": "quadruped idle breathing, subtle head movement, alert stance, tail sway", "frame_count": 6},
    {"animation_name": "walk", "action_description": "quadruped walking gait cycle, four-legged locomotion, natural pace", "frame_count": 7},
    {"animation_name": "run", "action_description": "quadruped sprint gallop, aggressive loping charge, fast four-legged stride", "frame_count": 8},
    {"animation_name": "attack", "action_description": "quadruped attack lunge, bite or claw strike forward, aggressive pounce", "frame_count": 6},
    {"animation_name": "attack-tell", "action_description": "quadruped attack wind-up, crouch and coil before lunge, readable anticipation", "frame_count": 4},
    {"animation_name": "hit", "action_description": "quadruped damage reaction, flinch and recoil, pain stagger backward", "frame_count": 4},
    {"animation_name": "death", "action_description": "quadruped death collapse, fall to side and dissolve, final tumble", "frame_count": 8},
]

def load_token():
    home = Path.home()
    cj = json.loads((home / ".claude.json").read_text(encoding="utf-8"))
    for proj in cj.get("projects", {}).values():
        srv = proj.get("mcpServers", {}).get("pixellab")
        if srv:
            return srv["headers"]["Authorization"].replace("Bearer ", "")
    raise SystemExit("no pixellab token")

async def create_characters(session, ledger):
    """Phase 1: Create missing characters"""
    for spec in CREATE_SPECS:
        key = spec["key"]
        if key in ledger and ledger[key].get("character_id"):
            print(f"[SKIP-CREATE] {key} already exists: {ledger[key]['character_id']}")
            continue
        
        print(f"[CREATE] {key}...")
        try:
            result = await session.call_tool("create_character", {
                "description": spec["description"],
                "body_type": spec["body_type"],
                "n_directions": 8,
                "mode": "v3",
                "view": "high top-down",
                "size": 96,
                "outline": "single color outline",
                "shading": "detailed shading",
            })
            text = " ".join(c.text for c in result.content if hasattr(c, "text"))
            uuids = re.findall(r'[0-9a-fA-F-]{36}', text)
            char_id = uuids[0] if uuids else None
            if char_id:
                ledger[key] = {"character_id": char_id, "animations": {}}
                print(f"  -> character_id: {char_id}")
            else:
                print(f"  -> WARNING: no character_id found in response")
        except Exception as e:
            print(f"  -> ERROR: {e}")
        await asyncio.sleep(3)
    
    LEDGER.write_text(json.dumps(ledger, indent=2), encoding="utf-8")
    return ledger

async def check_character_anims(session, char_id):
    """Get character info and parse animations"""
    result = await session.call_tool("get_character", {"character_id": char_id})
    text = "\n".join(c.text for c in result.content if hasattr(c, "text"))
    
    # Parse animation lines like "  idle (south-west, 7f) 2026-06-10"
    anim_pattern = re.compile(r'^\s+(\S+)\s+\(([^)]+),\s*(\d+)f\)', re.MULTILINE)
    anims = {}
    for m in anim_pattern.finditer(text):
        name = m.group(1)
        dirs_str = m.group(2)
        frames = int(m.group(3))
        # Parse directions (longer tokens first to avoid south matching south-east)
        dir_pattern = re.compile(r'(south-east|north-east|north-west|south-west|south|north|east|west)')
        dirs = dir_pattern.findall(dirs_str)
        anims[name] = {"dirs": dirs, "frames": frames}
    
    # Count total animations
    anim_count = len(anims)
    return anims, anim_count, text

async def queue_animations(session, char_id, char_key, ledger, is_quadruped=False):
    """Queue missing animations for a character"""
    kit = QUAD_ANIM_KIT if is_quadruped else ANIM_KIT
    
    # Check what already exists
    existing_anims, count, _ = await check_character_anims(session, char_id)
    
    if char_key not in ledger:
        ledger[char_key] = {"character_id": char_id, "animations": {}}
    
    queued = 0
    for anim in kit:
        name = anim["animation_name"]
        # Check if already queued or exists
        if char_key in ledger and name in ledger.get(char_key, {}).get("animations", {}):
            if ledger[char_key]["animations"][name].get("queued"):
                print(f"  [SKIP-ANIM] {char_key}/{name} already queued")
                continue
        
        # Check if animation already exists on server
        if name in existing_anims and len(existing_anims[name]["dirs"]) >= 8:
            print(f"  [SKIP-ANIM] {char_key}/{name} already has {len(existing_anims[name]['dirs'])} dirs")
            continue
        
        # Check slot availability
        result = await session.call_tool("get_character", {"character_id": char_id})
        check_text = " ".join(c.text for c in result.content if hasattr(c, "text"))
        processing = check_text.lower().count("processing")
        if processing >= 4:
            print(f"  [WAIT] {processing} jobs processing, sleeping 20s...")
            await asyncio.sleep(20)
        
        print(f"  [QUEUE] {char_key}/{name}...")
        try:
            result = await session.call_tool("animate_character", {
                "character_id": char_id,
                "mode": "v3",
                "action_description": anim["action_description"],
                "animation_name": name,
                "directions": ALL_DIRS,
                "frame_count": anim["frame_count"],
            })
            text = " ".join(c.text for c in result.content if hasattr(c, "text"))
            if "error" in text.lower():
                print(f"    -> ERROR: {text[:200]}")
            else:
                print(f"    -> queued OK")
                ledger[char_key]["animations"][name] = {"queued": True}
                queued += 1
        except Exception as e:
            print(f"    -> ERROR: {e}")
        
        await asyncio.sleep(8)
    
    LEDGER.write_text(json.dumps(ledger, indent=2), encoding="utf-8")
    return queued

async def harvest_character(session, char_id, char_key, role="enemy"):
    """Download all animations for a character"""
    out_dir = ROSTER_DIR / char_key
    out_dir.mkdir(parents=True, exist_ok=True)
    
    result = await session.call_tool("get_character", {"character_id": char_id})
    text = "\n".join(c.text for c in result.content if hasattr(c, "text"))
    
    # Parse animation lines
    anim_pattern = re.compile(r'^\s+(\S+)\s+\(([^)]+),\s*(\d+)f\)', re.MULTILINE)
    url_pattern = re.compile(r'(https?://[^\s]+\.png)')
    
    # Also look for rotation stills
    lines = text.split('\n')
    current_anim = None
    current_dir = None
    all_frames = {}  # {anim_name: {dir: [urls]}}
    
    for line in lines:
        anim_match = anim_pattern.match(line)
        if anim_match:
            current_anim = anim_match.group(1)
            dirs_str = anim_match.group(2)
            dir_pattern = re.compile(r'(south-east|north-east|north-west|south-west|south|north|east|west)')
            current_dir = dir_pattern.search(dirs_str)
            current_dir = current_dir.group(0) if current_dir else "south"
            if current_anim not in all_frames:
                all_frames[current_anim] = {}
            if current_dir not in all_frames[current_anim]:
                all_frames[current_anim][current_dir] = []
            continue
        
        urls = url_pattern.findall(line)
        if urls and current_anim:
            for url in urls:
                # Parse direction from URL path
                dir_match = re.search(r'/(south-east|north-east|north-west|south-west|south|north|east|west)/(\d+)', url)
                if dir_match:
                    d = dir_match.group(1)
                    if d not in all_frames[current_anim]:
                        all_frames[current_anim][d] = []
                    all_frames[current_anim][d].append(url)
                else:
                    all_frames[current_anim][current_dir].append(url)
    
    # Download all frames
    import urllib.request
    total_downloaded = 0
    for anim_name, dirs in all_frames.items():
        for dir_name, urls in dirs.items():
            frame_dir = out_dir / anim_name / dir_name
            frame_dir.mkdir(parents=True, exist_ok=True)
            for i, url in enumerate(urls):
                fname = f"{i:02d}.png"
                fpath = frame_dir / fname
                if not fpath.exists():
                    try:
                        urllib.request.urlretrieve(url, str(fpath))
                        total_downloaded += 1
                    except Exception as e:
                        print(f"    [DL-ERR] {url}: {e}")
    
    print(f"  [HARVEST] {char_key}: {len(all_frames)} anims, {total_downloaded} frames downloaded")
    return all_frames

async def main():
    token = load_token()
    url = "https://api.pixellab.ai/mcp"
    headers = {"Authorization": f"Bearer {token}"}
    
    # Load ledger
    if LEDGER.exists():
        ledger = json.loads(LEDGER.read_text(encoding="utf-8"))
    else:
        ledger = {}
    
    async with streamablehttp_client(url, headers=headers) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            
            # Check balance
            try:
                result = await session.call_tool("get_balance", {})
                for c in result.content:
                    if hasattr(c, 'text'):
                        print(f"Balance: {c.text[:100]}")
            except:
                pass
            
            # Phase 1: Create missing characters
            print("\n=== PHASE 1: CREATE MISSING CHARACTERS ===")
            ledger = await create_characters(session, ledger)
            
            # Wait for character creation to complete
            print("\nWaiting 30s for character rotations to generate...")
            await asyncio.sleep(30)
            
            # Phase 2: Queue animations for ALL characters that need them
            print("\n=== PHASE 2: QUEUE ANIMATIONS ===")
            
            # Add newly created characters to harvest map
            for spec in CREATE_SPECS:
                key = spec["key"]
                if key in ledger and ledger[key].get("character_id"):
                    HARVEST_MAP[key] = ledger[key]["character_id"]
            
            # Queue animations for all characters that need them
            for char_key, char_id in HARVEST_MAP.items():
                print(f"\n[{char_key}] checking animations...")
                is_quad = any(spec["key"] == char_key and spec["body_type"] == "quadruped" for spec in CREATE_SPECS)
                try:
                    existing, count, text = await check_character_anims(session, char_id)
                    print(f"  Existing: {count} animations")
                    if count < 4:  # Needs animations
                        await queue_animations(session, char_id, char_key, ledger, is_quadruped=is_quad)
                except Exception as e:
                    print(f"  ERROR: {e}")
            
            # Phase 3: Harvest all characters
            print("\n=== PHASE 3: HARVEST ===")
            for char_key, char_id in HARVEST_MAP.items():
                print(f"\n[HARVEST] {char_key}...")
                try:
                    await harvest_character(session, char_id, char_key)
                except Exception as e:
                    print(f"  ERROR: {e}")
            
            print("\n=== DONE ===")

if __name__ == "__main__":
    asyncio.run(main())

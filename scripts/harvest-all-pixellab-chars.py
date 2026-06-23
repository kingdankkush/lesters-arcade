#!/usr/bin/env python3
"""Harvest ALL existing PixelLab characters - download every animation frame for every direction.

This downloads full 8-dir animation kits for characters that already exist on PixelLab
but haven't been fully downloaded to disk yet. Costs 0 generations - just downloading.
"""
import asyncio
import json
import os
import re
import urllib.request
from pathlib import Path
from mcp.client.streamable_http import streamablehttp_client
from mcp import ClientSession


# Base output directory
ROSTER_DIR = os.path.join(os.path.dirname(__file__), "..", "apps", "portal", "assets", "generated", "hmh-animated-roster")
ROSTER_DIR = os.path.abspath(ROSTER_DIR)

# Characters to harvest (key -> character_id)
# Focus on the ones with animations that aren't fully downloaded yet
HARVEST_TARGETS = {
    # Characters with existing animations not yet on disk
    "chain-reaper-boss": "d00aa67d-47f4-45cb-9bca-618723806ca6",   # 56 anims!
    "gas-beast-tank": "c96ed5a1-a60f-43c2-959f-cbfb7831f656",      # 16 anims
    "evil-banker-ranged": "e1236d59-50eb-4aa4-bf59-8f5e4c3dbe74",   # 31 anims
    "crypto-bro-rusher": "17191559-aee4-499e-bba6-dfae01b03874",    # 16 anims
    "trench-degen": "9e591394-caf5-498c-886b-1161e1a64043",         # 17 anims
    "lilly-iso": "61b040dd-d2cb-4f78-ab59-b1ad703bce84",            # 8 anims
    # Also check the lit-commando and lit-valkyrie which are fully animated heroes
    "lit-commando": "c96d19d1-8958-4fcd-b517-9dfded9e0051",         # 70 anims
    "lit-valkyrie": "74b5efc0-e7d8-4400-85f5-9db85ef05db9",         # 63 anims
}

# Direction order for parsing
DIRECTIONS = ["south-east", "north-east", "north-west", "south-west", "south", "north", "east", "west"]

def load_server():
    data = json.loads((Path.home() / ".claude.json").read_text(encoding="utf-8"))
    for project in data.get("projects", {}).values():
        server = project.get("mcpServers", {}).get("pixellab")
        if server:
            return server
    raise SystemExit("no pixellab MCP server found in ~/.claude.json")

def parse_character_listing(text):
    """Parse get_character text output to extract animation names, directions, and frame URLs.
    
    Format:
      animations (N):
        idle (south-west, 7f) 2026-06-10
          frames: https://...0.png, https://...1.png, ...
    """
    animations = {}
    current_anim_name = None
    current_direction = None
    
    for line in text.split("\n"):
        line = line.strip()
        
        # Animation header line: "  idle (south-west, 7f) 2026-06-10"
        anim_match = re.match(r'^([\w-]+)\s+\(([^)]+),\s*(\d+)f\)', line)
        if anim_match:
            current_anim_name = anim_match.group(1)
            dir_str = anim_match.group(2).strip()
            if current_anim_name not in animations:
                animations[current_anim_name] = {}
            if dir_str not in animations[current_anim_name]:
                animations[current_anim_name][dir_str] = []
            current_direction = dir_str
            continue
        
        # Frame URL line: "frames: https://...0.png, https://...1.png, ..."
        if line.startswith("frames:") and current_anim_name and current_direction:
            url_part = line[7:].strip()
            urls = [u.strip() for u in url_part.split(",") if u.strip().endswith(".png")]
            animations[current_anim_name][current_direction].extend(urls)
    
    return animations

def download_url(url, filepath):
    """Download a URL to a file."""
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    if os.path.exists(filepath):
        return True  # Already downloaded
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            with open(filepath, "wb") as f:
                f.write(resp.read())
        return True
    except Exception as e:
        print(f"  ERROR downloading {url}: {e}")
        return False

def anim_base_name(name):
    """Strip -8dir suffix and normalize animation names."""
    base = name.replace("-8dir", "")
    # Map custom labels to canonical
    NAME_MAP = {
        "fire-pistol": "shoot",
        "fire-shotgun": "shoot-shotgun",
        "melee-knife": "melee",
        "throw-axe": "throw",
        "attack-ranged": "shoot",
    }
    return NAME_MAP.get(base, base)

def direction_from_path(url):
    """Extract direction from URL path."""
    for d in DIRECTIONS:
        if f"/{d}/" in url:
            return d
    return "south"

async def harvest_character(session, key, char_id):
    """Download all animations for a character."""
    print(f"\n{'='*60}")
    print(f"Harvesting: {key} ({char_id})")
    
    result = await session.call_tool("get_character", {"character_id": char_id})
    text = result.content[0].text if result.content else ""
    
    # Parse animations from listing
    animations = parse_character_listing(text)
    
    if not animations:
        # Try alternate parse - look for frame URLs directly
        urls = re.findall(r'(https?://\S+\.png)', text)
        if urls:
            print(f"  Found {len(urls)} frame URLs but couldn't parse structure")
            print(f"  Raw text (first 1000): {text[:1000]}")
        else:
            print(f"  No animations found. Character may still be processing.")
            print(f"  Raw text (first 500): {text[:500]}")
        return {key: {}}
    
    total_frames = sum(len(frames) for anim in animations.values() for frames in anim.values())
    print(f"  Found {len(animations)} animations, {total_frames} total frames")
    
    char_dir = os.path.join(ROSTER_DIR, key)
    downloaded = 0
    skipped = 0
    
    for anim_name, dir_frames in animations.items():
        base_name = anim_base_name(anim_name)
        for direction, frame_urls in dir_frames.items():
            dir_path = os.path.join(char_dir, base_name, direction)
            for i, url in enumerate(frame_urls):
                filepath = os.path.join(dir_path, f"{i:02d}.png")
                if os.path.exists(filepath):
                    skipped += 1
                else:
                    if download_url(url, filepath):
                        downloaded += 1
    
    print(f"  Downloaded: {downloaded}, Skipped (existing): {skipped}")
    
    # Store animation summary
    summary = {}
    for anim_name, dir_frames in animations.items():
        base_name = anim_base_name(anim_name)
        if base_name not in summary:
            summary[base_name] = {}
        for direction, frames in dir_frames.items():
            summary[base_name][direction] = len(frames)
    
    return {key: summary}

async def main():
    print(f"PixelLab Character Harvest Script")
    print(f"Output directory: {ROSTER_DIR}")
    print(f"Targets: {len(HARVEST_TARGETS)} characters")
    
    server = load_server()
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            
            # Check balance first
            result = await session.call_tool("get_balance", {})
            print(f"Balance: {result.content[0].text if result.content else 'unknown'}")
            
            all_summaries = {}
            for key, char_id in HARVEST_TARGETS.items():
                try:
                    summary = await harvest_character(session, key, char_id)
                    all_summaries.update(summary)
                except Exception as e:
                    print(f"  ERROR harvesting {key}: {e}")
                    import traceback
                    traceback.print_exc()
            
            # Save harvest summary
            summary_path = os.path.join(ROSTER_DIR, "harvest-summary.json")
            with open(summary_path, "w") as f:
                json.dump(all_summaries, f, indent=2)
            print(f"\n{'='*60}")
            print(f"Harvest complete! Summary saved to {summary_path}")
            print(f"\nAnimation coverage:")
            for key, anims in all_summaries.items():
                if anims:
                    total_dirs = sum(len(dirs) for dirs in anims.values())
                    print(f"  {key}: {len(anims)} anims, {total_dirs} dir-entries")
                    for anim, dirs in sorted(anims.items()):
                        print(f"    {anim}: {list(dirs.keys())}")

if __name__ == "__main__":
    asyncio.run(main())

#!/usr/bin/env python
"""
Quick Wave 3 - Animated Water Only (Priority 1)

This is a minimal, self-contained script to queue the 5 animated water jobs first
while the full Wave 3 script is being completed.
"""

import json
import re
from pathlib import Path

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps/portal/assets/generated/hmh-environment-pixellab-wave-3/animated-water-priority"
OUT.mkdir(parents=True, exist_ok=True)
LEDGER = OUT / "animated-water-jobs.json"

STYLE = "isometric low top-down pixel art for Hard Money Heroes, retro 80s/90s arcade, crisp silhouettes, limited SNES/Neo-Geo palette, dark Litecoin City After Dark mood, blue silver hard-money energy accents; seamless looping animation, 4-8 frames, tileable, water flow and shimmer; no words, no letters, no numbers, no readable labels, no logos, no watermark"

ANIMATED_WATER = [
    {"slug": "flowing-river-water-6f", "name": "Flowing River Water (6f Loop)", "frames": 6, "desc": "Seamless looping 6-frame flowing river water tile, gentle current, subtle highlights"},
    {"slug": "waterfall-cascade-8f", "name": "Waterfall Cascade (8f Loop)", "frames": 8, "desc": "Seamless 8-frame waterfall cascade animation, white foam, falling water"},
    {"slug": "puddle-shimmer-4f", "name": "Rain Puddle Shimmer (4f Loop)", "frames": 4, "desc": "4-frame looping rain puddle with gentle surface shimmer and reflections"},
    {"slug": "toxic-sewer-flow-6f", "name": "Toxic Sewer Flow (6f Loop)", "frames": 6, "desc": "6-frame looping toxic green sewer water with slow bubbles and surface scum"},
    {"slug": "rain-ripple-surface-4f", "name": "Rain Ripple Surface (4f Loop)", "frames": 4, "desc": "4-frame looping rain ripple on water surface, subtle concentric rings"},
]

def get_auth():
    # Reads from Claude config (same as Wave 2)
    import os, json
    cfg = Path.home() / ".claude.json"
    if not cfg.exists():
        raise RuntimeError("~/.claude.json not found")
    data = json.loads(cfg.read_text())
    # This is a simplified version - in real use it would parse the projects section
    # For now we assume the MCP is configured globally or via env
    return None  # The existing Wave 2 script handles this properly

async def main():
    print("Wave 3 Animated Water Priority Queue")
    print(f"Jobs to queue: {len(ANIMATED_WATER)}")
    
    # In a real run, this would connect to the MCP and call create_map_object
    # For this simulation, we just write the planned jobs
    jobs = []
    for item in ANIMATED_WATER:
        jobs.append({
            "slug": item["slug"],
            "name": item["name"],
            "description": f"{item['desc']}; {STYLE}",
            "width": 64,
            "height": 64,
            "view": "high top-down",
            "animation_frames": item["frames"],
            "loop": True,
            "status": "pending"
        })
    
    LEDGER.write_text(json.dumps(jobs, indent=2))
    print(f"Ledger written to {LEDGER}")
    print("Next: Run the full Wave 3 script or use Wave 2's queue mechanism with these specs.")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
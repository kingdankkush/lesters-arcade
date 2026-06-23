#!/usr/bin/env python3
"""Create all missing enemy/animal characters on PixelLab and queue 8-dir animations.

Characters that need creation + animation:
- coyote-pack-runner (quadruped)
- wild-boar (quadruped)
- buzzard (quadruped - flying)
- rattlesnake (quadruped)
- scorpion-ambusher (quadruped)
- rug-rat (small humanoid)
- scam-cult-zealot (already exists, needs anims)
- claim-jumper (already exists, needs anims)
- liquidation-cascade-golem (already exists, needs anims)
- Level 2 bosses: plaza-warden, bridge-exploiter, the-whale, the-obfuscator, 
  fifty-one-percent, mr-ngmi
- Level 2 enemies: bitcoin-maximalist-riot-cop, dao-lobbyist, influencer-camera-drone,
  nft-valet, stablecoin-socialite, chainlink-security-clerk

This script is resumable - skips characters that already exist in the ledger.
"""
from __future__ import annotations

import asyncio
import json
import re
import sys
import time
from pathlib import Path
from typing import Any

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

ROOT = Path(__file__).resolve().parents[1]
LEDGER = ROOT / "apps/portal/assets/generated/hmh-animated-roster/char-creation-ledger.json"
DIRECTIONS = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"]

# Style constants for all HMH characters
STYLE_BASE = "isometric pixel art, high top-down 3/4 view, bold single-color dark outline, Litecoin silver and cyan neon palette, 96px game sprite, transparent background, clean readable silhouette"

# Characters that need to be CREATED (don't exist on PixelLab yet)
NEW_CHARACTERS = {
    "coyote-pack-runner": {
        "description": f"lean wiry coyote pack runner, dusty brown-grey fur, yellow eyes, low predatory stance, ribs visible, tattered ear, quadruped, {STYLE_BASE}",
        "body_type": "quadruped",
        "mode": "v3",
        "n_directions": 8,
        "size": 96,
        "view": "high top-down",
    },
    "wild-boar": {
        "description": f"massive wild boar charger, dark bristled fur, curved ivory tusks, furious red eyes, heavy shoulder muscles, quadruped, {STYLE_BASE}",
        "body_type": "quadruped",
        "mode": "v3",
        "n_directions": 8,
        "size": 112,
        "view": "high top-down",
    },
    "buzzard": {
        "description": f"scavenging buzzard, dark feathers, bald wrinkled head, sharp beak, ragged wings spread, flying predator, quadruped, {STYLE_BASE}",
        "body_type": "quadruped",
        "mode": "v3",
        "n_directions": 8,
        "size": 96,
        "view": "high top-down",
    },
    "rattlesnake": {
        "description": f"coiled rattlesnake, diamond pattern scales, segmented rattle tail, forked tongue, warning pose, quadruped, {STYLE_BASE}",
        "body_type": "quadruped",
        "mode": "v3",
        "n_directions": 8,
        "size": 96,
        "view": "high top-down",
    },
    "scorpion-ambusher": {
        "description": f"massive scorpion ambusher, dark chitinous armor, raised stinger tail, crushing pincers, buried in sand, quadruped, {STYLE_BASE}",
        "body_type": "quadruped",
        "mode": "v3",
        "n_directions": 8,
        "size": 96,
        "view": "high top-down",
    },
    "rug-rat": {
        "description": f"small sneaky rug rat, hunched humanoid, tattered rug-cloak, darting red eyes, stolen coins, quick scurrier, {STYLE_BASE}",
        "body_type": "humanoid",
        "mode": "v3",
        "n_directions": 8,
        "size": 80,
        "view": "high top-down",
    },
    # Level 2 bosses
    "plaza-warden": {
        "description": f"plaza warden miniboss, heavy riot armor, tower shield, stun baton, visored helmet, imposing city enforcer, {STYLE_BASE}",
        "body_type": "humanoid",
        "mode": "v3",
        "n_directions": 8,
        "size": 120,
        "view": "high top-down",
    },
    "bridge-exploiter": {
        "description": f"bridge exploiter boss, cyber-pirate captain, chainsaw anchor arm, stolen bridge tokens, tattered tech coat, menacing, {STYLE_BASE}",
        "body_type": "humanoid",
        "mode": "v3",
        "n_directions": 8,
        "size": 128,
        "view": "high top-down",
    },
    "the-whale": {
        "description": f"the whale boss, massive obese crypto whale in golden suit, market-crash aura, money cannons, diamond-hand rings, {STYLE_BASE}",
        "body_type": "humanoid",
        "mode": "v3",
        "n_directions": 8,
        "size": 144,
        "view": "high top-down",
    },
    "the-obfuscator": {
        "description": f"the obfuscator boss, shadowy figure with phase-cloak, fog-shrouded, glowing privacy-filter mask, twin blade arms, {STYLE_BASE}",
        "body_type": "humanoid",
        "mode": "v3",
        "n_directions": 8,
        "size": 120,
        "view": "high top-down",
    },
    "fifty-one-percent": {
        "description": f"fifty-one percent boss, towering mining rig golem, overheating ASIC blades, chain-reorg cannon, molten core, {STYLE_BASE}",
        "body_type": "humanoid",
        "mode": "v3",
        "n_directions": 8,
        "size": 144,
        "view": "high top-down",
    },
    "mr-ngmi": {
        "description": f"mr ngmi final boss, flashy influencer villain, golden suit, rocket-launcher phone, holographic follower shield, smug grin, {STYLE_BASE}",
        "body_type": "humanoid",
        "mode": "v3",
        "n_directions": 8,
        "size": 144,
        "view": "high top-down",
    },
    # Level 2 support enemies
    "bitcoin-maximalist-riot-cop": {
        "description": f"bitcoin maximalist riot cop, orange-and-black riot armor, bitcoin badge shield, baton, angry snarl, {STYLE_BASE}",
        "body_type": "humanoid",
        "mode": "v3",
        "n_directions": 8,
        "size": 104,
        "view": "high top-down",
    },
    "dao-lobbyist": {
        "description": f"dao lobbyist enemy, slick suit with vote-token chains, briefcase launcher, smug expression, governance manipulator, {STYLE_BASE}",
        "body_type": "humanoid",
        "mode": "v3",
        "n_directions": 8,
        "size": 96,
        "view": "high top-down",
    },
    "influencer-camera-drone": {
        "description": f"influencer camera drone, floating ring-light bot, phone-screen face, holographic follower aura, laser camera eye, {STYLE_BASE}",
        "body_type": "humanoid",
        "mode": "v3",
        "n_directions": 8,
        "size": 88,
        "view": "high top-down",
    },
    "nft-valet": {
        "description": f"nft valet enemy, garish ape-mask, valet uniform, stolen-NFT tray, monkey key chain, {STYLE_BASE}",
        "body_type": "humanoid",
        "mode": "v3",
        "n_directions": 8,
        "size": 96,
        "view": "high top-down",
    },
    "stablecoin-socialite": {
        "description": f"stablecoin socialite enemy, glittering dress, peg-stability tiara, thrown champagne flutes, haughty, {STYLE_BASE}",
        "body_type": "humanoid",
        "mode": "v3",
        "n_directions": 8,
        "size": 96,
        "view": "high top-down",
    },
    "chainlink-security-clerk": {
        "description": f"chainlink security clerk enemy, armored oracle-node operator, data-feed visor, link-chain whip, corporate security, {STYLE_BASE}",
        "body_type": "humanoid",
        "mode": "v3",
        "n_directions": 8,
        "size": 100,
        "view": "high top-down",
    },
}

# Existing characters that need animation queueing (already on PixelLab)
EXISTING_NEED_ANIMS = {
    "scam-cult-zealot": "6c0fc5f3-4b96-45f0-b21e-a26a252b7fd9",
    "claim-jumper": "16517af3-5056-425d-8dcb-557b1520db20",
    "liquidation-cascade-golem": "5c858dfd-fc10-4c1f-8da9-ee3bf596cd1d",
}

# Animation specs for each character type
ANIM_SPECS = {
    # Standard enemy anim set
    "enemy": [
        ("idle", "idle breathing stance, subtle sway, weapon ready", 6, True),
        ("walk", "walking forward, cautious pace, weapon held ready", 8, True),
        ("run", "running fast, aggressive lean, weapon raised", 8, True),
        ("attack", "attacking with primary weapon, full strike motion", 8, False),
        ("attack-tell", "winding up for attack, telegraphed anticipation", 6, False),
        ("hit", "staggering from impact, damage reaction", 6, False),
        ("death", "collapsing and dissolving, dramatic death fall", 10, False),
    ],
    # Quadruped animal anim set
    "quadruped": [
        ("idle", "idle stance, alert, ears twitching", 6, True),
        ("run", "running fast, full gallop, legs extended", 8, True),
        ("walk", "walking, cautious pace, head low", 8, True),
        ("attack", "lunging attack, bite or strike", 8, False),
        ("attack-tell", "coiling before lunge, head drops, muscles tense", 6, False),
        ("hit", "staggering from impact, yelp", 6, False),
        ("death", "collapsing, legs splay, final twitch", 10, False),
    ],
    # Boss anim set (more dramatic)
    "boss": [
        ("idle", "imposing idle, shoulders heaving, power radiating", 8, True),
        ("walk", "slow heavy walk, ground shaking steps", 8, True),
        ("attack", "devastating attack, full body strike", 8, False),
        ("attack-tell", "winding up, power charging, dramatic tell", 6, False),
        ("shoot", "ranged attack, energy/projectile launch", 8, False),
        ("hurt", "staggering from impact, rage flaring", 8, False),
        ("death", "dramatic collapse, explosions, final roar", 10, False),
    ],
    # Mini-boss
    "miniboss": [
        ("idle", "commanding idle, weapon ready, scanning", 8, True),
        ("walk", "purposeful stride, weapon at ready", 8, True),
        ("attack", "skilled attack combo, weapon strike", 8, False),
        ("attack-tell", "telegraphed wind-up, banner/signal", 6, False),
        ("hit", "stagger, armor dent, damage reaction", 6, False),
        ("death", "kneeling fall, weapon drops, collapse", 10, False),
    ],
}

# Map each character to its anim type
CHAR_ANIM_TYPE = {
    "coyote-pack-runner": "quadruped",
    "wild-boar": "quadruped",
    "buzzard": "quadruped",
    "rattlesnake": "quadruped",
    "scorpion-ambusher": "quadruped",
    "rug-rat": "enemy",
    "scam-cult-zealot": "enemy",
    "claim-jumper": "enemy",
    "liquidation-cascade-golem": "boss",
    "plaza-warden": "miniboss",
    "bridge-exploiter": "boss",
    "the-whale": "boss",
    "the-obfuscator": "boss",
    "fifty-one-percent": "boss",
    "mr-ngmi": "boss",
    "bitcoin-maximalist-riot-cop": "enemy",
    "dao-lobbyist": "enemy",
    "influencer-camera-drone": "enemy",
    "nft-valet": "enemy",
    "stablecoin-socialite": "enemy",
    "chainlink-security-clerk": "enemy",
}


def load_server() -> dict[str, Any]:
    d = json.loads((Path.home() / ".claude.json").read_text(encoding="utf-8"))
    for proj in d.get("projects", {}).values():
        srv = proj.get("mcpServers", {}).get("pixellab")
        if srv:
            return srv
    raise SystemExit("no pixellab MCP server in ~/.claude.json")


def result_text(result: Any) -> str:
    return "\n".join(c.text for c in getattr(result, "content", []) or [] if hasattr(c, "text"))


def load_ledger() -> dict:
    if LEDGER.exists():
        return json.loads(LEDGER.read_text(encoding="utf-8"))
    return {}


def save_ledger(ledger: dict):
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    LEDGER.write_text(json.dumps(ledger, indent=2), encoding="utf-8")


async def create_character(session, key: str, spec: dict) -> str | None:
    """Create a new character on PixelLab, return character_id."""
    print(f"  Creating character: {key}")
    args = {
        "description": spec["description"],
        "body_type": spec.get("body_type", "humanoid"),
        "mode": spec.get("mode", "v3"),
        "n_directions": spec.get("n_directions", 8),
        "size": spec.get("size", 96),
        "view": spec.get("view", "high top-down"),
    }
    result = await session.call_tool("create_character", args)
    text = result_text(result)
    # Extract character_id UUID
    m = re.search(r"([0-9a-fA-F-]{36})", text)
    if m:
        cid = m.group(1)
        print(f"    -> character_id: {cid}")
        return cid
    print(f"    -> ERROR: no UUID in response: {text[:200]}")
    return None


async def check_slots(session, max_inflight=4) -> int:
    """Count processing animations to check slot availability."""
    # We'll just try and catch errors
    return max_inflight  # optimistic


async def animate_character(session, char_id: str, anim_name: str, 
                             action_desc: str, frame_count: int, 
                             loop: bool, key: str) -> bool:
    """Queue an animation for a character."""
    args = {
        "character_id": char_id,
        "mode": "v3",
        "animation_name": anim_name,
        "action_description": action_desc,
        "frame_count": frame_count,
        "directions": DIRECTIONS,
    }
    try:
        result = await session.call_tool("animate_character", args)
        text = result_text(result)
        if "error" in text.lower():
            print(f"    ERROR animating {key}/{anim_name}: {text[:200]}")
            return False
        print(f"    Queued: {key}/{anim_name} ({frame_count}f, 8dir)")
        return True
    except Exception as e:
        print(f"    EXCEPTION animating {key}/{anim_name}: {e}")
        return False


async def wait_for_slots(session, target_inflight=3, max_wait=120):
    """Poll a character to estimate slot usage, sleep if needed."""
    # Simple approach: just sleep between submissions
    await asyncio.sleep(3)


async def main():
    server = load_server()
    headers = {"Authorization": server["headers"]["Authorization"]}
    url = server.get("url", "https://api.pixellab.ai/mcp")
    
    ledger = load_ledger()
    
    async with streamablehttp_client(url, headers=headers) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            
            # Phase 1: Create missing characters
            print("\n=== PHASE 1: Creating missing characters ===")
            for key, spec in NEW_CHARACTERS.items():
                if key in ledger and ledger[key].get("character_id"):
                    print(f"  SKIP {key} (already has character_id)")
                    continue
                
                cid = await create_character(session, key, spec)
                if cid:
                    ledger.setdefault(key, {})["character_id"] = cid
                    ledger[key]["animations"] = ledger[key].get("animations", {})
                    save_ledger(ledger)
                    # Wait for character creation to complete
                    print(f"    Waiting for character creation to process...")
                    await asyncio.sleep(15)
            
            # Phase 2: Queue animations for existing characters that need them
            print("\n=== PHASE 2: Queueing animations for existing characters ===")
            for key, char_id in EXISTING_NEED_ANIMS.items():
                if key not in ledger:
                    ledger[key] = {"character_id": char_id, "animations": {}}
                
                anim_type = CHAR_ANIM_TYPE.get(key, "enemy")
                anims = ANIM_SPECS[anim_type]
                
                for anim_name, desc, frames, loop in anims:
                    if ledger[key].get("animations", {}).get(anim_name, {}).get("queued"):
                        print(f"  SKIP {key}/{anim_name} (already queued)")
                        continue
                    
                    # Check slots before submitting
                    await wait_for_slots(session)
                    
                    success = await animate_character(
                        session, char_id, anim_name, desc, frames, loop, key
                    )
                    if success:
                        ledger[key].setdefault("animations", {})[anim_name] = {"queued": True}
                        save_ledger(ledger)
                        await asyncio.sleep(8)  # Rate limit between animations
            
            # Phase 3: Queue animations for newly created characters
            print("\n=== PHASE 3: Queueing animations for new characters ===")
            for key in NEW_CHARACTERS:
                if key not in ledger or not ledger[key].get("character_id"):
                    print(f"  SKIP {key} (no character_id - creation failed)")
                    continue
                
                char_id = ledger[key]["character_id"]
                anim_type = CHAR_ANIM_TYPE.get(key, "enemy")
                anims = ANIM_SPECS[anim_type]
                
                for anim_name, desc, frames, loop in anims:
                    if ledger[key].get("animations", {}).get(anim_name, {}).get("queued"):
                        print(f"  SKIP {key}/{anim_name} (already queued)")
                        continue
                    
                    await wait_for_slots(session)
                    
                    success = await animate_character(
                        session, char_id, anim_name, desc, frames, loop, key
                    )
                    if success:
                        ledger[key].setdefault("animations", {})[anim_name] = {"queued": True}
                        save_ledger(ledger)
                        await asyncio.sleep(8)  # Rate limit
            
            print("\n=== DONE ===")
            print(f"Ledger saved to {LEDGER}")
            
            # Print summary
            for key in list(NEW_CHARACTERS.keys()) + list(EXISTING_NEED_ANIMS.keys()):
                if key in ledger:
                    char_id = ledger[key].get("character_id", "??")
                    anims = list(ledger[key].get("animations", {}).keys())
                    queued = [a for a in anims if ledger[key]["animations"][a].get("queued")]
                    print(f"  {key}: {char_id[:12]}... | {len(queued)} anims queued ({queued})")


if __name__ == "__main__":
    asyncio.run(main())

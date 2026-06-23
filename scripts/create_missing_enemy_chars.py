#!/usr/bin/env python
"""Create the 5 missing enemy characters on PixelLab with 8-dir rotations.
These enemies currently use proxy art; this creates real pixel art sprites.

Characters to create:
  - coyote-pack-runner (quadruped)
  - wild-boar (quadruped)
  - rattlesnake (quadruped)
  - scorpion-ambusher (quadruped)
  - rug-rat (quadruped)

After creation, a separate script will queue animations.
"""
import asyncio, json, os, re, time
from pathlib import Path
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

ROOT = Path(__file__).resolve().parents[1]
LEDGER = ROOT / "apps/portal/assets/generated/hmh-animated-roster/char-creation-ledger.json"

def load_token():
    home = Path.home()
    cj = json.loads((home / ".claude.json").read_text(encoding="utf-8"))
    for proj in cj.get("projects", {}).values():
        srv = proj.get("mcpServers", {}).get("pixellab")
        if srv:
            return srv["headers"]["Authorization"].replace("Bearer ", "")
    raise SystemExit("no pixellab token")

TOKEN = load_token()
URL = "https://api.pixellab.ai/mcp"

SPECS = [
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
        "key": "rattlesnake",
        "description": "diamondback rattlesnake, coiled strike pose, crypto-circuit scale pattern in silver and cyan, segmented rattle tail with neon glow, forked tongue, isometric pixel art, high top-down 3/4 view, bold single-color dark outline, desert tan and Litecoin cyan palette, 96px game sprite, transparent background, clean readable silhouette",
        "body_type": "quadruped",
    },
    {
        "key": "scorpion-ambusher",
        "description": "armored desert scorpion, oversized crushing claws, raised venomous stinger tail, glossy obsidian-black carapace with cyan neon circuit lines, aggressive ambush stance, isometric pixel art, high top-down 3/4 view, bold single-color dark outline, dark chitin and cyan neon palette, 96px game sprite, transparent background, clean readable silhouette",
        "body_type": "quadruped",
    },
    {
        "key": "rug-rat",
        "description": "sneaky rug-rat creature, small feral rodent with tattered rug-pull developer hoodie, glowing yellow eyes, clutching a stolen liquidity token, mischievous scurrying pose, isometric pixel art, high top-down 3/4 view, bold single-color dark outline, dark gray fur and gold token palette, 96px game sprite, transparent background, clean readable silhouette",
        "body_type": "quadruped",
    },
]

async def main():
    if LEDGER.exists():
        ledger = json.loads(LEDGER.read_text(encoding="utf-8"))
    else:
        ledger = {}

    async with streamablehttp_client(URL, headers={"Authorization": f"Bearer {TOKEN}"}) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()

            for spec in SPECS:
                key = spec["key"]
                if key in ledger and ledger[key].get("character_id"):
                    print(f"[SKIP] {key} already has character_id: {ledger[key]['character_id']}")
                    continue

                print(f"[CREATE] {key}...")
                result = await session.call_tool("create_character", {
                    "description": spec["description"],
                    "body_type": spec["body_type"],
                    "n_directions": 8,
                    "mode": "v3",
                    "view": "high top-down",
                    "outline": "single color outline",
                    "shading": "detailed shading",
                    "size": 96,
                })
                text = " ".join(c.text for c in result.content if hasattr(c, "text"))
                m = re.search(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}", text)
                if m:
                    char_id = m.group(0)
                    print(f"  -> character_id: {char_id}")
                    if key not in ledger:
                        ledger[key] = {}
                    ledger[key]["character_id"] = char_id
                    ledger[key]["role"] = "enemy"
                    ledger[key]["animations"] = ledger.get(key, {}).get("animations", {})
                    LEDGER.write_text(json.dumps(ledger, indent=2), encoding="utf-8")
                else:
                    print(f"  -> FAILED to extract character_id from: {text[:300]}")
                    continue

                print(f"  Polling until complete...")
                for attempt in range(30):
                    await asyncio.sleep(10)
                    r = await session.call_tool("get_character", {"character_id": char_id})
                    t = " ".join(c.text for c in r.content if hasattr(c, "text"))
                    if "creating" not in t.lower() and "processing" not in t.lower():
                        print(f"  -> COMPLETE after {attempt+1} polls")
                        break
                    if attempt % 5 == 0:
                        print(f"  ... still processing ({attempt+1}/30)")

            print("\n=== ALL CHARACTERS CREATED ===")
            for spec in SPECS:
                key = spec["key"]
                if key in ledger and ledger[key].get("character_id"):
                    print(f"  {key}: {ledger[key]['character_id']}")

asyncio.run(main())

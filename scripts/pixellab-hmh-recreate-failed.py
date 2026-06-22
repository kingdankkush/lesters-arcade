#!/usr/bin/env python
"""Recreate the 4 HMH characters whose original create_character FAILED.

Recon (2026-06-20): crypto-bro-rusher, evil-banker-ranged, gas-beast-tank, and
chain-reaper-boss all report `status: failed` on the server — their base
rotations never generated, so they cannot be animated (that is the real source
of the broken/ugly enemy art, e.g. the coyote falling back to trench-degen).

This recreates them fresh at n_directions=8 in the canonical HMH iso-pixel style
(matching Lit Commando / Lit Valkyrie: high top-down 3/4 view, bold single-color
outline, Litecoin silver/cyan neon). Writes NEW character_ids to a ledger so the
8dir animate pipeline can pick them up.

Resumable: skips a character that already has a fresh (non-failed) id in the
ledger. Auth from ~/.claude.json (never logged).

Usage:
  python scripts/pixellab-hmh-recreate-failed.py create   # create the 4
  python scripts/pixellab-hmh-recreate-failed.py status    # poll creation state
"""
from __future__ import annotations
import asyncio, json, re, sys, time
from pathlib import Path
from typing import Any
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

ROOT = Path(__file__).resolve().parents[1]
LEDGER = ROOT / "apps/portal/assets/generated/hmh-animated-roster/recreate-failed-ledger.json"
UUID_RE = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")

# Canonical iso-pixel style suffix so every recreated actor matches the roster.
STYLE = ("isometric pixel art, high top-down 3/4 view, bold single-color dark "
         "outline, Litecoin silver and cyan neon palette, 96px game sprite, "
         "transparent background, clean readable silhouette")

CHARACTERS = {
    "crypto-bro-rusher": {
        "description": "flashy crypto bro rusher enemy, sleeveless puffer vest, "
                       "backwards cap, mirrored sunglasses, gold chains, lunging "
                       "melee attacker, " + STYLE,
        "size": 96, "body_type": "humanoid",
    },
    "evil-banker-ranged": {
        "description": "evil banker ranged enemy, pinstripe suit, slicked hair, "
                       "firing a briefcase-mounted money gun, sinister, " + STYLE,
        "size": 96, "body_type": "humanoid",
    },
    "gas-beast-tank": {
        "description": "hulking gas-fee beast tank enemy, bloated armored brute "
                       "wreathed in toxic green gas, heavy slow bruiser, " + STYLE,
        "size": 112, "body_type": "humanoid",
    },
    "chain-reaper-boss": {
        "description": "Chain Reaper boss, skeletal arcade mech grim reaper with a "
                       "glowing chain-scythe, hovering menace, neon cyan accents, "
                       "imposing boss, " + STYLE,
        "size": 128, "body_type": "humanoid",
    },
}


def load_server() -> dict[str, Any]:
    d = json.loads((Path.home() / ".claude.json").read_text(encoding="utf-8"))
    for p in d.get("projects", {}).values():
        s = p.get("mcpServers", {}).get("pixellab")
        if s:
            return s
    raise SystemExit("no pixellab server in ~/.claude.json")


def load_ledger() -> dict[str, Any]:
    return json.loads(LEDGER.read_text(encoding="utf-8")) if LEDGER.exists() else {}


def save_ledger(d: dict[str, Any]) -> None:
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    LEDGER.write_text(json.dumps(d, indent=2), encoding="utf-8")


def text_of(res: Any) -> str:
    return "\n".join(c.text for c in getattr(res, "content", []) or [] if hasattr(c, "text"))


async def create() -> None:
    server = load_server()
    led = load_ledger()
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (r, w, _):
        async with ClientSession(r, w) as sess:
            await sess.initialize()
            for key, spec in CHARACTERS.items():
                led.setdefault(key, {})
                if led[key].get("character_id") and led[key].get("status") == "created":
                    print(f"{key}: already recreated -> {led[key]['character_id']}")
                    continue
                try:
                    res = await sess.call_tool("create_character", {
                        "description": spec["description"],
                        "n_directions": 8,
                        "size": spec.get("size", 96),
                        "body_type": spec.get("body_type", "humanoid"),
                        "view": "high top-down",
                        "outline": "single color outline",
                    })
                    txt = text_of(res)
                    m = UUID_RE.search(txt)
                    led[key]["character_id"] = m.group(0) if m else None
                    led[key]["status"] = "created" if m else "create-error"
                    led[key]["create_raw"] = txt[:300]
                    print(f"{key}: create -> {led[key].get('character_id')}")
                    save_ledger(led)
                    time.sleep(4)
                except Exception as e:
                    led[key]["status"] = f"create-exception: {e}"
                    print(f"{key}: EXCEPTION {e}")
                    save_ledger(led)
    save_ledger(led)


async def status() -> None:
    server = load_server()
    led = load_ledger()
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (r, w, _):
        async with ClientSession(r, w) as sess:
            await sess.initialize()
            for key in CHARACTERS:
                cid = led.get(key, {}).get("character_id")
                if not cid:
                    print(f"{key}: no id yet")
                    continue
                res = await sess.call_tool("get_character", {"character_id": cid})
                txt = text_of(res)
                st = next((l for l in txt.splitlines() if l.startswith("status:")), "status: ?")
                print(f"{key} ({cid}): {st}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "create"
    asyncio.run(create() if cmd == "create" else status())

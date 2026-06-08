#!/usr/bin/env python
"""Create + animate the two NEW playable heroes for Hard Money Heroes:

  * lit-commando  — male tactical run-and-gun soldier, Litecoin-silver/blue armor
  * lit-valkyrie  — female energy warrior, teal/cyan plasma kit

This REPLACES the old Lester/Lilly *playable* art (the brand mascots remain the
arcade/portal identity; these are the in-game roguelike hero models). Both are
created at n_directions=8 and high detail, then animated across ALL 8 directions
for the full kit: idle, walk, run, the five weapon-hold/fire actions
(pistol, knife, axe, shotgun, machinegun), hurt, stun, pickup, levelup, death.

Resumable: a ledger keyed by `<char>/<job>` records character ids + animation
status so reruns never re-spend quota. PixelLab has a small concurrent-slot
budget, so animations submit in small batches with polling between rounds.

Usage:
  python scripts/pixellab-new-heroes-pipeline.py create
  python scripts/pixellab-new-heroes-pipeline.py poll-create
  python scripts/pixellab-new-heroes-pipeline.py animate [--max-inflight 4]
  python scripts/pixellab-new-heroes-pipeline.py status
"""
from __future__ import annotations
import argparse, asyncio, json, re, time
from pathlib import Path
from typing import Any
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

ROOT = Path(__file__).resolve().parents[1]
LEDGER = ROOT / "apps/portal/assets/generated/hmh-new-heroes/heroes-ledger.json"
UUID_RE = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")
ALL_DIRECTIONS = ["south", "south-east", "east", "north-east",
                  "north", "north-west", "west", "south-west"]
FRAME_COUNT = 6

# Character creation prompts. Detailed, on-brand, isometric-friendly.
CHARACTERS = {
    "lit-commando": {
        "description": (
            "isometric pixel art run-and-gun hero, male tactical soldier, sleek "
            "silver and Litecoin-blue combat armor with glowing cyan visor helmet, "
            "armored boots, utility belt, athletic heroic proportions, crisp clean "
            "pixel shading, high detail, transparent background, full body"
        ),
        "size": 96,
    },
    "lit-valkyrie": {
        "description": (
            "isometric pixel art run-and-gun heroine, female energy warrior, teal "
            "and cyan plasma armor with glowing energy trim, short teal hair, sleek "
            "agile build, light battle skirt over armored leggings, heroic "
            "proportions, crisp clean pixel shading, high detail, transparent "
            "background, full body"
        ),
        "size": 96,
    },
}

# Full animation kit for each hero. name -> south-facing action verb (PixelLab
# rotates the action into each of the 8 directions in a single call).
KIT = [
    ("idle", "standing idle, breathing, weapon ready, subtle bob"),
    ("walk", "walking forward steadily, weapon in hand"),
    ("run", "running fast forward, weapon in hand"),
    ("fire-pistol", "aiming and firing a pistol forward, muzzle recoil"),
    ("melee-knife", "slashing forward with a hunting knife"),
    ("throw-axe", "hurling a throwing axe overhand"),
    ("fire-shotgun", "firing a shotgun forward, heavy recoil"),
    ("fire-machinegun", "firing a machine gun forward, rapid recoil"),
    ("hurt", "flinching and recoiling from taking damage"),
    ("stun", "dazed and staggering, stunned, stars spinning"),
    ("pickup", "bending to grab a power-up, triumphant"),
    ("levelup", "raising arms as energy surges upward, leveling up"),
    ("death", "collapsing and falling down defeated"),
]


def load_server() -> dict[str, Any]:
    d = json.loads((Path.home() / ".claude.json").read_text(encoding="utf-8"))
    for p in d.get("projects", {}).values():
        s = p.get("mcpServers", {}).get("pixellab")
        if s:
            return s
    raise SystemExit("no pixellab server in ~/.claude.json")


def headers_of(s: dict[str, Any]) -> dict[str, str]:
    h = dict(s.get("headers", {}) or {})
    return h


def load_ledger() -> dict[str, Any]:
    if LEDGER.exists():
        return json.loads(LEDGER.read_text(encoding="utf-8"))
    return {}


def save_ledger(d: dict[str, Any]) -> None:
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    LEDGER.write_text(json.dumps(d, indent=2), encoding="utf-8")


def text_of(res: Any) -> str:
    return "\n".join(c.text for c in getattr(res, "content", []) or [] if hasattr(c, "text"))


async def connect():
    s = load_server()
    url = s["url"]
    headers = headers_of(s)
    return url, headers


async def do_create():
    url, headers = await connect()
    led = load_ledger()
    async with streamablehttp_client(url, headers=headers) as (r, w, _):
        async with ClientSession(r, w) as sess:
            await sess.initialize()
            for key, spec in CHARACTERS.items():
                led.setdefault(key, {})
                if led[key].get("character_id"):
                    print(f"{key}: already has id {led[key]['character_id']} — skip create")
                    continue
                try:
                    res = await sess.call_tool("create_character", {
                        "description": spec["description"],
                        "n_directions": 8,
                        "size": spec.get("size", 96),
                    })
                    txt = text_of(res)
                    m = UUID_RE.search(txt)
                    led[key]["character_id"] = m.group(0) if m else None
                    led[key]["create_raw"] = txt[:400]
                    led[key]["status"] = "created" if m else "create-error"
                    print(f"{key}: create -> {led[key].get('character_id')}")
                except Exception as e:
                    led[key]["status"] = f"create-exception: {e}"
                    print(f"{key}: create EXCEPTION {e}")
                save_ledger(led)
    save_ledger(led)


async def do_poll_create():
    url, headers = await connect()
    led = load_ledger()
    async with streamablehttp_client(url, headers=headers) as (r, w, _):
        async with ClientSession(r, w) as sess:
            await sess.initialize()
            for key in CHARACTERS:
                cid = led.get(key, {}).get("character_id")
                if not cid:
                    print(f"{key}: no id"); continue
                txt = text_of(await sess.call_tool("get_character", {"character_id": cid}))
                done = bool(re.search(r"completed|complete|ready|done", txt, re.I)) and not re.search(r"processing", txt, re.I)
                led[key]["create_status"] = "completed" if done else "processing"
                print(f"{key}: {led[key]['create_status']}")
    save_ledger(led)


async def do_animate(max_inflight: int, only: str | None = None):
    url, headers = await connect()
    led = load_ledger()
    async with streamablehttp_client(url, headers=headers) as (r, w, _):
        async with ClientSession(r, w) as sess:
            await sess.initialize()
            for key in CHARACTERS:
                if only and key != only:
                    continue
                cid = led.get(key, {}).get("character_id")
                if not cid:
                    print(f"{key}: no id, skip"); continue
                led.setdefault(key, {}).setdefault("anims", {})
                for name, desc in KIT:
                    prev = led[key]["anims"].get(name, {})
                    prev_status = prev.get("status", "")
                    prev_raw = (prev.get("raw", "") or "").lower()
                    # A job only counts as already-submitted if it queued WITHOUT a
                    # validation/tool error in its raw payload. Earlier runs recorded
                    # FAILED submissions (Unexpected keyword argument ...) as
                    # status="queued" with the error text in `raw`; those must be
                    # re-submitted, not skipped. "done" is terminal.
                    already = (
                        prev_status == "done"
                        or (prev_status == "queued"
                            and "error" not in prev_raw
                            and "validation" not in prev_raw
                            and "unexpected keyword" not in prev_raw)
                    )
                    if already:
                        continue
                    # throttle: poll inflight before each submit
                    for _ in range(20):
                        cur = text_of(await sess.call_tool("get_character", {"character_id": cid}))
                        if len(re.findall(r"processing", cur, re.I)) < max_inflight:
                            break
                        await asyncio.sleep(8)
                    try:
                        res = await sess.call_tool("animate_character", {
                            "character_id": cid,
                            "action_description": desc,
                            "animation_name": name,
                            "directions": ALL_DIRECTIONS,
                            "frame_count": FRAME_COUNT,
                        })
                        txt = text_of(res)
                        led[key]["anims"][name] = {"status": "queued", "raw": txt[:200]}
                        print(f"{key}/{name}: queued")
                    except Exception as e:
                        led[key]["anims"][name] = {"status": f"error: {e}"}
                        print(f"{key}/{name}: ERROR {e}")
                    save_ledger(led)
    save_ledger(led)


def do_status():
    led = load_ledger()
    for key in CHARACTERS:
        e = led.get(key, {})
        anims = e.get("anims", {})
        queued = sum(1 for v in anims.values() if v.get("status") == "queued")
        print(f"{key}: id={e.get('character_id')} create={e.get('create_status', e.get('status'))} anims_queued={queued}/{len(KIT)}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["create", "poll-create", "animate", "status"])
    ap.add_argument("--max-inflight", type=int, default=4)
    ap.add_argument("--only", default=None, help="restrict to one hero key (lit-commando|lit-valkyrie)")
    a = ap.parse_args()
    if a.cmd == "create":
        asyncio.run(do_create())
    elif a.cmd == "poll-create":
        asyncio.run(do_poll_create())
    elif a.cmd == "animate":
        asyncio.run(do_animate(a.max_inflight, a.only))
    elif a.cmd == "status":
        do_status()


if __name__ == "__main__":
    main()

#!/usr/bin/env python
"""Slot-aware 8-direction animation pipeline for the HMH roster.

Why this exists: prior attempts fired all ~79 animation jobs at once and hit the
PixelLab concurrency wall (`need N slots but only 6 available`), so most never
completed and the few that did captured only one direction. This script:

  * animates each character's canonical kit in ALL 8 directions (directions=[...8])
  * submits in SMALL batches, polling get_character between batches so we never
    exceed the free concurrent-slot budget
  * keeps a resumable ledger keyed by `<char>/<anim>` so reruns never re-spend
  * (optional) first cleans the duplicate junk animations from prior failed runs

Characters are already created at n_directions:8, so we only pay for animation.

Usage:
  python scripts/pixellab-hmh-8dir-pipeline.py plan
  python scripts/pixellab-hmh-8dir-pipeline.py clean-junk --char lester        # delete dup -8dir anims
  python scripts/pixellab-hmh-8dir-pipeline.py animate --char lester [--max-inflight 4]
  python scripts/pixellab-hmh-8dir-pipeline.py animate-all [--max-inflight 4]
  python scripts/pixellab-hmh-8dir-pipeline.py status
"""
from __future__ import annotations
import argparse, asyncio, json, re, time
from pathlib import Path
from typing import Any
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

ROOT = Path(__file__).resolve().parents[1]
LEDGER = ROOT / "apps/portal/assets/generated/hmh-animated-roster/pipeline-8dir-ledger.json"
UUID_RE = re.compile(r"[0-9a-fA-F-]{36}")
ALL_DIRECTIONS = ["south", "south-east", "east", "north-east",
                  "north", "north-west", "west", "south-west"]
FRAME_COUNT = 6

# Canonical animation kits. name -> action description (front/south-facing verb;
# PixelLab rotates the action to each requested direction).
HERO = [
    ("idle", "standing idle, breathing, weapon ready, subtle bob"),
    ("walk", "walking forward steadily, weapon in hand"),
    ("run", "running fast forward, weapon in hand"),
    ("shoot", "firing a gun forward with muzzle recoil"),
    ("melee", "slashing forward with a combat knife"),
    ("throw", "throwing a grenade overhand"),
    ("hurt", "flinching and recoiling from taking damage"),
    ("death", "collapsing and falling down defeated"),
]
ENEMY = [
    ("idle", "standing idle menacingly, ready to attack"),
    ("walk", "walking forward toward the player"),
    ("attack", "lunging forward with a melee attack"),
    ("hurt", "flinching and recoiling from a hit"),
    ("death", "collapsing and falling down defeated"),
]
BOSS = [
    ("idle", "standing idle menacingly, powerful, looming"),
    ("walk", "advancing forward heavily and slowly"),
    ("attack", "swinging a heavy melee attack forward"),
    ("attack-ranged", "firing a ranged energy projectile forward"),
    ("attack-slam", "raising arms and slamming the ground"),
    ("hurt", "staggering backward from a heavy hit"),
    ("death", "collapsing and falling defeated dramatically"),
]

# key -> (character_id, kit). character_id None => needs creation first.
ROSTER: dict[str, tuple[str | None, list[tuple[str, str]]]] = {
    "lester": ("97185455-d6f8-4108-a0fc-ab90f451ddef", HERO),
    "fud-goblin": ("d0470066-7d2b-4195-bcb6-9e7c6f4638d8", ENEMY),
    "gas-fee-wisp": ("afb5c6c3-9d0a-48a0-a059-edc00b97aa50", ENEMY),
    "whale-dumper-boss": ("6b17f44f-4c87-48a4-8df3-d8f15a40d2c0", BOSS),
    "crypto-bro-rusher": ("170c9928-fcb5-4179-9ab5-768aa12b5f85", ENEMY),
    "evil-banker-ranged": ("522d99ae-64c3-4e8e-b61c-1b8cbebbe6b7", ENEMY),
    "trench-degen": ("9e591394-caf5-498c-886b-1161e1a64043", ENEMY),
    "gas-beast-tank": ("2035aef1-f38c-4e3d-97d3-c09563ba672b", ENEMY),
    "chain-reaper-boss": ("9ce10bf6-a5c4-457a-b485-e4f43fc67e3b", BOSS),
}

# Priority order for budget-aware runs (hero, core enemies, bosses).
PRIORITY = ["lester", "fud-goblin", "gas-fee-wisp", "crypto-bro-rusher",
            "trench-degen", "whale-dumper-boss", "chain-reaper-boss",
            "evil-banker-ranged", "gas-beast-tank"]


def load_server() -> dict[str, Any]:
    d = json.loads((Path.home() / ".claude.json").read_text(encoding="utf-8"))
    for p in d.get("projects", {}).values():
        s = p.get("mcpServers", {}).get("pixellab")
        if s:
            return s
    raise SystemExit("no pixellab server in ~/.claude.json")


def load_ledger() -> dict[str, Any]:
    if LEDGER.exists():
        return json.loads(LEDGER.read_text(encoding="utf-8"))
    return {}


def save_ledger(d: dict[str, Any]) -> None:
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    LEDGER.write_text(json.dumps(d, indent=2), encoding="utf-8")


def text_of(res: Any) -> str:
    return "\n".join(c.text for c in getattr(res, "content", []) or [] if hasattr(c, "text"))


def count_inflight(txt: str) -> int:
    """Best-effort: count animations still 'processing' from a get_character dump."""
    return len(re.findall(r"processing", txt, re.I))


def plan() -> None:
    rows = []
    total = 0
    for key in PRIORITY:
        cid, kit = ROSTER[key]
        rows.append({"char": key, "has_id": bool(cid), "anims": len(kit), "dir_jobs": len(kit) * 8})
        total += len(kit) * 8
    print(json.dumps({"characters": rows, "total_direction_jobs": total,
                      "note": "each anim animates all 8 directions in one call"}, indent=2))


async def animate_char(sess: ClientSession, key: str, max_inflight: int) -> None:
    cid, kit = ROSTER[key]
    if not cid:
        print(f"{key}: no character_id yet (needs creation) — skipping in this pass")
        return
    led = load_ledger()
    led.setdefault(key, {})
    for name, desc in kit:
        jk = name
        if led[key].get(jk, {}).get("status") == "queued":
            continue
        # throttle: wait until inflight under the cap
        while True:
            cur = text_of(await sess.call_tool("get_character", {"character_id": cid}))
            if count_inflight(cur) < max_inflight:
                break
            print(f"  [{key}] {count_inflight(cur)} inflight >= {max_inflight}, waiting 20s...", flush=True)
            time.sleep(20)
        try:
            res = await sess.call_tool("animate_character", {
                "character_id": cid,
                "action_description": desc,
                "animation_name": name,
                "directions": ALL_DIRECTIONS,
                "frame_count": FRAME_COUNT,
                "confirm_cost": True,
            })
            out = text_of(res)
            ids = [u for u in UUID_RE.findall(out) if u != cid]
            led[key][jk] = {"status": "queued", "directions": 8,
                            "job_ids": ids[:8], "raw": out[:160]}
            save_ledger(led)
            print(f"  queued {key}/{name} -> {len(ids)} job id(s)", flush=True)
            time.sleep(3)
        except Exception as exc:
            print(f"  ERR {key}/{name}: {exc}", flush=True)
            time.sleep(6)


async def run_animate(keys: list[str], max_inflight: int) -> None:
    server = load_server()
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (r, w, _):
        async with ClientSession(r, w) as sess:
            await sess.initialize()
            for key in keys:
                await animate_char(sess, key, max_inflight)
    print(json.dumps({"done": keys}, indent=2))


async def clean_junk(key: str) -> None:
    """Delete duplicate '-8dir' junk animations from prior failed runs."""
    server = load_server()
    cid, _ = ROSTER[key]
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (r, w, _):
        async with ClientSession(r, w) as sess:
            await sess.initialize()
            txt = text_of(await sess.call_tool("get_character", {"character_id": cid}))
            junk = sorted(set(re.findall(r"^\s+([a-z0-9-]+-8dir)\b", txt, re.M)))
            print(f"{key}: {len(junk)} junk anim types to delete: {junk}")
            for t in junk:
                try:
                    await sess.call_tool("delete_animation", {"character_id": cid, "animation_type": t, "confirm": True})
                    print(f"  deleted {t}", flush=True)
                    time.sleep(1)
                except Exception as exc:
                    print(f"  del err {t}: {exc}", flush=True)


def status() -> None:
    led = load_ledger()
    out = {}
    for key in PRIORITY:
        anims = led.get(key, {})
        out[key] = {"queued_anims": sum(1 for v in anims.values() if v.get("status") == "queued")}
    print(json.dumps(out, indent=2))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["plan", "animate", "animate-all", "clean-junk", "status"])
    ap.add_argument("--char", default=None)
    ap.add_argument("--max-inflight", type=int, default=4)
    args = ap.parse_args()
    if args.cmd == "plan":
        plan()
    elif args.cmd == "status":
        status()
    elif args.cmd == "clean-junk":
        asyncio.run(clean_junk(args.char or "lester"))
    elif args.cmd == "animate":
        asyncio.run(run_animate([args.char or "lester"], args.max_inflight))
    elif args.cmd == "animate-all":
        asyncio.run(run_animate(PRIORITY, args.max_inflight))


if __name__ == "__main__":
    main()

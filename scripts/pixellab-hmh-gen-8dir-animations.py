#!/usr/bin/env python
"""Generate FULL 8-direction animations for the priority HMH roster.

The existing account animations were generated south-only. This queues true
8-direction animations (omit `directions` => all 8) for the characters that
matter most in-game, then the harvest script can pull every direction.

Cost-aware: 8-dir v3 animation is the expensive call. We queue a curated,
prioritized list and run in resumable passes. Auth from ~/.claude.json.

Usage:
  python scripts/pixellab-hmh-gen-8dir-animations.py plan      # show what WOULD queue + count
  python scripts/pixellab-hmh-gen-8dir-animations.py queue [--limit N]
  python scripts/pixellab-hmh-gen-8dir-animations.py status
"""
from __future__ import annotations

import argparse, asyncio, json, re, time
from pathlib import Path
from typing import Any
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

ROOT = Path(__file__).resolve().parents[1]
LEDGER = ROOT / "apps/portal/assets/generated/hmh-animated-roster/gen8dir-ledger.json"
UUID_RE = re.compile(r"[0-9a-fA-F-]{36}")

# Priority characters (key -> character_id) and the animations each needs in 8 dirs.
# Heroes get the full kit; enemies get locomotion + attack + death; bosses get
# multiple attacks.
HERO_ANIMS = [
    ("idle", "standing idle breathing, subtle ready bob"),
    ("walk", "walking forward steadily"),
    ("run", "running fast forward"),
    ("shoot", "firing a gun forward with recoil"),
    ("melee", "slashing forward with a combat knife"),
    ("throw", "throwing a grenade overhand"),
    ("hurt", "recoiling flinching from taking damage"),
    ("death", "collapsing and falling defeated"),
]
ENEMY_ANIMS = [
    ("idle", "standing idle menacingly"),
    ("walk", "walking forward toward the player"),
    ("attack", "lunging forward attacking"),
    ("hurt", "recoiling flinching from a hit"),
    ("death", "collapsing and falling defeated"),
]
BOSS_ANIMS = [
    ("idle", "standing idle menacingly, powerful"),
    ("walk", "advancing forward heavily"),
    ("attack", "swinging a heavy melee attack"),
    ("attack-ranged", "firing a ranged energy projectile"),
    ("attack-slam", "raising up and slamming the ground"),
    ("hurt", "staggering from a heavy hit"),
    ("death", "collapsing defeated dramatically"),
]

TARGETS = {
    "lester": ("97185455-d6f8-4108-a0fc-ab90f451ddef", HERO_ANIMS),
    "lilly": ("61b040dd-d2cb-4f78-ab59-b1ad703bce84", HERO_ANIMS),
    "fud-goblin": ("d0470066-7d2b-4195-bcb6-9e7c6f4638d8", ENEMY_ANIMS),
    "gas-fee-wisp": ("afb5c6c3-9d0a-48a0-a059-edc00b97aa50", ENEMY_ANIMS),
    "crypto-bro-rusher": ("170c9928-fcb5-4179-9ab5-768aa12b5f85", ENEMY_ANIMS),
    "evil-banker-ranged": ("522d99ae-64c3-4e8e-b61c-1b8cbebbe6b7", ENEMY_ANIMS),
    "trench-degen": ("9e591394-caf5-498c-886b-1161e1a64043", ENEMY_ANIMS),
    "gas-beast-tank": ("2035aef1-f38c-4e3d-97d3-c09563ba672b", ENEMY_ANIMS),
    "rugpull-summoner": ("32f95be2-99d8-4507-8799-df8d14692b08", ENEMY_ANIMS),
    "whale-dumper-boss": ("6b17f44f-4c87-48a4-8df3-d8f15a40d2c0", BOSS_ANIMS),
    "chain-reaper-boss": ("9ce10bf6-a5c4-457a-b485-e4f43fc67e3b", BOSS_ANIMS),
    "bit-whale-boss": ("cecc4b9e-5c0a-44e9-9d42-211230c9b61b", BOSS_ANIMS),
    "warren-spear-rider": ("1b14807b-8bb7-495c-8ede-aa10c791ca51", BOSS_ANIMS),
}

FRAME_COUNT = 6


def load_server() -> dict[str, Any]:
    d = json.loads((Path.home()/".claude.json").read_text(encoding="utf-8"))
    for p in d.get("projects",{}).values():
        s=p.get("mcpServers",{}).get("pixellab")
        if s: return s
    raise SystemExit("no pixellab server")


def load_ledger() -> dict[str, Any]:
    if LEDGER.exists():
        return json.loads(LEDGER.read_text(encoding="utf-8"))
    return {}


def save_ledger(d: dict[str, Any]) -> None:
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    LEDGER.write_text(json.dumps(d, indent=2), encoding="utf-8")


def all_jobs():
    jobs = []
    for key, (cid, anims) in TARGETS.items():
        for name, desc in anims:
            jobs.append((key, cid, f"{name}-8dir", desc))
    return jobs


def plan():
    jobs = all_jobs()
    by_char = {}
    for key, _, name, _ in jobs:
        by_char.setdefault(key, []).append(name)
    print(json.dumps({"total_8dir_anim_jobs": len(jobs),
                      "approx_generation_cost_each": "~8-40 (8 directions)",
                      "by_character": {k: len(v) for k, v in by_char.items()}}, indent=2))


async def queue(limit):
    server = load_server()
    led = load_ledger()
    n = 0
    async with streamablehttp_client(server["url"], headers=server.get("headers",{})) as (r,w,_):
        async with ClientSession(r,w) as sess:
            await sess.initialize()
            for key, cid, name, desc in all_jobs():
                if limit is not None and n >= limit:
                    break
                jk = f"{key}/{name}"
                if led.get(jk, {}).get("animation_id"):
                    continue
                try:
                    # Omit `directions` => PixelLab animates all 8 directions.
                    res = await sess.call_tool("animate_character", {
                        "character_id": cid, "action_description": desc,
                        "animation_name": name, "mode": "v3", "frame_count": FRAME_COUNT,
                    })
                    text = "\n".join(c.text for c in res.content if hasattr(c, "text"))
                    ids = [u for u in UUID_RE.findall(text) if u != cid]
                    led[jk] = {"character_id": cid, "animation_id": ids[-1] if ids else None,
                               "status": "queued", "raw": text[:120]}
                    n += 1
                    print(f"queued {jk} -> {led[jk]['animation_id']}", flush=True)
                    save_ledger(led)
                    time.sleep(2)
                except Exception as exc:
                    print(f"ERR {jk}: {exc}", flush=True)
                    time.sleep(4)
    save_ledger(led)
    print(json.dumps({"queued_now": n, "total": len(all_jobs())}, indent=2))


def status():
    led = load_ledger()
    have = sum(1 for v in led.values() if v.get("animation_id"))
    print(json.dumps({"queued_with_ids": have, "total_jobs": len(all_jobs())}, indent=2))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("command", choices=["plan","queue","status"])
    ap.add_argument("--limit", type=int, default=None)
    a = ap.parse_args()
    if a.command == "plan": plan()
    elif a.command == "queue": asyncio.run(queue(a.limit))
    else: status()


if __name__ == "__main__":
    main()

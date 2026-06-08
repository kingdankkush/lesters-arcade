#!/usr/bin/env python
"""Resumable PixelLab generator: full animated Lester hero set (Phase A).

Builds an 8-direction Lester character and a rich animation set so the renderer
can do 16-way *facing* via in-engine interpolation/mirroring of the 8 generated
directions. Also creates weapon-hold STATES (pistol / shotgun / machine-gun)
each with their own fire/idle/walk animations, plus action animations
(knife, axe-throw, grenade-throw, take-damage, death, power-up grab).

Multi-stage, resumable via a ledger:
  create   -> create_character (humanoid, 8 directions, high top-down)
  states   -> create_character_state for each weapon-hold variant
  animate  -> animate_character (mode=v3) for base + each state's anim list
  collect  -> poll get_character + download every rotation/animation frame
  status   -> summarize ledger progress

Auth read from ~/.claude.json; never logged/committed.

Usage:
  python scripts/pixellab-hmh-lester-hero-wave.py create
  python scripts/pixellab-hmh-lester-hero-wave.py states
  python scripts/pixellab-hmh-lester-hero-wave.py animate [--limit N]
  python scripts/pixellab-hmh-lester-hero-wave.py collect [--limit N]
  python scripts/pixellab-hmh-lester-hero-wave.py status
"""
from __future__ import annotations

import argparse
import asyncio
import json
import re
import time
import urllib.request
from pathlib import Path
from typing import Any

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_ROOT = Path("apps/portal/assets/generated/hmh-lester-hero-wave")
OUT_ROOT = ROOT / PUBLIC_ROOT
LEDGER = OUT_ROOT / "lester-hero-ledger.json"
UUID_RE = re.compile(r"[0-9a-fA-F-]{36}")
URL_RE = re.compile(r"https?://[^\s,)\]>'\"]+")

NO_TEXT = "no words, no letters, no numbers, no logos, no watermark"
STYLE = (
    "retro 80s/90s arcade pixel-art hero, limited SNES/Neo-Geo palette, "
    "crisp clean readable silhouette, dark neon Litecoin-city mood, "
    "silver-and-blue accents; " + NO_TEXT
)
LOOK = (
    "Lester, a determined arcade run-and-gun hero in a silver-and-blue tactical "
    "jacket, dark cargo pants, fingerless gloves, short hair, athletic build, "
    "heroic confident stance"
)

# Base character (8 directions for 16-way in-engine interpolation).
BASE = {"id": "lester", "look": LOOK}

# Weapon-hold states (created from the base character via create_character_state).
# Each state gets its own idle/walk/fire animation set.
STATES = [
    ("pistol", "holding a compact silver pistol in two hands, ready stance"),
    ("shotgun", "holding a chunky silver-blue combat shotgun across the chest"),
    ("machinegun", "holding a heavy blue-silver machine gun braced at the hip"),
]

# Animations applied to the BASE character (unarmed locomotion + universal actions).
BASE_ANIMS = [
    ("idle", "standing idle breathing, subtle ready bob"),
    ("walk", "walking forward steadily"),
    ("run", "running fast forward"),
    ("knife", "slashing forward with a combat knife"),
    ("axe-throw", "throwing an axe overhand"),
    ("grenade-throw", "lobbing a grenade overhand"),
    ("hit", "recoiling backward flinching from taking damage"),
    ("death", "collapsing and falling down defeated"),
    ("powerup", "raising both arms triumphantly grabbing a power-up, glowing"),
]

# Animations applied to EACH weapon-hold state.
STATE_ANIMS = [
    ("idle", "standing idle aiming the weapon, ready stance"),
    ("walk", "walking forward while aiming the weapon"),
    ("fire", "firing the weapon forward with recoil"),
]

FRAME_COUNT = 6  # even, 4-16; keeps cost reasonable while reading as animation


def load_ledger() -> dict[str, Any]:
    if LEDGER.exists():
        return json.loads(LEDGER.read_text(encoding="utf-8"))
    return {"base": {}, "states": {}, "animations": {}}


def save_ledger(data: dict[str, Any]) -> None:
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    LEDGER.write_text(json.dumps(data, indent=2), encoding="utf-8")


def load_server() -> dict[str, Any]:
    d = json.loads((Path.home() / ".claude.json").read_text(encoding="utf-8"))
    for proj in d.get("projects", {}).values():
        srv = proj.get("mcpServers", {}).get("pixellab")
        if srv:
            return srv
    raise SystemExit("no pixellab MCP server in ~/.claude.json")


def result_text(result: Any) -> str:
    return "\n".join(c.text for c in getattr(result, "content", []) or [] if hasattr(c, "text"))


async def create() -> None:
    data = load_ledger()
    server = load_server()
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (r, w, _):
        async with ClientSession(r, w) as sess:
            await sess.initialize()
            if data["base"].get("character_id"):
                print(f"skip base (have id {data['base']['character_id']})", flush=True)
            else:
                res = await sess.call_tool("create_character", {
                    "description": f"{BASE['look']}; {STYLE}",
                    "name": "lester-hero", "body_type": "humanoid", "mode": "standard",
                    "n_directions": 8, "size": 64, "view": "high top-down",
                })
                text = result_text(res)
                m = UUID_RE.search(text)
                data["base"] = {"id": "lester", "character_id": m.group(0) if m else None,
                                "status": "creating", "raw": text[:160]}
                print(f"created base lester -> {data['base']['character_id']}", flush=True)
            save_ledger(data)


async def states() -> None:
    data = load_ledger()
    server = load_server()
    base_id = data["base"].get("character_id")
    if not base_id:
        raise SystemExit("run `create` first (no base character_id)")
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (r, w, _):
        async with ClientSession(r, w) as sess:
            await sess.initialize()
            for sid, desc in STATES:
                if data["states"].get(sid, {}).get("character_id"):
                    print(f"skip state {sid} (have id)", flush=True)
                    continue
                try:
                    res = await sess.call_tool("create_character_state", {
                        "character_id": base_id,
                        "edit_description": desc,
                        "use_color_palette_from_reference": True,
                    })
                    text = result_text(res)
                    m = UUID_RE.search(text)
                    data["states"][sid] = {"id": sid, "character_id": m.group(0) if m else None,
                                           "status": "creating", "raw": text[:160]}
                    print(f"state {sid} -> {data['states'][sid]['character_id']}", flush=True)
                    save_ledger(data)
                    time.sleep(2)
                except Exception as exc:
                    print(f"ERR state {sid}: {exc}", flush=True)
                    time.sleep(4)
    save_ledger(data)


def anim_jobs() -> list[tuple[str, str, str, str]]:
    """Return (owner_key, character_id_field, anim_name, action_desc) specs."""
    jobs: list[tuple[str, str, str, str]] = []
    for name, desc in BASE_ANIMS:
        jobs.append(("base", "base", name, desc))
    for sid, _ in STATES:
        for name, desc in STATE_ANIMS:
            jobs.append((f"state:{sid}", sid, f"{sid}-{name}", desc))
    return jobs


def resolve_char_id(data: dict[str, Any], owner: str) -> str | None:
    if owner == "base":
        return data["base"].get("character_id")
    return data["states"].get(owner, {}).get("character_id")


async def animate(limit: int | None) -> None:
    data = load_ledger()
    server = load_server()
    queued = 0
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (r, w, _):
        async with ClientSession(r, w) as sess:
            await sess.initialize()
            for owner_key, owner, anim_name, desc in anim_jobs():
                if limit is not None and queued >= limit:
                    break
                if data["animations"].get(anim_name, {}).get("animation_id"):
                    continue
                cid = resolve_char_id(data, owner)
                if not cid:
                    print(f"skip {anim_name} (owner {owner} has no character_id yet)", flush=True)
                    continue
                try:
                    res = await sess.call_tool("animate_character", {
                        "character_id": cid, "action_description": desc,
                        "animation_name": anim_name, "mode": "v3", "frame_count": FRAME_COUNT,
                    })
                    text = result_text(res)
                    m = UUID_RE.search(text)
                    data["animations"][anim_name] = {
                        "animation_id": m.group(0) if m else None, "owner": owner_key,
                        "character_id": cid, "status": "queued", "raw": text[:140]}
                    queued += 1
                    print(f"anim {anim_name} ({owner_key}) -> {data['animations'][anim_name]['animation_id']}", flush=True)
                    save_ledger(data)
                    time.sleep(2)
                except Exception as exc:
                    print(f"ERR anim {anim_name}: {exc}", flush=True)
                    time.sleep(4)
    save_ledger(data)
    print(json.dumps({"queued_now": queued, "total_anim_specs": len(anim_jobs())}, indent=2))


def download(url: str, dest: Path) -> bool:
    try:
        dest.parent.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(url, headers={"User-Agent": "hmh-lester"})
        with urllib.request.urlopen(req, timeout=120) as resp:
            dest.write_bytes(resp.read())
        return dest.stat().st_size > 0
    except Exception as exc:
        print(f"  download err: {exc}", flush=True)
        return False


async def collect(limit: int | None) -> None:
    data = load_ledger()
    server = load_server()
    done = 0
    # Map of character_id -> friendly dir name for output organization.
    char_dirs = {data["base"].get("character_id"): "base"}
    for sid, s in data["states"].items():
        if s.get("character_id"):
            char_dirs[s["character_id"]] = f"state-{sid}"
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (r, w, _):
        async with ClientSession(r, w) as sess:
            await sess.initialize()
            seen_ids = [cid for cid in char_dirs if cid]
            for cid in seen_ids:
                if limit is not None and done >= limit:
                    break
                try:
                    res = await sess.call_tool("get_character", {"character_id": cid})
                    text = result_text(res)
                    urls = [u for u in URL_RE.findall(text) if ".png" in u.lower()]
                    sub = char_dirs[cid]
                    for i, u in enumerate(urls):
                        dest = OUT_ROOT / sub / f"{i:03d}.png"
                        if download(u, dest):
                            done += 1
                    print(f"  {sub} ({cid[:8]}): {len(urls)} pngs", flush=True)
                except Exception as exc:
                    print(f"  ERR collect {cid[:8]}: {exc}", flush=True)
                time.sleep(1.0)
    save_ledger(data)
    print(json.dumps({"downloaded_now": done}, indent=2))


def status() -> None:
    data = load_ledger()
    jobs = anim_jobs()
    anims_have = sum(1 for j in jobs if data["animations"].get(j[2], {}).get("animation_id"))
    out = {
        "base_id": bool(data["base"].get("character_id")),
        "states": {sid: bool(data["states"].get(sid, {}).get("character_id")) for sid, _ in STATES},
        "animations_have_ids": anims_have,
        "animations_total": len(jobs),
        "anim_list": [j[2] for j in jobs],
    }
    print(json.dumps(out, indent=2))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("command", choices=["create", "states", "animate", "collect", "status"])
    ap.add_argument("--limit", type=int, default=None)
    args = ap.parse_args()
    if args.command == "create":
        asyncio.run(create())
    elif args.command == "states":
        asyncio.run(states())
    elif args.command == "animate":
        asyncio.run(animate(args.limit))
    elif args.command == "collect":
        asyncio.run(collect(args.limit))
    else:
        status()


if __name__ == "__main__":
    main()

#!/usr/bin/env python
"""PixelLab humanoid enemy generator for Hard Money Heroes (6 Web3-culture foes).

Uses the multi-step CHARACTER pipeline:
  create_character (humanoid, high top-down to match the iso game, 4 directions)
  -> poll get_character until rotations are ready
  -> animate_character for: walk, attack, hit, death
  -> collect spritesheet/frame URLs into the ledger.

Each enemy is biome-linked. Resumable via a ledger JSON. Auth from ~/.claude.json
(never logged/committed).

Usage:
  python scripts/pixellab-hmh-enemies-wave.py create        # create base characters
  python scripts/pixellab-hmh-enemies-wave.py animate       # queue walk/attack/hit/death
  python scripts/pixellab-hmh-enemies-wave.py collect        # download ready frames
  python scripts/pixellab-hmh-enemies-wave.py status
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
PUBLIC_ROOT = Path("apps/portal/assets/generated/hmh-enemies-wave")
OUT_ROOT = ROOT / PUBLIC_ROOT
LEDGER = OUT_ROOT / "enemies-ledger.json"
UUID_RE = re.compile(r"[0-9a-fA-F-]{36}")
URL_RE = re.compile(r"https?://[^\s,)\]>'\"]+")

NO_TEXT = "no words, no letters, no numbers, no logos, no watermark"
STYLE = (
    "retro 80s/90s arcade pixel-art character, limited SNES/Neo-Geo palette, "
    "crisp clean readable silhouette, dark neon Litecoin-city mood, "
    "silver-and-blue accents; " + NO_TEXT
)

# id, biome, appearance, animations (action descriptions)
ENEMIES = [
    ("diamond-hands-whale", "rock",
     "burly tough thug in a diamond-encrusted blue suit, huge fists, whale-themed bling, smug heavy bruiser"),
    ("influencer-shill", "pavement",
     "flashy crypto influencer in gold chains holding a glowing megaphone and phone, hype-man caster"),
    ("rug-pull-dev", "grass",
     "shady hoodie developer with a laptop and a rolled carpet under one arm, sneaky thin saboteur"),
    ("maxi-zealot", "sand",
     "fanatic cultist in orange robes with glowing laser eyes, raised fists, zealot believer"),
    ("mempool-bot-runner", "water",
     "fast lean cyborg courier with neon visor and data-cable limbs, sprinter runner"),
    ("taxman-validator", "gravel",
     "heavy armored authority validator in grey riot armor with a glowing badge and baton, slow enforcer"),
]

ANIMS = [
    ("walk", "walking forward steadily"),
    ("attack", "lunging forward in an aggressive attack swing"),
    ("hit", "recoiling backward flinching from being hit"),
    ("death", "collapsing and falling down defeated"),
]


def load_ledger() -> dict[str, Any]:
    if LEDGER.exists():
        return json.loads(LEDGER.read_text(encoding="utf-8"))
    return {"characters": {}}


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
    chars = data["characters"]
    server = load_server()
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (r, w, _):
        async with ClientSession(r, w) as sess:
            await sess.initialize()
            for eid, biome, look in ENEMIES:
                if eid in chars and chars[eid].get("character_id"):
                    print(f"skip {eid} (have id)", flush=True)
                    continue
                try:
                    res = await sess.call_tool("create_character", {
                        "description": f"{look}; {STYLE}",
                        "name": eid, "body_type": "humanoid", "mode": "standard",
                        "n_directions": 4, "size": 64, "view": "high top-down",
                    })
                    text = result_text(res)
                    m = UUID_RE.search(text)
                    chars[eid] = {"id": eid, "biome": biome, "character_id": m.group(0) if m else None,
                                  "status": "creating", "animations": {}, "raw": text[:160]}
                    print(f"created {eid} -> {chars[eid]['character_id']}", flush=True)
                    time.sleep(1.5)
                except Exception as exc:
                    print(f"ERR create {eid}: {exc}", flush=True)
                    time.sleep(3)
            save_ledger(data)
    print(json.dumps({"created": sum(1 for c in chars.values() if c.get('character_id'))}, indent=2))


async def animate() -> None:
    data = load_ledger()
    server = load_server()
    queued = 0
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (r, w, _):
        async with ClientSession(r, w) as sess:
            await sess.initialize()
            for eid, c in data["characters"].items():
                cid = c.get("character_id")
                if not cid:
                    continue
                for aname, adesc in ANIMS:
                    if c["animations"].get(aname, {}).get("animation_id"):
                        continue
                    try:
                        # mode="v3" is the custom action-description animation engine.
                        # (The old mode="template" failed with "template mode requires
                        # template_animation_id" since no template id was supplied.)
                        res = await sess.call_tool("animate_character", {
                            "character_id": cid, "action_description": adesc,
                            "animation_name": aname, "mode": "v3", "frame_count": 4,
                        })
                        text = result_text(res)
                        # The response often echoes the source character_id first; the
                        # NEW animation id is the last UUID that is not the character id.
                        ids = [u for u in UUID_RE.findall(text) if u != cid]
                        anim_id = ids[-1] if ids else None
                        c["animations"][aname] = {"animation_id": anim_id,
                                                  "status": "queued", "raw": text[:140]}
                        queued += 1
                        print(f"anim {eid}/{aname} -> {c['animations'][aname]['animation_id']}", flush=True)
                        time.sleep(1.5)
                    except Exception as exc:
                        print(f"ERR anim {eid}/{aname}: {exc}", flush=True)
                        time.sleep(3)
            save_ledger(data)
    print(json.dumps({"queued_anims": queued}, indent=2))


def download(url: str, dest: Path) -> bool:
    try:
        dest.parent.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(url, headers={"User-Agent": "hmh-enemies"})
        with urllib.request.urlopen(req, timeout=90) as resp:
            dest.write_bytes(resp.read())
        return dest.stat().st_size > 0
    except Exception as exc:
        print(f"  download err: {exc}", flush=True)
        return False


async def collect() -> None:
    data = load_ledger()
    server = load_server()
    done = 0
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (r, w, _):
        async with ClientSession(r, w) as sess:
            await sess.initialize()
            for eid, c in data["characters"].items():
                cid = c.get("character_id")
                if not cid:
                    continue
                try:
                    res = await sess.call_tool("get_character", {"character_id": cid})
                    text = result_text(res)
                    urls = [u for u in URL_RE.findall(text) if ".png" in u.lower()]
                    for i, u in enumerate(urls):
                        dest = OUT_ROOT / c["biome"] / f"{eid}-{i:02d}.png"
                        if download(u, dest):
                            done += 1
                    if urls:
                        c["status"] = "complete"
                        c["frame_count"] = len(urls)
                        c["src_dir"] = f"./assets/generated/hmh-enemies-wave/{c['biome']}/"
                        print(f"  {eid}: {len(urls)} frames", flush=True)
                    else:
                        c["status"] = "processing"
                        print(f"  {eid}: processing", flush=True)
                except Exception as exc:
                    print(f"  ERR collect {eid}: {exc}", flush=True)
                time.sleep(1.0)
    save_ledger(data)
    by_status: dict[str, int] = {}
    for c in data["characters"].values():
        by_status[c.get("status", "?")] = by_status.get(c.get("status", "?"), 0) + 1
    print(json.dumps({"downloaded_now": done, "by_status": by_status}, indent=2))


def status() -> None:
    data = load_ledger()
    out = {}
    for eid, c in data["characters"].items():
        out[eid] = {"status": c.get("status"), "has_id": bool(c.get("character_id")),
                    "anims": {a: bool(v.get("animation_id")) for a, v in c.get("animations", {}).items()},
                    "frames": c.get("frame_count", 0)}
    print(json.dumps({"enemies": out, "total_specs": len(ENEMIES)}, indent=2))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("command", choices=["create", "animate", "collect", "status"])
    args = ap.parse_args()
    if args.command == "create":
        asyncio.run(create())
    elif args.command == "animate":
        asyncio.run(animate())
    elif args.command == "collect":
        asyncio.run(collect())
    else:
        status()


if __name__ == "__main__":
    main()

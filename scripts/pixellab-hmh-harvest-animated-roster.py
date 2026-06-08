#!/usr/bin/env python
"""Harvest the existing animated 8-direction PixelLab character roster.

Recon found a large library of already-generated animated characters on the
account (Lester 9anim, Whale Dumper Boss 13anim, Gas Fee Wisp 12anim, FUD Goblin
7anim, full HMH ISO roster, Lilly alt hero). This script downloads EVERY
animation x EVERY direction x EVERY frame for the curated set below, and writes
a runtime manifest mapping role/state -> directional frame lists.

~0 new generations (pure get_character + download). Resumable via the on-disk
files (skips frames already downloaded). Auth from ~/.claude.json (never logged).

Usage:
  python scripts/pixellab-hmh-harvest-animated-roster.py list      # show roster + anim names
  python scripts/pixellab-hmh-harvest-animated-roster.py harvest   # download everything
  python scripts/pixellab-hmh-harvest-animated-roster.py manifest  # (re)build manifest from disk
"""
from __future__ import annotations

import argparse
import asyncio
import json
import re
import urllib.request
from pathlib import Path
from typing import Any

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

ROOT = Path(__file__).resolve().parents[1]
OUT_ROOT = ROOT / "apps/portal/assets/generated/hmh-animated-roster"
MANIFEST = OUT_ROOT / "hmh-animated-roster.mjs"
LEDGER = OUT_ROOT / "roster-ledger.json"
URL_RE = re.compile(r"https?://[^\s,)\]>'\"]+")

# Curated roster: friendly key -> (character_id, role). Picked the richest /
# canonical instances from list_characters recon.
ROSTER = {
    "lester": ("97185455-d6f8-4108-a0fc-ab90f451ddef", "hero"),
    "whale-dumper-boss": ("6b17f44f-4c87-48a4-8df3-d8f15a40d2c0", "boss"),
    "gas-fee-wisp": ("afb5c6c3-9d0a-48a0-a059-edc00b97aa50", "enemy"),
    "fud-goblin": ("d0470066-7d2b-4195-bcb6-9e7c6f4638d8", "enemy"),
    "chain-reaper-boss": ("9ce10bf6-a5c4-457a-b485-e4f43fc67e3b", "boss"),
    "bit-whale-boss": ("cecc4b9e-5c0a-44e9-9d42-211230c9b61b", "boss"),
    "warren-spear-rider": ("1b14807b-8bb7-495c-8ede-aa10c791ca51", "miniboss"),
    "rugpull-summoner": ("32f95be2-99d8-4507-8799-df8d14692b08", "enemy"),
    "gas-beast-tank": ("2035aef1-f38c-4e3d-97d3-c09563ba672b", "enemy"),
    "crypto-bro-rusher": ("170c9928-fcb5-4179-9ab5-768aa12b5f85", "enemy"),
    "evil-banker-ranged": ("522d99ae-64c3-4e8e-b61c-1b8cbebbe6b7", "enemy"),
    "trench-degen": ("9e591394-caf5-498c-886b-1161e1a64043", "enemy"),
    "lilly": ("61b040dd-d2cb-4f78-ab59-b1ad703bce84", "hero"),
    # New playable heroes (created via pixellab-new-heroes-pipeline.py).
    "lit-commando": ("c96d19d1-8958-4fcd-b517-9dfded9e0051", "hero"),
    "lit-valkyrie": ("74b5efc0-e7d8-4400-85f5-9db85ef05db9", "hero"),
}

DIRECTIONS = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"]


def load_server() -> dict[str, Any]:
    d = json.loads((Path.home() / ".claude.json").read_text(encoding="utf-8"))
    for proj in d.get("projects", {}).values():
        srv = proj.get("mcpServers", {}).get("pixellab")
        if srv:
            return srv
    raise SystemExit("no pixellab MCP server in ~/.claude.json")


def result_text(result: Any) -> str:
    return "\n".join(c.text for c in getattr(result, "content", []) or [] if hasattr(c, "text"))


def parse_character(text: str) -> dict[str, Any]:
    """Parse get_character text into {animations: [{name, anim_id, frames:{dir:[urls]}}], rotations:{dir:url}}.

    The text lists animation blocks; each animation has an animation UUID embedded
    in its frame URLs (.../animations/<anim_id>/<direction>/<n>.png) and a label
    line like 'idle (south, 5f)'. We group URLs by (anim_id, direction).
    """
    urls = [u for u in URL_RE.findall(text) if ".png" in u.lower()]
    anims: dict[str, dict[str, list[str]]] = {}
    rotations: dict[str, str] = {}
    anim_order: list[str] = []
    for u in urls:
        m = re.search(r"/animations/([0-9a-f-]{36})/([a-z-]+)/(\d+)\.png", u)
        if m:
            aid, direction, frame = m.group(1), m.group(2), int(m.group(3))
            anims.setdefault(aid, {}).setdefault(direction, [])
            anims[aid][direction].append((frame, u))
            if aid not in anim_order:
                anim_order.append(aid)
            continue
        mr = re.search(r"/rotations?/([a-z-]+)\.png", u)
        if mr:
            rotations[mr.group(1)] = u
    # sort frames
    for aid, dirs in anims.items():
        for direction in dirs:
            dirs[direction] = [u for _, u in sorted(dirs[direction])]
    # label map: lines look like '  idle (south, 5f) 2026-..'; capture in order.
    labels = re.findall(r"^\s+([a-z][a-z0-9-]+)\s*\((?:south|north|east|west)",
                        text, re.MULTILINE)
    return {"anim_order": anim_order, "anims": anims, "rotations": rotations, "labels": labels}


def download(url: str, dest: Path) -> bool:
    if dest.exists() and dest.stat().st_size > 0:
        return True
    try:
        dest.parent.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(url, headers={"User-Agent": "hmh-harvest"})
        with urllib.request.urlopen(req, timeout=120) as resp:
            dest.write_bytes(resp.read())
        return dest.stat().st_size > 0
    except Exception as exc:
        print(f"    dl err: {exc}", flush=True)
        return False


async def harvest() -> None:
    server = load_server()
    ledger: dict[str, Any] = {}
    total = 0
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (r, w, _):
        async with ClientSession(r, w) as sess:
            await sess.initialize()
            for key, (cid, role) in ROSTER.items():
                try:
                    res = await sess.call_tool("get_character", {"character_id": cid})
                    parsed = parse_character(result_text(res))
                except Exception as exc:
                    print(f"{key}: ERR {exc}", flush=True)
                    continue
                anim_ids = parsed["anim_order"]
                labels = parsed["labels"]
                entry = {"role": role, "character_id": cid, "animations": {}}
                # Name animations: use label list positionally; dedupe repeated names with suffix.
                used: dict[str, int] = {}
                for idx, aid in enumerate(anim_ids):
                    raw_name = labels[idx] if idx < len(labels) else f"anim{idx}"
                    n = used.get(raw_name, 0)
                    name = raw_name if n == 0 else f"{raw_name}-{n+1}"
                    used[raw_name] = n + 1
                    dirs = parsed["anims"][aid]
                    saved_dirs: dict[str, list[str]] = {}
                    for direction, frame_urls in dirs.items():
                        rels = []
                        for fi, u in enumerate(frame_urls):
                            dest = OUT_ROOT / key / name / direction / f"{fi:02d}.png"
                            if download(u, dest):
                                rels.append(f"./assets/generated/hmh-animated-roster/{key}/{name}/{direction}/{fi:02d}.png")
                                total += 1
                        if rels:
                            saved_dirs[direction] = rels
                    if saved_dirs:
                        entry["animations"][name] = saved_dirs
                    print(f"  {key}/{name}: {sum(len(v) for v in saved_dirs.values())} frames across {len(saved_dirs)} dirs", flush=True)
                ledger[key] = entry
                print(f"{key}: {len(entry['animations'])} animations harvested", flush=True)
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    LEDGER.write_text(json.dumps(ledger, indent=2), encoding="utf-8")
    print(json.dumps({"characters": len(ledger), "frames_downloaded": total}, indent=2))


def build_manifest() -> None:
    ledger = json.loads(LEDGER.read_text(encoding="utf-8"))
    body = json.dumps(ledger, indent=2)
    MANIFEST.write_text(
        "// AUTO-GENERATED by pixellab-hmh-harvest-animated-roster.py. Do not hand-edit.\n"
        "// 8-direction animated character roster (heroes/enemies/bosses).\n"
        "// Shape: { <key>: { role, character_id, animations: { <name>: { <direction>: [framePaths] } } } }\n"
        f"export const HMH_ANIMATED_ROSTER = Object.freeze({body});\n",
        encoding="utf-8",
    )
    print(f"wrote {MANIFEST.relative_to(ROOT)} with {len(ledger)} characters")


async def show_list() -> None:
    server = load_server()
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (r, w, _):
        async with ClientSession(r, w) as sess:
            await sess.initialize()
            for key, (cid, role) in ROSTER.items():
                res = await sess.call_tool("get_character", {"character_id": cid})
                parsed = parse_character(result_text(res))
                print(f"{key} ({role}): {len(parsed['anim_order'])} anims, labels={parsed['labels'][:12]}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("command", choices=["list", "harvest", "manifest"])
    args = ap.parse_args()
    if args.command == "harvest":
        asyncio.run(harvest())
        build_manifest()
    elif args.command == "manifest":
        build_manifest()
    else:
        asyncio.run(show_list())


if __name__ == "__main__":
    main()

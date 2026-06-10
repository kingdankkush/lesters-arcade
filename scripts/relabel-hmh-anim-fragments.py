#!/usr/bin/env python
"""Relabel positional animN harvest fragments into proper <name>/<direction> kits.

The harvest script's label regex missed PixelLab's current get_character text
format, so lit-valkyrie / lit-commando frames landed as anim0..animN, each
holding ONE direction. This script re-fetches each character's text, pairs
every animation UUID with its (label, direction) from the listing, moves the
on-disk frames to <char>/<base>/<direction>/NN.png, fixes the ledger, and
rebuilds the runtime manifest via the consolidator's writer.

Usage: python scripts/tmp-relabel-anim-fragments.py
"""
from __future__ import annotations

import asyncio
import json
import re
import shutil
from pathlib import Path

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

ROOT = Path(__file__).resolve().parents[1]
OUT_ROOT = ROOT / "apps/portal/assets/generated/hmh-animated-roster"
LEDGER = OUT_ROOT / "roster-ledger.json"

CHARS = {
    "lit-valkyrie": "74b5efc0-e7d8-4400-85f5-9db85ef05db9",
    "lit-commando": "c96d19d1-8958-4fcd-b517-9dfded9e0051",
}

# Canonical renderer names. Commando used custom labels at creation time.
NAME_MAP = {
    "fire-pistol": "shoot",
    "fire-shotgun": "shoot-shotgun",
    "melee-knife": "melee",
    "throw-axe": "throw",
}

URL_RE = re.compile(r"/animations/([0-9a-f-]{36})/([a-z-]+)/(\d+)\.png")
# Listing line: "  idle (north-west, 7f) 2026-06-10" — capture name + direction.
# NOTE: longer direction tokens MUST come first in the alternation, otherwise
# "south-east" matches as "south" (the \b boundary sits happily before "-").
LABEL_RE = re.compile(r"^\s*([a-z][a-z0-9-]*)\s*\((south-east|north-east|north-west|south-west|south|north|east|west)\b", re.M)


def load_server():
    d = json.loads((Path.home() / ".claude.json").read_text(encoding="utf-8"))
    for proj in d.get("projects", {}).values():
        srv = proj.get("mcpServers", {}).get("pixellab")
        if srv:
            return srv
    raise SystemExit("no pixellab server")


async def main() -> None:
    srv = load_server()
    ledger = json.loads(LEDGER.read_text(encoding="utf-8"))
    async with streamablehttp_client(srv["url"], headers=srv.get("headers")) as (r, w, _):
        async with ClientSession(r, w) as s:
            await s.initialize()
            for key, cid in CHARS.items():
                res = await s.call_tool("get_character", {"character_id": cid})
                text = "\n".join(c.text for c in res.content if hasattr(c, "text"))
                # anim ids in first-seen order (matches harvest's anim_order)
                anim_order: list[str] = []
                for m in URL_RE.finditer(text):
                    if m.group(1) not in anim_order:
                        anim_order.append(m.group(1))
                labels = LABEL_RE.findall(text)
                print(f"{key}: {len(anim_order)} anim ids, {len(labels)} labels parsed")
                if len(labels) != len(anim_order):
                    print(f"  WARN count mismatch — pairing first {min(len(labels), len(anim_order))}")
                entry = ledger.get(key) or {"role": "hero", "character_id": cid, "animations": {}}
                new_anims: dict[str, dict[str, list[str]]] = {}
                # Keep any already-correct (non-animN) names, e.g. idle harvested earlier.
                for name, dirs in entry.get("animations", {}).items():
                    if not re.fullmatch(r"anim\d+", name):
                        base = NAME_MAP.get(name, name)
                        bucket = new_anims.setdefault(base, {})
                        for d, frames in dirs.items():
                            if d not in bucket or len(frames) > len(bucket[d]):
                                bucket[d] = frames
                for idx, aid in enumerate(anim_order):
                    if idx >= len(labels):
                        break
                    raw, direction = labels[idx]
                    base = NAME_MAP.get(raw, raw)
                    src_dir = OUT_ROOT / key / f"anim{idx}" / direction
                    if not src_dir.is_dir():
                        # frame folder may have been harvested under its real name already
                        continue
                    dst_dir = OUT_ROOT / key / base / direction
                    dst_dir.mkdir(parents=True, exist_ok=True)
                    rels = []
                    for png in sorted(src_dir.glob("*.png")):
                        dst = dst_dir / png.name
                        if not dst.exists():
                            shutil.copy2(png, dst)
                        rels.append(f"./assets/generated/hmh-animated-roster/{key}/{base}/{direction}/{png.name}")
                    if rels:
                        bucket = new_anims.setdefault(base, {})
                        if direction not in bucket or len(rels) > len(bucket[direction]):
                            bucket[direction] = rels
                entry["animations"] = new_anims
                ledger[key] = entry
                cov = {n: len(d) for n, d in new_anims.items()}
                print(f"  -> {key} coverage: {cov}")
    LEDGER.write_text(json.dumps(ledger, indent=2), encoding="utf-8")
    print("ledger updated")


asyncio.run(main())

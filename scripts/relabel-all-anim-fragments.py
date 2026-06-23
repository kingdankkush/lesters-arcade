#!/usr/bin/env python
"""Relabel ALL animN harvest fragments into proper <name>/<direction> kits.

Extended from relabel-hmh-anim-fragments.py to cover every character with
fragment dirs, not just lit-valkyrie and lit-commando.

Usage: python scripts/relabel-all-anim-fragments.py
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

# All characters from roster-ledger.json with their PixelLab character IDs
CHARS = {
    "lester":              "97185455-d6f8-4108-a0fc-ab90f451ddef",
    "whale-dumper-boss":   "6b17f44f-4c87-48a4-8df3-d8f15a40d2c0",
    "gas-fee-wisp":        "afb5c6c3-9d0a-48a0-a059-edc00b97aa50",
    "fud-goblin":          "d0470066-7d2b-4195-bcb6-9e7c6f4638d8",
    "chain-reaper-boss":   "9ce10bf6-a5c4-457a-b485-e4f43fc67e3b",
    "bit-whale-boss":      "cecc4b9e-5c0a-44e9-9d42-211230c9b61b",
    "warren-spear-rider":  "1b14807b-8bb7-495c-8ede-aa10c791ca51",
    "rugpull-summoner":    "32f95be2-99d8-4507-8799-df8d14692b08",
    "gas-beast-tank":      "2035aef1-f38c-4e3d-97d3-c09563ba672b",
    "crypto-bro-rusher":   "170c9928-fcb5-4179-9ab5-768aa12b5f85",
    "evil-banker-ranged":  "522d99ae-64c3-4e8e-b61c-1b8cbebbe6b7",
    "trench-degen":        "9e591394-caf5-498c-886b-1161e1a64043",
    "lilly":               "61b040dd-d2cb-4f78-ab59-b1ad703bce84",
    "lit-commando":        "c96d19d1-8958-4fcd-b517-9dfded9e0051",
    "lit-valkyrie":        "74b5efc0-e7d8-4400-85f5-9db85ef05db9",
}

# Custom creation-time labels → canonical renderer names
NAME_MAP = {
    "fire-pistol": "shoot",
    "fire-shotgun": "shoot-shotgun",
    "melee-knife": "melee",
    "throw-axe": "throw",
    "idle-8dir": "idle",
    "walk-8dir": "walk",
    "run-8dir": "run",
    "death-8dir": "death",
    "hurt-8dir": "hurt",
    "attack-8dir": "attack",
    "attack-ranged-8dir": "attack-ranged",
    "melee-8dir": "melee",
    "shoot-8dir": "shoot",
    "throw-8dir": "throw",
    "attack-slam-8dir": "attack-slam",
    "shoot-8dir": "shoot",
}

URL_RE = re.compile(r"/animations/([0-9a-f-]{36})/([a-z-]+)/(\d+)\.png")
# Listing line: "  idle (north-west, 7f) 2026-06-10" — capture name + direction.
# NOTE: longer direction tokens MUST come first in the alternation, otherwise
# "south-east" matches as "south" (the \b boundary sits happily before "-").
LABEL_RE = re.compile(
    r"^\s*([a-z][a-z0-9-]*)\s*\((south-east|north-east|north-west|south-west|south|north|east|west)\b",
    re.M,
)


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

    stats = {"relabeled": 0, "files_moved": 0, "skipped": 0, "errors": 0}

    async with streamablehttp_client(srv["url"], headers=srv.get("headers")) as (r, w, _):
        async with ClientSession(r, w) as s:
            await s.initialize()

            for key, cid in CHARS.items():
                char_dir = OUT_ROOT / key
                if not char_dir.is_dir():
                    print(f"SKIP {key}: no directory on disk")
                    continue

                # Check if this char has any animN dirs
                anim_dirs = [d for d in char_dir.iterdir() if d.is_dir() and d.name.startswith("anim")]
                if not anim_dirs:
                    print(f"SKIP {key}: no animN fragments")
                    continue

                # Also check for split semantic dirs (walk-2, idle-3, etc.) that need consolidation
                split_dirs = [d for d in char_dir.iterdir()
                              if d.is_dir() and not d.name.startswith("anim")
                              and re.match(r'^[a-z]+-\d+$', d.name)]

                # Fetch character listing from PixelLab
                try:
                    res = await s.call_tool("get_character", {"character_id": cid})
                    text = "\n".join(c.text for c in res.content if hasattr(c, "text"))
                except Exception as e:
                    print(f"ERROR {key}: get_character failed: {e}")
                    stats["errors"] += 1
                    continue

                # Extract animation IDs in first-seen order
                anim_order: list[str] = []
                for m in URL_RE.finditer(text):
                    if m.group(1) not in anim_order:
                        anim_order.append(m.group(1))

                labels = LABEL_RE.findall(text)
                print(f"\n{key}: {len(anim_order)} anim ids, {len(labels)} labels, {len(anim_dirs)} animN dirs, {len(split_dirs)} split dirs")

                if len(labels) != len(anim_order):
                    print(f"  WARN count mismatch — pairing first {min(len(labels), len(anim_order))}")

                # Build new animations dict, preserving already-correct entries
                entry = ledger.get(key) or {"role": "unknown", "character_id": cid, "animations": {}}
                new_anims: dict[str, dict[str, list[str]]] = {}

                # Keep already-correct (non-animN, non-split) names
                for name, dirs in entry.get("animations", {}).items():
                    if re.fullmatch(r"anim\d+", name):
                        continue  # Skip fragment names — we'll relabel them
                    base = NAME_MAP.get(name, name)
                    bucket = new_anims.setdefault(base, {})
                    for d, frames in dirs.items():
                        if d not in bucket or len(frames) > len(bucket[d]):
                            bucket[d] = frames

                # Process animN dirs using the server listing
                for idx, aid in enumerate(anim_order):
                    if idx >= len(labels):
                        break
                    raw, direction = labels[idx]
                    base = NAME_MAP.get(raw, raw)
                    src_dir = OUT_ROOT / key / f"anim{idx}" / direction
                    if not src_dir.is_dir():
                        # Try alternative: the animN dir might hold frames directly without direction subdir
                        alt_dir = OUT_ROOT / key / f"anim{idx}"
                        if alt_dir.is_dir():
                            pngs = sorted(alt_dir.glob("*.png"))
                            if pngs:
                                dst_dir = OUT_ROOT / key / base / direction
                                dst_dir.mkdir(parents=True, exist_ok=True)
                                rels = []
                                for png in pngs:
                                    dst = dst_dir / png.name
                                    if not dst.exists():
                                        shutil.copy2(png, dst)
                                    rels.append(f"./assets/generated/hmh-animated-roster/{key}/{base}/{direction}/{png.name}")
                                if rels:
                                    bucket = new_anims.setdefault(base, {})
                                    if direction not in bucket or len(rels) > len(bucket.get(direction, [])):
                                        bucket[direction] = rels
                                    stats["files_moved"] += len(rels)
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
                        if direction not in bucket or len(rels) > len(bucket.get(direction, [])):
                            bucket[direction] = rels
                        stats["files_moved"] += len(rels)

                # Also process split semantic dirs (walk-2/west, idle-3/north-west, etc.)
                for split_dir in split_dirs:
                    # Parse name like "walk-2" → base="walk", suffix="2"
                    m = re.match(r'^([a-z]+)-(\d+)$', split_dir.name)
                    if not m:
                        continue
                    base_name = NAME_MAP.get(m.group(1), m.group(1))
                    # Find direction subdirs
                    for dir_subdir in split_dir.iterdir():
                        if not dir_subdir.is_dir():
                            continue
                        direction = dir_subdir.name
                        if direction not in ('south', 'south-east', 'east', 'north-east',
                                             'north', 'north-west', 'west', 'south-west'):
                            continue
                        pngs = sorted(dir_subdir.glob("*.png"))
                        if not pngs:
                            continue
                        dst_dir = OUT_ROOT / key / base_name / direction
                        dst_dir.mkdir(parents=True, exist_ok=True)
                        rels = []
                        for png in pngs:
                            dst = dst_dir / png.name
                            if not dst.exists():
                                shutil.copy2(png, dst)
                            rels.append(f"./assets/generated/hmh-animated-roster/{key}/{base_name}/{direction}/{png.name}")
                        if rels:
                            bucket = new_anims.setdefault(base_name, {})
                            if direction not in bucket or len(rels) > len(bucket.get(direction, [])):
                                bucket[direction] = rels
                            stats["files_moved"] += len(rels)

                entry["animations"] = new_anims
                ledger[key] = entry
                stats["relabeled"] += 1

                cov = {n: len(d) for n, d in new_anims.items()}
                print(f"  -> coverage: {cov}")

    LEDGER.write_text(json.dumps(ledger, indent=2), encoding="utf-8")
    print(f"\n=== DONE ===")
    print(f"Characters relabeled: {stats['relabeled']}")
    print(f"Files copied: {stats['files_moved']}")
    print(f"Errors: {stats['errors']}")
    print("Ledger updated.")


asyncio.run(main())

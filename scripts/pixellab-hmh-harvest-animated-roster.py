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
CHAR_LEDGER = OUT_ROOT / "char-creation-ledger.json"
URL_RE = re.compile(r"https?://[^\s,)\]>'\"]+")
LABEL_RE = re.compile(
    r"^\s*([a-z][a-z0-9-]+)\s*\((?:south-east|north-east|north-west|south-west|south|north|east|west)\b",
    re.M,
)

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
    # Enemies with existing animation kits on PixelLab (harvest, don't regenerate).
    "paper-hand": ("6eae0151-464f-49c6-846c-09c964d87408", "enemy"),
    "honeypot-turret": ("527b7c1a-1b10-4d10-9474-98c06d7b473e", "enemy"),
    "slippage-skater": ("591e81cc-fe62-49a2-a6be-dc9fa53b9378", "enemy"),
    "phishing-angler": ("2d8a546e-7a9c-4d60-a73a-54916604695f", "enemy"),
    "mev-reaper": ("741efea8-2306-4d06-9dfe-0d60d8b46dca", "enemy"),
    "sybil-drone": ("9ff63a91-4e1c-4704-9db4-e8b03ce8ce9e", "enemy"),
    "liquidation-cascade-golem": ("5c858dfd-fc10-4c1f-8da9-ee3bf596cd1d", "enemy"),
    # New characters created in recent sessions — harvest their animations.
    "claim-jumper": ("16517af3-5056-425d-8dcb-557b1520db20", "enemy"),
    "scam-cult-zealot": ("6c0fc5f3-4b96-45f0-b21e-a26a252b7fd9", "enemy"),
    "rug-rat": ("791b7a1e-6e95-4feb-b094-cbf01baa6fea", "enemy"),
    "plaza-warden": ("c69c76d7-bd1c-4336-9253-6c33bd69e0c5", "miniboss"),
    "bridge-exploiter": ("334e34c1-366c-4628-9500-256987ccfa84", "miniboss"),
    "the-obfuscator": ("39e9c54b-e30e-4007-a490-863aef3adef9", "miniboss"),
    "bitcoin-maximalist-riot-cop": ("7cdfd405-491c-49d7-8dd5-b27ef518b8e5", "enemy"),
    "dao-lobbyist": ("83f6fc50-a2b0-4925-8198-28e544105a69", "enemy"),
    "influencer-camera-drone": ("fb7ee889-51e7-4eb2-a897-2aeaef6e20dc", "enemy"),
    "nft-valet": ("eddc9f33-7ebb-42c2-8436-9f3e043612f3", "enemy"),
    "stablecoin-socialite": ("75206fcf-6c8c-4230-8283-fab97d19a8c9", "enemy"),
    "coyote-pack-runner": ("92611a02-7a89-4c99-a6c5-43a58019a2a4", "enemy"),
    "wild-boar": ("400567e7-710b-4940-bf41-460128772fc4", "enemy"),
    "buzzard": ("bf8c1cb2-a133-47e3-b060-969ab6f6cb68", "enemy"),
    "rattlesnake": ("76702029-90eb-4ce9-b113-f6d9eb8721b0", "enemy"),
    "scorpion-ambusher": ("ca55115c-5744-4af0-97d8-64f44d004a8c", "enemy"),
}

DIRECTIONS = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"]

NAME_MAP = {
    # Renderer-facing canonical names. Some PixelLab jobs were created with
    # weapon/action-specific names, but runtime state requests `shoot`, `melee`,
    # `throw`, and `shoot-shotgun`.
    "fire-pistol": "shoot",
    "melee-knife": "melee",
    "throw-axe": "throw",
    "fire-shotgun": "shoot-shotgun",
}


def roster_entries() -> dict[str, tuple[str, str]]:
    """Return the harvest roster, overriding IDs with recreated characters when present.

    Some older PixelLab characters can fail with missing rotation images. The
    recreate script writes fresh character_ids into char-creation-ledger.json;
    harvesting should follow those IDs without needing hand-edits to this file.
    """
    entries = dict(ROSTER)
    if CHAR_LEDGER.exists():
        char_ledger = json.loads(CHAR_LEDGER.read_text(encoding="utf-8"))
        for key, data in char_ledger.items():
            cid = data.get("character_id")
            if key in entries and cid:
                _, role = entries[key]
                entries[key] = (cid, role)
    return entries


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
    """Parse get_character text into consolidated animations grouped by base name + direction.

    The text lists animation blocks; each animation has an animation UUID embedded
    in its frame URLs (.../animations/<anim_id>/<direction>/<n>.png) and a label
    line like 'idle-8dir (south, 5f)'. We group URLs by base animation name and direction.
    """
    urls = [u for u in URL_RE.findall(text) if ".png" in u.lower()]
    anims: dict[str, dict[str, list[str]]] = {}
    rotations: dict[str, str] = {}
    anim_order: list[str] = []
    # Map anim_id -> (base_name, direction) from labels
    aid_to_meta: dict[str, tuple[str, str]] = {}
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
    # sort frames per anim_id
    for aid, dirs in anims.items():
        for direction in dirs:
            dirs[direction] = [u for _, u in sorted(dirs[direction])]
    # Parse labels to get base animation names
    # Labels look like: '  idle-8dir (south, 5f)' or 'walk-8dir (east, 5f)'
    labels = LABEL_RE.findall(text)
    # Build mapping: anim_id -> base_name (strip -8dir suffix, keep base like 'idle', 'walk', 'run', 'shoot', 'melee', 'hurt', 'death', 'throw')
    for idx, aid in enumerate(anim_order):
        raw = labels[idx] if idx < len(labels) else f"anim{idx}"
        base = raw.replace("-8dir", "")  # e.g., 'idle-8dir' -> 'idle'
        base = NAME_MAP.get(base, base)
        # Find the direction for this anim_id
        dirs = list(anims[aid].keys())
        direction = dirs[0] if dirs else "south"
        aid_to_meta[aid] = (base, direction)

    return {"anim_order": anim_order, "anims": anims, "rotations": rotations, "labels": labels, "aid_to_meta": aid_to_meta}


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


async def harvest(only: set[str] | None = None) -> None:
    server = load_server()
    ledger: dict[str, Any] = json.loads(LEDGER.read_text(encoding="utf-8")) if LEDGER.exists() else {}
    total = 0
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (r, w, _):
        async with ClientSession(r, w) as sess:
            await sess.initialize()
            for key, (cid, role) in roster_entries().items():
                if only and key not in only:
                    continue
                try:
                    res = await sess.call_tool("get_character", {"character_id": cid})
                    parsed = parse_character(result_text(res))
                except Exception as exc:
                    print(f"{key}: ERR {exc}", flush=True)
                    continue
                anim_ids = parsed["anim_order"]
                aid_to_meta = parsed["aid_to_meta"]
                entry = {"role": role, "character_id": cid, "animations": {}}
                # Consolidate by base animation name + direction
                consolidated: dict[str, dict[str, list[str]]] = {}
                for aid in anim_ids:
                    base_name, direction = aid_to_meta.get(aid, (f"anim{anim_ids.index(aid)}", "south"))
                    frame_urls = parsed["anims"][aid].get(direction, [])
                    if not frame_urls:
                        continue
                    # Download frames
                    rels = []
                    for fi, u in enumerate(frame_urls):
                        dest = OUT_ROOT / key / base_name / direction / f"{fi:02d}.png"
                        if download(u, dest):
                            rels.append(f"./assets/generated/hmh-animated-roster/{key}/{base_name}/{direction}/{fi:02d}.png")
                            total += 1
                    if rels:
                        consolidated.setdefault(base_name, {})[direction] = rels
                # Sort directions in canonical order
                for base_name, dirs in consolidated.items():
                    sorted_dirs = {d: dirs[d] for d in DIRECTIONS if d in dirs}
                    if sorted_dirs:
                        entry["animations"][base_name] = sorted_dirs
                        print(f"  {key}/{base_name}: {sum(len(v) for v in sorted_dirs.values())} frames across {len(sorted_dirs)} dirs", flush=True)
                if not entry["animations"]:
                    print(f"{key}: 0 animations harvested; preserving existing ledger entry", flush=True)
                    continue
                ledger[key] = entry
                OUT_ROOT.mkdir(parents=True, exist_ok=True)
                LEDGER.write_text(json.dumps(ledger, indent=2), encoding="utf-8")
                print(f"{key}: {len(entry['animations'])} animations harvested", flush=True)
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    LEDGER.write_text(json.dumps(ledger, indent=2), encoding="utf-8")
    print(json.dumps({"characters": len(ledger), "frames_downloaded": total}, indent=2))


def canonicalize_animation_names(ledger: dict[str, Any]) -> dict[str, Any]:
    """Normalize legacy/custom PixelLab animation labels to runtime names."""
    for entry in ledger.values():
        animations = entry.get("animations") or {}
        for old_name, new_name in NAME_MAP.items():
            if old_name not in animations:
                continue
            if new_name in animations:
                merged = dict(animations[new_name])
                for direction, frames in animations[old_name].items():
                    merged.setdefault(direction, frames)
                animations[new_name] = merged
            else:
                animations[new_name] = animations[old_name]
            del animations[old_name]
    return ledger


def build_manifest() -> None:
    ledger = canonicalize_animation_names(json.loads(LEDGER.read_text(encoding="utf-8")))
    LEDGER.write_text(json.dumps(ledger, indent=2), encoding="utf-8")
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
            for key, (cid, role) in roster_entries().items():
                res = await sess.call_tool("get_character", {"character_id": cid})
                parsed = parse_character(result_text(res))
                print(f"{key} ({role}): {len(parsed['anim_order'])} anims, labels={parsed['labels'][:12]}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("command", choices=["list", "harvest", "manifest"])
    ap.add_argument("--only", help="comma-separated roster keys to harvest (keeps long refreshes resumable/targeted)")
    args = ap.parse_args()
    if args.command == "harvest":
        only = {p.strip() for p in args.only.split(",") if p.strip()} if args.only else None
        asyncio.run(harvest(only=only))
        build_manifest()
    elif args.command == "manifest":
        build_manifest()
    else:
        asyncio.run(show_list())


if __name__ == "__main__":
    main()

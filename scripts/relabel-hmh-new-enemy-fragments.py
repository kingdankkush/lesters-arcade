#!/usr/bin/env python
"""Relabel recently harvested Hard Money Heroes enemy animN fragments.

This is a narrow/safe companion to relabel-all-anim-fragments.py. It only
processes newly harvested enemies that are missing from roster-ledger.json, so
it does not rewrite/recorrupt the locked hero manifests.

Usage:
  python scripts/relabel-hmh-new-enemy-fragments.py
  python scripts/consolidate-hmh-roster-directions.py build
"""
from __future__ import annotations

import asyncio
import json
import re
import shutil
from pathlib import Path
from typing import Any

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

ROOT = Path(__file__).resolve().parents[1]
OUT_ROOT = ROOT / "apps/portal/assets/generated/hmh-animated-roster"
LEDGER = OUT_ROOT / "roster-ledger.json"

CHARS: dict[str, str] = {
    "claim-jumper": "16517af3-5056-425d-8dcb-557b1520db20",
    "scam-cult-zealot": "6c0fc5f3-4b96-45f0-b21e-a26a252b7fd9",
    "sybil-drone": "9ff63a91-4e1c-4704-9db4-e8b03ce8ce9e",
    "mev-reaper": "741efea8-2306-4d06-9dfe-0d60d8b46dca",
    "phishing-angler": "2d8a546e-7a9c-4d60-a73a-54916604695f",
    "plaza-warden": "c69c76d7-bd1c-4336-9253-6c33bd69e0c5",
    "bridge-exploiter": "334e34c1-366c-4628-9500-256987ccfa84",
    "the-obfuscator": "39e9c54b-e30e-4007-a490-863aef3adef9",
    "bitcoin-maximalist-riot-cop": "7cdfd405-491c-49d7-8dd5-b27ef518b8e5",
    "rug-rat": "791b7a1e-6e95-4feb-b094-cbf01baa6fea",
}

NAME_MAP = {
    "idle-8dir": "idle",
    "walk-8dir": "walk",
    "run-8dir": "run",
    "death-8dir": "death",
    "hurt-8dir": "hurt",
    "hit-8dir": "hit",
    "attack-8dir": "attack",
    "attack-ranged-8dir": "attack-ranged",
    "attack-tell-8dir": "attack-tell",
    "melee-8dir": "melee",
    "shoot-8dir": "shoot",
    "throw-8dir": "throw",
}
DIRECTIONS = ("south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west")
URL_RE = re.compile(r"/animations/([0-9a-f-]{36})/([a-z-]+)/(\d+)\.png")
LABEL_RE = re.compile(
    r"^\s*([a-z][a-z0-9-]*)\s*\((south-east|north-east|north-west|south-west|south|north|east|west)\b",
    re.M,
)


def canonical_name(name: str) -> str:
    return NAME_MAP.get(name, name.replace("-8dir", ""))


def frame_rel(path: Path) -> str:
    return f"./assets/generated/hmh-animated-roster/{path.relative_to(OUT_ROOT).as_posix()}"


def merge_frames(bucket: dict[str, list[str]], direction: str, frames: list[str]) -> None:
    if not frames:
        return
    if direction not in bucket or len(frames) > len(bucket.get(direction, [])):
        bucket[direction] = frames


def collect_semantic_dirs(key: str, new_anims: dict[str, dict[str, list[str]]]) -> int:
    """Include any already-created <anim>/<direction>/NN.png folders on disk."""
    char_dir = OUT_ROOT / key
    moved = 0
    for anim_dir in sorted(char_dir.iterdir() if char_dir.is_dir() else []):
        if not anim_dir.is_dir() or re.fullmatch(r"anim\d+", anim_dir.name):
            continue
        base = canonical_name(anim_dir.name)
        for direction in DIRECTIONS:
            src_dir = anim_dir / direction
            if not src_dir.is_dir():
                continue
            frames = [frame_rel(png) for png in sorted(src_dir.glob("*.png"))]
            merge_frames(new_anims.setdefault(base, {}), direction, frames)
            moved += len(frames)
    return moved


def load_server() -> dict[str, Any]:
    data = json.loads((Path.home() / ".claude.json").read_text(encoding="utf-8"))
    for project in data.get("projects", {}).values():
        server = project.get("mcpServers", {}).get("pixellab")
        if server:
            return server
    raise SystemExit("no pixellab server in ~/.claude.json")


async def main() -> None:
    ledger = json.loads(LEDGER.read_text(encoding="utf-8"))
    server = load_server()
    stats = {"characters": 0, "semantic_frames": 0, "fragment_frames": 0}

    async with streamablehttp_client(server["url"], headers=server.get("headers")) as (reader, writer, _):
        async with ClientSession(reader, writer) as session:
            await session.initialize()
            for key, cid in CHARS.items():
                char_dir = OUT_ROOT / key
                if not char_dir.is_dir():
                    print(f"SKIP {key}: no harvested directory")
                    continue

                entry = ledger.get(key) or {"role": "enemy", "character_id": cid, "animations": {}}
                entry["role"] = entry.get("role") or "enemy"
                entry["character_id"] = entry.get("character_id") or cid
                new_anims: dict[str, dict[str, list[str]]] = {}

                # Preserve non-fragment ledger entries if this is rerun.
                for anim_name, dirs in entry.get("animations", {}).items():
                    if re.fullmatch(r"anim\d+", anim_name):
                        continue
                    base = canonical_name(anim_name)
                    bucket = new_anims.setdefault(base, {})
                    for direction, frames in dirs.items():
                        if direction in DIRECTIONS:
                            merge_frames(bucket, direction, list(frames))

                stats["semantic_frames"] += collect_semantic_dirs(key, new_anims)

                try:
                    res = await session.call_tool("get_character", {"character_id": cid})
                    text = "\n".join(c.text for c in res.content if hasattr(c, "text"))
                except Exception as exc:
                    print(f"WARN {key}: get_character failed ({exc}); kept semantic dirs only")
                    entry["animations"] = new_anims
                    ledger[key] = entry
                    continue

                anim_order: list[str] = []
                for match in URL_RE.finditer(text):
                    aid = match.group(1)
                    if aid not in anim_order:
                        anim_order.append(aid)
                labels = LABEL_RE.findall(text)
                print(f"{key}: {len(anim_order)} animation ids, {len(labels)} labels")

                for idx, (_aid) in enumerate(anim_order):
                    if idx >= len(labels):
                        break
                    raw, direction = labels[idx]
                    base = canonical_name(raw)
                    src_dir = char_dir / f"anim{idx}" / direction
                    if not src_dir.is_dir():
                        continue
                    dst_dir = char_dir / base / direction
                    dst_dir.mkdir(parents=True, exist_ok=True)
                    frames: list[str] = []
                    for png in sorted(src_dir.glob("*.png")):
                        dst = dst_dir / png.name
                        if not dst.exists():
                            shutil.copy2(png, dst)
                        frames.append(frame_rel(dst))
                    merge_frames(new_anims.setdefault(base, {}), direction, frames)
                    stats["fragment_frames"] += len(frames)

                entry["animations"] = new_anims
                ledger[key] = entry
                stats["characters"] += 1
                coverage = {name: len(dirs) for name, dirs in sorted(new_anims.items())}
                print(f"  -> {key}: {coverage}")

    LEDGER.write_text(json.dumps(ledger, indent=2), encoding="utf-8")
    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    asyncio.run(main())

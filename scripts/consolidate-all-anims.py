#!/usr/bin/env python
"""Consolidate ALL animN fragments into semantic <name>/<direction> kits.

Handles three cases:
1. Characters where PixelLab returns animation labels (use those)
2. Characters where PixelLab returns 0 labels but animN dirs exist (positional assignment)
3. Characters not yet in the relabel script's CHARS dict (paper-hand, honeypot-turret, slippage-skater)

For positional assignment, uses the 8dir pipeline kit order:
  ENEMY kit (5 anims): idle(0-7), walk(8-15), attack(16-23), hurt(24-31), death(32-39)
  Extended ENEMY kit (6 anims): idle(0-7), walk(8-15), run(16-23), attack(24-31), hit(32-39), death(40-47)

Usage: python scripts/consolidate-all-anims.py
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

# All characters with their PixelLab character IDs and roles
ALL_CHARS = {
    "lester":              ("97185455-d6f8-4108-a0fc-ab90f451ddef", "hero"),
    "lilly":               ("61b040dd-d2cb-4f78-ab59-b1ad703bce84", "hero"),
    "lit-commando":        ("c96d19d1-8958-4fcd-b517-9dfded9e0051", "hero"),
    "lit-valkyrie":        ("74b5efc0-e7d8-4400-85f5-9db85ef05db9", "hero"),
    "whale-dumper-boss":   ("6b17f44f-4c87-48a4-8df3-d8f15a40d2c0", "boss"),
    "chain-reaper-boss":   ("9ce10bf6-a5c4-457a-b485-e4f43fc67e3b", "boss"),
    "bit-whale-boss":      ("cecc4b9e-5c0a-44e9-9d42-211230c9b61b", "boss"),
    "warren-spear-rider":  ("1b14807b-8bb7-495c-8ede-aa10c791ca51", "miniboss"),
    "rugpull-summoner":    ("32f95be2-99d8-4507-8799-df8d14692b08", "enemy"),
    "gas-fee-wisp":        ("afb5c6c3-9d0a-48a0-a059-edc00b97aa50", "enemy"),
    "fud-goblin":          ("d0470066-7d2b-4195-bcb6-9e7c6f4638d8", "enemy"),
    "gas-beast-tank":      ("2035aef1-f38c-4e3d-97d3-c09563ba672b", "enemy"),
    "crypto-bro-rusher":   ("170c9928-fcb5-4179-9ab5-768aa12b5f85", "enemy"),
    "evil-banker-ranged":  ("522d99ae-64c3-4e8e-b61c-1b8cbebbe6b7", "enemy"),
    "trench-degen":        ("9e591394-caf5-498c-886b-1161e1a64043", "enemy"),
    "paper-hand":          ("6eae0151-464f-49c6-846c-09c964d87408", "enemy"),
    "honeypot-turret":     ("527b7c1a-1b10-4d10-9474-98c06d7b473e", "enemy"),
    "slippage-skater":     ("591e81cc-fe62-49a2-a6be-dc9fa53b9378", "enemy"),
    "phishing-angler":     ("2d8a546e-7a9c-4d60-a73a-54916604695f", "enemy"),
    "mev-reaper":          ("741efea8-2306-4d06-9dfe-0d60d8b46dca", "enemy"),
    "sybil-drone":         ("9ff63a91-4e1c-4704-9db4-e8b03ce8ce9e", "enemy"),
    "liquidation-cascade-golem": ("5c858dfd-fc10-4c1f-8da9-ee3bf596cd1d", "enemy"),
}

DIRECTIONS = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"]

# Name mapping for PixelLab labels
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
    "hit-8dir": "hit",
    "attack-8dir": "attack",
    "attack-ranged-8dir": "attack-ranged",
    "melee-8dir": "melee",
    "shoot-8dir": "shoot",
    "throw-8dir": "throw",
    "attack-slam-8dir": "attack-slam",
}

# Positional fallback kits (when PixelLab returns no labels)
# 6-anim kit: 48 dirs (6 anims × 8 directions)
KIT_6 = ["idle", "walk", "run", "attack", "hit", "death"]
# 5-anim kit: 40 dirs (5 anims × 8 directions)
KIT_5 = ["idle", "walk", "attack", "hurt", "death"]
# 2-anim partial kit (only 16 dirs completed)
KIT_2 = ["idle", "walk"]

URL_RE = re.compile(r"/animations/([0-9a-f-]{36})/([a-z-]+)/(\d+)\.png")
LABEL_RE = re.compile(
    r"^\s*([a-z][a-z0-9-]*)\s*\((south-east|north-east|north-west|south-west|south|north|east|west)\b",
    re.M,
)
_SUFFIX_RE = re.compile(r"(?:-8dir)?(?:-\d+)?$")


def base_name(name: str) -> str:
    n = name.replace("-8dir", "")
    n = re.sub(r"-\d+$", "", n)
    return n or name


def load_server():
    d = json.loads((Path.home() / ".claude.json").read_text(encoding="utf-8"))
    for proj in d.get("projects", {}).values():
        srv = proj.get("mcpServers", {}).get("pixellab")
        if srv:
            return srv
    raise SystemExit("no pixellab server")


def collect_semantic_anims(char_dir: Path) -> dict[str, dict[str, list[str]]]:
    """Scan existing semantic directories (non-animN) and collect frame paths."""
    result: dict[str, dict[str, list[str]]] = {}
    for d in char_dir.iterdir():
        if not d.is_dir() or d.name.startswith("anim"):
            continue
        base = base_name(d.name)
        bucket = result.setdefault(base, {})
        for dir_subdir in d.iterdir():
            if not dir_subdir.is_dir():
                continue
            direction = dir_subdir.name
            if direction not in DIRECTIONS:
                continue
            pngs = sorted(dir_subdir.glob("*.png"))
            if not pngs:
                continue
            rels = [f"./assets/generated/hmh-animated-roster/{char_dir.name}/{base}/{direction}/{p.name}" for p in pngs]
            if direction not in bucket or len(rels) > len(bucket[direction]):
                bucket[direction] = rels
    return result


def collect_animN_by_direction(char_dir: Path) -> list[tuple[str, str, list[str]]]:
    """Collect animN dirs, returning [(animN_name, direction, [frame_paths]), ...]"""
    result = []
    for d in sorted(char_dir.iterdir(), key=lambda x: (len(x.name), x.name)):
        if not d.is_dir() or not d.name.startswith("anim"):
            continue
        # Each animN dir has direction subdirs
        for dir_subdir in d.iterdir():
            if not dir_subdir.is_dir():
                continue
            direction = dir_subdir.name
            if direction not in DIRECTIONS:
                continue
            pngs = sorted(dir_subdir.glob("*.png"))
            if not pngs:
                continue
            rels = [f"./assets/generated/hmh-animated-roster/{char_dir.name}/{d.name}/{direction}/{p.name}" for p in pngs]
            result.append((d.name, direction, rels))
    return result


def assign_positional(animN_entries: list[tuple[str, str, list[str]]], kit: list[str]) -> dict[str, dict[str, list[str]]]:
    """Assign animN dirs to animation names positionally (every 8 dirs = 1 anim)."""
    result: dict[str, dict[str, list[str]]] = {}
    # Group by animN name
    anim_groups: dict[str, list[tuple[str, list[str]]]] = {}
    for anim_name, direction, frames in animN_entries:
        anim_groups.setdefault(anim_name, []).append((direction, frames))

    # Sort animN names numerically
    sorted_anims = sorted(anim_groups.keys(), key=lambda x: int(re.search(r'\d+', x).group()))
    num_anims = len(sorted_anims)
    dirs_per_anim = 8

    # Determine which kit to use
    if num_anims >= 48:
        kit = KIT_6
    elif num_anims >= 40:
        kit = KIT_5
    elif num_anims >= 16:
        kit = KIT_2
    else:
        # Fallback: assign all to "idle"
        kit = ["idle"]

    for i, anim_name in enumerate(sorted_anims):
        kit_idx = i // dirs_per_anim
        if kit_idx >= len(kit):
            kit_idx = len(kit) - 1  # overflow into last anim
        anim_label = kit[kit_idx]
        bucket = result.setdefault(anim_label, {})
        for direction, frames in anim_groups[anim_name]:
            if direction not in bucket or len(frames) > len(bucket.get(direction, [])):
                bucket[direction] = frames

    return result


async def main() -> None:
    srv = load_server()
    ledger = json.loads(LEDGER.read_text(encoding="utf-8"))

    stats = {"processed": 0, "files_copied": 0, "skipped": 0, "errors": 0}

    async with streamablehttp_client(srv["url"], headers=srv.get("headers")) as (r, w, _):
        async with ClientSession(r, w) as s:
            await s.initialize()

            for key, (cid, role) in ALL_CHARS.items():
                char_dir = OUT_ROOT / key
                if not char_dir.is_dir():
                    print(f"SKIP {key}: no directory on disk")
                    stats["skipped"] += 1
                    continue

                # Collect existing semantic anims
                semantic_anims = collect_semantic_anims(char_dir)

                # Collect animN entries
                animN_entries = collect_animN_by_direction(char_dir)

                if not semantic_anims and not animN_entries:
                    print(f"SKIP {key}: no animations on disk")
                    stats["skipped"] += 1
                    continue

                # Try to get labels from PixelLab
                labels = []
                anim_order = []
                try:
                    res = await s.call_tool("get_character", {"character_id": cid})
                    text = "\n".join(c.text for c in res.content if hasattr(c, "text"))
                    for m in URL_RE.finditer(text):
                        if m.group(1) not in anim_order:
                            anim_order.append(m.group(1))
                    labels = LABEL_RE.findall(text)
                except Exception as e:
                    print(f"WARN {key}: get_character failed: {e}")

                # Build new animations dict
                new_anims: dict[str, dict[str, list[str]]] = {}

                # 1. Keep semantic anims
                for name, dirs in semantic_anims.items():
                    base = NAME_MAP.get(name, name)
                    bucket = new_anims.setdefault(base, {})
                    for d, frames in dirs.items():
                        if d not in bucket or len(frames) > len(bucket.get(d, [])):
                            bucket[d] = list(frames)

                # 2. Process animN dirs
                if animN_entries:
                    if labels and len(labels) >= len(anim_order) and len(anim_order) > 0:
                        # Use PixelLab labels
                        print(f"\n{key}: {len(anim_order)} anim ids from PixelLab, {len(animN_entries)} animN dirs")
                        for idx, aid in enumerate(anim_order):
                            if idx >= len(labels):
                                break
                            raw, direction = labels[idx]
                            base = NAME_MAP.get(raw, raw)
                            # Find matching animN dir
                            animN_name = f"anim{idx}"
                            src_dir = char_dir / animN_name / direction
                            if src_dir.is_dir():
                                pngs = sorted(src_dir.glob("*.png"))
                                rels = [f"./assets/generated/hmh-animated-roster/{key}/{base}/{direction}/{p.name}" for p in pngs]
                                # Copy to semantic dir
                                dst_dir = char_dir / base / direction
                                dst_dir.mkdir(parents=True, exist_ok=True)
                                for png in pngs:
                                    dst = dst_dir / png.name
                                    if not dst.exists():
                                        shutil.copy2(png, dst)
                                        stats["files_copied"] += 1
                                if rels:
                                    bucket = new_anims.setdefault(base, {})
                                    if direction not in bucket or len(rels) > len(bucket.get(direction, [])):
                                        bucket[direction] = [f"./assets/generated/hmh-animated-roster/{key}/{base}/{direction}/{p.name}" for p in pngs]
                    else:
                        # Positional assignment
                        positional = assign_positional(animN_entries, KIT_6)
                        print(f"\n{key}: {len(animN_entries)} animN dirs (positional assignment, {len(positional)} anims)")
                        for anim_name, dirs in positional.items():
                            bucket = new_anims.setdefault(anim_name, {})
                            for direction, frames in dirs.items():
                                if direction not in bucket or len(frames) > len(bucket.get(direction, [])):
                                    bucket[direction] = list(frames)
                                    # Copy to semantic dir
                                    for frame_path in frames:
                                        src = ROOT / frame_path.replace("./", "")
                                        dst_dir = char_dir / anim_name / direction
                                        dst_dir.mkdir(parents=True, exist_ok=True)
                                        dst = dst_dir / Path(frame_path).name
                                        if not dst.exists() and src.exists():
                                            shutil.copy2(src, dst)
                                            stats["files_copied"] += 1

                # Update ledger
                entry = ledger.get(key) or {"role": role, "character_id": cid, "animations": {}}
                entry["role"] = role
                entry["character_id"] = cid

                # Merge with existing ledger animations (preserve existing, add new)
                existing_anims = entry.get("animations", {})
                for name, dirs in new_anims.items():
                    if name not in existing_anims:
                        existing_anims[name] = dirs
                    else:
                        for d, frames in dirs.items():
                            if d not in existing_anims[name] or len(frames) > len(existing_anims[name].get(d, [])):
                                existing_anims[name][d] = frames

                entry["animations"] = existing_anims
                ledger[key] = entry
                stats["processed"] += 1

                cov = {n: len(d) for n, d in entry.get("animations", {}).items()}
                print(f"  -> coverage: {cov}")

    LEDGER.write_text(json.dumps(ledger, indent=2), encoding="utf-8")
    print(f"\n=== DONE ===")
    print(f"Characters processed: {stats['processed']}")
    print(f"Files copied: {stats['files_copied']}")
    print(f"Skipped: {stats['skipped']}")
    print(f"Errors: {stats['errors']}")
    print("Ledger updated.")


asyncio.run(main())

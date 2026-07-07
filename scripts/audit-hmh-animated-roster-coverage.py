#!/usr/bin/env python3
"""Audit HMH animated roster disk coverage before runtime wiring.

This is intentionally read-only. It treats canonical animation folders as usable
only when they provide all 8 directions. Positional `animN` folders are reported
as fragment debt, because the renderer does not request those names.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ROSTER = ROOT / "apps/portal/assets/generated/hmh-animated-roster"
DIRECTIONS = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"]
CANONICAL = ["idle", "walk", "run", "attack-tell", "attack", "hit", "hurt", "death", "spawn"]


def frame_count(path: Path) -> int:
    return len([p for p in path.glob("*.png") if p.is_file()])


def audit_actor(actor_dir: Path) -> dict:
    animations = {}
    fragment_dirs = []
    for anim_dir in sorted([p for p in actor_dir.iterdir() if p.is_dir()]):
        if anim_dir.name.startswith("anim"):
            fragment_dirs.append(anim_dir.name)
        if anim_dir.name not in CANONICAL:
            continue
        dirs = {}
        for direction in DIRECTIONS:
            d = anim_dir / direction
            if d.is_dir():
                count = frame_count(d)
                if count:
                    dirs[direction] = count
        animations[anim_dir.name] = dirs
    canonical_full = {
        name: dirs
        for name, dirs in animations.items()
        if all(direction in dirs and dirs[direction] > 0 for direction in DIRECTIONS)
    }
    return {
        "actor": actor_dir.name,
        "canonicalAnimations": sorted(animations.keys()),
        "full8DirAnimations": sorted(canonical_full.keys()),
        "fragmentDirs": fragment_dirs[:20],
        "fragmentDirCount": len(fragment_dirs),
        "readyForRuntime": len(canonical_full) >= 5 and not fragment_dirs,
        "coverage": {name: sorted(dirs.keys()) for name, dirs in animations.items()},
    }


def main() -> None:
    actors = []
    for actor_dir in sorted([p for p in ROSTER.iterdir() if p.is_dir()]):
        actors.append(audit_actor(actor_dir))
    summary = {
        "actors": actors,
        "readyActors": [a["actor"] for a in actors if a["readyForRuntime"]],
        "fragmentDebtActors": [a["actor"] for a in actors if a["fragmentDirCount"]],
    }
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()

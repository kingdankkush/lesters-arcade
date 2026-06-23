#!/usr/bin/env python
"""Recreate HMH animal characters whose PixelLab rotations are missing.

The animation queue confirmed these old character_ids cannot animate:
  - coyote-pack-runner: 404 Character rotation image not found for south
  - wild-boar: 404 Character rotation image not found for south

This creates fresh 8-direction base characters and updates
apps/portal/assets/generated/hmh-animated-roster/char-creation-ledger.json so the
slot-aware animation queue and harvester use the new IDs on the next pass.

Usage:
  python scripts/pixellab-hmh-recreate-failed-animals.py create
  python scripts/pixellab-hmh-recreate-failed-animals.py status
  python scripts/pixellab-hmh-recreate-failed-animals.py animate
"""
from __future__ import annotations

import asyncio
import json
import re
import sys
import time
from pathlib import Path
from typing import Any

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

ROOT = Path(__file__).resolve().parents[1]
LEDGER = ROOT / "apps/portal/assets/generated/hmh-animated-roster/char-creation-ledger.json"
UUID_RE = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")

STYLE_BASE = (
    "isometric pixel art, high top-down 3/4 view, bold single-color dark outline, "
    "Litecoin silver and cyan neon palette, transparent background, clean readable silhouette"
)

SPECS: dict[str, dict[str, Any]] = {
    "coyote-pack-runner": {
        "description": f"lean wiry coyote pack runner enemy, dusty brown-grey fur, yellow eyes, low predatory stance, ribs visible, tattered ear, quadruped, 96px game sprite, {STYLE_BASE}",
        "body_type": "quadruped",
        "template": "dog",
        "size": 96,
    },
    "wild-boar": {
        "description": f"massive wild boar charger enemy, dark bristled fur, curved ivory tusks, furious red eyes, heavy shoulder muscles, quadruped, 112px game sprite, {STYLE_BASE}",
        "body_type": "quadruped",
        "template": "bear",
        "size": 112,
    },
}

DIRECTIONS = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"]
ANIMATIONS = [
    ("idle", "idle breathing animation, alert animal stance", 6),
    ("walk", "walking forward, four-legged gait, steady pursuit", 8),
    ("run", "running fast forward, aggressive charge", 8),
    ("attack", "lunging forward with bite or tusk strike", 6),
    ("attack-tell", "brief crouch and wind-up before lunging", 4),
    ("hit", "flinching backward from a hit", 6),
    ("death", "collapsing and falling defeated", 8),
]


def load_server() -> dict[str, Any]:
    data = json.loads((Path.home() / ".claude.json").read_text(encoding="utf-8"))
    for project in data.get("projects", {}).values():
        server = project.get("mcpServers", {}).get("pixellab")
        if server:
            return server
    raise SystemExit("no pixellab MCP server found in ~/.claude.json")


def load_ledger() -> dict[str, Any]:
    return json.loads(LEDGER.read_text(encoding="utf-8")) if LEDGER.exists() else {}


def save_ledger(ledger: dict[str, Any]) -> None:
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    LEDGER.write_text(json.dumps(ledger, indent=2), encoding="utf-8")


def text_of(result: Any) -> str:
    return "\n".join(c.text for c in getattr(result, "content", []) or [] if hasattr(c, "text"))


def status_line(text: str) -> str:
    for line in text.splitlines():
        if line.lower().startswith("status:"):
            return line.strip()
    return "status: unknown"


def animation_direction_coverage(text: str) -> dict[str, set[str]]:
    """Parse get_character output into animation_name -> completed directions.

    PixelLab can accept a queue request but still return partial coverage if one
    direction fails. Treat server-visible frames as the source of truth instead
    of only trusting the local queued ledger.
    """
    coverage: dict[str, set[str]] = {}
    pattern = re.compile(
        r"^\s*([a-z][a-z0-9-]+)\s*\(([^)]*),\s*(\d+)f\)",
        re.M,
    )
    direction_pattern = re.compile(r"south-east|north-east|north-west|south-west|south|north|east|west")
    for match in pattern.finditer(text):
        name = match.group(1).replace("-8dir", "")
        dirs = set(direction_pattern.findall(match.group(2)))
        if dirs:
            coverage.setdefault(name, set()).update(dirs)
    return coverage


async def create() -> None:
    server = load_server()
    ledger = load_ledger()
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (reader, writer, _):
        async with ClientSession(reader, writer) as session:
            await session.initialize()
            for key, spec in SPECS.items():
                entry = ledger.setdefault(key, {})
                existing = entry.get("character_id")
                if entry.get("recreated_from") and existing:
                    print(f"{key}: already recreated -> {existing}", flush=True)
                    continue

                old_id = existing
                for attempt in range(1, 8):
                    try:
                        args = {
                            "description": spec["description"],
                            "body_type": spec.get("body_type", "quadruped"),
                            "mode": "pro",
                            "n_directions": 8,
                            "size": spec.get("size", 96),
                            "view": "high top-down",
                            "outline": "single color outline",
                        }
                        if spec.get("template"):
                            args["template"] = spec["template"]
                        result = await session.call_tool("create_character", args)
                        text = text_of(result)
                        match = UUID_RE.search(text)
                        if not match:
                            entry["recreate_status"] = "create-error-no-id"
                            entry["recreate_raw"] = text[:500]
                            save_ledger(ledger)
                            print(f"{key}: create returned no id", flush=True)
                            break
                        new_id = match.group(0)
                        entry["recreated_from"] = old_id
                        entry["character_id"] = new_id
                        entry["animations"] = {}
                        entry["recreate_status"] = "created"
                        entry["recreate_raw"] = text[:500]
                        save_ledger(ledger)
                        print(f"{key}: recreated {old_id} -> {new_id}", flush=True)
                        break
                    except Exception as exc:  # MCP slot/rate errors usually surface here.
                        msg = str(exc)
                        entry["recreate_status"] = f"retry-{attempt}: {msg[:160]}"
                        save_ledger(ledger)
                        print(f"{key}: attempt {attempt} failed: {msg[:220]}", flush=True)
                        if "slot" in msg.lower() or "rate" in msg.lower() or "429" in msg:
                            time.sleep(45)
                            continue
                        break
                time.sleep(4)

async def wait_until_ready(sess: ClientSession, key: str, cid: str, max_wait: int = 900) -> bool:
    deadline = time.time() + max_wait
    while time.time() < deadline:
        text = text_of(await sess.call_tool("get_character", {"character_id": cid}))
        line = status_line(text)
        lower = line.lower()
        if "failed" in lower:
            print(f"{key}: {line}", flush=True)
            return False
        if "creating" not in lower and "processing" not in lower:
            print(f"{key}: ready ({line})", flush=True)
            return True
        print(f"{key}: {line}; waiting 45s", flush=True)
        await asyncio.sleep(45)
    print(f"{key}: timed out waiting for rotations", flush=True)
    return False


async def animate() -> None:
    server = load_server()
    ledger = load_ledger()
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (reader, writer, _):
        async with ClientSession(reader, writer) as session:
            await session.initialize()
            for key in SPECS:
                entry = ledger.setdefault(key, {})
                cid = entry.get("character_id")
                if not cid:
                    print(f"{key}: no character_id", flush=True)
                    continue
                if not await wait_until_ready(session, key, cid):
                    continue
                existing_text = text_of(await session.call_tool("get_character", {"character_id": cid}))
                coverage = animation_direction_coverage(existing_text)
                entry.setdefault("animations", {})
                for anim_name, action_description, frame_count in ANIMATIONS:
                    missing_dirs = [direction for direction in DIRECTIONS if direction not in coverage.get(anim_name, set())]
                    if not missing_dirs:
                        entry["animations"][anim_name] = {"queued": True, "complete": True}
                        save_ledger(ledger)
                        print(f"{key}/{anim_name}: complete", flush=True)
                        continue
                    if entry["animations"].get(anim_name, {}).get("queued"):
                        print(f"{key}/{anim_name}: queued but incomplete; retrying {', '.join(missing_dirs)}", flush=True)
                    for attempt in range(1, 11):
                        result = await session.call_tool("animate_character", {
                            "character_id": cid,
                            "mode": "v3",
                            "action_description": action_description,
                            "animation_name": anim_name,
                            "directions": missing_dirs,
                            "frame_count": frame_count,
                            "confirm_cost": True,
                        })
                        text = text_of(result)
                        lower = text.lower()
                        if "error" in lower and "slot" in lower:
                            print(f"{key}/{anim_name}: slots full, waiting 45s (retry {attempt}/10)", flush=True)
                            await asyncio.sleep(45)
                            continue
                        if "error" in lower:
                            entry["animations"][anim_name] = {"queued": False, "last_error": text[:240]}
                            save_ledger(ledger)
                            print(f"{key}/{anim_name}: ERROR {text[:220]}", flush=True)
                            break
                        entry["animations"][anim_name] = {"queued": True, "directions": missing_dirs, "raw": text[:240]}
                        save_ledger(ledger)
                        print(f"{key}/{anim_name}: queued {', '.join(missing_dirs)}", flush=True)
                        await asyncio.sleep(4)
                        break


async def status() -> None:
    server = load_server()
    ledger = load_ledger()
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (reader, writer, _):
        async with ClientSession(reader, writer) as session:
            await session.initialize()
            for key in SPECS:
                cid = ledger.get(key, {}).get("character_id")
                if not cid:
                    print(f"{key}: no character_id", flush=True)
                    continue
                try:
                    result = await session.call_tool("get_character", {"character_id": cid})
                    print(f"{key} ({cid}): {status_line(text_of(result))}", flush=True)
                except Exception as exc:
                    print(f"{key} ({cid}): status error {exc}", flush=True)


if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else "create"
    if command == "status":
        asyncio.run(status())
    elif command == "animate":
        asyncio.run(animate())
    else:
        asyncio.run(create())

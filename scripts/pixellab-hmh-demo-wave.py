#!/usr/bin/env python
"""Scaled, resumable PixelLab generator for Hard Money Heroes demo polish.

Uses the fast `create_map_object` tool (transparent-bg pixel objects, ~15-30s
each, ~1 subscription generation) to fill out the biome prop library and FX
sprites the game is short on. Designed to run in waves and be fully resumable:
all job state is persisted to a ledger JSON so a re-run only does outstanding
work (queue -> poll -> download).

Auth is read from the local PixelLab MCP config (~/.claude.json) and never
written to manifests, logs, or docs.

Usage:
  python scripts/pixellab-hmh-demo-wave.py queue   [--limit N]
  python scripts/pixellab-hmh-demo-wave.py collect [--limit N]
  python scripts/pixellab-hmh-demo-wave.py status
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
PUBLIC_ROOT = Path("apps/portal/assets/generated/hmh-demo-wave")
OUT_ROOT = ROOT / PUBLIC_ROOT
LEDGER = OUT_ROOT / "demo-wave-ledger.json"
UUID_RE = re.compile(r"[0-9a-fA-F-]{36}")
URL_RE = re.compile(r"https?://[^\s,)\]>'\"]+")

NO_TEXT = "no words, no letters, no numbers, no labels, no logos, no watermark"
STYLE = (
    "isometric pixel art, retro 80s/90s arcade game asset, crisp clean silhouette, "
    "limited SNES/Neo-Geo palette, transparent background, single centered object, "
    f"dark neon Litecoin-City-after-dark mood; {NO_TEXT}"
)


def spec(slug: str, biome: str, desc: str, size: int = 128) -> dict[str, Any]:
    return {
        "job_key": slug,
        "biome": biome,
        "tool": "create_map_object",
        "args": {
            "description": f"{desc}; {STYLE}",
            "width": size,
            "height": size,
            "view": "high top-down",
            "outline": "single color outline",
            "shading": "detailed shading",
        },
    }


def all_specs() -> list[dict[str, Any]]:
    s: list[dict[str, Any]] = []
    # --- DESERT (library is thin here) ---
    desert = [
        "tall saguaro cactus", "cluster of small barrel cacti", "dry desert shrub tumbleweed",
        "bleached cow skull on sand", "weathered wooden cattle skull post", "sandstone boulder pile",
        "small sand dune mound", "dead twisted desert tree", "rusty abandoned mine cart",
        "wooden desert signpost blank", "pile of dry bones", "cracked desert clay rock",
        "desert prickly pear cactus", "sun-bleached wagon wheel", "small adobe rock formation",
        "scorpion-shaped rock", "desert oasis tiny palm", "rusted oil drum half-buried",
    ]
    for i, d in enumerate(desert):
        s.append(spec(f"desert-{i:02d}", "desert", d))
    # --- FOREST ---
    forest = [
        "tall pine evergreen tree", "round leafy oak tree", "cluster of green bushes",
        "mossy fallen log", "tree stump with rings", "patch of wildflowers red and yellow",
        "fern undergrowth clump", "tall grass tuft", "berry bush with red berries",
        "birch tree slim white trunk", "pile of autumn leaves", "small mushroom cluster",
        "dense thorn bramble", "hanging vine plant", "forest boulder with moss",
        "dead leafless tree", "pine sapling small", "wooden forest fence post",
    ]
    for i, d in enumerate(forest):
        s.append(spec(f"forest-{i:02d}", "forest", d))
    # --- ROCKY / MOUNTAIN ---
    rocky = [
        "large grey boulder", "stacked rock cairn", "jagged stone spire",
        "cracked cliff rock chunk", "small rock rubble pile", "crystal geode rock",
        "mossy mountain stone", "flat stepping stone", "pointed obsidian shard rock",
        "rocky mountain outcrop", "cave entrance rock arch", "mineral vein boulder",
    ]
    for i, d in enumerate(rocky):
        s.append(spec(f"rocky-{i:02d}", "rocky", d))
    # --- WATER ---
    water = [
        "stone water well with bucket", "small wooden dock pier", "blue pond with lily pads",
        "waterfall over rocks", "wooden water barrel", "fishing net on post",
        "river rock with ripples", "old wooden rowboat", "reed cattails cluster",
        "stone fountain", "water pump rusty", "puddle with reflection",
    ]
    for i, d in enumerate(water):
        s.append(spec(f"water-{i:02d}", "water", d))
    # --- TOWN (extra variety: street furniture, crypto-arcade flavor) ---
    town = [
        "neon arcade cabinet machine", "retro vending machine", "street lamp post glowing",
        "wooden market stall", "stack of wooden crates", "metal trash dumpster",
        "fire hydrant", "wooden bench seat", "hanging shop awning",
        "newspaper box", "bar stool", "neon open sign frame blank",
        "cardboard box stack", "traffic cone", "manhole cover",
        "potted plant on stand", "wooden barrel stack", "brick wall segment",
    ]
    for i, d in enumerate(town):
        s.append(spec(f"town-{i:02d}", "town", d))
    # --- ROAD ---
    road = [
        "cobblestone path segment", "wooden plank bridge", "dirt road with tracks",
        "stone road marker", "wooden crossing sign blank", "pothole in asphalt",
    ]
    for i, d in enumerate(road):
        s.append(spec(f"road-{i:02d}", "road", d))
    # --- FX / IMPACT SPRITES (single-frame impact art for layering) ---
    fx = [
        "bright coin explosion burst yellow", "blue energy shockwave ring", "white muzzle flash star",
        "orange fireball explosion", "green toxic splash cloud", "electric spark burst",
        "red blood splatter splat", "dark smoke puff cloud", "golden sparkle twinkle",
        "ice shatter shard burst", "purple void implosion", "dust kick cloud brown",
        "critical hit star flash white", "shield block hexagon flash blue", "lightning bolt zap",
        "small explosion debris", "heal plus glow green", "level-up radiant burst gold",
    ]
    for i, d in enumerate(fx):
        s.append(spec(f"fx-{i:02d}", "fx", d, size=96))
    # --- PICKUPS / ITEMS ---
    pickups = [
        "glowing gold coin", "stack of silver coins", "treasure chest open",
        "health heart red", "blue energy crystal gem", "ammo box crate",
        "grenade pickup", "speed boost lightning icon", "shield powerup orb blue",
        "magnet powerup icon", "xp gem cyan diamond", "key golden",
    ]
    for i, d in enumerate(pickups):
        s.append(spec(f"pickup-{i:02d}", "pickup", d, size=72))
    return s


def load_ledger() -> dict[str, Any]:
    if LEDGER.exists():
        return json.loads(LEDGER.read_text(encoding="utf-8"))
    return {"jobs": []}


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
    parts = []
    for c in getattr(result, "content", []) or []:
        if hasattr(c, "text"):
            parts.append(c.text)
    return "\n".join(parts)


async def queue(limit: int | None) -> None:
    data = load_ledger()
    existing = {j["job_key"]: j for j in data["jobs"]}
    specs = all_specs()
    server = load_server()
    queued = 0
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (r, w, _):
        async with ClientSession(r, w) as sess:
            await sess.initialize()
            for sp in specs:
                if sp["job_key"] in existing and existing[sp["job_key"]].get("object_id"):
                    continue
                if limit is not None and queued >= limit:
                    break
                try:
                    res = await sess.call_tool(sp["tool"], sp["args"])
                    text = result_text(res)
                    m = UUID_RE.search(text)
                    job = {"job_key": sp["job_key"], "biome": sp["biome"],
                           "object_id": m.group(0) if m else None, "status": "queued",
                           "raw": text[:200]}
                    existing[sp["job_key"]] = job
                    queued += 1
                    print(f"queued {sp['job_key']} -> {job['object_id']}", flush=True)
                    time.sleep(1.0)
                except Exception as exc:
                    print(f"ERR queue {sp['job_key']}: {exc}", flush=True)
                    time.sleep(3.0)
            data["jobs"] = list(existing.values())
            save_ledger(data)
    total = len(all_specs())
    print(json.dumps({"queued_now": queued, "have_ids": sum(1 for j in existing.values() if j.get("object_id")), "total_specs": total}, indent=2))


def download(url: str, dest: Path) -> bool:
    try:
        dest.parent.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(url, headers={"User-Agent": "hmh-demo-wave"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            dest.write_bytes(resp.read())
        return dest.stat().st_size > 0
    except Exception as exc:
        print(f"  download err: {exc}", flush=True)
        return False


async def collect(limit: int | None) -> None:
    data = load_ledger()
    server = load_server()
    done = 0
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (r, w, _):
        async with ClientSession(r, w) as sess:
            await sess.initialize()
            for job in data["jobs"]:
                if job.get("status") == "complete":
                    continue
                if not job.get("object_id"):
                    continue
                if limit is not None and done >= limit:
                    break
                try:
                    res = await sess.call_tool("get_map_object", {"object_id": job["object_id"]})
                    text = result_text(res)
                    urls = URL_RE.findall(text)
                    png = next((u for u in urls if ".png" in u.lower()), urls[0] if urls else None)
                    if "processing" in text.lower() or not png:
                        job["status"] = "processing"
                        print(f"  {job['job_key']}: processing", flush=True)
                        continue
                    dest = OUT_ROOT / job["biome"] / f"{job['job_key']}.png"
                    if download(png, dest):
                        job["status"] = "complete"
                        job["src"] = f"./assets/generated/hmh-demo-wave/{job['biome']}/{job['job_key']}.png"
                        done += 1
                        print(f"  saved {job['job_key']}", flush=True)
                except Exception as exc:
                    print(f"  ERR collect {job['job_key']}: {exc}", flush=True)
                time.sleep(0.6)
    save_ledger(data)
    by_status: dict[str, int] = {}
    for j in data["jobs"]:
        by_status[j.get("status", "?")] = by_status.get(j.get("status", "?"), 0) + 1
    print(json.dumps({"collected_now": done, "by_status": by_status}, indent=2))


def status() -> None:
    data = load_ledger()
    by_status: dict[str, int] = {}
    by_biome: dict[str, int] = {}
    for j in data["jobs"]:
        by_status[j.get("status", "?")] = by_status.get(j.get("status", "?"), 0) + 1
        if j.get("status") == "complete":
            by_biome[j["biome"]] = by_biome.get(j["biome"], 0) + 1
    print(json.dumps({"total_specs": len(all_specs()), "ledger_jobs": len(data["jobs"]),
                      "by_status": by_status, "complete_by_biome": by_biome}, indent=2))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("command", choices=["queue", "collect", "status"])
    ap.add_argument("--limit", type=int, default=None)
    args = ap.parse_args()
    if args.command == "queue":
        asyncio.run(queue(args.limit))
    elif args.command == "collect":
        asyncio.run(collect(args.limit))
    else:
        status()


if __name__ == "__main__":
    main()

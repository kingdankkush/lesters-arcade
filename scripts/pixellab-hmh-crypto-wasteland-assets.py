#!/usr/bin/env python3
"""PixelLab queue/collect helper for the Hard Money Heroes Crypto Wasteland pass.

This script focuses on the missing district-connective assets called out in
`docs/game-design/hard-money-heroes-crypto-wasteland-district-production-sheet.md`.
It reuses the existing PixelLab MCP workflow (queue -> poll -> status) and keeps a
resumable ledger so reruns only touch unfinished jobs.

The first batch is intentionally the high-priority connective tissue:
- ground transitions
- road network tiles
- a few core blockers / facades that make district routes readable

Usage:
  python scripts/pixellab-hmh-crypto-wasteland-assets.py balance
  python scripts/pixellab-hmh-crypto-wasteland-assets.py queue [--limit N]
  python scripts/pixellab-hmh-crypto-wasteland-assets.py poll [--limit N]
  python scripts/pixellab-hmh-crypto-wasteland-assets.py status
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
OUT_DIR = ROOT / "apps" / "portal" / "assets" / "generated" / "hmh-coherent-world"
SET_NAME = "crypto-wasteland"
LEDGER = OUT_DIR / "crypto-wasteland-ledger.json"
UUID_RE = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")
URL_RE = re.compile(r"https?://[^\s,)\]>'\"]+")

NO_TEXT = "no words, no letters, no numbers, no readable labels, no logos, no watermark"
STYLE = (
    "isometric pixel art for Hard Money Heroes, retro arcade readability, crisp silhouette, "
    "limited SNES/Neo-Geo palette, transparent background, match the existing Crypto Wasteland "
    f"district belts and scene-template language; {NO_TEXT}"
)

PROMPTS: list[dict[str, Any]] = [
    {
        "job_key": f"{SET_NAME}/ground-sand-dirt-edge",
        "slug": "ground-sand-dirt-edge",
        "width": 256,
        "height": 256,
        "description": "seamless isometric ground transition tile: sand to dirt edge, readable route boundary for the desert hub and ghost town approach, matches the Crypto Wasteland palette",
    },
    {
        "job_key": f"{SET_NAME}/ground-dirt-asphalt-edge",
        "slug": "ground-dirt-asphalt-edge",
        "width": 256,
        "height": 256,
        "description": "seamless isometric ground transition tile: dirt to cracked asphalt curb edge, for country road and residential edge transitions, readable top-down route boundary",
    },
    {
        "job_key": f"{SET_NAME}/road-straight",
        "slug": "road-straight",
        "width": 256,
        "height": 256,
        "description": "isometric road straight tile, worn lane paint, subtle cracks, designed for the Crypto Wasteland route network and district loops",
    },
    {
        "job_key": f"{SET_NAME}/road-tjunction",
        "slug": "road-tjunction",
        "width": 256,
        "height": 256,
        "description": "isometric T-junction road tile, readable side-route branching piece for the district road network, worn asphalt, no text, no logos",
    },
    {
        "job_key": f"{SET_NAME}/road-cap-end",
        "slug": "road-cap-end",
        "width": 256,
        "height": 256,
        "description": "isometric road end-cap tile, crumbling asphalt fading into dirt and sand, useful for dead-end rewards and scenic route terminators",
    },
    {
        "job_key": f"{SET_NAME}/desert-boulder",
        "slug": "desert-boulder",
        "width": 192,
        "height": 192,
        "description": "large isometric desert boulder blocker, rounded weathered stone with readable silhouette, intended as a hard route blocker in the desert hub",
    },
    {
        "job_key": f"{SET_NAME}/desert-cactus",
        "slug": "desert-cactus",
        "width": 192,
        "height": 224,
        "description": "large isometric cactus blocker, tall saguaro style with arms, readable silhouette, fits Crypto Wasteland desert and wasteland routes",
    },
    {
        "job_key": f"{SET_NAME}/ghost-saloon-front",
        "slug": "ghost-saloon-front",
        "width": 256,
        "height": 224,
        "description": "isometric ghost town saloon facade, weathered wooden front, porch rail, absolutely no readable text, no logos, and a blank signboard only, strong readable silhouette",
    },
    {
        "job_key": f"{SET_NAME}/ghost-boarded-storefront",
        "slug": "ghost-boarded-storefront",
        "width": 256,
        "height": 224,
        "description": "isometric boarded storefront facade for the ghost town district, broken windows, nailed planks, worn porch, readable route-edge blocker",
    },
    {
        "job_key": f"{SET_NAME}/industrial-warehouse-facade",
        "slug": "industrial-warehouse-facade",
        "width": 280,
        "height": 224,
        "description": "isometric industrial warehouse facade with loading dock, roll-up door, rusted vents, and chain-link edge language for inner city and industrial routes",
    },
    {
        "job_key": f"{SET_NAME}/residential-hedge-run",
        "slug": "residential-hedge-run",
        "width": 256,
        "height": 192,
        "description": "isometric hedge-and-fence run for residential edge districts, readable soft blocker piece for neighborhood loops, with driveway and curb logic",
    },
    {
        "job_key": f"{SET_NAME}/shoreline-water-edge",
        "slug": "shoreline-water-edge",
        "width": 256,
        "height": 256,
        "description": "isometric shoreline transition tile, wet sand into shallow foamy water edge, useful for beach or oasis districts and water boundary logic",
    },
    {
        "job_key": f"{SET_NAME}/forest-tree-line",
        "slug": "forest-tree-line",
        "width": 256,
        "height": 256,
        "description": "isometric forest edge tile with dense tree line, root clutter, and trail opening, readable soft blocker for the forest greenbelt and park transitions",
    },
    {
        "job_key": f"{SET_NAME}/canyon-cliff-edge",
        "slug": "canyon-cliff-edge",
        "width": 256,
        "height": 256,
        "description": "isometric canyon cliff edge tile, sandstone wall with a switchback-friendly route opening, readable hard blocker for badlands and canyon routes",
    },
    {
        "job_key": f"{SET_NAME}/landmark-gas-station",
        "slug": "landmark-gas-station",
        "width": 280,
        "height": 224,
        "description": "isometric unbranded gas station or outpost landmark shell for Crypto Wasteland, blank canopy sign, no readable branding, no price boards, no logos, strong district beacon",
    },
    {
        "job_key": f"{SET_NAME}/utility-pole",
        "slug": "utility-pole",
        "width": 128,
        "height": 192,
        "description": "isometric roadside utility pole with wires, transformers, and cable clutter for country road and district transition bands, no readable signs, no logos, no hanging text boards",
    },
    {
        "job_key": f"{SET_NAME}/innercity-billboard-frame",
        "slug": "innercity-billboard-frame",
        "width": 256,
        "height": 192,
        "description": "isometric billboard frame, bus-stop language, and street barrier prop for the inner city district, readable silhouette, no readable text",
    },
]


def load_pixellab_server() -> dict[str, Any]:
    p_user = Path.home() / ".claude.json"
    if p_user.exists():
        d = json.loads(p_user.read_text(encoding="utf-8"))
        for project in d.get("projects", {}).values():
            srv = project.get("mcpServers", {}).get("pixellab")
            if srv:
                return srv
        srv = d.get("mcpServers", {}).get("pixellab")
        if srv:
            return srv
    p_hermes = Path.home() / ".hermes" / "config" / "mcp-config.json"
    if p_hermes.exists():
        d_hermes = json.loads(p_hermes.read_text(encoding="utf-8"))
        srv_hermes = d_hermes.get("mcpServers", {}).get("pixellab")
        if srv_hermes:
            return srv_hermes
    raise SystemExit(f"Could not locate PixelLab MCP config in {p_user} or {p_hermes}")


def txt(result: Any) -> str:
    return "\n".join(
        c.text for c in getattr(result, "content", []) or [] if hasattr(c, "text")
    )


def load_ledger() -> dict[str, Any]:
    if LEDGER.exists():
        return json.loads(LEDGER.read_text(encoding="utf-8"))
    return {"jobs": {}}


def save_ledger(data: dict[str, Any]) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    LEDGER.write_text(json.dumps(data, indent=2), encoding="utf-8")


async def fetch_balance_text() -> str:
    server = load_pixellab_server()
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            try:
                result = await session.call_tool("get_balance", {})
                return txt(result)
            except Exception as exc:
                return f"get_balance unavailable: {exc}"


async def cmd_balance() -> None:
    print(await fetch_balance_text())


async def cmd_queue(limit: int) -> None:
    server = load_pixellab_server()
    data = load_ledger()
    existing = dict(data.get("jobs", {}))
    balance = await fetch_balance_text()
    print(balance)
    queued = 0
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            for spec in PROMPTS:
                if queued >= limit:
                    break
                job = existing.get(spec["job_key"], {})
                if job.get("status") in {"downloaded", "created", "processing_create"} and job.get("id"):
                    continue
                print(f"Queueing create_map_object for {spec['job_key']}", flush=True)
                try:
                    result = await session.call_tool(
                        "create_map_object",
                        {
                            "description": f"{spec['description']}; {STYLE}",
                            "width": spec["width"],
                            "height": spec["height"],
                            "view": "high top-down",
                            "outline": "single color outline",
                            "shading": "detailed shading",
                        },
                    )
                except Exception as exc:
                    print(f"  ERR queue {spec['job_key']}: {exc}", flush=True)
                    time.sleep(2.0)
                    continue
                text = txt(result)
                ids = UUID_RE.findall(text)
                job = {
                    "job_key": spec["job_key"],
                    "set": SET_NAME,
                    "slug": spec["slug"],
                    "width": spec["width"],
                    "height": spec["height"],
                    "id": ids[0] if ids else None,
                    "status": "processing_create" if ids else "failed_create",
                    "raw_create_response": text[:5000],
                    "created_at": time.time(),
                }
                existing[spec["job_key"]] = job
                queued += 1
                save_ledger({"jobs": existing})
                print(f"  queued -> {job['id']}", flush=True)
                time.sleep(1.0)
    save_ledger({"jobs": existing})
    print(json.dumps({"queued_now": queued, "tracked": len(existing), "specs": len(PROMPTS)}, indent=2))


def download_asset(url: str, dest: Path) -> bool:
    try:
        dest.parent.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(url, headers={"User-Agent": "hmh-crypto-wasteland"})
        with urllib.request.urlopen(req, timeout=90) as resp:
            data = resp.read()
        if data[:8] != bytes.fromhex("89504e470d0a1a0a"):
            return False
        dest.write_bytes(data)
        return dest.stat().st_size > 0
    except Exception as exc:
        print(f"  download err: {exc}", flush=True)
        return False


async def cmd_poll(limit: int | None) -> None:
    server = load_pixellab_server()
    data = load_ledger()
    jobs = list(data.get("jobs", {}).items())
    completed = 0
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            for key, job in jobs:
                if limit is not None and completed >= limit:
                    break
                oid = job.get("id")
                if not oid or job.get("status") == "downloaded":
                    continue
                try:
                    result = await session.call_tool("get_object", {"object_id": oid})
                    text = txt(result).lower()
                except Exception as exc:
                    print(f"  ERR poll {key}: {exc}", flush=True)
                    continue
                if "completed" not in text and "status: completed" not in text:
                    job["status"] = "processing_create"
                    save_ledger(data)
                    print(f"  {key}: still processing", flush=True)
                    continue
                dest = OUT_DIR / SET_NAME / f"{job['slug']}.png"
                download_url = f"https://api.pixellab.ai/mcp/objects/{oid}/download"
                if download_asset(download_url, dest):
                    job["status"] = "downloaded"
                    job["path"] = str(dest.relative_to(ROOT))
                    completed += 1
                    save_ledger(data)
                    print(f"  saved {key}", flush=True)
    save_ledger(data)
    counts: dict[str, int] = {}
    for job in data.get("jobs", {}).values():
        status = job.get("status", "unknown")
        counts[status] = counts.get(status, 0) + 1
    print(json.dumps({"downloaded_now": completed, "status_counts": counts}, indent=2))


def cmd_status() -> None:
    data = load_ledger()
    counts: dict[str, int] = {}
    for job in data.get("jobs", {}).values():
        status = job.get("status", "not_started")
        counts[status] = counts.get(status, 0) + 1
    queued = sum(1 for j in data.get("jobs", {}).values() if j.get("id"))
    downloaded = sum(1 for j in data.get("jobs", {}).values() if j.get("status") == "downloaded")
    print(json.dumps({
        "specs": len(PROMPTS),
        "tracked": len(data.get("jobs", {})),
        "queued": queued,
        "downloaded": downloaded,
        "statuses": counts,
        "output_dir": str(OUT_DIR / SET_NAME),
        "ledger": str(LEDGER),
    }, indent=2))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["balance", "queue", "poll", "status"])
    parser.add_argument("--limit", type=int, default=0, help="Max jobs to queue/poll in this run (queue defaults to 4 when omitted; poll is unlimited when omitted)")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    if args.command == "balance":
        asyncio.run(cmd_balance())
    elif args.command == "queue":
        asyncio.run(cmd_queue(4 if args.limit <= 0 else args.limit))
    elif args.command == "poll":
        asyncio.run(cmd_poll(None if args.limit <= 0 else args.limit))
    elif args.command == "status":
        cmd_status()


if __name__ == "__main__":
    main()

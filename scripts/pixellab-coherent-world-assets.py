#!/usr/bin/env python3
"""Coherent world-asset generation for Hard Money Heroes (iso roguelike).

Generates COHERENT SETS of isometric props (street, interior, park/forest,
constructive fence/wall/river pieces) via the PixelLab MCP API, so the
scene-template placement layer has matching art to assemble believable areas.

Design: docs/game-design/coherent-world-assembly-plan.md

Resumable: a JSON ledger tracks each job's id + status. Re-running queues only
missing/failed jobs, polls in-flight ones, and downloads completed PNGs into the
repo asset tree. Safe to run repeatedly (e.g. from a cron wave) until done.

Usage:
  python scripts/pixellab-coherent-world-assets.py queue   # create missing objects
  python scripts/pixellab-coherent-world-assets.py poll    # poll + download ready
  python scripts/pixellab-coherent-world-assets.py status  # print ledger summary
"""
from __future__ import annotations
import asyncio, json, re, sys, time
from pathlib import Path

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "apps/portal/assets/generated/hmh-coherent-world"
LEDGER = OUT_DIR / "coherent-world-ledger.json"
UUID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")

# Each spec: (set, slug, w, h, view, description). view "high top-down" reads as
# iso for tall props; ground-flat pieces use "high top-down" too (PixelLab has no
# true iso object mode — tiles use create_isometric_tile separately).
SPECS = [
    # ---- STREET SET ----
    ("street", "street-lamp", 48, 96, "isometric retro street lamp post, dark metal pole, glowing warm lantern head, pixel art"),
    ("street", "fire-hydrant", 40, 48, "isometric red fire hydrant, chunky pixel art, transparent"),
    ("street", "park-bench", 64, 48, "isometric wooden park bench with metal frame, pixel art"),
    ("street", "mailbox", 40, 56, "isometric blue street mailbox on a post, pixel art"),
    ("street", "trash-can", 40, 48, "isometric metal city trash can with lid, pixel art"),
    ("street", "traffic-cone", 32, 40, "isometric orange traffic cone, pixel art"),
    ("street", "bus-stop-sign", 40, 72, "isometric bus stop sign on a thin pole, pixel art"),
    # ---- INTERIOR SET (arcade) ----
    ("interior", "arcade-cabinet", 48, 80, "isometric retro arcade cabinet machine with glowing screen, pixel art"),
    ("interior", "soda-machine", 48, 80, "isometric red soda vending machine, glowing front panel, pixel art"),
    ("interior", "tv-on-table", 56, 64, "isometric old CRT television sitting on a low wooden entertainment center table, pixel art"),
    ("interior", "stacked-boxes", 56, 56, "isometric stack of cardboard moving boxes, pixel art"),
    ("interior", "wooden-crate", 40, 40, "isometric wooden shipping crate, pixel art"),
    ("interior", "shop-counter", 64, 48, "isometric wooden shop counter desk, pixel art"),
    ("interior", "table-plain", 48, 40, "isometric small wooden table, pixel art"),
    # ---- PARK / FOREST SET ----
    ("nature", "pine-tree", 56, 96, "isometric tall green pine tree, pixel art, transparent"),
    ("nature", "oak-tree", 64, 88, "isometric round leafy oak tree, pixel art, transparent"),
    ("nature", "bush", 40, 40, "isometric small green round bush, pixel art"),
    ("nature", "flower-patch", 40, 32, "isometric small patch of wildflowers in grass, pixel art"),
    ("nature", "fallen-log", 56, 36, "isometric mossy fallen log, pixel art"),
    ("nature", "boulder", 48, 48, "isometric grey rocky boulder, pixel art"),
    ("nature", "fountain", 72, 72, "isometric round stone park fountain with water, pixel art"),
    # ---- CONSTRUCTIVE / TILING ----
    ("construct", "fence-segment", 48, 40, "isometric wooden fence segment, single straight panel, pixel art"),
    ("construct", "fence-post", 32, 48, "isometric single wooden fence post, pixel art"),
    ("construct", "fence-gate", 48, 44, "isometric wooden fence gate, pixel art"),
    ("construct", "brick-wall-segment", 48, 48, "isometric grey brick wall segment, straight, pixel art"),
    ("construct", "brick-wall-corner", 48, 48, "isometric grey brick wall corner piece, pixel art"),
    ("construct", "low-stone-wall", 48, 32, "isometric low grey stone wall segment, pixel art"),
    ("construct", "river-straight", 64, 48, "isometric straight river water segment with banks, pixel art"),
    ("construct", "river-bend", 64, 64, "isometric bending river water segment with banks, pixel art"),
    ("construct", "wood-bridge", 64, 40, "isometric wooden plank bridge over water, pixel art"),
]


def load_server() -> dict:
    d = json.loads((Path.home() / ".claude.json").read_text(encoding="utf-8"))
    for p in d.get("projects", {}).values():
        s = p.get("mcpServers", {}).get("pixellab")
        if s:
            return s
    s = d.get("mcpServers", {}).get("pixellab")
    if s:
        return s
    raise SystemExit("no pixellab server in ~/.claude.json")


def txt(r) -> str:
    return "\n".join(c.text for c in getattr(r, "content", []) or [] if hasattr(c, "text"))


def load_ledger() -> dict:
    if LEDGER.exists():
        return json.loads(LEDGER.read_text(encoding="utf-8"))
    return {"jobs": {}}


def save_ledger(d: dict) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    LEDGER.write_text(json.dumps(d, indent=2), encoding="utf-8")


async def cmd_queue(active_cap: int = 4) -> None:
    server = load_server()
    led = load_ledger()
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            queued = 0
            for (sset, slug, w, h, desc) in SPECS:
                key = f"{sset}/{slug}"
                job = led["jobs"].get(key)
                if job and job.get("status") in {"completed", "downloaded", "processing"} and job.get("id"):
                    continue
                if queued >= active_cap:
                    break  # respect the small active-job pool; next wave continues
                r = await session.call_tool("create_map_object", {
                    "description": desc, "width": w, "height": h,
                    "view": "high top-down", "outline": "single color outline",
                    "shading": "basic shading", "detail": "medium detail",
                })
                t = txt(r)
                ids = UUID_RE.findall(t)
                led["jobs"][key] = {
                    "set": sset, "slug": slug, "w": w, "h": h,
                    "id": ids[0] if ids else None,
                    "status": "processing" if ids else "failed",
                    "raw": t[:300],
                }
                save_ledger(led)
                print(f"queued {key} -> {ids[0] if ids else 'FAIL: ' + t[:120]}")
                queued += 1
                await asyncio.sleep(1.0)
    print(f"queue done: {queued} new this wave")


def download(server, oid: str, dest: Path) -> bool:
    import urllib.request
    url = f"https://api.pixellab.ai/mcp/objects/{oid}/download"
    req = urllib.request.Request(url, headers={"Authorization": server["headers"]["Authorization"]})
    try:
        data = urllib.request.urlopen(req, timeout=60).read()
        if data[:8] == bytes.fromhex("89504e470d0a1a0a"):
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
            return True
        # ZIP fallback (multi-frame): save raw for manual extraction
        if data[:2] == b"PK":
            dest.with_suffix(".zip").write_bytes(data)
            return True
    except Exception as e:
        print(f"  download err {oid}: {type(e).__name__} {e}")
    return False


async def cmd_poll() -> None:
    server = load_server()
    led = load_ledger()
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            for key, job in led["jobs"].items():
                if job.get("status") == "downloaded" or not job.get("id"):
                    continue
                g = await session.call_tool("get_object", {"object_id": job["id"]})
                gt = txt(g).lower()
                if "completed" in gt or "status: completed" in gt:
                    dest = OUT_DIR / job["set"] / f"{job['slug']}.png"
                    if download(server, job["id"], dest):
                        job["status"] = "downloaded"
                        job["path"] = str(dest.relative_to(ROOT))
                        print(f"downloaded {key} -> {job['path']}")
                    else:
                        job["status"] = "completed"
                else:
                    job["status"] = "processing"
                save_ledger(led)
                await asyncio.sleep(0.5)
    cmd_status()


def cmd_status() -> None:
    led = load_ledger()
    from collections import Counter
    c = Counter(j.get("status", "none") for j in led["jobs"].values())
    total = len(SPECS)
    print(f"ledger: {len(led['jobs'])}/{total} specs tracked :: {dict(c)}")


def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    if cmd == "queue":
        asyncio.run(cmd_queue())
    elif cmd == "poll":
        asyncio.run(cmd_poll())
    else:
        cmd_status()


if __name__ == "__main__":
    main()

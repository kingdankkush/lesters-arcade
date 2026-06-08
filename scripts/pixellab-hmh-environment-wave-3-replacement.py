#!/usr/bin/env python
"""Queue, collect, and package PixelLab environment assets for Hard Money Heroes.

Wave 2 focuses on level tilesets, terrain, roads, water, nature props, vehicles,
garbage/sign props, and lightweight idle/ambient animation loops.

Auth is read from the local Claude PixelLab MCP config and is never written to
manifests, docs, or logs.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import re
import shutil
import time
import urllib.parse
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    from PIL import Image, ImageDraw, ImageFont
except Exception as exc:  # pragma: no cover - local tooling guard
    raise SystemExit(f"Pillow is required for PixelLab packaging/contact sheets: {exc}")

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_ROOT = Path("apps/portal/assets/generated/hmh-environment-pixellab-wave-3")
OUT_ROOT = ROOT / PUBLIC_ROOT
JOBS_PATH = OUT_ROOT / "pixellab-environment-wave-3-jobs.json"
RAW_DIR = OUT_ROOT / "raw-tool-output"
CONTACT_DIR = OUT_ROOT / "contact-sheets"
RUNTIME_MANIFEST_PATH = OUT_ROOT / "hmh-environment-pixellab-wave-3.mjs"
DOC_PATH = ROOT / "docs/game-design/hard-money-heroes-pixellab-environment-wave-3.md"

UUID_RE = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")
URL_RE = re.compile(r"https?://[^\s,)\]>'\"]+")
NO_TEXT = "no words, no letters, no numbers, no readable labels, no logos, no watermark"
STYLE = (
    "isometric low top-down pixel art for Hard Money Heroes, retro 80s/90s arcade, "
    "crisp silhouettes, limited SNES/Neo-Geo palette, dark Litecoin City After Dark mood, "
    "blue silver hard-money energy accents without official brand marks"
)
TILE_STYLE = f"{STYLE}; seamless game-ready tile art, transparent background where appropriate; {NO_TEXT}"
OBJECT_STYLE = f"{STYLE}; transparent background; {NO_TEXT}"

# ---------------------------------------------------------------------------
# WAVE 3 — clean isometric REPLACEMENT art for Hard Money Heroes.
#
# Replaces the old 2D side-view props whose backgrounds were keyed out badly
# (halo fringe / never-keyed white). Everything here is generated natively as
# isometric low-top-down art with transparent backgrounds.
#
# Size tiers map 1:1 to renderer scale + collision policy:
#   role "large_*"  -> drawn 2-3x player size, SOLID collision (walk around)
#   role "small_*"  -> drawn small, NO collision (player walks over them)
#   tilesets/edges  -> level-design edge transitions (pebbles, sand, road end, beach->water)
# ---------------------------------------------------------------------------

# Small EDGE / TRANSITION tilesets for level-design borders. These are the
# "give things edges" kits Justin asked for: pebble borders, sand edges, the
# end of a road, beach-to-water transitions, etc.
TERRAIN_TILESETS: list[dict[str, Any]] = [
    {
        "slug": "edge-transition-kit",
        "name": "Ground Edge Transition Kit",
        "role": "tileset_edges",
        "description": (
            "small seamless ground edge transition tiles: 1). pebble gravel border edge "
            "2). grass to dirt edge 3). dirt to sand edge 4). end of asphalt road cap edge "
            "5). curb edge between road and sidewalk 6). cracked pavement edge "
            "7). cobblestone border edge 8). worn path edge into grass; "
            f"{TILE_STYLE}"
        ),
        "tile_size": 64,
    },
    {
        "slug": "beach-water-edge-kit",
        "name": "Beach And Water Edge Kit",
        "role": "tileset_water_edges",
        "description": (
            "small seamless beach and water edge transition tiles: 1). dry sand to wet sand edge "
            "2). wet sand to shallow water foam edge 3). shallow water to deep water edge "
            "4). pebble beach shoreline edge 5). river bank mud to water edge "
            "6). rock shoreline edge 7). small tide foam line 8). water corner edge; "
            f"{TILE_STYLE}"
        ),
        "tile_size": 64,
    },
]

# A few small standalone isometric ground/edge tiles (pebbles, sand, road end,
# beach->water) for hand-placed level-design edges.
ISOMETRIC_TILES: list[tuple[str, str, str]] = [
    ("pebble-edge", "pebble edge", "small scattered pebbles and gravel as a thin edge accent tile"),
    ("sand-edge", "sand edge", "pale sand tile fading to a soft grass edge on one side"),
    ("road-end-cap", "road end cap", "end of an asphalt road, broken crumbling edge into dirt, no text"),
    ("beach-to-water", "beach to water", "wet sand beach meeting shallow foamy water edge"),
    ("grass-flower-edge", "grass flower edge", "short grass tile with a few tiny scattered flowers, walkable ground"),
]

# LARGE collidable objects — buildings, vehicles, big rocks/boulders, big trees.
# Generated at large native dimensions; the renderer draws role "large_*" at
# 2-3x player size and gives them SOLID collision so the player must walk around.
STATIC_MAP_OBJECTS: list[dict[str, Any]] = [
    # --- Buildings (town biome) -------------------------------------------
    {"slug": "iso-apartment-block", "name": "Apartment Block", "role": "large_building", "biome": "town", "width": 200, "height": 240, "description": "tall isometric run-down city apartment building, multiple lit and dark windows, fire escape, flat roof, weathered concrete, clean readable silhouette, planted firmly on the ground"},
    {"slug": "iso-corner-store", "name": "Corner Store", "role": "large_building", "biome": "town", "width": 200, "height": 200, "description": "isometric small two-story corner store building with awning and blank empty signboard, roller shutter, grimy brick, clean readable silhouette, grounded base"},
    {"slug": "iso-warehouse", "name": "Warehouse", "role": "large_building", "biome": "town", "width": 224, "height": 200, "description": "isometric industrial warehouse with corrugated metal roof, loading dock and roll door, rusted vents, clean readable silhouette, grounded base"},
    {"slug": "iso-parking-garage", "name": "Parking Garage", "role": "large_building", "biome": "town", "width": 224, "height": 224, "description": "isometric multi-level concrete parking garage with open ramps and pillars, gritty urban, clean readable silhouette, grounded base"},
    # --- Vehicles ----------------------------------------------------------
    {"slug": "iso-sedan-car", "name": "Sedan Car", "role": "large_vehicle", "biome": "town", "width": 168, "height": 120, "description": "isometric parked four-door sedan car, glossy reflective paint, no license plate text, clean readable silhouette, wheels planted on ground"},
    {"slug": "iso-pickup-truck", "name": "Pickup Truck", "role": "large_vehicle", "biome": "town", "width": 184, "height": 132, "description": "isometric pickup truck with cargo bed, slightly dented, no text, clean readable silhouette, wheels on the ground"},
    {"slug": "iso-box-van", "name": "Box Van", "role": "large_vehicle", "biome": "town", "width": 200, "height": 140, "description": "isometric delivery box van, blank panel sides with no text or logo, clean readable silhouette, wheels grounded"},
    {"slug": "iso-wrecked-car", "name": "Wrecked Car", "role": "large_vehicle", "biome": "town", "width": 176, "height": 124, "description": "isometric abandoned wrecked car, smashed hood, broken windows, rust, no text, clean readable silhouette, planted on the ground"},
    # --- Rock formations / boulders ---------------------------------------
    {"slug": "iso-boulder-large", "name": "Large Boulder", "role": "large_rock", "biome": "desert", "width": 160, "height": 140, "description": "large isometric rounded desert boulder, weathered cracks and lichen, heavy solid mass, clean readable silhouette, firmly seated on the ground"},
    {"slug": "iso-rock-formation", "name": "Rock Formation", "role": "large_rock", "biome": "desert", "width": 200, "height": 180, "description": "isometric tall layered sandstone rock formation, stacked desert mesa rocks, clean readable silhouette, grounded base"},
    {"slug": "iso-rock-cluster-big", "name": "Big Rock Cluster", "role": "large_rock", "biome": "desert", "width": 168, "height": 128, "description": "isometric cluster of large gray-brown rocks and boulders for cover, clean readable silhouette, planted on the ground"},
    # --- Big trees ---------------------------------------------------------
    {"slug": "iso-oak-tree", "name": "Oak Tree", "role": "large_tree", "biome": "town", "width": 168, "height": 224, "description": "large isometric leafy oak tree with thick trunk and full canopy, city park tree, clean readable silhouette, roots grounded"},
    {"slug": "iso-pine-tree", "name": "Pine Tree", "role": "large_tree", "biome": "town", "width": 144, "height": 224, "description": "tall isometric pine evergreen tree, layered branches, clean readable silhouette, base planted on the ground"},
    {"slug": "iso-palm-tree", "name": "Palm Tree", "role": "large_tree", "biome": "desert", "width": 160, "height": 224, "description": "isometric desert palm tree with curved trunk and fronds, clean readable silhouette, base grounded"},
    {"slug": "iso-dead-tree", "name": "Dead Tree", "role": "large_tree", "biome": "desert", "width": 152, "height": 208, "description": "isometric bare twisted dead tree, gnarled branches, eerie, clean readable silhouette, roots grounded"},
    # --- Big saguaro cactus (desert landmark, collidable) -----------------
    {"slug": "iso-saguaro-cactus", "name": "Saguaro Cactus", "role": "large_tree", "biome": "desert", "width": 128, "height": 208, "description": "tall isometric saguaro cactus with two arms, desert green, clean readable silhouette, base planted on the ground"},
]

# SMALL walkable objects — flowers, plants, small city/forest clutter. The
# renderer draws role "small_*" at small scale and gives NO collision so the
# player simply walks over them.
SMALL_MAP_OBJECTS: list[dict[str, Any]] = [
    {"slug": "iso-flower-cluster", "name": "Flower Cluster", "role": "small_flora", "biome": "town", "width": 64, "height": 64, "description": "small isometric cluster of colorful wildflowers and grass tufts, ground-level, tiny"},
    {"slug": "iso-grass-tuft", "name": "Grass Tuft", "role": "small_flora", "biome": "town", "width": 56, "height": 56, "description": "small isometric tuft of grass blades, ground-level decoration, tiny"},
    {"slug": "iso-fern-bush", "name": "Fern Bush", "role": "small_flora", "biome": "town", "width": 72, "height": 72, "description": "small isometric leafy fern bush, low to the ground, tiny forest plant"},
    {"slug": "iso-desert-shrub", "name": "Desert Shrub", "role": "small_flora", "biome": "desert", "width": 72, "height": 64, "description": "small isometric dry desert shrub and tumbleweed sprig, low to the ground, tiny"},
    {"slug": "iso-small-barrel-cactus", "name": "Barrel Cactus", "role": "small_flora", "biome": "desert", "width": 56, "height": 64, "description": "small isometric round barrel cactus with a tiny flower on top, ground-level, tiny"},
    {"slug": "iso-mushroom-cluster", "name": "Mushroom Cluster", "role": "small_flora", "biome": "town", "width": 56, "height": 56, "description": "small isometric cluster of forest mushrooms, ground-level, tiny"},
    {"slug": "iso-soda-can", "name": "Soda Can", "role": "small_clutter", "biome": "town", "width": 40, "height": 48, "description": "tiny isometric crushed soda can litter, no readable text, ground-level"},
    {"slug": "iso-cardboard-box", "name": "Cardboard Box", "role": "small_clutter", "biome": "town", "width": 64, "height": 60, "description": "small isometric cardboard box on the ground, blank no text, low clutter"},
    {"slug": "iso-traffic-cone", "name": "Traffic Cone", "role": "small_clutter", "biome": "town", "width": 48, "height": 64, "description": "small isometric orange traffic cone, no text, ground-level clutter"},
    {"slug": "iso-small-rock", "name": "Small Rock", "role": "small_clutter", "biome": "desert", "width": 48, "height": 40, "description": "tiny isometric small rocks and pebbles on the ground, walkable clutter"},
    {"slug": "iso-puddle", "name": "Puddle", "role": "small_clutter", "biome": "town", "width": 72, "height": 48, "description": "small isometric reflective rain puddle on pavement, flat on the ground, walkable"},
    {"slug": "iso-manhole", "name": "Manhole Cover", "role": "small_clutter", "biome": "town", "width": 56, "height": 40, "description": "small isometric round metal manhole cover flat on the road, no readable text, walkable"},
]

# POWER-UP pickups (replace any old keyed-out pickup art).
POWERUP_MAP_OBJECTS: list[dict[str, Any]] = [
    {"slug": "pu-coin-magnet", "name": "Coin Magnet", "role": "powerup", "biome": "any", "width": 64, "height": 64, "description": "glowing isometric horseshoe magnet power-up pickup floating with blue silver sparkle, crisp icon, transparent"},
    {"slug": "pu-slow-time", "name": "Slow Time", "role": "powerup", "biome": "any", "width": 64, "height": 64, "description": "glowing isometric hourglass power-up pickup with cyan time-warp glow, crisp icon, transparent"},
    {"slug": "pu-berserk", "name": "Berserk", "role": "powerup", "biome": "any", "width": 64, "height": 64, "description": "glowing isometric red flaming fist power-up pickup, rage aura, crisp icon, transparent"},
    {"slug": "pu-nuke", "name": "Liquidation Nuke", "role": "powerup", "biome": "any", "width": 64, "height": 64, "description": "glowing isometric blue energy bomb power-up pickup with crackling electricity, crisp icon, transparent"},
    {"slug": "pu-shield", "name": "Shield", "role": "powerup", "biome": "any", "width": 64, "height": 64, "description": "glowing isometric hexagonal energy shield power-up pickup, silver blue, crisp icon, transparent"},
    {"slug": "pu-heal", "name": "Heal", "role": "powerup", "biome": "any", "width": 64, "height": 64, "description": "glowing isometric green health cross power-up pickup, soft heal glow, crisp icon, transparent"},
]

# Keep a small set of ambient animated props (trees/flowers/water swaying) so
# the world still has motion; the bulk replacement is the static iso art above.
ANIMATED_OBJECTS: list[dict[str, Any]] = [
    {"slug": "iso-oak-tree-wind", "name": "Oak Tree Wind", "role": "animated_tree", "size": 200, "frame_count": 4, "description": "large isometric leafy oak tree, full canopy, grounded", "animation": "subtle looping wind sway in the leaves, trunk stable"},
    {"slug": "iso-flower-patch-sway", "name": "Flower Patch Sway", "role": "animated_flowers", "size": 96, "frame_count": 4, "description": "small isometric cluster of colorful wildflowers and grass, ground-level", "animation": "gentle looping flower and grass sway in wind"},
]

ANIMATED_BY_SLUG = {spec["slug"]: spec for spec in ANIMATED_OBJECTS}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def rel(path: Path) -> str:
    try:
        return path.resolve().relative_to(ROOT).as_posix()
    except Exception:
        return path.as_posix()


def load_pixellab_server() -> dict[str, Any]:
    config = Path.home() / ".claude.json"
    data = json.loads(config.read_text(encoding="utf-8"))
    projects = data.get("projects", {})
    home_variants = {
        str(Path.home()),
        str(Path.home()).replace("\\", "/"),
        str(Path.home()).replace("/", "\\"),
    }
    for key in home_variants:
        server = projects.get(key, {}).get("mcpServers", {}).get("pixellab")
        if server:
            return server
    for project in projects.values():
        server = project.get("mcpServers", {}).get("pixellab")
        if server:
            return server
    raise SystemExit(f"Could not locate PixelLab MCP config in {config}")


def result_text(result: Any) -> str:
    return "\n".join(getattr(c, "text", str(c)) for c in (getattr(result, "content", []) or []))


def first_uuid(text: str) -> str | None:
    match = UUID_RE.search(text)
    return match.group(0) if match else None


def extract_urls(text: str) -> list[str]:
    seen: set[str] = set()
    urls: list[str] = []
    for url in URL_RE.findall(text):
        clean = url.rstrip(".,")
        if clean not in seen:
            seen.add(clean)
            urls.append(clean)
    return urls


def expanded_download_urls(text: str) -> list[str]:
    seen: set[str] = set()
    urls: list[str] = []
    for match in re.finditer(r"(https?://[^\s,)\]>'\"]*\{i\}[^\s,)\]>'\"]*)\s*\(i=(\d+)\.\.(\d+)\)", text):
        template = match.group(1)
        start = int(match.group(2))
        end = int(match.group(3))
        for idx in range(start, end + 1):
            url = template.replace("{i}", str(idx)).rstrip(".,")
            if url not in seen:
                seen.add(url)
                urls.append(url)
    for url in extract_urls(text):
        if "{i}" in url:
            continue
        if url not in seen:
            seen.add(url)
            urls.append(url)
    return urls


def status_from_text(text: str) -> str:
    low = text.lower()
    if "rate limit" in low or "too many" in low or "active-job" in low:
        return "rate_limited"
    match = re.search(r"status:\s*([a-z_-]+)", low)
    if match:
        return match.group(1)
    if "failed" in low or "error" in low:
        return "failed"
    if "processing" in low or "progress" in low or "queued" in low:
        return "processing"
    if "completed" in low and ("download" in low or "https://" in low):
        return "completed"
    if "download" in low and "https://" in low:
        return "completed"
    return "unknown"


def base_jobs() -> list[dict[str, Any]]:
    jobs: list[dict[str, Any]] = []
    for spec in TERRAIN_TILESETS:
        jobs.append({
            "job_key": f"tileset:{spec['slug']}",
            "asset_type": "tiles_pro",
            "slug": spec["slug"],
            "name": spec["name"],
            "role": spec["role"],
            "tool": "create_tiles_pro",
            "get_tool": "get_tiles_pro",
            "id_field": "tile_id",
            "args": {
                "description": spec["description"],
                "tile_type": "isometric",
                "tile_size": spec.get("tile_size", 64),
                "tile_view": "low top-down",
                "outline_mode": "segmentation",
            },
        })
    for slug, name, description in ISOMETRIC_TILES:
        jobs.append({
            "job_key": f"tile:{slug}",
            "asset_type": "isometric_tile",
            "slug": slug,
            "name": name.title(),
            "role": "tile_static",
            "tool": "create_isometric_tile",
            "get_tool": "get_isometric_tile",
            "id_field": "tile_id",
            "args": {
                "description": f"{description}; {TILE_STYLE}",
                "size": 56,
                "tile_shape": "thin tile",
                "outline": "selective outline",
                "shading": "medium shading",
                "detail": "medium detail",
                "text_guidance_scale": 10.5,
            },
        })
    for spec in STATIC_MAP_OBJECTS + SMALL_MAP_OBJECTS + POWERUP_MAP_OBJECTS:
        jobs.append({
            "job_key": f"static_object:{spec['slug']}",
            "asset_type": "static_map_object",
            "slug": spec["slug"],
            "name": spec["name"],
            "role": spec["role"],
            "biome": spec.get("biome"),
            "tool": "create_map_object",
            "get_tool": "get_map_object",
            "id_field": "object_id",
            "args": {
                "description": f"{spec['description']}; {OBJECT_STYLE}",
                "width": spec["width"],
                "height": spec["height"],
                "view": "low top-down",
                "outline": "selective outline",
                "shading": "medium shading",
                "detail": "medium detail",
            },
        })
    for spec in ANIMATED_OBJECTS:
        jobs.append({
            "job_key": f"animated_object:{spec['slug']}",
            "asset_type": "animated_object_base",
            "slug": spec["slug"],
            "name": spec["name"],
            "role": spec["role"],
            "tool": "create_1_direction_object",
            "get_tool": "get_object",
            "id_field": "object_id",
            "args": {
                "description": f"{spec['description']}; {OBJECT_STYLE}; composed as a standalone prop for later idle animation",
                "size": spec["size"],
                "view": "top-down",
            },
            "animation_slug": "ambient",
            "animation_description": spec["animation"],
            "frame_count": spec["frame_count"],
        })
    return jobs


def animation_jobs(existing: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_slug = {
        job["slug"]: job
        for job in existing
        if job.get("asset_type") == "animated_object_base" and job.get("status") in {"completed", "review"} and job.get("id")
    }
    wanted: list[dict[str, Any]] = []
    for spec in ANIMATED_OBJECTS:
        base = by_slug.get(spec["slug"])
        if not base:
            continue
        wanted.append({
            "job_key": f"animation:{spec['slug']}:ambient",
            "asset_type": "object_animation",
            "parent_slug": spec["slug"],
            "slug": f"{spec['slug']}-ambient",
            "name": f"{spec['name']} Ambient Loop",
            "role": spec["role"],
            "tool": "animate_object",
            "get_tool": "get_object",
            "id_field": "object_id",
            "parent_id": base["id"],
            "animation_slug": "ambient",
            "frame_count": spec["frame_count"],
            "args": {
                "object_id": base["id"],
                "mode": "v3",
                "animation_description": spec["animation"],
                "frame_count": spec["frame_count"],
                "display_name": "ambient-loop",
            },
        })
    return wanted


def load_jobs() -> dict[str, Any]:
    if JOBS_PATH.exists():
        return json.loads(JOBS_PATH.read_text(encoding="utf-8"))
    return {
        "source": "PixelLab MCP/API",
        "project": "Lester's Arcade / Hard Money Heroes",
        "pack": "environment-pixellab-wave-3",
        "public_root": PUBLIC_ROOT.as_posix(),
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "jobs": [],
    }


def save_jobs(data: dict[str, Any]) -> None:
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    data["updated_at"] = now_iso()
    JOBS_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")


async def queue_jobs(kind: str, limit: int | None = None) -> None:
    data = load_jobs()
    existing_by_key = {job["job_key"]: job for job in data["jobs"]}
    specs = base_jobs() if kind == "base" else animation_jobs(data["jobs"])
    if not specs:
        print(json.dumps({"queued": 0, "skipped": 0, "reason": f"no {kind} jobs ready"}, indent=2))
        return
    server = load_pixellab_server()
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            queued = 0
            skipped = 0
            for spec in specs:
                existing = existing_by_key.get(spec["job_key"])
                if existing and existing.get("status") not in {"failed", "rate_limited", "missing_id", "unknown"}:
                    skipped += 1
                    continue
                if limit is not None and queued >= limit:
                    break
                print(f"queue {spec['tool']} :: {spec['job_key']}", flush=True)
                result = await session.call_tool(spec["tool"], spec["args"])
                text = result_text(result)
                ident = first_uuid(text)
                job = {k: v for k, v in spec.items() if k != "args"}
                job["args"] = spec["args"]
                job["id"] = ident
                job["queued_at"] = now_iso()
                job["status"] = status_from_text(text)
                job["raw_queue_response"] = text[:5000]
                if existing and existing.get("status") in {"failed", "rate_limited", "missing_id", "unknown"}:
                    existing.setdefault("attempts", []).append({
                        "archived_at": now_iso(),
                        "id": existing.get("id"),
                        "status": existing.get("status"),
                        "raw_queue_response": existing.get("raw_queue_response"),
                    })
                    existing.update(job)
                else:
                    data["jobs"].append(job)
                    existing_by_key[spec["job_key"]] = job
                save_jobs(data)
                queued += 1
                await asyncio.sleep(0.8)
            print(json.dumps({"queued": queued, "skipped": skipped, "total_jobs": len(data["jobs"])}, indent=2))


def safe_filename_from_url(url: str, idx: int) -> str:
    parsed = urllib.parse.urlparse(url)
    name = Path(parsed.path).name or f"asset-{idx:03d}.png"
    name = urllib.parse.unquote(name)
    name = re.sub(r"[^A-Za-z0-9_.-]+", "-", name)
    if "." not in name:
        name += ".bin"
    return f"{idx:03d}-{name}"


def download_url(url: str, dest: Path, headers: dict[str, str]) -> bool:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req_headers: dict[str, str] = {}
    if "api.pixellab.ai" in url and headers.get("Authorization"):
        req_headers["Authorization"] = headers["Authorization"]
    request = urllib.request.Request(url, headers=req_headers)
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            dest.write_bytes(response.read())
        return True
    except Exception as exc:
        dest.with_suffix(dest.suffix + ".error.txt").write_text(str(exc), encoding="utf-8")
        return False


def normalize_downloaded_file(path: Path, record: dict[str, Any]) -> Path:
    if not path.exists():
        return path
    signature = path.read_bytes()[:16]
    if signature.startswith(b"\x89PNG\r\n\x1a\n") and path.suffix.lower() != ".png":
        dest = path.with_suffix(".png")
        if dest.exists():
            dest = path.with_name(f"{path.stem}-{time.time_ns()}.png")
        path.rename(dest)
        record["local_path"] = rel(dest)
        record["detected_format"] = "png"
        return dest
    if signature[:2] == b"\xff\xd8" and path.suffix.lower() not in {".jpg", ".jpeg"}:
        dest = path.with_suffix(".jpg")
        if dest.exists():
            dest = path.with_name(f"{path.stem}-{time.time_ns()}.jpg")
        path.rename(dest)
        record["local_path"] = rel(dest)
        record["detected_format"] = "jpg"
        return dest
    if signature.startswith(b"PK"):
        record["detected_format"] = "zip"
    return path


def flatten_zip_member_name(member_name: str, idx: int) -> str:
    suffix = Path(member_name).suffix or ".bin"
    base = Path(member_name.replace("\\", "/")).name or f"member-{idx:03d}{suffix}"
    safe = re.sub(r"[^A-Za-z0-9_.-]+", "-", base)
    if len(safe) > 48:
        safe = safe[:40] + suffix
    if not safe.endswith(suffix):
        safe += suffix
    return f"{idx:03d}-{safe}"


def extract_zip_flat(zip_path: Path, extract_dir: Path) -> int:
    if extract_dir.exists():
        shutil.rmtree(extract_dir)
    extract_dir.mkdir(parents=True, exist_ok=True)
    count = 0
    with zipfile.ZipFile(zip_path) as zf:
        for idx, info in enumerate(zf.infolist()):
            if info.is_dir():
                continue
            out = extract_dir / flatten_zip_member_name(info.filename, idx)
            out.write_bytes(zf.read(info))
            count += 1
    return count


def download_job_assets(job: dict[str, Any], text: str, headers: dict[str, str]) -> None:
    asset_dir = OUT_ROOT / job["asset_type"] / job["slug"]
    if asset_dir.exists():
        shutil.rmtree(asset_dir)
    urls = expanded_download_urls(text)
    downloads: list[dict[str, Any]] = []
    for idx, url in enumerate(urls):
        lower = url.lower()
        if not any(token in lower for token in [".png", ".jpg", ".jpeg", ".webp", "/download", ".zip"]):
            continue
        name = safe_filename_from_url(url, idx)
        if "/download" in lower and not name.endswith(".zip"):
            name += ".zip"
        dest = asset_dir / "downloads" / name
        ok = download_url(url, dest, headers)
        record: dict[str, Any] = {"url": url, "local_path": rel(dest), "ok": ok}
        if ok:
            dest = normalize_downloaded_file(dest, record)
            if dest.suffix.lower() == ".zip":
                extract_dir = asset_dir / "extracted" / dest.stem
                try:
                    record["extracted_to"] = rel(extract_dir)
                    record["extracted_files"] = extract_zip_flat(dest, extract_dir)
                except Exception as exc:
                    record["extract_error"] = str(exc)
        downloads.append(record)
    job["downloads"] = downloads
    images: list[dict[str, Any]] = []
    for p in sorted(asset_dir.rglob("*.png")):
        try:
            with Image.open(p) as img:
                images.append({
                    "local_path": rel(p),
                    "width": img.width,
                    "height": img.height,
                    "mode": img.mode,
                    "bytes": p.stat().st_size,
                })
        except Exception:
            pass
    job["local_images"] = images


def animation_has_frames(job: dict[str, Any]) -> bool:
    images = job.get("local_images", []) or []
    expected = int(job.get("frame_count") or 4)
    # v3 often stores the source frame plus generated frames, but require at least
    # the requested count to avoid marking a base-only download as complete.
    return len(images) >= expected


async def poll_once(download: bool = True) -> None:
    data = load_jobs()
    server = load_pixellab_server()
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            counts: dict[str, int] = {}
            for job in data["jobs"]:
                ident = job.get("parent_id") if job.get("asset_type") == "object_animation" else job.get("id")
                if not ident:
                    raw_status = status_from_text(job.get("raw_queue_response") or "")
                    job["status"] = raw_status if raw_status != "unknown" else "missing_id"
                    counts[job["status"]] = counts.get(job["status"], 0) + 1
                    continue
                if job.get("id_field") == "tile_id" and job.get("get_tool") == "get_isometric_tile":
                    args = {"tile_id": ident}
                elif job.get("id_field") == "tile_id" and job.get("get_tool") == "get_tiles_pro":
                    args = {"tile_id": ident}
                elif job.get("get_tool") == "get_map_object":
                    args = {"object_id": ident}
                else:
                    args = {"object_id": ident, "include_preview": False}
                result = await session.call_tool(job["get_tool"], args)
                text = result_text(result)
                status = status_from_text(text)
                job["last_polled_at"] = now_iso()
                job["urls"] = extract_urls(text)
                raw_name = job["job_key"].replace(":", "__").replace("/", "_") + ".txt"
                (RAW_DIR / raw_name).write_text(text, encoding="utf-8")
                should_download = (
                    download
                    and status in {"completed", "review"}
                    and (
                        not job.get("local_images")
                        or (job.get("asset_type") == "object_animation" and not animation_has_frames(job))
                    )
                )
                if should_download:
                    download_job_assets(job, text, server.get("headers", {}))
                    if job.get("asset_type") == "object_animation" and not animation_has_frames(job):
                        status = "animation_pending"
                job["status"] = status
                counts[status] = counts.get(status, 0) + 1
                await asyncio.sleep(0.2)
            save_jobs(data)
            print("poll", json.dumps(counts, sort_keys=True))


async def poll_until(timeout_s: int, interval_s: int) -> None:
    deadline = time.time() + timeout_s
    while True:
        await poll_once(download=True)
        data = load_jobs()
        incomplete = [
            job for job in data["jobs"]
            if job.get("status") not in {"completed", "review", "failed"}
        ]
        if not incomplete:
            break
        if time.time() >= deadline:
            print(f"poll timeout with incomplete={len(incomplete)}")
            break
        print(f"waiting {interval_s}s for incomplete={len(incomplete)}")
        await asyncio.sleep(interval_s)


def make_contact_sheet() -> None:
    data = load_jobs()
    CONTACT_DIR.mkdir(parents=True, exist_ok=True)
    tiles: list[tuple[str, str, Path]] = []
    for job in data["jobs"]:
        imgs = [ROOT / img["local_path"] for img in job.get("local_images", []) if (ROOT / img["local_path"]).exists()]
        for img in imgs[:8]:
            tiles.append((job["slug"], job.get("asset_type", "asset"), img))
    if not tiles:
        print("No local PNGs available for contact sheet yet.")
        return
    thumb_w, thumb_h = 112, 112
    label_h = 42
    pad = 10
    cols = 6
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (thumb_w + pad) + pad, rows * (thumb_h + label_h + pad) + pad), (18, 18, 28))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("arial.ttf", 10)
    except Exception:
        font = ImageFont.load_default()
    for idx, (slug, asset_type, path) in enumerate(tiles):
        col = idx % cols
        row = idx // cols
        x = pad + col * (thumb_w + pad)
        y = pad + row * (thumb_h + label_h + pad)
        try:
            with Image.open(path) as opened:
                img = opened.convert("RGBA")
            img.thumbnail((thumb_w, thumb_h), Image.Resampling.NEAREST)
            bg = Image.new("RGBA", (thumb_w, thumb_h), (34, 34, 48, 255))
            bg.alpha_composite(img, ((thumb_w - img.width) // 2, (thumb_h - img.height) // 2))
            sheet.paste(bg.convert("RGB"), (x, y))
        except Exception:
            draw.rectangle([x, y, x + thumb_w, y + thumb_h], outline=(255, 0, 0))
        draw.multiline_text((x, y + thumb_h + 3), f"{asset_type}\n{slug[:26]}", fill=(235, 235, 245), font=font, spacing=1)
    out = CONTACT_DIR / "hmh-environment-pixellab-wave-3-contact-sheet.png"
    sheet.save(out)
    data["contact_sheet"] = rel(out)
    save_jobs(data)
    print(f"contact_sheet={rel(out)} tiles={len(tiles)}")


def write_runtime_manifest() -> None:
    data = load_jobs()
    assets: list[dict[str, Any]] = []
    for job in data["jobs"]:
        images = job.get("local_images", []) or []
        if not images:
            continue
        assets.append({
            "jobKey": job["job_key"],
            "assetType": job.get("asset_type"),
            "slug": job["slug"],
            "name": job.get("name"),
            "role": job.get("role"),
            "biome": job.get("biome"),
            "status": job.get("status"),
            "id": job.get("id") or job.get("parent_id"),
            "parentSlug": job.get("parent_slug"),
            "frameCount": job.get("frame_count"),
            "loop": True if job.get("asset_type") == "object_animation" else None,
            "images": [
                {
                    "src": "./" + img["local_path"].split("apps/portal/", 1)[-1],
                    "width": img["width"],
                    "height": img["height"],
                    "mode": img.get("mode"),
                    "bytes": img.get("bytes"),
                }
                for img in images
            ],
        })
    payload = {
        "source": data.get("source"),
        "pack": data.get("pack"),
        "publicRoot": data.get("public_root"),
        "generatedAt": now_iso(),
        "contactSheet": "./" + data.get("contact_sheet", "").split("apps/portal/", 1)[-1] if data.get("contact_sheet") else None,
        "assets": assets,
    }
    RUNTIME_MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    RUNTIME_MANIFEST_PATH.write_text(
        "export const HMH_ENVIRONMENT_PIXELLAB_WAVE_3 = Object.freeze(" + json.dumps(payload, indent=2) + ");\n",
        encoding="utf-8",
    )
    print(f"runtime_manifest={rel(RUNTIME_MANIFEST_PATH)} assets={len(assets)}")


def write_doc() -> None:
    data = load_jobs()
    counts: dict[str, int] = {}
    pngs = 0
    for job in data["jobs"]:
        counts[job.get("status", "unknown")] = counts.get(job.get("status", "unknown"), 0) + 1
        pngs += len(job.get("local_images", []) or [])
    lines = [
        "# Hard Money Heroes — PixelLab Environment Wave 2",
        "",
        f"Generated/updated: {now_iso()}",
        "",
        "## Scope",
        "",
        "This PixelLab wave creates level tilesets and environment props requested for Hard Money Heroes: ground, rocks, concrete/asphalt roads, sand, gravel, wood, water, rivers, waterfalls, trees, flowers, cactus, cars, garbage cans, signs, and additional road/desert/city props.",
        "",
        "Static ground/tileset/rock assets are intentionally still PNG assets. Water, river, waterfall, trees, flowers, cactus, cars, garbage/trash, signs, traffic light, and tumbleweed receive short ambient animation loops where PixelLab returned frames.",
        "",
        "## Current status",
        "",
        f"- Jobs manifest: `{rel(JOBS_PATH)}`",
        f"- Runtime manifest: `{rel(RUNTIME_MANIFEST_PATH)}`",
        f"- Contact sheet: `{data.get('contact_sheet', 'pending')}`",
        f"- Job counts: `{json.dumps(counts, sort_keys=True)}`",
        f"- Local PNG count discovered: `{pngs}`",
        "",
        "## QA rules",
        "",
        "- Reject or re-prompt assets with pseudo-text, logos, watermarks, bad silhouettes, or unusable scale.",
        "- Treat assets as manifest-ready production-source material until anchored, collision-tagged, and smoke-tested in the isometric renderer.",
        "- No API keys or auth headers are stored in this doc or manifests.",
        "",
        "## Assets",
        "",
    ]
    for job in data["jobs"]:
        extra = ""
        if job.get("asset_type") == "object_animation":
            extra = f" / expected loop frames: {job.get('frame_count')}"
        lines.append(f"- `{job['job_key']}` — {job.get('status','unknown')} — {len(job.get('local_images', []) or [])} PNG(s){extra}")
    DOC_PATH.parent.mkdir(parents=True, exist_ok=True)
    DOC_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"doc={rel(DOC_PATH)}")


def verify_assets() -> dict[str, Any]:
    data = load_jobs()
    failures: list[str] = []
    pngs = 0
    counts: dict[str, int] = {}
    for job in data["jobs"]:
        status = job.get("status", "unknown")
        counts[status] = counts.get(status, 0) + 1
        if status not in {"completed", "review"}:
            failures.append(f"{job['job_key']} status={status}")
        images = job.get("local_images", []) or []
        pngs += len(images)
        if not images:
            failures.append(f"{job['job_key']} has no local PNGs")
        if job.get("asset_type") == "object_animation" and len(images) < int(job.get("frame_count") or 4):
            failures.append(f"{job['job_key']} animation has {len(images)} PNGs, expected >= {job.get('frame_count')}")
        for img in images:
            p = ROOT / img["local_path"]
            if not p.exists():
                failures.append(f"missing {img['local_path']}")
                continue
            try:
                with Image.open(p) as opened:
                    if opened.width != img["width"] or opened.height != img["height"]:
                        failures.append(f"dimension mismatch {img['local_path']}")
            except Exception as exc:
                failures.append(f"cannot open {img['local_path']}: {exc}")
    contact = data.get("contact_sheet")
    if not contact or not (ROOT / contact).exists():
        failures.append("contact sheet missing")
    if not RUNTIME_MANIFEST_PATH.exists():
        failures.append("runtime manifest missing")
    return {"jobs": len(data["jobs"]), "counts": counts, "pngs": pngs, "failures": failures}


def print_summary() -> None:
    data = load_jobs()
    counts: dict[str, int] = {}
    pngs = 0
    by_type: dict[str, int] = {}
    for job in data["jobs"]:
        counts[job.get("status", "unknown")] = counts.get(job.get("status", "unknown"), 0) + 1
        by_type[job.get("asset_type", "unknown")] = by_type.get(job.get("asset_type", "unknown"), 0) + 1
        pngs += len(job.get("local_images", []) or [])
    print(json.dumps({
        "jobs": len(data["jobs"]),
        "counts": counts,
        "by_type": by_type,
        "pngs": pngs,
        "contact_sheet": data.get("contact_sheet"),
        "runtime_manifest": rel(RUNTIME_MANIFEST_PATH) if RUNTIME_MANIFEST_PATH.exists() else None,
        "doc": rel(DOC_PATH) if DOC_PATH.exists() else None,
    }, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["queue-base", "queue-animations", "poll", "poll-until", "contact-sheet", "runtime-manifest", "doc", "package", "verify", "summary"])
    parser.add_argument("--timeout", type=int, default=720)
    parser.add_argument("--interval", type=int, default=30)
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    if args.command == "queue-base":
        asyncio.run(queue_jobs("base", args.limit))
    elif args.command == "queue-animations":
        asyncio.run(queue_jobs("animations", args.limit))
    elif args.command == "poll":
        asyncio.run(poll_once(download=True))
    elif args.command == "poll-until":
        asyncio.run(poll_until(args.timeout, args.interval))
    elif args.command == "contact-sheet":
        make_contact_sheet()
    elif args.command == "runtime-manifest":
        write_runtime_manifest()
    elif args.command == "doc":
        write_runtime_manifest()
        write_doc()
    elif args.command == "package":
        make_contact_sheet()
        write_runtime_manifest()
        write_doc()
    elif args.command == "verify":
        result = verify_assets()
        print(json.dumps(result, indent=2))
        if result["failures"]:
            raise SystemExit(1)
    elif args.command == "summary":
        print_summary()


if __name__ == "__main__":
    main()

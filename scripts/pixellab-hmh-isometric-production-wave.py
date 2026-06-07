#!/usr/bin/env python
"""Queue, collect, and package PixelLab production assets for the HMH isometric pivot.

This script intentionally reads the PixelLab MCP auth from the local Claude config
but never writes auth values into manifests/logs.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import re
import sys
import time
import urllib.parse
import urllib.request
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    from PIL import Image, ImageDraw, ImageFont
except Exception as exc:  # pragma: no cover - local tooling guard
    raise SystemExit(f"Pillow is required for contact sheets: {exc}")

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_ROOT = Path("apps/portal/assets/generated/hmh-isometric-pixellab")
OUT_ROOT = ROOT / PUBLIC_ROOT
JOBS_PATH = OUT_ROOT / "pixellab-isometric-wave-1-jobs.json"
RAW_DIR = OUT_ROOT / "raw-tool-output"
CONTACT_DIR = OUT_ROOT / "contact-sheets"
RUNTIME_MANIFEST_PATH = OUT_ROOT / "hmh-isometric-pixellab-wave-1.mjs"
DOC_PATH = ROOT / "docs/game-design/hard-money-heroes-pixellab-isometric-production-wave-1.md"

DIRECTIONS_8 = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"]
NO_TEXT = "no words, no letters, no numbers, no readable labels, no logos, no watermark, transparent background"
STYLE = "isometric low top-down pixel art, retro 80s/90s arcade, crisp silhouettes, limited SNES/Neo-Geo palette, dark neon Litecoin City After Dark mood, blue silver crypto energy accents without official logos"

UUID_RE = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")
URL_RE = re.compile(r"https?://[^\s,)\]>'\"]+")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def slugify(text: str) -> str:
    text = text.lower().replace("&", "and")
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text[:80] or "asset"


CHARACTERS: list[dict[str, Any]] = [
    {
        "slug": "lester-iso-hero",
        "name": "Lester Isometric Hero",
        "role": "hero",
        "description": f"Lester, stubborn Rambo-like arcade action hero with black cap, dark jacket, blue/silver hard-money highlights, compact readable run-and-gun silhouette, holding a chunky sci-fi blaster at low ready; {STYLE}; {NO_TEXT}",
        "size": 72,
        "proportions": {"type": "preset", "name": "stylized"},
    },
    {
        "slug": "lilly-iso-alt-hero",
        "name": "Lilly Isometric Alt Hero",
        "role": "hero_alt",
        "description": f"Lilly, agile alternate hero/skin for Hard Money Heroes, confident arcade fighter with ponytail or short hair, teal/purple jacket accents, compact run-and-gun silhouette, small blaster at low ready; {STYLE}; {NO_TEXT}",
        "size": 70,
        "proportions": {"type": "preset", "name": "stylized"},
    },
    {
        "slug": "trench-degen-chaser",
        "name": "Trench Degen Chaser",
        "role": "enemy_chaser",
        "description": f"feral crypto trench degen chaser enemy, ragged hoodie, glowing scam-phone, hunched aggressive run pose, fast fragile silhouette; {STYLE}; {NO_TEXT}",
        "size": 64,
        "proportions": {"type": "preset", "name": "cartoon"},
    },
    {
        "slug": "evil-banker-ranged",
        "name": "Evil Banker Ranged Shooter",
        "role": "enemy_ranged",
        "description": f"evil banker ranged shooter enemy, suit, red tie, briefcase blaster, slick hair, readable stop-and-shoot silhouette, satirical but original; {STYLE}; {NO_TEXT}",
        "size": 66,
        "proportions": {"type": "preset", "name": "stylized"},
    },
    {
        "slug": "crypto-bro-rusher",
        "name": "Crypto Bro Rusher",
        "role": "enemy_rusher",
        "description": f"flashy crypto bro rusher enemy, sleeveless vest, sunglasses, energy sneakers, fast fragile charging silhouette, original parody; {STYLE}; {NO_TEXT}",
        "size": 64,
        "proportions": {"type": "preset", "name": "cartoon"},
    },
    {
        "slug": "gas-beast-tank",
        "name": "Gas Beast Tank",
        "role": "enemy_tank",
        "description": f"bulky gas beast tank enemy, ogre-like mutant made of metal pipes and fumes, slow heavy silhouette, glowing furnace belly, no gore; {STYLE}; {NO_TEXT}",
        "size": 84,
        "proportions": {"type": "preset", "name": "heroic"},
    },
    {
        "slug": "rugpull-summoner",
        "name": "Rugpull Summoner",
        "role": "enemy_summoner",
        "description": f"rugpull summoner enemy, robed scam wizard with shredded contract scrolls and glowing portal device, creates minions, clear caster silhouette; {STYLE}; {NO_TEXT}",
        "size": 70,
        "proportions": {"type": "preset", "name": "stylized"},
    },
    {
        "slug": "warren-spear-rider-miniboss",
        "name": "Warren Spear Rider Mini Boss",
        "role": "mini_boss",
        "description": f"Warren Spear Rider mini-boss, armored boar-rider or hover-spear raider, big spear, aggressive charge silhouette, original boss parody without brand marks; {STYLE}; {NO_TEXT}",
        "size": 96,
        "proportions": {"type": "preset", "name": "heroic"},
    },
    {
        "slug": "bit-whale-boss",
        "name": "Bit Whale Boss",
        "role": "boss",
        "description": f"massive Bit Whale boss, humanoid whale tycoon in armored suit with coin cannons, huge readable boss silhouette for isometric arena survival, original crypto satire; {STYLE}; {NO_TEXT}",
        "size": 112,
        "proportions": {"type": "preset", "name": "heroic"},
    },
    {
        "slug": "chain-reaper-boss",
        "name": "Chain Reaper Boss",
        "role": "boss",
        "description": f"Chain Reaper boss, skeletal arcade mech with chain-scythe and blue energy core, intimidating but cartoony, clear telegraph silhouette, no gore; {STYLE}; {NO_TEXT}",
        "size": 112,
        "proportions": {"type": "preset", "name": "heroic"},
    },
]

TILES: list[dict[str, Any]] = [
    ("asphalt-street", "cracked wet asphalt street tile with subtle blue neon reflections"),
    ("sidewalk-concrete", "worn city sidewalk concrete tile with grime, small cracks, curb-readable edge texture"),
    ("alley-floor", "dark alley floor tile with oil stains, small puddles, gritty pavement"),
    ("foundry-metal-floor", "industrial foundry diamond-plate metal floor tile with warm orange rim light"),
    ("rooftop-tar", "flat rooftop tar paper tile with vents grime and rain sheen"),
    ("financial-plaza", "financial district plaza stone tile, clean cold marble, subtle blue reflection"),
    ("sewer-grate", "street sewer grate tile inset in asphalt, readable metal grid"),
    ("neon-puddle", "wet road puddle hazard tile with electric blue reflection"),
    ("curb-edge", "raised curb edge collision tile, sidewalk meeting street"),
    ("chainlink-footprint", "chain-link fence base collision tile with concrete posts"),
    ("stairs-ramp", "small isometric stair ramp tile for street-to-sidewalk height transition"),
    ("road-marking", "asphalt tile with a single clean lane marking stripe, no letters or symbols"),
]
TILES = [{"slug": s, "name": s.replace("-", " ").title(), "description": f"{d}; {STYLE}; seamless isometric tile, {NO_TEXT}"} for s, d in TILES]

OBJECTS: list[dict[str, Any]] = [
    ("dumpster", "rusty city dumpster prop with openable lid", 96, 80, "prop_collision"),
    ("garbage-can", "metal garbage can prop with dented lid", 64, 72, "prop_collision"),
    ("wood-crate", "stackable wooden crate prop with hard corners", 64, 64, "prop_collision"),
    ("streetlight", "bent streetlight prop with cyan neon glow", 64, 128, "prop_occluder"),
    ("traffic-barricade", "orange and black traffic barricade prop", 96, 64, "prop_collision"),
    ("blank-neon-sign", "blank neon sign frame prop, glowing border but absolutely no text", 128, 80, "prop_decor"),
    ("terminal-kiosk", "futuristic payment terminal kiosk prop with blank dark screen, no symbols", 80, 96, "prop_interactive"),
    ("vending-machine", "retro vending machine prop with blank front panel and neon trim, no text", 80, 128, "prop_collision"),
    ("dead-urban-tree", "leafless urban tree in square planter prop", 96, 128, "prop_occluder"),
    ("cyber-palm-tree", "small cyberpunk palm tree with planter and blue uplight", 96, 144, "prop_occluder"),
    ("broken-car", "abandoned compact car prop, no license plate text, readable collision footprint", 160, 96, "prop_collision"),
    ("explosive-barrel", "red-orange explosive barrel prop with no markings", 64, 80, "prop_hazard"),
    ("xp-shard", "floating blue silver XP shard pickup, diamond crystal", 48, 48, "pickup"),
    ("health-pack", "health pickup with green glow, simple plus-like shape but no readable text", 56, 56, "pickup"),
    ("ammo-pack", "ammo pickup crate with blue glow, no letters or labels", 56, 56, "pickup"),
    ("crypto-bomb", "round crypto bomb pickup, fuse and blue energy cracks, no logo", 56, 56, "pickup"),
    ("muzzle-flash", "bright yellow-blue muzzle flash VFX starburst", 64, 64, "vfx"),
    ("impact-sparks", "orange blue pixel impact sparks VFX burst", 64, 64, "vfx"),
    ("projectile-trail", "short blue silver projectile trail VFX", 96, 48, "vfx"),
    ("level-up-burst", "circular pixel level-up burst VFX with rays and particles", 128, 128, "vfx"),
    ("boss-telegraph-ring", "transparent red-orange isometric warning telegraph ring VFX", 160, 96, "vfx"),
    ("upgrade-card-frame", "blank roguelike upgrade card UI frame with neon border and empty dark center", 160, 224, "ui"),
    ("level-up-modal-frame", "large blank level-up modal UI frame with two empty card slots and neon border, no text", 320, 224, "ui"),
    ("reroll-button-frame", "small blank reroll button UI frame, no text", 128, 64, "ui"),
    ("mobile-joystick-ring", "transparent mobile virtual joystick ring and thumbstick UI control", 128, 128, "mobile_ui"),
    ("mobile-fire-button", "transparent mobile fire button circle UI control with blaster icon shape only", 128, 128, "mobile_ui"),
    ("xp-bar-frame", "long blank XP bar UI frame with neon border and empty center", 320, 48, "ui"),
]
OBJECTS = [{"slug": s, "name": s.replace("-", " ").title(), "description": f"{d}; {STYLE}; {NO_TEXT}", "width": w, "height": h, "role": r} for s, d, w, h, r in OBJECTS]

ROTATING_OBJECTS: list[dict[str, Any]] = [
    {
        "slug": "hard-money-heroes-arcade-cabinet-8dir",
        "name": "Hard Money Heroes Arcade Cabinet 8 Direction",
        "role": "arcade_cabinet",
        "description": f"upright retro arcade cabinet prop for Hard Money Heroes with blank marquee and blank screen border, chunky coin-op shape, neon blue orange trim, no readable labels, no logos; {STYLE}; transparent background",
        "size": 160,
    },
    {
        "slug": "loot-crate-8dir",
        "name": "Roguelike Loot Crate 8 Direction",
        "role": "pickup_container",
        "description": f"glowing loot crate chest for roguelike upgrades, metal box with blue silver energy seam, no symbols or labels; {STYLE}; transparent background",
        "size": 96,
    },
]


def base_jobs() -> list[dict[str, Any]]:
    jobs: list[dict[str, Any]] = []
    for spec in CHARACTERS:
        jobs.append({
            "job_key": f"character:{spec['slug']}",
            "asset_type": "character",
            "slug": spec["slug"],
            "name": spec["name"],
            "role": spec["role"],
            "tool": "create_character",
            "get_tool": "get_character",
            "id_field": "character_id",
            "args": {
                "description": spec["description"],
                "name": f"HMH ISO {spec['name']}",
                "body_type": "humanoid",
                "mode": "standard",
                "n_directions": 8,
                "proportions": json.dumps(spec["proportions"]),
                "size": spec["size"],
                "outline": "single color black outline",
                "shading": "basic shading",
                "detail": "medium detail",
                "text_guidance_scale": 10.5,
                "view": "low top-down",
            },
        })
    for spec in TILES:
        jobs.append({
            "job_key": f"tile:{spec['slug']}",
            "asset_type": "isometric_tile",
            "slug": spec["slug"],
            "name": spec["name"],
            "role": "tile",
            "tool": "create_isometric_tile",
            "get_tool": "get_isometric_tile",
            "id_field": "tile_id",
            "args": {
                "description": spec["description"],
                "size": 48,
                "tile_shape": "thin tile",
                "outline": "selective outline",
                "shading": "medium shading",
                "detail": "medium detail",
                "text_guidance_scale": 10.0,
            },
        })
    for spec in OBJECTS:
        jobs.append({
            "job_key": f"map_object:{spec['slug']}",
            "asset_type": "map_object",
            "slug": spec["slug"],
            "name": spec["name"],
            "role": spec["role"],
            "tool": "create_map_object",
            "get_tool": "get_map_object",
            "id_field": "object_id",
            "args": {
                "description": spec["description"],
                "width": spec["width"],
                "height": spec["height"],
                "view": "low top-down",
                "outline": "selective outline",
                "shading": "medium shading",
                "detail": "medium detail",
            },
        })
    for spec in ROTATING_OBJECTS:
        jobs.append({
            "job_key": f"object8:{spec['slug']}",
            "asset_type": "rotating_object",
            "slug": spec["slug"],
            "name": spec["name"],
            "role": spec["role"],
            "tool": "create_8_direction_object",
            "get_tool": "get_object",
            "id_field": "object_id",
            "args": {
                "description": spec["description"],
                "size": spec["size"],
                "view": "low top-down",
            },
        })
    return jobs


ANIMATION_SPECS = [
    {"slug": "idle", "animation_name": "iso-idle-ready", "frame_count": 8, "description": "idle combat-ready breathing stance, weapon steady, feet planted, loopable"},
    {"slug": "run", "animation_name": "iso-run", "frame_count": 8, "description": "running movement loop, arcade run-and-gun footwork, loopable"},
    {"slug": "shoot", "animation_name": "iso-aim-shoot", "frame_count": 8, "description": "aiming and firing a compact blaster with small muzzle recoil, loopable short action"},
]
ENEMY_ANIMATION_SPECS = [
    {"slug": "idle", "animation_name": "iso-idle", "frame_count": 6, "description": "idle threatening stance, loopable"},
    {"slug": "move", "animation_name": "iso-move", "frame_count": 8, "description": "moving toward the player, readable enemy locomotion loop"},
    {"slug": "attack", "animation_name": "iso-attack", "frame_count": 8, "description": "clear attack telegraph and strike or shot, readable arcade enemy attack"},
]


def animation_jobs(existing: list[dict[str, Any]]) -> list[dict[str, Any]]:
    completed_chars = {j["slug"]: j for j in existing if j.get("asset_type") == "character" and j.get("status") == "completed" and j.get("id")}
    wanted = []
    for slug in ["lester-iso-hero", "lilly-iso-alt-hero"]:
        char = completed_chars.get(slug)
        if not char:
            continue
        for spec in ANIMATION_SPECS:
            wanted.append({
                "job_key": f"animation:{slug}:{spec['slug']}",
                "asset_type": "character_animation",
                "parent_slug": slug,
                "slug": f"{slug}-{spec['slug']}",
                "name": f"{char['name']} {spec['animation_name']}",
                "role": "hero_animation",
                "tool": "animate_character",
                "get_tool": "get_character",
                "id_field": "character_id",
                "parent_id": char["id"],
                "args": {
                    "character_id": char["id"],
                    "action_description": spec["description"],
                    "animation_name": spec["animation_name"],
                    "directions": DIRECTIONS_8,
                    "mode": "v3",
                    "frame_count": spec["frame_count"],
                },
            })
    for slug in ["trench-degen-chaser", "evil-banker-ranged", "crypto-bro-rusher", "gas-beast-tank"]:
        char = completed_chars.get(slug)
        if not char:
            continue
        for spec in ENEMY_ANIMATION_SPECS:
            wanted.append({
                "job_key": f"animation:{slug}:{spec['slug']}",
                "asset_type": "character_animation",
                "parent_slug": slug,
                "slug": f"{slug}-{spec['slug']}",
                "name": f"{char['name']} {spec['animation_name']}",
                "role": "enemy_animation",
                "tool": "animate_character",
                "get_tool": "get_character",
                "id_field": "character_id",
                "parent_id": char["id"],
                "args": {
                    "character_id": char["id"],
                    "action_description": spec["description"],
                    "animation_name": spec["animation_name"],
                    "directions": DIRECTIONS_8,
                    "mode": "v3",
                    "frame_count": spec["frame_count"],
                },
            })
    return wanted


def load_jobs() -> dict[str, Any]:
    if JOBS_PATH.exists():
        return json.loads(JOBS_PATH.read_text(encoding="utf-8"))
    return {
        "source": "PixelLab MCP/API",
        "project": "Lester's Arcade / Hard Money Heroes",
        "pack": "isometric-production-wave-1",
        "public_root": PUBLIC_ROOT.as_posix(),
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "jobs": [],
    }


def save_jobs(data: dict[str, Any]) -> None:
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    data["updated_at"] = now_iso()
    JOBS_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")


def result_text(result: Any) -> str:
    pieces = []
    for content in getattr(result, "content", []) or []:
        pieces.append(getattr(content, "text", str(content)))
    return "\n".join(pieces)


def status_from_text(text: str) -> str:
    low = text.lower()
    m = re.search(r"status:\s*([a-z_-]+)", low)
    if m:
        return m.group(1)
    if "completed" in low and ("download" in low or "https://" in low):
        return "completed"
    if "failed" in low or "error" in low:
        return "failed"
    if "processing" in low or "progress" in low or "queued" in low:
        return "processing"
    return "unknown"


def first_uuid(text: str) -> str | None:
    m = UUID_RE.search(text)
    return m.group(0) if m else None


def extract_urls(text: str) -> list[str]:
    seen = set()
    out = []
    for url in URL_RE.findall(text):
        url = url.rstrip(".,")
        if url not in seen:
            seen.add(url)
            out.append(url)
    return out


def load_pixellab_server() -> dict[str, Any]:
    p = Path.home() / ".claude.json"
    data = json.loads(p.read_text(encoding="utf-8"))
    projects = data.get("projects", {})
    home_variants = {
        str(Path.home()),
        str(Path.home()).replace("\\", "/"),
        str(Path.home()).replace("/", "\\"),
    }
    for project_key in home_variants:
        server = projects.get(project_key, {}).get("mcpServers", {}).get("pixellab")
        if server:
            return server
    for project in projects.values():
        server = project.get("mcpServers", {}).get("pixellab")
        if server:
            return server
    raise SystemExit(f"Could not locate PixelLab MCP config in {p}")


async def with_session():
    server = load_pixellab_server()
    return streamablehttp_client(server["url"], headers=server.get("headers", {}))


async def queue_jobs(kind: str, limit: int | None = None) -> None:
    data = load_jobs()
    existing_by_key = {job["job_key"]: job for job in data["jobs"]}
    specs = base_jobs() if kind == "base" else animation_jobs(data["jobs"])
    if not specs:
        print(f"No {kind} jobs ready to queue.")
        return
    server = load_pixellab_server()
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            queued = 0
            skipped = 0
            for spec in specs:
                existing = existing_by_key.get(spec["job_key"])
                if existing and existing.get("status") not in {"failed", "rate_limited"}:
                    skipped += 1
                    continue
                if limit is not None and queued >= limit:
                    break
                print(f"queue {spec['tool']} :: {spec['job_key']}")
                result = await session.call_tool(spec["tool"], spec["args"])
                text = result_text(result)
                ident = first_uuid(text)
                job = {k: v for k, v in spec.items() if k != "args"}
                job["args"] = spec["args"]
                job["id"] = ident
                job["queued_at"] = now_iso()
                job["status"] = status_from_text(text)
                job["raw_queue_response"] = text[:5000]
                # Replace a failed/rate-limited prior attempt for the same key instead of appending duplicates.
                if existing and existing.get("status") in {"failed", "rate_limited"}:
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
                # PixelLab enforces a small active-job pool; queue in explicit waves.
                await asyncio.sleep(0.75)
            print(f"queued={queued} skipped={skipped} total_jobs={len(data['jobs'])}")


async def poll_once(download: bool = True) -> None:
    data = load_jobs()
    server = load_pixellab_server()
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            counts: dict[str, int] = {}
            for job in data["jobs"]:
                ident = job.get("id") or job.get("parent_id")
                if not ident:
                    counts["missing_id"] = counts.get("missing_id", 0) + 1
                    continue
                if job.get("asset_type") == "character_animation":
                    # Animations attach to parent character; poll parent details.
                    args = {"character_id": ident, "include_preview": False}
                elif job.get("id_field") == "character_id":
                    args = {"character_id": ident, "include_preview": False}
                elif job.get("id_field") == "tile_id":
                    args = {"tile_id": ident}
                elif job.get("get_tool") == "get_map_object":
                    args = {"object_id": ident}
                else:
                    args = {"object_id": ident, "include_preview": False}
                result = await session.call_tool(job["get_tool"], args)
                text = result_text(result)
                status = status_from_text(text)
                job["status"] = status
                job["last_polled_at"] = now_iso()
                urls = extract_urls(text)
                job["urls"] = urls
                (RAW_DIR / f"{job['job_key'].replace(':','__')}.txt").write_text(text, encoding="utf-8")
                if download and status in {"completed", "review"}:
                    download_job_assets(job, text, server.get("headers", {}))
                counts[status] = counts.get(status, 0) + 1
                await asyncio.sleep(0.15)
            save_jobs(data)
            print("poll", counts)


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
    req_headers = {}
    if "api.pixellab.ai" in url and headers.get("Authorization"):
        req_headers["Authorization"] = headers["Authorization"]
    req = urllib.request.Request(url, headers=req_headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            dest.write_bytes(response.read())
        return True
    except Exception as exc:
        dest.with_suffix(dest.suffix + ".error.txt").write_text(str(exc), encoding="utf-8")
        return False


def download_job_assets(job: dict[str, Any], text: str, headers: dict[str, str]) -> None:
    asset_dir = OUT_ROOT / job["asset_type"] / job["slug"]
    urls = extract_urls(text)
    downloads: list[dict[str, Any]] = []
    for idx, url in enumerate(urls):
        lower = url.lower()
        if not any(token in lower for token in [".png", ".jpg", ".jpeg", ".webp", "/download", ".zip"]):
            continue
        suffix = ".zip" if "/download" in lower or lower.endswith(".zip") else Path(urllib.parse.urlparse(url).path).suffix or ".bin"
        name = safe_filename_from_url(url, idx)
        if "/download" in lower and not name.endswith(".zip"):
            name += ".zip"
        dest = asset_dir / "downloads" / name
        ok = download_url(url, dest, headers)
        record = {"url": url, "local_path": rel(dest), "ok": ok}
        if ok:
            signature = dest.read_bytes()[:16]
            if signature.startswith(b"\x89PNG\r\n\x1a\n") and dest.suffix.lower() != ".png":
                png_dest = dest.with_suffix(".png")
                if png_dest.exists():
                    try:
                        png_dest.unlink()
                    except PermissionError:
                        png_dest = dest.with_name(f"{dest.stem}-{int(time.time())}.png")
                dest.rename(png_dest)
                dest = png_dest
                record["local_path"] = rel(dest)
                record["detected_format"] = "png"
            elif signature[:2] == b"\xff\xd8" and dest.suffix.lower() not in {".jpg", ".jpeg"}:
                jpg_dest = dest.with_suffix(".jpg")
                if jpg_dest.exists():
                    try:
                        jpg_dest.unlink()
                    except PermissionError:
                        jpg_dest = dest.with_name(f"{dest.stem}-{int(time.time())}.jpg")
                dest.rename(jpg_dest)
                dest = jpg_dest
                record["local_path"] = rel(dest)
                record["detected_format"] = "jpg"
        if ok and dest.suffix.lower() == ".zip":
            extract_dir = asset_dir / "extracted" / dest.stem
            try:
                with zipfile.ZipFile(dest) as zf:
                    zf.extractall(extract_dir)
                record["extracted_to"] = rel(extract_dir)
            except Exception as exc:
                record["extract_error"] = str(exc)
        downloads.append(record)
    job["downloads"] = downloads
    # image metadata for all local PNGs in this asset dir
    images = []
    for p in sorted(asset_dir.rglob("*.png")):
        try:
            with Image.open(p) as im:
                images.append({"local_path": rel(p), "width": im.width, "height": im.height, "mode": im.mode, "bytes": p.stat().st_size})
        except Exception:
            pass
    job["local_images"] = images


def rel(path: Path) -> str:
    try:
        return path.resolve().relative_to(ROOT).as_posix()
    except Exception:
        return path.as_posix()


def make_contact_sheet() -> None:
    data = load_jobs()
    CONTACT_DIR.mkdir(parents=True, exist_ok=True)
    tiles = []
    for job in data["jobs"]:
        imgs = [ROOT / img["local_path"] for img in job.get("local_images", []) if (ROOT / img["local_path"]).exists()]
        if not imgs:
            continue
        # Up to 8 examples per asset so the overview remains readable.
        for img in imgs[:8]:
            tiles.append((job["slug"], job.get("asset_type", "asset"), img))
    if not tiles:
        print("No local PNGs available for contact sheet yet.")
        return
    thumb_w, thumb_h = 104, 104
    label_h = 38
    pad = 10
    cols = 6
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (thumb_w + pad) + pad, rows * (thumb_h + label_h + pad) + pad), (18, 18, 28))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("arial.ttf", 10)
        title_font = ImageFont.truetype("arial.ttf", 12)
    except Exception:
        font = ImageFont.load_default()
        title_font = font
    for idx, (slug, typ, path) in enumerate(tiles):
        col = idx % cols
        row = idx // cols
        x = pad + col * (thumb_w + pad)
        y = pad + row * (thumb_h + label_h + pad)
        try:
            with Image.open(path) as opened:
                im = opened.convert("RGBA")
            im.thumbnail((thumb_w, thumb_h), Image.Resampling.NEAREST)
            bg = Image.new("RGBA", (thumb_w, thumb_h), (34, 34, 48, 255))
            bg.alpha_composite(im, ((thumb_w - im.width)//2, (thumb_h - im.height)//2))
            sheet.paste(bg.convert("RGB"), (x, y))
        except Exception:
            draw.rectangle([x, y, x+thumb_w, y+thumb_h], outline=(255,0,0))
        label = f"{typ}\n{slug[:24]}"
        draw.multiline_text((x, y + thumb_h + 3), label, fill=(235, 235, 245), font=font, spacing=1)
    out = CONTACT_DIR / "hmh-isometric-pixellab-wave-1-contact-sheet.png"
    sheet.save(out)
    data["contact_sheet"] = rel(out)
    save_jobs(data)
    print(f"contact_sheet={rel(out)} tiles={len(tiles)}")


def write_runtime_manifest() -> None:
    data = load_jobs()
    assets = []
    for job in data["jobs"]:
        images = job.get("local_images", [])
        if not images:
            continue
        assets.append({
            "jobKey": job["job_key"],
            "assetType": job.get("asset_type"),
            "slug": job["slug"],
            "name": job.get("name"),
            "role": job.get("role"),
            "status": job.get("status"),
            "id": job.get("id") or job.get("parent_id"),
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
    RUNTIME_MANIFEST_PATH.write_text("export const HMH_ISOMETRIC_PIXELLAB_WAVE_1 = Object.freeze(" + json.dumps(payload, indent=2) + ");\n", encoding="utf-8")
    print(f"runtime_manifest={rel(RUNTIME_MANIFEST_PATH)} assets={len(assets)}")


def write_doc() -> None:
    data = load_jobs()
    counts: dict[str, int] = {}
    local_pngs = 0
    for job in data["jobs"]:
        counts[job.get("status", "unknown")] = counts.get(job.get("status", "unknown"), 0) + 1
        local_pngs += len(job.get("local_images", []))
    lines = [
        "# Hard Money Heroes — PixelLab Isometric Production Wave 1",
        "",
        f"Generated/updated: {now_iso()}",
        "",
        "## Scope",
        "",
        "This wave begins the approved PixelLab production batch for the isometric roguelike pivot: 8-direction actors, first environment tiles, props, pickups, VFX, UI controls, mobile controls, and extra rotating cabinet/loot objects.",
        "",
        "## Current status",
        "",
        f"- Jobs manifest: `{rel(JOBS_PATH)}`",
        f"- Runtime manifest: `{rel(RUNTIME_MANIFEST_PATH)}`",
        f"- Contact sheet: `{data.get('contact_sheet', 'pending')}`",
        f"- Job counts: `{json.dumps(counts, sort_keys=True)}`",
        f"- Local PNG count discovered: `{local_pngs}`",
        "",
        "## QA rules",
        "",
        "- Reject or re-prompt assets with pseudo-text, logos, watermarks, bad silhouettes, or unusable scale.",
        "- Treat this as production-source material, not final shipping art, until sliced/anchored/hitboxed and smoke-tested in the isometric renderer.",
        "- No API keys or auth headers are stored in this doc or manifests.",
        "",
        "## Assets",
        "",
    ]
    for job in data["jobs"]:
        lines.append(f"- `{job['job_key']}` — {job.get('status','unknown')} — {len(job.get('local_images', []))} PNG(s)")
    DOC_PATH.parent.mkdir(parents=True, exist_ok=True)
    DOC_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"doc={rel(DOC_PATH)}")


async def poll_until(timeout_s: int, interval_s: int) -> None:
    deadline = time.time() + timeout_s
    while True:
        await poll_once(download=True)
        data = load_jobs()
        incomplete = [j for j in data["jobs"] if j.get("status") not in {"completed", "failed", "review"}]
        if not incomplete:
            break
        if time.time() >= deadline:
            print(f"poll timeout with incomplete={len(incomplete)}")
            break
        print(f"waiting {interval_s}s for incomplete={len(incomplete)}")
        await asyncio.sleep(interval_s)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["queue-base", "queue-animations", "poll", "poll-until", "contact-sheet", "runtime-manifest", "doc", "package", "summary"])
    parser.add_argument("--timeout", type=int, default=540)
    parser.add_argument("--interval", type=int, default=30)
    parser.add_argument("--limit", type=int, default=None, help="Maximum number of new jobs to queue in this run")
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
    elif args.command == "summary":
        data = load_jobs()
        counts: dict[str, int] = {}
        pngs = 0
        for job in data["jobs"]:
            counts[job.get("status", "unknown")] = counts.get(job.get("status", "unknown"), 0) + 1
            pngs += len(job.get("local_images", []))
        print(json.dumps({"jobs": len(data["jobs"]), "counts": counts, "pngs": pngs, "contact_sheet": data.get("contact_sheet")}, indent=2))


if __name__ == "__main__":
    main()

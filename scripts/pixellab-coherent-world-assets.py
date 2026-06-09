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
import asyncio, json, re, sys, time, zipfile, io
from pathlib import Path
from typing import Any, Literal

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "apps/portal/assets/generated/hmh-coherent-world"
LEDGER = OUT_DIR / "coherent-world-ledger.json"
UUID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")

AssetStatus = Literal["not_started", "processing_create", "failed_create", "created", "downloaded", # For static assets
                      "processing_animate", "failed_animate", "animated"] # For animated assets

# Each spec: (set, slug, w, h, description, animated:bool, frame_count:int|None).
# `view` is always "high top-down".
SPECS = [
    # ---- STREET SET ----
    ("street", "street-lamp", 48, 96, "isometric retro street lamp post, dark metal pole, glowing warm lantern head, pixel art", False, None),
    ("street", "fire-hydrant", 40, 48, "isometric red fire hydrant, chunky pixel art, transparent", False, None),
    ("street", "park-bench", 64, 48, "isometric wooden park bench with metal frame, pixel art", False, None),
    ("street", "mailbox", 40, 56, "isometric blue street mailbox on a post, pixel art", False, None),
    ("street", "trash-can", 40, 48, "isometric metal city trash can with lid, pixel art", False, None),
    ("street", "traffic-cone", 32, 40, "isometric orange traffic cone, pixel art", False, None),
    ("street", "bus-stop-sign", 40, 72, "isometric bus stop sign on a thin pole, pixel art", False, None),
    # ---- INTERIOR SET (arcade) ----
    ("interior", "arcade-cabinet", 48, 80, "isometric retro arcade cabinet machine with glowing screen, pixel art", True, 6), # Animated
    ("interior", "soda-machine", 48, 80, "isometric red soda vending machine, glowing front panel, pixel art", False, None),
    ("interior", "tv-on-table", 56, 64, "isometric old CRT television sitting on a low wooden entertainment center table, pixel art", False, None),
    ("interior", "stacked-boxes", 56, 56, "isometric stack of cardboard moving boxes, pixel art", False, None),
    ("interior", "wooden-crate", 40, 40, "isometric wooden shipping crate, pixel art", False, None),
    ("interior", "shop-counter", 64, 48, "isometric wooden shop counter desk, pixel art", False, None),
    ("interior", "table-plain", 48, 40, "isometric small wooden table, pixel art", False, None),
    # ---- PARK / FOREST SET ----
    ("nature", "pine-tree", 56, 96, "isometric tall green pine tree, pixel art, transparent", False, None),
    ("nature", "oak-tree", 64, 88, "isometric round leafy oak tree, pixel art, transparent", False, None),
    ("nature", "bush", 40, 40, "isometric small green round bush, pixel art", False, None),
    ("nature", "flower-patch", 40, 32, "isometric small patch of wildflowers in grass, pixel art", False, None),
    ("nature", "fallen-log", 56, 36, "isometric mossy fallen log, pixel art", False, None),
    ("nature", "boulder", 48, 48, "isometric grey rocky boulder, pixel art", False, None),
    ("nature", "fountain", 72, 72, "isometric round stone park fountain with water, pixel art", True, 8),
    # ---- CONSTRUCTIVE / TILING ----
    ("construct", "fence-segment", 48, 40, "isometric wooden fence segment, single straight panel, pixel art", False, None),
    ("construct", "fence-post", 32, 48, "isometric single wooden fence post, pixel art", False, None),
    ("construct", "fence-gate", 48, 44, "isometric wooden fence gate, pixel art", False, None),
    ("construct", "brick-wall-segment", 48, 48, "isometric grey brick wall segment, straight, pixel art", False, None),
    ("construct", "brick-wall-corner", 48, 48, "isometric grey brick wall corner piece, pixel art", False, None),
    ("construct", "low-stone-wall", 48, 32, "isometric low grey stone wall segment, pixel art", False, None),
    ("construct", "river-straight", 64, 48, "isometric straight river water segment with banks, pixel art", False, None),
    ("construct", "river-bend", 64, 64, "isometric bending river water segment with banks, pixel art", False, None),
    ("construct", "wood-bridge", 64, 40, "isometric wooden plank bridge over water, pixel art", False, None),
]


def load_pixellab_server() -> dict:
    # Look for the PixelLab config in ~/.claude.json first (user's primary config)
    p_user = Path.home() / ".claude.json"
    if p_user.exists():
        d = json.loads(p_user.read_text(encoding="utf-8"))
        for project in d.get("projects", {}).values():
            s = project.get("mcpServers", {}).get("pixellab")
            if s: return s
        s = d.get("mcpServers", {}).get("pixellab")
        if s: return s

    # Fallback for Hermes local mcp-config if not found in user's
    p_hermes = Path.home() / ".hermes" / "config" / "mcp-config.json"
    if p_hermes.exists():
        d_hermes = json.loads(p_hermes.read_text(encoding="utf-8"))
        s_hermes = d_hermes.get("mcpServers", {}).get("pixellab")
        if s_hermes: return s_hermes
    
    raise SystemExit(f"Could not locate PixelLab MCP config in {p_user} or {p_hermes}")


def txt(r) -> str:
    return "\n".join(c.text for c in getattr(r, "content", []) or [] if hasattr(c, "text"))


def load_ledger() -> dict:
    if LEDGER.exists():
        return json.loads(LEDGER.read_text(encoding="utf-8"))
    return {"jobs": {}}


def save_ledger(d: dict) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    LEDGER.write_text(json.dumps(d, indent=2), encoding="utf-8")


def get_job_base_info(spec_entry: tuple) -> tuple[str, str, int, int, str, bool, int | None]:
    # Ensure consistent unpacking regardless of animated status
    if len(spec_entry) == 7: # Animated
        return spec_entry
    else: # Static
        sset, slug, w, h, desc, animated = spec_entry
        return sset, slug, w, h, desc, animated, None


async def cmd_queue(active_cap: int = 4) -> None:
    server = load_pixellab_server()
    led = load_ledger()
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            queued_this_wave = 0
            for spec_entry in SPECS:
                sset, slug, w, h, desc, animated, frame_count = get_job_base_info(spec_entry)
                key = f"{sset}/{slug}"
                job = led["jobs"].get(key, {}) # Get existing job or create empty dict

                # --- Skip if already in final state ---
                if job.get("status") in {"downloaded", "downloaded_frames"}:
                    continue

                # --- Handle create_map_object ---
                if not job.get("id") or job.get("status") in {"failed_create", "processing_create"}:
                    if queued_this_wave >= active_cap:
                        break
                    
                    print(f"Queueing `create_map_object` for {key}")
                    r = await session.call_tool("create_map_object", {
                        "description": desc, "width": w, "height": h,
                        "view": "high top-down", "outline": "single color outline",
                        "shading": "basic shading", "detail": "medium detail",
                    })
                    t = txt(r)
                    ids = UUID_RE.findall(t)
                    
                    job.update({ # Update existing job entry or create new
                        "set": sset, "slug": slug, "w": w, "h": h,
                        "id": ids[0] if ids else None,
                        "status": "processing_create" if ids else "failed_create",
                        "raw_create_response": t[:5000],
                        "animated": animated,
                        "frame_count": frame_count,
                    })
                    led["jobs"][key] = job # Ensure it's in the ledger
                    save_ledger(led)
                    print(f"queued create_map_object {key} -> {ids[0] if ids else 'FAIL: ' + t[:120]}")
                    queued_this_wave += 1
                    await asyncio.sleep(1.0)
                
                # --- Handle animate_object if animated and create_map_object is done but animation not started/done ---
                if animated and job.get("id") and job.get("status") in {"created", "downloaded", "failed_animate", "processing_animate"}:
                    if job.get("status") in {"processing_animate", "failed_animate"} and job.get("animation_id"):
                        # If animation was previously queued, re-poll its status in cmd_poll
                        continue
                    if job.get("status") == "created" and not job.get("animation_id"): # Awaiting animation queuing
                         # If the main object is just created, we treat 'created' as a special status to await its animation queue.
                         # This allows the next `cmd_queue` call to actually queue the anim if it was missed.
                         pass
                    else: # Only queue if created status and no animation id, or if id exists and not already being processed
                        # We specifically only queue the animation if the object is created/downloaded and animation_id is not set.
                        # This prevents spamming animation requests.
                        continue


                    if queued_this_wave >= active_cap:
                        break
                    
                    print(f"Queueing `animate_object` for {key} (object_id: {job['id']})")
                    r_anim = await session.call_tool("animate_object", {
                        "object_id": job["id"],
                        "mode": "v3",
                        "animation_description": "water gently rippling and sparkling on the fountain, transparent" if slug == "fountain" else "glowing screen flickering with retro game pixels, transparent",
                        "frame_count": frame_count
                    })
                    t_anim = txt(r_anim)
                    ids_anim = UUID_RE.findall(t_anim)
                    job["animation_id"] = ids_anim[0] if ids_anim else None
                    job["status"] = "processing_animate" if ids_anim else "failed_animate"
                    job["raw_animation_response"] = t_anim[:5000]
                    save_ledger(led)
                    print(f"queued animate_object {key} -> {ids_anim[0] if ids_anim else 'FAIL: ' + t_anim[:120]}")
                    queued_this_wave += 1
                    await asyncio.sleep(1.0)

    print(f"queue done: {queued_this_wave} new today")


def download_asset_data(server: dict, oid: str, dest_base_path: Path, is_animated: bool = False) -> list[str] | str | None:
    import urllib.request
    url = f"https://api.pixellab.ai/mcp/objects/{oid}/download"
    req_headers = server["headers"].copy()
    if "Authorization" not in req_headers: # Ensure Authorization header is present
        req_headers["Authorization"] = ""
        # You might need to retrieve the bearer token from the client setup if it's not directly in server["headers"]
        # For now, assuming it's correctly accessible via server["headers"]

    req = urllib.request.Request(url, headers=req_headers)
    try:
        data = urllib.request.urlopen(req, timeout=120).read() # Increased timeout

        if is_animated:
            if data[:2] == b"PK": # ZIP signature for animations
                frame_output_dir = dest_base_path / "frames"
                if not frame_output_dir.exists():
                    frame_output_dir.mkdir(parents=True, exist_ok=True)
                
                downloaded_frame_paths = []
                with zipfile.ZipFile(io.BytesIO(data)) as z:
                    for frame_name in z.namelist():
                        if frame_name.lower().endswith(".png"):
                            frame_dest = frame_output_dir / frame_name
                            frame_dest.write_bytes(z.read(frame_name))
                            downloaded_frame_paths.append(str(frame_dest))
                return downloaded_frame_paths
            else:
                print(f"  Warning: Animated asset {oid} did not return a ZIP file.")
                return None # Indicate failure to download frames
        else: # Static asset, expect PNG
            if data[:8] == bytes.fromhex("89504e470d0a1a0a"): # PNG signature
                dest_base_path.parent.mkdir(parents=True, exist_ok=True) # Ensure parent dir exists
                dest_base_path.write_bytes(data)
                return str(dest_base_path)
            else:
                print(f"  Warning: Static asset {oid} did not return a PNG file.")
                return None # Indicate failure to download static asset
        
    except Exception as e:
        print(f"  Download error for {oid}: {type(e).__name__} {e}")
    return None


async def cmd_poll() -> None:
    server = load_pixellab_server()
    led = load_ledger()
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            for key, job in list(led["jobs"].items()):
                current_status = job.get("status", "not_started")
                job_id = job.get("id")
                animation_id = job.get("animation_id")
                is_animated = job.get("animated", False)

                if current_status in {"downloaded", "downloaded_frames"} or not job_id:
                    continue

                # --- Poll create_map_object status ---
                if current_status in {"not_started", "processing_create", "failed_create"} :
                    g = await session.call_tool("get_object", {"object_id": job_id})
                    gt = txt(g).lower()
                    if "completed" in gt or "status: completed" in gt:
                        if not is_animated: # Static asset, download it now
                            dest = OUT_DIR / job["set"] / f"{job['slug']}.png"
                            downloaded_path = download_asset_data(server, job_id, dest, is_animated=False)
                            if downloaded_path:
                                job["status"] = "downloaded"
                                job["path"] = str(Path(downloaded_path).relative_to(ROOT))
                                print(f"Downloaded static asset: {key}")
                            else:
                                job["status"] = "failed_download"
                            save_ledger(led)
                        else: # Object created, ready for animation queuing or polling
                            job["status"] = "created" # Mark as created for animation to pick up
                            save_ledger(led)
                            print(f"Object created for animation: {key}. Status: {job['status']}")
                    else:
                        job["status"] = "processing_create"
                        save_ledger(led)
                        print(f"Still processing creation for {key}. Status: {job['status']}")

                # --- Poll animate_object status if animated and animation_id exists ---
                # Check if it's animated, object is created, and animation_id exists, but not yet downloaded
                elif is_animated and job.get("id") and job.get("status") in {"created", "processing_animate", "failed_animate"}:
                        if not animation_id: # If object created but animation not yet queued
                            print(f"Re-queue `animate_object` for {key}. Object created but animation_id missing.")
                            # This path should ideally be handled by cmd_queue, but for robustness
                            # we can re-queue animation here if it somehow got missed.
                            # For now, let's just make sure we don't proceed with poll if animation_id is missing.
                            continue
                            
                        g_anim = await session.call_tool("get_object", {"object_id": animation_id})
                        gt_anim = txt(g_anim).lower()
                        if "completed" in gt_anim or "status: completed" in gt_anim:
                            dest_base = OUT_DIR / job["set"] / job["slug"]
                            downloaded_frames = download_asset_data(server, animation_id, dest_base, is_animated=True)
                            if downloaded_frames:
                                job["status"] = "downloaded_frames"
                                job["frames"] = [str(Path(p).relative_to(ROOT)) for p in downloaded_frames]
                                job["path"] = str(dest_base.relative_to(ROOT)) # Base dir for frames
                                job["frame_count"] = job["frame_count"] # Ensure frame_count is saved
                                print(f"Downloaded animated frames for {key} -> {len(downloaded_frames)} frames")
                            else:
                                job["status"] = "failed_animation_download"
                            save_ledger(led)
                        else:
                            job["status"] = "processing_animate"
                            save_ledger(led)
                            print(f"Still processing animation for {key}. Status: {job['status']}")
                
                await asyncio.sleep(0.5)
    cmd_status()


def cmd_status() -> None:
    led = load_ledger()
    from collections import Counter
    
    total_specs = len(SPECS)
    create_statuses = Counter()
    animate_statuses = Counter()
    
    for spec_entry in SPECS:
        sset, slug, _, _, _, animated, _ = get_job_base_info(spec_entry)
        key = f"{sset}/{slug}"
        job = led["jobs"].get(key, {})
        
        if job.get("animated", False):
            if job.get("animation_id"):
                animate_statuses[job.get("status", "not_started_animate")] += 1
            elif job.get("id"): # Animated object created, but animation not yet queued
                animate_statuses["waiting_queue"] += 1
            else:
                create_statuses[job.get("status", "not_started_create")] += 1 # Base object not even created
        else: # Static object
            create_statuses[job.get("status", "not_started_create")] += 1
            
    # Calculate overall progress for animated assets
    total_animated_specs = sum(1 for s in SPECS if s[5])
    downloaded_animated_frames = sum(1 for j in led["jobs"].values() if j.get("status") == "downloaded_frames")
    
    total_static_specs = total_specs - total_animated_specs
    downloaded_static = sum(1 for j in led["jobs"].values() if j.get("status") == "downloaded")

    print(f"Ledger Summary: {len(led['jobs'])}/{total_specs} specs tracked.")
    print(f"  Static Assets: {downloaded_static}/{total_static_specs} downloaded.")
    print(f"  Animated Assets: {downloaded_animated_frames}/{total_animated_specs} frames downloaded.")
    print(f"  Create Statuses: {dict(create_statuses)}")
    print(f"  Animate Statuses: {dict(animate_statuses)}")
    

def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    if cmd == "queue":
        asyncio.run(cmd_queue())
    elif cmd == "poll":
        asyncio.run(cmd_poll())
    elif cmd == "status":
        cmd_status()
    else:
        print(f"Unknown command: {cmd}")


if __name__ == "__main__":
    main()

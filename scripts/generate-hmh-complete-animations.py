#!/usr/bin/env python3
"""Complete animation generation for Hard Money Heroes.

Generates ALL missing animated states for:
- Heroes (Lit Commando, Lit Valkyrie): crouch, fall, shoot, melee, throw, hurt, death, victory
- Enemies (5 types): attack-tell, melee-counter, hit, death, optional-gore-overlay
- Particle/Weapon Effects: bullet impacts, explosions, muzzle flashes, blood splatter
- Extended Tile Sets: parks, retail, roads, bridges, rivers, lakes, waterfalls, cliffs, buildings

Uses PixelLab MCP API with proper 8-directional frame generation.
Resumable via ledger tracking.
"""

from __future__ import annotations
import asyncio, json, re, sys, time, zipfile, io
from pathlib import Path
from typing import Any, Literal

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "apps/portal/assets/generated/hmh-complete-animations"
LEDGER = OUT_DIR / "complete-animations-ledger.json"
UUID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")

AssetStatus = Literal[
    "not_started", "processing_create", "failed_create", "created", "downloaded",  # static
    "processing_animate", "failed_animate", "animated", "downloaded_frames"       # animated
]

# ========================================================================
# HERO ANIMATION SPECS (8-directional, 8 frames each for smooth motion)
# ========================================================================
# Each hero state needs 8 directions: E, NE, N, NW, W, SW, S, SE
# We'll generate as 8-frame animation sequences per direction

HERO_STATES = [
    # (state_name, description, frame_count, priority)
    ("crouch", "isometric tactical crouch pose, weighting shift, ready to move or shoot, pixel art", 4, 1),
    ("fall", "isometric falling through air, arms/legs spread, dynamic pose, pixel art", 6, 2),
    ("shoot", "isometric shooting stance, weapon raised, muzzle flash frame, recoil follow-through, pixel art", 8, 1),
    ("melee", "isometric melee attack slash with Litecoin Blade, 3-frame arc, impact spark, recovery, pixel art", 8, 1),
    ("throw", "isometric grenade/throwable windup, overhead toss, release frame, follow-through, pixel art", 6, 2),
    ("hurt", "isometric hit reaction, knockback stagger, flash frame, quick recovery to idle, pixel art", 4, 1),
    ("death", "isometric dramatic death sequence, slow-mo collapse, Litecoin spark fade, particle burst, pixel art", 10, 1),
    ("victory", "isometric victory pose, weapon salute, Litecoin glow pulse, triumphant stance, pixel art", 8, 3),
]

HEROES = [
    ("lit-commando", "Lit Commando", "silver-blue tactical commando armor, cyan visor, Litecoin blade on thigh"),
    ("lit-valkyrie", "Lit Valkyrie", "teal-plasma energy warrior, short teal hair, glowing energy fists"),
]

# Each hero state gets 8 directions
DIRECTIONS = [
    ("east", "facing right/east"),
    ("north-east", "facing up-right/northeast"),
    ("north", "facing up/north"),
    ("north-west", "facing up-left/northwest"),
    ("west", "facing left/west"),
    ("south-west", "facing down-left/southwest"),
    ("south", "facing down/south"),
    ("south-east", "facing down-right/southeast"),
]

# ========================================================================
# ENEMY ANIMATION SPECS (8-directional)
# ========================================================================

ENEMY_STATES = [
    ("attack-tell", "isometric attack telegraph pose, clear visual warning, weapon/charge glow, pixel art", 4, 1),
    ("melee-counter", "isometric parry/counter animation, defensive blade clash, spark impact, pixel art", 6, 2),
    ("hit", "isometric hit reaction, knockback stagger, damage flash, 2-frame recovery, pixel art", 4, 1),
    ("death", "isometric death animation, unique per enemy type, particle burst, collapse, pixel art", 8, 1),
    ("optional-gore-overlay", "isometric stylized gore overlay for death, blood splatter, chunks, toggleable, pixel art", 4, 3),
]

ENEMIES = [
    ("trench-degen", "Trench Degen", "grimy tactical gear, makeshift pistol, hunched posture"),
    ("evil-banker", "Evil Banker", "sharp suit, briefcase weapon, corporate predator vibe"),
    ("warren-spear-rider", "Warren Spear Rider", "mounted on cyber-steed, long energy spear, armored"),
    ("crypto-bro", "Crypto Bro", "hoodie, phone-taunt pose, jump-back knives, mocking grin"),
    ("gas-beast", "Gas Beast", "hulking mutated form, gas vents on back, claws, toxic glow"),
]

# ========================================================================
# PARTICLE / WEAPON EFFECTS (single-direction, loopable)
# ========================================================================

PARTICLE_EFFECTS = [
    ("bullet-impact-spark", "silver Litecoin spark burst on bullet hit, 6-frame radial, additive blend", 6),
    ("bullet-impact-blood", "stylized pixel blood splatter on hit, 5-frame directional, gore toggle", 5),
    ("muzzle-flash-pistol", "crisp 2-frame pistol muzzle flash, blue-white, shell eject, pixel art", 2),
    ("muzzle-flash-shotgun", "wide 3-frame shotgun blast, orange flash, pump smoke, pixel art", 3),
    ("muzzle-flash-mg", "rapid 4-frame MG muzzle chain, silver tracers, coil whine, pixel art", 4),
    ("muzzle-flash-rail", "2-frame railgun charge + fire, cyan beam streak, screen line, pixel art", 2),
    ("muzzle-flash-super", "3-frame oracle slayer charge + dragon beam, purple-white, pixel art", 3),
    ("explosion-small", "3-frame grenade pop, orange-white flash, debris scatter, pixel art", 3),
    ("explosion-medium", "5-frame crypto bomb blast, blue-white shockwave, ring expansion, pixel art", 5),
    ("explosion-large", "8-frame boss death explosion, multi-ring, screen shake frames, pixel art", 8),
    ("melee-spark-slash", "3-frame Litecoin Blade arc, silver trail, Ł stamp on hit, pixel art", 3),
    ("melee-spark-blood", "3-frame gore melee hit, blood arc + silver sparks, toggleable, pixel art", 3),
    ("particle-shell-casing", "4-frame brass casing eject, spin, bounce, settle, pixel art", 4),
    ("particle-xp-shard", "6-frame floating XP crystal, pulse glow, bob animation, pixel art", 6),
    ("particle-heal-glow", "8-frame health pickup pulse, green cross, soft pulse, pixel art", 8),
    ("particle-shield-pulse", "6-frame shield activation, cyan hex-grid pulse, pixel art", 6),
    ("particle-berserk-aura", "8-frame red damage aura, flame particles, screen tint frames, pixel art", 8),
]

# ========================================================================
# EXTENDED TILE SETS FOR WORLD BUILDING (scene-template compliant)
# ========================================================================

# Each tile needs to be 32x32 to 64x64, seamless, matching biome themes
EXTENDED_TILES = [
    # PAVEMENT / URBAN (town/road biome)
    ("pavement-main", "clean asphalt road tile, seamless, manhole cover variant, pixel art", False),
    ("pavement-crosswalk", "white crosswalk stripes on asphalt, seamless, pixel art", False),
    ("pavement-sidewalk", "concrete sidewalk tile, curb edge, seamless, pixel art", False),
    ("pavement-alley", "gritty alley pavement, graffiti patches, puddles, seamless, pixel art", False),
    ("pavement-intersection", "4-way intersection with lines, traffic light base, seamless, pixel art", False),
    ("pavement-parking", "parking lot lines on asphalt, numbered spaces, seamless, pixel art", False),
    
    # GRASS / PARK (forest/park biome)
    ("grass-main", "lush green grass tile, clover patches, seamless, pixel art", False),
    ("grass-path", "worn dirt path through grass, seamless, pixel art", False),
    ("grass-flowerbed", "grass with flower border edging, seamless, pixel art", False),
    ("grass-hill", "gentle grass slope tile, height transition, seamless, pixel art", False),
    
    # CARPET / INTERIOR (arcade/building biome)
    ("carpet-main", "dark arcade carpet, geometric pattern, seamless, pixel art", False),
    ("carpet-hallway", "corridor carpet with directional wear, seamless, pixel art", False),
    ("carpet-vip", "plush red carpet, gold trim, seamless, pixel art", False),
    ("floor-tile-concrete", "bare concrete floor, industrial, stain variants, seamless, pixel art", False),
    ("floor-tile-checker", "black-white checkerboard tile, retro arcade, seamless, pixel art", False),
    ("floor-metal-grate", "metal grate flooring, ventilation, seamless, pixel art", False),
    
    # SAND / DESERT (desert biome)
    ("sand-main", "desert sand tile, dune ripple, seamless, pixel art", False),
    ("sand-rocky", "sand with embedded rocks, seamless, pixel art", False),
    ("sand-oasis", "sand transitioning to water edge, seamless, pixel art", False),
    
    # WATER / RIVER (water biome)
    ("water-deep", "deep blue water tile, caustic shimmer, seamless animated", True),
    ("water-shallow", "shallow water over sand, ripple transparency, seamless animated", True),
    ("water-river", "flowing river tile, directional current foam, seamless animated", True),
    ("water-wetland", "marsh water with lily pads, reeds, seamless animated", True),
    
    # ROCKY / CLIFF (rocky biome)
    ("rock-main", "grey rocky terrain, boulder clusters, seamless, pixel art", False),
    ("rock-cliff-top", "cliff edge top tile, grass overhang, seamless, pixel art", False),
    ("rock-cliff-face", "vertical cliff face, stratification, seamless, pixel art", False),
    ("rock-scree", "loose rock slope, scree field, seamless, pixel art", False),
    
    # BRIDGES / CONSTRUCTIVE (construct biome) - these connect biomes
    ("bridge-wood", "wooden plank bridge deck, railings, seamless connectable", False),
    ("bridge-metal", "industrial metal grate bridge, bolted, seamless connectable", False),
    ("bridge-stone", "arched stone bridge deck, lanterns, seamless connectable", False),
    ("bridge-rope", "rope bridge planks, sway animation frames, seamless connectable", True),
    ("fence-chainlink", "chain-link fence segment, post, seamless tileable", False),
    ("fence-wooden-picket", "white picket fence segment, post, seamless tileable", False),
    ("fence-security", "security fence with barbed wire, post, seamless tileable", False),
    ("wall-brick", "brick wall segment, window variants, seamless tileable", False),
    ("wall-concrete", "concrete barrier wall, graffiti, seamless tileable", False),
    ("wall-retail", "storefront wall, glass window, awning, seamless tileable", False),
]

# ========================================================================
# BIOME TRANSITION TILES (for smooth biome blending)
# ========================================================================

TRANSITION_TILES = [
    ("pavement-to-grass", "asphalt transitioning to grass verge, curb, seamless", False),
    ("grass-to-sand", "grass fading to desert sand, dune grass, seamless", False),
    ("pavement-to-water", "concrete seawall to water, wave break, seamless", False),
    ("grass-to-water", "riverbank grass to water, reeds, mud, seamless", False),
    ("rock-to-grass", "rocky outcrop to grassy meadow, moss transition, seamless", False),
    ("sand-to-rocky", "desert sand to rocky plateau, seamless", False),
    ("carpet-to-concrete", "arcade carpet to bare concrete threshold, seamless", False),
    ("pavement-to-sand", "urban edge to desert, blowing sand on asphalt, seamless", False),
]


def load_pixellab_server() -> dict:
    p_user = Path.home() / ".claude.json"
    if p_user.exists():
        d = json.loads(p_user.read_text(encoding="utf-8"))
        for project in d.get("projects", {}).values():
            s = project.get("mcpServers", {}).get("pixellab")
            if s: return s
        s = d.get("mcpServers", {}).get("pixellab")
        if s: return s
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


async def queue_all_animations(active_cap: int = 12) -> None:
    """Queue all missing animations in priority order."""
    server = load_pixellab_server()
    led = load_ledger()
    
    all_specs = []
    
    # ---- HERO ANIMATIONS (8 directions each) ----
    for hero_id, hero_name, hero_desc in HEROES:
        for state_name, desc, frames, priority in HERO_STATES:
            for dir_id, dir_desc in DIRECTIONS:
                slug = f"{hero_id}/{state_name}-{dir_id}"
                full_desc = f"isometric {hero_name} {desc}, {dir_desc}, {hero_desc}"
                all_specs.append({
                    "key": slug,
                    "set": "heroes",
                    "slug": slug.replace("/", "-"),
                    "w": 64,
                    "h": 96,
                    "desc": full_desc,
                    "animated": True,
                    "frame_count": frames,
                    "priority": priority,
                    "meta": {"hero": hero_id, "state": state_name, "direction": dir_id}
                })
    
    # ---- ENEMY ANIMATIONS ----
    for enemy_id, enemy_name, enemy_desc in ENEMIES:
        for state_name, desc, frames, priority in ENEMY_STATES:
            # Enemies need 4 main directions for efficiency (E, N, W, S) + diagonals = 8
            for dir_id, dir_desc in DIRECTIONS:
                slug = f"{enemy_id}/{state_name}-{dir_id}"
                full_desc = f"isometric {enemy_name} {desc}, {dir_desc}, {enemy_desc}"
                all_specs.append({
                    "key": slug,
                    "set": "enemies",
                    "slug": slug.replace("/", "-"),
                    "w": 64,
                    "h": 96,
                    "desc": full_desc,
                    "animated": True,
                    "frame_count": frames,
                    "priority": priority,
                    "meta": {"enemy": enemy_id, "state": state_name, "direction": dir_id}
                })
    
    # ---- PARTICLE EFFECTS ----
    for effect_id, desc, frames in PARTICLE_EFFECTS:
        slug = f"particles/{effect_id}"
        all_specs.append({
            "key": slug,
            "set": "particles",
            "slug": effect_id,
            "w": 32,
            "h": 32,
            "desc": f"isometric {desc}",
            "animated": True,
            "frame_count": frames,
            "priority": 1,
            "meta": {"type": "particle", "effect": effect_id}
        })
    
    # ---- EXTENDED TILES ----
    for tile_id, desc, animated in EXTENDED_TILES:
        slug = f"tiles/{tile_id}"
        all_specs.append({
            "key": slug,
            "set": "tiles-extended",
            "slug": tile_id,
            "w": 64,
            "h": 64,
            "desc": f"isometric {desc}",
            "animated": animated,
            "frame_count": 8 if animated else None,
            "priority": 2,
            "meta": {"type": "tile", "tile": tile_id}
        })
    
    # ---- TRANSITION TILES ----
    for tile_id, desc, animated in TRANSITION_TILES:
        slug = f"transitions/{tile_id}"
        all_specs.append({
            "key": slug,
            "set": "transitions",
            "slug": tile_id,
            "w": 64,
            "h": 64,
            "desc": f"isometric {desc}",
            "animated": animated,
            "frame_count": 8 if animated else None,
            "priority": 2,
            "meta": {"type": "transition", "tile": tile_id}
        })
    
    print(f"Total specs to generate: {len(all_specs)}")
    
    # Sort by priority (1 = highest)
    all_specs.sort(key=lambda x: x["priority"])
    
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            queued_this_wave = 0
            
            for spec in all_specs:
                key = spec["key"]
                job = led["jobs"].get(key, {})
                
                # Skip if already completed
                if job.get("status") in {"downloaded", "downloaded_frames"}:
                    continue
                
                # Queue create_map_object if not done or failed
                # Only retry if failed; skip if already processing/created/downloaded
                if not job.get("id") or job.get("status") in {"failed_create"}:
                    if queued_this_wave >= active_cap:
                        break
                    
                    print(f"Queueing create_map_object for {key} (priority {spec['priority']})")
                    r = await session.call_tool("create_map_object", {
                        "description": spec["desc"],
                        "width": spec["w"],
                        "height": spec["h"],
                        "view": "high top-down",
                        "outline": "single color outline",
                        "shading": "basic shading",
                        "detail": "medium detail",
                    })
                    t = txt(r)
                    ids = UUID_RE.findall(t)
                    
                    job.update({
                        "set": spec["set"],
                        "slug": spec["slug"],
                        "w": spec["w"],
                        "h": spec["h"],
                        "id": ids[0] if ids else None,
                        "status": "processing_create" if ids else "failed_create",
                        "raw_create_response": t[:5000],
                        "animated": spec["animated"],
                        "frame_count": spec["frame_count"],
                        "priority": spec["priority"],
                        "meta": spec.get("meta", {}),
                    })
                    led["jobs"][key] = job
                    save_ledger(led)
                    queued_this_wave += 1
                    await asyncio.sleep(0.8)
                    continue
                
                # Queue animate_object if animated and creation done
                if spec["animated"] and job.get("id") and job.get("status") in {"created", "downloaded"}:
                    if not job.get("animation_id"):
                        if queued_this_wave >= active_cap:
                            break
                        print(f"Queueing animate_object for {key}")
                        r_anim = await session.call_tool("animate_object", {
                            "object_id": job["id"],
                            "mode": "v3",
                            "animation_description": spec["desc"],
                            "frame_count": spec["frame_count"]
                        })
                        t_anim = txt(r_anim)
                        # Extract group ID from animation response
                        group_match = re.search(r"group[:\s]+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})", t_anim, re.IGNORECASE)
                        ids_anim = UUID_RE.findall(t_anim)
                        anim_id = group_match.group(1) if group_match else (ids_anim[1] if len(ids_anim) > 1 else None)
                        
                        job["animation_id"] = anim_id
                        job["status"] = "processing_animate" if anim_id else "failed_animate"
                        job["raw_animation_response"] = t_anim[:5000]
                        save_ledger(led)
                        queued_this_wave += 1
                        await asyncio.sleep(0.8)
            
            print(f"Queued {queued_this_wave} new jobs this wave")


async def poll_all(active_cap: int = 4) -> None:
    """Poll all in-flight jobs and download completed."""
    server = load_pixellab_server()
    led = load_ledger()
    
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            
            for key, job in list(led["jobs"].items()):
                status = job.get("status", "not_started")
                obj_id = job.get("id")
                anim_id = job.get("animation_id")
                is_animated = job.get("animated", False)
                
                if status in {"downloaded", "downloaded_frames"} or not obj_id:
                    continue
                
                # Poll object creation
                if status in {"not_started", "processing_create", "failed_create"}:
                    g = await session.call_tool("get_object", {"object_id": obj_id})
                    gt = txt(g).lower()
                    if "completed" in gt or "status: completed" in gt:
                        if not is_animated:
                            dest = OUT_DIR / job["set"] / f"{job['slug']}.png"
                            downloaded = await download_asset(server, obj_id, dest, False)
                            if downloaded:
                                job["status"] = "downloaded"
                                job["path"] = str(Path(downloaded).relative_to(ROOT))
                                print(f"Downloaded static: {key}")
                            else:
                                job["status"] = "failed_download"
                        else:
                            job["status"] = "created"  # Ready for animation
                            print(f"Created, ready for animation: {key}")
                        save_ledger(led)
                    else:
                        job["status"] = "processing_create"
                        save_ledger(led)
                
                # Poll animation
                elif is_animated and obj_id and status in {"created", "processing_animate", "failed_animate"}:
                    if not anim_id:
                        print(f"Missing animation_id for {key}, will re-queue")
                        continue
                    
                    g_anim = await session.call_tool("get_object", {"object_id": anim_id})
                    gt_anim = txt(g_anim).lower()
                    if "completed" in gt_anim or "status: completed" in gt_anim:
                        dest_base = OUT_DIR / job["set"] / job["slug"]
                        frames = await download_animation_frames(server, anim_id, dest_base)
                        if frames:
                            job["status"] = "downloaded_frames"
                            job["frames"] = [str(Path(p).relative_to(ROOT)) for p in frames]
                            job["path"] = str(dest_base.relative_to(ROOT))
                            print(f"Downloaded {len(frames)} frames for {key}")
                        else:
                            job["status"] = "failed_animation_download"
                        save_ledger(led)
                    else:
                        job["status"] = "processing_animate"
                        save_ledger(led)
                
                await asyncio.sleep(0.3)
    
    cmd_status()


async def download_asset(server: dict, oid: str, dest: Path, is_animated: bool) -> str | None:
    import urllib.request
    url = f"https://api.pixellab.ai/mcp/objects/{oid}/download"
    req_headers = server["headers"].copy()
    if "Authorization" not in req_headers:
        req_headers["Authorization"] = ""
    
    try:
        req = urllib.request.Request(url, headers=req_headers)
        data = urllib.request.urlopen(req, timeout=120).read()
        
        if is_animated:
            if data[:2] == b"PK":
                dest.mkdir(parents=True, exist_ok=True)
                frame_paths = []
                with zipfile.ZipFile(io.BytesIO(data)) as z:
                    for fn in z.namelist():
                        if fn.lower().endswith(".png"):
                            fp = dest / fn
                            fp.write_bytes(z.read(fn))
                            frame_paths.append(str(fp))
                return frame_paths
            return None
        else:
            if data[:8] == bytes.fromhex("89504e470d0a1a0a"):
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(data)
                return str(dest)
            return None
    except Exception as e:
        print(f"  Download error {oid}: {type(e).__name__} {e}")
    return None


async def download_animation_frames(server: dict, anim_id: str, dest_base: Path) -> list[str] | None:
    import urllib.request
    url = f"https://api.pixellab.ai/mcp/objects/{anim_id}/download"
    req_headers = server["headers"].copy()
    if "Authorization" not in req_headers:
        req_headers["Authorization"] = ""
    
    try:
        req = urllib.request.Request(url, headers=req_headers)
        data = urllib.request.urlopen(req, timeout=120).read()
        
        if data[:2] == b"PK":
            frame_dir = dest_base / "frames"
            frame_dir.mkdir(parents=True, exist_ok=True)
            frame_paths = []
            with zipfile.ZipFile(io.BytesIO(data)) as z:
                for fn in z.namelist():
                    if fn.lower().endswith(".png"):
                        fp = frame_dir / fn
                        fp.write_bytes(z.read(fn))
                        frame_paths.append(str(fp))
            return frame_paths
    except Exception as e:
        print(f"  Animation download error {anim_id}: {type(e).__name__} {e}")
    return None


def cmd_status() -> None:
    led = load_ledger()
    from collections import Counter
    
    create_statuses = Counter()
    animate_statuses = Counter()
    
    for job in led["jobs"].values():
        if job.get("animated"):
            if job.get("animation_id"):
                animate_statuses[job.get("status", "unknown")] += 1
            elif job.get("id"):
                animate_statuses["waiting_queue"] += 1
            else:
                create_statuses[job.get("status", "unknown")] += 1
        else:
            create_statuses[job.get("status", "unknown")] += 1
    
    total = len(led["jobs"])
    downloaded = sum(1 for j in led["jobs"].values() if j.get("status") == "downloaded")
    anim_downloaded = sum(1 for j in led["jobs"].values() if j.get("status") == "downloaded_frames")
    
    print(f"Ledger: {total} jobs tracked")
    print(f"  Static downloaded: {downloaded}")
    print(f"  Animated downloaded: {anim_downloaded}")
    print(f"  Create statuses: {dict(create_statuses)}")
    print(f"  Animate statuses: {dict(animate_statuses)}")


def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    if cmd == "queue":
        asyncio.run(queue_all_animations())
    elif cmd == "poll":
        asyncio.run(poll_all())
    elif cmd == "status":
        cmd_status()
    else:
        print(f"Unknown command: {cmd}")
        print("Usage: python generate-hmh-complete-animations.py [queue|poll|status]")


if __name__ == "__main__":
    main()
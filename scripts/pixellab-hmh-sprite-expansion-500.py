#!/usr/bin/env python
"""Resumable PixelLab 500-sprite expansion wave for Hard Money Heroes.

Creates a 500-asset manifest covering animation frames, weapons, bullets,
level-up/power-up sprites, menu UI, damage models, VFX, death animations, and
level-design sprites. All queued jobs use PixelLab MCP `create_map_object` so
one downloaded PNG equals one sprite asset/frame.

Auth is read from local MCP config (`~/.claude.json` or Hermes mcp-config) and
is never written to logs, ledgers, manifests, or docs.

Usage:
  python scripts/pixellab-hmh-sprite-expansion-500.py init
  python scripts/pixellab-hmh-sprite-expansion-500.py preflight
  python scripts/pixellab-hmh-sprite-expansion-500.py queue --limit 25
  python scripts/pixellab-hmh-sprite-expansion-500.py poll --limit 50
  python scripts/pixellab-hmh-sprite-expansion-500.py package
  python scripts/pixellab-hmh-sprite-expansion-500.py status
"""
from __future__ import annotations

import argparse
import asyncio
import json
import re
import sys
import time
import urllib.request
import zipfile
from collections import Counter
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, AsyncIterator

try:
    from PIL import Image, ImageDraw, ImageFont
except Exception:  # pragma: no cover - packaging can report the missing dep
    Image = None
    ImageDraw = None
    ImageFont = None

from mcp import ClientSession

try:  # Current MCP SDK.
    from mcp.client.streamable_http import create_mcp_http_client, streamable_http_client
except Exception:  # pragma: no cover - old SDK fallback.
    create_mcp_http_client = None  # type: ignore[assignment]
    streamable_http_client = None  # type: ignore[assignment]

try:  # Older MCP SDK used by older repo scripts.
    from mcp.client.streamable_http import streamablehttp_client as old_streamablehttp_client
except Exception:  # pragma: no cover - current SDK does not expose this.
    old_streamablehttp_client = None  # type: ignore[assignment]

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_ROOT = Path("apps/portal/assets/generated/hmh-pixellab-sprite-expansion-500")
OUT_ROOT = ROOT / PUBLIC_ROOT
JOBS_PATH = OUT_ROOT / "pixellab-sprite-expansion-500-jobs.json"
RAW_DIR = OUT_ROOT / "raw-tool-output"
CONTACT_DIR = OUT_ROOT / "contact-sheets"
RUNTIME_MANIFEST_PATH = OUT_ROOT / "hmh-pixellab-sprite-expansion-500.mjs"
DOC_PATH = ROOT / "docs/game-design/hard-money-heroes-pixellab-sprite-expansion-500.md"

UUID_RE = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")
URL_RE = re.compile(r"https?://[^\s,)\]>'\"]+")
PNG_SIG = bytes.fromhex("89504e470d0a1a0a")
NO_TEXT = "no words, no letters, no numbers, no readable labels, no logos, no watermark, no official cryptocurrency marks"
BASE_STYLE = (
    "Hard Money Heroes game-ready sprite asset, top-down 2.5D PixiJS roguelike run-and-gun, "
    "retro 80s/90s arcade pixel art, limited SNES/Neo-Geo palette, dark Litecoin City After Dark mood, "
    "crisp readable silhouette, clean pixel edges, centered on a fully transparent background; "
    + NO_TEXT
)
UI_STYLE = (
    "Hard Money Heroes blank menu UI sprite, retro arcade HUD chrome, dark blue-silver hard-money mood, "
    "clean pixel edges, transparent background, no embedded text; "
    + NO_TEXT
)
LEVEL_STYLE = (
    "Hard Money Heroes level-design sprite/decal, high top-down 2.5D game art, readable at small scale, "
    "transparent background where appropriate, grounded perspective; "
    + NO_TEXT
)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def rel(path: Path) -> str:
    return path.resolve().relative_to(ROOT.resolve()).as_posix()


def txt(result: Any) -> str:
    return "\n".join(c.text for c in getattr(result, "content", []) or [] if hasattr(c, "text"))


def parse_balance(text: str) -> dict[str, Any]:
    data: dict[str, Any] = {"raw": text}
    for line in text.splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        key = key.strip().lower().replace(" ", "_")
        value = value.strip()
        if re.fullmatch(r"-?\d+", value):
            data[key] = int(value)
        else:
            data[key] = value
    lower = text.lower()
    data["looks_blocked"] = any(token in lower for token in ["subscription: expired", "renew", "frozen", "generations_remaining: 0"])
    return data


def status_from_text(text: str) -> str:
    lower = text.lower()
    if any(token in lower for token in ["rate limit", "too many", "8/8 jobs"]):
        return "rate_limited"
    if any(token in lower for token in ["subscription", "renew", "frozen", "generations_remaining: 0", "credits"]):
        if any(token in lower for token in ["expired", "renew", "frozen", "remaining: 0"]):
            return "blocked_subscription"
    if "failed" in lower or "error" in lower:
        return "failed"
    if "review" in lower:
        return "review"
    if "completed" in lower or "status: completed" in lower or "success" in lower:
        return "completed"
    if "processing" in lower or "queued" in lower or "pending" in lower or "in progress" in lower:
        return "processing"
    return "unknown"


def load_pixellab_server() -> dict[str, Any]:
    candidates = [Path.home() / ".claude.json", Path.home() / ".hermes" / "config" / "mcp-config.json"]
    for path in candidates:
        if not path.exists():
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        for project in data.get("projects", {}).values():
            server = project.get("mcpServers", {}).get("pixellab")
            if server:
                return server
        server = data.get("mcpServers", {}).get("pixellab")
        if server:
            return server
    raise SystemExit("Could not locate PixelLab MCP config in ~/.claude.json or ~/.hermes/config/mcp-config.json")


@asynccontextmanager
async def pixellab_session() -> AsyncIterator[ClientSession]:
    server = load_pixellab_server()
    if streamable_http_client and create_mcp_http_client:
        http_client = create_mcp_http_client(headers=server.get("headers", {}))
        async with http_client:
            async with streamable_http_client(server["url"], http_client=http_client) as streams:
                read_stream, write_stream = streams[:2]
                async with ClientSession(read_stream, write_stream) as session:
                    await session.initialize()
                    yield session
    elif old_streamablehttp_client:
        async with old_streamablehttp_client(server["url"], headers=server.get("headers", {})) as streams:
            read_stream, write_stream = streams[:2]
            async with ClientSession(read_stream, write_stream) as session:
                await session.initialize()
                yield session
    else:  # pragma: no cover
        raise SystemExit("No usable MCP streamable HTTP client found")


async def get_balance_text() -> str:
    async with pixellab_session() as session:
        result = await session.call_tool("get_balance", {})
        return txt(result)


def mk(
    category: str,
    family: str,
    slug: str,
    description: str,
    width: int,
    height: int,
    *,
    frame_index: int | None = None,
    frame_count: int | None = None,
    variant: str | None = None,
    view: str = "high top-down",
) -> dict[str, Any]:
    style = UI_STYLE if category == "menu-ui" else LEVEL_STYLE if category == "level-design" else BASE_STYLE
    bits = [description, style]
    if frame_index is not None and frame_count is not None:
        bits.append(f"animation frame {frame_index + 1} of {frame_count}; keep pose/progression distinct and consistent with adjacent frames")
    if variant:
        bits.append(f"variant/state: {variant}")
    prompt = "; ".join(bits)
    return {
        "job_key": f"{category}:{family}:{slug}",
        "category": category,
        "family": family,
        "slug": slug,
        "description": description,
        "variant": variant,
        "frame_index": frame_index,
        "frame_count": frame_count,
        "tool": "create_map_object",
        "args": {
            "description": prompt,
            "width": width,
            "height": height,
            "view": view,
            "outline": "single color outline" if category in {"weapons", "level-up", "menu-ui"} else "lineless",
            "shading": "detailed shading",
            "detail": "high detail" if width >= 96 else "medium detail",
        },
    }


def all_specs() -> list[dict[str, Any]]:
    specs: list[dict[str, Any]] = []

    animation_sequences = [
        ("survivor-idle", "generic human survivor idle weight-shift body frame, not Lester or Lilly"),
        ("survivor-run", "generic human survivor running body frame with readable foot planting, not a canonical hero"),
        ("survivor-recoil", "generic human survivor firing recoil body frame with small muzzle pose, not a canonical hero"),
        ("survivor-reload", "generic human survivor reload/fumble body frame, no weapon labels, not canonical"),
        ("survivor-dodge", "generic human survivor dodge roll and landing dust body frame, not canonical"),
        ("survivor-hurt", "generic human survivor hurt stagger body frame, non-gory, not canonical"),
        ("zombie-lurch", "human-scale zombie lurch walk body frame, ragged clothes, readable silhouette"),
        ("zombie-attack", "human-scale zombie swipe attack body frame, non-gory, readable silhouette"),
        ("pickup-interact", "generic human survivor leaning to collect loot body frame, not canonical"),
    ]
    for family, desc in animation_sequences:
        for i in range(8):
            specs.append(mk("animations", family, f"{family}-f{i+1:02d}", desc, 112, 112, frame_index=i, frame_count=8))

    weapon_families = [
        "pistol-sidearm", "sawed-shotgun", "auto-miner-smg", "hash-rail-rifle", "tube-launcher",
        "grenade-bomb", "throwing-axe", "cleaver-blade", "arc-orbital-drone",
    ]
    weapon_variants = ["clean pickup", "scavenged pickup", "blue charged", "overheated red", "elite silver", "shadow damaged"]
    for family in weapon_families:
        for variant in weapon_variants:
            desc = f"centered top-down weapon pickup sprite: {family.replace('-', ' ')}"
            specs.append(mk("weapons", family, f"{family}-{variant.replace(' ', '-')}", desc, 96, 96, variant=variant))

    bullet_families = [
        "pistol-tracer", "shotgun-pellet", "smg-casing", "rail-beam-segment", "launcher-shell",
        "grenade-arc", "axe-spin", "shock-dart", "ricochet-spark",
    ]
    bullet_variants = ["north", "east", "south", "west", "bright frame", "fading frame"]
    for family in bullet_families:
        for variant in bullet_variants:
            desc = f"small projectile/bullet sprite for {family.replace('-', ' ')}"
            specs.append(mk("bullets", family, f"{family}-{variant.replace(' ', '-')}", desc, 64, 64, variant=variant))

    levelup_families = [
        "critical-branch", "pierce-branch", "ricochet-branch", "elemental-fire", "elemental-shock",
        "magnet-surge", "shield-upgrade", "speed-upgrade",
    ]
    levelup_variants = ["inactive node", "active node", "pickup orb", "selection burst", "rank pip", "aura ring"]
    for family in levelup_families:
        for variant in levelup_variants:
            desc = f"level-up skill-tree or power-up sprite for {family.replace('-', ' ')}"
            specs.append(mk("level-up", family, f"{family}-{variant.replace(' ', '-')}", desc, 96, 96, variant=variant))

    ui_families = [
        "pause-panel", "inventory-slot", "weapon-card", "skill-card", "health-bar", "xp-bar",
        "minimap-frame", "dialog-panel", "music-player-control",
    ]
    ui_variants = ["idle", "hover", "pressed", "disabled", "selected", "warning"]
    for family in ui_families:
        for variant in ui_variants:
            desc = f"blank menu UI component sprite: {family.replace('-', ' ')}"
            specs.append(mk("menu-ui", family, f"{family}-{variant}", desc, 128, 72 if "bar" in family else 128, variant=variant, view="front-facing orthographic"))

    damage_families = [
        "survivor-armor-crack", "zombie-wound-decal", "car-damage", "barrel-damage", "wall-crack",
        "scorch-mark", "shield-crack", "weapon-overheat", "ground-crater",
    ]
    damage_variants = ["severity-1", "severity-2", "severity-3", "severity-4", "severity-5", "broken-final"]
    for family in damage_families:
        for variant in damage_variants:
            desc = f"damage model overlay/decal sprite: {family.replace('-', ' ')}, non-gory readable arcade damage"
            specs.append(mk("damage-models", family, f"{family}-{variant}", desc, 96, 96, variant=variant))

    fx_families = [
        "muzzle-flash", "impact-spark", "grenade-explosion", "death-smoke", "shock-lightning",
        "shield-pulse", "coin-pickup-burst", "portal-beacon", "heal-sparkle",
    ]
    for family in fx_families:
        for i in range(8):
            desc = f"special effect animation sprite for {family.replace('-', ' ')}"
            specs.append(mk("special-effects", family, f"{family}-f{i+1:02d}", desc, 96, 96, frame_index=i, frame_count=8))

    death_sequences = [
        ("zombie-collapse", "human-scale zombie collapse death animation frame, non-gory dust and ragged clothing"),
        ("zombie-ash", "human-scale zombie disintegration into grey ash and smoke, non-gory"),
        ("zombie-knockback", "human-scale zombie knocked backward death frame, readable body silhouette"),
        ("elite-zombie-fall", "larger human-scale elite zombie falling death frame, non-gory"),
        ("survivor-fall", "generic human survivor falling/knocked-down death animation frame, non-gory, not canonical"),
        ("survivor-kneel-fade", "generic human survivor kneeling and fading out death frame, non-gory, not canonical"),
        ("boss-zombie-burst", "oversized humanoid zombie boss death burst frame with smoke, non-gory"),
        ("burned-zombie-smoke", "human-scale zombie smoke-puff death frame after fire damage, non-gory"),
    ]
    for family, desc in death_sequences:
        for i in range(8):
            specs.append(mk("death-animations", family, f"{family}-f{i+1:02d}", desc, 112, 112, frame_index=i, frame_count=8))

    level_families = [
        "path-decal", "cover-marker", "shoreline-overlay", "hazard-floor", "checkpoint-gate",
        "loot-crate-cluster", "arena-boundary-posts",
    ]
    level_variants = ["variant-a", "variant-b", "variant-c", "variant-d"]
    for family in level_families:
        for variant in level_variants:
            desc = f"level-design terrain/prop sprite: {family.replace('-', ' ')}"
            specs.append(mk("level-design", family, f"{family}-{variant}", desc, 128, 128, variant=variant))

    if len(specs) != 500:
        raise AssertionError(f"Expected exactly 500 specs, got {len(specs)}")
    keys = [s["job_key"] for s in specs]
    if len(set(keys)) != len(keys):
        raise AssertionError("Duplicate job keys in generated spec list")
    return specs


def load_jobs() -> dict[str, Any]:
    specs = all_specs()
    specs_by_key = {spec["job_key"]: spec for spec in specs}
    if JOBS_PATH.exists():
        data = json.loads(JOBS_PATH.read_text(encoding="utf-8"))
    else:
        data = {
            "source": "PixelLab MCP create_map_object",
            "pack": "hmh-pixellab-sprite-expansion-500",
            "public_root": PUBLIC_ROOT.as_posix(),
            "created_at": now_iso(),
            "jobs": [],
        }
    existing = {job["job_key"]: job for job in data.get("jobs", []) if "job_key" in job}
    merged: list[dict[str, Any]] = []
    for spec in specs:
        job = existing.get(spec["job_key"], {})
        stable = {k: v for k, v in spec.items() if k not in {"args", "tool"}}
        job.update(stable)
        job["tool"] = spec["tool"]
        job["args"] = spec["args"]
        job.setdefault("status", "not_started")
        merged.append(job)
    data["jobs"] = merged
    data["updated_at"] = now_iso()
    data["desired_asset_count"] = 500
    return data


def save_jobs(data: dict[str, Any]) -> None:
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    JOBS_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")


def summarize(data: dict[str, Any]) -> dict[str, Any]:
    jobs = data.get("jobs", [])
    by_status = Counter(job.get("status", "unknown") for job in jobs)
    by_category = Counter(job.get("category", "unknown") for job in jobs)
    local_pngs = sum(len(job.get("local_images", []) or []) for job in jobs)
    complete_jobs = sum(1 for job in jobs if job.get("status") in {"complete", "completed", "review"} and job.get("local_images"))
    return {
        "desired_asset_count": data.get("desired_asset_count", 500),
        "ledger_jobs": len(jobs),
        "complete_jobs_with_pngs": complete_jobs,
        "local_png_count": local_pngs,
        "by_status": dict(sorted(by_status.items())),
        "by_category": dict(sorted(by_category.items())),
        "jobs_path": rel(JOBS_PATH),
        "runtime_manifest": rel(RUNTIME_MANIFEST_PATH) if RUNTIME_MANIFEST_PATH.exists() else None,
        "doc_path": rel(DOC_PATH) if DOC_PATH.exists() else None,
        "contact_dir": rel(CONTACT_DIR) if CONTACT_DIR.exists() else None,
        "blocked_reason": data.get("blocked_reason"),
    }


def init_manifest() -> None:
    data = load_jobs()
    save_jobs(data)
    print(json.dumps(summarize(data), indent=2))


async def preflight() -> int:
    data = load_jobs()
    save_jobs(data)
    balance_text = await get_balance_text()
    balance = parse_balance(balance_text)
    data["last_balance_check"] = {k: v for k, v in balance.items() if k != "raw"}
    if balance.get("looks_blocked") or int(balance.get("generations_remaining", 0) or 0) <= 0:
        data["blocked_reason"] = "PixelLab generation unavailable: subscription/remaining-generations check is blocked. Renew PixelLab to unlock MCP generation."
        save_jobs(data)
        print(balance_text)
        print("\nBLOCKED: PixelLab reports no usable generations for MCP generation. No jobs were queued.")
        return 2
    save_jobs(data)
    print(balance_text)
    print("\nOK: PixelLab has usable generations for this wave.")
    return 0


async def queue(limit: int | None, sleep_s: float) -> int:
    data = load_jobs()
    balance_text = await get_balance_text()
    balance = parse_balance(balance_text)
    remaining = int(balance.get("generations_remaining", 0) or 0)
    missing = [job for job in data["jobs"] if not job.get("object_id") and job.get("status") not in {"complete", "completed", "review"}]
    to_attempt = missing[: limit or len(missing)]
    if balance.get("looks_blocked") or remaining <= 0:
        data["last_balance_check"] = {k: v for k, v in balance.items() if k != "raw"}
        data["blocked_reason"] = "PixelLab generation unavailable: subscription expired or zero usable generations."
        save_jobs(data)
        print(balance_text)
        print(f"\nBLOCKED: wanted to queue {len(to_attempt)} jobs, but PixelLab reports {remaining} usable generations. No jobs were queued.")
        return 2
    if remaining < len(to_attempt):
        print(f"WARNING: remaining generations ({remaining}) are below requested queue attempt count ({len(to_attempt)}); queuing only {remaining}.")
        to_attempt = to_attempt[:remaining]
    queued = 0
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    async with pixellab_session() as session:
        for job in to_attempt:
            try:
                result = await session.call_tool(job["tool"], job["args"])
                text = txt(result)
                object_id = UUID_RE.search(text)
                raw_name = job["job_key"].replace(":", "__").replace("/", "_") + "__queue.txt"
                (RAW_DIR / raw_name).write_text(text, encoding="utf-8")
                job["raw_queue_response_path"] = rel(RAW_DIR / raw_name)
                job["object_id"] = object_id.group(0) if object_id else None
                job["queued_at"] = now_iso()
                st = status_from_text(text)
                if st in {"failed", "rate_limited", "blocked_subscription"}:
                    job["status"] = st
                    job["raw_queue_excerpt"] = text[:300]
                    print(f"{job['job_key']} {st} id={job.get('object_id')}")
                    if st == "rate_limited":
                        break
                    if st == "blocked_subscription":
                        data["blocked_reason"] = "PixelLab generation became blocked during queueing."
                        break
                elif job.get("object_id"):
                    job["status"] = "queued"
                    queued += 1
                    print(f"queued {job['job_key']} -> {job['object_id']}", flush=True)
                else:
                    job["status"] = "queue_unknown"
                    job["raw_queue_excerpt"] = text[:300]
                    print(f"{job['job_key']} queue_unknown", flush=True)
                save_jobs(data)
                await asyncio.sleep(sleep_s)
            except Exception as exc:
                msg = str(exc)
                job["status"] = "rate_limited" if "rate" in msg.lower() else "queue_error"
                job["queue_error"] = msg[:500]
                print(f"{job['job_key']} {job['status']}: {type(exc).__name__} {msg[:160]}", flush=True)
                save_jobs(data)
                if job["status"] == "rate_limited":
                    break
                await asyncio.sleep(max(3.0, sleep_s))
    print(json.dumps({"queued_now": queued, **summarize(data)}, indent=2))
    return 0


def download_object(object_id: str, dest: Path, headers: dict[str, str]) -> tuple[bool, list[Path], str | None]:
    url = f"https://api.pixellab.ai/mcp/objects/{object_id}/download"
    req = urllib.request.Request(url, headers={**headers, "User-Agent": "hmh-pixellab-sprite-expansion-500"})
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            payload = resp.read()
        dest.parent.mkdir(parents=True, exist_ok=True)
        if payload.startswith(PNG_SIG):
            dest.write_bytes(payload)
            return True, [dest], None
        if payload[:2] == b"PK":
            extracted: list[Path] = []
            target_dir = dest.with_suffix("")
            target_dir.mkdir(parents=True, exist_ok=True)
            with zipfile.ZipFile(dest.with_suffix(".zip"), "w") as placeholder:
                pass
            zip_path = dest.with_suffix(".zip")
            zip_path.write_bytes(payload)
            with zipfile.ZipFile(zip_path) as zf:
                png_names = [n for n in zf.namelist() if n.lower().endswith(".png")]
                for idx, name in enumerate(png_names):
                    short = target_dir / f"{idx+1:03d}-{Path(name).name}"
                    short.write_bytes(zf.read(name))
                    extracted.append(short)
            return bool(extracted), extracted, None
        return False, [], f"download was not PNG/ZIP; first bytes={payload[:16]!r}"
    except Exception as exc:
        return False, [], f"{type(exc).__name__}: {exc}"


def record_local_images(job: dict[str, Any], paths: list[Path]) -> None:
    images: list[dict[str, Any]] = []
    for path in paths:
        if not path.exists() or path.suffix.lower() != ".png":
            continue
        item: dict[str, Any] = {"local_path": rel(path), "bytes": path.stat().st_size}
        if Image:
            try:
                with Image.open(path) as img:
                    item.update({"width": img.width, "height": img.height, "mode": img.mode})
            except Exception as exc:
                item["probe_error"] = str(exc)
        images.append(item)
    if images:
        job["local_images"] = images


async def poll(limit: int | None, sleep_s: float) -> int:
    data = load_jobs()
    server = load_pixellab_server()
    candidates = [
        job for job in data["jobs"]
        if job.get("object_id") and not job.get("local_images") and job.get("status") not in {"complete", "completed", "review"}
    ]
    if limit is not None:
        candidates = candidates[:limit]
    checked = 0
    downloaded = 0
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    async with pixellab_session() as session:
        for job in candidates:
            try:
                result = await session.call_tool("get_map_object", {"object_id": job["object_id"]})
                text = txt(result)
                raw_name = job["job_key"].replace(":", "__").replace("/", "_") + "__poll.txt"
                (RAW_DIR / raw_name).write_text(text, encoding="utf-8")
                job["raw_poll_response_path"] = rel(RAW_DIR / raw_name)
                job["last_polled_at"] = now_iso()
                st = status_from_text(text)
                if st in {"completed", "review"}:
                    dest = OUT_ROOT / job["category"] / job["family"] / f"{job['slug']}.png"
                    ok, paths, err = download_object(job["object_id"], dest, server.get("headers", {}))
                    if ok:
                        record_local_images(job, paths)
                        job["status"] = "complete"
                        job["downloaded_at"] = now_iso()
                        downloaded += len(paths)
                        print(f"downloaded {job['job_key']} -> {len(paths)} png", flush=True)
                    else:
                        job["status"] = "download_pending"
                        job["download_error"] = err
                        print(f"pending download {job['job_key']}: {err}", flush=True)
                elif st in {"rate_limited", "blocked_subscription", "failed"}:
                    job["status"] = st
                    job["raw_poll_excerpt"] = text[:300]
                    print(f"{job['job_key']} {st}", flush=True)
                    if st == "rate_limited":
                        break
                else:
                    job["status"] = st if st != "unknown" else "processing"
                    print(f"processing {job['job_key']} status={job['status']}", flush=True)
                checked += 1
                save_jobs(data)
                await asyncio.sleep(sleep_s)
            except Exception as exc:
                msg = str(exc)
                job["status"] = "rate_limited" if "rate" in msg.lower() else "poll_error"
                job["poll_error"] = msg[:500]
                print(f"{job['job_key']} {job['status']}: {type(exc).__name__} {msg[:160]}", flush=True)
                save_jobs(data)
                if job["status"] == "rate_limited":
                    break
                await asyncio.sleep(max(2.0, sleep_s))
    print(json.dumps({"checked_now": checked, "downloaded_pngs_now": downloaded, **summarize(data)}, indent=2))
    return 0


def make_contact_sheets(data: dict[str, Any]) -> list[str]:
    if not Image or not ImageDraw:
        raise SystemExit("Pillow is required for contact-sheet packaging")
    CONTACT_DIR.mkdir(parents=True, exist_ok=True)
    created: list[str] = []
    groups: dict[str, list[tuple[str, Path]]] = {}
    for job in data["jobs"]:
        for img in job.get("local_images", []) or []:
            path = ROOT / img["local_path"]
            if path.exists():
                groups.setdefault(job["category"], []).append((job["slug"], path))
                groups.setdefault("all", []).append((job["slug"], path))
    if not groups:
        print("No local PNGs available for contact sheets yet.")
        return created
    try:
        font = ImageFont.truetype("arial.ttf", 9) if ImageFont else None
    except Exception:
        font = ImageFont.load_default() if ImageFont else None
    for category, tiles in sorted(groups.items()):
        thumb_w = thumb_h = 96
        label_h = 34
        pad = 8
        cols = 10 if category == "all" else 8
        rows = (len(tiles) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * (thumb_w + pad) + pad, rows * (thumb_h + label_h + pad) + pad), (18, 18, 28))
        draw = ImageDraw.Draw(sheet)
        for idx, (slug, path) in enumerate(tiles):
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
                draw.rectangle([x, y, x + thumb_w, y + thumb_h], outline=(255, 80, 80))
            draw.multiline_text((x, y + thumb_h + 2), slug[:28], fill=(235, 235, 245), font=font, spacing=1)
        out = CONTACT_DIR / f"hmh-pixellab-sprite-expansion-500-{category}.png"
        sheet.save(out)
        created.append(rel(out))
    data["contact_sheets"] = created
    save_jobs(data)
    return created


def write_runtime_manifest(data: dict[str, Any]) -> None:
    assets: list[dict[str, Any]] = []
    for job in data["jobs"]:
        images = job.get("local_images", []) or []
        if not images:
            continue
        assets.append({
            "jobKey": job["job_key"],
            "category": job["category"],
            "family": job["family"],
            "slug": job["slug"],
            "variant": job.get("variant"),
            "frameIndex": job.get("frame_index"),
            "frameCount": job.get("frame_count"),
            "status": job.get("status"),
            "images": [
                {
                    "src": "./" + img["local_path"].split("apps/portal/", 1)[-1],
                    "width": img.get("width"),
                    "height": img.get("height"),
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
        "desiredAssetCount": 500,
        "assets": assets,
        "contactSheets": ["./" + p.split("apps/portal/", 1)[-1] for p in data.get("contact_sheets", [])],
    }
    RUNTIME_MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    RUNTIME_MANIFEST_PATH.write_text(
        "export const HMH_PIXELLAB_SPRITE_EXPANSION_500 = Object.freeze("
        + json.dumps(payload, indent=2)
        + ");\n",
        encoding="utf-8",
    )


def write_doc(data: dict[str, Any]) -> None:
    summary = summarize(data)
    lines = [
        "# Hard Money Heroes — PixelLab Sprite Expansion 500",
        "",
        f"Generated/updated: {now_iso()}",
        "",
        "## Scope",
        "",
        "This PixelLab wave is a 500-sprite expansion for animation frames, weapons, bullets/projectiles, level-up/power-up sprites, menu UI, damage models, special effects, death-animation frames, and level-design sprites.",
        "",
        "All jobs are intended as one PixelLab `create_map_object` output per sprite asset/frame. Animation and death-animation packs are represented as sequential frame PNGs so they can be assembled into sprite sheets or runtime animation arrays later.",
        "",
        "## Current status",
        "",
        f"- Jobs manifest: `{summary['jobs_path']}`",
        f"- Runtime manifest: `{summary['runtime_manifest'] or 'pending until package has local PNGs'}`",
        f"- Contact sheets: `{summary['contact_dir'] or 'pending until package has local PNGs'}`",
        f"- Desired asset count: `{summary['desired_asset_count']}`",
        f"- Ledger jobs: `{summary['ledger_jobs']}`",
        f"- Complete jobs with PNGs: `{summary['complete_jobs_with_pngs']}`",
        f"- Local PNG count: `{summary['local_png_count']}`",
        f"- Job counts by status: `{json.dumps(summary['by_status'], sort_keys=True)}`",
        f"- Job counts by category: `{json.dumps(summary['by_category'], sort_keys=True)}`",
    ]
    if summary.get("blocked_reason"):
        lines += ["", "## Blocker", "", f"- {summary['blocked_reason']}"]
    lines += [
        "",
        "## Commands",
        "",
        "```bash",
        "python scripts/pixellab-hmh-sprite-expansion-500.py preflight",
        "python scripts/pixellab-hmh-sprite-expansion-500.py queue --limit 25",
        "python scripts/pixellab-hmh-sprite-expansion-500.py poll --limit 50",
        "python scripts/pixellab-hmh-sprite-expansion-500.py package",
        "python scripts/pixellab-hmh-sprite-expansion-500.py status",
        "```",
        "",
        "## QA rules",
        "",
        "- Reject assets with pseudo-text, logos, watermarks, official cryptocurrency marks, bad silhouettes, or unusable scale.",
        "- Menu UI assets must stay blank/no-text so real labels can be rendered by the game UI.",
        "- Active actor frames must visibly read as generic human survivors or zombies; do not use animals, vehicles, robots, mechs, or abstract actor proxies.",
        "- Treat this pack as source art until curated, budgeted, and smoke-tested in the runtime.",
        "- No API keys or auth headers are stored in this doc or the manifest.",
    ]
    DOC_PATH.parent.mkdir(parents=True, exist_ok=True)
    DOC_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def package() -> None:
    data = load_jobs()
    sheets = make_contact_sheets(data)
    write_runtime_manifest(data)
    write_doc(data)
    print(json.dumps({"contact_sheets": sheets, **summarize(data)}, indent=2))


def status() -> None:
    data = load_jobs()
    save_jobs(data)
    print(json.dumps(summarize(data), indent=2))


async def amain() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["init", "preflight", "queue", "poll", "package", "status", "doc"])
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--sleep", type=float, default=1.0)
    args = parser.parse_args()
    if args.command == "init":
        init_manifest()
        return 0
    if args.command == "preflight":
        return await preflight()
    if args.command == "queue":
        return await queue(args.limit, args.sleep)
    if args.command == "poll":
        return await poll(args.limit, args.sleep)
    if args.command == "package":
        package()
        return 0
    if args.command == "doc":
        data = load_jobs()
        write_doc(data)
        print(rel(DOC_PATH))
        return 0
    status()
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(amain()))

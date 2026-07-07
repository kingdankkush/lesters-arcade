#!/usr/bin/env python3
"""WO-102 PixelLab mega-prop queue/collect/contact-sheet pipeline.

Generates real transparent PixelLab candidates for the proof trio. It does not
create script-drawn placeholder art. Auth is read from ~/.claude.json and never
persisted. Runtime integration happens only after a candidate is selected and
captured in-game.
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
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_ROOT = Path("apps/portal/assets/generated/hmh-wo102-megaprops")
OUT_ROOT = ROOT / PUBLIC_ROOT
CANDIDATE_ROOT = OUT_ROOT / "candidates"
LEDGER = OUT_ROOT / "wo102-megaprops-ledger.json"
SHEET = OUT_ROOT / "wo102-megaprops-candidate-sheet.png"
UUID_RE = re.compile(r"[0-9a-fA-F-]{36}")
URL_RE = re.compile(r"https?://[^\s,)\]>'\"]+")
NO_TEXT = "no readable words, no letters, no numbers, no logos, no watermark"
STYLE = (
    "isometric high top-down 3/4 pixel art diorama, transparent background, "
    "hi-bit SNES Neo Geo painterly pixel detail, chunky readable silhouette, "
    "single dark outline only where it improves readability, Litecoin silver, cyan neon, warm ochre, burnt umber, "
    "baked soft shadow cast to the south-east, ground grime apron, combat-readable negative space, "
    + NO_TEXT
)

SPECS = [
    {
        "id": "wo102-noodle-bar-storefront",
        "category": "city-storefront",
        "count": 10,
        "prompt": (
            "one complete neon noodle-bar storefront block for a retro Web3 arcade wasteland town, "
            "deep awning/canopy band suitable for draw-over occlusion, glowing cyan/gold sign shapes without legible text, "
            "wet asphalt contact apron, steam vent, grime, cables, boarded side unit, composition faces south-east, "
            + STYLE
        ),
        "footprintTiles": {"w": 5.8, "h": 2.2},
        "groundContactY": 340,
        "bodyKind": "building",
        "placement": {"districtId": "ghost-town", "gridX": 40, "gridY": 2, "role": "landmark", "routeBeat": "arena"},
        "overSlice": {"x": 0, "y": 70, "w": 384, "h": 110, "anchor": "awning"},
        "r1Observation": "At seed 1337 near grid 40,2, a neon storefront block with baked wet-ground shadow replaces the old small saloon/storefront cluster.",
    },
    {
        "id": "wo102-forest-rock-outcrop",
        "category": "forest-cliff",
        "count": 10,
        "prompt": (
            "large forest rock outcrop and two-level cliff face boundary mega-prop, mossy stone, pine roots, small fern clusters, "
            "clear hard wall silhouette with open trail mouth on the south edge, baked shadow to south-east, no scattered random rocks, "
            + STYLE
        ),
        "footprintTiles": {"w": 5.2, "h": 2.8},
        "groundContactY": 344,
        "bodyKind": "cliff",
        "placement": {"districtId": "country-road", "gridX": 57, "gridY": 2, "role": "rock", "routeBeat": "loop"},
        "overSlice": {"x": 0, "y": 20, "w": 384, "h": 130, "anchor": "cliff-lip"},
        "r1Observation": "At seed 1337 near grid 57,2, the forest boundary reads as one authored cliff/rock wall rather than scattered small props.",
    },
    {
        "id": "wo102-farm-barn-silo-cluster",
        "category": "farmstead",
        "count": 10,
        "prompt": (
            "complete farm barn and silo cluster mega-prop, weathered red barn, silver silo, fence apron, hay bales, dirt road edge, "
            "warm evening light, readable farmstead landmark, composition faces south-east, baked shadow to south-east, "
            + STYLE
        ),
        "footprintTiles": {"w": 6.2, "h": 3.0},
        "groundContactY": 344,
        "bodyKind": "farmstead",
        "placement": {"districtId": "residential-edge", "gridX": 83, "gridY": 4, "role": "barn", "routeBeat": "loop"},
        "overSlice": None,
        "r1Observation": "At seed 1337 near grid 83,4, a barn+silo cluster with fence apron and SE baked shadow anchors the farm zone.",
    },
]


def load_server() -> dict[str, Any]:
    data = json.loads((Path.home() / ".claude.json").read_text(encoding="utf-8"))
    for project in data.get("projects", {}).values():
        server = project.get("mcpServers", {}).get("pixellab")
        if server:
            return server
    raise SystemExit("No PixelLab MCP config found in ~/.claude.json")


def result_text(result: Any) -> str:
    return "\n".join(getattr(chunk, "text", "") for chunk in (getattr(result, "content", []) or []))


def load_ledger() -> dict[str, Any]:
    if LEDGER.exists():
        return json.loads(LEDGER.read_text(encoding="utf-8"))
    return {"id": "hmh-wo102-megaprops", "status": "candidate-generation", "specs": SPECS, "jobs": []}


def save_ledger(ledger: dict[str, Any]) -> None:
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    LEDGER.write_text(json.dumps(ledger, indent=2) + "\n", encoding="utf-8")


def job_key(spec: dict[str, Any], index: int) -> str:
    return f"{spec['id']}__candidate-{index:02d}"


def jobs_by_key(ledger: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {job["jobKey"]: job for job in ledger.get("jobs", [])}


async def queue(limit: int | None) -> None:
    ledger = load_ledger()
    existing = jobs_by_key(ledger)
    server = load_server()
    queued = 0
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            for spec in SPECS:
                for i in range(1, spec["count"] + 1):
                    key = job_key(spec, i)
                    if existing.get(key, {}).get("objectId"):
                        continue
                    if limit is not None and queued >= limit:
                        break
                    prompt = f"{spec['prompt']} Candidate variation {i}: keep the same silhouette contract but vary silhouette details, lighting pockets, and material wear."
                    try:
                        response = await session.call_tool("create_map_object", {
                            "description": prompt,
                            "width": 384,
                            "height": 384,
                            "view": "high top-down",
                            "outline": "selective outline",
                            "shading": "detailed shading",
                        })
                        text = result_text(response)
                        match = UUID_RE.search(text)
                        existing[key] = {
                            "jobKey": key,
                            "specId": spec["id"],
                            "category": spec["category"],
                            "candidateIndex": i,
                            "objectId": match.group(0) if match else None,
                            "status": "queued" if match else "queue-response-without-id",
                            "queuedAt": int(time.time()),
                        }
                        queued += 1
                        print(f"queued {key} -> {existing[key]['objectId']}", flush=True)
                    except Exception as exc:
                        existing[key] = {"jobKey": key, "specId": spec["id"], "category": spec["category"], "candidateIndex": i, "status": "queue-error", "error": str(exc)[:240]}
                        print(f"queue error {key}: {exc}", flush=True)
                    time.sleep(1.0)
                if limit is not None and queued >= limit:
                    break
    ledger["jobs"] = list(existing.values())
    save_ledger(ledger)
    print_status(ledger)


def candidate_path(job: dict[str, Any]) -> Path:
    return CANDIDATE_ROOT / job["specId"] / f"candidate-{job['candidateIndex']:02d}.png"


def public_src(job: dict[str, Any]) -> str:
    return f"./assets/generated/hmh-wo102-megaprops/candidates/{job['specId']}/candidate-{job['candidateIndex']:02d}.png"


def download(url: str, dest: Path) -> bool:
    dest.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={"User-Agent": "hmh-wo102-megaprops"})
    with urllib.request.urlopen(request, timeout=120) as response:
        dest.write_bytes(response.read())
    return dest.exists() and dest.stat().st_size > 0


async def collect(limit: int | None) -> None:
    ledger = load_ledger()
    server = load_server()
    collected = 0
    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            for job in ledger.get("jobs", []):
                if job.get("status") == "complete" and candidate_path(job).exists():
                    continue
                if limit is not None and collected >= limit:
                    break
                object_id = job.get("objectId")
                if not object_id:
                    continue
                try:
                    response = await session.call_tool("get_map_object", {"object_id": object_id})
                    text = result_text(response)
                    urls = URL_RE.findall(text)
                    png_url = next((u for u in urls if ".png" in u.lower()), urls[0] if urls else None)
                    if not png_url or "processing" in text.lower():
                        job["status"] = "processing"
                        print(f"processing {job['jobKey']}", flush=True)
                        continue
                    dest = candidate_path(job)
                    if download(png_url, dest):
                        job["status"] = "complete"
                        job["src"] = public_src(job)
                        job["bytes"] = dest.stat().st_size
                        job["collectedAt"] = int(time.time())
                        collected += 1
                        print(f"saved {job['jobKey']} -> {dest.relative_to(ROOT)}", flush=True)
                except Exception as exc:
                    job["status"] = "collect-error"
                    job["error"] = str(exc)[:240]
                    print(f"collect error {job['jobKey']}: {exc}", flush=True)
                time.sleep(0.7)
    save_ledger(ledger)
    print_status(ledger, collected_now=collected)


def transparent_ok(path: Path) -> bool:
    im = Image.open(path).convert("RGBA")
    corners = [im.getpixel((0, 0))[3], im.getpixel((im.width - 1, 0))[3], im.getpixel((0, im.height - 1))[3], im.getpixel((im.width - 1, im.height - 1))[3]]
    return all(a == 0 for a in corners)


def contact_sheet() -> None:
    ledger = load_ledger()
    jobs = [job for job in ledger.get("jobs", []) if job.get("status") == "complete" and candidate_path(job).exists()]
    if not jobs:
        print("no complete jobs for sheet")
        return
    thumb = 160
    label_h = 28
    cols = 5
    rows = (len(jobs) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * thumb, rows * (thumb + label_h)), (20, 16, 12, 255))
    draw = ImageDraw.Draw(sheet)
    for n, job in enumerate(jobs):
        im = Image.open(candidate_path(job)).convert("RGBA")
        im.thumbnail((thumb, thumb), Image.Resampling.NEAREST)
        x = (n % cols) * thumb + (thumb - im.width) // 2
        y = (n // cols) * (thumb + label_h)
        sheet.alpha_composite(im, (x, y))
        ok = "A" if transparent_ok(candidate_path(job)) else "BAD_ALPHA"
        draw.text(((n % cols) * thumb + 4, y + thumb + 4), f"{job['specId'].replace('wo102-', '')[:15]} {job['candidateIndex']:02d} {ok}", fill=(255, 232, 77, 255))
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    sheet.save(SHEET)
    print(f"wrote {SHEET.relative_to(ROOT)} with {len(jobs)} candidates")


def print_status(ledger: dict[str, Any] | None = None, *, collected_now: int | None = None) -> None:
    ledger = ledger or load_ledger()
    by_status: dict[str, int] = {}
    by_spec: dict[str, dict[str, int]] = {}
    for job in ledger.get("jobs", []):
        status = job.get("status", "unknown")
        spec = job.get("specId", "unknown")
        by_status[status] = by_status.get(status, 0) + 1
        by_spec.setdefault(spec, {})[status] = by_spec.setdefault(spec, {}).get(status, 0) + 1
    payload = {"jobs": len(ledger.get("jobs", [])), "by_status": by_status, "by_spec": by_spec}
    if collected_now is not None:
        payload["collected_now"] = collected_now
    print(json.dumps(payload, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["queue", "collect", "status", "sheet"])
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()
    if args.action == "queue":
        asyncio.run(queue(args.limit))
    elif args.action == "collect":
        asyncio.run(collect(args.limit))
    elif args.action == "sheet":
        contact_sheet()
    else:
        print_status()


if __name__ == "__main__":
    main()

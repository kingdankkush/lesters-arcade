#!/usr/bin/env python3
"""Queue and collect Level 1 reference-style environment assets from PixelLab.

Reads the repo-owned queue at scripts/pixellab-hmh-level-one-environment-queue.json
and writes a resumable ledger plus downloaded PNG candidates under:
apps/portal/assets/generated/hmh-coherent-world/level1-reference-style/candidates/

Auth is read from ~/.claude.json and is never persisted.
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
QUEUE_PATH = ROOT / "scripts" / "pixellab-hmh-level-one-environment-queue.json"
PUBLIC_ROOT = Path("apps/portal/assets/generated/hmh-coherent-world/level1-reference-style/candidates")
OUT_ROOT = ROOT / PUBLIC_ROOT
LEDGER_PATH = OUT_ROOT / "pixellab-level1-asset-wave-ledger.json"
UUID_RE = re.compile(r"[0-9a-fA-F-]{36}")
URL_RE = re.compile(r"https?://[^\s,)\]>'\"]+")


def result_text(result: Any) -> str:
    return "\n".join(getattr(chunk, "text", "") for chunk in (getattr(result, "content", []) or []))


def load_server() -> dict[str, Any]:
    config_path = Path.home() / ".claude.json"
    data = json.loads(config_path.read_text(encoding="utf-8"))
    for project in data.get("projects", {}).values():
        server = project.get("mcpServers", {}).get("pixellab")
        if server:
            return server
    raise SystemExit("No PixelLab MCP config found in ~/.claude.json")


def load_queue() -> dict[str, Any]:
    return json.loads(QUEUE_PATH.read_text(encoding="utf-8"))


def load_ledger() -> dict[str, Any]:
    if LEDGER_PATH.exists():
        return json.loads(LEDGER_PATH.read_text(encoding="utf-8"))
    queue = load_queue()
    return {
        "queueId": queue["id"],
        "styleId": queue["styleId"],
        "sourceQueue": str(QUEUE_PATH.relative_to(ROOT)).replace("\\", "/"),
        "outputRoot": str(PUBLIC_ROOT).replace("\\", "/"),
        "jobs": [],
    }


def save_ledger(ledger: dict[str, Any]) -> None:
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    LEDGER_PATH.write_text(json.dumps(ledger, indent=2) + "\n", encoding="utf-8")


def local_png_path(job: dict[str, Any]) -> Path:
    return OUT_ROOT / job["category"] / f"{job['jobKey']}.png"


def public_png_src(job: dict[str, Any]) -> str:
    return f"./assets/generated/hmh-coherent-world/level1-reference-style/candidates/{job['category']}/{job['jobKey']}.png"


def ledger_jobs_by_key(ledger: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {job["jobKey"]: job for job in ledger.get("jobs", [])}


async def queue_jobs(limit: int | None) -> None:
    queue = load_queue()
    ledger = load_ledger()
    existing = ledger_jobs_by_key(ledger)
    server = load_server()
    queued = 0

    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            for source_job in queue["jobs"]:
                key = source_job["jobKey"]
                existing_job = existing.get(key)
                existing_id = existing_job.get(existing_job.get("idField", "objectId"), existing_job.get("objectId")) if existing_job else None
                if existing_id and existing_job.get("tool") == source_job["tool"]:
                    continue
                if limit is not None and queued >= limit:
                    break
                try:
                    response = await session.call_tool(source_job["tool"], source_job["args"])
                    text = result_text(response)
                    match = UUID_RE.search(text)
                    id_field = source_job.get("idField", "objectId")
                    existing[key] = {
                        "jobKey": key,
                        "category": source_job["category"],
                        "priority": source_job["priority"],
                        "targetAsset": source_job["targetAsset"],
                        "outputKey": source_job["outputKey"],
                        "tool": source_job["tool"],
                        "pollTool": source_job.get("pollTool", "get_map_object"),
                        "idField": id_field,
                        "args": source_job["args"],
                        "postProcess": source_job["postProcess"],
                        "acceptance": source_job["acceptance"],
                        id_field: match.group(0) if match else None,
                        "status": "queued" if match else "queue-response-without-id",
                        "queuedAt": int(time.time()),
                    }
                    queued += 1
                    generation_id = existing[key].get(id_field) or existing[key].get('objectId')
                    print(f"queued {key} -> {generation_id}", flush=True)
                except Exception as exc:  # keep batch resumable
                    existing[key] = {**existing.get(key, {}), "jobKey": key, "category": source_job["category"], "status": "queue-error", "error": str(exc)[:240]}
                    print(f"queue error {key}: {exc}", flush=True)
                time.sleep(1.0)

    ledger["jobs"] = list(existing.values())
    save_ledger(ledger)
    print(json.dumps({"queued_now": queued, "with_generation_ids": sum(1 for job in existing.values() if job.get(job.get("idField", "objectId")) or job.get("objectId")), "ledger_jobs": len(existing)}, indent=2))


def download_png(url: str, dest: Path) -> bool:
    dest.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={"User-Agent": "lesters-arcade-pixellab"})
    with urllib.request.urlopen(request, timeout=90) as response:
        dest.write_bytes(response.read())
    return dest.exists() and dest.stat().st_size > 0


async def collect_jobs(limit: int | None) -> None:
    ledger = load_ledger()
    server = load_server()
    collected = 0

    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            for job in ledger.get("jobs", []):
                if job.get("status") == "complete":
                    continue
                id_field = job.get("idField", "objectId")
                generation_id = job.get(id_field) or job.get("objectId")
                if not generation_id:
                    continue
                if limit is not None and collected >= limit:
                    break
                try:
                    poll_tool = job.get("pollTool", "get_map_object")
                    param_name = "tile_id" if poll_tool in {"get_tiles_pro", "get_isometric_tile"} else "object_id"
                    response = await session.call_tool(poll_tool, {param_name: generation_id})
                    text = result_text(response)
                    urls = URL_RE.findall(text)
                    download_url = next((url for url in urls if ".png" in url.lower()), urls[0] if urls else None)
                    if not download_url or "processing" in text.lower():
                        job["status"] = "processing"
                        print(f"processing {job['jobKey']}", flush=True)
                        continue
                    dest = local_png_path(job)
                    if download_png(download_url, dest):
                        job["status"] = "complete"
                        job["src"] = public_png_src(job)
                        job["bytes"] = dest.stat().st_size
                        job["collectedAt"] = int(time.time())
                        collected += 1
                        print(f"saved {job['jobKey']} -> {dest.relative_to(ROOT)}", flush=True)
                except Exception as exc:
                    job["status"] = "collect-error"
                    job["error"] = str(exc)[:240]
                    print(f"collect error {job['jobKey']}: {exc}", flush=True)
                time.sleep(0.6)

    save_ledger(ledger)
    print_status(ledger, collected_now=collected)


def print_status(ledger: dict[str, Any] | None = None, *, collected_now: int | None = None) -> None:
    ledger = ledger or load_ledger()
    by_status: dict[str, int] = {}
    for job in ledger.get("jobs", []):
        by_status[job.get("status", "unknown")] = by_status.get(job.get("status", "unknown"), 0) + 1
    payload = {"queueId": ledger.get("queueId"), "jobs": len(ledger.get("jobs", [])), "by_status": by_status}
    if collected_now is not None:
        payload["collected_now"] = collected_now
    print(json.dumps(payload, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["queue", "collect", "status"])
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()
    if args.action == "status":
        print_status()
    elif args.action == "queue":
        asyncio.run(queue_jobs(args.limit))
    elif args.action == "collect":
        asyncio.run(collect_jobs(args.limit))


if __name__ == "__main__":
    main()

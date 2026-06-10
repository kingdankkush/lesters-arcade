#!/usr/bin/env python3
"""Harvest completed HMH animations from PixelLab.

Fixes the broken poll in generate-hmh-complete-animations.py: that script
polled get_object(animation_id), but animation GROUPS are not objects (404).
The parent object's get_object response already contains the per-frame
backblaze URL template, e.g.:

  unknown: https://backblaze.pixellab.ai/.../animations/<uuid>/unknown/{i}.png  (i=0..4)

So: for every animated job, get_object(object_id), parse the frame URL
template + frame count, download every frame (NO auth header on backblaze —
it 403s with one), update the ledger to downloaded_frames.

Usage: python scripts/harvest-hmh-complete-animations.py
"""
from __future__ import annotations
import asyncio, json, re, sys, urllib.request
from pathlib import Path
import importlib.util

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "apps/portal/assets/generated/hmh-complete-animations"
LEDGER = OUT_DIR / "complete-animations-ledger.json"

spec = importlib.util.spec_from_file_location(
    "gen", ROOT / "scripts/generate-hmh-complete-animations.py")
gen = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gen)

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

# matches: <label>: https://backblaze...{i}.png  (i=0..4)
FRAME_TMPL_RE = re.compile(
    r"(https://backblaze\.pixellab\.ai/\S*animations/\S*?\{i\}\.png)\s*\(i=0\.\.(\d+)\)")


def fetch(url: str) -> bytes | None:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.read()
    except Exception as e:
        print(f"    fetch fail {url.split('/')[-2:]}: {type(e).__name__}")
        return None


async def main() -> None:
    server = gen.load_pixellab_server()
    led = json.loads(LEDGER.read_text())
    jobs = led["jobs"]
    pending = [(k, j) for k, j in jobs.items()
               if j.get("animated") and j.get("id")
               and j.get("status") not in {"downloaded_frames"}]
    print(f"{len(pending)} animated jobs to check")
    done = gone = notready = failed = 0

    async with streamablehttp_client(server["url"], headers=server.get("headers", {})) as (r, w, _):
        async with ClientSession(r, w) as s:
            await s.initialize()
            for i, (key, job) in enumerate(pending):
                try:
                    g = await s.call_tool("get_object", {"object_id": job["id"]})
                    t = gen.txt(g)
                except Exception as e:
                    print(f"  {key}: MCP error {type(e).__name__}")
                    failed += 1
                    continue
                low = t.lower()
                if "not found" in low or "error:" in low.split("\n")[0]:
                    job["status"] = "expired"
                    gone += 1
                    continue
                m = FRAME_TMPL_RE.search(t)
                if not m or "status: completed" not in low:
                    notready += 1
                    continue
                tmpl, last = m.group(1), int(m.group(2))
                dest = OUT_DIR / job["set"] / job["slug"]
                dest.mkdir(parents=True, exist_ok=True)
                frames = []
                ok = True
                for fi in range(last + 1):
                    data = fetch(tmpl.replace("{i}", str(fi)))
                    if not data:
                        ok = False
                        break
                    fp = dest / f"frame-{fi}.png"
                    fp.write_bytes(data)
                    frames.append(str(fp.relative_to(ROOT)))
                if ok and frames:
                    job["status"] = "downloaded_frames"
                    job["frames"] = frames
                    job["path"] = str(dest.relative_to(ROOT))
                    done += 1
                    print(f"  [{i+1}/{len(pending)}] {key}: {len(frames)} frames")
                else:
                    job["status"] = "failed_animation_download"
                    failed += 1
                if (done + failed) % 10 == 0:
                    LEDGER.write_text(json.dumps(led, indent=1))
                await asyncio.sleep(0.25)

    LEDGER.write_text(json.dumps(led, indent=1))
    print(f"\nDONE harvested={done} expired={gone} not_ready={notready} failed={failed}")


if __name__ == "__main__":
    asyncio.run(main())

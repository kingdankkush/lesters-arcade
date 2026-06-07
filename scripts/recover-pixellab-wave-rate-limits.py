#!/usr/bin/env python
"""Recover PixelLab production wave jobs that hit the API rate limit.

Queues one failed base job at a time, waits for PixelLab's active-job slot to
settle, polls/downloads, and repeats until the wave has no failed base jobs left
or the cycle cap is reached. No credentials are written; the called wave script
reads local MCP config itself.
"""
from __future__ import annotations

import json
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JOBS = ROOT / "apps/portal/assets/generated/hmh-isometric-pixellab/pixellab-isometric-wave-1-jobs.json"
WAVE = ROOT / "scripts/pixellab-hmh-isometric-production-wave.py"


def run(*args: str) -> None:
    print("$", sys.executable, WAVE.relative_to(ROOT).as_posix(), *args, flush=True)
    subprocess.run([sys.executable, str(WAVE), *args], cwd=ROOT, check=True)


def failed_count() -> int:
    data = json.loads(JOBS.read_text(encoding="utf-8"))
    return sum(1 for job in data["jobs"] if job.get("status") == "failed")


def main() -> None:
    max_cycles = int(sys.argv[1]) if len(sys.argv) > 1 else 25
    for cycle in range(1, max_cycles + 1):
        remaining = failed_count()
        print(f"=== recovery cycle {cycle}/{max_cycles}: failed jobs remaining={remaining} ===", flush=True)
        if remaining == 0:
            break
        run("queue-base", "--limit", "1")
        # PixelLab returned transient rate limits when map-object jobs were queued back-to-back.
        time.sleep(35)
        run("poll-until", "--timeout", "240", "--interval", "30")
        run("summary")
    run("package")
    run("summary")


if __name__ == "__main__":
    main()

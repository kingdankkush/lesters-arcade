from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "apps" / "hmh-reboot" / "assets" / "source" / "blender" / "hmh-character-pipeline.json"
EXPECTED_BLENDER_VERSION = "Blender 5.1.2"
TRACEBACK_MARKER = "Traceback (most recent call last)"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the deterministic HMH Blender mannequin atlas.")
    parser.add_argument("--verify-reproducible", action="store_true")
    parser.add_argument("--skip-scene", action="store_true", help="Reuse the committed .blend source.")
    return parser.parse_args()


def run_checked(command: list[str], log_path: Path, *, expected_file: Path | None = None) -> str:
    result = subprocess.run(command, cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=False)
    output = result.stdout or ""
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_path.write_text(output, encoding="utf-8")
    failed = result.returncode != 0 or TRACEBACK_MARKER in output
    if expected_file is not None and (not expected_file.exists() or expected_file.stat().st_size == 0):
        failed = True
    if failed:
        tail = "\n".join(output.splitlines()[-80:])
        raise RuntimeError(f"command failed ({result.returncode}): {' '.join(command)}\n{tail}")
    return output


def blend_signature_ok(path: Path) -> bool:
    header = path.read_bytes()[:7]
    return header == b"BLENDER" or header[:4] == bytes.fromhex("28b52ffd")


def metrics_path(manifest: dict) -> Path:
    return ROOT / manifest["atlas"]["outputDirectory"] / manifest["atlas"]["metrics"]


def metrics_fingerprint(metrics: dict) -> dict[str, str]:
    return {
        "sourceBlendSha256": metrics["sourceBlendSha256"],
        "rawFrameSetSha256": metrics["rawFrameSetSha256"],
        "atlasSha256": metrics["atlasSha256"],
        "metadataSha256": metrics["metadataSha256"],
    }


def export_and_pack(blender: Path, manifest: dict, run_label: str) -> dict:
    blend_path = ROOT / manifest["scene"]["sourceBlend"]
    export_script = ROOT / manifest["scripts"]["export"]
    run_checked(
        [
            str(blender),
            "--background",
            str(blend_path),
            "--python",
            str(export_script),
            "--",
            "--manifest",
            str(MANIFEST_PATH),
            "--repo-root",
            str(ROOT),
        ],
        ROOT / ".tmp" / f"hmh-reboot-phase19-blender-render-{run_label}.log",
    )
    run_checked(
        [sys.executable, str(ROOT / manifest["scripts"]["pack"]), "--manifest", str(MANIFEST_PATH), "--repo-root", str(ROOT)],
        ROOT / ".tmp" / f"hmh-reboot-phase19-blender-pack-{run_label}.log",
        expected_file=metrics_path(manifest),
    )
    metrics = json.loads(metrics_path(manifest).read_text(encoding="utf-8"))
    if metrics["status"] != "pass":
        raise RuntimeError(json.dumps(metrics, indent=2))
    return metrics


def main() -> None:
    args = parse_args()
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    configured = os.environ.get("BLENDER_EXECUTABLE", manifest["tool"]["executable"])
    blender = Path(configured)
    if not blender.exists():
        raise FileNotFoundError(f"Blender executable not found: {blender}")

    version = run_checked([str(blender), "--version"], ROOT / ".tmp" / "hmh-reboot-phase19-blender-version.log")
    first_line = version.splitlines()[0].strip() if version.splitlines() else ""
    if first_line != EXPECTED_BLENDER_VERSION:
        raise RuntimeError(f"expected {EXPECTED_BLENDER_VERSION!r}, received {first_line!r}")

    blend_path = ROOT / manifest["scene"]["sourceBlend"]
    if not args.skip_scene:
        blend_path.unlink(missing_ok=True)
        create_script = ROOT / manifest["scripts"]["createScene"]
        run_checked(
            [
                str(blender),
                "--background",
                "--factory-startup",
                "--python",
                str(create_script),
                "--",
                "--manifest",
                str(MANIFEST_PATH),
                "--output",
                str(blend_path),
            ],
            ROOT / ".tmp" / "hmh-reboot-phase19-blender-scene.log",
            expected_file=blend_path,
        )
    if not blend_signature_ok(blend_path):
        raise RuntimeError(f"invalid Blender source signature: {blend_path}")

    first = export_and_pack(blender, manifest, "run-1")
    if args.verify_reproducible:
        second = export_and_pack(blender, manifest, "run-2")
        first_fingerprint = metrics_fingerprint(first)
        second_fingerprint = metrics_fingerprint(second)
        if first_fingerprint != second_fingerprint:
            raise RuntimeError(json.dumps({"first": first_fingerprint, "second": second_fingerprint}, indent=2))
        final_metrics = second
        final_metrics["reproducibility"] = {
            "status": "pass",
            "runs": 2,
            "rawFrameSetSha256": second["rawFrameSetSha256"],
            "atlasSha256": second["atlasSha256"],
            "metadataSha256": second["metadataSha256"],
        }
    else:
        final_metrics = first
        final_metrics["reproducibility"] = {"status": "not-run", "runs": 1}
    metrics_path(manifest).write_bytes((json.dumps(final_metrics, indent=2) + "\n").encode("utf-8"))
    print(json.dumps({
        "status": "PASS",
        "blender": first_line,
        "pipelineId": manifest["id"],
        "frameCount": final_metrics["frameCount"],
        "atlasSize": final_metrics["atlasSize"],
        "atlasSha256": final_metrics["atlasSha256"],
        "reproducibility": final_metrics["reproducibility"],
    }))


if __name__ == "__main__":
    main()

"""Prove the external-model importer and the skinned exporter branch end to end.

Nothing this script produces ships. It generates a throwaway skinned GLB, imports
it twice, and renders it through the real production-hero pipeline into `.tmp/`,
so P-1 and P-2 can be accepted before the owner spends Tripo/Mixamo credits.

Three separate claims are checked:

1. The fixture generator is deterministic: the GLB's SHA-256 must equal the one
   pinned in `hmh-skinned-test-actor.json`. Pass `--update-sha` only when the
   fixture itself was deliberately changed.
2. The IMPORT is deterministic (P-1): two cold imports of the same GLB produce
   an identical canonical inspection, compared by `contentSha256` over bone
   names, per-object geometry and weight digests, action ranges, layers and
   materials. Raw `.blend` bytes are NOT compared — `save_as_mainfile` embeds
   session state, and no pipeline in this repo has ever hashed them.
3. The RENDER is deterministic (P-2): the unmodified hero runner renders the
   imported actor twice inside one Blender session and enforces the manifest's
   reproducibility budget; `--verify-reproducible` then rebuilds the whole
   thing cold and requires byte-identical decoded frames and artefacts.

    npm run assets:hmh:skinned-test
    npm run assets:hmh:skinned-test:verify
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

from PIL import Image

from hmh_pipeline_lock import exclusive_pipeline_lock


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "apps/hmh-reboot/assets/source/blender/hmh-skinned-test-actor.json"
FIXTURE_PATH = ROOT / "scripts/hmh-blender/create-hmh-skinned-test-actor.py"
IMPORTER_PATH = ROOT / "scripts/hmh-blender/import-hmh-external-model.py"
HERO_RUNNER_PATH = ROOT / "scripts/run-hmh-production-hero-pilot.py"
WORK_ROOT = ROOT / ".tmp/hmh-skinned-test-actor"
BLENDER = Path(os.environ.get("BLENDER_EXECUTABLE", r"D:\Apps\Blender\blender.exe"))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Throwaway skinned-actor pipeline gate.")
    parser.add_argument("--verify-reproducible", action="store_true")
    parser.add_argument(
        "--update-sha",
        action="store_true",
        help="Re-pin sourceModel.sourceSha256 after a deliberate fixture change.",
    )
    return parser.parse_args()


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_lf_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def run_checked(command: list[str], label: str) -> str:
    completed = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace")
    combined = completed.stdout + completed.stderr
    if completed.returncode != 0 or "Traceback (most recent call last)" in combined:
        raise RuntimeError(f"{label} failed ({completed.returncode})\n{combined[-12000:]}")
    return combined


def blender_version() -> str:
    completed = subprocess.run([str(BLENDER), "--version"], capture_output=True, text=True, encoding="utf-8", errors="replace")
    if completed.returncode != 0:
        raise RuntimeError(completed.stdout + completed.stderr)
    return completed.stdout.splitlines()[0].replace("Blender ", "").strip()


def decoded_frame_hashes(root: Path) -> dict:
    """Hash the decoded pixels, not the PNG bytes: encoder output can drift."""
    hashes = {}
    for path in sorted(root.rglob("*.png")):
        with Image.open(path) as image:
            hashes[str(path.relative_to(root)).replace("\\", "/")] = hashlib.sha256(image.convert("RGBA").tobytes()).hexdigest()
    return hashes


def generated_artifact_hashes(root: Path) -> dict:
    hashes = {}
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        # metrics.json carries sourceBlendSha256, and a .blend is not a
        # byte-stable artefact. Everything the runtime would consume is.
        if path.name.endswith("-metrics.json"):
            continue
        hashes[str(path.relative_to(root)).replace("\\", "/")] = sha256_file(path)
    return hashes


def build_fixture(manifest: dict, *, update_sha: bool) -> dict:
    glb_path = ROOT / manifest["pilots"][0]["sourceModel"]["path"]
    report_path = WORK_ROOT / "fixture-report.json"
    run_checked([
        str(BLENDER), "--background", "--factory-startup", "--python", str(FIXTURE_PATH), "--",
        "--output", str(glb_path), "--report-output", str(report_path),
    ], "skinned fixture generation")
    report = read_json(report_path)
    pinned = manifest["pilots"][0]["sourceModel"]["sourceSha256"]
    if report["sha256"] != pinned:
        if not update_sha:
            raise RuntimeError(
                "The throwaway fixture stopped being byte-reproducible.\n"
                f"  manifest sourceSha256: {pinned}\n"
                f"  generated:             {report['sha256']}\n"
                "Re-run with --update-sha only if the fixture generator was deliberately changed."
            )
        text = MANIFEST_PATH.read_text(encoding="utf-8").replace(pinned, report["sha256"])
        MANIFEST_PATH.write_text(text, encoding="utf-8", newline="")
        print(f"Re-pinned sourceModel.sourceSha256 to {report['sha256']}")
    return report


def import_twice(manifest: dict) -> dict:
    """P-1 acceptance: two cold imports agree on every byte that matters."""
    actor_id = manifest["pilots"][0]["actorId"]
    inspections = {}
    for label in ("a", "b"):
        blend_path = WORK_ROOT / f"import-{label}.blend"
        inspection_path = WORK_ROOT / f"import-{label}-inspection.json"
        run_checked([
            str(BLENDER), "--background", "--factory-startup", "--python", str(IMPORTER_PATH), "--",
            "--manifest", str(MANIFEST_PATH), "--actor-id", actor_id,
            "--output-blend", str(blend_path), "--inspection-output", str(inspection_path),
        ], f"external model import {label}")
        inspections[label] = read_json(inspection_path)
    first, second = inspections["a"], inspections["b"]
    if first["contentSha256"] != second["contentSha256"]:
        differing = sorted(key for key in first if first.get(key) != second.get(key))
        raise RuntimeError(
            "Importing the same model twice produced different content: "
            f"{first['contentSha256']} != {second['contentSha256']}; differing keys={differing}"
        )
    return first


def render_pass(manifest: dict) -> dict:
    """Drive the unmodified production-hero runner from the throwaway manifest."""
    generated_root = ROOT / manifest["atlas"]["outputDirectory"]
    run_checked([
        sys.executable, str(HERO_RUNNER_PATH),
        "--manifest", str(MANIFEST_PATH),
        "--output-root", str(generated_root),
    ], "skinned actor render")
    raw_root = ROOT / manifest["render"]["rawOutputDirectory"]
    return {
        "frames": decoded_frame_hashes(raw_root),
        "artifacts": generated_artifact_hashes(generated_root),
    }


def main() -> None:
    args = parse_args()
    if not BLENDER.exists():
        raise RuntimeError(f"Blender not found: {BLENDER}")
    manifest = read_json(MANIFEST_PATH)
    required_version = manifest["scene"]["blenderVersion"]
    actual_version = blender_version()
    if actual_version != required_version:
        raise RuntimeError(f"Blender version mismatch: expected {required_version}, got {actual_version}")
    if manifest["classification"] != "pipeline-test-never-ship":
        raise RuntimeError("The skinned test manifest must stay classified as a pipeline test")
    for value in (manifest["render"]["rawOutputDirectory"], manifest["scene"]["sourceBlend"], manifest["atlas"]["outputDirectory"]):
        if not value.startswith(".tmp/"):
            raise RuntimeError(f"Throwaway output escaped .tmp: {value}")

    WORK_ROOT.mkdir(parents=True, exist_ok=True)
    fixture = build_fixture(manifest, update_sha=args.update_sha)
    inspection = import_twice(manifest)
    first_pass = render_pass(manifest)

    summary = {
        "status": "pass",
        "blenderVersion": actual_version,
        "fixtureSha256": fixture["sha256"],
        "fixtureBytes": fixture["bytes"],
        "fixtureActions": fixture["actions"],
        "importContentSha256": inspection["contentSha256"],
        "importObjectsByLayer": inspection["objectsByLayer"],
        "importBones": inspection["bones"],
        "renderedFrameCount": len(first_pass["frames"]),
        "artifactCount": len(first_pass["artifacts"]),
        "reproducibleAcrossColdRebuild": None,
    }

    if args.verify_reproducible:
        snapshot = WORK_ROOT / "verify-first-pass"
        if snapshot.exists():
            shutil.rmtree(snapshot)
        snapshot.mkdir(parents=True, exist_ok=True)
        write_lf_json(snapshot / "frames.json", first_pass["frames"])
        write_lf_json(snapshot / "artifacts.json", first_pass["artifacts"])
        build_fixture(manifest, update_sha=False)
        import_twice(manifest)
        second_pass = render_pass(manifest)
        drifted_frames = sorted(
            name for name, digest in first_pass["frames"].items() if second_pass["frames"].get(name) != digest
        )
        drifted_artifacts = sorted(
            name for name, digest in first_pass["artifacts"].items() if second_pass["artifacts"].get(name) != digest
        )
        if drifted_frames or drifted_artifacts:
            raise RuntimeError(
                "The skinned actor is not reproducible across a cold rebuild: "
                f"frames={drifted_frames[:8]} artifacts={drifted_artifacts[:8]}"
            )
        summary["reproducibleAcrossColdRebuild"] = True
        summary["verifiedFrameCount"] = len(second_pass["frames"])

    write_lf_json(WORK_ROOT / "skinned-test-report.json", summary)
    print(json.dumps(summary, sort_keys=True))


if __name__ == "__main__":
    try:
        with exclusive_pipeline_lock(ROOT / ".tmp" / "hmh-skinned-test-pipeline.lock", "HMH skinned test pipeline"):
            main()
    except Exception as error:
        print(f"HMH skinned test pipeline failed: {error}", file=sys.stderr)
        raise

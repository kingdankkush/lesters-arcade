from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

import hmh_tripo_props as props


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render and pack owner-supplied HMH Tripo GLBs as a private projection-only candidate")
    parser.add_argument("--source-root", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--blender", required=True)
    parser.add_argument("--ids", nargs="*", help="Optional two-digit source IDs; omission selects the full 01..56 roster")
    parser.add_argument("--yaw", type=int, choices=(0, 90, 180, 270), help="Private orientation pilot override for selected source IDs")
    return parser.parse_args()


def write_new_json(path: Path, value: Any) -> None:
    if path.exists():
        raise ValueError(f"refusing to overwrite existing output file: {path}")
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")


def write_new_bytes(path: Path, value: bytes) -> None:
    if path.exists():
        raise ValueError(f"refusing to overwrite existing output file: {path}")
    path.write_bytes(value)


def parse_ids(values: list[str] | None) -> list[str]:
    if values is None:
        return [f"{number:02d}" for number in range(1, 57)]
    flattened = [part.strip() for value in values for part in value.split(",") if part.strip()]
    if not flattened:
        raise ValueError("--ids was provided without a pilot roster")
    required = {f"{number:02d}" for number in range(1, 57)}
    if any(value not in required for value in flattened):
        raise ValueError("--ids values must be literal two-digit source IDs in 01..56")
    if len(set(flattened)) != len(flattened):
        raise ValueError("--ids contains a duplicate source ID")
    return flattened


def build_render_recipe() -> dict[str, Any]:
    return {
        "engine": "BLENDER_EEVEE",
        "frameSize": [256, 256],
        "cameraType": "ORTHO",
        "cameraPitchAxis": "positive-X",
        "cameraPitchDegrees": 45.0,
        "cameraYawDegrees": 0.0,
        "sourceYawDegrees": {source_id: 90 for source_id in ("12", "13", "18", "20", "27", "33", "41", "44", "45", "52", "56")},
        "occupancy": 0.78,
        "exposure": 0.0,
        "transparent": True,
        "staticFramesOnly": True,
        "preserveOriginalMaterials": True,
    }


def native_render_tasks(blender: str, renderer: Path, request: Path, output: Path, source_ids: list[str]) -> list[dict[str, Any]]:
    allowed = {f"{value:02d}" for value in range(1, 57)}
    if not source_ids or any(source_id not in allowed for source_id in source_ids) or len(set(source_ids)) != len(source_ids):
        raise ValueError("native task source IDs must be unique literal IDs in 01..56")
    tasks = []
    for label in ("a", "b"):
        for source_id in source_ids:
            name = f"{label}-{source_id}"
            raw = output / f"native-{name}"
            report = output / f"native-{name}-report.json"
            tasks.append({
                "pass": label, "sourceId": source_id, "label": name, "raw": raw, "report": report,
                "command": [blender, "--background", "--factory-startup", "--disable-autoexec",
                            "--python-exit-code", "1", "--python", str(renderer), "--",
                            "--manifest", str(request), "--raw-output", str(raw),
                            "--report-output", str(report), "--source-id", source_id],
            })
    return tasks


def source_hashes(rows: list[dict[str, Any]]) -> dict[str, str]:
    return {row["id"]: props.sha256_file(Path(row["sourcePath"])) for row in rows}


def script_hashes(script_dir: Path) -> dict[str, str]:
    paths = {
        "intakeAndPacker": script_dir / "hmh_tripo_props.py",
        "nativeRenderer": script_dir / "hmh-blender" / "export-hmh-tripo-props.py",
        "orchestrator": Path(__file__).resolve(),
    }
    return {name: props.sha256_file(path) for name, path in paths.items()}


def process_record(command: list[str], output: Path, label: str) -> dict[str, Any]:
    stdout_path = output / f"blender-{label}.stdout.log"
    stderr_path = output / f"blender-{label}.stderr.log"
    environment = dict(os.environ)
    environment["PYTHONHASHSEED"] = "0"
    try:
        result = subprocess.run(
            command,
            cwd=str(Path(__file__).resolve().parents[1]),
            env=environment,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
            shell=False,
        )
        write_new_bytes(stdout_path, result.stdout)
        write_new_bytes(stderr_path, result.stderr)
        return {
            "label": label,
            "started": True,
            "command": command,
            "returnCode": result.returncode,
            "stdoutLog": stdout_path.name,
            "stdoutSha256": props.sha256_file(stdout_path),
            "stdout": result.stdout.decode("utf-8", errors="replace"),
            "stderrLog": stderr_path.name,
            "stderrSha256": props.sha256_file(stderr_path),
            "stderr": result.stderr.decode("utf-8", errors="replace"),
        }
    except OSError as error:
        diagnostic = str(error).encode("utf-8", errors="replace")
        write_new_bytes(stdout_path, b"")
        write_new_bytes(stderr_path, diagnostic)
        return {
            "label": label,
            "started": False,
            "command": command,
            "launchError": str(error),
            "stdoutLog": stdout_path.name,
            "stdoutSha256": props.sha256_file(stdout_path),
            "stdout": "",
            "stderrLog": stderr_path.name,
            "stderrSha256": props.sha256_file(stderr_path),
            "stderr": str(error),
        }


def read_report(path: Path, expected_ids: list[str]) -> dict[str, Any]:
    if not path.is_file():
        raise ValueError(f"missing native Blender report: {path.name}")
    report = json.loads(path.read_text(encoding="utf-8"))
    if report.get("status") != "pass" or report.get("runtimeAuthority") != "projection-only":
        raise ValueError(f"native Blender report did not pass projection-only checks: {path.name}")
    frames = report.get("frames")
    if not isinstance(frames, list) or [frame.get("sourceId") for frame in frames] != expected_ids:
        raise ValueError(f"native Blender report roster differs from the requested source IDs: {path.name}")
    return report


def main() -> int:
    args = parse_args()
    selected_ids = parse_ids(args.ids)
    source_root = Path(args.source_root).resolve(strict=True)
    output = Path(args.output).resolve()
    if output.exists():
        raise ValueError("requested candidate output already exists; refusing to delete or overwrite it")
    if not output.parent.is_dir():
        raise ValueError("requested candidate output parent directory does not exist")

    all_rows = props.ingest_catalog(source_root, expected_count=56)
    by_id = {row["id"]: row for row in all_rows}
    selected_rows = [by_id[asset_id] for asset_id in selected_ids]
    output.mkdir(parents=False, exist_ok=False)

    script_dir = Path(__file__).resolve().parent
    renderer = script_dir / "hmh-blender" / "export-hmh-tripo-props.py"
    catalog_path = source_root / "catalog.json"
    before_hashes = source_hashes(all_rows)
    scripts = script_hashes(script_dir)
    scope = "full-56-candidate" if len(selected_ids) == 56 else "subset-visual-review-only"
    recipe = build_render_recipe()
    if getattr(args, "yaw", None) is not None:
        recipe["sourceYawDegrees"] = {source_id: args.yaw for source_id in selected_ids}
    request = {
        "pipelineId": "hmh-tripo-static-props/v1",
        "classification": "native-render-candidate",
        "runtimeAuthority": "projection-only",
        "certified": False,
        "sourceRoot": str(source_root),
        "sourceCatalog": str(catalog_path),
        "sourceCatalogSha256": props.sha256_file(catalog_path),
        "rosterScope": scope,
        "selectedIds": selected_ids,
        "render": recipe,
        "assets": [
            {
                "sourceId": row["id"],
                "assetId": f"tripo-{row['id']}",
                "name": row["name"],
                "category": row["category"],
                "sourcePath": row["sourcePath"],
                "sourceModelSha256": row["glb_sha256"],
                "bytes": row["bytes"],
                "cameraYawDegrees": props.render_recipe_for_asset(recipe, row["id"])["cameraYawDegrees"],
                "runtimeApproved": False,
            }
            for row in selected_rows
        ],
    }
    request_path = output / "render-request.json"
    write_new_json(request_path, request)

    processes: list[dict[str, Any]] = []
    reports: list[dict[str, Any]] = []
    comparison: dict[str, Any] | None = None
    after_hashes: dict[str, str] = {}
    package_manifest_hash: str | None = None
    failure: str | None = None

    tasks = native_render_tasks(args.blender, renderer, request_path, output, selected_ids)
    for task in tasks:
        processes.append(process_record(task["command"], output, task["label"]))
        if not processes[-1].get("started") or processes[-1].get("returnCode") != 0:
            break

    try:
        failed_processes = [record["label"] for record in processes if not record.get("started") or record.get("returnCode") != 0]
        if failed_processes:
            raise ValueError(f"native Blender process failure: {failed_processes}")
        native_reports = []
        for task in tasks:
            report = read_report(task["report"], [task["sourceId"]])
            frame = report["frames"][0]
            image = task["raw"] / f"{task['sourceId']}.png"
            if props.sha256_file(image) != frame.get("renderFileSha256"):
                raise ValueError("native source frame hash changed before collection")
            requested_yaw = props.render_recipe_for_asset(recipe, task["sourceId"])["cameraYawDegrees"]
            if abs(frame.get("cameraYawDegrees", -999) - requested_yaw) > 0.001:
                raise ValueError("evaluated native camera yaw differs from the requested source facing")
            native_reports.append(report)
        builds = {(report.get("blenderVersion"), report.get("blenderBuildHash"), report.get("blenderBuildDate")) for report in native_reports}
        if len(builds) != 1 or not all(next(iter(builds))):
            raise ValueError("isolated native sources did not use one identical exact Blender build")
        for label in ("a", "b"):
            raw_dir = output / f"raw-{label}"
            raw_dir.mkdir(exist_ok=False)
            phase = [(task, report) for task, report in zip(tasks, native_reports) if task["pass"] == label]
            combined = {**phase[0][1], "frameCount": len(phase), "frames": [],
                        "aggregation": "one fresh native Blender process per source",
                        "sourceReportFiles": [task["report"].name for task, _ in phase]}
            for task, report in phase:
                shutil.copyfile(task["raw"] / f"{task['sourceId']}.png", raw_dir / f"{task['sourceId']}.png")
                combined["frames"].extend(report["frames"])
            write_new_json(output / f"blender-{label}-report.json", combined)
            reports.append(combined)
        versions = [
            (report.get("blenderVersion"), report.get("blenderBuildHash"), report.get("blenderBuildDate"))
            for report in reports
        ]
        if versions[0] != versions[1] or not all(versions[0]):
            raise ValueError("A/B renders did not report one identical exact Blender build")
        pivots_a = {frame["sourceId"]: frame.get("pivot") for frame in reports[0]["frames"]}
        pivots_b = {frame["sourceId"]: frame.get("pivot") for frame in reports[1]["frames"]}
        if pivots_a != pivots_b:
            raise ValueError("A/B renders produced different measured ground pivots")

        comparison = props.compare_frames(output / "raw-a", output / "raw-b", selected_ids)
        if not comparison["exact"]:
            raise ValueError(f"A/B decoded RGBA differs for source IDs {comparison['changedFrames']}")

        packed_rows = [{**row, "pivot": pivots_a[row["id"]]} for row in selected_rows]
        package = output / "package"
        props.pack_frames(packed_rows, output / "raw-a", package, max_size=2048, padding=4)
        package_manifest_hash = props.sha256_file(package / "manifest.json")
    except Exception as error:
        failure = f"{type(error).__name__}: {error}"
    finally:
        try:
            after_hashes = source_hashes(all_rows)
        except Exception as error:
            after_hashes = {}
            suffix = f"{type(error).__name__}: {error}"
            failure = f"{failure}; post-render source hashing failed: {suffix}" if failure else f"post-render source hashing failed: {suffix}"

    unchanged = bool(after_hashes) and before_hashes == after_hashes
    if not unchanged:
        message = "owner-supplied source GLB hashes changed during the candidate process"
        failure = f"{failure}; {message}" if failure else message

    blender_identity = None
    material_concerns: list[dict[str, Any]] = []
    if reports:
        blender_identity = {
            "version": reports[0]["blenderVersion"],
            "versionTuple": reports[0]["blenderVersionTuple"],
            "buildHash": reports[0]["blenderBuildHash"],
            "buildDate": reports[0]["blenderBuildDate"],
        }
        for frame in reports[0]["frames"]:
            for concern in frame.get("materialConcerns", []):
                material_concerns.append({"sourceId": frame["sourceId"], **concern})

    provenance = {
        "pipelineId": "hmh-tripo-static-props/v1",
        "classification": "native-render-candidate",
        "runtimeAuthority": "projection-only",
        "certified": False,
        "rosterScope": scope,
        "selectedIds": selected_ids,
        "sourceCatalog": str(catalog_path),
        "sourceCatalogSha256": props.sha256_file(catalog_path),
        "renderRequestSha256": props.sha256_file(request_path),
        "scriptSha256": scripts,
        "sourceModelSha256Before": before_hashes,
        "sourceModelSha256After": after_hashes,
        "sourceModelsUnchanged": unchanged,
        "blender": blender_identity,
        "processes": processes,
        "materialConcernsPreservedNotAltered": material_concerns,
        "noGameplayIdsInferredFromCosmetics": True,
        "noAnimatedActors": True,
        "settlementLive": False,
    }
    write_new_json(output / "provenance.json", provenance)

    status = "failed" if failure else "pass"
    receipt = {
        "status": status,
        "pipelineId": "hmh-tripo-static-props/v1",
        "classification": "native-render-candidate",
        "runtimeAuthority": "projection-only",
        "certified": False,
        "canonicalAdoption": False,
        "rosterScope": scope,
        "selectedIds": selected_ids,
        "fullRosterComplete": status == "pass" and len(selected_ids) == 56,
        "subsetIsNeverFullComplete": len(selected_ids) != 56,
        "failure": failure,
        "comparison": comparison,
        "sourceCatalogSha256": props.sha256_file(catalog_path),
        "renderRequestSha256": props.sha256_file(request_path),
        "scriptSha256": scripts,
        "sourceModelSha256Before": before_hashes,
        "sourceModelSha256After": after_hashes,
        "sourceModelsUnchanged": unchanged,
        "blender": blender_identity,
        "processes": processes,
        "rawDirectoriesRetained": ["raw-a", "raw-b"],
        "packageManifestSha256": package_manifest_hash,
        "materialConcernsPreservedNotAltered": material_concerns,
        "requiresParentVisualReviewAndCanonicalAdoption": True,
        "settlementLive": False,
    }
    write_new_json(output / "receipt.json", receipt)
    print(json.dumps({"status": status, "output": str(output), "rosterScope": scope}, sort_keys=True))
    return 1 if failure else 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"hmh Tripo props candidate failed before receipt finalization: {type(error).__name__}: {error}", file=sys.stderr)
        raise

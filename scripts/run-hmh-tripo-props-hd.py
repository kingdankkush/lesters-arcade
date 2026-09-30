"""Render and pack the HD Tripo prop package (pipeline hmh-tripo-static-props-hd/v1).

Two phases, each idempotent per item:

  render  One fresh --factory-startup --disable-autoexec Blender process per
          asset and per pass (A and B). Both passes must decode to identical RGBA
          before an item is accepted. Every item gets its own directory under
          <work>/renders/<assetId>/ with request.json, raw-a/, raw-b/, reports,
          closed stdout/stderr logs and receipt.json (source SHA-256 before/after,
          request hash, render file hashes, Blender identity, process records).

  pack    Re-validates both delivery catalogs, re-checks every item receipt and
          render hash, applies the contact-sheet review (rejected items are
          excluded), packs class-grouped 2048 px lossless WebP pages plus @0.5x
          variants, writes the manifest and labelled contact sheets.

Usage (Windows repo checkout):

  python scripts/run-hmh-tripo-props-hd.py render --work <workdir> --blender D:/Apps/Blender/blender.exe
  python scripts/run-hmh-tripo-props-hd.py render --work <workdir> --blender ... --ids b2-51 --yaw b2-51=180 --replace
  python scripts/run-hmh-tripo-props-hd.py pack --work <workdir> \
      --package apps/portal/assets/generated/hmh-reboot-tripo-props-hd \
      --receipts docs/2.0/receipts/tripo-props-hd-20260930 \
      --review docs/2.0/receipts/tripo-props-hd-20260930/review.json

Default source roots are the owner's two delivery folders (read-only). No paid
asset generation happens here; only re-rendering of models already on disk.
Projection-only art; nothing here can alter gameplay authority.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

import hmh_tripo_props as base
import hmh_tripo_props_hd as hd

DEFAULT_B1 = r"C:\Users\just_\Desktop\Projects\LestersArcade-Assets\Tripo-Environment-Powerups\delivery\HMH-3D-Models"
DEFAULT_B2 = r"C:\Users\just_\Desktop\Projects\LestersArcade-Assets\Tripo-Level-Design-Batch-2\delivery\HMH-Level-Design-Batch-2-Models"
SCRIPT_DIR = Path(__file__).resolve().parent
RENDERER = SCRIPT_DIR / "hmh-blender" / "export-hmh-tripo-props-hd.py"
BASE_RENDERER = SCRIPT_DIR / "hmh-blender" / "export-hmh-tripo-props.py"
MANIFEST_NAME = "hmh-tripo-props-hd.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("render", "pack"):
        p = sub.add_parser(name)
        p.add_argument("--work", required=True, help="Work directory holding per-item render directories")
        p.add_argument("--b1-root", default=DEFAULT_B1)
        p.add_argument("--b2-root", default=DEFAULT_B2)
        if name == "render":
            p.add_argument("--blender", required=True)
            p.add_argument("--ids", nargs="*", help="Namespaced asset IDs (b1-NN, b2-NN); omit for all 96")
            p.add_argument("--yaw", action="append", default=[], help="Per-item yaw override, e.g. b2-51=180")
            p.add_argument("--replace", action="store_true", help="Replace an item's existing render directory")
            p.add_argument("--single-pass", action="store_true", help="Skip the B pass (no A/B exactness proof)")
        else:
            p.add_argument("--package", required=True)
            p.add_argument("--receipts", required=True)
            p.add_argument("--review", help="review.json; when given, every rendered item needs an entry")
    return parser.parse_args()


def write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")


def script_hashes() -> dict[str, str]:
    return {
        "intakeAndPacker": base.sha256_file(SCRIPT_DIR / "hmh_tripo_props_hd.py"),
        "baseIntake": base.sha256_file(SCRIPT_DIR / "hmh_tripo_props.py"),
        "nativeRenderer": base.sha256_file(RENDERER),
        "baseRenderer": base.sha256_file(BASE_RENDERER),
        "orchestrator": base.sha256_file(Path(__file__).resolve()),
    }


def ingest_all(args: argparse.Namespace) -> dict[str, dict[str, Any]]:
    rows = hd.ingest_batch("b1", args.b1_root) + hd.ingest_batch("b2", args.b2_root)
    return {row["assetId"]: row for row in rows}


def parse_yaws(values: list[str]) -> dict[str, float]:
    result: dict[str, float] = {}
    for value in values:
        asset_id, _, angle = value.partition("=")
        hd.require_asset_id(asset_id)
        if angle not in ("0", "90", "180", "270"):
            raise ValueError(f"yaw override for {asset_id} must be 0, 90, 180 or 270")
        result[asset_id] = float(angle)
    return result


def run_process(command: list[str], log_dir: Path, label: str) -> dict[str, Any]:
    stdout_path = log_dir / f"blender-{label}.stdout.log"
    stderr_path = log_dir / f"blender-{label}.stderr.log"
    environment = dict(os.environ)
    environment["PYTHONHASHSEED"] = "0"
    started = dt.datetime.now(dt.timezone.utc)
    result = subprocess.run(command, cwd=str(SCRIPT_DIR.parent), env=environment, stdin=subprocess.DEVNULL,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False, shell=False)
    stdout_path.write_bytes(result.stdout)
    stderr_path.write_bytes(result.stderr)
    return {
        "label": label,
        "command": command,
        "returnCode": result.returncode,
        "startedUtc": started.isoformat(),
        "seconds": (dt.datetime.now(dt.timezone.utc) - started).total_seconds(),
        "stdoutLog": stdout_path.name,
        "stdoutSha256": base.sha256_file(stdout_path),
        "stderrLog": stderr_path.name,
        "stderrSha256": base.sha256_file(stderr_path),
        "stderrTail": result.stderr.decode("utf-8", errors="replace")[-2000:],
    }


def render_item(args: argparse.Namespace, row: dict[str, Any], yaw: float | None, scripts: dict[str, str]) -> dict[str, Any]:
    asset_id = row["assetId"]
    item_dir = Path(args.work).resolve() / "renders" / asset_id
    if item_dir.exists():
        if not args.replace:
            raise ValueError(f"{asset_id} already has a render directory; pass --replace to redo it")
        shutil.rmtree(item_dir)
    item_dir.mkdir(parents=True, exist_ok=False)
    asset = {**row, "cameraYawDegrees": float(yaw if yaw is not None else row["cameraYawDegrees"])}
    request = {
        "pipelineId": hd.PIPELINE_ID,
        "classification": "native-render-candidate",
        "runtimeAuthority": "projection-only",
        "certified": False,
        "render": hd.build_render_recipe(),
        "assets": [asset],
    }
    request_path = item_dir / "request.json"
    write_json(request_path, request)
    before = base.sha256_file(Path(row["sourcePath"]))
    passes = ["a"] if args.single_pass else ["a", "b"]
    processes = []
    failure = None
    reports: dict[str, Any] = {}
    for label in passes:
        command = [args.blender, "--background", "--factory-startup", "--disable-autoexec", "--python-exit-code", "1",
                   "--python", str(RENDERER), "--", "--manifest", str(request_path), "--raw-output", str(item_dir / f"raw-{label}"),
                   "--report-output", str(item_dir / f"report-{label}.json"), "--asset-id", asset_id]
        record = run_process(command, item_dir, label)
        processes.append(record)
        if record["returnCode"] != 0:
            failure = f"blender pass {label} failed with return code {record['returnCode']}"
            break
        report = json.loads((item_dir / f"report-{label}.json").read_text(encoding="utf-8"))
        frame = report["frames"][0]
        rendered = item_dir / f"raw-{label}" / f"{asset_id}.png"
        if report.get("status") != "pass" or frame.get("assetId") != asset_id or base.sha256_file(rendered) != frame["renderFileSha256"]:
            failure = f"blender pass {label} report does not match its rendered file"
            break
        if abs(frame["cameraYawDegrees"] - asset["cameraYawDegrees"]) > 0.001:
            failure = "evaluated camera yaw differs from the requested yaw"
            break
        reports[label] = report
    comparison = None
    if failure is None and not args.single_pass:
        first = base._load_rgba(item_dir / "raw-a" / f"{asset_id}.png", "A")
        second = base._load_rgba(item_dir / "raw-b" / f"{asset_id}.png", "B")
        comparison = {"exact": first.size == second.size and first.tobytes() == second.tobytes(),
                      "aDecodedRgbaSha256": hd.sha256_bytes(first.tobytes()), "bDecodedRgbaSha256": hd.sha256_bytes(second.tobytes())}
        if not comparison["exact"]:
            failure = "A/B decoded RGBA differs"
        elif reports["a"]["frames"][0]["pivot"] != reports["b"]["frames"][0]["pivot"]:
            failure = "A/B ground pivots differ"
    after = base.sha256_file(Path(row["sourcePath"]))
    if after != before or before != row["sourceModelSha256"]:
        failure = (failure + "; " if failure else "") + "owner-supplied source GLB hash changed during the render"
    blender = None
    if "a" in reports:
        blender = {key: reports["a"][key] for key in ("blenderVersion", "blenderVersionTuple", "blenderBuildHash", "blenderBuildDate")}
    receipt = {
        "status": "failed" if failure else "pass",
        "failure": failure,
        "pipelineId": hd.PIPELINE_ID,
        "classification": "native-render-candidate",
        "runtimeAuthority": "projection-only",
        "assetId": asset_id,
        "batch": row["batch"],
        "sourceId": row["sourceId"],
        "class": row["class"],
        "frameSize": row["frameSize"],
        "cameraYawDegrees": asset["cameraYawDegrees"],
        "sourcePath": row["sourcePath"],
        "sourceModelSha256Before": before,
        "sourceModelSha256After": after,
        "sourceModelsUnchanged": before == after == row["sourceModelSha256"],
        "renderRequestSha256": base.sha256_file(request_path),
        "renderFileSha256": {label: reports[label]["frames"][0]["renderFileSha256"] for label in reports},
        "comparison": comparison,
        "passes": passes,
        "processes": processes,
        "blender": blender,
        "scriptSha256": scripts,
        "settlementLive": False,
    }
    write_json(item_dir / "receipt.json", receipt)
    return receipt


def command_render(args: argparse.Namespace) -> int:
    rows = ingest_all(args)
    selected = args.ids or sorted(rows)
    for asset_id in selected:
        hd.require_asset_id(asset_id)
    if len(set(selected)) != len(selected):
        raise ValueError("--ids contains a duplicate")
    yaws = parse_yaws(args.yaw)
    if any(asset_id not in selected for asset_id in yaws):
        raise ValueError("--yaw names an asset that is not being rendered")
    scripts = script_hashes()
    work = Path(args.work).resolve()
    work.mkdir(parents=True, exist_ok=True)
    failures = []
    for index, asset_id in enumerate(selected, 1):
        receipt = render_item(args, rows[asset_id], yaws.get(asset_id), scripts)
        seconds = sum(p["seconds"] for p in receipt["processes"])
        print(json.dumps({"item": asset_id, "index": index, "of": len(selected), "status": receipt["status"], "seconds": round(seconds, 1), "failure": receipt["failure"]}), flush=True)
        if receipt["status"] != "pass":
            failures.append(asset_id)
    with (work / "render-runs.jsonl").open("a", encoding="utf-8") as handle:
        handle.write(json.dumps({"utc": dt.datetime.now(dt.timezone.utc).isoformat(), "ids": selected, "yaw": yaws,
                                 "singlePass": bool(args.single_pass), "failures": failures, "scriptSha256": scripts}, sort_keys=True) + "\n")
    print(json.dumps({"status": "failed" if failures else "pass", "rendered": len(selected), "failures": failures}, sort_keys=True))
    return 1 if failures else 0


def load_review(path: str | None) -> dict[str, Any] | None:
    if not path:
        return None
    review = json.loads(Path(path).read_text(encoding="utf-8"))
    items = review.get("items")
    if not isinstance(items, dict):
        raise ValueError("review.json must contain an items object")
    for asset_id, entry in items.items():
        hd.require_asset_id(asset_id)
        if entry.get("status") not in ("ok", "fixed", "rejected") or not isinstance(entry.get("reason"), str):
            raise ValueError(f"review entry {asset_id} needs status ok|fixed|rejected and a reason string")
    return review


def command_pack(args: argparse.Namespace) -> int:
    rows = ingest_all(args)
    review = load_review(args.review)
    work = Path(args.work).resolve()
    renders = work / "renders"
    scripts = script_hashes()
    frames = []
    receipts = {}
    rejected = []
    for item_dir in sorted(renders.iterdir()):
        asset_id = hd.require_asset_id(item_dir.name)
        row = rows[asset_id]
        receipt = json.loads((item_dir / "receipt.json").read_text(encoding="utf-8"))
        if receipt.get("status") != "pass" or receipt.get("assetId") != asset_id:
            raise ValueError(f"{asset_id} render receipt did not pass")
        if receipt["sourceModelSha256Before"] != row["sourceModelSha256"] or receipt["sourceModelSha256After"] != row["sourceModelSha256"]:
            raise ValueError(f"{asset_id} source model hash differs from its render receipt")
        if receipt["scriptSha256"]["nativeRenderer"] != scripts["nativeRenderer"] or receipt["scriptSha256"]["baseRenderer"] != scripts["baseRenderer"]:
            raise ValueError(f"{asset_id} was rendered by a different renderer source; re-render it")
        if base.sha256_file(item_dir / "request.json") != receipt["renderRequestSha256"]:
            raise ValueError(f"{asset_id} render request changed after its receipt")
        report = json.loads((item_dir / "report-a.json").read_text(encoding="utf-8"))
        frame_report = report["frames"][0]
        entry = None
        if review is not None:
            entry = review["items"].get(asset_id)
            if entry is None:
                raise ValueError(f"review.json has no entry for rendered item {asset_id}")
            if entry["status"] == "rejected":
                rejected.append({"assetId": asset_id, "name": row["name"], "reason": entry["reason"]})
                receipts[asset_id] = {**receipt, "review": entry}
                continue
        frame = hd.load_frame(item_dir / "raw-a", {**row, "cameraYawDegrees": receipt["cameraYawDegrees"]}, frame_report)
        frame["review"] = entry["status"] if entry else "unreviewed"
        frame["reviewReason"] = entry["reason"] if entry else None
        frames.append(frame)
        receipts[asset_id] = {**receipt, "review": entry}
    if not frames:
        raise ValueError("no accepted frames to pack")
    package = Path(args.package).resolve()
    receipts_dir = Path(args.receipts).resolve()
    manifest = hd.pack_package(frames, package, receipts_dir)
    for item in manifest["items"]:
        item["reviewReason"] = next(f["reviewReason"] for f in frames if f["assetId"] == item["assetId"])
    manifest.update({
        "reviewed": review is not None,
        "review": {k: v for k, v in (review or {}).items() if k != "items"} if review else None,
        "rejected": rejected,
        "sources": {
            "b1": {"label": hd.BATCHES["b1"]["label"], "root": str(Path(args.b1_root).resolve()), "catalogSha256": base.sha256_file(Path(args.b1_root) / "catalog.json"), "count": 56},
            "b2": {"label": hd.BATCHES["b2"]["label"], "root": str(Path(args.b2_root).resolve()), "catalogSha256": base.sha256_file(Path(args.b2_root) / "catalog.json"), "count": 40},
        },
        "render": hd.build_render_recipe(),
        "blender": next(iter(receipts.values()))["blender"],
        "scriptSha256": scripts,
        "renderReceiptsSha256": None,
        "settlementLive": False,
    })
    receipts_path = receipts_dir / "render-receipts.json"
    write_json(receipts_path, {
        "pipelineId": hd.PIPELINE_ID,
        "generatedUtc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "scriptSha256": scripts,
        "items": receipts,
    })
    manifest["renderReceiptsSha256"] = base.sha256_file(receipts_path)
    manifest_path = package / MANIFEST_NAME
    write_json(manifest_path, manifest)
    summary = {
        "status": "pass",
        "package": str(package),
        "manifestSha256": base.sha256_file(manifest_path),
        "accepted": len(frames),
        "rejected": [r["assetId"] for r in rejected],
        "pages": [(p["image"], p["itemCount"], p["encodedBytes"], p["decodedBytes"]) for p in manifest["pages"]],
        "totals": manifest["totals"],
    }
    write_json(receipts_dir / "pack-summary.json", summary)
    print(json.dumps(summary, sort_keys=True))
    return 0


def main() -> int:
    args = parse_args()
    return command_render(args) if args.command == "render" else command_pack(args)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"hmh Tripo HD props failed: {type(error).__name__}: {error}", file=sys.stderr)
        raise

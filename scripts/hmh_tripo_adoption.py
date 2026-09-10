from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import tempfile
from pathlib import Path
from PIL import Image
import hmh_tripo_props as props

IDS = [f"{value:02d}" for value in range(1, 57)]
HASH = re.compile(r"[a-f0-9]{64}\Z")


def validate_receipt(receipt: dict, scripts: dict) -> None:
    required = {"pipelineId": "hmh-tripo-static-props/v1", "status": "pass",
                "classification": "native-render-candidate", "runtimeAuthority": "projection-only",
                "rosterScope": "full-56-candidate", "fullRosterComplete": True,
                "canonicalAdoption": False, "certified": False, "settlementLive": False,
                "sourceModelsUnchanged": True}
    if any(receipt.get(key) != value for key, value in required.items()) or receipt.get("selectedIds") != IDS:
        raise ValueError("complete unchanged projection-only native candidate required")
    if receipt.get("scriptSha256") != scripts:
        raise ValueError("native producer sources changed after the bake")
    before, after = receipt.get("sourceModelSha256Before", {}), receipt.get("sourceModelSha256After", {})
    if set(before) != set(IDS) or before != after or any(not isinstance(value, str) or not HASH.fullmatch(value) for value in before.values()):
        raise ValueError("source identity or immutable source hash mismatch")
    comparison = receipt.get("comparison", {})
    frames = comparison.get("frames", [])
    if comparison.get("exact") is not True or comparison.get("frameCount") != 56 or comparison.get("changedFrames") != [] or [frame.get("sourceId") for frame in frames] != IDS:
        raise ValueError("complete exact native A/B comparison required")
    for frame in frames:
        value = frame.get("firstDecodedRgbaSha256")
        if frame.get("exact") is not True or not isinstance(value, str) or not HASH.fullmatch(value) or value != frame.get("secondDecodedRgbaSha256"):
            raise ValueError("native A/B source pixels differ")
    processes = receipt.get("processes", [])
    expected = [(phase, source_id) for phase in ("a", "b") for source_id in IDS]
    if len(processes) != len(expected):
        raise ValueError("both isolated native processes are required for every source")
    for process, (phase, source_id) in zip(processes, expected):
        label = f"{phase}-{source_id}"
        command = process.get("command", [])
        if process.get("label") != label or process.get("started") is not True or process.get("returnCode") != 0:
            raise ValueError("native process did not complete successfully")
        if any(flag not in command for flag in ("--background", "--factory-startup", "--disable-autoexec", "--source-id", "--python-exit-code")):
            raise ValueError("native launch safety flags missing")
        for flag, value in (("--source-id", source_id), ("--python-exit-code", "1")):
            index = command.index(flag)
            if index + 1 >= len(command) or command[index + 1] != value:
                raise ValueError("native process source ownership or exit contract mismatch")
        for stream in ("stdout", "stderr"):
            if process.get(f"{stream}Log") != f"blender-{label}.{stream}.log" or not HASH.fullmatch(str(process.get(f"{stream}Sha256", ""))):
                raise ValueError("native closed-log identity missing")


def verify_candidate(candidate: Path, source_root: Path, review_path: Path) -> dict:
    candidate, source_root = candidate.resolve(strict=True), source_root.resolve(strict=True)
    script_root = Path(__file__).resolve().parent
    scripts = {name: props.sha256_file(path) for name, path in {
        "intakeAndPacker": script_root / "hmh_tripo_props.py",
        "nativeRenderer": script_root / "hmh-blender/export-hmh-tripo-props.py",
        "orchestrator": script_root / "run-hmh-tripo-props.py",
    }.items()}
    receipt_path = candidate / "receipt.json"
    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    validate_receipt(receipt, scripts)
    review = json.loads(review_path.read_text(encoding="utf-8"))
    if review.get("status") != "approved-for-local-runtime-evaluation" or review.get("staticArtApproved") is not True or review.get("sourceIds") != IDS or review.get("receiptSha256") != props.sha256_file(receipt_path):
        raise ValueError("exact-candidate static-art review required")
    if review.get("contactSheetSha256") != props.sha256_file(candidate / "package/labelled-contact-sheet.png"):
        raise ValueError("reviewed contact sheet changed")
    if receipt["sourceCatalogSha256"] != props.sha256_file(source_root / "catalog.json"):
        raise ValueError("owner source catalog changed")
    rows = props.ingest_catalog(source_root, expected_count=56)
    if {row["id"]: row["glb_sha256"] for row in rows} != receipt["sourceModelSha256After"]:
        raise ValueError("owner source models changed")
    if props.sha256_file(candidate / "render-request.json") != receipt["renderRequestSha256"]:
        raise ValueError("native render request changed")
    for process in receipt["processes"]:
        for stream in ("stdout", "stderr"):
            if props.sha256_file(candidate / process[f"{stream}Log"]) != process[f"{stream}Sha256"]:
                raise ValueError("native process log changed or is still open")
    manifest_path = candidate / "package/manifest.json"
    if props.sha256_file(manifest_path) != receipt["packageManifestSha256"]:
        raise ValueError("native package manifest changed")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("assetCount") != 56 or [frame.get("sourceId") for frame in manifest.get("frames", [])] != IDS:
        raise ValueError("native package roster mismatch")
    comparison = props.compare_frames(candidate / "raw-a", candidate / "raw-b", IDS)
    if comparison != receipt["comparison"]:
        raise ValueError("native decoded source evidence changed")
    pages = []
    for page in manifest["pages"]:
        if not re.fullmatch(r"[a-z0-9-]+\.webp", page["image"]):
            raise ValueError("invalid native page filename")
        path = candidate / "package" / page["image"]
        if props.sha256_file(path) != page["sha256"]:
            raise ValueError("native atlas bytes changed")
        with Image.open(path) as image:
            rgba = image.convert("RGBA")
        if rgba.size != (page["width"], page["height"]) or hashlib.sha256(rgba.tobytes()).hexdigest() != page["decodedRgbaSha256"]:
            raise ValueError("native atlas decoded pixels changed")
        pages.append(rgba)
    for frame, compared in zip(manifest["frames"], comparison["frames"]):
        box = frame["frame"]
        pixels = pages[frame["page"]].crop((box["x"], box["y"], box["x"] + box["w"], box["y"] + box["h"]))
        if frame["sourceModelSha256"] != receipt["sourceModelSha256After"][frame["sourceId"]] or hashlib.sha256(pixels.tobytes()).hexdigest() != frame["sourcePixelSha256"] or frame["sourcePixelSha256"] != compared["firstDecodedRgbaSha256"]:
            raise ValueError("native atlas frame reconstruction or ownership failed")
    return {"manifest": manifest, "receipt": receipt, "pages": pages, "review": review}


def adopt_candidate(candidate: Path, source_root: Path, review_path: Path, output: Path) -> dict:
    output = output.resolve()
    if output.exists():
        raise ValueError("refusing to overwrite an existing canonical asset destination")
    if output.is_relative_to(source_root.resolve()):
        raise ValueError("adoption must never write into the owner's source delivery")
    checked = verify_candidate(candidate, source_root, review_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=".hmh-tripo-adoption-", dir=output.parent))
    try:
        manifest = checked["manifest"]
        manifest["classification"] = "production-art"
        manifest["certified"] = False
        manifest["canonicalAdoption"] = True
        manifest["adoption"] = {"scope": "local-runtime-evaluation", "releaseCertified": False,
            "nativeReceiptSha256": props.sha256_file(candidate / "receipt.json"),
            "visualReviewSha256": props.sha256_file(review_path),
            "sourceCatalogSha256": checked["receipt"]["sourceCatalogSha256"],
            "nativeProducerSha256": checked["receipt"]["scriptSha256"],
            "adoptionProducerSha256": props.sha256_file(Path(__file__))}
        for page in manifest["pages"]:
            shutil.copyfile(candidate / "package" / page["image"], staging / page["image"])
        (staging / "items").mkdir()
        for frame in manifest["frames"]:
            box = frame["frame"]
            pixels = checked["pages"][frame["page"]].crop((box["x"], box["y"], box["x"] + box["w"], box["y"] + box["h"]))
            name = f"{frame['assetId']}.webp"
            path = staging / "items" / name
            pixels.save(path, format="WEBP", lossless=True, exact=True, method=6)
            with Image.open(path) as image:
                if hashlib.sha256(image.convert("RGBA").tobytes()).hexdigest() != frame["sourcePixelSha256"]:
                    raise ValueError("native item image was not encoded exactly")
            frame["itemImage"] = name
            frame["itemSha256"] = props.sha256_file(path)
        shutil.copyfile(candidate / "package/labelled-contact-sheet.png", staging / "labelled-contact-sheet.png")
        (staging / "hmh-tripo-props.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
        staging.rename(output)
        return manifest
    finally:
        if staging.exists():
            shutil.rmtree(staging)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Adopt a reviewed, immutable native Tripo candidate for local runtime evaluation")
    for name in ("candidate", "source-root", "review", "output"):
        parser.add_argument(f"--{name}", required=True, type=Path)
    args = parser.parse_args()
    result = adopt_candidate(args.candidate, args.source_root, args.review, args.output)
    print(json.dumps({"status": "adopted-for-local-runtime-evaluation", "assetCount": result["assetCount"], "output": str(args.output.resolve()), "releaseCertified": False}))

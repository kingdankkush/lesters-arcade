"""HMH bridge kit pipeline (Level 1 design package 2.4, slice S4.9).

  python scripts/run-hmh-bridge-kit-pipeline.py                 # build, render, pack
  python scripts/run-hmh-bridge-kit-pipeline.py --skip-render   # repack existing raw frames
  python scripts/run-hmh-bridge-kit-pipeline.py --verify-reproducible
  python scripts/run-hmh-bridge-kit-pipeline.py --preview 0.25  # quick look-dev, writes .tmp only

Stages
  1. Blender (scripts/hmh-blender/create-hmh-bridge-kit.py) assembles the eight
     crossings from modular pieces, saves the LFS source scene, and renders
     every layer / state / sway phase at the 35-degree hero camera with the
     shared light rig at pixelDensity 2.
  2. Frames are trimmed on alpha (to even pixel offsets so the half-res page is
     an exact 2:1 of the full page), their world screen origins recomputed, and
     the projection probes checked: every deck corner must land within half a
     pixel of (x - x0, y - z - y0) * density.
  3. Alignment gates on real pixels: the default-state ground layers must cover
     the deck rectangle, and the rail layers must cover the rail capsule lines.
  4. Frames are shelf-packed into WebP pages per district group, with a
     premultiplied Lanczos `@0.5x.webp` mobile variant per page (the same
     frame-isolated resampling as scripts/build-hmh-mobile-half-res.py).
  5. Atlas JSON, metrics JSON, a contact sheet and per-crossing alignment
     previews are written. The atlas is registered dark; nothing loads it.

Projection-only art: it cannot alter collision, navigation, combat or results.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import os
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
import PIL

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "apps/hmh-reboot/assets/source/blender/hmh-bridge-kit.json"
BLENDER_SCRIPT = ROOT / "scripts/hmh-blender/create-hmh-bridge-kit.py"
EXPECTED_BLENDER_VERSION = "Blender 5.1.2"
PAD_TEXELS = 3
MOBILE_SUFFIX = "@0.5x.webp"
# Alignment gates (fractions of sampled points that must be opaque).
DECK_COVERAGE_MIN = 0.985
RAIL_COVERAGE_MIN = 0.9
PROBE_ERROR_MAX_PX = 0.5
# Catcher frames render with a wider margin; their outer band fades out.
SHADOW_EDGE_FADE_UNITS = 22
# Empty bands at least this wide split a frame into separately packed pieces.
SPLIT_GAP_UNITS = 40


def args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-render", action="store_true")
    parser.add_argument("--verify-reproducible", action="store_true")
    parser.add_argument("--preview", type=float, default=0.0)
    parser.add_argument("--only", default="")
    return parser.parse_args()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8", newline="\n")


def run_blender(manifest, raw_dir: Path, report: Path, blend: Path, scale: float, only: str) -> None:
    blender = Path(os.environ.get("BLENDER_EXECUTABLE", r"D:\Apps\Blender\blender.exe"))
    version = subprocess.run([str(blender), "--version"], capture_output=True, text=True).stdout.splitlines()[0].strip()
    if version != EXPECTED_BLENDER_VERSION:
        raise RuntimeError(f"expected {EXPECTED_BLENDER_VERSION!r}, received {version!r}")
    command = [str(blender), "--background", "--factory-startup", "--python", str(BLENDER_SCRIPT), "--",
               "--manifest", str(MANIFEST_PATH), "--source-blend", str(blend), "--raw-output", str(raw_dir),
               "--report-output", str(report), "--scale", str(scale)]
    if only:
        command += ["--only", only]
    completed = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if completed.returncode != 0 or '"status": "pass"' not in completed.stdout:
        raise RuntimeError(f"bridge kit Blender stage failed\n{completed.stdout[-4000:]}\n{completed.stderr[-4000:]}")
    print("[bridge-kit] blender stage: pass", flush=True)


def _runs(occupied, gap):
    """Index spans of occupied cells, merging holes narrower than `gap`."""
    spans = []
    idx = np.where(occupied)[0]
    if idx.size == 0:
        return spans
    start = prev = int(idx[0])
    for value in idx[1:]:
        value = int(value)
        if value - prev > gap:
            spans.append((start, prev + 1))
            start = value
        prev = value
    spans.append((start, prev + 1))
    return spans


def _split(mask, x0, y0, x1, y1, gap, depth=0):
    """Recursively split a sparse frame at wide empty column / row bands.

    A rope bridge's tower layer is two towers 1,300 px apart; packing its
    bounding box would spend a page on air."""
    sub = mask[y0:y1, x0:x1]
    boxes = []
    for c0, c1 in _runs(sub.any(axis=0), gap):
        for r0, r1 in _runs(sub[:, c0:c1].any(axis=1), gap):
            boxes.append((x0 + c0, y0 + r0, x0 + c1, y0 + r1))
    if depth < 2 and len(boxes) > 1:
        refined = []
        for bx0, by0, bx1, by1 in boxes:
            refined.extend(_split(mask, bx0, by0, bx1, by1, gap, depth + 1))
        return refined
    return boxes


def load_frames(report, raw_dir: Path, threshold: int):
    """Trim each render on alpha into one or more pieces with even offsets and sizes."""
    records = []
    for frame in report["frames"]:
        image = Image.open(raw_dir / frame["file"]).convert("RGBA")
        rgba = np.asarray(image).copy()
        if frame["castsCatcherShadows"]:
            # The shadow catcher runs past the frame; long shadows would end in
            # a hard frame-edge cut. Fade the outer band (objects sit a full
            # margin inside it, so only catcher shadow is touched).
            band = SHADOW_EDGE_FADE_UNITS * frame["pixelDensity"]
            h, w = rgba.shape[:2]
            ramp_x = np.clip(np.minimum(np.arange(w), np.arange(w)[::-1]) / band, 0.0, 1.0)
            ramp_y = np.clip(np.minimum(np.arange(h), np.arange(h)[::-1]) / band, 0.0, 1.0)
            fade = np.minimum(ramp_y[:, None], ramp_x[None, :])
            rgba[:, :, 3] = np.rint(rgba[:, :, 3].astype(np.float32) * fade).astype(np.uint8)
        alpha = rgba[:, :, 3]
        h, w = alpha.shape
        corners = [alpha[0, 0], alpha[0, w - 1], alpha[h - 1, 0], alpha[h - 1, w - 1]]
        if max(corners) > threshold:
            raise RuntimeError(f"{frame['id']} touches a frame corner")
        mask = alpha > threshold
        # Texels at or under the threshold are invisible; clearing them keeps
        # piece edges identical run to run.
        rgba[~mask] = 0
        if not mask.any():
            raise RuntimeError(f"{frame['id']} rendered empty")
        density = frame["pixelDensity"]
        errors = [math.hypot(p["pixel"][0] - p["expected"][0], p["pixel"][1] - p["expected"][1]) for p in frame["probes"]]
        boxes = _split(mask, 0, 0, w, h, int(SPLIT_GAP_UNITS * density))
        boxes.sort(key=lambda box: (box[0], box[1]))
        for index, (bx0, by0, bx1, by1) in enumerate(boxes):
            x0, y0 = bx0 & ~1, by0 & ~1
            x1, y1 = bx1 + (bx1 - x0) % 2, by1 + (by1 - y0) % 2
            crop = np.zeros((y1 - y0, x1 - x0, 4), dtype=np.uint8)
            keep = np.zeros_like(mask)
            keep[by0:by1, bx0:bx1] = mask[by0:by1, bx0:bx1]
            ys, xs = slice(y0, min(y1, h)), slice(x0, min(x1, w))
            src = np.where(keep[ys, xs][:, :, None], rgba[ys, xs], 0).astype(np.uint8)
            crop[:src.shape[0], :src.shape[1]] = src
            piece_id = frame["id"] if len(boxes) == 1 else f"{frame['id']}#{index}"
            records.append({
                **frame,
                "id": piece_id,
                "frameId": frame["id"],
                "pixels": crop,
                "origin": {"x": frame["screenOrigin"]["x"] + x0 / density, "y": frame["screenOrigin"]["y"] + y0 / density},
                "size": {"w": x1 - x0, "h": y1 - y0},
                "probeErrorMaxPx": max(errors),
                "sha256": sha256_bytes(crop.tobytes()),
            })
    return records


def composite(records, crossing, state_filter, density):
    """Union canvas of the given frames in world screen space (for gates and previews)."""
    chosen = [r for r in records if r["crossing"] == crossing["id"] and state_filter(r)]
    minx = min(r["origin"]["x"] for r in chosen)
    miny = min(r["origin"]["y"] for r in chosen)
    maxx = max(r["origin"]["x"] + r["size"]["w"] / density for r in chosen)
    maxy = max(r["origin"]["y"] + r["size"]["h"] / density for r in chosen)
    width = int(math.ceil((maxx - minx) * density))
    height = int(math.ceil((maxy - miny) * density))
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    order = {"ground": 0, "actors": 1, "overhead": 2}
    for r in sorted(chosen, key=lambda item: (order[item["band"]], item["sortY"] or 0)):
        tile = Image.fromarray(r["pixels"], "RGBA")
        canvas.alpha_composite(tile, (int(round((r["origin"]["x"] - minx) * density)), int(round((r["origin"]["y"] - miny) * density))))
    return canvas, minx, miny


def default_state_filter(crossing):
    """The configuration a run starts in: gates at their closed default."""
    default = crossing.get("defaultState")
    moving = crossing.get("movingParts", {})
    active = set(moving.get("stateSets", {}).get(default, [default] if default else []))

    def keep(record):
        state = record["state"]
        if record["layer"] == "moving":
            return state in active
        if state.startswith("sway-"):
            return state == "sway-0" and default != "raised"
        return True
    return keep


def lowered_filter(crossing):
    """The walkable configuration: gates open or leaves down, sway phase 0."""
    def keep(record):
        state = record["state"]
        if record["layer"] == "moving":
            return state in ("lowered", "open-north", "open-south")
        if state.startswith("sway-"):
            return state == "sway-0"
        return True
    return keep


def alignment(records, crossing, density):
    canvas, minx, miny = composite(records, crossing, lowered_filter(crossing), density)
    alpha = np.asarray(canvas)[:, :, 3]
    x0, y0, x1, y1 = crossing["rect"]
    z = crossing["z"]

    def opaque(wx, wy):
        px = int((wx - minx) * density)
        py = int((wy - miny) * density)
        if px < 0 or py < 0 or px >= alpha.shape[1] or py >= alpha.shape[0]:
            return False
        return alpha[py, px] > 128

    deck_points = [(x0 + (x1 - x0) * (i + 0.5) / 40, y0 + (y1 - y0) * (j + 0.5) / 20) for i in range(40) for j in range(20)]
    deck_hits = sum(1 for wx, wy in deck_points if opaque(wx, wy - z))
    result = {"deckCoverage": round(deck_hits / len(deck_points), 4), "deckSamples": len(deck_points)}
    if crossing.get("rails", True) is not False:
        # A rail sample passes when any texel in the column above its capsule
        # line (deck level up to rail height) is drawn: the art shows the rail
        # exactly where the r14 capsule blocks shots and movement.
        rail_points = []
        if crossing["span"] == "x":
            for rail_y in (y0 - 30, y1 + 30):
                for i in range(30):
                    rail_points.append((x0 + 20 + (x1 - x0 - 40) * (i + 0.5) / 30, rail_y - z))
        else:
            for rail_x in (x0 - 30, x1 + 30):
                for i in range(30):
                    rail_points.append((rail_x, y0 + 20 + (y1 - y0 - 40) * (i + 0.5) / 30 - z))
        rail_hits = sum(1 for wx, wy in rail_points if any(opaque(wx, wy - h) for h in range(0, 46, 3)))
        result.update({"railCoverage": round(rail_hits / len(rail_points), 4), "railSamples": len(rail_points)})
    return result, canvas, minx, miny


def _contained(inner, outer):
    return outer[0] <= inner[0] and outer[1] <= inner[1] and outer[0] + outer[2] >= inner[0] + inner[2] and outer[1] + outer[3] >= inner[1] + inner[3]


def maxrects_pack(records, padding, max_size):
    """MaxRects (best short side fit) into as few pages as possible.

    Every size and the padding are even, so every placement is even and the
    half-resolution page stays an exact 2:1 of the full page."""
    ordered = sorted(records, key=lambda r: (-max(r["size"]["w"], r["size"]["h"]), -r["size"]["w"] * r["size"]["h"], r["id"]))
    pages = []
    remaining = ordered
    while remaining:
        free = [(padding, padding, max_size - padding, max_size - padding)]
        placed, leftover = [], []
        for record in remaining:
            w = record["size"]["w"] + padding
            h = record["size"]["h"] + padding
            best = None
            for fx, fy, fw, fh in free:
                if w <= fw and h <= fh:
                    score = (min(fw - w, fh - h), max(fw - w, fh - h), fy, fx)
                    if best is None or score < best[0]:
                        best = (score, fx, fy)
            if best is None:
                leftover.append(record)
                continue
            _, x, y = best
            placed.append((record, x, y))
            split = []
            for fx, fy, fw, fh in free:
                if x >= fx + fw or x + w <= fx or y >= fy + fh or y + h <= fy:
                    split.append((fx, fy, fw, fh))
                    continue
                if x > fx:
                    split.append((fx, fy, x - fx, fh))
                if x + w < fx + fw:
                    split.append((x + w, fy, fx + fw - x - w, fh))
                if y > fy:
                    split.append((fx, fy, fw, y - fy))
                if y + h < fy + fh:
                    split.append((fx, y + h, fw, fy + fh - y - h))
            unique = sorted(set(split))
            free = [r for r in unique if not any(o != r and _contained(r, o) for o in unique)]
        if not placed:
            raise RuntimeError("bridge kit piece does not fit a page")
        def page_edge(extent):
            # Multiples of 64: WebGL2 samples NPOT pages, the half page stays
            # an exact 2:1, and a part-filled last page stops costing 16 MB.
            return min(max_size, max(256, -(-extent // 64) * 64))
        width = page_edge(max(x + r["size"]["w"] for r, x, y in placed) + padding)
        height = page_edge(max(y + r["size"]["h"] for r, x, y in placed) + padding)
        pages.append(((width, height), placed))
        remaining = leftover
    return pages


def _premultiplied(frame_rgba: np.ndarray) -> np.ndarray:
    data = frame_rgba.astype(np.float32) / 255.0
    data[:, :, :3] *= data[:, :, 3:4]
    return data


def half_frame(frame_rgba: np.ndarray) -> np.ndarray:
    """Premultiplied Lanczos 2:1 of one isolated frame (exactly even sized)."""
    h, w = frame_rgba.shape[:2]
    pad = PAD_TEXELS * 2
    canvas = np.zeros((h + 2 * pad, w + 2 * pad, 4), dtype=np.float32)
    canvas[pad:pad + h, pad:pad + w] = _premultiplied(frame_rgba)
    channels = []
    for c in range(4):
        plane = Image.fromarray(canvas[:, :, c], mode="F")
        channels.append(np.asarray(plane.resize(((w + 2 * pad) // 2, (h + 2 * pad) // 2), Image.Resampling.LANCZOS)))
    out = np.stack(channels, axis=-1)[PAD_TEXELS:PAD_TEXELS + h // 2, PAD_TEXELS:PAD_TEXELS + w // 2]
    out = np.clip(out, 0.0, 1.0)
    alpha = out[:, :, 3:4]
    rgb = np.where(alpha > 1e-6, out[:, :, :3] / np.maximum(alpha, 1e-6), 0.0)
    rgb = np.clip(rgb, 0.0, 1.0)
    result = np.concatenate([rgb, alpha], axis=-1)
    result = np.rint(result * 255.0).astype(np.uint8)
    result[result[:, :, 3] == 0, :3] = 0
    return result


def encode_webp(image: Image.Image, options) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="WEBP", exact=True, **options)
    return buffer.getvalue()


def build(options) -> None:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    preview = options.preview > 0
    scale = options.preview if preview else 1.0
    tmp = ROOT / ".tmp" / ("hmh-bridge-kit-preview" if preview else "hmh-bridge-kit")
    raw_dir = ROOT / manifest["scene"]["rawOutputDirectory"] if not preview else tmp / "raw"
    report_path = tmp / "render-report.json"
    blend = ROOT / manifest["scene"]["sourceBlend"] if not preview else tmp / "preview.blend"
    if not options.skip_render:
        run_blender(manifest, raw_dir, report_path, blend, scale, options.only)
    report = json.loads(report_path.read_text(encoding="utf-8"))
    density = manifest["render"]["pixelDensity"] * scale
    records = load_frames(report, raw_dir, manifest["render"]["alphaThreshold"])
    crossings = {c["id"]: c for c in manifest["crossings"] if not options.only or c["id"] in options.only.split(",")}

    worst_probe = max(r["probeErrorMaxPx"] for r in records)
    if worst_probe > PROBE_ERROR_MAX_PX:
        raise RuntimeError(f"projection probe error {worst_probe:.3f}px exceeds {PROBE_ERROR_MAX_PX}px")

    evidence = ROOT / manifest["atlas"]["evidenceDirectory"] if not preview else tmp / "evidence"
    evidence.mkdir(parents=True, exist_ok=True)
    align = {}
    failures = []
    for cid, crossing in crossings.items():
        result, canvas, minx, miny = alignment(records, crossing, density)
        align[cid] = result
        if result["deckCoverage"] < crossing.get("deckCoverageMin", DECK_COVERAGE_MIN):
            failures.append(f"{cid} deck coverage {result['deckCoverage']}")
        if result.get("railCoverage", 1.0) < RAIL_COVERAGE_MIN:
            failures.append(f"{cid} rail coverage {result['railCoverage']}")
        write_alignment_preview(evidence / f"{cid}-alignment.webp", crossing, records, density, preview)
    if failures and not preview:
        raise RuntimeError("bridge kit alignment gate failed: " + "; ".join(failures))
    if preview:
        write_json(tmp / "preview-alignment.json", {"alignment": align, "failures": failures, "worstProbePx": worst_probe})
        print(json.dumps({"preview": True, "failures": failures, "alignment": align}, indent=1))
        return

    out_dir = ROOT / manifest["atlas"]["outputDirectory"]
    out_dir.mkdir(parents=True, exist_ok=True)
    for stale in out_dir.glob("*.webp"):
        stale.unlink()
    groups = manifest["atlas"]["pageGroups"]
    webp = manifest["atlas"]["webp"]
    page_entries = []
    frame_entries = {}
    for group, members in groups.items():
        chosen = [r for r in records if r["crossing"] in members]
        for index, ((page_w, page_h), placed) in enumerate(maxrects_pack(chosen, manifest["atlas"]["padding"], manifest["atlas"]["maxPageSize"])):
            page_id = f"{group}-{index}"
            full = np.zeros((page_h, page_w, 4), dtype=np.uint8)
            half = np.zeros((page_h // 2, page_w // 2, 4), dtype=np.uint8)
            for record, x, y in placed:
                w, h = record["size"]["w"], record["size"]["h"]
                full[y:y + h, x:x + w] = record["pixels"]
                half[y // 2:(y + h) // 2, x // 2:(x + w) // 2] = half_frame(record["pixels"])
                entry = frame_entries.setdefault(record["frameId"], {
                    "id": record["frameId"], "crossing": record["crossing"], "layer": record["layer"], "state": record["state"],
                    "band": record["band"], "sortY": record["sortY"], "fadeWhenHeroOnDeck": record["fadeWhenHeroOnDeck"], "parts": [],
                })
                entry["parts"].append({
                    "id": record["id"], "page": page_id, "frame": {"x": x, "y": y, "w": w, "h": h},
                    "origin": record["origin"], "sourcePixelSha256": record["sha256"],
                })
            full_bytes = encode_webp(Image.fromarray(full, "RGBA"), webp)
            half_bytes = encode_webp(Image.fromarray(half, "RGBA"), webp)
            name = f"hmh-bridge-kit-{page_id}.webp"
            mobile = name.replace(".webp", MOBILE_SUFFIX)
            (out_dir / name).write_bytes(full_bytes)
            (out_dir / mobile).write_bytes(half_bytes)
            if len(full_bytes) > manifest["atlas"]["maxPageBytes"]:
                raise RuntimeError(f"{name} is {len(full_bytes)} bytes, over the {manifest['atlas']['maxPageBytes']} page budget")
            page_entries.append({
                "id": page_id, "group": group, "image": f"./{name}", "mobileImage": f"./{mobile}", "mobileResolution": 0.5,
                "width": page_w, "height": page_h, "bytes": len(full_bytes), "mobileBytes": len(half_bytes),
                "decodedBytes": page_w * page_h * 4, "mobileDecodedBytes": (page_w // 2) * (page_h // 2) * 4,
                "sha256": sha256_bytes(full_bytes), "mobileSha256": sha256_bytes(half_bytes), "frameCount": len(placed),
            })

    for entry in frame_entries.values():
        entry["parts"].sort(key=lambda part: part["id"])
    crossings_out = {}
    for cid, crossing in crossings.items():
        mine = sorted(fid for fid, f in frame_entries.items() if f["crossing"] == cid)
        static = [fid for fid in mine if frame_entries[fid]["state"] == "static"]
        sway = {}
        for fid in mine:
            state = frame_entries[fid]["state"]
            if state.startswith("sway-"):
                sway.setdefault(frame_entries[fid]["layer"], []).append(fid)
        for key in sway:
            sway[key] = sorted(sway[key], key=lambda fid: int(frame_entries[fid]["state"].split("-")[1]))
        moving = crossing.get("movingParts")
        states = {}
        if moving:
            for state in moving["states"]:
                states[state] = [fid for fid in mine if frame_entries[fid]["layer"] == "moving" and frame_entries[fid]["state"] == state]
        crossings_out[cid] = {
            "id": cid, "packageName": crossing["packageName"], "district": crossing["district"], "style": crossing["style"],
            "rect": crossing["rect"], "span": crossing["span"], "z": crossing["z"], "clear": crossing["clear"],
            "rampLength": crossing.get("rampLength", 0), "rails": crossing.get("rails", True), "under": crossing["under"],
            "staticFrames": static, "swayFrames": sway, "defaultState": crossing.get("defaultState"),
            "movingParts": ({"gateId": moving["gateId"], "states": states, "stateSets": moving.get("stateSets", {}),
                              "sequence": moving.get("sequence"), "sequenceTicks": moving.get("sequenceTicks")} if moving else None),
            "alignment": align[cid],
            "moduleInventory": report["moduleInventory"].get(cid, {}),
        }

    atlas = {
        "schema": "hmh-bridge-kit-atlas-v1",
        "pipelineId": manifest["pipelineId"],
        "status": "dark",
        "runtimeAuthority": "projection-only",
        "flag": "bridgeKit",
        "cameraElevationDegrees": manifest["render"]["cameraElevationDegrees"],
        "pixelDensity": manifest["render"]["pixelDensity"],
        "runtimeScale": 1 / manifest["render"]["pixelDensity"],
        "projection": "A frame's top-left texel sits at world screen origin (x, y - z); draw at runtimeScale with anchor (0, 0).",
        "sway": {"frames": manifest["sway"]["frames"], "fps": manifest["sway"]["fps"], "styles": manifest["sway"]["styles"]},
        "layoutSource": manifest["layoutSource"],
        "pages": page_entries,
        "crossings": crossings_out,
        "frames": dict(sorted(frame_entries.items())),
    }
    atlas_path = out_dir / "hmh-bridge-kit-atlas.json"
    write_json(atlas_path, atlas)
    write_contact_sheet(evidence / "hmh-bridge-kit-contact-sheet.webp", records)
    metrics = {
        "schema": "hmh-bridge-kit-metrics-v1",
        "status": "pass",
        "blenderVersion": report["blenderVersion"],
        "pillowVersion": PIL.__version__,
        "frameCount": len(records),
        "uniqueFrames": len({r["sha256"] for r in records}),
        "sharedMeshCount": report["sharedMeshCount"],
        "worstProbeErrorPx": round(worst_probe, 4),
        "gates": {"deckCoverageMin": DECK_COVERAGE_MIN, "railCoverageMin": RAIL_COVERAGE_MIN, "probeErrorMaxPx": PROBE_ERROR_MAX_PX},
        "alignment": align,
        "pages": [{k: p[k] for k in ("id", "width", "height", "bytes", "mobileBytes", "decodedBytes", "mobileDecodedBytes")} for p in page_entries],
        "totalBytes": sum(p["bytes"] for p in page_entries),
        "totalMobileBytes": sum(p["mobileBytes"] for p in page_entries),
        "reproducibility": options.reproducibility if hasattr(options, "reproducibility") else None,
        "manifestSha256": sha256_bytes(MANIFEST_PATH.read_bytes()),
        "blenderScriptSha256": sha256_bytes(BLENDER_SCRIPT.read_bytes()),
        "sourceBlendSha256": sha256_bytes(blend.read_bytes()),
        "atlasSha256": sha256_bytes(atlas_path.read_bytes()),
        "frameSha256": {r["id"]: r["sha256"] for r in sorted(records, key=lambda r: r["id"])},
    }
    write_json(evidence / "hmh-bridge-kit-metrics.json", metrics)
    print(json.dumps({k: metrics[k] for k in ("status", "frameCount", "worstProbeErrorPx", "totalBytes", "totalMobileBytes")}, indent=1))


GROUND = {"chasm": (22, 24, 30, 255), "deep": (40, 78, 96, 255), "shallow": (72, 110, 104, 255)}
LAND = (112, 116, 84, 255)


def write_alignment_preview(path: Path, crossing, records, density, preview) -> None:
    """Greybox under the art: land, water or chasm, the deck rectangle (red),
    rail capsule lines (yellow) and gate lines (cyan). One panel per config."""
    panels = []
    configs = [("default", default_state_filter(crossing)), ("walkable", lowered_filter(crossing))]
    for label, keep in configs:
        chosen = [r for r in records if r["crossing"] == crossing["id"] and keep(r)]
        if not chosen:
            continue
        canvas, minx, miny = composite(records, crossing, keep, density)
        margin = 40
        W, H = canvas.size[0] + 2 * margin, canvas.size[1] + 2 * margin
        base = Image.new("RGBA", (W, H), LAND)
        draw = ImageDraw.Draw(base)
        x0, y0, x1, y1 = crossing["rect"]
        z = crossing["z"]

        def px(wx, wy):
            return ((wx - minx) * density + margin, (wy - miny) * density + margin)
        if crossing["span"] == "x":
            a, b = px(x0 + 20, miny - 2000), px(x1 - 20, miny + 4000)
        else:
            a, b = px(minx - 2000, y0 + 20), px(minx + 4000, y1 - 20)
        draw.rectangle([a, b], fill=GROUND[crossing["under"]])
        base.alpha_composite(canvas, (margin, margin))
        draw = ImageDraw.Draw(base)
        draw.rectangle([px(x0, y0 - z), px(x1, y1 - z)], outline=(255, 40, 40, 255), width=max(1, int(density)))
        if crossing.get("rails", True) is not False:
            if crossing["span"] == "x":
                for ry in (y0 - 30, y1 + 30):
                    draw.line([px(x0 + 20, ry - z), px(x1 - 20, ry - z)], fill=(255, 220, 40, 255), width=max(1, int(density)))
            else:
                for rx in (x0 - 30, x1 + 30):
                    draw.line([px(rx, y0 + 20 - z), px(rx, y1 - 20 - z)], fill=(255, 220, 40, 255), width=max(1, int(density)))
        panels.append((label, base))
    width = sum(p.size[0] for _, p in panels) + 20 * (len(panels) - 1)
    height = max(p.size[1] for _, p in panels) + 24
    sheet = Image.new("RGBA", (width, height), (10, 14, 20, 255))
    x = 0
    font = ImageFont.load_default()
    for label, panel in panels:
        sheet.alpha_composite(panel, (x, 24))
        ImageDraw.Draw(sheet).text((x + 6, 6), f"{crossing['id']} - {label}", fill=(230, 240, 250, 255), font=font)
        x += panel.size[0] + 20
    if not preview:
        sheet = sheet.resize((sheet.size[0] // 2, sheet.size[1] // 2), Image.Resampling.LANCZOS)
    path.parent.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(path, format="WEBP", quality=82, method=6)


def write_contact_sheet(path: Path, records) -> None:
    cell = 256
    cols = 6
    rows = (len(records) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * cell, rows * (cell + 16)), (18, 22, 28, 255))
    font = ImageFont.load_default()
    for index, record in enumerate(sorted(records, key=lambda r: r["id"])):
        tile = Image.fromarray(record["pixels"], "RGBA")
        tile.thumbnail((cell - 8, cell - 8), Image.Resampling.LANCZOS)
        x = (index % cols) * cell
        y = (index // cols) * (cell + 16)
        sheet.alpha_composite(tile, (x + 4, y + 18))
        ImageDraw.Draw(sheet).text((x + 4, y + 3), record["id"][:40], fill=(220, 232, 244, 255), font=font)
    sheet.convert("RGB").save(path, format="WEBP", quality=82, method=6)


def verify(options) -> None:
    """Render twice into private directories and compare trimmed frames."""
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    tmp = ROOT / ".tmp/hmh-bridge-kit-verify"
    results = []
    for run in ("a", "b"):
        raw = tmp / run / "raw"
        report = tmp / run / "report.json"
        run_blender(manifest, raw, report, tmp / run / "verify.blend", 1.0, options.only)
        results.append({r["id"]: r for r in load_frames(json.loads(report.read_text(encoding="utf-8")), raw, manifest["render"]["alphaThreshold"])})
    changed = {}
    for fid, a in results[0].items():
        b = results[1][fid]
        if a["pixels"].shape != b["pixels"].shape:
            changed[fid] = "shape"
            continue
        delta = np.abs(a["pixels"].astype(np.int16) - b["pixels"].astype(np.int16))
        changed[fid] = {"changedPixels": int((delta.max(axis=2) > 0).sum()), "maxChannelDelta": int(delta.max())}
    write_json(tmp / "reproducibility.json", changed)
    print(json.dumps(changed, indent=1))


def main():
    options = args()
    if options.verify_reproducible:
        verify(options)
        return
    build(options)


if __name__ == "__main__":
    main()

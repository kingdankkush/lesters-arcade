"""Intake, class table, atlas packing, half-res and contact sheets for the HD Tripo prop package.

Pipeline ``hmh-tripo-static-props-hd/v1``. It reads the two owner-supplied
delivery catalogs (environment/power-up batch 1, level-design batch 2), assigns
each model a namespaced ID (``b1-NN`` / ``b2-NN``), a page class and a render
frame size, and packs the rendered frames into class-grouped 2048 px WebP atlas
pages with ``@0.5x`` variants.

The pinned 256 px module ``hmh_tripo_props.py`` is imported for its GLB
parser, hashing and image helpers; it is not modified.

Projection-only art. Nothing here may alter collision, AI, spawning, RNG,
progression, evidence or results.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
from pathlib import Path
from typing import Any, Sequence

import numpy as np
from PIL import Image, ImageDraw, ImageFont

import hmh_tripo_props as base

PIPELINE_ID = "hmh-tripo-static-props-hd/v1"
PAGE_SIZE = 2048
PADDING = 4
TRIM_MARGIN = 2
HALF_SUFFIX = "@0.5x"
HALF_PAD_TEXELS = 3
HALF_WEBP = {"quality": 90, "alpha_quality": 100, "method": 6}
FULL_WEBP = {"lossless": True, "exact": True, "method": 6}
CLASSES = ("plants", "props", "structures", "pickups")
CLASS_FRAME_SIZE = {"plants": 512, "props": 512, "structures": 768, "pickups": 512}
_ASSET_ID = re.compile(r"^b[12]-[0-9]{2}$")

# Batch 1 keeps the yaw overrides of the shipped 256 px package so cards face
# the same way. Batch 2 defaults to yaw 0; overrides come from the contact-sheet
# review and are passed explicitly to the renderer run.
BATCH1_YAW = {source_id: 90 for source_id in ("12", "13", "18", "20", "27", "33", "41", "44", "45", "52", "56")}


def _span(first: int, last: int) -> list[str]:
    return [f"{value:02d}" for value in range(first, last + 1)]


BATCH1_CLASS: dict[str, str] = {}
BATCH1_CLASS.update({sid: "plants" for sid in _span(1, 10)})
BATCH1_CLASS.update({sid: "structures" for sid in _span(11, 15)})
BATCH1_CLASS.update({sid: "props" for sid in _span(16, 20)})
BATCH1_CLASS.update({sid: "pickups" for sid in _span(21, 40)})
BATCH1_CLASS.update({
    "41": "props", "42": "props", "43": "structures", "44": "props", "45": "props",
    "46": "structures", "47": "structures", "48": "structures", "49": "plants", "50": "plants",
    "51": "structures", "52": "structures", "53": "plants", "54": "plants", "55": "plants", "56": "structures",
})
BATCH2_CLASS: dict[str, str] = {}
BATCH2_CLASS.update({sid: "structures" for sid in _span(41, 46)})
BATCH2_CLASS.update({sid: "props" for sid in _span(47, 49)})
BATCH2_CLASS["50"] = "structures"
BATCH2_CLASS.update({sid: "props" for sid in _span(51, 53)})
BATCH2_CLASS.update({sid: "props" for sid in _span(54, 61)})
BATCH2_CLASS.update({sid: "structures" for sid in _span(62, 69)})
BATCH2_CLASS.update({sid: "plants" for sid in _span(70, 75)})
BATCH2_CLASS.update({"76": "structures", "77": "structures"})
BATCH2_CLASS.update({sid: "props" for sid in _span(78, 80)})
BATCHES = {
    "b1": {"label": "Tripo-Environment-Powerups", "count": 56, "ids": _span(1, 56), "classes": BATCH1_CLASS, "yaw": BATCH1_YAW},
    "b2": {"label": "Tripo-Level-Design-Batch-2", "count": 40, "ids": _span(41, 80), "classes": BATCH2_CLASS, "yaw": {}},
}


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    return base.sha256_file(path)


def require_asset_id(value: Any) -> str:
    if not isinstance(value, str) or not _ASSET_ID.fullmatch(value):
        raise ValueError(f"asset id must be a namespaced b1-NN/b2-NN id, got {value!r}")
    batch, source_id = value.split("-")
    if source_id not in BATCHES[batch]["ids"]:
        raise ValueError(f"asset id {value} is outside its batch roster")
    return value


def class_for(asset_id: str) -> str:
    batch, source_id = require_asset_id(asset_id).split("-")
    return BATCHES[batch]["classes"][source_id]


def frame_size_for(asset_id: str) -> int:
    return CLASS_FRAME_SIZE[class_for(asset_id)]


def default_yaw_for(asset_id: str) -> int:
    batch, source_id = require_asset_id(asset_id).split("-")
    return int(BATCHES[batch]["yaw"].get(source_id, 0))


def build_render_recipe() -> dict[str, Any]:
    return {
        "engine": "BLENDER_EEVEE",
        "frameSize": [512, 512],
        "frameSizeByClass": dict(CLASS_FRAME_SIZE),
        "cameraType": "ORTHO",
        "cameraPitchAxis": "positive-X",
        "cameraPitchDegrees": 45.0,
        "cameraYawDegrees": 0.0,
        "occupancy": 0.78,
        "exposure": 0.0,
        "transparent": True,
        "staticFramesOnly": True,
        "preserveOriginalMaterials": True,
    }


def ingest_batch(batch: str, source_root: str | Path) -> list[dict[str, Any]]:
    """Validate one delivery catalog and return namespaced rows (source bytes untouched)."""
    if batch not in BATCHES:
        raise ValueError(f"unknown batch {batch!r}")
    spec = BATCHES[batch]
    root = Path(source_root).resolve(strict=True)
    catalog_path = root / "catalog.json"
    if not catalog_path.is_file():
        raise ValueError(f"{batch} delivery is missing catalog.json")
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    assets = catalog.get("assets")
    if not isinstance(assets, list) or catalog.get("count") != len(assets) or len(assets) != spec["count"]:
        raise ValueError(f"{batch} catalog roster count is not {spec['count']}")
    rows: list[dict[str, Any]] = []
    seen: set[str] = set()
    for source_row in assets:
        source_id = source_row.get("id")
        if source_id not in spec["ids"] or source_id in seen:
            raise ValueError(f"{batch} catalog has an unexpected or duplicate id {source_id!r}")
        seen.add(source_id)
        name = source_row.get("name")
        if not isinstance(name, str) or not name.strip():
            raise ValueError(f"{batch}-{source_id} has no source name")
        if source_row.get("runtime_approved") is not False:
            raise ValueError(f"{batch}-{source_id} must remain projection-only and runtime_approved false")
        model_path = base._resolve_delivery_path(root, source_row.get("glb"), f"{batch}-{source_id} GLB")
        expected_hash = base._require_sha256(source_row.get("glb_sha256"), f"{batch}-{source_id} GLB hash")
        data = model_path.read_bytes()
        actual_hash = sha256_bytes(data)
        if actual_hash != expected_hash or source_row.get("bytes") != len(data):
            raise ValueError(f"{batch}-{source_id} GLB hash/size drift against its delivery catalog")
        base._parse_glb(data, f"{batch}-{source_id}")
        asset_id = f"{batch}-{source_id}"
        rows.append({
            "assetId": asset_id,
            "batch": batch,
            "sourceId": source_id,
            "name": name,
            "category": source_row.get("category", "environment"),
            "subcategory": source_row.get("subcategory"),
            "class": class_for(asset_id),
            "frameSize": frame_size_for(asset_id),
            "cameraYawDegrees": float(default_yaw_for(asset_id)),
            "sourceRoot": str(root),
            "sourcePath": str(model_path),
            "sourceModelSha256": actual_hash,
            "bytes": len(data),
            "sourceRawGlbSha256": source_row.get("raw_glb_sha256"),
            "sourceTaskId": source_row.get("task_id"),
            "runtimeApproved": False,
        })
    if seen != set(spec["ids"]):
        raise ValueError(f"{batch} roster is incomplete")
    rows.sort(key=lambda row: row["assetId"])
    return rows


def _even_down(value: int) -> int:
    return value - (value % 2)


def _even_up(value: int) -> int:
    return value + (value % 2)


def trimmed_rect(alpha_bounds: dict[str, int], frame_size: int) -> dict[str, int]:
    """Even-aligned crop rectangle around the painted alpha bounds (plus margin) inside the render frame."""
    x0 = _even_down(max(0, alpha_bounds["x"] - TRIM_MARGIN))
    y0 = _even_down(max(0, alpha_bounds["y"] - TRIM_MARGIN))
    x1 = _even_up(min(frame_size, alpha_bounds["x"] + alpha_bounds["w"] + TRIM_MARGIN))
    y1 = _even_up(min(frame_size, alpha_bounds["y"] + alpha_bounds["h"] + TRIM_MARGIN))
    if x1 - x0 < 2 or y1 - y0 < 2 or x1 > frame_size or y1 > frame_size:
        raise ValueError("trimmed frame rectangle is degenerate or leaves the render frame")
    return {"x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0}


def load_frame(render_dir: Path, row: dict[str, Any], report_frame: dict[str, Any]) -> dict[str, Any]:
    """Load one rendered PNG, verify it against its Blender report and trim it."""
    asset_id = require_asset_id(row["assetId"])
    path = render_dir / f"{asset_id}.png"
    if not path.is_file():
        raise ValueError(f"missing rendered frame for {asset_id}")
    if sha256_file(path) != report_frame["renderFileSha256"]:
        raise ValueError(f"rendered frame {asset_id} changed after its native report")
    image = base._load_rgba(path, asset_id)
    size = row["frameSize"]
    if image.size != (size, size) or report_frame.get("frameSize") != size:
        raise ValueError(f"rendered frame {asset_id} is not {size}x{size}")
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError(f"rendered frame {asset_id} is blank")
    left, top, right, bottom = bbox
    if left <= 0 or top <= 0 or right >= size or bottom >= size:
        raise ValueError(f"rendered frame {asset_id} touches the frame edge (clipped)")
    alpha = {"x": left, "y": top, "w": right - left, "h": bottom - top}
    rect = trimmed_rect(alpha, size)
    crop = image.crop((rect["x"], rect["y"], rect["x"] + rect["w"], rect["y"] + rect["h"]))
    pivot = report_frame["pivot"]
    px, py = float(pivot[0]) - rect["x"], float(pivot[1]) - rect["y"]
    if px < 0 or py < 0 or px > rect["w"] - 1 or py > rect["h"] - 1:
        raise ValueError(f"rendered frame {asset_id} ground pivot lies outside its trimmed frame")
    footprint = [[float(p[0]) - rect["x"], float(p[1]) - rect["y"]] for p in report_frame["groundFootprintPixels"]]
    return {
        **row,
        "image": crop,
        "renderFrame": {"size": size, "trim": {"x": rect["x"], "y": rect["y"]}, "pivot": [float(pivot[0]), float(pivot[1])]},
        "width": rect["w"],
        "height": rect["h"],
        "sourcePixelSha256": sha256_bytes(crop.tobytes()),
        "renderFileSha256": report_frame["renderFileSha256"],
        "pivot": [px, py],
        "anchor": {"x": px / (rect["w"] - 1), "y": py / (rect["h"] - 1)},
        "alphaBounds": {"x": alpha["x"] - rect["x"], "y": alpha["y"] - rect["y"], "w": alpha["w"], "h": alpha["h"]},
        "groundFootprintPixels": footprint,
        "modelDimensions": list(report_frame["modelDimensions"]),
        "cameraYawDegrees": float(report_frame["cameraYawDegrees"]),
        "materialConcerns": list(report_frame.get("materialConcerns", [])),
    }


def shelf_pack(frames: Sequence[dict[str, Any]], page_size: int = PAGE_SIZE, padding: int = PADDING) -> list[dict[str, int]]:
    """Height-sorted shelf packing. Returns one placement per input frame (input order preserved)."""
    order = sorted(range(len(frames)), key=lambda i: (-frames[i]["height"], -frames[i]["width"], frames[i]["assetId"]))
    placements: list[dict[str, int] | None] = [None] * len(frames)
    page, cursor_x, cursor_y, shelf_height = 0, padding, padding, 0
    for index in order:
        width, height = frames[index]["width"], frames[index]["height"]
        if width + padding * 2 > page_size or height + padding * 2 > page_size:
            raise ValueError(f"frame {frames[index]['assetId']} does not fit a {page_size} px page")
        if cursor_x + width + padding > page_size:
            cursor_x, cursor_y, shelf_height = padding, cursor_y + shelf_height + padding, 0
        if cursor_y + height + padding > page_size:
            page, cursor_x, cursor_y, shelf_height = page + 1, padding, padding, 0
        placements[index] = {"page": page, "x": cursor_x, "y": cursor_y, "w": width, "h": height}
        cursor_x += width + padding
        shelf_height = max(shelf_height, height)
    return [placement for placement in placements if placement is not None]


def _premultiplied_half(canvas: Image.Image) -> Image.Image:
    """Exact 2:1 Lanczos reduction of an RGBA canvas in premultiplied float space."""
    rgba = np.asarray(canvas, dtype=np.float32) / 255.0
    alpha = rgba[..., 3:4]
    premultiplied = np.concatenate([rgba[..., :3] * alpha, alpha], axis=2)
    half_size = (canvas.width // 2, canvas.height // 2)
    channels = []
    for channel in range(4):
        plane = Image.fromarray(np.ascontiguousarray(premultiplied[..., channel]), mode="F")
        channels.append(np.asarray(plane.resize(half_size, Image.Resampling.LANCZOS), dtype=np.float32))
    stacked = np.stack(channels, axis=2)
    out_alpha = np.clip(stacked[..., 3:4], 0.0, 1.0)
    out_rgb = np.clip(stacked[..., :3], 0.0, out_alpha)
    with np.errstate(divide="ignore", invalid="ignore"):
        straight = np.where(out_alpha > 0.0, out_rgb / np.maximum(out_alpha, 1e-12), 0.0)
    result = np.concatenate([straight, out_alpha], axis=2)
    return Image.fromarray(np.clip(np.rint(result * 255.0), 0, 255).astype(np.uint8), mode="RGBA")


def build_half_page(page: Image.Image, rects: Sequence[dict[str, int]]) -> Image.Image:
    """Frame-isolated half-resolution page: each rect is resampled alone so neighbours never bleed."""
    half = Image.new("RGBA", (page.width // 2, page.height // 2), (0, 0, 0, 0))
    pad = HALF_PAD_TEXELS * 2
    for rect in rects:
        if any(rect[key] % 2 for key in ("x", "y", "w", "h")):
            raise ValueError("half-res page requires even-aligned frame rectangles")
        canvas = Image.new("RGBA", (rect["w"] + pad * 2, rect["h"] + pad * 2), (0, 0, 0, 0))
        canvas.paste(page.crop((rect["x"], rect["y"], rect["x"] + rect["w"], rect["y"] + rect["h"])), (pad, pad))
        reduced = _premultiplied_half(canvas)
        inner = reduced.crop((pad // 2, pad // 2, pad // 2 + rect["w"] // 2, pad // 2 + rect["h"] // 2))
        half.paste(inner, (rect["x"] // 2, rect["y"] // 2))
    return half


def _font(size: int) -> ImageFont.ImageFont | ImageFont.FreeTypeFont:
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def write_contact_sheet(page: Image.Image, frames: Sequence[dict[str, Any]], placements: Sequence[dict[str, int]], title: str, output: Path) -> dict[str, Any]:
    """Labelled review sheet: the page over a dark backdrop with per-item IDs, pivot marks and footprint outlines."""
    sheet = Image.new("RGBA", (page.width, page.height + 48), (20, 24, 32, 255))
    sheet.alpha_composite(page, (0, 48))
    draw = ImageDraw.Draw(sheet)
    draw.text((12, 12), title, fill=(240, 244, 252, 255), font=_font(24))
    label_font = _font(18)
    for frame, placement in zip(frames, placements):
        x0, y0 = placement["x"], placement["y"] + 48
        draw.rectangle((x0, y0, x0 + placement["w"] - 1, y0 + placement["h"] - 1), outline=(70, 82, 100, 255))
        px, py = frame["pivot"]
        draw.line((x0 + px - 10, y0 + py, x0 + px + 10, y0 + py), fill=(255, 64, 64, 255), width=2)
        draw.line((x0 + px, y0 + py - 10, x0 + px, y0 + py + 10), fill=(255, 64, 64, 255), width=2)
        polygon = [(x0 + p[0], y0 + p[1]) for p in frame["groundFootprintPixels"]]
        draw.polygon(polygon, outline=(64, 220, 255, 200))
        label = f"{frame['assetId']} y{int(frame['cameraYawDegrees'])} {frame['name'].split(' - ', 1)[-1]}"[:34]
        draw.rectangle((x0, y0, x0 + 8 + len(label) * 9, y0 + 22), fill=(0, 0, 0, 170))
        draw.text((x0 + 4, y0 + 2), label, fill=(255, 240, 160, 255), font=label_font)
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(output, format="PNG", compress_level=9)
    return {"image": output.name, "sha256": sha256_file(output), "width": sheet.width, "height": sheet.height}


def pack_package(frames: Sequence[dict[str, Any]], package_dir: Path, receipts_dir: Path) -> dict[str, Any]:
    """Pack loaded frames into class-grouped pages, write the package + contact sheets, return the manifest."""
    if package_dir.exists():
        raise ValueError("package output already exists; refusing to overwrite it")
    seen: set[str] = set()
    for frame in frames:
        if frame["assetId"] in seen:
            raise ValueError(f"duplicate frame {frame['assetId']}")
        seen.add(frame["assetId"])
    package_dir.mkdir(parents=True, exist_ok=False)
    receipts_dir.mkdir(parents=True, exist_ok=True)

    pages: list[dict[str, Any]] = []
    items: list[dict[str, Any]] = []
    classes: dict[str, Any] = {}
    sheets: list[dict[str, Any]] = []
    for class_name in CLASSES:
        group = sorted((frame for frame in frames if frame["class"] == class_name), key=lambda f: f["assetId"])
        if not group:
            classes[class_name] = {"frameSize": CLASS_FRAME_SIZE[class_name], "pages": [], "items": []}
            continue
        placements = shelf_pack(group)
        page_count = max(p["page"] for p in placements) + 1
        first_page_index = len(pages)
        page_images = [Image.new("RGBA", (PAGE_SIZE, PAGE_SIZE), (0, 0, 0, 0)) for _ in range(page_count)]
        for frame, placement in zip(group, placements):
            page_images[placement["page"]].paste(frame["image"], (placement["x"], placement["y"]))
        for local_index, page_image in enumerate(page_images):
            stem = f"tripo-props-hd-{class_name}-{local_index:02d}"
            full_path = package_dir / f"{stem}.webp"
            page_image.save(full_path, format="WEBP", **FULL_WEBP)
            decoded = base._load_rgba(full_path, stem)
            if decoded.size != page_image.size or decoded.tobytes() != page_image.tobytes():
                raise ValueError(f"lossless exact WebP page {stem} changed decoded RGBA pixels")
            rects = [p for p in placements if p["page"] == local_index]
            half_image = build_half_page(page_image, rects)
            half_path = package_dir / f"{stem}{HALF_SUFFIX}.webp"
            half_image.save(half_path, format="WEBP", **HALF_WEBP)
            half_decoded = base._load_rgba(half_path, stem + HALF_SUFFIX)
            page_frames = [(f, p) for f, p in zip(group, placements) if p["page"] == local_index]
            sheet = write_contact_sheet(page_image, [f for f, _ in page_frames], [p for _, p in page_frames],
                                        f"{stem}  ({len(page_frames)} items, {CLASS_FRAME_SIZE[class_name]} px renders, red = ground pivot, cyan = base footprint)",
                                        receipts_dir / f"contact-sheet-{stem}.png")
            sheets.append({**sheet, "page": stem})
            pages.append({
                "image": full_path.name,
                "class": class_name,
                "classPageIndex": local_index,
                "width": decoded.width,
                "height": decoded.height,
                "sha256": sha256_file(full_path),
                "decodedRgbaSha256": sha256_bytes(decoded.tobytes()),
                "encodedBytes": full_path.stat().st_size,
                "decodedBytes": decoded.width * decoded.height * 4,
                "lossless": True,
                "exact": True,
                "itemCount": len(page_frames),
                "halfRes": {
                    "image": half_path.name,
                    "width": half_decoded.width,
                    "height": half_decoded.height,
                    "sha256": sha256_file(half_path),
                    "encodedBytes": half_path.stat().st_size,
                    "decodedBytes": half_decoded.width * half_decoded.height * 4,
                    "lossless": False,
                    "webp": dict(HALF_WEBP),
                },
            })
        for frame, placement in zip(group, placements):
            page_index = first_page_index + placement["page"]
            page = base._load_rgba(package_dir / pages[page_index]["image"], pages[page_index]["image"])
            crop = page.crop((placement["x"], placement["y"], placement["x"] + placement["w"], placement["y"] + placement["h"]))
            if sha256_bytes(crop.tobytes()) != frame["sourcePixelSha256"]:
                raise ValueError(f"packed frame {frame['assetId']} changed decoded RGBA pixels")
            items.append({
                "assetId": frame["assetId"],
                "batch": frame["batch"],
                "sourceId": frame["sourceId"],
                "name": frame["name"],
                "category": frame["category"],
                "subcategory": frame["subcategory"],
                "class": class_name,
                "frameSize": frame["frameSize"],
                "page": page_index,
                "pageImage": pages[page_index]["image"],
                "frame": {key: placement[key] for key in ("x", "y", "w", "h")},
                "renderFrame": frame["renderFrame"],
                "anchor": frame["anchor"],
                "groundAnchorPixels": {"x": frame["pivot"][0], "y": frame["pivot"][1]},
                "alphaBounds": frame["alphaBounds"],
                "groundFootprintPixels": frame["groundFootprintPixels"],
                "modelDimensions": frame["modelDimensions"],
                "cameraYawDegrees": frame["cameraYawDegrees"],
                "sourceModelSha256": frame["sourceModelSha256"],
                "sourceRawGlbSha256": frame.get("sourceRawGlbSha256"),
                "sourceTaskId": frame.get("sourceTaskId"),
                "renderFileSha256": frame["renderFileSha256"],
                "sourcePixelSha256": frame["sourcePixelSha256"],
                "materialConcerns": frame["materialConcerns"],
                "review": frame.get("review", "ok"),
                "runtimeApproved": False,
            })
        classes[class_name] = {
            "frameSize": CLASS_FRAME_SIZE[class_name],
            "pages": [page["image"] for page in pages[first_page_index:]],
            "items": [frame["assetId"] for frame in group],
        }
    items.sort(key=lambda item: item["assetId"])
    totals = {
        "pages": len(pages),
        "items": len(items),
        "encodedBytes": sum(page["encodedBytes"] for page in pages),
        "decodedBytes": sum(page["decodedBytes"] for page in pages),
        "halfResEncodedBytes": sum(page["halfRes"]["encodedBytes"] for page in pages),
        "halfResDecodedBytes": sum(page["halfRes"]["decodedBytes"] for page in pages),
    }
    return {
        "schemaVersion": 1,
        "pipelineId": PIPELINE_ID,
        "classification": "native-render-hd-candidate",
        "runtimeAuthority": "projection-only",
        "certified": False,
        "artAccepted": False,
        "canonicalAdoption": False,
        "maxPageSize": PAGE_SIZE,
        "padding": PADDING,
        "trimMargin": TRIM_MARGIN,
        "halfResSuffix": HALF_SUFFIX,
        "frameSizeByClass": dict(CLASS_FRAME_SIZE),
        "classes": classes,
        "pages": pages,
        "items": items,
        "totals": totals,
        "contactSheets": sheets,
    }

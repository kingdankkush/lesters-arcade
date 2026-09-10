from __future__ import annotations

import hashlib
import json
import math
import re
import struct
from pathlib import Path, PurePosixPath
from typing import Any, Iterable, Sequence

from PIL import Image, ImageDraw, UnidentifiedImageError

_ID_PATTERN = re.compile(r"^[0-9]{2}$")
_SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")
_GLB_JSON_CHUNK = 0x4E4F534A
_GLB_BIN_CHUNK = 0x004E4942
_MAX_PAGE_SIZE = 2048


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _require_sha256(value: Any, label: str) -> str:
    if not isinstance(value, str) or not _SHA256_PATTERN.fullmatch(value):
        raise ValueError(f"{label} must be a lowercase SHA-256 hash")
    return value


def _require_asset_id(value: Any) -> str:
    if not isinstance(value, str) or not _ID_PATTERN.fullmatch(value):
        raise ValueError("asset id must be a literal two-digit source id")
    number = int(value)
    if number < 1 or number > 56:
        raise ValueError("asset id is outside the supported 01..56 source roster")
    return value


def render_recipe_for_asset(recipe: dict[str, Any], source_id: str) -> dict[str, Any]:
    _require_asset_id(source_id)
    overrides = recipe.get("sourceYawDegrees", {})
    if not isinstance(overrides, dict):
        raise ValueError("source yaw overrides must be an object")
    for key, angle in overrides.items():
        _require_asset_id(key)
        if type(angle) not in (int, float) or angle not in (0, 90, 180, 270):
            raise ValueError("source yaw angle must be 0, 90, 180 or 270 degrees")
    yaw = overrides.get(source_id, recipe.get("cameraYawDegrees", 0.0))
    if type(yaw) not in (int, float) or yaw not in (0, 90, 180, 270):
        raise ValueError("camera yaw angle must be 0, 90, 180 or 270 degrees")
    return {**recipe, "cameraYawDegrees": float(yaw)}


def _resolve_delivery_path(root: Path, value: Any, label: str) -> Path:
    if not isinstance(value, str) or not value or "\\" in value:
        raise ValueError(f"{label} path must be a non-empty relative POSIX path")
    if re.match(r"^[A-Za-z]:", value):
        raise ValueError(f"{label} path must not contain a drive or point outside the delivery")
    relative = PurePosixPath(value)
    if relative.is_absolute() or any(part in ("", ".", "..") for part in relative.parts):
        raise ValueError(f"{label} path must be relative and remain inside the delivery")
    try:
        candidate = (root / Path(*relative.parts)).resolve(strict=True)
        candidate.relative_to(root)
    except (FileNotFoundError, RuntimeError, ValueError) as error:
        raise ValueError(f"{label} path is missing or resolves outside the delivery") from error
    if not candidate.is_file():
        raise ValueError(f"{label} path is not a regular file")
    return candidate


def _parse_glb(data: bytes, label: str) -> dict[str, Any]:
    if len(data) < 20:
        raise ValueError(f"{label} has invalid GLB dimensions or is truncated")
    magic, version, declared_length = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF" or version != 2:
        raise ValueError(f"{label} is not an embedded GLB 2.0 file")
    if declared_length != len(data):
        raise ValueError(f"{label} GLB declared size does not match its bytes")

    offset = 12
    chunks: list[tuple[int, bytes]] = []
    while offset < len(data):
        if offset + 8 > len(data):
            raise ValueError(f"{label} has a truncated GLB chunk header")
        chunk_length, chunk_type = struct.unpack_from("<II", data, offset)
        offset += 8
        end = offset + chunk_length
        if chunk_length < 0 or end > len(data):
            raise ValueError(f"{label} has invalid GLB chunk dimensions")
        chunks.append((chunk_type, data[offset:end]))
        offset = end
    if offset != len(data) or not chunks or chunks[0][0] != _GLB_JSON_CHUNK:
        raise ValueError(f"{label} does not contain a valid leading embedded JSON chunk")
    if any(chunk_type not in (_GLB_JSON_CHUNK, _GLB_BIN_CHUNK) for chunk_type, _ in chunks):
        raise ValueError(f"{label} contains an unsupported GLB dependency chunk")
    if sum(1 for chunk_type, _ in chunks if chunk_type == _GLB_JSON_CHUNK) != 1:
        raise ValueError(f"{label} must contain exactly one GLB JSON chunk")
    if sum(1 for chunk_type, _ in chunks if chunk_type == _GLB_BIN_CHUNK) > 1:
        raise ValueError(f"{label} must contain at most one embedded GLB binary chunk")

    try:
        document = json.loads(chunks[0][1].rstrip(b"\x00 \t\r\n").decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError(f"{label} contains invalid GLB JSON") from error
    if not isinstance(document, dict) or document.get("asset", {}).get("version") != "2.0":
        raise ValueError(f"{label} does not declare glTF asset version 2.0")

    buffers = document.get("buffers", [])
    images = document.get("images", [])
    buffer_views = document.get("bufferViews", [])
    if not isinstance(buffers, list) or not isinstance(images, list) or not isinstance(buffer_views, list):
        raise ValueError(f"{label} has invalid GLB dependency tables")
    if len(buffers) > 1:
        raise ValueError(f"{label} requires external or unsupported multiple buffer dependencies")
    for buffer in buffers:
        if not isinstance(buffer, dict) or "uri" in buffer:
            raise ValueError(f"{label} contains an external buffer dependency; GLB data must be embedded")
    for image in images:
        if not isinstance(image, dict) or "uri" in image:
            raise ValueError(f"{label} contains an external image dependency; GLB images must be embedded")
        if not isinstance(image.get("bufferView"), int):
            raise ValueError(f"{label} contains an image that is not embedded in a GLB buffer view")
        if image["bufferView"] < 0 or image["bufferView"] >= len(buffer_views):
            raise ValueError(f"{label} contains an invalid embedded image buffer view")

    binary = next((chunk for chunk_type, chunk in chunks if chunk_type == _GLB_BIN_CHUNK), b"")
    if buffers:
        byte_length = buffers[0].get("byteLength")
        if not isinstance(byte_length, int) or byte_length < 0 or byte_length > len(binary):
            raise ValueError(f"{label} has invalid embedded buffer dimensions")
    for view in buffer_views:
        if not isinstance(view, dict) or view.get("buffer", 0) != 0:
            raise ValueError(f"{label} contains an invalid or external buffer-view dependency")
        start = view.get("byteOffset", 0)
        length = view.get("byteLength")
        if not isinstance(start, int) or not isinstance(length, int) or start < 0 or length < 0:
            raise ValueError(f"{label} has invalid buffer-view dimensions")
        if start + length > len(binary):
            raise ValueError(f"{label} has an embedded buffer view outside the GLB binary chunk")
    return document


def ingest_catalog(source_root: str | Path, expected_count: int = 56) -> list[dict[str, Any]]:
    root = Path(source_root).resolve(strict=True)
    if not root.is_dir():
        raise ValueError("source root must be a delivery directory")
    catalog_path = root / "catalog.json"
    if not catalog_path.is_file():
        raise ValueError("source delivery is missing catalog.json")
    try:
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError("catalog.json is not valid UTF-8 JSON") from error
    if not isinstance(catalog, dict) or not isinstance(catalog.get("assets"), list):
        raise ValueError("catalog must contain an assets roster")
    assets = catalog["assets"]
    declared_count = catalog.get("count")
    if not isinstance(declared_count, int) or declared_count != len(assets):
        raise ValueError("catalog count does not match its asset roster")
    if not isinstance(expected_count, int) or expected_count < 1:
        raise TypeError("expected roster count must be a positive integer")
    if declared_count != expected_count:
        raise ValueError(f"catalog roster count is {declared_count}; expected {expected_count}")

    rows: list[dict[str, Any]] = []
    seen: set[str] = set()
    for index, source_row in enumerate(assets):
        if not isinstance(source_row, dict):
            raise ValueError(f"catalog asset {index} is not an object")
        asset_id = _require_asset_id(source_row.get("id"))
        if asset_id in seen:
            raise ValueError(f"duplicate catalog asset id {asset_id}")
        seen.add(asset_id)
        name = source_row.get("name")
        category = source_row.get("category")
        if not isinstance(name, str) or not name.strip():
            raise ValueError(f"asset {asset_id} has no source name")
        if not isinstance(category, str) or not category.strip():
            raise ValueError(f"asset {asset_id} has no source category")
        if source_row.get("runtime_approved") is not False:
            raise ValueError(f"asset {asset_id} must remain projection-only and runtime_approved false")

        model_path = _resolve_delivery_path(root, source_row.get("glb"), f"asset {asset_id} GLB")
        expected_hash = _require_sha256(source_row.get("glb_sha256"), f"asset {asset_id} GLB hash")
        expected_bytes = source_row.get("bytes")
        if not isinstance(expected_bytes, int) or isinstance(expected_bytes, bool) or expected_bytes < 20:
            raise ValueError(f"asset {asset_id} GLB byte size is invalid")
        actual_size = model_path.stat().st_size
        if actual_size != expected_bytes:
            raise ValueError(f"asset {asset_id} GLB size/bytes drift: {actual_size} != {expected_bytes}")
        data = model_path.read_bytes()
        actual_hash = _sha256_bytes(data)
        if actual_hash != expected_hash:
            raise ValueError(f"asset {asset_id} GLB hash drift: {actual_hash} != {expected_hash}")
        _parse_glb(data, f"asset {asset_id}")

        row = dict(source_row)
        row["id"] = asset_id
        row["glb_sha256"] = actual_hash
        row["bytes"] = actual_size
        row["runtime_approved"] = False
        row["sourcePath"] = str(model_path)
        rows.append(row)

    if expected_count == 56:
        required = {f"{number:02d}" for number in range(1, 57)}
        if seen != required:
            missing = sorted(required - seen)
            extra = sorted(seen - required)
            raise ValueError(f"full source roster IDs are incomplete; missing={missing}, extra={extra}")
    return rows


def _load_rgba(path: Path, label: str) -> Image.Image:
    try:
        with Image.open(path) as opened:
            opened.load()
            return opened.convert("RGBA")
    except (OSError, UnidentifiedImageError) as error:
        raise ValueError(f"{label} is not a readable image frame") from error


def _validated_frames(rows: Sequence[dict[str, Any]], raw_dir: Path, max_size: int, padding: int) -> list[dict[str, Any]]:
    if not rows:
        raise ValueError("at least one source frame is required")
    seen: set[str] = set()
    frames: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            raise TypeError("frame rows must be objects")
        asset_id = _require_asset_id(row.get("id"))
        if asset_id in seen:
            raise ValueError(f"duplicate frame id {asset_id}")
        seen.add(asset_id)
        name = row.get("name")
        category = row.get("category")
        if not isinstance(name, str) or not name.strip() or not isinstance(category, str) or not category.strip():
            raise ValueError(f"frame {asset_id} is missing its source name or category")
        source_model_hash = _require_sha256(row.get("glb_sha256"), f"frame {asset_id} source model hash")
        path = raw_dir / f"{asset_id}.png"
        if not path.is_file():
            raise ValueError(f"missing rendered frame for asset {asset_id}")
        image = _load_rgba(path, f"asset {asset_id}")
        width, height = image.size
        if width < 3 or height < 3 or width + padding * 2 > max_size or height + padding * 2 > max_size:
            raise ValueError(f"frame {asset_id} dimensions do not fit the bounded atlas page")
        alpha_bounds = image.getchannel("A").getbbox()
        if alpha_bounds is None:
            raise ValueError(f"frame {asset_id} is blank/empty in alpha")
        left, top, right, bottom = alpha_bounds
        if left <= 0 or top <= 0 or right >= width or bottom >= height:
            raise ValueError(f"frame {asset_id} is clipped at an image edge or corner")

        pivot = row.get("pivot")
        if not isinstance(pivot, (list, tuple)) or len(pivot) != 2:
            raise ValueError(f"frame {asset_id} pivot/anchor must contain two pixel coordinates")
        if any(isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) for value in pivot):
            raise ValueError(f"frame {asset_id} pivot/anchor contains invalid coordinates")
        pivot_x, pivot_y = float(pivot[0]), float(pivot[1])
        if pivot_x < 0 or pivot_y < 0 or pivot_x > width - 1 or pivot_y > height - 1:
            raise ValueError(f"frame {asset_id} pivot/anchor is outside the rendered frame")

        frames.append({
            "id": asset_id,
            "name": name,
            "category": category,
            "sourceModelSha256": source_model_hash,
            "image": image,
            "width": width,
            "height": height,
            "sourcePixelSha256": _sha256_bytes(image.tobytes()),
            "pivot": [pivot_x, pivot_y],
            "anchor": {
                "x": pivot_x / (width - 1),
                "y": pivot_y / (height - 1),
            },
            "alphaBounds": {"x": left, "y": top, "w": right - left, "h": bottom - top},
        })
    return frames


def _write_contact_sheet(frames: Sequence[dict[str, Any]], output: Path) -> dict[str, Any]:
    columns = min(8, max(1, len(frames)))
    cell_width, cell_height = 192, 224
    rows = math.ceil(len(frames) / columns)
    sheet = Image.new("RGBA", (columns * cell_width, rows * cell_height), (18, 22, 30, 255))
    draw = ImageDraw.Draw(sheet)
    for index, frame in enumerate(frames):
        column, row = index % columns, index // columns
        x0, y0 = column * cell_width, row * cell_height
        preview = frame["image"].copy()
        preview.thumbnail((cell_width - 16, cell_height - 48), Image.Resampling.LANCZOS)
        px = x0 + (cell_width - preview.width) // 2
        py = y0 + 8 + (cell_height - 48 - preview.height) // 2
        sheet.alpha_composite(preview, (px, py))
        label = f"tripo-{frame['id']}  {frame['name']}"
        draw.text((x0 + 8, y0 + cell_height - 34), label[:30], fill=(240, 244, 252, 255))
        draw.rectangle((x0, y0, x0 + cell_width - 1, y0 + cell_height - 1), outline=(64, 74, 92, 255))
    filename = "labelled-contact-sheet.png"
    path = output / filename
    sheet.save(path, format="PNG", compress_level=9)
    return {"image": filename, "sha256": sha256_file(path), "width": sheet.width, "height": sheet.height}


def pack_frames(
    rows: Sequence[dict[str, Any]],
    raw_dir: str | Path,
    output: str | Path,
    max_size: int = 2048,
    padding: int = 4,
) -> dict[str, Any]:
    raw = Path(raw_dir).resolve(strict=True)
    if not raw.is_dir():
        raise ValueError("raw frame input must be a directory")
    if not isinstance(max_size, int) or isinstance(max_size, bool) or max_size < 16 or max_size > _MAX_PAGE_SIZE:
        raise ValueError("atlas max_size must be an integer between 16 and 2048")
    if not isinstance(padding, int) or isinstance(padding, bool) or padding < 1 or padding * 2 >= max_size:
        raise ValueError("atlas padding must be a positive bounded integer")
    destination = Path(output).resolve()
    if destination.exists():
        raise ValueError("output candidate already exists; refusing to overwrite it")

    frames = _validated_frames(rows, raw, max_size, padding)
    placements: list[dict[str, int]] = []
    page_index = 0
    cursor_x = padding
    cursor_y = padding
    shelf_height = 0
    for frame in frames:
        width, height = frame["width"], frame["height"]
        if cursor_x + width + padding > max_size:
            cursor_x = padding
            cursor_y += shelf_height + padding
            shelf_height = 0
        if cursor_y + height + padding > max_size:
            page_index += 1
            cursor_x = padding
            cursor_y = padding
            shelf_height = 0
        placements.append({"page": page_index, "x": cursor_x, "y": cursor_y, "w": width, "h": height})
        cursor_x += width + padding
        shelf_height = max(shelf_height, height)

    destination.mkdir(parents=False, exist_ok=False)
    page_images = [Image.new("RGBA", (max_size, max_size), (0, 0, 0, 0)) for _ in range(page_index + 1)]
    for frame, placement in zip(frames, placements):
        page_images[placement["page"]].paste(frame["image"], (placement["x"], placement["y"]))

    pages: list[dict[str, Any]] = []
    for index, source_page in enumerate(page_images):
        filename = f"tripo-props-{index:02d}.webp"
        path = destination / filename
        source_rgba = source_page.tobytes()
        source_page.save(path, format="WEBP", lossless=True, exact=True, method=6)
        decoded = _load_rgba(path, f"atlas page {index}")
        decoded_rgba = decoded.tobytes()
        if decoded.size != source_page.size or decoded_rgba != source_rgba:
            raise ValueError(f"lossless exact WebP page {index} changed decoded RGBA pixels")
        pages.append({
            "image": filename,
            "width": decoded.width,
            "height": decoded.height,
            "sha256": sha256_file(path),
            "decodedRgbaSha256": _sha256_bytes(decoded_rgba),
            "lossless": True,
            "exact": True,
        })

    manifest_frames: list[dict[str, Any]] = []
    for frame, placement in zip(frames, placements):
        page = _load_rgba(destination / pages[placement["page"]]["image"], f"atlas page {placement['page']}")
        crop = page.crop((placement["x"], placement["y"], placement["x"] + placement["w"], placement["y"] + placement["h"]))
        crop_hash = _sha256_bytes(crop.tobytes())
        if crop_hash != frame["sourcePixelSha256"]:
            raise ValueError(f"packed frame {frame['id']} changed decoded RGBA pixels")
        manifest_frames.append({
            "assetId": f"tripo-{frame['id']}",
            "sourceId": frame["id"],
            "name": frame["name"],
            "category": frame["category"],
            "page": placement["page"],
            "frame": {key: placement[key] for key in ("x", "y", "w", "h")},
            "anchor": frame["anchor"],
            "groundAnchorPixels": {"x": frame["pivot"][0], "y": frame["pivot"][1]},
            "alphaBounds": frame["alphaBounds"],
            "sourcePixelSha256": frame["sourcePixelSha256"],
            "sourceModelSha256": frame["sourceModelSha256"],
        })

    contact_sheet = _write_contact_sheet(frames, destination)
    metadata: dict[str, Any] = {
        "schemaVersion": 1,
        "pipelineId": "hmh-tripo-static-props/v1",
        "classification": "native-render-candidate",
        "runtimeAuthority": "projection-only",
        "certified": False,
        "assetCount": len(frames),
        "rosterScope": "full-56-candidate" if len(frames) == 56 else "subset-visual-review-only",
        "maxPageSize": max_size,
        "padding": padding,
        "pages": pages,
        "frames": manifest_frames,
        "contactSheet": contact_sheet,
    }
    manifest_path = destination / "manifest.json"
    manifest_path.write_text(json.dumps(metadata, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    return metadata


def compare_frames(first_dir: str | Path, second_dir: str | Path, ids: Iterable[str]) -> dict[str, Any]:
    first = Path(first_dir).resolve(strict=True)
    second = Path(second_dir).resolve(strict=True)
    if not first.is_dir() or not second.is_dir():
        raise ValueError("A/B frame inputs must be directories")
    ordered_ids = list(ids)
    if not ordered_ids:
        raise ValueError("A/B comparison requires at least one frame id")
    seen: set[str] = set()
    changed: list[str] = []
    compared: list[dict[str, Any]] = []
    for value in ordered_ids:
        asset_id = _require_asset_id(value)
        if asset_id in seen:
            raise ValueError(f"duplicate A/B frame id {asset_id}")
        seen.add(asset_id)
        first_path = first / f"{asset_id}.png"
        second_path = second / f"{asset_id}.png"
        if not first_path.is_file() or not second_path.is_file():
            raise ValueError(f"missing A/B rendered frame for asset {asset_id}")
        first_image = _load_rgba(first_path, f"A frame {asset_id}")
        second_image = _load_rgba(second_path, f"B frame {asset_id}")
        first_bytes = first_image.tobytes()
        second_bytes = second_image.tobytes()
        exact = first_image.size == second_image.size and first_bytes == second_bytes
        if not exact:
            changed.append(asset_id)
        compared.append({
            "sourceId": asset_id,
            "firstSize": list(first_image.size),
            "secondSize": list(second_image.size),
            "firstDecodedRgbaSha256": _sha256_bytes(first_bytes),
            "secondDecodedRgbaSha256": _sha256_bytes(second_bytes),
            "exact": exact,
        })
    return {
        "exact": not changed,
        "frameCount": len(ordered_ids),
        "changedFrames": changed,
        "frames": compared,
    }

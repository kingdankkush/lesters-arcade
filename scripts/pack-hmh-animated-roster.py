#!/usr/bin/env python3
"""Pack the HMH animated roster into lazy per-actor lossless WebP atlases.

The canonical manifest keeps string frame refs. Atlas refs append:
  #frame=x,y,width,height,atlasWidth,atlasHeight

Loose sources must be backed up to the Lester's Arcade vault before deletion.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

from PIL import Image, ImageChops

MAX_TEXTURE = 4096
PADDING = 1


@dataclass(frozen=True)
class Rect:
    x: int
    y: int
    w: int
    h: int

    @property
    def right(self) -> int:
        return self.x + self.w

    @property
    def bottom(self) -> int:
        return self.y + self.h


@dataclass
class Page:
    free: list[Rect] = field(default_factory=lambda: [Rect(0, 0, MAX_TEXTURE, MAX_TEXTURE)])
    placements: dict[str, Rect] = field(default_factory=dict)

    def place(self, key: str, width: int, height: int) -> Rect | None:
        padded_w = width + PADDING * 2
        padded_h = height + PADDING * 2
        candidates: list[tuple[int, int, int, Rect]] = []
        for index, free in enumerate(self.free):
            if padded_w <= free.w and padded_h <= free.h:
                short = min(free.w - padded_w, free.h - padded_h)
                long = max(free.w - padded_w, free.h - padded_h)
                candidates.append((short, long, index, free))
        if not candidates:
            return None
        _, _, _, chosen = min(candidates, key=lambda row: (row[0], row[1], row[3].y, row[3].x))
        used = Rect(chosen.x, chosen.y, padded_w, padded_h)
        next_free: list[Rect] = []
        for free in self.free:
            next_free.extend(split_free_rect(free, used))
        self.free = prune_free_rects(next_free)
        content = Rect(used.x + PADDING, used.y + PADDING, width, height)
        self.placements[key] = content
        return content


def intersects(a: Rect, b: Rect) -> bool:
    return not (b.x >= a.right or b.right <= a.x or b.y >= a.bottom or b.bottom <= a.y)


def split_free_rect(free: Rect, used: Rect) -> list[Rect]:
    if not intersects(free, used):
        return [free]
    out: list[Rect] = []
    if used.x > free.x and used.x < free.right:
        out.append(Rect(free.x, free.y, used.x - free.x, free.h))
    if used.right < free.right:
        out.append(Rect(used.right, free.y, free.right - used.right, free.h))
    if used.y > free.y and used.y < free.bottom:
        out.append(Rect(free.x, free.y, free.w, used.y - free.y))
    if used.bottom < free.bottom:
        out.append(Rect(free.x, used.bottom, free.w, free.bottom - used.bottom))
    return [rect for rect in out if rect.w > 0 and rect.h > 0]


def contains(outer: Rect, inner: Rect) -> bool:
    return outer.x <= inner.x and outer.y <= inner.y and outer.right >= inner.right and outer.bottom >= inner.bottom


def prune_free_rects(rects: list[Rect]) -> list[Rect]:
    kept: list[Rect] = []
    for index, rect in enumerate(rects):
        if any(index != other_index and contains(other, rect) for other_index, other in enumerate(rects)):
            continue
        if rect not in kept:
            kept.append(rect)
    return kept


def parse_roster_module(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    marker = "export const HMH_ANIMATED_ROSTER = Object.freeze("
    start = text.index(marker) + len(marker)
    end = text.rindex(");")
    return json.loads(text[start:end])


def portal_path_for_ref(portal_root: Path, ref: str) -> Path:
    clean = ref.split("#", 1)[0].removeprefix("./")
    return portal_root / clean


def frame_refs(actor: dict) -> list[str]:
    refs: list[str] = []
    for directions in actor.get("animations", {}).values():
        for frames in directions.values():
            refs.extend(frames or [])
    return refs


def file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def rgba(path: Path) -> Image.Image:
    with Image.open(path) as image:
        return image.convert("RGBA")


def pack_actor(actor_key: str, actor: dict, portal_root: Path, output_root: Path) -> tuple[dict[str, str], dict]:
    refs = frame_refs(actor)
    refs_by_hash: dict[str, list[str]] = {}
    source_by_hash: dict[str, Path] = {}
    dimensions: dict[str, tuple[int, int]] = {}
    for ref in refs:
        source = portal_path_for_ref(portal_root, ref)
        if not source.exists():
            raise FileNotFoundError(f"Missing roster frame: {source}")
        digest = file_hash(source)
        refs_by_hash.setdefault(digest, []).append(ref)
        source_by_hash.setdefault(digest, source)
        if digest not in dimensions:
            with Image.open(source) as image:
                dimensions[digest] = image.size

    items = sorted(
        refs_by_hash,
        key=lambda digest: (max(dimensions[digest]), dimensions[digest][0] * dimensions[digest][1], digest),
        reverse=True,
    )
    pages: list[Page] = []
    page_for_hash: dict[str, int] = {}
    for digest in items:
        width, height = dimensions[digest]
        if width + PADDING * 2 > MAX_TEXTURE or height + PADDING * 2 > MAX_TEXTURE:
            raise ValueError(f"Frame exceeds {MAX_TEXTURE}px atlas limit: {source_by_hash[digest]} ({width}x{height})")
        placed = None
        for page_index, page in enumerate(pages):
            placed = page.place(digest, width, height)
            if placed:
                page_for_hash[digest] = page_index
                break
        if not placed:
            page = Page()
            placed = page.place(digest, width, height)
            if not placed:
                raise RuntimeError(f"Unable to place frame: {source_by_hash[digest]}")
            pages.append(page)
            page_for_hash[digest] = len(pages) - 1

    actor_dir = output_root / actor_key
    actor_dir.mkdir(parents=True, exist_ok=True)
    atlas_info: list[dict] = []
    page_dimensions: list[tuple[int, int]] = []
    for page_index, page in enumerate(pages):
        used_w = max(rect.right for rect in page.placements.values()) + PADDING
        used_h = max(rect.bottom for rect in page.placements.values()) + PADDING
        used_w = min(MAX_TEXTURE, max(2, used_w))
        used_h = min(MAX_TEXTURE, max(2, used_h))
        page_dimensions.append((used_w, used_h))
        atlas = Image.new("RGBA", (used_w, used_h), (0, 0, 0, 0))
        for digest, rect in page.placements.items():
            atlas.alpha_composite(rgba(source_by_hash[digest]), (rect.x, rect.y))
        filename = f"{actor_key}-{page_index:02d}.webp"
        destination = actor_dir / filename
        atlas.save(destination, "WEBP", lossless=True, quality=100, method=4, exact=True)
        atlas_info.append({
            "src": f"./assets/generated/hmh-animated-roster-atlas/{actor_key}/{filename}",
            "width": used_w,
            "height": used_h,
            "bytes": destination.stat().st_size,
        })

    rewritten: dict[str, str] = {}
    atlas_cache: dict[int, Image.Image] = {}
    try:
        for digest, original_refs in refs_by_hash.items():
            page_index = page_for_hash[digest]
            rect = pages[page_index].placements[digest]
            atlas_meta = atlas_info[page_index]
            atlas_ref = (
                f"{atlas_meta['src']}#frame={rect.x},{rect.y},{rect.w},{rect.h},"
                f"{atlas_meta['width']},{atlas_meta['height']}"
            )
            if page_index not in atlas_cache:
                atlas_cache[page_index] = Image.open(actor_dir / Path(atlas_meta["src"]).name).convert("RGBA")
            crop = atlas_cache[page_index].crop((rect.x, rect.y, rect.right, rect.bottom))
            source = rgba(source_by_hash[digest])
            if ImageChops.difference(crop, source).getbbox() is not None:
                raise RuntimeError(f"Pixel mismatch in atlas crop for {source_by_hash[digest]}")
            for original in original_refs:
                rewritten[original] = atlas_ref
    finally:
        for image in atlas_cache.values():
            image.close()

    report = {
        "actor": actor_key,
        "sourceFrameRefs": len(refs),
        "uniqueFramePixels": len(refs_by_hash),
        "deduplicatedRefs": len(refs) - len(refs_by_hash),
        "atlasPages": len(pages),
        "atlasBytes": sum(item["bytes"] for item in atlas_info),
        "atlases": atlas_info,
    }
    return rewritten, report


def rewrite_actor(actor: dict, ref_map: dict[str, str], report: dict) -> dict:
    output = dict(actor)
    animations: dict[str, dict[str, list[str]]] = {}
    for state, directions in actor.get("animations", {}).items():
        animations[state] = {
            direction: [ref_map[ref] for ref in frames]
            for direction, frames in directions.items()
        }
    output["animations"] = animations
    output["atlas"] = {
        "format": "lossless-webp-frame-ref-v1",
        "sourceFrameRefs": report["sourceFrameRefs"],
        "uniqueFramePixels": report["uniqueFramePixels"],
        "pages": report["atlases"],
    }
    return output


def report_from_packed_actor(actor_key: str, actor: dict) -> dict:
    atlas = actor.get("atlas") or {}
    pages = atlas.get("pages") or []
    return {
        "actor": actor_key,
        "sourceFrameRefs": int(atlas.get("sourceFrameRefs") or 0),
        "uniqueFramePixels": int(atlas.get("uniqueFramePixels") or 0),
        "deduplicatedRefs": max(0, int(atlas.get("sourceFrameRefs") or 0) - int(atlas.get("uniqueFramePixels") or 0)),
        "atlasPages": len(pages),
        "atlasBytes": sum(int(page.get("bytes") or 0) for page in pages),
        "atlases": pages,
    }


def planned_atlas_page_count(actor: dict, portal_root: Path) -> int:
    dimensions_by_hash: dict[str, tuple[int, int]] = {}
    source_by_hash: dict[str, Path] = {}
    for ref in frame_refs(actor):
        source = portal_path_for_ref(portal_root, ref)
        if not source.exists():
            raise FileNotFoundError(f"Missing roster frame: {source}")
        digest = file_hash(source)
        source_by_hash.setdefault(digest, source)
        if digest not in dimensions_by_hash:
            with Image.open(source) as image:
                dimensions_by_hash[digest] = image.size
    items = sorted(
        dimensions_by_hash,
        key=lambda digest: (
            max(dimensions_by_hash[digest]),
            dimensions_by_hash[digest][0] * dimensions_by_hash[digest][1],
            digest,
        ),
        reverse=True,
    )
    pages: list[Page] = []
    for digest in items:
        width, height = dimensions_by_hash[digest]
        if width + PADDING * 2 > MAX_TEXTURE or height + PADDING * 2 > MAX_TEXTURE:
            raise ValueError(f"Frame exceeds {MAX_TEXTURE}px atlas limit: {source_by_hash[digest]} ({width}x{height})")
        if any(page.place(digest, width, height) for page in pages):
            continue
        page = Page()
        if not page.place(digest, width, height):
            raise RuntimeError(f"Unable to place frame: {source_by_hash[digest]}")
        pages.append(page)
    return len(pages)


def git_tracked_paths(repo_root: Path) -> set[str]:
    raw = subprocess.check_output(["git", "ls-files", "-z"], cwd=repo_root)
    return {part.decode("utf-8").replace("\\", "/") for part in raw.split(b"\0") if part}


def repo_relative(path: Path, repo_root: Path) -> str:
    return path.resolve().relative_to(repo_root).as_posix()


def path_is_within(path: str, directory: str) -> bool:
    return path == directory or path.startswith(f"{directory}/")


def projected_tracked_file_count(
    *,
    repo_root: Path,
    roster_root: Path,
    output_root: Path,
    manifest_path: Path,
    actor_page_counts: dict[str, int],
    cleanup_loose: bool,
    replace_entire_output: bool,
) -> int:
    tracked = git_tracked_paths(repo_root)
    removed: set[str] = set()
    output_rel = repo_relative(output_root, repo_root)
    if replace_entire_output:
        removed.update(path for path in tracked if path_is_within(path, output_rel))
    else:
        for actor_key in actor_page_counts:
            actor_rel = repo_relative(output_root / actor_key, repo_root)
            removed.update(path for path in tracked if path_is_within(path, actor_rel))
    if cleanup_loose:
        for actor_key in actor_page_counts:
            loose_rel = repo_relative(roster_root / actor_key, repo_root)
            removed.update(path for path in tracked if path_is_within(path, loose_rel))

    added = {
        repo_relative(output_root / actor_key / f"{actor_key}-{index:02d}.webp", repo_root)
        for actor_key, page_count in actor_page_counts.items()
        for index in range(page_count)
    }
    added.add(repo_relative(manifest_path, repo_root))
    added.add(repo_relative(output_root / "hmh-animated-roster-atlas.json", repo_root))
    return len((tracked - removed) | added)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--source-manifest", type=Path)
    parser.add_argument("--only", help="comma-separated actor keys to repack in place")
    parser.add_argument("--cleanup-loose", action="store_true", help="remove selected loose source actor directories after successful packing")
    parser.add_argument("--file-count-cap", type=int, default=8000, help="abort before writing if projected Git tracked files exceed this cap")
    args = parser.parse_args()
    repo_root = args.repo.resolve()
    portal_root = repo_root / "apps" / "portal"
    roster_root = portal_root / "assets" / "generated" / "hmh-animated-roster"
    manifest_path = args.source_manifest or roster_root / "hmh-animated-roster.mjs"
    output_root = portal_root / "assets" / "generated" / "hmh-animated-roster-atlas"
    selected = {part.strip() for part in (args.only or "").split(",") if part.strip()}

    roster = parse_roster_module(manifest_path)
    missing = sorted(selected - set(roster))
    if missing:
        raise SystemExit(f"Unknown --only actor keys: {', '.join(missing)}")
    target_keys = sorted(selected or set(roster))
    actor_page_counts = {
        actor_key: planned_atlas_page_count(roster[actor_key], portal_root)
        for actor_key in target_keys
    }
    projected_count = projected_tracked_file_count(
        repo_root=repo_root,
        roster_root=roster_root,
        output_root=output_root,
        manifest_path=manifest_path,
        actor_page_counts=actor_page_counts,
        cleanup_loose=bool(selected and args.cleanup_loose),
        replace_entire_output=not selected,
    )
    if args.file_count_cap > 0 and projected_count > args.file_count_cap:
        raise SystemExit(
            f"Tracked-file cap exceeded before packing: projected {projected_count} > {args.file_count_cap}; no files changed"
        )
    print(f"tracked-file preflight: projected {projected_count}/{args.file_count_cap}")

    if not selected and output_root.exists():
        shutil.rmtree(output_root)
    output_root.mkdir(parents=True, exist_ok=True)

    packed: dict[str, dict] = dict(roster)
    for actor_key, actor in roster.items():
        if selected and actor_key not in selected:
            continue
        actor_output = output_root / actor_key
        if actor_output.exists():
            shutil.rmtree(actor_output)
        ref_map, report = pack_actor(actor_key, actor, portal_root, output_root)
        packed[actor_key] = rewrite_actor(actor, ref_map, report)
        print(
            f"{actor_key}: {report['sourceFrameRefs']} refs -> {report['uniqueFramePixels']} unique "
            f"-> {report['atlasPages']} pages / {report['atlasBytes']} bytes"
        )

    reports = [report_from_packed_actor(actor_key, actor) for actor_key, actor in packed.items()]
    metadata = {
        "version": "hmh-animated-roster-atlas-v1",
        "format": "lossless-webp-frame-ref-v1",
        "maxTextureSize": MAX_TEXTURE,
        "padding": PADDING,
        "actorCount": len(packed),
        "sourceFrameRefs": sum(report["sourceFrameRefs"] for report in reports),
        "uniqueFramePixels": sum(report["uniqueFramePixels"] for report in reports),
        "atlasPageCount": sum(report["atlasPages"] for report in reports),
        "atlasBytes": sum(report["atlasBytes"] for report in reports),
        "actors": reports,
    }
    module = (
        "// AUTO-GENERATED by scripts/pack-hmh-animated-roster.py. Do not hand-edit.\n"
        "// Lossless per-actor atlas refs preserve the original state/direction/frame matrix.\n"
        f"export const HMH_ANIMATED_ROSTER_ATLAS = Object.freeze({json.dumps(metadata, separators=(',', ':'))});\n"
        f"export const HMH_ANIMATED_ROSTER = Object.freeze({json.dumps(packed, separators=(',', ':'))});\n"
    )
    manifest_path.write_text(module, encoding="utf-8")
    (output_root / "hmh-animated-roster-atlas.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    if selected and args.cleanup_loose:
        for actor_key in sorted(selected):
            loose_dir = roster_root / actor_key
            if loose_dir.exists():
                shutil.rmtree(loose_dir)
                print(f"removed loose frames: {loose_dir.relative_to(repo_root)}")
    print(
        f"PASS: {metadata['sourceFrameRefs']} refs -> {metadata['uniqueFramePixels']} unique pixels -> "
        f"{metadata['atlasPageCount']} atlas pages / {metadata['atlasBytes']} bytes"
    )


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Ingest Justin-provided Lester/Lilly canon references into the repo.

This script copies source PNG references from Justin's local art folders into
`docs/art/canon/`, creates preview thumbnails/contact sheets, writes a JSON
manifest, and regenerates `docs/art/HERO_CANON.md`.

It deliberately does NOT generate derivative animation frames. Player character
identity is reference-first; generation/wiring comes after this canon lock.
"""

from __future__ import annotations

import json
import re
import shutil
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFont

REPO = Path(__file__).resolve().parents[1]
OUT_ROOT = REPO / "docs" / "art" / "canon"
MANIFEST_PATH = OUT_ROOT / "hero-canon-manifest.json"
DOC_PATH = REPO / "docs" / "art" / "HERO_CANON.md"

SOURCE_DIRS = [
    Path.home() / "Desktop" / "My Stuff" / "Lester's Arcade" / "Hard Money Heroes" / "Art Assets",
    Path.home() / "Desktop" / "LDA" / "LitVM" / "2026" / "References and Logos",
]

HEROES = ("lester", "lilly")
CANON_NAME_RE = re.compile(r"^(lester|lilly)(?:-|character|charactersheet|_|\s|$)", re.IGNORECASE)
EXCLUDE_RE = re.compile(r"lestersarcade|banner|logo|litvm|litecoin", re.IGNORECASE)

ROLE_HINTS = [
    ("idle", re.compile(r"idle", re.IGNORECASE)),
    ("walk", re.compile(r"walk", re.IGNORECASE)),
    ("run", re.compile(r"run", re.IGNORECASE)),
    ("attack", re.compile(r"attack", re.IGNORECASE)),
    ("pistol", re.compile(r"pistol", re.IGNORECASE)),
    ("shotgun", re.compile(r"shotgun", re.IGNORECASE)),
    ("machine-gun", re.compile(r"machine[-_ ]?gun|machinegun", re.IGNORECASE)),
    ("grenade", re.compile(r"grenade", re.IGNORECASE)),
    ("melee-knife", re.compile(r"melee|knife|stab", re.IGNORECASE)),
    ("headshot", re.compile(r"headshot|pfp", re.IGNORECASE)),
    ("character-sheet", re.compile(r"character[-_ ]?sheet|fullbody|turnaround", re.IGNORECASE)),
]

DIRECTION_HINTS = [
    ("south", re.compile(r"facing|front", re.IGNORECASE)),
    ("west", re.compile(r"leftside|left[-_ ]?profile", re.IGNORECASE)),
    ("east", re.compile(r"rightside|right[-_ ]?profile", re.IGNORECASE)),
    ("turnaround", re.compile(r"turnaround|3shot|3[-_ ]?shot|sheet", re.IGNORECASE)),
]

@dataclass(frozen=True)
class RefEntry:
    hero: str
    id: str
    role: str
    direction: str
    source_path: str
    repo_path: str
    preview_path: str
    width: int
    height: int
    mode: str
    has_alpha: bool
    alpha_min: int | None
    alpha_max: int | None
    file_size: int


def slugify(stem: str) -> str:
    s = stem.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    s = re.sub(r"-+", "-", s)
    return s or "ref"


def infer_role(name: str) -> str:
    for role, rx in ROLE_HINTS:
        if rx.search(name):
            return role
    return "reference"


def infer_direction(name: str) -> str:
    for direction, rx in DIRECTION_HINTS:
        if rx.search(name):
            return direction
    return "unspecified"


def rel(path: Path) -> str:
    return path.relative_to(REPO).as_posix()


def iter_sources() -> Iterable[Path]:
    seen = set()
    for source_dir in SOURCE_DIRS:
        if not source_dir.exists():
            continue
        for path in source_dir.rglob("*.png"):
            name = path.name
            if path in seen:
                continue
            seen.add(path)
            if not CANON_NAME_RE.search(name):
                continue
            if EXCLUDE_RE.search(name):
                continue
            yield path


def open_image(path: Path) -> Image.Image:
    img = Image.open(path)
    img.load()
    return img


def image_alpha_stats(img: Image.Image) -> tuple[bool, int | None, int | None]:
    if img.mode not in ("RGBA", "LA") and "transparency" not in img.info:
        return False, None, None
    alpha = img.convert("RGBA").getchannel("A")
    extrema = alpha.getextrema()
    return extrema != (255, 255), int(extrema[0]), int(extrema[1])


def make_preview(src: Path, dest: Path, max_size: int = 360) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with open_image(src) as img:
        rgba = img.convert("RGBA")
        rgba.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        bg = Image.new("RGBA", rgba.size, (24, 24, 32, 255))
        checker = Image.new("RGBA", rgba.size, (0, 0, 0, 0))
        cd = ImageDraw.Draw(checker)
        tile = 16
        for y in range(0, rgba.height, tile):
            for x in range(0, rgba.width, tile):
                if (x // tile + y // tile) % 2 == 0:
                    cd.rectangle([x, y, x + tile - 1, y + tile - 1], fill=(50, 50, 62, 255))
        out = Image.alpha_composite(bg, checker)
        out.alpha_composite(rgba, ((out.width - rgba.width) // 2, (out.height - rgba.height) // 2))
        out.convert("RGB").save(dest, quality=92)


def draw_label(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str) -> None:
    try:
        font = ImageFont.truetype("arial.ttf", 13)
    except Exception:
        font = ImageFont.load_default()
    x, y = xy
    draw.rectangle([x - 4, y - 3, x + min(260, len(text) * 8), y + 30], fill=(8, 10, 18, 210))
    draw.text((x, y), text, fill=(235, 242, 255), font=font)


def make_contact_sheet(hero: str, entries: list[RefEntry]) -> Path:
    if not entries:
        raise ValueError(f"no entries for {hero}")
    thumb_w, thumb_h = 220, 190
    cols = 4
    rows = (len(entries) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * thumb_w, rows * thumb_h), (14, 16, 24))
    draw = ImageDraw.Draw(sheet, "RGBA")
    for idx, entry in enumerate(entries):
        x = (idx % cols) * thumb_w
        y = (idx // cols) * thumb_h
        preview = Image.open(REPO / entry.preview_path).convert("RGB")
        preview.thumbnail((thumb_w - 20, thumb_h - 54), Image.Resampling.LANCZOS)
        px = x + (thumb_w - preview.width) // 2
        py = y + 8
        sheet.paste(preview, (px, py))
        draw.rectangle([x, y, x + thumb_w - 1, y + thumb_h - 1], outline=(82, 111, 161, 180), width=1)
        label = f"{entry.id}\n{entry.role} / {entry.direction}"
        draw_label(draw, (x + 8, y + thumb_h - 40), label)
    out = OUT_ROOT / hero / f"{hero}-canon-contact-sheet.jpg"
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out, quality=92)
    return out


def reset_generated_dirs() -> None:
    for hero in HEROES:
        for dirname in ("source", "preview"):
            path = OUT_ROOT / hero / dirname
            if path.exists():
                shutil.rmtree(path)
        contact = OUT_ROOT / hero / f"{hero}-canon-contact-sheet.jpg"
        if contact.exists():
            contact.unlink()


def copy_refs() -> list[RefEntry]:
    entries: list[RefEntry] = []
    used_ids: dict[str, int] = {}
    final_ids: set[str] = set()
    for src in sorted(iter_sources(), key=lambda p: p.name.lower()):
        hero = src.name.split("-")[0].split("_")[0].lower()
        if hero.startswith("lester"):
            hero = "lester"
        elif hero.startswith("lilly"):
            hero = "lilly"
        else:
            continue
        stem = slugify(src.stem)
        base_id = stem
        n = used_ids.get(base_id, 0)
        used_ids[base_id] = n + 1
        ref_id = base_id if n == 0 else f"{base_id}-{n+1}"
        while ref_id in final_ids:
            n += 1
            ref_id = f"{base_id}-{n+1}"
        used_ids[base_id] = n + 1
        final_ids.add(ref_id)
        role = infer_role(src.name)
        direction = infer_direction(src.name)
        dest = OUT_ROOT / hero / "source" / f"{ref_id}{src.suffix.lower()}"
        preview = OUT_ROOT / hero / "preview" / f"{ref_id}.jpg"
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)
        make_preview(dest, preview)
        with open_image(dest) as img:
            has_alpha, alpha_min, alpha_max = image_alpha_stats(img)
            entry = RefEntry(
                hero=hero,
                id=ref_id,
                role=role,
                direction=direction,
                source_path=str(src),
                repo_path=rel(dest),
                preview_path=rel(preview),
                width=img.width,
                height=img.height,
                mode=img.mode,
                has_alpha=has_alpha,
                alpha_min=alpha_min,
                alpha_max=alpha_max,
                file_size=dest.stat().st_size,
            )
        entries.append(entry)
    return entries


def write_doc(entries: list[RefEntry], contact_sheets: dict[str, Path]) -> None:
    by_hero = {hero: [e for e in entries if e.hero == hero] for hero in HEROES}
    lines = [
        "# Hard Money Heroes — Hero Canon References",
        "",
        f"Generated by `scripts/ingest-hmh-hero-canon-refs.py` on {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%SZ')}.",
        "",
        "These are Justin-approved source references for canonical Lester and Lilly. All later sprite generation must preserve these silhouettes, colors, costumes, faces, and weapon/pose cues. Do not replace player-character identity with generic AI lookalikes.",
        "",
        "## Production target",
        "",
        "- Redo Lester and Lilly as higher-quality in-game pixel sprites.",
        "- Produce 8 directions: S, SE, E, NE, N, NW, W, SW.",
        "- Required states: idle, walk, run, shoot-pistol, shoot-shotgun, shoot-mg, melee, throw-grenade, hurt, death, dash, victory.",
        "- Runtime frames must use transparent PNGs, fixed canvas, bottom-center anchor, muzzle/hand/footstep event metadata, and contact sheets before integration.",
        "",
        "## Contact sheets",
        "",
    ]
    for hero in HEROES:
        if hero in contact_sheets:
            lines.append(f"- {hero.title()}: `{rel(contact_sheets[hero])}`")
    lines += ["", "## Hero reference inventory", ""]
    for hero in HEROES:
        hero_entries = by_hero[hero]
        lines += [f"### {hero.title()}", "", f"Count: {len(hero_entries)}", "", "| id | role | direction | dimensions | alpha | repo path |", "|---|---:|---:|---:|---:|---|"]
        for e in hero_entries:
            alpha = "yes" if e.has_alpha else "no"
            lines.append(f"| `{e.id}` | {e.role} | {e.direction} | {e.width}×{e.height} | {alpha} | `{e.repo_path}` |")
        lines.append("")
    lines += [
        "## Must-preserve identity notes",
        "",
        "### Lester",
        "",
        "- Blue spherical head/helmet silhouette with white Litecoin-style L mark.",
        "- Simple readable face: two eyes and mouth must survive small sprite scale.",
        "- Arcade commando posture; compact body; weapon poses are reference-first.",
        "",
        "### Lilly",
        "",
        "- Teal hair, glasses, tactical companion silhouette, gold/teal armor language.",
        "- Slimmer body read than Lester; face/glasses/hair are the primary identity lock.",
        "- Pistol/shotgun/machine-gun/grenade/knife poses in refs set hand and weapon anchors.",
        "",
        "## Deprecated generated lookalike policy",
        "",
        "Any existing/generated player art that does not match these refs should be treated as placeholder or reassigned to non-player/NPC/enemy use. It must not be presented as canonical Lester or Lilly in new runtime manifests.",
    ]
    DOC_PATH.parent.mkdir(parents=True, exist_ok=True)
    DOC_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    reset_generated_dirs()
    entries = copy_refs()
    if not entries:
        raise SystemExit("No Lester/Lilly canon PNG refs found in configured source dirs")
    contact_sheets: dict[str, Path] = {}
    for hero in HEROES:
        hero_entries = [e for e in entries if e.hero == hero]
        if hero_entries:
            contact_sheets[hero] = make_contact_sheet(hero, hero_entries)
    manifest = {
        "id": "hmh-hero-canon-refs-v1",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sourceDirs": [str(p) for p in SOURCE_DIRS],
        "heroes": {
            hero: {
                "count": len([e for e in entries if e.hero == hero]),
                "contactSheet": rel(contact_sheets[hero]) if hero in contact_sheets else None,
                "entries": [asdict(e) for e in entries if e.hero == hero],
            }
            for hero in HEROES
        },
        "productionTarget": {
            "directions": ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"],
            "states": ["idle", "walk", "run", "shoot-pistol", "shoot-shotgun", "shoot-mg", "melee", "throw-grenade", "hurt", "death", "dash", "victory"],
            "approval": "Justin approved these references as Lester/Lilly canon in chat before generation.",
        },
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    write_doc(entries, contact_sheets)
    print(json.dumps({
        "entries": len(entries),
        "heroes": {hero: len([e for e in entries if e.hero == hero]) for hero in HEROES},
        "manifest": rel(MANIFEST_PATH),
        "doc": rel(DOC_PATH),
        "contactSheets": {hero: rel(path) for hero, path in contact_sheets.items()},
    }, indent=2))


if __name__ == "__main__":
    main()

#!/usr/bin/env python
"""Ingest Justin's canonical hand-made Hard Money Heroes art into the repo.

Source of truth: C:/Users/just_/Desktop/My Stuff/Lester's Arcade/Hard Money
Heroes/Art Assets. These are high-res concept/animation frames on a flat
chroma background. This tool:
  1. removes the flat background (corner-sampled flood fill) -> transparency
  2. auto-crops to the character bounding box
  3. rescales to a consistent game sprite height (preserving aspect)
  4. groups numbered frames into animation states (idle/walk/run/jump/attack...)
  5. emits sprite-pipeline-schema .mjs manifests (apps/portal/src/sprite-pipeline.mjs)

Generation tools (PixelLab/img-gen) are used ELSEWHERE only to ADD frames,
tilesets, and VFX -- never to replace these canonical character designs.
"""
from __future__ import annotations

import json
import re
import shutil
from collections import defaultdict
from pathlib import Path
from typing import Any

from PIL import Image

SRC = Path(r"C:/Users/just_/Desktop/My Stuff/Lester's Arcade/Hard Money Heroes/Art Assets")
ROOT = Path(__file__).resolve().parents[1]
PUBLIC_ROOT = Path("apps/portal/assets/generated/hmh-canonical-art")
OUT_ROOT = ROOT / PUBLIC_ROOT
DOC_PATH = ROOT / "docs/game-design/hard-money-heroes-canonical-art-pack.md"

# Target sprite heights per role (px). Heroes/enemies sized for the combat scale;
# bosses larger. Width follows aspect ratio.
TARGET_HEIGHT = {"hero": 96, "enemy": 88, "miniboss": 120, "boss": 150}

BG_TOLERANCE = 42  # color distance for background flood removal

# Roster: maps a character to its source files. `dir` is relative to SRC.
# Each state lists candidate filename stems (without extension); numbered
# variants like "Lilly-idle (1)" are auto-collected as extra frames.
ROSTER: list[dict[str, Any]] = [
    {
        "id": "lester", "role": "hero", "dir": "Lester",
        "look": "blue spherical head, white Litecoin L logo, two eyes + mouth",
        "states": {
            "idle": ["Lester-idle"], "walk": ["Lester-walk"], "run": ["Lester-run", "Lester-run-v1"],
            "jump": ["Lester-jump"], "shoot": ["Lester-Facing-Shotgun"], "melee": ["Lester-stab"],
        },
        "sheets": ["Lester-Sprites-01", "Lester-Sprites-02"],
    },
    {
        "id": "lilly", "role": "hero", "dir": ".",
        "look": "teal hair, glasses",
        "states": {
            "idle": ["Lilly-idle"], "walk": ["Lilly-walk"], "run": ["Lilly-run"],
            "jump": ["Lilly-jump"], "attack": ["Lilly-attack"],
        },
        "sheets": ["Lilly/Lilly-Sprites"],
    },
    {
        "id": "trench-degen", "role": "enemy", "dir": ".",
        "states": {
            "idle": ["Trench Degen-idle"], "walk": ["Trench Degen-walk"], "run": ["Trench Degen-run"],
            "jump": ["Trench Degen-jump"], "attack": ["Trench Degen-attack"],
        },
        "health_variants": {
            "75": "Enemy-Facing-Trench-Degen-75Health", "50": "Enemy-Facing-Trench-Degen-50Health",
            "25": "Enemy-Facing-Trench-Degen-25Health",
        },
    },
    {
        "id": "evil-banker", "role": "enemy", "dir": ".",
        "states": {
            "idle": ["Evil Banker-idle"], "walk": ["Evil Banker-walk"], "run": ["Evil Banker-run"],
            "jump": ["Evil Banker-jump"], "attack": ["Evil Banker-attack"],
        },
        "health_variants": {
            "75": "Enemy-Facing-EvilBanker-75Health", "50": "Enemy-Facing-EvilBanker-50Health",
        },
    },
    {
        "id": "crypto-bro", "role": "enemy", "dir": "Enemies",
        "states": {
            "idle": ["Crypto Bro-idle"], "walk": ["Crypto Bro-walk"], "run": ["Crypto Bro-run"],
            "jump": ["Crypto Bro-jump"], "attack": ["Crypto Bro-attack"],
        },
    },
    {
        "id": "gas-beast", "role": "enemy", "dir": "Enemies",
        "states": {
            "idle": ["Gas Beast-idle"], "walk": ["Gas Beast-walk"], "run": ["Gas Beast-run"],
            "jump": ["Gas Beast-jump"], "attack": ["Gas Beast-attack"],
        },
    },
    {
        "id": "evil-boss", "role": "boss", "dir": ".",
        "states": {
            "idle": ["Evil Boss-idle"], "walk": ["Evil Boss-walk"], "run": ["Evil Boss-run"],
            "jump": ["Evil Boss-jump"], "attack": ["Evil Boss-attack"],
        },
    },
    {
        "id": "warren-boss", "role": "boss", "dir": ".",
        "states": {"idle": ["Enemy-Boss-WarrenIndian-Facing"]},
        "health_variants": {
            "75": "Enemy-Boss-WarrenIndian-Facing-75Health", "50": "Enemy-Boss-WarrenIndian-Facing-50Health",
        },
    },
]


def color_dist(a, b) -> float:
    return sum((x - y) ** 2 for x, y in zip(a[:3], b[:3])) ** 0.5


def _bg_color(im: Image.Image):
    return im.convert("RGBA").getpixel((1, 1))


def detect_cells(im: Image.Image):
    """Detect grid cells separated by background gutters.

    Returns a list of (x0, y0, x1, y1) bounding boxes, one per non-empty cell,
    in row-major order. Handles single-pose, tiled-same-pose, and real
    animation-strip sheets uniformly.
    """
    import numpy as np
    rgba = im.convert("RGBA")
    arr = np.array(rgba)
    h, w = arr.shape[0], arr.shape[1]
    bg = np.array(rgba.getpixel((1, 1))[:3], dtype=int)
    diff = np.sqrt(((arr[:, :, :3].astype(int) - bg) ** 2).sum(axis=2))
    fg = diff > BG_TOLERANCE
    col_has = fg.sum(axis=0) > (h * 0.012)
    row_has = fg.sum(axis=1) > (w * 0.012)

    def spans(mask):
        out, start = [], None
        for i, v in enumerate(mask):
            if v and start is None:
                start = i
            elif not v and start is not None:
                out.append((start, i)); start = None
        if start is not None:
            out.append((start, len(mask)))
        # merge spans separated by tiny gutters (<1.5% of dimension)
        merged = []
        gap = max(2, int(len(mask) * 0.015))
        for s in out:
            if merged and s[0] - merged[-1][1] <= gap:
                merged[-1] = (merged[-1][0], s[1])
            else:
                merged.append(list(s))
        return [tuple(m) for m in merged if m[1] - m[0] > len(mask) * 0.02]

    col_spans = spans(col_has)
    row_spans = spans(row_has)
    cells = []
    for (y0, y1) in row_spans:
        for (x0, x1) in col_spans:
            cells.append((x0, y0, x1, y1))
    return cells, len(col_spans), len(row_spans)


def cell_signature(im: Image.Image, box):
    """Downsampled grayscale signature for fuzzy cell comparison."""
    cell = im.crop(box).convert("L").resize((16, 16), Image.BILINEAR)
    return list(cell.getdata())


def _sig_distance(a, b) -> float:
    if not a or not b or len(a) != len(b):
        return 1e9
    return sum(abs(x - y) for x, y in zip(a, b)) / len(a)


def extract_frames(path: Path) -> list[Image.Image]:
    """Slice a source sheet into distinct, background-removed character frames.

    Source sheets are grids where each ROW is the same animation sequence and
    rows repeat. Strategy: take the first row of cells, then fuzzy-dedup
    consecutive identical cells. A single-pose/tiled sheet collapses to 1 frame;
    a real animation row yields its N distinct frames in order.
    """
    im = Image.open(path)
    cells, ncols, nrows = detect_cells(im)
    if not cells or (ncols <= 1 and nrows <= 1):
        return [remove_background(im)]
    # Cells are row-major; the first `ncols` are the top row = one full sequence.
    first_row = cells[:ncols] if ncols >= 1 else cells
    sigs = [cell_signature(im, box) for box in first_row]
    # Fuzzy-dedup: drop a cell if it's nearly identical to the previously kept one.
    THRESH = 6.0  # mean per-pixel gray diff (0-255)
    kept_boxes = []
    last_sig = None
    for box, sig in zip(first_row, sigs):
        if last_sig is not None and _sig_distance(sig, last_sig) < THRESH:
            continue
        kept_boxes.append(box)
        last_sig = sig
    # If the whole row collapsed to duplicates, it's a tiled single pose.
    if not kept_boxes:
        kept_boxes = [first_row[0]]
    frames = []
    for box in kept_boxes:
        frame = remove_background(im.crop(box))
        if frame.size[0] >= 8 and frame.size[1] >= 8:
            frames.append(frame)
    return frames or [remove_background(im)]


def remove_background(im: Image.Image) -> Image.Image:
    """Flood-remove the flat corner background to transparency, then crop."""
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    bg = im.getpixel((1, 1))
    from collections import deque
    seen = [[False] * w for _ in range(h)]
    dq = deque()
    for x in range(w):
        dq.append((x, 0)); dq.append((x, h - 1))
    for y in range(h):
        dq.append((0, y)); dq.append((w - 1, y))
    while dq:
        x, y = dq.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y][x]:
            continue
        seen[y][x] = True
        r, g, b, a = px[x, y]
        if color_dist((r, g, b), bg) <= BG_TOLERANCE:
            px[x, y] = (r, g, b, 0)
            dq.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    return im


def scale_to_height(im: Image.Image, target_h: int) -> Image.Image:
    w, h = im.size
    if h == 0:
        return im
    ratio = target_h / h
    new_w = max(1, round(w * ratio))
    # Nearest keeps crisp pixel edges for a pixel-art feel.
    return im.resize((new_w, target_h), Image.NEAREST)


def find_source_files(base: Path, stem: str) -> list[Path]:
    """Find <stem>.png plus numbered variants '<stem> (N).png', sorted."""
    out = []
    exact = base / f"{stem}.png"
    if exact.exists():
        out.append(exact)
    variants = sorted(base.glob(f"{stem} (*).png"), key=lambda p: p.name)
    out.extend(variants)
    return out


def process_actor(actor: dict[str, Any]) -> dict[str, Any] | None:
    role = actor["role"]
    target_h = TARGET_HEIGHT[role]
    base = SRC / actor["dir"]
    out_dir = OUT_ROOT / actor["id"]
    if out_dir.exists():
        shutil.rmtree(out_dir)
    states_out: dict[str, Any] = {}
    max_w = 0
    for state, stems in actor.get("states", {}).items():
        srcs: list[Path] = []
        for stem in stems:
            srcs.extend(find_source_files(base, stem))
        if not srcs:
            continue
        adir = out_dir / state
        adir.mkdir(parents=True, exist_ok=True)
        rels = []
        frame_idx = 0
        for sp in srcs:
            try:
                frames = extract_frames(sp)
                for im in frames:
                    im = scale_to_height(im, target_h)
                    max_w = max(max_w, im.size[0])
                    dest = adir / f"{state}-{frame_idx:02d}.png"
                    im.save(dest)
                    rels.append(f"./assets/generated/hmh-canonical-art/{actor['id']}/{state}/{dest.name}")
                    frame_idx += 1
            except Exception as exc:
                (adir / f"{state}-{frame_idx:02d}.error.txt").write_text(str(exc), encoding="utf-8")
        if rels:
            fps = {"idle": 6, "walk": 10, "run": 14, "jump": 10, "attack": 14, "shoot": 16, "melee": 16}.get(state, 10)
            loop = state in ("idle", "walk", "run")
            states_out[state] = {"fps": fps, "loop": loop, "frames": {"south": rels}}
    if not states_out:
        return None
    # Health-tier stills (already-drawn damage variants) become single-frame states.
    for tier, stem in actor.get("health_variants", {}).items():
        srcs = find_source_files(base, stem)
        if not srcs:
            continue
        adir = out_dir / f"health-{tier}"
        adir.mkdir(parents=True, exist_ok=True)
        rels = []
        idx = 0
        for sp in srcs:
            for im in extract_frames(sp):
                im = scale_to_height(im, target_h)
                dest = adir / f"health-{tier}-{idx:02d}.png"
                im.save(dest)
                rels.append(f"./assets/generated/hmh-canonical-art/{actor['id']}/health-{tier}/{dest.name}")
                idx += 1
        states_out[f"health-{tier}"] = {"fps": 6, "loop": True, "frames": {"south": rels}}

    manifest = {
        "id": actor["id"], "role": role,
        "frameSize": [max_w or target_h, target_h],
        "anchor": "bottom-center",
        "directions": ["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"],
        "defaultDirection": "south",
        "targetFps": 60,
        "source": "Justin canonical hand-made art (background-removed, cropped, rescaled)",
        "look": actor.get("look", ""),
        "stateAliases": {"shoot": "attack", "melee": "attack"} if "attack" in states_out and "shoot" not in states_out else {},
        "states": states_out,
    }
    export = "HMH_CANON_" + actor["id"].upper().replace("-", "_")
    mpath = out_dir / f"{actor['id']}.mjs"
    mpath.write_text(
        f"// Canonical hand-made art manifest for {actor['id']} (sprite-pipeline schema).\n"
        f"// Source: Justin's Art Assets. Generation tools only ADD frames, never redesign.\n"
        f"export const {export} = Object.freeze(" + json.dumps(manifest, indent=2) + ");\n",
        encoding="utf-8",
    )
    return {"id": actor["id"], "role": role, "states": list(states_out.keys()), "frameSize": manifest["frameSize"]}


def main() -> None:
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    summary = []
    for actor in ROSTER:
        res = process_actor(actor)
        if res:
            summary.append(res)
            print(f"ingested {res['id']}: {res['states']} @ {res['frameSize']}", flush=True)
        else:
            print(f"SKIP {actor['id']}: no source frames found", flush=True)
    print(json.dumps({"ingested": summary}, indent=2))


if __name__ == "__main__":
    main()

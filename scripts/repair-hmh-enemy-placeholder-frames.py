#!/usr/bin/env python3
"""Replace live QA-green enemy placeholder frames with local same-character art.

The bad c241cf97 generation pass left several enemies as tiny 5-color triangle bodies
(`qa-green-native-*`). This script quarantines those runtime kits without inventing
new designs:
- claim-jumper: promote its existing high-quality cowboy/rifle `shoot/*` frames across
  placeholder states.
- fud-goblin: promote the repo-local bonus Fud Goblin body frames into 8-direction
  runtime slots (mirrored for side/back reads until final art exists).
- gas-beast-tank: promote canonical Gas Beast frames into the tank runtime slot.
- gas-fee-wisp: no acceptable wisp source exists yet, so replace the triangle wisp
  with canonical Gas Beast-derived frames as a temporary gameplay-safe proxy and
  change metadata to mark it as quarantined proxy art instead of QA-green native art.

This is a quality gate fix: no live runtime frame should use the low-color triangle
placeholder signature.
"""

from __future__ import annotations

from pathlib import Path
from shutil import copyfile
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
ROSTER = ROOT / "apps/portal/assets/generated/hmh-animated-roster"
DIRECTIONS = ("south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west")
SIDE_FLIP = {"west": "east", "south-west": "south-east", "north-west": "north-east"}


def frame_stats(path: Path) -> tuple[int, int]:
    im = Image.open(path).convert("RGBA")
    pixels = [(r, g, b) for r, g, b, a in im.getdata() if a > 0]
    return path.stat().st_size, len(set(pixels))


def is_placeholder(path: Path) -> bool:
    size, colors = frame_stats(path)
    return size < 950 and colors <= 8


def sorted_pngs(directory: Path) -> list[Path]:
    return sorted(directory.glob("*.png"), key=lambda p: int(p.stem) if p.stem.isdigit() else p.name)


def non_placeholder_sources(paths: list[Path]) -> list[Path]:
    return [p for p in paths if p.exists() and not is_placeholder(p)]


def copy_or_flip(src: Path, dst: Path, flip: bool = False) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if not flip:
        copyfile(src, dst)
        return
    im = Image.open(src).convert("RGBA")
    ImageOps.mirror(im).save(dst)


def promote_actor_from_sources(actor: str, source_by_direction: dict[str, list[Path]], *, metadata_id: str) -> int:
    actor_root = ROSTER / actor
    if not actor_root.exists():
        raise FileNotFoundError(actor_root)
    replaced = 0
    for anim_dir in sorted(p for p in actor_root.iterdir() if p.is_dir()):
        anim = anim_dir.name
        for direction in DIRECTIONS:
            directory = anim_dir / direction
            if not directory.exists():
                continue
            frames = sorted_pngs(directory)
            if not frames:
                continue
            source_direction = direction
            flip = False
            if source_direction not in source_by_direction:
                source_direction = SIDE_FLIP.get(direction, "south")
                flip = direction in SIDE_FLIP
            sources = source_by_direction.get(source_direction) or source_by_direction.get("south")
            if not sources:
                raise RuntimeError(f"No source frames for {actor} {direction}")
            for idx, dst in enumerate(frames):
                if is_placeholder(dst):
                    copy_or_flip(sources[idx % len(sources)], dst, flip=flip)
                    replaced += 1
    return replaced


def path_list(pattern: str) -> list[Path]:
    return sorted(ROOT.glob(pattern), key=lambda p: p.name)


def fud_sources() -> dict[str, list[Path]]:
    base = ROOT / "apps/portal/assets/generated/hmh-bonus-enemies/fud-goblin"
    south = non_placeholder_sources(
        path_list("apps/portal/assets/generated/hmh-bonus-enemies/fud-goblin/walk/*.png")
        + path_list("apps/portal/assets/generated/hmh-bonus-enemies/fud-goblin/idle/*.png")
        + path_list("apps/portal/assets/generated/hmh-bonus-enemies/fud-goblin/attack/*.png")
        + path_list("apps/portal/assets/generated/hmh-bonus-enemies/fud-goblin/death/*.png")
    )
    if not south:
        south = non_placeholder_sources(sorted((ROSTER / "fud-goblin/hurt/south").glob("*.png")))
    if not south:
        raise RuntimeError(f"No usable Fud Goblin sources under {base}")
    return {"south": south, "south-east": south, "east": south, "north-east": south, "north": south}


def gas_beast_sources() -> dict[str, list[Path]]:
    base = ROOT / "apps/portal/assets/generated/hmh-canonical-art/gas-beast"
    south = non_placeholder_sources(
        path_list("apps/portal/assets/generated/hmh-canonical-art/gas-beast/run/*.png")
        + path_list("apps/portal/assets/generated/hmh-canonical-art/gas-beast/walk/*.png")
        + path_list("apps/portal/assets/generated/hmh-canonical-art/gas-beast/idle/*.png")
        + path_list("apps/portal/assets/generated/hmh-canonical-art/gas-beast/attack/*.png")
    )
    if not south:
        raise RuntimeError(f"No usable Gas Beast sources under {base}")
    return {"south": south, "south-east": south, "east": south, "north-east": south, "north": south}


def claim_jumper_sources() -> dict[str, list[Path]]:
    actor_root = ROSTER / "claim-jumper"
    sources: dict[str, list[Path]] = {}
    for direction in DIRECTIONS:
        frames = non_placeholder_sources(sorted_pngs(actor_root / "shoot" / direction))
        if frames:
            sources[direction] = frames
    if not sources:
        raise RuntimeError("No usable Claim Jumper shoot frames found")
    return sources


def patch_manifest_metadata() -> None:
    path = ROSTER / "hmh-animated-roster.mjs"
    text = path.read_text(encoding="utf-8")
    replacements = {
        '"character_id": "qa-green-native-fud-goblin-v1"': '"character_id": "fud-goblin-bonus-promoted-v2"',
        '"character_id": "qa-green-native-gas-beast-tank-v1"': '"character_id": "gas-beast-canonical-promoted-v2"',
        '"character_id": "qa-green-native-claim-jumper-v1"': '"character_id": "claim-jumper-cowboy-promoted-v2"',
        '"character_id": "qa-green-native-gas-fee-wisp-v1"': '"character_id": "gas-fee-wisp-quarantined-gas-beast-proxy-v2"',
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    path.write_text(text, encoding="utf-8")


def remaining_bad_frames() -> list[Path]:
    bad: list[Path] = []
    for actor in ("fud-goblin", "gas-fee-wisp", "gas-beast-tank", "claim-jumper"):
        for path in (ROSTER / actor).glob("*/*/*.png"):
            if is_placeholder(path):
                bad.append(path)
    return sorted(bad)


if __name__ == "__main__":
    counts = {
        "claim-jumper": promote_actor_from_sources("claim-jumper", claim_jumper_sources(), metadata_id="claim-jumper-cowboy-promoted-v2"),
        "fud-goblin": promote_actor_from_sources("fud-goblin", fud_sources(), metadata_id="fud-goblin-bonus-promoted-v2"),
        "gas-beast-tank": promote_actor_from_sources("gas-beast-tank", gas_beast_sources(), metadata_id="gas-beast-canonical-promoted-v2"),
        "gas-fee-wisp": promote_actor_from_sources("gas-fee-wisp", gas_beast_sources(), metadata_id="gas-fee-wisp-quarantined-gas-beast-proxy-v2"),
    }
    # The roster rebuild script derives paths from disk but preserves existing actor dirs;
    # patching metadata after rebuild keeps the live manifest honest about proxies.
    patch_manifest_metadata()
    bad = remaining_bad_frames()
    print("enemy placeholder replacements")
    for actor, count in counts.items():
        print(f"  {actor}: {count}")
    print(f"remaining bad QA-triangle signature frames: {len(bad)}")
    for path in bad[:20]:
        print("  BAD", path.relative_to(ROOT))
    if bad:
        raise SystemExit(1)

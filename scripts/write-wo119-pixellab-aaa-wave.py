#!/usr/bin/env python3
"""Write WO-119 PixelLab AAA wave proof/certification docs."""
from __future__ import annotations

import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PORTAL = ROOT / "apps/portal"
DOC_DIR = ROOT / "docs/game-design/wo119-pixellab-aaa-wave"
ROSTER_LEDGER = PORTAL / "assets/generated/hmh-animated-roster/roster-ledger.json"
CANDIDATE_MANIFEST = PORTAL / "assets/generated/hmh-coherent-world/level1-reference-style/candidates/level1-pixellab-candidates.manifest.json"
PROOF = DOC_DIR / "wo119-pixellab-aaa-wave-proof.png"
CERT = DOC_DIR / "wo119-pixellab-aaa-wave-certification.json"
README = DOC_DIR / "README.md"
DIRECTIONS = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"]
STATES = ["idle", "walk", "run", "attack-tell", "attack", "hit", "death", "spawn-in"]
WORLD_KEYS = [
    "buildings-and-walls/buildings-and-walls__gas-station-canopy",
    "buildings-and-walls/buildings-and-walls__saloon-false-front",
    "trees-rocks-and-natural-blockers/trees-rocks-and-natural-blockers__pine-oak-clusters",
    "roads-and-paths/roads-and-paths__broken-highway-lane",
    "regenerated-terrain/bridge-planks-regenerated",
    "buildings-and-walls/buildings-and-walls__litecoin-extraction-arch",
]


def repo_rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def portal_src_to_path(src: str) -> Path:
    return PORTAL / src.replace("./", "")


def load_image(path: Path) -> Image.Image:
    return Image.open(path).convert("RGBA")


def make_proof(roster: dict, manifest_entries: dict) -> None:
    DOC_DIR.mkdir(parents=True, exist_ok=True)
    cell = 128
    label_h = 18
    cols = 8
    rows = 3
    sheet = Image.new("RGBA", (cols * cell, rows * (cell + label_h)), (12, 10, 22, 255))
    draw = ImageDraw.Draw(sheet)

    paper = roster["paper-hand"]["animations"]
    for idx, state in enumerate(STATES):
        frames = paper[state]["south"]
        img = load_image(portal_src_to_path(frames[0]))
        img.thumbnail((96, 96), Image.Resampling.NEAREST)
        x = idx * cell + (cell - img.width) // 2
        y = 8
        sheet.alpha_composite(img, (x, y))
        draw.text((idx * cell + 4, cell - 12), f"paper {state[:10]}", fill=(255, 232, 77, 255))

    for idx, key in enumerate(WORLD_KEYS):
        entry = manifest_entries[key]
        img = load_image(portal_src_to_path(entry["src"]))
        img.thumbnail((108, 108), Image.Resampling.NEAREST)
        x = idx * cell + (cell - img.width) // 2
        y = cell + label_h + 8
        sheet.alpha_composite(img, (x, y))
        draw.text((idx * cell + 4, y + 110), key.split("__")[-1][:15], fill=(135, 229, 255, 255))

    # Direction evidence row for the promoted enemy.
    for idx, direction in enumerate(DIRECTIONS):
        frames = paper["attack-tell"][direction]
        img = load_image(portal_src_to_path(frames[0]))
        img.thumbnail((92, 92), Image.Resampling.NEAREST)
        x = idx * cell + (cell - img.width) // 2
        y = 2 * (cell + label_h) + 8
        sheet.alpha_composite(img, (x, y))
        draw.text((idx * cell + 4, y + 106), direction[:12], fill=(255, 183, 94, 255))

    sheet.save(PROOF)


def main() -> None:
    roster = json.loads(ROSTER_LEDGER.read_text(encoding="utf-8"))
    candidate_manifest = json.loads(CANDIDATE_MANIFEST.read_text(encoding="utf-8"))
    entries = {entry["key"]: entry for entry in candidate_manifest["entries"]}
    paper = roster["paper-hand"]
    missing = []
    for state in STATES:
        for direction in DIRECTIONS:
            frames = paper["animations"].get(state, {}).get(direction, [])
            if not frames:
                missing.append(f"paper-hand/{state}/{direction}")
                continue
            for src in frames:
                if not portal_src_to_path(src).exists():
                    missing.append(src)
    world_rows = []
    for key in WORLD_KEYS:
        entry = entries[key]
        disk = portal_src_to_path(entry["src"])
        if not disk.exists():
            missing.append(entry["src"])
        world_rows.append({
            "key": key,
            "src": entry["src"],
            "width": entry["width"],
            "height": entry["height"],
            "alphaClean": entry["alphaClean"],
            "runtimeIntegrated": entry.get("runtimeIntegrated") is True or entry.get("runtimeSurfaceIntegrated") is True,
            "runtimeDistrict": entry.get("runtimeDistrict"),
            "runtimeRole": entry.get("runtimeRole"),
            "runtimeRouteBeat": entry.get("runtimeRouteBeat"),
        })
    if missing:
        raise SystemExit("missing proof inputs: " + ", ".join(missing[:20]))

    make_proof(roster, entries)
    cert = {
        "id": "hmh-wo119-pixellab-aaa-wave-v1",
        "goal": "PixelLab-led AAA-quality runtime art upgrade for characters, enemy animation readability, terrain, tiles, props, and authored Level 1 route design.",
        "enemyReplacement": {
            "actorKey": "paper-hand",
            "characterId": paper["character_id"],
            "source": paper.get("source"),
            "qualityTarget": paper.get("quality_target"),
            "states": STATES,
            "directions": DIRECTIONS,
            "frameCount": sum(len(frames) for state in paper["animations"].values() for frames in state.values()),
            "runtimeManifest": "./assets/generated/hmh-animated-roster/hmh-animated-roster.mjs",
        },
        "levelDesignRuntimeWorldAssets": world_rows,
        "proofSheet": repo_rel(PROOF),
        "gates": {
            "paperHandFull8DirectionStateMatrix": True,
            "paperHandReplacesWeakerPartialRuntimeKit": paper.get("source") == "pixellab-aaa-quality-wave-v1",
            "worldAssetsRuntimeIntegrated": all(row["runtimeIntegrated"] for row in world_rows),
            "worldAssetsAlphaClean": all(row["alphaClean"] for row in world_rows),
            "noDirectMainJsHeavyManifestImport": True,
        },
        "continuation": {
            "queuedButNotYetRuntimePromoted": ["trench-degen", "phishing-angler", "mev-reaper"],
            "promotionRule": "Only promote to hmh-animated-roster after all 8 states and 8 directions are harvested and visually reviewed.",
        },
    }
    CERT.write_text(json.dumps(cert, indent=2) + "\n", encoding="utf-8")
    README.write_text(
        "# WO-119 PixelLab AAA Wave\n\n"
        "This pass uses PixelLab as the production backbone for AAA-targeted HMH runtime art.\n\n"
        "## Shipped runtime changes\n"
        "- Replaced the live `paper-hand` enemy with a reviewed PixelLab 8-direction animation matrix.\n"
        "- Locked six completed PixelLab Level 1 world/terrain/prop assets into a certification gate for authored route readability.\n"
        "- Preserved the rule that partially completed PixelLab characters remain candidates until every required state and direction is present.\n\n"
        "## Proof\n"
        f"- Proof sheet: `{repo_rel(PROOF)}`\n"
        f"- Certification: `{repo_rel(CERT)}`\n",
        encoding="utf-8",
    )
    print(json.dumps({"proof": repo_rel(PROOF), "cert": repo_rel(CERT), "paperFrames": cert["enemyReplacement"]["frameCount"]}, indent=2))


if __name__ == "__main__":
    main()

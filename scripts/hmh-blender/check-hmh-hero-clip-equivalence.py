"""Prove the clip library reproduces Blender's export of the nine native clips.

For each hero: read the committed GLB's rest skeleton and neutral stance,
re-express every native clip from the Blender pose-basis dump
(``dump-hmh-hero-pose-basis.py``) as library keys, bake it through the same
``rest ∘ basis`` composition the exporter uses, and compare every sampled node
translation/rotation/scale with the committed GLB samplers.

Tolerance: 1e-5 per component (observed maximum is ~7e-7, float32 rounding).
Writes docs/2.0/receipts/hmh-hero-clips-20260930/<hero>-native-equivalence.json
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import hmh_clip_library as library  # noqa: E402

HEROES = ("lit-commando", "lilly", "lit-valkyrie", "lester-original")
TOLERANCE = 1e-5
RECEIPTS = ROOT / "docs/2.0/receipts/hmh-hero-clips-20260930"


def check(hero):
    glb_path = ROOT / "apps/portal/assets/generated/hmh-actor-3d-pilot" / f"{hero}.glb"
    basis_path = ROOT / ".tmp/hmh-actor-3d-pilot" / f"{hero}-pose-basis.json"
    data = glb_path.read_bytes()
    gltf, binary = library.read_glb(data)
    dump = json.loads(basis_path.read_text(encoding="utf-8"))
    rest = library.joint_rest(gltf)
    neutral = library.neutral_stance(gltf, binary, rest)
    clips = []
    worst_overall = 0.0
    for name, record in dump["clips"].items():
        raw = library.clip_from_basis_frames(name, record["frames"], list(rest), neutral)
        baked = library.bake_native_reexpression(raw, rest, neutral)
        worst = library.compare_native(gltf, binary, name, baked, rest)
        worst_overall = max(worst_overall, *worst.values())
        clips.append({"clip": name, "frames": len(record["frames"]), "maxAbsError": worst, "withinTolerance": max(worst.values()) <= TOLERANCE})
    receipt = {"schema": 1, "actorId": hero, "glbSha256": hashlib.sha256(data).hexdigest(), "sourceSha256": dump["sourceSha256"],
               "method": "native per-frame pose basis re-expressed as library keys, baked as rest∘basis, compared with the committed samplers",
               "tolerance": TOLERANCE, "maxAbsErrorOverall": worst_overall, "passed": all(c["withinTolerance"] for c in clips), "clips": clips,
               "scope": "proves the library export math equals Blender's export; the shipped native nine clips remain Blender's bytes"}
    RECEIPTS.mkdir(parents=True, exist_ok=True)
    (RECEIPTS / f"{hero}-native-equivalence.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps({"hero": hero, "maxAbsErrorOverall": worst_overall, "passed": receipt["passed"]}))
    if not receipt["passed"]:
        raise SystemExit(1)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--hero", action="append", choices=[*HEROES, "all"], required=True)
    args = parser.parse_args()
    for hero in (HEROES if "all" in args.hero else args.hero):
        check(hero)


if __name__ == "__main__":
    main()

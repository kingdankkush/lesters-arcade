"""Dump each native hero clip's per-frame Blender pose basis. CPU only, never saves.

Opens the immutable hero sources read-only (digest checked before and after),
evaluates the nine native actions frame by frame and records every pose bone's
``location``, ``matrix_basis`` quaternion (wxyz) and ``scale`` plus the rest
skeleton. ``check-hmh-hero-clip-equivalence.py`` re-expresses these through
the clip library and proves the library reproduces Blender's own GLB export.

Usage: blender -b --python this.py -- --hero lilly [--hero ...]
Output: .tmp/hmh-actor-3d-pilot/<hero>-pose-basis.json
"""
import argparse
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

import bpy
from bpy_extras import anim_utils

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("pilot_exporter", Path(__file__).with_name("export-hmh-actor-glb-pilot.py"))
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)
HEROES = ("lit-commando", "lilly", "lit-valkyrie", "lester-original")


def dump(hero):
    spec_ = exporter.ACTORS[hero]
    source = ROOT / spec_["source"]
    before = hashlib.sha256(source.read_bytes()).hexdigest()
    if before != spec_["sha256"]:
        raise RuntimeError("Immutable source digest mismatch: " + hero)
    bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False, use_scripts=False)
    rig = bpy.data.objects[spec_["rig"]]
    scene = bpy.context.scene
    record = {"schema": 1, "hero": hero, "sourceSha256": before, "fps": scene.render.fps, "rig": rig.name,
              "bones": [{"name": b.name, "parent": b.parent.name if b.parent else None, "rotationMode": rig.pose.bones[b.name].rotation_mode,
                         "matrixLocal": [list(r) for r in b.matrix_local]} for b in rig.data.bones], "clips": {}}
    adt = rig.animation_data or rig.animation_data_create()
    for clip, action_name in spec_["clips"].items():
        action = bpy.data.actions[action_name]
        for track in adt.nla_tracks:
            track.mute = True
        adt.action = action
        adt.action_slot = anim_utils.action_get_first_suitable_slot(action, "OBJECT")
        start, end = action.frame_range
        frames = []
        for frame in range(int(start), int(end) + 1):
            scene.frame_set(frame)
            bpy.context.view_layer.update()
            frames.append({"frame": frame, "basis": {pb.name: {"loc": list(pb.location), "quat": list(pb.matrix_basis.to_quaternion()), "scale": list(pb.scale)}
                                                     for pb in rig.pose.bones}})
        record["clips"][clip] = {"action": action_name, "frameRange": [start, end], "frames": frames}
    if hashlib.sha256(source.read_bytes()).hexdigest() != before:
        raise RuntimeError("Source changed during basis dump")
    output = ROOT / ".tmp/hmh-actor-3d-pilot" / f"{hero}-pose-basis.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(record), encoding="utf-8")
    print("HMH_HERO_POSE_BASIS=" + str(output), flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--hero", action="append", choices=[*HEROES, "all"], required=True)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    for hero in (HEROES if "all" in args.hero else args.hero):
        dump(hero)


if __name__ == "__main__":
    main()

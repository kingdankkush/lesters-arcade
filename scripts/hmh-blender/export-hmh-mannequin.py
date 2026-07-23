from __future__ import annotations

import argparse
import hashlib
import json
import math
import random
import shutil
from pathlib import Path

import bpy


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--repo-root", required=True)
    args = []
    if "--" in __import__("sys").argv:
        args = __import__("sys").argv[__import__("sys").argv.index("--") + 1 :]
    return parser.parse_args(args)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def reset_pose(rig: bpy.types.Object) -> None:
    for bone in rig.pose.bones:
        bone.rotation_mode = "XYZ"
        bone.rotation_euler = (0.0, 0.0, 0.0)
        bone.location = (0.0, 0.0, 0.0)
        bone.scale = (1.0, 1.0, 1.0)


def apply_pose(rig: bpy.types.Object, *, layer: str, state: str, direction_degrees: float, frame_index: int, frame_count: int) -> None:
    reset_pose(rig)
    rig.pose.bones["root"].rotation_euler.z = math.radians(direction_degrees)
    if layer == "lower-body" and state == "run":
        phase = frame_index / frame_count * math.tau
        swing = math.sin(phase) * 0.48
        lift = max(0.0, math.sin(phase)) * 0.18
        rig.pose.bones["thigh.L"].rotation_euler.x = swing
        rig.pose.bones["shin.L"].rotation_euler.x = -swing * 0.44 - lift
        rig.pose.bones["thigh.R"].rotation_euler.x = -swing
        rig.pose.bones["shin.R"].rotation_euler.x = swing * 0.44 - max(0.0, -math.sin(phase)) * 0.18
    bpy.context.view_layer.update()


def isolate_collection(layer_collection_name: str, manifest: dict) -> None:
    for layer in manifest["layers"]:
        collection = bpy.data.collections.get(layer["collection"])
        if collection is None:
            raise RuntimeError(f"missing render collection: {layer['collection']}")
        collection.hide_render = layer["collection"] != layer_collection_name
    guides = bpy.data.collections.get("HMH_Guides")
    if guides:
        guides.hide_render = True


def main() -> None:
    args = parse_args()
    repo_root = Path(args.repo_root).resolve()
    manifest_path = Path(args.manifest).resolve()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    random.seed(manifest["scene"]["randomSeed"])

    scene = bpy.context.scene
    scene.render.film_transparent = True
    scene.render.threads_mode = "FIXED"
    scene.render.threads = manifest["scene"]["threads"]
    scene.render.resolution_x = manifest["render"]["frameSize"][0]
    scene.render.resolution_y = manifest["render"]["frameSize"][1]
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = manifest["render"]["fileFormat"]
    scene.render.image_settings.color_mode = manifest["render"]["colorMode"]
    scene.render.image_settings.color_depth = str(manifest["render"]["colorDepth"])
    scene.render.image_settings.compression = 100
    scene.render.use_file_extension = True
    scene.render.use_compositing = False
    scene.render.use_sequencer = False

    rig = bpy.data.objects.get(manifest["rig"]["armature"])
    if rig is None or rig.type != "ARMATURE":
        raise RuntimeError("missing HMH shared character armature")

    raw_dir = repo_root / manifest["render"]["rawOutputDirectory"]
    if raw_dir.exists():
        shutil.rmtree(raw_dir)
    raw_dir.mkdir(parents=True, exist_ok=True)

    rendered = []
    layer_specs = {layer["id"]: layer for layer in manifest["layers"]}
    for layer, states in manifest["clips"].items():
        isolate_collection(layer_specs[layer]["collection"], manifest)
        for state, budget in states.items():
            for direction in manifest["directions"]:
                angle = manifest["directionAnglesDegrees"][direction]
                for frame_index in range(budget["frames"]):
                    apply_pose(
                        rig,
                        layer=layer,
                        state=state,
                        direction_degrees=angle,
                        frame_index=frame_index,
                        frame_count=budget["frames"],
                    )
                    scene.frame_set(frame_index + 1)
                    frame_id = f"{manifest['actor']['id']}__{layer}__{state}__{direction}__{frame_index:03d}"
                    output = raw_dir / f"{frame_id}.png"
                    scene.render.filepath = str(output)
                    bpy.ops.render.render(write_still=True)
                    if not output.exists() or output.stat().st_size == 0:
                        raise RuntimeError(f"render failed: {output}")
                    rendered.append({"id": frame_id, "path": output.relative_to(repo_root).as_posix(), "bytes": output.stat().st_size})

    reset_pose(rig)
    report_path = raw_dir.parent / "render-report.json"
    report = {
        "status": "PASS",
        "pipelineId": manifest["id"],
        "sourceBlend": bpy.data.filepath,
        "sourceBlendSha256": sha256(Path(bpy.data.filepath)),
        "frameCount": len(rendered),
        "frames": rendered,
    }
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": "PASS", "frameCount": len(rendered), "report": str(report_path)}))


if __name__ == "__main__":
    main()

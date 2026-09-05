"""Render the character-select turntables from the committed hero scene.

Runs inside Blender (`blender --background <hero.blend> --python this.py -- ...`).
The scene is opened exactly as committed and is never saved: this exporter
only changes in-memory render resolution, per-hero visibility, the rig pose
and the rig's Z rotation, then renders one composite frame (all four layers at
once) per spin direction per hero. Pose maths is reused from
export-hmh-production-hero-pilot.py so the selector shows the same idle/aim
pose the gameplay atlases ship, just rendered at selector resolution.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import math
from pathlib import Path
import sys

import bpy
from bpy_extras.object_utils import world_to_camera_view


def blender_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True, help="hmh-hero-selector-render.json")
    parser.add_argument("--repo-root", required=True)
    parser.add_argument("--raw-output", required=True)
    parser.add_argument("--report-output", required=True)
    return parser.parse_args(argv)


def write_lf_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")


def load_module(path: Path):
    spec = importlib.util.spec_from_file_location(path.stem.replace("-", "_"), path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def capture_pose(rig) -> dict[str, tuple]:
    return {
        bone.name: (tuple(bone.location), tuple(bone.rotation_euler), tuple(bone.scale))
        for bone in rig.pose.bones
    }


def apply_selector_pose(hero_exporter, rig, pilot: dict, pose_table: dict, clip_table: dict) -> dict[str, tuple]:
    """Compose the per-layer poses the gameplay exporter renders separately.

    Each layer's pose is applied through the hero exporter's own `apply_pose`
    (which resets first), the bones it moved are recorded, and the union is
    re-applied. A bone driven by two layers with different values is a contract
    violation, not something to average silently.
    """
    hero_exporter.reset_pose(rig)
    identity = capture_pose(rig)
    combined: dict[str, tuple] = {}
    combined_owner: dict[str, str] = {}
    for layer, spec in pose_table.items():
        clip = clip_table[layer][spec["state"]]
        hero_exporter.apply_pose(rig, layer, spec["state"], spec["frameIndex"], clip["frames"], pilot["animationProfile"])
        for name, transform in capture_pose(rig).items():
            if transform == identity[name]:
                continue
            if name in combined and combined[name] != transform:
                raise RuntimeError(f"Pose conflict on bone {name!r}: {combined_owner[name]} vs {layer}")
            combined[name] = transform
            combined_owner[name] = layer
    hero_exporter.reset_pose(rig)
    for name, (location, rotation, scale) in combined.items():
        bone = rig.pose.bones[name]
        bone.location = location
        bone.rotation_euler = rotation
        bone.scale = scale
    return combined


def main() -> None:
    args = blender_args()
    manifest_path = Path(args.manifest).resolve()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    repo_root = Path(args.repo_root).resolve()
    hero_manifest = json.loads((repo_root / manifest["scene"]["sourceManifest"]).read_text(encoding="utf-8"))
    hero_exporter = load_module(repo_root / manifest["scene"]["heroExporter"])
    raw_output = Path(args.raw_output).resolve()
    report_output = Path(args.report_output).resolve()
    raw_output.mkdir(parents=True, exist_ok=True)

    expected_blend = (repo_root / manifest["scene"]["sourceBlend"]).resolve()
    opened_blend = Path(bpy.data.filepath).resolve() if bpy.data.filepath else None
    if opened_blend != expected_blend:
        raise RuntimeError(f"Selector exporter must open the committed hero scene {expected_blend}, got {opened_blend}")

    scene = bpy.context.scene
    frame_size = manifest["render"]["frameSize"]
    scene.render.resolution_x = frame_size[0]
    scene.render.resolution_y = frame_size[1]
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = bool(manifest["render"]["transparentFilm"])
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = int(manifest["render"]["compression"])

    # The camera, exposure and lights are inherited from the committed scene and
    # only asserted here, so the selector is provably the gameplay camera.
    camera_ortho = float(scene.camera.data.ortho_scale)
    exposure = float(scene.view_settings.exposure)
    if abs(camera_ortho - manifest["render"]["cameraOrthoScale"]) > 1e-6:
        raise RuntimeError(f"Scene camera ortho scale {camera_ortho} != manifest {manifest['render']['cameraOrthoScale']}")
    if abs(exposure - manifest["render"]["exposure"]) > 1e-6:
        raise RuntimeError(f"Scene exposure {exposure} != manifest {manifest['render']['exposure']}")

    pilots = {pilot["actorId"]: pilot for pilot in hero_manifest["pilots"]}
    production_objects = [obj for obj in bpy.data.objects if obj.get("hmh_actor_id")]
    for obj in production_objects:
        obj.hide_render = True

    rendered = []
    pivots = {}
    hero_reports = {}
    for hero in manifest["heroes"]:
        pilot = pilots.get(hero["actorId"])
        if pilot is None:
            raise RuntimeError(f"Unknown production actor for selector: {hero['actorId']}")
        rig = hero_exporter.resolve_rig(hero_manifest, pilot)
        actor_objects = [obj for obj in production_objects if obj.get("hmh_actor_id") == hero["actorId"]]
        if not actor_objects:
            raise RuntimeError(f"No renderable objects for {hero['actorId']}")
        layer_counts = {layer: sum(1 for obj in actor_objects if obj.get("hmh_layer") == layer) for layer in manifest["pose"]}
        if any(count == 0 for count in layer_counts.values()):
            raise RuntimeError(f"{hero['actorId']}: missing layer objects {layer_counts}")
        for obj in production_objects:
            obj.hide_render = obj.get("hmh_actor_id") != hero["actorId"]
        if max(abs(component) for component in rig.location) > 1e-6:
            raise RuntimeError(f"{hero['actorId']}: rig must sit on the world origin for a fixed ground-contact pivot, got {tuple(rig.location)}")
        posed_bones = apply_selector_pose(hero_exporter, rig, pilot, manifest["pose"], pilot["clips"])
        for direction in manifest["directions"]:
            rig.rotation_euler[2] = math.radians(hero_manifest["directionAngles"][direction])
            bpy.context.view_layer.update()
            filename = f"{hero['actorId']}__selector__{direction}.png"
            # The ground-contact pivot is the rig origin seen through the fixed
            # camera; recording it per frame lets the runner prove the turntable
            # cannot jitter (v2 recentred every frame to its own alpha bbox).
            view = world_to_camera_view(scene, scene.camera, rig.matrix_world.translation)
            pivots[filename] = [round(view.x * frame_size[0], 4), round((1.0 - view.y) * frame_size[1], 4)]
            scene.render.filepath = str(raw_output / filename)
            bpy.ops.render.render(write_still=True)
            rendered.append(filename)
        hero_reports[hero["portalHeroId"]] = {
            "actorId": hero["actorId"],
            "layerObjectCounts": layer_counts,
            "posedBones": sorted(posed_bones),
        }
        hero_exporter.reset_pose(rig)
        rig.rotation_euler[2] = 0.0

    for obj in production_objects:
        obj.hide_render = True
    bpy.context.view_layer.update()

    report = {
        "status": "pass",
        "pipelineId": manifest["pipelineId"],
        "sourceBlend": str(opened_blend),
        "saved": False,
        "engine": scene.render.engine,
        "frameSize": list(frame_size),
        "cameraOrthoScale": camera_ortho,
        "exposure": exposure,
        "frameCount": len(rendered),
        "frames": rendered,
        "pivotPixels": pivots,
        "heroes": hero_reports,
    }
    write_lf_json(report_output, report)
    print(json.dumps({"status": "pass", "frameCount": len(rendered), "saved": False}, sort_keys=True))


if __name__ == "__main__":
    main()

"""Render the character-select turntables from the committed hero scene.

Runs inside Blender (`blender --background --disable-autoexec <hero.blend> --python this.py -- ...`).
Packed gameplay mode renders one --actor-id per process using its own native
action through the hero exporter's action-slot binding and frame sampler.
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

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from hmh_selector_native_sources import (
    PACKED_MODE, packed_gameplay_sources, selector_cli_path, source_input_path,
    validate_selector_export_destinations, validate_camera_pitch,
)


def blender_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True, help="hmh-hero-selector-render.json")
    parser.add_argument("--repo-root", required=True)
    parser.add_argument("--raw-output", required=True)
    parser.add_argument("--report-output", required=True)
    parser.add_argument("--actor-id", help="Required only for one isolated packed gameplay source")
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


def apply_native_selector_pose(hero_exporter, rig, pose: dict) -> dict:
    """Use the gameplay exporter's real action/slot binding; never reset quaternion bones."""
    action = hero_exporter.set_clip_action(rig, pose["action"])
    frame = hero_exporter.sample_clip_frame(action, pose["frameIndex"], pose["frameCount"], pose["loop"])
    return {"action": action.name, "sampledFrame": frame}


def measured_camera_pitch(camera) -> float:
    """Measure optical -Z against downward world Z, including parenting/constraints.

    The source builder sets dz = horizontal / tan(pitch), so 55 degrees is
    measured from downward vertical (35 degrees below the horizon), not elevation.
    """
    forward = tuple(-float(camera.matrix_world[row][2]) for row in range(3))
    if not all(math.isfinite(value) for value in forward) or math.hypot(*forward) == 0:
        raise RuntimeError("Scene camera pitch cannot be measured from an invalid optical axis")
    return math.degrees(math.atan2(math.hypot(forward[0], forward[1]), -forward[2]))


def main() -> None:
    args = blender_args()
    repo_root = Path(args.repo_root).resolve()
    manifest_path = selector_cli_path(repo_root, Path(args.manifest))
    manifest_path = source_input_path(repo_root, manifest_path.relative_to(repo_root).as_posix())
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    raw_output, report_output = validate_selector_export_destinations(
        manifest, repo_root, manifest_path, Path(args.raw_output), Path(args.report_output), args.actor_id)
    hero_manifest = json.loads((repo_root / manifest["scene"]["sourceManifest"]).read_text(encoding="utf-8"))
    hero_exporter = load_module(repo_root / manifest["scene"]["heroExporter"])

    packed = manifest["scene"].get("sourceMode") == PACKED_MODE
    sources = packed_gameplay_sources(manifest, repo_root, require_materialized=True) if packed else []
    heroes = manifest["heroes"]
    if packed:
        heroes = [hero for hero in heroes if hero["actorId"] == args.actor_id]
        if len(heroes) != 1:
            raise RuntimeError("Packed selector requires one configured --actor-id per Blender invocation")
        source = next(item for item in sources if item["actorId"] == args.actor_id)
        expected_blend = (repo_root / source["path"]).resolve()
    else:
        if args.actor_id:
            raise RuntimeError("--actor-id is only supported for packed gameplay selector sources")
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
    bpy.context.view_layer.update()
    evaluated_camera = scene.camera.evaluated_get(bpy.context.evaluated_depsgraph_get())
    camera_pitch = validate_camera_pitch(
        measured_camera_pitch(evaluated_camera), manifest["render"]["cameraPitchDegrees"])
    camera_ortho = float(scene.camera.data.ortho_scale)
    exposure = float(scene.view_settings.exposure)
    if abs(camera_ortho - manifest["render"]["cameraOrthoScale"]) > 1e-6:
        raise RuntimeError(f"Scene camera ortho scale {camera_ortho} != manifest {manifest['render']['cameraOrthoScale']}")
    if abs(exposure - manifest["render"]["exposure"]) > 1e-6:
        raise RuntimeError(f"Scene exposure {exposure} != manifest {manifest['render']['exposure']}")

    static_sources = manifest["scene"].get("sourceMode") == "static-textured-models"
    pilots = {pilot["actorId"]: pilot for pilot in hero_manifest.get("pilots", [])}
    production_objects = [obj for obj in bpy.data.objects if obj.get("hmh_actor_id")]
    for obj in production_objects:
        obj.hide_render = True

    raw_output.mkdir(parents=True, exist_ok=True)
    rendered = []
    pivots = {}
    hero_reports = {}
    for hero in heroes:
        native_receipt = None
        actor_objects = [obj for obj in production_objects if obj.get("hmh_actor_id") == hero["actorId"]]
        if packed:
            actor_objects = hero_exporter.active_actor_objects(hero["actorId"])
        if not actor_objects:
            raise RuntimeError(f"No renderable objects for {hero['actorId']}")
        if static_sources:
            roots = [obj for obj in actor_objects if obj.get("hmh_selector_root") == hero["actorId"]]
            if len(roots) != 1 or roots[0].type != "EMPTY":
                raise RuntimeError(f"{hero['actorId']}: missing unique static selector root")
            source = next(item for item in hero_manifest["heroes"] if item["actorId"] == hero["actorId"])
            bodies = [obj for obj in actor_objects if obj.type == "MESH" and not obj.get("hmh_selector_shadow")]
            if not bodies or any(not obj.data.uv_layers or obj.get("hmh_source_sha256") != source["sourceSha256"] for obj in bodies):
                raise RuntimeError(f"{hero['actorId']}: untextured or mismatched source geometry")
            pivot_root = roots[0]
            layer_counts = {"textured-source": len(bodies), "shadow": sum(bool(obj.get("hmh_selector_shadow")) for obj in actor_objects)}
            posed_bones = {}
        else:
            pilot = pilots.get(hero["actorId"])
            if pilot is None:
                raise RuntimeError(f"Unknown production actor for selector: {hero['actorId']}")
            pivot_root = hero_exporter.resolve_rig(hero_manifest, pilot)
            layers = pilot["layers"] if packed else manifest["pose"]
            layer_counts = {layer: sum(1 for obj in actor_objects if obj.get("hmh_layer") == layer) for layer in layers}
            if any(count == 0 for count in layer_counts.values()):
                raise RuntimeError(f"{hero['actorId']}: missing layer objects {layer_counts}")
            if packed:
                native_receipt = apply_native_selector_pose(hero_exporter, pivot_root, source["nativePose"])
                posed_bones = {}  # Native channels are action-driven, not the procedural pose union.
            else:
                posed_bones = apply_selector_pose(hero_exporter, pivot_root, pilot, manifest["pose"], pilot["clips"])
        for obj in production_objects:
            obj.hide_render = obj.get("hmh_actor_id") != hero["actorId"]
        if packed:
            # Match the gameplay mesh filter, including exclusion of released demo props.
            for obj in bpy.data.objects:
                if obj.type == "MESH":
                    obj.hide_render = obj not in actor_objects
        if max(abs(component) for component in pivot_root.location) > 1e-6:
            raise RuntimeError(f"{hero['actorId']}: selector root must sit on the world origin")
        for direction in manifest["directions"]:
            pivot_root.rotation_euler[2] = math.radians(hero_manifest["directionAngles"][direction])
            bpy.context.view_layer.update()
            filename = f"{hero['actorId']}__selector__{direction}.png"
            # Project the fixed root rather than recentering each frame's alpha bounds.
            view = world_to_camera_view(scene, scene.camera, pivot_root.matrix_world.translation)
            pivots[filename] = [round(view.x * frame_size[0], 4), round((1.0 - view.y) * frame_size[1], 4)]
            scene.render.filepath = str(raw_output / filename)
            bpy.ops.render.render(write_still=True)
            rendered.append(filename)
        hero_reports[hero["portalHeroId"]] = {
            "actorId": hero["actorId"],
            "layerObjectCounts": layer_counts,
            "posedBones": sorted(posed_bones),
            "sourceMode": PACKED_MODE if packed else "static-textured-models" if static_sources else "gameplay-pose",
        }
        if packed:
            hero_reports[hero["portalHeroId"]]["nativePose"] = native_receipt
        if not static_sources and not packed:
            hero_exporter.reset_pose(pivot_root)
        pivot_root.rotation_euler[2] = 0.0

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
        "cameraPitchDegrees": camera_pitch,
        "exposure": exposure,
        "frameCount": len(rendered),
        "frames": rendered,
        "pivotPixels": pivots,
        "heroes": hero_reports,
    }
    if packed:
        report["sourceAssets"] = [source]
    write_lf_json(report_output, report)
    print(json.dumps({"status": "pass", "frameCount": len(rendered), "saved": False}, sort_keys=True))


if __name__ == "__main__":
    main()

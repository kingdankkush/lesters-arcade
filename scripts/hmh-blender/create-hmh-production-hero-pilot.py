from __future__ import annotations

import argparse
import importlib.util
import json
import math
from pathlib import Path
import sys

import bpy


def blender_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--source-blend", required=True)
    parser.add_argument("--inspection-output", required=True)
    return parser.parse_args(argv)


def load_module(path: Path):
    spec = importlib.util.spec_from_file_location("hmh_commando_concepts", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load concept generator: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def write_lf_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")


def find_variant(concept_manifest: dict, actor_id: str, variant_id: str) -> tuple[dict, dict]:
    actor = next((entry for entry in concept_manifest["actors"] if entry["id"] == actor_id), None)
    if actor is None:
        raise RuntimeError(f"Unknown actor: {actor_id}")
    variant = next((entry for entry in actor["variants"] if entry["id"] == variant_id), None)
    if variant is None:
        raise RuntimeError(f"Unknown variant: {actor_id}/{variant_id}")
    return actor, variant


def replace_rifle_with_pistol(concept, collection, rig, mats, actor_id: str, variant_id: str) -> None:
    for obj in list(collection.objects):
        if "_Weapon_" in obj.name:
            bpy.data.objects.remove(obj, do_unlink=True)

    prefix = f"{actor_id}_{variant_id}_Pistol"
    concept.cylinder(
        prefix + "_Barrel",
        (0.0, -0.48, 1.26),
        0.042,
        0.34,
        mats["charcoal"],
        collection,
        rotation=(math.radians(90), 0, 0),
        bone="weapon_socket",
        rig=rig,
        vertices=24,
    )
    concept.cylinder(
        prefix + "_Muzzle",
        (0.0, -0.66, 1.26),
        0.065,
        0.05,
        mats["silver_dark"],
        collection,
        rotation=(math.radians(90), 0, 0),
        bone="weapon_socket",
        rig=rig,
        vertices=24,
    )
    concept.cube(
        prefix + "_Receiver",
        (0.0, -0.31, 1.25),
        (0.11, 0.17, 0.095),
        mats["silver_dark"],
        collection,
        bevel=0.035,
        bone="weapon_socket",
        rig=rig,
    )
    concept.cube(
        prefix + "_Slide",
        (0.0, -0.36, 1.34),
        (0.09, 0.19, 0.045),
        mats["blue"],
        collection,
        bevel=0.025,
        bone="weapon_socket",
        rig=rig,
    )
    concept.cube(
        prefix + "_EnergyCell",
        (0.105, -0.31, 1.26),
        (0.025, 0.10, 0.045),
        mats["cyan"],
        collection,
        bevel=0.012,
        bone="weapon_socket",
        rig=rig,
    )
    concept.cube(
        prefix + "_Grip",
        (0.0, -0.14, 1.10),
        (0.075, 0.065, 0.14),
        mats["charcoal"],
        collection,
        bevel=0.025,
        rotation=(math.radians(-10), 0, 0),
        bone="weapon_socket",
        rig=rig,
    )


def semantic_layer(obj) -> str:
    name = obj.name
    if "GroundShadow" in name:
        return "shadow"
    if "_Pistol_" in name:
        return "weapon"
    lower_tokens = (
        "_Pelvis",
        "_Thigh_",
        "_Knee_",
        "_Shin_",
        "_Boot_",
        "_HipPlate",
        "_EnergyBelt",
        "_CoatPanel_",
    )
    if any(token in name for token in lower_tokens):
        return "lower-body"
    return "torso-head"


def main() -> None:
    args = blender_args()
    manifest_path = Path(args.manifest).resolve()
    repo_root = manifest_path.parents[5]
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    concept_manifest_path = repo_root / manifest["scene"]["conceptManifest"]
    concept_manifest = json.loads(concept_manifest_path.read_text(encoding="utf-8"))
    concept = load_module(repo_root / "scripts/hmh-blender/create-hmh-commando-concepts.py")
    source_blend = Path(args.source_blend).resolve()
    inspection_output = Path(args.inspection_output).resolve()
    source_blend.parent.mkdir(parents=True, exist_ok=True)

    scene, mats = concept.configure_scene(concept_manifest)
    frame_width, frame_height = manifest["render"]["frameSize"]
    scene.render.resolution_x = frame_width
    scene.render.resolution_y = frame_height
    scene.view_settings.exposure = manifest["render"]["exposure"]
    scene.camera.data.ortho_scale = manifest["render"]["cameraOrthoScale"]
    scene.render.filepath = ""

    rig = concept.create_rig()
    rig.name = manifest["scene"]["armature"]
    rig.data.name = manifest["scene"]["armature"]
    rig["hmh_gameplay_body_profile"] = manifest["gameplayBodyProfile"]
    rig["hmh_runtime_authority"] = "projection-only"

    objects_by_actor = {}
    variants_by_actor = {}
    for pilot in manifest["pilots"]:
        actor, variant = find_variant(concept_manifest, pilot["actorId"], pilot["variantId"])
        collection = bpy.data.collections.new(f"Production__{actor['id']}__{variant['id']}")
        scene.collection.children.link(collection)
        concept.add_variant_details(
            collection,
            rig,
            mats,
            actor["id"],
            variant["id"],
            female=actor["id"] == "lit-valkyrie",
        )
        replace_rifle_with_pistol(concept, collection, rig, mats, actor["id"], variant["id"])

        objects_by_layer = {layer: [] for layer in pilot["layers"]}
        for obj in collection.objects:
            if obj.type != "MESH":
                continue
            layer = semantic_layer(obj)
            obj["hmh_layer"] = layer
            obj["hmh_actor_id"] = actor["id"]
            obj["hmh_variant_id"] = variant["id"]
            obj["hmh_runtime_authority"] = "projection-only"
            objects_by_layer[layer].append(obj.name)
            if layer == "shadow":
                concept.attach_to_bone(obj, rig, "root")

        expected_layers = set(pilot["layers"])
        if set(layer for layer, objects in objects_by_layer.items() if objects) != expected_layers:
            raise RuntimeError(f"Layer assignment incomplete for {actor['id']}: {objects_by_layer}")
        objects_by_actor[actor["id"]] = objects_by_layer
        variants_by_actor[actor["id"]] = variant["id"]

    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="POSE")
    for pose_bone in rig.pose.bones:
        pose_bone.rotation_mode = "XYZ"
        pose_bone.matrix_basis.identity()
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.view_layer.update()
    bpy.ops.wm.save_as_mainfile(filepath=str(source_blend), compress=True)

    external_dependencies = concept.external_dependencies()
    bones = sorted(bone.name for bone in rig.data.bones)
    inspection = {
        "armature": rig.name,
        "bones": bones,
        "weaponSocket": manifest["scene"]["weaponSocket"] in bones,
        "actors": {
            actor_id: {
                "actorId": actor_id,
                "variantId": variants_by_actor[actor_id],
                "objectsByLayer": {layer: sorted(objects) for layer, objects in layers.items()},
            }
            for actor_id, layers in objects_by_actor.items()
        },
        "externalDependencies": external_dependencies,
        "externalDependencyCount": len(external_dependencies),
        "gameplayBodyProfile": rig["hmh_gameplay_body_profile"],
        "runtimeAuthority": rig["hmh_runtime_authority"],
    }
    write_lf_json(inspection_output, inspection)
    object_count = sum(len(objects) for layers in objects_by_actor.values() for objects in layers.values())
    print(json.dumps({"status": "pass", "sourceBlend": str(source_blend), "actors": sorted(objects_by_actor), "objects": object_count}, sort_keys=True))


if __name__ == "__main__":
    main()

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
        "_CargoThigh_",
        "_CargoPocket_",
        "_GoldBelt",
    )
    if any(token in name for token in lower_tokens):
        return "lower-body"
    return "torso-head"


def actor_materials(concept, mats, actor_id: str) -> dict:
    themed = dict(mats)
    if actor_id == "lester-original":
        themed.update({
            "blue": concept.material("Lester blue", "#155bd7", metallic=0.18),
            "cyan": concept.material("Lester mask white", "#f4f8ff"),
            "silver": concept.material("Lester cargo tan", "#8a744f"),
            "silver_dark": concept.material("Lester boot black", "#141b22", metallic=0.12),
            "charcoal": concept.material("Lester tactical black", "#1c252b"),
            "teal": concept.material("Lester scarf blue", "#0c48ba"),
            "teal_light": concept.material("Lester brass", "#c58b32", metallic=0.42),
        })
    elif actor_id == "lilly":
        themed.update({
            "blue": concept.material("Lilly veteran gold", "#c8932f", metallic=0.38),
            "cyan": concept.material("Lilly lens cyan", "#7af5ed", emission=0.25),
            "silver": concept.material("Lilly gold plate", "#d4a542", metallic=0.45),
            "silver_dark": concept.material("Lilly dark plate", "#20272c", metallic=0.22),
            "charcoal": concept.material("Lilly tactical black", "#11191d"),
            "teal": concept.material("Lilly hair teal", "#079e9b"),
            "teal_light": concept.material("Lilly teal light", "#59eee4", emission=0.38),
        })
    return themed


def add_unlockable_details(concept, collection, rig, mats, actor_id: str, variant_id: str) -> dict:
    themed = actor_materials(concept, mats, actor_id)
    prefix = f"{actor_id}_{variant_id}"
    female = actor_id == "lilly"
    concept.add_base_body(collection, rig, themed, actor_id, variant_id, female=female)
    if actor_id == "lester-original":
        concept.sphere(prefix + "_BlueMaskShell", (0, 0, 1.80), (0.245, 0.225, 0.255), themed["blue"], collection, bone="head", rig=rig)
        concept.cube(prefix + "_WhiteFaceStripe", (0, -0.236, 1.80), (0.045, 0.018, 0.175), themed["cyan"], collection, bevel=0.018, bone="head", rig=rig)
        for side, sign in (("L", -1), ("R", 1)):
            concept.sphere(prefix + f"_EyeWhite_{side}", (sign * 0.085, -0.245, 1.83), (0.062, 0.020, 0.072), themed["cyan"], collection, bone="head", rig=rig)
            concept.sphere(prefix + f"_EyePupil_{side}", (sign * 0.085, -0.266, 1.83), (0.022, 0.010, 0.030), themed["charcoal"], collection, bone="head", rig=rig)
            concept.cylinder(prefix + f"_CargoThigh_{side}", (sign * 0.16, 0, 0.54), 0.145, 0.44, themed["silver"], collection, bone=f"thigh.{side}", rig=rig)
            concept.cube(prefix + f"_CargoPocket_{side}", (sign * 0.22, -0.13, 0.54), (0.075, 0.035, 0.10), themed["silver_dark"], collection, bevel=0.025, bone=f"thigh.{side}", rig=rig)
        concept.cube(prefix + "_ScarfCollar", (0, -0.02, 1.52), (0.25, 0.16, 0.075), themed["teal"], collection, bevel=0.05, bone="chest", rig=rig)
        concept.cube(prefix + "_ScarfTailA", (-0.17, 0.14, 1.42), (0.055, 0.20, 0.05), themed["teal"], collection, bevel=0.03, rotation=(math.radians(18), 0, math.radians(-22)), bone="chest", rig=rig)
        concept.cube(prefix + "_ScarfTailB", (-0.04, 0.17, 1.39), (0.05, 0.17, 0.045), themed["teal"], collection, bevel=0.03, rotation=(math.radians(-12), 0, math.radians(12)), bone="chest", rig=rig)
        for index in range(6):
            x = -0.18 + index * 0.072
            z = 1.43 - index * 0.055
            concept.cube(prefix + f"_BandolierRound_{index}", (x, -0.245, z), (0.027, 0.025, 0.055), themed["teal_light"], collection, bevel=0.012, rotation=(0, 0, math.radians(-18)), bone="chest", rig=rig)
    elif actor_id == "lilly":
        for index, (x, z, angle) in enumerate(((-0.18, 1.61, -12), (-0.10, 1.53, -6), (0.0, 1.49, 0), (0.10, 1.53, 6), (0.18, 1.61, 12))):
            concept.cube(prefix + f"_LongHairLock_{index}", (x, 0.13, z), (0.07, 0.085, 0.25), themed["teal"], collection, bevel=0.065, rotation=(math.radians(-8), math.radians(angle), math.radians(angle)), bone="head", rig=rig)
        for side, sign in (("L", -1), ("R", 1)):
            bpy.ops.mesh.primitive_torus_add(major_radius=0.073, minor_radius=0.012, major_segments=24, minor_segments=8, location=(sign * 0.085, -0.198, 1.80), rotation=(math.radians(90), 0, 0))
            glasses = bpy.context.object
            glasses.name = prefix + f"_RoundGlasses_{side}"
            glasses.data.materials.append(themed["silver"])
            concept.move_to_collection(glasses, collection)
            concept.attach_to_bone(glasses, rig, "head")
        concept.cube(prefix + "_GlassesBridge", (0, -0.205, 1.80), (0.025, 0.018, 0.012), themed["silver"], collection, bevel=0.008, bone="head", rig=rig)
        concept.cube(prefix + "_GoldCollar", (0, -0.19, 1.48), (0.22, 0.045, 0.055), themed["silver"], collection, bevel=0.025, bone="chest", rig=rig)
        concept.cube(prefix + "_GoldBelt", (0, -0.205, 0.87), (0.24, 0.035, 0.045), themed["silver"], collection, bevel=0.018, bone="pelvis", rig=rig)
        concept.cube(prefix + "_TealChestMark", (0, -0.245, 1.28), (0.075, 0.018, 0.17), themed["teal_light"], collection, bevel=0.018, bone="chest", rig=rig)
    else:
        raise RuntimeError(f"Unknown production unlockable: {actor_id}")
    return themed


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
        if pilot["actorId"] in {"lester-original", "lilly"}:
            actor = {"id": pilot["actorId"]}
            variant = {"id": pilot["variantId"]}
        else:
            actor, variant = find_variant(concept_manifest, pilot["actorId"], pilot["variantId"])
        collection = bpy.data.collections.new(f"Production__{actor['id']}__{variant['id']}")
        scene.collection.children.link(collection)
        actor_mats = mats
        if actor["id"] in {"lester-original", "lilly"}:
            actor_mats = add_unlockable_details(concept, collection, rig, mats, actor["id"], variant["id"])
        else:
            concept.add_variant_details(
                collection,
                rig,
                mats,
                actor["id"],
                variant["id"],
                female=actor["id"] == "lit-valkyrie",
            )
        replace_rifle_with_pistol(concept, collection, rig, actor_mats, actor["id"], variant["id"])

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

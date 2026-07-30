"""Build the deterministic HMH enemy/boss roster scene.

One parametric humanoid rig drives every actor. Identity comes from build
proportions, palette and a single silhouette prop, so the roster reads as one
faction rather than seven unrelated models, and the whole scene is
reproducible from `hmh-enemy-roster.json`.

Canon: every actor must read as a human survivor or a zombie -- no animals,
vehicles, robots, mechs or abstract shapes. Collision, damage and AI live in
enemy-archetypes.mjs; nothing here is gameplay authority.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import sys

import bpy

# --- shared art direction -------------------------------------------------
# Every authored-asset pipeline reads the same rig so heroes, enemies and props
# light identically. See scripts/hmh-blender/hmh-light-rig.json.
import json as _rig_json
from pathlib import Path as _RigPath


def load_shared_light_rig():
    path = _RigPath(__file__).resolve().parent / "hmh-light-rig.json"
    rig = _rig_json.loads(path.read_text(encoding="utf-8"))
    if rig.get("id") != "hmh-shared-light-rig-v1":
        raise SystemExit("unexpected light rig id: " + str(rig.get("id")))
    return rig


def shared_light_channels(family):
    rig = load_shared_light_rig()
    energy = rig["energy"][family]
    return [
        (channel, tuple(rig["colors"][channel]), energy[channel])
        for channel in ("key", "fill", "rim")
    ]




def blender_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--source-blend", required=True)
    parser.add_argument("--inspection-output", required=True)
    return parser.parse_args(argv)


def write_lf_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")


def hex_rgba(value: str, alpha: float = 1.0):
    value = value.lstrip("#")
    return tuple(int(value[index:index + 2], 16) / 255 for index in (0, 2, 4)) + (alpha,)


def material(name: str, color: str, *, metallic: float = 0.0, emission: float = 0.0, roughness: float | None = None):
    existing = bpy.data.materials.get(name)
    if existing:
        return existing
    mat = bpy.data.materials.new(name)
    rgba = hex_rgba(color)
    mat.diffuse_color = rgba
    mat.use_nodes = True
    node = mat.node_tree.nodes.get("Principled BSDF")
    node.inputs["Base Color"].default_value = rgba
    node.inputs["Roughness"].default_value = roughness if roughness is not None else (0.38 if metallic else 0.74)
    node.inputs["Metallic"].default_value = metallic
    if emission:
        node.inputs["Emission Color"].default_value = rgba
        node.inputs["Emission Strength"].default_value = emission
    return mat


def apply_render_material_policy(manifest: dict) -> None:
    for mat in bpy.data.materials:
        node = mat.node_tree.nodes.get("Principled BSDF") if mat.node_tree else None
        if node is None or node.inputs.get("Specular IOR Level") is None:
            raise RuntimeError(f"Material {mat.name} is missing the required Principled specular input")
        node.inputs["Specular IOR Level"].default_value = manifest["render"]["specularIorLevel"]


def move_to_collection(obj, collection):
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)


def tag(obj, actor_id: str):
    obj["hmh_actor_id"] = actor_id
    obj["hmh_layer"] = "body"


def attach(obj, rig, bone_name: str):
    world = obj.matrix_world.copy()
    obj.parent = rig
    obj.parent_type = "BONE"
    obj.parent_bone = bone_name
    obj.matrix_world = world


def cube(name, location, scale, mat, collection, rig, bone, actor_id, *, bevel=0.05, rotation=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new("Soft bevel", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    obj.data.materials.append(mat)
    move_to_collection(obj, collection)
    tag(obj, actor_id)
    attach(obj, rig, bone)
    return obj


def sphere(name, location, scale, mat, collection, rig, bone, actor_id):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.ops.object.shade_smooth()
    obj.data.materials.append(mat)
    move_to_collection(obj, collection)
    tag(obj, actor_id)
    attach(obj, rig, bone)
    return obj


def cylinder(name, location, radius, depth, mat, collection, rig, bone, actor_id, *, rotation=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=18, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    move_to_collection(obj, collection)
    tag(obj, actor_id)
    attach(obj, rig, bone)
    return obj


def cone(name, location, radius, depth, mat, collection, rig, bone, actor_id, *, rotation=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    move_to_collection(obj, collection)
    tag(obj, actor_id)
    attach(obj, rig, bone)
    return obj


BONES = [
    ("root", (0.0, 0.0, 0.0), (0.0, 0.0, 0.18), None),
    ("pelvis", (0.0, 0.0, 0.86), (0.0, 0.0, 1.02), "root"),
    ("chest", (0.0, 0.0, 1.02), (0.0, 0.0, 1.42), "pelvis"),
    ("head", (0.0, 0.0, 1.42), (0.0, 0.0, 1.70), "chest"),
    ("upper_arm.L", (0.20, 0.0, 1.34), (0.40, 0.0, 1.12), "chest"),
    ("forearm.L", (0.40, 0.0, 1.12), (0.54, 0.0, 0.92), "upper_arm.L"),
    ("upper_arm.R", (-0.20, 0.0, 1.34), (-0.40, 0.0, 1.12), "chest"),
    ("forearm.R", (-0.40, 0.0, 1.12), (-0.54, 0.0, 0.92), "upper_arm.R"),
    ("thigh.L", (0.11, 0.0, 0.86), (0.13, 0.0, 0.46), "pelvis"),
    ("shin.L", (0.13, 0.0, 0.46), (0.13, 0.0, 0.06), "thigh.L"),
    ("thigh.R", (-0.11, 0.0, 0.86), (-0.13, 0.0, 0.46), "pelvis"),
    ("shin.R", (-0.13, 0.0, 0.46), (-0.13, 0.0, 0.06), "thigh.R"),
    ("prop_socket", (0.0, -0.16, 1.30), (0.0, -0.34, 1.30), "chest"),
]


def build_rig(name: str):
    armature = bpy.data.armatures.new(name)
    rig = bpy.data.objects.new(name, armature)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    created = {}
    for bone_name, head, tail, parent in BONES:
        bone = armature.edit_bones.new(bone_name)
        bone.head = head
        bone.tail = tail
        if parent:
            bone.parent = created[parent]
            bone.use_connect = False
        created[bone_name] = bone
    bpy.ops.object.mode_set(mode="OBJECT")
    for pose_bone in rig.pose.bones:
        pose_bone.rotation_mode = "XYZ"
    return rig


def build_role_detail_kit(actor: dict, rig, collection, *, height: float, shoulders: float,
                          bulk: float, accent, secondary, boot) -> list:
    """Build role-specific, front-readable silhouette equipment.

    These objects are rigged projection only. Gameplay radius, damage and AI
    remain owned by enemy-archetypes.mjs.
    """
    detail = actor.get("detailKit")
    if not detail:
        return []
    actor_id = actor["actorId"]
    kind = detail["kind"]
    parts = []

    if kind == "forkrunner-forearm-forks":
        for side, sign in (("L", 1.0), ("R", -1.0)):
            bone = f"forearm.{side}"
            parts.append(cube(
                f"{actor_id}_Detail_ForearmGuard_{side}",
                (sign * 0.48 * shoulders, -0.035, 1.01 * height),
                (0.070 * bulk, 0.058 * bulk, 0.12 * height), secondary,
                collection, rig, bone, actor_id, bevel=0.018,
            ))
            parts.append(cube(
                f"{actor_id}_Detail_ForkCrossbar_{side}",
                (sign * 0.52 * shoulders, -0.105, 0.85 * height),
                (0.073, 0.028, 0.020), accent,
                collection, rig, bone, actor_id, bevel=0.008,
            ))
            for tine_index, offset in enumerate((-0.040, 0.0, 0.040)):
                parts.append(cylinder(
                    f"{actor_id}_Detail_ForkTine_{side}_{tine_index}",
                    (sign * 0.52 * shoulders + offset, -0.115, 0.70 * height),
                    0.014, 0.30 * height, accent,
                    collection, rig, bone, actor_id,
                ))
    elif kind == "bagholder-undead-scrapper-v1":
        bone_mat = material(f"{actor_id}_detail_bone", "#d8cfb3", roughness=0.9)
        wound_mat = material(f"{actor_id}_detail_wound", "#541d32", roughness=0.94)

        parts.append(cube(
            f"{actor_id}_Detail_ScalpWound", (0.045, -0.102, 1.655 * height),
            (0.052, 0.020, 0.025), wound_mat, collection, rig, "head", actor_id,
            bevel=0.008, rotation=(0.0, math.radians(-10), math.radians(-16)),
        ))
        for tooth_index, x in enumerate((-0.042, 0.0, 0.042)):
            parts.append(cone(
                f"{actor_id}_Detail_BrokenTooth_{tooth_index}",
                (x, -0.125, 1.485 * height), 0.017, 0.055, bone_mat,
                collection, rig, "head", actor_id,
                rotation=(math.radians(90), 0.0, 0.0),
            ))
        for side, sign in (("L", 1.0), ("R", -1.0)):
            parts.append(cube(
                f"{actor_id}_Detail_TornLapel_{side}",
                (sign * 0.095 * shoulders, -0.151 * bulk, 1.29 * height),
                (0.052, 0.022, 0.17 * height), secondary,
                collection, rig, "chest", actor_id, bevel=0.012,
                rotation=(0.0, 0.0, math.radians(sign * 17)),
            ))
            parts.append(cube(
                f"{actor_id}_Detail_ShoulderScrap_{side}",
                (sign * 0.275 * shoulders, -0.052, 1.37 * height),
                (0.092 * bulk, 0.068 * bulk, 0.035), secondary,
                collection, rig, "chest", actor_id, bevel=0.018,
                rotation=(0.0, math.radians(sign * 12), math.radians(sign * 8)),
            ))
            parts.append(cube(
                f"{actor_id}_Detail_ForearmWrap_{side}",
                (sign * 0.47 * shoulders, -0.048, 1.01 * height),
                (0.061 * bulk, 0.058 * bulk, 0.082 * height), wound_mat,
                collection, rig, f"forearm.{side}", actor_id, bevel=0.014,
                rotation=(0.0, 0.0, math.radians(sign * 12)),
            ))
            parts.append(cube(
                f"{actor_id}_Detail_KneeGuard_{side}",
                (sign * 0.13, -0.077, 0.43 * height),
                (0.075 * bulk, 0.032, 0.072 * height), accent,
                collection, rig, f"shin.{side}", actor_id, bevel=0.016,
            ))
            parts.append(cube(
                f"{actor_id}_Detail_BootToe_{side}",
                (sign * 0.13, -0.118, 0.075 * height),
                (0.071 * bulk, 0.055 * bulk, 0.028 * height), secondary,
                collection, rig, f"shin.{side}", actor_id, bevel=0.014,
            ))
            parts.append(cube(
                f"{actor_id}_Detail_DebtPouch_{side}",
                (sign * 0.20 * bulk, -0.142 * bulk, 0.99 * height),
                (0.062, 0.036, 0.078 * height), boot,
                collection, rig, "pelvis", actor_id, bevel=0.014,
                rotation=(0.0, 0.0, math.radians(sign * 5)),
            ))
            parts.append(cube(
                f"{actor_id}_Detail_TornCoatTail_{side}",
                (sign * 0.13 * bulk, 0.045, 0.78 * height),
                (0.082 * bulk, 0.035, 0.16 * height), secondary,
                collection, rig, "pelvis", actor_id, bevel=0.012,
                rotation=(math.radians(sign * 4), 0.0, math.radians(sign * 8)),
            ))
        for link_index, (x, z) in enumerate(((-0.08, 1.31), (0.0, 1.24), (0.08, 1.17))):
            parts.append(cylinder(
                f"{actor_id}_Detail_DebtChain_{link_index}",
                (x, -0.176 * bulk, z * height), 0.025, 0.055, accent,
                collection, rig, "chest", actor_id,
                rotation=(math.radians(90), 0.0, math.radians(-28)),
            ))
    elif kind == "whale-enforcer-undead-bruiser-v1":
        bone_mat = material(f"{actor_id}_detail_bone", "#ddd1a7", roughness=0.9)
        wound_mat = material(f"{actor_id}_detail_wound", "#46251c", roughness=0.94)

        parts.append(cube(
            f"{actor_id}_Detail_SkullFracture", (-0.045, -0.108, 1.655 * height),
            (0.060, 0.020, 0.027), wound_mat, collection, rig, "head", actor_id,
            bevel=0.008, rotation=(0.0, math.radians(8), math.radians(18)),
        ))
        for tooth_index, x in enumerate((-0.045, 0.045)):
            parts.append(cone(
                f"{actor_id}_Detail_JawTooth_{tooth_index}",
                (x, -0.128, 1.485 * height), 0.020, 0.060, bone_mat,
                collection, rig, "head", actor_id,
                rotation=(math.radians(90), 0.0, 0.0),
            ))
        parts.append(cube(
            f"{actor_id}_Detail_NeckGuard", (0.0, -0.058, 1.445 * height),
            (0.20 * shoulders, 0.105 * bulk, 0.052 * height), boot,
            collection, rig, "chest", actor_id, bevel=0.024,
        ))
        for plate_index, (x, width, rotation_z) in enumerate((
            (0.0, 0.13, 0.0),
            (-0.19, 0.085, -8.0),
            (0.19, 0.085, 8.0),
        )):
            parts.append(cube(
                f"{actor_id}_Detail_ChestPlate_{plate_index}",
                (x * shoulders, -0.178 * bulk, (1.28 if plate_index == 0 else 1.27) * height),
                (width * shoulders, 0.028, 0.145 * height), accent,
                collection, rig, "chest", actor_id, bevel=0.020,
                rotation=(0.0, 0.0, math.radians(rotation_z)),
            ))
        for side, sign in (("L", 1.0), ("R", -1.0)):
            parts.append(cube(
                f"{actor_id}_Detail_CrossHarness_{side}",
                (sign * 0.105 * shoulders, -0.205 * bulk, 1.27 * height),
                (0.036, 0.018, 0.22 * height), boot,
                collection, rig, "chest", actor_id, bevel=0.010,
                rotation=(0.0, 0.0, math.radians(sign * 22)),
            ))
            parts.append(cube(
                f"{actor_id}_Detail_ForearmBracer_{side}",
                (sign * 0.47 * shoulders, -0.045, 1.02 * height),
                (0.078 * bulk, 0.068 * bulk, 0.115 * height), accent,
                collection, rig, f"forearm.{side}", actor_id, bevel=0.022,
            ))
            parts.append(cube(
                f"{actor_id}_Detail_KnucklePlate_{side}",
                (sign * 0.53 * shoulders, -0.055, 0.89 * height),
                (0.062 * bulk, 0.052 * bulk, 0.040 * height), bone_mat,
                collection, rig, f"forearm.{side}", actor_id, bevel=0.018,
            ))
            parts.append(cube(
                f"{actor_id}_Detail_HeavyPouch_{side}",
                (sign * 0.21 * bulk, -0.160 * bulk, 0.99 * height),
                (0.078, 0.042, 0.085 * height), secondary,
                collection, rig, "pelvis", actor_id, bevel=0.016,
            ))
            parts.append(cube(
                f"{actor_id}_Detail_KneePlate_{side}",
                (sign * 0.13, -0.084, 0.43 * height),
                (0.087 * bulk, 0.035, 0.082 * height), accent,
                collection, rig, f"shin.{side}", actor_id, bevel=0.018,
            ))
            for rivet_index, z_offset in enumerate((-0.028, 0.035)):
                parts.append(sphere(
                    f"{actor_id}_Detail_ShoulderRivet_{side}_{rivet_index}",
                    (sign * 0.315 * shoulders, -0.122, (1.39 + z_offset) * height),
                    (0.034, 0.025, 0.034), bone_mat,
                    collection, rig, "chest", actor_id,
                ))
    elif kind == "liquidator-tactical-suppressor-v1":
        armor_mat = material(f"{actor_id}_detail_armor", "#21182e", roughness=0.66)
        lens_mat = material(f"{actor_id}_detail_lens", "#ef9cff", emission=0.38, roughness=0.38)

        parts.append(cube(
            f"{actor_id}_Detail_Visor", (0.0, -0.112, 1.575 * height),
            (0.102, 0.024, 0.035), lens_mat, collection, rig, "head", actor_id,
            bevel=0.010,
        ))
        for side, sign in (("L", 1.0), ("R", -1.0)):
            parts.append(sphere(
                f"{actor_id}_Detail_CommNode_{side}",
                (sign * 0.122, -0.015, 1.57 * height), (0.035, 0.028, 0.045),
                accent, collection, rig, "head", actor_id,
            ))
        for plate_index, (x, width, angle) in enumerate((
            (0.0, 0.12, 0.0),
            (-0.16, 0.07, -10.0),
            (0.16, 0.07, 10.0),
        )):
            parts.append(cube(
                f"{actor_id}_Detail_ChestPlate_{plate_index}",
                (x * shoulders, -0.165 * bulk, 1.27 * height),
                (width * shoulders, 0.025, 0.13 * height), armor_mat,
                collection, rig, "chest", actor_id, bevel=0.018,
                rotation=(0.0, 0.0, math.radians(angle)),
            ))
        for side, sign in (("L", 1.0), ("R", -1.0)):
            parts.append(cube(
                f"{actor_id}_Detail_ShoulderPlate_{side}",
                (sign * 0.29 * shoulders, -0.055, 1.38 * height),
                (0.095 * bulk, 0.075 * bulk, 0.045), secondary,
                collection, rig, "chest", actor_id, bevel=0.020,
                rotation=(0.0, math.radians(sign * 12), math.radians(sign * 7)),
            ))
            parts.append(cube(
                f"{actor_id}_Detail_ForearmBracer_{side}",
                (sign * 0.47 * shoulders, -0.045, 1.02 * height),
                (0.066 * bulk, 0.060 * bulk, 0.105 * height), armor_mat,
                collection, rig, f"forearm.{side}", actor_id, bevel=0.017,
            ))
            parts.append(cube(
                f"{actor_id}_Detail_AmmoPouch_{side}",
                (sign * 0.19 * bulk, -0.155 * bulk, 0.99 * height),
                (0.060, 0.038, 0.075 * height), secondary,
                collection, rig, "pelvis", actor_id, bevel=0.014,
            ))
            parts.append(cube(
                f"{actor_id}_Detail_KneePlate_{side}",
                (sign * 0.13, -0.078, 0.43 * height),
                (0.073 * bulk, 0.032, 0.070 * height), armor_mat,
                collection, rig, f"shin.{side}", actor_id, bevel=0.016,
            ))
        parts.append(cube(
            f"{actor_id}_Detail_RifleReceiver", (0.16, -0.27, 1.22 * height),
            (0.062, 0.16, 0.060), armor_mat, collection, rig, "prop_socket", actor_id,
            bevel=0.014,
        ))
        parts.append(cube(
            f"{actor_id}_Detail_RifleStock", (0.16, -0.055, 1.22 * height),
            (0.072, 0.080, 0.075), secondary, collection, rig, "prop_socket", actor_id,
            bevel=0.016,
        ))
        parts.append(cylinder(
            f"{actor_id}_Detail_RifleScope", (0.16, -0.265, 1.31 * height),
            0.027, 0.18, lens_mat, collection, rig, "prop_socket", actor_id,
            rotation=(math.radians(90), 0.0, 0.0),
        ))
        parts.append(cylinder(
            f"{actor_id}_Detail_MuzzleBrake", (0.16, -0.59, 1.22 * height),
            0.046, 0.085, armor_mat, collection, rig, "prop_socket", actor_id,
            rotation=(math.radians(90), 0.0, 0.0),
        ))
        parts.append(cube(
            f"{actor_id}_Detail_RifleMagazine", (0.16, -0.25, 1.115 * height),
            (0.050, 0.045, 0.080), secondary, collection, rig, "prop_socket", actor_id,
            bevel=0.012, rotation=(math.radians(-8), 0.0, 0.0),
        ))
    elif kind == "validator-undead-cultist-v1":
        bone_mat = material(f"{actor_id}_detail_bone", "#d9d0b0", roughness=0.9)
        wound_mat = material(f"{actor_id}_detail_wound", "#44203f", roughness=0.94)

        parts.append(cube(
            f"{actor_id}_Detail_ScalpSigil", (0.0, -0.108, 1.645 * height),
            (0.055, 0.020, 0.026), wound_mat, collection, rig, "head", actor_id,
            bevel=0.008, rotation=(0.0, math.radians(-8), math.radians(18)),
        ))
        for tooth_index, x in enumerate((-0.042, 0.0, 0.042)):
            parts.append(cone(
                f"{actor_id}_Detail_BrokenTooth_{tooth_index}",
                (x, -0.125, 1.485 * height), 0.016, 0.052, bone_mat,
                collection, rig, "head", actor_id,
                rotation=(math.radians(90), 0.0, 0.0),
            ))
        parts.append(cube(
            f"{actor_id}_Detail_CheekWound", (-0.072, -0.112, 1.535 * height),
            (0.032, 0.018, 0.045), wound_mat, collection, rig, "head", actor_id,
            bevel=0.007, rotation=(0.0, 0.0, math.radians(-18)),
        ))
        for side, sign in (("L", 1.0), ("R", -1.0)):
            parts.append(cube(
                f"{actor_id}_Detail_CowlPanel_{side}",
                (sign * 0.085, 0.015, 1.53 * height),
                (0.060, 0.055, 0.15 * height), secondary,
                collection, rig, "head", actor_id, bevel=0.020,
                rotation=(0.0, math.radians(sign * 8), math.radians(sign * 12)),
            ))
            parts.append(cone(
                f"{actor_id}_Detail_ShoulderSigil_{side}",
                (sign * 0.28 * shoulders, -0.070, 1.39 * height),
                0.070, 0.060, accent, collection, rig, "chest", actor_id,
                rotation=(math.radians(90), 0.0, math.radians(sign * 15)),
            ))
            parts.append(cube(
                f"{actor_id}_Detail_ForearmWrap_{side}",
                (sign * 0.47 * shoulders, -0.040, 1.02 * height),
                (0.058 * bulk, 0.056 * bulk, 0.095 * height), wound_mat,
                collection, rig, f"forearm.{side}", actor_id, bevel=0.014,
                rotation=(0.0, 0.0, math.radians(sign * 9)),
            ))
            parts.append(cube(
                f"{actor_id}_Detail_KneeWrap_{side}",
                (sign * 0.13, -0.068, 0.43 * height),
                (0.064 * bulk, 0.028, 0.070 * height), secondary,
                collection, rig, f"shin.{side}", actor_id, bevel=0.014,
            ))
        for panel_index, (x, angle) in enumerate(((-0.11, -7.0), (0.0, 0.0), (0.11, 7.0))):
            parts.append(cube(
                f"{actor_id}_Detail_RobePanel_{panel_index}",
                (x * bulk, 0.035, 0.78 * height),
                (0.067 * bulk, 0.035, 0.20 * height), secondary,
                collection, rig, "pelvis", actor_id, bevel=0.012,
                rotation=(math.radians(3), 0.0, math.radians(angle)),
            ))
        for charm_index, x in enumerate((-0.12, 0.0, 0.12)):
            parts.append(cube(
                f"{actor_id}_Detail_BeltCharm_{charm_index}",
                (x, -0.155 * bulk, 0.98 * height),
                (0.034, 0.022, 0.065 * height), accent,
                collection, rig, "pelvis", actor_id, bevel=0.010,
                rotation=(0.0, 0.0, math.radians((charm_index - 1) * 8)),
            ))
        for band_index, z in enumerate((1.07, 1.34, 1.55)):
            parts.append(cylinder(
                f"{actor_id}_Detail_StaffBand_{band_index}",
                (0.42, -0.10, z * height), 0.034, 0.052, bone_mat,
                collection, rig, "forearm.L", actor_id,
            ))
        for side, sign in (("L", 1.0), ("R", -1.0)):
            parts.append(cube(
                f"{actor_id}_Detail_OrbBracket_{side}",
                (0.42 + sign * 0.055, -0.10, 1.60 * height),
                (0.018, 0.022, 0.065), bone_mat,
                collection, rig, "forearm.L", actor_id, bevel=0.008,
                rotation=(0.0, math.radians(sign * 15), math.radians(sign * 18)),
            ))
    elif kind == "gas-bomber-respirator-rig":
        parts.append(sphere(
            f"{actor_id}_Detail_Respirator", (0.0, -0.125, 1.53 * height),
            (0.102, 0.058, 0.078), accent, collection, rig, "head", actor_id,
        ))
        parts.append(cube(
            f"{actor_id}_Detail_MaskPlate", (0.0, -0.172, 1.53 * height),
            (0.072, 0.018, 0.054), secondary, collection, rig, "head", actor_id, bevel=0.012,
        ))
        for side, sign in (("L", 1.0), ("R", -1.0)):
            parts.append(cylinder(
                f"{actor_id}_Detail_Filter_{side}",
                (sign * 0.112, -0.160, 1.50 * height), 0.045, 0.080, accent,
                collection, rig, "head", actor_id, rotation=(math.radians(90), 0.0, 0.0),
            ))
            parts.append(cylinder(
                f"{actor_id}_Detail_BeltBomb_{side}",
                (sign * 0.205 * bulk, -0.165 * bulk, 1.01 * height), 0.055, 0.14 * height, accent,
                collection, rig, "pelvis", actor_id,
            ))
            parts.append(cone(
                f"{actor_id}_Detail_BeltBombCap_{side}",
                (sign * 0.205 * bulk, -0.165 * bulk, 1.105 * height), 0.036, 0.070, accent,
                collection, rig, "pelvis", actor_id,
            ))
        parts.append(cone(
            f"{actor_id}_Detail_HazardBadge", (0.0, -0.164 * bulk, 1.25 * height),
            0.080, 0.055, accent, collection, rig, "chest", actor_id,
            rotation=(math.radians(90), 0.0, 0.0),
        ))
        parts.append(cylinder(
            f"{actor_id}_Detail_HoseUpper", (0.145, -0.145, 1.33 * height),
            0.018, 0.31 * height, secondary, collection, rig, "chest", actor_id,
            rotation=(0.0, math.radians(-12), 0.0),
        ))
        parts.append(cylinder(
            f"{actor_id}_Detail_HoseLower", (0.175, -0.145, 1.13 * height),
            0.018, 0.14 * height, secondary, collection, rig, "chest", actor_id,
            rotation=(0.0, math.radians(18), 0.0),
        ))
    else:
        raise RuntimeError(f"Unknown detail kit: {kind}")

    minimum = detail["minimumAuthoredParts"]
    if len(parts) < minimum:
        raise RuntimeError(f"{actor_id} detail kit {kind} built {len(parts)} parts; minimumAuthoredParts={minimum}")
    for obj in parts:
        obj["hmh_detail_kit"] = kind
    return parts


def build_actor(actor: dict, rig, collection) -> dict:
    actor_id = actor["actorId"]
    build = actor["build"]
    palette = actor["palette"]
    height = build["height"]
    shoulders = build["shoulders"]
    bulk = build["bulk"]

    policy = actor.get("materialPolicy", {})
    skin = material(
        f"{actor_id}_skin", palette["skin"],
        metallic=policy.get("skinMetallic", 0.0),
        roughness=policy.get("skinRoughness", 0.86),
    )
    primary = material(f"{actor_id}_primary", palette["primary"], roughness=policy.get("identityRoughness", 0.8))
    secondary = material(f"{actor_id}_secondary", palette["secondary"], roughness=policy.get("identityRoughness", 0.8))
    accent = material(f"{actor_id}_accent", palette["accent"], emission=0.55, roughness=policy.get("accentRoughness", 0.62))
    boot = material(f"{actor_id}_boot", palette["boot"], roughness=policy.get("identityRoughness", 0.8))

    parts = []
    # Torso and hips carry the bulk; the shoulder width is what reads at a
    # glance, so it is driven separately from overall mass.
    parts.append(cube(f"{actor_id}_Chest", (0.0, 0.0, 1.22 * height), (0.19 * shoulders, 0.13 * bulk, 0.21 * height),
                      primary, collection, rig, "chest", actor_id))
    parts.append(cube(f"{actor_id}_Pelvis", (0.0, 0.0, 0.94 * height), (0.15 * bulk, 0.12 * bulk, 0.12 * height),
                      secondary, collection, rig, "pelvis", actor_id))
    # Head: skull, brow ridge, jaw and recessed eye sockets. A bare sphere read
    # as a featureless ball at gameplay scale, which is most of why the roster
    # looked undetailed.
    parts.append(sphere(f"{actor_id}_Head", (0.0, 0.0, 1.56 * height), (0.118, 0.115, 0.132), skin,
                        collection, rig, "head", actor_id))
    parts.append(cube(f"{actor_id}_Brow", (0.0, -0.085, 1.60 * height), (0.098, 0.035, 0.028),
                      skin, collection, rig, "head", actor_id, bevel=0.012))
    parts.append(cube(f"{actor_id}_Jaw", (0.0, -0.052, 1.49 * height), (0.082, 0.062, 0.042),
                      skin, collection, rig, "head", actor_id, bevel=0.016))
    for eye_side in (-1.0, 1.0):
        parts.append(cube(f"{actor_id}_EyeSocket_{'L' if eye_side > 0 else 'R'}",
                          (eye_side * 0.046, -0.098, 1.565 * height), (0.028, 0.018, 0.020),
                          boot, collection, rig, "head", actor_id, bevel=0.006))
    # Hair/hood mass gives the silhouette a top profile instead of a dome.
    parts.append(sphere(f"{actor_id}_Crown", (0.0, 0.022, 1.60 * height), (0.116, 0.108, 0.088),
                        secondary, collection, rig, "head", actor_id))
    # Two arms and two legs, always: the roster contract requires recognizable
    # biological anatomy even on grayboxes.
    for side, sign in (("L", 1.0), ("R", -1.0)):
        parts.append(cube(f"{actor_id}_UpperArm_{side}", (sign * 0.29 * shoulders, 0.0, 1.24 * height),
                          (0.055 * bulk, 0.055 * bulk, 0.13 * height), skin, collection, rig, f"upper_arm.{side}", actor_id))
        parts.append(cube(f"{actor_id}_Forearm_{side}", (sign * 0.46 * shoulders, 0.0, 1.02 * height),
                          (0.048 * bulk, 0.048 * bulk, 0.12 * height), skin, collection, rig, f"forearm.{side}", actor_id))
        # Hands and shoulder caps: limbs previously ended in flat stumps.
        parts.append(cube(f"{actor_id}_Hand_{side}", (sign * 0.52 * shoulders, 0.0, 0.90 * height),
                          (0.045 * bulk, 0.040 * bulk, 0.052 * height), boot, collection, rig, f"forearm.{side}",
                          actor_id, bevel=0.018))
        parts.append(sphere(f"{actor_id}_Shoulder_{side}", (sign * 0.24 * shoulders, 0.0, 1.34 * height),
                            (0.072 * bulk, 0.070 * bulk, 0.068 * bulk), primary, collection, rig, "chest", actor_id))
        parts.append(cube(f"{actor_id}_Thigh_{side}", (sign * 0.12, 0.0, 0.66 * height),
                          (0.068 * bulk, 0.068 * bulk, 0.20 * height), secondary, collection, rig, f"thigh.{side}", actor_id))
        parts.append(cube(f"{actor_id}_Shin_{side}", (sign * 0.13, 0.0, 0.26 * height),
                          (0.058 * bulk, 0.058 * bulk, 0.20 * height), boot, collection, rig, f"shin.{side}", actor_id))
        # Boots read the ground contact; a leg ending in a flat cube did not.
        parts.append(cube(f"{actor_id}_Boot_{side}", (sign * 0.13, -0.030, 0.075 * height),
                          (0.066 * bulk, 0.086 * bulk, 0.052 * height), boot, collection, rig, f"shin.{side}",
                          actor_id, bevel=0.02))

    parts.append(cube(f"{actor_id}_Belt", (0.0, 0.0, 1.02 * height),
                      (0.163 * bulk, 0.128 * bulk, 0.030 * height), boot, collection, rig, "pelvis",
                      actor_id, bevel=0.012))
    parts.append(cube(f"{actor_id}_Buckle", (0.0, -0.118 * bulk, 1.02 * height),
                      (0.036, 0.020, 0.030), accent, collection, rig, "pelvis", actor_id, bevel=0.008))
    for strap in (-1.0, 1.0):
        parts.append(cube(f"{actor_id}_Harness_{'L' if strap > 0 else 'R'}",
                          (strap * 0.072 * shoulders, -0.128 * bulk, 1.24 * height),
                          (0.030, 0.016, 0.185 * height), secondary, collection, rig, "chest",
                          actor_id, bevel=0.008))

    # One silhouette prop per family. This is the read-at-a-glance cue that
    # separates roles in a crowded fight.
    prop = actor["prop"]
    kind = prop["kind"]
    prop_mat = material(f"{actor_id}_prop_accent", prop["accent"], emission=0.7)
    if kind == "chest-wedge":
        parts.append(cone(f"{actor_id}_Prop_Wedge", (0.0, -0.16, 1.26 * height), 0.13, 0.1, prop_mat,
                          collection, rig, "chest", actor_id, rotation=(math.radians(90), 0, 0)))
    elif kind == "back-satchel":
        parts.append(cube(f"{actor_id}_Prop_Satchel", (0.0, 0.19, 1.20 * height), (0.14, 0.06, 0.11), prop_mat,
                          collection, rig, "chest", actor_id))
    elif kind == "shoulder-rifle":
        parts.append(cylinder(f"{actor_id}_Prop_Rifle", (0.16, -0.30, 1.22 * height), 0.032, 0.56, prop_mat,
                              collection, rig, "prop_socket", actor_id, rotation=(math.radians(90), 0, 0)))
    elif kind == "shoulder-plate":
        for sign in (1.0, -1.0):
            parts.append(cube(f"{actor_id}_Prop_Pauldron_{'L' if sign > 0 else 'R'}",
                              (sign * 0.30 * shoulders, 0.0, 1.38 * height), (0.10, 0.11, 0.055), prop_mat,
                              collection, rig, "chest", actor_id))
    elif kind == "back-canister":
        parts.append(cylinder(f"{actor_id}_Prop_Canister", (0.0, 0.22, 1.24 * height), 0.10, 0.30, prop_mat,
                              collection, rig, "chest", actor_id))
    elif kind == "hand-staff":
        parts.append(cylinder(f"{actor_id}_Prop_Staff", (0.42, -0.10, 1.16 * height), 0.022, 0.86, prop_mat,
                              collection, rig, "forearm.L", actor_id))
        parts.append(sphere(f"{actor_id}_Prop_StaffOrb", (0.42, -0.10, 1.60 * height), (0.06, 0.06, 0.06), prop_mat,
                            collection, rig, "forearm.L", actor_id))
    elif kind == "crown-rig":
        for index in range(5):
            angle = math.radians(-52 + index * 26)
            parts.append(cone(f"{actor_id}_Prop_Crown_{index}",
                              (math.sin(angle) * 0.15, math.cos(angle) * 0.15 * -1, 1.74 * height),
                              0.028, 0.16, prop_mat, collection, rig, "head", actor_id))
        parts.append(cube(f"{actor_id}_Prop_Mantle", (0.0, 0.16, 1.30 * height), (0.30 * shoulders, 0.05, 0.20), prop_mat,
                          collection, rig, "chest", actor_id))
    else:
        raise RuntimeError(f"Unknown prop kind: {kind}")

    detail_parts = build_role_detail_kit(
        actor, rig, collection, height=height, shoulders=shoulders, bulk=bulk,
        accent=accent, secondary=secondary, boot=boot,
    )
    parts.extend(detail_parts)

    # Boss phases carry real authored silhouette changes rather than runtime
    # tint-only proxies. These objects are hidden selectively by the exporter.
    phase_visuals = actor.get("phaseVisuals", {})
    if phase_visuals:
        market = phase_visuals["market-open"]
        market_mat = material(f"{actor_id}_phase_market", market["accent"], emission=0.64, roughness=0.6)
        market_badge = cylinder(
            f"{actor_id}_Phase_MarketCoin", (0.0, -0.24, 1.22 * height), 0.20, 0.075,
            market_mat, collection, rig, "chest", actor_id, rotation=(math.radians(90), 0.0, 0.0),
        )
        market_badge["hmh_phase"] = "market-open"
        parts.append(market_badge)
        for index, x in enumerate((-0.10, 0.0, 0.10)):
            tick = cube(
                f"{actor_id}_Phase_MarketTick_{index}", (x, -0.29, (1.18 + index * 0.04) * height),
                (0.025, 0.025, 0.07 + index * 0.02), market_mat, collection, rig, "chest", actor_id, bevel=0.015,
            )
            tick["hmh_phase"] = "market-open"
            parts.append(tick)
        margin = phase_visuals["margin-call"]
        margin_mat = material(f"{actor_id}_phase_margin", margin["accent"], emission=0.72, roughness=0.58)
        for side, sign in (("L", 1.0), ("R", -1.0)):
            phase_obj = cone(
                f"{actor_id}_Phase_MarginSpike_{side}",
                (sign * 0.44 * shoulders, 0.0, 1.43 * height),
                0.10, 0.46, margin_mat, collection, rig, "chest", actor_id,
                rotation=(0.0, math.radians(sign * 54), 0.0),
            )
            phase_obj["hmh_phase"] = "margin-call"
            parts.append(phase_obj)
        total = phase_visuals["total-liquidation"]
        total_mat = material(f"{actor_id}_phase_total", total["accent"], emission=0.9, roughness=0.5)
        for index in range(8):
            angle = math.radians(index * 45)
            phase_obj = cone(
                f"{actor_id}_Phase_LiquidationRay_{index}",
                (math.sin(angle) * 0.42, 0.12 + math.cos(angle) * 0.18, 1.31 * height + math.cos(angle) * 0.20),
                0.055, 0.38, total_mat, collection, rig, "chest", actor_id,
                rotation=(math.radians(90), angle, 0.0),
            )
            phase_obj["hmh_phase"] = "total-liquidation"
            parts.append(phase_obj)
        total_core = sphere(
            f"{actor_id}_Phase_LiquidationCore", (0.0, -0.27, 1.22 * height), (0.20, 0.10, 0.20),
            total_mat, collection, rig, "chest", actor_id,
        )
        total_core["hmh_phase"] = "total-liquidation"
        parts.append(total_core)

    # Zombies get a visible identity cue distinct from the living survivors.
    if actor["identityForm"] == "zombie":
        parts.append(cube(f"{actor_id}_Ident_Ribs", (0.0, -0.14, 1.14 * height), (0.11 * shoulders, 0.02, 0.07), skin,
                          collection, rig, "chest", actor_id))

    for obj in parts:
        obj.hide_render = True
    return {
        "actorId": actor_id,
        "objectCount": len(parts),
        "identityForm": actor["identityForm"],
        "prop": kind,
        "detailKit": actor.get("detailKit", {}).get("kind"),
        "detailPartCount": len(detail_parts),
    }


def build_lighting(manifest: dict):
    scene = bpy.context.scene
    scene.render.engine = manifest["render"]["engine"]
    scene.render.dither_intensity = manifest["render"]["ditherIntensity"]
    scene.eevee.taa_render_samples = manifest["render"]["taaRenderSamples"]
    scene.render.film_transparent = True
    world = bpy.data.worlds.new("HMH_Enemy_World")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.02, 0.03, 0.04, 1.0)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.42
    scene.world = world
    if hasattr(scene, "view_settings"):
        scene.view_settings.exposure = manifest["render"]["exposure"]
    scene.display.shading.light = manifest["render"]["workbenchLight"]
    scene.display.shading.color_type = manifest["render"]["workbenchColorType"]
    scene.display.shading.show_shadows = True
    scene.display.shading.show_cavity = manifest["render"]["workbenchCavityEnabled"]
    scene.display.shading.cavity_type = manifest["render"]["workbenchCavity"]
    scene.display.shading.show_specular_highlight = True

    _channels = dict((name, (color, energy)) for name, color, energy in shared_light_channels("enemy"))
    key = bpy.data.lights.new("HMH_Enemy_Key", type="AREA")
    key.energy = _channels["key"][1]
    key.color = _channels["key"][0]
    key.size = 5.0
    key.use_shadow = manifest["render"]["castShadows"]
    key_obj = bpy.data.objects.new("HMH_Enemy_Key", key)
    key_obj.location = (2.6, -3.4, 4.4)
    key_obj.rotation_euler = (math.radians(48), 0.0, math.radians(38))
    scene.collection.objects.link(key_obj)

    fill = bpy.data.lights.new("HMH_Enemy_Fill", type="AREA")
    fill.energy = _channels["fill"][1]
    fill.color = _channels["fill"][0]
    fill.size = 6.0
    fill.use_shadow = manifest["render"]["castShadows"]
    fill_obj = bpy.data.objects.new("HMH_Enemy_Fill", fill)
    fill_obj.location = (-3.2, -2.2, 2.6)
    fill_obj.rotation_euler = (math.radians(66), 0.0, math.radians(-52))
    scene.collection.objects.link(fill_obj)

    rim = bpy.data.lights.new("HMH_Enemy_Rim", type="AREA")
    rim.energy = _channels["rim"][1]
    rim.color = _channels["rim"][0]
    rim.size = 4.0
    rim.use_shadow = manifest["render"]["castShadows"]
    rim_obj = bpy.data.objects.new("HMH_Enemy_Rim", rim)
    rim_obj.location = (0.4, 3.6, 3.4)
    rim_obj.rotation_euler = (math.radians(-56), 0.0, math.radians(8))
    scene.collection.objects.link(rim_obj)

    camera_data = bpy.data.cameras.new("HMH_Enemy_Camera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = manifest["render"]["cameraOrthoScale"]
    camera = bpy.data.objects.new("HMH_Enemy_Camera", camera_data)
    # Top-down 2.5D framing: matches the hero pilot so enemies and heroes sit
    # in the same projection.
    target_z = manifest["render"].get("cameraTargetZ", 0.0)
    camera.location = (0.0, -3.05, 3.05 + target_z)
    camera.rotation_euler = (math.radians(manifest["render"]["cameraPitchDegrees"]), 0.0, 0.0)
    scene.collection.objects.link(camera)
    scene.camera = camera


def main() -> None:
    args = blender_args()
    manifest = json.loads(Path(args.manifest).resolve().read_text(encoding="utf-8"))

    bpy.ops.wm.read_factory_settings(use_empty=True)
    collection = bpy.data.collections.new(manifest["scene"]["collection"])
    bpy.context.scene.collection.children.link(collection)

    build_lighting(manifest)
    rig = build_rig(manifest["scene"]["armature"])
    move_to_collection(rig, collection)

    built = []
    for actor in manifest["actors"]:
        actor_with_policy = dict(actor)
        actor_with_policy["materialPolicy"] = manifest.get("materialPolicy", {})
        built.append(build_actor(actor_with_policy, rig, collection))
    apply_render_material_policy(manifest)

    blend_path = Path(args.source_blend).resolve()
    blend_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))

    write_lf_json(Path(args.inspection_output).resolve(), {
        "status": "pass",
        "pipelineId": manifest["pipelineId"],
        "armature": manifest["scene"]["armature"],
        "boneCount": len(BONES),
        "actors": built,
        "totalObjects": sum(entry["objectCount"] for entry in built),
    })
    print(json.dumps({"status": "pass", "actors": len(built)}, sort_keys=True))


if __name__ == "__main__":
    main()


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
    parts.append(sphere(f"{actor_id}_Head", (0.0, 0.0, 1.56 * height), (0.115, 0.115, 0.13), skin,
                        collection, rig, "head", actor_id))
    # Two arms and two legs, always: the roster contract requires recognizable
    # biological anatomy even on grayboxes.
    for side, sign in (("L", 1.0), ("R", -1.0)):
        parts.append(cube(f"{actor_id}_UpperArm_{side}", (sign * 0.29 * shoulders, 0.0, 1.24 * height),
                          (0.055 * bulk, 0.055 * bulk, 0.13 * height), skin, collection, rig, f"upper_arm.{side}", actor_id))
        parts.append(cube(f"{actor_id}_Forearm_{side}", (sign * 0.46 * shoulders, 0.0, 1.02 * height),
                          (0.048 * bulk, 0.048 * bulk, 0.12 * height), skin, collection, rig, f"forearm.{side}", actor_id))
        parts.append(cube(f"{actor_id}_Thigh_{side}", (sign * 0.12, 0.0, 0.66 * height),
                          (0.068 * bulk, 0.068 * bulk, 0.20 * height), secondary, collection, rig, f"thigh.{side}", actor_id))
        parts.append(cube(f"{actor_id}_Shin_{side}", (sign * 0.13, 0.0, 0.26 * height),
                          (0.058 * bulk, 0.058 * bulk, 0.20 * height), boot, collection, rig, f"shin.{side}", actor_id))

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
    return {"actorId": actor_id, "objectCount": len(parts), "identityForm": actor["identityForm"], "prop": kind}


def build_lighting(manifest: dict):
    scene = bpy.context.scene
    scene.render.engine = manifest["render"]["engine"]
    scene.render.film_transparent = True
    world = bpy.data.worlds.new("HMH_Enemy_World")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.02, 0.03, 0.04, 1.0)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.55
    scene.world = world
    if hasattr(scene, "view_settings"):
        scene.view_settings.exposure = manifest["render"]["exposure"]

    key = bpy.data.lights.new("HMH_Enemy_Key", type="AREA")
    key.energy = 330
    key.size = 5.0
    key_obj = bpy.data.objects.new("HMH_Enemy_Key", key)
    key_obj.location = (2.6, -3.4, 4.4)
    key_obj.rotation_euler = (math.radians(48), 0.0, math.radians(38))
    scene.collection.objects.link(key_obj)

    fill = bpy.data.lights.new("HMH_Enemy_Fill", type="AREA")
    fill.energy = 120
    fill.size = 6.0
    fill_obj = bpy.data.objects.new("HMH_Enemy_Fill", fill)
    fill_obj.location = (-3.2, -2.2, 2.6)
    fill_obj.rotation_euler = (math.radians(66), 0.0, math.radians(-52))
    scene.collection.objects.link(fill_obj)

    rim = bpy.data.lights.new("HMH_Enemy_Rim", type="AREA")
    rim.energy = 190
    rim.size = 4.0
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

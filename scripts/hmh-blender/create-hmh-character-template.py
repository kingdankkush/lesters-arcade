from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import bpy
from mathutils import Vector

SCENE_TEMPLATE_ID = "hmh_character_template"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--output", required=True)
    args = []
    if "--" in __import__("sys").argv:
        args = __import__("sys").argv[__import__("sys").argv.index("--") + 1 :]
    return parser.parse_args(args)


def srgb_to_linear(value: float) -> float:
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


def rgba(hex_color: str, alpha: float = 1.0) -> tuple[float, float, float, float]:
    value = hex_color.lstrip("#")
    channels = tuple(srgb_to_linear(int(value[index : index + 2], 16) / 255) for index in (0, 2, 4))
    return channels + (alpha,)


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        bpy.data.collections.remove(collection)
    for material in list(bpy.data.materials):
        bpy.data.materials.remove(material)


def create_collection(name: str) -> bpy.types.Collection:
    collection = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(collection)
    return collection


def move_to_collection(obj: bpy.types.Object, collection: bpy.types.Collection) -> None:
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collection.objects.link(obj)


def make_material(name: str, color: tuple[float, float, float, float], *, roughness: float = 0.78) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = color
    emission.inputs["Strength"].default_value = 1.0
    if color[3] < 1.0:
        transparent = nodes.new("ShaderNodeBsdfTransparent")
        mix = nodes.new("ShaderNodeMixShader")
        mix.inputs[0].default_value = color[3]
        material.node_tree.links.new(transparent.outputs["BSDF"], mix.inputs[1])
        material.node_tree.links.new(emission.outputs["Emission"], mix.inputs[2])
        material.node_tree.links.new(mix.outputs["Shader"], output.inputs["Surface"])
    else:
        material.node_tree.links.new(emission.outputs["Emission"], output.inputs["Surface"])
    material["hmh_palette_locked"] = True
    material["hmh_roughness_rule"] = roughness
    return material


def add_uv_sphere(name: str, location: tuple[float, float, float], scale: tuple[float, float, float], material: bpy.types.Material, collection: bpy.types.Collection) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(material)
    move_to_collection(obj, collection)
    return obj


def add_box(name: str, location: tuple[float, float, float], scale: tuple[float, float, float], material: bpy.types.Material, collection: bpy.types.Collection) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(material)
    move_to_collection(obj, collection)
    return obj


def add_cylinder_between(name: str, start: tuple[float, float, float], end: tuple[float, float, float], radius: float, material: bpy.types.Material, collection: bpy.types.Collection) -> bpy.types.Object:
    start_v = Vector(start)
    end_v = Vector(end)
    direction = end_v - start_v
    midpoint = (start_v + end_v) * 0.5
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=radius, depth=direction.length, location=midpoint)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    obj.data.materials.append(material)
    move_to_collection(obj, collection)
    return obj


def parent_to_bone(obj: bpy.types.Object, armature: bpy.types.Object, bone_name: str) -> None:
    bpy.context.view_layer.update()
    world = obj.matrix_world.copy()
    obj.parent = armature
    obj.parent_type = "BONE"
    obj.parent_bone = bone_name
    bpy.context.view_layer.update()
    obj.matrix_world = world


def create_rig() -> bpy.types.Object:
    armature_data = bpy.data.armatures.new("HMH_CharacterRigData")
    armature = bpy.data.objects.new("HMH_CharacterRig", armature_data)
    bpy.context.scene.collection.objects.link(armature)
    bpy.context.view_layer.objects.active = armature
    armature.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bones = {
        "root": ((0, 0, 0), (0, 0, 0.12), None),
        "pelvis": ((0, 0, 0.72), (0, 0, 0.92), "root"),
        "spine": ((0, 0, 0.92), (0, 0, 1.20), "pelvis"),
        "chest": ((0, 0, 1.20), (0, 0, 1.43), "spine"),
        "head": ((0, 0, 1.43), (0, 0, 1.76), "chest"),
        "upper_arm.L": ((-0.20, 0, 1.34), (-0.46, -0.03, 1.18), "chest"),
        "forearm.L": ((-0.46, -0.03, 1.18), (-0.55, -0.26, 1.06), "upper_arm.L"),
        "upper_arm.R": ((0.20, 0, 1.34), (0.46, -0.03, 1.18), "chest"),
        "forearm.R": ((0.46, -0.03, 1.18), (0.33, -0.37, 1.08), "upper_arm.R"),
        "thigh.L": ((-0.13, 0, 0.78), (-0.13, 0, 0.42), "pelvis"),
        "shin.L": ((-0.13, 0, 0.42), (-0.13, -0.02, 0.08), "thigh.L"),
        "thigh.R": ((0.13, 0, 0.78), (0.13, 0, 0.42), "pelvis"),
        "shin.R": ((0.13, 0, 0.42), (0.13, -0.02, 0.08), "thigh.R"),
        "weapon_socket": ((0.31, -0.34, 1.08), (0.31, -0.82, 1.08), "forearm.R"),
    }
    for name, (head, tail, parent_name) in bones.items():
        bone = armature_data.edit_bones.new(name)
        bone.head = head
        bone.tail = tail
        if parent_name:
            bone.parent = armature_data.edit_bones[parent_name]
    bpy.ops.object.mode_set(mode="POSE")
    for bone in armature.pose.bones:
        bone.rotation_mode = "XYZ"
    bpy.ops.object.mode_set(mode="OBJECT")
    armature["shared_hero_proportions"] = True
    armature["height_meters"] = 1.8
    return armature


def create_mannequin(manifest: dict, collections: dict[str, bpy.types.Collection], armature: bpy.types.Object) -> None:
    palette = manifest["palette"]
    materials = {
        "outline": make_material("HMH_Outline", rgba(palette["outline"])),
        "suit": make_material("HMH_Suit", rgba(palette["suit"])),
        "highlight": make_material("HMH_SuitHighlight", rgba(palette["suitHighlight"])),
        "mannequin": make_material("HMH_Mannequin", rgba(palette["mannequin"])),
        "weapon": make_material("HMH_WeaponGold", rgba(palette["weapon"]), roughness=0.48),
        "shadow": make_material("HMH_Shadow", rgba(palette["shadow"], 0.18)),
    }

    lower = collections["HMH_LowerBody"]
    left_thigh = add_cylinder_between("HMH_Thigh.L", (-0.13, 0, 0.78), (-0.13, 0, 0.42), 0.105, materials["suit"], lower)
    left_shin = add_cylinder_between("HMH_Shin.L", (-0.13, 0, 0.42), (-0.13, -0.02, 0.10), 0.09, materials["highlight"], lower)
    right_thigh = add_cylinder_between("HMH_Thigh.R", (0.13, 0, 0.78), (0.13, 0, 0.42), 0.105, materials["suit"], lower)
    right_shin = add_cylinder_between("HMH_Shin.R", (0.13, 0, 0.42), (0.13, -0.02, 0.10), 0.09, materials["highlight"], lower)
    left_boot = add_box("HMH_Boot.L", (-0.13, -0.075, 0.07), (0.12, 0.18, 0.07), materials["outline"], lower)
    right_boot = add_box("HMH_Boot.R", (0.13, -0.075, 0.07), (0.12, 0.18, 0.07), materials["outline"], lower)
    for obj, bone in [(left_thigh, "thigh.L"), (left_shin, "shin.L"), (left_boot, "shin.L"), (right_thigh, "thigh.R"), (right_shin, "shin.R"), (right_boot, "shin.R")]:
        parent_to_bone(obj, armature, bone)

    torso = collections["HMH_TorsoHead"]
    pelvis = add_box("HMH_Pelvis", (0, 0, 0.82), (0.24, 0.17, 0.16), materials["outline"], torso)
    chest = add_box("HMH_Torso", (0, -0.01, 1.16), (0.34, 0.22, 0.35), materials["suit"], torso)
    chest_plate = add_box("HMH_ChestPlate", (0, -0.235, 1.18), (0.23, 0.035, 0.20), materials["highlight"], torso)
    head = add_uv_sphere("HMH_Head", (0, -0.01, 1.62), (0.22, 0.20, 0.24), materials["mannequin"], torso)
    left_upper = add_cylinder_between("HMH_UpperArm.L", (-0.20, 0, 1.34), (-0.46, -0.03, 1.18), 0.09, materials["suit"], torso)
    left_fore = add_cylinder_between("HMH_Forearm.L", (-0.46, -0.03, 1.18), (-0.55, -0.26, 1.06), 0.075, materials["mannequin"], torso)
    right_upper = add_cylinder_between("HMH_UpperArm.R", (0.20, 0, 1.34), (0.46, -0.03, 1.18), 0.09, materials["suit"], torso)
    right_fore = add_cylinder_between("HMH_Forearm.R", (0.46, -0.03, 1.18), (0.33, -0.37, 1.08), 0.075, materials["mannequin"], torso)
    for obj, bone in [(pelvis, "pelvis"), (chest, "chest"), (chest_plate, "chest"), (head, "head"), (left_upper, "upper_arm.L"), (left_fore, "forearm.L"), (right_upper, "upper_arm.R"), (right_fore, "forearm.R")]:
        parent_to_bone(obj, armature, bone)

    weapon = collections["HMH_Weapon"]
    rifle = add_box("HMH_Rifle", (0.31, -0.68, 1.08), (0.07, 0.40, 0.07), materials["weapon"], weapon)
    muzzle = add_cylinder_between("HMH_Muzzle", (0.31, -1.02, 1.08), (0.31, -1.18, 1.08), 0.045, materials["outline"], weapon)
    parent_to_bone(rifle, armature, "weapon_socket")
    parent_to_bone(muzzle, armature, "weapon_socket")

    shadow_collection = collections["HMH_Shadow"]
    shadow = add_uv_sphere("HMH_GroundShadow", (0, 0.02, 0.025), (0.42, 0.28, 0.018), materials["shadow"], shadow_collection)
    shadow["render_role"] = "ground-contact-shadow"


def create_guides(collection: bpy.types.Collection, material: bpy.types.Material) -> None:
    ground = add_box("HMH_GroundGuide", (0, 0, -0.035), (2.0, 2.0, 0.03), material, collection)
    scale = add_box("HMH_ScaleReference", (1.35, 0.9, 0.5), (0.5, 0.5, 0.5), material, collection)
    ground.hide_render = True
    scale.hide_render = True


def point_at(obj: bpy.types.Object, target: tuple[float, float, float]) -> None:
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def create_camera_and_lights(manifest: dict) -> None:
    scene = bpy.context.scene
    camera_spec = manifest["scene"]["camera"]
    target = tuple(camera_spec["target"])
    elevation = math.radians(camera_spec["rotationDegrees"][0])
    azimuth = math.radians(camera_spec["rotationDegrees"][2])
    distance = 8.0
    horizontal = distance * math.cos(elevation)
    location = (horizontal * math.cos(azimuth), horizontal * math.sin(azimuth), target[2] + distance * math.sin(elevation))
    camera_data = bpy.data.cameras.new("HMH_OrthoCameraData")
    camera = bpy.data.objects.new("HMH_OrthoCamera", camera_data)
    scene.collection.objects.link(camera)
    camera.location = location
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = camera_spec["orthographicScale"]
    point_at(camera, target)
    scene.camera = camera

    lights = [
        ("HMH_Key", (4.0, -4.0, 6.0), 900.0, 4.0, (0.78, 0.88, 1.0)),
        ("HMH_Fill", (-4.0, -2.5, 4.0), 520.0, 5.0, (0.45, 0.64, 1.0)),
        ("HMH_Rim", (0.0, 4.0, 5.5), 720.0, 3.0, (1.0, 0.74, 0.36)),
    ]
    for name, location, energy, size, color in lights:
        data = bpy.data.lights.new(f"{name}Data", type="AREA")
        data.energy = energy
        data.shape = "DISK"
        data.size = size
        data.color = color
        obj = bpy.data.objects.new(name, data)
        scene.collection.objects.link(obj)
        obj.location = location
        point_at(obj, target)


def configure_render(manifest: dict) -> None:
    scene = bpy.context.scene
    spec = manifest["scene"]
    render = manifest["render"]
    scene.render.engine = spec["renderEngine"]
    scene.render.resolution_x = render["frameSize"][0]
    scene.render.resolution_y = render["frameSize"][1]
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = render["fileFormat"]
    scene.render.image_settings.color_mode = render["colorMode"]
    scene.render.image_settings.color_depth = str(render["colorDepth"])
    scene.render.film_transparent = True
    scene.render.threads_mode = "FIXED"
    scene.render.threads = spec["threads"]
    scene.render.use_file_extension = True
    scene.render.use_compositing = False
    scene.render.use_sequencer = False
    scene.view_settings.view_transform = spec["colorManagement"]["view"]
    try:
        scene.view_settings.look = spec["colorManagement"]["look"]
    except TypeError:
        scene.view_settings.look = "Medium High Contrast"
    scene.view_settings.exposure = spec["colorManagement"]["exposure"]
    scene.view_settings.gamma = spec["colorManagement"]["gamma"]
    scene.world.color = (0.0, 0.0, 0.0)
    scene["hmh_pipeline_id"] = manifest["id"]
    scene["hmh_random_seed"] = spec["randomSeed"]
    scene["hmh_template_id"] = SCENE_TEMPLATE_ID


def main() -> None:
    args = parse_args()
    manifest_path = Path(args.manifest).resolve()
    output_path = Path(args.output).resolve()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    clear_scene()
    collections = {name: create_collection(name) for name in ["HMH_Shadow", "HMH_LowerBody", "HMH_TorsoHead", "HMH_Weapon", "HMH_Guides"]}
    rig = create_rig()
    create_mannequin(manifest, collections, rig)
    guide_material = make_material("HMH_Guide", (0.12, 0.18, 0.28, 1.0))
    create_guides(collections["HMH_Guides"], guide_material)
    create_camera_and_lights(manifest)
    configure_render(manifest)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output_path), compress=True)
    print(json.dumps({
        "status": "PASS",
        "pipelineId": manifest["id"],
        "scene": str(output_path),
        "collections": sorted(collections),
        "bones": sorted(bone.name for bone in rig.data.bones),
    }))


if __name__ == "__main__":
    main()

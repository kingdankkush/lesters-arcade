from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector

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
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--raw-output", required=True)
    parser.add_argument("--source-blend", required=True)
    parser.add_argument("--inspection-output", required=True)
    return parser.parse_args(argv)


def hex_rgba(value: str, alpha: float = 1.0) -> tuple[float, float, float, float]:
    value = value.lstrip("#")
    return tuple(int(value[index : index + 2], 16) / 255 for index in (0, 2, 4)) + (alpha,)


def material(name: str, color: str, *, alpha: float = 1.0, metallic: float = 0.0, emission: float = 0.0):
    mat = bpy.data.materials.new(name)
    rgba = hex_rgba(color, alpha)
    mat.diffuse_color = rgba
    mat.use_nodes = True
    node = mat.node_tree.nodes.get("Principled BSDF")
    node.inputs["Base Color"].default_value = rgba
    node.inputs["Roughness"].default_value = 0.34 if metallic else 0.72
    node.inputs["Metallic"].default_value = metallic
    node.inputs["Alpha"].default_value = alpha
    if emission:
        node.inputs["Emission Color"].default_value = rgba
        node.inputs["Emission Strength"].default_value = emission
    if alpha < 1.0 and hasattr(mat, "surface_render_method"):
        mat.surface_render_method = "DITHERED"
    return mat


def move_to_collection(obj, collection):
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)


def attach_to_bone(obj, rig, bone_name: str):
    world = obj.matrix_world.copy()
    obj.parent = rig
    obj.parent_type = "BONE"
    obj.parent_bone = bone_name
    obj.matrix_world = world


def cube(name, location, scale, mat, collection, *, bevel=0.08, rotation=(0.0, 0.0, 0.0), bone=None, rig=None):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new("Soft bevel", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
    obj.data.materials.append(mat)
    move_to_collection(obj, collection)
    if bone and rig:
        attach_to_bone(obj, rig, bone)
    return obj


def sphere(name, location, scale, mat, collection, *, bone=None, rig=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    move_to_collection(obj, collection)
    if bone and rig:
        attach_to_bone(obj, rig, bone)
    return obj


def cylinder(name, location, radius, depth, mat, collection, *, rotation=(0.0, 0.0, 0.0), bone=None, rig=None, vertices=20):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    bevel = obj.modifiers.new("Edge bevel", "BEVEL")
    bevel.width = min(radius * 0.22, 0.035)
    bevel.segments = 2
    move_to_collection(obj, collection)
    if bone and rig:
        attach_to_bone(obj, rig, bone)
    return obj


def cone(name, location, radius1, radius2, depth, mat, collection, *, rotation=(0.0, 0.0, 0.0), bone=None, rig=None):
    bpy.ops.mesh.primitive_cone_add(vertices=20, radius1=radius1, radius2=radius2, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    move_to_collection(obj, collection)
    if bone and rig:
        attach_to_bone(obj, rig, bone)
    return obj


def create_rig():
    armature = bpy.data.armatures.new("HMH_CommandoConceptRig")
    rig = bpy.data.objects.new("HMH_CommandoConceptRig", armature)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bones = {
        "root": ((0, 0, 0), (0, 0, 0.35), None),
        "pelvis": ((0, 0, 0.68), (0, 0, 0.98), "root"),
        "spine": ((0, 0, 0.98), (0, 0, 1.38), "pelvis"),
        "chest": ((0, 0, 1.28), (0, 0, 1.58), "spine"),
        "head": ((0, 0, 1.55), (0, 0, 1.92), "chest"),
        "upper_arm.L": ((-0.2, 0, 1.43), (-0.55, 0, 1.25), "chest"),
        "forearm.L": ((-0.55, 0, 1.25), (-0.75, -0.04, 1.08), "upper_arm.L"),
        "upper_arm.R": ((0.2, 0, 1.43), (0.55, 0, 1.25), "chest"),
        "forearm.R": ((0.55, 0, 1.25), (0.74, -0.04, 1.08), "upper_arm.R"),
        "thigh.L": ((-0.13, 0, 0.78), (-0.16, 0, 0.38), "pelvis"),
        "shin.L": ((-0.16, 0, 0.38), (-0.17, -0.05, 0.06), "thigh.L"),
        "thigh.R": ((0.13, 0, 0.78), (0.16, 0, 0.38), "pelvis"),
        "shin.R": ((0.16, 0, 0.38), (0.17, -0.05, 0.06), "thigh.R"),
        "weapon_socket": ((0.34, -0.18, 1.26), (0.34, -0.6, 1.26), "chest"),
    }
    for name, (head, tail, parent) in bones.items():
        bone = armature.edit_bones.new(name)
        bone.head = head
        bone.tail = tail
        if parent:
            bone.parent = armature.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.hide_render = True
    return rig


def create_shadow(collection, mats):
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.56, depth=0.012, location=(0, 0, 0.012))
    shadow = bpy.context.object
    shadow.name = f"{collection.name}_GroundShadow"
    shadow.scale.y = 0.58
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    shadow.data.materials.append(mats["shadow"])
    move_to_collection(shadow, collection)
    return shadow


def add_rifle(collection, rig, mats, accent, actor_id, variant_id):
    prefix = f"{actor_id}_{variant_id}_Weapon"
    cylinder(prefix + "_Barrel", (0.0, -0.6, 1.23), 0.045, 0.72, mats["charcoal"], collection, rotation=(math.radians(90), 0, 0), bone="weapon_socket", rig=rig)
    cube(prefix + "_Receiver", (0.0, -0.25, 1.23), (0.105, 0.18, 0.10), mats["silver_dark"], collection, bevel=0.035, bone="weapon_socket", rig=rig)
    cube(prefix + "_Energy", (0.0, -0.34, 1.29), (0.065, 0.09, 0.035), accent, collection, bevel=0.02, bone="weapon_socket", rig=rig)
    cube(prefix + "_Stock", (0.0, 0.02, 1.21), (0.085, 0.14, 0.07), mats["blue"], collection, bevel=0.03, bone="weapon_socket", rig=rig)


def add_base_body(collection, rig, mats, actor_id, variant_id, *, female=False):
    prefix = f"{actor_id}_{variant_id}"
    armor = mats["teal"] if female else mats["blue"]
    accent = mats["teal_light"] if female else mats["cyan"]
    torso_width = 0.27 if female else 0.34
    shoulder_width = 0.30 if female else 0.39
    hip_width = 0.26 if female else 0.29

    create_shadow(collection, mats)
    cube(prefix + "_Pelvis", (0, 0, 0.78), (hip_width, 0.19, 0.16), mats["charcoal"], collection, bevel=0.08, bone="pelvis", rig=rig)
    cube(prefix + "_TorsoSuit", (0, 0, 1.18), (torso_width, 0.20, 0.34), mats["charcoal"], collection, bevel=0.10, bone="spine", rig=rig)
    cube(prefix + "_ChestPlate", (0, -0.12, 1.28), (torso_width * 0.92, 0.10, 0.23), armor, collection, bevel=0.075, bone="chest", rig=rig)
    cube(prefix + "_ChestStripe", (0, -0.235, 1.28), (0.075, 0.018, 0.18), accent, collection, bevel=0.02, bone="chest", rig=rig)
    cylinder(prefix + "_Neck", (0, 0, 1.57), 0.10, 0.14, mats["skin"], collection, bone="head", rig=rig)
    sphere(prefix + "_Head", (0, 0, 1.76), (0.20, 0.18, 0.23), mats["skin"], collection, bone="head", rig=rig)

    for side, sign in (("L", -1), ("R", 1)):
        cube(prefix + f"_Shoulder_{side}", (sign * shoulder_width, 0, 1.43), (0.14, 0.18, 0.14), armor, collection, bevel=0.075, bone=f"upper_arm.{side}", rig=rig)
        cylinder(prefix + f"_UpperArm_{side}", (sign * 0.43, 0, 1.24), 0.105, 0.38, mats["charcoal"], collection, rotation=(0, math.radians(18), 0), bone=f"upper_arm.{side}", rig=rig)
        cube(prefix + f"_Forearm_{side}", (sign * 0.50, -0.04, 1.02), (0.105, 0.12, 0.20), mats["silver"], collection, bevel=0.065, bone=f"forearm.{side}", rig=rig)
        sphere(prefix + f"_Hand_{side}", (sign * 0.46, -0.14, 0.91), (0.10, 0.10, 0.10), mats["skin"], collection, bone=f"forearm.{side}", rig=rig)
        cylinder(prefix + f"_Thigh_{side}", (sign * 0.16, 0, 0.54), 0.135, 0.43, mats["charcoal"], collection, bone=f"thigh.{side}", rig=rig)
        cube(prefix + f"_Knee_{side}", (sign * 0.16, -0.06, 0.34), (0.14, 0.13, 0.12), armor, collection, bevel=0.055, bone=f"shin.{side}", rig=rig)
        cylinder(prefix + f"_Shin_{side}", (sign * 0.16, 0, 0.18), 0.12, 0.30, mats["silver_dark"], collection, bone=f"shin.{side}", rig=rig)
        cube(prefix + f"_Boot_{side}", (sign * 0.16, -0.09, 0.065), (0.14, 0.22, 0.075), mats["charcoal"], collection, bevel=0.045, bone=f"shin.{side}", rig=rig)

    if female:
        sphere(prefix + "_HairCap", (0, 0.055, 1.85), (0.215, 0.19, 0.16), mats["teal"], collection, bone="head", rig=rig)
        cube(prefix + "_ShortHair", (-0.13, 0.09, 1.68), (0.13, 0.10, 0.20), mats["teal"], collection, bevel=0.10, rotation=(0.0, math.radians(-12), math.radians(-15)), bone="head", rig=rig)
        cube(prefix + "_TempleGuard", (0.16, -0.10, 1.78), (0.055, 0.065, 0.12), mats["silver"], collection, bevel=0.025, bone="head", rig=rig)
    else:
        sphere(prefix + "_Helmet", (0, 0.025, 1.79), (0.22, 0.20, 0.24), mats["silver"], collection, bone="head", rig=rig)
        cube(prefix + "_Visor", (0, -0.19, 1.79), (0.16, 0.035, 0.07), mats["cyan"], collection, bevel=0.035, bone="head", rig=rig)

    add_rifle(collection, rig, mats, accent, actor_id, variant_id)
    return armor, accent


def add_variant_details(collection, rig, mats, actor_id, variant_id, *, female=False):
    armor, accent = add_base_body(collection, rig, mats, actor_id, variant_id, female=female)
    prefix = f"{actor_id}_{variant_id}"
    if variant_id == "reserve-vanguard":
        for side, sign in (("L", -1), ("R", 1)):
            sphere(prefix + f"_HeavyPauldron_{side}", (sign * 0.43, 0, 1.48), (0.20, 0.22, 0.16), mats["silver"], collection, bone=f"upper_arm.{side}", rig=rig)
        cube(prefix + "_ScarfFront", (0.0, -0.22, 1.49), (0.17, 0.04, 0.055), mats["orange"], collection, bevel=0.035, bone="chest", rig=rig)
        cube(prefix + "_ScarfTail", (-0.19, 0.08, 1.39), (0.055, 0.18, 0.05), mats["orange"], collection, bevel=0.025, rotation=(math.radians(15), 0, math.radians(-20)), bone="chest", rig=rig)
    elif variant_id == "hashstorm-breacher":
        sphere(prefix + "_HeavyPauldron_R", (0.45, 0, 1.48), (0.24, 0.24, 0.19), mats["silver_dark"], collection, bone="upper_arm.R", rig=rig)
        for x in (-0.12, 0.0, 0.12):
            cube(prefix + f"_ChestCell_{x}", (x, -0.25, 1.25), (0.045, 0.035, 0.12), mats["cyan"], collection, bevel=0.015, bone="chest", rig=rig)
        cube(prefix + "_ForearmGuard", (-0.53, -0.05, 1.04), (0.15, 0.15, 0.22), mats["blue"], collection, bevel=0.07, bone="forearm.L", rig=rig)
    elif variant_id == "frontier-ranger":
        cube(prefix + "_Collar", (0, 0.03, 1.52), (0.28, 0.17, 0.11), mats["silver_dark"], collection, bevel=0.055, bone="chest", rig=rig)
        for side, sign in (("L", -1), ("R", 1)):
            cube(prefix + f"_CoatPanel_{side}", (sign * 0.17, 0.10, 0.66), (0.14, 0.05, 0.30), mats["charcoal"], collection, bevel=0.045, rotation=(math.radians(-5), 0, math.radians(sign * 3)), bone="pelvis", rig=rig)
        sphere(prefix + "_BluePauldron", (-0.41, 0, 1.47), (0.19, 0.21, 0.15), mats["blue"], collection, bone="upper_arm.L", rig=rig)
    elif variant_id == "plasma-striker":
        for side, sign in (("L", -1), ("R", 1)):
            cube(prefix + f"_AngledPauldron_{side}", (sign * 0.34, -0.01, 1.47), (0.16, 0.18, 0.075), mats["silver"], collection, bevel=0.05, rotation=(0, math.radians(sign * 18), math.radians(sign * 18)), bone=f"upper_arm.{side}", rig=rig)
        cube(prefix + "_HipPlate", (0.29, -0.04, 0.78), (0.09, 0.16, 0.20), mats["teal"], collection, bevel=0.055, bone="pelvis", rig=rig)
        cube(prefix + "_EnergyBelt", (0, -0.21, 0.87), (0.23, 0.035, 0.045), mats["teal_light"], collection, bevel=0.018, bone="pelvis", rig=rig)
    elif variant_id == "circuit-valkyrie":
        cone(prefix + "_HairCrest", (0, 0.10, 2.04), 0.13, 0.015, 0.35, mats["teal"], collection, rotation=(0, math.radians(-12), 0), bone="head", rig=rig)
        for side, sign in (("L", -1), ("R", 1)):
            cone(prefix + f"_WingFin_{side}", (sign * 0.40, 0.03, 1.51), 0.14, 0.01, 0.38, mats["silver"], collection, rotation=(0, math.radians(sign * 58), 0), bone=f"upper_arm.{side}", rig=rig)
        for x in (-0.12, 0, 0.12):
            cube(prefix + f"_GoldCircuit_{x}", (x, -0.23, 1.25), (0.028, 0.018, 0.13), mats["gold"], collection, bevel=0.01, bone="chest", rig=rig)
    elif variant_id == "aurora-scout":
        cube(prefix + "_VisorCrown", (0, -0.14, 1.91), (0.18, 0.07, 0.075), mats["blue"], collection, bevel=0.04, rotation=(math.radians(-8), 0, 0), bone="head", rig=rig)
        cube(prefix + "_VisorGlow", (0, -0.21, 1.89), (0.13, 0.022, 0.035), mats["teal_light"], collection, bevel=0.018, bone="head", rig=rig)
        for side, sign in (("L", -1), ("R", 1)):
            cone(prefix + f"_ForearmFin_{side}", (sign * 0.57, -0.02, 1.02), 0.09, 0.01, 0.30, mats["teal"], collection, rotation=(0, math.radians(sign * 48), 0), bone=f"forearm.{side}", rig=rig)


def configure_scene(manifest):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = manifest["render"]["engine"]
    scene.render.resolution_x = manifest["render"]["frameSize"][0]
    scene.render.resolution_y = manifest["render"]["frameSize"][1]
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = manifest["render"]["transparentFilm"]
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 100
    scene.render.resolution_percentage = 100
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = -0.45

    world = bpy.data.worlds.new("HMH Concept World")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.015, 0.02, 0.05, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.22
    scene.world = world

    camera_data = bpy.data.cameras.new("HMH_ConceptCamera")
    camera = bpy.data.objects.new("HMH_ConceptCamera", camera_data)
    scene.collection.objects.link(camera)
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 2.75
    camera.location = (3.6, -3.6, 4.2)
    camera.rotation_euler = (Vector((0, 0, 1.0)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera

    _placement = {
        "key": ((2.5, -3.2, 4.8), 3.0),
        "fill": ((-3.5, -1.0, 3.0), 2.6),
        "rim": ((2.0, 3.5, 4.0), 2.2),
    }
    lights = [
        (
            channel.capitalize(), "AREA", _placement[channel][0],
            energy, color, _placement[channel][1],
        )
        for channel, color, energy in shared_light_channels("hero")
    ]
    for name, light_type, location, energy, color, size in lights:
        light_data = bpy.data.lights.new(name, light_type)
        light_data.energy = energy
        light_data.color = color
        light_data.shape = "DISK"
        light_data.size = size
        light = bpy.data.objects.new(name, light_data)
        scene.collection.objects.link(light)
        light.location = location
        light.rotation_euler = (Vector((0, 0, 1.1)) - light.location).to_track_quat("-Z", "Y").to_euler()

    palette = manifest["palette"]
    mats = {
        "blue": material("Litecoin Blue", palette["litecoinBlue"], metallic=0.55),
        "blue_light": material("Litecoin Light", palette["litecoinLight"], metallic=0.35),
        "cyan": material("Cyan Energy", palette["cyan"], emission=0.45),
        "silver": material("Silver Armor", palette["silver"], metallic=0.78),
        "silver_dark": material("Dark Silver", palette["silverDark"], metallic=0.62),
        "charcoal": material("Charcoal Suit", palette["charcoal"]),
        "teal": material("Teal Plasma Armor", palette["teal"], metallic=0.48),
        "teal_light": material("Teal Energy", palette["tealLight"], emission=0.42),
        "gold": material("Gold Circuit", palette["gold"], metallic=0.65),
        "orange": material("Command Orange", palette["orange"]),
        "skin": material("Skin", palette["skin"]),
        "shadow": material("Ground Shadow", palette["shadow"], alpha=0.18),
    }
    return scene, mats


def external_dependencies():
    paths = []
    for datablock in list(bpy.data.images) + list(bpy.data.movieclips) + list(bpy.data.sounds) + list(bpy.data.fonts):
        filepath = getattr(datablock, "filepath", "")
        # Blender exposes some packed images through packed_files only.
        packed = getattr(datablock, "packed_file", None) or getattr(datablock, "packed_files", None)
        if filepath and filepath != "<builtin>" and not packed:
            paths.append(filepath)
    for library in bpy.data.libraries:
        if library.filepath:
            paths.append(library.filepath)
    return sorted(set(paths))


def main():
    args = blender_args()
    manifest_path = Path(args.manifest).resolve()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    raw_output = Path(args.raw_output).resolve()
    source_blend = Path(args.source_blend).resolve()
    inspection_output = Path(args.inspection_output).resolve()
    raw_output.mkdir(parents=True, exist_ok=True)
    source_blend.parent.mkdir(parents=True, exist_ok=True)
    inspection_output.parent.mkdir(parents=True, exist_ok=True)

    scene, mats = configure_scene(manifest)
    rig = create_rig()
    concepts = []
    for actor in manifest["actors"]:
        for variant in actor["variants"]:
            collection = bpy.data.collections.new(f"Concept__{actor['id']}__{variant['id']}")
            scene.collection.children.link(collection)
            add_variant_details(collection, rig, mats, actor["id"], variant["id"], female=actor["id"] == "lit-valkyrie")
            concepts.append((actor, variant, collection))

    for _actor, _variant, collection in concepts:
        collection.hide_render = True
    bpy.ops.wm.save_as_mainfile(filepath=str(source_blend), compress=True)

    render_count = 0
    for actor, variant, collection in concepts:
        collection.hide_render = False
        for direction in manifest["directions"]:
            rig.rotation_euler[2] = math.radians(manifest["directionAngles"][direction])
            scene.render.filepath = str(raw_output / f"{actor['id']}__{variant['id']}__{direction}.png")
            bpy.ops.render.render(write_still=True)
            render_count += 1
        collection.hide_render = True
    rig.rotation_euler[2] = 0

    dependencies = external_dependencies()
    inspection = {
        "schema": "hmh-reboot-commando-concept-inspection-v1",
        "renderCount": render_count,
        "armature": rig.name,
        "bones": sorted(bone.name for bone in rig.data.bones),
        "weaponSocket": "weapon_socket" in rig.data.bones,
        "externalDependencies": dependencies,
        "externalDependencyCount": len(dependencies),
    }
    inspection_output.write_bytes((json.dumps(inspection, indent=2) + "\n").encode("utf-8"))
    print(json.dumps(inspection))


if __name__ == "__main__":
    main()

"""Re-import the exported GLB and measure actual skinned poses, not metadata.

Optional preview is an offline model inspection, never a game screenshot.
"""
import argparse
import importlib.util
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).parent))
module_spec = importlib.util.spec_from_file_location("pilot_exporter", Path(__file__).with_name("export-hmh-actor-glb-pilot.py"))
exporter = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(exporter)


def activate_clip(clip):
    ranges = []
    for obj in bpy.data.objects:
        adt = obj.animation_data
        if not adt:
            continue
        adt.action = None
        for track in adt.nla_tracks:
            matches = track.name == clip
            track.mute = not matches
            if matches:
                for strip in track.strips:
                    ranges.append((strip.frame_start, strip.frame_end))
    if not ranges:
        raise RuntimeError("Imported clip has no actual NLA track: " + clip)
    return min(start for start, end in ranges), max(end for start, end in ranges)


def geometry_points(meshes):
    points = []
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in meshes:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        try:
            points.extend(tuple(evaluated.matrix_world @ vertex.co) for vertex in mesh.vertices)
        finally:
            evaluated.to_mesh_clear()
    return points


def shape_change(first, current):
    if not first or len(first) != len(current):
        raise RuntimeError("Reimported animated geometry vertex correspondence changed")
    centre_first = [sum(point[axis] for point in first) / len(first) for axis in range(3)]
    centre_current = [sum(point[axis] for point in current) / len(current) for axis in range(3)]
    return max(math.sqrt(sum(((point[axis] - centre_current[axis]) - (base[axis] - centre_first[axis])) ** 2
                             for axis in range(3))) for base, point in zip(first, current))


def render_preview(output, actor_id):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = scene.render.resolution_y = 768
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.world = bpy.data.worlds.new("Pilot inspection world")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (.015, .02, .05, 1)
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = .22
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = -.45
    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 2.75 if actor_id in {"lit-commando", "lilly", "lit-valkyrie", "lester-original"} else 2.35
    target = Vector((0, 0, 1 if actor_id in {"lit-commando", "lilly", "lit-valkyrie", "lester-original"} else .86))
    camera.location = Vector((2.828427, -2.828427, target.z + 4 / math.tan(math.radians(55))))
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera
    for name, position, energy, color, size in [
        ("key", (3, -4, 6), 650, (1, .88, .75), 3),
        ("fill", (-4, -2, 3), 330, (.65, .8, 1), 2.6),
        ("rim", (2, 3, 5), 500, (1, .82, .64), 2.2),
    ]:
        bpy.ops.object.light_add(type="AREA", location=position)
        light = bpy.context.object
        light.name = "Pilot inspection " + name
        light.data.energy = energy
        light.data.color = color
        light.data.shape = "DISK"
        light.data.size = size
        light.rotation_euler = (target - light.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--actor", choices=list(exporter.ACTORS), required=True)
    parser.add_argument("--output-prefix", required=True)
    parser.add_argument("--preview", action="store_true")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    output = exporter.validate_pilot_output(ROOT, args.actor, "verify", args.output_prefix)
    output.parent.mkdir(parents=True, exist_ok=True)
    source = ROOT / "apps/portal/assets/generated/hmh-actor-3d-pilot" / (args.actor + ".glb")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
    # The glTF importer creates a hidden BoneShape mesh for rig handles. It is
    # editor scaffolding, never actor geometry or part of foot measurements.
    meshes = [obj for obj in bpy.data.objects if obj.type == "MESH"
              and any(mod.type == "ARMATURE" for mod in obj.modifiers)]
    rigs = [obj for obj in bpy.data.objects if obj.type == "ARMATURE"]
    scene = bpy.context.scene
    clips = []
    for clip in exporter.ACTORS[args.actor]["clips"]:
        start, end = activate_clip(clip)
        samples = []
        first_points = None
        max_shape_change = 0
        for fraction in [0, .25, .5, .75, 1]:
            frame = start + (end - start) * fraction
            scene.frame_set(int(frame), subframe=frame % 1)
            samples.append({"frame": frame, **exporter.evaluated_bounds(meshes)})
            if args.actor == "the-liquidator":
                points = geometry_points(meshes)
                if first_points is None:
                    first_points = points
                max_shape_change = max(max_shape_change, shape_change(first_points, points))
                body = [obj for obj in meshes if obj.get("hmh_native_body")]
                if not body:
                    raise RuntimeError("Reimported native boss body identity missing")
                samples[-1]["nativeBodyMinimumZ"] = exporter.evaluated_bounds(body)["min"][2]
                if abs(samples[-1]["nativeBodyMinimumZ"]) > .0002:
                    raise RuntimeError("Reimported native boss foot grounding failed: " + clip)
        minimums = [sample["min"][2] for sample in samples]
        if args.actor == "bagholder-rusher" and max(abs(value) for value in minimums) > .0002:
            raise RuntimeError("Re-imported native foot grounding failed: " + clip + " " + str(minimums))
        record = {"name": clip, "samples": samples, "minimumWorldZ": min(minimums), "maximumMinimumWorldZ": max(minimums)}
        if args.actor == "the-liquidator":
            record["maxShapeChangeAfterCentroidTranslationMetres"] = max_shape_change
        clips.append(record)
    receipt = {"schema": 1, "actorId": args.actor, "glbSha256": exporter.digest(source),
               "verification": "offline-Blender-reimport-not-runtime", "cameraDegreesFromVertical": 55,
               "meshes": len(meshes), "bones": sum(len(rig.data.bones) for rig in rigs), "clips": clips}
    output.with_suffix(".json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    if args.preview:
        start, end = activate_clip("idle")
        scene.frame_set(int(start))
        render_preview(output.with_suffix(".png"), args.actor)
    print("HMH_ACTOR_REIMPORT_RECEIPT=" + str(output.with_suffix(".json")))


if __name__ == "__main__":
    main()

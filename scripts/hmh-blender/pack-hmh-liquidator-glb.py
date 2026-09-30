"""One source-preserving opening-boss pack and native 512px material bake.

No saved source, runtime loader extension, actor scale or gameplay change.
Geometry reference is the optimized copy before UV packing, not dense-source
decimation fidelity. The external runner owns the process-tree deadline.
"""
import argparse
import gzip
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts/lib"))
from hmh_actor_boss_pack_paths import validate_boss_pack_output, select_boss_pack_mode
from hmh_actor_rendered_reference import rendered_triangle_record, assert_triangle_corner_equivalence
from hmh_actor_exact_costume import copy_input, rebuild_exact_costume, optimized_body_identity
from hmh_actor_export_state import run_export_restoring_state, capture_native_rest_pose


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


pilot = module("boss_pack_pilot", Path(__file__).with_name("export-hmh-actor-glb-pilot.py"))
verifier = module("boss_pack_preview", Path(__file__).with_name("verify-hmh-actor-glb-pilot.py"))
ACTOR = "the-liquidator"
SPEC = pilot.ACTORS[ACTOR]
LANE = ROOT / ".tmp/hmh-actor-3d-pilot/r2b"
EXACT_OUTPUT_MODE = "exact-"
PROTECTED = [SPEC["source"], "apps/portal/assets/generated/hmh-actor-3d-pilot/the-liquidator.glb",
             "apps/portal/assets/generated/hmh-actor-3d-pilot/the-liquidator-manifest.json",
             "apps/portal/assets/generated/hmh-actor-3d-pilot/lit-commando.glb",
             "apps/portal/assets/generated/hmh-actor-3d-pilot/bagholder-rusher.glb",
             "apps/portal/assets/generated/hmh-actor-3d-pilot/manifest.json",
             "apps/hmh-reboot/src/main.mjs", "apps/hmh-reboot/src/actor-3d-model.mjs",
             "apps/hmh-reboot/src/actor-3d-controller.mjs", "apps/hmh-reboot/src/actor-3d-pixi.mjs"]

EXACT_PROTECTED = [
    'apps/hmh-reboot/assets/source/models/native-enemies/the-liquidator/the-liquidator.blend',
    'apps/portal/assets/generated/hmh-actor-3d-pilot/the-liquidator.glb',
    'apps/portal/assets/generated/hmh-actor-3d-pilot/the-liquidator-manifest.json',
    'apps/portal/assets/generated/hmh-actor-3d-pilot/lit-commando.glb',
    'apps/portal/assets/generated/hmh-actor-3d-pilot/bagholder-rusher.glb',
    'apps/portal/assets/generated/hmh-actor-3d-pilot/manifest.json',
    'apps/hmh-reboot/src/main.mjs',
    'apps/hmh-reboot/src/actor-3d-model.mjs',
    'apps/hmh-reboot/src/actor-3d-controller.mjs',
    'apps/hmh-reboot/src/actor-3d-pixi.mjs',
    'apps/portal/assets/generated/hmh-actor-3d-pilot/the-liquidator-packed.glb',
    '.tmp/hmh-actor-3d-pilot/r2b/optimized-prepack-reference.json.gz',
    'docs/2.0/receipts/actor-3d-r2b-failed-attempt.json',
    'docs/2.0/receipts/actor-3d-r2b-failed-metadata.json',
    'docs/2.0/receipts/actor-3d-r2b-failed-reimport.json',
    'docs/2.0/receipts/actor-3d-r2b-idle-cloud-diagnosis.json',
    'docs/2.0/receipts/actor-3d-r2b-current-source-inspection.json',
    'docs/2.0/receipts/actor-3d-r2b-source-inspection-window.json',
    'docs/2.0/receipts/actor-3d-r2b-rendered-failed-attempt.json',
    'docs/2.0/receipts/actor-3d-r2b-rendered-failed-producer.json',
    '.tmp/hmh-actor-3d-pilot/r2b-rendered/rendered-prepack-reference.json.gz',
    '.tmp/hmh-actor-3d-pilot/r2b-rendered/the-liquidator-packed-export.json',
    'docs/2.0/receipts/actor-3d-r2b-exact-topology-failed-window.json',
    'docs/2.0/receipts/actor-3d-r2b-exact-topology-failed-native.json',
    '.tmp/hmh-actor-3d-pilot/character-r2b-exact-topology-7ebc8dda00a44f6898344a7936973144/window.json',
    '.tmp/hmh-actor-3d-pilot/r2b-exact-topology/receipt.json',
    '.tmp/hmh-actor-3d-pilot/r2b-exact-topology/before-corners.json.gz',
    '.tmp/hmh-actor-3d-pilot/r2b-exact-topology/after-corners.json.gz',
    '.tmp/hmh-actor-3d-pilot/r2b-exact-topology/copy-plan.json.gz',
    '.tmp/hmh-actor-3d-pilot/r2b-exact-topology/legacy-before-corners.json.gz',
    '.tmp/hmh-actor-3d-pilot/r2b-exact-topology/legacy-after-corners.json.gz',
    'docs/2.0/receipts/actor-3d-r2b-groups-failed-window.json',
    'docs/2.0/receipts/actor-3d-r2b-groups-failed-native.json',
    'docs/2.0/receipts/actor-3d-r2b-groups-failed-normal-analysis.json',
    '.tmp/hmh-actor-3d-pilot/character-r2b-exact-topology-groups-f435ff0825d0469f89f8a8aee4b674f8/window.json',
    '.tmp/hmh-actor-3d-pilot/r2b-exact-topology-groups/receipt.json',
    '.tmp/hmh-actor-3d-pilot/r2b-exact-topology-groups/before-corners.json.gz',
    '.tmp/hmh-actor-3d-pilot/r2b-exact-topology-groups/after-corners.json.gz',
    '.tmp/hmh-actor-3d-pilot/r2b-exact-topology-groups/copy-plan.json.gz',
    '.tmp/hmh-actor-3d-pilot/r2b-exact-topology-groups/legacy-before-corners.json.gz',
    '.tmp/hmh-actor-3d-pilot/r2b-exact-topology-groups/legacy-after-corners.json.gz',
    'docs/2.0/receipts/actor-3d-r2b-exact-normals-window.json',
    'docs/2.0/receipts/actor-3d-r2b-exact-normals-native.json',
    '.tmp/hmh-actor-3d-pilot/r2b-exact-topology-normals/receipt.json',
    '.tmp/hmh-actor-3d-pilot/r2b-exact-topology-normals/before-corners.json.gz',
    '.tmp/hmh-actor-3d-pilot/r2b-exact-topology-normals/after-corners.json.gz',
    '.tmp/hmh-actor-3d-pilot/r2b-exact-topology-normals/copy-plan.json.gz',
    '.tmp/hmh-actor-3d-pilot/r2b-exact-topology-normals/legacy-before-corners.json.gz',
    '.tmp/hmh-actor-3d-pilot/r2b-exact-topology-normals/legacy-after-corners.json.gz',
]


def hashes():
    return {name: pilot.digest(ROOT / name) for name in PROTECTED}


def selected(objects):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.hide_set(False)
        obj.hide_viewport = False
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]


def apply_geometry(rig, meshes):
    records = []
    rig.data.pose_position = "REST"
    bpy.context.view_layer.update()
    for obj in meshes:
        selected([obj])
        applied = []
        for modifier in list(obj.modifiers):
            if modifier.type == "ARMATURE":
                continue
            if modifier.type not in {"SOLIDIFY", "BEVEL", "SUBSURF"}:
                raise RuntimeError("Unreviewed native modifier: " + obj.name + "/" + modifier.type)
            kind, name = modifier.type, modifier.name
            bpy.ops.object.modifier_apply(modifier=name)
            applied.append({"name": name, "type": kind})
        records.append({"mesh": obj.name, "applied": applied})
    return records


def activate(clip):
    verifier.activate_clip(clip)


def point_record(obj):
    points = verifier.geometry_points([obj])
    return {"name": obj.name, "rigidGear": bool(obj.get("hmh_role_gear")), "points": points}


def reference(meshes):
    records = []
    for clip in SPEC["clips"]:
        start, end = verifier.activate_clip(clip)
        samples = []
        for fraction in [0, .25, .5, .75, 1]:
            frame = start + (end - start) * fraction
            bpy.context.scene.frame_set(int(frame), subframe=frame % 1)
            components = [point_record(obj) for obj in meshes]
            geometry_hash = hashlib.sha256(json.dumps(components, separators=(",", ":"), allow_nan=False).encode()).hexdigest()
            body = next(obj for obj in meshes if obj.get("hmh_primary_skinned_body"))
            samples.append({"fraction": fraction, "frame": frame, "components": components,
                            "geometrySha256": geometry_hash,
                            "nativeBodyMinimumZ": pilot.evaluated_bounds([body])["min"][2]})
        records.append({"name": clip, "samples": samples})
    record = {"sourceSha256": SPEC["sha256"], "referenceKind": "optimized-bind-copy-before-packing", "clips": records}
    output = LANE / "optimized-prepack-reference.json.gz"
    output.write_bytes(gzip.compress(json.dumps(record, separators=(",", ":"), allow_nan=False).encode(), mtime=0))
    return {"path": output.relative_to(ROOT).as_posix(), "sha256": pilot.digest(output)}


def rendered_point_record(obj):
    evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    try:
        mesh.calc_loop_triangles()
        points = [list(evaluated.matrix_world @ vertex.co) for vertex in mesh.vertices]
        record = rendered_triangle_record(points, [list(triangle.vertices) for triangle in mesh.loop_triangles])
        return {"name": obj.name, "rigidGear": bool(obj.get("hmh_role_gear")), **record}
    finally:
        evaluated.to_mesh_clear()


def rendered_reference(meshes):
    records = []
    for clip in SPEC["clips"]:
        start, end = verifier.activate_clip(clip)
        samples = []
        for fraction in [0, .25, .5, .75, 1]:
            frame = start + (end - start) * fraction
            bpy.context.scene.frame_set(int(frame), subframe=frame % 1)
            components = [rendered_point_record(obj) for obj in meshes]
            geometry_hash = hashlib.sha256(json.dumps(components, separators=(",", ":"), allow_nan=False).encode()).hexdigest()
            body = next(obj for obj in meshes if obj.get("hmh_primary_skinned_body"))
            samples.append({"fraction": fraction, "frame": frame, "components": components,
                            "geometrySha256": geometry_hash, "nativeBodyMinimumZ": pilot.evaluated_bounds([body])["min"][2]})
        records.append({"name": clip, "samples": samples})
    record = {"sourceSha256": SPEC["sha256"], "referenceKind": "optimized-rendered-triangle-copy-before-packing",
              "membershipRule": "all and only evaluated loop-triangle vertex indices; no distance filtering",
              "clips": records}
    output = LANE / "rendered-prepack-reference.json.gz"
    output.write_bytes(gzip.compress(json.dumps(record, separators=(",", ":"), allow_nan=False).encode(), mtime=0))
    return {"path": output.relative_to(ROOT).as_posix(), "sha256": pilot.digest(output)}


def triangle_corners(obj):
    mesh = obj.data
    mesh.calc_loop_triangles()
    uv = mesh.uv_layers.active
    if uv is None:
        raise RuntimeError("Actual export costume atlas missing before triangulation")
    triangles = []
    for triangle in mesh.loop_triangles:
        corners = []
        for loop_id in triangle.loops:
            vertex = mesh.vertices[mesh.loops[loop_id].vertex_index]
            corners.append({"vertexId": vertex.index, "position": list(obj.matrix_world @ vertex.co),
                            "uv": list(uv.data[loop_id].uv), "normal": list(mesh.corner_normals[loop_id].vector),
                            "weights": [[obj.vertex_groups[group.group].name, group.weight] for group in vertex.groups if group.weight > 0]})
        triangles.append(corners)
    return triangles


def triangulate_export_costume(obj):
    # This is the joined unsaved export copy, after the original per-object
    # material bake. Never modify the source body or the saved .blend.
    if obj.name != "Liquidator Packed Costume" or obj.get("hmh_primary_skinned_body") or obj.get("hmh_native_body"):
        raise RuntimeError("Triangulation is restricted to the joined export costume")
    before = triangle_corners(obj)
    selected([obj])
    modifier = obj.modifiers.new("R2b Rendered Export Triangles", "TRIANGULATE")
    modifier.quad_method = "BEAUTY"
    modifier.ngon_method = "BEAUTY"
    modifier.min_vertices = 4
    preserve_option = hasattr(modifier, "keep_custom_normals")
    if preserve_option:
        modifier.keep_custom_normals = True
    # Apply topology in bind coordinates, never bake the live armature into
    # vertex positions by applying a modifier below it in the stack.
    while obj.modifiers[0] != modifier:
        bpy.ops.object.modifier_move_up(modifier=modifier.name)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    after = triangle_corners(obj)
    proof = assert_triangle_corner_equivalence(before, after)
    if any(len(polygon.vertices) != 3 for polygon in obj.data.polygons):
        raise RuntimeError("Export costume still contains non-triangle polygons")
    return {"mesh": obj.name, "scope": "joined unsaved export costume only; source body untouched",
            "keepCustomNormalsOptionAvailable": preserve_option, **proof}


def raw_exact_array(kind, value):
    names = {"before": "before-corners.json.gz", "after": "after-corners.json.gz", "plan": "copy-plan.json.gz"}
    path = validate_boss_pack_output(ROOT, EXACT_OUTPUT_MODE + kind, LANE / names[kind])
    if path.exists():
        raise RuntimeError("Never overwrite an exact export witness")
    path.write_bytes(gzip.compress(json.dumps(value, separators=(",", ":"), allow_nan=False).encode(), mtime=0))
    return {"path": path.relative_to(ROOT).as_posix(), "bytes": path.stat().st_size, "sha256": pilot.digest(path)}


def prepare_export_costume(obj, rendered, exact, receipt):
    if exact and not rendered:
        raise RuntimeError("Exact costume copy requires the separately bound rendered reference")
    if not rendered:
        return
    if not exact:
        receipt["exportCostumeTriangulation"] = triangulate_export_costume(obj)
        return
    proof = {"mesh": obj.name, "exactMeshCopy": True,
             "scope": "joined unsaved export costume only; original optimized body untouched"}
    receipt["exportCostumeTriangulation"] = proof
    before = triangle_corners(obj)
    proof["beforeCorners"] = raw_exact_array("before", before)
    plan = copy_input(obj)
    proof["copyPlan"] = raw_exact_array("plan", plan)
    after, failure = None, None
    try:
        proof["meshCopy"] = rebuild_exact_costume(obj, plan)
        after = triangle_corners(obj)
        proof.update(assert_triangle_corner_equivalence(before, after))
    except Exception as error:
        failure = error
        proof["failure"] = str(error)
        raise
    finally:
        # Retain the actual native after array even on copy/guard failure.
        # If capture also fails, record it without masking the primary error.
        try:
            if after is None:
                after = triangle_corners(obj)
            proof["afterCorners"] = raw_exact_array("after", after)
        except Exception as error:
            proof["afterCaptureFailure"] = str(error)
            if failure is None:
                raise


def material_graph(material):
    tree = material.node_tree
    return {"name": material.name,
            "nodes": [{"name": node.name, "type": node.type} for node in tree.nodes],
            "links": [{"from": link.from_node.name + "/" + link.from_socket.name,
                       "to": link.to_node.name + "/" + link.to_socket.name} for link in tree.links]}


def unwrap(costume):
    for obj in costume:
        # These five costume materials use Generated/procedural/constant
        # inputs, not source image UVs. Keep exactly one atlas UV set so the
        # bounded runtime's TEXCOORD_0 carries the actual baked material.
        for old in list(obj.data.uv_layers):
            obj.data.uv_layers.remove(old)
        layer = obj.data.uv_layers.new(name="HMH_CostumeAtlas")
        obj.data.uv_layers.active = layer
        layer.active_render = True
    selected(costume)
    bpy.ops.object.mode_set(mode="EDIT")
    try:
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=1.1519173063, island_margin=.015625, scale_to_bounds=True)
        # Explicit multi-object packing keeps the shared bake islands separate.
        bpy.ops.uv.pack_islands(margin=.015625)
    finally:
        bpy.ops.object.mode_set(mode="OBJECT")


def link_input(tree, source_input, target_input):
    if source_input.is_linked:
        tree.links.new(source_input.links[0].from_socket, target_input)
    else:
        target_input.default_value = source_input.default_value


def bake_material(original, semantic, image):
    material = original.copy()
    material.name = "R2b " + semantic + " " + original.name
    nodes, links = material.node_tree.nodes, material.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    output = next(node for node in nodes if node.type == "OUTPUT_MATERIAL" and node.is_active_output)
    target = nodes.new("ShaderNodeTexImage")
    target.image = image
    nodes.active = target
    if semantic != "normal":
        for link in list(output.inputs["Surface"].links):
            links.remove(link)
        emission = nodes.new("ShaderNodeEmission")
        if semantic == "baseColor":
            link_input(material.node_tree, bsdf.inputs["Base Color"], emission.inputs["Color"])
        elif semantic == "metallicRoughness":
            combine = nodes.new("ShaderNodeCombineColor")
            combine.mode = "RGB"
            combine.inputs[0].default_value = 1
            link_input(material.node_tree, bsdf.inputs["Roughness"], combine.inputs[1])
            link_input(material.node_tree, bsdf.inputs["Metallic"], combine.inputs[2])
            links.new(combine.outputs[0], emission.inputs["Color"])
        elif semantic == "emission":
            link_input(material.node_tree, bsdf.inputs["Emission Color"], emission.inputs["Color"])
            link_input(material.node_tree, bsdf.inputs["Emission Strength"], emission.inputs["Strength"])
        else:
            raise ValueError("Unreviewed bake semantic")
        links.new(emission.outputs[0], output.inputs["Surface"])
    return material


def bake(costume, rig):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 2
    scene.cycles.device = "CPU"
    scene.cycles.samples = 8
    rig.data.pose_position = "REST"
    # Bake before joining: Generated texture vectors still come from each
    # authored object's own frame, not the combined costume bounds.
    original_slots = {obj.name: [slot.material for slot in obj.material_slots] for obj in costume}
    originals = {material.name: material for materials in original_slots.values() for material in materials}
    graphs = {name: material_graph(material) for name, material in originals.items()}
    images = {}
    for semantic in ["baseColor", "metallicRoughness", "normal", "emission"]:
        image = bpy.data.images.new("Liquidator packed " + semantic, 512, 512, alpha=True, float_buffer=False)
        image.colorspace_settings.name = "sRGB" if semantic in {"baseColor", "emission"} else "Non-Color"
        copies = {name: bake_material(material, semantic, image) for name, material in originals.items()}
        for obj in costume:
            for slot, original in zip(obj.material_slots, original_slots[obj.name]):
                slot.material = copies[original.name]
        selected(costume)
        bpy.ops.object.bake(type="NORMAL" if semantic == "normal" else "EMIT",
                            normal_space="TANGENT", use_clear=False, margin=4)
        image.filepath_raw = str(LANE / ("costume-" + semantic + ".png"))
        image.file_format = "PNG"
        image.save()
        image.pack()
        images[semantic] = image
        for obj in costume:
            for slot, original in zip(obj.material_slots, original_slots[obj.name]):
                slot.material = original
    if graphs != {name: material_graph(material) for name, material in originals.items()}:
        raise RuntimeError("Source material graph mutated during bake")
    rig.data.pose_position = "POSE"
    return images, list(graphs.values())


def packed_material(images):
    material = bpy.data.materials.new("Liquidator Packed Native Costume")
    material.use_nodes = True
    nodes, links = material.node_tree.nodes, material.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    for semantic, image in images.items():
        texture = nodes.new("ShaderNodeTexImage")
        texture.image = image
        if semantic == "baseColor":
            links.new(texture.outputs["Color"], bsdf.inputs["Base Color"])
        elif semantic == "metallicRoughness":
            split = nodes.new("ShaderNodeSeparateColor")
            split.mode = "RGB"
            links.new(texture.outputs["Color"], split.inputs[0])
            links.new(split.outputs[1], bsdf.inputs["Roughness"])
            links.new(split.outputs[2], bsdf.inputs["Metallic"])
        elif semantic == "normal":
            normal = nodes.new("ShaderNodeNormalMap")
            links.new(texture.outputs["Color"], normal.inputs["Color"])
            links.new(normal.outputs["Normal"], bsdf.inputs["Normal"])
        elif semantic == "emission":
            links.new(texture.outputs["Color"], bsdf.inputs["Emission Color"])
            bsdf.inputs["Emission Strength"].default_value = 1
    return material


def preview(output):
    # All three offline comparisons use one identical inspection light rig.
    for obj in list(bpy.data.objects):
        if obj.type in {"LIGHT", "CAMERA"}:
            bpy.data.objects.remove(obj, do_unlink=True)
    verifier.render_preview(output, ACTOR)


def perform_packed_export(body, rig, root, combined, args, output, receipt):
    def export():
        prepare_export_costume(combined, args.rendered_triangles, args.exact_triangles, receipt)
        rig.data.pose_position = "POSE"
        # Export the same muted NLA clip set as R0/R2a, with real UV tangents.
        for obj in [rig, root]:
            obj.animation_data.action = None
            for track in obj.animation_data.nla_tracks:
                track.mute = True
        selected([rig, root, body, combined])
        bpy.context.view_layer.objects.active = rig
        output.parent.mkdir(parents=True, exist_ok=True)
        return bpy.ops.export_scene.gltf(filepath=str(output), export_format="GLB", export_yup=True,
                                  export_skins=True, export_animations=True, export_animation_mode="NLA_TRACKS",
                                  export_anim_slide_to_zero=True, export_force_sampling=True,
                                  export_optimize_animation_size=False, export_optimize_animation_keep_anim_object=True,
                                  export_apply=False, export_tangents=True, export_image_format="AUTO",
                                  export_extras=True, use_selection=True, export_cameras=False, export_lights=False)
    if args.exact_triangles:
        return run_export_restoring_state(bpy.context, [body, rig, root, combined], rig, body,
                                          export, optimized_body_identity, receipt)
    return export()


def main():
    global LANE, EXACT_OUTPUT_MODE
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--rendered-triangles", action="store_true")
    parser.add_argument("--exact-triangles", action="store_true")
    parser.add_argument("--restored-state", action="store_true")
    parser.add_argument("--restored-02", action="store_true")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    mode = select_boss_pack_mode(args.rendered_triangles, args.exact_triangles, args.restored_state, args.restored_02)
    if args.exact_triangles:
        EXACT_OUTPUT_MODE = mode
        lane = "r2b-restored-02" if args.restored_02 else "r2b-restored" if args.restored_state else "r2b-exact"
        LANE = ROOT / (".tmp/hmh-actor-3d-pilot/" + lane)
        output = validate_boss_pack_output(ROOT, mode + "export", args.output)
        receipt_path = validate_boss_pack_output(ROOT, mode + "receipt", LANE / "the-liquidator-packed-export.json")
        if args.restored_state:
            PROTECTED.append("apps/portal/assets/generated/hmh-actor-3d-pilot/the-liquidator-packed-exact.glb")
            PROTECTED.extend(".tmp/hmh-actor-3d-pilot/r2b-exact/" + name for name in [
                "the-liquidator-packed-export.json", "before-corners.json.gz", "after-corners.json.gz",
                "copy-plan.json.gz", "rendered-prepack-reference.json.gz", "original-source.png", "optimized-prepack.png"])
        if args.restored_02:
            PROTECTED.append("apps/portal/assets/generated/hmh-actor-3d-pilot/the-liquidator-packed-restored.glb")
            PROTECTED.extend(".tmp/hmh-actor-3d-pilot/r2b-restored/" + name for name in [
                "the-liquidator-packed-export.json", "before-corners.json.gz", "after-corners.json.gz",
                "copy-plan.json.gz", "rendered-prepack-reference.json.gz", "original-source.png", "optimized-prepack.png",
                "costume-baseColor.png", "costume-emission.png", "costume-metallicRoughness.png", "costume-normal.png"])
        PROTECTED.extend(name for name in EXACT_PROTECTED if name not in PROTECTED)
        if output.exists() or LANE.exists():
            raise RuntimeError("Exact candidate lane already exists; no overwrite or automatic retry")
    elif args.rendered_triangles:
        LANE = ROOT / ".tmp/hmh-actor-3d-pilot/r2b-rendered"
        output = validate_boss_pack_output(ROOT, "rendered-export", args.output)
        receipt_path = validate_boss_pack_output(ROOT, "rendered-receipt", LANE / "the-liquidator-packed-export.json")
        # All original failed witnesses remain immutable and separately named.
        PROTECTED.extend(["apps/portal/assets/generated/hmh-actor-3d-pilot/the-liquidator-packed.glb",
                          ".tmp/hmh-actor-3d-pilot/r2b/optimized-prepack-reference.json.gz",
                          "docs/2.0/receipts/actor-3d-r2b-failed-reimport.json",
                          "docs/2.0/receipts/actor-3d-r2b-current-source-inspection.json"])
        if output.exists() or LANE.exists():
            raise RuntimeError("Rendered candidate lane already exists; no overwrite or automatic retry")
    else:
        output = validate_boss_pack_output(ROOT, "export", args.output)
        receipt_path = validate_boss_pack_output(ROOT, "receipt", ROOT / ".tmp/hmh-actor-3d-pilot/the-liquidator-packed-export.json")
    before = hashes()
    if before[SPEC["source"]] != SPEC["sha256"]:
        raise RuntimeError("Immutable actual boss source changed")
    LANE.mkdir(parents=True, exist_ok=True)
    receipt = {"schema": 1, "actorId": ACTOR, "phase": SPEC["phase"], "sourceSha256": SPEC["sha256"],
               "beforeSha256": before, "activeRuntimeIntegration": False, "simulationAuthority": "none",
               "exactTriangles": args.exact_triangles, "restoredState": args.restored_state}
    body = None
    try:
        bpy.ops.wm.open_mainfile(filepath=str(ROOT / SPEC["source"]), load_ui=False, use_scripts=False)
        rig = bpy.data.objects[SPEC["rig"]]
        meshes = pilot.actor_meshes(ACTOR, rig)
        if len(meshes) != 45 or len(rig.data.bones) != 19:
            raise RuntimeError("Reviewed opening selection/rig changed")
        body = next(obj for obj in meshes if obj.get("hmh_primary_skinned_body"))
        costume = [obj for obj in meshes if obj != body]
        if sum(bool(obj.get("hmh_role_gear")) for obj in costume) != 43:
            raise RuntimeError("Reviewed rigid gear selection changed")
        for obj in bpy.data.objects:
            if obj.type == "MESH":
                obj.hide_render = obj not in meshes
        pilot.set_action(rig, bpy.data.actions[SPEC["clips"]["idle"]])
        bpy.context.scene.frame_set(1)
        preview(LANE / "original-source.png")
        receipt["appliedGeometryModifiers"] = apply_geometry(rig, meshes)
        receipt["optimization"] = pilot.simplify(ACTOR, rig, meshes)
        rig.data.pose_position = "POSE"
        root = pilot.prepare_clip_tracks(ACTOR, rig, meshes, SPEC)
        receipt["reference"] = rendered_reference(meshes) if args.rendered_triangles else reference(meshes)
        activate("idle")
        bpy.context.scene.frame_set(1)
        preview(LANE / "optimized-prepack.png")
        unwrap(costume)
        images, graphs = bake(costume, rig)
        receipt["sourceMaterialGraphs"] = graphs
        receipt["sourceGraphSnapshotScope"] = "node identities/types and links only; input default values are not fully snapshotted"
        receipt["sourceGraphsPreserved"] = True
        receipt["constantPbrFallbackUsed"] = False
        receipt["costumeBakeSemantics"] = list(images)
        receipt["nativeThreadCap"] = 2
        receipt["sourceComponents"] = [obj.name for obj in meshes]
        costume_components = [obj.name for obj in costume]
        rig.data.pose_position = "REST"
        selected(costume)
        bpy.ops.object.join()
        combined = bpy.context.object
        combined.name = "Liquidator Packed Costume"
        combined["hmh_actor_id"] = ACTOR
        combined["hmh_source_components"] = json.dumps(costume_components)
        combined.data.materials.clear()
        combined.data.materials.append(packed_material(images))
        for poly in combined.data.polygons:
            poly.material_index = 0
        if args.exact_triangles:
            receipt["optimizedNativeBodyBeforeSha256"] = optimized_body_identity(body)
        if args.restored_state:
            receipt["nativeRestPose"] = capture_native_rest_pose(
                root, rig, body, SPEC["sha256"], receipt["optimizedNativeBodyBeforeSha256"])
        perform_packed_export(body, rig, root, combined, args, output, receipt)
        receipt["output"] = output.relative_to(ROOT).as_posix()
        receipt["glbSha256"] = pilot.digest(output)
        receipt["bytes"] = output.stat().st_size
        receipt["completed"] = True
    except Exception as error:
        receipt["failure"] = str(error)
        raise
    finally:
        # A failed export/guard still records unrelated optimized body custody.
        if body is not None and "optimizedNativeBodyBeforeSha256" in receipt:
            try:
                receipt["optimizedNativeBodyAfterSha256"] = optimized_body_identity(body)
                receipt["optimizedNativeBodyUnchanged"] = receipt["optimizedNativeBodyAfterSha256"] == receipt["optimizedNativeBodyBeforeSha256"]
                if not receipt["optimizedNativeBodyUnchanged"]:
                    receipt["completed"] = False
                    receipt["bodyCustodyFailure"] = "The optimized native body changed during costume/export preparation"
            except Exception as error:
                receipt["completed"] = False
                receipt["bodyAfterCaptureFailure"] = str(error)
        receipt["afterSha256"] = hashes()
        receipt["protectedUnchanged"] = before == receipt["afterSha256"]
        receipt_path.write_text(json.dumps(receipt, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    if args.exact_triangles and not receipt.get("optimizedNativeBodyUnchanged", False):
        raise RuntimeError("Optimized native body custody failed")
    if not receipt["protectedUnchanged"]:
        raise RuntimeError("Protected source/prior export/runtime bytes changed")
    print("HMH_BOSS_PACK_RECEIPT=" + str(receipt_path))


if __name__ == "__main__":
    main()

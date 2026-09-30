"""Shared offline exact costume copy, proven on the immutable Liquidator source.

Only a joined unsaved export costume can be replaced. Blender-only: no runtime
loader/simulation import, source save, material bake or cap change. Preserve
original vertex IDs, loop triangles/UV/Float3 normals and named skin ownership.
"""
import hashlib
import json
import bpy
from hmh_actor_rendered_reference import plan_exact_triangle_copy


def digest(value):
    return hashlib.sha256(json.dumps(value, separators=(",", ":"), allow_nan=False).encode()).hexdigest()


def skin_weights(obj):
    return [[[obj.vertex_groups[group.group].name, group.weight] for group in vertex.groups]
            for vertex in obj.data.vertices]


def optimized_body_identity(obj):
    return digest({"positions": [list(vertex.co) for vertex in obj.data.vertices], "weights": skin_weights(obj),
                   "matrix": [list(row) for row in obj.matrix_world],
                   "materials": [material.name if material else None for material in obj.data.materials],
                   "modifiers": [(modifier.name, modifier.type) for modifier in obj.modifiers]})


def copy_input(obj):
    mesh = obj.data
    mesh.calc_loop_triangles()
    uv = mesh.uv_layers.active
    if uv is None or len(mesh.uv_layers) != 1:
        raise RuntimeError("Diagnostic requires the actual single costume atlas UV set")
    triangles = []
    for triangle in mesh.loop_triangles:
        polygon = mesh.polygons[triangle.polygon_index]
        triangles.append({"materialIndex": polygon.material_index, "useSmooth": polygon.use_smooth,
                          "corners": [{"vertexId": mesh.loops[index].vertex_index,
                                       "uv": list(uv.data[index].uv), "normal": list(mesh.corner_normals[index].vector)}
                                      for index in triangle.loops]})
    return plan_exact_triangle_copy([list(vertex.co) for vertex in mesh.vertices], skin_weights(obj), triangles)


def rebuild_exact_costume(obj, plan):
    if obj.name != "Liquidator Packed Costume" or obj.get("hmh_primary_skinned_body") or obj.get("hmh_native_body"):
        raise RuntimeError("Mesh copy is restricted to the joined unsaved export costume")
    original = obj.data
    group_names = [group.name for group in obj.vertex_groups]
    modifiers = [(modifier.name, modifier.type) for modifier in obj.modifiers]
    mesh = bpy.data.meshes.new(original.name + " Exact Export Triangles")
    mesh.from_pydata(plan["positions"], [], plan["faces"])
    mesh.update()
    for material in original.materials:
        mesh.materials.append(material)
    mesh.polygons.foreach_set("material_index", plan["materialIndices"])
    mesh.polygons.foreach_set("use_smooth", plan["useSmooth"])
    uv = mesh.uv_layers.new(name=original.uv_layers.active.name)
    uv.active_render = True
    uv.data.foreach_set("uv", [number for pair in plan["loopUvs"] for number in pair])
    # Keep original vertex order and live modifier/object ownership. Rebuild
    # deformation memberships by the original named groups, not new bone IDs.
    obj.data = mesh
    # Blender may clear object-level groups when assigning a fresh mesh.
    # Restore every original name in order, including unweighted groups.
    retained_names = [group.name for group in obj.vertex_groups]
    if retained_names and retained_names != group_names:
        raise RuntimeError("Mesh replacement retained partial or reordered skin groups")
    if not retained_names:
        for name in group_names:
            obj.vertex_groups.new(name=name)
    for vertex_id, memberships in enumerate(plan["weights"]):
        for name, weight in memberships:
            group = obj.vertex_groups.get(name)
            if group is None:
                raise RuntimeError("Original named skin group vanished: " + name)
            group.add([vertex_id], weight, "REPLACE")
    # The encoded smooth-fan setter changed normals in the frozen failure.
    # Blender 5.1 supports direct Float3 corner normals through attributes.
    # Retain original values/order and measure the unchanged strict witness.
    normal = mesh.attributes.new(name="custom_normal", type="FLOAT_VECTOR", domain="CORNER")
    if normal.name != "custom_normal" or normal.data_type != "FLOAT_VECTOR" or normal.domain != "CORNER" \
            or len(normal.data) != len(plan["loopNormals"]) or len(mesh.loops) != len(plan["loopNormals"]):
        raise RuntimeError("Exact corner-normal attribute ownership or count changed")
    normal.data.foreach_set("vector", [number for value in plan["loopNormals"] for number in value])
    mesh.update()
    bpy.context.view_layer.update()
    if [group.name for group in obj.vertex_groups] != group_names or [(modifier.name, modifier.type) for modifier in obj.modifiers] != modifiers:
        raise RuntimeError("Exact mesh copy altered live skin group/modifier ownership")
    return {"originalMesh": original.name, "copyMesh": mesh.name, "sourceMeshRetainedInMemory": original.name in bpy.data.meshes,
            "sourceVertices": len(original.vertices), "copiedVertices": len(mesh.vertices),
            "triangles": len(mesh.polygons), "namedGroups": group_names, "liveModifiers": modifiers,
            "normalAttribute": {"name": normal.name, "dataType": normal.data_type, "domain": normal.domain, "corners": len(normal.data)},
            "positionsSha256": digest(plan["positions"]), "weightsSha256": digest(plan["weights"]),
            "facesSha256": digest(plan["faces"]), "copyPlanSha256": digest(plan)}

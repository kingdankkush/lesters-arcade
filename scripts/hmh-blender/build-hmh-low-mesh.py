"""Scratch-only geometry LOD from accepted GLBs; never saves editable sources."""
import argparse
import hashlib
import json
import struct
import sys
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[2]
HEROES = ("lit-commando", "lilly", "lit-valkyrie", "lester-original")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--hero", choices=HEROES, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index("--")+1:])
    source = ROOT / "apps/portal/assets/generated/hmh-actor-3d-pilot" / (args.hero+".glb")
    target = ROOT / ".tmp/hmh-low-mesh" / (args.hero+".glb")
    target.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    # Weld equivalent GLB split vertices before collapse; UVs/custom normals
    # remain corner attributes instead of disconnected surface fragments.
    bpy.ops.import_scene.gltf(filepath=str(source),merge_vertices=True)
    raw = source.read_bytes(); size = struct.unpack_from("<I",raw,12)[0]
    source_nodes = json.loads(raw[20:20+size])["nodes"]
    names = {node["name"] for node in source_nodes if "mesh" in node}
    masks = json.loads((target.parent/(args.hero+"-protection.json")).read_text())
    if masks["sourceSha256"] != hashlib.sha256(raw).hexdigest(): raise RuntimeError("Stale protection source")
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH" and obj.name in names]
    rows = []
    for obj in bpy.context.scene.objects:
        if obj.type == "ARMATURE": obj.data.pose_position = "REST"
    for obj in meshes:
        before = sum(len(poly.vertices)-2 for poly in obj.data.polygons)
        name = obj.name.lower()
        goal = (3000 if "lower-body" in name else (6000 if args.hero == "lit-commando" else 7000) if "torso-head" in name
                else 1000 if "blaster" in name or "handgun" in name else 600 if args.hero == "lit-commando" and ("knife" in name or "grenade" in name)
                else 400 if "knife" in name else before)
        if "frag" in name or "grenade" in name: goal = before
        if before > goal:
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.select_all(action="DESELECT")
            obj.select_set(True)
            modifier = obj.modifiers.new("Source-faithful low geometry", "DECIMATE")
            modifier.ratio = goal / before
            # Bias collapse away from the face and gripping hands; the export
            # gates independently constrain animated silhouette loss.
            protected = obj.vertex_groups.new(name="HMH_LOD_Protected")
            ids = {group.index for group in obj.vertex_groups if group.name.lower().startswith(("head", "hand"))}
            mask = masks["meshes"][obj.name]
            if len(obj.data.vertices) > mask["vertices"]: raise RuntimeError("Importer vertex count increased")
            coordinate_map = {}
            for vertex in obj.data.vertices:
                coordinate_map.setdefault(tuple(round(value,5) for value in vertex.co),[]).append(vertex.index)
            protected_indices = set()
            for row in mask["protected"]:
                x,y,z = row["position"]
                coordinate = (x,-z,y)
                matches = coordinate_map.get(tuple(round(value,5) for value in coordinate),[])
                matches = [index for index in matches if max(abs(a-b) for a,b in zip(obj.data.vertices[index].co,coordinate)) <= 1e-5]
                if not matches:
                    matches = [vertex.index for vertex in obj.data.vertices if max(abs(a-b) for a,b in zip(vertex.co,coordinate)) <= 1e-5]
                if not matches:
                    raise RuntimeError("Importer vertex coordinate authority changed")
                protected_indices.update(matches)
            minima = [min(vertex.co[axis] for vertex in obj.data.vertices) for axis in range(3)]
            maxima = [max(vertex.co[axis] for vertex in obj.data.vertices) for axis in range(3)]
            margin = max(maxima[axis]-minima[axis] for axis in range(3)) * .002
            for vertex in obj.data.vertices:
                value = max((group.weight for group in vertex.groups if group.group in ids), default=0)
                extremum = any(vertex.co[axis] < minima[axis]+margin or vertex.co[axis] > maxima[axis]-margin for axis in range(3))
                if vertex.index in protected_indices or extremum or ("torso-head" in name and value>.1): protected.add([vertex.index], 1, "REPLACE")
            # The vertex group selects collapse eligibility; invert the mask
            # so identity-bearing head/hands and extrema have zero influence.
            modifier.vertex_group = protected.name
            modifier.invert_vertex_group = True
            modifier.vertex_group_factor = 1
            bpy.ops.object.modifier_move_to_index(modifier=modifier.name, index=0)
            bpy.ops.object.modifier_apply(modifier=modifier.name)
            owned_group = obj.vertex_groups.get("HMH_LOD_Protected")
            if owned_group: obj.vertex_groups.remove(owned_group)
        if obj.data.validate(clean_customdata=False): raise RuntimeError("Decimation produced invalid mesh")
        rows.append({"mesh":obj.name,"sourceTriangles":before,"targetTriangles":goal,
                     "triangles":sum(len(poly.vertices)-2 for poly in obj.data.polygons),"vertices":len(obj.data.vertices)})
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        if obj in meshes or obj.type in ("ARMATURE", "EMPTY"): obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(target),export_format="GLB",export_yup=True,export_skins=True,
        export_animations=False,export_apply=False,export_materials="PLACEHOLDER",export_tangents=True,
        use_selection=True,export_cameras=False,export_lights=False)
    target.with_suffix(".json").write_text(json.dumps({"hero":args.hero,"meshes":rows,"source":source.relative_to(ROOT).as_posix()},indent=2)+"\n")
    print("HMH_LOW_MESH",json.dumps(rows))

if __name__ == "__main__": main()

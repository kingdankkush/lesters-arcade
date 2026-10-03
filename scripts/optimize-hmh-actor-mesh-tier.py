"""Repack scratch Blender geometry into low tiers, retaining original rigs/clips."""
import argparse
import copy
import gzip
import hashlib
import importlib.util
import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "apps/portal/assets/generated/hmh-actor-3d-pilot"
SCRATCH = ROOT / ".tmp/hmh-low-mesh"
HEROES = ("lit-commando", "lilly", "lit-valkyrie", "lester-original")
WIDTH = {"SCALAR":1,"VEC2":2,"VEC3":3,"VEC4":4,"MAT4":16}
SIZE = {5121:1,5123:2,5125:4,5126:4}

def read_glb(raw):
    length = struct.unpack_from("<I", raw, 12)[0]
    return json.loads(raw[20:20+length]), raw[28+length:]

def accessor_bytes(doc, binary, index):
    row = doc["accessors"][index]
    if row.get("sparse") or row.get("normalized"): raise ValueError("Unexpected scratch accessor")
    view = doc["bufferViews"][row["bufferView"]]
    size = WIDTH[row["type"]] * SIZE[row["componentType"]]
    stride = view.get("byteStride",size)
    start = view.get("byteOffset",0)+row.get("byteOffset",0)
    return b"".join(binary[start+i*stride:start+i*stride+size] for i in range(row["count"]))

def derive(base_bytes, scratch_bytes):
    doc, binary = read_glb(base_bytes)
    lod, lod_binary = read_glb(scratch_bytes)
    payloads = [binary[view.get("byteOffset",0):view.get("byteOffset",0)+view["byteLength"]] for view in doc["bufferViews"]]
    new_nodes = {node["name"]:node for node in lod["nodes"] if "mesh" in node}
    measured = []
    for node in doc["nodes"]:
        if "mesh" not in node: continue
        other = new_nodes[node["name"]]
        original_skin = doc["skins"][node["skin"]]
        other_skin = lod["skins"][other["skin"]]
        originals = {doc["nodes"][joint]["name"]:index for index,joint in enumerate(original_skin["joints"])}
        joint_map = [originals[lod["nodes"][joint]["name"]] for joint in other_skin["joints"]]
        old_primitives = doc["meshes"][node["mesh"]]["primitives"]
        new_primitives = lod["meshes"][other["mesh"]]["primitives"]
        if len(old_primitives) != len(new_primitives): raise ValueError("Material primitive ownership changed")
        for original, replacement in zip(old_primitives,new_primitives):
            before = doc["accessors"][original["indices"]]["count"] // 3
            # Small held/released frags are rigid identity props. Keep their
            # accepted geometry verbatim rather than spend silhouette error.
            if "frag" in node["name"].lower() or "grenade" in node["name"].lower():
                measured.append({"mesh":node["name"],"sourceTriangles":before,"triangles":before,
                                 "vertices":doc["accessors"][original["attributes"]["POSITION"]]["count"],"preserved":True})
                continue
            attributes = {}
            for semantic in list(original["attributes"])+["indices"]:
                index = replacement["indices"] if semantic == "indices" else replacement["attributes"][semantic]
                row = copy.deepcopy(lod["accessors"][index])
                data = accessor_bytes(lod,lod_binary,index)
                if semantic == "JOINTS_0":
                    code = "B" if row["componentType"] == 5121 else "H"
                    values = struct.unpack("<"+code*(len(data)//SIZE[row["componentType"]]),data)
                    data = struct.pack("<"+"H"*len(values),*(joint_map[value] for value in values))
                    row["componentType"] = 5123
                    row.pop("min",None); row.pop("max",None)
                row.pop("byteOffset",None)
                row["bufferView"] = len(payloads)
                payloads.append(data)
                doc["bufferViews"].append({"buffer":0,"byteLength":len(data),"target":34963 if semantic == "indices" else 34962})
                new_index = len(doc["accessors"])
                doc["accessors"].append(row)
                if semantic == "indices": original["indices"] = new_index
                else: attributes[semantic] = new_index
            original["attributes"] = attributes
            after = doc["accessors"][original["indices"]]["count"] // 3
            measured.append({"mesh":node["name"],"sourceTriangles":before,"triangles":after,
                             "vertices":doc["accessors"][attributes["POSITION"]]["count"]})
    # Remove only unused geometry accessors/views. Animation and bind bytes are
    # copied unchanged; their indices are rebased, never resampled/re-exported.
    used = set()
    for mesh in doc["meshes"]:
        for primitive in mesh["primitives"]: used.update(primitive["attributes"].values()); used.add(primitive["indices"])
    for skin in doc["skins"]: used.add(skin["inverseBindMatrices"])
    for animation in doc["animations"]:
        for sampler in animation["samplers"]: used.update((sampler["input"],sampler["output"]))
    mapping = {old:new for new,old in enumerate(sorted(used))}
    doc["accessors"] = [doc["accessors"][old] for old in sorted(used)]
    for mesh in doc["meshes"]:
        for primitive in mesh["primitives"]:
            primitive["attributes"] = {name:mapping[index] for name,index in primitive["attributes"].items()}
            primitive["indices"] = mapping[primitive["indices"]]
    for skin in doc["skins"]: skin["inverseBindMatrices"] = mapping[skin["inverseBindMatrices"]]
    for animation in doc["animations"]:
        for sampler in animation["samplers"]:
            sampler["input"] = mapping[sampler["input"]]; sampler["output"] = mapping[sampler["output"]]
    used_views = sorted({row["bufferView"] for row in doc["accessors"]}|{row["bufferView"] for row in doc["images"]})
    views, chunks, offset = [],[],0
    view_map = {}
    for old in used_views:
        view = copy.deepcopy(doc["bufferViews"][old]); data = payloads[old]
        view_map[old] = len(views); view["byteOffset"] = offset; view["byteLength"] = len(data)
        chunk = data+b"\0"*(-len(data)%4); chunks.append(chunk); offset += len(chunk); views.append(view)
    for row in doc["accessors"]+doc["images"]: row["bufferView"] = view_map[row["bufferView"]]
    doc["bufferViews"] = views; doc["buffers"][0]["byteLength"] = offset
    text = json.dumps(doc,separators=(",",":")).encode(); text += b" "*(-len(text)%4)
    binary = b"".join(chunks)
    raw = struct.pack("<III",0x46546c67,2,28+len(text)+len(binary))+struct.pack("<II",len(text),0x4e4f534a)+text+struct.pack("<II",len(binary),0x004e4942)+binary
    return raw,measured

def main():
    parser = argparse.ArgumentParser(); modes=parser.add_mutually_exclusive_group(required=True)
    modes.add_argument("--hero",choices=HEROES); modes.add_argument("--publish",action="store_true")
    args = parser.parse_args()
    if args.publish:
        manifest=json.loads((SOURCE/"low/manifest.json").read_text())
        prepared=[]
        for hero in HEROES:
            receipt=json.loads((SCRATCH/(hero+"-repack.json")).read_text())
            packed=(SCRATCH/(hero+".glb.gz")).read_bytes()
            if hashlib.sha256(packed).hexdigest()!=receipt["sha256"] or receipt["sourceSha256"]!=hashlib.sha256((SOURCE/(hero+".glb")).read_bytes()).hexdigest():
                raise ValueError("Stale mesh LOD source/output")
            if len(packed)>1_500_000: raise ValueError("Download budget")
            prepared.append((hero,packed,receipt))
        for hero,packed,receipt in prepared:
            row=manifest["actors"][hero]
            row.update({key:receipt[key] for key in ("compressedBytes","glbBytes","sha256","glbSha256","geometry")})
            (SOURCE/"low"/row["file"]).write_bytes(packed)
        manifest.update(schema=2,kind="derived-low-mesh-and-texture-tier",geometryChanged=True,rigChanged=False,animationChanged=False)
        (SOURCE/"low/manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
        minimal={hero:{key:manifest["actors"][hero][key] for key in ("file","compressedBytes","glbBytes")} for hero in HEROES}
        (ROOT/"apps/hmh-reboot/src/actor-3d-texture-tiers.mjs").write_text("// GENERATED by scripts/optimize-hmh-actor-mesh-tier.py. Lazy presentation chunk only.\nexport const ACTOR3D_LOW_ASSETS = Object.freeze("+json.dumps(minimal,separators=(",",":"))+");\n")
        print("Published complete low mesh set")
        return
    hero=args.hero
    source=(SOURCE/(hero+".glb")).read_bytes()
    # Recreate texture input from the immutable classic asset, so rerunning
    # after publication never simplifies or measures an already reduced tier.
    spec=importlib.util.spec_from_file_location("hmh_texture_tier",ROOT/"scripts/optimize-hmh-actor-texture-tier.py")
    texture=importlib.util.module_from_spec(spec); spec.loader.exec_module(texture)
    edge=json.loads((SOURCE/"low/manifest.json").read_text())["actors"][hero]["baseEdge"]
    base,_,_=texture.derive(source,edge)
    raw, rows = derive(base,(SCRATCH/(hero+".glb")).read_bytes())
    packed = gzip.compress(raw,compresslevel=9,mtime=0)
    if len(packed)>1_500_000: raise ValueError("Low download exceeds budget")
    (SCRATCH/(hero+".glb.gz")).write_bytes(packed)
    (SCRATCH/(hero+"-repack.json")).write_text(json.dumps({"hero":hero,"sourceSha256":hashlib.sha256(source).hexdigest(),"compressedBytes":len(packed),"glbBytes":len(raw),"sha256":hashlib.sha256(packed).hexdigest(),"glbSha256":hashlib.sha256(raw).hexdigest(),"geometry":rows},indent=2)+"\n")
    print(json.dumps({"hero":hero,"compressedBytes":len(packed),"geometry":rows}))

if __name__ == "__main__": main()

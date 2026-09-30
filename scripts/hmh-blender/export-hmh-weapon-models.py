"""Export one optimised HMH weapon GLB from an owner-supplied source model.

Runs inside a fresh ``--factory-startup --disable-autoexec`` Blender process,
one weapon per process, driven by ``scripts/run-hmh-weapon-models.py``. The
owner GLB is opened read-only (hashed before and after); nothing under the
owner's asset folder is ever written.

Pipeline per weapon
  1. import the owner GLB, join its parts into one high-poly source mesh;
  2. orient the mesh into the held-weapon *grip frame* shared with the
     held-weapon atlas pipeline: origin = trigger-hand palm point on the grip,
     +X = forward along the bore toward the muzzle, +Y = left, +Z = up, metres
     at hero scale. Forward is the principal axis of the vertices (re-fitted on
     the upper slice for guns so the bore, not the grip mass, sets the line),
     with the sign and up direction taken from the reviewed hints;
  3. scale to the requested length, seat the bore at the requested height above
     the palm and the palm at the requested fraction along the length;
  4. decimate a copy to the triangle budget, smart-unwrap it, bake ambient
     occlusion (and the source diffuse colour when the owner model is
     textured) from the high-poly source onto one 512 px texture;
  5. export the low-poly mesh as an embedded GLB with the grip and muzzle in
     the node extras, and render review frames of both meshes.

Projection-only art: nothing here can alter damage, fire rate, ammo, drops,
collision, RNG or results.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
TEXTURE_SIZE = 512


def blender_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--request", required=True, help="JSON request written by the orchestrator")
    return parser.parse_args(argv)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def unit(vector: np.ndarray) -> np.ndarray:
    norm = float(np.linalg.norm(vector))
    if norm <= 1e-12:
        raise RuntimeError("degenerate axis")
    return vector / norm


def principal_axis(points: np.ndarray) -> np.ndarray:
    centred = points - points.mean(axis=0)
    _, _, vt = np.linalg.svd(centred, full_matrices=False)
    return unit(vt[0])


def enable_gpu_cycles(scene, cpu_only: bool = False) -> str:
    if cpu_only:
        scene.cycles.device = "CPU"
        return "CPU"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for backend in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = backend
        except TypeError:
            continue
        prefs.refresh_devices()
        gpus = [device for device in prefs.devices if device.type == backend]
        if gpus:
            for device in prefs.devices:
                device.use = device.type == backend
            scene.cycles.device = "GPU"
            return backend
    scene.cycles.device = "CPU"
    return "CPU"


def import_source(path: Path) -> list:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError("owner model has no meshes")
    return meshes


def join(meshes: list, name: str):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    source = bpy.context.view_layer.objects.active
    source.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for obj in list(bpy.context.scene.objects):
        if obj.type != "MESH":
            bpy.data.objects.remove(obj, do_unlink=True)
    return source


def vertices(obj) -> np.ndarray:
    count = len(obj.data.vertices)
    flat = np.empty(count * 3, dtype=np.float64)
    obj.data.vertices.foreach_get("co", flat)
    return flat.reshape(count, 3)


def orient(source, spec: dict) -> dict:
    points = vertices(source)
    hint_forward = unit(np.array(spec["forwardHint"], dtype=np.float64))
    hint_up = unit(np.array(spec["upHint"], dtype=np.float64))
    if spec.get("align", "forward") == "up":
        up = principal_axis(points)
        if up @ hint_up < 0:
            up = -up
        forward = unit(hint_forward - up * (hint_forward @ up))
    else:
        forward = principal_axis(points)
        if forward @ hint_forward < 0:
            forward = -forward
        up = unit(hint_up - forward * (hint_up @ forward))
        if spec.get("refitSlide", False):
            # The grip mass drags the whole-body axis nose-up; refit on the
            # upper slice (the slide / receiver / barrel) like the held pages.
            heights = (points - points.mean(axis=0)) @ up
            top = points[heights >= np.quantile(heights, 0.6)]
            refit = principal_axis(top)
            if refit @ forward < 0:
                refit = -refit
            forward = refit
            up = unit(hint_up - forward * (hint_up @ forward))
        if spec.get("refitFront", False):
            # Long guns: the stock drop tilts the whole-body axis. The front
            # half (barrel, forend) sets the bore line.
            along = (points - points.mean(axis=0)) @ forward
            front = points[along >= np.quantile(along, 0.5)]
            refit = principal_axis(front)
            if refit @ forward < 0:
                refit = -refit
            forward = refit
            up = unit(hint_up - forward * (hint_up @ forward))
    left = unit(np.cross(up, forward))
    rows = np.stack([forward, left, up])  # canonical = rows @ (point - mean)
    canonical = (points - points.mean(axis=0)) @ rows.T
    extent_axis = 2 if spec.get("align", "forward") == "up" else 0
    length = float(canonical[:, extent_axis].max() - canonical[:, extent_axis].min())
    scale = float(spec["lengthMetres"]) / length
    canonical *= scale
    # Seat the palm: rear of the model at -gripAlong * length; the bore line
    # (centroid of the upper slice for guns, whole centroid otherwise) at
    # boreHeight above the palm; centred left/right.
    x_min = float(canonical[:, 0].min())
    grip_along = float(spec.get("gripAlong", 0.5))
    if spec.get("boreSlice", False):
        heights = canonical[:, 2]
        slice_points = canonical[heights >= np.quantile(heights, 0.6)]
        bore_z = float(slice_points[:, 2].mean())
    else:
        bore_z = float(canonical[:, 2].mean())
    offset = np.array([
        -x_min - grip_along * float(spec["lengthMetres"]),
        -float(canonical[:, 1].mean()),
        float(spec.get("boreHeight", 0.1)) - bore_z,
    ])
    canonical += offset
    # Muzzle: the forward-most vertex close to the bore line.
    near_bore = canonical[np.hypot(canonical[:, 1], canonical[:, 2] - float(spec.get("boreHeight", 0.1))) <= float(spec["lengthMetres"]) * 0.12]
    if len(near_bore) == 0:
        near_bore = canonical
    muzzle_index = int(np.argmax(near_bore[:, 0]))
    muzzle = [float(near_bore[muzzle_index, 0]), 0.0, float(spec.get("boreHeight", 0.1))]
    # Apply as a world matrix, then bake it into the mesh data.
    rotation = Matrix(rows.tolist()).to_4x4()
    mean = Vector(points.mean(axis=0).tolist())
    transform = Matrix.Translation(Vector(offset.tolist())) @ Matrix.Scale(scale, 4) @ rotation @ Matrix.Translation(-mean)
    source.matrix_world = transform
    bpy.ops.object.select_all(action="DESELECT")
    source.select_set(True)
    bpy.context.view_layer.objects.active = source
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    check = vertices(source)
    bounds = [[float(v) for v in check.min(axis=0)], [float(v) for v in check.max(axis=0)]]
    return {
        "axesInSource": {"forward": forward.tolist(), "left": left.tolist(), "up": up.tolist()},
        "sourceScale": scale, "lengthMetres": float(spec["lengthMetres"]), "bounds": bounds, "muzzle": muzzle,
        "grip": [0.0, 0.0, 0.0], "boreHeight": float(spec.get("boreHeight", 0.1)),
    }


def decimate(source, target: int, limit: int):
    bpy.ops.object.select_all(action="DESELECT")
    source.select_set(True)
    bpy.context.view_layer.objects.active = source
    bpy.ops.object.duplicate()
    low = bpy.context.view_layer.objects.active
    low.name = "HMH_Weapon_Low"
    low.data = low.data.copy()
    for _ in range(4):
        modifier = low.modifiers.new("Decimate", "DECIMATE")
        current = sum(len(polygon.vertices) - 2 for polygon in low.data.polygons)
        modifier.ratio = min(1.0, target / max(1, current))
        modifier.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.quads_convert_to_tris(quad_method="BEAUTY", ngon_method="BEAUTY")
        bpy.ops.mesh.select_all(action="DESELECT")
        bpy.ops.object.mode_set(mode="OBJECT")
        if len(low.data.polygons) <= limit:
            break
        target = int(target * 0.85)
    if len(low.data.polygons) > limit:
        raise RuntimeError(f"decimation left {len(low.data.polygons)} triangles above the {limit} budget")
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(80.0), island_margin=0.004, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.mesh.select_all(action="DESELECT")
    bpy.ops.object.mode_set(mode="OBJECT")
    try:
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35.0))
    except AttributeError:
        bpy.ops.object.shade_smooth()
    return low


def source_has_texture(source) -> bool:
    for slot in source.material_slots:
        material = slot.material
        if material and material.node_tree and any(node.type == "TEX_IMAGE" and node.image for node in material.node_tree.nodes):
            return True
    return False


def bake_material(low, image):
    material = bpy.data.materials.new("HMH_Weapon_Bake")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = image
    nodes.active = texture
    low.data.materials.clear()
    low.data.materials.append(material)
    return material


def bake(scene, source, low, image, kind: str, length: float, samples: int, pass_filter=None) -> None:
    scene.render.engine = "CYCLES"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = False
    scene.render.bake.use_selected_to_active = True
    scene.render.bake.cage_extrusion = length * 0.02
    scene.render.bake.max_ray_distance = length * 0.08
    scene.render.bake.margin = 6
    scene.render.bake.use_clear = True
    if scene.world is None:
        scene.world = bpy.data.worlds.new("HMH_Weapon_World")
    scene.world.light_settings.distance = max(0.05, length * 0.5)
    bpy.ops.object.select_all(action="DESELECT")
    source.select_set(True)
    low.select_set(True)
    bpy.context.view_layer.objects.active = low
    for slot in low.material_slots:
        for node in slot.material.node_tree.nodes:
            if node.type == "TEX_IMAGE":
                node.image = image
                slot.material.node_tree.nodes.active = node
    kwargs = {"type": kind, "use_selected_to_active": True}
    if pass_filter:
        kwargs["pass_filter"] = pass_filter
    bpy.ops.object.bake(**kwargs)


def image_pixels(image) -> np.ndarray:
    flat = np.empty(image.size[0] * image.size[1] * 4, dtype=np.float32)
    image.pixels.foreach_get(flat)
    return flat.reshape(image.size[1], image.size[0], 4)


def compose_texture(ao: np.ndarray, diffuse: np.ndarray | None, tint: list[float], ambient: float) -> np.ndarray:
    occlusion = np.clip(ao[..., :1], 0.0, 1.0)
    shade = ambient + (1.0 - ambient) * occlusion
    if diffuse is None:
        base = np.array(tint, dtype=np.float32).reshape(1, 1, 3)
        rgb = np.broadcast_to(base, (*ao.shape[:2], 3)) * shade
    else:
        rgb = np.clip(diffuse[..., :3], 0.0, 1.0) * (0.55 + 0.45 * shade)
    out = np.ones((*ao.shape[:2], 4), dtype=np.float32)
    out[..., :3] = np.clip(rgb, 0.0, 1.0)
    return out


def save_jpeg(scene, image, path: Path, quality: int) -> None:
    settings = scene.render.image_settings
    previous = (settings.file_format, settings.color_mode, settings.quality)
    settings.file_format = "JPEG"
    settings.color_mode = "RGB"
    settings.quality = quality
    image.save_render(str(path), scene=scene)
    settings.file_format, settings.color_mode, settings.quality = previous


def final_material(low, jpeg_path: Path, spec: dict, weapon_id: str):
    material = bpy.data.materials.new(f"HMH Weapon | {weapon_id}")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    principled = next(node for node in nodes if node.type == "BSDF_PRINCIPLED")
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = bpy.data.images.load(str(jpeg_path))
    texture.image.name = f"hmh-weapon-{weapon_id}"
    links.new(texture.outputs["Color"], principled.inputs["Base Color"])
    principled.inputs["Metallic"].default_value = float(spec.get("metallic", 0.6))
    principled.inputs["Roughness"].default_value = float(spec.get("roughness", 0.55))
    low.data.materials.clear()
    low.data.materials.append(material)
    return material


def render_reviews(scene, objects_by_label: dict, out_dir: Path, length: float, weapon_id: str, bounds, cpu_only: bool = False) -> dict:
    engines = {item.identifier for item in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items}
    if cpu_only:
        scene.render.engine = "CYCLES"
        scene.cycles.device = "CPU"
        scene.cycles.samples = 24
    else:
        scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engines else "BLENDER_EEVEE"
    scene.render.resolution_x = scene.render.resolution_y = 384
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    rig = json.loads((ROOT / "scripts/hmh-blender/hmh-light-rig.json").read_text(encoding="utf-8"))
    energy = rig["energy"]["prop"]
    for name, offset in (("key", (-1.2, -1.0, 1.6)), ("fill", (1.4, -0.8, 0.5)), ("rim", (0.3, 1.6, 1.1))):
        data = bpy.data.lights.new(f"HMH_Weapon_{name}", type="AREA")
        data.energy = float(energy[name]) * (length ** 2) * 0.55
        data.color = rig["colors"][name]
        data.size = max(0.3, length)
        light = bpy.data.objects.new(f"HMH_Weapon_{name}", data)
        light.location = Vector(offset) * length * 1.6
        light.rotation_euler = (-light.location).to_track_quat("-Z", "Y").to_euler()
        scene.collection.objects.link(light)
    camera_data = bpy.data.cameras.new("HMH_Weapon_Camera")
    camera_data.type = "ORTHO"
    low_bounds = [Vector(bounds[0]), Vector(bounds[1])]
    span = max(max(low_bounds[1][i] - low_bounds[0][i] for i in range(3)), 1e-3)
    camera_data.ortho_scale = span * 1.25
    camera = bpy.data.objects.new("HMH_Weapon_Camera", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    centre = (low_bounds[0] + low_bounds[1]) / 2
    views = {
        "side": (Vector((0.0, -10.0, 0.0)), (math.radians(90.0), 0.0, 0.0)),
        "three-quarter": (Vector((-6.0, -7.0, 5.0)), None),
        "top": (Vector((0.0, 0.0, 10.0)), (0.0, 0.0, 0.0)),
    }
    files = {}
    for label, obj in objects_by_label.items():
        for other in objects_by_label.values():
            other.hide_render = other is not obj
        for view, (offset, euler) in views.items():
            if label == "source" and view != "side":
                continue
            camera.location = centre + offset * length
            if euler is None:
                camera.rotation_euler = (centre - camera.location).to_track_quat("-Z", "Z").to_euler()
            else:
                camera.rotation_euler = euler
            filename = f"{weapon_id}__{label}__{view}.png"
            scene.render.filepath = str(out_dir / filename)
            bpy.ops.render.render(write_still=True)
            files[f"{label}:{view}"] = filename
    return files


def main() -> None:
    args = blender_args()
    request = json.loads(Path(args.request).read_text(encoding="utf-8"))
    weapon_id = request["weaponId"]
    spec = request["spec"]
    source_path = Path(request["sourcePath"])
    work = Path(request["workDir"])
    work.mkdir(parents=True, exist_ok=True)
    before = sha256_file(source_path)
    if before != request["sourceSha256"]:
        raise RuntimeError(f"{source_path} does not match the recorded source hash")
    meshes = import_source(source_path)
    source = join(meshes, "HMH_Weapon_Source")
    source_triangles = sum(len(polygon.vertices) - 2 for polygon in source.data.polygons)
    textured = source_has_texture(source)
    placement = orient(source, spec)
    scene = bpy.context.scene
    device = enable_gpu_cycles(scene, bool(request.get("cpuOnly", False)))
    low = decimate(source, int(spec.get("targetTriangles", request["targetTriangles"])), int(request["triangleLimit"]))
    length = float(spec["lengthMetres"])
    ao_image = bpy.data.images.new("hmh_bake_ao", TEXTURE_SIZE, TEXTURE_SIZE, alpha=True)
    bake_material(low, ao_image)
    bake(scene, source, low, ao_image, "AO", length, int(request.get("bakeSamples", 48)))
    ao = image_pixels(ao_image)
    diffuse = None
    if textured:
        diffuse_image = bpy.data.images.new("hmh_bake_diffuse", TEXTURE_SIZE, TEXTURE_SIZE, alpha=True)
        bake(scene, source, low, diffuse_image, "DIFFUSE", length, int(request.get("bakeSamples", 48)), pass_filter={"COLOR"})
        diffuse = image_pixels(diffuse_image)
    composed = compose_texture(ao, diffuse, spec.get("tint", [0.36, 0.38, 0.42]), float(spec.get("ambient", 0.35)))
    final_image = bpy.data.images.new("hmh_weapon_base", TEXTURE_SIZE, TEXTURE_SIZE, alpha=False)
    final_image.pixels.foreach_set(composed.reshape(-1))
    jpeg_path = work / f"{weapon_id}-base.jpg"
    save_jpeg(scene, final_image, jpeg_path, int(spec.get("jpegQuality", request.get("jpegQuality", 78))))
    final_material(low, jpeg_path, spec, weapon_id)
    low["hmh_weapon_id"] = weapon_id
    low["hmh_grip"] = placement["grip"]
    low["hmh_muzzle"] = placement["muzzle"]
    low["hmh_grip_frame"] = "+X forward, +Y left, +Z up (Blender); exported Y-up"
    low.name = f"HMH Weapon | {weapon_id}"
    output = Path(request["outputGlb"])
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    low.select_set(True)
    bpy.context.view_layer.objects.active = low
    bpy.ops.export_scene.gltf(
        filepath=str(output), export_format="GLB", use_selection=True, export_yup=True, export_apply=True,
        export_animations=False, export_skins=False, export_morph=False, export_extras=True,
        export_image_format="AUTO", export_texcoords=True, export_normals=True, export_tangents=False,
        export_materials="EXPORT", export_cameras=False, export_lights=False,
    )
    reviews = render_reviews(scene, {"low": low, "source": source}, work, length, weapon_id, placement["bounds"], bool(request.get("cpuOnly", False)))
    after = sha256_file(source_path)
    if after != before:
        raise RuntimeError("owner source file changed during export")
    report = {
        "weaponId": weapon_id, "sourcePath": str(source_path), "sourceSha256Before": before, "sourceSha256After": after,
        "sourceTriangles": source_triangles, "sourceTextured": textured, "lowTriangles": len(low.data.polygons),
        "lowVertices": len(low.data.vertices), "placement": placement, "device": device,
        "textureSize": TEXTURE_SIZE, "textureJpeg": jpeg_path.name, "outputGlb": str(output), "outputSha256": sha256_file(output),
        "outputBytes": output.stat().st_size, "reviews": reviews,
        "blender": {"version": bpy.app.version_string, "hash": bpy.app.build_hash.decode() if isinstance(bpy.app.build_hash, bytes) else str(bpy.app.build_hash)},
    }
    (work / "report.json").write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print("HMH_WEAPON_EXPORT_DONE", weapon_id)


if __name__ == "__main__":
    main()

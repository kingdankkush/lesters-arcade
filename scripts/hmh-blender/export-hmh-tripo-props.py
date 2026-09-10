from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from pathlib import Path
from typing import Any

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector


def blender_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--raw-output", required=True)
    parser.add_argument("--report-output", required=True)
    parser.add_argument("--source-id", help="Render exactly one source in this fresh native process")
    return parser.parse_args(argv)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def configure_scene(render: dict[str, Any], target: Vector, span: float) -> tuple[Any, Any]:
    scene = bpy.context.scene
    scene.render.engine = render["engine"]
    scene.render.film_transparent = True
    scene.render.resolution_x = int(render["frameSize"][0])
    scene.render.resolution_y = int(render["frameSize"][1])
    scene.render.resolution_percentage = 100
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 1
    scene.render.dither_intensity = 0.0
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 20
    scene.view_settings.exposure = float(render["exposure"])

    world = bpy.data.worlds.new("HMH_Tripo_Prop_World")
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs[0].default_value = (0.02, 0.025, 0.035, 1.0)
    background.inputs[1].default_value = 0.45
    scene.world = world

    pitch_degrees = float(render["cameraPitchDegrees"])
    pitch_radians = math.radians(pitch_degrees)
    distance = max(3.8, span * 3.0)
    camera_data = bpy.data.cameras.new("HMH_Tripo_Prop_Camera")
    camera_data.type = "ORTHO"
    camera_data.clip_start = max(0.001, distance / 1000.0)
    camera_data.clip_end = max(1000.0, distance * 20.0)
    camera = bpy.data.objects.new("HMH_Tripo_Prop_Camera", camera_data)
    camera.location = (target.x, target.y - distance, target.z + distance)
    # Camera pitch is explicitly a positive rotation around Blender's X axis.
    # With the camera placed on -Y/+Z, its local -Z axis points toward +Y/-Z.
    camera.rotation_euler = (pitch_radians, 0.0, math.radians(render["cameraYawDegrees"]))
    scene.collection.objects.link(camera)
    scene.camera = camera

    scale = max(1.0, span)
    placements = {
        "Key": (Vector((3.2, -4.0, 5.2)) * scale, 900.0, (1.0, 0.84, 0.70), 4.0 * scale),
        "Fill": (Vector((-3.0, -2.2, 2.8)) * scale, 520.0, (0.58, 0.72, 1.0), 5.0 * scale),
        "Rim": (Vector((0.5, 3.6, 3.5)) * scale, 700.0, (0.72, 0.88, 1.0), 4.0 * scale),
    }
    for name, (offset, energy, color, size) in placements.items():
        data = bpy.data.lights.new(f"HMH_Tripo_Prop_{name}", type="AREA")
        data.energy = energy
        data.color = color
        data.size = size
        light = bpy.data.objects.new(f"HMH_Tripo_Prop_{name}", data)
        light.location = target + offset
        light.rotation_euler = (target - light.location).to_track_quat("-Z", "Y").to_euler()
        scene.collection.objects.link(light)
    return scene, camera


def mesh_bound_points(objects: list[Any]) -> list[Vector]:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    points: list[Vector] = []
    for obj in objects:
        evaluated = obj.evaluated_get(depsgraph)
        matrix = evaluated.matrix_world
        points.extend(matrix @ Vector(corner) for corner in evaluated.bound_box)
    if not points:
        raise RuntimeError("imported GLB contains no renderable mesh bounds")
    return points


def dimensions(points: list[Vector]) -> tuple[Vector, Vector, Vector]:
    minimum = Vector(tuple(min(point[axis] for point in points) for axis in range(3)))
    maximum = Vector(tuple(max(point[axis] for point in points) for axis in range(3)))
    size = maximum - minimum
    values = [*minimum, *maximum, *size]
    if any(not math.isfinite(value) for value in values):
        raise RuntimeError("imported GLB has non-finite dimensions")
    if max(size) <= 1.0e-6 or size.z <= 1.0e-6 or max(abs(value) for value in values) > 1.0e8:
        raise RuntimeError(f"imported GLB has invalid dimensions: {tuple(size)}")
    return minimum, maximum, size


def center_and_ground(imported: list[Any], meshes: list[Any]) -> tuple[list[Vector], Vector]:
    before = mesh_bound_points(meshes)
    minimum, maximum, _ = dimensions(before)
    ground_center = Vector(((minimum.x + maximum.x) * 0.5, (minimum.y + maximum.y) * 0.5, minimum.z))
    delta = -ground_center
    roots = [obj for obj in imported if obj.parent is None]
    if not roots:
        raise RuntimeError("imported GLB contains no movable root objects")
    for root in roots:
        root.location += delta
    bpy.context.view_layer.update()
    after = mesh_bound_points(meshes)
    minimum, maximum, size = dimensions(after)
    target = Vector(((minimum.x + maximum.x) * 0.5, (minimum.y + maximum.y) * 0.5, (minimum.z + maximum.z) * 0.5))
    return after, target


def fit_orthographic_camera(scene: Any, camera: Any, points: list[Vector], occupancy: float) -> None:
    if not 0.5 <= occupancy < 1.0:
        raise RuntimeError("camera occupancy is outside its safe range")
    bpy.context.view_layer.update()
    inverse = camera.matrix_world.inverted()
    camera_points = [inverse @ point for point in points]
    min_x = min(point.x for point in camera_points)
    max_x = max(point.x for point in camera_points)
    min_y = min(point.y for point in camera_points)
    max_y = max(point.y for point in camera_points)
    center_x = (min_x + max_x) * 0.5
    center_y = (min_y + max_y) * 0.5
    local_offset = Vector((center_x, center_y, 0.0))
    camera.location += camera.rotation_euler.to_matrix() @ local_offset
    bpy.context.view_layer.update()

    aspect = scene.render.resolution_x / scene.render.resolution_y
    camera.data.ortho_scale = max(
        (max_y - min_y) / occupancy,
        (max_x - min_x) / (aspect * occupancy),
        0.01,
    )
    bpy.context.view_layer.update()
    projected = [world_to_camera_view(scene, camera, point) for point in points]
    if any(not math.isfinite(value) for point in projected for value in (point.x, point.y, point.z)):
        raise RuntimeError("camera projection produced non-finite dimensions")
    if any(point.x <= 0.0 or point.x >= 1.0 or point.y <= 0.0 or point.y >= 1.0 for point in projected):
        raise RuntimeError("orthographic fit would crop imported geometry")


def material_concerns() -> list[dict[str, str]]:
    concerns: list[dict[str, str]] = []
    for material in sorted(bpy.data.materials, key=lambda item: item.name):
        reasons: list[str] = []
        if len(material.diffuse_color) >= 4 and material.diffuse_color[3] < 0.999:
            reasons.append("material-alpha-below-one-preserved")
        if material.use_nodes and material.node_tree:
            for node in material.node_tree.nodes:
                if node.type != "BSDF_PRINCIPLED":
                    continue
                transmission = node.inputs.get("Transmission Weight") or node.inputs.get("Transmission")
                alpha = node.inputs.get("Alpha")
                if transmission is not None and (transmission.is_linked or float(transmission.default_value) > 0.0):
                    reasons.append("principled-transmission-preserved-for-review")
                if alpha is not None and (alpha.is_linked or float(alpha.default_value) < 0.999):
                    reasons.append("principled-alpha-preserved-for-review")
        for reason in sorted(set(reasons)):
            concerns.append({"material": material.name, "concern": reason})
    return concerns


def audit_render(path: Path) -> dict[str, Any]:
    image = bpy.data.images.load(str(path), check_existing=False)
    try:
        width, height = image.size
        if width < 3 or height < 3:
            raise RuntimeError("rendered frame has invalid dimensions")
        pixels = image.pixels[:]
        occupied: list[tuple[int, int]] = []
        for index in range(width * height):
            if pixels[index * 4 + 3] > 0.0:
                x = index % width
                y = height - 1 - index // width
                occupied.append((x, y))
        if not occupied:
            raise RuntimeError("rendered frame is blank/empty in alpha")
        minimum_x = min(point[0] for point in occupied)
        maximum_x = max(point[0] for point in occupied)
        minimum_y = min(point[1] for point in occupied)
        maximum_y = max(point[1] for point in occupied)
        if minimum_x <= 0 or minimum_y <= 0 or maximum_x >= width - 1 or maximum_y >= height - 1:
            raise RuntimeError("rendered frame is cropped or touches an image edge")
        return {
            "width": width,
            "height": height,
            "alphaBounds": {
                "x": minimum_x,
                "y": minimum_y,
                "w": maximum_x - minimum_x + 1,
                "h": maximum_y - minimum_y + 1,
            },
        }
    finally:
        bpy.data.images.remove(image)


def validate_source_path(source_root: Path, asset: dict[str, Any]) -> Path:
    path = Path(asset["sourcePath"]).resolve(strict=True)
    try:
        path.relative_to(source_root)
    except ValueError as error:
        raise RuntimeError(f"asset {asset['sourceId']} path resolves outside source delivery") from error
    if not path.is_file() or path.suffix.lower() != ".glb":
        raise RuntimeError(f"asset {asset['sourceId']} is not a GLB file")
    if path.stat().st_size != asset["bytes"]:
        raise RuntimeError(f"asset {asset['sourceId']} source byte size changed before import")
    if sha256_file(path) != asset["sourceModelSha256"]:
        raise RuntimeError(f"asset {asset['sourceId']} source hash changed before import")
    return path


def render_asset(manifest: dict[str, Any], asset: dict[str, Any], raw_output: Path) -> dict[str, Any]:
    # A complete factory reset between assets clears imported objects, meshes,
    # images, materials and other datablocks, bounding native memory growth.
    bpy.ops.wm.read_factory_settings(use_empty=True)
    source_root = Path(manifest["sourceRoot"]).resolve(strict=True)
    model_path = validate_source_path(source_root, asset)
    before_objects = set(bpy.data.objects)
    result = bpy.ops.import_scene.gltf(filepath=str(model_path))
    if "FINISHED" not in result:
        raise RuntimeError(f"Blender failed to import asset {asset['sourceId']}")
    imported = [obj for obj in bpy.data.objects if obj not in before_objects]

    # Imported lights and cameras are not part of the authored material payload
    # and must not replace the fixed HMH projection convention.
    for obj in list(imported):
        if obj.type in {"CAMERA", "LIGHT"}:
            imported.remove(obj)
            bpy.data.objects.remove(obj, do_unlink=True)
    meshes = [obj for obj in imported if obj.type == "MESH" and not obj.hide_render]
    if not meshes:
        raise RuntimeError(f"asset {asset['sourceId']} contains no renderable mesh")

    points, target = center_and_ground(imported, meshes)
    _, _, size = dimensions(points)
    render = {**manifest["render"], "cameraYawDegrees": asset["cameraYawDegrees"]}
    scene, camera = configure_scene(render, target, max(size))
    fit_orthographic_camera(scene, camera, points, float(manifest["render"]["occupancy"]))

    ground_projection = world_to_camera_view(scene, camera, Vector((0.0, 0.0, 0.0)))
    width = scene.render.resolution_x
    height = scene.render.resolution_y
    pivot = [
        int(round(ground_projection.x * (width - 1))),
        int(round((1.0 - ground_projection.y) * (height - 1))),
    ]
    if not (0 <= pivot[0] < width and 0 <= pivot[1] < height):
        raise RuntimeError(f"asset {asset['sourceId']} measured ground pivot is outside the frame")

    output_path = raw_output / f"{asset['sourceId']}.png"
    scene.render.filepath = str(output_path)
    bpy.context.view_layer.update()
    bpy.ops.render.render(write_still=True)
    audit = audit_render(output_path)
    audit.update({
        "sourceId": asset["sourceId"],
        "file": output_path.name,
        "sourceModelSha256": asset["sourceModelSha256"],
        "renderFileSha256": sha256_file(output_path),
        "pivot": pivot,
        "pivotNormalized": {
            "x": ground_projection.x,
            "y": 1.0 - ground_projection.y,
        },
        "pivotMethod": "world_to_camera_view of normalized XY bounds center at minimum world Z",
        "cameraPitchAxis": "positive-X",
        "cameraPitchDegrees": manifest["render"]["cameraPitchDegrees"],
        "cameraType": "ORTHO",
        "cameraYawDegrees": round(math.degrees(camera.rotation_euler.z) % 360, 4),
        "cameraOpticalAxisWorld": list(camera.matrix_world.to_quaternion() @ Vector((0.0, 0.0, -1.0))),
        "orthoScale": camera.data.ortho_scale,
        "modelDimensions": [size.x, size.y, size.z],
        "materialConcerns": material_concerns(),
    })
    return audit


def main() -> None:
    args = blender_args()
    request_path = Path(args.manifest).resolve(strict=True)
    raw_output = Path(args.raw_output).resolve()
    report_output = Path(args.report_output).resolve()
    if raw_output.exists():
        raise RuntimeError("raw render output already exists; refusing to overwrite it")
    if report_output.exists():
        raise RuntimeError("render report already exists; refusing to overwrite it")
    if not report_output.parent.is_dir():
        raise RuntimeError("render report parent directory does not exist")
    raw_output.mkdir(parents=False, exist_ok=False)

    manifest = json.loads(request_path.read_text(encoding="utf-8"))
    if manifest.get("pipelineId") != "hmh-tripo-static-props/v1":
        raise RuntimeError("unexpected native render pipeline id")
    if manifest.get("classification") != "native-render-candidate" or manifest.get("runtimeAuthority") != "projection-only":
        raise RuntimeError("render request exceeds projection-only candidate scope")
    assets = manifest.get("assets")
    if not isinstance(assets, list) or not assets:
        raise RuntimeError("render request contains no assets")
    if args.source_id is not None:
        assets = [asset for asset in assets if asset.get("sourceId") == args.source_id]
        if len(assets) != 1:
            raise RuntimeError("native source filter must match exactly one requested literal source ID")

    rendered: list[dict[str, Any]] = []
    for asset in assets:
        rendered.append(render_asset(manifest, asset, raw_output))
    bpy.ops.wm.read_factory_settings(use_empty=True)

    report = {
        "status": "pass",
        "pipelineId": manifest["pipelineId"],
        "classification": "native-render-candidate",
        "runtimeAuthority": "projection-only",
        "certified": False,
        "blenderVersion": bpy.app.version_string,
        "blenderVersionTuple": list(bpy.app.version),
        "blenderBuildHash": bpy.app.build_hash.decode("utf-8", errors="replace") if isinstance(bpy.app.build_hash, bytes) else str(bpy.app.build_hash),
        "blenderBuildDate": bpy.app.build_date.decode("utf-8", errors="replace") if isinstance(bpy.app.build_date, bytes) else str(bpy.app.build_date),
        "background": True,
        "factoryStartup": True,
        "autoexecDisabledByLauncher": True,
        "cleanupStrategy": "factory reset before every asset and after the final asset",
        "frameCount": len(rendered),
        "frames": rendered,
    }
    report_output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps({"status": "pass", "frameCount": len(rendered), "blenderVersion": bpy.app.version_string}, sort_keys=True))


if __name__ == "__main__":
    main()

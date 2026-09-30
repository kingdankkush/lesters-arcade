"""HD native render of owner-supplied HMH Tripo props (pipeline hmh-tripo-static-props-hd/v1).

Runs inside Blender. It reuses the camera, lighting, grounding, orthographic fit,
material-concern and audit helpers of the pinned 256 px renderer
(export-hmh-tripo-props.py) without modifying that file, and differs only in:

  * per-asset frame size (512 px or 768 px, requested per item);
  * namespaced asset IDs (b1-NN, b2-NN) spanning both delivery catalogs;
  * extra base-contact metadata: the projected ground footprint corners of the
    model's bounding box base, plus the model's physical dimensions.

Camera contract is otherwise identical: orthographic, 45 deg pitch around +X,
per-item yaw override, film transparent, original materials, single static frame.
Projection-only art; nothing here can alter collision, AI, RNG or results.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import math
import sys
from pathlib import Path
from typing import Any

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

PIPELINE_ID = "hmh-tripo-static-props-hd/v1"
ALLOWED_FRAME_SIZES = (512, 768)


def load_base_renderer() -> Any:
    path = Path(__file__).resolve().with_name("export-hmh-tripo-props.py")
    spec = importlib.util.spec_from_file_location("hmh_tripo_base_renderer", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("base Tripo renderer could not be loaded")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


BASE = load_base_renderer()


def blender_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--raw-output", required=True)
    parser.add_argument("--report-output", required=True)
    parser.add_argument("--asset-id", help="Render exactly one namespaced asset in this fresh native process")
    return parser.parse_args(argv)


def validate_source_path(asset: dict[str, Any]) -> Path:
    path = Path(asset["sourcePath"]).resolve(strict=True)
    source_root = Path(asset["sourceRoot"]).resolve(strict=True)
    try:
        path.relative_to(source_root)
    except ValueError as error:
        raise RuntimeError(f"asset {asset['assetId']} path resolves outside its source delivery") from error
    if not path.is_file() or path.suffix.lower() != ".glb":
        raise RuntimeError(f"asset {asset['assetId']} is not a GLB file")
    if path.stat().st_size != asset["bytes"]:
        raise RuntimeError(f"asset {asset['assetId']} source byte size changed before import")
    if BASE.sha256_file(path) != asset["sourceModelSha256"]:
        raise RuntimeError(f"asset {asset['assetId']} source hash changed before import")
    return path


def project_pixels(scene: Any, camera: Any, point: Vector, width: int, height: int) -> list[float]:
    projected = world_to_camera_view(scene, camera, point)
    return [projected.x * (width - 1), (1.0 - projected.y) * (height - 1)]


def render_asset(manifest: dict[str, Any], asset: dict[str, Any], raw_output: Path) -> dict[str, Any]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    frame_size = asset["frameSize"]
    if frame_size not in ALLOWED_FRAME_SIZES:
        raise RuntimeError(f"asset {asset['assetId']} requests an unsupported frame size {frame_size}")
    model_path = validate_source_path(asset)
    before_objects = set(bpy.data.objects)
    result = bpy.ops.import_scene.gltf(filepath=str(model_path))
    if "FINISHED" not in result:
        raise RuntimeError(f"Blender failed to import asset {asset['assetId']}")
    imported = [obj for obj in bpy.data.objects if obj not in before_objects]
    for obj in list(imported):
        if obj.type in {"CAMERA", "LIGHT"}:
            imported.remove(obj)
            bpy.data.objects.remove(obj, do_unlink=True)
    meshes = [obj for obj in imported if obj.type == "MESH" and not obj.hide_render]
    if not meshes:
        raise RuntimeError(f"asset {asset['assetId']} contains no renderable mesh")

    points, target = BASE.center_and_ground(imported, meshes)
    minimum, maximum, size = BASE.dimensions(points)
    render = {
        **manifest["render"],
        "frameSize": [frame_size, frame_size],
        "cameraYawDegrees": asset["cameraYawDegrees"],
    }
    scene, camera = BASE.configure_scene(render, target, max(size))
    BASE.fit_orthographic_camera(scene, camera, points, float(manifest["render"]["occupancy"]))

    width = scene.render.resolution_x
    height = scene.render.resolution_y
    ground_projection = world_to_camera_view(scene, camera, Vector((0.0, 0.0, 0.0)))
    pivot = [
        int(round(ground_projection.x * (width - 1))),
        int(round((1.0 - ground_projection.y) * (height - 1))),
    ]
    if not (0 <= pivot[0] < width and 0 <= pivot[1] < height):
        raise RuntimeError(f"asset {asset['assetId']} measured ground pivot is outside the frame")
    footprint = [
        project_pixels(scene, camera, Vector((x, y, 0.0)), width, height)
        for x, y in ((minimum.x, minimum.y), (maximum.x, minimum.y), (maximum.x, maximum.y), (minimum.x, maximum.y))
    ]

    output_path = raw_output / f"{asset['assetId']}.png"
    scene.render.filepath = str(output_path)
    bpy.context.view_layer.update()
    bpy.ops.render.render(write_still=True)
    audit = BASE.audit_render(output_path)
    if audit["width"] != frame_size or audit["height"] != frame_size:
        raise RuntimeError(f"asset {asset['assetId']} rendered at an unexpected frame size")
    audit.update({
        "assetId": asset["assetId"],
        "batch": asset["batch"],
        "sourceId": asset["sourceId"],
        "file": output_path.name,
        "frameSize": frame_size,
        "sourceModelSha256": asset["sourceModelSha256"],
        "renderFileSha256": BASE.sha256_file(output_path),
        "pivot": pivot,
        "pivotNormalized": {"x": ground_projection.x, "y": 1.0 - ground_projection.y},
        "pivotMethod": "world_to_camera_view of normalized XY bounds center at minimum world Z",
        "groundFootprintPixels": footprint,
        "groundFootprintMethod": "projected corners of the bounding-box base rectangle at minimum world Z, in frame pixels",
        "cameraPitchAxis": "positive-X",
        "cameraPitchDegrees": manifest["render"]["cameraPitchDegrees"],
        "cameraType": "ORTHO",
        "cameraYawDegrees": round(math.degrees(camera.rotation_euler.z) % 360, 4),
        "cameraOpticalAxisWorld": list(camera.matrix_world.to_quaternion() @ Vector((0.0, 0.0, -1.0))),
        "orthoScale": camera.data.ortho_scale,
        "modelDimensions": [size.x, size.y, size.z],
        "materialConcerns": BASE.material_concerns(),
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
    if manifest.get("pipelineId") != PIPELINE_ID:
        raise RuntimeError("unexpected native render pipeline id")
    if manifest.get("classification") != "native-render-candidate" or manifest.get("runtimeAuthority") != "projection-only":
        raise RuntimeError("render request exceeds projection-only candidate scope")
    assets = manifest.get("assets")
    if not isinstance(assets, list) or not assets:
        raise RuntimeError("render request contains no assets")
    if args.asset_id is not None:
        assets = [asset for asset in assets if asset.get("assetId") == args.asset_id]
        if len(assets) != 1:
            raise RuntimeError("native asset filter must match exactly one requested namespaced asset ID")

    rendered = [render_asset(manifest, asset, raw_output) for asset in assets]
    bpy.ops.wm.read_factory_settings(use_empty=True)

    def text(value: Any) -> str:
        return value.decode("utf-8", errors="replace") if isinstance(value, bytes) else str(value)

    report = {
        "status": "pass",
        "pipelineId": PIPELINE_ID,
        "classification": "native-render-candidate",
        "runtimeAuthority": "projection-only",
        "certified": False,
        "blenderVersion": bpy.app.version_string,
        "blenderVersionTuple": list(bpy.app.version),
        "blenderBuildHash": text(bpy.app.build_hash),
        "blenderBuildDate": text(bpy.app.build_date),
        "background": True,
        "factoryStartup": True,
        "autoexecDisabledByLauncher": True,
        "baseRendererSha256": BASE.sha256_file(Path(BASE.__file__)),
        "cleanupStrategy": "factory reset before every asset and after the final asset",
        "frameCount": len(rendered),
        "frames": rendered,
    }
    report_output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps({"status": "pass", "frameCount": len(rendered), "blenderVersion": bpy.app.version_string}, sort_keys=True))


if __name__ == "__main__":
    main()

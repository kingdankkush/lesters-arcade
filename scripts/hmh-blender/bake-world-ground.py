"""Original seamless Blender ground materials for HMH's close gameplay camera.

Run with Blender 5.1:
  blender --background --factory-startup --python scripts/hmh-blender/bake-world-ground.py -- --output .tmp/world-ground --verify-repeat

Every stochastic texture samples the same four-dimensional periodic torus.
The camera sees its central repeat on an oversized plane: there is no tile-edge
geometry, vignette, perspective or finite light falloff. This is projection-only
art and does not author gameplay geometry. Outputs remain review candidates.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import struct
import sys

import bpy
import numpy as np

MATERIALS = {
    "packed-earth": ("6a5036", "89704b", "af9670", "b9a584", 5.5, 74.0, .27),
    "red-rock": ("754c39", "966647", "bb8660", "c99b72", 7.0, 61.0, .30),
    "wet-bank": ("34382e", "4f503c", "6c6b4e", "7b7760", 5.0, 82.0, .18),
    "forest-floor": ("343b29", "505338", "6c7044", "91836a", 6.0, 59.0, .27),
    "crushed-ore": ("40464a", "646b6c", "818987", "a2a69b", 8.0, 67.0, .31),
    "industrial-slab": ("64645a", "7a7c71", "94958a", "a1a396", 4.5, 108.0, .11),
    "road": ("2d302e", "414540", "535952", "777d71", 4.0, 122.0, .14),
}


def linear_color(value):
    rgb = [int(value[i:i+2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4 for x in rgb) + (1,)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def strip_render_metadata(path):
    """Remove Blender's wall-clock/path text without changing any image bytes."""
    data = path.read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    chunks, offset = [data[:8]], 8
    while offset < len(data):
        length = struct.unpack(">I", data[offset:offset+4])[0]
        kind = data[offset+4:offset+8]
        chunk = data[offset:offset+length+12]
        if kind not in (b"tEXt", b"iTXt", b"zTXt", b"tIME"):
            chunks.append(chunk)
        offset += length + 12
    assert offset == len(data)
    path.write_bytes(b"".join(chunks))


def material(name, spec):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()

    def node(kind, name):
        value = nodes.new(kind)
        value.label = name
        value.name = name
        return value

    def math_node(operation, a, b=None, label=None):
        value = node("ShaderNodeMath", label or operation)
        value.operation = operation
        if hasattr(a, "node"):
            links.new(a, value.inputs[0])
        else:
            value.inputs[0].default_value = a
        if b is not None:
            if hasattr(b, "node"):
                links.new(b, value.inputs[1])
            else:
                value.inputs[1].default_value = b
        return value.outputs[0]

    uv = node("ShaderNodeTexCoord", "Periodic tile UV")
    split = node("ShaderNodeSeparateXYZ", "Tile coordinates")
    links.new(uv.outputs["UV"], split.inputs[0])
    u = math_node("MULTIPLY", split.outputs["X"], math.tau)
    v = math_node("MULTIPLY", split.outputs["Y"], math.tau)
    coords = node("ShaderNodeCombineXYZ", "Torus xyz")
    for socket, component in zip(coords.inputs, (math_node("COSINE", u), math_node("SINE", u), math_node("COSINE", v))):
        links.new(component, socket)
    fourth = math_node("SINE", v, label="Torus fourth dimension")

    def noise(scale, detail, label):
        value = node("ShaderNodeTexNoise", label)
        value.noise_dimensions = "4D"
        links.new(coords.outputs[0], value.inputs["Vector"])
        links.new(fourth, value.inputs["W"])
        value.inputs["Scale"].default_value = scale
        value.inputs["Detail"].default_value = detail
        value.inputs["Roughness"].default_value = .63
        return value.outputs["Fac"]

    def ramp(source, colors, label):
        value = node("ShaderNodeValToRGB", label)
        value.color_ramp.interpolation = "EASE"
        while len(value.color_ramp.elements) > 2:
            value.color_ramp.elements.remove(value.color_ramp.elements[-1])
        value.color_ramp.elements[0].position = colors[0][0]
        value.color_ramp.elements[0].color = linear_color(colors[0][1])
        value.color_ramp.elements[1].position = colors[-1][0]
        value.color_ramp.elements[1].color = linear_color(colors[-1][1])
        for position, color in colors[1:-1]:
            value.color_ramp.elements.new(position).color = linear_color(color)
        links.new(source, value.inputs[0])
        return value.outputs["Color"]

    dark, mid, light, fleck, broad_scale, grit_scale, bump_strength = spec
    broad = noise(broad_scale, 3, "Restrained material variation")
    fine = noise(grit_scale, 2, "Fine aggregate")
    base = ramp(broad, ((.18, dark), (.5, mid), (.83, light)), "Natural ground palette")
    grain = ramp(fine, ((.24, dark), (.5, mid), (.76, fleck)), "Fine-grain palette")
    mixed = node("ShaderNodeMixRGB", "Matte fine detail")
    mixed.blend_type = "MIX"
    mixed.inputs[0].default_value = .28 if name != "industrial-slab" else .15
    links.new(base, mixed.inputs[1])
    links.new(grain, mixed.inputs[2])
    color = mixed.outputs[0]

    if name in ("forest-floor", "crushed-ore", "red-rock"):
        cellular = node("ShaderNodeTexVoronoi", "Small angular fragments")
        cellular.voronoi_dimensions = "4D"
        cellular.feature = "DISTANCE_TO_EDGE"
        links.new(coords.outputs[0], cellular.inputs["Vector"])
        links.new(fourth, cellular.inputs["W"])
        cellular.inputs["Scale"].default_value = 11 if name == "forest-floor" else 17
        cracks = math_node("LESS_THAN", cellular.outputs["Distance"], .035)
        crack_mix = node("ShaderNodeMixRGB", "Fine fragment boundaries")
        crack_mix.inputs[2].default_value = linear_color(dark)
        links.new(math_node("MULTIPLY", cracks, .17), crack_mix.inputs[0])
        links.new(color, crack_mix.inputs[1])
        color = crack_mix.outputs[0]

        if name in ("forest-floor", "crushed-ore"):
            chips = node("ShaderNodeTexVoronoi", "Leaf litter" if name == "forest-floor" else "Slate chips")
            chips.voronoi_dimensions = "4D"
            chips.feature = "F1"
            links.new(coords.outputs[0], chips.inputs["Vector"])
            links.new(fourth, chips.inputs["W"])
            chips.inputs["Scale"].default_value = cellular.inputs["Scale"].default_value
            channels = node("ShaderNodeSeparateColor", "Fragment variation")
            channels.mode = "RGB"
            links.new(chips.outputs["Color"], channels.inputs[0])
            selected = math_node("GREATER_THAN", channels.outputs[0], .83 if name == "forest-floor" else .71)
            interior = math_node("GREATER_THAN", cellular.outputs["Distance"], .045)
            flecks = node("ShaderNodeMixRGB", "Flat small fragments")
            links.new(math_node("MULTIPLY", math_node("MULTIPLY", selected, interior), .52), flecks.inputs[0])
            links.new(color, flecks.inputs[1])
            flecks.inputs[2].default_value = linear_color(fleck)
            color = flecks.outputs[0]

    if name == "red-rock":
        strata = math_node("ADD", math_node("MULTIPLY", v, 19), math_node("MULTIPLY", broad, 19))
        line = math_node("GREATER_THAN", math_node("SINE", strata), .965)
        worn = math_node("GREATER_THAN", noise(9, 2, "Interrupted strata"), .53)
        layers = node("ShaderNodeMixRGB", "Weathered thin strata")
        links.new(math_node("MULTIPLY", math_node("MULTIPLY", line, worn), .15), layers.inputs[0])
        links.new(color, layers.inputs[1])
        layers.inputs[2].default_value = linear_color(dark)
        color = layers.outputs[0]

    bump = node("ShaderNodeBump", "Restrained micro relief")
    bump.inputs["Strength"].default_value = bump_strength
    bump.inputs["Distance"].default_value = .006
    links.new(fine, bump.inputs["Height"])
    surface = node("ShaderNodeBsdfPrincipled", "Matte ground surface")
    surface.inputs["Roughness"].default_value = .97
    surface.inputs["Specular IOR Level"].default_value = .12
    links.new(color, surface.inputs["Base Color"])
    links.new(bump.outputs["Normal"], surface.inputs["Normal"])
    output = node("ShaderNodeOutputMaterial", "Material output")
    links.new(surface.outputs[0], output.inputs[0])
    # Stable node positions make the saved native material library editable.
    for index, value in enumerate(nodes):
        value.location = ((index % 6) * 230, -(index // 6) * 240)
    mat.use_fake_user = True
    return mat


def scene_setup(size):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 16
    scene.cycles.use_denoising = False
    scene.cycles.seed = 42819
    scene.cycles.use_animated_seed = False
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 2
    scene.render.resolution_x = scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    scene.render.dither_intensity = 0
    scene.world = bpy.data.worlds.new("Uniform daylight")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (1, 1, 1, 1)
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = .45
    bpy.ops.mesh.primitive_plane_add(size=10)
    ground = bpy.context.object
    ground.name = "Oversized seamless ground plane"
    for loop in ground.data.uv_layers.active.data:
        loop.uv = (loop.uv.x * 5 - 2, loop.uv.y * 5 - 2)
    bpy.ops.object.camera_add(location=(0, 0, 8))
    camera = bpy.context.object
    camera.name = "Orthographic material bake camera"
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 2
    camera.rotation_euler = (0, 0, 0)
    scene.camera = camera
    bpy.ops.object.light_add(type="SUN", location=(0, 0, 4))
    sun = bpy.context.object
    sun.name = "Uniform soft key"
    sun.rotation_euler = (math.radians(25), math.radians(-18), math.radians(-25))
    sun.data.energy = 1.65
    sun.data.angle = math.radians(12)
    return scene, ground


def pixels(path):
    image = bpy.data.images.load(str(path), check_existing=False)
    data = np.array(image.pixels[:], dtype=np.float32).reshape(image.size[1], image.size[0], 4)
    bpy.data.images.remove(image)
    return data


def metrics(data):
    rgb = data[:, :, :3]
    dx, dy = np.abs(np.diff(rgb, axis=1)), np.abs(np.diff(rgb, axis=0))
    xseam, yseam = np.abs(rgb[:, 0] - rgb[:, -1]), np.abs(rgb[0] - rgb[-1])
    return {
        "horizontalSeamMean": float(xseam.mean()), "verticalSeamMean": float(yseam.mean()),
        "interiorHorizontalMean": float(dx.mean()), "interiorVerticalMean": float(dy.mean()),
        "horizontalSeamToInterior": float(xseam.mean() / max(1e-8, dx.mean())),
        "verticalSeamToInterior": float(yseam.mean() / max(1e-8, dy.mean())),
        "opaque": bool(np.all(data[:, :, 3] == 1)),
        "rgbMean": [float(value) for value in rgb.mean(axis=(0, 1))],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path(".tmp/world-ground"))
    parser.add_argument("--verify-repeat", action="store_true")
    parser.add_argument("--resume", action="store_true", help="Resume from the saved native scene without rerendering completed images.")
    parser.add_argument("--size", type=int, default=512)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    out = args.output.resolve()
    out.mkdir(parents=True, exist_ok=True)
    native_path = out / "hmh-world-ground-materials.blend"
    if args.resume:
        bpy.ops.wm.open_mainfile(filepath=str(native_path))
        scene = bpy.context.scene
        ground = bpy.data.objects["Oversized seamless ground plane"]
        mats = {name: bpy.data.materials[name] for name in MATERIALS}
        assert scene.render.resolution_x == scene.render.resolution_y == args.size
    else:
        scene, ground = scene_setup(args.size)
        mats = {name: material(name, spec) for name, spec in MATERIALS.items()}
        ground.data.materials.append(mats["packed-earth"])
        bpy.ops.wm.save_as_mainfile(filepath=str(native_path))
    rows = []
    tile_data = []
    for name, mat in mats.items():
        ground.data.materials[0] = mat
        path = out / f"{name}.png"
        if not args.resume or not path.exists():
            scene.render.filepath = str(path)
            bpy.ops.render.render(write_still=True)
        strip_render_metadata(path)
        original = pixels(path)
        row = {"id": name, "file": path.name, "sha256": sha(path), "size": [args.size, args.size], **metrics(original)}
        tile_data.append(original)
        if args.verify_repeat:
            repeated = out / "repeat" / path.name
            repeated.parent.mkdir(exist_ok=True)
            if not args.resume or not repeated.exists():
                scene.render.filepath = str(repeated)
                bpy.ops.render.render(write_still=True)
            strip_render_metadata(repeated)
            other = pixels(repeated)
            row["repeatSha256"] = sha(repeated)
            row["repeatPixelExact"] = bool(np.array_equal(original, other))
            row["repeatFileExact"] = row["sha256"] == row["repeatSha256"]
            if not row["repeatPixelExact"]:
                raise RuntimeError(f"Nonreproducible material pixels: {name}")
            if not row["repeatFileExact"]:
                raise RuntimeError(f"Nonreproducible normalized PNG bytes: {name}")
        if max(row["horizontalSeamToInterior"], row["verticalSeamToInterior"]) > 1.5:
            raise RuntimeError(f"Material border exceeds ordinary interior variation: {name}: {row}")
        rows.append(row)
        print("WORLD_GROUND_MATERIAL " + json.dumps(row), flush=True)
    gap = 12
    w, h = 4 * args.size + 5 * gap, 2 * args.size + 3 * gap
    sheet = np.zeros((h, w, 4), dtype=np.float32)
    sheet[:, :, :3] = .025
    sheet[:, :, 3] = 1
    for index, data in enumerate(tile_data):
        x, y = gap + index % 4 * (args.size + gap), gap + (1 - index // 4) * (args.size + gap)
        sheet[y:y+args.size, x:x+args.size] = data
    image = bpy.data.images.new("Material review contact sheet", width=w, height=h, alpha=True)
    image.pixels.foreach_set(sheet.ravel())
    image.filepath_raw = str(out / "contact-sheet.png")
    image.file_format = "PNG"
    image.save()
    report = {
        "pipeline": "hmh-blender-ground-v1", "status": "review-candidate",
        "blenderVersion": bpy.app.version_string, "engine": scene.render.engine,
        "samples": scene.cycles.samples, "seed": scene.cycles.seed,
        "sourceScriptSha256": sha(Path(__file__)), "nativeSource": "hmh-world-ground-materials.blend",
        "nativeSourceSha256": sha(out / "hmh-world-ground-materials.blend"),
        "license": "Original project-authored procedural Blender materials; no external texture inputs.",
        "seamMethod": "4D torus of sine/cosine UV; one period in both axes; oversized plane and uniform sun/world. Opposing pixel centers are adjacent samples, not duplicated edge pixels.",
        "repeatVerified": args.verify_repeat,
        "resumedFromSavedNativeScene": args.resume,
        "pngNormalization": "Only volatile text/time metadata chunks removed; IDAT compressed pixels and color-space chunks unchanged.",
        "contactSheetOrder": list(MATERIALS), "materials": rows,
    }
    (out / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    print("WORLD_GROUND_COMPLETE " + str(out), flush=True)


if __name__ == "__main__":
    main()

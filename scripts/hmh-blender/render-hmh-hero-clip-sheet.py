"""Offline clip inspection: one rendered frame per library clip of one hero.

``--render`` runs under Blender (GPU): re-imports the exported GLB, activates
each library clip's NLA track at the requested normalised time and renders a
small Eevee still with the pilot inspection light rig. ``--compose`` runs under
plain Python with Pillow and tiles the stills into a labelled contact sheet.
This is a model inspection, never a game screenshot, and it does not change
any asset.

blender -b --python this.py -- --render --hero lilly --time 0.5
python this.py --compose --hero lilly
"""
import argparse
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SHEET_DIR = ROOT / "docs/2.0/receipts/hmh-hero-clips-20260930"
FRAME_DIR = ROOT / ".tmp/hmh-actor-3d-pilot/clip-sheet"
HEROES = ("lit-commando", "lilly", "lit-valkyrie", "lester-original")


def render(hero, time_fraction, size):
    import bpy
    from mathutils import Vector
    manifest = json.loads((ROOT / "apps/portal/assets/generated/hmh-actor-3d-pilot" / f"{hero}-clips.json").read_text(encoding="utf-8"))
    names = [clip["name"] for clip in manifest["libraryClips"]]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / "apps/portal/assets/generated/hmh-actor-3d-pilot" / f"{hero}.glb"))
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = "PNG"
    scene.world = bpy.data.worlds.new("Clip sheet world")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (.10, .11, .14, 1)
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = .5
    scene.view_settings.view_transform = "AgX"
    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 2.9
    target = Vector((0, 0, .95))
    camera.location = Vector((2.4, -3.2, target.z + 3.2 / math.tan(math.radians(55))))
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera
    for name, position, energy, color, light_size in [("key", (3, -4, 6), 900, (1, .9, .8), 3), ("fill", (-4, -2, 3), 420, (.7, .8, 1), 2.6), ("rim", (2, 3, 5), 600, (1, .85, .7), 2.2)]:
        bpy.ops.object.light_add(type="AREA", location=position)
        light = bpy.context.object
        light.data.energy, light.data.color, light.data.shape, light.data.size = energy, color, "DISK", light_size
        light.rotation_euler = (target - light.location).to_track_quat("-Z", "Y").to_euler()
    bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, 0))
    floor = bpy.context.object
    material = bpy.data.materials.new("Clip sheet floor")
    material.use_nodes = True
    material.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (.22, .2, .17, 1)
    floor.data.materials.append(material)
    FRAME_DIR.mkdir(parents=True, exist_ok=True)
    rendered = []
    for clip in names:
        ranges = []
        for obj in bpy.data.objects:
            if obj.type == "ARMATURE":
                for bone in obj.pose.bones:
                    bone.matrix_basis.identity()  # unkeyed joints rest, as in glTF
            adt = obj.animation_data
            if not adt:
                continue
            adt.action = None
            for track in adt.nla_tracks:
                track.mute = track.name != clip
                if track.name == clip:
                    ranges.extend((strip.frame_start, strip.frame_end) for strip in track.strips)
        if not ranges:
            raise RuntimeError("clip track missing after import: " + clip)
        start, end = min(r[0] for r in ranges), max(r[1] for r in ranges)
        frame = start + (end - start) * time_fraction
        # Consecutive clips sample the same frame number; muting tracks alone does
        # not always re-evaluate the armature, so step through a neighbour frame.
        scene.frame_set(int(frame) + 1)
        bpy.context.view_layer.update()
        scene.frame_set(int(frame), subframe=frame % 1)
        bpy.context.view_layer.update()
        scene.render.filepath = str(FRAME_DIR / f"{hero}--{clip}--{time_fraction:.2f}.png")
        bpy.ops.render.render(write_still=True)
        rendered.append(scene.render.filepath)
    (FRAME_DIR / f"{hero}-{time_fraction:.2f}-index.json").write_text(json.dumps({"hero": hero, "time": time_fraction, "frames": rendered}), encoding="utf-8")
    print("HMH_CLIP_SHEET_FRAMES=" + str(len(rendered)))


def compose(hero, times, columns, size):
    from PIL import Image, ImageDraw
    manifest = json.loads((ROOT / "apps/portal/assets/generated/hmh-actor-3d-pilot" / f"{hero}-clips.json").read_text(encoding="utf-8"))
    names = [clip["name"] for clip in manifest["libraryClips"]]
    cell_w = size * len(times)
    cell_h = size + 18
    rows = math.ceil(len(names) / columns)
    sheet = Image.new("RGB", (columns * cell_w, rows * cell_h), (16, 16, 20))
    draw = ImageDraw.Draw(sheet)
    for index, clip in enumerate(names):
        x0, y0 = (index % columns) * cell_w, (index // columns) * cell_h
        for t_index, t in enumerate(times):
            frame = Image.open(FRAME_DIR / f"{hero}--{clip}--{t:.2f}.png").convert("RGB").resize((size, size))
            sheet.paste(frame, (x0 + t_index * size, y0 + 18))
        draw.text((x0 + 4, y0 + 3), f"{clip} t={'/'.join(f'{t:g}' for t in times)}", fill=(240, 240, 240))
    SHEET_DIR.mkdir(parents=True, exist_ok=True)
    output = SHEET_DIR / f"{hero}-clip-contact-sheet.png"
    sheet.save(output, optimize=True)
    print("HMH_CLIP_SHEET=" + str(output))


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--render", action="store_true")
    parser.add_argument("--compose", action="store_true")
    parser.add_argument("--hero", choices=HEROES, required=True)
    parser.add_argument("--time", type=float, action="append")
    parser.add_argument("--size", type=int, default=224)
    parser.add_argument("--columns", type=int, default=6)
    args = parser.parse_args(argv)
    times = args.time or [.5]
    if args.render:
        for t in times:
            render(args.hero, t, args.size)
    if args.compose:
        compose(args.hero, times, args.columns, args.size)


if __name__ == "__main__":
    main()

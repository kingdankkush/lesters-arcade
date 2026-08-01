from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

# --- shared art direction -------------------------------------------------
# Every authored-asset pipeline reads the same rig so heroes, enemies and props
# light identically. See scripts/hmh-blender/hmh-light-rig.json.
import json as _rig_json
from pathlib import Path as _RigPath


def load_shared_light_rig():
    path = _RigPath(__file__).resolve().parent / "hmh-light-rig.json"
    rig = _rig_json.loads(path.read_text(encoding="utf-8"))
    if rig.get("id") != "hmh-shared-light-rig-v1":
        raise SystemExit("unexpected light rig id: " + str(rig.get("id")))
    return rig


def shared_light_channels(family):
    rig = load_shared_light_rig()
    energy = rig["energy"][family]
    return [
        (channel, tuple(rig["colors"][channel]), energy[channel])
        for channel in ("key", "fill", "rim")
    ]




def blender_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument('--manifest', required=True)
    parser.add_argument('--source-blend', required=True)
    parser.add_argument('--inspection-output', required=True)
    return parser.parse_args(argv)


def rgba(value: str, alpha: float = 1.0):
    token = value.removeprefix('#')
    return tuple(int(token[index:index + 2], 16) / 255 for index in (0, 2, 4)) + (alpha,)


def material(name: str, color: str, *, metallic: float = 0.0, emission: float = 0.0, roughness: float = 0.72):
    mat = bpy.data.materials.new(name)
    color_value = rgba(color)
    mat.diffuse_color = color_value
    mat.use_nodes = True
    node = mat.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value = color_value
    node.inputs['Roughness'].default_value = roughness
    node.inputs['Metallic'].default_value = metallic
    if emission:
        node.inputs['Emission Color'].default_value = color_value
        node.inputs['Emission Strength'].default_value = emission
    return mat


def tag(obj, asset_id: str):
    obj['hmh_asset_id'] = asset_id
    obj['hmh_runtime_authority'] = 'projection-only'
    obj.hide_render = True
    return obj


def cube(name, location, scale, mat, asset_id, *, rotation=(0.0, 0.0, 0.0), bevel=0.035):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new('Authored bevel', 'BEVEL')
        modifier.width = bevel
        modifier.segments = 2
    obj.data.materials.append(mat)
    return tag(obj, asset_id)


def cylinder(name, location, radius, depth, mat, asset_id, *, rotation=(0.0, 0.0, 0.0), vertices=20):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return tag(obj, asset_id)


def sphere(name, location, scale, mat, asset_id):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.ops.object.shade_smooth()
    obj.data.materials.append(mat)
    return tag(obj, asset_id)


def cone(name, location, radius, depth, mat, asset_id, *, rotation=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_cone_add(vertices=18, radius1=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return tag(obj, asset_id)


def torus(name, location, major, minor, mat, asset_id, *, rotation=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=28, minor_segments=8, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return tag(obj, asset_id)


def tone(hex_color: str, factor: float) -> str:
    """Deterministically lighten/darken a hex colour for per-part variation."""
    value = hex_color.lstrip('#')
    r, g, b = (int(value[i:i + 2], 16) for i in (0, 2, 4))
    return '#%02x%02x%02x' % tuple(max(0, min(255, round(channel * factor))) for channel in (r, g, b))


def prism_mesh(name, profile, y_min, y_max, mat, asset_id, *, location=(0.0, 0.0, 0.0)):
    """One flat-shaded solid extruded from an (x, z) profile polygon.

    Explicit vertex/face authorship: fully deterministic, no modifiers, no
    bevel. Crisp joined silhouettes are what the beveled-primitive assembly
    could not produce at the 55-degree camera.
    """
    count = len(profile)
    verts = [(x, y_min, z) for x, z in profile] + [(x, y_max, z) for x, z in profile]
    faces = [list(range(count - 1, -1, -1)), list(range(count, 2 * count))]
    for index in range(count):
        nxt = (index + 1) % count
        faces.append([index, nxt, count + nxt, count + index])
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    obj.data.materials.append(mat)
    for poly in mesh.polygons:
        poly.use_smooth = False
    bpy.context.scene.collection.objects.link(obj)
    tag(obj, asset_id)
    return obj


def build_asset(asset: dict) -> dict:
    asset_id = asset['assetId']
    shape = asset['shape']
    palette = asset['palette']
    primary = material(f'{asset_id}_primary', palette['primary'], metallic=0.12, roughness=0.68)
    secondary = material(f'{asset_id}_secondary', palette['secondary'], metallic=0.18, roughness=0.74)
    emissive_world_shapes = {'pylon', 'crystal', 'beacon', 'console', 'terminal'}
    accent_emission = 0.42 if asset['category'] == 'world-prop' and shape in emissive_world_shapes else 0.0 if asset['category'] == 'world-prop' else 0.65
    accent = material(f'{asset_id}_accent', palette['accent'], metallic=0.1, emission=accent_emission, roughness=0.68 if asset['category'] == 'world-prop' else 0.55)
    parts = []
    add = parts.append

    if shape == 'pistol':
        add(cube(f'{asset_id}_Receiver', (0.0, 0.0, 0.72), (0.42, 0.10, 0.13), primary, asset_id))
        add(cylinder(f'{asset_id}_Barrel', (0.43, 0.0, 0.74), 0.075, 0.34, secondary, asset_id, rotation=(0.0, math.radians(90), 0.0)))
        add(cube(f'{asset_id}_Grip', (-0.17, 0.0, 0.44), (0.10, 0.11, 0.28), secondary, asset_id, rotation=(0.0, math.radians(-12), 0.0)))
        add(cylinder(f'{asset_id}_Coin', (0.05, -0.13, 0.77), 0.12, 0.035, accent, asset_id, rotation=(math.radians(90), 0.0, 0.0)))
    elif shape == 'shotgun':
        add(cube(f'{asset_id}_Stock', (-0.35, 0.0, 0.58), (0.27, 0.14, 0.16), primary, asset_id, rotation=(0.0, math.radians(-8), 0.0)))
        for y in (-0.065, 0.065): add(cylinder(f'{asset_id}_Barrel_{y}', (0.28, y, 0.72), 0.055, 0.88, secondary, asset_id, rotation=(0.0, math.radians(90), 0.0)))
        add(cube(f'{asset_id}_Pump', (0.12, 0.0, 0.64), (0.18, 0.16, 0.12), primary, asset_id))
        add(cube(f'{asset_id}_Sight', (0.55, 0.0, 0.82), (0.035, 0.035, 0.07), accent, asset_id))
    elif shape == 'minigun':
        add(cube(f'{asset_id}_Body', (-0.15, 0.0, 0.65), (0.28, 0.22, 0.22), primary, asset_id))
        for y in (-0.10, 0.0, 0.10): add(cylinder(f'{asset_id}_Barrel_{y}', (0.35, y, 0.68), 0.035, 0.72, secondary, asset_id, rotation=(0.0, math.radians(90), 0.0), vertices=16))
        add(cylinder(f'{asset_id}_Drum', (-0.12, 0.0, 0.39), 0.20, 0.30, secondary, asset_id, rotation=(math.radians(90), 0.0, 0.0)))
        add(torus(f'{asset_id}_GlowRing', (0.02, -0.23, 0.65), 0.15, 0.026, accent, asset_id, rotation=(math.radians(90), 0.0, 0.0)))
    elif shape == 'launcher':
        add(cylinder(f'{asset_id}_Tube', (0.10, 0.0, 0.68), 0.17, 1.02, primary, asset_id, rotation=(0.0, math.radians(90), 0.0)))
        add(cylinder(f'{asset_id}_Muzzle', (0.58, 0.0, 0.68), 0.24, 0.16, secondary, asset_id, rotation=(0.0, math.radians(90), 0.0)))
        add(cube(f'{asset_id}_Grip', (-0.12, 0.0, 0.40), (0.10, 0.12, 0.25), secondary, asset_id))
        add(cube(f'{asset_id}_Sight', (0.12, -0.19, 0.82), (0.14, 0.06, 0.06), accent, asset_id))
    elif shape == 'life-token':
        # A med kit with a bold cross on its lid. The previous sphere-and-halo
        # read as a featureless circle from above, which is the single most
        # important pickup in the game to identify instantly.
        add(cube(f'{asset_id}_Case', (0.0, 0.0, 0.42), (0.46, 0.40, 0.26), primary, asset_id))
        add(cube(f'{asset_id}_Lid', (0.0, 0.0, 0.60), (0.48, 0.42, 0.06), secondary, asset_id))
        add(cube(f'{asset_id}_CrossBar', (0.0, 0.0, 0.66), (0.30, 0.10, 0.05), accent, asset_id))
        add(cube(f'{asset_id}_CrossStem', (0.0, 0.0, 0.66), (0.10, 0.30, 0.05), accent, asset_id))
        add(cube(f'{asset_id}_Handle', (0.0, -0.34, 0.56), (0.16, 0.05, 0.08), secondary, asset_id))
    elif shape == 'rail-core':
        # Ribbed ammo cell: a squat ringed cylinder with a lit terminal cap.
        # The old double cone read as a diamond, indistinguishable from the
        # other cone-shaped power-ups at gameplay scale.
        add(cylinder(f'{asset_id}_Cell', (0.0, 0.0, 0.50), 0.34, 0.66, primary, asset_id))
        for z in (0.30, 0.50, 0.70):
            add(torus(f'{asset_id}_Rib_{int(z * 100)}', (0.0, 0.0, z), 0.35, 0.035, secondary, asset_id))
        add(cylinder(f'{asset_id}_Cap', (0.0, 0.0, 0.90), 0.17, 0.16, accent, asset_id))
    elif shape == 'hourglass':
        add(cone(f'{asset_id}_Upper', (0.0, 0.0, 0.82), 0.28, 0.45, primary, asset_id, rotation=(math.pi, 0.0, 0.0)))
        add(cone(f'{asset_id}_Lower', (0.0, 0.0, 0.38), 0.28, 0.45, primary, asset_id))
        add(cube(f'{asset_id}_Top', (0.0, 0.0, 1.04), (0.36, 0.24, 0.055), secondary, asset_id))
        add(cube(f'{asset_id}_Base', (0.0, 0.0, 0.16), (0.36, 0.24, 0.055), secondary, asset_id))
        add(sphere(f'{asset_id}_Sand', (0.0, -0.05, 0.60), (0.09, 0.09, 0.13), accent, asset_id))
    elif shape == 'candle':
        # Wide dish holder gives the candle a ringed footprint distinct from
        # the bomb's solid circle and the cell's ribbed barrel.
        add(cylinder(f'{asset_id}_Dish', (0.0, 0.0, 0.14), 0.40, 0.10, secondary, asset_id))
        add(torus(f'{asset_id}_DishRim', (0.0, 0.0, 0.18), 0.40, 0.05, secondary, asset_id))
        add(cylinder(f'{asset_id}_Wax', (0.0, 0.0, 0.52), 0.18, 0.62, primary, asset_id))
        add(cone(f'{asset_id}_FlameOuter', (0.0, 0.0, 1.00), 0.16, 0.38, accent, asset_id))
        add(cone(f'{asset_id}_FlameInner', (0.0, -0.06, 1.02), 0.08, 0.26, accent, asset_id))
    elif shape == 'nuke':
        # Round bomb with four radial fins: a circular footprint broken by
        # spokes, which cannot be confused with a cone or a cell from above.
        add(sphere(f'{asset_id}_Core', (0.0, 0.0, 0.52), (0.40, 0.40, 0.38), primary, asset_id))
        add(cylinder(f'{asset_id}_Fuse', (0.0, 0.0, 0.94), 0.05, 0.26, secondary, asset_id))
        add(sphere(f'{asset_id}_Spark', (0.0, 0.0, 1.10), (0.11, 0.11, 0.11), accent, asset_id))
        for angle in (45, 135, 225, 315):
            r = math.radians(angle)
            add(cube(f'{asset_id}_Fin_{angle}', (math.sin(r) * 0.40, math.cos(r) * 0.40, 0.30),
                     (0.07, 0.20, 0.16), secondary, asset_id, rotation=(0.0, 0.0, r)))
    elif shape.endswith('-chip'):
        add(cylinder(f'{asset_id}_Chip', (0.0, 0.0, 0.62), 0.42, 0.12, primary, asset_id, rotation=(math.radians(90), 0.0, 0.0), vertices=8))
        add(torus(f'{asset_id}_Ring', (0.0, -0.08, 0.62), 0.30, 0.045, accent, asset_id, rotation=(math.radians(90), 0.0, 0.0)))
        if shape == 'health-chip':
            add(cube(f'{asset_id}_H', (0.0, -0.16, 0.62), (0.08, 0.025, 0.25), accent, asset_id)); add(cube(f'{asset_id}_V', (0.0, -0.16, 0.62), (0.25, 0.025, 0.08), accent, asset_id))
        elif shape == 'grenade-chip':
            add(sphere(f'{asset_id}_Grenade', (0.0, -0.18, 0.60), (0.15, 0.04, 0.20), accent, asset_id)); add(cube(f'{asset_id}_Pin', (0.0, -0.18, 0.84), (0.09, 0.03, 0.05), accent, asset_id))
        else:
            bars = {'damage-chip':3, 'rate-chip':4, 'reload-chip':2, 'dash-chip':5}.get(shape, 3)
            for index in range(bars): add(cube(f'{asset_id}_Mark_{index}', ((index-(bars-1)/2)*0.11, -0.16, 0.56+index*0.035), (0.035, 0.025, 0.12+index*0.02), accent, asset_id))
    elif shape in {'console','terminal'}:
        add(cube(f'{asset_id}_Base', (0.0, 0.05, 0.36), (0.42, 0.30, 0.34), primary, asset_id))
        add(cube(f'{asset_id}_Screen', (0.0, -0.28, 0.68), (0.32, 0.035, 0.20), accent, asset_id, rotation=(math.radians(-12), 0.0, 0.0)))
        add(cube(f'{asset_id}_Foot', (0.0, 0.0, 0.08), (0.50, 0.36, 0.08), secondary, asset_id))
    elif shape == 'crate':
        add(cube(f'{asset_id}_Box', (0.0, 0.0, 0.40), (0.46, 0.38, 0.38), primary, asset_id, bevel=0.025))
        for x in (-0.40, 0.40): add(cube(f'{asset_id}_Band_{x}', (x, -0.40, 0.40), (0.045, 0.03, 0.36), secondary, asset_id))
        add(cube(f'{asset_id}_Mark', (0.0, -0.41, 0.42), (0.16, 0.025, 0.10), accent, asset_id))
    elif shape in {'pylon','bollard','beacon'}:
        add(cylinder(f'{asset_id}_Post', (0.0, 0.0, 0.46), 0.16 if shape != 'pylon' else 0.24, 0.82, primary, asset_id))
        if shape == 'pylon':
            # A faceted energy orb avoids the coplanar cap/post seam that made
            # one Eevee pixel unstable across otherwise identical renders.
            add(sphere(f'{asset_id}_Cap', (0.0, 0.0, 0.98), (0.24, 0.24, 0.24), accent, asset_id))
        else:
            add(cone(f'{asset_id}_Cap', (0.0, 0.0, 0.96), 0.24, 0.28, accent, asset_id))
        add(cylinder(f'{asset_id}_Foot', (0.0, 0.0, 0.08), 0.32, 0.14, secondary, asset_id))
    elif shape == 'stump':
        add(cylinder(f'{asset_id}_Trunk', (0.0, 0.0, 0.38), 0.34, 0.68, primary, asset_id, vertices=12))
        add(cylinder(f'{asset_id}_Rings', (0.0, 0.0, 0.75), 0.29, 0.035, accent, asset_id, vertices=12))
        for angle in (20, 160, 280):
            r=math.radians(angle); add(cube(f'{asset_id}_Root_{angle}', (math.sin(r)*0.35, math.cos(r)*0.35, 0.12), (0.10,0.28,0.10), secondary, asset_id, rotation=(0,0,-r)))
    elif shape == 'crystal':
        for index, (x,z,s) in enumerate(((-0.22,0.42,0.28),(0.06,0.62,0.38),(0.28,0.34,0.22))): add(cone(f'{asset_id}_Shard_{index}', (x,0.0,z), s, s*2.3, accent if index==1 else primary, asset_id))
        add(cube(f'{asset_id}_Rock', (0.0,0.08,0.12), (0.42,0.30,0.12), secondary, asset_id))
    elif shape == 'ore-cart':
        add(cube(f'{asset_id}_Bin', (0.0,0.0,0.45), (0.48,0.34,0.28), primary, asset_id, rotation=(0,math.radians(8),0)))
        for x in (-0.34,0.34): add(cylinder(f'{asset_id}_Wheel_{x}', (x,-0.34,0.18), 0.16, 0.08, secondary, asset_id, rotation=(math.radians(90),0,0)))
        for x in (-0.18,0.05,0.24): add(sphere(f'{asset_id}_Ore_{x}', (x,-0.04,0.76), (0.16,0.14,0.14), accent, asset_id))
    elif shape in {'barrel','fuel-drum'}:
        add(cylinder(f'{asset_id}_Drum', (0.0,0.0,0.46), 0.31, 0.84, primary, asset_id, vertices=20))
        for z in (0.17,0.73): add(torus(f'{asset_id}_Band_{z}', (0.0,0.0,z), 0.31, 0.035, secondary, asset_id))
        add(cube(f'{asset_id}_Stripe', (0.0,-0.31,0.48), (0.20,0.025,0.08), accent, asset_id))
    elif shape == 'barricade':
        for z,angle in ((0.38,16),(0.68,-14)): add(cube(f'{asset_id}_Plank_{z}', (0.0,0.0,z), (0.62,0.12,0.10), primary, asset_id, rotation=(0,0,math.radians(angle))))
        for x in (-0.42,0.42): add(cube(f'{asset_id}_Leg_{x}', (x,0.0,0.34), (0.08,0.12,0.40), secondary, asset_id, rotation=(0,math.radians(x*14),0)))
        add(cube(f'{asset_id}_Warning', (0.0,-0.13,0.55), (0.16,0.025,0.07), accent, asset_id))
    elif shape == 'pine-tree':
        # Dense conifer: tapered trunk with bark ridges and root flare, five
        # canopy tiers each fringed with branch tufts in alternating greens.
        deep = material(f'{asset_id}_deep', tone(palette['primary'], 0.62), roughness=0.82)
        lit = material(f'{asset_id}_lit', tone(palette['primary'], 1.22), roughness=0.7)
        add(cylinder(f'{asset_id}_TrunkLower', (0.0, 0.0, 0.16), 0.105, 0.32, secondary, asset_id, vertices=12))
        add(cylinder(f'{asset_id}_TrunkUpper', (0.0, 0.0, 0.42), 0.08, 0.30, secondary, asset_id, vertices=12))
        for ridge in range(6):
            r = math.radians(ridge * 60 + 12)
            add(cube(f'{asset_id}_Bark_{ridge}', (math.cos(r) * 0.095, math.sin(r) * 0.095, 0.18), (0.02, 0.02, 0.15), material(f'{asset_id}_bark_dark', tone(palette['secondary'], 0.7), roughness=0.9), asset_id, bevel=0.008, rotation=(0, 0, r)))
        for root in range(4):
            r = math.radians(root * 90 + 45)
            add(cone(f'{asset_id}_Root_{root}', (math.cos(r) * 0.13, math.sin(r) * 0.13, 0.045), 0.06, 0.1, secondary, asset_id, rotation=(math.radians(78) * math.cos(r), math.radians(78) * math.sin(r), 0)))
        tiers = ((0.52, 0.50, 9), (0.74, 0.42, 8), (0.95, 0.34, 7), (1.14, 0.26, 6), (1.30, 0.18, 5))
        for tier_index, (z, radius, tufts) in enumerate(tiers):
            body = primary if tier_index % 2 == 0 else deep
            add(cone(f'{asset_id}_Tier_{tier_index}', (0.0, 0.0, z), radius, 0.34, body, asset_id))
            for tuft in range(tufts):
                r = math.radians(tuft * (360 / tufts) + tier_index * 23)
                tx, ty = math.cos(r) * radius * 0.72, math.sin(r) * radius * 0.72
                tuft_mat = lit if (tuft + tier_index) % 3 == 0 else (primary if tier_index % 2 else deep)
                add(cone(f'{asset_id}_Tuft_{tier_index}_{tuft}', (tx, ty, z - 0.06), radius * 0.30, 0.20, tuft_mat, asset_id, rotation=(math.radians(24) * math.sin(r), math.radians(-24) * math.cos(r), 0)))
        add(cone(f'{asset_id}_Crown', (0.0, 0.0, 1.44), 0.11, 0.22, lit, asset_id))
        add(cone(f'{asset_id}_Tip', (0.0, 0.0, 1.56), 0.045, 0.1, accent, asset_id))
    elif shape == 'broadleaf-tree':
        deep = material(f'{asset_id}_deep', tone(palette['primary'], 0.6), roughness=0.85)
        lit = material(f'{asset_id}_lit', tone(palette['primary'], 1.28), roughness=0.68)
        add(cylinder(f'{asset_id}_Trunk', (0.0, 0.0, 0.30), 0.115, 0.60, secondary, asset_id, vertices=12))
        add(cylinder(f'{asset_id}_BranchL', (-0.16, 0.03, 0.62), 0.055, 0.34, secondary, asset_id, vertices=10, rotation=(0, math.radians(-38), math.radians(10))))
        add(cylinder(f'{asset_id}_BranchR', (0.14, -0.04, 0.70), 0.05, 0.30, secondary, asset_id, vertices=10, rotation=(0, math.radians(34), math.radians(-16))))
        add(cylinder(f'{asset_id}_BranchB', (0.02, 0.12, 0.66), 0.045, 0.26, secondary, asset_id, vertices=10, rotation=(math.radians(-30), 0, 0)))
        # Three canopy shells: shadowed base puffs, mid-tone body, lit crown.
        puffs = (
            (deep, ((-0.30, 0.05, 0.86, 0.24), (0.26, -0.02, 0.90, 0.26), (0.02, 0.20, 0.88, 0.22), (-0.05, -0.18, 0.84, 0.21))),
            (primary, ((-0.22, 0.12, 1.06, 0.26), (0.18, 0.10, 1.10, 0.28), (0.00, -0.14, 1.04, 0.25), (-0.32, -0.06, 1.00, 0.20), (0.32, -0.04, 1.02, 0.19))),
            (lit, ((-0.10, 0.02, 1.26, 0.24), (0.14, 0.05, 1.24, 0.20), (0.02, 0.14, 1.30, 0.17), (-0.02, -0.08, 1.32, 0.15))),
        )
        for shell_index, (mat, entries) in enumerate(puffs):
            for puff_index, (x, y, z, size) in enumerate(entries):
                add(cube(f'{asset_id}_Puff_{shell_index}_{puff_index}', (x, y, z), (size, size * 0.92, size * 0.8), mat, asset_id, bevel=size * 0.42, rotation=(0, 0, (shell_index * 5 + puff_index) * 0.5)))
        add(cube(f'{asset_id}_AccentPuff', (0.08, -0.16, 1.18), (0.12, 0.11, 0.09), accent, asset_id, bevel=0.05))
    elif shape == 'boulder':
        # Polish pass: the first cluster read as a low sliver from the 55-degree
        # camera. Taller stacked massing with a clear lit/dark split.
        dark = material(f'{asset_id}_dark', tone(palette['primary'], 0.62), roughness=0.92)
        lit = material(f'{asset_id}_lit', tone(palette['primary'], 1.22), roughness=0.78)
        moss = material(f'{asset_id}_moss', '#3f5a37', roughness=0.95)
        crack = material(f'{asset_id}_crack', '#1b1d20', roughness=0.95)
        rocks = (
            (0.0, 0.0, 0.42, 0.40, 0.34, 0.42, 0.10, 0.35, primary),
            (0.05, -0.06, 0.82, 0.26, 0.22, 0.20, -0.14, 0.9, lit),
            (0.34, -0.10, 0.26, 0.22, 0.20, 0.26, 0.18, -0.55, dark),
            (-0.32, 0.08, 0.22, 0.19, 0.17, 0.22, -0.1, 1.05, dark),
            (0.16, 0.22, 0.30, 0.15, 0.14, 0.17, 0.22, 1.6, primary),
            (-0.14, -0.26, 0.16, 0.14, 0.12, 0.15, 0.0, 2.2, lit),
        )
        for index, (x, y, z, sx, sy, sz, rx, rz, mat) in enumerate(rocks):
            add(cube(f'{asset_id}_Rock_{index}', (x, y, z), (sx, sy, sz), mat, asset_id, bevel=min(sx, sz) * 0.42, rotation=(rx, 0.0, rz)))
        for index, (x, y, z, rz) in enumerate(((-0.04, -0.30, 0.62, 0.4), (0.28, -0.22, 0.42, -0.7), (-0.28, -0.06, 0.36, 1.1))):
            add(cube(f'{asset_id}_Moss_{index}', (x, y, z), (0.10, 0.035, 0.06), moss, asset_id, bevel=0.02, rotation=(0.3, 0, rz)))
        add(cube(f'{asset_id}_Crack', (0.10, -0.32, 0.40), (0.016, 0.02, 0.22), crack, asset_id, bevel=0.005, rotation=(0, 0, 0.28)))
        add(cube(f'{asset_id}_Crack2', (-0.16, -0.30, 0.24), (0.12, 0.02, 0.013), crack, asset_id, bevel=0.004, rotation=(0, 0, -0.22)))
        add(cube(f'{asset_id}_OreFleck', (0.14, -0.30, 0.66), (0.055, 0.02, 0.045), accent, asset_id, bevel=0.012))
    elif shape == 'wrecked-car':
        # Polish pass: taller body massing so the profile reads as a vehicle,
        # not roadside debris. Static world dressing only - never an actor.
        rust = material(f'{asset_id}_rust', tone(palette['primary'], 0.58), roughness=0.95)
        glass = material(f'{asset_id}_glass', '#20343c', roughness=0.3)
        chrome = material(f'{asset_id}_chrome', '#8b959b', metallic=0.6, roughness=0.4)
        tyre_mat = material(f'{asset_id}_tyre', '#17181a', roughness=0.9)
        add(cube(f'{asset_id}_Chassis', (0.0, 0.0, 0.22), (0.64, 0.27, 0.10), secondary, asset_id, bevel=0.035))
        add(cube(f'{asset_id}_Body', (0.0, 0.0, 0.38), (0.62, 0.26, 0.10), primary, asset_id, bevel=0.045))
        add(cube(f'{asset_id}_Hood', (0.44, 0.0, 0.44), (0.19, 0.24, 0.045), primary, asset_id, bevel=0.03, rotation=(0, math.radians(5), 0)))
        add(cube(f'{asset_id}_TrunkLid', (-0.45, 0.0, 0.445), (0.155, 0.24, 0.04), rust, asset_id, bevel=0.025, rotation=(0, math.radians(-4), 0)))
        add(cube(f'{asset_id}_Cabin', (-0.04, 0.0, 0.60), (0.27, 0.215, 0.115), primary, asset_id, bevel=0.05, rotation=(0, math.radians(-2), 0)))
        add(cube(f'{asset_id}_Roof', (-0.04, 0.0, 0.715), (0.24, 0.19, 0.02), rust, asset_id, bevel=0.012, rotation=(0.05, math.radians(-2), 0.08)))
        add(cube(f'{asset_id}_Windshield', (0.20, 0.0, 0.575), (0.06, 0.19, 0.10), glass, asset_id, bevel=0.02, rotation=(0, math.radians(30), 0)))
        add(cube(f'{asset_id}_RearGlass', (-0.29, 0.0, 0.57), (0.05, 0.18, 0.09), glass, asset_id, bevel=0.02, rotation=(0, math.radians(-34), 0)))
        for side in (-1, 1):
            add(cube(f'{asset_id}_SideGlass_{side}', (-0.04, side * 0.218, 0.60), (0.19, 0.012, 0.075), glass, asset_id, bevel=0.012))
        wheels = ((0.42, -0.295, 0.12, False), (0.42, 0.295, 0.075, True), (-0.40, -0.295, 0.12, False))
        for index, (x, y, radius, flat) in enumerate(wheels):
            add(cylinder(f'{asset_id}_Tyre_{index}', (x, y, radius), radius, 0.08, tyre_mat, asset_id, vertices=16, rotation=(math.radians(90), 0, 0)))
            add(cylinder(f'{asset_id}_Hub_{index}', (x, y * 1.02, radius), radius * 0.45, 0.084, chrome, asset_id, vertices=10, rotation=(math.radians(90), 0, 0)))
        add(cylinder(f'{asset_id}_BareHub', (-0.40, 0.295, 0.085), 0.06, 0.08, chrome, asset_id, vertices=10, rotation=(math.radians(90), 0, 0)))
        add(cube(f'{asset_id}_Grill', (0.635, 0.0, 0.36), (0.014, 0.16, 0.055), chrome, asset_id, bevel=0.008))
        for side in (-1, 1):
            add(cube(f'{asset_id}_Headlight_{side}', (0.63, side * 0.185, 0.41), (0.016, 0.05, 0.035), accent, asset_id, bevel=0.01))
        add(cube(f'{asset_id}_Bumper', (0.655, 0.0, 0.245), (0.02, 0.24, 0.035), chrome, asset_id, bevel=0.012))
        for index, (x, y, sx, sz) in enumerate(((0.24, -0.262, 0.09, 0.05), (-0.16, -0.262, 0.13, 0.06), (0.08, 0.262, 0.11, 0.05))):
            add(cube(f'{asset_id}_Rust_{index}', (x, y, 0.40), (sx, 0.014, sz), rust, asset_id, bevel=0.012, rotation=(0, 0, index * 0.4)))
    elif shape == 'fence':
        # One joined comb solid: base rail, top rail and nine pickets share a
        # single flat-shaded mesh, so nothing can float apart.
        weathered = material(f'{asset_id}_weathered', tone(palette['primary'], 0.72), roughness=0.9)
        profile = [(-0.60, 0.02), (0.60, 0.02)]
        # up the right edge of the base rail
        profile += [(0.60, 0.20)]
        # picket comb, right to left: gap-top, picket-up-over-down per picket
        for index in range(8, -1, -1):
            x = -0.505 + index * 0.1265
            top = 0.74 if index % 2 else 0.68
            profile += [(x + 0.048, 0.20), (x + 0.048, top), (x, top + 0.075), (x - 0.048, top), (x - 0.048, 0.20)]
        profile += [(-0.60, 0.20)]
        parts.append(prism_mesh(f'{asset_id}_Comb', profile, -0.035, 0.035, primary, asset_id))
        # Mid rail crosses every picket as a second joined solid.
        parts.append(prism_mesh(f'{asset_id}_MidRail', [(-0.60, 0.40), (0.60, 0.40), (0.60, 0.47), (-0.60, 0.47)], -0.05, 0.05, weathered, asset_id))
        for index, x in enumerate((-0.56, 0.0, 0.56)):
            parts.append(prism_mesh(f'{asset_id}_Post_{index}', [(x - 0.055, 0.0), (x + 0.055, 0.0), (x + 0.055, 0.80), (x + 0.07, 0.80), (x, 0.88), (x - 0.07, 0.80), (x - 0.055, 0.80)], -0.055, 0.055, secondary, asset_id))
        add(cube(f'{asset_id}_Sign', (-0.26, -0.075, 0.55), (0.09, 0.014, 0.065), accent, asset_id, bevel=0.008, rotation=(0, 0, math.radians(-6))))
    elif shape == 'shack':
        # Walls: one crisp prism slab (front profile extruded through depth)
        # with plank grooves as shallow relief strips; roof: one closed gabled
        # prism with an overhang, extruded along X so the gable ends are part
        # of the same solid.
        plank_lit = material(f'{asset_id}_plank_lit', tone(palette['primary'], 1.18), roughness=0.82)
        roof_mat = material(f'{asset_id}_roof', tone(palette['secondary'], 0.78), roughness=0.88)
        frame_mat = material(f'{asset_id}_frame', tone(palette['secondary'], 1.3), roughness=0.8)
        parts.append(prism_mesh(f'{asset_id}_Walls', [(-0.54, 0.0), (0.54, 0.0), (0.54, 0.80), (-0.54, 0.80)], -0.40, 0.40, primary, asset_id))
        for row in range(5):
            z = 0.14 + row * 0.15
            parts.append(prism_mesh(f'{asset_id}_Groove_{row}', [(-0.54, z), (0.54, z), (0.54, z + 0.022), (-0.54, z + 0.022)], -0.415, 0.415, plank_lit if row % 2 else material(f'{asset_id}_plank_dark', tone(palette['primary'], 0.72), roughness=0.9), asset_id))
        # Roof: profile in (y, z) plane -> build as (x=long axis) prism by
        # swapping: author profile in (x, z) as the GABLE face and extrude in
        # y? No - the gable faces are at x ends, so extrude the (y, z) section
        # along x. prism_mesh profiles are (x, z) extruded in y; rotate the
        # object 90 degrees about Z to map extrusion onto X.
        roof = prism_mesh(f'{asset_id}_Roof', [(-0.47, 0.76), (0.47, 0.76), (0.47, 0.82), (0.0, 1.10), (-0.47, 0.82)], -0.62, 0.62, roof_mat, asset_id)
        roof.rotation_euler = (0.0, 0.0, math.radians(90))
        # Shingle course lines as thin joined strips on each slope.
        for sign in (-1, 1):
            for row in range(3):
                t = 0.22 + row * 0.26
                y_pos = sign * (0.47 - t * 0.47)
                z_pos = 0.82 + t * 0.26
                strip = prism_mesh(f'{asset_id}_Course_{sign}_{row}', [(y_pos - 0.028, z_pos), (y_pos + 0.028, z_pos), (y_pos + 0.028, z_pos + 0.035), (y_pos - 0.028, z_pos + 0.035)], -0.60, 0.60, frame_mat if row == 1 else roof_mat, asset_id)
                strip.rotation_euler = (0.0, 0.0, math.radians(90))
        add(cube(f'{asset_id}_Ridge', (0.0, 0.0, 1.11), (0.64, 0.05, 0.04), frame_mat, asset_id, bevel=0.012))
        add(cube(f'{asset_id}_DoorFrame', (0.22, -0.408, 0.30), (0.15, 0.016, 0.28), frame_mat, asset_id, bevel=0.008))
        add(cube(f'{asset_id}_Door', (0.22, -0.415, 0.29), (0.115, 0.014, 0.25), secondary, asset_id, bevel=0.01))
        add(cube(f'{asset_id}_Handle', (0.175, -0.428, 0.28), (0.014, 0.008, 0.014), material(f'{asset_id}_brass', '#c9a86a', metallic=0.5, roughness=0.4), asset_id, bevel=0.004))
        add(cube(f'{asset_id}_WindowFrame', (-0.18, -0.408, 0.50), (0.155, 0.016, 0.14), frame_mat, asset_id, bevel=0.008))
        add(cube(f'{asset_id}_Window', (-0.18, -0.415, 0.50), (0.125, 0.014, 0.11), accent, asset_id, bevel=0.008))
        add(cube(f'{asset_id}_WindowCrossV', (-0.18, -0.425, 0.50), (0.012, 0.008, 0.11), frame_mat, asset_id, bevel=0.003))
        add(cube(f'{asset_id}_WindowCrossH', (-0.18, -0.425, 0.50), (0.125, 0.008, 0.012), frame_mat, asset_id, bevel=0.003))
        parts.append(prism_mesh(f'{asset_id}_Chimney', [(-0.36, 1.02), (-0.25, 1.02), (-0.25, 1.24), (-0.235, 1.24), (-0.235, 1.28), (-0.365, 1.28), (-0.365, 1.24), (-0.36, 1.24)], 0.04, 0.15, primary, asset_id))
        add(cube(f'{asset_id}_Step', (0.22, -0.46, 0.045), (0.16, 0.05, 0.045), plank_lit, asset_id, bevel=0.012))
        add(cylinder(f'{asset_id}_Barrel', (0.62, -0.26, 0.16), 0.085, 0.30, secondary, asset_id, vertices=14))
        add(cube(f'{asset_id}_BarrelBand', (0.62, -0.26, 0.2), (0.1, 0.1, 0.012), frame_mat, asset_id, bevel=0.004))
    else:
        raise RuntimeError(f'Unknown authored prop shape: {shape}')

    return {'assetId': asset_id, 'category': asset['category'], 'shape': shape, 'objectCount': len(parts)}


def configure_scene(manifest: dict):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = manifest['render']['engine']
    scene.render.film_transparent = True
    scene.render.resolution_x = manifest['render']['frameSize'][0]
    scene.render.resolution_y = manifest['render']['frameSize'][1]
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.color_depth = '8'
    scene.render.image_settings.compression = 20
    scene.view_settings.exposure = manifest['render']['exposure']
    world = bpy.data.worlds.new('HMH_Authored_Prop_World')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.02,0.025,0.035,1.0)
    world.node_tree.nodes['Background'].inputs[1].default_value = 0.45
    scene.world = world

    target = Vector((0.0,0.0,manifest['render']['cameraTargetZ']))
    camera_data = bpy.data.cameras.new('HMH_Authored_Prop_Camera')
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = manifest['render']['cameraOrthoScale']
    camera = bpy.data.objects.new('HMH_Authored_Prop_Camera', camera_data)
    camera.location = (0.0,-3.8,3.8 + target.z)
    camera.rotation_euler = (math.radians(manifest['render']['cameraPitchDegrees']),0.0,0.0)
    scene.collection.objects.link(camera)
    scene.camera = camera

    _placement = {'key': ((3.2,-4.0,5.2), 4.0), 'fill': ((-3.0,-2.2,2.8), 5.0), 'rim': ((0.5,3.6,3.5), 4.0)}
    for channel, color, energy in shared_light_channels('prop'):
        name = channel.capitalize()
        location, size = _placement[channel]
        data=bpy.data.lights.new(f'HMH_Prop_{name}',type='AREA'); data.energy=energy; data.color=color; data.size=size
        obj=bpy.data.objects.new(f'HMH_Prop_{name}',data); obj.location=location; obj.rotation_euler=(target-obj.location).to_track_quat('-Z','Y').to_euler(); scene.collection.objects.link(obj)


def main() -> None:
    args=blender_args(); manifest=json.loads(Path(args.manifest).resolve().read_text(encoding='utf-8'))
    configure_scene(manifest)
    built=[build_asset(asset) for asset in manifest['assets']]
    blend_path=Path(args.source_blend).resolve(); blend_path.parent.mkdir(parents=True,exist_ok=True); bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    inspection={'status':'pass','pipelineId':manifest['pipelineId'],'runtimeAuthority':manifest['runtimeAuthority'],'assetCount':len(built),'assets':built,'externalDependencyCount':0}
    output=Path(args.inspection_output).resolve(); output.parent.mkdir(parents=True,exist_ok=True); output.write_text(json.dumps(inspection,indent=2)+'\n',encoding='utf-8',newline='\n')
    print(json.dumps({'status':'pass','assetCount':len(built)},sort_keys=True))


if __name__=='__main__': main()

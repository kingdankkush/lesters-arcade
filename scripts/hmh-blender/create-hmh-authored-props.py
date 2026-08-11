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

    EEVEE ONLY. The winding below leaves both caps facing INWARD: for a profile
    wound counter-clockwise in (x, z), the top cap's face order yields a -Y
    normal even though the cap sits at y_max. EEVEE shades non-culled backfaces
    by flipping the normal toward the viewer, so this is invisible here and
    every prop built on it renders correctly. Workbench does not do that, so
    the same geometry renders inside-out in the BLENDER_WORKBENCH enemy-roster
    pipeline. Fix the winding before reusing this there -- do not copy the
    helper across as-is. Guarded by tests/hmh-reboot-prism-mesh-policy.test.mjs.
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
    emissive_world_shapes = {'pylon', 'crystal', 'beacon', 'console', 'terminal', 'awning-shopfront', 'water-tower', 'fuel-pump-island', 'town-billboard', 'streetlamp', 'relay-tower-setpiece', 'forked-spire-setpiece', 'proof-bridge-setpiece', 'hashwood-beacon-setpiece', 'mining-headframe-setpiece', 'liquidation-tower-setpiece'}
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
    elif shape == 'railgun':
        # Long silver body, separated twin rails, and blue charge coils create
        # a silhouette that cannot be mistaken for the launcher or shotgun.
        add(cube(f'{asset_id}_Stock', (-0.46, 0.0, 0.62), (0.28, 0.16, 0.16), secondary, asset_id, rotation=(0.0, math.radians(-6), 0.0)))
        add(cube(f'{asset_id}_Receiver', (-0.08, 0.0, 0.69), (0.34, 0.18, 0.18), primary, asset_id))
        for y in (-0.085, 0.085):
            add(cylinder(f'{asset_id}_Rail_{y}', (0.50, y, 0.72), 0.038, 1.14, primary, asset_id, rotation=(0.0, math.radians(90), 0.0), vertices=16))
        for x in (0.18, 0.42, 0.66):
            add(torus(f'{asset_id}_Coil_{x}', (x, 0.0, 0.72), 0.15, 0.025, accent, asset_id, rotation=(0.0, math.radians(90), 0.0)))
        add(cube(f'{asset_id}_Grip', (-0.18, 0.0, 0.39), (0.10, 0.12, 0.24), secondary, asset_id, rotation=(0.0, math.radians(-10), 0.0)))
        add(cube(f'{asset_id}_Sight', (0.02, -0.20, 0.86), (0.18, 0.045, 0.055), accent, asset_id))
    elif shape == 'arc-rifle':
        # Compact forked emitter with six exposed capacitor cells. The cyan
        # ladder silhouette is intentionally shorter and taller than Hash Rail.
        add(cube(f'{asset_id}_Stock', (-0.42, 0.0, 0.58), (0.22, 0.18, 0.18), secondary, asset_id, rotation=(0.0, math.radians(-14), 0.0)))
        add(cube(f'{asset_id}_Receiver', (-0.08, 0.0, 0.70), (0.34, 0.22, 0.20), primary, asset_id))
        for index, x in enumerate((-0.30, -0.18, -0.06, 0.06, 0.18, 0.30)):
            add(cylinder(f'{asset_id}_Cell_{index}', (x, -0.24, 0.73), 0.045, 0.14, accent, asset_id, rotation=(math.radians(90), 0.0, 0.0), vertices=16))
        for y in (-0.12, 0.12):
            add(cube(f'{asset_id}_Fork_{y}', (0.48, y, 0.74), (0.38, 0.045, 0.045), secondary, asset_id, rotation=(0.0, 0.0, math.radians(3 if y > 0 else -3))))
            add(sphere(f'{asset_id}_Emitter_{y}', (0.84, y, 0.77), (0.075, 0.075, 0.075), accent, asset_id))
        add(torus(f'{asset_id}_ArcGate', (0.40, 0.0, 0.74), 0.19, 0.028, accent, asset_id, rotation=(0.0, math.radians(90), 0.0)))
        add(cube(f'{asset_id}_Grip', (-0.17, 0.0, 0.38), (0.10, 0.13, 0.25), secondary, asset_id, rotation=(0.0, math.radians(-10), 0.0)))
    elif shape == 'flame-projector':
        # Short industrial projector: rear fuel tank, armored pump body, heat
        # shield, and flared nozzle distinguish it from every ballistic weapon.
        add(cylinder(f'{asset_id}_Tank', (-0.40, 0.0, 0.61), 0.22, 0.52, primary, asset_id, rotation=(math.radians(90), 0.0, 0.0), vertices=20))
        add(torus(f'{asset_id}_TankBandA', (-0.40, -0.20, 0.61), 0.22, 0.028, accent, asset_id, rotation=(math.radians(90), 0.0, 0.0)))
        add(torus(f'{asset_id}_TankBandB', (-0.40, 0.20, 0.61), 0.22, 0.028, accent, asset_id, rotation=(math.radians(90), 0.0, 0.0)))
        add(cube(f'{asset_id}_Pump', (-0.02, 0.0, 0.67), (0.30, 0.20, 0.20), secondary, asset_id, bevel=0.035))
        add(cylinder(f'{asset_id}_Barrel', (0.38, 0.0, 0.70), 0.09, 0.70, primary, asset_id, rotation=(0.0, math.radians(90), 0.0), vertices=20))
        add(cone(f'{asset_id}_Nozzle', (0.76, 0.0, 0.70), 0.18, 0.28, secondary, asset_id, rotation=(0.0, math.radians(90), 0.0)))
        add(torus(f'{asset_id}_Igniter', (0.76, 0.0, 0.70), 0.15, 0.025, accent, asset_id, rotation=(0.0, math.radians(90), 0.0)))
        add(cube(f'{asset_id}_HeatShield', (0.30, 0.0, 0.84), (0.30, 0.24, 0.045), accent, asset_id))
        add(cube(f'{asset_id}_Grip', (-0.10, 0.0, 0.36), (0.11, 0.13, 0.25), secondary, asset_id, rotation=(0.0, math.radians(-10), 0.0)))
    elif shape == 'forked-spear':
        # Long two-tine polearm. The shaft stays broad enough to survive atlas
        # scale, while the open fork silhouette makes it unmistakable in-hand.
        add(cylinder(f'{asset_id}_Shaft', (0.02, 0.0, 0.62), 0.055, 1.48, secondary, asset_id, rotation=(0.0, math.radians(90), 0.0), vertices=12))
        add(cylinder(f'{asset_id}_RearCap', (-0.73, 0.0, 0.62), 0.095, 0.16, primary, asset_id, rotation=(0.0, math.radians(90), 0.0), vertices=12))
        add(torus(f'{asset_id}_GripBandA', (-0.34, 0.0, 0.62), 0.078, 0.022, accent, asset_id, rotation=(0.0, math.radians(90), 0.0)))
        add(torus(f'{asset_id}_GripBandB', (-0.12, 0.0, 0.62), 0.078, 0.022, accent, asset_id, rotation=(0.0, math.radians(90), 0.0)))
        add(cube(f'{asset_id}_ForkCollar', (0.69, 0.0, 0.62), (0.16, 0.20, 0.11), primary, asset_id, bevel=0.025))
        for index, y in enumerate((-0.13, 0.13)):
            add(cube(f'{asset_id}_Tine_{index}', (0.90, y, 0.66), (0.25, 0.045, 0.045), primary, asset_id, rotation=(0.0, 0.0, math.radians(4 if y > 0 else -4))))
            add(cone(f'{asset_id}_Tip_{index}', (1.17, y, 0.68), 0.085, 0.30, accent, asset_id, rotation=(0.0, math.radians(90), 0.0)))
        add(cube(f'{asset_id}_CrossGuard', (0.61, 0.0, 0.62), (0.055, 0.30, 0.055), accent, asset_id, bevel=0.014))
    elif shape == 'life-token':
        # A med kit with a bold cross on its lid. The previous sphere-and-halo
        # read as a featureless circle from above, which is the single most
        # important pickup in the game to identify instantly.
        add(cube(f'{asset_id}_Case', (0.0, 0.0, 0.42), (0.46, 0.40, 0.26), primary, asset_id))
        add(cube(f'{asset_id}_Lid', (0.0, 0.0, 0.60), (0.48, 0.42, 0.06), secondary, asset_id))
        add(cube(f'{asset_id}_CrossBar', (0.0, 0.0, 0.66), (0.30, 0.10, 0.05), accent, asset_id))
        add(cube(f'{asset_id}_CrossStem', (0.0, 0.0, 0.66), (0.10, 0.30, 0.05), accent, asset_id))
        add(cube(f'{asset_id}_Handle', (0.0, -0.34, 0.56), (0.16, 0.05, 0.08), secondary, asset_id))
    elif shape == 'hash-rail-core':
        # Floating blue capacitor core: a bright faceted cell nested inside
        # two orthogonal induction rings. It must not read as spendable coin.
        add(sphere(f'{asset_id}_Core', (0.0, 0.0, 0.62), (0.24, 0.24, 0.32), accent, asset_id))
        add(torus(f'{asset_id}_RingA', (0.0, 0.0, 0.62), 0.38, 0.045, primary, asset_id, rotation=(math.radians(90), 0.0, 0.0)))
        add(torus(f'{asset_id}_RingB', (0.0, 0.0, 0.62), 0.38, 0.045, secondary, asset_id, rotation=(0.0, math.radians(90), 0.0)))
        add(cube(f'{asset_id}_RailTop', (0.0, 0.0, 1.02), (0.18, 0.08, 0.045), primary, asset_id))
        add(cube(f'{asset_id}_RailBase', (0.0, 0.0, 0.22), (0.18, 0.08, 0.045), primary, asset_id))
    elif shape == 'ledger-cache':
        # A six-cell field case with a forked lightning terminal. It echoes the
        # carried weapon without sharing Hash Rail's floating ring silhouette.
        add(cube(f'{asset_id}_Case', (0.0, 0.0, 0.34), (0.48, 0.38, 0.28), secondary, asset_id, bevel=0.035))
        add(cube(f'{asset_id}_Lid', (0.0, 0.0, 0.61), (0.50, 0.40, 0.08), primary, asset_id, bevel=0.025))
        for index, x in enumerate((-0.30, -0.18, -0.06, 0.06, 0.18, 0.30)):
            add(cylinder(f'{asset_id}_Cell_{index}', (x, -0.43, 0.46), 0.045, 0.16, accent, asset_id, rotation=(math.radians(90), 0.0, 0.0), vertices=16))
        add(cube(f'{asset_id}_TerminalStem', (0.0, 0.0, 0.86), (0.055, 0.06, 0.23), accent, asset_id))
        add(cube(f'{asset_id}_TerminalLeft', (-0.11, 0.0, 1.04), (0.14, 0.055, 0.045), accent, asset_id, rotation=(0.0, math.radians(-22), 0.0)))
        add(cube(f'{asset_id}_TerminalRight', (0.11, 0.0, 1.04), (0.14, 0.055, 0.045), accent, asset_id, rotation=(0.0, math.radians(22), 0.0)))
    elif shape == 'burner-cache':
        # Twin orange fuel canisters in a dark field rack. The broad hazard bars
        # remain readable at gameplay scale and do not resemble the cyan Ledger.
        add(cube(f'{asset_id}_Rack', (0.0, 0.0, 0.30), (0.52, 0.38, 0.22), secondary, asset_id, bevel=0.035))
        for index, x in enumerate((-0.24, 0.24)):
            add(cylinder(f'{asset_id}_Canister_{index}', (x, 0.0, 0.66), 0.18, 0.64, primary, asset_id, vertices=20))
            add(torus(f'{asset_id}_Band_{index}', (x, 0.0, 0.66), 0.18, 0.035, accent, asset_id))
            add(cube(f'{asset_id}_Valve_{index}', (x, 0.0, 1.02), (0.08, 0.08, 0.07), secondary, asset_id))
        add(cube(f'{asset_id}_HazardA', (-0.18, -0.40, 0.34), (0.16, 0.045, 0.055), accent, asset_id, rotation=(0.0, math.radians(-18), 0.0)))
        add(cube(f'{asset_id}_HazardB', (0.18, -0.40, 0.34), (0.16, 0.045, 0.055), accent, asset_id, rotation=(0.0, math.radians(-18), 0.0)))
        add(cube(f'{asset_id}_Handle', (0.0, 0.0, 1.11), (0.25, 0.06, 0.06), secondary, asset_id))
    elif shape == 'standard-cache':
        # Field rack with a bright fork crest. The upright icon is readable as
        # a weapon cache rather than another fuel or capacitor container.
        add(cube(f'{asset_id}_Case', (0.0, 0.0, 0.28), (0.50, 0.38, 0.24), secondary, asset_id, bevel=0.035))
        add(cube(f'{asset_id}_Lid', (0.0, 0.0, 0.51), (0.52, 0.40, 0.07), primary, asset_id, bevel=0.025))
        add(cube(f'{asset_id}_Shaft', (0.0, -0.41, 0.82), (0.045, 0.045, 0.34), primary, asset_id, bevel=0.012))
        add(cube(f'{asset_id}_Collar', (0.0, -0.41, 1.04), (0.18, 0.050, 0.055), accent, asset_id, bevel=0.012))
        for index, x in enumerate((-0.14, 0.14)):
            add(cube(f'{asset_id}_Tine_{index}', (x, -0.41, 1.18), (0.045, 0.045, 0.22), accent, asset_id, rotation=(0.0, math.radians(-8 if x < 0 else 8), 0.0)))
            add(cone(f'{asset_id}_Tip_{index}', (x, -0.41, 1.43), 0.065, 0.18, accent, asset_id))
        add(cube(f'{asset_id}_Latch', (0.0, -0.41, 0.33), (0.16, 0.035, 0.07), accent, asset_id, bevel=0.012))
    elif shape == 'litecoin-token':
        # Upright silver/blue token with a raised stylized Ł mark. Facing the
        # certified camera preserves the circular silhouette and symbol.
        face_rotation = (math.radians(90), 0.0, 0.0)
        add(cylinder(f'{asset_id}_Coin', (0.0, 0.0, 0.60), 0.44, 0.14, primary, asset_id, rotation=face_rotation, vertices=32))
        add(torus(f'{asset_id}_Rim', (0.0, -0.08, 0.60), 0.35, 0.045, secondary, asset_id, rotation=face_rotation))
        mark_rotation = (0.0, math.radians(-14), 0.0)
        add(cube(f'{asset_id}_LStem', (-0.03, -0.16, 0.60), (0.055, 0.025, 0.24), accent, asset_id, rotation=mark_rotation))
        add(cube(f'{asset_id}_LCross', (0.0, -0.16, 0.60), (0.23, 0.026, 0.045), accent, asset_id, rotation=mark_rotation))
        add(cube(f'{asset_id}_LFoot', (0.05, -0.16, 0.39), (0.20, 0.026, 0.045), accent, asset_id, rotation=mark_rotation))
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
    elif shape == 'dead-pine':
        # Bare weathered snag: tapered trunk, broken crown, stub branches at
        # alternating angles. Reads as the hashwood's dead sibling.
        bark = material(f'{asset_id}_bark', tone(palette['primary'], 0.8), roughness=0.95)
        lit = material(f'{asset_id}_lit', tone(palette['primary'], 1.24), roughness=0.8)
        add(cylinder(f'{asset_id}_Trunk', (0.0, 0.0, 0.62), 0.085, 1.24, primary, asset_id, vertices=10))
        add(cylinder(f'{asset_id}_TrunkTop', (0.02, 0.0, 1.30), 0.05, 0.24, bark, asset_id, vertices=8, rotation=(0, math.radians(6), 0)))
        add(cone(f'{asset_id}_Snap', (0.03, 0.0, 1.46), 0.052, 0.12, secondary, asset_id))
        branches = ((0.42, 0.30, 0.0, 58), (0.68, 0.26, 122, 64), (0.92, 0.22, 233, 52), (1.12, 0.18, 40, 66), (0.55, 0.24, 300, 60))
        for index, (z, length, yaw, pitch) in enumerate(branches):
            r = math.radians(yaw)
            mat = lit if index % 2 else bark
            add(cylinder(f'{asset_id}_Branch_{index}', (math.cos(r) * length * 0.5, math.sin(r) * length * 0.5, z), 0.028, length, mat, asset_id, vertices=8, rotation=(math.radians(pitch) * math.sin(r), math.radians(pitch) * math.cos(r), 0)))
            add(cone(f'{asset_id}_BranchTip_{index}', (math.cos(r) * length * 0.92, math.sin(r) * length * 0.92, z + 0.05), 0.024, 0.07, secondary, asset_id))
        add(cube(f'{asset_id}_RootFlare', (0.0, 0.0, 0.05), (0.16, 0.16, 0.05), secondary, asset_id, bevel=0.03))
        add(cube(f'{asset_id}_FallenBranch', (0.30, -0.20, 0.03), (0.20, 0.03, 0.025), bark, asset_id, bevel=0.008, rotation=(0, 0, 0.5)))
    elif shape == 'moss-boulder':
        # Forest-floor rock stack with a mossy crown; value-compressed toward
        # the hashwood ground band per the art direction.
        dark = material(f'{asset_id}_dark', tone(palette['primary'], 0.6), roughness=0.94)
        lit = material(f'{asset_id}_lit', tone(palette['primary'], 1.2), roughness=0.8)
        moss = material(f'{asset_id}_moss', tone(palette['secondary'], 1.35), roughness=0.96)
        rocks = (
            (0.0, 0.0, 0.36, 0.36, 0.30, 0.36, 0.08, 0.4, primary),
            (-0.06, 0.08, 0.72, 0.24, 0.20, 0.18, -0.12, 1.1, lit),
            (0.30, -0.12, 0.22, 0.20, 0.17, 0.22, 0.2, -0.6, dark),
            (-0.30, -0.10, 0.18, 0.16, 0.14, 0.18, -0.08, 0.9, dark),
            (0.10, 0.24, 0.24, 0.13, 0.12, 0.14, 0.24, 1.7, primary),
        )
        for index, (x, y, z, sx, sy, sz, rx, rz, mat) in enumerate(rocks):
            add(cube(f'{asset_id}_Rock_{index}', (x, y, z), (sx, sy, sz), mat, asset_id, bevel=min(sx, sz) * 0.4, rotation=(rx, 0.0, rz)))
        for index, (x, y, z, sx, rz) in enumerate(((-0.08, 0.06, 0.86, 0.20, 0.3), (0.10, 0.02, 0.82, 0.14, -0.5), (-0.02, 0.16, 0.80, 0.11, 1.2), (0.28, -0.10, 0.40, 0.10, 0.8))):
            add(cube(f'{asset_id}_Moss_{index}', (x, y, z), (sx, sx * 0.85, 0.045), moss, asset_id, bevel=0.02, rotation=(0.1, 0, rz)))
        add(cube(f'{asset_id}_MintFleck', (-0.10, 0.14, 0.90), (0.045, 0.035, 0.02), accent, asset_id, bevel=0.008))
    elif shape == 'reed-cluster':
        # Wetland reed fan for the crossing banks: thin blades at raked
        # angles around a mud hummock, seed heads catching the light.
        blade = material(f'{asset_id}_blade', palette['primary'], roughness=0.85)
        blade_lit = material(f'{asset_id}_blade_lit', tone(palette['primary'], 1.3), roughness=0.7)
        mud = material(f'{asset_id}_mud', tone(palette['secondary'], 0.85), roughness=0.98)
        head = material(f'{asset_id}_head', tone(palette['secondary'], 1.5), roughness=0.8)
        add(cube(f'{asset_id}_Hummock', (0.0, 0.0, 0.05), (0.30, 0.24, 0.055), mud, asset_id, bevel=0.04))
        blades = (
            (0.0, 0.0, 0.95, 0, 3), (0.10, 0.05, 0.85, 24, -6), (-0.10, -0.03, 0.9, 210, 8),
            (0.16, -0.08, 0.7, 120, 12), (-0.16, 0.08, 0.75, 300, -10), (0.05, 0.13, 0.8, 70, 7),
            (-0.06, -0.13, 0.68, 250, -9), (0.20, 0.10, 0.6, 30, 14), (-0.20, -0.08, 0.62, 200, -13),
        )
        for index, (x, y, height, yaw, lean) in enumerate(blades):
            r = math.radians(yaw)
            mat = blade_lit if index % 3 == 0 else blade
            add(cube(f'{asset_id}_Blade_{index}', (x, y, height / 2 + 0.06), (0.016, 0.05, height / 2), mat, asset_id, bevel=0.006, rotation=(math.radians(lean) * math.sin(r), math.radians(lean) * math.cos(r), r)))
            if index % 2 == 0:
                add(cone(f'{asset_id}_Head_{index}', (x + math.sin(r) * 0.03, y + math.cos(r) * 0.03, height + 0.10), 0.028, 0.16, head, asset_id))
        add(cube(f'{asset_id}_WaterGlint', (0.24, -0.14, 0.025), (0.07, 0.05, 0.012), accent, asset_id, bevel=0.006))
    elif shape == 'driftwood-log':
        # Beached weathered log, third pass: the rotated root disc never read
        # from the 55-degree camera. The root end is now a chunky faceted
        # mass (the boulder recipe, which ships), the trunk is fat with a
        # hard bleach/bark value split, and two upturned arms give the
        # silhouette height.
        bleach = material(f'{asset_id}_bleach', tone(palette['primary'], 1.45), roughness=0.82)
        bark = material(f'{asset_id}_bark', tone(palette['secondary'], 0.7), roughness=0.96)
        log_yaw = math.radians(20)
        add(cylinder(f'{asset_id}_Trunk', (0.10, 0.0, 0.24), 0.23, 1.00, primary, asset_id, vertices=12, rotation=(0, math.radians(86), log_yaw)))
        add(cylinder(f'{asset_id}_TrunkTaper', (0.56, 0.19, 0.20), 0.15, 0.34, bark, asset_id, vertices=10, rotation=(0, math.radians(86), log_yaw)))
        add(cube(f'{asset_id}_TopBleach', (0.10, 0.02, 0.46), (0.42, 0.13, 0.028), bleach, asset_id, bevel=0.012, rotation=(0, 0, log_yaw)))
        add(cube(f'{asset_id}_SideBark', (0.10, -0.20, 0.24), (0.44, 0.03, 0.14), bark, asset_id, bevel=0.015, rotation=(0, 0, log_yaw)))
        # Root mass: stacked faceted chunks rising above the trunk line.
        root_chunks = (
            (-0.46, -0.17, 0.30, 0.24, 0.22, 0.30, 0.1, 0.5, primary),
            (-0.52, -0.10, 0.62, 0.17, 0.15, 0.16, -0.15, 1.2, bark),
            (-0.36, -0.30, 0.52, 0.14, 0.12, 0.14, 0.2, -0.6, bleach),
            (-0.60, -0.26, 0.44, 0.12, 0.11, 0.13, -0.1, 0.9, bark),
        )
        for index, (x, y, z, sx, sy, sz, rx, rz, mat) in enumerate(root_chunks):
            add(cube(f'{asset_id}_RootChunk_{index}', (x, y, z), (sx, sy, sz), mat, asset_id, bevel=min(sx, sz) * 0.35, rotation=(rx, 0.0, rz)))
        for index, (x, y, dz, rz) in enumerate(((-0.50, -0.02, 0.78, 0.4), (-0.40, -0.34, 0.68, -0.8), (-0.64, -0.18, 0.70, 1.5))):
            add(cone(f'{asset_id}_RootSpike_{index}', (x, y, dz), 0.05, 0.20, bark if index % 2 else primary, asset_id, rotation=(0.35, 0.15 * index, rz)))
        for index, (x, y, z, branch_yaw, pitch) in enumerate(((0.00, 0.16, 0.48, 0.6, 52), (0.34, -0.12, 0.42, -0.9, 60))):
            add(cylinder(f'{asset_id}_Arm_{index}', (x, y, z), 0.05, 0.32, bark, asset_id, vertices=8, rotation=(math.radians(pitch), 0, branch_yaw)))
            add(cone(f'{asset_id}_ArmTip_{index}', (x + math.sin(branch_yaw) * 0.09, y + math.cos(branch_yaw) * 0.09, z + 0.17), 0.045, 0.10, bleach, asset_id))
        add(cube(f'{asset_id}_SandDrift', (0.38, -0.24, 0.035), (0.26, 0.13, 0.035), material(f'{asset_id}_sand', tone(palette['primary'], 0.72), roughness=0.98), asset_id, bevel=0.02, rotation=(0, 0, log_yaw)))
    elif shape == 'ruined-wall':
        # Broken L-shaped masonry segment. Polish pass: the first flat run
        # washed out — now taller (chest-high peaks), thicker, yawed 18
        # degrees, with a dark exposed-core face and higher brick contrast.
        yaw = math.radians(18)
        mortar = material(f'{asset_id}_mortar', tone(palette['primary'], 1.28), roughness=0.9)
        core = material(f'{asset_id}_core', tone(palette['secondary'], 0.62), roughness=0.95)
        brick = material(f'{asset_id}_brick', '#8a5a48', roughness=0.92)
        wall_parts = []
        wall_parts.append(prism_mesh(f'{asset_id}_Run', [(-0.58, 0.0), (0.58, 0.0), (0.58, 0.34), (0.40, 0.34), (0.38, 0.72), (0.12, 0.72), (0.10, 0.95), (-0.20, 0.95), (-0.22, 0.58), (-0.44, 0.58), (-0.46, 0.80), (-0.58, 0.80)], -0.13, 0.13, primary, asset_id))
        # Exposed rubble core along the broken top steps: a darker inset slab.
        wall_parts.append(prism_mesh(f'{asset_id}_Core', [(-0.20, 0.56), (0.10, 0.56), (0.10, 0.93), (-0.18, 0.93)], -0.08, 0.08, core, asset_id))
        wall_parts.append(prism_mesh(f'{asset_id}_Wing', [(-0.13, 0.0), (0.13, 0.0), (0.13, 0.52), (0.02, 0.52), (0.0, 0.38), (-0.13, 0.38)], -0.56, -0.13, mortar, asset_id, location=(-0.45, 0.0, 0.0)))
        for part in wall_parts:
            part.rotation_euler = (0.0, 0.0, yaw)
            parts.append(part)
        for index, (x, z, sx) in enumerate(((-0.32, 0.55, 0.11), (0.0, 0.70, 0.10), (0.28, 0.32, 0.12), (-0.50, 0.77, 0.07), (0.09, 0.92, 0.08))):
            add(cube(f'{asset_id}_BrickTop_{index}', (x, 0.0, z), (sx, 0.135, 0.045), brick, asset_id, bevel=0.01, rotation=(0, 0, yaw + index * 0.06)))
        for index, (x, y, z) in enumerate(((0.50, -0.30, 0.05), (-0.05, -0.34, 0.06), (0.22, -0.28, 0.045))):
            add(cube(f'{asset_id}_Rubble_{index}', (x, y, z), (0.09, 0.075, 0.05), index % 2 and brick or mortar, asset_id, bevel=0.018, rotation=(0.2, 0, index * 0.7)))
        add(cube(f'{asset_id}_Conduit', (0.40, 0.13, 0.24), (0.022, 0.022, 0.22), material(f'{asset_id}_conduit', '#20262c', roughness=0.6), asset_id, bevel=0.006, rotation=(0, 0, yaw)))
        add(cube(f'{asset_id}_ConduitLight', (0.40, 0.13, 0.50), (0.032, 0.032, 0.024), accent, asset_id, bevel=0.008, rotation=(0, 0, yaw)))
    elif shape == 'watchtower':
        # Frontier watch platform: four raked legs, braced deck, roof and a
        # powered lamp. Anchor-scale silhouette for the relay compound.
        timber = material(f'{asset_id}_timber', tone(palette['primary'], 0.9), roughness=0.9)
        timber_lit = material(f'{asset_id}_timber_lit', tone(palette['primary'], 1.22), roughness=0.78)
        roof_mat = material(f'{asset_id}_roof', tone(palette['secondary'], 1.1), roughness=0.85)
        for sx in (-1, 1):
            for sy in (-1, 1):
                add(cylinder(f'{asset_id}_Leg_{sx}_{sy}', (sx * 0.30, sy * 0.24, 0.55), 0.045, 1.14, timber, asset_id, vertices=8, rotation=(math.radians(-7) * sy, math.radians(7) * sx, 0)))
        add(cube(f'{asset_id}_BraceX', (0.0, 0.245, 0.44), (0.30, 0.02, 0.025), timber_lit, asset_id, bevel=0.006, rotation=(0, math.radians(32), 0)))
        add(cube(f'{asset_id}_BraceX2', (0.0, -0.245, 0.44), (0.30, 0.02, 0.025), timber_lit, asset_id, bevel=0.006, rotation=(0, math.radians(-32), 0)))
        parts.append(prism_mesh(f'{asset_id}_Deck', [(-0.42, 1.06), (0.42, 1.06), (0.42, 1.12), (-0.42, 1.12)], -0.36, 0.36, timber_lit, asset_id))
        parts.append(prism_mesh(f'{asset_id}_Rail', [(-0.42, 1.12), (-0.38, 1.12), (-0.38, 1.34), (-0.42, 1.34)], -0.36, 0.36, timber, asset_id))
        parts.append(prism_mesh(f'{asset_id}_Rail2', [(0.38, 1.12), (0.42, 1.12), (0.42, 1.34), (0.38, 1.34)], -0.36, 0.36, timber, asset_id))
        roof = prism_mesh(f'{asset_id}_Roof', [(-0.46, 1.52), (0.46, 1.52), (0.0, 1.74)], -0.40, 0.40, roof_mat, asset_id)
        parts.append(roof)
        for sx in (-1, 1):
            add(cylinder(f'{asset_id}_RoofPost_{sx}', (sx * 0.34, 0.0, 1.42), 0.025, 0.22, timber, asset_id, vertices=8))
        add(cube(f'{asset_id}_Ladder', (0.0, -0.30, 0.55), (0.02, 0.015, 0.52), timber_lit, asset_id, bevel=0.004, rotation=(math.radians(8), 0, 0)))
        for rung in range(5):
            add(cube(f'{asset_id}_Rung_{rung}', (0.0, -0.315 - rung * 0.008, 0.18 + rung * 0.2), (0.09, 0.012, 0.012), timber, asset_id, bevel=0.003))
        add(cube(f'{asset_id}_Lamp', (0.0, 0.0, 1.40), (0.05, 0.05, 0.05), accent, asset_id, bevel=0.015))
    elif shape == 'cargo-container':
        # Corrugated shipping container, doors ajar. Polish pass: the first
        # axis-aligned low box read as a flat slab from the 55-degree camera.
        # Now taller, shorter, and yawed 28 degrees so two faces read, with a
        # strong rib/frame value split and a bigger neon tag.
        yaw = math.radians(28)
        shell = material(f'{asset_id}_shell', tone(palette['primary'], 1.1), roughness=0.85)
        shell_dark = material(f'{asset_id}_shell_dark', tone(palette['primary'], 0.55), roughness=0.9)
        frame_mat = material(f'{asset_id}_frame', tone(palette['secondary'], 1.6), roughness=0.6, metallic=0.3)
        container_parts = []
        profile = [(-0.52, 0.0), (0.52, 0.0), (0.52, 0.86), (-0.52, 0.86)]
        container_parts.append(prism_mesh(f'{asset_id}_Body', profile, -0.30, 0.30, shell, asset_id))
        for index in range(6):
            x = -0.42 + index * 0.168
            container_parts.append(prism_mesh(f'{asset_id}_Rib_{index}', [(x - 0.026, 0.03), (x + 0.026, 0.03), (x + 0.026, 0.83), (x - 0.026, 0.83)], -0.315, 0.315, shell_dark, asset_id))
        container_parts.append(prism_mesh(f'{asset_id}_FrameTop', [(-0.535, 0.83), (0.535, 0.83), (0.535, 0.90), (-0.535, 0.90)], -0.325, 0.325, frame_mat, asset_id))
        container_parts.append(prism_mesh(f'{asset_id}_FrameBase', [(-0.535, 0.0), (0.535, 0.0), (0.535, 0.06), (-0.535, 0.06)], -0.325, 0.325, frame_mat, asset_id))
        for corner in (-0.535, 0.535):
            container_parts.append(prism_mesh(f'{asset_id}_Post_{corner}', [(corner - 0.024, 0.0), (corner + 0.024, 0.0), (corner + 0.024, 0.90), (corner - 0.024, 0.90)], -0.325, 0.325, frame_mat, asset_id))
        door = prism_mesh(f'{asset_id}_Door', [(-0.02, 0.06), (0.34, 0.06), (0.34, 0.83), (-0.02, 0.83)], -0.016, 0.016, shell_dark, asset_id, location=(0.52, -0.36, 0.0))
        door.rotation_euler = (0.0, 0.0, math.radians(-58))
        container_parts.append(door)
        for part in container_parts:
            part.rotation_euler = (part.rotation_euler[0], part.rotation_euler[1], part.rotation_euler[2] + yaw)
            parts.append(part)
        add(cube(f'{asset_id}_Tag', (-0.26, -0.36, 0.52), (0.18, 0.014, 0.13), accent, asset_id, bevel=0.008, rotation=(0, 0, yaw)))
        add(cube(f'{asset_id}_Lock', (0.55, 0.16, 0.40), (0.02, 0.035, 0.06), frame_mat, asset_id, bevel=0.006, rotation=(0, 0, yaw)))
    elif shape == 'ore-conveyor':
        # Mining conveyor segment: A-frame legs, raked belt with ore lumps,
        # drive drum with a powered warning stripe.
        steel = material(f'{asset_id}_steel', palette['primary'], roughness=0.7, metallic=0.35)
        steel_dark = material(f'{asset_id}_steel_dark', tone(palette['primary'], 0.7), roughness=0.8, metallic=0.3)
        belt = material(f'{asset_id}_belt', '#232426', roughness=0.92)
        ore = material(f'{asset_id}_ore', tone(palette['secondary'], 1.4), roughness=0.85)
        for index, (x, height) in enumerate(((-0.44, 0.34), (0.10, 0.56), (0.56, 0.78))):
            for sy in (-1, 1):
                add(cylinder(f'{asset_id}_Leg_{index}_{sy}', (x, sy * 0.16, height / 2), 0.028, height, steel_dark, asset_id, vertices=8, rotation=(math.radians(-8) * sy, 0, 0)))
        parts.append(prism_mesh(f'{asset_id}_Frame', [(-0.62, 0.30), (0.72, 0.72), (0.72, 0.78), (-0.62, 0.36)], -0.16, 0.16, steel, asset_id))
        parts.append(prism_mesh(f'{asset_id}_Belt', [(-0.60, 0.365), (0.70, 0.785), (0.70, 0.805), (-0.60, 0.385)], -0.13, 0.13, belt, asset_id))
        for index, (t, size) in enumerate(((0.15, 0.05), (0.38, 0.06), (0.60, 0.045), (0.80, 0.055))):
            x = -0.60 + t * 1.30
            z = 0.385 + t * 0.42 + size
            add(cube(f'{asset_id}_Ore_{index}', (x, (index % 2 - 0.5) * 0.1, z), (size, size, size), ore, asset_id, bevel=size * 0.3, rotation=(0.3, 0, index * 0.8)))
        add(cylinder(f'{asset_id}_Drum', (0.74, 0.0, 0.79), 0.06, 0.30, steel_dark, asset_id, vertices=12, rotation=(math.radians(90), 0, 0)))
        add(cube(f'{asset_id}_Stripe', (0.74, 0.0, 0.87), (0.05, 0.26, 0.014), accent, asset_id, bevel=0.005))
        add(cube(f'{asset_id}_Hopper', (-0.62, 0.0, 0.22), (0.10, 0.14, 0.10), steel, asset_id, bevel=0.02))

    # --- A2 undergrowth -------------------------------------------------
    # The layer between "tree" and "bare ground". Every one of these is built
    # to stand UP: driftwood-log proved three times over that a low horizontal
    # mass disappears at the 55-degree camera, and undergrowth is the category
    # most tempted toward ground-hugging shapes. Mass sits in a raised crown,
    # not a flat skirt, and the lit/dark value split runs top-to-bottom so the
    # silhouette separates from the ground band it stands on.
    elif shape == 'scrub-bush':
        # Fourth pass, authored cards. Primitive assembly gave this a rock-pile
        # read, then a grass read, then floating crown plates. The silhouette is
        # now drawn directly: three overlapping bush masses with notched tops,
        # set at different depths and values so the crown reads as layered
        # foliage rather than one flat blob.
        wood = material(f'{asset_id}_wood', tone(palette['secondary'], 0.70), roughness=0.94)
        leaf_dark = material(f'{asset_id}_leaf_dark', tone(palette['primary'], 0.64), roughness=0.90)
        leaf_mid = material(f'{asset_id}_leaf_mid', palette['primary'], roughness=0.86)
        leaf_lit = material(f'{asset_id}_leaf_lit', tone(palette['primary'], 1.32), roughness=0.76)
        add(cylinder(f'{asset_id}_Stem', (0.0, 0.0, 0.10), 0.038, 0.20, wood, asset_id, vertices=8))
        back = [
            (-0.19, 0.14), (-0.15, 0.52), (-0.09, 0.40), (-0.04, 0.72), (0.00, 0.50),
            (0.06, 0.76), (0.11, 0.46), (0.16, 0.60), (0.20, 0.16), (0.14, 0.05), (-0.14, 0.05),
        ]
        parts.append(prism_mesh(f'{asset_id}_MassBack', back, 0.05, 0.11, leaf_dark, asset_id))
        mid = [
            (-0.16, 0.12), (-0.12, 0.60), (-0.06, 0.46), (-0.01, 0.84), (0.04, 0.55),
            (0.09, 0.82), (0.14, 0.44), (0.17, 0.62), (0.18, 0.13), (0.12, 0.04), (-0.12, 0.04),
        ]
        parts.append(prism_mesh(f'{asset_id}_MassMid', mid, -0.04, 0.05, leaf_mid, asset_id))
        front = [
            (-0.13, 0.10), (-0.09, 0.52), (-0.04, 0.38), (0.01, 0.68), (0.05, 0.42),
            (0.10, 0.58), (0.13, 0.32), (0.15, 0.09), (0.09, 0.03), (-0.10, 0.03),
        ]
        parts.append(prism_mesh(f'{asset_id}_MassFront', front, -0.12, -0.04, leaf_lit, asset_id))
        for index, (x, z, w) in enumerate(((-0.17, 0.42, 0.050), (0.17, 0.48, 0.046), (0.01, 0.90, 0.042))):
            leaf = [(x - w, z), (x, z + w * 1.7), (x + w, z), (x, z - w * 0.5)]
            parts.append(prism_mesh(f'{asset_id}_Sprig_{index}', leaf, -0.14, -0.10, leaf_lit if index % 2 else leaf_mid, asset_id))
        add(cube(f'{asset_id}_Berry', (0.04, -0.13, 0.66), (0.030, 0.028, 0.030), accent, asset_id, bevel=0.011))
    elif shape == 'fern-cluster':
        # Fourth pass, authored cards. The cone-tipped fronds never met their
        # blades and the two-plate rebuild broke into an X of loose segments.
        # Each frond is now ONE polygon with its taper and arc drawn in, so
        # there is no seam that can open up.
        frond = material(f'{asset_id}_frond', palette['primary'], roughness=0.86)
        frond_lit = material(f'{asset_id}_frond_lit', tone(palette['primary'], 1.34), roughness=0.72)
        frond_dark = material(f'{asset_id}_frond_dark', tone(palette['primary'], 0.68), roughness=0.9)
        litter = material(f'{asset_id}_litter', tone(palette['secondary'], 0.8), roughness=0.97)
        add(cube(f'{asset_id}_Crown', (0.0, 0.0, 0.05), (0.13, 0.11, 0.05), litter, asset_id, bevel=0.03))

        def frond_profile(tip_x, tip_z, width, notches=4):
            """One arching frond: a spine from the crown to (tip_x, tip_z) with
            saw-tooth pinnae down the outer edge."""
            points = [(0.0, 0.07)]
            for step in range(1, notches + 1):
                t = step / notches
                # Quadratic arc: rises fast, then leans out toward the tip.
                x = tip_x * (t ** 1.45)
                z = 0.07 + (tip_z - 0.07) * (t ** 0.72)
                spread = width * (1.0 - 0.55 * t)
                points.append((x - spread * 0.35, z + spread * 0.55))
                points.append((x + spread * 0.30, z + spread * 0.15))
            points.append((tip_x, tip_z))
            for step in range(notches, 0, -1):
                t = step / notches
                x = tip_x * (t ** 1.45)
                z = 0.07 + (tip_z - 0.07) * (t ** 0.72)
                spread = width * (1.0 - 0.55 * t)
                points.append((x + spread * 0.30, z - spread * 0.45))
            return points

        fronds = (
            (-0.19, 0.82, 0.078, -0.06, -0.05, frond_dark),
            (-0.10, 1.00, 0.074, -0.03, 0.02, frond),
            (0.01, 1.10, 0.070, 0.0, -0.03, frond_lit),
            (0.12, 0.98, 0.074, 0.03, 0.04, frond),
            (0.20, 0.78, 0.078, 0.06, -0.06, frond_dark),
            (-0.05, 0.72, 0.066, -0.01, 0.08, frond_lit),
            (0.08, 0.68, 0.066, 0.02, 0.09, frond),
        )
        for index, (tip_x, tip_z, width, y_shift, depth, mat) in enumerate(fronds):
            profile = [(x + y_shift, z) for x, z in frond_profile(tip_x, tip_z, width)]
            parts.append(prism_mesh(
                f'{asset_id}_Frond_{index}', profile,
                depth - 0.016, depth + 0.016, mat, asset_id,
            ))
        add(cube(f'{asset_id}_Curl', (0.01, -0.04, 1.16), (0.038, 0.032, 0.045), accent, asset_id, bevel=0.015))
    elif shape == 'grass-tuft':
        # Tall grass: a fan of raked blades. Deliberately narrow in plan and
        # tall in elevation -- a wide low tuft is exactly the silhouette the
        # camera loses against the ground band.
        blade = material(f'{asset_id}_blade', palette['primary'], roughness=0.88)
        blade_lit = material(f'{asset_id}_blade_lit', tone(palette['primary'], 1.32), roughness=0.74)
        blade_dry = material(f'{asset_id}_blade_dry', tone(palette['secondary'], 1.12), roughness=0.9)
        soil = material(f'{asset_id}_soil', tone(palette['secondary'], 0.7), roughness=0.98)
        add(cube(f'{asset_id}_Base', (0.0, 0.0, 0.05), (0.15, 0.13, 0.05), soil, asset_id, bevel=0.03))
        blades = (
            (0.00, 0.00, 0.78, 5, 4), (0.07, 0.04, 0.70, 40, -9), (-0.07, -0.03, 0.74, 215, 10),
            (0.11, -0.06, 0.60, 130, 14), (-0.11, 0.06, 0.64, 305, -12), (0.03, 0.10, 0.66, 75, 8),
            (-0.04, -0.10, 0.56, 250, -11), (0.13, 0.08, 0.50, 25, 16), (-0.13, -0.06, 0.52, 195, -15),
            (0.00, -0.12, 0.58, 160, 12),
        )
        for index, (x, y, height, yaw, lean) in enumerate(blades):
            r = math.radians(yaw)
            mat = (blade_lit, blade, blade_dry)[index % 3]
            add(cube(
                f'{asset_id}_Blade_{index}',
                (x, y, height / 2 + 0.06),
                (0.014, 0.042, height / 2),
                mat, asset_id, bevel=0.005,
                rotation=(math.radians(lean) * math.sin(r), math.radians(lean) * math.cos(r), r),
            ))
        add(cone(f'{asset_id}_Seed', (0.02, 0.01, 0.90), 0.022, 0.13, accent, asset_id))
    elif shape == 'thorn-bramble':
        # Fourth pass, authored cards. Cylinder canes read as a woodpile at any
        # thickness I tried. The tangle is now drawn as spiked silhouette
        # polygons, so the thorns are part of the outline instead of separate
        # cones that scatter.
        cane = material(f'{asset_id}_cane', tone(palette['primary'], 0.66), roughness=0.92)
        cane_lit = material(f'{asset_id}_cane_lit', tone(palette['primary'], 1.05), roughness=0.84)
        leaf = material(f'{asset_id}_leaf', tone(palette['secondary'], 0.9), roughness=0.9)
        dirt = material(f'{asset_id}_dirt', tone(palette['secondary'], 0.58), roughness=0.98)
        add(cube(f'{asset_id}_Mound', (0.0, 0.0, 0.055), (0.17, 0.15, 0.055), dirt, asset_id, bevel=0.035))

        def cane_profile(lean, height, thickness):
            """A cane rising from the mound with thorns barbed off both edges."""
            points = []
            steps = 5
            for step in range(steps + 1):
                t = step / steps
                x = lean * (t ** 1.3)
                z = 0.08 + (height - 0.08) * t
                barb = thickness * (2.6 if step % 2 == 1 else 1.0)
                points.append((x - barb, z))
            points.append((lean, height + 0.05))
            for step in range(steps, -1, -1):
                t = step / steps
                x = lean * (t ** 1.3)
                z = 0.08 + (height - 0.08) * t
                barb = thickness * (2.6 if step % 2 == 0 else 1.0)
                points.append((x + barb, z))
            return points

        canes = (
            (-0.17, 0.72, 0.017, -0.06, cane),
            (-0.07, 0.94, 0.019, 0.01, cane_lit),
            (0.04, 0.86, 0.018, -0.03, cane),
            (0.14, 0.68, 0.017, 0.05, cane_lit),
            (0.21, 0.52, 0.015, -0.08, cane),
            (-0.22, 0.54, 0.015, 0.07, cane_lit),
        )
        for index, (lean, height, thickness, depth, mat) in enumerate(canes):
            parts.append(prism_mesh(
                f'{asset_id}_Cane_{index}', cane_profile(lean, height, thickness),
                depth - 0.014, depth + 0.014, mat, asset_id,
            ))
        for index, (x, z, w) in enumerate(((-0.11, 0.48, 0.046), (0.09, 0.58, 0.042), (0.0, 0.32, 0.046))):
            blade = [(x - w, z), (x, z + w * 1.3), (x + w, z), (x, z - w * 0.6)]
            parts.append(prism_mesh(f'{asset_id}_Leaf_{index}', blade, -0.10, -0.07, leaf, asset_id))
        add(cube(f'{asset_id}_Berry', (0.03, -0.09, 0.80), (0.028, 0.026, 0.028), accent, asset_id, bevel=0.010))
    elif shape == 'flowering-weeds':
        # Ruderal weed patch: leggy stems carrying flower heads at varied
        # heights. The colour interest sits at the TOP of the silhouette where
        # the camera can see it, not on the ground.
        stem = material(f'{asset_id}_stem', palette['primary'], roughness=0.88)
        stem_lit = material(f'{asset_id}_stem_lit', tone(palette['primary'], 1.3), roughness=0.76)
        leaf = material(f'{asset_id}_leaf', tone(palette['primary'], 0.78), roughness=0.9)
        bloom = material(f'{asset_id}_bloom', tone(palette['secondary'], 1.35), roughness=0.62)
        dirt = material(f'{asset_id}_dirt', tone(palette['secondary'], 0.6), roughness=0.98)
        add(cube(f'{asset_id}_Soil', (0.0, 0.0, 0.045), (0.22, 0.19, 0.045), dirt, asset_id, bevel=0.035))
        stems = (
            (0.00, 0.00, 0.72, 6, bloom),
            (0.12, 0.06, 0.58, -14, bloom),
            (-0.12, -0.05, 0.62, 12, accent),
            (0.07, -0.13, 0.48, -18, bloom),
            (-0.09, 0.13, 0.52, 16, accent),
            (0.16, -0.02, 0.40, -22, bloom),
        )
        for index, (x, y, height, lean, head_mat) in enumerate(stems):
            lean_r = math.radians(lean)
            mat = stem_lit if index % 2 == 0 else stem
            add(cylinder(f'{asset_id}_Stem_{index}', (x, y, height / 2 + 0.06), 0.011, height, mat, asset_id, vertices=6, rotation=(0.0, lean_r, 0.0)))
            top_x = x + math.sin(lean_r) * height * 0.5
            add(cone(f'{asset_id}_Bloom_{index}', (top_x, y, height + 0.09), 0.045, 0.11, head_mat, asset_id, rotation=(0.0, lean_r, 0.0)))
            add(cube(f'{asset_id}_Leaf_{index}', (x + 0.05, y, height * 0.45), (0.06, 0.014, 0.028), leaf, asset_id, bevel=0.008, rotation=(0.0, 0.25, index * 0.9)))
    elif shape == 'hanging-vines':
        # Fifth pass. Rods with regular leaf ticks read as a ladder; random
        # leans read as scattered diagonals; one filled curtain polygon read as
        # a solid slab, because a polygon has no holes and the gaps BETWEEN
        # strands are most of what makes a drape look like foliage. Each strand
        # is now its own narrow ribbon with leaf lobes bulging off its outline,
        # so the leaves ride the vine and the negative space survives.
        anchor = material(f'{asset_id}_anchor', tone(palette['secondary'], 0.60), roughness=0.96)
        vine = material(f'{asset_id}_vine', palette['primary'], roughness=0.88)
        vine_lit = material(f'{asset_id}_vine_lit', tone(palette['primary'], 1.30), roughness=0.76)
        vine_dark = material(f'{asset_id}_vine_dark', tone(palette['primary'], 0.66), roughness=0.9)
        add(cube(f'{asset_id}_Spar', (0.0, 0.0, 0.95), (0.28, 0.045, 0.028), anchor, asset_id, bevel=0.010))

        def strand(x0, bottom_z, sway, leaf_at, thickness=0.014, leaf=0.048):
            """One vine: a slightly swaying ribbon from the spar down to
            bottom_z, with leaf lobes swelling off alternating sides."""
            top_z = 0.93
            steps = 8
            left, right = [], []
            for step in range(steps + 1):
                t = step / steps
                z = top_z - (top_z - bottom_z) * t
                x = x0 + sway * math.sin(t * 2.4)
                grow = leaf if step in leaf_at else 0.0
                side = 1 if step % 2 == 0 else -1
                left.append((x - thickness - (grow if side < 0 else 0.0), z))
                right.append((x + thickness + (grow if side > 0 else 0.0), z))
            # Down the left edge, across the tip, back up the right edge.
            points = list(left)
            points.append((x0 + sway * math.sin(2.4), bottom_z - 0.05))
            points.extend(reversed(right))
            return points

        strands = (
            (-0.235, 0.30, 0.035, (2, 5), vine_dark, 0.052),
            (-0.145, 0.10, -0.030, (1, 4, 7), vine, -0.005),
            (-0.050, 0.34, 0.028, (3, 6), vine_lit, -0.062),
            (0.045, 0.06, -0.034, (2, 5, 7), vine, -0.005),
            (0.140, 0.26, 0.030, (1, 4), vine_lit, -0.062),
            (0.230, 0.42, -0.026, (2, 5), vine_dark, 0.052),
        )
        for index, (x0, bottom_z, sway, leaf_at, mat, depth) in enumerate(strands):
            parts.append(prism_mesh(
                f'{asset_id}_Vine_{index}', strand(x0, bottom_z, sway, leaf_at),
                depth - 0.013, depth + 0.013, mat, asset_id,
            ))
        add(cube(f'{asset_id}_Bloom', (-0.05, -0.078, 0.52), (0.030, 0.016, 0.028), accent, asset_id, bevel=0.010))
    # --- A3 rock and cliff -----------------------------------------------
    # Authored silhouettes again. Rock is faceted by construction here: the
    # facets ARE the profile vertices, so there is no way for a smooth sphere
    # to creep back in (established twice in earlier cycles that smooth
    # spheres read badly at this projection).
    elif shape == 'rock-spire':
        # A weathered needle. Tall and narrow on purpose -- this is the
        # vertical accent the ravine had no authored version of.
        stone = material(f'{asset_id}_stone', palette['primary'], roughness=0.9)
        stone_lit = material(f'{asset_id}_stone_lit', tone(palette['primary'], 1.26), roughness=0.82)
        stone_dark = material(f'{asset_id}_stone_dark', tone(palette['primary'], 0.62), roughness=0.94)
        base = [(-0.28, 0.0), (-0.20, 0.20), (-0.10, 0.14), (0.06, 0.22), (0.18, 0.10), (0.26, 0.0)]
        parts.append(prism_mesh(f'{asset_id}_Base', base, -0.20, 0.18, stone_dark, asset_id))
        shaft = [(-0.16, 0.10), (-0.11, 0.62), (-0.05, 1.02), (0.02, 1.34), (0.07, 0.96), (0.13, 0.58), (0.18, 0.08)]
        parts.append(prism_mesh(f'{asset_id}_Shaft', shaft, -0.11, 0.09, stone, asset_id))
        lit = [(-0.07, 0.20), (-0.04, 0.70), (0.01, 1.30), (0.05, 0.86), (0.09, 0.24)]
        parts.append(prism_mesh(f'{asset_id}_LitFace', lit, -0.14, -0.10, stone_lit, asset_id))
        flake = [(0.14, 0.30), (0.24, 0.52), (0.30, 0.40), (0.22, 0.18)]
        parts.append(prism_mesh(f'{asset_id}_Flake', flake, -0.08, 0.02, stone_dark, asset_id))
        add(cube(f'{asset_id}_Fleck', (-0.06, -0.13, 0.92), (0.030, 0.020, 0.026), accent, asset_id, bevel=0.008))
    elif shape == 'rock-shelf':
        # Third pass. Centred concentric steps read as a ziggurat. Sedimentary
        # bedding is asymmetric: the strata now shear to the left as they rise,
        # each one overhanging the last on one side only, with a tilted bedding
        # plane. Depth still steps back so no layer buries the one behind it.
        stone = material(f'{asset_id}_stone', palette['primary'], roughness=0.9)
        stone_lit = material(f'{asset_id}_stone_lit', tone(palette['primary'], 1.30), roughness=0.78)
        stone_dark = material(f'{asset_id}_stone_dark', tone(palette['primary'], 0.56), roughness=0.95)
        seam = material(f'{asset_id}_seam', tone(palette['secondary'], 0.72), roughness=0.96)
        strata = (
            ([(-0.20, 0.0), (-0.24, 0.20), (0.34, 0.26), (0.32, 0.0)], -0.25, -0.16, stone_lit),
            ([(-0.30, 0.19), (-0.33, 0.39), (0.24, 0.44), (0.27, 0.24)], -0.14, -0.05, stone),
            ([(-0.36, 0.38), (-0.34, 0.56), (0.12, 0.61), (0.17, 0.42)], -0.03, 0.06, stone_dark),
            ([(-0.30, 0.55), (-0.26, 0.74), (0.02, 0.78), (0.06, 0.59)], 0.08, 0.17, stone),
        )
        for index, (profile, y0, y1, mat) in enumerate(strata):
            parts.append(prism_mesh(f'{asset_id}_Stratum_{index}', profile, y0, y1, mat, asset_id))
        for index, (x0, z0, x1, z1, y) in enumerate((
            (-0.23, 0.185, 0.33, 0.245, -0.26),
            (-0.32, 0.375, 0.235, 0.425, -0.15),
            (-0.35, 0.545, 0.115, 0.595, -0.04),
        )):
            parts.append(prism_mesh(
                f'{asset_id}_Seam_{index}',
                [(x0, z0), (x1, z1), (x1, z1 + 0.022), (x0, z0 + 0.022)],
                y - 0.012, y, seam, asset_id,
            ))
        add(cube(f'{asset_id}_Fleck', (0.18, -0.27, 0.16), (0.028, 0.016, 0.022), accent, asset_id, bevel=0.008))
    elif shape == 'scree-pile':
        # Second pass. A smooth heap outline projected as a plain triangle and
        # the loose chunks were hidden behind it. The outline is now a stepped
        # rubble profile -- every notch is a visible block edge -- and the
        # separate chunks sit in FRONT of the heap rather than beside it.
        stone = material(f'{asset_id}_stone', palette['primary'], roughness=0.93)
        stone_lit = material(f'{asset_id}_stone_lit', tone(palette['primary'], 1.32), roughness=0.82)
        stone_dark = material(f'{asset_id}_stone_dark', tone(palette['primary'], 0.56), roughness=0.96)
        heap_back = [
            (-0.34, 0.0), (-0.30, 0.14), (-0.23, 0.13), (-0.19, 0.31), (-0.11, 0.29),
            (-0.06, 0.50), (0.02, 0.62), (0.08, 0.45), (0.15, 0.47), (0.19, 0.28),
            (0.27, 0.26), (0.31, 0.11), (0.36, 0.0),
        ]
        parts.append(prism_mesh(f'{asset_id}_HeapBack', heap_back, 0.06, 0.22, stone_dark, asset_id))
        heap_mid = [
            (-0.28, 0.0), (-0.24, 0.17), (-0.16, 0.15), (-0.12, 0.34), (-0.04, 0.32),
            (0.00, 0.52), (0.06, 0.38), (0.13, 0.36), (0.17, 0.19), (0.25, 0.17), (0.29, 0.0),
        ]
        parts.append(prism_mesh(f'{asset_id}_HeapMid', heap_mid, -0.10, 0.06, stone, asset_id))
        heap_front = [
            (-0.22, 0.0), (-0.18, 0.13), (-0.10, 0.11), (-0.06, 0.27), (0.01, 0.25),
            (0.05, 0.14), (0.13, 0.12), (0.17, 0.0),
        ]
        parts.append(prism_mesh(f'{asset_id}_HeapFront', heap_front, -0.26, -0.10, stone_lit, asset_id))
        # Loose blocks in front of the pile, faceted, no smooth spheres.
        chunks = (
            (-0.25, 0.055, 0.060, 0.5, stone_lit),
            (0.21, 0.050, 0.052, -0.8, stone),
            (-0.02, 0.055, 0.048, 1.2, stone_dark),
            (0.10, 0.045, 0.044, 0.2, stone_lit),
        )
        for index, (x, z, size, rz, mat) in enumerate(chunks):
            add(cube(f'{asset_id}_Chunk_{index}', (x, -0.30, z), (size, size * 0.8, size * 0.85), mat, asset_id, bevel=size * 0.28, rotation=(0.18, 0.0, rz)))
        add(cube(f'{asset_id}_Fleck', (0.03, -0.32, 0.10), (0.026, 0.016, 0.022), accent, asset_id, bevel=0.007))
    elif shape == 'cliff-face':
        # Third pass. Deep crest notches turned the top into crystal spikes and
        # the relief columns ran the full height like pillars. The crest now
        # varies only between 0.94 and 1.06 -- broken, not toothed -- and the
        # reliefs stop well short of it so they read as fracture planes on a
        # wall. Left and right edges stay straight at matching x so instances
        # abut seamlessly when tiled along a capsule blocker.
        stone = material(f'{asset_id}_stone', palette['primary'], roughness=0.92)
        stone_lit = material(f'{asset_id}_stone_lit', tone(palette['primary'], 1.22), roughness=0.84)
        stone_dark = material(f'{asset_id}_stone_dark', tone(palette['primary'], 0.56), roughness=0.95)
        face = [
            (-0.30, 0.0), (-0.30, 1.00), (-0.19, 1.06), (-0.06, 0.97),
            (0.08, 1.04), (0.20, 0.96), (0.30, 1.01), (0.30, 0.0),
        ]
        parts.append(prism_mesh(f'{asset_id}_Face', face, -0.10, 0.16, stone, asset_id))
        relief = [(-0.25, 0.10), (-0.26, 0.62), (-0.14, 0.70), (-0.12, 0.08)]
        parts.append(prism_mesh(f'{asset_id}_Relief', relief, -0.17, -0.10, stone_dark, asset_id))
        relief_lit = [(0.04, 0.07), (0.06, 0.74), (0.20, 0.64), (0.18, 0.05)]
        parts.append(prism_mesh(f'{asset_id}_ReliefLit', relief_lit, -0.17, -0.10, stone_lit, asset_id))
        ledge = [(-0.28, 0.76), (-0.10, 0.82), (0.06, 0.78), (0.04, 0.70), (-0.26, 0.68)]
        parts.append(prism_mesh(f'{asset_id}_Ledge', ledge, -0.20, -0.15, stone_lit, asset_id))
        talus = [(-0.32, 0.0), (-0.24, 0.16), (-0.10, 0.08), (0.06, 0.18), (0.20, 0.09), (0.32, 0.0)]
        parts.append(prism_mesh(f'{asset_id}_Talus', talus, -0.26, -0.17, stone_dark, asset_id))
        add(cube(f'{asset_id}_Fleck', (-0.02, -0.23, 0.42), (0.026, 0.016, 0.022), accent, asset_id, bevel=0.008))
    elif shape == 'balanced-boulder':
        # Third pass. A big cap on a short pedestal reads as a mushroom, not as
        # a rock that should have fallen over. Inverting the proportions is
        # what sells it: the pedestal is now the tall element, the cap is
        # SMALLER than the pedestal is tall, and it sits off-centre so the mass
        # is visibly not above the support.
        stone = material(f'{asset_id}_stone', palette['primary'], roughness=0.9)
        stone_lit = material(f'{asset_id}_stone_lit', tone(palette['primary'], 1.30), roughness=0.8)
        stone_dark = material(f'{asset_id}_stone_dark', tone(palette['primary'], 0.56), roughness=0.94)
        pad = [(-0.26, 0.0), (-0.19, 0.09), (0.17, 0.10), (0.25, 0.0)]
        parts.append(prism_mesh(f'{asset_id}_Pad', pad, -0.16, 0.04, stone_dark, asset_id))
        # Tall narrow pedestal, frontmost so nothing can occlude the waist.
        pedestal = [(-0.11, 0.07), (-0.07, 0.34), (-0.05, 0.60), (0.06, 0.61), (0.09, 0.33), (0.12, 0.07)]
        parts.append(prism_mesh(f'{asset_id}_Pedestal', pedestal, -0.21, -0.10, stone, asset_id))
        pedestal_lit = [(-0.05, 0.12), (-0.03, 0.58), (0.04, 0.58), (0.06, 0.12)]
        parts.append(prism_mesh(f'{asset_id}_PedestalLit', pedestal_lit, -0.25, -0.21, stone_lit, asset_id))
        # Cap: modest, tilted, and pushed left of the pedestal centre.
        cap = [
            (-0.27, 0.63), (-0.22, 0.80), (-0.09, 0.90), (0.05, 0.86),
            (0.14, 0.74), (0.11, 0.61), (-0.20, 0.59),
        ]
        parts.append(prism_mesh(f'{asset_id}_Cap', cap, -0.08, 0.14, stone, asset_id))
        cap_lit = [(-0.18, 0.70), (-0.10, 0.86), (0.02, 0.83), (0.06, 0.70), (-0.08, 0.64)]
        parts.append(prism_mesh(f'{asset_id}_CapLit', cap_lit, -0.12, -0.08, stone_lit, asset_id))
        # A chock jammed under the low side of the overhang.
        chock = [(0.10, 0.40), (0.13, 0.58), (0.21, 0.57), (0.16, 0.39)]
        parts.append(prism_mesh(f'{asset_id}_Chock', chock, -0.19, -0.13, stone_dark, asset_id))
        add(cube(f'{asset_id}_Fleck', (-0.12, -0.14, 0.76), (0.026, 0.016, 0.022), accent, asset_id, bevel=0.008))
    elif shape == 'ore-vein-rock':
        # Mining-camp stone: a split block with an exposed ore seam. The
        # accent is the seam itself, so the prop reads as worth mining rather
        # than as another grey rock.
        stone = material(f'{asset_id}_stone', palette['primary'], roughness=0.9)
        stone_lit = material(f'{asset_id}_stone_lit', tone(palette['primary'], 1.24), roughness=0.82)
        stone_dark = material(f'{asset_id}_stone_dark', tone(palette['primary'], 0.58), roughness=0.95)
        ore = material(f'{asset_id}_ore', tone(palette['secondary'], 1.35), roughness=0.5, emission=0.22)
        block = [(-0.28, 0.0), (-0.24, 0.44), (-0.12, 0.66), (0.04, 0.72), (0.18, 0.58), (0.26, 0.30), (0.28, 0.0)]
        parts.append(prism_mesh(f'{asset_id}_Block', block, -0.20, 0.18, stone, asset_id))
        shoulder = [(-0.20, 0.30), (-0.14, 0.60), (-0.02, 0.68), (0.06, 0.50), (-0.04, 0.28)]
        parts.append(prism_mesh(f'{asset_id}_Shoulder', shoulder, -0.24, -0.19, stone_lit, asset_id))
        skirt = [(-0.32, 0.0), (-0.22, 0.14), (-0.04, 0.09), (0.14, 0.16), (0.30, 0.0)]
        parts.append(prism_mesh(f'{asset_id}_Skirt', skirt, -0.22, -0.15, stone_dark, asset_id))
        for index, (x0, z0, x1, z1) in enumerate(((-0.16, 0.14, -0.06, 0.46), (0.02, 0.20, 0.12, 0.52), (-0.06, 0.44, 0.04, 0.62))):
            parts.append(prism_mesh(
                f'{asset_id}_Vein_{index}',
                [(x0, z0), (x1, z1), (x1 + 0.035, z1 - 0.035), (x0 + 0.035, z0 - 0.035)],
                -0.26, -0.21, ore, asset_id,
            ))
        add(cube(f'{asset_id}_Fleck', (0.14, -0.24, 0.34), (0.030, 0.018, 0.026), accent, asset_id, bevel=0.008))

    # --- A1 trees, second generation --------------------------------------
    # The first generation was four conifer-ish shapes, so a forest read as one
    # species repeated. These are chosen for silhouette contrast: pale
    # multi-stem, low thicket, bare snag, one-sided canopy, and a fallen trunk
    # whose ROOT PLATE does the vertical work (a horizontal log is the exact
    # shape driftwood-log failed three passes on).
    elif shape == 'birch-cluster':
        # Three pale slender stems from one base, canopy high and narrow.
        bark = material(f'{asset_id}_bark', tone(palette['secondary'], 1.42), roughness=0.84)
        bark_dark = material(f'{asset_id}_bark_dark', tone(palette['secondary'], 0.95), roughness=0.9)
        leaf = material(f'{asset_id}_leaf', palette['primary'], roughness=0.86)
        leaf_lit = material(f'{asset_id}_leaf_lit', tone(palette['primary'], 1.30), roughness=0.76)
        for index, (x0, lean, height, mat) in enumerate((
            (-0.13, -0.05, 1.16, bark), (0.02, 0.03, 1.42, bark), (0.15, 0.07, 1.02, bark_dark),
        )):
            trunk = [
                (x0 - 0.036, 0.0), (x0 - 0.030 + lean * 0.5, height * 0.55),
                (x0 - 0.022 + lean, height), (x0 + 0.022 + lean, height),
                (x0 + 0.030 + lean * 0.5, height * 0.55), (x0 + 0.036, 0.0),
            ]
            parts.append(prism_mesh(f'{asset_id}_Trunk_{index}', trunk, -0.05, 0.05, mat, asset_id))
            for band in range(3):
                z = height * (0.28 + 0.22 * band)
                parts.append(prism_mesh(
                    f'{asset_id}_Band_{index}_{band}',
                    [(x0 - 0.030, z), (x0 + 0.030, z), (x0 + 0.030, z + 0.026), (x0 - 0.030, z + 0.026)],
                    -0.07, -0.05, bark_dark, asset_id,
                ))
        canopies = (
            (-0.11, 1.18, 0.20, 0.06, leaf),
            (0.05, 1.46, 0.22, -0.02, leaf_lit),
            (0.21, 1.04, 0.17, 0.10, leaf),
            (-0.02, 1.30, 0.16, 0.14, leaf_lit),
        )
        for index, (x, z, r, depth, mat) in enumerate(canopies):
            crown = [
                (x - r, z), (x - r * 0.62, z + r * 0.85), (x, z + r * 1.15),
                (x + r * 0.66, z + r * 0.80), (x + r, z - r * 0.10), (x + r * 0.4, z - r * 0.45),
                (x - r * 0.45, z - r * 0.42),
            ]
            parts.append(prism_mesh(f'{asset_id}_Crown_{index}', crown, depth - 0.07, depth + 0.07, mat, asset_id))
        add(cube(f'{asset_id}_Fleck', (0.06, -0.13, 1.52), (0.030, 0.020, 0.026), accent, asset_id, bevel=0.008))
    elif shape == 'sapling-thicket':
        # Many thin young stems, low and dense. The wide-but-short mass is
        # deliberate contrast against the tall singles around it.
        stem = material(f'{asset_id}_stem', tone(palette['secondary'], 0.9), roughness=0.9)
        leaf = material(f'{asset_id}_leaf', palette['primary'], roughness=0.86)
        leaf_lit = material(f'{asset_id}_leaf_lit', tone(palette['primary'], 1.28), roughness=0.78)
        leaf_dark = material(f'{asset_id}_leaf_dark', tone(palette['primary'], 0.68), roughness=0.9)
        # Second pass: pulled in from 0.45 wide and raised, so young growth
        # reads as vertical rather than as a low hedge.
        saplings = (
            (-0.13, 0.72, -0.04, leaf_dark), (-0.06, 0.94, 0.05, leaf),
            (0.01, 0.82, -0.09, leaf_lit), (0.08, 1.02, 0.02, leaf),
            (0.14, 0.78, -0.06, leaf_dark), (-0.02, 0.64, 0.10, leaf_lit),
        )
        for index, (x, height, depth, mat) in enumerate(saplings):
            parts.append(prism_mesh(
                f'{asset_id}_Stem_{index}',
                [(x - 0.016, 0.0), (x - 0.012, height * 0.7), (x + 0.012, height * 0.7), (x + 0.016, 0.0)],
                depth - 0.02, depth + 0.02, stem, asset_id,
            ))
            r = 0.085
            leaf_shape = [
                (x - r, height * 0.58), (x - r * 0.5, height * 0.88), (x, height + 0.06),
                (x + r * 0.55, height * 0.86), (x + r, height * 0.56), (x, height * 0.44),
            ]
            parts.append(prism_mesh(f'{asset_id}_Leaf_{index}', leaf_shape, depth - 0.05, depth + 0.05, mat, asset_id))
        parts.append(prism_mesh(
            f'{asset_id}_Litter',
            [(-0.17, 0.0), (-0.11, 0.055), (0.04, 0.05), (0.13, 0.06), (0.17, 0.0)],
            -0.14, 0.10, material(f'{asset_id}_litter', tone(palette['secondary'], 0.66), roughness=0.97), asset_id,
        ))
        add(cube(f'{asset_id}_Fleck', (0.08, -0.12, 0.86), (0.028, 0.018, 0.024), accent, asset_id, bevel=0.008))
    elif shape == 'burned-snag':
        # A dead standing trunk, charred, with broken limbs. Bare silhouette is
        # the whole read, so the limbs stay part of the trunk profile.
        char = material(f'{asset_id}_char', tone(palette['primary'], 0.42), roughness=0.97)
        char_lit = material(f'{asset_id}_char_lit', tone(palette['primary'], 0.78), roughness=0.9)
        ash = material(f'{asset_id}_ash', tone(palette['secondary'], 1.25), roughness=0.95)
        trunk = [
            (-0.085, 0.0), (-0.070, 0.52), (-0.058, 1.02), (-0.030, 1.44),
            (0.008, 1.38), (0.030, 0.98), (0.052, 0.50), (0.078, 0.0),
        ]
        parts.append(prism_mesh(f'{asset_id}_Trunk', trunk, -0.07, 0.07, char, asset_id))
        parts.append(prism_mesh(
            f'{asset_id}_TrunkLit',
            [(-0.028, 0.06), (-0.020, 1.36), (0.008, 1.32), (0.020, 0.06)],
            -0.10, -0.07, char_lit, asset_id,
        ))
        limbs = (
            ([(-0.06, 0.92), (-0.22, 1.14), (-0.27, 1.08), (-0.06, 0.82)], -0.05, 0.02, char),
            ([(0.04, 1.10), (0.21, 1.28), (0.24, 1.20), (0.04, 1.00)], 0.02, 0.08, char_lit),
            ([(-0.05, 0.56), (-0.18, 0.66), (-0.20, 0.59), (-0.05, 0.48)], 0.03, 0.09, char),
            ([(0.05, 0.68), (0.16, 0.80), (0.18, 0.73), (0.05, 0.60)], -0.09, -0.04, char_lit),
        )
        for index, (profile, y0, y1, mat) in enumerate(limbs):
            parts.append(prism_mesh(f'{asset_id}_Limb_{index}', profile, y0, y1, mat, asset_id))
        parts.append(prism_mesh(
            f'{asset_id}_AshRing',
            [(-0.20, 0.0), (-0.13, 0.045), (0.05, 0.04), (0.17, 0.05), (0.21, 0.0)],
            -0.16, 0.12, ash, asset_id,
        ))
        add(cube(f'{asset_id}_Ember', (-0.02, -0.12, 0.40), (0.026, 0.016, 0.022), accent, asset_id, bevel=0.007))
    elif shape == 'canopy-edge-tree':
        # Asymmetric crown: full on one side, cut back on the other, the way a
        # tree grows at a treeline. Gives a forest edge a real boundary.
        bark = material(f'{asset_id}_bark', tone(palette['secondary'], 0.86), roughness=0.92)
        leaf = material(f'{asset_id}_leaf', palette['primary'], roughness=0.86)
        leaf_lit = material(f'{asset_id}_leaf_lit', tone(palette['primary'], 1.30), roughness=0.76)
        leaf_dark = material(f'{asset_id}_leaf_dark', tone(palette['primary'], 0.66), roughness=0.9)
        trunk = [(-0.07, 0.0), (-0.05, 0.44), (-0.02, 0.70), (0.05, 0.70), (0.06, 0.42), (0.09, 0.0)]
        parts.append(prism_mesh(f'{asset_id}_Trunk', trunk, -0.06, 0.06, bark, asset_id))
        for index, (profile, y0, y1, mat) in enumerate((
            # Crown mass leans hard to +x; the -x side is clipped nearly flat.
            ([(-0.06, 0.62), (-0.09, 0.92), (0.02, 1.14), (0.20, 1.10), (0.33, 0.92), (0.30, 0.66), (0.10, 0.56)], 0.02, 0.16, leaf_dark),
            ([(-0.04, 0.70), (-0.06, 0.96), (0.06, 1.16), (0.24, 1.10), (0.34, 0.90), (0.28, 0.70), (0.08, 0.62)], -0.10, 0.02, leaf),
            ([(0.00, 0.76), (0.02, 1.04), (0.14, 1.12), (0.26, 0.98), (0.22, 0.78), (0.08, 0.70)], -0.18, -0.10, leaf_lit),
        )):
            parts.append(prism_mesh(f'{asset_id}_Crown_{index}', profile, y0, y1, mat, asset_id))
        for index, (profile, y0, y1) in enumerate((
            ([(0.02, 0.62), (0.20, 0.72), (0.21, 0.65), (0.02, 0.54)], -0.04, 0.02),
            ([(-0.02, 0.50), (-0.14, 0.58), (-0.15, 0.52), (-0.02, 0.44)], 0.03, 0.08),
        )):
            parts.append(prism_mesh(f'{asset_id}_Branch_{index}', profile, y0, y1, bark, asset_id))
        add(cube(f'{asset_id}_Fleck', (0.18, -0.19, 0.94), (0.030, 0.018, 0.026), accent, asset_id, bevel=0.008))
    elif shape == 'fallen-trunk':
        # A toppled tree. The trunk is horizontal, which is the shape that
        # killed driftwood-log, so the ROOT PLATE carries the silhouette: a
        # tall upended disc of soil and torn roots standing clear of the log.
        bark = material(f'{asset_id}_bark', tone(palette['secondary'], 0.80), roughness=0.94)
        wood = material(f'{asset_id}_wood', tone(palette['secondary'], 1.30), roughness=0.86)
        soil = material(f'{asset_id}_soil', tone(palette['primary'], 0.58), roughness=0.98)
        moss = material(f'{asset_id}_moss', palette['primary'], roughness=0.94)
        # Root plate: upright, tall, and frontmost so nothing occludes it.
        # Third pass: the roots splayed to x=-0.56 and held the asset at 0.52
        # h/w, under granite-boulder's shipping 0.62. Roots pulled in, plate
        # raised, so the upended disc reads as tall rather than sprawling.
        plate = [
            (-0.34, 0.02), (-0.38, 0.40), (-0.32, 0.74), (-0.20, 0.94), (-0.07, 0.88),
            (-0.03, 0.58), (-0.06, 0.24), (-0.12, 0.02),
        ]
        parts.append(prism_mesh(f'{asset_id}_RootPlate', plate, -0.20, -0.04, soil, asset_id))
        parts.append(prism_mesh(
            f'{asset_id}_PlateFace',
            [(-0.30, 0.14), (-0.32, 0.50), (-0.22, 0.74), (-0.10, 0.62), (-0.10, 0.18)],
            -0.26, -0.20, wood, asset_id,
        ))
        for index, (profile) in enumerate((
            [(-0.36, 0.66), (-0.44, 0.86), (-0.38, 0.90), (-0.30, 0.74)],
            [(-0.24, 0.88), (-0.27, 1.06), (-0.19, 1.04), (-0.18, 0.86)],
            [(-0.37, 0.34), (-0.46, 0.42), (-0.44, 0.50), (-0.34, 0.44)],
        )):
            parts.append(prism_mesh(f'{asset_id}_Root_{index}', profile, -0.24, -0.16, bark, asset_id))
        # Second pass: the log ran to x=0.48 as a thin sliver, which dominated
        # the bounding box and dragged the asset to 0.39 h/w -- driftwood-log
        # territory. It is now short and thick, a broken stump end rather than
        # a plank, so the root plate stays the silhouette.
        log = [(-0.12, 0.08), (-0.10, 0.40), (0.20, 0.36), (0.23, 0.05)]
        parts.append(prism_mesh(f'{asset_id}_Log', log, -0.16, 0.12, bark, asset_id))
        parts.append(prism_mesh(
            f'{asset_id}_LogTop',
            [(-0.11, 0.37), (0.21, 0.33), (0.21, 0.42), (-0.11, 0.46)],
            -0.17, -0.11, moss, asset_id,
        ))
        parts.append(prism_mesh(
            f'{asset_id}_LogEnd',
            [(0.19, 0.06), (0.17, 0.35), (0.24, 0.33), (0.26, 0.05)],
            -0.14, -0.06, wood, asset_id,
        ))
        add(cube(f'{asset_id}_Fleck', (-0.19, -0.27, 0.56), (0.028, 0.016, 0.024), accent, asset_id, bevel=0.008))

    # --- A4 water dressing -------------------------------------------------
    # reed-cluster was the only water prop in the game. Everything here is
    # built so that something stands proud of the surface: a flat pad or stone
    # on its own is the driftwood-log silhouette and will not read.
    elif shape == 'lily-pads':
        # Fifth pass. prism_mesh shapes the x-z profile and extrudes along Y,
        # so it cannot make a ROUND horizontal disc -- the pads came out as
        # vertical plates seen edge-on, then as a solid rectangular block. A
        # flat cylinder is the right primitive: faceted at 14 sides (smooth
        # spheres and smooth discs both read badly here), thick enough to show
        # a rim, and lifted off the frame edge. Flower spikes give the group
        # the vertical anchor a floating pad cannot provide on its own.
        pad = material(f'{asset_id}_pad', palette['primary'], roughness=0.72)
        pad_lit = material(f'{asset_id}_pad_lit', tone(palette['primary'], 1.28), roughness=0.62)
        pad_dark = material(f'{asset_id}_pad_dark', tone(palette['primary'], 0.68), roughness=0.8)
        stem = material(f'{asset_id}_stem', tone(palette['primary'], 0.86), roughness=0.84)
        bloom = material(f'{asset_id}_bloom', tone(palette['secondary'], 1.35), roughness=0.6)
        pads = (
            (-0.30, -0.06, 0.22, 0.26, pad_dark),
            (-0.02, 0.10, 0.26, 0.30, pad),
            (0.28, -0.02, 0.20, 0.22, pad_lit),
            (0.08, -0.24, 0.17, 0.18, pad_dark),
        )
        for index, (x, y, radius, z, mat) in enumerate(pads):
            add(cylinder(f'{asset_id}_Pad_{index}', (x, y, z), radius, 0.055, mat, asset_id, vertices=14))
            # Notch: the wedge cut every lily pad has, read as a darker chord.
            add(cube(f'{asset_id}_Notch_{index}', (x + radius * 0.52, y, z + 0.030), (radius * 0.40, radius * 0.16, 0.020), pad_dark, asset_id, bevel=0.008))
        for index, (x, y, height) in enumerate(((-0.16, -0.10, 0.92), (0.06, 0.06, 1.14), (0.26, -0.06, 0.80))):
            add(cylinder(f'{asset_id}_Stem_{index}', (x, y, height / 2 + 0.20), 0.016, height, stem, asset_id, vertices=6))
            add(cone(f'{asset_id}_Bloom_{index}', (x, y, height + 0.26), 0.055, 0.20, bloom, asset_id))
        add(cube(f'{asset_id}_Glint', (-0.36, -0.30, 0.24), (0.032, 0.022, 0.014), accent, asset_id, bevel=0.006))
    elif shape == 'water-grass':
        # Tall emergent blades in standing water, taller and looser than
        # reed-cluster so the two do not read as the same prop.
        blade = material(f'{asset_id}_blade', palette['primary'], roughness=0.86)
        blade_lit = material(f'{asset_id}_blade_lit', tone(palette['primary'], 1.32), roughness=0.74)
        blade_dark = material(f'{asset_id}_blade_dark', tone(palette['primary'], 0.66), roughness=0.9)
        silt = material(f'{asset_id}_silt', tone(palette['secondary'], 0.78), roughness=0.98)
        parts.append(prism_mesh(
            f'{asset_id}_Silt',
            [(-0.17, 0.0), (-0.11, 0.05), (0.05, 0.045), (0.15, 0.05), (0.18, 0.0)],
            -0.13, 0.11, silt, asset_id,
        ))
        blades = (
            (-0.13, 0.72, 0.055, -0.05, blade_dark),
            (-0.05, 1.02, 0.048, 0.04, blade),
            (0.02, 0.88, 0.044, -0.09, blade_lit),
            (0.09, 1.12, 0.050, 0.02, blade),
            (0.15, 0.80, 0.042, -0.03, blade_dark),
            (-0.09, 0.94, 0.040, 0.10, blade_lit),
        )
        for index, (x, height, width, depth, mat) in enumerate(blades):
            tip = x + (0.07 if index % 2 == 0 else -0.07)
            profile = [
                (x - width * 0.5, 0.03), (tip - width * 0.16, height),
                (tip, height + 0.05), (tip + width * 0.14, height * 0.96), (x + width * 0.5, 0.03),
            ]
            parts.append(prism_mesh(f'{asset_id}_Blade_{index}', profile, depth - 0.016, depth + 0.016, mat, asset_id))
        add(cube(f'{asset_id}_Glint', (0.19, -0.14, 0.03), (0.030, 0.018, 0.012), accent, asset_id, bevel=0.006))
    elif shape == 'submerged-log':
        # A waterlogged trunk lying half under, with one broken limb standing
        # up out of the water. driftwood-log failed as a pure horizontal, so
        # the limb is not decoration here -- it is the reason this reads.
        bark = material(f'{asset_id}_bark', tone(palette['secondary'], 0.74), roughness=0.95)
        wet = material(f'{asset_id}_wet', tone(palette['secondary'], 0.5), roughness=0.42)
        algae = material(f'{asset_id}_algae', palette['primary'], roughness=0.9)
        parts.append(prism_mesh(
            f'{asset_id}_Limb',
            [(-0.05, 0.28), (-0.08, 0.62), (-0.01, 0.84), (0.05, 0.80), (0.05, 0.50), (0.07, 0.26)],
            -0.06, 0.02, bark, asset_id,
        ))
        parts.append(prism_mesh(
            f'{asset_id}_LimbStub',
            [(0.02, 0.44), (0.16, 0.56), (0.19, 0.49), (0.04, 0.36)],
            -0.06, 0.01, bark, asset_id,
        ))
        parts.append(prism_mesh(
            f'{asset_id}_Trunk',
            [(-0.40, 0.06), (-0.37, 0.40), (0.29, 0.35), (0.33, 0.04)],
            -0.13, 0.11, bark, asset_id,
        ))
        parts.append(prism_mesh(
            f'{asset_id}_Waterline',
            [(-0.41, 0.06), (0.34, 0.03), (0.34, 0.16), (-0.41, 0.20)],
            -0.16, -0.12, wet, asset_id,
        ))
        parts.append(prism_mesh(
            f'{asset_id}_Algae',
            [(-0.33, 0.34), (-0.05, 0.38), (0.21, 0.32), (0.19, 0.42), (-0.31, 0.43)],
            -0.15, -0.10, algae, asset_id,
        ))
        add(cube(f'{asset_id}_Glint', (0.20, -0.18, 0.10), (0.030, 0.018, 0.012), accent, asset_id, bevel=0.006))
    elif shape == 'stepping-stones':
        # A crossing line of stones. Each one is a raised block with a visible
        # side face, not a flat disc -- the side faces are what carry it.
        stone = material(f'{asset_id}_stone', palette['primary'], roughness=0.9)
        stone_lit = material(f'{asset_id}_stone_lit', tone(palette['primary'], 1.30), roughness=0.8)
        stone_dark = material(f'{asset_id}_stone_dark', tone(palette['primary'], 0.60), roughness=0.94)
        wet = material(f'{asset_id}_wet', tone(palette['secondary'], 0.62), roughness=0.4)
        # Second pass: laid out in a row this measured 0.37 h/w -- flatter
        # than driftwood-log. The stones now recede UP the frame, which is
        # what a crossing line actually looks like from this camera, and the
        # silhouette gains height instead of width.
        stones = (
            (-0.10, 0.0, 0.125, 0.34, -0.14, stone_dark),
            (0.02, 0.26, 0.115, 0.32, -0.02, stone),
            (-0.04, 0.52, 0.100, 0.28, 0.10, stone_lit),
            (0.06, 0.76, 0.085, 0.24, 0.20, stone_dark),
        )
        for index, (x, z, r, height, depth, mat) in enumerate(stones):
            block = [
                (x - r, z), (x - r * 0.86, z + height * 0.78), (x - r * 0.3, z + height),
                (x + r * 0.42, z + height * 0.94), (x + r, z + height * 0.6), (x + r * 0.9, z),
            ]
            parts.append(prism_mesh(f'{asset_id}_Stone_{index}', block, depth - r * 0.7, depth + r * 0.7, mat, asset_id))
            parts.append(prism_mesh(
                f'{asset_id}_Wet_{index}',
                [(x - r * 0.9, z), (x + r * 0.85, z), (x + r * 0.85, z + height * 0.18), (x - r * 0.9, z + height * 0.18)],
                depth - r * 0.74, depth - r * 0.7, wet, asset_id,
            ))
        add(cube(f'{asset_id}_Glint', (-0.18, -0.20, 0.14), (0.030, 0.018, 0.014), accent, asset_id, bevel=0.006))
    elif shape == 'dock-post':
        # A mooring post with a cross-brace and a rope collar. The tallest
        # thing in this wave and the one that gives the bank a built edge.
        timber = material(f'{asset_id}_timber', tone(palette['secondary'], 0.86), roughness=0.94)
        timber_lit = material(f'{asset_id}_timber_lit', tone(palette['secondary'], 1.22), roughness=0.86)
        wet = material(f'{asset_id}_wet', tone(palette['secondary'], 0.52), roughness=0.4)
        rope = material(f'{asset_id}_rope', tone(palette['primary'], 1.2), roughness=0.92)
        parts.append(prism_mesh(
            f'{asset_id}_Post',
            [(-0.075, 0.0), (-0.065, 0.62), (-0.052, 1.04), (0.048, 1.06), (0.062, 0.60), (0.072, 0.0)],
            -0.075, 0.075, timber, asset_id,
        ))
        parts.append(prism_mesh(
            f'{asset_id}_PostLit',
            [(-0.026, 0.04), (-0.020, 1.02), (0.020, 1.03), (0.026, 0.04)],
            -0.10, -0.075, timber_lit, asset_id,
        ))
        parts.append(prism_mesh(
            f'{asset_id}_Cap',
            [(-0.088, 1.02), (-0.070, 1.12), (0.062, 1.13), (0.082, 1.01)],
            -0.09, 0.09, timber_lit, asset_id,
        ))
        parts.append(prism_mesh(
            f'{asset_id}_Brace',
            [(-0.24, 0.34), (-0.22, 0.42), (0.20, 0.56), (0.22, 0.48)],
            -0.05, 0.03, timber, asset_id,
        ))
        for index, z in enumerate((0.72, 0.79)):
            parts.append(prism_mesh(
                f'{asset_id}_Rope_{index}',
                [(-0.085, z), (0.082, z), (0.082, z + 0.042), (-0.085, z + 0.042)],
                -0.11, -0.085, rope, asset_id,
            ))
        parts.append(prism_mesh(
            f'{asset_id}_Waterline',
            [(-0.10, 0.06), (0.095, 0.06), (0.095, 0.15), (-0.10, 0.15)],
            -0.115, -0.10, wet, asset_id,
        ))
        add(cube(f'{asset_id}_Glint', (0.14, -0.13, 0.10), (0.028, 0.018, 0.012), accent, asset_id, bevel=0.006))
    elif shape == 'wetland-hummock':
        # A raised tussock of marsh grass on a peat mound: the bank filler
        # between reed-cluster and open water.
        peat = material(f'{asset_id}_peat', tone(palette['secondary'], 0.66), roughness=0.98)
        peat_lit = material(f'{asset_id}_peat_lit', tone(palette['secondary'], 0.95), roughness=0.95)
        tuft = material(f'{asset_id}_tuft', palette['primary'], roughness=0.88)
        tuft_lit = material(f'{asset_id}_tuft_lit', tone(palette['primary'], 1.30), roughness=0.78)
        # Second pass: the peat mound carried the mass (centroid 0.709, a
        # flat-decal reading). Mound flattened, tufts roughly doubled.
        mound = [(-0.23, 0.0), (-0.19, 0.14), (-0.07, 0.23), (0.07, 0.24), (0.19, 0.15), (0.24, 0.0)]
        parts.append(prism_mesh(f'{asset_id}_Mound', mound, -0.18, 0.14, peat, asset_id))
        parts.append(prism_mesh(
            f'{asset_id}_MoundFace',
            [(-0.13, 0.02), (-0.10, 0.13), (0.05, 0.15), (0.13, 0.09), (0.11, 0.02)],
            -0.23, -0.18, peat_lit, asset_id,
        ))
        # Third pass: vertical spears made this a second water-grass. The
        # tufts now splay outward from the crown and the peat mound stays
        # visible beneath them, so the silhouette is a tussock rather than a
        # stand of blades.
        tufts = (
            (-0.13, 0.52, 0.048, -0.06, -0.13, tuft),
            (-0.05, 0.66, 0.052, 0.04, -0.05, tuft_lit),
            (0.04, 0.60, 0.046, -0.02, 0.06, tuft),
            (0.12, 0.46, 0.040, 0.08, 0.15, tuft_lit),
            (0.00, 0.72, 0.044, 0.12, 0.01, tuft),
        )
        for index, (x, height, width, depth, splay, mat) in enumerate(tufts):
            profile = [
                (x - width, 0.12), (splay - width * 0.5, height * 0.72), (splay - width * 0.2, height),
                (splay + width * 0.25, height * 0.94), (splay + width * 0.6, height * 0.66), (x + width, 0.12),
            ]
            parts.append(prism_mesh(f'{asset_id}_Tuft_{index}', profile, depth - 0.030, depth + 0.030, mat, asset_id))
        add(cube(f'{asset_id}_Glint', (0.17, -0.22, 0.04), (0.028, 0.018, 0.012), accent, asset_id, bevel=0.006))

    # --- A7 camp and enemy-hangout kit ------------------------------------
    # Enemies spawned on open grass, so an encounter read as figures appearing
    # on a lawn. This kit gives a spawn region somewhere to come FROM. Purely
    # projection-only dressing: no collision, no spawn or AI change.
    elif shape == 'campfire-ring':
        # Third pass. The render frame clips content below roughly z=0.15, so
        # the first build lost its stone ring, ash bed and logs entirely while
        # the flame survived; scaling the whole asset up in z made them visible
        # but turned a campfire into an obelisk. Everything is now composed to
        # START at 0.16 and stay in proportion within the band.
        stone = material(f'{asset_id}_stone', tone(palette['secondary'], 0.9), roughness=0.94)
        stone_lit = material(f'{asset_id}_stone_lit', tone(palette['secondary'], 1.25), roughness=0.86)
        log = material(f'{asset_id}_log', tone(palette['primary'], 0.66), roughness=0.95)
        char = material(f'{asset_id}_char', '#241d1a', roughness=0.98)
        flame = material(f'{asset_id}_flame', palette['accent'], roughness=0.4, emission=1.15)
        flame_core = material(f'{asset_id}_flame_core', tone(palette['accent'], 1.4), roughness=0.35, emission=1.6)
        parts.append(prism_mesh(
            f'{asset_id}_KerbBack',
            [(-0.26, 0.20), (-0.20, 0.34), (-0.07, 0.37), (0.07, 0.35), (0.20, 0.37), (0.27, 0.21)],
            0.04, 0.20, stone, asset_id,
        ))
        parts.append(prism_mesh(
            f'{asset_id}_Ash',
            [(-0.24, 0.18), (0.24, 0.18), (0.19, 0.28), (-0.19, 0.28)],
            -0.14, 0.10, char, asset_id,
        ))
        for index, (x0, z0, x1, z1, depth) in enumerate((
            (-0.20, 0.24, 0.13, 0.42, -0.06),
            (0.19, 0.24, -0.09, 0.44, 0.04),
        )):
            parts.append(prism_mesh(
                f'{asset_id}_Log_{index}',
                [(x0, z0), (x1, z1), (x1 + 0.055, z1 - 0.055), (x0 + 0.055, z0 - 0.055)],
                depth - 0.05, depth + 0.05, log, asset_id,
            ))
        # Front kerb last so it reads in front of the ash and logs.
        parts.append(prism_mesh(
            f'{asset_id}_Kerb',
            [(-0.30, 0.16), (-0.26, 0.29), (-0.18, 0.31), (-0.13, 0.23), (-0.05, 0.30),
             (0.04, 0.32), (0.12, 0.29), (0.20, 0.32), (0.27, 0.28), (0.31, 0.16)],
            -0.22, -0.10, stone_lit, asset_id,
        ))
        parts.append(prism_mesh(
            f'{asset_id}_Flame',
            [(-0.13, 0.30), (-0.07, 0.50), (-0.09, 0.62), (0.0, 0.80), (0.08, 0.60), (0.05, 0.46), (0.13, 0.30)],
            -0.07, 0.07, flame, asset_id,
        ))
        parts.append(prism_mesh(
            f'{asset_id}_FlameCore',
            [(-0.055, 0.32), (-0.025, 0.50), (0.01, 0.66), (0.045, 0.48), (0.055, 0.32)],
            -0.10, -0.07, flame_core, asset_id,
        ))
    elif shape == 'bedroll-cluster':
        # Third pass, same clipping lesson as campfire-ring: bedrolls lie on
        # the ground, which is exactly where the frame cuts off. The rolls are
        # composed starting at z=0.16 and the standing pack carries the height.
        cloth = material(f'{asset_id}_cloth', palette['primary'], roughness=0.94)
        cloth_alt = material(f'{asset_id}_cloth_alt', tone(palette['primary'], 0.72), roughness=0.94)
        strap = material(f'{asset_id}_strap', tone(palette['secondary'], 0.7), roughness=0.9)
        pack = material(f'{asset_id}_pack', tone(palette['secondary'], 1.15), roughness=0.9)
        for index, (x, length, depth, mat) in enumerate((
            (-0.26, 0.26, -0.06, cloth),
            (0.04, 0.23, 0.06, cloth_alt),
        )):
            roll = [
                (x, 0.20), (x + 0.03, 0.34), (x + length * 0.5, 0.37),
                (x + length, 0.33), (x + length + 0.02, 0.19), (x + length * 0.5, 0.16),
            ]
            parts.append(prism_mesh(f'{asset_id}_Roll_{index}', roll, depth - 0.10, depth + 0.10, mat, asset_id))
            band = [(x + length * 0.36, 0.17), (x + length * 0.46, 0.17), (x + length * 0.46, 0.36), (x + length * 0.36, 0.36)]
            parts.append(prism_mesh(f'{asset_id}_Strap_{index}', band, depth - 0.115, depth - 0.100, strap, asset_id))
        parts.append(prism_mesh(
            f'{asset_id}_Pack',
            [(-0.13, 0.18), (-0.16, 0.52), (-0.06, 0.76), (0.08, 0.74), (0.16, 0.44), (0.12, 0.18)],
            -0.11, 0.09, pack, asset_id,
        ))
        parts.append(prism_mesh(
            f'{asset_id}_PackFlap',
            [(-0.13, 0.50), (-0.04, 0.73), (0.08, 0.70), (0.05, 0.46)],
            -0.16, -0.11, strap, asset_id,
        ))
        parts.append(prism_mesh(
            f'{asset_id}_Buckle',
            [(-0.035, 0.55), (0.035, 0.55), (0.035, 0.64), (-0.035, 0.64)],
            -0.185, -0.16, accent, asset_id,
        ))
    elif shape == 'sandbag-nest':
        # Second pass, authored cards. Fourteen small bevelled cubes produced
        # one visible sliver. The courses are now drawn as scalloped bands --
        # each bump is a bag -- stepping up to a firing lip, which reads as an
        # emplacement rather than a mound.
        bag = material(f'{asset_id}_bag', palette['primary'], roughness=0.96)
        bag_lit = material(f'{asset_id}_bag_lit', tone(palette['primary'], 1.24), roughness=0.9)
        bag_dark = material(f'{asset_id}_bag_dark', tone(palette['primary'], 0.68), roughness=0.97)

        def course(width, z, height, bumps):
            points = [(-width, z)]
            for index in range(bumps):
                left = -width + (2 * width) * index / bumps
                right = -width + (2 * width) * (index + 1) / bumps
                points.append((left, z + height * 0.72))
                points.append(((left + right) / 2, z + height))
                points.append((right, z + height * 0.72))
            points.append((width, z))
            return points

        parts.append(prism_mesh(f'{asset_id}_Course0', course(0.29, 0.14, 0.15, 4), -0.20, -0.06, bag_dark, asset_id))
        parts.append(prism_mesh(f'{asset_id}_Course1', course(0.26, 0.28, 0.14, 4), -0.06, 0.06, bag, asset_id))
        parts.append(prism_mesh(f'{asset_id}_Course2', course(0.22, 0.41, 0.13, 3), 0.06, 0.16, bag_lit, asset_id))
        parts.append(prism_mesh(f'{asset_id}_Course3', course(0.17, 0.53, 0.12, 2), 0.16, 0.24, bag, asset_id))
        parts.append(prism_mesh(
            f'{asset_id}_Lip',
            [(-0.19, 0.64), (0.19, 0.66), (0.19, 0.74), (-0.19, 0.72)],
            -0.10, 0.10, bag_lit, asset_id,
        ))
        parts.append(prism_mesh(
            f'{asset_id}_Tag',
            [(-0.06, 0.44), (0.02, 0.45), (0.02, 0.53), (-0.06, 0.52)],
            -0.24, -0.20, accent, asset_id,
        ))
    elif shape == 'scrap-barricade':
        # Second pass. The plate sprawled to 0.33 h/w -- flatter than
        # driftwood-log. Narrowed and stood up, with the props tucked behind
        # rather than splaying outward.
        plate = material(f'{asset_id}_plate', palette['primary'], roughness=0.82, metallic=0.3)
        plate_lit = material(f'{asset_id}_plate_lit', tone(palette['primary'], 1.26), roughness=0.72, metallic=0.35)
        rust = material(f'{asset_id}_rust', tone(palette['secondary'], 0.9), roughness=0.97)
        frame = material(f'{asset_id}_frame', tone(palette['secondary'], 0.6), roughness=0.9, metallic=0.4)
        parts.append(prism_mesh(
            f'{asset_id}_Plate',
            [(-0.19, 0.02), (-0.21, 0.70), (-0.09, 0.86), (0.03, 0.75), (0.13, 0.90), (0.20, 0.68), (0.17, 0.02)],
            -0.05, 0.07, plate, asset_id,
        ))
        parts.append(prism_mesh(
            f'{asset_id}_PlateLit',
            [(-0.15, 0.08), (-0.16, 0.66), (-0.04, 0.75), (-0.01, 0.10)],
            -0.10, -0.05, plate_lit, asset_id,
        ))
        parts.append(prism_mesh(
            f'{asset_id}_Rust',
            [(0.03, 0.12), (0.05, 0.64), (0.15, 0.71), (0.13, 0.10)],
            -0.09, -0.05, rust, asset_id,
        ))
        for index, (x, lean) in enumerate(((-0.17, -0.09), (0.16, 0.08))):
            parts.append(prism_mesh(
                f'{asset_id}_Prop_{index}',
                [(x, 0.0), (x + lean * 0.4, 0.38), (x + lean, 0.74), (x + lean + 0.045, 0.70), (x + 0.045, 0.0)],
                0.07, 0.13, frame, asset_id,
            ))
        parts.append(prism_mesh(
            f'{asset_id}_Mark',
            [(-0.08, 0.38), (-0.01, 0.39), (-0.01, 0.47), (-0.08, 0.46)],
            -0.13, -0.10, accent, asset_id,
        ))
    elif shape == 'watch-platform':
        # Second pass. At 0.76 h/w the stand read as a table. The footprint is
        # narrower and the legs are much taller, so it reads as a lookout that
        # someone climbs.
        timber = material(f'{asset_id}_timber', tone(palette['secondary'], 0.9), roughness=0.94)
        timber_lit = material(f'{asset_id}_timber_lit', tone(palette['secondary'], 1.24), roughness=0.86)
        deck = material(f'{asset_id}_deck', palette['primary'], roughness=0.92)
        for index, (x, y, lean) in enumerate(((-0.13, -0.09, 0.030), (0.13, -0.09, -0.030), (-0.10, 0.11, 0.024), (0.10, 0.11, -0.024))):
            parts.append(prism_mesh(
                f'{asset_id}_Leg_{index}',
                [(x - 0.024, 0.0), (x + lean * 12 - 0.019, 1.16), (x + lean * 12 + 0.019, 1.16), (x + 0.024, 0.0)],
                y - 0.024, y + 0.024, timber if index % 2 else timber_lit, asset_id,
            ))
        parts.append(prism_mesh(
            f'{asset_id}_Deck',
            [(-0.22, 1.14), (0.22, 1.14), (0.22, 1.21), (-0.22, 1.21)],
            -0.16, 0.18, deck, asset_id,
        ))
        parts.append(prism_mesh(
            f'{asset_id}_Rail',
            [(-0.21, 1.42), (0.21, 1.42), (0.21, 1.48), (-0.21, 1.48)],
            -0.15, -0.11, timber_lit, asset_id,
        ))
        for index, x in enumerate((-0.19, -0.01, 0.19)):
            parts.append(prism_mesh(
                f'{asset_id}_Post_{index}',
                [(x - 0.020, 1.19), (x - 0.016, 1.48), (x + 0.016, 1.48), (x + 0.020, 1.19)],
                -0.15, -0.11, timber, asset_id,
            ))
        for index, z in enumerate((0.22, 0.50, 0.78)):
            parts.append(prism_mesh(
                f'{asset_id}_Rung_{index}',
                [(0.14, z), (0.26, z + 0.02), (0.26, z + 0.055), (0.14, z + 0.035)],
                0.13, 0.17, timber, asset_id,
            ))
        parts.append(prism_mesh(
            f'{asset_id}_Lamp',
            [(-0.04, 1.50), (0.04, 1.50), (0.03, 1.60), (-0.03, 1.60)],
            -0.17, -0.13, accent, asset_id,
        ))
    elif shape == 'faction-banner':
        # A hung banner on a pole. Per-enemy-role colour lives in the palette
        # accent, so one shape carries every faction's identity.
        pole = material(f'{asset_id}_pole', tone(palette['secondary'], 0.72), roughness=0.92)
        cloth = material(f'{asset_id}_cloth', palette['primary'], roughness=0.94)
        cloth_shade = material(f'{asset_id}_cloth_shade', tone(palette['primary'], 0.7), roughness=0.95)
        base = material(f'{asset_id}_base', tone(palette['secondary'], 0.56), roughness=0.96)
        parts.append(prism_mesh(
            f'{asset_id}_Base',
            [(-0.16, 0.0), (-0.11, 0.10), (0.10, 0.11), (0.15, 0.0)],
            -0.14, 0.12, base, asset_id,
        ))
        parts.append(prism_mesh(
            f'{asset_id}_Pole',
            [(-0.026, 0.06), (-0.020, 1.34), (0.020, 1.34), (0.026, 0.06)],
            -0.026, 0.026, pole, asset_id,
        ))
        parts.append(prism_mesh(
            f'{asset_id}_Crossbar',
            [(-0.20, 1.22), (0.20, 1.22), (0.20, 1.27), (-0.20, 1.27)],
            -0.022, 0.022, pole, asset_id,
        ))
        # Banner cloth with a ragged lower edge.
        parts.append(prism_mesh(
            f'{asset_id}_Cloth',
            [(-0.18, 1.22), (0.18, 1.22), (0.17, 0.72), (0.10, 0.62), (0.02, 0.74), (-0.07, 0.60), (-0.16, 0.70)],
            -0.048, -0.022, cloth, asset_id,
        ))
        parts.append(prism_mesh(
            f'{asset_id}_ClothShade',
            [(0.02, 1.20), (0.17, 1.20), (0.16, 0.74), (0.03, 0.70)],
            -0.062, -0.048, cloth_shade, asset_id,
        ))
        parts.append(prism_mesh(
            f'{asset_id}_Sigil',
            [(-0.08, 0.94), (0.0, 1.08), (0.08, 0.94), (0.0, 0.82)],
            -0.075, -0.062, accent, asset_id,
        ))

    # --- A5 bridge kit -----------------------------------------------------
    # The proof-of-work bridge was a walkable surface plus two rail blockers
    # and one bollard, so the map's signature crossing had almost no authored
    # structure on it. These are the parts that make it read as built.
    elif shape == 'bridge-pier':
        # A stone footing rising out of the water: battered sides, a capping
        # course, and a waterline stain so it reads as standing IN something.
        stone = material(f'{asset_id}_stone', palette['primary'], roughness=0.93)
        stone_lit = material(f'{asset_id}_stone_lit', tone(palette['primary'], 1.26), roughness=0.84)
        stone_dark = material(f'{asset_id}_stone_dark', tone(palette['primary'], 0.58), roughness=0.95)
        wet = material(f'{asset_id}_wet', tone(palette['secondary'], 0.6), roughness=0.42)
        # Battered: wider at the base than the top, which is what makes masonry
        # look load-bearing rather than like a box.
        parts.append(prism_mesh(
            f'{asset_id}_Shaft',
            [(-0.26, 0.16), (-0.19, 0.86), (0.18, 0.88), (0.25, 0.16)],
            -0.20, 0.18, stone, asset_id,
        ))
        parts.append(prism_mesh(
            f'{asset_id}_ShaftLit',
            [(-0.15, 0.20), (-0.11, 0.84), (0.03, 0.85), (0.05, 0.20)],
            -0.25, -0.20, stone_lit, asset_id,
        ))
        # Capping course, proud of the shaft on both sides.
        parts.append(prism_mesh(
            f'{asset_id}_Cap',
            [(-0.28, 0.86), (0.27, 0.88), (0.27, 1.00), (-0.28, 0.98)],
            -0.24, 0.22, stone_lit, asset_id,
        ))
        for index, z in enumerate((0.34, 0.52, 0.70)):
            parts.append(prism_mesh(
                f'{asset_id}_Course_{index}',
                [(-0.23, z), (0.22, z + 0.01), (0.22, z + 0.030), (-0.23, z + 0.020)],
                -0.26, -0.24, stone_dark, asset_id,
            ))
        parts.append(prism_mesh(
            f'{asset_id}_Waterline',
            [(-0.27, 0.17), (0.26, 0.17), (0.26, 0.27), (-0.27, 0.27)],
            -0.27, -0.25, wet, asset_id,
        ))
        add(cube(f'{asset_id}_Fleck', (0.10, -0.28, 0.60), (0.030, 0.018, 0.026), accent, asset_id, bevel=0.008))
    elif shape == 'bridge-truss':
        # A steel support frame: top and bottom chords with a zig-zag web
        # between them. The web is the whole read, so it is drawn as one
        # polygon rather than assembled from struts that could drift apart.
        steel = material(f'{asset_id}_steel', palette['primary'], roughness=0.7, metallic=0.4)
        steel_lit = material(f'{asset_id}_steel_lit', tone(palette['primary'], 1.24), roughness=0.6, metallic=0.45)
        rust = material(f'{asset_id}_rust', tone(palette['secondary'], 0.92), roughness=0.96)
        parts.append(prism_mesh(
            f'{asset_id}_BottomChord',
            [(-0.36, 0.18), (0.36, 0.18), (0.36, 0.27), (-0.36, 0.27)],
            -0.07, 0.07, steel, asset_id,
        ))
        parts.append(prism_mesh(
            f'{asset_id}_TopChord',
            [(-0.32, 0.78), (0.32, 0.78), (0.32, 0.87), (-0.32, 0.87)],
            -0.07, 0.07, steel_lit, asset_id,
        ))
        # Zig-zag web, one continuous outline: down-up-down across the span.
        web = [
            (-0.33, 0.26), (-0.20, 0.79), (-0.14, 0.79), (-0.03, 0.30), (0.03, 0.30),
            (0.14, 0.79), (0.20, 0.79), (0.33, 0.26), (0.27, 0.26), (0.17, 0.72),
            (0.06, 0.26), (-0.06, 0.26), (-0.17, 0.72), (-0.27, 0.26),
        ]
        parts.append(prism_mesh(f'{asset_id}_Web', web, -0.035, 0.035, steel, asset_id))
        for index, x in enumerate((-0.30, 0.30)):
            parts.append(prism_mesh(
                f'{asset_id}_EndPost_{index}',
                [(x - 0.035, 0.18), (x - 0.030, 0.86), (x + 0.030, 0.86), (x + 0.035, 0.18)],
                -0.075, 0.075, steel_lit, asset_id,
            ))
        parts.append(prism_mesh(
            f'{asset_id}_Rust',
            [(-0.10, 0.19), (0.08, 0.19), (0.07, 0.25), (-0.10, 0.25)],
            -0.09, -0.07, rust, asset_id,
        ))
        add(cube(f'{asset_id}_Bolt', (0.22, -0.10, 0.82), (0.028, 0.018, 0.024), accent, asset_id, bevel=0.008))
    elif shape == 'plank-deck-broken':
        # A deck section with boards missing. A plank surface IS flat, so this
        # one earns its read from the BROKEN EDGE rather than from height: the
        # gap and the splintered ends are the silhouette.
        plank = material(f'{asset_id}_plank', palette['primary'], roughness=0.95)
        plank_lit = material(f'{asset_id}_plank_lit', tone(palette['primary'], 1.26), roughness=0.88)
        plank_dark = material(f'{asset_id}_plank_dark', tone(palette['primary'], 0.66), roughness=0.96)
        beam = material(f'{asset_id}_beam', tone(palette['secondary'], 0.72), roughness=0.94)
        # Cross beam under the deck, visible through the gap.
        parts.append(prism_mesh(
            f'{asset_id}_Beam',
            [(-0.23, 0.18), (0.23, 0.18), (0.23, 0.30), (-0.23, 0.30)],
            -0.10, 0.10, beam, asset_id,
        ))
        # Boards, with two missing in the middle and one snapped short.
        # Second pass: at 0.64 wide against a 0.28 deck this measured 0.36 h/w,
        # under the 0.62 that granite-boulder ships at and near driftwood-log's
        # 0.30 failure. Narrower, with longer boards and a taller broken edge.
        boards = (
            (-0.21, 0.34, plank_dark), (-0.145, 0.42, plank), (-0.08, 0.30, plank_lit),
            (0.055, 0.38, plank), (0.12, 0.46, plank_lit), (0.185, 0.32, plank_dark),
        )
        for index, (x, length, mat) in enumerate(boards):
            parts.append(prism_mesh(
                f'{asset_id}_Board_{index}',
                [(x, 0.30), (x + 0.055, 0.30), (x + 0.055, 0.30 + length), (x, 0.30 + length)],
                -0.12, 0.12, mat, asset_id,
            ))
        # Splintered ends framing the gap.
        # The broken edge is the read, so it reaches well above the deck.
        for index, (x, direction) in enumerate(((-0.045, 1), (0.045, -1))):
            parts.append(prism_mesh(
                f'{asset_id}_Splinter_{index}',
                [(x, 0.30), (x + direction * 0.050, 0.46), (x + direction * 0.018, 0.60), (x + direction * 0.044, 0.76), (x, 0.66)],
                -0.10, 0.10, plank_dark, asset_id,
            ))
        add(cube(f'{asset_id}_Nail', (-0.15, -0.14, 0.60), (0.026, 0.016, 0.022), accent, asset_id, bevel=0.007))
    elif shape == 'handrail-post':
        # A post with two rails running off it. Tall and thin: the vertical
        # rhythm along a bridge edge.
        timber = material(f'{asset_id}_timber', palette['primary'], roughness=0.93)
        timber_lit = material(f'{asset_id}_timber_lit', tone(palette['primary'], 1.25), roughness=0.86)
        iron = material(f'{asset_id}_iron', tone(palette['secondary'], 0.7), roughness=0.72, metallic=0.4)
        parts.append(prism_mesh(
            f'{asset_id}_Post',
            [(-0.055, 0.16), (-0.048, 1.02), (0.048, 1.02), (0.055, 0.16)],
            -0.055, 0.055, timber, asset_id,
        ))
        parts.append(prism_mesh(
            f'{asset_id}_PostLit',
            [(-0.020, 0.18), (-0.016, 1.00), (0.016, 1.00), (0.020, 0.18)],
            -0.075, -0.055, timber_lit, asset_id,
        ))
        parts.append(prism_mesh(
            f'{asset_id}_Cap',
            [(-0.072, 1.00), (-0.055, 1.09), (0.052, 1.09), (0.070, 0.99)],
            -0.065, 0.065, timber_lit, asset_id,
        ))
        for index, z in enumerate((0.58, 0.84)):
            parts.append(prism_mesh(
                f'{asset_id}_Rail_{index}',
                [(-0.30, z), (0.30, z + 0.012), (0.30, z + 0.055), (-0.30, z + 0.043)],
                -0.030, 0.030, timber, asset_id,
            ))
        parts.append(prism_mesh(
            f'{asset_id}_Bracket',
            [(-0.040, 0.30), (0.040, 0.30), (0.040, 0.37), (-0.040, 0.37)],
            -0.080, -0.062, iron, asset_id,
        ))
        add(cube(f'{asset_id}_Bolt', (0.0, -0.085, 0.72), (0.026, 0.016, 0.022), accent, asset_id, bevel=0.007))
    elif shape == 'bridge-warning-sign':
        # A load-limit sign on a leaning post. The board is the read, so it is
        # frontmost and the post is set behind it.
        post = material(f'{asset_id}_post', tone(palette['secondary'], 0.72), roughness=0.9, metallic=0.3)
        board = material(f'{asset_id}_board', palette['primary'], roughness=0.82)
        board_edge = material(f'{asset_id}_board_edge', tone(palette['primary'], 0.62), roughness=0.9)
        parts.append(prism_mesh(
            f'{asset_id}_Post',
            [(-0.030, 0.16), (-0.012, 0.86), (0.030, 0.86), (0.012, 0.16)],
            -0.028, 0.028, post, asset_id,
        ))
        parts.append(prism_mesh(
            f'{asset_id}_Board',
            [(-0.21, 0.72), (0.20, 0.76), (0.20, 1.10), (-0.21, 1.06)],
            -0.055, -0.030, board, asset_id,
        ))
        parts.append(prism_mesh(
            f'{asset_id}_BoardEdge',
            [(-0.21, 0.72), (0.20, 0.76), (0.20, 0.80), (-0.21, 0.76)],
            -0.060, -0.055, board_edge, asset_id,
        ))
        # Two stripes: enough to read as a marking, not enough to be text.
        for index, z in enumerate((0.84, 0.95)):
            parts.append(prism_mesh(
                f'{asset_id}_Stripe_{index}',
                [(-0.15, z), (0.14, z + 0.03), (0.14, z + 0.062), (-0.15, z + 0.032)],
                -0.066, -0.060, accent, asset_id,
            ))
        parts.append(prism_mesh(
            f'{asset_id}_Base',
            [(-0.10, 0.16), (0.10, 0.16), (0.08, 0.24), (-0.08, 0.24)],
            -0.06, 0.06, post, asset_id,
        ))
    elif shape == 'rope-bridge-anchor':
        # The ravine end of a rope span: a lashed timber A-frame with the ropes
        # running off it. The ropes leave frame, which is what tells you the
        # span continues past the prop.
        timber = material(f'{asset_id}_timber', palette['primary'], roughness=0.94)
        timber_lit = material(f'{asset_id}_timber_lit', tone(palette['primary'], 1.24), roughness=0.88)
        rope = material(f'{asset_id}_rope', tone(palette['secondary'], 1.18), roughness=0.96)
        stone = material(f'{asset_id}_stone', tone(palette['secondary'], 0.6), roughness=0.96)
        parts.append(prism_mesh(
            f'{asset_id}_Ballast',
            [(-0.30, 0.16), (-0.24, 0.34), (0.22, 0.35), (0.29, 0.16)],
            -0.18, 0.16, stone, asset_id,
        ))
        for index, lean in enumerate((-0.16, 0.16)):
            parts.append(prism_mesh(
                f'{asset_id}_Leg_{index}',
                [(lean * 1.4 - 0.045, 0.30), (lean * 0.2 - 0.038, 0.94), (lean * 0.2 + 0.038, 0.94), (lean * 1.4 + 0.045, 0.30)],
                -0.06 + index * 0.10, 0.02 + index * 0.10, timber if index else timber_lit, asset_id,
            ))
        parts.append(prism_mesh(
            f'{asset_id}_Lashing',
            [(-0.075, 0.86), (0.075, 0.86), (0.075, 0.94), (-0.075, 0.94)],
            -0.10, 0.12, rope, asset_id,
        ))
        # Ropes running out of frame toward the far side.
        for index, (z0, z1) in enumerate(((0.90, 0.74), (0.66, 0.56))):
            parts.append(prism_mesh(
                f'{asset_id}_Rope_{index}',
                [(0.02, z0), (0.46, z1), (0.46, z1 - 0.032), (0.02, z0 - 0.032)],
                -0.04 + index * 0.05, -0.01 + index * 0.05, rope, asset_id,
            ))
        add(cube(f'{asset_id}_Knot', (0.0, -0.12, 0.90), (0.030, 0.020, 0.026), accent, asset_id, bevel=0.008))

    elif shape in {
        'relay-tower-setpiece', 'forked-spire-setpiece', 'proof-bridge-setpiece',
        'hashwood-beacon-setpiece', 'mining-headframe-setpiece', 'liquidation-tower-setpiece',
    }:
        # A9 district landmarks: large, joined silhouettes with one dominant
        # vertical read and district-specific secondary masses. Gameplay and
        # collision stay with the canonical world landmark; these are art.
        lit = material(f'{asset_id}_lit', tone(palette['primary'], 1.32), roughness=.72)
        dark = material(f'{asset_id}_dark', tone(palette['secondary'], .68), roughness=.92)
        metal = material(f'{asset_id}_metal', tone(palette['secondary'], 1.42), metallic=.44, roughness=.62)
        if shape == 'relay-tower-setpiece':
            add(cube(f'{asset_id}_Foundation', (0,0,.10), (.76,.58,.10), primary, asset_id, bevel=.05))
            add(cube(f'{asset_id}_PlinthCap', (0,-.04,.22), (.68,.48,.045), lit, asset_id, bevel=.018))
            for x in (-.46,0,.46):
                add(cylinder(f'{asset_id}_Mast_{x}', (x,0,1.16+abs(x)*.26), .045, 2.12-abs(x)*.34, metal, asset_id, vertices=10, rotation=(0,math.radians(-6*x),0)))
                add(cube(f'{asset_id}_Lamp_{x}', (x,-.055,2.18-abs(x)*.08), (.07,.05,.08), accent, asset_id, bevel=.016))
            for z,w in ((.52,.62),(1.08,.52),(1.62,.42)): add(cube(f'{asset_id}_Cross_{z}', (0,0,z), (w,.035,.035), lit, asset_id, bevel=.008))
            add(torus(f'{asset_id}_DishRim', (0,-.08,1.60), .32,.035,lit,asset_id,rotation=(math.radians(78),0,0)))
            add(cube(f'{asset_id}_DishBar', (0,-.10,1.60), (.30,.025,.035), accent, asset_id, rotation=(0,0,.22), bevel=.006))
            add(cube(f'{asset_id}_Console', (0,-.48,.42), (.32,.20,.30), primary, asset_id, bevel=.035))
        elif shape == 'forked-spire-setpiece':
            left=[(-.72,0),(-.18,0),(-.10,1.04),(-.26,1.72),(-.42,2.38),(-.62,1.42)]
            right=[(.10,0),(.74,0),(.58,.88),(.64,1.76),(.42,2.18),(.24,1.20)]
            add(prism_mesh(f'{asset_id}_Left',left,-.30,.30,primary,asset_id))
            add(prism_mesh(f'{asset_id}_Right',right,-.34,.34,dark,asset_id))
            add(cube(f'{asset_id}_Span', (0,-.02,1.04), (.50,.18,.09), metal, asset_id, rotation=(0,0,-.08), bevel=.025))
            for i,z in enumerate((.46,.78,1.34)): add(cube(f'{asset_id}_Strata_{i}', (-.30 if i%2==0 else .34,-.32,z), (.24,.025,.035), lit, asset_id, rotation=(0,0,.12-i*.11), bevel=.008))
            add(cube(f'{asset_id}_Warning', (0,-.24,1.20), (.17,.025,.11), accent, asset_id, rotation=(0,0,-.08), bevel=.012))
            for i,x in enumerate((-.54,.54)): add(cube(f'{asset_id}_Rubble_{i}', (x,-.38,.10), (.18,.14,.10), lit if i else primary, asset_id, rotation=(.2,0,i*.7), bevel=.035))
        elif shape == 'proof-bridge-setpiece':
            add(cube(f'{asset_id}_Deck', (0,0,.46), (.88,.34,.10), primary, asset_id, bevel=.025))
            for x in (-.68,.68):
                add(cube(f'{asset_id}_Pier_{x}', (x,.04,.86), (.24,.36,1.68), dark, asset_id, bevel=.025))
                add(cube(f'{asset_id}_Cap_{x}', (x,.04,1.72), (.30,.42,.12), lit, asset_id, bevel=.018))
                add(cylinder(f'{asset_id}_Beacon_{x}', (x,.04,1.91), .06,.30,accent,asset_id,vertices=10))
            add(cube(f'{asset_id}_TopSpan', (0,.04,1.72), (1.18,.32,.10), lit, asset_id, bevel=.012))
            for side in (-1,1):
                add(cube(f'{asset_id}_FacePost_{side}', (side*.68,-.30,1.10), (.12,.05,1.25), lit, asset_id, bevel=.01))
                add(cube(f'{asset_id}_Truss_{side}', (side*.30,-.31,1.16), (.70,.045,.045), metal, asset_id, rotation=(0,math.radians(38*side),0), bevel=.007))
            add(cube(f'{asset_id}_FaceTop', (0,-.30,1.72), (1.20,.05,.10), lit, asset_id, bevel=.012))
            add(cube(f'{asset_id}_Ledger', (0,-.37,.92), (.38,.03,.13), accent, asset_id, bevel=.012))
            for x in (-.36,0,.36): add(cube(f'{asset_id}_Rail_{x}', (x,-.32,.68), (.025,.025,.24), lit, asset_id, bevel=.006))
        elif shape == 'hashwood-beacon-setpiece':
            add(cylinder(f'{asset_id}_Trunk', (0,.02,.90), .30,1.72,dark,asset_id,vertices=11,rotation=(0,math.radians(-7),0)))
            for i,(x,y,z,s) in enumerate(((-.40,.02,.92,.54),(.36,.05,1.14,.60),(-.10,.08,1.60,.66))):
                add(cone(f'{asset_id}_Crown_{i}', (x,y,z), s,.78,primary if i!=1 else lit,asset_id))
            for i,(x,y,r) in enumerate(((-.48,-.08,.30),(.45,.10,.32),(0,-.35,.28))): add(cube(f'{asset_id}_Root_{i}', (x,y,.15), (r,.10,.08), dark, asset_id, rotation=(0,0,(i-1)*.55), bevel=.035))
            add(cone(f'{asset_id}_Crystal', (0,-.20,2.12), .18,.62,accent,asset_id))
            add(torus(f'{asset_id}_Halo', (0,-.20,2.18), .30,.028,accent,asset_id,rotation=(math.radians(90),0,0)))
            add(cube(f'{asset_id}_Shrine', (0,-.32,.50), (.30,.20,.12), metal, asset_id, bevel=.025))
        elif shape == 'mining-headframe-setpiece':
            add(cube(f'{asset_id}_Pad', (0,0,.08), (.82,.52,.08), dark, asset_id, bevel=.04))
            for x in (-.48,.48):
                add(cylinder(f'{asset_id}_Leg_{x}', (x,0,1.02), .055,2.04,metal,asset_id,vertices=8,rotation=(0,math.radians(-12*x),0)))
            add(cube(f'{asset_id}_Crown', (0,0,1.94), (.58,.26,.09), lit, asset_id, bevel=.018))
            for z,angle in ((.55,34),(1.02,-34),(1.48,34)): add(cube(f'{asset_id}_Brace_{z}', (0,-.05,z), (.62,.035,.035), primary, asset_id, rotation=(0,math.radians(angle),0), bevel=.006))
            add(cube(f'{asset_id}_MidSpan', (0,-.04,1.18), (.48,.035,.045), lit, asset_id, bevel=.008))
            add(cube(f'{asset_id}_BaseSpan', (0,-.04,.20), (.70,.05,.055), lit, asset_id, bevel=.012))
            add(torus(f'{asset_id}_Wheel', (0,-.10,1.76), .28,.045,accent,asset_id,rotation=(math.radians(90),0,0)))
            add(cylinder(f'{asset_id}_Axle', (0,-.10,1.76), .055,.22,metal,asset_id,vertices=10,rotation=(math.radians(90),0,0)))
            add(cube(f'{asset_id}_Hoist', (0,-.18,.38), (.34,.22,.28), primary, asset_id, bevel=.04))
        elif shape == 'liquidation-tower-setpiece':
            add(cube(f'{asset_id}_Base', (0,0,.12), (.70,.52,.12), dark, asset_id, bevel=.045))
            for x in (-.38,.38): add(cylinder(f'{asset_id}_Leg_{x}', (x,0,.88), .05,1.62,metal,asset_id,vertices=8,rotation=(0,math.radians(-8*x),0)))
            add(cube(f'{asset_id}_Platform', (0,0,1.56), (.54,.40,.10), primary, asset_id, bevel=.025))
            for x in (-.48,.48): add(cylinder(f'{asset_id}_Rail_{x}', (x,0,1.82), .025,.46,lit,asset_id,vertices=8))
            add(cylinder(f'{asset_id}_Mast', (0,.02,2.02), .045,.92,metal,asset_id,vertices=10))
            add(cube(f'{asset_id}_Ticker', (0,-.34,1.84), (.46,.035,.15), accent, asset_id, bevel=.018))
            for i,w in enumerate((.34,.24,.40)): add(cube(f'{asset_id}_Line_{i}', (0,-.38,1.90-i*.09), (w,.012,.018), lit if i!=1 else secondary, asset_id, bevel=.004))
            add(torus(f'{asset_id}_Signal', (0,-.02,2.46), .18,.028,accent,asset_id))

    elif shape in {
        'awning-shopfront', 'ruined-tenement', 'corrugated-lean-to', 'market-stall',
        'water-tower', 'fuel-pump-island', 'town-billboard', 'porch-stoop',
        'chain-fence-gate', 'streetlamp', 'mailbox', 'stacked-crates',
    }:
        # A6 shares a weathered settlement material grammar while each module
        # keeps a distinct target-distance silhouette. These are source props;
        # collisionProxy metadata is consumed by W2, never by this art builder.
        lit = material(f'{asset_id}_lit', tone(palette['primary'], 1.18), roughness=.82)
        dark = material(f'{asset_id}_dark', tone(palette['secondary'], .72), roughness=.94)
        metal = material(f'{asset_id}_metal', tone(palette['secondary'], 1.3), metallic=.36, roughness=.68)
        if shape == 'awning-shopfront':
            add(cube(f'{asset_id}_Body', (0,0,.58), (.76,.42,.58), primary, asset_id, bevel=.025))
            add(cube(f'{asset_id}_Parapet', (0,0,1.20), (.81,.46,.08), dark, asset_id, bevel=.018))
            add(cube(f'{asset_id}_Window', (-.18,-.44,.58), (.34,.02,.33), accent, asset_id, bevel=.008))
            add(cube(f'{asset_id}_Door', (.48,-.44,.45), (.16,.02,.42), secondary, asset_id, bevel=.01))
            add(cube(f'{asset_id}_Awning', (-.12,-.59,.96), (.58,.25,.055), lit, asset_id, rotation=(math.radians(-10),0,0), bevel=.012))
            for i,x in enumerate((-.52,-.26,0,.26,.52)): add(cube(f'{asset_id}_Stripe_{i}', (x-.12,-.61,.98), (.05,.25,.014), accent if i%2 else dark, asset_id, rotation=(math.radians(-10),0,0), bevel=.004))
            add(cube(f'{asset_id}_Sign', (.12,-.46,1.14), (.42,.025,.10), accent, asset_id, bevel=.012))
        elif shape == 'ruined-tenement':
            add(cube(f'{asset_id}_Block', (0,0,.88), (.64,.45,.88), primary, asset_id, bevel=.018))
            add(cube(f'{asset_id}_Roof', (-.08,.02,1.80), (.60,.44,.06), secondary, asset_id, rotation=(0,0,-.07), bevel=.012))
            for floor,z in enumerate((.47,1.03,1.48)):
                add(cube(f'{asset_id}_Band_{floor}', (0,-.46,z-.27), (.62,.018,.035), dark, asset_id, bevel=.005))
                for col,x in enumerate((-.38,0,.38)):
                    if floor==2 and col==2: continue
                    add(cube(f'{asset_id}_Window_{floor}_{col}', (x,-.47,z), (.12,.018,.16), accent if (floor+col)%3==0 else dark, asset_id, bevel=.008))
            add(cube(f'{asset_id}_Breach', (.43,-.468,1.48), (.12,.018,.30), dark, asset_id, rotation=(0,0,.08), bevel=.008))
            for i,(x,y) in enumerate(((.48,-.28),(.30,-.40),(.12,-.46))): add(cube(f'{asset_id}_Rubble_{i}', (x,y,.07), (.10,.08,.07), lit, asset_id, rotation=(.2,0,i*.7), bevel=.025))
        elif shape == 'corrugated-lean-to':
            add(cube(f'{asset_id}_Rear', (0,.24,.48), (.62,.08,.48), dark, asset_id, bevel=.015))
            add(cube(f'{asset_id}_Side', (-.54,0,.40), (.08,.34,.40), metal, asset_id, bevel=.012))
            add(cube(f'{asset_id}_Roof', (0,-.02,.91), (.70,.46,.06), metal, asset_id, rotation=(math.radians(-8),0,0), bevel=.014))
            for i,x in enumerate((-.55,-.33,-.11,.11,.33,.55)): add(cube(f'{asset_id}_Rib_{i}', (x,-.02,.94), (.018,.46,.025), primary if i%2 else dark, asset_id, rotation=(math.radians(-8),0,0), bevel=.004))
            for x in (-.56,.56): add(cylinder(f'{asset_id}_Post_{x}', (x,-.30,.40), .035,.80,dark,asset_id,vertices=8))
            add(cube(f'{asset_id}_Bench', (.12,-.20,.27), (.38,.22,.08), lit, asset_id, bevel=.015))
        elif shape == 'market-stall':
            add(cube(f'{asset_id}_Counter', (0,-.08,.48), (.56,.28,.08), dark, asset_id, bevel=.012))
            add(cube(f'{asset_id}_Front', (0,.12,.27), (.56,.08,.27), primary, asset_id, bevel=.01))
            for x in (-.50,.50): add(cylinder(f'{asset_id}_Post_{x}', (x,.04,.82), .035,1.42,dark,asset_id,vertices=8))
            add(cube(f'{asset_id}_Canopy', (0,.02,1.38), (.66,.42,.055), lit, asset_id, rotation=(math.radians(-5),0,0), bevel=.015))
            for i,x in enumerate((-.48,-.24,0,.24,.48)): add(cube(f'{asset_id}_Stripe_{i}', (x,-.08,1.40), (.055,.42,.015), accent if i%2 else secondary, asset_id, rotation=(math.radians(-5),0,0), bevel=.004))
            for i,x in enumerate((-.30,0,.28)): add(cube(f'{asset_id}_Goods_{i}', (x,-.26,.58), (.09,.09,.08+i*.02), accent if i==1 else primary, asset_id, bevel=.025))
        elif shape == 'water-tower':
            for sx in (-1,1):
                for sy in (-1,1): add(cylinder(f'{asset_id}_Leg_{sx}_{sy}', (sx*.28,sy*.24,.67), .035,1.34,dark,asset_id,vertices=8,rotation=(math.radians(-4)*sy,math.radians(4)*sx,0)))
            add(cylinder(f'{asset_id}_Tank', (0,0,1.53), .43,.62,metal,asset_id,vertices=20))
            add(cone(f'{asset_id}_Roof', (0,0,1.89), .45,.20,dark,asset_id))
            add(torus(f'{asset_id}_Band', (0,0,1.53), .43,.028,accent,asset_id))
            for z in (.38,.78,1.08): add(cube(f'{asset_id}_Brace_{z}', (0,-.25,z), (.30,.022,.022), lit, asset_id, rotation=(0,math.radians(28 if z!=.78 else -28),0), bevel=.005))
            add(cube(f'{asset_id}_Ladder', (.35,-.19,.94), (.022,.018,.58), accent, asset_id, bevel=.004))
        elif shape == 'fuel-pump-island':
            add(cube(f'{asset_id}_Island', (0,0,.06), (.70,.34,.06), dark, asset_id, bevel=.04))
            for x in (-.30,.30):
                add(cube(f'{asset_id}_Pump_{x}', (x,-.05,.48), (.16,.14,.42), primary, asset_id, bevel=.035))
                add(cube(f'{asset_id}_Meter_{x}', (x,-.195,.62), (.10,.015,.10), accent, asset_id, bevel=.008))
                add(cylinder(f'{asset_id}_Hose_{x}', (x+.16,-.05,.44), .025,.48,metal,asset_id,vertices=8,rotation=(math.radians(12),0,0)))
            for x in (-.60,.60): add(cylinder(f'{asset_id}_CanopyPost_{x}', (x,.12,.78), .035,1.45,metal,asset_id,vertices=8))
            add(cube(f'{asset_id}_Canopy', (0,.06,1.50), (.78,.42,.08), primary, asset_id, bevel=.025))
            add(cube(f'{asset_id}_Glow', (0,-.37,1.47), (.50,.02,.035), accent, asset_id, bevel=.008))
        elif shape == 'town-billboard':
            for x in (-.46,.46): add(cylinder(f'{asset_id}_Post_{x}', (x,.10,.70), .045,1.40,dark,asset_id,vertices=8))
            add(cube(f'{asset_id}_Board', (0,0,1.30), (.68,.09,.40), primary, asset_id, rotation=(0,0,-.05), bevel=.018))
            add(cube(f'{asset_id}_Inset', (0,-.10,1.30), (.58,.018,.30), secondary, asset_id, rotation=(0,0,-.05), bevel=.012))
            add(cube(f'{asset_id}_Headline', (-.12,-.125,1.42), (.34,.012,.055), accent, asset_id, rotation=(0,0,-.05), bevel=.006))
            for i,w in enumerate((.40,.30,.46)): add(cube(f'{asset_id}_Copy_{i}', (-.05,-.124,1.28-i*.10), (w,.01,.018), lit if i!=1 else accent, asset_id, bevel=.004))
            add(cube(f'{asset_id}_Break', (.57,-.11,1.56), (.12,.025,.10), dark, asset_id, rotation=(.2,0,.6), bevel=.01))
        elif shape == 'porch-stoop':
            add(cube(f'{asset_id}_Facade', (0,.35,.72), (.46,.08,.66), primary, asset_id, bevel=.018))
            add(cube(f'{asset_id}_Roof', (0,.26,1.42), (.52,.20,.06), dark, asset_id, rotation=(math.radians(-8),0,0), bevel=.012))
            add(cube(f'{asset_id}_Deck', (0,.05,.34), (.56,.34,.08), lit, asset_id, bevel=.012))
            for i,(y,z,w) in enumerate(((-.34,.07,.62),(-.23,.15,.58),(-.12,.23,.54))): add(cube(f'{asset_id}_Step_{i}', (0,y,z), (w,.10,.07), primary, asset_id, bevel=.012))
            for x in (-.50,.50):
                add(cylinder(f'{asset_id}_Post_{x}', (x,.22,.72), .03,.92,dark,asset_id,vertices=8))
                add(cube(f'{asset_id}_Rail_{x}', (x,0,.62), (.03,.28,.03), dark, asset_id, rotation=(math.radians(10 if x>0 else -10),0,0), bevel=.005))
            add(cube(f'{asset_id}_DoorFrame', (0,.36,.76), (.22,.035,.45), dark, asset_id, bevel=.01))
            add(cube(f'{asset_id}_Door', (0,.32,.77), (.16,.02,.36), accent, asset_id, bevel=.008))
        elif shape == 'chain-fence-gate':
            for x in (-.65,.65): add(cylinder(f'{asset_id}_Post_{x}', (x,0,.58), .045,1.16,metal,asset_id,vertices=10))
            for side in (-1,1):
                center=side*.34
                add(cube(f'{asset_id}_Top_{side}', (center,0,1.02), (.27,.025,.025), metal, asset_id, rotation=(0,0,side*.09), bevel=.005))
                add(cube(f'{asset_id}_Base_{side}', (center,0,.16), (.27,.025,.025), metal, asset_id, rotation=(0,0,side*.09), bevel=.005))
                for i in range(4): add(cube(f'{asset_id}_Picket_{side}_{i}', (center+(i-1.5)*.14,0,.58), (.012,.02,.42), dark, asset_id, rotation=(0,0,side*.09), bevel=.003))
            add(cube(f'{asset_id}_Warning', (0,-.04,.76), (.14,.018,.09), accent, asset_id, rotation=(0,0,.09), bevel=.008))
        elif shape == 'streetlamp':
            add(cylinder(f'{asset_id}_Base', (0,0,.10), .13,.20,dark,asset_id,vertices=12))
            add(cylinder(f'{asset_id}_Pole', (0,0,.88), .035,1.56,metal,asset_id,vertices=10))
            add(cube(f'{asset_id}_Arm', (.18,0,1.64), (.20,.025,.025), metal, asset_id, rotation=(0,0,.14), bevel=.006))
            add(cube(f'{asset_id}_Housing', (.38,0,1.55), (.14,.10,.08), secondary, asset_id, rotation=(0,0,-.14), bevel=.018))
            add(cube(f'{asset_id}_Light', (.38,-.07,1.50), (.10,.025,.035), accent, asset_id, bevel=.012))
            add(cube(f'{asset_id}_Poster', (0,-.045,.78), (.08,.018,.16), primary, asset_id, rotation=(0,0,-.14), bevel=.004))
        elif shape == 'mailbox':
            add(cylinder(f'{asset_id}_Post', (0,.05,.40), .045,.80,dark,asset_id,vertices=8))
            add(cube(f'{asset_id}_Box', (0,-.02,.86), (.24,.20,.18), primary, asset_id, bevel=.06))
            add(cylinder(f'{asset_id}_Roof', (0,-.02,1.02), .20,.48,lit,asset_id,vertices=12,rotation=(0,math.radians(90),0)))
            add(cube(f'{asset_id}_Door', (-.25,-.02,.88), (.025,.17,.15), secondary, asset_id, bevel=.012))
            add(cube(f'{asset_id}_FlagPost', (.12,-.22,1.02), (.018,.018,.22), accent, asset_id, bevel=.004))
            add(cube(f'{asset_id}_Flag', (.20,-.22,1.18), (.09,.018,.06), accent, asset_id, bevel=.006))
        elif shape == 'stacked-crates':
            crates=((- .30,.04,.28,.28,.24,.28,0),(.30,.02,.26,.26,.23,.26,.08),(0,-.04,.80,.30,.24,.26,-.10))
            for i,(x,y,z,sx,sy,sz,rz) in enumerate(crates):
                add(cube(f'{asset_id}_Crate_{i}', (x,y,z), (sx,sy,sz), lit if i!=1 else primary, asset_id, rotation=(0,0,rz), bevel=.018))
                front=y-sy-.012
                add(cube(f'{asset_id}_BandH_{i}', (x,front,z), (sx+.015,.018,.028), dark, asset_id, rotation=(0,0,rz), bevel=.004))
                add(cube(f'{asset_id}_BandV_{i}', (x,front-.005,z), (.028,.018,sz+.015), dark, asset_id, rotation=(0,0,rz), bevel=.004))
            add(cube(f'{asset_id}_Mark', (0,-.292,.80), (.10,.014,.06), accent, asset_id, rotation=(0,0,-.1), bevel=.006))

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
    # Exact pixel reproducibility is a release contract. Eevee can vary a
    # shaded edge by one RGB unit when tile work is scheduled across threads.
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 1
    scene.render.dither_intensity = 0.0
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

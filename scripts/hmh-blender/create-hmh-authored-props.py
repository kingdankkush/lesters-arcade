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

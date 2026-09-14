"""Blender-authored, transparent obstacle art. Run with Blender --background --python.

The shared shape recipe defines the tree crown and drone envelope used by the
deterministic game. Rendered leaves extend slightly past the forgiving collider.
"""
import bpy
import json
import math
import random
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
SHAPES = json.loads((ROOT / 'apps/chikun/assets/obstacle-shapes.json').read_text(encoding='utf-8-sig'))
SOURCE = ROOT / 'apps/chikun/assets/source/open-air'
FRAMES = ROOT.parent / 'open-air-prop-frames'
SOURCE.mkdir(parents=True, exist_ok=True)
FRAMES.mkdir(parents=True, exist_ok=True)
random.seed(130926)


def material(name, color, metallic=0, roughness=.5, emission=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*color, 1)
    bs.inputs['Metallic'].default_value = metallic
    bs.inputs['Roughness'].default_value = roughness
    if emission:
        bs.inputs['Emission Color'].default_value = (*color, 1)
        bs.inputs['Emission Strength'].default_value = emission
    return m


def sphere(name, loc, scale, mat, subdivisions=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def rod(name, a, b, r1, r2, mat, vertices=12):
    delta = Vector(b) - Vector(a)
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=r1, radius2=r2, depth=delta.length, location=(Vector(a)+Vector(b))/2)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = delta.to_track_quat('Z', 'Y').to_euler()
    obj.data.materials.append(mat)
    bevel = obj.modifiers.new('Soft manufactured edges' if mat.name.startswith('Drone') else 'Worn bark edges', 'BEVEL')
    bevel.width = .012
    bevel.segments = 2
    return obj


def setup(width, height, ortho, target):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.film_transparent = True
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.fps = 24
    scene.world.color = (.25, .28, .32)
    scene.view_settings.view_transform = 'AgX'
    for name, loc, energy, size, color in [
        ('Warm late afternoon key', (-4,-6,8), 1000, 5, (1,.85,.67)),
        ('Cool sky fill', (4,-2,5), 800, 5, (.60,.82,1)),
        ('Sun rim', (1,4,7), 1500, 4, (1,.93,.70))]:
        bpy.ops.object.light_add(type='AREA', location=loc)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.shape = 'DISK'
        light.data.size = size
        light.data.color = color
        light.rotation_euler = (Vector(target)-light.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(location=(0,-15,target[2]))
    camera = bpy.context.object
    camera.name = 'Gameplay silhouette camera'
    camera.rotation_euler = (Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type = 'ORTHO'
    # Blender ortho_scale is the horizontal span for a landscape frame.
    camera.data.ortho_scale = ortho
    scene.camera = camera
    return scene


scene = setup(512,768,4.8,(0,0,2.4))
bark = material('Tree / warm ridged bark', (.20,.105,.046), roughness=.87)
bark_light = material('Tree / raised bark ridges', (.38,.22,.095), roughness=.85)
leaf_mats = [material('Tree / foliage %02d' % i,c,roughness=.66) for i,c in enumerate([
    (.035,.15,.065),(.055,.23,.095),(.085,.31,.12),(.13,.38,.15),(.22,.43,.15),(.30,.48,.18)])]
rod('Root to trunk', (0,0,.03),(-.035,0,2.4), .17,.095,bark)
rod('Upper trunk',(-.035,0,2.2),(0,0,3.35),.10,.025,bark)
for i in range(8):
    angle = i*math.tau/8
    rod('Exposed root %02d' % i,(math.cos(angle)*.37,math.sin(angle)*.20,.025),(0,0,.52),.023,.07,bark)
for i,(cx,z,r) in enumerate(SHAPES['tree']['crown']):
    rod('Crown branch %02d' % i,(0,.03,1.8+i*.13),(cx,0,z),.066,.018,bark)
    sphere('Crown shadow volume %02d' % i,(cx,.12,z),(r*.68,r*.48,r*.68),leaf_mats[0],3)
    # Folded, pointed leaves overlap into a crown with a broken natural edge.
    verts, faces, colors = [], [], []
    for j in range(820):
        u = random.uniform(-1,1)
        angle = random.uniform(0,math.tau)
        rr = r * random.uniform(.74,.98)
        normal = Vector((math.sqrt(1-u*u)*math.cos(angle),math.sqrt(1-u*u)*math.sin(angle),u))
        point = Vector((cx+normal.x*rr,normal.y*rr*.72,z+normal.z*rr))
        tangent = normal.cross(Vector((0,0,1)))
        if tangent.length < .01: tangent = Vector((1,0,0))
        tangent.normalize()
        up = normal.cross(tangent).normalized()
        a = random.uniform(0,math.tau)
        along = tangent*math.cos(a)+up*math.sin(a)
        across = normal.cross(along).normalized()
        length = random.uniform(.105,.205)
        wide = length * random.uniform(.38,.55)
        offset=len(verts)
        for v in [point-along*length,point-across*wide,point+along*length,point+across*wide,point+normal*.028]:
            verts.append(tuple(v))
        faces.extend([(offset,offset+1,offset+4),(offset+1,offset+2,offset+4),(offset+2,offset+3,offset+4),(offset+3,offset,offset+4)])
        colors.extend([random.randrange(1,6)]*4)
    mesh=bpy.data.meshes.new('Folded leaf crown mesh %02d'%i)
    mesh.from_pydata(verts,[],faces)
    mesh.update()
    obj=bpy.data.objects.new('Authored leaf crown %02d'%i,mesh)
    bpy.context.collection.objects.link(obj)
    for mat in leaf_mats: mesh.materials.append(mat)
    for face,color in zip(mesh.polygons,colors): face.material_index=color
for i in range(7):
    xx=(i-3)*.037
    rod('Fine trunk grain %02d' % i,(xx,-.145,.17),(xx*.54,-.085,2.30),.006,.003,bark_light,6)
scene['source_contract'] = 'obstacle-shapes.json tree; floor z=0, orthographic 3.2 x 4.8'
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'Chikun-City-Tree.blend'))
scene.render.filepath = str(FRAMES/'tree.png')
bpy.ops.render.render(write_still=True)

scene = setup(512,256,4,(0,0,0))
graphite = material('Drone / graphite ceramic',(.033,.052,.068),.35,.35)
ivory = material('Drone / warm ivory shell',(.67,.73,.70),.5,.28)
metal = material('Drone / brushed titanium',(.20,.29,.33),.8,.26)
orange = material('Drone / amber safety trim',(.91,.23,.028),.45,.28)
glass = material('Drone / optical glass',(.02,.095,.12),.75,.14)
cyan = material('Drone / turquoise navigation',(.05,.95,.76),.3,.21,2)
warning = material('Drone / amber optics',(1,.15,.025),.3,.18,2)
sphere('Armored fuselage',(0,0,0),(.64,.34,.235),ivory,3)
sphere('Underside chassis',(0,.01,-.095),(.50,.29,.17),graphite,3)
sphere('Forward panoramic visor',(0,-.295,.015),(.44,.065,.105),glass,3)
rod('Port titanium strut',(-.37,0,.03),(-1.12,0,.07),.08,.055,metal)
rod('Starboard titanium strut',(.37,0,.03),(1.12,0,.07),.08,.055,metal)
for sign in [-1,1]:
    x=sign*1.10
    sphere('Engine nacelle',(x,0,.04),(.22,.24,.155),graphite,3)
    rod('Rotor axle',(x,0,.06),(x,0,.20),.05,.04,metal)
    # A real ring, pitched toward the camera, reads as a protective rotor cage.
    bpy.ops.mesh.primitive_torus_add(major_radius=.34, minor_radius=.034, major_segments=40, minor_segments=8, location=(x,0,.17))
    ring=bpy.context.object
    ring.name='Orange rotor guard'
    ring.rotation_euler.x=math.radians(18)
    ring.data.materials.append(orange)
    bpy.ops.object.empty_add(type='PLAIN_AXES',location=(x,0,.20))
    hub=bpy.context.object
    hub.name='Spinning rotor '+str(sign)
    for angle in [0,math.pi]:
        blade=sphere('Carbon rotor blade',(x+math.cos(angle)*.16,math.sin(angle)*.16,.20),(.21,.044,.012),metal,2)
        blade.parent=hub
        blade.matrix_parent_inverse=hub.matrix_world.inverted()
    for frame in range(1,10):
        hub.rotation_euler.z=(frame-1)*math.tau/8
        hub.keyframe_insert(data_path='rotation_euler',frame=frame)
    sphere('Navigation lamp',(x,-.23,.07),(.046,.022,.028),cyan,2)
    rod('Landing skid',(sign*.30,.06,-.13),(sign*.40,-.01,-.30),.022,.018,metal)
    rod('Landing foot',(sign*.40,-.11,-.30),(sign*.40,.15,-.30),.019,.019,graphite)
    sphere('Safety stripe',(sign*.51,-.12,.10),(.043,.19,.09),orange,2)
    sphere('Optical sensor',(sign*.16,-.355,.012),(.077,.028,.041),warning,3)
rod('Top antenna',(0,.09,.19),(.08,.09,.37),.013,.008,metal,8)
sphere('Antenna status',( .08,.09,.37),(.023,.023,.023),cyan,2)
scene.frame_start=1
scene.frame_end=8
scene['source_contract']='obstacle-shapes.json drone; center z=0, orthographic 4 x 2'
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'Chikun-Patrol-Drone.blend'))
for frame in range(1,9):
    scene.frame_set(frame)
    scene.render.filepath=str(FRAMES/('drone-%02d.png'%frame))
    bpy.ops.render.render(write_still=True)
print('CHIKUN_OPEN_AIR_PROPS_COMPLETE')

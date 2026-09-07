"""Build a source-only static PBR selector scene; never replace gameplay rigs."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import bpy
from mathutils import Vector

p=argparse.ArgumentParser();p.add_argument('--inputs',required=True);p.add_argument('--output',required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);root=Path(__file__).resolve().parents[2]
inputs=json.loads(Path(a.inputs).read_text());target=Path(a.output).resolve()
assert not target.exists(), 'save a new version; never overwrite an existing source scene'
assert [h['actorId']for h in inputs['heroes']]==['lit-commando','lit-valkyrie','lester-original','lilly']
# Retain the certified shared camera, world, lights and color management only.
bpy.ops.wm.open_mainfile(filepath=str(root/'apps/hmh-reboot/assets/source/blender/hmh-production-heroes.blend'),load_ui=False)
scene=bpy.context.scene;scene.name='HMH | Textured Tripo Hero Selector'
for obj in list(bpy.data.objects):
    if obj.type not in {'CAMERA','LIGHT'}:bpy.data.objects.remove(obj,do_unlink=True)
bpy.data.orphans_purge(do_local_ids=True,do_linked_ids=False,do_recursive=True)
scene['hmh_source_mode']='static-textured-models';scene['hmh_gameplay_integrated']=False
for hero in inputs['heroes']:
    path=root/hero['sourcePath']
    assert path.stat().st_size==hero['sourceBytes'] and hashlib.sha256(path.read_bytes()).hexdigest()==hero['sourceSha256']
    before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(path));objects=list(set(bpy.data.objects)-before)
    meshes=[o for o in objects if o.type=='MESH'];assert meshes and all(o.data.uv_layers for o in meshes)
    collection=bpy.data.collections.new(hero['displayName']);scene.collection.children.link(collection)
    base=bpy.data.objects.new(hero['displayName']+' | Selector Root',None);collection.objects.link(base);base['hmh_selector_root']=hero['actorId'];base['hmh_actor_id']=hero['actorId']
    bpy.context.view_layer.update()
    points=[o.matrix_world@Vector(v)for o in meshes for v in o.bound_box]
    lo=Vector(tuple(min(v[k]for v in points)for k in range(3)));hi=Vector(tuple(max(v[k]for v in points)for k in range(3)))
    for i,obj in enumerate(objects):
        obj['hmh_original_name']=obj.name;obj.name=f'{hero["displayName"]} | Source {i+1:02d}'
        obj['hmh_actor_id']=hero['actorId'];obj['hmh_source_sha256']=hero['sourceSha256']
        for c in list(obj.users_collection):c.objects.unlink(obj)
        collection.objects.link(obj)
        if obj.parent is None:
            matrix=obj.matrix_world.copy();obj.parent=base;obj.matrix_world=matrix
            obj.location-=Vector(((lo.x+hi.x)*.5,(lo.y+hi.y)*.5,lo.z))
    base.scale=(2.1/(hi.z-lo.z),)*3;bpy.context.view_layer.update()
    # Analytic soft contact shadow. No image texture or opaque backdrop.
    bpy.ops.mesh.primitive_plane_add(size=2,location=(0,0,-.005));shadow=bpy.context.object
    shadow.name=hero['displayName']+' | Contact Shadow';shadow.scale=(.64,.34,1)
    shadow['hmh_actor_id']=hero['actorId'];shadow['hmh_selector_shadow']=True
    for c in list(shadow.users_collection):c.objects.unlink(shadow)
    collection.objects.link(shadow);shadow.parent=base;shadow.matrix_parent_inverse=base.matrix_world.inverted()
    mat=bpy.data.materials.new(hero['displayName']+' | Soft Shadow');mat.use_nodes=True;mat.surface_render_method='BLENDED'
    nodes=mat.node_tree.nodes;nodes.clear();links=mat.node_tree.links
    coord=nodes.new('ShaderNodeTexCoord');distance=nodes.new('ShaderNodeVectorMath');distance.operation='DISTANCE';distance.inputs[1].default_value=(.5,.5,0)
    links.new(coord.outputs['UV'],distance.inputs[0]);ramp=nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=0;ramp.color_ramp.elements[0].color=(.30,.30,.30,1);ramp.color_ramp.elements[1].position=.5;ramp.color_ramp.elements[1].color=(0,0,0,1)
    links.new(distance.outputs['Value'],ramp.inputs['Fac']);transparent=nodes.new('ShaderNodeBsdfTransparent');black=nodes.new('ShaderNodeEmission');black.inputs['Color'].default_value=(0,0,0,1)
    mix=nodes.new('ShaderNodeMixShader');links.new(ramp.outputs['Color'],mix.inputs[0]);links.new(transparent.outputs[0],mix.inputs[1]);links.new(black.outputs[0],mix.inputs[2]);out=nodes.new('ShaderNodeOutputMaterial');links.new(mix.outputs[0],out.inputs['Surface']);shadow.data.materials.append(mat)
    for obj in [*objects,shadow]:obj.hide_render=True
    print(json.dumps({'actorId':hero['actorId'],'sourceSha256':hero['sourceSha256'],'meshes':len(meshes),'height':2.1}),flush=True)
assert not [o for o in bpy.data.objects if o.type=='ARMATURE']
bpy.ops.wm.save_as_mainfile(filepath=str(target),compress=True)
print(json.dumps({'saved':str(target),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size}),flush=True)

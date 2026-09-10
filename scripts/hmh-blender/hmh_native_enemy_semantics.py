"""Repo-owned, CPU-only native enemy evidence helpers; no source mutations or render calls."""
import array
import hashlib
import json
import bpy


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()).hexdigest()


def flat(matrix):
    return [float(x) for row in matrix for x in row]


def values(collection, attribute, width, kind='f'):
    data = array.array(kind, [0]) * (len(collection) * width)
    collection.foreach_get(attribute, data)
    return hashlib.sha256(data.tobytes()).hexdigest()


def plain(value):
    if value is None or isinstance(value, (str, bool, int, float)):
        return value
    if isinstance(value, bpy.types.ID):
        return value.name
    try:
        return [plain(x) for x in value]
    except TypeError:
        return str(value)


def properties(obj):
    return {k: plain(v) for k, v in obj.items()}


def action_record(action):
    curves = []
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for fc in bag.fcurves:
                    curves.append({'path': fc.data_path, 'index': fc.array_index, 'extrapolation': fc.extrapolation,
                        'mute':fc.mute, 'modifiers': [m.type for m in fc.modifiers],
                        'keys': [[*k.co, *k.handle_left, *k.handle_right, k.interpolation, k.handle_left_type, k.handle_right_type, k.easing, k.amplitude, k.back, k.period] for k in fc.keyframe_points]})
    return {'range':list(action.frame_range), 'slots':[s.identifier for s in action.slots], 'properties':properties(action),
            'curveCount':len(curves), 'channels': sorted(set(c['path'] for c in curves)), 'curvesSha256':digest(curves)}


def mesh_record(obj):
    mesh = obj.data
    weights = [[(obj.vertex_groups[g.group].name, g.weight) for g in v.groups] for v in mesh.vertices]
    return {'vertices':len(mesh.vertices),'edges':len(mesh.edges),'polygons':len(mesh.polygons),'loops':len(mesh.loops),
        'coordinates':values(mesh.vertices,'co',3), 'edgesSha256':values(mesh.edges,'vertices',2,'i'),
        'loopVertices':values(mesh.loops,'vertex_index',1,'i'),
        'polygonStarts':values(mesh.polygons,'loop_start',1,'i'), 'polygonSizes':values(mesh.polygons,'loop_total',1,'i'),
        'smooth':digest([p.use_smooth for p in mesh.polygons]), 'materialIndices':values(mesh.polygons,'material_index',1,'i'),
        'uvs':{u.name:values(u.data,'uv',2) for u in mesh.uv_layers},
        'materials':[m.name if m else None for m in mesh.materials],
        'groups':[g.name for g in obj.vertex_groups], 'weightsSha256':digest(weights)}


def snapshot(object_names=None, material_names=None, image_names=None, action_names=None):
    objects = [bpy.data.objects[n] for n in object_names] if object_names is not None else list(bpy.context.scene.objects)
    materials = [bpy.data.materials[n] for n in material_names] if material_names is not None else list(bpy.data.materials)
    images = [bpy.data.images[n] for n in image_names] if image_names is not None else [i for i in bpy.data.images if i.type not in {'RENDER_RESULT','COMPOSITING'}]
    actions = [bpy.data.actions[n] for n in action_names] if action_names is not None else list(bpy.data.actions)
    result = {'objects':{},'materials':{},'images':{},'actions':{}}
    for obj in objects:
        r = {'type':obj.type, 'parent':obj.parent.name if obj.parent else None,'parentType':obj.parent_type,'parentBone':obj.parent_bone,
            'basis':flat(obj.matrix_basis),'parentInverse':flat(obj.matrix_parent_inverse),'rotationMode':obj.rotation_mode,
            'modifiers':[{'name':m.name,'type':m.type,'target':getattr(getattr(m,'object',None),'name',None),'vertexGroup':getattr(m,'vertex_group',None),'envelopes':getattr(m,'use_bone_envelopes',None),'vertexGroups':getattr(m,'use_vertex_groups',None),'preserveVolume':getattr(m,'use_deform_preserve_volume',None),'showViewport':m.show_viewport,'showRender':m.show_render} for m in obj.modifiers],
            'constraints':[{'type':c.type,'name':c.name,'influence':c.influence} for c in obj.constraints]}
        if obj.type=='MESH':
            r['mesh']=mesh_record(obj)
        if obj.type=='ARMATURE':
            r['restBones']={b.name:{'parent':b.parent.name if b.parent else None,'head':list(b.head_local),'tail':list(b.tail_local),'matrix':flat(b.matrix_local),'deform':b.use_deform,'connected':b.use_connect,'inheritScale':b.inherit_scale} for b in obj.data.bones}
            r['poseModes']={b.name:b.rotation_mode for b in obj.pose.bones}
            ad=obj.animation_data
            r['nla']=[{'name':t.name,'mute':t.mute,'strips':[{'action':s.action.name,'slot':s.action_slot.identifier if s.action_slot else None,'range':[s.frame_start,s.frame_end],'actionRange':[s.action_frame_start,s.action_frame_end],'blend':s.blend_type,'influence':s.influence,'scale':s.scale,'repeat':s.repeat} for s in t.strips]} for t in ad.nla_tracks] if ad else []
        result['objects'][obj.name]=r
    for m in materials:
        nodes=[]
        links=[]
        if m.node_tree:
            for n in m.node_tree.nodes:
                nodes.append({'name':n.name,'type':n.bl_idname,'image':getattr(getattr(n,'image',None),'name',None),
                    'settings':{k:plain(getattr(n,k)) for k in ('uv_map','interpolation','extension','projection','space','blend_type','operation') if hasattr(n,k)},
                    'inputs':[[s.identifier,plain(s.default_value)] for s in n.inputs if hasattr(s,'default_value')]})
            links=sorted((l.from_node.name,l.from_socket.identifier,l.to_node.name,l.to_socket.identifier) for l in m.node_tree.links)
        result['materials'][m.name]={'useNodes':m.use_nodes,'diffuse':list(m.diffuse_color),'nodes':nodes,'links':links}
    for i in images:
        packed=[bytes(f.packed_file.data) for f in i.packed_files] if len(i.packed_files) else ([bytes(i.packed_file.data)] if i.packed_file else [])
        result['images'][i.name]={'size':list(i.size),'colorSpace':i.colorspace_settings.name,'alphaMode':i.alpha_mode,'source':i.source,
            'packed':[{'bytes':len(p),'sha256':hashlib.sha256(p).hexdigest()} for p in packed]}
    result['actions']={a.name:action_record(a) for a in actions}
    return result


def resnapshot(reference):
    return snapshot(*[list(reference[k]) for k in ('objects','materials','images','actions')])


def differences(first, second):
    return [f'{category}/{name}' for category in first for name in set(first[category])|set(second[category]) if digest(first[category].get(name))!=digest(second[category].get(name))]

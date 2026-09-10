"""Put an existing native hero into the certified gameplay camera/light scene.

Geometry, UVs, materials, weights and actions come from the owner's completed
master. This creates a new derivative and never saves over either input.
"""
from __future__ import annotations
import argparse
from array import array
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]


def validate_paths(source: Path, template: Path, output: Path):
    source, template, output = source.resolve(), template.resolve(), output.resolve()
    if any(path.suffix.lower() != '.blend' for path in (source, template, output)):
        raise ValueError('all scene paths must be .blend files')
    if not source.is_file() or not template.is_file():
        raise ValueError('both source scenes must already exist')
    receipt = output.with_suffix('.preparation.json')
    if output.exists() or receipt.exists() or output in (source, template):
        preserved = output if output.exists() or output in (source, template) else receipt
        raise FileExistsError(f'preserving existing scene artifact: {preserved}')
    allowed = (ROOT / '.tmp', ROOT / 'apps/hmh-reboot/assets/source/models/tripo-gameplay')
    if not any(output.is_relative_to(base.resolve()) for base in allowed):
        raise ValueError('derived source must stay in the private scratch or source-model vault')
    return source, template, output


def _json_value(value):
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, bytes):
        return {'sha256': hashlib.sha256(value).hexdigest(), 'bytes': len(value)}
    if hasattr(value, 'bl_rna') and hasattr(value, 'name'):
        return {'idType': value.bl_rna.identifier, 'name': value.name}
    try:
        return [_json_value(item) for item in value]
    except TypeError:
        return str(value)


def _rna_settings(block, excluded=(), depth=0):
    result = {}
    excluded = set(excluded) | {'rna_type'}
    for prop in sorted(block.bl_rna.properties, key=lambda item: item.identifier):
        name = prop.identifier
        if name in excluded or prop.is_readonly:
            continue
        try:
            value = getattr(block, name)
        except (AttributeError, RuntimeError, TypeError):
            continue
        if prop.type == 'COLLECTION':
            if depth < 1:
                result[name] = [_rna_settings(item, depth=depth + 1) for item in value]
        elif prop.type == 'POINTER':
            result[name] = None if value is None else {
                'idType': value.bl_rna.identifier,
                'name': getattr(value, 'name', None),
            }
        else:
            result[name] = _json_value(value)
    return result


def _digest(value):
    encoded = json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
    return hashlib.sha256(encoded).hexdigest()


def _packed_image_signature(image):
    if image.source != 'FILE':
        return {'name': image.name, 'source': image.source}
    packed = [image.packed_file] if image.packed_file else [item.packed_file for item in image.packed_files]
    assert packed, f'unpacked source texture: {image.name}'
    return {
        'name': image.name,
        'source': image.source,
        'packedSha256': [hashlib.sha256(item.data).hexdigest() for item in packed],
    }


def _socket_signature(socket):
    row = {
        'name': socket.name,
        'identifier': getattr(socket, 'identifier', socket.name),
        'type': socket.bl_rna.identifier,
    }
    if hasattr(socket, 'default_value'):
        try:
            row['default'] = _json_value(socket.default_value)
        except (AttributeError, RuntimeError, TypeError):
            pass
    return row


def _node_tree_signature(tree, seen=None):
    if tree is None:
        return None
    seen = set() if seen is None else seen
    marker = (tree.bl_rna.identifier, tree.name)
    if marker in seen:
        return {'name': tree.name, 'recursiveReference': True}
    seen.add(marker)
    nodes = []
    for node in sorted(tree.nodes, key=lambda item: item.name):
        row = {
            'name': node.name,
            'type': node.bl_idname,
            'label': node.label,
            'mute': node.mute,
            'settings': _rna_settings(node, {'location', 'width', 'height', 'dimensions', 'select', 'show_options', 'show_preview'}),
            'inputs': [_socket_signature(socket) for socket in node.inputs],
            'outputs': [_socket_signature(socket) for socket in node.outputs],
        }
        image = getattr(node, 'image', None)
        if image is not None:
            row['image'] = _packed_image_signature(image)
        group_tree = getattr(node, 'node_tree', None)
        if group_tree is not None and group_tree is not tree:
            row['nodeTree'] = _node_tree_signature(group_tree, seen)
        nodes.append(row)
    links = sorted({
        (link.from_node.name, link.from_socket.identifier, link.to_node.name, link.to_socket.identifier)
        for link in tree.links
    })
    seen.remove(marker)
    return {'name': tree.name, 'nodes': nodes, 'links': [list(link) for link in links]}


def _material_signature(material):
    return {
        'name': material.name,
        'settings': _rna_settings(material, {'users', 'use_fake_user', 'node_tree', 'preview'}),
        'nodeTree': _node_tree_signature(material.node_tree) if material.use_nodes else None,
    }


def _modifier_signature(modifier):
    return {
        'name': modifier.name,
        'type': modifier.type,
        'settings': _rna_settings(modifier, {'execution_time'}),
    }


def _constraint_signature(constraint):
    return {
        'name': constraint.name,
        'type': constraint.type,
        'settings': _rna_settings(constraint),
    }


def _transform_signature(obj):
    return {
        'location': list(obj.location),
        'rotationMode': obj.rotation_mode,
        'rotationEuler': list(obj.rotation_euler),
        'rotationQuaternion': list(obj.rotation_quaternion),
        'scale': list(obj.scale),
        'deltaLocation': list(obj.delta_location),
        'deltaRotationEuler': list(obj.delta_rotation_euler),
        'deltaRotationQuaternion': list(obj.delta_rotation_quaternion),
        'deltaScale': list(obj.delta_scale),
        'matrixParentInverse': [list(row) for row in obj.matrix_parent_inverse],
        'parent': obj.parent.name if obj.parent else None,
        'parentType': obj.parent_type,
        'parentBone': obj.parent_bone,
    }


def _mesh_native_signature(obj):
    mesh = obj.data
    vertices = [list(vertex.co) for vertex in mesh.vertices]
    edges = [[*edge.vertices, edge.use_seam, edge.use_edge_sharp] for edge in mesh.edges]
    loops = [loop.vertex_index for loop in mesh.loops]
    polygons = [[polygon.loop_start, polygon.loop_total, polygon.material_index, polygon.use_smooth] for polygon in mesh.polygons]
    weights = [
        [[element.group, element.weight] for element in sorted(vertex.groups, key=lambda item: item.group)]
        for vertex in mesh.vertices
    ]
    uv_layers = [
        {'name': layer.name, 'activeRender': layer.active_render, 'uv': [list(item.uv) for item in layer.data]}
        for layer in mesh.uv_layers
    ]
    color_layers = []
    for layer in mesh.color_attributes:
        color_layers.append({
            'name': layer.name,
            'domain': layer.domain,
            'dataType': layer.data_type,
            'values': [
                _json_value(getattr(item, 'color_srgb', getattr(item, 'color', None)))
                for item in layer.data
            ],
        })
    shape_keys = None
    if mesh.shape_keys is not None:
        shape_keys = [
            {
                'name': key.name,
                'relativeKey': key.relative_key.name if key.relative_key else None,
                'interpolation': key.interpolation,
                'mute': key.mute,
                'value': key.value,
                'coordinates': [list(point.co) for point in key.data],
            }
            for key in mesh.shape_keys.key_blocks
        ]
    return {
        'name': obj.name,
        'layer': obj.get('hmh_layer'),
        'transform': _transform_signature(obj),
        'constraints': [_constraint_signature(item) for item in obj.constraints],
        'modifiers': [_modifier_signature(item) for item in obj.modifiers],
        'vertexGroups': [{'index': group.index, 'name': group.name, 'lockWeight': group.lock_weight} for group in obj.vertex_groups],
        'geometrySha256': _digest(vertices),
        'topologySha256': _digest({'edges': edges, 'loops': loops, 'polygons': polygons}),
        'weightsSha256': _digest(weights),
        'uvLayersSha256': _digest(uv_layers),
        'colorAttributesSha256': _digest(color_layers),
        'shapeKeysSha256': _digest(shape_keys),
        'materials': [material.name if material else None for material in mesh.materials],
        'polygonMaterialIndices': [polygon.material_index for polygon in mesh.polygons],
    }


def _armature_signature(obj):
    bones = []
    for bone in sorted(obj.data.bones, key=lambda item: item.name):
        bones.append({
            'name': bone.name,
            'parent': bone.parent.name if bone.parent else None,
            'useConnected': bone.use_connect,
            'useDeform': bone.use_deform,
            'inheritScale': bone.inherit_scale,
            'headLocal': list(bone.head_local),
            'tailLocal': list(bone.tail_local),
            'matrixLocal': [list(row) for row in bone.matrix_local],
            'bboneX': bone.bbone_x,
            'bboneZ': bone.bbone_z,
        })
    return {
        'name': obj.name,
        'transform': _transform_signature(obj),
        'constraints': [_constraint_signature(item) for item in obj.constraints],
        'bones': bones,
    }


def _fcurve_signature(curve):
    return {
        'dataPath': curve.data_path,
        'arrayIndex': curve.array_index,
        'extrapolation': curve.extrapolation,
        'group': curve.group.name if curve.group else None,
        'keyframes': [
            {
                'co': list(point.co),
                'handleLeft': list(point.handle_left),
                'handleRight': list(point.handle_right),
                'handleLeftType': point.handle_left_type,
                'handleRightType': point.handle_right_type,
                'interpolation': point.interpolation,
                'easing': point.easing,
            }
            for point in curve.keyframe_points
        ],
        'modifiers': [_rna_settings(modifier) for modifier in curve.modifiers],
    }


def _action_signature(action):
    slots = sorted(action.slots, key=lambda slot: (getattr(slot, 'target_id_type', ''), slot.name_display))
    layers = []
    for layer in action.layers:
        strips = []
        for strip in layer.strips:
            channels = []
            for slot in slots:
                try:
                    bag = strip.channelbag(slot)
                except (RuntimeError, TypeError):
                    bag = None
                if bag is None:
                    continue
                curves = sorted(
                    (_fcurve_signature(curve) for curve in bag.fcurves),
                    key=lambda row: (row['dataPath'], row['arrayIndex']),
                )
                channels.append({
                    'slot': {
                        'name': slot.name_display,
                        'idType': getattr(slot, 'target_id_type', None),
                    },
                    'fcurves': curves,
                })
            strips.append({
                'type': strip.bl_rna.identifier,
                'settings': _rna_settings(strip),
                'channels': channels,
            })
        layers.append({'name': layer.name, 'settings': _rna_settings(layer), 'strips': strips})
    legacy = []
    if hasattr(action, 'fcurves'):
        legacy = sorted(
            (_fcurve_signature(curve) for curve in action.fcurves),
            key=lambda row: (row['dataPath'], row['arrayIndex']),
        )
    return {
        'name': action.name,
        'slots': [
            {'name': slot.name_display, 'idType': getattr(slot, 'target_id_type', None)}
            for slot in slots
        ],
        'layers': layers,
        'legacyFcurves': legacy,
    }


def native_signature(bpy, actor_id):
    assert not bpy.data.libraries, 'native actor source must not contain linked libraries'
    actor_meshes = sorted(
        (obj for obj in bpy.data.objects if obj.type == 'MESH' and obj.get('hmh_actor_id') == actor_id),
        key=lambda obj: obj.name,
    )
    assert actor_meshes, f'actor has no native meshes: {actor_id}'
    rig_names = {
        target.name
        for obj in actor_meshes
        for target in ([obj.parent] + [getattr(modifier, 'object', None) for modifier in obj.modifiers])
        if target is not None and target.type == 'ARMATURE'
    }
    if not rig_names:
        armatures = [obj for obj in bpy.data.objects if obj.type == 'ARMATURE']
        assert len(armatures) == 1, [obj.name for obj in armatures]
        rig_names.add(armatures[0].name)
    material_names = {
        material.name
        for obj in actor_meshes
        for material in obj.data.materials
        if material is not None
    }
    return {
        'actorId': actor_id,
        'meshes': [_mesh_native_signature(obj) for obj in actor_meshes],
        'armatures': [_armature_signature(bpy.data.objects[name]) for name in sorted(rig_names)],
        'materials': [_material_signature(bpy.data.materials[name]) for name in sorted(material_names)],
        'fileImages': [
            _packed_image_signature(image)
            for image in sorted(bpy.data.images, key=lambda item: item.name)
            if image.source == 'FILE'
        ],
        'actions': [_action_signature(action) for action in sorted(bpy.data.actions, key=lambda item: item.name)],
    }


def mesh_signature(obj):
    coordinates = array('f', [0.0]) * (len(obj.data.vertices) * 3)
    obj.data.vertices.foreach_get('co', coordinates)
    digest = hashlib.sha256(coordinates.tobytes())
    for layer in obj.data.uv_layers:
        uv = array('f', [0.0]) * (len(layer.data) * 2)
        layer.data.foreach_get('uv', uv)
        digest.update(uv.tobytes())
    return {'name': obj.name, 'vertices': len(obj.data.vertices), 'polygons': len(obj.data.polygons), 'coordinateUvSha256': digest.hexdigest(), 'layer': obj.get('hmh_layer'), 'vertexGroups': [group.name for group in obj.vertex_groups]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for flag in ('source', 'template', 'output', 'actor-id'):
        parser.add_argument('--' + flag, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    source, template, output = validate_paths(Path(args.source), Path(args.template), Path(args.output))
    import bpy
    from bpy_extras.object_utils import world_to_camera_view
    from mathutils import Vector
    input_paths = {'source': source, 'template': template}
    input_hashes = {role: hashlib.sha256(path.read_bytes()).hexdigest() for role, path in input_paths.items()}
    bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False, use_scripts=False)
    source_native = native_signature(bpy, args.actor_id)
    source_meshes = sorted([mesh_signature(obj) for obj in bpy.data.objects if obj.type == 'MESH' and obj.get('hmh_actor_id') == args.actor_id], key=lambda row: row['name'])
    expected_actions = sorted(action.name for action in bpy.data.actions)
    assert len(expected_actions) == 9, expected_actions
    assert {row['layer'] for row in source_meshes} == {'shadow', 'lower-body', 'torso-head', 'weapon'}
    rig_names = [obj.name for obj in bpy.data.objects if obj.type == 'ARMATURE']
    assert len(rig_names) == 1, rig_names
    source_object_names = [row['name'] for row in source_meshes] + rig_names
    bpy.ops.wm.open_mainfile(filepath=str(template), load_ui=False, use_scripts=False)
    scene = bpy.context.scene
    assert scene.camera is not None and scene.camera.data.type == 'ORTHO'
    for obj in list(bpy.data.objects):
        if obj.type in {'MESH', 'ARMATURE'}:
            bpy.data.objects.remove(obj, do_unlink=True)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action, do_unlink=True)
    bpy.data.orphans_purge(do_recursive=True)
    with bpy.data.libraries.load(str(source), link=False) as (_, incoming):
        # Blender replaces these lists' names with datablocks on context exit.
        # Pass copies so the source contract remains immutable comparison data.
        incoming.objects = list(source_object_names)
        incoming.actions = list(expected_actions)
    for obj in incoming.objects:
        assert obj is not None
        if obj.name not in scene.objects:
            scene.collection.objects.link(obj)
    assert sorted(action.name for action in bpy.data.actions) == expected_actions, {'expected': expected_actions, 'actual': sorted(action.name for action in bpy.data.actions)}
    for action in bpy.data.actions:
        action.use_fake_user = True
    scene.name = f'{args.actor_id} | Textured Gameplay Render Source'
    scene.render.film_transparent = True
    scene.render.filepath = ''
    scene.frame_set(1)
    bpy.context.view_layer.update()
    derived_meshes = sorted([mesh_signature(obj) for obj in bpy.data.objects if obj.type == 'MESH' and obj.get('hmh_actor_id') == args.actor_id], key=lambda row: row['name'])
    assert derived_meshes == source_meshes, 'mesh/UV/layer/group structure changed during scene transfer'
    derived_native = native_signature(bpy, args.actor_id)
    assert derived_native == source_native, 'native actor data changed during scene transfer'
    bpy.ops.file.pack_all()
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output))
    bpy.ops.wm.open_mainfile(filepath=str(output), load_ui=False, use_scripts=False)
    scene = bpy.context.scene
    reloaded = sorted([mesh_signature(obj) for obj in bpy.data.objects if obj.type == 'MESH' and obj.get('hmh_actor_id') == args.actor_id], key=lambda row: row['name'])
    assert reloaded == source_meshes, 'native reopen changed source geometry'
    reloaded_native = native_signature(bpy, args.actor_id)
    assert reloaded_native == source_native, 'native save/reopen changed actor data'
    images = {}
    for image in bpy.data.images:
        if image.source != 'FILE':
            continue
        packed = [image.packed_file] if image.packed_file else [item.packed_file for item in image.packed_files]
        assert packed, f'unpacked source texture: {image.name}'
        images[image.name] = [hashlib.sha256(item.data).hexdigest() for item in packed]
    assert not bpy.data.libraries, 'derived source retained a linked library'
    for role, path in input_paths.items():
        assert hashlib.sha256(path.read_bytes()).hexdigest() == input_hashes[role], 'an input scene was modified'
    point = world_to_camera_view(scene, scene.camera, Vector((0, 0, 0)))
    rig = bpy.data.objects[rig_names[0]]
    assert 'weapon_socket' in rig.pose.bones
    report = {'actorId': args.actor_id, 'inputs': {role: {'file': path.name, 'sha256': input_hashes[role]} for role, path in input_paths.items()}, 'output': output.relative_to(ROOT).as_posix(), 'outputSha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'outputBytes': output.stat().st_size, 'armature': rig.name, 'boneCount': len(rig.data.bones), 'actions': sorted(action.name for action in bpy.data.actions), 'camera': {'position': list(scene.camera.location), 'rotation': list(scene.camera.rotation_euler), 'orthoScale': scene.camera.data.ortho_scale}, 'frameSize': [scene.render.resolution_x, scene.render.resolution_y], 'groundPixel': [point.x * scene.render.resolution_x, (1-point.y) * scene.render.resolution_y], 'packedImages': images, 'externalDependencyCount': 0, 'meshUvPreservationPassed': True, 'nativePreservationPassed': True, 'nativeSignatureSha256': _digest(reloaded_native), 'meshSignatures': reloaded}
    output.with_suffix('.preparation.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items() if k not in {'meshSignatures', 'packedImages'}}))


if __name__ == '__main__':
    main()

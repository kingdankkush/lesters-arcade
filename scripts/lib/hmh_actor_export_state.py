"""Restore temporary native export state without repairing or rebasing meshes."""
import math


CHANNELS = ("location", "rotation_euler", "rotation_quaternion", "rotation_axis_angle", "scale",
            "delta_location", "delta_rotation_euler", "delta_rotation_quaternion", "delta_scale")


def native_identity(value):
    if value is None:
        return None
    if hasattr(value, "as_pointer"):
        pointer = value.as_pointer()
        if not isinstance(pointer, int) or pointer <= 0:
            raise RuntimeError("Invalid native export RNA identity")
        return "RNA", pointer
    return "PYTHON", id(value)


def native_channels(obj):
    values = {name: tuple(getattr(obj, name)) for name in CHANNELS if hasattr(obj, name)}
    if not all(math.isfinite(number) for value in values.values() for number in value):
        raise RuntimeError("Nonfinite native export transform")
    return obj.rotation_mode, values


def animation_state(obj):
    adt = obj.animation_data
    if adt is None:
        return None
    return {"data": adt, "action": adt.action, "slot": adt.action_slot,
            "use_nla": adt.use_nla, "tweak": adt.use_tweak_mode,
            "tracks": tuple((track, track.name, track.mute, track.is_solo) for track in adt.nla_tracks)}


def capture_state(context, objects, rig):
    if len({obj.name for obj in objects}) != len(objects):
        raise RuntimeError("Duplicate native export object name")
    return {"objects": tuple((obj, obj.name, obj.parent, native_channels(obj), animation_state(obj),
                               obj.hide_get(), obj.hide_viewport) for obj in objects),
            "bones": tuple((bone, bone.name, native_channels(bone)) for bone in rig.pose.bones),
            "frame": (context.scene.frame_current, context.scene.frame_subframe),
            "pose": rig.data.pose_position,
            "selection": tuple((obj, obj.select_get()) for obj in context.view_layer.objects),
            "active": context.view_layer.objects.active}


def observe_body(proof, key, body, objects, identity):
    # Install detached components first so an identity/native-channel capture
    # failure cannot discard already captured protected geometry.
    proof[key] = {"components": {
        "positions": [list(vertex.co) for vertex in body.data.vertices],
        "weights": [[[body.vertex_groups[group.group].name, group.weight] for group in vertex.groups]
                    for vertex in body.data.vertices],
        "matrix": [list(row) for row in body.matrix_world],
        "materials": [material.name if material else None for material in body.data.materials],
        "modifiers": [(modifier.name, modifier.type) for modifier in body.modifiers]}}
    proof[key]["sha256"] = identity(body)
    proof[key]["objects"] = [{"name": obj.name, "native": native_channels(obj),
        "matrixWorld": [list(row) for row in obj.matrix_world], "hidden": obj.hide_get(),
        "hideViewport": obj.hide_viewport, "selected": obj.select_get(),
        "action": obj.animation_data.action.name if obj.animation_data and obj.animation_data.action else None,
        "tracks": [{"name": track.name, "mute": track.mute, "solo": track.is_solo}
                   for track in obj.animation_data.nla_tracks] if obj.animation_data else []} for obj in objects]


def restore_animation(saved, rig, failed):
    def assign(target, field, value, owner):
        try:
            setattr(target, field, value)
            return True
        except Exception as error:
            failed("animation-restoration:" + owner + ":" + field, error)
            return False

    assign(rig.data, "pose_position", saved["pose"], rig.name)
    for obj, name, parent, channels, animation, hidden, viewport in saved["objects"]:
        try:
            if obj.name != name or native_identity(obj.parent) != native_identity(parent):
                raise RuntimeError("Native export object ownership changed")
            if animation is None:
                if obj.animation_data is not None:
                    raise RuntimeError("Native export animation ownership changed")
                continue
            adt = obj.animation_data
            if native_identity(adt) != native_identity(animation["data"]):
                raise RuntimeError("Native export animation ownership changed")
            tracks = animation["tracks"]
            if len(adt.nla_tracks) != len(tracks) or any(native_identity(current) != native_identity(original[0]) or current.name != original[1]
                                                      for current, original in zip(adt.nla_tracks, tracks)):
                raise RuntimeError("Native export track ownership changed")
        except Exception as error:
            failed("animation-restoration:" + name + ":ownership", error)
            continue
        if assign(adt, "use_tweak_mode", False, name):
            action_restored = assign(adt, "action", animation["action"], name)
            # Blender clears the slot with action=None, and rejects even a
            # None slot assignment without an Action. Never assign a slot
            # after a failed Action setter or into a different Action.
            if action_restored and animation["action"] is not None:
                if native_identity(adt.action) == native_identity(animation["action"]):
                    assign(adt, "action_slot", animation["slot"], name)
                else:
                    failed("animation-restoration:" + name + ":action", RuntimeError("Native export Action was not restored"))
        assign(adt, "use_nla", animation["use_nla"], name)
        for track, track_name, mute, solo in tracks:
            assign(track, "is_solo", False, name + "/" + track_name)
            assign(track, "mute", mute, name + "/" + track_name)
        for track, track_name, mute, solo in tracks:
            assign(track, "is_solo", solo, name + "/" + track_name)
        assign(adt, "use_tweak_mode", animation["tweak"], name)


def restore_channels(saved):
    for target, name, channels in [(entry[0], entry[1], entry[3]) for entry in saved["objects"]] + list(saved["bones"]):
        if target.name != name:
            raise RuntimeError("Native transform ownership changed")
        target.rotation_mode = channels[0]
        for field, value in channels[1].items():
            setattr(target, field, value)


def restore_view(context, saved):
    for obj, name, parent, channels, animation, hidden, viewport in saved["objects"]:
        obj.hide_viewport = viewport
        obj.hide_set(hidden)
    for obj, selected in saved["selection"]:
        obj.select_set(selected)
    context.view_layer.objects.active = saved["active"]


def state_signature(state):
    def animation_signature(animation):
        if animation is None:
            return None
        return (native_identity(animation["data"]), native_identity(animation["action"]),
                native_identity(animation["slot"]), animation["use_nla"], animation["tweak"],
                tuple((native_identity(track), name, mute, solo) for track, name, mute, solo in animation["tracks"]))
    return (tuple((native_identity(obj), name, native_identity(parent), channels,
                   animation_signature(animation), hidden, viewport)
                  for obj, name, parent, channels, animation, hidden, viewport in state["objects"]),
            tuple((native_identity(bone), name, channels) for bone, name, channels in state["bones"]),
            state["frame"], state["pose"],
            tuple((native_identity(obj), selected) for obj, selected in state["selection"]),
            native_identity(state["active"]))


def assert_state_restored(context, saved, rig):
    current = capture_state(context, [entry[0] for entry in saved["objects"]], rig)
    if state_signature(current) != state_signature(saved):
        raise RuntimeError("Original native export presentation state was not restored exactly")


def run_export_restoring_state(context, objects, rig, body, exporter, identity, receipt):
    """Retain exporter state before cleanup, then require the original full guard."""
    proof = {"scope": "temporary native presentation state only", "failures": [], "restored": False}
    receipt["exportStateRestoration"] = proof
    observe_body(proof, "before", body, objects, identity)
    expected = receipt["optimizedNativeBodyBeforeSha256"]
    if proof["before"]["sha256"] != expected:
        raise RuntimeError("Original body custody differs before export; no rebasing permitted")
    saved = capture_state(context, objects, rig)
    primary = secondary = None
    result = None

    def failed(phase, error):
        nonlocal primary, secondary
        proof["failures"].append({"phase": phase, "error": str(error)})
        if primary is None:
            primary = error
        elif secondary is None:
            secondary = error

    try:
        result = exporter()
    except Exception as error:
        primary = error
        proof["exportFailure"] = str(error)
    finally:
        try:
            observe_body(proof, "beforeCleanup", body, objects, identity)
        except Exception as error:
            failed("before-cleanup-capture", error)
        # Independent cleanup steps preserve evidence and keep one failed step
        # from suppressing unrelated restoration. Never write mesh data here.
        for phase, operation in [
            ("animation-restoration", lambda: restore_animation(saved, rig, failed)),
            ("frame-restoration", lambda: context.scene.frame_set(saved["frame"][0], subframe=saved["frame"][1])),
            ("channel-restoration", lambda: restore_channels(saved)),
            ("dependency-update", context.view_layer.update),
            ("view-restoration", lambda: restore_view(context, saved))]:
            try:
                operation()
            except Exception as error:
                failed(phase, error)
        try:
            observe_body(proof, "afterCleanup", body, objects, identity)
            if proof["afterCleanup"]["sha256"] != expected:
                raise RuntimeError("Original full body custody failed after export cleanup")
            assert_state_restored(context, saved, rig)
            proof["restored"] = not proof["failures"]
        except Exception as error:
            failed("after-cleanup-custody", error)
    if primary is not None:
        receipt["completed"] = False
        if secondary is not None:
            raise primary from secondary
        raise primary
    return result


def capture_native_rest_pose(root, rig, body, source_sha, body_sha):
    """Detached source rest data, before export, with no scene mutation."""
    if source_sha != "56a9e240a8cc053f09e2ef95046bf84520ffa65ec561c5dec5e1f46c6ebed574":
        raise ValueError("Immutable source rest provenance changed")
    if body_sha != "d00345d46bc3d896341566e6c6cd9b38b5804f5e4c7c1e6b01f97ddf4b15704a":
        raise ValueError("Original body baseline changed before native rest capture")
    def matrix(value):
        result = [list(row) for row in value]
        if len(result) != 4 or any(len(row) != 4 or not all(math.isfinite(n) for n in row) for row in result):
            raise ValueError("Finite native rest matrix required")
        return result
    bones = list(rig.data.bones)
    if not 0 < len(bones) <= 32 or len({bone.name for bone in bones}) != len(bones):
        raise ValueError("Bounded unique native rest bones required")
    return {"schema": "hmh-native-rest-pose-v1", "actorId": "the-liquidator",
            "sourceSha256": source_sha, "bodyIdentitySha256": body_sha,
            "root": {"name": root.name, "worldMatrix": matrix(root.matrix_world)},
            "rig": {"name": rig.name, "worldMatrix": matrix(rig.matrix_world)},
            "body": {"name": body.name, "worldMatrix": matrix(body.matrix_world)},
            "bones": [{"name": bone.name, "parent": bone.parent.name if bone.parent else None,
                       "matrixLocal": matrix(bone.matrix_local)} for bone in bones]}

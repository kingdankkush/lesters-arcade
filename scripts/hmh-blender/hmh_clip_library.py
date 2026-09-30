"""Data-driven hero clip authoring for the shared HMH Tripo gameplay rigs.

Pure Python (no bpy). A clip is a list of pose keys at 60 Hz ticks. Each key
maps rig bone names to offsets expressed in Blender pose-bone semantics, so a
value here means exactly what it would mean typed into Blender's N-panel for
that bone: ``rot`` is an XYZ Euler in degrees, ``loc`` is metres in the bone's
own rest frame, ``scale`` is a per-axis multiplier. Offsets compose on top of
the hero's *neutral stance* (its native ``idle`` clip at t=0), so an empty
pose is the standing hero.

Rig axis facts measured on all four hero rigs (``dump-hmh-hero-pose-basis.py``):
+Y runs along every bone, +Z points forward, and local X points to world -X on
BOTH sides. Therefore limb rotation ``x`` swings forward/back, ``z`` moves a
limb sideways (negative = outward for the right side), ``y`` twists, and the
left/right mirror of a pose is ``rot (x, -y, -z)``, ``loc (-x, y, z)``.

Export path: a baked clip becomes glTF LINEAR samplers whose node transforms
are ``rest ∘ basis`` (``check-hmh-hero-clip-equivalence.py`` proves this
reproduces Blender's own export of the nine native clips to <1e-6). Baked
clips are appended to an existing hero GLB without touching its geometry,
textures or native animations, and are recorded in ``asset.extras`` so a
re-export strips the previous library block first.

Everything here is projection-only. Nothing reads or writes simulation state.
"""
from __future__ import annotations

import json
import math
import struct
from dataclasses import dataclass, field

TICK_RATE = 60
CLIP_DURATION_SECONDS = 1.0  # every GLB clip is normalised; the manifest carries ticks
EASES = ("linear", "in", "out", "in-out", "hold")
PROPS = ("blaster", "knife", "frag", "none")
CATEGORIES = ("native", "movement", "evasion", "cover", "traversal", "weapon", "melee", "grenade",
              "damage", "death", "ceremony", "interaction", "hazard", "fidget")
LIBRARY_EXTRAS_KEY = "hmhClipLibrary"
LIBRARY_SCHEMA = 1

# Shared skeleton. Hero-specific extras (coat tails, release bones) are read from the GLB.
CORE_BONES = ("root", "pelvis", "spine", "chest", "head",
              "upper_arm.L", "forearm.L", "hand.L", "upper_arm.R", "forearm.R", "hand.R",
              "weapon_socket", "pistol_prop", "knife_prop", "grenade_prop",
              "thigh.L", "shin.L", "foot.L", "thigh.R", "shin.R", "foot.R")
PROP_BONES = {"blaster": "pistol_prop", "knife": "knife_prop", "frag": "grenade_prop"}
RELEASE_BONES = ("grenade_release", "release_grip")


# ---------------------------------------------------------------- maths (xyzw quaternions)
def quat_from_euler_xyz_degrees(rot):
    """Blender XYZ Euler (X applied first, then Y, then Z) as an xyzw quaternion."""
    x, y, z = (math.radians(v) / 2 for v in rot)
    cx, sx, cy, sy, cz, sz = math.cos(x), math.sin(x), math.cos(y), math.sin(y), math.cos(z), math.sin(z)
    # q = qz * qy * qx
    return (sx * cy * cz - cx * sy * sz, cx * sy * cz + sx * cy * sz, cx * cy * sz - sx * sy * cz, cx * cy * cz + sx * sy * sz)


def quat_multiply(a, b):
    x1, y1, z1, w1 = a
    x2, y2, z2, w2 = b
    return (w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2, w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2,
            w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2, w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2)


def quat_conjugate(q):
    return (-q[0], -q[1], -q[2], q[3])


def quat_normalize(q):
    n = math.sqrt(sum(v * v for v in q))
    if n <= 0:
        raise ValueError("degenerate quaternion")
    return tuple(v / n for v in q)


def quat_rotate(q, v):
    x, y, z, w = q
    cx, cy, cz = y * v[2] - z * v[1] + w * v[0], z * v[0] - x * v[2] + w * v[1], x * v[1] - y * v[0] + w * v[2]
    return (v[0] + 2 * (y * cz - z * cy), v[1] + 2 * (z * cx - x * cz), v[2] + 2 * (x * cy - y * cx))


def quat_slerp(a, b, t):
    dot = sum(p * q for p, q in zip(a, b))
    if dot < 0:
        b, dot = tuple(-v for v in b), -dot
    if dot > 0.9995:
        return quat_normalize(tuple(p + (q - p) * t for p, q in zip(a, b)))
    angle = math.acos(min(1.0, dot))
    sa, sb = math.sin((1 - t) * angle), math.sin(t * angle)
    s = math.sin(angle)
    return tuple((sa * p + sb * q) / s for p, q in zip(a, b))


def ease_fraction(kind, t):
    if kind == "linear":
        return t
    if kind == "in":
        return t * t
    if kind == "out":
        return 1 - (1 - t) * (1 - t)
    if kind == "in-out":
        return t * t * (3 - 2 * t)
    if kind == "hold":
        return 0.0 if t < 1 else 1.0
    raise ValueError("unknown ease: " + str(kind))


# ---------------------------------------------------------------- authoring data model
def _vec(value, size, default):
    if value is None:
        return tuple(default)
    value = tuple(float(v) for v in value)
    if len(value) != size or not all(math.isfinite(v) for v in value):
        raise ValueError("expected %d finite components" % size)
    return value


@dataclass(frozen=True)
class BonePose:
    rot: tuple = (0.0, 0.0, 0.0)      # XYZ Euler degrees, Blender pose-bone semantics
    loc: tuple = (0.0, 0.0, 0.0)      # metres in the bone rest frame
    scale: tuple = (1.0, 1.0, 1.0)

    @staticmethod
    def of(rot=None, loc=None, scale=None):
        return BonePose(_vec(rot, 3, (0, 0, 0)), _vec(loc, 3, (0, 0, 0)), _vec(scale, 3, (1, 1, 1)))

    def mirrored(self):
        return BonePose((self.rot[0], -self.rot[1], -self.rot[2]), (-self.loc[0], self.loc[1], self.loc[2]), self.scale)

    def scaled(self, k):
        return BonePose(tuple(v * k for v in self.rot), tuple(v * k for v in self.loc),
                        tuple(1 + (v - 1) * k for v in self.scale))


def pose(**bones):
    """``pose(chest=(10, 0, 0), pelvis={'loc': (0, -.1, 0)})`` -> {bone: BonePose}."""
    result = {}
    for name, value in bones.items():
        name = name.replace("_L", ".L").replace("_R", ".R") if name.endswith(("_L", "_R")) else name
        if isinstance(value, BonePose):
            result[name] = value
        elif isinstance(value, dict):
            result[name] = BonePose.of(value.get("rot"), value.get("loc"), value.get("scale"))
        else:
            result[name] = BonePose.of(rot=value)
    return result


def merge(*poses):
    """Later poses override earlier ones per bone (no additive blending)."""
    result = {}
    for item in poses:
        result.update(item)
    return result


def add(*poses):
    """Sum rotation/location offsets per bone (scale multiplies)."""
    result = {}
    for item in poses:
        for bone, value in item.items():
            base = result.get(bone, BonePose())
            result[bone] = BonePose(tuple(a + b for a, b in zip(base.rot, value.rot)), tuple(a + b for a, b in zip(base.loc, value.loc)),
                                    tuple(a * b for a, b in zip(base.scale, value.scale)))
    return result


def scaled(item, k):
    return {bone: value.scaled(k) for bone, value in item.items()}


def _mirror_name(name):
    if name.endswith(".L"):
        return name[:-2] + ".R"
    if name.endswith(".R"):
        return name[:-2] + ".L"
    return name


def mirror_pose(item):
    return {_mirror_name(bone): value.mirrored() for bone, value in item.items()}


@dataclass(frozen=True)
class Key:
    tick: int
    pose: dict
    ease: str = "in-out"   # ease used when travelling INTO this key from the previous one

    def __post_init__(self):
        if not isinstance(self.tick, int) or self.tick < 0:
            raise ValueError("key tick must be a non-negative integer")
        if self.ease not in EASES:
            raise ValueError("unknown ease " + str(self.ease))
        for bone, value in self.pose.items():
            if not isinstance(bone, str) or not isinstance(value, BonePose):
                raise ValueError("pose values must be BonePose")


@dataclass(frozen=True)
class Clip:
    name: str
    ticks: int
    keys: tuple
    category: str
    loop: bool = False
    blend_in: int = 4
    blend_out: int = 4
    interruptible: bool = True
    prop: str = "blaster"
    prop_release_tick: int | None = None   # frag clips: hide the held grenade from this tick on
    samples: int | None = None             # baked LINEAR samples; odd and (n-1) % 4 == 0
    heroes: tuple | None = None            # None = every hero
    note: str = ""

    def __post_init__(self):
        if not self.name or self.name != self.name.lower() or " " in self.name:
            raise ValueError("clip names are lowercase-hyphen tokens")
        if not isinstance(self.ticks, int) or self.ticks < 2 or self.ticks > 600:
            raise ValueError("clip ticks must be 2..600: " + self.name)
        if self.category not in CATEGORIES or self.prop not in PROPS:
            raise ValueError("unknown category/prop: " + self.name)
        if not all(isinstance(k, Key) for k in self.keys) or len(self.keys) < 1:
            raise ValueError("clip needs Key entries: " + self.name)
        ticks = [k.tick for k in self.keys]
        if ticks != sorted(ticks) or len(set(ticks)) != len(ticks) or ticks[0] != 0 or ticks[-1] > self.ticks:
            raise ValueError("keys must start at tick 0, be strictly increasing and end within the clip: " + self.name)
        if not (0 <= self.blend_in <= self.ticks and 0 <= self.blend_out <= self.ticks):
            raise ValueError("blend ticks out of range: " + self.name)
        if self.samples is not None and (self.samples < 5 or self.samples % 4 != 1):
            raise ValueError("samples must be 5, 9, 13, 17, 21, 25...: " + self.name)
        if self.prop_release_tick is not None and not (0 <= self.prop_release_tick <= self.ticks):
            raise ValueError("prop release tick out of range: " + self.name)

    def sample_count(self):
        if self.samples:
            return self.samples
        return 9 if self.ticks <= 24 else 13 if self.ticks <= 72 else 17 if self.ticks <= 150 else 25

    def manifest_entry(self):
        return {"name": self.name, "frames": self.ticks, "loop": self.loop, "blendIn": self.blend_in, "blendOut": self.blend_out,
                "interruptible": self.interruptible, "prop": self.prop, "category": self.category, "samples": self.sample_count(),
                "propReleaseTick": self.prop_release_tick}


def mirrored_clip(clip, name, note=""):
    """Left/right variant: every key mirrored, timing and flags preserved."""
    return Clip(name, clip.ticks, tuple(Key(k.tick, mirror_pose(k.pose), k.ease) for k in clip.keys), clip.category, clip.loop,
                clip.blend_in, clip.blend_out, clip.interruptible, clip.prop, clip.prop_release_tick, clip.samples, clip.heroes, note or clip.note)


# ---------------------------------------------------------------- evaluation
def _segment_keys(clip):
    keys = list(clip.keys)
    if clip.loop and keys[-1].tick < clip.ticks:
        keys.append(Key(clip.ticks, keys[0].pose, keys[-1].ease if len(keys) > 1 else "in-out"))
    elif keys[-1].tick < clip.ticks:
        keys.append(Key(clip.ticks, keys[-1].pose, "hold"))
    return keys


def _bone_state(item, bone):
    value = item.get(bone, BonePose())
    return quat_from_euler_xyz_degrees(value.rot), value.loc, value.scale


def evaluate_clip(clip, tick, bones):
    """Offsets (quat xyzw, loc, scale) per bone at a fractional tick in [0, ticks]."""
    keys = _segment_keys(clip)
    tick = max(0.0, min(float(clip.ticks), float(tick)))
    before = keys[0]
    after = keys[-1]
    for i in range(len(keys) - 1):
        if keys[i].tick <= tick <= keys[i + 1].tick:
            before, after = keys[i], keys[i + 1]
            break
    span = after.tick - before.tick
    fraction = 0.0 if span == 0 else ease_fraction(after.ease, (tick - before.tick) / span)
    result = {}
    for bone in bones:
        qa, la, sa = _bone_state(before.pose, bone)
        qb, lb, sb = _bone_state(after.pose, bone)
        if fraction <= 0:
            result[bone] = (qa, la, sa)
        elif fraction >= 1:
            result[bone] = (qb, lb, sb)
        else:
            result[bone] = (quat_slerp(qa, qb, fraction), tuple(a + (b - a) * fraction for a, b in zip(la, lb)),
                            tuple(a + (b - a) * fraction for a, b in zip(sa, sb)))
    return result


# ---------------------------------------------------------------- GLB access
GLB_MAGIC, JSON_CHUNK, BIN_CHUNK = 0x46546C67, 0x4E4F534A, 0x004E4942
ACCESSOR_WIDTH = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def read_glb(data):
    if data[:4] != b"glTF" or struct.unpack_from("<I", data, 4)[0] != 2 or struct.unpack_from("<I", data, 8)[0] != len(data):
        raise ValueError("expected a well-formed GLB v2")
    offset, json_chunk, bin_chunk = 12, None, None
    while offset < len(data):
        length, kind = struct.unpack_from("<II", data, offset)
        chunk = data[offset + 8:offset + 8 + length]
        if kind == JSON_CHUNK:
            json_chunk = json.loads(chunk.decode("utf-8"))
        elif kind == BIN_CHUNK:
            bin_chunk = bytes(chunk)
        else:
            raise ValueError("unsupported GLB chunk")
        offset += 8 + length
    if json_chunk is None or bin_chunk is None:
        raise ValueError("GLB needs JSON and BIN chunks")
    return json_chunk, bin_chunk


def write_glb(gltf, binary):
    encoded = json.dumps(gltf, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    encoded += b" " * (-len(encoded) % 4)
    binary = bytes(binary) + b"\0" * (-len(binary) % 4)
    total = 12 + 8 + len(encoded) + 8 + len(binary)
    return b"".join([struct.pack("<III", GLB_MAGIC, 2, total), struct.pack("<II", len(encoded), JSON_CHUNK), encoded,
                     struct.pack("<II", len(binary), BIN_CHUNK), binary])


def read_accessor(gltf, binary, index):
    accessor = gltf["accessors"][index]
    view = gltf["bufferViews"][accessor["bufferView"]]
    if accessor["componentType"] != 5126:
        raise ValueError("float accessor expected")
    width = ACCESSOR_WIDTH[accessor["type"]]
    stride = view.get("byteStride", width * 4)
    start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    return [struct.unpack_from("<%df" % width, binary, start + i * stride) for i in range(accessor["count"])]


def joint_rest(gltf):
    """{bone name: (node index, rest translation, rest rotation, rest scale)} for the single skin."""
    if len(gltf.get("skins", [])) != 1:
        raise ValueError("hero GLB must have one skin")
    rest = {}
    for node_index in gltf["skins"][0]["joints"]:
        node = gltf["nodes"][node_index]
        if "matrix" in node:
            raise ValueError("joint nodes must use TRS")
        rest[node["name"]] = (node_index, tuple(node.get("translation", [0, 0, 0])), tuple(node.get("rotation", [0, 0, 0, 1])), tuple(node.get("scale", [1, 1, 1])))
    return rest


def sample_native_basis(gltf, binary, clip_name, time_seconds, rest):
    """Blender pose basis (quat, loc, scale) of every joint in a native clip at a time."""
    animation = next((a for a in gltf.get("animations", []) if a["name"] == clip_name), None)
    if animation is None:
        raise ValueError("native clip missing: " + clip_name)
    node_state = {index: [list(t), list(r), list(s)] for name, (index, t, r, s) in rest.items()}
    for channel in animation["channels"]:
        sampler = animation["samplers"][channel["sampler"]]
        node = channel["target"]["node"]
        if node not in node_state:
            continue
        times = [v[0] for v in read_accessor(gltf, binary, sampler["input"])]
        values = read_accessor(gltf, binary, sampler["output"])
        path = channel["target"]["path"]
        if sampler.get("interpolation", "LINEAR") not in ("LINEAR", "STEP"):
            raise ValueError("native clip interpolation unsupported")
        hi = next((i for i, t in enumerate(times) if t >= time_seconds), len(times) - 1)
        lo = max(0, hi - 1)
        if hi == lo or sampler.get("interpolation") == "STEP":
            value = values[hi if times[hi] <= time_seconds else lo]
        else:
            f = (time_seconds - times[lo]) / (times[hi] - times[lo])
            value = quat_slerp(values[lo], values[hi], f) if path == "rotation" else tuple(a + (b - a) * f for a, b in zip(values[lo], values[hi]))
        node_state[node][{"translation": 0, "rotation": 1, "scale": 2}[path]] = list(value)
    basis = {}
    for name, (index, rt, rr, rs) in rest.items():
        t, r, s = node_state[index]
        inverse = quat_conjugate(rr)
        local = quat_rotate(inverse, tuple(a - b for a, b in zip(t, rt)))
        basis[name] = (quat_normalize(quat_multiply(inverse, tuple(r))), tuple(v / (k if abs(k) > 1e-9 else 1.0) for v, k in zip(local, rs)),
                       tuple(v / (k if abs(k) > 1e-9 else 1.0) for v, k in zip(s, rs)))
    return basis


def neutral_stance(gltf, binary, rest):
    return sample_native_basis(gltf, binary, "idle", 0.0, rest)


# ---------------------------------------------------------------- baking
def identity_neutral(rest):
    """A neutral stance equal to the rest pose (offsets then mean plain pose-bone basis values)."""
    return {bone: ((0.0, 0.0, 0.0, 1.0), (0.0, 0.0, 0.0), (1.0, 1.0, 1.0)) for bone in rest}


def _compose(rest_entry, neutral_entry, offset, absolute_scale=None):
    _, rt, rr, rs = rest_entry
    nq, nl, ns = neutral_entry
    oq, ol, os_ = offset
    basis_q = quat_normalize(quat_multiply(nq, oq))
    basis_l = tuple(a + b for a, b in zip(nl, ol))
    # Prop bones carry an absolute basis scale: a hidden prop's neutral scale can be
    # exactly zero (Commando), which no multiplier could bring back to one.
    basis_s = tuple(absolute_scale) if absolute_scale is not None else tuple(a * b for a, b in zip(ns, os_))
    rotation = quat_normalize(quat_multiply(rr, basis_q))
    translation = tuple(a + b for a, b in zip(rt, quat_rotate(rr, tuple(v * k for v, k in zip(basis_l, rs)))))
    scale = tuple(a * b for a, b in zip(rs, basis_s))
    return translation, rotation, scale


def bake_clip(clip, rest, neutral, hidden_scale=None):
    """Per-joint LINEAR samples ready for glTF: {bone: {'times': [...], 'translation': [...], 'rotation': [...], 'scale': [...]}}."""
    count = clip.sample_count()
    ticks = [clip.ticks * i / (count - 1) for i in range(count)]
    times = [CLIP_DURATION_SECONDS * i / (count - 1) for i in range(count)]
    bones = list(rest)
    prop_scale = {}
    for prop, bone in PROP_BONES.items():
        if bone not in rest:
            continue
        shown = clip.prop == prop
        hidden = (hidden_scale or {}).get(bone, neutral[bone][2])
        prop_scale[bone] = (shown, hidden)
    baked = {bone: {"times": times, "translation": [], "rotation": [], "scale": []} for bone in bones}
    previous = {bone: None for bone in bones}
    for tick, _ in zip(ticks, times):
        offsets = evaluate_clip(clip, tick, bones)
        for bone in bones:
            oq, ol, os_ = offsets[bone]
            absolute_scale = None
            if bone in prop_scale:
                shown, hidden = prop_scale[bone]
                visible = shown and (clip.prop_release_tick is None or tick < clip.prop_release_tick)
                absolute_scale = (1.0, 1.0, 1.0) if visible else tuple(hidden)
            elif bone in RELEASE_BONES:
                absolute_scale = tuple(neutral[bone][2])  # the released-grenade bone stays hidden
            t, r, s = _compose(rest[bone], neutral[bone], (oq, ol, os_), absolute_scale)
            if previous[bone] is not None and sum(a * b for a, b in zip(previous[bone], r)) < 0:
                r = tuple(-v for v in r)
            previous[bone] = r
            baked[bone]["translation"].append(t)
            baked[bone]["rotation"].append(r)
            baked[bone]["scale"].append(s)
    return baked


def compact_channel(times, values, epsilon):
    """Constant channels collapse to two keys; glTF LINEAR reproduces them exactly."""
    first = values[0]
    if all(max(abs(a - b) for a, b in zip(first, v)) <= epsilon for v in values):
        return [times[0], times[-1]], [first, first]
    return list(times), list(values)


# ---------------------------------------------------------------- GLB injection
def strip_library_block(gltf, binary):
    record = (gltf.get("asset", {}).get("extras") or {}).get(LIBRARY_EXTRAS_KEY)
    if not record:
        return gltf, binary, None
    gltf["bufferViews"] = gltf["bufferViews"][:record["bufferViews"]]
    gltf["accessors"] = gltf["accessors"][:record["accessors"]]
    gltf["animations"] = gltf["animations"][:record["animations"]]
    binary = binary[:record["binaryBytes"]]
    gltf["buffers"][0]["byteLength"] = len(binary)
    extras = gltf["asset"]["extras"]
    extras.pop(LIBRARY_EXTRAS_KEY)
    if not extras:
        gltf["asset"].pop("extras")
    return gltf, binary, record


def inject_clips(glb_bytes, clips, rest_epsilon=1e-7):
    """Append baked library clips to a hero GLB. Returns (bytes, report)."""
    gltf, binary = read_glb(glb_bytes)
    gltf, binary, previous = strip_library_block(gltf, binary)
    native_names = {a["name"] for a in gltf.get("animations", [])}
    rest = joint_rest(gltf)
    neutral = neutral_stance(gltf, binary, rest)
    record = {"schema": LIBRARY_SCHEMA, "bufferViews": len(gltf["bufferViews"]), "accessors": len(gltf["accessors"]),
              "animations": len(gltf.get("animations", [])), "binaryBytes": len(binary)}
    out = bytearray(binary)
    out += b"\0" * (-len(out) % 4)
    report = {"nativeClips": sorted(native_names), "libraryClips": [], "bytesBefore": len(glb_bytes), "strippedPrevious": previous}
    gltf.setdefault("animations", [])
    for clip in clips:
        if clip.name in native_names:
            raise ValueError("library clip collides with a native clip: " + clip.name)
        if any(a["name"] == clip.name for a in gltf["animations"]):
            raise ValueError("duplicate library clip: " + clip.name)
        baked = bake_clip(clip, rest, neutral)
        channels, samplers = [], []
        clip_bytes_start = len(out)
        view_index = len(gltf["bufferViews"])
        gltf["bufferViews"].append({"buffer": 0, "byteOffset": clip_bytes_start, "byteLength": 0})
        time_cache = {}

        def push(values, width, kind, extra=None):
            flat = [component for value in values for component in value] if width > 1 else list(values)
            offset = len(out) - clip_bytes_start
            out.extend(struct.pack("<%df" % len(flat), *flat))
            accessor = {"bufferView": view_index, "byteOffset": offset, "componentType": 5126, "count": len(values), "type": kind}
            if extra:
                accessor.update(extra)
            gltf["accessors"].append(accessor)
            return len(gltf["accessors"]) - 1

        for bone, tracks in baked.items():
            node_index = rest[bone][0]
            for path, width, kind, rest_value in (("translation", 3, "VEC3", rest[bone][1]), ("rotation", 4, "VEC4", rest[bone][2]), ("scale", 3, "VEC3", rest[bone][3])):
                times, values = compact_channel(tracks["times"], tracks[path], rest_epsilon)
                if all(abs(v - r) <= rest_epsilon for value in values for v, r in zip(value, rest_value)):
                    continue  # identical to the node's static rest value for the whole clip
                time_key = tuple(times)
                if time_key not in time_cache:
                    time_cache[time_key] = push(times, 1, "SCALAR", {"min": [times[0]], "max": [times[-1]]})
                samplers.append({"input": time_cache[time_key], "output": push(values, width, kind)})
                channels.append({"sampler": len(samplers) - 1, "target": {"node": node_index, "path": path}})
        gltf["bufferViews"][view_index]["byteLength"] = len(out) - clip_bytes_start
        if not channels:
            raise ValueError("clip produced no animated channels: " + clip.name)
        gltf["animations"].append({"name": clip.name, "channels": channels, "samplers": samplers})
        report["libraryClips"].append({**clip.manifest_entry(), "channels": len(channels), "binaryBytes": len(out) - clip_bytes_start})
    gltf["buffers"][0]["byteLength"] = len(out)
    gltf.setdefault("asset", {}).setdefault("extras", {})[LIBRARY_EXTRAS_KEY] = record
    result = write_glb(gltf, bytes(out))
    report["bytesAfter"] = len(result)
    report["record"] = record
    return result, report


# ---------------------------------------------------------------- native re-expression (equivalence proof)
def clip_from_basis_frames(name, frames, bone_names, neutral):
    """Re-express a native clip's per-frame Blender basis as library keys relative to a neutral stance.

    ``frames`` is the dump from ``dump-hmh-hero-pose-basis.py`` (Blender wxyz quaternions).
    Rotation and location are relative to ``neutral``; scale is carried absolutely (prop
    bones are hidden with scale 0 on some rigs). Keyed every frame with linear ease, so
    baking it at the same frame count reproduces the force-sampled native export.
    """
    keys = []
    total = len(frames) - 1
    for i, frame in enumerate(frames):
        offsets = {}
        for bone in bone_names:
            b = frame["basis"][bone]
            w, x, y, z = b["quat"]
            nq, nl, ns = neutral[bone]
            relative = quat_normalize(quat_multiply(quat_conjugate(nq), (x, y, z, w)))
            offsets[bone] = _RawPose(relative, tuple(a - c for a, c in zip(b["loc"], nl)), tuple(b["scale"]))
        keys.append(Key(i, offsets, "linear"))
    return _RawClip(name, total, tuple(keys))


class _RawPose(BonePose):
    """A BonePose whose rotation is already a quaternion (used only for native re-expression)."""
    def __init__(self, quat, loc, scale):
        object.__setattr__(self, "rot", quat)
        object.__setattr__(self, "loc", loc)
        object.__setattr__(self, "scale", scale)


class _RawClip:
    def __init__(self, name, ticks, keys):
        self.name, self.ticks, self.keys, self.loop, self.prop, self.prop_release_tick = name, ticks, keys, False, "none", None

    def sample_count(self):
        return self.ticks + 1


def evaluate_raw(clip, index, bones):
    key = clip.keys[index]
    return {bone: (key.pose[bone].rot, key.pose[bone].loc, key.pose[bone].scale) for bone in bones}


def bake_native_reexpression(raw, rest, neutral):
    """Bake a re-expressed native clip without prop overrides; returns node TRS per frame."""
    baked = {bone: {"translation": [], "rotation": [], "scale": []} for bone in rest}
    for index in range(len(raw.keys)):
        offsets = evaluate_raw(raw, index, list(rest))
        for bone in rest:
            t, r, s = _compose(rest[bone], neutral[bone], offsets[bone], offsets[bone][2])
            baked[bone]["translation"].append(t)
            baked[bone]["rotation"].append(r)
            baked[bone]["scale"].append(s)
    return baked


def compare_native(gltf, binary, clip_name, baked, rest):
    """Max abs difference between a baked re-expression and the committed native samplers."""
    animation = next(a for a in gltf["animations"] if a["name"] == clip_name)
    names = {index: name for name, (index, *_ ) in rest.items()}
    worst = {"translation": 0.0, "rotation": 0.0, "scale": 0.0}
    for channel in animation["channels"]:
        node = channel["target"]["node"]
        if node not in names:
            continue
        path = channel["target"]["path"]
        values = read_accessor(gltf, binary, animation["samplers"][channel["sampler"]]["output"])
        ours = baked[names[node]][path]
        if len(values) != len(ours):
            raise ValueError("sample count mismatch for " + clip_name)
        for got, mine in zip(values, ours):
            if path == "rotation" and sum(a * b for a, b in zip(got, mine)) < 0:
                mine = tuple(-v for v in mine)
            worst[path] = max(worst[path], max(abs(a - b) for a, b in zip(got, mine)))
    return worst

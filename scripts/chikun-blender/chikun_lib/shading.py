"""Shader-node builder and the scenery material library.

Every material shares two global controls:
* HAZE: aerial perspective baked by depth (world y), a neutral haze the runtime
  fog then tints for the time of day.
* EmitSwitch: 0 renders the lit albedo pass; 1 renders the emission-only pass
  (windows, lamps) that the runtime adds back with 'lighter' at night.
"""
import bpy, math

HAZE = dict(color=(0.74, 0.80, 0.86), y0=0.0, y1=1000.0, near=0.0, far=0.0)
TILE = dict(period=0.0)  # set by regions.common.tile(): the strip's wrap period


def srgb(hex_value):
    c = [int(hex_value[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def _switch_group():
    g = bpy.data.node_groups.get('EmitSwitch')
    if g: return g
    g = bpy.data.node_groups.new('EmitSwitch', 'ShaderNodeTree')
    g.interface.new_socket('Value', in_out='OUTPUT', socket_type='NodeSocketFloat')
    out = g.nodes.new('NodeGroupOutput')
    v = g.nodes.new('ShaderNodeValue'); v.name = 'switch'; v.outputs[0].default_value = 0.0
    g.links.new(v.outputs[0], out.inputs[0])
    return g


def set_emit_only(on):
    _switch_group().nodes['switch'].outputs[0].default_value = 1.0 if on else 0.0


class NB:
    def __init__(self, tree):
        self.t, self.n, self.l = tree, tree.nodes, tree.links

    def new(self, kind, **props):
        node = self.n.new(kind)
        for k, v in props.items(): setattr(node, k, v)
        return node

    def put(self, socket, value):
        if isinstance(value, bpy.types.NodeSocket): self.l.new(value, socket)
        elif value is not None:
            if isinstance(value, (tuple, list)) and len(value) == 3 and socket.type == 'RGBA': value = (*value, 1.0)
            socket.default_value = value
        return socket

    def value(self, v):
        n = self.new('ShaderNodeValue'); n.outputs[0].default_value = v; return n.outputs[0]

    def math(self, op, a, b=None, c=None, clamp=False):
        n = self.new('ShaderNodeMath', operation=op, use_clamp=clamp)
        self.put(n.inputs[0], a)
        if b is not None: self.put(n.inputs[1], b)
        if c is not None: self.put(n.inputs[2], c)
        return n.outputs[0]

    def vmath(self, op, a, b=None, scale=None):
        n = self.new('ShaderNodeVectorMath', operation=op)
        self.put(n.inputs[0], a)
        if b is not None: self.put(n.inputs[1], b)
        if scale is not None: self.put(n.inputs['Scale'], scale)
        return n.outputs['Value'] if op in ('DOT_PRODUCT', 'LENGTH', 'DISTANCE') else n.outputs['Vector']

    def combine(self, x=0.0, y=0.0, z=0.0):
        n = self.new('ShaderNodeCombineXYZ')
        for i, v in enumerate((x, y, z)): self.put(n.inputs[i], v)
        return n.outputs[0]

    def separate(self, v):
        n = self.new('ShaderNodeSeparateXYZ'); self.put(n.inputs[0], v)
        return n.outputs[0], n.outputs[1], n.outputs[2]

    def geometry(self):
        return self.new('ShaderNodeNewGeometry')

    def texcoord(self):
        return self.new('ShaderNodeTexCoord')

    def object_random(self):
        # Object Info > Random differs between collection-instance copies (it
        # would put a colour seam where the strip wraps), and many kit objects
        # sit at the origin, so a location hash is useless. kit.link() gives
        # every object a deterministic pass index instead: identical in every
        # instance copy, distinct per object.
        idx = self.new('ShaderNodeObjectInfo').outputs['Object Index']
        n = self.new('ShaderNodeTexWhiteNoise'); n.noise_dimensions = '1D'
        self.put(n.inputs['W'], self.math('MULTIPLY', idx, 0.7310585))
        return n.outputs['Value']

    def periodic(self, pos, period):
        """Circle-map x so any 4D texture repeats exactly every `period` units."""
        x, y, z = self.separate(pos)
        theta = self.math('MULTIPLY', x, math.tau / period)
        r = period / math.tau
        cx = self.math('MULTIPLY', self.math('COSINE', theta), r)
        sx = self.math('MULTIPLY', self.math('SINE', theta), r)
        return self.combine(cx, sx, y), z

    def noise(self, vec, scale=1.0, detail=4.0, rough=0.5, w=None, distortion=0.0, lacunarity=2.0):
        n = self.new('ShaderNodeTexNoise')
        n.noise_dimensions = '4D' if w is not None else '3D'
        self.put(n.inputs['Vector'], vec)
        if w is not None: self.put(n.inputs['W'], w)
        n.inputs['Scale'].default_value = scale
        n.inputs['Detail'].default_value = detail
        n.inputs['Roughness'].default_value = rough
        n.inputs['Lacunarity'].default_value = lacunarity
        n.inputs['Distortion'].default_value = distortion
        return n.outputs['Factor']

    def voronoi(self, vec, scale=1.0, w=None, feature='F1', randomness=1.0):
        n = self.new('ShaderNodeTexVoronoi')
        n.voronoi_dimensions = '4D' if w is not None else '3D'
        n.feature = feature
        self.put(n.inputs['Vector'], vec)
        if w is not None: self.put(n.inputs['W'], w)
        n.inputs['Scale'].default_value = scale
        n.inputs['Randomness'].default_value = randomness
        return n

    def white(self, vec, w=None):
        n = self.new('ShaderNodeTexWhiteNoise')
        n.noise_dimensions = '4D' if w is not None else '3D'
        self.put(n.inputs['Vector'], vec)
        if w is not None: self.put(n.inputs['W'], w)
        return n.outputs['Value'], n.outputs['Color']

    def ramp(self, fac, stops, interp='LINEAR'):
        n = self.new('ShaderNodeValToRGB')
        cr = n.color_ramp; cr.interpolation = interp
        while len(cr.elements) > 1: cr.elements.remove(cr.elements[-1])
        for i, (pos, col) in enumerate(stops):
            e = cr.elements[0] if i == 0 else cr.elements.new(pos)
            e.position = pos
            c = srgb(col) if isinstance(col, str) else col
            e.color = (*c, 1.0) if len(c) == 3 else c
        self.put(n.inputs[0], fac)
        return n.outputs['Color']

    def mix(self, a, b, fac, blend='MIX'):
        n = self.new('ShaderNodeMix', data_type='RGBA', blend_type=blend)
        self.put(n.inputs[0], fac)
        self.put(n.inputs[6], srgb(a) if isinstance(a, str) else a)
        self.put(n.inputs[7], srgb(b) if isinstance(b, str) else b)
        return n.outputs[2]

    def mixf(self, a, b, fac):
        n = self.new('ShaderNodeMix', data_type='FLOAT')
        self.put(n.inputs[0], fac); self.put(n.inputs[2], a); self.put(n.inputs[3], b)
        return n.outputs[0]

    def maprange(self, v, a, b, c=0.0, d=1.0, smooth=False, clamp=True):
        n = self.new('ShaderNodeMapRange', interpolation_type='SMOOTHSTEP' if smooth else 'LINEAR', clamp=clamp)
        self.put(n.inputs[0], v)
        for i, x in zip((1, 2, 3, 4), (a, b, c, d)): self.put(n.inputs[i], x)
        return n.outputs[0]

    def bump(self, height, strength=0.3, distance=1.0, normal=None):
        n = self.new('ShaderNodeBump')
        self.put(n.inputs['Height'], height)
        n.inputs['Strength'].default_value = strength
        n.inputs['Distance'].default_value = distance
        if normal is not None: self.put(n.inputs['Normal'], normal)
        return n.outputs['Normal']

    def rgb(self, col):
        c = srgb(col) if isinstance(col, str) else col
        n = self.new('ShaderNodeRGB'); n.outputs[0].default_value = (*c, 1.0)
        return n.outputs[0]


def material(name, build, haze=True, emissive=False):
    """build(nb) -> dict(color, rough, normal, emit, emit_strength, spec, transmission)."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    tree = mat.node_tree
    for n in list(tree.nodes): tree.nodes.remove(n)
    nb = NB(tree)
    spec = build(nb)
    out = nb.new('ShaderNodeOutputMaterial')
    bsdf = nb.new('ShaderNodeBsdfPrincipled')
    nb.put(bsdf.inputs['Base Color'], spec.get('color', (0.5, 0.5, 0.5)))
    nb.put(bsdf.inputs['Roughness'], spec.get('rough', 0.8))
    nb.put(bsdf.inputs['Specular IOR Level'], spec.get('spec', 0.25))
    nb.put(bsdf.inputs['Metallic'], spec.get('metal', 0.0))
    if spec.get('normal') is not None: nb.put(bsdf.inputs['Normal'], spec['normal'])
    if spec.get('translucent'):
        tr = nb.new('ShaderNodeBsdfTranslucent'); nb.put(tr.inputs['Color'], spec.get('color', (0.5, 0.5, 0.5)))
        m = nb.new('ShaderNodeMixShader'); m.inputs[0].default_value = spec['translucent']
        nb.l.new(bsdf.outputs[0], m.inputs[1]); nb.l.new(tr.outputs[0], m.inputs[2])
        beauty = m.outputs[0]
    else:
        beauty = bsdf.outputs[0]
    haze_fac = None
    if haze and HAZE['far'] > 0:
        y = nb.separate(nb.geometry().outputs['Position'])[1]
        haze_fac = nb.maprange(y, HAZE['y0'], HAZE['y1'], HAZE['near'], HAZE['far'], smooth=True)
        he = nb.new('ShaderNodeEmission'); he.inputs['Color'].default_value = (*HAZE['color'], 1); he.inputs['Strength'].default_value = 1.0
        hm = nb.new('ShaderNodeMixShader'); nb.put(hm.inputs[0], haze_fac)
        nb.l.new(beauty, hm.inputs[1]); nb.l.new(he.outputs[0], hm.inputs[2])
        beauty = hm.outputs[0]
    # Emission-only pass.
    ee = nb.new('ShaderNodeEmission')
    if emissive and spec.get('emit') is not None:
        nb.put(ee.inputs['Color'], spec['emit'])
        strength = spec.get('emit_strength', 1.0)
        if haze_fac is not None:
            strength = nb.math('MULTIPLY', strength if not isinstance(strength, (int, float)) else nb.value(strength), nb.math('SUBTRACT', 1.0, nb.math('MULTIPLY', haze_fac, 0.6)))
        nb.put(ee.inputs['Strength'], strength)
    else:
        ee.inputs['Color'].default_value = (0, 0, 0, 1); ee.inputs['Strength'].default_value = 0.0
    sw = nb.new('ShaderNodeGroup'); sw.node_tree = _switch_group()
    fm = nb.new('ShaderNodeMixShader'); nb.l.new(sw.outputs[0], fm.inputs[0])
    nb.l.new(beauty, fm.inputs[1]); nb.l.new(ee.outputs[0], fm.inputs[2])
    nb.l.new(fm.outputs[0], out.inputs['Surface'])
    return mat


# ---------------------------------------------------------------- material library

def flat(name, color, rough=0.85, jitter=0.06, scale=0.05, spec=0.2, period=None):
    """Solid colour with a little per-object and per-surface variation. Objects
    that span the whole tile must pass `period` so the variation wraps."""
    def build(nb):
        pos = nb.texcoord().outputs['Object']
        if period:
            vec, w = nb.periodic(pos, period)
            n = nb.noise(vec, scale=scale, detail=3.0, w=w)
        else:
            n = nb.noise(pos, scale=scale, detail=3.0)
        r = nb.object_random()
        base = nb.rgb(color)
        dark = nb.mix(base, (0.0, 0.0, 0.0), jitter, 'MIX')
        light = nb.mix(base, (1.0, 1.0, 1.0), jitter * 0.8, 'MIX')
        c = nb.mix(dark, light, nb.math('ADD', nb.math('MULTIPLY', n, 0.7), nb.math('MULTIPLY', r, 0.3)))
        return dict(color=c, rough=rough, spec=spec)
    return material(name, build)


def foliage(name, dark, mid, light, scale=0.12, bump=0.5):
    """Leafy clumps: cellular light/dark breakup plus per-object hue shift."""
    def build(nb):
        pos = nb.texcoord().outputs['Object']
        v = nb.voronoi(pos, scale=scale * 1.6)
        n = nb.noise(pos, scale=scale, detail=5.0, rough=0.6)
        f = nb.math('ADD', nb.math('MULTIPLY', v.outputs['Distance'], 0.55), nb.math('MULTIPLY', n, 0.6))
        f = nb.math('ADD', f, nb.math('MULTIPLY', nb.object_random(), 0.25))
        c = nb.ramp(f, [(0.25, dark), (0.62, mid), (0.95, light)])
        normal = nb.bump(nb.math('ADD', v.outputs['Distance'], n), strength=bump, distance=2.0)
        return dict(color=c, rough=0.75, normal=normal, spec=0.15, translucent=0.15)
    return material(name, build)


def terrain(name, stops, period, scale=0.004, detail=6.0, bump=0.25, patches=None, bands=None):
    """Periodic ground/hill material. `patches` = (scale, [colours], edge_colour,
    edge_width) adds a field patchwork with hedgerow lines."""
    def build(nb):
        pos = nb.texcoord().outputs['Object']
        vec, w = nb.periodic(pos, period)
        n = nb.noise(vec, scale=scale, detail=detail, rough=0.55, w=w)
        c = nb.ramp(n, stops)
        if patches:
            pscale, cols, edge_col, edge_w = patches
            v = nb.voronoi(vec, scale=pscale, w=w, feature='F1', randomness=0.85)
            pick = v.outputs['Color']
            r = nb.separate(pick)[0]
            pc = nb.ramp(r, [(i / max(1, len(cols) - 1), col) for i, col in enumerate(cols)], interp='CONSTANT')
            pc = nb.mix(pc, c, 0.35, 'OVERLAY')
            e = nb.voronoi(vec, scale=pscale, w=w, feature='DISTANCE_TO_EDGE', randomness=0.85)
            edge = nb.maprange(e.outputs['Distance'], 0.0, edge_w, 1.0, 0.0, smooth=True)
            c = nb.mix(pc, edge_col, edge)
        if bands:
            # bands: list of (y0, y1, colour, softness) in object y
            y = nb.separate(pos)[1]
            for y0, y1, col, soft in bands:
                f = nb.math('MULTIPLY', nb.maprange(y, y0 - soft, y0 + soft, 0, 1, smooth=True), nb.maprange(y, y1 - soft, y1 + soft, 1, 0, smooth=True))
                c = nb.mix(c, col, f)
        normal = nb.bump(nb.noise(vec, scale=scale * 8, detail=3.0, w=w), strength=bump, distance=1.0)
        return dict(color=c, rough=0.9, normal=normal, spec=0.15)
    return material(name, build)


def fields(name, period, cell_w, row_depth, palette, hedge='#3c5530', hedge_w=1.4, y_start=0.0, stripe_pitch=3.0, seed=0.0, blank=None):
    """Rectilinear patchwork fields on a hillside: rows by depth (object y), cells
    by x with a per-row offset, one crop colour per cell, crop stripes inside and
    darker hedge lines on the boundaries. Periodic in x: cells = period / cell_w.
    blank = (colour, depth) keeps the front strip (y < depth) as plain meadow."""
    cells = int(round(period / cell_w)); cw = period / cells

    def build(nb):
        pos = nb.texcoord().outputs['Object']
        x, y, z = nb.separate(pos)
        vec, w = nb.periodic(pos, period)
        yy = nb.math('SUBTRACT', y, y_start)
        row = nb.math('FLOOR', nb.math('DIVIDE', yy, row_depth))
        # Same offset formula as field_grid() so hedge geometry sits on the lines.
        roff = nb.math('MULTIPLY', nb.math('FRACT', nb.math('ADD', nb.math('MULTIPLY', row, 0.6180339), seed * 0.1)), cw)
        xs = nb.math('ADD', x, roff)
        cell = nb.math('FLOORED_MODULO', nb.math('FLOOR', nb.math('DIVIDE', xs, cw)), cells)
        rv, rc = nb.white(nb.combine(cell, row, seed))
        crop = nb.ramp(rv, [(i / len(palette), c) for i, c in enumerate(palette)], interp='CONSTANT')
        n = nb.noise(vec, scale=0.06, detail=5.0, w=w)
        crop = nb.mix(crop, nb.mix(crop, (0, 0, 0), 0.3), nb.math('MULTIPLY', nb.math('SUBTRACT', n, 0.3), 0.8))
        # Crop rows inside each field: along x or along the slope, per cell.
        dirx = nb.math('GREATER_THAN', nb.separate(rc)[1], 0.5)
        coord = nb.mixf(x, yy, dirx)
        stripe = nb.math('MULTIPLY', nb.math('SINE', nb.math('MULTIPLY', coord, math.tau / stripe_pitch)), 0.5)
        stripe = nb.math('MULTIPLY', stripe, nb.math('GREATER_THAN', nb.separate(rc)[2], 0.35))
        crop = nb.mix(crop, nb.mix(crop, (0, 0, 0), 0.25), nb.math('MAXIMUM', stripe, 0.0))
        fx = nb.math('FRACT', nb.math('DIVIDE', xs, cw))
        fy = nb.math('FRACT', nb.math('DIVIDE', yy, row_depth))
        ex = nb.math('MINIMUM', nb.math('MULTIPLY', fx, cw), nb.math('MULTIPLY', nb.math('SUBTRACT', 1.0, fx), cw))
        ey = nb.math('MINIMUM', nb.math('MULTIPLY', fy, row_depth), nb.math('MULTIPLY', nb.math('SUBTRACT', 1.0, fy), row_depth))
        edge = nb.maprange(nb.math('MINIMUM', ex, ey), 0.0, hedge_w, 1.0, 0.0, smooth=True)
        c = nb.mix(crop, hedge, edge)
        if blank:
            col, depth = blank
            c = nb.mix(nb.mix(col, (0, 0, 0), nb.math('MULTIPLY', n, 0.25)), c, nb.maprange(y, depth - 8, depth + 8, 0, 1, smooth=True))
        normal = nb.bump(nb.math('ADD', n, nb.math('MULTIPLY', stripe, 0.3)), strength=0.35, distance=1.0)
        return dict(color=c, rough=0.9, normal=normal, spec=0.12)
    return material(name, build)


def wall(name, color, window=None, trim=None, rough=0.85, grime=0.12, timber=None):
    """Facade with a window grid on the camera-facing (x, z) plane.
    window = dict(w, h, cols_px, rows_px, x0, z0, z1, glass, lit, lit_prob, frame)."""
    def build(nb):
        pos = nb.texcoord().outputs['Object']
        x, y, z = nb.separate(pos)
        n = nb.noise(pos, scale=0.08, detail=4.0)
        base = nb.mix(nb.rgb(color), (0, 0, 0), nb.math('MULTIPLY', n, grime))
        base = nb.mix(base, (1, 1, 1), nb.math('MULTIPLY', nb.object_random(), 0.08))
        emit = None
        wmask = None
        if window:
            cw, ch = window['cols_px'], window['rows_px']
            fx = nb.math('FRACT', nb.math('DIVIDE', nb.math('SUBTRACT', x, window.get('x0', 0.0)), cw))
            fz = nb.math('FRACT', nb.math('DIVIDE', nb.math('SUBTRACT', z, window.get('z0', 0.0)), ch))
            half_w = window['w'] / cw / 2; half_h = window['h'] / ch / 2
            mx = nb.math('LESS_THAN', nb.math('ABSOLUTE', nb.math('SUBTRACT', fx, 0.5)), half_w)
            mz = nb.math('LESS_THAN', nb.math('ABSOLUTE', nb.math('SUBTRACT', fz, 0.5)), half_h)
            band = nb.math('MULTIPLY', nb.math('GREATER_THAN', z, window.get('z_min', 0.0)), nb.math('LESS_THAN', z, window.get('z_max', 1e9)))
            nrm = nb.geometry().outputs['Normal']
            facing = nb.math('LESS_THAN', nb.separate(nrm)[1], -0.5)
            mask = nb.math('MULTIPLY', nb.math('MULTIPLY', mx, mz), nb.math('MULTIPLY', band, facing))
            wmask = mask
            cell = nb.combine(nb.math('FLOOR', nb.math('DIVIDE', nb.math('SUBTRACT', x, window.get('x0', 0.0)), cw)), nb.math('FLOOR', nb.math('DIVIDE', nb.math('SUBTRACT', z, window.get('z0', 0.0)), ch)), nb.object_random())
            rnd, rcol = nb.white(cell)
            glass = nb.mix(window.get('glass', '#27323c'), window.get('glass_hi', '#5d7486'), nb.math('MULTIPLY', rnd, 0.6))
            base = nb.mix(base, glass, mask)
            if window.get('frame'):
                fr = nb.math('MULTIPLY', nb.math('LESS_THAN', nb.math('ABSOLUTE', nb.math('SUBTRACT', fx, 0.5)), half_w + window['frame'] / cw), nb.math('LESS_THAN', nb.math('ABSOLUTE', nb.math('SUBTRACT', fz, 0.5)), half_h + window['frame'] / ch))
                fr = nb.math('MULTIPLY', nb.math('SUBTRACT', fr, mask), nb.math('MULTIPLY', band, facing))
                base = nb.mix(base, window.get('frame_color', '#e8e2d2'), nb.math('MAXIMUM', fr, 0.0))
            lit = nb.math('LESS_THAN', rnd, window.get('lit_prob', 0.55))
            if window.get('building_lit', 1.0) < 1.0:
                # Whole buildings dark or lit: fewer, calmer lights and sparser emissive chunks.
                lit = nb.math('MULTIPLY', lit, nb.math('LESS_THAN', nb.object_random(), window['building_lit']))
            warm = nb.mix(window.get('lit', '#ffc877'), window.get('lit2', '#ffe3a8'), nb.separate(rcol)[1])
            emit = nb.mix((0, 0, 0), warm, nb.math('MULTIPLY', mask, lit))
        if timber:
            # Half-timbering: posts, floor beams and braces in dark oak.
            sp, fh, tw = timber.get('spacing', 12.0), timber.get('floor', 14.0), timber.get('width', 0.9)
            px = nb.math('FRACT', nb.math('DIVIDE', x, sp)); pz = nb.math('FRACT', nb.math('DIVIDE', z, fh))
            post = nb.math('LESS_THAN', nb.math('MINIMUM', nb.math('MULTIPLY', px, sp), nb.math('MULTIPLY', nb.math('SUBTRACT', 1.0, px), sp)), tw)
            beam = nb.math('LESS_THAN', nb.math('MINIMUM', nb.math('MULTIPLY', pz, fh), nb.math('MULTIPLY', nb.math('SUBTRACT', 1.0, pz), fh)), tw)
            brace = nb.math('LESS_THAN', nb.math('ABSOLUTE', nb.math('SUBTRACT', nb.math('MULTIPLY', px, sp), nb.math('MULTIPLY', pz, sp))), tw * 1.2)
            frame = nb.math('MINIMUM', nb.math('ADD', nb.math('ADD', post, beam), brace), 1.0)
            above = nb.math('GREATER_THAN', z, timber.get('from', fh))
            if wmask is not None: frame = nb.math('MULTIPLY', frame, nb.math('SUBTRACT', 1.0, wmask))
            base = nb.mix(base, timber.get('color', '#3b2a20'), nb.math('MULTIPLY', frame, above))
        if trim:
            for z0, z1, col in trim:
                f = nb.math('MULTIPLY', nb.math('GREATER_THAN', z, z0), nb.math('LESS_THAN', z, z1))
                base = nb.mix(base, col, f)
        return dict(color=base, rough=rough, emit=emit, emit_strength=window.get('strength', 1.0) if window else 1.0, spec=0.2)
    return material(name, build, emissive=bool(window))


def roof(name, color, tile=6.0, rough=0.8):
    def build(nb):
        pos = nb.texcoord().outputs['Object']
        x, y, z = nb.separate(pos)
        rows = nb.math('FRACT', nb.math('DIVIDE', nb.math('ADD', y, z), tile))
        stripe = nb.maprange(rows, 0.0, 0.25, 0.75, 1.0, smooth=True)
        n = nb.noise(pos, scale=0.1, detail=3.0)
        c = nb.mix(nb.mix(nb.rgb(color), (0, 0, 0), nb.math('MULTIPLY', nb.math('SUBTRACT', 1.0, stripe), 0.9)), (1, 1, 1), nb.math('MULTIPLY', n, 0.08))
        c = nb.mix(c, (0, 0, 0), nb.math('MULTIPLY', nb.object_random(), 0.12))
        return dict(color=c, rough=rough, spec=0.3)
    return material(name, build)


def lamp(name, color='#ffd9a0', body='#3a3c40', strength=1.2):
    """Unlit fixture by day, bright source in the emission pass."""
    def build(nb):
        return dict(color=nb.rgb(body), rough=0.5, emit=nb.rgb(color), emit_strength=strength)
    return material(name, build, emissive=True)


def water(name, deep, shallow, period, scale=0.02):
    def build(nb):
        pos = nb.texcoord().outputs['Object']
        vec, w = nb.periodic(pos, period)
        n = nb.noise(vec, scale=scale, detail=6.0, w=w, distortion=0.4)
        c = nb.ramp(n, [(0.3, deep), (0.7, shallow)])
        normal = nb.bump(nb.noise(vec, scale=scale * 6, detail=4.0, w=w), strength=0.25, distance=1.0)
        return dict(color=c, rough=0.08, normal=normal, spec=0.6)
    return material(name, build)

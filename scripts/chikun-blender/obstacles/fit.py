"""Measure and fit modules against their collision footprints in screen space."""
import bpy
from mathutils import Vector, Matrix
from .rig import SP, CP, screen


def screen_bbox(objs):
    dg = bpy.context.evaluated_depsgraph_get()
    x0 = y0 = float('inf'); x1 = y1 = float('-inf')
    for o in objs:
        if o.type != 'MESH':
            continue
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        mw = o.matrix_world
        for v in me.vertices:
            sx, sy = screen(mw @ v.co)
            x0 = min(x0, sx); x1 = max(x1, sx); y0 = min(y0, sy); y1 = max(y1, sy)
        ev.to_mesh_clear()
    return x0, y0, x1, y1


def shift(objs, dx=0.0, dsy=0.0):
    """Move objects by dx on screen and dsy (screen y, down) along world z."""
    for o in objs:
        o.location.x += dx
        o.location.z += -dsy / CP


def fit_vertical(objs, top=None, bottom=None, pivot_x=None):
    """Scale about the bottom (world z) so the silhouette spans [top, bottom] (screen y).
    With only `bottom`, translate so the lowest point lands on it."""
    x0, y0, x1, y1 = screen_bbox(objs)
    if bottom is not None and top is None:
        shift(objs, 0.0, bottom - y1)
        return
    if top is not None and bottom is not None:
        k = (bottom - top) / max(1e-6, (y1 - y0))
        # scale world y and z around the origin (screen y scales linearly), then place
        for o in objs:
            o.location.y *= k; o.location.z *= k
            o.scale = (o.scale.x, o.scale.y * k, o.scale.z * k)
        bpy.context.view_layer.update()
        x0, y0, x1, y1 = screen_bbox(objs)
        shift(objs, 0.0, bottom - y1)


def fit_horizontal(objs, left, right):
    x0, y0, x1, y1 = screen_bbox(objs)
    k = (right - left) / max(1e-6, (x1 - x0))
    for o in objs:
        o.location.x = left + (o.location.x - x0) * k
        o.scale = (o.scale.x * k, o.scale.y, o.scale.z)
    bpy.context.view_layer.update()

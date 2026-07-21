#!/usr/bin/env python3
"""Build the approved Hard Money Heroes Level 1 World Blueprint v3.

The generated outputs are the repo-owned source of truth for the 100x100 map,
browser runtime adapter, per-cell prompt context, and certification visuals.
"""

from __future__ import annotations

import csv
import json
import math
from collections import Counter, deque
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "docs" / "game-design" / "data"
ASSET_DIR = ROOT / "docs" / "game-design" / "assets" / "hmh-level-1-world-blueprint-v3"
BLUEPRINT_PATH = DATA_DIR / "hmh-level-1-world-blueprint-v3.json"
TILE_CONTEXT_PATH = DATA_DIR / "hmh-level-1-world-blueprint-v3-tile-contexts.csv"
RUNTIME_MODULE_PATH = ROOT / "apps" / "portal" / "src" / "hmh-level-one-world-v3-runtime.mjs"
WIDTH = 100
HEIGHT = 100

TERRAIN_FAMILIES = [
    {"code": "g", "id": "dry-grass", "title": "Dry prairie grass", "promptFamilyId": "terrain-dry-grass"},
    {"code": "G", "id": "lush-grass", "title": "Lush grass", "promptFamilyId": "terrain-lush-grass"},
    {"code": "F", "id": "forest-floor", "title": "Dry forest floor", "promptFamilyId": "terrain-forest-floor"},
    {"code": "D", "id": "packed-dirt", "title": "Packed dirt", "promptFamilyId": "terrain-packed-dirt"},
    {"code": "S", "id": "wasteland-sand", "title": "Wasteland sand", "promptFamilyId": "terrain-wasteland-sand"},
    {"code": "R", "id": "rocky-ground", "title": "Rocky ground", "promptFamilyId": "terrain-rocky-ground"},
    {"code": "X", "id": "cliff-mountain", "title": "Cliff and mountain blocker", "promptFamilyId": "terrain-cliff-mountain"},
    {"code": "C", "id": "cobblestone", "title": "Ghost-town cobblestone", "promptFamilyId": "terrain-cobblestone"},
    {"code": "A", "id": "cracked-asphalt", "title": "Cracked asphalt", "promptFamilyId": "terrain-cracked-asphalt"},
    {"code": "f", "id": "farm-field", "title": "Farm field", "promptFamilyId": "terrain-farm-field"},
    {"code": "B", "id": "beach-sand", "title": "Beach and lake sand", "promptFamilyId": "terrain-beach-sand"},
    {"code": "M", "id": "mud-reeds", "title": "Mud and reed bank", "promptFamilyId": "terrain-mud-reeds"},
    {"code": "W", "id": "fresh-deep-water", "title": "Deep river and lake water", "promptFamilyId": "terrain-fresh-water"},
    {"code": "w", "id": "shallow-ford", "title": "Authored shallow ford", "promptFamilyId": "terrain-shallow-ford"},
    {"code": "O", "id": "sea-water", "title": "Deep coastal sea", "promptFamilyId": "terrain-sea-water"},
    {"code": "H", "id": "wood-bridge", "title": "Wood bridge deck", "promptFamilyId": "terrain-wood-bridge"},
    {"code": "Q", "id": "stone-road-bridge", "title": "Stone and asphalt bridge", "promptFamilyId": "terrain-stone-road-bridge"},
]
TERRAIN_BY_CODE = {item["code"]: item for item in TERRAIN_FAMILIES}

TERRAIN_COLORS = {
    "g": "#8d9a52", "G": "#5e9854", "F": "#405d3c", "D": "#9a7548",
    "S": "#c89a58", "R": "#756d64", "X": "#3d4147", "C": "#77726a",
    "A": "#34383f", "f": "#b49b4f", "B": "#dec782", "M": "#64734f",
    "W": "#327b9c", "w": "#5aa4a8", "O": "#164f73", "H": "#805733",
    "Q": "#686a6c",
}
BIOME_COLORS = {
    "M": "#59616c", "F": "#365f43", "D": "#c1884f", "G": "#726a60",
    "P": "#74a65d", "T": "#4f5965", "A": "#a4a05a", "L": "#3c88a1",
    "C": "#d7b873", "S": "#1f6080",
}


def new_layer(fill: str) -> list[list[str]]:
    return [[fill for _ in range(WIDTH)] for _ in range(HEIGHT)]


def in_bounds(x: int, y: int) -> bool:
    return 0 <= x < WIDTH and 0 <= y < HEIGHT


def point_in_polygon(x: float, y: float, points: list[tuple[int, int]]) -> bool:
    inside = False
    j = len(points) - 1
    for i, (xi, yi) in enumerate(points):
        xj, yj = points[j]
        intersects = ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-9) + xi)
        if intersects:
            inside = not inside
        j = i
    return inside


def paint_polygon(layer: list[list[str]], points: list[tuple[int, int]], value: str) -> None:
    min_x = max(0, min(x for x, _ in points))
    max_x = min(WIDTH - 1, max(x for x, _ in points))
    min_y = max(0, min(y for _, y in points))
    max_y = min(HEIGHT - 1, max(y for _, y in points))
    for y in range(min_y, max_y + 1):
        for x in range(min_x, max_x + 1):
            if point_in_polygon(x + 0.5, y + 0.5, points):
                layer[y][x] = value


def paint_ellipse(layer: list[list[str]], cx: int, cy: int, rx: int, ry: int, value: str) -> None:
    for y in range(max(0, cy - ry), min(HEIGHT, cy + ry + 1)):
        for x in range(max(0, cx - rx), min(WIDTH, cx + rx + 1)):
            if ((x - cx) / max(1, rx)) ** 2 + ((y - cy) / max(1, ry)) ** 2 <= 1:
                layer[y][x] = value


def bresenham(a: tuple[int, int], b: tuple[int, int]) -> list[tuple[int, int]]:
    x0, y0 = a
    x1, y1 = b
    points = []
    dx = abs(x1 - x0)
    sx = 1 if x0 < x1 else -1
    dy = -abs(y1 - y0)
    sy = 1 if y0 < y1 else -1
    err = dx + dy
    while True:
        points.append((x0, y0))
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy
    return points


def expand_path(control_points: list[tuple[int, int]]) -> list[tuple[int, int]]:
    result: list[tuple[int, int]] = []
    for index in range(len(control_points) - 1):
        segment = bresenham(control_points[index], control_points[index + 1])
        result.extend(segment if index == 0 else segment[1:])
    return result


def paint_path(layer: list[list[str]], control_points: list[tuple[int, int]], value: str, radius: int = 0, skip: set[str] | None = None) -> list[tuple[int, int]]:
    painted: list[tuple[int, int]] = []
    skip = skip or set()
    for px, py in expand_path(control_points):
        for y in range(py - radius, py + radius + 1):
            for x in range(px - radius, px + radius + 1):
                if not in_bounds(x, y) or math.dist((x, y), (px, py)) > radius + 0.35:
                    continue
                if layer[y][x] in skip:
                    continue
                layer[y][x] = value
                painted.append((x, y))
    return painted


def paint_rect(layer: list[list[str]], x0: int, y0: int, x1: int, y1: int, value: str) -> None:
    for y in range(max(0, y0), min(HEIGHT, y1 + 1)):
        for x in range(max(0, x0), min(WIDTH, x1 + 1)):
            layer[y][x] = value


def set_cells(layer: list[list[str]], cells: list[tuple[int, int]], value: str) -> None:
    for x, y in cells:
        if in_bounds(x, y):
            layer[y][x] = value


def layer_rows(layer: list[list[str]]) -> list[str]:
    return ["".join(row) for row in layer]


def reachable(nav: list[list[str]], start: tuple[int, int]) -> set[tuple[int, int]]:
    seen: set[tuple[int, int]] = set()
    queue: deque[tuple[int, int]] = deque([start])
    while queue:
        x, y = queue.popleft()
        if not in_bounds(x, y) or (x, y) in seen or nav[y][x] == "#":
            continue
        seen.add((x, y))
        queue.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return seen


def label_font(size: int = 15) -> ImageFont.ImageFont:
    candidates = [
        Path("C:/Windows/Fonts/arialbd.ttf"),
        Path("C:/Windows/Fonts/arial.ttf"),
    ]
    for path in candidates:
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def build_layers() -> tuple[dict[str, list[list[str]]], dict]:
    terrain = new_layer("g")
    biome = new_layer("P")
    elevation = new_layer("1")
    nav = new_layer(".")
    route = new_layer(".")
    encounter = new_layer(".")

    # Major authored biome envelopes. Their overlaps intentionally blend through
    # transition terrain rather than creating hard rectangular bands.
    mountain_poly = [(0, 0), (100, 0), (100, 10), (84, 12), (72, 9), (60, 15), (47, 12), (35, 18), (18, 15), (0, 22)]
    forest_poly = [(1, 7), (28, 8), (39, 18), (37, 39), (31, 54), (18, 62), (4, 55), (1, 40)]
    desert_poly = [(1, 48), (23, 43), (43, 49), (58, 64), (58, 89), (1, 89)]
    plains_poly = [(36, 25), (72, 20), (94, 31), (94, 76), (72, 84), (53, 73), (42, 51)]
    coast_poly = [(66, 67), (99, 58), (99, 99), (53, 99), (60, 87)]
    town_poly = [(59, 38), (84, 35), (92, 45), (89, 63), (70, 68), (58, 57)]
    farm_poly = [(50, 67), (75, 62), (84, 77), (74, 88), (50, 86)]

    paint_polygon(terrain, mountain_poly, "R")
    paint_polygon(biome, mountain_poly, "M")
    paint_polygon(terrain, forest_poly, "F")
    paint_polygon(biome, forest_poly, "F")
    paint_polygon(terrain, desert_poly, "S")
    paint_polygon(biome, desert_poly, "D")
    paint_polygon(terrain, plains_poly, "G")
    paint_polygon(biome, plains_poly, "P")
    paint_polygon(terrain, coast_poly, "B")
    paint_polygon(biome, coast_poly, "C")
    paint_polygon(terrain, town_poly, "g")
    paint_polygon(biome, town_poly, "T")
    paint_polygon(terrain, farm_poly, "f")
    paint_polygon(biome, farm_poly, "A")

    # Elevation bands establish mountain sources and ensure downhill waterways.
    for y in range(HEIGHT):
        for x in range(WIDTH):
            if biome[y][x] == "M":
                elevation[y][x] = "4" if y <= 6 else "3" if y <= 12 else "2"
            elif biome[y][x] in {"F", "D"} and y < 32:
                elevation[y][x] = "2"
            else:
                elevation[y][x] = "1"

    # Beach buffer and lake basin are established before water is painted.
    paint_ellipse(terrain, 49, 64, 13, 11, "B")
    paint_ellipse(biome, 49, 64, 13, 11, "L")
    paint_ellipse(terrain, 49, 64, 10, 8, "W")
    paint_ellipse(biome, 49, 64, 10, 8, "L")
    paint_ellipse(nav, 49, 64, 10, 8, "#")
    paint_ellipse(elevation, 49, 64, 10, 8, "0")

    northwest_stream = [(19, 3), (21, 10), (25, 17), (29, 25), (33, 34), (37, 43), (41, 52), (44, 57)]
    northeast_stream = [(67, 3), (64, 10), (61, 18), (58, 27), (55, 36), (52, 45), (50, 53), (49, 56)]
    lake_outlet = [(56, 66), (61, 69), (66, 73), (72, 77), (78, 82), (84, 87), (88, 92)]
    waterways = [
        {"id": "northwest-pine-creek", "title": "Northwest Pine Creek", "source": "northwest-mountain-spring", "destination": "silver-wallet-lake", "path": northwest_stream, "elevationProfile": [4, 3, 3, 2, 2, 1, 1, 0]},
        {"id": "northeast-ridge-run", "title": "Northeast Ridge Run", "source": "northeast-mountain-spring", "destination": "silver-wallet-lake", "path": northeast_stream, "elevationProfile": [4, 3, 3, 2, 2, 1, 1, 0]},
        {"id": "silver-wallet-outlet", "title": "Silver Wallet Lake Outlet", "source": "silver-wallet-lake", "destination": "south-coast-sea", "path": lake_outlet, "elevationProfile": [0, 0, 0, 0, 0, 0, 0]},
    ]
    for waterway in waterways:
        stream_cells = paint_path(terrain, waterway["path"], "W", radius=1)
        set_cells(biome, stream_cells, "L")
        set_cells(nav, stream_cells, "#")
        expanded = expand_path(waterway["path"])
        for index, (x, y) in enumerate(expanded):
            if waterway["id"] == "silver-wallet-outlet":
                level = 0
            else:
                progress = index / max(1, len(expanded) - 1)
                level = 4 if progress < 0.08 else 3 if progress < 0.28 else 2 if progress < 0.58 else 1 if progress < 0.83 else 0
            for yy in range(y - 1, y + 2):
                for xx in range(x - 1, x + 2):
                    if in_bounds(xx, yy) and terrain[yy][xx] == "W":
                        elevation[yy][xx] = str(level)
        # Lock control points to a monotonically descending sequence for design validation.
        for index, (x, y) in enumerate(waterway["path"]):
            if waterway["id"] == "silver-wallet-outlet":
                elevation[y][x] = "0"
            else:
                elevation[y][x] = str(max(0, 4 - math.ceil(index * 4 / (len(waterway["path"]) - 1))))

    # Southern sea and mud/beach transition. Sea is always blocked for ground actors.
    for x in range(WIDTH):
        coast_y = round(92 - 5 * math.sin((x - 55) / 16)) if x >= 53 else 94
        for y in range(max(0, coast_y - 3), HEIGHT):
            if y < coast_y:
                terrain[y][x] = "B"
                biome[y][x] = "C"
            elif y == coast_y:
                terrain[y][x] = "M"
                biome[y][x] = "C"
                nav[y][x] = "#"
                elevation[y][x] = "0"
            else:
                terrain[y][x] = "O"
                biome[y][x] = "S"
                nav[y][x] = "#"
                elevation[y][x] = "0"

    # Main and optional loops are authored paths. Roads do not overwrite water;
    # explicit bridge footprints below are the only ground crossings.
    main_spine = [(8, 78), (15, 72), (23, 66), (31, 60), (39, 52), (46, 47), (56, 45), (66, 49), (73, 52), (81, 44), (87, 35), (93, 39)]
    north_loop = [(24, 65), (20, 57), (18, 48), (20, 38), (27, 29), (38, 20), (48, 29), (54, 42), (57, 45)]
    south_loop = [(29, 62), (34, 70), (40, 77), (50, 80), (60, 77), (69, 76), (79, 82), (86, 75), (82, 62), (73, 52)]
    coastal_path = [(70, 76), (76, 80), (82, 82), (88, 78), (91, 70)]
    frontier_town_east_west = [(65, 51), (79, 51)]
    frontier_town_north_south = [(72, 43), (72, 59)]

    road_specs = [
        (main_spine, "A", "M", 2),
        (north_loop, "D", "N", 1),
        (south_loop, "D", "S", 1),
        (coastal_path, "D", "S", 1),
    ]
    for path, surface, route_code, radius in road_specs:
        route_cells = paint_path(route, path, route_code, radius=radius)
        for x, y in route_cells:
            if terrain[y][x] not in {"W", "O", "M", "X"}:
                terrain[y][x] = surface
                nav[y][x] = "."

    # Ghost town and normal town road/plaza systems.
    paint_rect(biome, 16, 57, 33, 72, "G")
    paint_rect(terrain, 18, 60, 31, 69, "D")
    paint_rect(terrain, 19, 63, 31, 67, "C")
    paint_rect(nav, 18, 60, 31, 69, ".")
    paint_rect(route, 19, 63, 31, 67, "T")
    paint_rect(biome, 62, 40, 82, 61, "T")
    paint_rect(terrain, 64, 44, 80, 58, "g")
    paint_rect(terrain, 65, 49, 79, 53, "A")
    paint_rect(terrain, 70, 43, 74, 59, "A")
    paint_rect(terrain, 66, 50, 74, 56, "C")
    paint_rect(nav, 64, 44, 80, 58, ".")
    paint_rect(route, 65, 49, 79, 53, "T")
    paint_rect(route, 70, 43, 74, 59, "T")

    # Farm plots remain traversable but costlier for ground navigation at runtime.
    for rect in [(53, 72, 60, 78), (62, 68, 69, 74), (70, 72, 77, 78), (59, 81, 67, 86)]:
        paint_rect(terrain, *rect, "f")
        paint_rect(biome, *rect, "A")
        paint_rect(nav, *rect, "~")

    bridges = [
        {"id": "pine-creek-wood-bridge", "x": 35, "y": 39, "surface": "H", "route": "N", "kind": "wood"},
        {"id": "west-river-main-bridge", "x": 39, "y": 52, "surface": "Q", "route": "M", "kind": "stone-road"},
        {"id": "east-river-main-bridge", "x": 52, "y": 46, "surface": "Q", "route": "M", "kind": "stone-road"},
        {"id": "lake-outlet-farm-bridge", "x": 68, "y": 75, "surface": "H", "route": "S", "kind": "wood"},
    ]
    for bridge in bridges:
        x, y = bridge["x"], bridge["y"]
        paint_rect(terrain, x - 2, y - 2, x + 2, y + 2, bridge["surface"])
        paint_rect(nav, x - 2, y - 2, x + 2, y + 2, ".")
        paint_rect(route, x - 2, y - 2, x + 2, y + 2, "B")
        paint_rect(elevation, x - 2, y - 2, x + 2, y + 2, "1")

    # A single optional ford is slow but traversable; all ordinary water remains blocked.
    paint_rect(terrain, 55, 58, 57, 60, "w")
    paint_rect(nav, 55, 58, 57, 60, "~")
    paint_rect(elevation, 55, 58, 57, 60, "0")

    points_of_interest = [
        {"id": "ghost-saloon-square", "title": "Ghost Saloon Square", "x": 24, "y": 65, "biome": "ghost-town", "encounterRole": "optional-miniboss", "arenaRadius": 6, "reward": "weapon-or-shield", "landmark": "saloon, water tower, false-front storefronts"},
        {"id": "dry-forest-cave", "title": "Dry Forest Cave", "x": 20, "y": 38, "biome": "dry-forest", "encounterRole": "optional-miniboss", "arenaRadius": 5, "reward": "xp-luck-or-summon", "landmark": "dark cave mouth beneath old pine wall"},
        {"id": "mesa-overlook", "title": "Mesa Overlook", "x": 38, "y": 20, "biome": "mountain", "encounterRole": "exploration-landmark", "arenaRadius": 5, "reward": "range-or-pierce", "landmark": "switchback ridge and Litecoin City sightline"},
        {"id": "old-hashrate-camp", "title": "Old Hashrate Camp", "x": 40, "y": 77, "biome": "desert", "encounterRole": "swarm-arena", "arenaRadius": 7, "reward": "drone-or-orbital", "landmark": "half-buried mining rigs and dragon bones"},
        {"id": "oasis-lakeside", "title": "Silver Wallet Lakeside", "x": 60, "y": 65, "biome": "lake", "encounterRole": "exploration-landmark", "arenaRadius": 5, "reward": "regen-or-health", "landmark": "reeds, ruined wallet shrine, shallow ford"},
        {"id": "crossroads-trading-post", "title": "Crossroads Trading Post", "x": 58, "y": 45, "biome": "plains", "encounterRole": "exploration-landmark", "arenaRadius": 5, "reward": "reroll-economy", "landmark": "wagon circle, signpost, lantern string"},
        {"id": "frontier-town-square", "title": "Frontier Town Square", "x": 71, "y": 52, "biome": "town", "encounterRole": "swarm-arena", "arenaRadius": 6, "reward": "coin-or-upgrade", "landmark": "courthouse clock, diner, gas canopy"},
        {"id": "wrecked-lighthouse", "title": "Wrecked Litecoin Lighthouse", "x": 82, "y": 82, "biome": "coast", "encounterRole": "optional-miniboss", "arenaRadius": 6, "reward": "mobility-or-luck", "landmark": "leaning lighthouse and shipwreck ribs"},
        {"id": "rugpull-gulch-boss-yard", "title": "Rugpull Gulch Boss Yard", "x": 87, "y": 35, "biome": "city-threshold", "encounterRole": "boss-arena", "arenaRadius": 8, "reward": "level-clear-rare-draft", "landmark": "ruined vault facade and backlit scam billboard"},
    ]
    encounter_codes = {
        "ghost-saloon-square": "G", "dry-forest-cave": "F", "mesa-overlook": "M",
        "old-hashrate-camp": "D", "oasis-lakeside": "L", "crossroads-trading-post": "R",
        "frontier-town-square": "T", "wrecked-lighthouse": "C", "rugpull-gulch-boss-yard": "B",
    }
    for poi in points_of_interest:
        paint_ellipse(encounter, poi["x"], poi["y"], poi["arenaRadius"], poi["arenaRadius"], encounter_codes[poi["id"]])
        # Arena centers are always dry/passable even when adjacent terrain is hazardous.
        if terrain[poi["y"]][poi["x"]] in {"W", "O", "M", "X"}:
            terrain[poi["y"]][poi["x"]] = "D"
        nav[poi["y"]][poi["x"]] = "."

    # Boss yard and extraction road get explicit clean negative space.
    paint_ellipse(terrain, 87, 35, 8, 7, "D")
    paint_ellipse(nav, 87, 35, 8, 7, ".")
    paint_ellipse(encounter, 87, 35, 8, 7, "B")
    paint_path(terrain, [(87, 35), (93, 39)], "A", radius=2, skip={"W", "O", "X"})
    paint_path(nav, [(87, 35), (93, 39)], ".", radius=2)
    paint_path(route, [(87, 35), (93, 39)], "M", radius=2)

    # Mountains/cliffs and all four map edges become diegetic hard boundaries.
    for x in range(WIDTH):
        terrain[0][x] = "X"
        biome[0][x] = "M"
        elevation[0][x] = "4"
        nav[0][x] = "#"
        terrain[99][x] = "O" if x >= 48 else "X"
        biome[99][x] = "S" if x >= 48 else "M"
        elevation[99][x] = "0" if x >= 48 else "2"
        nav[99][x] = "#"
    for y in range(HEIGHT):
        terrain[y][0] = "F" if y < 62 else "X"
        biome[y][0] = "F" if y < 62 else "M"
        nav[y][0] = "#"
        terrain[y][99] = "X" if y < 70 else "O"
        biome[y][99] = "M" if y < 70 else "S"
        nav[y][99] = "#"

    # Interior mountain cliff blockers create short cat-and-mouse lanes without
    # enclosing the critical path.
    cliff_lines = [
        [(4, 14), (12, 12), (18, 15)],
        [(30, 11), (38, 14), (45, 11)],
        [(72, 10), (80, 13), (90, 11)],
        [(31, 31), (35, 35), (34, 40)],
        [(7, 84), (16, 87), (24, 85)],
    ]
    for line in cliff_lines:
        cells = paint_path(terrain, line, "X", radius=1)
        set_cells(nav, cells, "#")
        set_cells(biome, cells, "M")

    # Declared crossings are gameplay contracts. Reapply them after cliff and
    # perimeter painting so later barrier passes can never silently bury a bridge.
    for bridge in bridges:
        x, y = bridge["x"], bridge["y"]
        paint_rect(terrain, x - 2, y - 2, x + 2, y + 2, bridge["surface"])
        paint_rect(nav, x - 2, y - 2, x + 2, y + 2, ".")
        paint_rect(route, x - 2, y - 2, x + 2, y + 2, "B")
        paint_rect(elevation, x - 2, y - 2, x + 2, y + 2, "1")

    # Ensure critical anchors remain connected after terrain blockers are laid.
    critical_path = [
        {"id": "broken-road-spawn", "title": "Broken Road Spawn", "x": 8, "y": 78, "beat": "orientation-rest"},
        {"id": "ghost-saloon-mainstreet", "title": "Ghost Saloon Main Street", "x": 24, "y": 65, "beat": "first-pressure"},
        {"id": "twin-river-bridges", "title": "Twin River Bridges", "x": 46, "y": 47, "beat": "navigation-test"},
        {"id": "crossroads-trading-post", "title": "Crossroads Trading Post", "x": 58, "y": 45, "beat": "branch-rest"},
        {"id": "frontier-town-square", "title": "Frontier Town Square", "x": 71, "y": 52, "beat": "swarm-pressure"},
        {"id": "rugpull-gulch-boss-yard", "title": "Rugpull Gulch Boss Yard", "x": 87, "y": 35, "beat": "final-boss"},
        {"id": "litecoin-city-threshold", "title": "Litecoin City Threshold", "x": 93, "y": 39, "beat": "extraction-rest"},
    ]
    for anchor in critical_path:
        nav[anchor["y"]][anchor["x"]] = "."

    layers = {"terrain": terrain, "biome": biome, "elevation": elevation, "groundNav": nav, "route": route, "encounter": encounter}
    metadata = {
        "waterways": waterways,
        "bridges": bridges,
        "pointsOfInterest": points_of_interest,
        "criticalPath": critical_path,
        "paths": {"mainSpine": main_spine, "northAdventureLoop": north_loop, "southAdventureLoop": south_loop, "coastalSpur": coastal_path},
        "routePresentation": [
            {"id": "main-spine", "routeCode": "M", "style": "asphalt", "radius": 2, "controlPoints": main_spine},
            {"id": "north-adventure-loop", "routeCode": "N", "style": "dirt", "radius": 1, "controlPoints": north_loop},
            {"id": "south-adventure-loop", "routeCode": "S", "style": "dirt", "radius": 1, "controlPoints": south_loop},
            {"id": "coastal-spur", "routeCode": "S", "style": "dirt", "radius": 1, "controlPoints": coastal_path},
            {"id": "frontier-town-east-west", "routeCode": "T", "style": "asphalt", "radius": 2, "controlPoints": frontier_town_east_west},
            {"id": "frontier-town-north-south", "routeCode": "T", "style": "asphalt", "radius": 2, "controlPoints": frontier_town_north_south},
        ],
    }
    return layers, metadata


def build_blueprint(layers: dict[str, list[list[str]]], metadata: dict) -> dict:
    spawn = {"id": "broken-road-spawn", "x": 8, "y": 78}
    final_boss = {"id": "rugpull-gulch-boss-yard", "x": 87, "y": 35}
    extraction = {"id": "litecoin-city-threshold", "x": 93, "y": 39}
    reached = reachable(layers["groundNav"], (spawn["x"], spawn["y"]))
    required = [*metadata["criticalPath"], *metadata["pointsOfInterest"], final_boss, extraction]
    unreachable = [item["id"] for item in required if (item["x"], item["y"]) not in reached]
    if unreachable:
        raise RuntimeError(f"Blueprint has unreachable anchors: {unreachable}")

    layer_contract = {
        "terrain": {"encoding": "one-character terrain family code", "rows": layer_rows(layers["terrain"])},
        "biome": {"encoding": "one-character biome code", "rows": layer_rows(layers["biome"])},
        "elevation": {"encoding": "integer elevation band 0-4", "rows": layer_rows(layers["elevation"])},
        "groundNav": {"encoding": ". normal, ~ slow, # blocked", "rows": layer_rows(layers["groundNav"])},
        "route": {"encoding": ". none, M main spine, N north loop, S south loop, T town street, B bridge", "rows": layer_rows(layers["route"])},
        "encounter": {"encoding": ". none; named encounter-zone code", "rows": layer_rows(layers["encounter"])},
    }
    metrics = {
        "terrainCounts": dict(sorted(Counter("".join(layer_contract["terrain"]["rows"])).items())),
        "biomeCounts": dict(sorted(Counter("".join(layer_contract["biome"]["rows"])).items())),
        "groundNavCounts": dict(sorted(Counter("".join(layer_contract["groundNav"]["rows"])).items())),
        "reachableGroundCellsFromSpawn": len(reached),
        "criticalPathAnchors": len(metadata["criticalPath"]),
        "pointsOfInterest": len(metadata["pointsOfInterest"]),
        "bridges": len(metadata["bridges"]),
    }
    return {
        "id": "hmh-level-1-world-blueprint-v3",
        "version": 3,
        "status": "approved-for-live-runtime-integration",
        "levelId": "level-1-crypto-wasteland",
        "title": "Level 1 - Crypto Wasteland World Blueprint v3",
        "dimensions": {"width": WIDTH, "height": HEIGHT, "cellCount": WIDTH * HEIGHT},
        "projection": {"kind": "isometric-2-to-1", "tileWidth": 64, "tileHeight": 32},
        "coordinateSystem": {"origin": "northwest", "xAxis": "east", "yAxis": "south", "runtimeConversion": "subtract authored spawn (8,78), making the live player spawn world (0,0)"},
        "designIntent": "A compact handcrafted adventure map with a readable critical spine, two optional loops, natural downhill hydrology, strong landmarks, broad swarm arenas, short cat-and-mouse chokepoints, and diegetic borders.",
        "canonReconciliation": {
            "preserve": ["level-1-crypto-wasteland", "lester-blaster", "Rug Pull Baron final boss", "Litecoin City as Level 2 destination", "deterministic seed behavior"],
            "replaceInRuntime": ["263x225 world dimensions", "coarse district-cell terrain placement", "random-looking ground scatter"],
            "activationGates": ["runtime adapter tests", "collision and reachability tests", "seam certification", "visual regression acceptance", "production smoke verification"],
        },
        "anchors": {"spawn": spawn, "finalBoss": final_boss, "extraction": extraction},
        "criticalPath": metadata["criticalPath"],
        "adventureLoops": [
            {"id": "north-adventure-loop", "title": "Pine Shadow and Mesa Loop", "path": metadata["paths"]["northAdventureLoop"], "risk": "tight forest ambushes and ridge ranged pressure", "rejoin": "crossroads-trading-post"},
            {"id": "south-adventure-loop", "title": "Hashrate, Farm, and Coast Loop", "path": metadata["paths"]["southAdventureLoop"], "risk": "open swarm fields, outlet chokepoint, and coastal mini-boss", "rejoin": "frontier-town-square"},
        ],
        "routePresentation": {
            "authority": "visual-only; collision and traversal remain authored layer contracts",
            "centerlineModel": "expanded authored control points with merged eight-direction junctions",
            "paths": metadata["routePresentation"],
        },
        "pointsOfInterest": metadata["pointsOfInterest"],
        "hydrology": {
            "model": "two mountain tributaries feed Silver Wallet Lake; one outlet descends through farms and coast into the southern sea",
            "deepWaterBlocksGroundActors": True,
            "authoredFordsAreSlow": True,
            "waterways": metadata["waterways"],
            "bridges": metadata["bridges"],
        },
        "navigation": {
            "movementClasses": {
                "ground": {"passableCodes": [".", "~"], "blockedCode": "#", "slowCode": "~"},
                "air": {"ignoresGroundCollision": True, "stillRespectsWorldPerimeter": True},
            },
            "widthRules": {"mainSpineTiles": 5, "secondaryLoopTiles": 3, "shortChokepointTiles": 2, "bossArenaDiameterTiles": 16},
            "collisionSource": "blueprint metadata, never image pixels",
            "collisionContract": {
                "sourceOfTruth": "authored-blueprint-metadata",
                "neverInferFromImagePixels": True,
                "layers": ["baseTerrain", "edgeBarriers", "propFootprints", "structureFootprints", "bridgeDecks", "hazards"],
                "edgeBarrierBits": {"north": 1, "east": 2, "south": 4, "west": 8},
                "terrainPolicies": {
                    "normalGround": {"ground": "passable", "air": "passable", "movementCost": 1.0},
                    "slowGround": {"ground": "slow", "air": "passable", "movementCost": 1.5},
                    "deepWater": {"ground": "blocked", "air": "passable", "movementCost": None},
                    "ford": {"ground": "slow", "air": "passable", "movementCost": 1.75},
                    "bridgeDeck": {"ground": "passable", "air": "passable", "movementCost": 1.0, "overridesWaterOnlyInsideFootprint": True},
                    "cliff": {"ground": "blocked", "air": "passable", "movementCost": None},
                    "worldPerimeter": {"ground": "blocked", "air": "blocked", "movementCost": None},
                },
                "structurePolicy": {
                    "everySolidPropRequiresFootprint": True,
                    "supportedShapes": ["circle", "rectangle", "capsule", "polygon"],
                    "anchor": "bottom-center-ground-contact",
                    "visualBoundsSeparateFromCollision": True,
                    "trees": "trunk footprint blocks; canopy is overhang/occlusion only",
                    "rocks": "authored polygon or capsule footprint",
                    "buildings": "multi-cell footprint plus door and route sockets",
                    "mountains": "blocked plateau/cliff polygons plus explicit slope openings",
                },
                "actorPolicies": {
                    "player": "swept-circle collision against blocked terrain, edge barriers, and solid footprints",
                    "groundEnemy": "grid/flow-field navigation plus local footprint avoidance and swept collision",
                    "airEnemy": "ignores ground/water/prop footprints but respects world perimeter and explicit air blockers",
                    "projectile": "separate projectile-blocking and line-of-sight masks",
                },
                "debugViews": ["walkable-cells", "movement-cost", "edge-barriers", "collision-footprints", "bridge-overrides", "enemy-route", "projectile-blockers"],
                "validation": [
                    "ground-enemies-cannot-cross-deep-water",
                    "air-enemies-can-cross-water",
                    "every-bridge-connects-two-reachable-ground-banks",
                    "no-walkable-cell-inside-solid-footprint",
                    "no-road-connector-terminates-in-blocked-terrain",
                    "all-critical-and-optional-anchors-reachable",
                    "swept-player-collision-cannot-tunnel-through-thin-barriers",
                    "enemy-routes-do-not-cut-cliff-corners",
                    "projectile-and-line-of-sight-masks-match-authored-material-policy",
                ],
            },
        },
        "pacing": {
            "targetActDurationSeconds": 390,
            "beats": [
                "0:00-0:35 spawn orientation and first road choice",
                "0:35-1:25 ghost-town pressure knot",
                "1:25-2:35 north or south adventure-loop commitment",
                "2:35-3:45 crossroads rest, draft, and optional mini-boss resolution",
                "3:45-5:15 frontier-town swarm escalation",
                "5:15-6:30 Rugpull Gulch approach and boss",
            ],
            "activationRule": "All arenas exist physically; one optional mini-boss route is promoted per run while other arenas host elites, events, or rewards.",
        },
        "layers": layer_contract,
        "artGrammar": {
            "strategy": "reusable-edge-aware-families-plus-authored-landmark-chunks",
            "terrainFamilies": TERRAIN_FAMILIES,
            "adjacency": "Each tile-context row records north/east/south/west terrain; runtime art selects edge and corner variants from a Wang-style mask.",
            "sourceCanvas": "square transparent source containing a centered 2:1 isometric diamond; normalize to 64x32 logical footprint",
            "pixelStyle": "high-detail 16-bit arcade pixel art, controlled palette, crisp clusters, no painterly blur, no text, consistent northwest key light",
            "landmarkChunkSizes": ["4x4", "8x8", "12x12", "16x16"],
            "seamContract": {
                "independentPerCellGeneration": False,
                "logicalDiamond": {"width": 64, "height": 32},
                "sourceSupertileGrids": ["4x4", "6x6"],
                "connectivityMasks": ["NESW-4-bit", "47-tile-blob", "Wang-edge-and-corner"],
                "pathMaskBits": {"north": 1, "east": 2, "south": 4, "west": 8},
                "layers": ["ground", "transition", "water", "elevation", "shadow", "structure", "overhang", "decal"],
                "atlasGutterPixels": 4,
                "edgeExtrusionPixels": 4,
                "sampling": "nearest-neighbor-only",
                "landmarkOuterSafetyRingCells": 1,
                "buildingPolicy": "Buildings are multi-cell structure/overhang chunks with explicit footprints and bottom-center anchors; never crop them into unrelated ground tiles.",
                "mountainPolicy": "Mountain ground, cliff faces, caps, and overhangs are separate connected layers; cliff connectors declare continuation across chunk boundaries.",
                "generationPolicy": "Generate connected supertile concepts and material masters; deterministic masks own final topology and seams.",
                "certification": ["all-16-NESW-path-neighborhoods", "47-blob-transition-contact-sheet", "5x5-random-neighborhood-seam-render", "edge-pixel-and-alpha-gutter-audit", "multi-cell-anchor-and-footprint-audit"],
            },
        },
        "approvalGate": {
            "generateBeforeApproval": ["sample-terrain-river-road-transition", "sample-landmark-ghost-saloon-arena"],
            "seamFollowupSamples": ["sample-connected-road-river-neighborhood", "sample-cliff-path-supertile"],
            "generateRemainingAfterApproval": True,
            "stopCondition": "User approves map plan, palette, pixel density, projection, lighting, and edge-connectivity quality.",
        },
        "metrics": metrics,
    }


def write_tile_contexts(blueprint: dict) -> None:
    layer_rows_by_name = {name: contract["rows"] for name, contract in blueprint["layers"].items()}
    fieldnames = [
        "x", "y", "terrain", "terrainId", "biome", "elevation", "groundNav", "route", "encounter",
        "northTerrain", "eastTerrain", "southTerrain", "westTerrain", "promptFamilyId",
    ]
    with TILE_CONTEXT_PATH.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for y in range(HEIGHT):
            for x in range(WIDTH):
                code = layer_rows_by_name["terrain"][y][x]
                family = TERRAIN_BY_CODE[code]
                neighbor = lambda nx, ny: layer_rows_by_name["terrain"][ny][nx] if in_bounds(nx, ny) else "VOID"
                writer.writerow({
                    "x": x, "y": y, "terrain": code, "terrainId": family["id"],
                    "biome": layer_rows_by_name["biome"][y][x], "elevation": layer_rows_by_name["elevation"][y][x],
                    "groundNav": layer_rows_by_name["groundNav"][y][x], "route": layer_rows_by_name["route"][y][x],
                    "encounter": layer_rows_by_name["encounter"][y][x],
                    "northTerrain": neighbor(x, y - 1), "eastTerrain": neighbor(x + 1, y),
                    "southTerrain": neighbor(x, y + 1), "westTerrain": neighbor(x - 1, y),
                    "promptFamilyId": family["promptFamilyId"],
                })


def draw_topdown(
    rows: list[str],
    colors: dict[str, str],
    title: str,
    labels: list[dict] | None = None,
    markers: list[dict] | None = None,
) -> Image.Image:
    cell = 8
    header = 52
    image = Image.new("RGB", (WIDTH * cell, HEIGHT * cell + header), "#10151d")
    draw = ImageDraw.Draw(image)
    for y, row in enumerate(rows):
        for x, code in enumerate(row):
            color = colors.get(code, "#ff00ff")
            draw.rectangle((x * cell, header + y * cell, (x + 1) * cell - 1, header + (y + 1) * cell - 1), fill=color)
    draw.text((16, 13), title, font=label_font(20), fill="#f3e6bd")
    draw.text((16, 35), "100 x 100 authored logical cells | north is up", font=label_font(11), fill="#9fb5c5")
    # North arrow and map-edge cue.
    draw.line((760, 41, 760, 12), fill="#f3e6bd", width=3)
    draw.polygon([(760, 8), (754, 18), (766, 18)], fill="#f3e6bd")
    draw.text((747, 30), "N", font=label_font(12), fill="#f3e6bd")

    if markers:
        marker_font = label_font(9)
        for index, item in enumerate(markers, 1):
            px = item["x"] * cell
            py = header + item["y"] * cell
            draw.polygon([(px, py - 7), (px + 7, py), (px, py + 7), (px - 7, py)], fill="#55d6e8", outline="#071319")
            draw.text((px + 8, py - 7), f"B{index}", font=marker_font, fill="#071319", stroke_width=2, stroke_fill="#d8fbff")

    if labels:
        font = label_font(10)
        offsets = {
            "broken-road-spawn": (8, -20),
            "ghost-saloon-square": (-12, -24),
            "dry-forest-cave": (10, 8),
            "mesa-overlook": (10, -22),
            "old-hashrate-camp": (-14, 10),
            "oasis-lakeside": (12, 10),
            "crossroads-trading-post": (12, -28),
            "frontier-town-square": (12, 12),
            "wrecked-lighthouse": (-150, -26),
            "rugpull-gulch-boss-yard": (-178, -28),
            "litecoin-city-threshold": (-118, 10),
        }
        for item in labels:
            px = item["x"] * cell
            py = header + item["y"] * cell
            dx, dy = offsets.get(item.get("id"), (8, -18))
            text = item["title"]
            bbox = draw.textbbox((0, 0), text, font=font)
            text_w = bbox[2] - bbox[0]
            text_h = bbox[3] - bbox[1]
            tx = max(4, min(image.width - text_w - 10, px + dx))
            ty = max(header + 3, min(image.height - text_h - 8, py + dy))
            draw.line((px, py, tx, ty + text_h // 2), fill="#ffdf5a", width=1)
            draw.rounded_rectangle((tx - 4, ty - 3, tx + text_w + 4, ty + text_h + 3), radius=3, fill="#10151de6", outline="#6c7782")
            draw.ellipse((px - 5, py - 5, px + 5, py + 5), fill="#ffdf5a", outline="#111111", width=2)
            draw.text((tx, ty), text, font=font, fill="#ffffff")
    return image


def draw_isometric(rows: list[str], labels: list[dict]) -> Image.Image:
    tile_w, tile_h = 8, 4
    margin = 38
    width = (WIDTH + HEIGHT) * tile_w // 2 + margin * 2
    height = (WIDTH + HEIGHT) * tile_h // 2 + margin * 2 + 40
    image = Image.new("RGB", (width, height), "#10151d")
    draw = ImageDraw.Draw(image)
    center_x = width // 2
    for y in range(HEIGHT):
        for x in range(WIDTH):
            sx = center_x + (x - y) * tile_w // 2
            sy = margin + (x + y) * tile_h // 2
            color = TERRAIN_COLORS.get(rows[y][x], "#ff00ff")
            diamond = [(sx, sy), (sx + tile_w // 2, sy + tile_h // 2), (sx, sy + tile_h), (sx - tile_w // 2, sy + tile_h // 2)]
            draw.polygon(diamond, fill=color)
    draw.text((14, 10), "Level 1 World Blueprint v3 - Isometric Terrain Preview", font=label_font(18), fill="#f3e6bd")
    font = label_font(9)
    for item in labels:
        sx = center_x + (item["x"] - item["y"]) * tile_w // 2
        sy = margin + (item["x"] + item["y"]) * tile_h // 2
        draw.ellipse((sx - 3, sy - 3, sx + 3, sy + 3), fill="#ffdf5a")
        draw.text((sx + 5, sy - 5), item["title"], font=font, fill="#ffffff", stroke_width=2, stroke_fill="#10151d")
    return image


def write_visuals(blueprint: dict) -> None:
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    labels = [
        *blueprint["pointsOfInterest"],
        {**blueprint["anchors"]["spawn"], "title": "Spawn"},
        {**blueprint["anchors"]["extraction"], "title": "Extraction"},
    ]
    bridges = blueprint["hydrology"]["bridges"]
    terrain = draw_topdown(blueprint["layers"]["terrain"]["rows"], TERRAIN_COLORS, "Terrain, Routes, Hydrology, and POIs", labels, bridges)
    biome = draw_topdown(blueprint["layers"]["biome"]["rows"], BIOME_COLORS, "Biome Envelopes", labels)
    nav_colors = {".": "#77b86c", "~": "#d4b65e", "#": "#272c35"}
    nav = draw_topdown(blueprint["layers"]["groundNav"]["rows"], nav_colors, "Ground Navigation: Green Passable, Gold Slow, Dark Blocked", labels)
    route_colors = {".": "#202630", "M": "#f0c857", "N": "#6fc0a9", "S": "#e58b5b", "T": "#a8a7b4", "B": "#5bd2e5"}
    routes = draw_topdown(blueprint["layers"]["route"]["rows"], route_colors, "Critical Spine, Adventure Loops, Town Streets, and Bridges", labels, bridges)
    encounter_colors = {".": "#202630", "G": "#bd744c", "F": "#4e9a64", "M": "#8e93a1", "D": "#d5a050", "L": "#53a4bc", "R": "#d8c766", "T": "#7489b0", "C": "#d9897a", "B": "#bc5dda"}
    encounters = draw_topdown(blueprint["layers"]["encounter"]["rows"], encounter_colors, "Encounter and Landmark Zones", labels)
    hydrology_labels = [
        {"id": "northwest-source", "title": "NW Spring", "x": 19, "y": 3},
        {"id": "northeast-source", "title": "NE Spring", "x": 67, "y": 3},
        {"id": "silver-wallet-lake", "title": "Silver Wallet Lake", "x": 49, "y": 64},
        {"id": "south-coast-sea", "title": "Outlet to Sea", "x": 88, "y": 92},
    ]
    hydrology = draw_topdown(blueprint["layers"]["terrain"]["rows"], TERRAIN_COLORS, "Hydrology: Mountain Springs to Lake to Southern Sea", hydrology_labels, bridges)
    iso = draw_isometric(blueprint["layers"]["terrain"]["rows"], labels)
    outputs = {
        "terrain-map.png": terrain,
        "biome-map.png": biome,
        "navigation-map.png": nav,
        "route-map.png": routes,
        "encounter-map.png": encounters,
        "hydrology-map.png": hydrology,
        "isometric-preview.png": iso,
    }
    for name, image in outputs.items():
        image.save(ASSET_DIR / name, optimize=True)

    thumb_w, thumb_h = 500, 535
    contact_rows = math.ceil(len(outputs) / 2)
    contact = Image.new("RGB", (thumb_w * 2, thumb_h * contact_rows), "#0b0f15")
    for index, (name, image) in enumerate(outputs.items()):
        thumb = image.copy()
        thumb.thumbnail((thumb_w - 16, thumb_h - 16), Image.Resampling.LANCZOS)
        x = (index % 2) * thumb_w + (thumb_w - thumb.width) // 2
        y = (index // 2) * thumb_h + (thumb_h - thumb.height) // 2
        contact.paste(thumb, (x, y))
    contact.save(ASSET_DIR / "blueprint-contact-sheet.png", optimize=True)


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    layers, metadata = build_layers()
    blueprint = build_blueprint(layers, metadata)
    BLUEPRINT_PATH.write_text(json.dumps(blueprint, indent=2) + "\n", encoding="utf-8")
    write_tile_contexts(blueprint)
    write_visuals(blueprint)
    print(json.dumps({
        "blueprint": str(BLUEPRINT_PATH),
        "tileContexts": str(TILE_CONTEXT_PATH),
        "visuals": str(ASSET_DIR),
        "metrics": blueprint["metrics"],
    }, indent=2))


if __name__ == "__main__":
    main()

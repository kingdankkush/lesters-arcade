"""Bounded offline triangle membership and export-copy corner equivalence.

Membership is derived only from actual rendered triangle indices. No distance
filter or geometry repair may discard a referenced vertex. The all-point
diagnostic is a separate retained contract, never rewritten by this helper.
"""
import hashlib
import json
import math

POSITION_TOLERANCE_METRES = .0005
UV_TOLERANCE = 1e-7
NORMAL_TOLERANCE = 1e-6
WEIGHT_TOLERANCE = 1e-7


def digest(value):
    return hashlib.sha256(json.dumps(value, separators=(",", ":"), allow_nan=False).encode()).hexdigest()


def finite_vector(value, width):
    if not isinstance(value, (tuple, list)) or len(value) != width or any(
            isinstance(number, bool) or not isinstance(number, (int, float)) or not math.isfinite(number) for number in value):
        raise ValueError("Invalid finite triangle vector")
    return list(value)


def rendered_triangle_record(points, triangles):
    points = [finite_vector(point, 3) for point in points]
    if not points or not triangles:
        raise ValueError("Rendered reference needs actual triangle geometry")
    copied = []
    for triangle in triangles:
        if len(triangle) != 3 or any(type(index) is not int or not 0 <= index < len(points) for index in triangle):
            raise ValueError("Invalid actual rendered triangle indices")
        copied.append(list(triangle))
    membership = sorted({index for triangle in copied for index in triangle})
    excluded = sorted(set(range(len(points))) - set(membership))
    selected = [points[index][:] for index in membership]
    return {"sourceVertexCount": len(points), "triangleCount": len(copied),
            "renderedVertexCount": len(membership), "vertexIds": membership,
            "vertexIdsSha256": digest(membership), "triangleVertexIds": copied,
            "excludedVertexIds": excluded, "points": selected,
            "membershipSha256": digest({"sourceVertexCount": len(points), "vertexIds": membership, "triangles": copied}),
            "geometrySha256": digest({"vertexIds": membership, "points": selected})}


def canonical_corners(triangles):
    if not triangles:
        raise ValueError("No actual triangle corners to compare")
    records = []
    for triangle in triangles:
        if len(triangle) != 3:
            raise ValueError("Corner witness requires triangles")
        copied = []
        for corner in triangle:
            vertex_id = corner["vertexId"]
            if type(vertex_id) is not int or vertex_id < 0:
                raise ValueError("Invalid stable corner vertex identity")
            weights = corner["weights"]
            if len({name for name, _weight in weights}) != len(weights) or any(
                    not isinstance(name, str) or isinstance(weight, bool) or not isinstance(weight, (int, float))
                    or not math.isfinite(weight) or weight < 0 for name, weight in weights):
                raise ValueError("Invalid triangle skin weights")
            copied.append({"vertexId": vertex_id, "position": finite_vector(corner["position"], 3),
                           "uv": finite_vector(corner["uv"], 2), "normal": finite_vector(corner["normal"], 3),
                           "weights": sorted([[name, weight] for name, weight in weights])})
        # Cyclic rotations retain winding. Reversal or a different diagonal
        # must fail even when the union of vertex positions happens to match.
        rotations = [copied[index:] + copied[:index] for index in range(3)]
        records.append(min(rotations, key=lambda corners: tuple(corner["vertexId"] for corner in corners)))
    return sorted(records, key=lambda corners: tuple(corner["vertexId"] for corner in corners))


def assert_triangle_corner_equivalence(before, after):
    before, after = canonical_corners(before), canonical_corners(after)
    if len(before) != len(after):
        raise ValueError("Export triangulation changed actual triangle count")
    maxima = {"position": 0, "uv": 0, "normal": 0, "weights": 0}
    for expected, actual in zip(before, after):
        if [corner["vertexId"] for corner in expected] != [corner["vertexId"] for corner in actual]:
            raise ValueError("Export triangulation changed surface topology or winding")
        for original, current in zip(expected, actual):
            for field in ["position", "uv", "normal"]:
                delta = math.dist(original[field], current[field]) if field == "position" else max(
                    abs(a - b) for a, b in zip(original[field], current[field]))
                maxima[field] = max(maxima[field], delta)
            if [name for name, _weight in original["weights"]] != [name for name, _weight in current["weights"]]:
                raise ValueError("Export triangulation changed skin group identities")
            maxima["weights"] = max(maxima["weights"], max((abs(a[1] - b[1]) for a, b in zip(
                original["weights"], current["weights"])), default=0))
    for field, tolerance in [("position", POSITION_TOLERANCE_METRES), ("uv", UV_TOLERANCE),
                             ("normal", NORMAL_TOLERANCE), ("weights", WEIGHT_TOLERANCE)]:
        if maxima[field] > tolerance:
            raise ValueError("Export triangulation changed " + field + " beyond unchanged corner tolerance")
    return {"triangles": len(before), "beforeCornerSha256": digest(before), "afterCornerSha256": digest(after),
            "maximumPositionDifferenceMetres": maxima["position"], "maximumUvDifference": maxima["uv"],
            "maximumNormalDifference": maxima["normal"], "maximumWeightDifference": maxima["weights"],
            "tolerances": {"positionMetres": POSITION_TOLERANCE_METRES, "uv": UV_TOLERANCE,
                           "normal": NORMAL_TOLERANCE, "weights": WEIGHT_TOLERANCE}}


def plan_exact_triangle_copy(positions, vertex_weights, triangles):
    """Copy actual loop triangles/corners, never choose or repair topology.

    Complete source vertex order (including loose vertices) stays intact.
    UVs/normals belong to loops, whereas named skin weights belong to the
    original vertex IDs. Validate the whole detached plan before mesh writes.
    """
    positions = [finite_vector(point, 3) for point in positions]
    if not positions or len(vertex_weights) != len(positions) or not triangles:
        raise ValueError("Exact triangle copy requires complete original geometry/skin arrays")
    weights = []
    for source_weights in vertex_weights:
        if len({name for name, _weight in source_weights}) != len(source_weights):
            raise ValueError("Duplicate original vertex skin group")
        copied = []
        for name, weight in source_weights:
            if not isinstance(name, str) or not name or isinstance(weight, bool) or not isinstance(weight, (int, float)) \
                    or not math.isfinite(weight) or not 0 <= weight <= 1:
                raise ValueError("Invalid finite named vertex skin weight")
            copied.append([name, weight])
        weights.append(copied)
    faces, uvs, normals, materials, smooth = [], [], [], [], []
    for triangle in triangles:
        corners = triangle["corners"]
        material = triangle["materialIndex"]
        shading = triangle["useSmooth"]
        if len(corners) != 3 or type(material) is not int or material < 0 or type(shading) is not bool:
            raise ValueError("Invalid original triangle/material/shading data")
        face = []
        for corner in corners:
            vertex_id = corner["vertexId"]
            if type(vertex_id) is not int or not 0 <= vertex_id < len(positions):
                raise ValueError("Invalid original triangle vertex identity")
            face.append(vertex_id)
            uvs.append(finite_vector(corner["uv"], 2))
            normals.append(finite_vector(corner["normal"], 3))
        faces.append(face)
        materials.append(material)
        smooth.append(shading)
    return {"positions": positions, "weights": weights, "faces": faces,
            "loopUvs": uvs, "loopNormals": normals, "materialIndices": materials, "useSmooth": smooth}


def triangle_identity_report(before, after):
    """Diagnostic equality only, never an alternative acceptance guard."""
    before, after = canonical_corners(before), canonical_corners(after)

    def id_triangles(records):
        return [tuple(corner["vertexId"] for corner in triangle) for triangle in records]

    def signatures(records, attributes=False, oriented=True):
        values = []
        for triangle in records:
            corners = [{key: corner[key] for key in ["position", "uv", "normal", "weights"]} if attributes
                       else corner["position"] for corner in triangle]
            if oriented:
                rotations = [corners[index:] + corners[:index] for index in range(3)]
                values.append(min(json.dumps(rotation, separators=(",", ":"), allow_nan=False) for rotation in rotations))
            else:
                values.append(json.dumps(sorted(corners), separators=(",", ":"), allow_nan=False))
        return sorted(values)

    def identities(records):
        return sorted({(corner["vertexId"], tuple(corner["position"])) for triangle in records for corner in triangle})

    def positions(records):
        return sorted({tuple(corner["position"]) for triangle in records for corner in triangle})

    before_ids, after_ids = id_triangles(before), id_triangles(after)
    return {"diagnosticOnly": True, "acceptanceGuardUnchanged": True,
            "beforeTriangles": len(before), "afterTriangles": len(after),
            "vertexIdTrianglesEqual": before_ids == after_ids,
            "vertexIdentityPositionsEqual": identities(before) == identities(after),
            "uniqueReferencedPositionsEqual": positions(before) == positions(after),
            "orientedTrianglePositionsEqual": signatures(before) == signatures(after),
            "trianglePositionsIgnoringWindingEqual": signatures(before, oriented=False) == signatures(after, oriented=False),
            "cornerAttributesIgnoringVertexIdsEqual": signatures(before, attributes=True) == signatures(after, attributes=True),
            "firstDifferingVertexIdTriangles": [{"before": list(a), "after": list(b)} for a, b in zip(before_ids, after_ids) if a != b][:3]}

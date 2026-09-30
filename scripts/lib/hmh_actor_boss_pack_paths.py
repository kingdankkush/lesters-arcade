"""Literal, separate Liquidator packed-output ownership before source opening."""
from pathlib import Path


def select_boss_pack_mode(rendered, exact, restored=False, restored02=False):
    if exact and not rendered:
        raise ValueError("Exact costume copy requires the rendered reference")
    if restored and not exact:
        raise ValueError("Restored candidate requires exact rendered custody")
    if restored02 and not restored:
        raise ValueError("Restored02 requires the original restored custody contract")
    return "restored-02-" if restored02 else "restored-" if restored else "exact-" if exact else "rendered-" if rendered else ""


def validate_boss_pack_output(root, mode, output):
    root = Path(root).resolve()
    destinations = {
        "tangent-derived-verify": ".tmp/hmh-actor-3d-pilot/r2b-tangent-01/the-liquidator-tangent-reimport",
        "restored-02-fresh-verify": ".tmp/hmh-actor-3d-pilot/r2b-restored-02/the-liquidator-packed-reimport-complete",
        "restored-02-export": "apps/portal/assets/generated/hmh-actor-3d-pilot/the-liquidator-packed-restored-02.glb",
        "restored-02-receipt": ".tmp/hmh-actor-3d-pilot/r2b-restored-02/the-liquidator-packed-export.json",
        "restored-02-verify": ".tmp/hmh-actor-3d-pilot/r2b-restored-02/the-liquidator-packed-reimport",
        "restored-02-before": ".tmp/hmh-actor-3d-pilot/r2b-restored-02/before-corners.json.gz",
        "restored-02-after": ".tmp/hmh-actor-3d-pilot/r2b-restored-02/after-corners.json.gz",
        "restored-02-plan": ".tmp/hmh-actor-3d-pilot/r2b-restored-02/copy-plan.json.gz",
        "restored-02-rest-bind": ".tmp/hmh-actor-3d-pilot/r2b-restored-02/the-liquidator-packed-rest-bind.json",
        "restored-export": "apps/portal/assets/generated/hmh-actor-3d-pilot/the-liquidator-packed-restored.glb",
        "restored-receipt": ".tmp/hmh-actor-3d-pilot/r2b-restored/the-liquidator-packed-export.json",
        "restored-verify": ".tmp/hmh-actor-3d-pilot/r2b-restored/the-liquidator-packed-reimport",
        "restored-before": ".tmp/hmh-actor-3d-pilot/r2b-restored/before-corners.json.gz",
        "restored-after": ".tmp/hmh-actor-3d-pilot/r2b-restored/after-corners.json.gz",
        "restored-plan": ".tmp/hmh-actor-3d-pilot/r2b-restored/copy-plan.json.gz",
        "restored-rest-bind": ".tmp/hmh-actor-3d-pilot/r2b-restored/the-liquidator-packed-rest-bind.json",
        "export": "apps/portal/assets/generated/hmh-actor-3d-pilot/the-liquidator-packed.glb",
        "receipt": ".tmp/hmh-actor-3d-pilot/the-liquidator-packed-export.json",
        "verify": ".tmp/hmh-actor-3d-pilot/the-liquidator-packed-reimport",
        "rendered-export": "apps/portal/assets/generated/hmh-actor-3d-pilot/the-liquidator-packed-rendered.glb",
        "rendered-receipt": ".tmp/hmh-actor-3d-pilot/r2b-rendered/the-liquidator-packed-export.json",
        "rendered-verify": ".tmp/hmh-actor-3d-pilot/r2b-rendered/the-liquidator-packed-reimport",
        "exact-export": "apps/portal/assets/generated/hmh-actor-3d-pilot/the-liquidator-packed-exact.glb",
        "exact-receipt": ".tmp/hmh-actor-3d-pilot/r2b-exact/the-liquidator-packed-export.json",
        "exact-verify": ".tmp/hmh-actor-3d-pilot/r2b-exact/the-liquidator-packed-reimport",
        "exact-before": ".tmp/hmh-actor-3d-pilot/r2b-exact/before-corners.json.gz",
        "exact-after": ".tmp/hmh-actor-3d-pilot/r2b-exact/after-corners.json.gz",
        "exact-plan": ".tmp/hmh-actor-3d-pilot/r2b-exact/copy-plan.json.gz",
        "exact-topology-receipt": ".tmp/hmh-actor-3d-pilot/r2b-exact-topology/receipt.json",
        "exact-topology-before": ".tmp/hmh-actor-3d-pilot/r2b-exact-topology/before-corners.json.gz",
        "exact-topology-after": ".tmp/hmh-actor-3d-pilot/r2b-exact-topology/after-corners.json.gz",
        "exact-topology-plan": ".tmp/hmh-actor-3d-pilot/r2b-exact-topology/copy-plan.json.gz",
        "exact-topology-legacy-before": ".tmp/hmh-actor-3d-pilot/r2b-exact-topology/legacy-before-corners.json.gz",
        "exact-topology-legacy-after": ".tmp/hmh-actor-3d-pilot/r2b-exact-topology/legacy-after-corners.json.gz",
        "exact-topology-groups-receipt": ".tmp/hmh-actor-3d-pilot/r2b-exact-topology-groups/receipt.json",
        "exact-topology-groups-before": ".tmp/hmh-actor-3d-pilot/r2b-exact-topology-groups/before-corners.json.gz",
        "exact-topology-groups-after": ".tmp/hmh-actor-3d-pilot/r2b-exact-topology-groups/after-corners.json.gz",
        "exact-topology-groups-plan": ".tmp/hmh-actor-3d-pilot/r2b-exact-topology-groups/copy-plan.json.gz",
        "exact-topology-groups-legacy-before": ".tmp/hmh-actor-3d-pilot/r2b-exact-topology-groups/legacy-before-corners.json.gz",
        "exact-topology-groups-legacy-after": ".tmp/hmh-actor-3d-pilot/r2b-exact-topology-groups/legacy-after-corners.json.gz",
        "exact-topology-normals-receipt": ".tmp/hmh-actor-3d-pilot/r2b-exact-topology-normals/receipt.json",
        "exact-topology-normals-before": ".tmp/hmh-actor-3d-pilot/r2b-exact-topology-normals/before-corners.json.gz",
        "exact-topology-normals-after": ".tmp/hmh-actor-3d-pilot/r2b-exact-topology-normals/after-corners.json.gz",
        "exact-topology-normals-plan": ".tmp/hmh-actor-3d-pilot/r2b-exact-topology-normals/copy-plan.json.gz",
        "exact-topology-normals-legacy-before": ".tmp/hmh-actor-3d-pilot/r2b-exact-topology-normals/legacy-before-corners.json.gz",
        "exact-topology-normals-legacy-after": ".tmp/hmh-actor-3d-pilot/r2b-exact-topology-normals/legacy-after-corners.json.gz",
    }
    if mode not in destinations:
        raise ValueError("No approved boss pack output mode")
    expected = root / destinations[mode]
    actual = Path(output).resolve()
    if actual != expected:
        raise ValueError("Output must be the approved separate boss pack destination")
    return actual

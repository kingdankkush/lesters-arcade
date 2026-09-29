"""Pure, source-safe output ownership for the two-actor GLB pilot."""
from pathlib import Path

ACTOR_IDS = ("lit-commando", "bagholder-rusher")


def validate_pilot_output(root, actor_id, mode, output):
    root = Path(root).resolve()
    if actor_id not in ACTOR_IDS or mode not in ("inspect", "export", "verify"):
        raise ValueError("No approved pilot output for actor/mode")
    relative = (f".tmp/hmh-actor-3d-pilot/{actor_id}-inspection.json" if mode == "inspect"
                else f".tmp/hmh-actor-3d-pilot/{actor_id}-reimport" if mode == "verify"
                else f"apps/portal/assets/generated/hmh-actor-3d-pilot/{actor_id}.glb")
    # Compare resolved user output against the literal owned destination. A
    # file/directory symlink pointing at a source cannot satisfy this equality.
    expected = root / relative
    actual = Path(output).resolve()
    if actual != expected:
        raise ValueError("Output must be the approved actor pilot destination")
    return actual

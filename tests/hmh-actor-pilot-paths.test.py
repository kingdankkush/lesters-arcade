"""Pure output-path regression; never opens Blender or a character source."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("pilot_paths", REPO / "scripts/lib/hmh_actor_pilot_paths.py")
paths = importlib.util.module_from_spec(spec) if spec and spec.loader else None
try:
    spec.loader.exec_module(paths)
except FileNotFoundError:
    paths = None


class PilotPathTests(unittest.TestCase):
    def test_approved_paths(self):
        self.assertIsNotNone(paths)
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp).resolve()
            for actor in ["lit-commando", "bagholder-rusher"]:
                for mode, rel in [("inspect", f".tmp/hmh-actor-3d-pilot/{actor}-inspection.json"),
                                  ("verify", f".tmp/hmh-actor-3d-pilot/{actor}-reimport"),
                                  ("export", f"apps/portal/assets/generated/hmh-actor-3d-pilot/{actor}.glb")]:
                    expected = root / rel
                    self.assertEqual(paths.validate_pilot_output(root, actor, mode, expected), expected)

    def test_source_paths_and_wrong_extensions_are_rejected_before_writing(self):
        self.assertIsNotNone(paths)
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp).resolve()
            for mode in ["inspect", "export", "verify"]:
                for rel in ["apps/hmh-reboot/assets/source/models/Commando.blend",
                            "apps/hmh-reboot/assets/source/models/Commando.glb",
                            "apps/portal/assets/generated/hmh-actor-3d-pilot/lit-commando.blend",
                            ".tmp/hmh-actor-3d-pilot/lit-commando.glb",
                            "../outside.glb"]:
                    with self.assertRaisesRegex(ValueError, "approved"):
                        paths.validate_pilot_output(root, "lit-commando", mode, root / rel)

    def test_another_actor_output_is_not_owned(self):
        self.assertIsNotNone(paths)
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp).resolve()
            with self.assertRaisesRegex(ValueError, "approved"):
                paths.validate_pilot_output(root, "lit-commando", "export",
                    root / "apps/portal/assets/generated/hmh-actor-3d-pilot/bagholder-rusher.glb")


if __name__ == "__main__":
    unittest.main()

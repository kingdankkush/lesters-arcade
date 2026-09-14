import os
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from hmh_pipeline_lock import pid_is_alive


class ProcessProbeTests(unittest.TestCase):
    def test_live_owner_query_never_signals_on_windows(self):
        if os.name == 'nt':
            with patch('os.kill', side_effect=AssertionError('Windows liveness query must not send a signal')):
                self.assertTrue(pid_is_alive(os.getpid()))
        else:
            self.assertTrue(pid_is_alive(os.getpid()))

    def test_live_and_exited_child(self):
        options = {'creationflags': subprocess.CREATE_NEW_PROCESS_GROUP} if os.name == 'nt' else {}
        child = subprocess.Popen([sys.executable, '-c', 'input()'], stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, **options)
        try:
            self.assertTrue(pid_is_alive(child.pid))
            self.assertIsNone(child.poll(), 'Checking a lock owner must not stop it')
            child.communicate(b'\n', timeout=5)
            self.assertFalse(pid_is_alive(child.pid))
        finally:
            if child.poll() is None:
                child.communicate(b'\n', timeout=5)

    def test_invalid_owner(self):
        for pid in [-1, 0, 99999999]:
            self.assertFalse(pid_is_alive(pid))


if __name__ == '__main__':
    unittest.main()

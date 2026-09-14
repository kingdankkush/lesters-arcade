from __future__ import annotations

from contextlib import contextmanager
import os
from pathlib import Path
import shutil
import time


def pid_is_alive(pid: int) -> bool:
    if pid <= 0:
        return False
    if os.name == 'nt':
        # os.kill(pid, 0) can deliver CTRL_C_EVENT on Windows. Query the
        # process handle instead; an unreadable owner must retain its lock.
        import ctypes
        from ctypes import wintypes
        kernel = ctypes.WinDLL('kernel32', use_last_error=True)
        kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
        kernel.OpenProcess.restype = wintypes.HANDLE
        kernel.GetExitCodeProcess.argtypes = [wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD)]
        kernel.GetExitCodeProcess.restype = wintypes.BOOL
        kernel.CloseHandle.argtypes = [wintypes.HANDLE]
        kernel.CloseHandle.restype = wintypes.BOOL
        handle = kernel.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
        if not handle:
            return ctypes.get_last_error() != 87  # ERROR_INVALID_PARAMETER: no such PID
        try:
            code = wintypes.DWORD()
            if not kernel.GetExitCodeProcess(handle, ctypes.byref(code)):
                return True
            return code.value == 259  # STILL_ACTIVE
        finally:
            kernel.CloseHandle(handle)
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    except OSError:
        return False
    return True


def _read_owner(lock_dir: Path) -> int | None:
    try:
        return int((lock_dir / "pid").read_text(encoding="utf-8").strip())
    except (FileNotFoundError, ValueError, OSError):
        return None


def _acquire(lock_dir: Path, label: str) -> int:
    owner_pid = os.getpid()
    lock_dir.parent.mkdir(parents=True, exist_ok=True)
    for _ in range(3):
        try:
            lock_dir.mkdir(exist_ok=False)
            (lock_dir / "pid").write_text(f"{owner_pid}\n", encoding="utf-8", newline="\n")
            return owner_pid
        except FileExistsError:
            existing_pid = _read_owner(lock_dir)
            if existing_pid is not None and pid_is_alive(existing_pid):
                raise RuntimeError(f"{label} already running as PID {existing_pid}")
            # A missing PID can be the tiny interval between another process's
            # atomic directory creation and PID publication. Treat a fresh
            # directory as owned rather than deleting a live lock.
            try:
                age_seconds = time.time() - lock_dir.stat().st_mtime
            except FileNotFoundError:
                continue
            if existing_pid is None and age_seconds < 10:
                raise RuntimeError(f"{label} already running as PID pending")
            shutil.rmtree(lock_dir, ignore_errors=True)
    raise RuntimeError(f"Unable to acquire {label} lock at {lock_dir}")


def _release(lock_dir: Path, owner_pid: int) -> None:
    if _read_owner(lock_dir) == owner_pid:
        shutil.rmtree(lock_dir, ignore_errors=True)


@contextmanager
def exclusive_pipeline_lock(lock_dir: Path, label: str):
    owner_pid = _acquire(lock_dir, label)
    try:
        yield
    finally:
        _release(lock_dir, owner_pid)

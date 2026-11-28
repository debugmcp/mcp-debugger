"""A target that holds the interpreter on demand (issue #1325).

Run under debugpy: python -m debugpy --listen 127.0.0.1:<port> busy_target.py

Each line `hold <seconds>` on stdin makes one C call that sleeps for that long
without releasing the GIL (a ctypes.PyDLL call keeps it for the whole call).
While it runs, pydevd's own threads cannot run, so the debug adapter cannot
answer a disconnect until it returns. The length is wall-clock time, so it
does not depend on how fast or how loaded the machine is.

The main thread polls a queue fed by a stdin reader thread rather than
blocking on stdin itself, so it runs Python code every 100 ms and the
post-attach pause lands on it at once.
"""
import ctypes
import queue
import sys
import threading
import time


class _Timespec(ctypes.Structure):
    _fields_ = [('tv_sec', ctypes.c_long), ('tv_nsec', ctypes.c_long)]


def _hold(seconds):
    """Sleep in C for `seconds` with the GIL held."""
    if sys.platform == 'win32':
        sleep = ctypes.PyDLL('kernel32').Sleep
        sleep.argtypes = [ctypes.c_uint32]
        sleep.restype = None
        sleep(int(seconds * 1000))
    else:
        nanosleep = ctypes.PyDLL(None).nanosleep
        nanosleep.argtypes = [ctypes.POINTER(_Timespec), ctypes.c_void_p]
        nanosleep.restype = ctypes.c_int
        whole = int(seconds)
        nanosleep(ctypes.byref(_Timespec(whole, int((seconds - whole) * 1e9))), None)


lines = queue.Queue()


def _read_stdin():
    for line in sys.stdin:
        lines.put(line)


threading.Thread(target=_read_stdin, daemon=True).start()
print('BUSY_TARGET_READY', flush=True)

while True:
    try:
        parts = lines.get(timeout=0.1).split()
    except queue.Empty:
        continue
    if len(parts) == 2 and parts[0] == 'hold':
        print('HOLD_START', flush=True)
        started = time.perf_counter()
        _hold(float(parts[1]))
        print(f'HOLD_END {time.perf_counter() - started:.3f}', flush=True)

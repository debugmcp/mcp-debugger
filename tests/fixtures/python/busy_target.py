"""A target that holds the interpreter until it is told to let go (issue #1325).

Run under debugpy: python -m debugpy --listen 127.0.0.1:<port> busy_target.py

Each line `block <port>` on stdin makes the target connect to 127.0.0.1:<port>
(a listener the test opened) and make one C call, a blocking `recv` of one
byte on that connection, through ctypes.PyDLL, which keeps the GIL for the
whole call. While it blocks, pydevd's own threads cannot run, so the debug
adapter cannot answer a disconnect. The hold ends when the test writes a byte:
the test, not a clock, decides how long it lasts. A receive timeout of
BLOCK_SAFETY_MS on the socket ends it anyway if the test never writes, so a
stalled test cannot hold the target past the 10 s release bound.

`HOLD_START` is printed just before the call, and `HOLD_END <seconds> <why>`
after it, where <why> is `byte` (the test let go), `timeout` (the safety
expired) or `error <code>` (the call failed): a test asserts `byte`, so any
other end fails under its own name.

The main thread polls a queue fed by a stdin reader thread rather than
blocking on stdin itself, so it runs Python code every 100 ms and the
post-attach pause lands on it at once.
"""
import ctypes
import queue
import socket
import struct
import sys
import threading
import time

BLOCK_SAFETY_MS = 8000


def _recv_one_holding_the_gil(sock):
    """recv(1) in C with the GIL held; returns why it returned."""
    buf = ctypes.create_string_buffer(1)
    if sys.platform == 'win32':
        # use_last_error: ctypes saves the thread's last error as the call
        # returns; a WSAGetLastError() call made afterwards can read 0.
        ws2_32 = ctypes.PyDLL('ws2_32', use_last_error=True)
        recv = ws2_32.recv
        # SOCKET is UINT_PTR: pointer-sized.
        recv.argtypes = [ctypes.c_size_t, ctypes.c_void_p, ctypes.c_int, ctypes.c_int]
        recv.restype = ctypes.c_int
        got = recv(sock.fileno(), buf, 1, 0)
        error = 0 if got >= 0 else ctypes.get_last_error()
        timed_out = error == 10060  # WSAETIMEDOUT
    else:
        libc = ctypes.PyDLL(None, use_errno=True)
        recv = libc.recv
        recv.argtypes = [ctypes.c_int, ctypes.c_void_p, ctypes.c_size_t, ctypes.c_int]
        recv.restype = ctypes.c_ssize_t
        got = recv(sock.fileno(), buf, 1, 0)
        error = 0 if got >= 0 else ctypes.get_errno()
        timed_out = error in (11, 35)  # EAGAIN / EWOULDBLOCK (Linux, macOS)
    if got == 1:
        return 'byte'
    if got == 0:
        return 'error closed'
    return 'timeout' if timed_out else 'error %d' % error


def _block(port):
    # A blocking socket: settimeout() would make it non-blocking, and the C
    # recv would return at once. The safety timeout is set on the socket.
    sock = socket.create_connection(('127.0.0.1', port))
    sock.setblocking(True)
    if sys.platform == 'win32':
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_RCVTIMEO, struct.pack('<I', BLOCK_SAFETY_MS))
    else:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_RCVTIMEO,
                        struct.pack('ll', BLOCK_SAFETY_MS // 1000, (BLOCK_SAFETY_MS % 1000) * 1000))
    try:
        print('HOLD_START', flush=True)
        started = time.perf_counter()
        why = _recv_one_holding_the_gil(sock)
        print('HOLD_END %.3f %s' % (time.perf_counter() - started, why), flush=True)
    finally:
        sock.close()


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
    if len(parts) == 2 and parts[0] == 'block':
        _block(int(parts[1]))

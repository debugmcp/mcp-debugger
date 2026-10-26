"""Debuggee that spawns a child with an inherited stderr (issue #993).

For an inherited stderr, `subprocess` duplicates the parent's Win32
STD_ERROR_HANDLE. With the adapter swapped for pythonw.exe the whole chain
ran windowless, and pytest-xdist's workers (the same Popen shape as below,
under a venv) died there with `OSError: [WinError 6] The handle is invalid`.
This file is the CI-runnable shape: the child must complete, and the
interpreter line pins which interpreter the debuggee runs under.
"""
import os
import subprocess
import sys

print("interpreter=" + os.path.basename(sys.executable).lower())

if sys.platform == "win32":
    import ctypes

    kernel32 = ctypes.windll.kernel32
    kernel32.GetStdHandle.restype = ctypes.c_void_p
    kernel32.GetFileType.argtypes = [ctypes.c_void_p]
    # GetFileType: 0 = FILE_TYPE_UNKNOWN (an invalid handle answers this), 2 = char, 3 = pipe.
    for name, which in (("stdin", -10), ("stdout", -11), ("stderr", -12)):
        handle = kernel32.GetStdHandle(which)
        file_type = kernel32.GetFileType(handle)
        print("std %s handle=%s type=%d" % (name, handle, file_type))

child = subprocess.run(
    [sys.executable, "-c", "import sys; print('child ok'); print('child stderr', file=sys.stderr)"],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    text=True,
)
print("child exit %d %s" % (child.returncode, child.stdout.strip()))
sys.exit(child.returncode)

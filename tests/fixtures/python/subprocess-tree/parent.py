"""Debuggee that spawns a Python child the debugger can report (issue #1081).

The session tree's M1 fixture. With sub-process debugging on (the default)
debugpy reports the child this program starts, and the server adopts the
report as a child debug session (`parentSessionId` = this session's id) that
stops on the breakpoints set on this session before launch. The parent pauses
on its own breakpoint while that happens, then waits for the child's exit
code and exits with it, so the whole tree's end is one number.
"""
import os
import subprocess
import sys

print("parent start", flush=True)
child_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), sys.argv[1] if len(sys.argv) > 1 else "child.py")  # argv names another child (child_grand.py)
proc = subprocess.Popen([sys.executable, child_script])
marker = proc.pid  # BREAKPOINT: the parent pauses here while the child is reported and adopted
code = proc.wait()
print("parent child exit %d" % code, flush=True)
sys.exit(code)

"""A child that spawns a grandchild (issue #1081).

The grandchild chain of the session tree's cascade suite: parent.py started
with this script's name as its argument runs it as the child; it stops once
on its own breakpoint, then starts grandchild.py the way the parent started
it, waits for it and exits with its code. debugpy reports the grandchild on
this process's connection, so its session hangs under this one.
"""
import os
import subprocess
import sys

print("child start", flush=True)
marker = 1  # BREAKPOINT
grandchild_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "grandchild.py")
proc = subprocess.Popen([sys.executable, grandchild_script])
code = proc.wait()
print("child grandchild exit %d" % code, flush=True)
sys.exit(code)

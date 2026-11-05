"""A parent that exits with its child still running (issue #1081).

The #993 pipe shape of the session tree's cascade suite (design, lifecycle
table row 2): the child inherits this process's stdout, so the launcher holds
the parent's exit until the child's own end, and the parent's session stays
running while its wait_for_stop reports the child.
"""
import os
import subprocess
import sys

print("parent start", flush=True)
child_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "child.py")
subprocess.Popen([sys.executable, child_script])
print("parent exiting", flush=True)
sys.exit(0)

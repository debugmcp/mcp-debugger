"""A parent with two children at once (issue #1081).

The siblings case of the session tree's cascade suite: closing one child
ends that process alone; the other child and this parent go on.
"""
import os
import subprocess
import sys

print("parent start", flush=True)
child_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "child.py")
first = subprocess.Popen([sys.executable, child_script])
second = subprocess.Popen([sys.executable, child_script])
codes = [first.wait(), second.wait()]
print("parent children exit %d %d" % (codes[0], codes[1]), flush=True)
sys.exit(max(codes))

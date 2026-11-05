"""The attach-mode parent of the session tree's attach fixture (issue #1081).

Run as `python -m debugpy --listen 127.0.0.1:<port> attach_parent.py`: debugpy
has its listener up before the script runs, so the READY line means a client
can attach. The script then waits for that client, starts child.py the way
parent.py does, waits for it and exits with its code, so a tree that was
released or closed can be seen running to its end on the harness's own pipe.
"""
import os
import subprocess
import sys

import debugpy

print("ATTACH_PARENT_READY", flush=True)
debugpy.wait_for_client()
print("parent attached", flush=True)
child_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "child.py")
proc = subprocess.Popen([sys.executable, child_script])
code = proc.wait()
print("parent child exit %d" % code, flush=True)
sys.exit(code)

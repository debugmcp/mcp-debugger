"""A long-lived attach-mode parent with one child process (issue #1343).

Run as `python -m debugpy --listen 127.0.0.1:<port> attach_service_parent.py`.
Prints ATTACH_PARENT_READY once debugpy's listener is up, waits for a client,
starts child_steps.py and prints the child's exit code when it ends, so a
child that was released can be seen finishing its work on this process's own
pipe. It then lives on, calling `tick` every 50 ms, until the test stops it
(with a 10-minute backstop so an aborted run never leaks it).
"""
import os
import subprocess
import sys
import time

import debugpy


def tick(count):
    return count + 1  # TICK


def main():
    print("ATTACH_PARENT_READY", flush=True)
    debugpy.wait_for_client()
    print("parent attached", flush=True)  # PARENT BREAKPOINT: before the child starts
    child_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "child_steps.py")
    code = subprocess.Popen([sys.executable, child_script]).wait()
    print("parent child exit %d" % code, flush=True)
    deadline = time.monotonic() + 600.0
    count = 0
    while time.monotonic() < deadline:
        count = tick(count)
        time.sleep(0.05)


if __name__ == "__main__":
    main()

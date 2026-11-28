"""A long-lived attach-mode parent with one child process (issue #1343).

Run as `python -m debugpy --listen 127.0.0.1:<port> attach_service_parent.py <go-file>`.
Prints ATTACH_PARENT_READY once debugpy's listener is up, waits for a client,
starts child_steps.py with the same <go-file> and prints the child's exit
code when it ends, so a child that was released can be seen finishing its
work on this process's own pipe. It then lives on, calling `tick` every
50 ms, until the test stops it.

The backstop is armed before anything else and bounds the whole life of the
process: faulthandler's watchdog is a native thread, so it fires while the
process waits for a client, waits for its child, or is paused by the
debugger (pydevd suspends Python threads, a timer thread among them, but
not this one), and it exits the process with code 1 after dumping its stacks.
"""
import faulthandler
import os
import subprocess
import sys
import time

BACKSTOP_S = 600
faulthandler.dump_traceback_later(BACKSTOP_S, exit=True)

import debugpy  # noqa: E402  (after the backstop: it must bound the import too)


def tick(count):
    return count + 1  # TICK


def main():
    go_file = sys.argv[1]
    print("ATTACH_PARENT_READY", flush=True)
    debugpy.wait_for_client()
    print("parent attached", flush=True)  # PARENT BREAKPOINT: before the child starts
    child_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "child_steps.py")
    code = subprocess.Popen([sys.executable, child_script, go_file]).wait()
    print("parent child exit %d" % code, flush=True)
    count = 0
    while True:
        count = tick(count)
        time.sleep(0.05)


if __name__ == "__main__":
    main()

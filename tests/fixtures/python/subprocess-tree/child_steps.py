"""The child attach_service_parent.py starts (issue #1343).

Run as `child_steps.py <go-file>`. Three steps with a breakpoint on the first
line of each. After its first step the child waits for <go-file> to exist,
which the test creates once it has checked that the child is alive: a child
released at the first breakpoint keeps running, waiting, for as long as the
test needs, whatever the time the server takes to answer. Then it does its
remaining steps and prints the total, which only a child that ran to its end
prints, and exits 0.

The backstop is armed first and bounds the whole life of the process, paused
by the debugger or not (see attach_service_parent.py): faulthandler's native
watchdog exits it with code 1 after BACKSTOP_S.
"""
import faulthandler
import os
import sys
import time

BACKSTOP_S = 600
faulthandler.dump_traceback_later(BACKSTOP_S, exit=True)

go_file = sys.argv[1]
print("child start", flush=True)
total = 0
for i in range(3):
    total += i  # BREAKPOINT
    print("child step %d" % i, flush=True)
    if i == 0:
        while not os.path.exists(go_file):
            time.sleep(0.05)
        print("child told to finish", flush=True)
print("child done %d" % total, flush=True)
sys.exit(0)

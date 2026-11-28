"""The child attach_service_parent.py starts (issue #1343).

Three steps half a second apart, with a breakpoint on the first line of each:
a child released at that breakpoint is still running for about a second
afterwards, and the total it prints at the end is printed only by a child
that ran to its end.
"""
import sys
import time

print("child start", flush=True)
total = 0
for i in range(3):
    total += i  # BREAKPOINT
    print("child step %d" % i, flush=True)
    time.sleep(0.5)
print("child done %d" % total, flush=True)
sys.exit(0)

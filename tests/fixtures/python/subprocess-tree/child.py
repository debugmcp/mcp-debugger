"""The child the subprocess-tree parent spawns (issue #1081).

Three iterations of a loop with a breakpoint on its first line: a child
session adopted with the parent's breakpoints stops here three times, and
the total it prints at the end is the proof it ran to completion.
"""
import sys

print("child start", flush=True)
total = 0
for i in range(3):
    total += i  # BREAKPOINT
    print("child step %d" % i, flush=True)
print("child done %d" % total, flush=True)
sys.exit(0)

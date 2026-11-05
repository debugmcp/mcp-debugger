"""The grandchild of the session tree's cascade suite (issue #1081).

Started by child_grand.py: one breakpoint line, then the line that proves it
ran to its end.
"""
import sys

print("grandchild start", flush=True)
value = 42  # BREAKPOINT
print("grandchild done %d" % value, flush=True)
sys.exit(0)

#!/usr/bin/env python3
"""Long-running loop target for attach_to_process smoke tests."""
import time


def compute(a, b):
    result = a + b
    return result


print("ATTACH_LOOP_READY", flush=True)  # readiness sentinel awaited verbatim by tests/e2e/mcp-server-smoke-python-attach.test.ts -- keep in sync
while True:
    total = compute(42, 58)
    time.sleep(0.5)

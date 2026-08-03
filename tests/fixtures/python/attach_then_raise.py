#!/usr/bin/env python3
"""Attach-mode fixture for break-on-exception e2e (issue #220).

Starts a debugpy listener, waits for the client to attach, then raises an
uncaught exception shortly after execution resumes.
"""
import sys
import time

import debugpy

port = int(sys.argv[1]) if len(sys.argv) > 1 else 5679
debugpy.listen(("127.0.0.1", port))
print(f"LISTENING {port}", flush=True)
debugpy.wait_for_client()
print("CLIENT ATTACHED", flush=True)

time.sleep(1.0)  # Line 18: give post-attach verification a beat
raise RuntimeError("attach-mode uncaught exception")  # Line 19: crash site

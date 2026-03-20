#!/usr/bin/env python3
"""Long-running program for testing pause_execution."""
import time

counter = 0
while True:
    counter += 1
    time.sleep(0.5)

import sys
import time # Added for sleep

# Simple script for debugging tests

print("Python version:", sys.version)
print("Starting simple test script...")

# Code that would be debugged
def sample_function():
    a = 5
    b = 10
    c = a + b
    print(f"Result: {c}")

# Run the function
print("Running sample function...")
sample_function()
print("Debug test script is now sleeping for 60 seconds...")
time.sleep(60)
print("Debug test script finished sleeping and will now exit.")

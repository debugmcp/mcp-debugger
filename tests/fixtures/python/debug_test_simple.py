#!/usr/bin/env python3
"""Simple Python script for debugging workflow tests."""

import time

def sample_function():
    """Function with local variables for testing debugger inspection."""
    # Initialize some variables
    a = 5
    b = 10
    
    # This is line 13 - the actual breakpoint line
    c = a + b  # Line 14 - the test sets a breakpoint here
    
    # Some more computation
    result = c * 2
    
    return result

def main():
    """Main entry point."""
    print("Starting debug test...")
    
    # Call our sample function
    value = sample_function()
    print(f"Result from sample_function: {value}")
    
    # Do some more work
    for i in range(3):
        print(f"Iteration {i}")
        time.sleep(0.1)
    
    print("Debug test completed!")

if __name__ == "__main__":
    main()

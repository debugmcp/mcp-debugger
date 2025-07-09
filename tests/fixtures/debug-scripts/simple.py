#!/usr/bin/env python3
"""Simple test script for debugging"""

def main():
    x = 10  # Line 4: First breakpoint
    y = 20  # Line 5
    result = x + y  # Line 6: Second breakpoint
    print(f"Result: {result}")  # Line 7
    return result  # Line 8: Third breakpoint

if __name__ == "__main__":
    main()

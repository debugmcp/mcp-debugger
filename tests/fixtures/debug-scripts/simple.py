#!/usr/bin/env python3
"""Simple test script for debugging"""

def main():
    x = 10  # Line 5: First breakpoint
    y = 20  # Line 6
    result = x + y  # Line 7: Second breakpoint
    print(f"Result: {result}")  # Line 8
    return result  # Line 9: Third breakpoint

if __name__ == "__main__":
    main()

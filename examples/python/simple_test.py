#!/usr/bin/env python3
"""
Simple test script for debugging
"""

def main():
    """Main function for testing debugger."""
    a = 1
    b = 2
    print(f"Before swap: a={a}, b={b}")
    a, b = b, a  # We'll set a breakpoint on this line
    print(f"After swap: a={a}, b={b}")

if __name__ == "__main__":
    main()

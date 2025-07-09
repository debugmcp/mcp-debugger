#!/usr/bin/env python3
"""Test script that throws exceptions"""

def divide(a, b):
    return a / b  # Line 4: Will throw ZeroDivisionError

def main():
    x = 10  # Line 7
    y = 0   # Line 8
    result = divide(x, y)  # Line 9: Error here
    print(result)  # Line 10: Never reached
    return result  # Line 11

if __name__ == "__main__":
    main()

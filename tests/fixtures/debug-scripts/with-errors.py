#!/usr/bin/env python3
"""Test script that throws exceptions"""

def divide(a, b):
    return a / b  # Line 5: Will throw ZeroDivisionError

def main():
    x = 10  # Line 8
    y = 0   # Line 9
    result = divide(x, y)  # Line 10: Error here
    print(result)  # Line 11: Never reached
    return result  # Line 12

if __name__ == "__main__":
    main()

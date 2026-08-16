#!/usr/bin/env python3
"""Test script with various data types for variable inspection"""

def test_variables():
    # Different data types
    number = 42  # Line 6
    text = "Hello, debugger!"  # Line 7
    items = [1, 2, 3, 4, 5]  # Line 8
    data = {"name": "test", "value": 100}  # Line 9

    # Nested function to test scopes
    def inner():
        local_var = "inner scope"  # Line 13
        return local_var  # Line 14

    result = inner()  # Line 16: Breakpoint here
    return result  # Line 17

if __name__ == "__main__":
    test_variables()

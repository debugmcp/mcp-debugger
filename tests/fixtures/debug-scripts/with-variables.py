#!/usr/bin/env python3
"""Test script with various data types for variable inspection"""

def test_variables():
    # Different data types
    number = 42  # Line 5
    text = "Hello, debugger!"  # Line 6
    items = [1, 2, 3, 4, 5]  # Line 7
    data = {"name": "test", "value": 100}  # Line 8
    
    # Nested function to test scopes
    def inner():
        local_var = "inner scope"  # Line 12
        return local_var  # Line 13
    
    result = inner()  # Line 15: Breakpoint here
    return result  # Line 16

if __name__ == "__main__":
    test_variables()

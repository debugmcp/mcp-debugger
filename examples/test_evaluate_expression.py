#!/usr/bin/env python3
"""
Simple test script to demonstrate evaluate_expression functionality.
This script creates variables and pauses at breakpoints to allow expression evaluation.
"""

def test_function(x, y):
    """A simple function to test variable evaluation in different frames."""
    local_var = x + y
    nested_list = [1, 2, [3, 4, 5]]
    nested_dict = {
        'name': 'test',
        'value': 42,
        'inner': {
            'data': [10, 20, 30]
        }
    }
    # Breakpoint 1: Test evaluation in function scope
    result = local_var * 2
    return result

def main():
    """Main function to test expression evaluation."""
    # Simple variables
    x = 10
    y = 20
    message = "Hello, debugger!"
    
    # Complex types
    my_list = [1, 2, 3, 4, 5]
    my_dict = {'a': 1, 'b': 2, 'c': 3}
    
    # Breakpoint 2: Test evaluation in main scope
    print(f"x = {x}, y = {y}")
    
    # Call function to test frame context
    result = test_function(x, y)
    
    # Breakpoint 3: Test state modification
    print(f"Result: {result}")
    print(f"Message: {message}")
    
    # Test unicode
    unicode_var = "测试中文"
    print(f"Unicode: {unicode_var}")
    
    print("Test completed!")

if __name__ == "__main__":
    main()

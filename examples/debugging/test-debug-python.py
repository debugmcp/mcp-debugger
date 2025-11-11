#!/usr/bin/env python3
"""Test script for debugging with MCP debugger."""

def calculate_sum(a, b):
    """Calculate sum of two numbers."""
    result = a + b
    print(f"Sum of {a} and {b} is {result}")
    return result

def process_list(items):
    """Process a list of items."""
    total = 0
    for i, item in enumerate(items):
        print(f"Processing item {i}: {item}")
        total += item
    return total

def main():
    """Main function."""
    print("Starting Python debug test...")
    
    # Test simple calculation
    x = 10
    y = 20
    sum_result = calculate_sum(x, y)
    
    # Test list processing
    numbers = [1, 2, 3, 4, 5]
    list_sum = process_list(numbers)
    
    # Test variable manipulation
    message = "Debug test complete"
    final_result = sum_result + list_sum
    
    print(f"{message}: {final_result}")
    return final_result

if __name__ == "__main__":
    result = main()
    print(f"Program finished with result: {result}")

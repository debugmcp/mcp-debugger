#!/usr/bin/env python3
"""
Fibonacci Example - for testing the Debug MCP Server

This is a simple example script that calculates Fibonacci numbers both recursively
and iteratively. It's intended to be used as a test case for debugging.
"""

def fibonacci_recursive(n):
    """Calculate the nth Fibonacci number recursively."""
    if n <= 0:
        return 0
    elif n == 1:
        return 1
    else:
        return fibonacci_recursive(n - 1) + fibonacci_recursive(n - 2)


def fibonacci_iterative(n):
    """Calculate the nth Fibonacci number iteratively."""
    if n <= 0:
        return 0
    
    a, b = 0, 1
    for _ in range(1, n):
        a, b = b, a + b
    
    return b


def main():
    """Main function to demonstrate the Fibonacci calculations."""
    n = 10
    
    print(f"Calculating the {n}th Fibonacci number:")
    
    # Calculate using the iterative approach
    result_iterative = fibonacci_iterative(n)
    print(f"Iterative result: {result_iterative}")
    
    # Calculate using the recursive approach
    result_recursive = fibonacci_recursive(n)
    print(f"Recursive result: {result_recursive}")
    
    # Introduce a bug for debugging purposes
    buggy_value = fibonacci_iterative(n - 1) + 1  # This should be +0 not +1
    print(f"Buggy value: {buggy_value}")
    
    if buggy_value != fibonacci_iterative(n):
        print("Debug me: The buggy value doesn't match the expected result!")


if __name__ == "__main__":
    main()

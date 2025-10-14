#!/usr/bin/env python3
"""Comprehensive test script for Python debugging"""

def factorial(n):
    """Calculate factorial recursively"""
    if n <= 1:
        return 1
    return n * factorial(n - 1)

def sum_list(numbers):
    """Sum a list of numbers"""
    total = 0
    for num in numbers:
        total += num
    return total

def process_data(data):
    """Process some data with multiple operations"""
    result = []
    for item in data:
        processed = item * 2
        result.append(processed)
    return result

def main():
    # Test variables
    x = 10
    y = 20
    z = x + y
    
    # Test factorial
    fact_result = factorial(5)
    print(f"Factorial of 5: {fact_result}")
    
    # Test list operations
    numbers = [1, 2, 3, 4, 5]
    sum_result = sum_list(numbers)
    print(f"Sum of numbers: {sum_result}")
    
    # Test data processing
    data = [10, 20, 30]
    processed = process_data(data)
    print(f"Processed data: {processed}")
    
    # Final computation
    final = z * fact_result
    print(f"Final result: {final}")
    
    return final

if __name__ == "__main__":
    result = main()
    print(f"Script completed with result: {result}")

#!/usr/bin/env python3
"""Comprehensive Python test script for MCP debugger testing"""

def fibonacci(n):
    """Calculate fibonacci number recursively"""
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

def calculate_sum(numbers):
    """Calculate sum of numbers"""
    total = 0
    for num in numbers:
        total += num
    return total

def factorial(n):
    """Calculate factorial"""
    if n <= 1:
        return 1
    result = 1
    for i in range(2, n + 1):
        result *= i
    return result

def main():
    """Main function to test various debugging scenarios"""
    # Test 1: Simple variables
    x = 10
    y = 20
    z = x + y
    print(f"Sum: {z}")
    
    # Test 2: List operations
    numbers = [1, 2, 3, 4, 5]
    sum_result = calculate_sum(numbers)
    print(f"Sum of list: {sum_result}")
    
    # Test 3: Recursive function
    fib_5 = fibonacci(5)
    print(f"Fibonacci(5): {fib_5}")
    
    # Test 4: Loop with calculation
    fact_5 = factorial(5)
    print(f"Factorial(5): {fact_5}")
    
    # Test 5: Dictionary
    person = {
        "name": "Alice",
        "age": 30,
        "city": "New York"
    }
    print(f"Person: {person['name']}, {person['age']}")
    
    # Test 6: Conditional logic
    if z > 25:
        print("Z is greater than 25")
    else:
        print("Z is 25 or less")
    
    print("Test complete!")

if __name__ == "__main__":
    main()

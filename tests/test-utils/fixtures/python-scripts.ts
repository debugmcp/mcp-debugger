/**
 * Python script fixtures for testing
 * 
 * This file contains various Python scripts for testing the debugger
 */

// Simple script with a loop
export const simpleLoopScript = `
# Simple Python script with a basic loop
def main():
    print("Starting simple loop test")
    
    sum = 0
    for i in range(5):
        sum += i
        print(f"Current sum: {sum}")
    
    print(f"Final sum: {sum}")
    return sum

if __name__ == "__main__":
    main()
`;

// Script with a function call
export const functionCallScript = `
# Python script with a function call
def add(a, b):
    result = a + b
    print(f"Adding {a} + {b} = {result}")
    return result

def multiply(a, b):
    result = a * b
    print(f"Multiplying {a} * {b} = {result}")
    return result

def main():
    print("Starting function call test")
    
    x = 5
    y = 7
    
    sum_result = add(x, y)
    product_result = multiply(x, y)
    
    print(f"Sum: {sum_result}, Product: {product_result}")
    
    return sum_result, product_result

if __name__ == "__main__":
    main()
`;

// Fibonacci implementation (recursive and iterative)
export const fibonacciScript = `
# Python script with fibonacci implementations
def fibonacci_recursive(n):
    """Calculate the nth Fibonacci number recursively"""
    if n <= 0:
        return 0
    elif n == 1:
        return 1
    else:
        return fibonacci_recursive(n-1) + fibonacci_recursive(n-2)

def fibonacci_iterative(n):
    """Calculate the nth Fibonacci number iteratively"""
    if n <= 0:
        return 0
    elif n == 1:
        return 1
    
    a, b = 0, 1
    for _ in range(2, n+1):
        a, b = b, a + b
    
    return b

def main():
    print("Starting Fibonacci test")
    
    n = 10
    
    # Calculate using both methods
    result_recursive = fibonacci_recursive(n)
    result_iterative = fibonacci_iterative(n)
    
    print(f"Fibonacci({n}) recursive = {result_recursive}")
    print(f"Fibonacci({n}) iterative = {result_iterative}")
    
    # Verify results match
    assert result_recursive == result_iterative, "Results don't match!"
    
    return result_iterative

if __name__ == "__main__":
    main()
`;

// Script with exception handling
export const exceptionHandlingScript = `
# Python script with exception handling
def divide(a, b):
    try:
        result = a / b
        print(f"Dividing {a} / {b} = {result}")
        return result
    except ZeroDivisionError:
        print("Error: Cannot divide by zero!")
        return None

def main():
    print("Starting exception handling test")
    
    # Valid division
    result1 = divide(10, 2)
    
    # Division by zero (will be caught)
    result2 = divide(5, 0)
    
    # Uncaught exception (for testing breakpoints on exceptions)
    values = [1, 2, 3]
    try:
        # This will raise IndexError
        value = values[10]
    except IndexError as e:
        print(f"Caught IndexError: {e}")
    
    return result1, result2

if __name__ == "__main__":
    main()
`;

// Script with multiple modules (main file)
export const multiModuleMainScript = `
# Main file for multi-module test
import module_helper

def main():
    print("Starting multi-module test")
    
    # Call function from the helper module
    result = module_helper.process_data([1, 2, 3, 4, 5])
    
    print(f"Result from helper: {result}")
    return result

if __name__ == "__main__":
    main()
`;

// Script with multiple modules (helper file)
export const multiModuleHelperScript = `
# Helper module for multi-module test
def process_data(data):
    """Process the input data and return a result"""
    total = sum(data)
    average = total / len(data)
    
    print(f"Processing data: {data}")
    print(f"Total: {total}, Average: {average}")
    
    return {
        "total": total,
        "average": average,
        "min": min(data),
        "max": max(data)
    }
`;

// Script with a bug to debug
export const buggyScript = `
# Python script with a buggy function for testing debugging
def calculate_average(numbers):
    """Calculate the average of a list of numbers"""
    total = 0
    count = 0
    
    for number in numbers:
        total += number
        # Bug: count is not incremented properly
        if number > 0:  # This condition causes the bug
            count += 1
    
    # This will cause division by zero if all numbers are <= 0
    try:
        average = total / count
    except ZeroDivisionError:
        print("Error: No positive numbers in the list")
        return None
    
    return average

def main():
    print("Starting buggy script test")
    
    test_data = [5, -3, 10, 2, -8]
    result = calculate_average(test_data)
    print(f"Average of positive numbers: {result}")
    
    # This should cause the bug
    buggy_data = [-1, -2, -3]
    buggy_result = calculate_average(buggy_data)
    print(f"Buggy result: {buggy_result}")
    
    return result, buggy_result

if __name__ == "__main__":
    main()
`;

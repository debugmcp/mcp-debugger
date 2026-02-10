# examples/python/fibonacci.py
@source-hash: bae9881f2c6491a0
@generated: 2026-02-09T18:14:54Z

## Purpose
Test script for debugging MCP server functionality, implementing Fibonacci number calculation using both recursive and iterative approaches with intentional bugs for testing.

## Key Functions

### `fibonacci_recursive(n)` (L9-16)
- Classic recursive Fibonacci implementation with exponential time complexity O(2^n)
- Base cases: returns 0 for n<=0, returns 1 for n==1
- Recursive case: F(n) = F(n-1) + F(n-2)
- No memoization - inefficient for large values

### `fibonacci_iterative(n)` (L19-28)
- Efficient iterative Fibonacci implementation with O(n) time complexity
- Uses two-variable approach: maintains previous two values (a, b)
- Returns 0 for n<=0, otherwise iterates from 1 to n-1
- Space complexity O(1)

### `main()` (L31-50)
- Demonstrates both Fibonacci implementations with n=10
- **Intentional bug on L46**: adds +1 to fibonacci_iterative(n-1) creating incorrect "buggy_value"
- Compares buggy result with correct result to trigger debug scenario
- Outputs results and debug message when values don't match

## Execution Flow
- Script runs main() when executed directly (L53-54)
- Calculates 10th Fibonacci number using both methods
- Introduces deliberate calculation error for debugging demonstration
- Prints comparison results and debug message

## Dependencies
- Standard Python only (no external imports)
- Uses f-string formatting (requires Python 3.6+)

## Architecture Notes
- Simple procedural design with no classes
- Designed specifically as debugging test case for MCP server
- Intentional bug serves as debugging exercise rather than accidental error
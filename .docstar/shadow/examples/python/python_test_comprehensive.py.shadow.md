# examples/python/python_test_comprehensive.py
@source-hash: 12deeaf3c51dc287
@generated: 2026-02-10T00:41:41Z

## Primary Purpose
Comprehensive test script designed for MCP (Message Control Protocol) debugger testing, providing various Python programming scenarios to exercise debugging capabilities.

## Key Functions

### fibonacci(n) (L4-8)
Recursive implementation of Fibonacci sequence calculation. Uses classic base case pattern (n <= 1) with recursive calls for n-1 and n-2. Inefficient O(2^n) time complexity due to redundant calculations but useful for debugging recursive call stacks.

### calculate_sum(numbers) (L10-15)
Iterative summation function that accumulates total from an iterable of numbers using simple for-loop pattern. Demonstrates basic variable mutation and iteration debugging scenarios.

### factorial(n) (L17-24)
Iterative factorial calculation using range-based loop multiplication. Includes base case handling (n <= 1) and demonstrates loop variable tracking with accumulator pattern.

### main() (L26-61)
Primary test orchestration function containing 6 distinct debugging scenarios:
- **Test 1 (L28-32)**: Basic variable assignment and arithmetic operations
- **Test 2 (L34-37)**: List creation and function call with result capture
- **Test 3 (L39-41)**: Recursive function invocation testing
- **Test 4 (L43-45)**: Iterative algorithm execution
- **Test 5 (L47-53)**: Dictionary creation and key-based access patterns
- **Test 6 (L55-59)**: Conditional branching logic with variable comparison

## Execution Entry Point
Standard Python idiom `if __name__ == "__main__"` (L63-64) ensures main() only executes when script is run directly, not imported.

## Debugging Test Coverage
The script systematically exercises:
- Variable assignment and arithmetic
- Function calls (both recursive and iterative)
- Data structure operations (lists, dictionaries)
- Control flow (loops, conditionals)
- Print statement debugging output
- Multiple algorithm implementations for comparative analysis

## Dependencies
No external dependencies - uses only Python standard library features (print, range, basic data types).
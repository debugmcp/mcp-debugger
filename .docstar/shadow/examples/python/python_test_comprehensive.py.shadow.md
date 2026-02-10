# examples/python/python_test_comprehensive.py
@source-hash: 12deeaf3c51dc287
@generated: 2026-02-09T18:14:56Z

## Primary Purpose
Comprehensive test script designed for MCP (Model Context Protocol) debugger testing. Provides various Python language constructs and debugging scenarios including recursion, loops, data structures, and control flow.

## Key Functions

**fibonacci(n) (L4-8)**
- Recursive implementation of Fibonacci sequence calculation
- Base case: returns n when n <= 1
- Recursive case: returns sum of fibonacci(n-1) and fibonacci(n-2)
- Used in main() for testing recursive debugging scenarios

**calculate_sum(numbers) (L10-15)**
- Iterative summation of numeric list/iterable
- Uses accumulator pattern with for-loop
- Returns total sum of all numbers in input collection

**factorial(n) (L17-24)**
- Iterative factorial calculation using range-based loop
- Base case: returns 1 for n <= 1
- Multiplies result by each integer from 2 to n inclusive

**main() (L26-61)**
- Primary test orchestrator function containing 6 distinct debugging test scenarios:
  - Test 1 (L28-32): Basic variable arithmetic and string formatting
  - Test 2 (L34-37): List operations with function call
  - Test 3 (L39-41): Recursive function testing
  - Test 4 (L43-45): Iterative calculation testing
  - Test 5 (L47-53): Dictionary data structure access
  - Test 6 (L55-59): Conditional branching logic
- Each test includes print statements for output verification

## Dependencies
- No external dependencies
- Uses built-in Python functions: print(), range()

## Architectural Patterns
- **Test-driven structure**: Each function serves as a isolated test case for different debugging scenarios
- **Pure functions**: All utility functions (fibonacci, calculate_sum, factorial) are stateless and deterministic
- **Linear test execution**: main() runs tests sequentially without error handling or test isolation

## Critical Characteristics
- **Performance concern**: fibonacci() uses naive recursion (exponential time complexity)
- **Debugger-friendly**: Code includes varied breakpoint opportunities across different language constructs
- **Self-contained**: No external file I/O or network dependencies
- **Output verification**: All tests produce console output for manual verification
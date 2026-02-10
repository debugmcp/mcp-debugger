# examples/javascript/javascript_test_comprehensive.js
@source-hash: 3097d163e8b22c79
@generated: 2026-02-10T00:41:38Z

## Purpose
Comprehensive JavaScript test script designed for MCP (Model Context Protocol) debugger testing. Provides various debugging scenarios including recursive functions, loops, objects, and conditional logic to validate debugger functionality.

## Key Functions

### `fibonacci(n)` (L6-12)
Recursive implementation of Fibonacci sequence calculation. Takes integer `n` and returns nth Fibonacci number using classic recursive approach with base case for n ≤ 1.

### `calculateSum(numbers)` (L14-21)
Array summation utility using for-of loop iteration. Accepts array of numbers and returns total sum through accumulator pattern.

### `factorial(n)` (L23-33)
Iterative factorial calculation with explicit loop. Uses base case for n ≤ 1, then iteratively multiplies from 2 to n.

### `main()` (L35-78)
Primary test orchestrator containing 7 distinct debugging test scenarios:
- Simple arithmetic operations (L38-42)
- Array processing with function calls (L44-47)
- Recursive function testing (L49-51)
- Iterative calculation validation (L53-55)
- Object property access (L57-63)
- Conditional branching logic (L65-70)
- Arrow function usage (L72-75)

## Architecture & Patterns
- **Test-driven structure**: Each test case demonstrates different debugging scenarios
- **Functional decomposition**: Separate utility functions for mathematical operations
- **Console output**: Extensive logging for debugging visibility
- **Mixed paradigms**: Combines recursive, iterative, and functional programming styles

## Dependencies
- Node.js runtime environment (shebang L1)
- Console API for output logging

## Execution
Script automatically executes via `main()` call at L81, making it immediately runnable for debugging session testing.
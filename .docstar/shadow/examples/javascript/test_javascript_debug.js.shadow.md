# examples/javascript/test_javascript_debug.js
@source-hash: cc36b9c79f9ab95c
@generated: 2026-02-10T00:41:39Z

## Primary Purpose
JavaScript debugging test script demonstrating various computational operations and control flow patterns. Serves as a comprehensive example for testing debugger functionality with recursive functions, loops, array operations, and variable tracking.

## Key Functions

**factorial(n)** (L6-12)
- Recursive factorial calculation with base case handling
- Returns 1 for n <= 1, otherwise returns n * factorial(n-1)
- Useful for testing recursive call stack debugging

**sumList(numbers)** (L14-21)
- Iterative array summation using for-of loop
- Demonstrates basic array iteration and accumulator pattern
- Returns total sum of all numbers in input array

**processData(data)** (L23-31)
- Array transformation function that doubles each element
- Uses for-of loop with array pushing pattern
- Returns new array with processed values

**main()** (L33-58)
- Primary execution function orchestrating all test operations
- Defines test variables (x=10, y=20, z=30) for debugging variable tracking
- Executes factorial(5), sumList([1,2,3,4,5]), and processData([10,20,30])
- Performs final computation combining multiple results
- Returns computed final value for script completion

## Execution Flow
Script entry point at L61 calls main() and logs the final result. Each function call includes console.log statements for output verification during debugging sessions.

## Architecture Notes
- Simple procedural design optimized for debugging visibility
- No external dependencies beyond Node.js built-ins
- Clear separation of concerns with distinct computational functions
- Executable via Node.js shebang (L1)

## Debug-Friendly Features
- Multiple variable assignments for breakpoint testing
- Mixed iteration patterns (recursion vs loops)
- Intermediate result logging
- Nested function calls for stack trace examination
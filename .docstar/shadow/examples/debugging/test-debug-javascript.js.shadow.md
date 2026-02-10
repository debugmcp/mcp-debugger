# examples/debugging/test-debug-javascript.js
@source-hash: 7b3844907faa5a88
@generated: 2026-02-09T18:14:52Z

## Purpose
Test script for demonstrating debugging capabilities with MCP debugger. Provides a controlled environment for exercising common JavaScript debugging scenarios including arithmetic operations, array processing, recursion, and object manipulation.

## Key Functions

**calculateProduct(a, b)** (L6-11)
- Multiplies two numbers with console logging
- Returns product result
- Purpose: Simple arithmetic debugging test case

**processArray(items)** (L13-21)
- Iterates through array, logging each item and accumulating sum
- Returns total sum of array elements
- Purpose: Array iteration and state tracking debugging scenario

**fibonacci(n)** (L23-30)
- Recursive implementation of Fibonacci sequence
- Base case: returns n for n <= 1
- Purpose: Recursive function call stack debugging test

**main()** (L32-62)
- Orchestrates all test scenarios in sequence
- Creates test data: x=15, y=3, numbers=[10,20,30,40,50], fibNumber=6
- Builds composite testObject containing results from all operations
- Returns final computed result (product + arraySum + fibResult)
- Purpose: Main execution flow for comprehensive debugging session

## Execution Flow
1. Simple multiplication test (L36-38)
2. Array processing test (L41-42) 
3. Recursive function test (L45-47)
4. Object creation and manipulation (L50-54)
5. Final result computation (L58-61)

## Architecture
- Standalone Node.js script with shebang (L1)
- Sequential execution model with clear separation of concerns
- Heavy use of console.log for debugging visibility
- Functional programming approach with pure functions
- Global execution at module level (L65-66)

## Dependencies
- Node.js runtime environment
- Console API for logging output

## Notable Patterns
- Each function includes descriptive comments matching their purpose
- Consistent logging pattern for traceability
- Progressive complexity: simple operations → arrays → recursion → objects
- All intermediate results preserved for inspection
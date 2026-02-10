# examples/javascript/mcp_target.js
@source-hash: 20db91ba517632f7
@generated: 2026-02-09T18:14:55Z

## Purpose
A JavaScript test script designed to validate debugging capabilities in development environments. Provides structured test scenarios for breakpoints, stack traces, variable inspection, and expression evaluation.

## Key Components

### Test Data (L13-17)
- `testData`: Static configuration object containing script metadata and feature list
- Used as baseline data for debugging tests

### Functions

#### `deepFunction(level)` (L20-27)
- Recursive function for testing call stack depth and tracing
- Creates controlled stack frames by recursively calling itself until `level` reaches 0
- Returns a local variable from the deepest stack frame
- Useful for testing debugger stack navigation and variable scope inspection

#### `testVariables()` (L30-39)
- Demonstrates various JavaScript data types for variable inspection testing
- Creates local variables of different types: number, string, array, object with nested properties
- Performs simple computation (`result = number * 2`) for expression evaluation testing
- Returns computed result

#### `main()` (L42-57)
- Async entry point orchestrating all test scenarios
- Executes tests in sequence with console logging for visual feedback
- **Test 1 (L47-49)**: Stack trace testing via `deepFunction(3)`
- **Test 2 (L52-54)**: Variable inspection testing via `testVariables()`
- Provides clear test boundaries with formatted console output

### Execution Entry Point (L60-63)
- Invokes `main()` with error handling
- Exits process with code 1 on any unhandled errors
- Uses `.catch()` for promise error handling

## Architecture Patterns
- Separation of concerns: distinct functions for different debugging aspects
- Async/await pattern for main execution flow
- Structured test organization with clear logging boundaries
- Error handling with graceful process termination

## Key Testing Scenarios
- **Stack Depth**: 4-level deep recursion for stack frame inspection
- **Data Types**: Primitive and complex types for variable examination
- **Scope Testing**: Local variables at different function levels
- **Expression Evaluation**: Simple arithmetic operations for debugger testing
# examples/javascript/test_complete_js_debug.js
@source-hash: 82636f381ecc3d5c
@generated: 2026-02-09T18:14:56Z

## Purpose
Test harness for JavaScript debugging features, designed to exercise breakpoints, stack traces, variable inspection, and expression evaluation capabilities in debugging environments.

## Key Components

**Test Data (L13-17)**
- `testData` object: Static configuration with metadata about the debugging test suite
- Contains test identification and feature list for reference during debugging sessions

**Stack Depth Testing (L20-28)**
- `deepFunction(level)`: Recursive function that creates a call stack of specified depth
- Base case at level 0 creates local variable `localVar` for inspection
- Line 25 marked as optimal breakpoint location for stack examination
- Returns string value from bottom of call stack

**Variable Testing (L31-42)**
- `testVariables()`: Demonstrates various JavaScript data types for debugger inspection
- Creates primitive types (number, string), collections (array), and nested objects
- Line 37 marked as breakpoint location for variable state examination
- Includes expression evaluation test with `result = number * 2`

**Main Execution Flow (L45-60)**
- `main()`: Async orchestrator function that runs test sequence
- Executes stack trace test (L51) and variable inspection test (L56)
- Provides console output for test progress tracking
- Uses structured test sections with clear delimiters

**Error Handling (L63-66)**
- Top-level error handler with process exit on failure
- Catches and logs any unhandled promise rejections from main()

## Architecture Patterns
- Sequential test execution with clear separation of concerns
- Console logging for debugging session visibility
- Async/await pattern for main execution despite synchronous operations
- Explicit breakpoint location comments for debugging guidance

## Dependencies
- Node.js runtime (implied by `process.exit`)
- Console API for output and debugging markers

## Usage Context
Intended for debugging tool validation, debugger training, or testing IDE debugging capabilities with realistic JavaScript code patterns.
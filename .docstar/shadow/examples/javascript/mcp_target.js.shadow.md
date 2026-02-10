# examples/javascript/mcp_target.js
@source-hash: 20db91ba517632f7
@generated: 2026-02-10T00:41:37Z

## Purpose
JavaScript debugging test script designed to exercise various debugging features including breakpoints, stack traces, variable inspection, and expression evaluation. Serves as a comprehensive target for testing JavaScript debugging tools.

## Key Functions

**deepFunction(level)** (L20-27)
- Recursive function for testing stack trace depth
- Decrements level until reaching 0, then returns a local variable
- Creates nested call stack for debugging stack frame inspection

**testVariables()** (L30-39)
- Demonstrates variable inspection capabilities
- Creates diverse variable types: number, string, array, nested object
- Performs simple expression evaluation (multiplication)
- Returns computed result for testing

**main()** (L42-57)
- Async entry point orchestrating test execution
- Runs two test scenarios with console output separation
- Calls deepFunction(3) to test 4-level stack depth
- Calls testVariables() to test variable inspection

## Data Structures

**testData** (L13-17)
- Global constant object with metadata about the debugging test
- Contains name, version, and features array for inspection

## Execution Flow
1. Script starts by calling main() (L60-63)
2. Error handling with process.exit(1) on failure
3. Sequential execution of stack trace and variable inspection tests
4. Console logging throughout for test progress tracking

## Debugging Test Points
- Line 48: Deep recursion call for stack testing
- Line 53: Variable-rich function call for inspection testing
- Multiple breakpoint opportunities at function entry/exit points
- Diverse variable types for expression evaluation testing
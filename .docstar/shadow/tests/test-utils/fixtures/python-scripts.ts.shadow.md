# tests/test-utils/fixtures/python-scripts.ts
@source-hash: 5a9fcf4520e976a4
@generated: 2026-02-09T18:14:40Z

## Purpose and Responsibility
Test fixture file containing Python script templates as string constants for debugger testing. Provides various Python code patterns to exercise different debugging scenarios including loops, function calls, recursion, exception handling, multi-module imports, and intentional bugs.

## Exported Script Constants

### `simpleLoopScript` (L8-23)
Basic Python script with a for-loop that calculates sum of integers 0-4. Contains main function with print statements for testing basic stepping and variable inspection during loop execution.

### `functionCallScript` (L26-53) 
Python script demonstrating function calls with two arithmetic functions (`add` and `multiply`). Tests function entry/exit breakpoints and parameter/return value inspection. Main function calls both arithmetic functions with hardcoded values (5, 7).

### `fibonacciScript` (L56-99)
Comprehensive Fibonacci implementation with both recursive and iterative approaches. Features:
- `fibonacci_recursive()` function using classic recursive pattern
- `fibonacci_iterative()` function using loop-based calculation
- Result comparison with assertion to verify correctness
- Tests recursive call stack debugging and algorithmic comparison

### `exceptionHandlingScript` (L102-134)
Exception handling demonstration with multiple error scenarios:
- `divide()` function with try/catch for ZeroDivisionError
- Intentional division by zero case
- IndexError demonstration with array bounds violation
- Tests breakpoint behavior on caught vs uncaught exceptions

### `multiModuleMainScript` (L137-152)
Main module for multi-file debugging scenarios. Imports `module_helper` and calls its `process_data()` function. Tests cross-module debugging, import resolution, and module boundary stepping.

### `multiModuleHelperScript` (L155-171)
Helper module containing `process_data()` function that performs statistical calculations (sum, average, min, max) on input array. Returns dictionary with computed values. Tests debugging imported functions and data structure inspection.

### `buggyScript` (L174-212)
Intentionally flawed implementation for debugging practice:
- `calculate_average()` function with logical bug in counting mechanism
- Only counts positive numbers but divides total by positive count (incorrect average calculation)
- Includes error case that triggers ZeroDivisionError when all numbers are negative
- Tests debugging logic errors, conditional breakpoints, and edge case handling

## Key Dependencies
No external dependencies - pure TypeScript string constants containing Python code templates.

## Architectural Notes
- All scripts follow consistent pattern: function definitions + main() + `if __name__ == "__main__"` guard
- Scripts designed to be self-contained and executable for isolated testing
- Intentional variety in complexity levels from basic loops to multi-module scenarios
- Each script includes descriptive print statements to aid in debugging verification
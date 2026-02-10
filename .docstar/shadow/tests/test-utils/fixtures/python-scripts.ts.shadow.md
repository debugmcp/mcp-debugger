# tests/test-utils/fixtures/python-scripts.ts
@source-hash: 5a9fcf4520e976a4
@generated: 2026-02-10T00:41:27Z

**Primary Purpose:** TypeScript module containing Python script fixtures for testing debugger functionality. Each export provides a complete Python program as a string template for different debugging scenarios.

**Key Exports:**

- **`simpleLoopScript` (L8-23)** - Basic Python script with loop iteration, sum calculation, and print statements. Tests basic debugging flow with variable tracking through iterations.

- **`functionCallScript` (L26-53)** - Demonstrates function calls and returns with `add()` and `multiply()` functions. Tests stepping into/over functions and parameter passing.

- **`fibonacciScript` (L56-99)** - Implements both recursive and iterative Fibonacci algorithms. Tests recursive debugging, algorithm comparison, and assertion handling. Includes performance comparison scenarios.

- **`exceptionHandlingScript` (L102-134)** - Tests exception handling with `divide()` function and deliberate error scenarios (ZeroDivisionError, IndexError). Useful for testing breakpoints on exceptions and try/catch debugging.

- **`multiModuleMainScript` (L137-152)** - Main module that imports `module_helper`. Tests cross-module debugging and import resolution.

- **`multiModuleHelperScript` (L155-171)** - Helper module with `process_data()` function that performs statistical calculations. Returns dictionary with computed values.

- **`buggyScript` (L174-212)** - Contains intentional bug in `calculate_average()` function where count only increments for positive numbers, causing incorrect averages and potential division by zero. Designed for debugging exercises.

**Architecture:** Pure fixture module with no dependencies. Each script is self-contained with proper `if __name__ == "__main__"` guards and meaningful test data. Scripts progress from simple to complex scenarios covering loops, functions, recursion, exceptions, modules, and debugging scenarios.

**Usage Context:** These fixtures support automated testing of Python debugger features including breakpoints, variable inspection, step operations, exception handling, and multi-file debugging workflows.
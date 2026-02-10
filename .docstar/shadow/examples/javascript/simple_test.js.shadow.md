# examples/javascript/simple_test.js
@source-hash: 1d758932fc4c3cb6
@generated: 2026-02-10T00:41:36Z

**Purpose**: Test script for MCP (Model Context Protocol) debugger smoke tests, providing a minimal JavaScript example for validating debugger functionality including breakpoints, stepping, and variable inspection.

**Key Components**:
- `main()` function (L8-16): Core test function that performs a simple variable swap operation
  - Initializes two variables `a=1, b=2` (L9-10)
  - Logs initial state (L11)
  - Performs destructuring assignment swap `[a, b] = [b, a]` (L14)
  - Logs final state (L15)
- Function invocation (L18): Executes main() to run the test

**Architecture**:
- Uses ES6 module syntax with `export function`
- Executable Node.js script (shebang L1)
- Mirrors equivalent Python implementation for cross-language debugger testing
- Designed specifically for breakpoint placement at L14 to inspect variables in initial state

**Dependencies**: None (pure JavaScript with Node.js console API)

**Test Strategy**: The swap operation provides predictable before/after states ideal for debugger validation, with strategic breakpoint positioning to examine variable values during execution flow.
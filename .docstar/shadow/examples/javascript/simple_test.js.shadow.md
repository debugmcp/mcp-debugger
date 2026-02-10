# examples/javascript/simple_test.js
@source-hash: 1d758932fc4c3cb6
@generated: 2026-02-09T18:14:52Z

## Purpose
Simple JavaScript test script designed for MCP (Model Context Protocol) debugger smoke testing. Provides basic variable manipulation scenario to validate debugger functionality including breakpoints, stepping, and variable inspection.

## Key Functions
- **main()** (L8-16): Primary test function that demonstrates variable swapping using destructuring assignment. Creates two variables, logs their initial state, swaps their values, and logs the result.

## Execution Flow
1. Initializes variables `a=1` and `b=2` (L9-10)
2. Logs initial state (L11)
3. Performs swap using destructuring assignment `[a, b] = [b, a]` (L14)
4. Logs final state (L15)
5. Auto-executes via `main()` call (L18)

## Debugging Features
- Strategic comment on L13 indicates intended breakpoint location for testing
- Variable states are logged before and after transformation for validation
- Simple control flow ideal for step-through debugging scenarios

## Dependencies
- Uses ES6 modules (export statement)
- Node.js shebang for direct execution
- Console logging for output verification

## Architecture Notes
- Mirrors equivalent Python implementation for cross-language debugger testing
- Minimal complexity to focus on debugger interaction patterns
- Self-contained with no external dependencies
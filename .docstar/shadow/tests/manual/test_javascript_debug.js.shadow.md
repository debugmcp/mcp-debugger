# tests/manual/test_javascript_debug.js
@source-hash: 6bf1c1934b3d8da3
@generated: 2026-02-09T18:15:06Z

## Purpose and Responsibility
Manual test script for JavaScript debugging functionality. Executable Node.js script that demonstrates basic mathematical operations with console output for debugging verification.

## Key Functions

**calculateSum(a, b) (L6-9)**
- Simple addition function taking two parameters
- Returns sum of inputs with intermediate result variable assignment
- Used for testing basic arithmetic debugging scenarios

**calculateProduct(numbers) (L11-17)**
- Array multiplication function using for-of loop
- Iterates through array elements, maintaining running product
- Demonstrates iterative debugging with state accumulation

**main() (L19-34)**
- Entry point orchestrating test scenarios
- Tests addition with hardcoded values (10, 20) - L21-24
- Tests multiplication with array [2, 3, 4] - L27-29
- Outputs results via console.log for debugging verification
- Includes completion message for test execution confirmation

## Execution Flow
Script auto-executes main() on load (L36), making it immediately runnable for debugging sessions.

## Dependencies
- Node.js runtime (shebang L1)
- Console API for output logging

## Architecture Notes
- Simple procedural design optimized for debugging practice
- Clear separation of concerns with dedicated calculation functions
- Predictable execution path with deterministic outputs
- No error handling - assumes valid inputs for debugging focus
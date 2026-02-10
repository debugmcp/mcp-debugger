# tests/fixtures/debug-scripts/simple-mock.js
@source-hash: 4d9d01364f0aa2d7
@generated: 2026-02-10T01:18:50Z

## Primary Purpose
Test fixture script for validating mock adapter functionality in debug environments. Serves as a simple, predictable JavaScript file for path validation and basic execution testing rather than actual runtime functionality.

## Key Functions
- **main() (L4-10)**: Simple arithmetic function that demonstrates basic variable operations and console output
  - Declares two variables (x=10, y=20) and computes their sum
  - Outputs result via console.log 
  - Returns the computed result (30)
- **main() call (L12)**: Direct invocation of the main function

## Architecture & Patterns
- Minimal standalone script pattern with single function execution
- No external dependencies or imports
- Synchronous execution flow with immediate function call
- Uses var declarations (ES5 style) for simplicity

## Testing Context
Designed specifically as a mock/fixture for testing scenarios where:
- Path validation is required but execution complexity should be minimal
- Predictable output is needed for assertion testing
- Simple JavaScript syntax validation is sufficient

## Critical Constraints
- File exists primarily for path validation, not functional execution
- Intentionally simple to avoid side effects in test environments
- Self-contained with no external dependencies
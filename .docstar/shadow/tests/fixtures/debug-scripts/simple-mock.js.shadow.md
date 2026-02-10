# tests/fixtures/debug-scripts/simple-mock.js
@source-hash: 0be9c1d9d94163a6
@generated: 2026-02-09T18:14:33Z

## Purpose
Test fixture for validating mock adapter functionality. Not intended for execution - exists solely for path validation in testing scenarios.

## Key Elements
- **main() function (L4-10)**: Simple arithmetic function that adds two hardcoded values (10 + 20), logs the result, and returns it
- **Function invocation (L12)**: Calls main() to demonstrate basic execution flow

## Structure
Minimal JavaScript structure with:
- Variable declarations and basic arithmetic (L5-7)
- Console output for debugging (L8)
- Return statement (L9)

## Usage Context
Serves as a mock script in test suites for validating:
- File path resolution
- Mock adapter behavior
- Basic JavaScript parsing/loading

## Dependencies
- None (pure JavaScript with console API only)

## Notable Characteristics
- Intentionally simple implementation
- Contains inline comments with line number references that don't match actual line positions
- Self-contained with no external dependencies
- Non-production code meant for testing infrastructure
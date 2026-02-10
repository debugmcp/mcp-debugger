# tests/fixtures/debug-scripts/with-variables.py
@source-hash: 8540bb65e9505c2f
@generated: 2026-02-10T00:41:23Z

## Purpose
Test fixture script for debugging variable inspection functionality across different data types and scopes.

## Key Functions
- `test_variables()` (L4-17): Main test function demonstrating variable inspection scenarios
  - Creates variables of different types (int, str, list, dict) for testing debugger variable display
  - Contains nested function to test scope-based variable inspection
  - Returns result from inner function call
- `inner()` (L12-14): Nested function for testing local scope variable inspection
  - Creates `local_var` with string value for scope testing
  - Returns local variable value

## Variables & Test Data
- `number = 42` (L6): Integer variable for numeric type testing
- `text = "Hello, debugger!"` (L7): String variable for text type testing  
- `items = [1, 2, 3, 4, 5]` (L8): List variable for collection type testing
- `data = {"name": "test", "value": 100}` (L9): Dictionary variable for mapping type testing
- `local_var = "inner scope"` (L13): Local variable in nested function scope

## Debug Points
- L16 (`result = inner()`): Marked as breakpoint location in comments for testing debugger functionality
- Function demonstrates multiple variable scopes (global function scope vs nested function scope)

## Execution Flow
Script executes `test_variables()` when run directly via `if __name__ == "__main__"` guard (L19-20).

## Architecture Notes
Simple linear test script designed specifically for debugger variable inspection testing. No external dependencies. Demonstrates common Python data types and nested scope scenarios that debuggers need to handle.
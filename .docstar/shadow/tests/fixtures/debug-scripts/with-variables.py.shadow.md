# tests/fixtures/debug-scripts/with-variables.py
@source-hash: 8540bb65e9505c2f
@generated: 2026-02-09T18:14:32Z

**Purpose**: Test fixture script for debugger variable inspection functionality. Demonstrates various Python data types and scoping scenarios for testing debugging tools.

**Key Functions**:
- `test_variables()` (L4-17): Main test function that creates variables of different types (int, string, list, dict) and calls a nested function to test scope handling
- `inner()` (L12-14): Nested function that creates a local variable to test debugger scope inspection

**Variable Types Tested**:
- `number` (L6): Integer literal (42)
- `text` (L7): String literal 
- `items` (L8): List with integers [1,2,3,4,5]
- `data` (L9): Dictionary with mixed types
- `local_var` (L13): String in nested scope
- `result` (L16): Return value from nested function

**Execution Flow**:
- Script entry point at L19-20 calls `test_variables()`
- Function creates variables of different types (L6-9)
- Calls nested `inner()` function (L16) - marked as breakpoint location in comment
- Returns result from nested function (L17)

**Testing Context**: 
- Comments indicate specific line numbers for breakpoint placement (L16)
- Designed to test debugger's ability to inspect variables across different scopes
- No external dependencies - pure Python standard types only

**Architecture Notes**:
- Simple linear execution flow
- Single level of function nesting to test scope boundaries
- Self-contained test data with no external state
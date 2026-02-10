# examples/debugging/test-debug-python.py
@source-hash: 034c3624d6f52339
@generated: 2026-02-09T18:14:53Z

## Primary Purpose
Test script designed for debugging with MCP debugger. Provides a simple Python program with multiple functions and variable manipulations to facilitate debugging demonstrations and testing.

## Key Functions

### `calculate_sum(a, b)` (L4-8)
- Simple arithmetic function that adds two numbers
- Includes debug-friendly print statement showing inputs and result
- Returns the calculated sum
- Used as a basic function call test case

### `process_list(items)` (L10-16) 
- Iterates through a list of items with enumeration
- Accumulates total sum while printing progress for each item
- Demonstrates loop debugging scenarios with index and value tracking
- Returns accumulated total

### `main()` (L18-36)
- Primary execution function orchestrating the debug test
- Creates test variables (x=10, y=20) for simple calculation
- Defines test list [1,2,3,4,5] for list processing
- Combines results from both functions for final output
- Returns combined result (sum_result + list_sum)

## Execution Flow
1. Script starts at `__name__ == "__main__"` guard (L38-40)
2. Calls `main()` which executes three test scenarios:
   - Simple arithmetic (L23-25)
   - List processing (L28-29) 
   - Variable combination (L32-35)
3. Final result printing at module level

## Debug-Friendly Features
- Multiple print statements throughout execution for state visibility
- Clear variable naming and intermediate result storage
- Sequential operations that can be stepped through
- Combination of different programming constructs (arithmetic, loops, variable assignment)

## Dependencies
- No external dependencies, uses only Python builtins
- Utilizes `enumerate()` for list iteration with indices
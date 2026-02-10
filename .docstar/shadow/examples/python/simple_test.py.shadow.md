# examples/python/simple_test.py
@source-hash: 0cbb6f41fc853fe5
@generated: 2026-02-09T18:14:52Z

## Purpose
Simple test script designed for debugging practice and demonstration. Contains minimal code with clear execution flow to facilitate breakpoint testing and variable inspection.

## Key Functions
- `main()` (L6-12): Core test function that performs a basic variable swap operation
  - Initializes two variables with integer values
  - Prints state before and after swap operation
  - Uses Python tuple unpacking for variable exchange (L11)
  - Designed with debugger breakpoint placement in mind

## Execution Flow
- Script entry point at L14-15 using standard `if __name__ == "__main__"` pattern
- Single function call to `main()` when run directly
- Linear execution with print statements for state visibility

## Dependencies
- No external dependencies
- Uses only built-in Python features (f-strings, tuple unpacking)

## Architectural Notes
- Minimal design optimized for debugging education
- Clear variable naming and explicit state logging
- Comment at L11 indicates intended breakpoint location
- Self-contained with no imports or complex logic
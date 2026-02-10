# examples/python_simple_swap/swap_vars.py
@source-hash: ee9ac0e81182fe46
@generated: 2026-02-09T18:14:54Z

## Purpose
Educational demonstration script showing a deliberately buggy variable swap implementation for debugging practice.

## Key Components

### `swap_variables(a, b)` (L4-14)
- **Purpose**: Attempts to swap two input variables but contains intentional bugs
- **Bug Pattern**: Sequential assignment without temporary variable preservation
  - L10: `a = b` - overwrites original `a` value
  - L11: `b = a` - assigns already-modified `a` (now equal to original `b`) back to `b`
- **Result**: Both variables end up with the value of original `b`
- **Debug Output**: Prints before/after values for debugging
- **Returns**: Tuple of (incorrectly) swapped values

### `main()` (L16-27)
- **Test Setup**: Creates test variables `x=10`, `y=20`
- **Execution**: Calls buggy swap function and captures return values
- **Validation**: Checks if swap was successful (expects x=20, y=10)
- **Output**: Reports success/failure with actual vs expected values

### Entry Point (L29-30)
Standard Python module execution pattern using `if __name__ == "__main__"`

## Educational Context
- **Learning Objective**: Demonstrates common variable swap bug
- **Correct Solutions**: Comments (L7-8) reference proper implementations:
  - Temporary variable approach: `temp = a; a = b; b = temp`
  - Python tuple assignment: `a, b = b, a`

## Expected Behavior
Script will always report "Swap NOT successful" because both variables end up equal to original `y` value (20).
# examples/python_simple_swap/swap_vars.py
@source-hash: ee9ac0e81182fe46
@generated: 2026-02-10T00:41:39Z

## Purpose
Educational demonstration script showcasing an intentionally buggy variable swap implementation for debugging practice.

## Core Functions

### `swap_variables(a, b)` (L4-14)
Intentionally flawed swap function that demonstrates a classic programming error. Takes two parameters and attempts to swap their values, but contains a logical bug where both variables end up with the same value due to improper assignment order. Includes debug print statements to trace execution.

**Bug Details:**
- L10: `a = b` - overwrites original value of `a`
- L11: `b = a` - assigns the new value of `a` (which is now `b`'s original value) to `b`
- Result: both variables contain the original value of `b`

### `main()` (L16-27)
Test harness that demonstrates the buggy swap behavior with concrete values (x=10, y=20). Includes verification logic that will detect and report the swap failure.

## Dependencies
- Standard Python print function for output
- No external imports required

## Architectural Notes
- Simple procedural design with main execution guard (L29-30)
- Comments explicitly document the correct swap approaches for educational comparison
- Verification pattern demonstrates proper testing of function behavior

## Educational Value
Serves as a debugging exercise where the expected outcome (successful swap) will fail, allowing learners to:
1. Identify the logical error in variable assignment
2. Understand the importance of temporary variables or tuple unpacking
3. Practice debugging with print statement tracing
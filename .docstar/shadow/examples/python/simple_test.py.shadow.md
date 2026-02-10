# examples/python/simple_test.py
@source-hash: 0cbb6f41fc853fe5
@generated: 2026-02-10T00:41:38Z

## Purpose
Simple Python test script designed for debugger testing and demonstration, providing a minimal program with clear execution flow for setting breakpoints.

## Structure
- **main() (L6-12)**: Core test function that performs a basic variable swap operation
  - Initializes two variables `a=1, b=2` (L8-9)
  - Prints pre-swap state (L10)
  - Performs tuple swap `a, b = b, a` (L11) - designated breakpoint location
  - Prints post-swap state (L12)
- **Entry point (L14-15)**: Standard Python main guard executing the test function

## Key Characteristics
- Executable script with shebang (L1)
- Self-contained with no external dependencies
- Deterministic behavior suitable for debugging scenarios
- Clear state changes that can be observed during debugging
- Comment on L11 explicitly indicates intended breakpoint location

## Usage Pattern
Designed as a minimal debugging target where developers can:
1. Set breakpoints on the swap operation (L11)
2. Inspect variable states before/after the operation
3. Step through simple control flow without complexity

This is a teaching/testing tool rather than production code.
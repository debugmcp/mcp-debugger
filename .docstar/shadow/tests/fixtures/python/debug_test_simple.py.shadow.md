# tests/fixtures/python/debug_test_simple.py
@source-hash: 00d270681a3e9e8a
@generated: 2026-02-10T00:41:23Z

**Purpose:** Test fixture for debugging workflow tests - provides a simple Python script with predictable execution flow and breakpoint targets for debugger functionality validation.

**Key Components:**

- `sample_function()` (L6-18): Core test function designed for debugger inspection
  - Contains local variables (a=5, b=10) for variable inspection testing
  - Line 13 serves as primary breakpoint target (c = a + b calculation)
  - Returns computed result (c * 2) for execution flow verification
  
- `main()` (L20-33): Entry point orchestrating test execution
  - Calls sample_function() and prints result for output verification
  - Includes iteration loop with sleep delays for step debugging scenarios
  - Provides clear start/completion messages for test harness integration

**Dependencies:**
- `time` module for sleep functionality in debugging scenarios

**Architectural Decisions:**
- Simple, linear execution flow to minimize debugging complexity
- Explicit variable assignments with clear computation steps
- Strategic comment placement indicating breakpoint locations (L12-13)
- Minimal external dependencies to reduce test environment requirements

**Critical Details:**
- Line 13 specifically documented as breakpoint target location
- Function contains multiple local variables at different scopes for inspection testing
- Execution includes both synchronous computation and timed operations
- Script designed for standalone execution via `if __name__ == "__main__"` pattern
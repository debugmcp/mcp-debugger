# tests/fixtures/python/debug_test_simple.py
@source-hash: 00d270681a3e9e8a
@generated: 2026-02-09T18:14:33Z

## Purpose
Test fixture for debugging workflow tests. Provides a simple, predictable execution flow with local variables and clear breakpoint targets for debugger testing scenarios.

## Key Functions

### `sample_function()` (L6-18)
Core debugging target function containing:
- Local variable initialization (`a=5`, `b=10` at L9-10)
- **Primary breakpoint target at L13** (`c = a + b`) - explicitly documented as test breakpoint location
- Sequential computation flow for variable inspection testing
- Returns computed result (`c * 2`)

### `main()` (L20-33)
Entry point orchestrating test execution:
- Calls `sample_function()` and displays result (L25-26)
- Includes timed loop with sleep delays (L29-31) for extended debugging scenarios
- Provides console output for execution tracking

## Dependencies
- `time` module for sleep functionality in main loop

## Architecture Notes
- Designed as standalone executable (`if __name__ == "__main__"` guard at L35-36)
- Simple linear execution flow optimized for debugger step-through testing
- Comments explicitly mark breakpoint locations for test automation
- No complex control flow or exception handling - intentionally minimal for debugging clarity

## Testing Context
File serves as controlled environment for debugger workflow validation, with predictable variable states and execution points.
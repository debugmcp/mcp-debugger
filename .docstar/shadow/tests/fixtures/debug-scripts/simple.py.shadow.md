# tests/fixtures/debug-scripts/simple.py
@source-hash: d61ab3471568e71b
@generated: 2026-02-10T01:18:50Z

## Purpose
Simple debugging test script designed for breakpoint testing and debugging workflow validation. Provides a minimal executable with predictable behavior and clearly marked breakpoint locations.

## Key Functions
- `main()` (L4-9): Core function performing basic arithmetic operation (10 + 20 = 30) with strategic comment markers indicating intended breakpoint locations at lines 5, 7, and 9
- Entry point (L11-12): Standard Python module execution pattern calling main() when script is run directly

## Structure & Flow
1. Variable initialization (L5-6): Sets x=10, y=20
2. Computation (L7): Calculates sum and stores in result
3. Output (L8): Prints formatted result string
4. Return (L9): Returns computed value

## Dependencies
- Standard library only (print, f-strings)
- No external imports

## Debugging Context
Comments explicitly mark three breakpoint locations:
- Line 5: Initial variable state inspection
- Line 7: Pre/post computation state
- Line 9: Final result verification

The script provides a controlled environment for testing debugger functionality, step-through operations, and breakpoint behavior with minimal complexity.
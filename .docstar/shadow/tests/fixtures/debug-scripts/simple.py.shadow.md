# tests/fixtures/debug-scripts/simple.py
@source-hash: 9b91108e7aa62368
@generated: 2026-02-09T18:14:30Z

## Purpose
Test fixture script for debugging functionality. Provides a simple, predictable code structure with clearly marked breakpoint locations for testing debugger capabilities.

## Key Functions
- `main()` (L4-9): Core function demonstrating basic arithmetic operations with strategic comment markers indicating intended breakpoint locations
  - Variable initialization: `x = 10` (L5), `y = 20` (L6)
  - Computation: `result = x + y` (L7)
  - Output: `print(f"Result: {result}")` (L8)
  - Return value: `result` (L9)

## Entry Point
- Script execution guard (L11-12): Standard Python idiom calling `main()` when run directly

## Architecture Notes
- Deliberately simple linear execution flow for predictable debugging behavior
- Comments explicitly mark "breakpoint" locations (L5, L7, L9), suggesting this is designed for step-through debugging tests
- No external dependencies beyond Python standard library
- Single return path with deterministic output (always prints "Result: 30")

## Usage Context
Located in `tests/fixtures/debug-scripts/`, indicating this serves as test data for debugging-related functionality rather than production code.
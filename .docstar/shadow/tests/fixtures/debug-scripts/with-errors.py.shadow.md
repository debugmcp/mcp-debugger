# tests/fixtures/debug-scripts/with-errors.py
@source-hash: 5f1ef6fe59c5429c
@generated: 2026-02-10T01:18:48Z

## Purpose
Test fixture script designed to generate ZeroDivisionError exceptions for debugging/testing purposes.

## Key Components
- **divide() (L4-5)**: Simple division function that performs `a / b` operation, intentionally vulnerable to ZeroDivisionError when b=0
- **main() (L7-12)**: Entry point that sets up error conditions by calling divide(10, 0), guaranteed to throw exception at L10
- **Execution flow (L14-15)**: Standard Python module pattern with `if __name__ == "__main__"` guard

## Architecture
Simple procedural script with intentional error path. The divide function has no error handling, making it suitable for testing exception handling in debugging tools or test frameworks.

## Critical Invariants
- Will always throw ZeroDivisionError when executed
- Lines 11-12 are unreachable due to unhandled exception at L10
- Designed for controlled failure scenarios

## Dependencies
None - uses only Python builtins
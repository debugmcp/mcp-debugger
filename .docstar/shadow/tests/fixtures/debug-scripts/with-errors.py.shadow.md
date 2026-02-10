# tests/fixtures/debug-scripts/with-errors.py
@source-hash: 447149c2b4a90400
@generated: 2026-02-09T18:14:36Z

## Purpose
Test fixture script designed to generate runtime exceptions for debugging/testing purposes. Deliberately creates a ZeroDivisionError to test error handling, logging, or debugging tools.

## Key Functions
- **divide(a, b)** (L4-5): Simple division function that will raise ZeroDivisionError when b=0
- **main()** (L7-12): Entry point that orchestrates the error scenario by calling divide(10, 0)

## Execution Flow
1. Sets x=10, y=0 (L8-9)
2. Calls divide(10, 0) which triggers ZeroDivisionError at L5
3. Lines 11-12 are unreachable due to unhandled exception

## Architecture Notes
- Classic test fixture pattern for exception scenarios
- No error handling implemented (intentional for testing)
- Standard Python executable script structure with `if __name__ == "__main__"` guard (L14-15)

## Dependencies
- Standard Python library only
- Executable via shebang `#!/usr/bin/env python3`

## Critical Behavior
- **Always fails** with ZeroDivisionError when executed
- Designed for testing error conditions, not normal operation
- Exception occurs at L5 during division operation
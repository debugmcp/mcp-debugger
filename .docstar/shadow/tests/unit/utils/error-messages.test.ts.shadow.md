# tests/unit/utils/error-messages.test.ts
@source-hash: 892bd0c3398a57d8
@generated: 2026-02-09T18:14:42Z

## Purpose
Unit test file for error message utilities, validating timeout message formatting and error message extraction functionality.

## Test Structure
- **ErrorMessages tests (L5-29)**: Validates static error message builders for various timeout scenarios
- **getErrorMessage tests (L31-38)**: Validates error message extraction from different input types

## Key Test Cases

### ErrorMessages Class Tests
- **dapRequestTimeout test (L6-10)**: Verifies DAP (Debug Adapter Protocol) request timeout messages include command name and timeout duration
- **proxyInitTimeout test (L12-16)**: Validates debug proxy initialization timeout messages with duration and case-insensitive "debug proxy" text
- **stepTimeout test (L18-22)**: Confirms step operation timeout messages include duration and "Step operation" text
- **adapterReadyTimeout test (L24-28)**: Ensures debug adapter ready timeout messages contain duration and "debug adapter" text

### Error Extraction Tests
- **getErrorMessage test (L32-37)**: Tests error message extraction from:
  - Error objects → extracts `.message` property
  - String inputs → returns as-is
  - Generic objects → converts to string representation
  - Primitive values → converts to string

## Dependencies
- **Vitest**: Testing framework (L1)
- **ErrorMessages**: Static utility class from `src/utils/error-messages.js` (L2)
- **getErrorMessage**: Error extraction function from `src/errors/debug-errors.js` (L3)

## Testing Patterns
- Uses `toContain()` for partial string matching
- Uses `toMatch()` with regex for case-insensitive pattern matching
- Tests multiple input types for robust error handling validation
# tests/unit/utils/error-messages.test.ts
@source-hash: 892bd0c3398a57d8
@generated: 2026-02-10T00:41:33Z

**Primary Purpose**: Unit test suite for error message utilities, validating timeout message generation and error message extraction functionality.

**Test Structure**:
- **ErrorMessages tests (L5-29)**: Validates static methods that generate timeout-related error messages
  - `dapRequestTimeout` test (L6-10): Verifies DAP (Debug Adapter Protocol) request timeout messages include command name and timeout duration
  - `proxyInitTimeout` test (L12-16): Validates debug proxy initialization timeout messages contain duration and "debug proxy" text
  - `stepTimeout` test (L18-22): Ensures step operation timeout messages include duration and "Step operation" text
  - `adapterReadyTimeout` test (L24-28): Confirms debug adapter ready timeout messages contain duration and "debug adapter" text

- **getErrorMessage tests (L31-38)**: Validates error message extraction from various input types
  - Tests extraction from Error objects, strings, plain objects, and primitive values
  - Verifies consistent string conversion behavior across different input types

**Key Dependencies**:
- `vitest` testing framework for test structure and assertions
- `ErrorMessages` utility class from `src/utils/error-messages.js`
- `getErrorMessage` function from `src/errors/debug-errors.js`

**Testing Patterns**:
- Uses `toContain()` for partial string matching of expected content
- Uses `toMatch()` with regex for case-insensitive pattern matching
- Uses `toBe()` for exact string equality assertions
- All timeout tests follow pattern of verifying both timeout duration and contextual keywords

**Coverage**: Tests cover timeout message generation for different debug operations and robust error message extraction from mixed input types.
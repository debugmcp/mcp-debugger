# packages/adapter-javascript/tests/unit/javascript-debug-adapter.errors.edge.test.ts
@source-hash: 87955e1bd4535c0e
@generated: 2026-02-09T18:14:00Z

## Purpose
Unit test file for edge cases in JavaScript debug adapter error handling utilities. Specifically tests the error message translation and installation instruction features of `JavascriptDebugAdapter`.

## Key Components

**Test Setup (L5-21)**
- Creates minimal `AdapterDependencies` stub with mocked logger methods
- Uses vitest mocking framework with beforeEach cleanup
- Instantiates fresh `JavascriptDebugAdapter` instance per test

**Error Translation Tests (L23-70)**
- `translateErrorMessage` for ENOENT/not found errors (L23-35): Tests case-insensitive detection of Node.js runtime missing scenarios
- `translateErrorMessage` for permission errors (L37-46): Tests EACCES and permission denied message handling
- `translateErrorMessage` for TypeScript module errors (L48-56): Tests specific handling of ts-node/tsx missing module errors with install hints
- `translateErrorMessage` for generic module not found (L58-65): Tests fallback behavior for generic module missing scenarios
- Pass-through behavior test (L67-70): Ensures unrelated error messages remain unchanged

**Installation Instructions Tests (L72-83)**
- Tests `getInstallationInstructions()` contains expected content (nodejs.org, tsx, ts-node, tsconfig-paths)
- Tests `getMissingExecutableError()` includes runtime not found message with PATH and nodejs.org references

## Dependencies
- **vitest**: Testing framework with mocking capabilities
- **JavascriptDebugAdapter**: Main class under test from `../../src/index.js`
- **@debugmcp/shared**: Provides `AdapterDependencies` type interface

## Test Patterns
- Case-insensitive string matching for error detection
- Regex-based assertions using `.toMatch()` for flexible string validation
- Loop-based testing for multiple similar error scenarios
- Mock restoration and cleanup in beforeEach hooks
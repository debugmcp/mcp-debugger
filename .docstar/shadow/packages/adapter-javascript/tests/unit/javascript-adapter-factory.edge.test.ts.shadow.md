# packages/adapter-javascript/tests/unit/javascript-adapter-factory.edge.test.ts
@source-hash: f7888160fc939997
@generated: 2026-02-09T18:14:03Z

## Purpose
Edge case unit tests for JavascriptAdapterFactory validation logic, specifically testing error handling and boundary conditions in the adapter validation process.

## Core Test Structure
- **Main test suite** (L14-113): `JavascriptAdapterFactory.validate (edge branches)` - Tests unusual/error conditions
- **Setup/teardown hooks** (L18-31): Preserve and restore `process.env.PATH` and `process.version` between tests
- **Helper functions**:
  - `norm()` (L7-9): Normalizes path strings by replacing backslashes with forward slashes
  - `isVendorPath()` (L10-12): Detects vendor js-debug server paths

## Key Dependencies
- **vitest**: Testing framework with mocking capabilities
- **fs**: File system operations (mocked in tests)
- **path**: Path manipulation utilities
- **JavascriptAdapterFactory** (L5): Main class under test from `../../src/index.js`

## Test Scenarios

### Vendor Path Error Handling (L33-49)
Tests filesystem error resilience when checking for vendor js-debug adapter:
- Mocks `fs.existsSync` to throw errors on vendor path checks
- Verifies errors are caught and treated as "missing vendor"
- Expected outcome: `valid: false` with specific error message

### TypeScript Runner Detection (L51-86)
Tests early termination logic when multiple TS runners found:
- Simulates both `tsx` and `ts-node` present in first PATH directory
- Tests cross-platform executable variants (.cmd, .exe, no extension)
- Verifies no warning issued when both runners detected
- Expected outcome: `valid: true`, both `tsxFound` and `tsNodeFound` flags set

### PATH Entry Error Resilience (L88-112)
Tests robustness when filesystem operations fail on PATH directories:
- Mocks selective fs errors for specific PATH entries
- Verifies validation completes without throwing exceptions
- Tests `existsSafe` error swallowing behavior
- Expected outcome: Validation completes successfully despite fs errors

## Test Patterns
- **Mock-heavy approach**: Extensive use of `vi.spyOn()` to control filesystem behavior
- **Environment manipulation**: Modifies `process.env.PATH` to simulate different system states  
- **Error injection**: Deliberately triggers filesystem errors to test error handling paths
- **Cross-platform awareness**: Tests platform-specific executable extensions

## Critical Invariants
- Validation must never throw unhandled exceptions, even with filesystem errors
- Vendor path availability is primary validation criterion
- PATH scanning should be resilient to individual directory access failures
- TypeScript runner detection should optimize by early termination when multiple runners found
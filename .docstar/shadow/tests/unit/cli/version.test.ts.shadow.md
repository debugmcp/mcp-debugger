# tests/unit/cli/version.test.ts
@source-hash: c7d94f832e06fb89
@generated: 2026-02-10T00:41:30Z

## Purpose
Unit test suite for the CLI version utility module, testing the `getVersion` function's behavior under various success and failure scenarios.

## Test Structure
- **Main describe block** (L7): "Version Utility" - contains all test cases
- **Setup/teardown** (L10-17): Console error spy management with beforeEach/afterEach hooks
- **Six test cases** covering different scenarios:

## Key Test Cases
1. **Happy path** (L19-31): Verifies successful version extraction from valid package.json
2. **Missing version field** (L33-44): Tests fallback to "0.0.0" when version field absent
3. **File read failure** (L46-56): Tests error handling when fs.readFileSync throws
4. **Invalid JSON** (L58-65): Tests JSON parsing error handling
5. **Empty package.json** (L67-73): Tests behavior with empty JSON object
6. **Silenced console output** (L75-85): Tests error suppression via environment variable

## Dependencies & Mocking
- **Vitest testing framework**: describe, it, expect, vi, beforeEach, afterEach (L1)
- **Node.js fs module**: Mocked via `vi.mock('fs')` (L2, L5)
- **Target module**: `getVersion` from `../../../src/cli/version.js` (L3)

## Test Patterns
- **Console spy pattern** (L8, L11): Captures and silences console.error calls
- **Mock data pattern** (L20-23, L34-37): Creates realistic package.json structures
- **Error simulation** (L47-50, L77-79): Forces exceptions to test error paths
- **Environment variable testing** (L76, L84): Tests conditional behavior based on env vars

## Assertions
- Version string validation against expected values
- File system interaction verification via mock call expectations
- Error logging behavior validation through console spy
- Environment-based conditional logging verification
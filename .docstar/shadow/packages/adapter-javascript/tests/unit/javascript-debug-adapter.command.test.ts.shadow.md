# packages/adapter-javascript/tests/unit/javascript-debug-adapter.command.test.ts
@source-hash: 6154aa1a68fa7118
@generated: 2026-02-10T00:41:07Z

## Purpose
Unit test file for the `JavascriptDebugAdapter.buildAdapterCommand` method, focusing on command construction and NODE_OPTIONS environment variable handling for stdio-based debug adapter execution.

## Key Components

### Test Utilities (L7-12)
- `norm(p: unknown)`: Normalizes file paths by converting backslashes to forward slashes for cross-platform compatibility
- `isVendorPath(p: unknown)`: Validates that paths end with the expected debug server location `/vendor/js-debug/vsDebugServer.cjs`

### Test Setup (L15-37)
- `deps` (L15-23): Minimal `AdapterDependencies` stub with no-op logger methods, type-cast to satisfy interface requirements
- `defaultConfig` (L29-37): Standard test configuration with platform-specific paths for Node executable, log directory, and script paths

### Test Structure
The test suite validates `JavascriptDebugAdapter.buildAdapterCommand` behavior:

**Command Construction Test (L55-80)**
- Verifies command uses provided Node executable path
- Validates argument structure: `[adapterPath, port, host]`
- Ensures adapter path is absolute and points to correct vendor location
- Tests cross-platform path handling

**Environment Variable Tests (L82-140)**
- **Basic NODE_OPTIONS handling (L82-98)**: Ensures NODE_OPTIONS includes `--max-old-space-size=4096` without mutating `process.env`
- **Preservation test (L100-111)**: Verifies existing NODE_OPTIONS are preserved and new flags appended with single space separation  
- **Idempotency test (L113-127)**: Confirms multiple calls don't duplicate the memory flag
- **Override prevention (L129-140)**: Ensures existing max-old-space-size flags (any value, case-insensitive) are not overridden

## Architecture Patterns
- Uses Vitest testing framework with mocking capabilities
- Cross-platform testing with Windows/Unix path normalization
- Environment variable isolation using beforeEach/afterEach cleanup
- Type casting for test stub objects to satisfy TypeScript interfaces

## Dependencies
- `@debugmcp/shared` types for `AdapterDependencies` and `AdapterConfig`
- `JavascriptDebugAdapter` from main source
- Standard Node.js `path` module for path validation
# packages/adapter-javascript/tests/unit/javascript-debug-adapter.command.test.ts
@source-hash: 6154aa1a68fa7118
@generated: 2026-02-09T18:14:02Z

## Purpose
Unit test file for `JavascriptDebugAdapter.buildAdapterCommand()` method, focusing on command construction, argument validation, and NODE_OPTIONS environment variable handling for stdio-based debugging sessions.

## Key Test Components

### Helper Functions (L6-12)
- `norm()` (L7-9): Cross-platform path normalization helper converting backslashes to forward slashes
- `isVendorPath()` (L10-12): Validates that adapter path ends with expected vendor debug server location

### Test Setup (L14-37)
- `deps` (L15-23): Minimal AdapterDependencies stub with logger interface, cast for type compatibility
- `defaultConfig` (L29-37): Platform-aware test configuration with Windows/Unix path handling
- Environment management (L39-53): Preserves and restores NODE_OPTIONS between tests

### Core Test Cases

#### Command Structure Validation (L55-80)
Tests `buildAdapterCommand()` output structure:
- Verifies command equals provided Node executable path
- Validates args array format: `[adapterPath, port, host]`
- Confirms adapter path is absolute and points to `vendor/js-debug/vsDebugServer.cjs`
- Ensures port and host arguments match configuration

#### Environment Variable Handling (L82-141)
Four test scenarios for NODE_OPTIONS management:

1. **Basic Environment Setup** (L82-98): Confirms NODE_OPTIONS includes memory flag without mutating process.env
2. **Existing Options Preservation** (L100-111): Tests appending memory flag to existing NODE_OPTIONS with proper spacing
3. **Idempotency** (L113-127): Ensures multiple calls don't duplicate the memory flag
4. **Override Prevention** (L129-140): Prevents adding memory flag when one already exists (case-insensitive)

## Key Behaviors
- Cross-platform compatibility with Windows/Unix path handling
- Memory optimization via `--max-old-space-size=4096` flag injection
- Non-destructive environment variable manipulation
- Absolute path resolution for debug adapter executable

## Dependencies
- `vitest` testing framework
- `JavascriptDebugAdapter` from main source
- `@debugmcp/shared` types for AdapterConfig and AdapterDependencies

## Test Architecture
Follows arrange-act-assert pattern with comprehensive environment cleanup and platform-specific path handling for reliable cross-platform execution.
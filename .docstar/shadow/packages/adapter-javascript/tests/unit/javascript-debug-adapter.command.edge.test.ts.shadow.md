# packages/adapter-javascript/tests/unit/javascript-debug-adapter.command.edge.test.ts
@source-hash: ccfc0a560f315720
@generated: 2026-02-10T00:41:07Z

## Unit Test for JavascriptDebugAdapter Command Building Edge Cases

**Primary Purpose**: Tests the stability and correctness of `JavascriptDebugAdapter.buildAdapterCommand()` method under various NODE_OPTIONS environment variable scenarios, ensuring consistent behavior across repeated calls without side effects.

### Key Test Components

**Test Setup** (L4-31):
- `deps` (L5-12): Minimal mock of `AdapterDependencies` with no-op logger methods
- `isVendorPath()` (L14-16): Helper function to validate adapter executable path points to vendor debug server
- `baseConfig` (L22-30): Standard adapter configuration with platform-specific paths for Node.js executable, log directory, and script path

**Environment Management** (L32-46):
- Preserves and restores original `NODE_OPTIONS` environment variable
- Uses Vitest lifecycle hooks for clean test isolation
- Restores all mocks after each test

### Test Scenarios

**Existing Memory Flag Test** (L48-66):
- Tests behavior when `NODE_OPTIONS` already contains `--MAX-OLD-SPACE-SIZE=2048`
- Verifies whitespace normalization occurs only once without duplication
- Ensures original process environment remains unchanged
- Validates adapter path points to correct vendor location

**Missing Memory Flag Test** (L68-82):
- Tests automatic addition of `--max-old-space-size=4096` when memory flag absent
- Verifies preservation of existing flags while adding default memory setting
- Confirms whitespace normalization and stability across multiple calls

**Empty Environment Test** (L84-94):
- Tests default behavior when `NODE_OPTIONS` is undefined
- Verifies only memory flag is added with default 4096MB limit
- Confirms no side effects on process environment

### Critical Test Patterns

- **Idempotency**: All tests verify repeated calls produce identical results
- **Environment Isolation**: Process environment modifications don't persist between tests
- **Cross-platform Compatibility**: Uses platform detection for Windows vs Unix paths
- **Whitespace Handling**: Tests proper normalization of environment variable formatting
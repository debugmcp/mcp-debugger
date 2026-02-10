# packages/adapter-javascript/tests/unit/javascript-debug-adapter.runtime.edge.test.ts
@source-hash: 5512ad072db8e1f8
@generated: 2026-02-10T21:25:31Z

## Purpose
Unit test file providing edge case coverage for JavascriptDebugAdapter's private runtime helper methods. Tests adapter configuration methods and executable path resolution behavior with caching.

## Key Test Structure
- **Test Suite** (L20-64): "JavascriptDebugAdapter private runtime helpers (edge coverage)"
- **Setup/Teardown** (L23-31): Standard vitest beforeEach/afterEach with mock cleanup
- **Test Group** (L33-63): "misc small helpers" - tests adapter metadata and executable resolution

## Dependencies
- **JavascriptDebugAdapter** (L4): Main class under test from `../../src/index.js`
- **Mock Dependencies** (L7-14): Stubbed AdapterDependencies with logger mocks
- **Utility Function** (L16-18): `norm()` for path normalization (backslash to forward slash)

## Test Coverage Areas

### Adapter Metadata Tests (L34-40)
Tests basic adapter configuration methods:
- `getAdapterModuleName()` → expects 'js-debug'
- `getAdapterInstallCommand()` → expects to match @vscode/js-debug pattern
- `getDefaultLaunchConfig()` → validates object structure with cwd property

### Executable Resolution Tests (L42-46)
Tests executable discovery:
- `getDefaultExecutableName()` → expects 'node'
- `getExecutableSearchPaths()` → validates array return type

### Cache Override Test (L48-62)
Complex test verifying executable path resolution with caching behavior:
1. Calls `resolveExecutablePath()` without params to establish cache
2. Mocks `findNode` from executable-resolver module
3. Calls `resolveExecutablePath(customPath)` to test preferredPath override
4. Validates custom path overrides cached value

## Architectural Patterns
- Uses vitest mocking for isolated unit testing
- Employs dynamic imports for selective module mocking (L56)
- Implements path normalization for cross-platform compatibility
- Tests both happy path and override scenarios for caching logic
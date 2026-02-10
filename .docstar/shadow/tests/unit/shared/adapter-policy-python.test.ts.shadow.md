# tests/unit/shared/adapter-policy-python.test.ts
@source-hash: 36c00b4ddcc9b163
@generated: 2026-02-10T00:41:36Z

## Purpose
Unit test suite for PythonAdapterPolicy class, validating Python debug adapter behavior, environment handling, and state management.

## Test Structure
**Main describe block (L4-101)**: Comprehensive test coverage with environment mocking setup
- **beforeEach (L8-11)**: Captures original PYTHON_PATH env var and process.platform property for restoration
- **afterEach (L13-23)**: Restores original environment state to prevent test interference

## Key Test Cases

### Child Session Rejection (L25-27)
Tests that `buildChildStartArgs()` throws exception for unsupported child session functionality.

### Local Variable Extraction (L29-55)
Validates `extractLocalVariables()` method:
- Filters out special Python variables (names starting with underscore or containing "special")
- Preserves standard variables and `__name__` 
- Uses mock frames, scopes, and variables data structures

### Executable Path Resolution (L57-72)
Tests `resolveExecutablePath()` precedence logic:
- Explicit path parameter takes highest precedence
- Falls back to PYTHON_PATH environment variable
- Platform-specific defaults: 'python' on Windows, 'python3' on Unix-like systems
- Manipulates `process.platform` using `Object.defineProperty()`

### Command Queueing and State Management (L74-87)
Validates adapter state behavior:
- Command queueing disabled by default
- Initial state reports as uninitialized
- 'initialized' event triggers both initialized and connected states
- 'configurationDone' command updates corresponding state flag

### Adapter Matching (L89-96)
Tests `matchesAdapter()` method recognizes Python debugpy adapter command signature (`python -m debugpy.adapter`).

### Initialization Behavior (L98-100)
Confirms `getInitializationBehavior()` returns empty object.

## Dependencies
- **vitest**: Test framework providing describe/it/expect/beforeEach/afterEach
- **PythonAdapterPolicy**: Main class under test from shared interfaces

## Testing Patterns
- Environment variable mocking with proper cleanup
- Process platform spoofing for cross-platform testing
- Mock data structures for complex object interactions
- State mutation validation
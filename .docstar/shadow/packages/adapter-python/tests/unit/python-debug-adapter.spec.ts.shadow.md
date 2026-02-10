# packages/adapter-python/tests/unit/python-debug-adapter.spec.ts
@source-hash: 58c5df4f1ff50aa6
@generated: 2026-02-10T00:41:07Z

## Purpose
Unit test suite for the PythonDebugAdapter class, validating initialization, error handling, environment validation, and state management functionality.

## Test Infrastructure
- **createDependencies() (L6-21)**: Factory function creating mock dependencies with stubbed fileSystem, processLauncher, environment services, and Vitest-spied logger methods
- **setSuccessfulEnvironment() (L23-28)**: Test helper that mocks all Python environment checks to return successful values (executable path, version 3.10.1, debugpy installed, no virtual env)

## Key Test Cases

### Initialization Tests
- **Successful initialize test (L37-49)**: Verifies adapter transitions to READY state, emits 'initialized' event, and returns correct ready status when environment setup succeeds
- **Failed initialize test (L51-62)**: Tests initialization failure when debugpy is missing, expects ENVIRONMENT_INVALID error code and ERROR state

### Environment Validation
- **validateEnvironment test (L64-80)**: Tests comprehensive environment validation with multiple issues (Python 3.6.9 too old, debugpy missing, virtual env detected). Validates error reporting structure and logging behavior

### Lifecycle Management
- **dispose test (L82-91)**: Verifies proper cleanup - state reset to UNINITIALIZED, thread ID cleared, ready status false

### Error Handling
- **translateErrorMessage test (L93-97)**: Tests user-friendly error message translation for ENOENT system errors

## Dependencies
- **@debugmcp/shared**: Provides AdapterState enum, AdapterErrorCode enum, and AdapterDependencies interface
- **PythonDebugAdapter**: Main class under test from relative import
- **Vitest**: Testing framework with spies and mocking capabilities

## Testing Patterns
- Uses type casting with `(adapter as any)` to mock private methods for controlled testing scenarios
- Event-driven testing with adapter.on() listeners
- Promise-based async testing with expect().rejects patterns
- Comprehensive error validation using expect.objectContaining() and expect.arrayContaining() matchers
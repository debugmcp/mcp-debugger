# packages/adapter-python/tests/unit/python-debug-adapter.spec.ts
@source-hash: 58c5df4f1ff50aa6
@generated: 2026-02-09T18:14:05Z

## Purpose
Unit test suite for the PythonDebugAdapter class, verifying initialization, environment validation, state transitions, and error handling behaviors.

## Test Structure
- **Main describe block (L30-98)**: Groups all PythonDebugAdapter tests
- **beforeEach setup (L33-35)**: Creates fresh mock dependencies for each test
- **Test dependencies factory (L6-21)**: Creates mock AdapterDependencies with vi.fn() stubs for filesystem, process launcher, environment, and logger

## Key Test Scenarios

### Initialization Tests
- **Successful initialization (L37-49)**: Verifies adapter transitions to READY state and emits 'initialized' event when all environment checks pass
- **Failed initialization (L51-62)**: Tests error state transition when debugpy is missing, expecting ENVIRONMENT_INVALID error code

### Environment Validation Tests  
- **Environment validation (L64-80)**: Tests validation with old Python version (3.6.9) and missing debugpy, verifying multiple error conditions are reported correctly

### State Management Tests
- **Dispose functionality (L82-91)**: Confirms adapter resets to UNINITIALIZED state and clears thread ID after disposal
- **Error message translation (L93-97)**: Tests user-friendly error message generation for ENOENT errors

## Test Utilities
- **setSuccessfulEnvironment helper (L23-28)**: Mocks all environment checks to return successful values (Python 3.10.1, debugpy installed, no virtual env)
- **Mock strategy**: Uses vi.fn() to mock private methods via type assertion casting

## Dependencies
- **vitest**: Testing framework with mocking capabilities
- **@debugmcp/shared**: Provides AdapterState enum, AdapterErrorCode enum, and AdapterDependencies interface
- **PythonDebugAdapter**: The class under test from the main source

## Test Patterns
Tests follow AAA pattern (Arrange-Act-Assert) with consistent mocking of private methods to control environment validation outcomes. Event emission testing uses arrays to capture async events.
# packages/adapter-python/tests/unit/python-adapter-factory.test.ts
@source-hash: 28a0bb6940aeaa3c
@generated: 2026-02-09T18:14:09Z

## Primary Purpose
Unit test suite for `PythonAdapterFactory` class, validating adapter creation, metadata retrieval, and environment validation functionality for Python debugging support.

## Test Structure & Mocking (L1-74)
- Uses Vitest testing framework with comprehensive mocking setup
- Mocks Python utilities: `findPythonExecutable` and `getPythonVersion` (L11-14)
- Mocks Node.js `child_process.spawn` for debugpy detection (L16-22)
- Mock variables: `findPythonExecutableMock`, `getPythonVersionMock`, `spawnMock` (L24-26)

## Test Utilities
- `createDependencies()` (L28-43): Factory function creating mock `AdapterDependencies` with stubbed logger, filesystem, process launcher, and environment
- `simulateSpawn()` (L45-66): Helper function simulating child process behavior with configurable output, exit codes, and error conditions using EventEmitter pattern

## Core Test Cases

### Adapter Creation (L76-81)
Tests factory pattern implementation - verifies `PythonAdapterFactory.createAdapter()` returns `PythonDebugAdapter` instances

### Metadata Validation (L83-96)
Validates `getMetadata()` returns correct adapter information:
- Language: Python
- Version: 2.0.0
- File extensions: .py, .pyw
- Documentation URL and author details

### Environment Validation Tests (L98-173)
Comprehensive validation scenarios:

**Success Case (L98-114)**: Valid Python 3.10.1 + debugpy 1.8.1 environment
- Expects: `valid: true`, empty errors/warnings
- Includes platform details in response

**Python Not Found (L116-124)**: Handles missing Python executable
- Expects: `valid: false` with "Python executable not found" error

**Version Too Old (L126-136)**: Python 3.6.9 below minimum 3.7 requirement
- Expects: `valid: false` with version requirement error

**Version Unknown (L138-149)**: Handles undefined Python version
- Expects: `valid: true` with warning about undetermined version

**Debugpy Missing (L151-173)**: Two scenarios for missing debugpy:
- Exit code 1 (L151-161): Non-zero exit from version check
- Spawn error (L163-173): Process spawn failure
- Both expect: `valid: false` with debugpy installation instruction

## Key Dependencies
- `@debugmcp/shared`: `AdapterDependencies`, `DebugLanguage` enums
- Source modules: `PythonAdapterFactory`, `PythonDebugAdapter`, Python utilities
- Node.js: `child_process`, `events` for process simulation

## Testing Patterns
- BeforeEach cleanup (L69-74) ensures test isolation
- Mock simulation pattern for external process dependencies
- Comprehensive error path coverage for environment validation
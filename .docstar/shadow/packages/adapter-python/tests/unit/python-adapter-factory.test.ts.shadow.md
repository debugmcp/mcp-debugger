# packages\adapter-python\tests\unit\python-adapter-factory.test.ts
@source-hash: 5267f58c9c0967e8
@generated: 2026-02-23T15:26:01Z

**Purpose:** Comprehensive unit test suite for the PythonAdapterFactory class, validating factory pattern implementation, environment validation, and error handling for Python debugging capabilities.

## Key Test Components

### Mock Setup (L11-26)
- Mocks `python-utils.js` functions (`findPythonExecutable`, `getPythonVersion`) 
- Mocks Node.js `child_process.spawn` while preserving other exports
- Creates typed mock references for test assertions

### Test Utilities (L28-66)
- `createDependencies()` (L28-43): Factory function creating mock `AdapterDependencies` with minimal logger, filesystem, process launcher, and environment implementations
- `simulateSpawn()` (L45-66): Mock helper simulating child process spawn behavior with configurable output, exit codes, and error conditions using EventEmitter patterns

### Core Test Coverage

**Factory Functionality (L76-96):**
- Validates `PythonDebugAdapter` instance creation
- Verifies metadata accuracy (language, version, file extensions, documentation URL)

**Environment Validation Success Cases (L98-149):**
- Happy path: Python 3.10.1 + debugpy 1.8.1 available
- Graceful degradation: Missing Python version (warns but validates)

**Environment Validation Failure Cases (L116-175):**
- Python executable not found (validation fails)
- Python version below 3.7 requirement (validation fails) 
- debugpy detection failures (warns but doesn't fail validation)

**Critical Edge Case (L177-197):**
- **Issue #16 scenario**: System Python found but debugpy missing (virtualenv case)
- Must return `valid: true` with warnings to allow adapter registration
- Addresses real-world deployment where debugpy exists in project virtualenv but not system-wide

## Dependencies
- **Test Framework:** Vitest with mocking capabilities
- **Source Modules:** PythonAdapterFactory, python-utils, shared types
- **External:** Node.js child_process, events modules

## Architecture Patterns
- **Factory Pattern Testing:** Validates adapter instance creation and metadata provision
- **Environment Validation Strategy:** Distinguishes between hard failures (missing Python, wrong version) and soft failures (missing debugpy)
- **Async Mock Simulation:** Uses `queueMicrotask()` to simulate realistic async spawn behavior
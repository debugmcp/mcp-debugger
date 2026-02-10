# packages/adapter-python/tests/unit/python-utils.discovery.test.ts
@source-hash: 53cf9adb5e97206a
@generated: 2026-02-09T18:14:08Z

## Python Discovery Unit Tests

Test suite for Python executable discovery functionality in the adapter-python package. Tests the `findPythonExecutable` function's behavior across different platforms and environment configurations.

### Primary Purpose
Validates Python executable auto-detection logic, including environment variable handling, platform-specific behavior, debugpy module verification, and error reporting mechanisms.

### Key Test Infrastructure

**Mock Setup (L6-26)**
- Mocks `child_process.spawn` to simulate Python process execution
- Defines `ChildProcessMock` type for simulated process objects
- `createSpawn` helper (L28-45) generates mock processes with configurable exit codes and output

**Environment Management (L47-60)**
- Preserves and restores original environment variables
- Clears Python-specific env vars (`pythonLocation`, `PythonLocation`) between tests
- Resets all mocks after each test

### Test Scenarios

**Linux Auto-Detection (L62-88)**
- Tests discovery of `python3` and `python` executables via PATH
- Verifies debugpy module presence check with version output parsing
- Uses mock `CommandFinder` to simulate filesystem command resolution

**Windows Environment Variables (L90-130)**
- Tests `pythonLocation` environment variable preference on Windows
- Mocks `fs.existsSync` to simulate Python installation paths
- Validates debugpy check with conditional spawn behavior based on arguments

**Custom PYTHON_PATH (L132-170)**
- Tests explicit Python path specification via `PYTHON_PATH` environment variable
- Overrides default discovery mechanisms when custom path provided
- Verifies proper CommandFinder integration

**Error Handling (L172-200)**
- Tests discovery failure scenarios with empty PATH and missing executables
- Validates error logging with `[PYTHON_DISCOVERY_FAILED]` markers
- Simulates CI environment conditions

**Debugpy Fallback (L202-228)**
- Tests fallback behavior when debugpy module is unavailable
- Verifies selection of first valid Python executable when debugpy checks fail
- Confirms multiple spawn attempts during discovery process

### Key Dependencies
- `vitest` testing framework with mocking capabilities
- `../../src/utils/python-utils.js` - Core Python discovery logic
- Node.js built-ins: `child_process`, `path`, `fs`, `events`

### Testing Patterns
- Extensive use of vi.spyOn for platform and filesystem mocking
- CommandFinder injection pattern for dependency isolation
- Asynchronous spawn simulation with immediate event emission
- Proper cleanup with try/finally blocks to restore mocks and environment
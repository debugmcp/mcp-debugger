# packages/adapter-python/tests/unit/python-utils.discovery.test.ts
@source-hash: 53cf9adb5e97206a
@generated: 2026-02-10T00:41:12Z

## Purpose
Unit tests for Python executable discovery functionality in the adapter-python package. Tests various scenarios for finding and validating Python installations across different platforms and environment configurations.

## Key Components

### Test Setup and Mocking (L6-46)
- **spawnMock** (L26): Mocked `child_process.spawn` function for testing process execution
- **createSpawn** (L28-45): Factory function that creates mock child processes with configurable exit codes and output streams
- **ChildProcessMock** (L20-24): Type definition for mocked child process with EventEmitter interface

### Test Structure (L49-229)
- **Environment Management** (L50-60): BeforeEach/afterEach hooks that preserve and restore process environment variables
- **Core Function Under Test**: `findPythonExecutable` from `python-utils.js`

### Test Scenarios

#### Linux/Non-Windows Discovery (L62-88)
- Tests auto-detection of Python from PATH on Linux systems
- Verifies preference for `python3` over `python` 
- Validates debugpy version checking (expects stdout: '1.8.17')
- Uses custom CommandFinder mock to simulate executable discovery

#### Windows pythonLocation Priority (L90-130)
- Tests Windows-specific behavior using `pythonLocation` environment variable
- Mocks filesystem existence checks for Python installation paths
- Verifies preference for environment-specified Python over PATH discovery
- Expected path format: `C:\HostedPython\3.11.9\x64\python.exe`

#### PYTHON_PATH Environment Variable (L132-170)
- Tests explicit Python path specification via `PYTHON_PATH` env var
- Validates custom Python installation usage
- Verifies debugpy compatibility checking with version '1.9.0'

#### Discovery Failure Handling (L172-200)
- Tests error reporting when Python discovery fails completely
- Validates logger error messages with `[PYTHON_DISCOVERY_FAILED]` prefix
- Simulates CI environment conditions
- Expects CommandNotFoundError propagation

#### Debugpy Fallback Behavior (L202-228)
- Tests fallback to first valid Python when debugpy module is missing
- Simulates `ModuleNotFoundError: debugpy` scenarios
- Verifies graceful degradation to any working Python executable

## Dependencies
- **vitest**: Testing framework with mocking capabilities
- **node:path, node:fs, node:events**: Node.js built-in modules
- **child_process**: Mocked for process spawning simulation
- **python-utils.js**: Main module containing `findPythonExecutable`, `setDefaultCommandFinder`, `CommandNotFoundError`

## Key Patterns
- **Platform-specific testing**: Uses `process.platform` mocking for Windows vs Linux behavior
- **Environment variable manipulation**: Extensive use of process.env modification for testing different configurations  
- **Mock restoration**: Consistent cleanup of mocks and spies in finally blocks
- **Async process simulation**: Uses `setImmediate` to simulate asynchronous child process behavior
- **Error scenario coverage**: Tests both successful discovery and failure paths
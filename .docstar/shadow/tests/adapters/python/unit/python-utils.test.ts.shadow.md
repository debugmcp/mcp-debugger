# tests/adapters/python/unit/python-utils.test.ts
@source-hash: 05c71052cdd484a7
@generated: 2026-02-10T01:19:05Z

## Purpose
Comprehensive unit test suite for Python utility functions in the debugmcp adapter, specifically testing Python executable discovery, version detection, and command finding functionality across different platforms.

## Test Structure
- **Main test suite**: `python-utils` (L24-427) covering all core functionality
- **Cross-platform testing**: Tests run on win32, linux, and darwin platforms (L59-214)
- **Windows-specific tests**: Special handling for Store aliases and py launcher (L216-319)

## Key Test Functions

### findPythonExecutable Tests (L58-320)
Tests Python executable discovery with multiple fallback strategies:
- User-specified pythonPath validation (L68-75)
- Environment variable precedence: PYTHON_PATH, PYTHON_EXECUTABLE (L77-93)
- Windows pythonLocation support for GitHub Actions (L96-110)
- Platform-specific command order and debugpy preference (L112-161)
- Fallback chain testing (L163-184)
- Error handling for missing Python (L186-198, L200-213)

### getPythonVersion Tests (L322-408)
Tests version string extraction from Python executable:
- Standard stdout version output parsing (L323-341)
- stderr version output handling (L343-361)
- Error conditions: spawn errors (L363-374), non-zero exit codes (L376-387)
- Fallback to raw output when version pattern not found (L389-407)

### setDefaultCommandFinder Tests (L410-426)
Tests global command finder configuration for dependency injection.

## Mock Infrastructure

### Mocking Strategy
- **child_process mock**: Partial mock preserving other APIs like exec (L14-20)
- **MockCommandFinder**: Custom mock for command discovery testing (L25, L36)
- **spawn mock**: EventEmitter-based process simulation (L39-48, L22)

### Mock Patterns
- **Platform stubbing**: Uses vi.stubGlobal for cross-platform testing (L61)
- **Environment cleanup**: Resets Python-related env vars in beforeEach/afterEach (L29-34, L51-56)
- **Process simulation**: Mocks child processes with EventEmitter pattern for async testing

## Test Environment Management
- **beforeEach setup**: Clears mocks, resets env vars, creates fresh MockCommandFinder (L27-49)
- **afterEach cleanup**: Clears mocks, resets command finder, removes env vars (L51-56)
- **Global stubbing**: Platform-specific test isolation with proper cleanup (L64-66)

## Platform-Specific Logic
- **Windows**: Tests py launcher priority, Store alias detection, where.exe usage
- **Unix-like**: Tests python3 → python fallback order
- **Cross-platform**: Environment variable handling, error conditions

## Dependencies
- **Core modules**: vitest testing framework, node fs/path, child_process
- **Target code**: @debugmcp/adapter-python utilities and errors
- **Test utilities**: MockCommandFinder from test-utils

## Key Patterns
- **Parameterized testing**: describe.each for platform variants
- **Process mocking**: EventEmitter-based child process simulation
- **Error simulation**: CommandNotFoundError and spawn error testing
- **Async testing**: Promise-based test patterns with proper await handling
# packages/adapter-python/tests/unit/python-utils.comprehensive.test.ts
@source-hash: 617edf2a0d91327a
@generated: 2026-02-10T00:41:23Z

## Comprehensive Test Suite for Python Discovery Utilities

This TypeScript test file provides extensive coverage for Python executable discovery functionality across different platforms and scenarios. It uses Vitest testing framework with comprehensive mocking of child processes and file system operations.

### Primary Purpose
Tests the `python-utils.js` module's ability to find and validate Python executables across Windows, Linux, and macOS platforms with various edge cases and error conditions.

### Test Structure & Key Components

**Mock Setup (L6-36)**
- Mocks `child_process.spawn` and `which` library for controlled testing
- `createSpawn()` helper (L37-58) creates mock child processes with configurable exit codes, stdout/stderr output, and errors
- Preserves original environment and platform for restoration

**Core Test Suites:**

**CommandNotFoundError Tests (L63-76)**
- Validates custom error class behavior and inheritance
- Tests error properties and instanceof checks

**Command Finder Management (L78-96)**
- Tests `setDefaultCommandFinder()` function for dependency injection
- Verifies previous finder return and restoration

**Windows Platform Behavior (L110-248)**
- Path environment variable handling (`Path` to `PATH` conversion) (L111-130)
- Windows Store alias filtering and detection (L132-247)
- Handles `.exe` extension requirements on Windows (L156-183)
- Verbose discovery logging with `DEBUG_PYTHON_DISCOVERY=true` (L185-215)
- Multiple detection methods for Windows Store aliases (stderr content analysis)

**Environment Variable Handling (L250-325)**
- Tests `PYTHON_EXECUTABLE`, `PythonLocation`, `pythonLocation` environment variables
- Platform-specific path resolution (Windows vs Unix-like systems)
- File system existence checks with `fs.existsSync` mocking

**Preferred Path Parameter (L327-399)**
- Tests explicit Python path preference handling
- Error propagation for non-CommandNotFoundError exceptions
- Fallback behavior when preferred path is invalid

**Multiple Python Installations (L401-470)**
- debugpy module preference logic - prefers Python installations with debugpy available
- Fallback to first valid Python when no installations have debugpy
- Tests debugpy availability checking via spawn calls

**Error Scenarios (L472-509)**
- Comprehensive error handling and reporting
- CI environment specific logging behavior
- Error message formatting with tried paths

**getPythonVersion Function Tests (L512-574)**
- Version string extraction from Python `--version` output
- Handles stdout and stderr version output
- Error handling for spawn failures and non-zero exit codes
- Returns null for invalid scenarios

**Command Finder Class Behavior (L576-757)**
- Integration testing of WhichCommandFinder class
- Error handling during debugpy checks
- Debug message logging during discovery process
- Windows Store alias detection by path analysis
- Environment variable lookup error handling

**Additional Edge Cases (L759-908)**
- Auto-detect loop error handling
- Multiple validation scenarios
- Candidate collection and selection logic

**Verbose Discovery Logging (L910-1069)**
- Comprehensive logging when `DEBUG_PYTHON_DISCOVERY=true`
- PATH environment analysis and issue detection
- CI-specific verbose failure reporting
- Console output verification for debugging scenarios

### Key Testing Patterns
- Extensive use of `vi.spyOn()` for mocking system calls and console output
- Platform-specific behavior testing using `process.platform` mocking
- Environment variable manipulation with proper cleanup
- Mock restoration in `beforeEach`/`afterEach` hooks
- Comprehensive error scenario coverage including spawn errors, file system errors, and validation failures

### Critical Test Coverage Areas
- Cross-platform Python discovery (Windows Store aliases, Unix PATH resolution)
- Environment variable precedence and validation
- debugpy module preference for development scenarios
- Verbose logging for CI/debugging environments
- Error handling and user-friendly error messages
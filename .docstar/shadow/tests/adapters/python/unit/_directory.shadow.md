# tests/adapters/python/unit/
@generated: 2026-02-11T23:47:37Z

## Purpose

This directory contains comprehensive unit tests for the Python adapter's core utility functions in the debugmcp project. It focuses on testing Python executable discovery, version detection, and command finding functionality across different operating systems and environments.

## Key Components

### Test Coverage
- **Python executable discovery** - Tests multiple fallback strategies for finding Python installations
- **Cross-platform compatibility** - Validates behavior on Windows, Linux, and macOS
- **Version detection** - Tests parsing Python version strings from various output formats  
- **Command finding** - Tests configurable command discovery mechanisms
- **Error handling** - Validates graceful failure scenarios and fallback chains

### Mock Infrastructure
- **Process simulation** - EventEmitter-based mocking of child processes for async testing
- **Platform abstraction** - Global stubbing for cross-platform test isolation
- **Environment management** - Controlled testing of environment variables and cleanup
- **Command finder mocking** - Dependency injection testing with MockCommandFinder

## Test Organization

The test suite is structured around the core Python utility functions:

1. **findPythonExecutable** - Tests the primary Python discovery logic with:
   - User-specified path validation
   - Environment variable precedence (PYTHON_PATH, PYTHON_EXECUTABLE)  
   - Platform-specific command ordering
   - Windows-specific features (py launcher, Store aliases)
   - Comprehensive fallback chains

2. **getPythonVersion** - Tests version extraction from Python executables:
   - Standard output parsing
   - Error output handling
   - Spawn error recovery
   - Fallback mechanisms

3. **Command finder configuration** - Tests dependency injection patterns

## Testing Patterns

### Cross-Platform Strategy
- Parameterized tests using `describe.each` for platform variants
- Platform-specific logic isolation with proper mocking
- Environment variable testing with cleanup between tests

### Process Mocking
- EventEmitter-based child process simulation
- Controlled stdout/stderr output for version parsing tests
- Error condition simulation for robust error handling validation

### Test Environment Management
- Consistent setup/teardown with beforeEach/afterEach hooks
- Environment variable isolation and cleanup
- Mock state reset between test runs

## Dependencies

- **Testing framework**: Vitest for test execution and assertions
- **Node.js APIs**: child_process, fs, and path modules for system interaction
- **Target modules**: @debugmcp/adapter-python utilities and error classes
- **Test utilities**: MockCommandFinder for dependency injection testing

## Integration Points

This test suite validates the foundational Python discovery and version detection logic that other components of the debugmcp Python adapter depend on. It ensures reliable Python executable location across different development environments and deployment scenarios, which is critical for the adapter's core functionality.
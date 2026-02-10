# tests/adapters/python/unit/
@generated: 2026-02-10T01:19:41Z

## Purpose
Unit test directory for the Python adapter's core utility functions, providing comprehensive test coverage for Python executable discovery, version detection, and cross-platform compatibility in the debugmcp system.

## Key Components
This directory contains focused unit tests for the `@debugmcp/adapter-python` utility layer:

- **python-utils.test.ts**: Complete test suite for Python environment detection and executable management
- **Cross-platform testing infrastructure**: Ensures adapter works consistently across Windows, Linux, and macOS
- **Mock framework**: Sophisticated mocking system for child processes, file system, and command discovery

## Test Coverage Areas

### Python Executable Discovery
Tests the core `findPythonExecutable` functionality that powers Python environment detection:
- User-specified path validation and prioritization  
- Environment variable precedence (PYTHON_PATH, PYTHON_EXECUTABLE)
- Platform-specific executable search patterns and fallback chains
- Windows-specific features (py launcher, Store aliases, GitHub Actions support)
- Error handling for missing or invalid Python installations

### Version Detection
Tests `getPythonVersion` utility for Python version extraction:
- Version string parsing from stdout/stderr outputs
- Error handling for spawn failures and non-zero exit codes
- Fallback strategies when version patterns aren't found

### Command Finding Infrastructure
Tests the configurable command discovery system through `setDefaultCommandFinder`:
- Dependency injection patterns for testability
- Platform-specific command location strategies

## Testing Infrastructure

### Mock Strategy
- **Process mocking**: EventEmitter-based child process simulation for realistic async testing
- **Platform isolation**: Global stubbing system for cross-platform test execution
- **Command finder mocking**: MockCommandFinder for controlled executable discovery testing
- **Environment management**: Clean slate setup/teardown for Python-related environment variables

### Test Organization
- **Platform-driven testing**: Parameterized tests across win32, linux, darwin platforms
- **Error scenario coverage**: Comprehensive testing of failure modes and edge cases
- **Integration patterns**: Tests cover the full flow from high-level API calls to low-level system interactions

## Internal Organization
The test suite follows a layered approach:
1. **Environment setup/teardown**: Ensures clean test isolation
2. **Platform-specific scenarios**: Tests platform-dependent behaviors 
3. **Error condition simulation**: Validates robust error handling
4. **Integration verification**: Confirms end-to-end functionality

## Key Patterns
- **Cross-platform compatibility testing**: Ensures consistent behavior across operating systems
- **Mock-driven testing**: Comprehensive mocking of system dependencies for reliable, fast tests
- **Error simulation**: Systematic testing of failure scenarios and recovery mechanisms
- **Async process handling**: Proper testing of child process lifecycle and event handling

## API Surface Tested
The tests validate the public API of the Python adapter utilities:
- `findPythonExecutable(options?)`: Primary entry point for Python discovery
- `getPythonVersion(pythonPath)`: Version detection utility
- `setDefaultCommandFinder(finder)`: Configuration interface for dependency injection

This test directory ensures the Python adapter can reliably discover and interact with Python environments across different platforms and configurations, forming the foundation for debugmcp's Python debugging capabilities.
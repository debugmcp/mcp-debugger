# tests\adapters\python\unit/
@generated: 2026-02-12T21:00:53Z

## Overall Purpose
This directory contains unit tests for the Python adapter utilities in the debugmcp system. It provides comprehensive test coverage for Python executable discovery, version detection, and command finder functionality across multiple platforms (Windows, Linux, macOS).

## Key Components and Relationships

### Core Test Module
- **python-utils.test.ts**: Primary test suite covering all Python utility functions
  - Tests `findPythonExecutable()` cross-platform discovery logic
  - Validates `getPythonVersion()` version extraction capabilities
  - Verifies `setDefaultCommandFinder()` global configuration management

### Mock Infrastructure
- **MockCommandFinder Integration**: Simulates command discovery with configurable responses
- **Process Mocking**: Uses EventEmitter-based mocks to simulate `child_process.spawn` behavior
- **Environment Variable Management**: Comprehensive setup/teardown for testing environment-specific behaviors

## Public API Testing Surface
The tests validate the public interface of the Python adapter utilities:

1. **findPythonExecutable()**: Multi-platform Python executable discovery with environment variable precedence
2. **getPythonVersion()**: Version string extraction from Python `--version` output
3. **setDefaultCommandFinder()**: Global command finder configuration management

## Testing Patterns and Organization

### Cross-Platform Testing Strategy
- **Platform-specific command prioritization**: Windows (`py -> python -> python3`) vs Unix (`python3 -> python`)
- **Environment variable precedence**: Tests user paths > PYTHON_PATH > PYTHON_EXECUTABLE > platform defaults
- **Windows Store alias detection**: Validates rejection of invalid Windows Store Python aliases

### Mock Architecture
- **Partial mocking**: Preserves real `child_process.exec` while mocking `spawn`
- **Configurable responses**: MockCommandFinder provides flexible command discovery simulation
- **State management**: Proper setup/teardown to prevent cross-test pollution

### Error Handling Coverage
- **Discovery failures**: Tests behavior when no Python executable found
- **Spawn errors**: Validates error propagation from subprocess calls
- **Version parsing failures**: Tests fallback behavior for malformed version output

## Internal Data Flow
1. **Environment Analysis**: Tests read environment variables and platform detection
2. **Command Discovery**: MockCommandFinder simulates executable search across PATH
3. **Validation**: Spawn mocks verify executable functionality (debugpy import checks)
4. **Version Detection**: Process mocks simulate `--version` command execution
5. **Result Processing**: Tests verify proper parsing and error handling of outputs

## Dependencies and Integration
- **@debugmcp/adapter-python**: Core utilities under test
- **MockCommandFinder**: Test utility for command discovery simulation
- **vitest**: Primary testing framework with mocking capabilities
- **Node.js modules**: child_process, fs, path for system integration testing

This test suite ensures reliable Python environment detection across diverse deployment scenarios and platforms, providing confidence in the adapter's ability to locate and validate Python installations.
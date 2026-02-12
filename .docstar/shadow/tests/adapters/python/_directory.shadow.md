# tests\adapters\python/
@generated: 2026-02-12T21:01:12Z

## Python Adapter Test Suite

**Purpose**: Comprehensive test coverage for the Python debugging adapter within the MCP (Model Context Protocol) ecosystem. This module validates Python environment discovery, version detection, debug adapter communication, and complete debugging workflows across multiple platforms through both unit and integration testing approaches.

### Key Components and Architecture

#### Unit Testing Layer (`unit/`)
Provides focused validation of Python utility functions with mock-based isolation:
- **Python Discovery Logic**: Tests cross-platform executable discovery with environment variable precedence
- **Version Detection**: Validates Python version extraction and parsing capabilities
- **Command Configuration**: Tests global command finder management and configuration
- **Mock Infrastructure**: Sophisticated mocking of child processes and command discovery for isolated testing

#### Integration Testing Layer (`integration/`)
Delivers end-to-end validation of real-world debugging scenarios without mocking:
- **Environment Management**: Automated Python and debugpy installation for CI environments
- **MCP Protocol Testing**: Real communication with debug adapter server via Model Context Protocol
- **Complete Workflow Validation**: Full debugging session lifecycle including breakpoints and variable inspection
- **Windows CI Focus**: Specialized handling for Windows environments and GitHub Actions

### Component Integration Flow

The test layers work together to provide comprehensive validation:

1. **Unit Layer Foundation**: Mock-based tests ensure individual utility functions work correctly across platforms
2. **Integration Layer Validation**: Real environment tests verify the complete system works in practice
3. **CI/CD Integration**: Windows-focused integration tests validate deployment scenarios
4. **MCP Protocol Verification**: Integration tests confirm proper debug adapter communication

### Public API Surface

**Primary Entry Points**:
- Unit test coverage for `findPythonExecutable()`, `getPythonVersion()`, and `setDefaultCommandFinder()`
- Integration test utilities including `ensurePythonOnPath()` for environment preparation
- Test suites with `@requires-python` tagging for conditional execution
- MCP client integration patterns for debug adapter communication

**Testing Patterns**:
- Cross-platform compatibility testing (Windows, Linux, macOS)
- Environment variable precedence validation
- Real vs. mocked implementation testing strategies
- CI-aware error handling and diagnostic logging

### Internal Organization

#### Data Flow Architecture
1. **Unit Testing**: Isolated function validation with configurable mocks
2. **Environment Preparation**: Python PATH configuration and debugpy installation
3. **Discovery Validation**: Real Python executable resolution through MCP protocol
4. **Workflow Testing**: Complete debug session lifecycle validation
5. **Error Handling**: Comprehensive logging and failure diagnostics

#### Testing Strategies
- **Platform-Specific Logic**: Windows Store alias detection, PATH manipulation, case-insensitive handling
- **Mock Architecture**: Partial mocking preserving critical system interactions while controlling test conditions
- **Real Environment Testing**: Integration tests deliberately avoid mocking to validate actual system behavior
- **Timeout Management**: Appropriate timeouts for network operations and process spawning

### Important Conventions

- **Windows-First Design**: Primary focus on Windows compatibility with specialized CI environment handling
- **MCP Protocol Integration**: Uses Model Context Protocol for standardized debug adapter communication
- **Conditional Execution**: Runtime requirement tagging for Python-dependent tests
- **Failure Diagnostics**: Structured error logging and payload persistence for debugging CI failures
- **Environment Isolation**: Proper setup/teardown to prevent cross-test contamination

This test suite ensures reliable Python debugging adapter functionality across diverse deployment scenarios, providing confidence in both individual utility functions and complete debugging workflows within the MCP ecosystem.
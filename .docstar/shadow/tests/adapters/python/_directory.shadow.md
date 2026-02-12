# tests/adapters/python/
@generated: 2026-02-11T23:48:01Z

## Purpose

The `tests/adapters/python` directory contains a comprehensive test suite for the Python debugging adapter in the debugmcp project. It validates both the core utility functions and the complete debugging workflow through isolated unit tests and full integration testing, ensuring reliable Python environment discovery and debugging functionality across different platforms and deployment scenarios.

## Key Components and Organization

### Unit Tests (`unit/`)
- **Python Discovery Testing**: Validates `findPythonExecutable` functionality with comprehensive fallback strategies, environment variable precedence, and platform-specific behavior
- **Version Detection Testing**: Tests `getPythonVersion` parsing capabilities across various Python output formats and error conditions  
- **Cross-Platform Validation**: Ensures consistent behavior on Windows, Linux, and macOS through parameterized testing
- **Mock Infrastructure**: EventEmitter-based process simulation for controlled testing of async operations and error scenarios

### Integration Tests (`integration/`)
- **Environment Preparation**: `env-utils.ts` provides Python runtime setup with debugpy support, especially for CI environments
- **Discovery Integration**: Real-world Python executable discovery validation without mocks
- **End-to-End Workflow**: Complete debugging session lifecycle testing through MCP protocol communication
- **Real System Interaction**: Tests actual Python script execution, breakpoint management, and variable inspection

## How Components Work Together

The test architecture follows a layered approach that builds confidence from foundational utilities to complete workflows:

1. **Foundation Layer**: Unit tests validate core Python discovery and version detection utilities that all other functionality depends on
2. **Integration Layer**: Environment utilities ensure Python+debugpy availability for higher-level testing
3. **Workflow Layer**: End-to-end tests exercise the complete debug adapter functionality through real MCP communication
4. **Platform Layer**: Cross-platform testing ensures consistent behavior across development and deployment environments

## Public API Surface

### Entry Points for Testing
- **Unit Test Coverage**: Tests for `findPythonExecutable`, `getPythonVersion`, and command finder configuration
- **Integration Utilities**: `ensurePythonOnPath(env)` for Python environment preparation
- **MCP Tool Validation**: Tests for debug server tools including `list_sessions`, `create_session`, `set_breakpoint`, `start_debugging`, `continue`, `get_stack_frames`, `get_scopes`, `get_variables`

### Test Configuration
- **Environment Management**: Controlled environment variable testing with proper cleanup
- **Platform Testing**: Parameterized tests for Windows, Linux, and macOS scenarios
- **CI Integration**: Tests tagged with `@requires-python` for conditional execution

## Internal Organization and Data Flow

### Unit Testing Flow
1. Mock infrastructure setup for platform and process simulation
2. Isolated testing of Python discovery logic with various environment configurations
3. Version detection validation with controlled stdout/stderr output
4. Error handling verification through simulated failure conditions

### Integration Testing Flow
1. Environment preparation ensures Python+debugpy availability
2. MCP client-server communication via stdio transport
3. Real debugging workflow execution with actual Python scripts
4. Validation of debugging operations through protocol communication
5. Proper cleanup of sessions and transport connections

## Important Patterns and Conventions

### Testing Strategies
- **No Mocks in Integration**: Integration tests use real system behavior for authentic validation
- **Comprehensive Mocking in Unit Tests**: EventEmitter-based process simulation for controlled conditions
- **Cross-Platform Isolation**: Platform-specific logic testing with proper abstraction
- **Environment Isolation**: Filtered environment variables and cleanup between tests

### Error Handling and Reliability
- **Graceful Fallback Testing**: Validates fallback chains for Python discovery
- **CI-Friendly Design**: Extensive logging, failure artifact collection, and diagnostic output
- **Windows-Specific Handling**: Special support for Microsoft Store Python redirects and py launcher
- **Polling Strategies**: Asynchronous state monitoring with configurable timeouts

### Dependencies and Integration Points
- **Core Testing**: Validates foundational utilities that the entire Python adapter depends on
- **MCP Protocol**: Integration with Model Context Protocol for debug server communication
- **VS Code DAP**: Compatibility testing with Debug Adapter Protocol standards
- **System Integration**: Real Python executable and debugpy interaction for authentic testing

This test suite serves as the quality assurance foundation for the Python debugging adapter, ensuring reliable operation across diverse Python environments and providing confidence in both individual components and complete debugging workflows.
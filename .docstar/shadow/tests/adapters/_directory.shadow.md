# tests\adapters/
@generated: 2026-02-12T21:01:38Z

## Overall Purpose and Responsibility

The `tests/adapters` directory provides comprehensive test coverage for all debug adapter implementations within the MCP (Model Context Protocol) debug system. This module ensures reliable multi-language debugging capabilities by validating adapter integration, protocol compliance, and cross-platform functionality for Go, JavaScript, Python, and Rust debugging environments.

## Key Components and Architecture

### Language-Specific Adapter Test Suites
The directory is organized by programming language, with each subdirectory containing dedicated test infrastructure:

- **Go (`go/`)**: Two-tier testing strategy (unit + integration) validating Go/Delve debugger integration, DAP protocol compliance, and environment detection
- **JavaScript (`javascript/`)**: Integration-focused testing for TypeScript/JavaScript debugging workflows with tsx runtime and debug server validation
- **Python (`python/`)**: Comprehensive unit and integration testing covering Python environment discovery, debugpy integration, and MCP protocol communication
- **Rust (`rust/`)**: Integration testing for CodeLLDB adapter functionality with cross-platform command generation and configuration transformation

### Unified Testing Patterns
All adapter test suites follow consistent architectural patterns:
- **Mock-Based Isolation**: Sophisticated dependency injection and process mocking for reliable unit testing
- **Integration Validation**: End-to-end workflow testing with real or realistic environment simulation
- **Cross-Platform Compatibility**: Windows, Linux, and macOS support with platform-specific handling
- **Environment Management**: Proper setup/teardown and state isolation between tests

## Public API Surface and Entry Points

### Core Testing Infrastructure
Each language adapter exposes standardized test interfaces:
- **Adapter Factory Testing**: Validation of `createAdapter()` methods and metadata retrieval
- **Configuration Processing**: Launch configuration transformation and validation testing
- **Environment Validation**: Toolchain detection and dependency checking across platforms
- **Command Generation**: Debug server/adapter command building with proper arguments and port configuration

### Common Test Utilities
Shared testing patterns across all adapters:
- **Mock Dependency Factories**: Consistent AdapterDependencies mocking for isolated testing
- **Process Simulation**: EventEmitter-based child process mocking for command execution testing
- **File System Abstraction**: Cross-platform executable discovery without actual file system dependencies
- **Environment Control**: Safe manipulation of PATH, environment variables with proper cleanup

## Internal Organization and Data Flow

### Testing Strategy Hierarchy
The directory implements a **multi-layer validation approach**:

1. **Unit Testing Layer**: Component-level validation of utilities, version detection, and executable discovery
2. **Integration Testing Layer**: End-to-end adapter lifecycle and protocol communication testing
3. **Environment Testing**: Real-world scenario validation with actual toolchain integration
4. **Cross-Platform Validation**: Platform-specific behavior testing and compatibility assurance

### Critical Validation Workflows
All adapter tests validate core debugging infrastructure:
- **Adapter Lifecycle Management**: State transitions, initialization, and cleanup
- **Debug Protocol Compliance**: DAP (Debug Adapter Protocol) and MCP communication standards
- **Configuration Transformation**: Launch config processing for debugger consumption
- **Toolchain Integration**: Language-specific debugger and runtime integration (Delve, debugpy, CodeLLDB, tsx)
- **Session Management**: Unique session handling, port assignment, and resource isolation

## Integration with Debug System

### MCP Protocol Integration
The test suite validates adapter integration with the broader MCP debug ecosystem:
- **Adapter Registration**: Testing adapter factory registration with the debug system
- **Protocol Communication**: MCP client/server communication patterns for debug operations
- **Session Isolation**: Multi-session debugging capability with proper resource management
- **Error Handling**: Standardized error reporting and user-friendly diagnostic messages

### Cross-Language Consistency
While each language has specific requirements, the test directory ensures:
- **Uniform API Patterns**: Consistent adapter factory and lifecycle interfaces
- **Standardized Error Handling**: Common error reporting and validation patterns
- **Shared Infrastructure**: Reusable testing utilities and mock frameworks
- **Platform Compatibility**: Universal cross-platform support across all language adapters

This comprehensive test directory serves as the quality gate for the entire MCP debug adapter system, ensuring reliable multi-language debugging capabilities across diverse development environments while maintaining strict protocol compliance and cross-platform functionality.
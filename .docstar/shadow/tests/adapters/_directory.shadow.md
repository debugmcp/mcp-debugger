# tests/adapters/
@generated: 2026-02-09T18:17:02Z

## Overall Purpose and Responsibility

The `tests/adapters` directory serves as the comprehensive quality assurance foundation for the DebugMCP adapter ecosystem. This module contains complete test suites for all supported programming language debug adapters (Go, JavaScript, Python, Rust), ensuring reliable integration between the MCP debugging framework and language-specific debugging tools.

The directory validates both individual adapter functionality and the broader adapter registry system, providing confidence that each adapter can properly transform debugging configurations, manage debug sessions, and integrate with their respective language toolchains across diverse development environments.

## Component Architecture and Integration

### Multi-Layer Testing Strategy
Each language adapter employs a consistent dual-layer testing approach:
- **Unit Testing**: Deep validation of core utilities like toolchain discovery, version detection, and command construction
- **Integration Testing**: End-to-end workflow validation using real or sophisticated mock implementations

### Cross-Adapter Testing Patterns
All adapters share common testing infrastructure and patterns:
- **Environment Isolation**: Comprehensive setup/teardown with environment variable management
- **Mock Dependency Systems**: Sophisticated process mocking and dependency injection for controlled testing
- **Cross-Platform Validation**: Platform-aware testing for Windows, Linux, and macOS compatibility
- **Error Scenario Coverage**: Extensive failure mode validation including missing toolchains and configuration errors

### Adapter Registry Integration
The test suites validate integration with the central adapter management system:
- **Factory Pattern Validation**: Testing adapter creation and registration workflows
- **Configuration Transformation**: Launch configuration processing and runtime override handling
- **Session Management**: Debug session lifecycle from initialization to cleanup

## Key Components and Data Flow

### Language-Specific Adapters
- **Go Adapter Tests**: Validates Go/Delve toolchain integration with DAP support detection
- **JavaScript Adapter Tests**: Tests tsx runtime integration and js-debug vendor script coordination
- **Python Adapter Tests**: Validates Python environment discovery and MCP SDK communication
- **Rust Adapter Tests**: Tests CodeLLDB integration and LLDB configuration management

### Testing Infrastructure Flow
1. **Environment Setup**: Mock dependencies and isolate test environment
2. **Adapter Creation**: Factory instantiation with proper dependency injection
3. **Configuration Processing**: Launch configuration transformation and validation
4. **Command Building**: Debug command generation with toolchain-specific arguments
5. **Session Lifecycle**: Connection, debugging operations, and cleanup validation
6. **Platform Compatibility**: Cross-platform path handling and executable discovery

## Public API Surface and Entry Points

### Primary Validation Targets
The test suite validates all major adapter interfaces from the `@debugmcp/adapter-*` packages:

#### Factory Interface
- `AdapterFactory.create()` - Adapter instantiation with dependency injection
- `validate()` - Environment and toolchain validation
- `getMetadata()` - Adapter capability reporting

#### Core Adapter Interface
- `initialize()` - Adapter setup and validation
- `connect()` / `disconnect()` - Debug session management
- `buildAdapterCommand()` - Toolchain-specific command generation
- `transformLaunchConfig()` - Configuration transformation for debugging

#### Utility Functions
- Language-specific executable discovery (Python, Go, Rust toolchain detection)
- Version detection and compatibility validation
- Platform-specific configuration handling

### Registry Integration Points
- **Adapter Registration**: Validation of adapter registration with the central registry
- **Configuration Handling**: Runtime override processing and parameter validation
- **Session Coordination**: Port management and session state handling

## Critical Quality Assurance Patterns

### Comprehensive Mock Strategies
- **Process Mocking**: EventEmitter-based simulation of toolchain process execution
- **File System Abstraction**: Mock file operations while preserving environment access
- **Dependency Injection**: Clean separation of adapter logic from system dependencies

### Cross-Platform Reliability
- **Platform Detection**: OS-specific testing with proper path normalization
- **Environment Management**: Careful handling of platform-specific environment variables
- **CI/CD Integration**: Specialized handling for automated testing environments

### Error Resilience Testing
- **Missing Toolchains**: Validation of graceful degradation when required tools are unavailable
- **Configuration Errors**: Testing of malformed or invalid debug configurations
- **Process Failures**: Simulation of toolchain execution failures and recovery mechanisms

This test directory ensures that the DebugMCP adapter ecosystem can reliably integrate with diverse development environments while providing clear error messages and proper fallback behaviors when dependencies are not met. The comprehensive testing approach validates both individual adapter functionality and the broader system integration, providing confidence for production debugging scenarios.
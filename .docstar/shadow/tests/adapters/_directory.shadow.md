# tests\adapters/
@children-hash: f73e3c3312c04ea8
@generated: 2026-02-15T09:02:07Z

## Overall Purpose and Responsibility

The `tests/adapters` directory provides comprehensive test coverage for all debugger adapter implementations within the Debug MCP framework. This directory serves as the quality assurance gateway, validating that each language-specific adapter (Go, JavaScript/TypeScript, Python, and Rust) correctly implements the debugger adapter protocol while maintaining proper isolation, cross-platform compatibility, and reliable integration with their respective debugging backends.

## Key Components and Integration Architecture

### Multi-Language Adapter Testing Suite
The directory is organized by programming language, with each subdirectory containing specialized test suites:

- **Go Adapter Tests** (`go/`): Validates Go/Delve debugger integration with comprehensive unit and integration testing
- **JavaScript/TypeScript Tests** (`javascript/`): Ensures reliable debugging for JavaScript/TypeScript applications via VS Code js-debug adapter
- **Python Adapter Tests** (`python/`): Tests Python debugger integration with debugpy support across different Python installations
- **Rust Adapter Tests** (`rust/`): Validates Rust debugging through CodeLLDB integration with platform-specific handling

### Unified Testing Patterns and Component Relationships

All adapter test suites follow a consistent two-tier architecture:

1. **Unit Testing Layer**: Focused validation of individual components (factories, utilities, configuration handlers) with comprehensive mocking
2. **Integration Testing Layer**: End-to-end workflow validation using either mock dependencies or controlled real environments

The adapters work together through shared interfaces and patterns:
- **Adapter Factory Pattern**: Each language implements a factory for creating debug adapter instances
- **Configuration Transformation Pipeline**: Common launch configuration processing with language-specific overrides
- **Command Generation Framework**: Standardized approach to building debugger-specific commands
- **Environment Validation System**: Cross-platform executable discovery and version compatibility checking

## Public API Surface and Entry Points

### Primary Test Interfaces
- **Adapter Factory Testing**: Validation of adapter creation, metadata retrieval, and environment checks across all languages
- **Configuration Processing**: Launch config transformation testing with runtime-specific parameters (tsx for TypeScript, debugpy for Python, etc.)
- **Command Building Validation**: Debugger command generation testing for each backend (dlv, js-debug, debugpy, CodeLLDB)
- **Cross-Platform Compatibility**: Platform-specific testing for Windows, Linux, and macOS environments

### Shared Testing Infrastructure
- **Mock Strategy Framework**: Comprehensive process isolation using EventEmitter simulation and filesystem abstraction
- **Environment Management**: Standardized setup/teardown patterns with PATH manipulation and environment variable handling
- **Integration Points**: Common testing of adapter lifecycle, session management, and DAP protocol communication

## Internal Organization and Data Flow

### Test Execution Pipeline
1. **Environment Setup**: Each test suite preserves system state and initializes controlled test environments
2. **Adapter Registration**: Language-specific adapter factories are registered with mock or real dependencies
3. **Configuration Validation**: Launch configurations are processed and validated for each debugging scenario
4. **Command Generation Testing**: End-to-end validation of debugger command building with proper ports and parameters
5. **Integration Verification**: Communication testing between adapter components and debugging backends
6. **Environment Restoration**: Clean teardown ensuring no test pollution or side effects

### Quality Assurance Patterns
- **Isolation Strategy**: All tests prevent actual debugger process execution while validating complete logic paths
- **Cross-Platform Design**: Consistent handling of platform differences including executable extensions and path normalization
- **Dependency Injection**: Mock factories enable comprehensive testing without external dependencies
- **Error Scenario Coverage**: Robust testing of failure modes, missing tools, and version incompatibilities

## Framework Integration and Dependencies

### Core Testing Technologies
- **Vitest**: Primary testing framework across all adapter test suites
- **MCP SDK**: Client libraries for protocol communication in integration scenarios
- **Debug Adapter Protocol**: Standardized interfaces for debugging communication
- **Node.js Built-ins**: System integration testing utilities (child_process, fs, path, events)

### Language-Specific Dependencies
- **Go**: Delve debugger integration and GOPATH/GOBIN discovery
- **JavaScript/TypeScript**: VS Code js-debug adapter and tsx runtime support
- **Python**: debugpy integration with MCP client-server communication
- **Rust**: CodeLLDB debugger integration with LLDB platform requirements

This test directory ensures that the Debug MCP framework provides reliable debugging capabilities across all supported programming languages while maintaining consistent quality, cross-platform compatibility, and proper isolation from system dependencies. The comprehensive coverage validates both individual adapter functionality and the unified debugging experience across the entire ecosystem.
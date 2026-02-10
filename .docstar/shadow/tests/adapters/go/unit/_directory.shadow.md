# tests/adapters/go/unit/
@generated: 2026-02-10T21:26:22Z

## Overall Purpose and Responsibility

This directory contains comprehensive unit tests for the Go debug adapter implementation within the debugmcp ecosystem. The test suite validates the complete functionality of Go/Delve debugger integration, ensuring proper adapter lifecycle management, environment validation, and debug session orchestration.

## Key Components and Relationships

The test suite is organized around three core components that work together to provide Go debugging capabilities:

### GoAdapterFactory Testing (`go-adapter-factory.test.ts`)
- **Role**: Factory pattern implementation for Go adapter instantiation
- **Validation**: Tests adapter creation, metadata retrieval, and comprehensive environment validation
- **Environment Checks**: Validates Go binary availability, minimum version requirements (1.18+), Delve debugger installation, and DAP support
- **Dependencies**: Ensures both Go toolchain and Delve debugger are properly configured

### GoDebugAdapter Testing (`go-debug-adapter.test.ts`)
- **Role**: Core adapter implementation managing debug session lifecycle
- **State Management**: Tests adapter state transitions (INIT → READY → CONNECTED → DISCONNECTED)
- **Capabilities**: Validates DAP (Debug Adapter Protocol) feature support including breakpoints, log points, and Go-specific exception handling
- **Configuration**: Tests launch configuration transformation from generic to Go-specific parameters

### Go Utilities Testing (`go-utils.test.ts`)
- **Role**: Platform-specific utility functions for tool discovery and validation
- **Executable Discovery**: Tests Go and Delve binary resolution across different search paths (PATH, GOPATH, custom locations)
- **Version Management**: Validates version parsing for both Go and Delve with format normalization
- **Platform Support**: Handles cross-platform considerations for Windows, Linux, and macOS

## Public API Surface and Entry Points

The test suite validates these main entry points:
- **GoAdapterFactory.createAdapter()**: Primary adapter instantiation
- **GoAdapterFactory.getMetadata()**: Adapter information and capabilities
- **GoAdapterFactory.validate()**: Environment prerequisite validation
- **GoDebugAdapter lifecycle methods**: init(), dispose(), connect(), disconnect()
- **Utility functions**: findGoExecutable(), findDelveExecutable(), version parsing, and DAP support detection

## Internal Organization and Data Flow

### Test Infrastructure
- **Mocking Strategy**: Comprehensive mocking of `child_process.spawn`, file system operations, and environment variables
- **Test Isolation**: Each test suite uses independent mock setups with proper cleanup
- **Platform Awareness**: Tests adapt to current platform while maintaining cross-platform compatibility

### Validation Flow
1. **Environment Discovery**: Tests locate Go and Delve executables through multiple search strategies
2. **Version Validation**: Ensures minimum Go version requirements and Delve DAP compatibility
3. **Adapter Lifecycle**: Validates state transitions and event emission throughout debug session lifecycle
4. **Configuration Processing**: Tests transformation of generic debug configurations to Go-specific parameters

## Important Patterns and Conventions

### Testing Patterns
- **EventEmitter Simulation**: Uses EventEmitter pattern to mock child processes with realistic async behavior
- **Environment Isolation**: Comprehensive backup/restore of environment variables to prevent test pollution
- **State Transition Testing**: Systematic validation of adapter state changes with proper event emission
- **Error Boundary Testing**: Thorough testing of failure modes with human-readable error message translation

### Mock Architecture
- **Process Mocking**: `process.nextTick()` for async event simulation with realistic stdout/stderr data
- **File System Abstraction**: Mocked `fs.promises.access` for executable discovery testing
- **Dependency Injection**: Mock factory pattern for `AdapterDependencies` interface

### Platform Considerations
- **Current Platform Focus**: Tests run only on current platform to avoid unreliable cross-platform mocking
- **Path Resolution**: Platform-specific handling for Windows vs. Unix-like systems
- **Home Directory Discovery**: Cross-platform user home directory resolution for GOPATH detection

The test suite ensures the Go debug adapter provides reliable debugging capabilities while maintaining proper integration with the broader debugmcp ecosystem and adhering to the Debug Adapter Protocol specification.
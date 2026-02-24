# tests\adapters/
@children-hash: 91b05020ef5a36e1
@generated: 2026-02-24T01:55:35Z

## Overall Purpose and Responsibility

The `tests/adapters` directory serves as the comprehensive testing infrastructure for all debugger adapter implementations in the MCP (Model Context Protocol) debugger system. This directory validates that language-specific debug adapters (Go, JavaScript/TypeScript, Python, Rust) can reliably integrate with their respective debugging toolchains while maintaining consistent behavior across different platforms and environments.

## Test Architecture and Strategy

The directory implements a **multi-layered testing approach** that provides complete validation coverage:

### Dual-Layer Testing Pattern
- **Unit Tests**: Fine-grained validation of individual adapter components with comprehensive mocking
- **Integration Tests**: End-to-end smoke testing that validates complete debugging workflows from adapter creation through session management

### Language-Specific Test Suites
Each language adapter (`go/`, `javascript/`, `python/`, `rust/`) follows consistent testing patterns while accommodating language-specific requirements:

- **Go Adapter Tests**: Validates Delve debugger integration with cross-platform Go toolchain discovery
- **JavaScript/TypeScript Tests**: Ensures js-debug adapter compatibility with Node.js and tsx runtime configurations  
- **Python Adapter Tests**: Comprehensive testing from Python discovery through debugpy session management
- **Rust Adapter Tests**: CodeLLDB integration validation with platform-specific LLDB configuration

## Key Components and Integration

### Shared Testing Infrastructure
All adapter test suites utilize common patterns and utilities:

- **Mock Dependency Injection**: Comprehensive mocking of filesystem, process spawning, and logging operations
- **Environment Management**: Systematic preservation and restoration of system environment variables
- **Cross-Platform Validation**: Platform-aware testing for Windows, Linux, and macOS compatibility
- **Session Lifecycle Testing**: Standardized validation of debug session state management (UNINITIALIZED → READY → CONNECTED)

### Component Interaction Validation
Tests ensure proper integration between core system components:

- **Adapter Factory System**: Validates adapter registration, creation, and metadata exposure
- **Debug Session Management**: Tests session configuration, launch parameter transformation, and state transitions
- **Command Generation Pipeline**: Verifies correct debugger command construction with proper ports, paths, and flags
- **Error Handling Framework**: Validates graceful failure scenarios and user-friendly error message translation

## Public API Surface and Entry Points

### Primary Test Interfaces
The test directory validates the complete public API surface of the adapter system:

- **Factory Interface Testing**: Adapter instantiation, environment validation, and capability reporting
- **Session Management Interface**: Debug session lifecycle, configuration transformation, and state management
- **Command Building Interface**: Platform-specific debugger command generation and parameter handling
- **Discovery Interface**: Runtime and toolchain discovery with version compatibility validation

### Test Execution Patterns
- **Smoke Testing Strategy**: Focus on critical integration points and real-world usage scenarios
- **Conditional Test Execution**: Platform-specific and runtime-dependent test tagging (e.g., `@requires-python`)
- **Extended Timeout Configuration**: Accommodation for real process spawning and network communication
- **Failure Diagnostics**: Automatic logging and error reporting for CI/CD debugging

## Internal Organization and Data Flow

### Test Execution Flow
1. **Environment Setup**: Mock configuration, dependency injection, and platform detection
2. **Adapter Factory Registration**: Language-specific adapter creation with controlled dependencies  
3. **Configuration Validation**: Launch parameter transformation and runtime override testing
4. **Command Generation Testing**: End-to-end debugger command building with platform-specific handling
5. **Integration Verification**: Complete workflow validation from factory through active debugging
6. **Environment Cleanup**: State restoration and mock reset for test isolation

### Testing Infrastructure Dependencies
- **Core MCP Components**: Client-server protocol testing and adapter interface validation
- **Language-Specific Toolchains**: Runtime discovery and debugger integration (Delve, js-debug, debugpy, CodeLLDB)
- **Platform Testing Libraries**: Cross-platform path handling, process simulation, and environment management
- **Mock Frameworks**: Sophisticated dependency injection and behavioral simulation

## Quality Assurance and Coverage

This directory ensures that all debugger adapters maintain:
- **Reliable Cross-Platform Operation**: Consistent behavior across Windows, Linux, and macOS
- **Robust Error Handling**: Graceful degradation and meaningful error reporting
- **Toolchain Compatibility**: Version detection and requirement validation for debugging dependencies
- **Session Reliability**: Proper debug session lifecycle management and state consistency
- **Integration Stability**: Seamless communication between adapters and debugging toolchains

The comprehensive test coverage provides confidence that the MCP debugger system can reliably support diverse development environments and debugging scenarios across all supported programming languages.
# tests/adapters/rust/integration/
@generated: 2026-02-09T18:16:07Z

## Overall Purpose
This directory contains integration tests for the Rust adapter's core functionality, specifically focusing on session management, command building, and launch configuration transformation. The tests validate adapter behavior without executing actual debugging processes, ensuring the Rust adapter correctly interfaces with CodeLLDB and configures debugging sessions.

## Key Components and Integration

### Test Infrastructure
- **Mock Dependencies**: Comprehensive dependency injection system that stubs file system operations, logging, and process launching while preserving environment access
- **Environment Management**: Isolated test environment with proper setup/teardown of environment variables (CODELLDB_PATH, RUST_BACKTRACE)
- **Cross-Platform Support**: Platform-specific handling for Windows vs Unix systems, particularly for LLDB configuration

### Core Test Coverage
The integration tests validate two critical adapter workflows:

1. **Command Building Pipeline**: Tests the complete command construction process from adapter configuration to executable CodeLLDB command with proper arguments (--port, --liblldb) and environment variables
2. **Launch Configuration Transformation**: Validates the conversion of Rust project configurations into LLDB-compatible launch configurations with correct path resolution and debugging parameters

### Test Patterns and Conventions
- **Safety-First Design**: Process launcher deliberately throws errors to prevent accidental process spawning during tests
- **Dependency Injection**: Mock implementations allow testing adapter logic without external dependencies
- **Environment Isolation**: Tests maintain clean environment state through proper setup/teardown procedures

## Public API Surface
The directory tests the Rust adapter's primary interface methods:
- `RustAdapterFactory.create()` - Adapter instantiation with dependency injection
- `adapter.buildAdapterCommand()` - Command construction for CodeLLDB execution
- `adapter.transformLaunchConfig()` - Launch configuration transformation for debugging sessions

## Internal Organization
Tests are organized around the adapter lifecycle:
1. **Setup Phase**: Mock dependency creation and environment configuration
2. **Command Building**: Validation of executable command construction with proper arguments and environment
3. **Configuration Transform**: Testing of launch configuration conversion for Rust binary debugging

## Critical Dependencies
- Requires example Rust projects (examples/rust/src/main.rs, examples/rust-hello) for realistic testing scenarios
- Depends on CodeLLDB path validation and executable existence checks
- Platform-specific LLDB configuration requirements (particularly Windows LLDB_USE_NATIVE_PDB_READER)

The integration tests ensure the Rust adapter can successfully bridge between VS Code debugging requests and the underlying CodeLLDB debugger while maintaining cross-platform compatibility and proper error handling.
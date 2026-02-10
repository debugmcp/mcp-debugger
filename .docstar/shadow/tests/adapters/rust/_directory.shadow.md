# tests/adapters/rust/
@generated: 2026-02-09T18:16:24Z

## Overall Purpose and Responsibility

The `tests/adapters/rust` directory contains comprehensive integration tests for the Rust debugging adapter, validating its core functionality in bridging VS Code debugging requests with the CodeLLDB debugger. This test suite ensures the adapter correctly handles session management, command construction, and launch configuration transformation without executing actual debugging processes.

## Key Components and Integration

### Test Architecture
The directory employs a sophisticated testing infrastructure built around:

- **Mock Dependency System**: Comprehensive dependency injection that stubs file system operations, logging, and process launching while preserving environment access
- **Environment Isolation**: Controlled test environment with proper setup/teardown of critical environment variables (CODELLDB_PATH, RUST_BACKTRACE)
- **Cross-Platform Validation**: Platform-specific testing for Windows vs Unix systems, particularly around LLDB configuration requirements

### Core Integration Workflows
The tests validate two critical adapter pipelines:

1. **Command Building Pipeline**: End-to-end testing of command construction from adapter configuration to executable CodeLLDB command with proper arguments (--port, --liblldb) and environment setup
2. **Launch Configuration Transformation**: Validation of converting Rust project configurations into LLDB-compatible launch configurations with accurate path resolution and debugging parameters

## Public API Surface

The test suite validates the Rust adapter's primary interface:

- **`RustAdapterFactory.create()`** - Adapter instantiation with dependency injection support
- **`adapter.buildAdapterCommand()`** - Command construction for CodeLLDB execution with proper argument handling
- **`adapter.transformLaunchConfig()`** - Launch configuration transformation for Rust binary debugging sessions

## Internal Organization and Data Flow

Tests follow the adapter lifecycle pattern:

1. **Setup Phase**: Mock dependency creation and environment configuration with safety guards
2. **Command Construction**: Validation of executable command building with platform-specific considerations
3. **Configuration Processing**: Testing launch configuration conversion for various Rust project scenarios

### Safety and Testing Patterns

- **Process Launch Prevention**: Mock process launcher deliberately prevents actual process spawning during tests
- **Realistic Test Scenarios**: Utilizes example Rust projects (examples/rust/src/main.rs, examples/rust-hello) for authentic testing
- **Dependency Validation**: Ensures CodeLLDB path validation and executable existence checks function correctly

## Important Dependencies and Context

The test suite relies on:
- Example Rust project structures for realistic debugging scenarios
- CodeLLDB path validation and availability checks
- Platform-specific LLDB configuration (Windows LLDB_USE_NATIVE_PDB_READER support)
- Proper environment variable management for cross-platform compatibility

This integration test directory serves as the quality gate ensuring the Rust adapter can successfully mediate between VS Code's debugging interface and the underlying CodeLLDB debugger while maintaining robust cross-platform support and comprehensive error handling.